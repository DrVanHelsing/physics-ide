import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  CreateAssignmentInputSchema,
  UpdateAssignmentInputSchema,
  SaveRuleSetInputSchema,
  MarkDraftInputSchema,
  GroupMarkDraftInputSchema,
  MarksReleaseInputSchema,
  MarkReturnInputSchema,
  computeAssignmentPhase,
} from "@physics-ide/shared";
import {
  assignments,
  assignmentWork,
  projectVersions,
  submissions,
  ruleSets,
  projects,
  classes,
  classMembers,
  groupMembers,
  groups,
  marks,
  users,
} from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import {
  ClassAuthError,
  getMembership,
  isStaffRole,
  requireClassStaff,
  requireClassTeacher,
  sendClassAuthError,
} from "../classes/guards.js";
import { logEvent } from "../db/events.js";
import type { Db } from "../db/types.js";
import { pgErrorCode, toEpoch, visibleToStudent } from "../lib/util.js";
import { stableStringify } from "./projects.js";
import { groupMembersOf, groupShape, myGroupFor } from "./groups.js";
import { submissionReceipt, dueReminder, marksReleased, workReturned } from "../email/templates.js";

type AssignmentRow = typeof assignments.$inferSelect;

const NOT_A_MEMBER = "Not a member of this class.";
const NO_SUCH_ASSIGNMENT = "No such assignment.";
const TEACHERS_ONLY = "Teachers only.";
const STARTER_LOCKED = "This assignment already has submissions — the starter is a starting point, not a mid-flight swap.";
/** The same shape as STARTER_LOCKED, one step earlier: the submission mode is
 *  a starting decision. Every work row is keyed either to a user or to a
 *  group, so flipping the mode after the first Start orphans what is already
 *  there and desynchronizes myWork, the inbox and the gradebook at once. */
const MODE_LOCKED = "Students have started — the submission mode is fixed once work exists.";
const RELEASED_RETURN_TEACHER_ONLY =
  "Only the class teacher can return a mark that has already been released.";
const NOT_OPEN = "This assignment is not open.";
const NO_SUCH_PROJECT = "No such project.";
const NOT_STARTED = "Start this assignment before submitting.";
const DUE_DATE_PASSED = "The due date has passed.";
const ASSIGNMENT_CLOSED = "This assignment is closed.";
const NO_SUCH_SUBMISSION = "No submission from this student.";
const NO_SUCH_STUDENT_WORK = "This student has not started this assignment.";
const NO_SUCH_STUDENT_IN_CLASS = "No such student in this class.";
const JOIN_A_GROUP_FIRST = "Join a group before starting this assignment.";
/* ── Task 23: group submit and the group mark (spec §5.5 / §7.3) ── */
const NO_SUCH_GROUP = "No such group.";
const NO_SUCH_GROUP_SUBMISSION = "No submission from this group.";
const NO_SUCH_GROUP_WORK = "This group has not started this assignment.";
const ADJUSTMENT_OUT_OF_RANGE = "That adjustment puts a member outside the assignment's own total.";
const ADJUSTMENT_NOT_A_MEMBER = "That adjustment names someone outside the group.";
// Same exact sentence as AssignmentPage.js's own gateSentence(phase) for the
// Start/Continue button — the two surfaces must agree (review finding).
const MARKS_RELEASED_CLOSED = "This assignment is closed — marks have been released.";

export function toAssignmentSummary(
  a: typeof assignments.$inferSelect,
  extras: Record<string, unknown> = {},
) {
  const phase = computeAssignmentPhase(a, new Date());
  return {
    id: a.id,
    classId: a.classId,
    title: a.title,
    projectType: a.projectType,
    points: a.points,
    submissionMode: a.submissionMode,
    individualWork: a.individualWork,
    phase,
    opensAt: toEpoch(a.opensAt),
    dueAt: toEpoch(a.dueAt),
    lateUntil: toEpoch(a.lateUntil),
    hasStarter: a.starterManifest != null,
    ...extras,
  };
}

/** Account-level teacher check (spec §3.1) — used by the rule-set routes, which
 *  are the teacher's own scratch space and not tied to any one class. */
function isTeacherAccount(user: { isTeacher: boolean; role: string }): boolean {
  return user.isTeacher || user.role === "admin";
}

async function assignmentHasSubmissions(db: Db, assignmentId: string): Promise<boolean> {
  const rows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.assignmentId, assignmentId))
    .limit(1);
  return rows.length > 0;
}

/** Anyone at all has pressed Start on this assignment. A submission implies a
 *  work row, so this is the wider of the two checks — but not by construction
 *  (a mark can be entered without one), so MODE_LOCKED reads both. */
async function assignmentHasWork(db: Db, assignmentId: string): Promise<boolean> {
  const rows = await db
    .select({ id: assignmentWork.id })
    .from(assignmentWork)
    .where(eq(assignmentWork.assignmentId, assignmentId))
    .limit(1);
  return rows.length > 0;
}

/** Re-runs Task 1's three cross-field checks against the row as it would
 *  read AFTER the patch is applied — same messages the create schema uses,
 *  since a merged row can violate them even when the patch body alone can't. */
function validateMergedDates(merged: {
  opensAt: number | null;
  dueAt: number | null;
  lateUntil: number | null;
  individualWork: boolean;
  submissionMode: string;
}): string | null {
  if (merged.opensAt != null && merged.dueAt != null && merged.dueAt <= merged.opensAt) {
    return "The due date must come after the open date.";
  }
  if (merged.lateUntil != null && (merged.dueAt == null || merged.lateUntil <= merged.dueAt)) {
    return "The late window must extend past the due date.";
  }
  if (merged.individualWork && merged.submissionMode !== "individual") {
    return "Individual work applies to individually-submitted assignments.";
  }
  return null;
}

async function loadAssignment(db: Db, id: string): Promise<AssignmentRow | null> {
  const rows = await db.select().from(assignments).where(eq(assignments.id, id));
  return rows[0] ?? null;
}

/** The two fields a member's own read needs from their work row. */
function toMyWork(row: (typeof assignmentWork.$inferSelect) | null | undefined) {
  return row ? { projectId: row.projectId, startedAt: row.startedAt.getTime() } : null;
}

async function myWorkFor(
  db: Db,
  assignmentId: string,
  userId: string,
): Promise<{ projectId: string; startedAt: number } | null> {
  return toMyWork(await myWorkRowFor(db, assignmentId, userId));
}

/** Pair/group mode keys the work row by the GROUP, not by the member — one
 *  shared row for the whole group (design D§2, plan Stage D). */
async function groupWorkFor(
  db: Db,
  assignmentId: string,
  groupId: string,
): Promise<typeof assignmentWork.$inferSelect | null> {
  const rows = await db
    .select()
    .from(assignmentWork)
    .where(and(eq(assignmentWork.assignmentId, assignmentId), eq(assignmentWork.groupId, groupId)));
  return rows[0] ?? null;
}

/** The body both /start branches read: the client's own already-pushed
 *  project id, which the FK on assignment_work points at. */
function readProjectId(body: unknown): string | null {
  const b = body as { projectId?: unknown } | null | undefined;
  return typeof b?.projectId === "string" && b.projectId.length > 0 ? b.projectId : null;
}

/** The caller must own a LIVE copy of the project they are linking — a
 *  tombstone or someone else's row is "No such project.", never a raw FK
 *  violation. */
async function ownsLiveProject(db: Db, ownerId: string, projectId: string): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.ownerId, ownerId), eq(projects.id, projectId), sql`${projects.deletedAt} IS NULL`),
    );
  return rows.length > 0;
}

/** The caller's full assignment_work row (not just the projectId/startedAt
 *  pair myWorkFor hands back) — submit needs ownerId too, to look up the
 *  linked project's current server-head row. */
async function myWorkRowFor(
  db: Db,
  assignmentId: string,
  userId: string,
): Promise<typeof assignmentWork.$inferSelect | null> {
  const rows = await db
    .select()
    .from(assignmentWork)
    .where(and(eq(assignmentWork.assignmentId, assignmentId), eq(assignmentWork.userId, userId)));
  return rows[0] ?? null;
}

/** Fiat D§11.2: a returned, unreleased mark reopens submission for that one
 *  student regardless of Closed — the teacher's Return is the authority,
 *  until marks release (computeAssignmentPhase then reads marks_released,
 *  which this override deliberately does not touch). Task 18 is what
 *  actually WRITES a returned mark; this branch just has to be ready. */
