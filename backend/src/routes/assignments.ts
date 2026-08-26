import type { FastifyInstance } from "fastify";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  CreateAssignmentInputSchema,
  UpdateAssignmentInputSchema,
  SaveRuleSetInputSchema,
  computeAssignmentPhase,
} from "@physics-ide/shared";
import { assignments, assignmentWork, submissions, ruleSets, projects } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import {
  getMembership,
  requireClassTeacher,
  sendClassAuthError,
} from "../classes/guards.js";
import { logEvent } from "../db/events.js";
import type { Db } from "../db/types.js";

type AssignmentRow = typeof assignments.$inferSelect;

const NOT_A_MEMBER = "Not a member of this class.";
const NO_SUCH_ASSIGNMENT = "No such assignment.";
const TEACHERS_ONLY = "Teachers only.";
const STARTER_LOCKED = "This assignment already has submissions — the starter is a starting point, not a mid-flight swap.";

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
): Promise<{ started: boolean; projectId: string } | null> {
  const rows = await db
    .select()
    .from(assignmentWork)
    .where(and(eq(assignmentWork.assignmentId, assignmentId), eq(assignmentWork.userId, userId)));
  const row = rows[0];
  return row ? { started: true, projectId: row.projectId } : null;
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
    const extras: Record<string, unknown> = { instructions: a.instructions, myWork };
    if (staff) extras.rules = a.rules;
    return { assignment: toAssignmentSummary(a, extras) };
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
}
