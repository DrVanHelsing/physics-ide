import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { CreateShareInputSchema, AcceptShareInputSchema, WorkspaceRulesSchema } from "@physics-ide/shared";
import {
  assignments,
  assignmentWork,
  classes,
  classMembers,
  groups,
  projects,
  shares,
  users,
} from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { ClassAuthError, getMembership, isStaffRole, sendClassAuthError } from "../classes/guards.js";
import { logEvent } from "../db/events.js";
import type { Db } from "../db/types.js";
import { isAtCap, ManifestSchema } from "./projects.js";
import { pgErrorCode } from "../lib/util.js";

/* Every refusal is a named sentence, asserted verbatim by shares.test.ts
 * and the authority matrix — the assignments.ts idiom. */
const SHARING_OFF = "Peer sharing is off for this class.";
const NOT_A_MEMBER = "Not a member of this class.";
const RECIPIENT_NOT_ACTIVE = "They're not an active member of this class.";
const SELF_SHARE = "You can't share a project with yourself.";
const NO_SUCH_CLASS = "No such class.";
const CLASS_ARCHIVED = "That class is archived.";
const NO_SUCH_PROJECT = "No such project.";
const GROUP_PROJECT = "A group's shared project belongs to the whole group — it can't be shared out.";
const INDIVIDUAL_WORK = "This assignment is individual work — it can't be shared.";
const EXPORT_OFF = "This assignment's rules don't allow copies to leave the workspace.";
const ALREADY_PENDING = "Already shared with them — it's waiting on their class page.";
/* The five below belong to the routes that extend this file (accept, decline,
 * revoke) — declared with the rest so the sentence block reads as one
 * authority rather than arriving piecemeal. */
const NO_SUCH_SHARE = "No such share.";
const SHARE_RESOLVED = "That share has already been dealt with.";
const REVOKE_FORBIDDEN = "Only the sharer or the class teacher can revoke a share.";
/** D§14.8: the recipient must never see the generic own-limit sentence on
 *  someone else's action — the cap refusal at accept has its own words. */
const SHARE_CAP =
  "You're at the 100-project limit — the copy needs a free slot. Delete something first, then add it.";
const COPY_ID_TAKEN = "That project id is already in use — try again.";
/** §11's own word for an erased person, everywhere a sharer's name resolves. */
export const REMOVED_STUDENT = "Removed student";

/** The D§5 gate — ONE function, one place, every refusal a named sentence,
 *  everything failing closed. Thrown as ClassAuthError so the routes keep
 *  the groups.ts try/sendClassAuthError idiom. */
async function requireShareable(
  db: Db,
  sharerId: string,
  input: { classId: string; recipientId: string; projectId: string },
): Promise<{ sourceHead: typeof projects.$inferSelect }> {
  const classRows = await db.select().from(classes).where(eq(classes.id, input.classId));
  const c = classRows[0];
  if (!c) throw new ClassAuthError(404, NO_SUCH_CLASS);
  if (c.archived) throw new ClassAuthError(400, CLASS_ARCHIVED);
  const sharer = await getMembership(db, input.classId, sharerId);
  if (!sharer || sharer.status !== "active") throw new ClassAuthError(403, NOT_A_MEMBER);
  // D§5.1 — the class switch, off by default.
  if (!c.peerSharing) throw new ClassAuthError(403, SHARING_OFF);
  if (input.recipientId === sharerId) throw new ClassAuthError(400, SELF_SHARE);
  // D§5.2 — any role may share and receive, but both must be active members.
  const recipient = await getMembership(db, input.classId, input.recipientId);
  if (!recipient || recipient.status !== "active") {
    throw new ClassAuthError(400, RECIPIENT_NOT_ACTIVE);
  }
  const headRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, sharerId), eq(projects.id, input.projectId)));
  const sourceHead = headRows[0];
  if (!sourceHead || sourceHead.deletedAt) throw new ClassAuthError(404, NO_SUCH_PROJECT);
  // D§5.4 — enforced on the ROW's identity, never the actor: a group
  // member's pulled local copy must not launder the group's work out.
  const groupRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.ownerId, sharerId), eq(groups.projectId, input.projectId)))
    .limit(1);
  if (groupRows.length > 0) throw new ClassAuthError(403, GROUP_PROJECT);
  // D§5.3 — assignment work: the individual-work override (spec §5.1's
  // real meaning, restored), then the export rule — a share is a copy-out
  // and §5.4 carved out submit, not share.
  const workRows = await db
    .select({ assignment: assignments })
    .from(assignmentWork)
    .innerJoin(assignments, eq(assignments.id, assignmentWork.assignmentId))
    .where(and(eq(assignmentWork.ownerId, sharerId), eq(assignmentWork.projectId, input.projectId)));
  for (const { assignment } of workRows) {
    if (assignment.individualWork) throw new ClassAuthError(403, INDIVIDUAL_WORK);
    const rules = WorkspaceRulesSchema.safeParse(assignment.rules);
    // Unreadable rules fail CLOSED — a lockdown that cannot be read is a lockdown.
    if (!rules.success || !rules.data.exportAndCopy) throw new ClassAuthError(403, EXPORT_OFF);
  }
  return { sourceHead };
}

