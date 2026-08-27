import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  CreateAssignmentInputSchema,
  UpdateAssignmentInputSchema,
  SaveRuleSetInputSchema,
  MarkDraftInputSchema,
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
  marks,
  users,
} from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import {
  getMembership,
  requireClassTeacher,
  sendClassAuthError,
} from "../classes/guards.js";
import { logEvent } from "../db/events.js";
import type { Db } from "../db/types.js";
import { stableStringify } from "./projects.js";
import { submissionReceipt, dueReminder, marksReleased, workReturned } from "../email/templates.js";

type AssignmentRow = typeof assignments.$inferSelect;

const NOT_A_MEMBER = "Not a member of this class.";
const NO_SUCH_ASSIGNMENT = "No such assignment.";
const TEACHERS_ONLY = "Teachers only.";
const STARTER_LOCKED = "This assignment already has submissions — the starter is a starting point, not a mid-flight swap.";
const NOT_OPEN = "This assignment is not open.";
const NO_SUCH_PROJECT = "No such project.";
const NOT_STARTED = "Start this assignment before submitting.";
const DUE_DATE_PASSED = "The due date has passed.";
const ASSIGNMENT_CLOSED = "This assignment is closed.";
const NO_SUCH_SUBMISSION = "No submission from this student.";
const STAFF_ONLY_FOR_CLASS = "Teachers and TAs only for this class.";
const NO_SUCH_STUDENT_WORK = "This student has not started this assignment.";
const NO_SUCH_STUDENT_IN_CLASS = "No such student in this class.";
// Same exact sentence as AssignmentPage.js's own gateSentence(phase) for the
// Start/Continue button — the two surfaces must agree (review finding).
const MARKS_RELEASED_CLOSED = "This assignment is closed — marks have been released.";

function toEpoch(d: Date | null): number | null {
  return d ? d.getTime() : null;
}

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

/** Students see an assignment only once it has left draft (spec §5.1).
 *  A draft 404s rather than 403s — its existence is the teacher's business. */
function visibleToStudent(a: typeof assignments.$inferSelect): boolean {
  return computeAssignmentPhase(a, new Date()) !== "draft";
}