async function returnedUnreleasedMarkExists(db: Db, assignmentId: string, studentId: string): Promise<boolean> {
  const rows = await db
    .select({ id: marks.id })
    .from(marks)
    .where(
      and(
        eq(marks.assignmentId, assignmentId),
        eq(marks.studentId, studentId),
        eq(marks.returned, true),
        eq(marks.status, "draft"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** The same fiat for group work: a returned, unreleased mark on ANY member
 *  reopens the GROUP's submission — a return is written to every member at
 *  once (the group return route), and the work being sent back is the
 *  group's, not one person's. */
async function groupHasReturnedUnreleasedMark(db: Db, assignmentId: string, groupId: string): Promise<boolean> {
  const rows = await db
    .select({ id: marks.id })
    .from(marks)
    .innerJoin(groupMembers, eq(groupMembers.userId, marks.studentId))
    .where(
      and(
        eq(marks.assignmentId, assignmentId),
        eq(groupMembers.groupId, groupId),
        eq(marks.returned, true),
        eq(marks.status, "draft"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** The honest sentences a refused submit can show. `marks_released` gets
 *  its own (matching AssignmentPage.js's gateSentence for the Start
 *  button — the two surfaces must agree, review finding). Only the
 *  "closed" phase (not the unreachable-post-start scheduled/draft cases)
 *  splits further by cause: a teacher's manual Close, or the due date +
 *  late window simply having elapsed on their own. */
function submitRefusalMessage(a: AssignmentRow, phase: string, now: Date): string {
  if (phase === "marks_released") return MARKS_RELEASED_CLOSED;
  if (phase === "closed" && !(a.closedAt && a.closedAt <= now)) return DUE_DATE_PASSED;
  return ASSIGNMENT_CLOSED;
}

function toSubmissionSummary(row: typeof submissions.$inferSelect) {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    late: row.late,
    attempt: row.attempt,
    submittedAt: row.createdAt.getTime(),
  };
}

/** D§2's four seed fields, never the raw manifest — derived from the
 *  teacher's frozen starterManifest copy. */
function starterSeedFrom(
  starterManifest: unknown,
): { goal: string | null; workspaceXml: string; python: string; preferredEditor: string } | null {
  if (!starterManifest || typeof starterManifest !== "object") return null;
  const m = starterManifest as Record<string, unknown>;
  const workspace = m.workspace as Record<string, unknown> | undefined;
  const source = m.source as Record<string, unknown> | undefined;
  return {
    goal: typeof m.goal === "string" ? m.goal : null,
    workspaceXml: typeof workspace?.xml === "string" ? workspace.xml : "",
    python: typeof source?.python === "string" ? source.python : "",
    preferredEditor: typeof m.preferredEditor === "string" ? m.preferredEditor : "blocks",
  };
}

/** One mark row for (assignmentId, studentId), or undefined — the shared
 *  read every Task 18 surface (myMark, the marking-room read, release,
 *  return) starts from. */
async function loadMark(db: Db, assignmentId: string, studentId: string) {
  const rows = await db
    .select()
    .from(marks)
    .where(and(eq(marks.assignmentId, assignmentId), eq(marks.studentId, studentId)));
  return rows[0];
}

/** The TARGET of a mark must be an active student of the assignment's own
 *  class. The caller's own membership says nothing about whose row is being
 *  written: without this, a teacher of any class could create orphan mark
 *  rows against arbitrary user ids — and the return route would email
 *  teacher-supplied text to any account in the system. 404 rather than 403
 *  in this file's established idiom: the caller is entitled to be here, the
 *  student they named simply is not in this class. */
async function isMarkableStudent(db: Db, classId: string, studentId: string): Promise<boolean> {
  const m = await getMembership(db, classId, studentId);
  return !!m && m.status === "active" && m.role === "student";
}

/** The group named in the URL, but only if it belongs to THIS assignment.
 *  A group id from a different assignment is "No such group." rather than a
 *  route that quietly marks or reads the wrong people's work. */
async function groupOfAssignment(db: Db, assignmentId: string, groupId: string) {
  const rows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.assignmentId, assignmentId)));
  return rows[0] ?? null;
}

/** A group's CURRENT submission (spec §5.5 — one submission for the whole
 *  group, keyed by groupId with submitterId null). Same belt-and-braces
 *  ORDER BY my-submission uses: isCurrent is the invariant, attempt DESC is
 *  the deterministic fallback. */
async function currentGroupSubmission(db: Db, assignmentId: string, groupId: string) {
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.groupId, groupId),
        eq(submissions.isCurrent, true),
      ),
    )
    .orderBy(desc(submissions.attempt));
  return rows[0] ?? null;
}

/** The caller's own current submission — their row for individual work, their
 *  GROUP's row for pair/group work. Spec §5.5: "the assignment shows as
 *  submitted for all of them", so a member who never pressed Submit reads
 *  exactly what the member who did reads. */
async function currentSubmissionFor(
  db: Db,
  a: AssignmentRow,
  userId: string,
  group: { id: string } | null,
) {
  if (a.submissionMode !== "individual") {
    return group ? await currentGroupSubmission(db, a.id, group.id) : null;
  }
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, a.id),
        eq(submissions.submitterId, userId),
        eq(submissions.isCurrent, true),
      ),
    )
    .orderBy(desc(submissions.attempt));
  return rows[0] ?? null;
}

/** The student-facing submission shape, with the credit list named (§5.5's
 *  "the snapshot credits every member by name"). creditedIds order is join
 *  order and is preserved — the receipt and this page agree. */
async function toMySubmission(db: Db, row: typeof submissions.$inferSelect | null) {
  if (!row) return null;
  const ids = Array.isArray(row.creditedIds) ? (row.creditedIds as string[]) : [];
  const named = ids.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids))
    : [];
  const nameById = new Map(named.map((u) => [u.id, u.name]));
  return {
    ...toSubmissionSummary(row),
    credited: ids.map((id) => ({ userId: id, name: nameById.get(id) ?? "" })),
  };
}

/** The full staff shape — privateNote included, since every caller of this
 *  helper is already behind a staff-only gate (PUT/return/the marking
 *  room's submission read). Never handed to a student-facing route. */
function toMarkStaffShape(row: typeof marks.$inferSelect) {
  return {
    studentId: row.studentId,
    points: row.points,
    comment: row.comment,
    privateNote: row.privateNote,
    status: row.status,
    returned: row.returned,
    basedOnSubmissionId: row.basedOnSubmissionId,
    releasedAt: toEpoch(row.releasedAt),
  };
}

/** Every mark row belonging to a set of students on one assignment — the
 *  read behind a group's single mark (one row per member, spec §5.5). */
async function marksForStudents(db: Pick<Db, "select">, assignmentId: string, studentIds: string[]) {
  if (studentIds.length === 0) return [];
  return db
    .select()
    .from(marks)
    .where(and(eq(marks.assignmentId, assignmentId), inArray(marks.studentId, studentIds)));
}

/** THE single answer to "does this roster member currently have a
 *  submission" for one assignment — group-aware (spec §5.5: a group's
 *  submission credits every member). `inboxEntriesFor` below (GET /inbox,
 *  POST /remind) and the daily tick (tick.ts) both read through this
 *  instead of re-deriving it; task 24's review found three independent
 *  copies of this exact rule (this one, tick.ts's, and the semantically-
 *  narrower currentSubmissionFor above) had already grown from one design.
 *
 *  `byStudent`/`byGroup` carry the actual submission row — inboxEntriesFor
 *  needs late/attempt/when, not just yes-or-no. `hasSubmission` is the
 *  yes-or-no itself, for callers that only need to know who is missing
 *  one. Exactly one of `byStudent`/`byGroup` is ever populated, matching
 *  the assignment's own submissionMode. */
export type RosterSubmissionStatus = {
  groupByUser: Map<string, string>;
  byStudent: Map<string, typeof submissions.$inferSelect>;
  byGroup: Map<string, typeof submissions.$inferSelect>;
  hasSubmission: Set<string>;
};

export async function rosterSubmissionStatus(
  db: Pick<Db, "select">,
  a: AssignmentRow,
  rosterIds: string[],
): Promise<RosterSubmissionStatus> {
  if (a.submissionMode === "individual") {
    const subRows = rosterIds.length
      ? await db
          .select()
          .from(submissions)
          .where(
            and(
              eq(submissions.assignmentId, a.id),
              eq(submissions.isCurrent, true),
              inArray(submissions.submitterId, rosterIds),
            ),
          )
      : [];
    const byStudent = new Map(
      subRows
        .filter((s): s is typeof s & { submitterId: string } => !!s.submitterId)
        .map((s) => [s.submitterId, s]),
    );
    return { groupByUser: new Map(), byStudent, byGroup: new Map(), hasSubmission: new Set(byStudent.keys()) };
  }

  const memberRows = await db
    .select({ groupId: groupMembers.groupId, userId: groupMembers.userId })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groups.assignmentId, a.id));
  const groupByUser = new Map(memberRows.map((m) => [m.userId, m.groupId]));

  const groupIds = [...new Set(memberRows.map((m) => m.groupId))];
  const subRows = groupIds.length
    ? await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.assignmentId, a.id),
            eq(submissions.isCurrent, true),
            inArray(submissions.groupId, groupIds),
          ),
        )
    : [];
  const byGroup = new Map(
    subRows.filter((s): s is typeof s & { groupId: string } => !!s.groupId).map((s) => [s.groupId, s]),
  );

  const hasSubmission = new Set(
    rosterIds.filter((id) => {
      const groupId = groupByUser.get(id);
      return groupId != null && byGroup.has(groupId);
    }),
  );
  return { groupByUser, byStudent: new Map(), byGroup, hasSubmission };
}

/** The group's ONE mark, reassembled from its members' rows (spec §7.3:
 *  "shows all the members, sets one mark for the group, and allows a
 *  per-member adjustment"). Each row stores the member's FINAL total, so
 *  the group's own figure is `points - adjustment` — that subtraction is
 *  the whole reason `adjustment` is a stored column and not a transient
 *  input: a marker returning tomorrow must see both halves as they left
 *  them. Staff-only shape (privateNote included), same as toMarkStaffShape.
 *
 *  status/returned read from ALL the rows together because a group's rows
 *  move together (one PUT writes them all). A mixed set is only reachable
 *  through the per-student routes, and then the weaker claim is the honest
 *  one — never "released" while a member's row is still a draft. */
function toGroupMarkShape(
  groupId: string,
  members: Array<{ userId: string; name: string }>,
  markRows: (typeof marks.$inferSelect)[],
) {
  if (markRows.length === 0) return null;
  const byStudent = new Map(markRows.map((r) => [r.studentId, r]));
  const base = members.map((m) => byStudent.get(m.userId)).find((r) => !!r) ?? markRows[0];
  return {
    groupId,
    points: base.points == null ? null : base.points - base.adjustment,
    comment: base.comment,
    privateNote: base.privateNote,
    status: markRows.every((r) => r.status === "released") ? "released" : "draft",
    returned: markRows.every((r) => r.returned),
    basedOnSubmissionId: base.basedOnSubmissionId,
    releasedAt: toEpoch(base.releasedAt),
    members: members.map((m) => {
      const row = byStudent.get(m.userId);
      return {
        studentId: m.userId,
        name: m.name,
        adjustment: row?.adjustment ?? 0,
        points: row?.points ?? null,
      };
    }),
  };
}

/** The student's own read — released or returned rows only (drafts are
 *  staff-only business), and privateNote is never even read into the
 *  shape returned here (by construction, not by omission after the fact). */
function toMyMark(row: (typeof marks.$inferSelect) | undefined) {
  if (!row) return null;
  if (row.status !== "released" && !row.returned) return null;
  return {
    points: row.points,
    comment: row.comment,
    released: row.status === "released",
    returned: row.returned,
  };
}