export function shareRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/shares", async (req, reply) => {
    const parsed = CreateShareInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    let sourceHead: typeof projects.$inferSelect;
    try {
      ({ sourceHead } = await requireShareable(app.db, req.user!.id, parsed.data));
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    // One pending hand-off per (source, recipient) — fan-out is one share
    // per recipient (D§1), and a second identical pending row would only
    // let the recipient mint two copies from one gesture.
    const dup = await app.db
      .select({ id: shares.id })
      .from(shares)
      .where(
        and(
          eq(shares.sourceOwnerId, req.user!.id),
          eq(shares.sourceProjectId, parsed.data.projectId),
          eq(shares.recipientId, parsed.data.recipientId),
          eq(shares.status, "pending"),
        ),
      )
      .limit(1);
    if (dup.length > 0) return reply.code(409).send({ error: ALREADY_PENDING });

    const created = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(shares)
        .values({
          classId: parsed.data.classId,
          sharerId: req.user!.id,
          recipientId: parsed.data.recipientId,
          sourceOwnerId: req.user!.id,
          sourceProjectId: parsed.data.projectId,
          frozenManifest: sourceHead.manifest,
          sourceClientUpdatedAt: sourceHead.clientUpdatedAt,
        })
        .returning();
      // D§3: the ledger row, same transaction — a share cannot happen
      // without its event. D§9: the label will name the immediate sharer;
      // the LEDGER records the chain, so the source's own attribution (if
      // this is a re-share of an accepted copy) rides the payload.
      await logEvent(tx, "project.shared", req.user!.id, {
        shareId: row.id,
        classId: parsed.data.classId,
        recipientId: parsed.data.recipientId,
        sourceOwnerId: req.user!.id,
        sourceProjectId: parsed.data.projectId,
        sourceClientUpdatedAt: sourceHead.clientUpdatedAt,
        sourceAttribution: sourceHead.attribution ?? null,
      });
      return row;
    });
    return reply.code(201).send({
      share: {
        id: created.id,
        classId: created.classId,
        recipientId: created.recipientId,
        status: created.status,
      },
    });
  });

  app.post("/api/shares/:id/accept", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = AcceptShareInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const result = await app.db.transaction(async (tx) => {
      const rows = await tx.select().from(shares).where(eq(shares.id, id)).for("update");
      const share = rows[0];
      // A share that is not yours to accept does not exist for you.
      if (!share || share.recipientId !== req.user!.id) return { kind: "missing" as const };
      const m = await getMembership(tx, share.classId, req.user!.id);
      if (!m || m.status !== "active") return { kind: "not-member" as const };
      if (share.status !== "pending") return { kind: "resolved" as const };
      // D§14.8 — their cap, their slot, their OWN sentence. isAtCap locks
      // the recipient's user row, serializing against their own pushes.
      if (await isAtCap(tx, req.user!.id)) return { kind: "cap" as const };
      // D§2: an ordinary project under a FRESH id — never the source's.
      // The manifest the row stores is EXACTLY the manifest the reply
      // carries; the client saves it verbatim (preserveTimestamp) and its
      // later push lands in projects.ts's identical-re-push no-op branch.
      const checked = ManifestSchema.safeParse({
        ...(share.frozenManifest as Record<string, unknown>),
        id: parsed.data.projectId,
      });
      if (!checked.success) return { kind: "invalid" as const };
      try {
        await tx.transaction(async (sp) => {
          await sp.insert(projects).values({
            id: checked.data.id,
            ownerId: req.user!.id,
            title: checked.data.title,
            goal: checked.data.goal,
            projectType: checked.data.projectType,
            manifest: checked.data,
            clientUpdatedAt: checked.data.updatedAt,
            // D§3: ids only — the name is resolved at read time, so §11
            // erasure has one place to act.
            attribution: { sharerId: share.sharerId, shareId: share.id },
          });
        });
      } catch (err) {
        if (pgErrorCode(err) === "23505") return { kind: "taken" as const };
        throw err;
      }
      await tx
        .update(shares)
        .set({ status: "accepted", resolvedAt: new Date(), copyProjectId: checked.data.id })
        .where(eq(shares.id, share.id));
      await logEvent(tx, "project.share_accepted", req.user!.id, {
        shareId: share.id,
        classId: share.classId,
        sharerId: share.sharerId,
        sourceOwnerId: share.sourceOwnerId,
        sourceProjectId: share.sourceProjectId,
        sourceClientUpdatedAt: share.sourceClientUpdatedAt,
        copyProjectId: checked.data.id,
      });
      return { kind: "accepted" as const, share, manifest: checked.data };
    });

    if (result.kind === "missing") return reply.code(404).send({ error: NO_SUCH_SHARE });
    if (result.kind === "not-member") return reply.code(403).send({ error: NOT_A_MEMBER });
    if (result.kind === "resolved") return reply.code(409).send({ error: SHARE_RESOLVED });
    if (result.kind === "cap") return reply.code(403).send({ error: SHARE_CAP });
    if (result.kind === "invalid") return reply.code(400).send({ error: "That doesn't look like a valid project." });
    if (result.kind === "taken") return reply.code(409).send({ error: COPY_ID_TAKEN });

    const sharerRows = await app.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, result.share.sharerId));
    return {
      manifest: result.manifest,
      attribution: {
        sharerId: result.share.sharerId,
        shareId: result.share.id,
        sharerName: sharerRows[0]?.name ?? REMOVED_STUDENT,
      },
    };
  });

  app.get("/api/shares/incoming", async (req, reply) => {
    const classId = z.string().uuid().safeParse((req.query as { classId?: string }).classId);
    if (!classId.success) return reply.code(400).send({ error: "Invalid input." });
    const m = await getMembership(app.db, classId.data, req.user!.id);
    if (!m || m.status !== "active") return reply.code(403).send({ error: NOT_A_MEMBER });
    const rows = await app.db
      .select({ share: shares, sharerName: users.name })
      .from(shares)
      .leftJoin(users, eq(users.id, shares.sharerId))
      .where(
        and(
          eq(shares.classId, classId.data),
          eq(shares.recipientId, req.user!.id),
          eq(shares.status, "pending"),
        ),
      )
      .orderBy(desc(shares.createdAt));
    return {
      shares: rows.map(({ share, sharerName }) => ({
        id: share.id,
        classId: share.classId,
        title: (share.frozenManifest as { title?: string }).title ?? "Untitled project",
        // §11 erasure: the name resolves at read time, or to the same word
        // the spec uses for erased submissions.
        sharerName: sharerName ?? REMOVED_STUDENT,
        createdAt: share.createdAt.getTime(),
      })),
    };
  });

  // The client's online name-refresh feed (Task 13's refreshShareAttributions)
  // and the second-device path by which a copy accepted elsewhere gains its
  // local label: every live attributed project the CALLER owns, names
  // resolved fresh so §11 erasure has one place to act.
  app.get("/api/shares/attributions", async (req) => {
    const rows = await app.db
      .select({ id: projects.id, attribution: projects.attribution })
      .from(projects)
      .where(
        and(
          eq(projects.ownerId, req.user!.id),
          isNotNull(projects.attribution),
          isNull(projects.deletedAt),
        ),
      );
    const sharerIds = [...new Set(rows.map((r) => (r.attribution as { sharerId: string }).sharerId))];
    const named = sharerIds.length
      ? await app.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, sharerIds))
      : [];
    const nameById = new Map(named.map((u) => [u.id, u.name]));
    const attributions: Record<string, { sharerId: string; shareId: string; sharerName: string }> = {};
    for (const r of rows) {
      const a = r.attribution as { sharerId: string; shareId: string };
      attributions[r.id] = {
        sharerId: a.sharerId,
        shareId: a.shareId,
        // §11: resolved at read time — an erased sharer is the same
        // "Removed student" the spec uses for erased submissions.
        sharerName: nameById.get(a.sharerId) ?? REMOVED_STUDENT,
      };
    }
    return { attributions };
  });

  app.get("/api/shares/roster/:classId", async (req, reply) => {
    const { classId } = req.params as { classId: string };
    const classRows = await app.db.select().from(classes).where(eq(classes.id, classId));
    const c = classRows[0];
    if (!c) return reply.code(404).send({ error: NO_SUCH_CLASS });
    const m = await getMembership(app.db, classId, req.user!.id);
    if (!m || m.status !== "active") return reply.code(403).send({ error: NOT_A_MEMBER });
    // The picker obeys the same switch as the share itself — no roster
    // browsing through a feature the teacher has off (D§5 fails closed).
    if (!c.peerSharing) return reply.code(403).send({ error: SHARING_OFF });
    const rows = await app.db
      .select({ userId: classMembers.userId, name: users.name, role: classMembers.role })
      .from(classMembers)
      .innerJoin(users, eq(classMembers.userId, users.id))
      .where(and(eq(classMembers.classId, classId), eq(classMembers.status, "active")))
      .orderBy(users.name);
    return { members: rows.filter((r) => r.userId !== req.user!.id) };
  });

  app.post("/api/shares/:id/revoke", async (req, reply) => {
    const { id } = req.params as { id: string };
    const outcome = await app.db.transaction(async (tx) => {
      const rows = await tx.select().from(shares).where(eq(shares.id, id)).for("update");
      const share = rows[0];
      if (!share) return { kind: "missing" as const };
      const m = await getMembership(tx, share.classId, req.user!.id);
      const active = !!m && m.status === "active";
      // CONTROLLER RULING (deviation from the task-8 brief's drafted line):
      // widen maySee to any active class STAFF, not just the teacher role.
      // A TA is class staff, not a stranger, so a TA's revoke attempt must
      // be able to reach REVOKE_FORBIDDEN's honest sentence rather than the
      // draft-404 posture that exists to hide a share's existence from
      // people with no standing on it at all.
      const maySee =
        active &&
        (share.sharerId === req.user!.id ||
          share.recipientId === req.user!.id ||
          isStaffRole(m!.role));
      if (!maySee) return { kind: "missing" as const }; // existence is not their business
      const mayRevoke = active && (share.sharerId === req.user!.id || m!.role === "teacher");
      if (!mayRevoke) return { kind: "forbidden" as const };
      if (share.status !== "pending") return { kind: "resolved" as const };
      await tx
        .update(shares)
        .set({ status: "revoked", resolvedAt: new Date() })
        .where(eq(shares.id, id));
      await logEvent(tx, "project.share_revoked", req.user!.id, {
        shareId: id,
        classId: share.classId,
        sharerId: share.sharerId,
        recipientId: share.recipientId,
      });
      return { kind: "revoked" as const };
    });
    if (outcome.kind === "missing") return reply.code(404).send({ error: NO_SUCH_SHARE });
    if (outcome.kind === "forbidden") return reply.code(403).send({ error: REVOKE_FORBIDDEN });
    if (outcome.kind === "resolved") return reply.code(409).send({ error: SHARE_RESOLVED });
    return { ok: true };
  });
}