function isStaffRole(role: string): boolean {
  return role === "teacher" || role === "ta";
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

async function myWorkFor(
  db: Db,
  assignmentId: string,
  userId: string,
): Promise<{ projectId: string; startedAt: number } | null> {
  const rows = await db
    .select()
    .from(assignmentWork)
    .where(and(eq(assignmentWork.assignmentId, assignmentId), eq(assignmentWork.userId, userId)));
  const row = rows[0];
  return row ? { projectId: row.projectId, startedAt: row.startedAt.getTime() } : null;
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
    const myWork = await myWorkFor(app.db, id, req.user!.id);
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
    const extras: Record<string, unknown> = {
      instructions: a.instructions,
      rules: a.rules,
      myWork,
      starterSeed,
      myMark,
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
    const body = req.body as { projectId?: unknown };
    if (typeof body?.projectId !== "string" || body.projectId.length === 0) {
      return reply.code(400).send({ error: "Invalid input." });
    }

    // Idempotent: a second start returns the row that already exists rather
    // than racing the unique (assignment, user) constraint.
    const existing = await myWorkFor(app.db, id, req.user!.id);
    if (existing) {
      return reply.code(200).send({ work: { projectId: existing.projectId } });
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
    if (!projectRows[0]) return reply.code(404).send({ error: NO_SUCH_PROJECT });

    try {
      await app.db.transaction(async (tx) => {
        await tx.insert(assignmentWork).values({
          assignmentId: id,
          userId: req.user!.id,
          ownerId: req.user!.id,
          projectId: body.projectId as string,
        });
        await logEvent(tx, "assignment.started", req.user!.id, { assignmentId: id, projectId: body.projectId });
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

    return reply.code(201).send({ work: { projectId: body.projectId } });
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
      // Individual submissions only (submitterId = caller) — group
      // submissions carry groupId instead and resolving "did my group submit"
      // is Stage D's job, not this one's.
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
      const submittedSet = new Set(submittedRows.map((s) => s.assignmentId));

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

  /* ── Task 14: submit ── */
  // The frozen snapshot: submit reads the caller's LINKED project's current
  // server-head manifest (never a client-uploaded copy — the client pushes
  // first, per the design, so the server head already IS what the student
  // sees by the time this runs), fingerprints it, and files it as the new
  // current attempt in one transaction. Individual submission mode only —
  // group crediting is Stage D (design §9); creditedIds is `[callerId]` with
  // that noted below rather than silently half-implemented.

  app.post("/api/assignments/:id/submit", async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await loadAssignment(app.db, id);
    if (!a) return reply.code(404).send({ error: NO_SUCH_ASSIGNMENT });
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active") {
      return reply.code(403).send({ error: NOT_A_MEMBER });
    }

    const work = await myWorkRowFor(app.db, id, req.user!.id);
    if (!work) return reply.code(400).send({ error: NOT_STARTED });

    const now = new Date();
    const phase = computeAssignmentPhase(a, now);
    let allowed = phase === "open" || phase === "late_window";
    if (!allowed && phase === "closed") {
      // Fiat D§11.2 — a returned, unreleased mark reopens work for this
      // student regardless of Closed, until marks release.
      allowed = await returnedUnreleasedMarkExists(app.db, id, req.user!.id);
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
        .where(and(eq(assignmentWork.assignmentId, id), eq(assignmentWork.userId, req.user!.id)))
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

      const priorRows = await tx
        .select()
        .from(submissions)
        .where(and(eq(submissions.assignmentId, id), eq(submissions.submitterId, req.user!.id)));
      const maxAttempt = priorRows.reduce((max, r) => Math.max(max, r.attempt), 0);
      const currentRow = priorRows.find((r) => r.isCurrent);
      if (currentRow) {
        await tx.update(submissions).set({ isCurrent: false }).where(eq(submissions.id, currentRow.id));
      }
      const [row] = await tx
        .insert(submissions)
        .values({
          assignmentId: id,
          submitterId: req.user!.id,
          submittedBy: req.user!.id,
          // Individual work only for now — every group member gets credited
          // once Stage D's group support lands (design §9).
          creditedIds: [req.user!.id],
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
      });
      return { kind: "submitted" as const, row };
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
    });
    // Individual submission: the submitter is the sole credited recipient —
    // one email per credited user, same as every other credited-recipient
    // template; groups (every member) arrive with Stage D.
    await app.mailer.send({
      to: req.user!.email,
      toUserId: req.user!.id,
      template: "submission-receipt",
      ...mail,
    });

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
    // picks the latest, never an arbitrary row-order pick.
    const rows = await app.db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, id),
          eq(submissions.submitterId, req.user!.id),
          eq(submissions.isCurrent, true),
        ),
      )
      .orderBy(desc(submissions.attempt));
    return { submission: rows[0] ? toSubmissionSummary(rows[0]) : null };
  });

  /* ── Task 16: inbox ── */
  // The teacher's (and TA's) roster-wide view of one assignment: every
  // active student, submitted or missing, their mark status, and a
  // one-click reminder for whoever hasn't turned it in yet. GET is staff
  // (teacher + TA, same "Teachers and assistants only." wording as
  // members.ts's own roster route); the reminder itself is teacher-only.

  const STAFF_ONLY = "Teachers and assistants only.";

  type InboxEntry = {
    studentId: string;
    name: string;
    email: string;
    state: "submitted" | "missing";
    late: boolean;
    submittedAt: number | null;
    attempt: number | null;
    markStatus: "none" | "draft" | "released";
  };

  /** Fiat D§11.1: "missing" is an active roster student with no CURRENT
   *  submission — one join, roster (active students) ← submissions(current)
   *  ← marks, shared by both the read (GET /inbox) and the write
   *  (POST /remind, which only needs the "missing" half of it). */
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

    const subRows = studentIds.length
      ? await db
          .select()
          .from(submissions)
          .where(
            and(
              eq(submissions.assignmentId, a.id),
              eq(submissions.isCurrent, true),
              inArray(submissions.submitterId, studentIds),
            ),
          )
      : [];
    // Individual submissions only — group submissions carry groupId instead
    // (submitterId null) and resolving "did my group submit" is Stage D's
    // job, not this one's (same exclusion /upcoming's dueSoon filter makes).
    // The filter also narrows the type for the Map key below.
    const subByStudent = new Map(
      subRows.filter((s): s is typeof s & { submitterId: string } => !!s.submitterId).map((s) => [s.submitterId, s]),
    );

    const markRows = studentIds.length
      ? await db
          .select()
          .from(marks)
          .where(and(eq(marks.assignmentId, a.id), inArray(marks.studentId, studentIds)))
      : [];
    const markByStudent = new Map(markRows.map((m) => [m.studentId, m]));

    return roster
      .map(({ user }): InboxEntry => {
        const sub = subByStudent.get(user.id);
        const mark = markByStudent.get(user.id);
        const markStatus: InboxEntry["markStatus"] = !mark ? "none" : mark.status === "released" ? "released" : "draft";
        return sub
          ? {
              studentId: user.id,
              name: user.name,
              email: user.email,
              state: "submitted",
              late: sub.late,
              submittedAt: sub.createdAt.getTime(),
              attempt: sub.attempt,
              markStatus,
            }
          : {
              studentId: user.id,
              name: user.name,
              email: user.email,
              state: "missing",
              late: false,
              submittedAt: null,
              attempt: null,
              markStatus,
            };
      })
      .sort((x, y) => x.name.localeCompare(y.name));
  }

  /** The public row shape (cross-lane contract, Task 17 consumes it) —
   *  `email` above is internal-only, never serialized. */
  function toInboxRow(e: InboxEntry) {
    return {
      studentId: e.studentId,
      name: e.name,
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
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active" || !isStaffRole(m.role)) {
      return reply.code(403).send({ error: STAFF_ONLY });
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
    const missing = entries.filter((e) => e.state === "missing");

    // The audit record is the durable fact; it lands in its own small
    // transaction the same weight as this file's other single-write routes
    // (publish/close/etc). Email is best-effort ON TOP of that fact, so it
    // runs AFTER the tx commits — same ordering submit's own receipt uses.
    await app.db.transaction(async (tx) => {
      await logEvent(tx, "assignment.reminded", req.user!.id, {
        assignmentId: id,
        remindedCount: missing.length,
      });
    });

    if (missing.length > 0) {
      const classRows = await app.db.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
      const className = classRows[0]?.name ?? "";
      for (const s of missing) {
        const mail = dueReminder({
          name: s.name,
          title: a.title,
          className,
          dueAt: a.dueAt ? a.dueAt.toISOString() : null,
        });
        await app.mailer.send({ to: s.email, toUserId: s.studentId, template: "due-reminder", ...mail });
      }
    }

    return { reminded: missing.length };
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
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active" || !isStaffRole(m.role)) {
      return reply.code(403).send({ error: STAFF_ONLY_FOR_CLASS });
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
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active" || !isStaffRole(m.role)) {
      return reply.code(403).send({ error: STAFF_ONLY });
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
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active" || !isStaffRole(m.role)) {
      return reply.code(403).send({ error: STAFF_ONLY });
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
    const currentByStudent = new Map(
      currentSubs.filter((s): s is { studentId: string; id: string } => !!s.studentId).map((s) => [s.studentId, s.id]),
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
    const m = await getMembership(app.db, a.classId, req.user!.id);
    if (!m || m.status !== "active" || !isStaffRole(m.role)) {
      return reply.code(403).send({ error: STAFF_ONLY });
    }
    if (!(await isMarkableStudent(app.db, a.classId, studentId))) {
      return reply.code(404).send({ error: NO_SUCH_STUDENT_IN_CLASS });
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

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause.
 *  Same private-per-file idiom auth.ts and members.ts already use. */
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}
