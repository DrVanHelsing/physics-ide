import type { FastifyInstance } from "fastify";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { InviteInputSchema, AcceptInviteInputSchema } from "@physics-ide/shared";
import { classes, classMembers, invites, users } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { requireClassTeacher, sendClassAuthError } from "../classes/guards.js";
import { newToken, hashToken } from "../auth/tokens.js";
import { classInvite } from "../email/templates.js";
import { logEvent } from "../db/events.js";
import { notify } from "../notifications/notify.js";
import { config } from "../config.js";

/** DEPLOY.md box 8 — invite pacing. The 50-address zod cap on one batch
 *  (`InviteInputSchema`, shared/src/classes.ts) stays; this is an
 *  ADDITIONAL cap, 5x that, on the ROLLING HOUR: `invites` rows with
 *  `invitedBy = caller` and `createdAt > now() - 1 hour`. "5 batches/hour"
 *  isn't derivable — an `invites` row is per ADDRESS, not per batch (the
 *  loop below opens one write per recipient, and the table carries no
 *  batch id, schema.ts:132-146) — so a row is the only unit this table can
 *  count. */
export const INVITE_PACE_CAP = 250;
export const INVITE_PACE_WINDOW_MS = 60 * 60 * 1000;
export const INVITE_PACE_MESSAGE = "Too many invites sent recently. Try again in a bit.";

/** classid for the invite-pacing cap's per-teacher advisory lock (two-arg
 *  form — see classes.ts's CLASS_CREATE_LOCK_CLASSID doc comment for why
 *  this namespace can't collide with the one-arg locks). Distinct from
 *  auth.ts's 100025 and classes.ts's 100026 so none of the three
 *  per-subject locks can contend with each other. */
const INVITE_PACE_LOCK_CLASSID = 100027;

