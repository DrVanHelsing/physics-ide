import type { FastifyInstance } from "fastify";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { users, emails, emailTokens } from "../db/schema.js";
import { getSetting, setSetting } from "../db/settings.js";
import { requireAdmin } from "../auth/guards.js";
import { destroyAllUserSessions } from "../auth/session.js";
import { logEvent } from "../db/events.js";
import { newToken } from "../auth/tokens.js";
import { confirmEmail, resetEmail } from "../email/templates.js";
import { config } from "../config.js";
import { toAuthUser, CONFIRM_TTL_MS, RESET_TTL_MS } from "./auth.js";

const CapSchema = z.object({ cap: z.number().int().min(1).max(10000) });

export function adminRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/users", async (req) => {
    const q = (req.query as { q?: string }).q?.trim();
    const base = app.db.select().from(users);
    const rows = q
      ? await base.where(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)))
      : await base;
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      users: rows.slice(0, 200).map((u) => ({
        ...toAuthUser(u),
        active: u.active,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/admin/users/:id/deactivate", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user!.id) {
      return reply.code(400).send({ error: "You cannot deactivate your own account." });
    }
    const [u] = await app.db.update(users).set({ active: false }).where(eq(users.id, id)).returning();
    if (!u) return reply.code(404).send({ error: "No such account." });
    await destroyAllUserSessions(app.db, id);
    await logEvent(app.db, "account.deactivated", req.user!.id, { subject: id });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/reactivate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [u] = await app.db.update(users).set({ active: true }).where(eq(users.id, id)).returning();
    if (!u) return reply.code(404).send({ error: "No such account." });
    await logEvent(app.db, "account.reactivated", req.user!.id, { subject: id });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/resend-confirmation", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(users).where(eq(users.id, id));
    const u = rows[0];
    if (!u) return reply.code(404).send({ error: "No such account." });
    if (u.emailConfirmedAt) {
      return reply.code(400).send({ error: "That account is already confirmed." });
    }
    const t = newToken();
    await app.db.insert(emailTokens).values({
      userId: u.id,
      type: "confirm",
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
    });
    const mail = confirmEmail({
      name: u.name,
      confirmUrl: `${config.appBaseUrl}/auth/confirm?token=${t.token}`,
    });
    await app.mailer.send({ to: u.email, toUserId: u.id, template: "confirm", ...mail });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/send-reset", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(users).where(eq(users.id, id));
    const u = rows[0];
    if (!u) return reply.code(404).send({ error: "No such account." });
    const t = newToken();
    await app.db.insert(emailTokens).values({
      userId: u.id,
      type: "reset",
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const mail = resetEmail({
      name: u.name,
      resetUrl: `${config.appBaseUrl}/auth/reset?token=${t.token}`,
    });
    await app.mailer.send({ to: u.email, toUserId: u.id, template: "reset", ...mail });
    return { ok: true };
  });

  app.get("/api/admin/cap", async () => {
    const cap = (await getSetting(app.db, "account_cap")) ?? 200;
    const [{ count }] = await app.db.select({ count: sql<number>`count(*)::int` }).from(users);
    return { cap, count };
  });

  app.put("/api/admin/cap", async (req, reply) => {
    const parsed = CapSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "cap must be a whole number ≥ 1." });
    await setSetting(app.db, "account_cap", parsed.data.cap);
    await logEvent(app.db, "settings.cap_changed", req.user!.id, { cap: parsed.data.cap });
    return { ok: true, cap: parsed.data.cap };
  });

  app.get("/api/admin/emails", async (req) => {
    const limitRaw = Number((req.query as { limit?: string }).limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 100;
    const rows = await app.db.select().from(emails).orderBy(desc(emails.id)).limit(limit);
    return {
      emails: rows.map((e) => ({
        id: e.id,
        toEmail: e.toEmail,
        template: e.template,
        subject: e.subject,
        bodyText: e.bodyText,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });

  app.get("/api/admin/health", async () => {
    const [{ count: userCount }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [{ count: emailCount }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emails);
    const cap = (await getSetting(app.db, "account_cap")) ?? 200;
    return { ok: true, db: "ok", users: userCount, cap, emailsLogged: emailCount };
  });
}
