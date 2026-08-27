import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import {
  CreateGroupInputSchema,
  GroupProjectSaveInputSchema,
  computeAssignmentPhase,
} from "@physics-ide/shared";
import {
  assignments,
  groupMembers,
  groups,
  projects,
  projectVersions,
  submissions,
  users,
} from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { ClassAuthError, getMembership, sendClassAuthError } from "../classes/guards.js";
import { logEvent } from "../db/events.js";
import type { Db } from "../db/types.js";
import {
  INVALID_PROJECT_ERROR,
  ManifestSchema,
  MAX_MANIFEST_BYTES,
  OVERSIZE_ERROR,
  pruneVersions,
} from "./projects.js";

type AssignmentRow = typeof assignments.$inferSelect;
type GroupRow = typeof groups.$inferSelect;

/** Spec §5.5 "first-come, capped at the group size": a pair is two people,
 *  a group is six. Keyed by the assignment's own submission mode. */
export const GROUP_SIZE_CAP: Record<string, number> = { pair: 2, group: 6 };

/** The baton is a POLLED lease (stack §sync): holder + expiry on the group
 *  row, no live connection and no server-side timer. Ninety seconds is long
 *  enough to survive a slow save and short enough that a member who walks
 *  away frees it before the others give up. */
export const BATON_TTL_MS = 90 * 1000;

const NOT_A_MEMBER = "Not a member of this class.";
const NO_SUCH_ASSIGNMENT = "No such assignment.";
const NO_SUCH_GROUP = "No such group.";
const NO_SUCH_PROJECT = "No such project.";
const NOT_GROUP_WORK = "This assignment is not group work.";
const NOT_A_GROUP_MEMBER = "Not a member of this group.";
const ALREADY_GROUPED = "You are already in a group for this assignment.";
const GROUP_FULL = "That group is full.";
const ALREADY_SUBMITTED = "This group has already submitted.";
const BATON_HELD = "Another member holds the baton.";
const NO_BATON = "Take the baton before saving.";
const NOT_STARTED = "This group has not started work yet.";
const STUDENTS_ONLY = "Groups are for students.";

function isStaffRole(role: string): boolean {
  return role === "teacher" || role === "ta";
}

/** Same "a draft's existence is the teacher's business" posture the
 *  assignment routes take — a student acting on one gets a 404, not a 403. */
function visibleToStudent(a: AssignmentRow): boolean {
  return computeAssignmentPhase(a, new Date()) !== "draft";
}

function isGroupWork(a: AssignmentRow): boolean {
  return a.submissionMode === "pair" || a.submissionMode === "group";
}

/** The caller's group for one assignment, if they are in one. Exported
 *  because the assignment routes need it too: a pair/group assignment's
 *  work row is keyed by the GROUP, so both /start and the student read
 *  have to come through here first. */
export async function myGroupFor(
  db: Pick<Db, "select">,
  assignmentId: string,
  userId: string,
): Promise<GroupRow | null> {
  const rows = await db
    .select({ group: groups })
    .from(groups)
    .innerJoin(groupMembers, eq(groupMembers.groupId, groups.id))
    .where(and(eq(groups.assignmentId, assignmentId), eq(groupMembers.userId, userId)));
  return rows[0]?.group ?? null;
}

/** The group's members in join order, with the two things every caller of
 *  this needs: who they are and where to email them. Exported because Task
 *  23's group submit, receipts and group mark all live in assignments.ts —
 *  the credit list a submission freezes is exactly this, read once. */
export async function groupMembersOf(
  db: Pick<Db, "select">,
  groupId: string,
): Promise<Array<{ userId: string; name: string; email: string }>> {
  return db
    .select({ userId: groupMembers.userId, name: users.name, email: users.email })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.createdAt);
}

/** One group with its members named, in join order — the shape the group
 *  panel and the student assignment read both render. `projectId` is null
 *  until the founding member starts work. Email is internal to the helper
 *  above and never reaches this student-facing shape. */
export async function groupShape(db: Db, group: GroupRow) {
  const members = (await groupMembersOf(db, group.id)).map(({ userId, name }) => ({ userId, name }));
  return { id: group.id, name: group.name, projectId: group.projectId, members };
}

async function loadGroup(db: Db, gid: string): Promise<GroupRow | null> {
  const rows = await db.select().from(groups).where(eq(groups.id, gid));
  return rows[0] ?? null;
}

async function memberCount(db: Pick<Db, "select">, gid: string): Promise<number> {
  const rows = await db.select({ id: groupMembers.id }).from(groupMembers).where(eq(groupMembers.groupId, gid));
  return rows.length;
}