export function inviteRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/classes/:id/invites", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, id));
    if (!c) return reply.code(404).send({ error: "No such class." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    const parsed = InviteInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    // Emails already holding an ACTIVE membership are skipped, not errored (spec: invite tools are forgiving).
    // WAITING members are NOT skipped: an invite is how a teacher pulls someone straight
    // into active, bypassing the approval queue (see the accept route's upgrade branch).
    const existingUsers = await app.db
      .select({ user: users, member: classMembers })
      .from(users)
      .innerJoin(
        classMembers,
        and(
          eq(classMembers.userId, users.id),
          eq(classMembers.classId, id),
          eq(classMembers.status, "active"),
        ),
      )
      .where(inArray(users.email, parsed.data.emails));
    const memberEmails = new Set(existingUsers.map((r) => r.user.email));
    const skipped = parsed.data.emails.filter((email) => memberEmails.has(email));
    const toInvite = parsed.data.emails.filter((email) => !memberEmails.has(email));

    // `invited` records what this route actually does — an invite row and a
    // token created, and a send attempted — NOT that delivery succeeded.
    // Once neverThrow (guards.ts) sits outermost on app.mailer, a driver
    // rejection never surfaces here, so a field named "sent" would silently
    // start lying: every address would land in it regardless of how many
    // rows the driver actually delivered. Delivery is a separate fact,
    // tracked in the emails table — the admin email log is where it lives.
    const invited: string[] = [];
    if (toInvite.length > 0) {
      // DEPLOY.md box 8 — the pacing gate and this batch's row inserts
      // share ONE transaction under a per-teacher advisory lock: the same
      // "commits the count+insert" shape auth.ts's reset cap uses (Task
      // 5's CRITICAL fix), generalised from one row to up to 50. The lock
      // covers only these fast DB writes — never the mail round-trips
      // below, which is what "not a lock held across 50 sends" (dispatch)
      // actually requires: mint every token first (pure, no I/O), then one
      // transaction gates on the count and, only if under cap, inserts
      // every row and its event; the mail loop runs strictly after that
      // transaction has committed.
      const minted = toInvite.map((email) => ({ email, t: newToken() }));
      let paced = false;
      await app.db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(${INVITE_PACE_LOCK_CLASSID}, hashtext(${req.user!.id}))`,
        );
        const [{ count: recentInvites }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(invites)
          .where(
            and(
              eq(invites.invitedBy, req.user!.id),
              gt(invites.createdAt, new Date(Date.now() - INVITE_PACE_WINDOW_MS)),
            ),
          );
        if (recentInvites + minted.length > INVITE_PACE_CAP) {
          paced = true;
          return;
        }
        for (const { email, t } of minted) {
          await tx.insert(invites).values({
            classId: id,
            email,
            role: parsed.data.role,
            tokenHash: t.hash,
            invitedBy: req.user!.id,
          });
          await logEvent(tx, "invite.sent", req.user!.id, { classId: id, email, role: parsed.data.role });
        }
      });
      if (paced) {
        return reply.code(429).send({ error: INVITE_PACE_MESSAGE });
      }
      for (const { email, t } of minted) {
        const mail = classInvite({
          className: c.name,
          inviterName: req.user!.name,
          joinUrl: `${config.appBaseUrl}/join/invite?token=${t.token}`,
          role: parsed.data.role,
        });
        await app.mailer.send({ to: email, template: "class-invite", ...mail });
        invited.push(email);
      }
    }
    return { invited, skipped };
  });

  app.get("/api/classes/:id/invites", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const rows = await app.db
      .select()
      .from(invites)
      .where(and(eq(invites.classId, id), eq(invites.status, "pending")));
    return {
      invites: rows.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/invites/:id/revoke", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(invites).where(eq(invites.id, id));
    const inv = rows[0];
    if (!inv) return reply.code(404).send({ error: "No such invite." });
    try {
      await requireClassTeacher(app.db, inv.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (inv.status !== "pending") {
      return reply.code(400).send({ error: "That invite is not pending." });
    }
    const missed = await app.db.transaction(async (tx) => {
      // Re-check status inside the UPDATE's where: a concurrent accept between the
      // pre-check above and this write must not clobber an already-accepted invite.
      const updated = await tx
        .update(invites)
        .set({ status: "revoked" })
        .where(and(eq(invites.id, id), eq(invites.status, "pending")))
        .returning();
      if (updated.length === 0) return true;
      await logEvent(tx, "invite.revoked", req.user!.id, { classId: inv.classId, email: inv.email });
      return false;
    });
    if (missed) {
      return reply.code(400).send({ error: "That invite is not pending." });
    }
    return { ok: true };
  });

  app.post("/api/invites/:id/resend", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(invites).where(eq(invites.id, id));
    const inv = rows[0];
    if (!inv) return reply.code(404).send({ error: "No such invite." });
    try {
      await requireClassTeacher(app.db, inv.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (inv.status !== "pending") {
      return reply.code(400).send({ error: "That invite is not pending." });
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, inv.classId));
    if (!c) return reply.code(404).send({ error: "No such class." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    const t = newToken();
    const missed = await app.db.transaction(async (tx) => {
      // Rotate the token: the previously emailed link stops working. Re-check status
      // inside the UPDATE's where: a concurrent accept must not resurrect a dead invite.
      const updated = await tx
        .update(invites)
        .set({ tokenHash: t.hash })
        .where(and(eq(invites.id, id), eq(invites.status, "pending")))
        .returning();
      if (updated.length === 0) return true;
      await logEvent(tx, "invite.sent", req.user!.id, {
        classId: inv.classId,
        email: inv.email,
        resend: true,
      });
      return false;
    });
    if (missed) {
      return reply.code(400).send({ error: "That invite is not pending." });
    }
    const mail = classInvite({
      className: c.name,
      inviterName: req.user!.name,
      joinUrl: `${config.appBaseUrl}/join/invite?token=${t.token}`,
      role: inv.role as "student" | "ta" | "teacher",
    });
    await app.mailer.send({ to: inv.email, template: "class-invite", ...mail });
    return { ok: true };
  });

  app.post("/api/invites/accept", async (req, reply) => {
    const parsed = AcceptInviteInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "That invite link is no longer valid." });
    }
    const tokenHash = hashToken(parsed.data.token);
    let result;
    try {
      result = await app.db.transaction(async (tx) => {
        // Atomic claim, Plan 2 pattern: only a pending invite flips to accepted.
        const claimed = await tx
          .update(invites)
          .set({ status: "accepted", acceptedBy: req.user!.id })
          .where(and(eq(invites.tokenHash, tokenHash), eq(invites.status, "pending")))
          .returning();
        const inv = claimed[0];
        if (!inv) return null;
        // Refuse (and roll back the claim) if the class went archived after the invite
        // was sent — the invite stays pending so a teacher can decide, not silently burn.
        const [c] = await tx.select().from(classes).where(eq(classes.id, inv.classId));
        if (c?.archived) throw new AcceptIntoArchivedClass();
        const existing = await tx
          .select()
          .from(classMembers)
          .where(and(eq(classMembers.classId, inv.classId), eq(classMembers.userId, req.user!.id)));
        if (existing.length === 0) {
          // Invited members land active regardless of joinMode — the teacher asked for them.
          await tx.insert(classMembers).values({
            classId: inv.classId,
            userId: req.user!.id,
            role: inv.role,
            status: "active",
          });
        } else if (existing[0].status === "waiting") {
          await tx
            .update(classMembers)
            .set({ status: "active", role: inv.role })
            .where(eq(classMembers.id, existing[0].id));
        } else if (existing[0].status === "active" && existing[0].role !== inv.role) {
          // Already active (e.g. joined by code separately): the invite is still the
          // promotion path, so apply its role rather than silently no-op-ing.
          await tx
            .update(classMembers)
            .set({ role: inv.role })
            .where(eq(classMembers.id, existing[0].id));
        }
        const eid = await logEvent(tx, "invite.accepted", req.user!.id, {
          classId: inv.classId,
          invitedEmail: inv.email,
          role: inv.role,
        });
        // Task 5, site 9: the class's active teachers — the quiet joined
        // event's second door (an invited member lands ACTIVE without
        // passing the join route), same select as site 8.
        //
        // Fix (review finding): when the invite confers `teacher`, the role
        // update above already committed the acceptor as an active teacher
        // in THIS transaction, so this select would otherwise include them —
        // self-notifying them about their own acceptance. Site 8's mandated
        // joiner exclusion shows the design never wants the actor notified
        // about their own action, so the actor is filtered out here too.
        const teachers = await tx
          .select({ userId: classMembers.userId })
          .from(classMembers)
          .where(
            and(
              eq(classMembers.classId, inv.classId),
              eq(classMembers.role, "teacher"),
              eq(classMembers.status, "active"),
            ),
          );
        await notify(
          tx,
          teachers.map((t) => t.userId).filter((uid) => uid !== req.user!.id),
          eid,
          "invite.accepted",
          { classId: inv.classId, joinerId: req.user!.id },
        );
        return inv;
      });
    } catch (err) {
      if (err instanceof AcceptIntoArchivedClass) {
        return reply.code(400).send({ error: "That class is archived." });
      }
      throw err;
    }
    if (!result) {
      return reply.code(400).send({ error: "That invite link is no longer valid." });
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, result.classId));
    return { ok: true, classId: result.classId, className: c?.name ?? "", status: "active" };
  });
}

class AcceptIntoArchivedClass extends Error {}
