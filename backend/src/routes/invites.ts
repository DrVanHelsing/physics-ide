import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { InviteInputSchema, AcceptInviteInputSchema } from "@physics-ide/shared";
import { classes, classMembers, invites, users } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { getMembership, requireClassTeacher, sendClassAuthError } from "../classes/guards.js";
import { newToken, hashToken } from "../auth/tokens.js";
import { classInvite } from "../email/templates.js";
import { logEvent } from "../db/events.js";
import { config } from "../config.js";

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
    const existingUsers = await app.db
      .select({ user: users, member: classMembers })
      .from(users)
      .innerJoin(
        classMembers,
        and(eq(classMembers.userId, users.id), eq(classMembers.classId, id)),
      )
      .where(inArray(users.email, parsed.data.emails));
    const memberEmails = new Set(existingUsers.map((r) => r.user.email));

    const sent: string[] = [];
    const skipped: string[] = [];
    for (const email of parsed.data.emails) {
      if (memberEmails.has(email)) {
        skipped.push(email);
        continue;
      }
      const t = newToken();
      await app.db.transaction(async (tx) => {
        await tx.insert(invites).values({
          classId: id,
          email,
          role: parsed.data.role,
          tokenHash: t.hash,
          invitedBy: req.user!.id,
        });
        await logEvent(tx, "invite.sent", req.user!.id, { classId: id, email, role: parsed.data.role });
      });
      const mail = classInvite({
        className: c.name,
        inviterName: req.user!.name,
        joinUrl: `${config.appBaseUrl}/join/invite?token=${t.token}`,
        role: parsed.data.role,
      });
      await app.mailer.send({ to: email, template: "class-invite", ...mail });
      sent.push(email);
    }
    return { sent, skipped };
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
    await app.db.transaction(async (tx) => {
      await tx.update(invites).set({ status: "revoked" }).where(eq(invites.id, id));
      await logEvent(tx, "invite.revoked", req.user!.id, { classId: inv.classId, email: inv.email });
    });
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
    const t = newToken();
    await app.db.transaction(async (tx) => {
      // Rotate the token: the previously emailed link stops working.
      await tx.update(invites).set({ tokenHash: t.hash }).where(eq(invites.id, id));
      await logEvent(tx, "invite.sent", req.user!.id, {
        classId: inv.classId,
        email: inv.email,
        resend: true,
      });
    });
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
    const result = await app.db.transaction(async (tx) => {
      // Atomic claim, Plan 2 pattern: only a pending invite flips to accepted.
      const claimed = await tx
        .update(invites)
        .set({ status: "accepted", acceptedBy: req.user!.id })
        .where(and(eq(invites.tokenHash, tokenHash), eq(invites.status, "pending")))
        .returning();
      const inv = claimed[0];
      if (!inv) return null;
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
      }
      await logEvent(tx, "invite.accepted", req.user!.id, {
        classId: inv.classId,
        invitedEmail: inv.email,
        role: inv.role,
      });
      return inv;
    });
    if (!result) {
      return reply.code(400).send({ error: "That invite link is no longer valid." });
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, result.classId));
    return { ok: true, classId: result.classId, className: c?.name ?? "", status: "active" };
  });
}