export function assignmentRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/classes/:id/assignments", async (req, reply) => {
    const { id: classId } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const parsed = CreateAssignmentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const d = parsed.data;
    const created = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(assignments)
        .values({
          classId,
          createdBy: req.user!.id,
          title: d.title,
          instructions: d.instructions,
          projectType: d.projectType,
          points: d.points,
          submissionMode: d.submissionMode,
          individualWork: d.individualWork,
          rules: d.rules,
          opensAt: d.opensAt != null ? new Date(d.opensAt) : null,
          dueAt: d.dueAt != null ? new Date(d.dueAt) : null,
          lateUntil: d.lateUntil != null ? new Date(d.lateUntil) : null,
        })
        .returning();
      await logEvent(tx, "assignment.created", req.user!.id, { assignmentId: row.id, classId });
      return row;
    });
    return reply.code(201).send({ assignment: toAssignmentSummary(created) });
  });

  app.get("/api/classes/:id/assignments", async (req, reply) => {
    const { id: classId } = req.params as { id: string };
    const m = await getMembership(app.db, classId, req.user!.id);
    if (!m || m.status !== "active") {
      return reply.code(403).send({ error: NOT_A_MEMBER });
    }
    const rows = await app.db.select().from(assignments).where(eq(assignments.classId, classId));

    if (!isStaffRole(m.role)) {
      return { assignments: rows.filter(visibleToStudent).map((a) => toAssignmentSummary(a)) };
    }

    const ids = rows.map((a) => a.id);
    const counts = ids.length
      ? await app.db
          .select({ assignmentId: submissions.assignmentId, count: sql<number>`count(*)::int` })
          .from(submissions)
          .where(and(inArray(submissions.assignmentId, ids), eq(submissions.isCurrent, true)))
          .groupBy(submissions.assignmentId)
      : [];
    const countByAssignment = new Map(counts.map((c) => [c.assignmentId, c.count]));
    return {
      assignments: rows.map((a) =>
        toAssignmentSummary(a, { submittedCount: countByAssignment.get(a.id) ?? 0 }),
      ),
    };
  });

  app.get("/api/assignments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active") {
      return reply.code(403).send({ error: NOT_A_MEMBER });
    }
    const staff = isStaffRole(m.role);
    if (!staff && !visibleToStudent(a)) {
      return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    }
    // Carry-forward from Task 3: myWork is userId-keyed, but a pair/group
    // assignment's work row is keyed by the GROUP — resolved through the
    // caller's membership, or every member after the founding one would
    // read "not started" on work that is plainly under way.
    const group = a.submissionMode === "individual" ? null : await myGroupFor(app.db, id, req.user!.id);
    const myWork = group
      ? toMyWork(await groupWorkFor(app.db, id, group.id))
      : await myWorkFor(app.db, id, req.user!.id);
    // rules reach every member here (spec: it's the teacher LIST view, not
    // the detail, that omits them for brevity — a member must know their
    // own workspace constraints).
    const phase = computeAssignmentPhase(a, new Date());
    const starterSeed =
      (phase === "open" || phase === "late_window") && !myWork
        ? starterSeedFrom(a.starterManifest)
        : null;
    // Task 18: myMark — released or returned rows only. A plain draft is
    // staff-only business and must never surface here; toMyMark enforces
    // that by construction (privateNote is never even read into the shape).
    const myMark = toMyMark(await loadMark(app.db, id, req.user!.id));
    // Task 23: what has actually been handed in — the caller's own row, or
    // their GROUP's (spec §5.5's "submitted for all of them", which has to
    // be true for the member who never pressed the button).
    const mySubmission = await toMySubmission(
      app.db,
      await currentSubmissionFor(app.db, a, req.user!.id, group),
    );
    const extras: Record<string, unknown> = {
      instructions: a.instructions,
      rules: a.rules,
      myWork,
      myGroup: group ? await groupShape(app.db, group) : null,
      starterSeed,
      myMark,
      mySubmission,
    };
    return { assignment: toAssignmentSummary(a, extras) };
  });

  // Start (or continue) work — design D§2: the server is the authority; the
  // link (assignment_work) is created here, once the client's private copy
  // has already been pushed so the FK below has a row to point at.

  app.post("/api/assignments/:id/start", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active") {
      return reply.code(403).send({ error: NOT_A_MEMBER });
    }
    const phase = computeAssignmentPhase(a, new Date());
    if (phase !== "open" && phase !== "late_window") {
      return reply.code(400).send({ error: NOT_OPEN });
    }
    // Pair/group mode: one shared row for the whole group (plan Stage D).
    // The FIRST member to start supplies their own already-pushed project
    // exactly as an individual does — it becomes the group's shared project,
    // owned by their account, because `projects` is keyed by a real user and
    // there is no group account to hang it on. Every later member simply
    // adopts that row, which is why the body is only read when there isn't
    // one yet: a second member has nothing of their own to offer.
    if (a.submissionMode !== "individual") {
      const group = await myGroupFor(app.db, id, req.user!.id);
      if (!group) return reply.code(400).send({ error: JOIN_A_GROUP_FIRST });

      const existingGroupWork = await groupWorkFor(app.db, id, group.id);
      if (existingGroupWork) {
        return reply.code(200).send({ work: { projectId: existingGroupWork.projectId } });
      }

      const groupProjectId = readProjectId(req.body);
      if (!groupProjectId) return reply.code(400).send({ error: "Invalid input." });
      if (!(await ownsLiveProject(app.db, req.user!.id, groupProjectId))) {
        return reply.code(404).send({ error: NO_SUCH_PROJECT });
      }

      try {
        await app.db.transaction(async (tx) => {
          // The work row goes in FIRST: its unique (assignment, group)
          // constraint is what settles a race between two members starting
          // at the same instant, and the loser's group stamp rolls back
          // with it rather than disagreeing with the row that survived.
          await tx.insert(assignmentWork).values({
            assignmentId: id,
            groupId: group.id,
            ownerId: req.user!.id,
            projectId: groupProjectId,
          });
          await tx
            .update(groups)
            .set({ ownerId: req.user!.id, projectId: groupProjectId })
            .where(eq(groups.id, group.id));
          await logEvent(tx, "assignment.started", req.user!.id, {
            assignmentId: id,
            groupId: group.id,
            projectId: groupProjectId,
          });
        });
      } catch (err) {
        if (pgErrorCode(err) === "23505") {
          const winner = await groupWorkFor(app.db, id, group.id);
          if (winner) return reply.code(200).send({ work: { projectId: winner.projectId } });
        }
        throw err;
      }
      return reply.code(201).send({ work: { projectId: groupProjectId } });
    }

    const projectId = readProjectId(req.body);
    if (!projectId) {
      return reply.code(400).send({ error: "Invalid input." });
    }

    // Idempotent: a second start returns the row that already exists rather
    // than racing the unique (assignment, user) constraint.
    const existing = await myWorkFor(app.db, id, req.user!.id);
    if (existing) {
      return reply.code(200).send({ work: { projectId: existing.projectId } });
    }

    if (!(await ownsLiveProject(app.db, req.user!.id, projectId))) {
      return reply.code(404).send({ error: NO_SUCH_PROJECT });
    }

    try {
      await app.db.transaction(async (tx) => {
        await tx.insert(assignmentWork).values({
          assignmentId: id,
          userId: req.user!.id,
          ownerId: req.user!.id,
          projectId,
        });
        await logEvent(tx, "assignment.started", req.user!.id, { assignmentId: id, projectId });
      });
    } catch (err) {
      // The pre-check above is TOCTOU under true concurrency — two genuinely
      // simultaneous first-time starts can both pass it. The unique
      // (assignmentId, userId) constraint is the real guard: whichever
      // insert loses that race hands back the winner's row, same as the
      // sequential idempotent path above, instead of a raw 500.
      if (pgErrorCode(err) === "23505") {
        const winner = await myWorkFor(app.db, id, req.user!.id);
        if (winner) return reply.code(200).send({ work: { projectId: winner.projectId } });
      }
      throw err;
    }

    return reply.code(201).send({ work: { projectId } });
  });

  app.patch("/api/assignments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassTeacher(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const parsed = UpdateAssignmentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const d = parsed.data;
    const merged = {
      opensAt: d.opensAt !== undefined ? d.opensAt : toEpoch(a.opensAt),
      dueAt: d.dueAt !== undefined ? d.dueAt : toEpoch(a.dueAt),
      lateUntil: d.lateUntil !== undefined ? d.lateUntil : toEpoch(a.lateUntil),
      individualWork: d.individualWork !== undefined ? d.individualWork : a.individualWork,
      submissionMode: d.submissionMode !== undefined ? d.submissionMode : a.submissionMode,
    };
    const dateError = validateMergedDates(merged);
    if (dateError) return reply.code(400).send({ error: dateError });

    // The submission mode is a starting decision (see MODE_LOCKED). Only an
    // actual CHANGE is refused — re-sending the value the row already holds
    // is what an edit form that posts every field does, and it changes
    // nothing, so it stays accepted alongside title, points and the dates.
    const changesMode =
      merged.submissionMode !== a.submissionMode || merged.individualWork !== a.individualWork;
    if (
      changesMode &&
      ((await assignmentHasWork(app.db, id)) || (await assignmentHasSubmissions(app.db, id)))
    ) {
      return reply.code(400).send({ error: MODE_LOCKED });
    }

    const patch: Partial<typeof assignments.$inferInsert> = {};
    if (d.title !== undefined) patch.title = d.title;
    if (d.instructions !== undefined) patch.instructions = d.instructions;
    if (d.projectType !== undefined) patch.projectType = d.projectType;
    if (d.points !== undefined) patch.points = d.points;
    if (d.submissionMode !== undefined) patch.submissionMode = d.submissionMode;
    if (d.individualWork !== undefined) patch.individualWork = d.individualWork;
    if (d.rules !== undefined) patch.rules = d.rules;
    if (d.opensAt !== undefined) patch.opensAt = d.opensAt != null ? new Date(d.opensAt) : null;
    if (d.dueAt !== undefined) patch.dueAt = d.dueAt != null ? new Date(d.dueAt) : null;
    if (d.lateUntil !== undefined) patch.lateUntil = d.lateUntil != null ? new Date(d.lateUntil) : null;

    if (Object.keys(patch).length === 0) return { assignment: toAssignmentSummary(a) };

    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .update(assignments)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(assignments.id, id))
        .returning();
      await logEvent(tx, "assignment.updated", req.user!.id, { assignmentId: id, patch: d });
      return row;
    });
    return { assignment: toAssignmentSummary(updated) };
  });

  app.post("/api/assignments/:id/publish", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassTeacher(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (a.status !== "draft") {
      return reply.code(400).send({ error: "Only a draft can be published." });
    }
    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .update(assignments)
        .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(assignments.id, id))
        .returning();
      await logEvent(tx, "assignment.published", req.user!.id, { assignmentId: id });
      return row;
    });
    return { assignment: toAssignmentSummary(updated) };
  });

  app.post("/api/assignments/:id/close", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassTeacher(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (a.status === "draft") {
      return reply.code(400).send({ error: "A draft has nothing to close — publish it first." });
    }
    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .update(assignments)
        .set({ closedAt: new Date(), updatedAt: new Date() })
        .where(eq(assignments.id, id))
        .returning();
      await logEvent(tx, "assignment.closed", req.user!.id, { assignmentId: id });
      return row;
    });
    return { assignment: toAssignmentSummary(updated) };
  });

  app.delete("/api/assignments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassTeacher(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    // A published assignment closes; it never disappears (spec §5.1).
    if (a.status !== "draft") {
      return reply.code(400).send({ error: "A published assignment can only be closed, not deleted." });
    }
    await app.db.transaction(async (tx) => {
      await tx.delete(assignments).where(eq(assignments.id, id));
      await logEvent(tx, "assignment.deleted", req.user!.id, { assignmentId: id, classId: a.classId });
    });
    return reply.code(204).send();
  });

  // Rule sets: a teacher's saved custom workspace-rule combinations (spec §5.4).
  // Account-scoped, not class-scoped — a teacher's own reusable presets.

  app.get("/api/rule-sets", async (req, reply) => {
    if (!isTeacherAccount(req.user!)) {
      return reply.code(403).send({ error: TEACHERS_ONLY });
    }
    const rows = await app.db.select().from(ruleSets).where(eq(ruleSets.ownerId, req.user!.id));
    return { ruleSets: rows.map((r) => ({ id: r.id, name: r.name, rules: r.rules })) };
  });

  app.post("/api/rule-sets", async (req, reply) => {
    if (!isTeacherAccount(req.user!)) {
      return reply.code(403).send({ error: TEACHERS_ONLY });
    }
    const parsed = SaveRuleSetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const d = parsed.data;
    const saved = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(ruleSets)
        .values({ ownerId: req.user!.id, name: d.name, rules: d.rules })
        .onConflictDoUpdate({
          target: [ruleSets.ownerId, ruleSets.name],
          set: { rules: d.rules },
        })
        .returning();
      await logEvent(tx, "ruleset.saved", req.user!.id, { ruleSetId: row.id, name: row.name });
      return row;
    });
    return reply.code(201).send({ ruleSet: { id: saved.id, name: saved.name, rules: saved.rules } });
  });

  app.delete("/api/rule-sets/:id", async (req, reply) => {
    if (!isTeacherAccount(req.user!)) {
      return reply.code(403).send({ error: TEACHERS_ONLY });
    }
    const { id } = req.params as { id: string };
    const deleted = await app.db.transaction(async (tx) => {
      const rows = await tx
        .delete(ruleSets)
        .where(and(eq(ruleSets.id, id), eq(ruleSets.ownerId, req.user!.id)))
        .returning();
      if (rows[0]) await logEvent(tx, "ruleset.deleted", req.user!.id, { ruleSetId: id });
      return rows[0];
    });
    if (!deleted) return reply.code(404).send({ error: "No such rule set." });
    return reply.code(204).send();
  });

  // Starter pinning: a frozen copy of the teacher's own project manifest,
  // used as the workspace's starting point (spec §5.1, design D§6).

  app.post("/api/assignments/:id/starter", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassTeacher(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const body = req.body as { projectId?: unknown };
    if (typeof body?.projectId !== "string" || body.projectId.length === 0) {
      return reply.code(400).send({ error: "Invalid input." });
    }
    if (await assignmentHasSubmissions(app.db, id)) {
      return reply.code(400).send({ error: STARTER_LOCKED });
    }
    const projectRows = await app.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.ownerId, req.user!.id),
          eq(projects.id, body.projectId),
          sql`${projects.deletedAt} IS NULL`,
        ),
      );
    const project = projectRows[0];
    if (!project) return reply.code(404).send({ error: "No such project." });

    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .update(assignments)
        .set({ starterManifest: project.manifest, updatedAt: new Date() })
        .where(eq(assignments.id, id))
        .returning();
      await logEvent(tx, "assignment.starter_pinned", req.user!.id, {
        assignmentId: id,
        projectId: body.projectId,
      });
      return row;
    });
    return { assignment: toAssignmentSummary(updated) };
  });

  app.delete("/api/assignments/:id/starter", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassTeacher(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (await assignmentHasSubmissions(app.db, id)) {
      return reply.code(400).send({ error: STARTER_LOCKED });
    }
    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .update(assignments)
        .set({ starterManifest: null, updatedAt: new Date() })
        .where(eq(assignments.id, id))
        .returning();
      await logEvent(tx, "assignment.starter_cleared", req.user!.id, { assignmentId: id });
      return row;
    });
    return { assignment: toAssignmentSummary(updated) };
  });

  /* ── Task 15: upcoming ── */
  // The Home strip: what's due soon and what feedback just landed. Reads
  // only the caller's own state — no class-teacher gate, every confirmed
  // member sees their own rows.
  app.get("/api/assignments/upcoming", async (req) => {
    const userId = req.user!.id;
    const now = new Date();
    const nowMs = now.getTime();
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    const activeClasses = await app.db
      .select({ id: classes.id, name: classes.name })
      .from(classMembers)
      .innerJoin(classes, eq(classMembers.classId, classes.id))
      .where(
        and(
          eq(classMembers.userId, userId),
          eq(classMembers.status, "active"),
          eq(classes.archived, false),
        ),
      );

    let dueSoon: Array<{
      assignmentId: string;
      classId: string;
      className: string;
      title: string;
      dueAt: number;
      submitted: boolean;
    }> = [];

    if (activeClasses.length > 0) {
      const classIds = activeClasses.map((c) => c.id);
      const classNameById = new Map(activeClasses.map((c) => [c.id, c.name]));
      const rows = await app.db
        .select()
        .from(assignments)
        .where(and(inArray(assignments.classId, classIds), eq(assignments.status, "published")));

      const windowEndMs = nowMs + FOURTEEN_DAYS_MS;
      const candidates = rows.filter((a) => {
        if (a.dueAt == null) return false;
        const phase = computeAssignmentPhase(a, now);
        // Already due but still in the late window is urgency by itself —
        // that state is already bounded by lateUntil, so the 14-day lookahead
        // only applies to the still-open, not-yet-due case.
        if (phase === "late_window") return true;
        if (phase !== "open") return false;
        return a.dueAt.getTime() <= windowEndMs;
      });

      const candidateIds = candidates.map((a) => a.id);
      const submittedRows = candidateIds.length
        ? await app.db
            .select({ assignmentId: submissions.assignmentId })
            .from(submissions)
            .where(
              and(
                inArray(submissions.assignmentId, candidateIds),
                eq(submissions.submitterId, userId),
                eq(submissions.isCurrent, true),
              ),
            )
        : [];
      // Task 23: a group's submission counts for every member (spec §5.5's
      // "the assignment shows as submitted for all of them") — without this
      // the strip nags the member who did not press the button.
      const groupSubmittedRows = candidateIds.length
        ? await app.db
            .select({ assignmentId: submissions.assignmentId })
            .from(submissions)
            .innerJoin(groupMembers, eq(groupMembers.groupId, submissions.groupId))
            .where(
              and(
                inArray(submissions.assignmentId, candidateIds),
                eq(groupMembers.userId, userId),
                eq(submissions.isCurrent, true),
              ),
            )
        : [];
      const submittedSet = new Set(
        [...submittedRows, ...groupSubmittedRows].map((s) => s.assignmentId),
      );

      dueSoon = candidates
        .map((a) => ({
          assignmentId: a.id,
          classId: a.classId,
          className: classNameById.get(a.classId) ?? "",
          title: a.title,
          dueAt: a.dueAt!.getTime(),
          submitted: submittedSet.has(a.id),
        }))
        .sort((x, y) => x.dueAt - y.dueAt);
    }

    const feedbackWindowStart = new Date(nowMs - FOURTEEN_DAYS_MS);
    const feedbackRows = await app.db
      .select({
        assignmentId: marks.assignmentId,
        classId: assignments.classId,
        title: assignments.title,
        releasedAt: marks.releasedAt,
      })
      .from(marks)
      .innerJoin(assignments, eq(marks.assignmentId, assignments.id))
      .where(
        and(
          eq(marks.studentId, userId),
          eq(marks.status, "released"),
          gte(marks.releasedAt, feedbackWindowStart),
        ),
      );

    const recentFeedback = feedbackRows
      .map((r) => ({
        assignmentId: r.assignmentId,
        classId: r.classId,
        title: r.title,
        releasedAt: toEpoch(r.releasedAt),
      }))
      .sort((x, y) => (y.releasedAt ?? 0) - (x.releasedAt ?? 0));

    return { dueSoon, recentFeedback };
  });

  /* ── Task 14: submit (Task 23: the group branch) ── */
  // The frozen snapshot: submit reads the LINKED project's current
  // server-head manifest (never a client-uploaded copy — the client pushes
  // first, per the design, so the server head already IS what the student
  // sees by the time this runs), fingerprints it, and files it as the new
  // current attempt in one transaction.
  //
  // Pair/group work (spec §5.5) takes the same path with three differences,
  // all of them about WHOSE work this is: the linked row is the GROUP's, the
  // submission carries groupId instead of submitterId, and `creditedIds` is
  // every member — "any member can press Submit; the snapshot credits every
  // member by name, every member gets the receipt email".

  app.post("/api/assignments/:id/submit", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active") {
      return reply.code(403).send({ error: NOT_A_MEMBER });
    }

    // Same resolution /start does: a pair/group assignment's work row is
    // keyed by the group, so an ungrouped member has not started and cannot
    // start — the honest next step is the one /start names, not "submit".
    const group = a.submissionMode === "individual" ? null : await myGroupFor(app.db, id, req.user!.id);
    if (a.submissionMode !== "individual" && !group) {
      return reply.code(400).send({ error: JOIN_A_GROUP_FIRST });
    }

    const work = group
      ? await groupWorkFor(app.db, id, group.id)
      : await myWorkRowFor(app.db, id, req.user!.id);
    if (!work) return reply.code(400).send({ error: NOT_STARTED });

    const now = new Date();
    const phase = computeAssignmentPhase(a, now);
    let allowed = phase === "open" || phase === "late_window";
    if (!allowed && phase === "closed") {
      // Fiat D§11.2 — a returned, unreleased mark reopens work regardless of
      // Closed, until marks release. For a group that is any member's row:
      // the work sent back is the group's.
      allowed = group
        ? await groupHasReturnedUnreleasedMark(app.db, id, group.id)
        : await returnedUnreleasedMarkExists(app.db, id, req.user!.id);
    }
    if (!allowed) {
      return reply.code(400).send({ error: submitRefusalMessage(a, phase, now) });
    }

    // Fiat D§11.4 — late is computed against the dates in force AT SUBMIT
    // TIME (the `a` row was just loaded fresh above), never retroactively
    // re-stamped if the teacher moves dates later.
    const late = a.dueAt != null && now.getTime() >= a.dueAt.getTime();

    const created = await app.db.transaction(async (tx) => {
      // Lock this student's assignment_work row FIRST — it becomes the
      // serialization mutex for the whole submit critical section (same
      // FOR UPDATE idiom as projects.ts's isAtCap). Two genuinely
      // concurrent submits for the SAME student now execute this block
      // ONE AT A TIME: the second blocks here until the first commits,
      // then re-reads the now-current state — the same guarantee that
      // makes /start's own race safe, but via a row lock instead of a
      // unique-constraint-then-catch, since submissions carries no unique
      // constraint to catch on (review finding: the isCurrent invariant
      // does not self-correct without this).
      const workRows = await tx
        .select()
        .from(assignmentWork)
        .where(
          and(
            eq(assignmentWork.assignmentId, id),
            group ? eq(assignmentWork.groupId, group.id) : eq(assignmentWork.userId, req.user!.id),
          ),
        )
        .for("update");
      const lockedWork = workRows[0];
      if (!lockedWork) return { kind: "not-started" as const };

      // The server-head read happens under the SAME lock, inside the SAME
      // transaction as the flip+insert below — "snapshots the CURRENT
      // SERVER HEAD manifest ... inside ONE transaction" is the brief's own
      // wording; reading it outside the tx would leave a gap where a
      // genuinely concurrent push could land unreflected.
      const projectRows = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, lockedWork.ownerId), eq(projects.id, lockedWork.projectId)));
      const project = projectRows[0];
      if (!project) return { kind: "no-project" as const };

      const manifest = project.manifest;
      const fingerprint = crypto.createHash("sha256").update(stableStringify(manifest)).digest("hex");

      // The credit list, read under the same lock that serialises the
      // submit: membership is frozen the moment a submission exists
      // (groups.ts refuses join and leave after one), so what this reads is
      // what the receipt can go on claiming forever.
      const members = group ? await groupMembersOf(tx, group.id) : [];

      const priorRows = await tx
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.assignmentId, id),
            group ? eq(submissions.groupId, group.id) : eq(submissions.submitterId, req.user!.id),
          ),
        );
      const maxAttempt = priorRows.reduce((max, r) => Math.max(max, r.attempt), 0);
      const currentRow = priorRows.find((r) => r.isCurrent);
      if (currentRow) {
        await tx.update(submissions).set({ isCurrent: false }).where(eq(submissions.id, currentRow.id));
      }
      const [row] = await tx
        .insert(submissions)
        .values({
          assignmentId: id,
          // Exactly one of these is set, the same split assignment_work uses.
          submitterId: group ? null : req.user!.id,
          groupId: group ? group.id : null,
          submittedBy: req.user!.id,
          creditedIds: group ? members.map((mm) => mm.userId) : [req.user!.id],
          manifest,
          fingerprint,
          late,
          isCurrent: true,
          attempt: maxAttempt + 1,
        })
        .returning();
      await logEvent(tx, "assignment.submitted", req.user!.id, {
        assignmentId: id,
        submissionId: row.id,
        attempt: row.attempt,
        late,
        groupId: group ? group.id : null,
      });
      return { kind: "submitted" as const, row, members };
    });

    // Neither branch is reachable in practice today (the pre-tx checks
    // above already proved a work row exists, and the client pushes the
    // project before POSTing) — handled honestly rather than assumed away.
    if (created.kind === "not-started") return reply.code(400).send({ error: NOT_STARTED });
    if (created.kind === "no-project") return reply.code(404).send({ error: NO_SUCH_PROJECT });

    const classRows = await app.db.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
    const mail = submissionReceipt({
      title: a.title,
      className: classRows[0]?.name ?? "",
      submittedAt: now.toISOString(),
      attempt: created.row.attempt,
      fingerprint: created.row.fingerprint,
      // Group work: the receipt names who it was credited to, so a member who
      // did not press the button knows what was handed in on their behalf.
      credited: group ? created.members.map((mm) => mm.name) : null,
    });
    // One email per credited user — the submitter alone for individual work,
    // every member for a group (spec §5.5). Fans out AFTER the transaction
    // commits, the same discipline remind and marks release both use.
    const recipients = group
      ? created.members.map((mm) => ({ id: mm.userId, email: mm.email }))
      : [{ id: req.user!.id, email: req.user!.email }];
    for (const r of recipients) {
      await app.mailer.send({
        to: r.email,
        toUserId: r.id,
        template: "submission-receipt",
        ...mail,
      });
    }

    return reply.code(201).send({ submission: toSubmissionSummary(created.row) });
  });

  // The caller's own current submission, if any — read-only, no class-teacher
  // gate (every confirmed member reads their own row, same posture as the
  // upcoming strip above).
  app.get("/api/assignments/:id/my-submission", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active") {
      return reply.code(403).send({ error: NOT_A_MEMBER });
    }
    // Belt-and-braces ORDER BY (review finding): the isCurrent invariant is
    // now enforced by the submit route's FOR UPDATE mutex, but this read
    // stays deterministic even if that were ever violated — attempt DESC
    // picks the latest, never an arbitrary row-order pick. Task 23: group
    // work resolves through the caller's group, the same way the detail
    // read does — one resolver, so the two can never disagree.
    const group = a.submissionMode === "individual" ? null : await myGroupFor(app.db, id, req.user!.id);
    const row = await currentSubmissionFor(app.db, a, req.user!.id, group);
    return { submission: row ? toSubmissionSummary(row) : null };
  });

  /* ── Task 16: inbox ── */
  // The teacher's (and TA's) roster-wide view of one assignment: every
  // active student, submitted or missing, their mark status, and a
  // one-click reminder for whoever hasn't turned it in yet. GET is staff
  // (teacher + TA); the reminder itself is teacher-only.

  type InboxEntry = {
    /** Task 23: a group assignment's row IS the group (spec §5.5 — one
     *  submission, one mark, all the members). Individual work is unchanged
     *  and always "student". */
    kind: "student" | "group";
    studentId: string | null;
    groupId: string | null;
    name: string;
    members: Array<{ userId: string; name: string }>;
    /** Internal only — who a reminder actually reaches. Never serialized. */
    recipients: Array<{ id: string; name: string; email: string }>;
    state: "submitted" | "missing";
    late: boolean;
    submittedAt: number | null;
    attempt: number | null;
    markStatus: "none" | "draft" | "released";
  };

  /** One group's mark status from its members' rows: released only once
   *  every member's is (a half-released group is still being worked on). */
  function markStatusOf(rows: (typeof marks.$inferSelect)[]): InboxEntry["markStatus"] {
    if (rows.length === 0) return "none";
    return rows.every((r) => r.status === "released") ? "released" : "draft";
  }

  /** Fiat D§11.1: "missing" is an active roster student with no CURRENT
   *  submission — one join, roster (active students) ← submissions(current)
   *  ← marks, shared by both the read (GET /inbox) and the write
   *  (POST /remind, which only needs the "missing" half of it).
   *
   *  Task 23 — pair/group work: the unit is the GROUP, so the roster is
   *  rolled up into one row per group with its members named. A rostered
   *  student who never joined a group still gets a row of their own: they
   *  have nothing to hand in and are exactly who the reminder is for. */
  async function inboxEntriesFor(db: Db, a: AssignmentRow): Promise<InboxEntry[]> {
    const roster = await db
      .select({ user: users })
      .from(classMembers)
      .innerJoin(users, eq(classMembers.userId, users.id))
      .where(
        and(
          eq(classMembers.classId, a.classId),
          eq(classMembers.status, "active"),
          eq(classMembers.role, "student"),
        ),
      );
    const studentIds = roster.map((r) => r.user.id);
    const markRows = await marksForStudents(db, a.id, studentIds);
    const markByStudent = new Map(markRows.map((m) => [m.studentId, m]));
    // Task 24 fix round 1: the one shared "has this student submitted"
    // derivation — also consumed by the daily tick (tick.ts).
    const status = await rosterSubmissionStatus(db, a, studentIds);

    const groupEntries: InboxEntry[] = [];
    const groupedStudentIds = new Set<string>();

    if (a.submissionMode !== "individual") {
      const groupRows = await db
        .select()
        .from(groups)
        .where(eq(groups.assignmentId, a.id))
        .orderBy(groups.createdAt);
      const memberRows = groupRows.length
        ? await db
            .select({ groupId: groupMembers.groupId, userId: groupMembers.userId, name: users.name, email: users.email })
            .from(groupMembers)
            .innerJoin(users, eq(groupMembers.userId, users.id))
            .where(inArray(groupMembers.groupId, groupRows.map((g) => g.id)))
            .orderBy(groupMembers.createdAt)
        : [];
      const membersByGroup = new Map<string, typeof memberRows>();
      for (const row of memberRows) {
        const list = membersByGroup.get(row.groupId) ?? [];
        list.push(row);
        membersByGroup.set(row.groupId, list);
        groupedStudentIds.add(row.userId);
      }

      const rosterIds = new Set(studentIds);
      for (const g of groupRows) {
        const members = membersByGroup.get(g.id) ?? [];
        const sub = status.byGroup.get(g.id);
        groupEntries.push({
          kind: "group",
          studentId: null,
          groupId: g.id,
          name: g.name,
          members: members.map((mm) => ({ userId: mm.userId, name: mm.name })),
          // A member who has since left the class is still named on the row
          // (they are in the credit list) but is never emailed by it.
          recipients: members
            .filter((mm) => rosterIds.has(mm.userId))
            .map((mm) => ({ id: mm.userId, name: mm.name, email: mm.email })),
          state: sub ? "submitted" : "missing",
          late: sub ? sub.late : false,
          submittedAt: sub ? sub.createdAt.getTime() : null,
          attempt: sub ? sub.attempt : null,
          markStatus: markStatusOf(
            members.map((mm) => markByStudent.get(mm.userId)).filter((r) => !!r),
          ),
        });
      }
    }

    const studentEntries = roster
      .filter(({ user }) => !groupedStudentIds.has(user.id))
      .map(({ user }): InboxEntry => {
        const sub = status.byStudent.get(user.id);
        const mark = markByStudent.get(user.id);
        return {
          kind: "student",
          studentId: user.id,
          groupId: null,
          name: user.name,
          members: [],
          recipients: [{ id: user.id, name: user.name, email: user.email }],
          state: sub ? "submitted" : "missing",
          late: sub ? sub.late : false,
          submittedAt: sub ? sub.createdAt.getTime() : null,
          attempt: sub ? sub.attempt : null,
          markStatus: markStatusOf(mark ? [mark] : []),
        };
      });

    return [...groupEntries, ...studentEntries].sort((x, y) => x.name.localeCompare(y.name));
  }

  /** The public row shape (cross-lane contract, Task 17 consumes it) —
   *  `recipients` above is internal-only, never serialized. */
  function toInboxRow(e: InboxEntry) {
    return {
      kind: e.kind,
      studentId: e.studentId,
      groupId: e.groupId,
      name: e.name,
      members: e.members,
      state: e.state,
      late: e.late,
      submittedAt: e.submittedAt,
      attempt: e.attempt,
      markStatus: e.markStatus,
    };
  }

  app.get("/api/assignments/:id/inbox", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassStaff(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const entries = await inboxEntriesFor(app.db, a);
    return {
      phase: computeAssignmentPhase(a, new Date()),
      rows: entries.map(toInboxRow),
    };
  });

  app.post("/api/assignments/:id/remind", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassTeacher(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }

    const entries = await inboxEntriesFor(app.db, a);
    // People, not rows: one missing GROUP row owes a reminder to each of its
    // members (spec §5.5), so the count the teacher is shown — and the one
    // the confirm dialog promised — is how many emails actually go out.
    const missing = new Map<string, { id: string; name: string; email: string }>();
    for (const e of entries) {
      if (e.state !== "missing") continue;
      for (const r of e.recipients) missing.set(r.id, r);
    }
    const recipients = [...missing.values()];

    // The audit record is the durable fact; it lands in its own small
    // transaction the same weight as this file's other single-write routes
    // (publish/close/etc). Email is best-effort ON TOP of that fact, so it
    // runs AFTER the tx commits — same ordering submit's own receipt uses.
    await app.db.transaction(async (tx) => {
      await logEvent(tx, "assignment.reminded", req.user!.id, {
        assignmentId: id,
        remindedCount: recipients.length,
      });
    });

    if (recipients.length > 0) {
      const classRows = await app.db.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
      const className = classRows[0]?.name ?? "";
      for (const s of recipients) {
        const mail = dueReminder({
          name: s.name,
          title: a.title,
          className,
          dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        });
        await app.mailer.send({ to: s.email, toUserId: s.id, template: "due-reminder", ...mail });
      }
    }

    return { reminded: recipients.length };
  });

  /* ── Task 19: gradebook ── */
  // The prep grid: every active student × every assignment in this class,
  // one read. Staff only — same gate idiom as GET /members (PeopleTab):
  // a student never reaches this route at all, so there's no need to
  // filter anything out of the payload for them (design D§11.5). A TA
  // sees a DRAFT mark's points too, flagged via `released: false` rather
  // than hidden — the grid is a preparation tool, and drafts are exactly
  // what it's for previewing.
  app.get("/api/classes/:id/gradebook", async (req, reply) => {
    const { id: classId } = req.params as { id: string };
    const me = await getMembership(app.db, classId, req.user!.id);
    if (!me || me.status !== "active" || me.role === "student") {
      return reply.code(403).send({ error: "Teachers and assistants only." });
    }

    // Alphabetical by name — a roster reads naturally that way, and it
    // gives the client (grid + CSV export) a stable, predictable order
    // that has nothing to do with signup sequence.
    const studentRows = await app.db
      .select({ id: users.id, name: users.name })
      .from(classMembers)
      .innerJoin(users, eq(classMembers.userId, users.id))
      .where(
        and(
          eq(classMembers.classId, classId),
          eq(classMembers.status, "active"),
          eq(classMembers.role, "student"),
        ),
      )
      .orderBy(users.name);

    // Creation order — the sequence a teacher built the class in, and the
    // same order AssignmentsTab lists them (no explicit sort there either,
    // so this matches the DB's natural insertion order).
    const assignmentRows = await app.db
      .select()
      .from(assignments)
      .where(eq(assignments.classId, classId))
      .orderBy(assignments.createdAt);

    const studentIds = studentRows.map((s) => s.id);
    const assignmentIds = assignmentRows.map((a) => a.id);

    const submissionRows =
      studentIds.length && assignmentIds.length
        ? await app.db
            .select()
            .from(submissions)
            .where(
              and(
                inArray(submissions.assignmentId, assignmentIds),
                inArray(submissions.submitterId, studentIds),
                eq(submissions.isCurrent, true),
              ),
            )
        : [];
    const markRows =
      studentIds.length && assignmentIds.length
        ? await app.db
            .select()
            .from(marks)
            .where(
              and(inArray(marks.assignmentId, assignmentIds), inArray(marks.studentId, studentIds)),
            )
        : [];

    const cellKey = (studentId: string, assignmentId: string) => `${studentId}:${assignmentId}`;
    const submissionByCell = new Map(
      submissionRows.map((s) => [cellKey(s.submitterId as string, s.assignmentId), s]),
    );
    const markByCell = new Map(markRows.map((m) => [cellKey(m.studentId, m.assignmentId), m]));

    const cells: Array<{
      studentId: string;
      assignmentId: string;
      points: number | null;
      released: boolean;
      late: boolean;
      missing: boolean;
    }> = [];
    for (const s of studentRows) {
      for (const a of assignmentRows) {
        const key = cellKey(s.id, a.id);
        const submission = submissionByCell.get(key);
        const mark = markByCell.get(key);
        cells.push({
          studentId: s.id,
          assignmentId: a.id,
          points: mark ? mark.points : null,
          released: mark ? mark.status === "released" : false,
          late: submission ? submission.late : false,
          // Nothing turned in AND nothing marked — genuinely nothing to show.
          // A mark alone (credit entered without a matching submission) is
          // deliberately NOT "missing": something was graded either way.
          missing: !submission && !mark,
        });
      }
    }

    return {
      students: studentRows.map((s) => ({ id: s.id, name: s.name })),
      assignments: assignmentRows.map((a) => ({ id: a.id, title: a.title, points: a.points })),
      cells,
    };
  });

  /* ── Task 20: timeline ── */
  // The History screen's teacher feed (design D§6 naming: the screen is
  // "History", an entry is a "checkpoint"). This is the product's FIRST
  // cross-user read — a teacher or TA reading a specific student's own
  // project history through the assignment_work link — so, per D§6, it is
  // logged like an account action rather than treated as an ordinary GET.
  //
  // Guarded by active teacher-or-TA membership in the ASSIGNMENT'S class
  // (not requireClassTeacher, which is teacher-only and would wrongly 403
  // a TA). Returns the same four-field version shape
  // /api/projects/:id/versions already ships (versionId, clientUpdatedAt,
  // reason, savedAt) plus a `submissions` marker list — the frontend
  // HistoryTimeline component interleaves the two by time.
  app.get("/api/assignments/:id/timeline/:studentId", async (req, reply) => {
    const { id, studentId } = req.params as { id: string; studentId: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassStaff(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }

    const work = await myWorkRowFor(app.db, id, studentId);
    if (!work) return reply.code(404).send({ error: NO_SUCH_STUDENT_WORK });

    const versionRows = await app.db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.ownerId, work.ownerId), eq(projectVersions.projectId, work.projectId)))
      .orderBy(desc(projectVersions.id));
    const submissionRows = await app.db
      .select()
      .from(submissions)
      .where(and(eq(submissions.assignmentId, id), eq(submissions.submitterId, studentId)))
      .orderBy(desc(submissions.createdAt));

    await logEvent(app.db, "assignment.timeline_viewed", req.user!.id, { assignmentId: id, studentId });

    return {
      versions: versionRows.map((v) => ({
        versionId: v.id,
        clientUpdatedAt: v.clientUpdatedAt,
        reason: v.reason,
        savedAt: v.createdAt.toISOString(),
      })),
      submissions: submissionRows.map((s) => ({
        id: s.id,
        attempt: s.attempt,
        late: s.late,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  });

  // Task 23: the same feed for a GROUP's shared project. The route above is
  // userId-keyed and a group's work row is keyed by the group, so it would
  // 404 for every group row the marking room mounts. A separate path rather
  // than a smarter :studentId: the marking room genuinely holds a group id
  // there, and a param that means two different kinds of thing depending on
  // what happens to match is the sort of ambiguity that reads fine until it
  // resolves the wrong way.
  //
  // Spec §5.5's honesty layer: "the timeline still records which member made
  // every checkpoint", so each version carries the name of the member who
  // saved it (project_versions.savedBy) — the per-checkpoint attribution
  // HistoryTimeline already renders and buildTimelineEntries left to Stage D.
  app.get("/api/assignments/:id/timeline/group/:gid", async (req, reply) => {
    const { id, gid } = req.params as { id: string; gid: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassStaff(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const group = await groupOfAssignment(app.db, id, gid);
    if (!group) return reply.code(404).send({ error: NO_SUCH_GROUP });
    const work = await groupWorkFor(app.db, id, gid);
    if (!work) return reply.code(404).send({ error: NO_SUCH_GROUP_WORK });

    const versionRows = await app.db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.ownerId, work.ownerId), eq(projectVersions.projectId, work.projectId)))
      .orderBy(desc(projectVersions.id));
    const saverIds = [...new Set(versionRows.map((v) => v.savedBy))];
    const saverRows = saverIds.length
      ? await app.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, saverIds))
      : [];
    const saverName = new Map(saverRows.map((s) => [s.id, s.name]));

    const submissionRows = await app.db
      .select()
      .from(submissions)
      .where(and(eq(submissions.assignmentId, id), eq(submissions.groupId, gid)))
      .orderBy(desc(submissions.createdAt));

    await logEvent(app.db, "assignment.timeline_viewed", req.user!.id, { assignmentId: id, groupId: gid });

    return {
      versions: versionRows.map((v) => ({
        versionId: v.id,
        clientUpdatedAt: v.clientUpdatedAt,
        reason: v.reason,
        savedAt: v.createdAt.toISOString(),
        savedByName: saverName.get(v.savedBy) ?? null,
      })),
      submissions: submissionRows.map((s) => ({
        id: s.id,
        attempt: s.attempt,
        late: s.late,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  });

  /* ── Task 17: submission read ── */
  // The marking room's read (spec §7.2): the exam script itself — a staff
  // member's view of one student's CURRENT submission snapshot plus their
  // full attempt history. Never the student's own read (that's my-submission
  // above); this 404s rather than 403s-with-empty-body when the student has
  // no submission at all, same "don't pretend it exists" posture
  // NO_SUCH_ASSIGNMENT uses elsewhere in this file.
  app.get("/api/assignments/:id/submissions/:studentId", async (req, reply) => {
    const { id, studentId } = req.params as { id: string; studentId: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassStaff(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }

    // Every attempt, newest first — the current one (isCurrent) is the
    // snapshot rendered; the rest is the honest attempt history.
    const rows = await app.db
      .select({ submission: submissions, studentName: users.name })
      .from(submissions)
      .innerJoin(users, eq(submissions.submitterId, users.id))
      .where(and(eq(submissions.assignmentId, id), eq(submissions.submitterId, studentId)))
      .orderBy(desc(submissions.attempt));
    if (rows.length === 0) return reply.code(404).send({ error: NO_SUCH_SUBMISSION });

    const current = rows.find((r) => r.submission.isCurrent) ?? rows[0];
    // manifest is the same shape createManifest produces (submit.ts stores
    // the linked project's manifest as-is) — starterSeedFrom's extraction
    // already knows that shape, so it's reused rather than duplicated here.
    const seed = starterSeedFrom(current.submission.manifest);
    // Task 18: the marking panel's prefill — the existing draft/released/
    // returned row, in the full staff shape (this route is already
    // staff-gated above, same as the PUT/return routes below).
    const markRow = await loadMark(app.db, id, studentId);

    return {
      submission: {
        studentId,
        studentName: current.studentName,
        ...toSubmissionSummary(current.submission),
        workspaceXml: seed?.workspaceXml ?? "",
        python: seed?.python ?? "",
      },
      history: rows.map((r) => toSubmissionSummary(r.submission)),
      mark: markRow ? toMarkStaffShape(markRow) : null,
    };
  });

  // Task 23: the same read for a GROUP's submission (spec §7.3 — "the panel
  // shows all the members, sets one mark for the group"). One snapshot, one
  // attempt history, one mark reassembled from the members' rows.
  app.get("/api/assignments/:id/submissions/group/:gid", async (req, reply) => {
    const { id, gid } = req.params as { id: string; gid: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassStaff(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const group = await groupOfAssignment(app.db, id, gid);
    if (!group) return reply.code(404).send({ error: NO_SUCH_GROUP });

    const rows = await app.db
      .select()
      .from(submissions)
      .where(and(eq(submissions.assignmentId, id), eq(submissions.groupId, gid)))
      .orderBy(desc(submissions.attempt));
    if (rows.length === 0) return reply.code(404).send({ error: NO_SUCH_GROUP_SUBMISSION });

    const current = rows.find((r) => r.isCurrent) ?? rows[0];
    const seed = starterSeedFrom(current.manifest);
    const members = (await groupMembersOf(app.db, gid)).map(({ userId, name }) => ({ userId, name }));
    const markRows = await marksForStudents(app.db, id, members.map((mm) => mm.userId));

    return {
      submission: {
        groupId: gid,
        groupName: group.name,
        members,
        ...toSubmissionSummary(current),
        workspaceXml: seed?.workspaceXml ?? "",
        python: seed?.python ?? "",
      },
      history: rows.map(toSubmissionSummary),
      groupMark: toGroupMarkShape(gid, members, markRows),
    };
  });

  /* ── Task 18: marks ── */
  // Drafts, release, return for changes — spec §7.3, design D§11.2/D§11.3.
  // TA drafts await teacher release BY CONSTRUCTION: PUT never touches
  // `status`, and only requireClassTeacher (not isStaffRole) guards release.

  /** D§11.3: a draft written against an OLDER attempt than the student's
   *  current one is stale and must be re-saved before it can be released.
   *  A mark with no basedOnSubmissionId at all (manual credit, entered
   *  before — or without — any submission) is never stale by this rule;
   *  there is no "previous attempt" for it to be stale against. */
  function staleReason(mark: typeof marks.$inferSelect, currentSubmissionId: string | null): string | null {
    if (mark.basedOnSubmissionId == null) return null;
    if (mark.basedOnSubmissionId === currentSubmissionId) return null;
    return "This draft was written against a previous attempt — re-save it before releasing.";
  }

  app.put("/api/assignments/:id/marks/:studentId", async (req, reply) => {
    const { id, studentId } = req.params as { id: string; studentId: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassStaff(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (!(await isMarkableStudent(app.db, a.classId, studentId))) {
      return reply.code(404).send({ error: NO_SUCH_STUDENT_IN_CLASS });
    }
    const parsed = MarkDraftInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const d = parsed.data;
    if (a.points != null && d.points != null && d.points > a.points) {
      return reply.code(400).send({ error: "That is more than the assignment is out of." });
    }
    // A points-less assignment is complete/not-complete: existence of the
    // mark row is what "complete" means (gradebook carries the same rule),
    // so the stored points ALWAYS stay null here, regardless of what the
    // client sent — never trust the client alone for an invariant this load-
    // bearing (Task 19's gradebook already renders on this assumption).
    const points = a.points == null ? null : d.points;

    const currentSubRows = await app.db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, id),
          eq(submissions.submitterId, studentId),
          eq(submissions.isCurrent, true),
        ),
      );
    const basedOnSubmissionId = currentSubRows[0]?.id ?? null;

    // Ruling R5: a fresh draft SUPERSEDES a return — the marker has looked
    // at the work again and written a mark on it, so the return episode is
    // over. Leaving `returned` set would surface this unreleased draft's
    // comment and points to the student through myMark (a draft leak) and
    // keep "You can resubmit." on their page next to it.
    const saved = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(marks)
        .values({
          assignmentId: id,
          studentId,
          points,
          // A mark written for one student is that student's whole mark —
          // there is no group figure for it to sit apart from, so any
          // adjustment left over from an earlier group mark is cleared
          // rather than left to make `points - adjustment` lie.
          adjustment: 0,
          comment: d.comment,
          privateNote: d.privateNote,
          returned: false,
          markedBy: req.user!.id,
          basedOnSubmissionId,
        })
        .onConflictDoUpdate({
          target: [marks.assignmentId, marks.studentId],
          set: {
            points,
            adjustment: 0,
            comment: d.comment,
            privateNote: d.privateNote,
            returned: false,
            markedBy: req.user!.id,
            basedOnSubmissionId,
            updatedAt: new Date(),
          },
        })
        .returning();
      await logEvent(tx, "assignment.mark_drafted", req.user!.id, { assignmentId: id, studentId });
      return row;
    });
    return { mark: toMarkStaffShape(saved) };
  });

  /* ── Task 23: the group mark (spec §5.5 / §7.3) ── */
  // "One mark for the group by default, with the teacher free to adjust an
  // individual member's mark up or down." Stored as one ordinary mark row
  // PER MEMBER — the same rows the gradebook, the student's own myMark, the
  // inbox and release already read — carrying that member's FINAL total plus
  // the `adjustment` it sits away from the group's own figure. Nothing about
  // release, staleness or the student's read needs a group-shaped special
  // case as a result: by the time marks move, they are just marks.

  type GroupMember = { userId: string; name: string; email: string };
  type MarkableGroup =
    | { ok: true; a: AssignmentRow; role: string; members: GroupMember[]; markable: GroupMember[] }
    | { ok: false; code: number; error: string };

  /** Both group-mark routes start here: an assignment, a staff caller, a
   *  group that belongs to that assignment, and the members who may actually
   *  be marked. A member who has since left the class is still NAMED on the
   *  panel (they are on the group's credit list) but gets no mark row — the
   *  same target rule isMarkableStudent enforces one student at a time.
   *  Hands the refusal BACK rather than sending it, so the routes keep this
   *  file's one-reply-per-path shape. */
  async function markableGroup(userId: string, id: string, gid: string): Promise<MarkableGroup> {
    const a = await loadAssignment(app.db, id);
    if (!a) return { ok: false, code: 404, error: NO_SUCH_ASSIGNMENT };
    let m: typeof classMembers.$inferSelect;
    try {
      m = await requireClassStaff(app.db, a.classId, userId);
    } catch (err) {
      if (err instanceof ClassAuthError) return { ok: false, code: err.status, error: err.message };
      throw err;
    }
    if (!(await groupOfAssignment(app.db, id, gid))) {
      return { ok: false, code: 404, error: NO_SUCH_GROUP };
    }
    const members = await groupMembersOf(app.db, gid);
    const markable: GroupMember[] = [];
    for (const mm of members) {
      if (await isMarkableStudent(app.db, a.classId, mm.userId)) markable.push(mm);
    }
    if (markable.length === 0) return { ok: false, code: 404, error: NO_SUCH_STUDENT_IN_CLASS };
    // The caller's own role travels with the context: the return route below
    // needs to tell a teacher from a TA, and re-reading the membership it
    // just checked would be a second answer to the same question.
    return { ok: true, a, role: m.role, members, markable };
  }

  app.put("/api/assignments/:id/marks/group/:gid", async (req, reply) => {
    const { id, gid } = req.params as { id: string; gid: string };
    const ctx = await markableGroup(req.user!.id, id, gid);
    if (!ctx.ok) return reply.code(ctx.code).send({ error: ctx.error });
    const { a, members, markable } = ctx;

    const parsed = GroupMarkDraftInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const d = parsed.data;
    if (a.points != null && d.points != null && d.points > a.points) {
      return reply.code(400).send({ error: "That is more than the assignment is out of." });
    }
    // Same invariant the individual PUT holds: a points-less assignment is
    // complete/not-complete, so the stored points stay null — and with no
    // total, there is nothing for an adjustment to be a fraction OF either.
    const points = a.points == null ? null : d.points;

    const memberIds = new Set(members.map((mm) => mm.userId));
    for (const adj of d.adjustments) {
      if (!memberIds.has(adj.studentId)) {
        return reply.code(400).send({ error: ADJUSTMENT_NOT_A_MEMBER });
      }
    }
    const adjustmentBy = new Map(d.adjustments.map((x) => [x.studentId, x.adjustment]));
    // No stored figure, no adjustment: a points-less assignment has no total
    // to sit away from, and neither does a mark whose points the marker just
    // cleared. Either way the stored pair stays coherent — `points -
    // adjustment` is always the group's own figure, never a fiction.
    const adjustmentFor = (userId: string) => (points == null ? 0 : adjustmentBy.get(userId) ?? 0);
    if (points != null) {
      for (const mm of markable) {
        const total = points + adjustmentFor(mm.userId);
        if (total < 0 || (a.points != null && total > a.points)) {
          return reply.code(400).send({ error: ADJUSTMENT_OUT_OF_RANGE });
        }
      }
    }

    // The GROUP's submission is the anchor (the individual PUT's own rule,
    // read through the group): every member's row is based on the one thing
    // that was actually marked, so release's staleness check refuses the
    // whole group together when a newer attempt lands.
    const basedOnSubmissionId = (await currentGroupSubmission(app.db, id, gid))?.id ?? null;

    const saved = await app.db.transaction(async (tx) => {
      for (const mm of markable) {
        const adjustment = adjustmentFor(mm.userId);
        const memberPoints = points == null ? null : points + adjustment;
        await tx
          .insert(marks)
          .values({
            assignmentId: id,
            studentId: mm.userId,
            points: memberPoints,
            adjustment,
            comment: d.comment,
            privateNote: d.privateNote,
            returned: false,
            markedBy: req.user!.id,
            basedOnSubmissionId,
          })
          .onConflictDoUpdate({
            target: [marks.assignmentId, marks.studentId],
            set: {
              points: memberPoints,
              adjustment,
              comment: d.comment,
              privateNote: d.privateNote,
              // Ruling R5, unchanged for groups: a fresh draft ends a return.
              returned: false,
              markedBy: req.user!.id,
              basedOnSubmissionId,
              updatedAt: new Date(),
            },
          });
      }
      await logEvent(tx, "assignment.group_mark_drafted", req.user!.id, {
        assignmentId: id,
        groupId: gid,
        memberCount: markable.length,
      });
      return marksForStudents(tx, id, markable.map((mm) => mm.userId));
    });

    return { groupMark: toGroupMarkShape(gid, members, saved) };
  });

  app.post("/api/assignments/:id/marks/group/:gid/return", async (req, reply) => {
    const { id, gid } = req.params as { id: string; gid: string };
    const ctx = await markableGroup(req.user!.id, id, gid);
    if (!ctx.ok) return reply.code(ctx.code).send({ error: ctx.error });
    const { a, members, markable } = ctx;

    // The group half of the individual route's R5 gate: a return un-releases
    // every member's row at once, so one released row among them makes this
    // the teacher's call. A group still on draft marks stays open to TAs.
    if (ctx.role !== "teacher") {
      const existing = await marksForStudents(app.db, id, markable.map((mm) => mm.userId));
      if (existing.some((row) => row.status === "released")) {
        return reply.code(403).send({ error: RELEASED_RETURN_TEACHER_ONLY });
      }
    }

    const parsed = MarkReturnInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const comment = parsed.data.comment;

    // Ruling R5 per member, all at once: the work being sent back is the
    // group's, so every member's row un-releases together — and the submit
    // route's D§11.2 branch then reopens the GROUP's submission.
    const saved = await app.db.transaction(async (tx) => {
      for (const mm of markable) {
        await tx
          .insert(marks)
          .values({
            assignmentId: id,
            studentId: mm.userId,
            comment,
            returned: true,
            status: "draft",
            releasedAt: null,
            markedBy: req.user!.id,
          })
          .onConflictDoUpdate({
            target: [marks.assignmentId, marks.studentId],
            set: {
              comment,
              returned: true,
              status: "draft",
              releasedAt: null,
              markedBy: req.user!.id,
              updatedAt: new Date(),
            },
          });
      }
      await logEvent(tx, "assignment.group_mark_returned", req.user!.id, {
        assignmentId: id,
        groupId: gid,
        memberCount: markable.length,
      });
      return marksForStudents(tx, id, markable.map((mm) => mm.userId));
    });

    // One email each, after the tx commits — the same fan-out discipline the
    // group receipt and marks release both use.
    const classRows = await app.db.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
    const mail = workReturned({ title: a.title, className: classRows[0]?.name ?? "", comment });
    for (const mm of markable) {
      await app.mailer.send({ to: mm.email, toUserId: mm.userId, template: "work-returned", ...mail });
    }

    return { groupMark: toGroupMarkShape(gid, members, saved) };
  });

  app.post("/api/assignments/:id/marks/release", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    try {
      await requireClassTeacher(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const parsed = MarksReleaseInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const releaseAll = parsed.data.all === true;
    const ids = parsed.data.studentIds ?? [];

    const draftRows = releaseAll
      ? await app.db.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.status, "draft")))
      : ids.length === 0
        ? []
        : await app.db
            .select()
            .from(marks)
            .where(and(eq(marks.assignmentId, id), eq(marks.status, "draft"), inArray(marks.studentId, ids)));

    const targetStudentIds = draftRows.map((r) => r.studentId);
    const currentSubs = targetStudentIds.length
      ? await app.db
          .select({ studentId: submissions.submitterId, id: submissions.id })
          .from(submissions)
          .where(
            and(
              eq(submissions.assignmentId, id),
              eq(submissions.isCurrent, true),
              inArray(submissions.submitterId, targetStudentIds),
            ),
          )
      : [];
    // Task 23: for group work a member's current submission is their GROUP's
    // — without this every group mark would read as stale (no submitterId row
    // to match) and no group would ever be releasable.
    const currentGroupSubs = targetStudentIds.length
      ? await app.db
          .select({ studentId: groupMembers.userId, id: submissions.id })
          .from(submissions)
          .innerJoin(groupMembers, eq(groupMembers.groupId, submissions.groupId))
          .where(
            and(
              eq(submissions.assignmentId, id),
              eq(submissions.isCurrent, true),
              inArray(groupMembers.userId, targetStudentIds),
            ),
          )
      : [];
    const currentByStudent = new Map(
      [...currentSubs, ...currentGroupSubs]
        .filter((s): s is { studentId: string; id: string } => !!s.studentId)
        .map((s) => [s.studentId, s.id]),
    );

    const releasable: typeof marks.$inferSelect[] = [];
    const refused: Array<{ studentId: string; error: string }> = [];
    for (const row of draftRows) {
      const reason = staleReason(row, currentByStudent.get(row.studentId) ?? null);
      if (reason) refused.push({ studentId: row.studentId, error: reason });
      else releasable.push(row);
    }

    const releasedAt = new Date();
    await app.db.transaction(async (tx) => {
      for (const row of releasable) {
        // Ruling R5: releasing ENDS any return episode. A row that stayed
        // `returned` while released would render the student's feedback
        // card and the "You can resubmit." warning at the same time, and
        // would hold submission open on a closed assignment.
        await tx
          .update(marks)
          .set({ status: "released", returned: false, releasedAt, updatedAt: releasedAt })
          .where(eq(marks.id, row.id));
      }
      if (releaseAll) {
        await tx
          .update(assignments)
          .set({ status: "marks_released", marksReleasedAt: releasedAt, updatedAt: releasedAt })
          .where(eq(assignments.id, id));
      }
      await logEvent(tx, "assignment.marks_released", req.user!.id, {
        assignmentId: id,
        releasedCount: releasable.length,
        refusedCount: refused.length,
        all: releaseAll,
      });
    });

    // Fans out AFTER the tx commits — same ordering submit's receipt and
    // remind's due-reminder both already use (the durable fact lands first).
    if (releasable.length > 0) {
      const classRows = await app.db.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
      const className = classRows[0]?.name ?? "";
      const studentRows = await app.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, releasable.map((r) => r.studentId)));
      const studentById = new Map(studentRows.map((s) => [s.id, s]));
      for (const row of releasable) {
        const student = studentById.get(row.studentId);
        if (!student) continue;
        const mail = marksReleased({
          title: a.title,
          className,
          points: row.points,
          outOf: a.points,
          comment: row.comment,
        });
        await app.mailer.send({ to: student.email, toUserId: student.id, template: "marks-released", ...mail });
      }
    }

    return {
      released: releasable.map((r) => r.studentId),
      refused,
    };
  });

  app.post("/api/assignments/:id/marks/:studentId/return", async (req, reply) => {
    const { id, studentId } = req.params as { id: string; studentId: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    let m: typeof classMembers.$inferSelect;
    try {
      m = await requireClassStaff(app.db, a.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (!(await isMarkableStudent(app.db, a.classId, studentId))) {
      return reply.code(404).send({ error: NO_SUCH_STUDENT_IN_CLASS });
    }
    // Ruling R5 made Return an UN-RELEASE, which turned this staff-wide route
    // into a way around the teacher-only release gate below it: a TA could
    // reverse a release they were never allowed to make. Returning a DRAFT is
    // still ordinary marking work and stays open to TAs; only undoing a
    // release needs the authority that made it.
    if (m.role !== "teacher" && (await loadMark(app.db, id, studentId))?.status === "released") {
      return reply.code(403).send({ error: RELEASED_RETURN_TEACHER_ONLY });
    }
    const parsed = MarkReturnInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const comment = parsed.data.comment;

    // Ruling R5: a return UN-RELEASES the row — D§11.2 makes the teacher's
    // Return the authority, and only a draft-status returned row actually
    // reopens submission (the submit route's own branch), which is what the
    // workReturned email promises the student.
    const saved = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(marks)
        .values({
          assignmentId: id,
          studentId,
          comment,
          returned: true,
          status: "draft",
          releasedAt: null,
          markedBy: req.user!.id,
        })
        .onConflictDoUpdate({
          target: [marks.assignmentId, marks.studentId],
          set: {
            comment,
            returned: true,
            status: "draft",
            releasedAt: null,
            markedBy: req.user!.id,
            updatedAt: new Date(),
          },
        })
        .returning();
      await logEvent(tx, "assignment.mark_returned", req.user!.id, { assignmentId: id, studentId });
      return row;
    });

    const classRows = await app.db.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
    const studentRows = await app.db.select({ email: users.email }).from(users).where(eq(users.id, studentId));
    if (studentRows[0]) {
      const mail = workReturned({ title: a.title, className: classRows[0]?.name ?? "", comment });
      await app.mailer.send({ to: studentRows[0].email, toUserId: studentId, template: "work-returned", ...mail });
    }

    return { mark: toMarkStaffShape(saved) };
  });
}