async function hasSubmission(db: Db, gid: string): Promise<boolean> {
  const rows = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.groupId, gid)).limit(1);
  return rows.length > 0;
}

/** Serializes one student's own group moves against each other. "One group
 *  per assignment" is a rule about a PERSON, and there is no row of theirs
 *  in `group_members` yet to lock — so their user row is the mutex, the same
 *  idiom the project cap uses. Locked before any group row, everywhere, so
 *  the two locks can never be taken in opposite orders. */
async function lockActor(tx: Pick<Db, "select">, userId: string): Promise<void> {
  await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
}

async function userName(db: Db, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const rows = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return rows[0]?.name ?? null;
}

/** The three fields the polled lease exposes. A lease whose expiry has
 *  passed is still reported verbatim — the client needs to see WHOSE it
 *  was to offer "Take over" by name (spec §5.5). */
function toBaton(group: GroupRow, holderName: string | null) {
  return {
    holderId: group.batonHolderId,
    holderName,
    expiresAt: group.batonExpiresAt ? group.batonExpiresAt.getTime() : null,
  };
}

function leaseIsLive(group: GroupRow, now: Date): boolean {
  return (
    group.batonHolderId != null &&
    group.batonExpiresAt != null &&
    group.batonExpiresAt.getTime() > now.getTime()
  );
}

/** Every group route starts from the assignment: it must exist, the caller
 *  must be an active member of its class, a student must be allowed to see
 *  it at all, and it must actually be group work. Throws ClassAuthError so
 *  the routes keep this file family's try/sendClassAuthError idiom. */
async function requireGroupAssignment(
  db: Db,
  assignmentId: string,
  userId: string,
): Promise<AssignmentRow> {
  const rows = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
  const assignment = rows[0];
  if (!assignment) throw new ClassAuthError(404, NO_SUCH_ASSIGNMENT);
  const membership = await getMembership(db, assignment.classId, userId);
  if (!membership || membership.status !== "active") throw new ClassAuthError(403, NOT_A_MEMBER);
  if (!isStaffRole(membership.role) && !visibleToStudent(assignment)) {
    throw new ClassAuthError(404, NO_SUCH_ASSIGNMENT);
  }
  if (!isGroupWork(assignment)) throw new ClassAuthError(400, NOT_GROUP_WORK);
  return assignment;
}

type GroupContext = { assignment: AssignmentRow; group: GroupRow };

async function requireGroup(db: Db, gid: string, userId: string): Promise<GroupContext> {
  const group = await loadGroup(db, gid);
  if (!group) throw new ClassAuthError(404, NO_SUCH_GROUP);
  const assignment = await requireGroupAssignment(db, group.assignmentId, userId);
  return { assignment, group };
}

/** Ruling R7: forming and joining a group is student-only. A staff member
 *  sitting in a group would be written into its submission's `creditedIds`
 *  and would collect a mark row of their own when the group's mark is
 *  released — the same harm isMarkableStudent guards against on the mark's
 *  TARGET (assignments.ts). Staff still SEE every group (the roster read
 *  below is unchanged); they simply cannot be in one. */
async function requireStudentOfClass(db: Db, classId: string, userId: string): Promise<void> {
  const m = await getMembership(db, classId, userId);
  if (!m || m.status !== "active" || m.role !== "student") {
    throw new ClassAuthError(403, STUDENTS_ONLY);
  }
}

/** The membership gate on everything the group OWNS — its project and its
 *  baton. Class membership is not enough: the shared project lives under
 *  the founding member's account and only the group reaches it. */
async function requireGroupMember(db: Db, gid: string, userId: string): Promise<void> {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, userId)));
  if (!rows[0]) throw new ClassAuthError(403, NOT_A_GROUP_MEMBER);
}

