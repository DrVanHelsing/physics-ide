import type { FastifyInstance } from "fastify";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  CreateAssignmentInputSchema,
  UpdateAssignmentInputSchema,
  SaveRuleSetInputSchema,
  computeAssignmentPhase,
} from "@physics-ide/shared";
import {
  assignments,
  assignmentWork,
  submissions,
  ruleSets,
  projects,
  classes,
  classMembers,
  marks,
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
import { submissionReceipt } from "../email/templates.js";

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

/** The two honest sentences a refused submit can show. Only the "closed"
 *  phase (not marks_released, and not the unreachable-post-start
 *  scheduled/draft cases) splits by cause: a teacher's manual Close, or the
 *  due date + late window simply having elapsed on their own. */
function submitRefusalMessage(a: AssignmentRow, phase: string, now: Date): string {
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
    const extras: Record<string, unknown> = {
      instructions: a.instructions,
      rules: a.rules,
      myWork,
      starterSeed,
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

    const projectRows = await app.db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, work.ownerId), eq(projects.id, work.projectId)));
    const project = projectRows[0];
    if (!project) return reply.code(404).send({ error: NO_SUCH_PROJECT });

    const manifest = project.manifest;
    const fingerprint = crypto.createHash("sha256").update(stableStringify(manifest)).digest("hex");

    const created = await app.db.transaction(async (tx) => {
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
      return row;
    });

    const classRows = await app.db.select({ name: classes.name }).from(classes).where(eq(classes.id, a.classId));
    const mail = submissionReceipt({
      title: a.title,
      className: classRows[0]?.name ?? "",
      submittedAt: now.toISOString(),
      attempt: created.attempt,
      fingerprint: created.fingerprint,
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

    return reply.code(201).send({ submission: toSubmissionSummary(created) });
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
    const rows = await app.db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, id),
          eq(submissions.submitterId, req.user!.id),
          eq(submissions.isCurrent, true),
        ),
      );
    return { submission: rows[0] ? toSubmissionSummary(rows[0]) : null };
  });
}

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause.
 *  Same private-per-file idiom auth.ts and members.ts already use. */
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}