export function groupRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  /* ── Forming groups (spec §5.5) ── */

  app.post("/api/assignments/:id/groups", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const assignment = await requireGroupAssignment(app.db, id, req.user!.id);
      await requireStudentOfClass(app.db, assignment.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const parsed = CreateGroupInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }

    const created = await app.db.transaction(async (tx) => {
      await lockActor(tx, req.user!.id);
      if (await myGroupFor(tx, id, req.user!.id)) return null;
      // "Group N" counts the assignment's existing groups. Two simultaneous
      // creations by DIFFERENT students can land on the same number — a
      // duplicate name is cosmetic (ids are what everything keys off), so
      // this deliberately does not serialize the whole assignment for it.
      const existing = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.assignmentId, id));
      const [row] = await tx
        .insert(groups)
        .values({
          assignmentId: id,
          name: parsed.data.name ?? `Group ${existing.length + 1}`,
        })
        .returning();
      await tx.insert(groupMembers).values({ groupId: row.id, userId: req.user!.id });
      await logEvent(tx, "group.created", req.user!.id, { groupId: row.id, assignmentId: id });
      return row;
    });
    if (!created) return reply.code(400).send({ error: ALREADY_GROUPED });

    return reply.code(201).send({ group: await groupShape(app.db, created) });
  });

  app.get("/api/assignments/:id/groups", async (req, reply) => {
    const { id } = req.params as { id: string };
    let assignment: AssignmentRow;
    try {
      assignment = await requireGroupAssignment(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }

    const rows = await app.db
      .select()
      .from(groups)
      .where(eq(groups.assignmentId, id))
      .orderBy(groups.createdAt);
    const memberRows = rows.length
      ? await app.db
          .select({ groupId: groupMembers.groupId, userId: groupMembers.userId, name: users.name })
          .from(groupMembers)
          .innerJoin(users, eq(groupMembers.userId, users.id))
          .where(
            inArray(
              groupMembers.groupId,
              rows.map((r) => r.id),
            ),
          )
          .orderBy(groupMembers.createdAt)
      : [];
    const byGroup = new Map<string, { userId: string; name: string }[]>();
    for (const m of memberRows) {
      const list = byGroup.get(m.groupId) ?? [];
      list.push({ userId: m.userId, name: m.name });
      byGroup.set(m.groupId, list);
    }

    return {
      capacity: GROUP_SIZE_CAP[assignment.submissionMode],
      groups: rows.map((r) => ({
        id: r.id,
        name: r.name,
        projectId: r.projectId,
        members: byGroup.get(r.id) ?? [],
      })),
    };
  });

  app.post("/api/groups/:gid/join", async (req, reply) => {
    const { gid } = req.params as { gid: string };
    let ctx: GroupContext;
    try {
      ctx = await requireGroup(app.db, gid, req.user!.id);
      await requireStudentOfClass(app.db, ctx.assignment.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (await hasSubmission(app.db, gid)) {
      return reply.code(400).send({ error: ALREADY_SUBMITTED });
    }

    const cap = GROUP_SIZE_CAP[ctx.assignment.submissionMode];
    const outcome = await app.db.transaction(async (tx) => {
      await lockActor(tx, req.user!.id);
      // The group row is the mutex for its own seat count: two members
      // racing for the last seat serialize here, so the cap can't be
      // stepped over by a pair of simultaneous joins.
      await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, gid)).for("update");
      const mine = await myGroupFor(tx, ctx.group.assignmentId, req.user!.id);
      if (mine?.id === gid) return "already" as const; // idempotent re-join
      if (mine) return "elsewhere" as const;
      if ((await memberCount(tx, gid)) >= cap) return "full" as const;
      await tx.insert(groupMembers).values({ groupId: gid, userId: req.user!.id });
      await logEvent(tx, "group.joined", req.user!.id, {
        groupId: gid,
        assignmentId: ctx.group.assignmentId,
      });
      return "joined" as const;
    });
    if (outcome === "full") return reply.code(400).send({ error: GROUP_FULL });
    if (outcome === "elsewhere") return reply.code(400).send({ error: ALREADY_GROUPED });

    return { group: await groupShape(app.db, ctx.group) };
  });

  app.post("/api/groups/:gid/leave", async (req, reply) => {
    const { gid } = req.params as { gid: string };
    let ctx: GroupContext;
    try {
      ctx = await requireGroup(app.db, gid, req.user!.id);
      await requireGroupMember(app.db, gid, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    // Membership is frozen once the group has handed in: the receipt already
    // names who was credited, and quietly changing the roster afterwards
    // would make that receipt a lie.
    if (await hasSubmission(app.db, gid)) {
      return reply.code(400).send({ error: ALREADY_SUBMITTED });
    }

    await app.db.transaction(async (tx) => {
      await tx
        .delete(groupMembers)
        .where(and(eq(groupMembers.groupId, gid), eq(groupMembers.userId, req.user!.id)));
      // Don't walk off with the baton — a departing holder frees it now
      // rather than making everyone else wait out the lease.
      if (ctx.group.batonHolderId === req.user!.id) {
        await tx
          .update(groups)
          .set({ batonHolderId: null, batonExpiresAt: null })
          .where(eq(groups.id, gid));
      }
      await logEvent(tx, "group.left", req.user!.id, {
        groupId: gid,
        assignmentId: ctx.group.assignmentId,
      });
    });

    return { group: await groupShape(app.db, ctx.group) };
  });

  /* ── The baton: a polled lease, no live connections (stack §sync) ── */

  app.get("/api/groups/:gid/baton", async (req, reply) => {
    const { gid } = req.params as { gid: string };
    let ctx: GroupContext;
    try {
      ctx = await requireGroup(app.db, gid, req.user!.id);
      await requireGroupMember(app.db, gid, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    return { baton: toBaton(ctx.group, await userName(app.db, ctx.group.batonHolderId)) };
  });

  app.post("/api/groups/:gid/baton/take", async (req, reply) => {
    const { gid } = req.params as { gid: string };
    let ctx: GroupContext;
    try {
      ctx = await requireGroup(app.db, gid, req.user!.id);
      await requireGroupMember(app.db, gid, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }

    const now = new Date();
    const result = await app.db.transaction(async (tx) => {
      const rows = await tx.select().from(groups).where(eq(groups.id, gid)).for("update");
      const current = rows[0]!;
      // Free, expired, or already yours — all takeable. Only a LIVE lease in
      // someone else's hand refuses, and then the reply names them so the UI
      // can say who (spec §5.5's "Thabo is working on it now").
      if (leaseIsLive(current, now) && current.batonHolderId !== req.user!.id) {
        return { kind: "held" as const, group: current };
      }
      const [updated] = await tx
        .update(groups)
        .set({ batonHolderId: req.user!.id, batonExpiresAt: new Date(now.getTime() + BATON_TTL_MS) })
        .where(eq(groups.id, gid))
        .returning();
      await logEvent(tx, "group.baton_taken", req.user!.id, {
        groupId: gid,
        assignmentId: ctx.group.assignmentId,
        tookOverFrom: current.batonHolderId !== req.user!.id ? current.batonHolderId : null,
      });
      return { kind: "taken" as const, group: updated };
    });

    const baton = toBaton(result.group, await userName(app.db, result.group.batonHolderId));
    if (result.kind === "held") return reply.code(409).send({ error: BATON_HELD, baton });
    return { baton };
  });

  /* ── The shared project ── */
  // It lives under the FOUNDING member's account (`projects` is keyed by a
  // real user; there is no group account), and every other member reaches it
  // only through these two routes. The personal sync engine still ignores
  // projects it does not own, so nothing here touches it.

  app.get("/api/groups/:gid/project", async (req, reply) => {
    const { gid } = req.params as { gid: string };
    let ctx: GroupContext;
    try {
      ctx = await requireGroup(app.db, gid, req.user!.id);
      await requireGroupMember(app.db, gid, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const { ownerId, projectId } = ctx.group;
    if (!ownerId || !projectId) return reply.code(404).send({ error: NOT_STARTED });

    const rows = await app.db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, ownerId), eq(projects.id, projectId)));
    const head = rows[0];
    if (!head || head.deletedAt) return reply.code(404).send({ error: NO_SUCH_PROJECT });

    return {
      manifest: head.manifest,
      clientUpdatedAt: head.clientUpdatedAt,
      savedBy: await headSavedBy(app.db, ownerId, projectId),
    };
  });

  app.put("/api/groups/:gid/project", async (req, reply) => {
    const { gid } = req.params as { gid: string };
    let ctx: GroupContext;
    try {
      ctx = await requireGroup(app.db, gid, req.user!.id);
      await requireGroupMember(app.db, gid, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (!ctx.group.ownerId || !ctx.group.projectId) {
      return reply.code(404).send({ error: NOT_STARTED });
    }
    const parsed = GroupProjectSaveInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    // The shared schema above says the BODY carries a manifest. This says the
    // manifest is one this server may store: a group's shared project is an
    // ordinary row on the founding member's account, and their own sync
    // engine hands back whatever a member saves into it — so a group save is
    // held to exactly the contract that client's own push is held to, from
    // the one schema, and must NAME the project it is actually saving.
    // Without the id check a member could plant, under the founder's account,
    // a manifest calling itself some other project of theirs.
    const checked = ManifestSchema.safeParse(parsed.data.manifest);
    if (!checked.success || checked.data.id !== ctx.group.projectId) {
      return reply.code(400).send({ error: INVALID_PROJECT_ERROR });
    }
    const manifest = checked.data;
    // The same byte bound the personal engine enforces — a group project is
    // an ordinary project row, and two members' saves must not buy a bigger
    // one than one member's would.
    if (Buffer.byteLength(JSON.stringify(manifest), "utf8") > MAX_MANIFEST_BYTES) {
      return reply.code(413).send({ error: OVERSIZE_ERROR });
    }

    const now = new Date();
    const result = await app.db.transaction(async (tx) => {
      const groupRows = await tx.select().from(groups).where(eq(groups.id, gid)).for("update");
      const current = groupRows[0]!;
      const { ownerId, projectId } = current;
      if (!ownerId || !projectId) return { kind: "not-started" as const };
      // Two different truths, two different sentences: someone else is
      // mid-edit, or nobody is and this member simply never picked it up.
      const holdsBaton = current.batonHolderId === req.user!.id && leaseIsLive(current, now);
      if (!holdsBaton && leaseIsLive(current, now)) return { kind: "held" as const };
      if (!holdsBaton) return { kind: "no-baton" as const };

      const headRows = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, ownerId), eq(projects.id, projectId)))
        .for("update");
      const head = headRows[0];
      if (!head || head.deletedAt) return { kind: "no-project" as const };

      // Nothing is ever lost to a collision (spec §5.5): the previous head
      // goes to history first, stamped with the member doing the saving —
      // the same attribution the personal engine's overwrite records, and
      // what makes the checkpoint list say who saved what.
      await tx.insert(projectVersions).values({
        ownerId,
        projectId,
        manifest: head.manifest,
        clientUpdatedAt: head.clientUpdatedAt,
        savedBy: req.user!.id,
        reason: "overwrite",
      });
      await tx
        .update(projects)
        .set({
          manifest,
          clientUpdatedAt: manifest.updatedAt,
          // Validated above, so the denormalised columns come straight off
          // the manifest — the same three the owner's own push maintains.
          title: manifest.title,
          goal: manifest.goal,
          projectType: manifest.projectType,
          updatedAt: now,
        })
        .where(and(eq(projects.ownerId, ownerId), eq(projects.id, projectId)));
      // A save is proof the holder is still at the keyboard — renew, so a
      // long editing session never has its own next save refused.
      await tx
        .update(groups)
        .set({ batonExpiresAt: new Date(now.getTime() + BATON_TTL_MS) })
        .where(eq(groups.id, gid));
      await logEvent(tx, "group.project_saved", req.user!.id, {
        groupId: gid,
        assignmentId: current.assignmentId,
        projectId,
        clientUpdatedAt: manifest.updatedAt,
      });
      return { kind: "saved" as const, ownerId, projectId };
    });

    if (result.kind === "not-started") return reply.code(404).send({ error: NOT_STARTED });
    if (result.kind === "held") return reply.code(409).send({ error: BATON_HELD });
    if (result.kind === "no-baton") return reply.code(409).send({ error: NO_BATON });
    if (result.kind === "no-project") return reply.code(404).send({ error: NO_SUCH_PROJECT });

    await pruneVersions(app.db, result.ownerId, result.projectId);
    return { ok: true, clientUpdatedAt: manifest.updatedAt };
  });
}

/** Reasons whose version row records a push that did NOT become the head.
 *  `conflict-loser` is the only one: the personal sync engine files a stale
 *  push under it and leaves the head exactly where it was (projects.ts's
 *  kept-remote branch). Every other reason archives the OUTGOING head at the
 *  moment it is replaced, which is what makes the lookup below work. */
const NON_HEAD_REASONS = ["conflict-loser"];

/** Who saved what is now the head. There is no savedBy column on the head
 *  row, and there does not need to be one: a head-moving write archives the
 *  OLD manifest stamped with the member performing the save, so the newest
 *  such version row's savedBy is precisely the author of the CURRENT head.
 *  With no history at all, the head is still exactly as its owner pushed it.
 *
 *  Conflict-losers must be skipped or this lies: the founding member's own
 *  client pushing a stale local copy of the shared project files one under
 *  their name without touching the head, which would otherwise re-credit
 *  them for a checkpoint another member wrote. */
async function headSavedBy(db: Db, ownerId: string, projectId: string): Promise<string> {
  const rows = await db
    .select({ savedBy: projectVersions.savedBy })
    .from(projectVersions)
    .where(
      and(
        eq(projectVersions.ownerId, ownerId),
        eq(projectVersions.projectId, projectId),
        notInArray(projectVersions.reason, NON_HEAD_REASONS),
      ),
    )
    .orderBy(desc(projectVersions.id))
    .limit(1);
  return rows[0]?.savedBy ?? ownerId;
}
