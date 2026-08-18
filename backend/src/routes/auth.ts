import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { eq, sql, and, isNull, gt, ne } from "drizzle-orm";
import {
  SignupInputSchema,
  ConfirmInputSchema,
  SigninInputSchema,
  UpdateMeInputSchema,
  ForgotInputSchema,
  ResetInputSchema,
  ChangePasswordInputSchema,
  ACCOUNT_CAP_MESSAGE,
  type AuthUser,
} from "@physics-ide/shared";
import { users, emailTokens, settings, sessions } from "../db/schema.js";
import { logEvent } from "../db/events.js";
import { newToken, hashToken } from "../auth/tokens.js";
import {
  createSession,
  destroySessionByToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "../auth/session.js";
import { requireUser } from "../auth/guards.js";
import { confirmEmail, teacherSignupAlert, resetEmail } from "../email/templates.js";
import { config } from "../config.js";

export const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;

export function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as AuthUser["role"],
    isTeacher: row.isTeacher,
    emailConfirmed: row.emailConfirmedAt !== null,
  };
}

export function authRoutes(app: FastifyInstance): void {
  app.post(
    "/api/auth/signup",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = SignupInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
      }
      const input = parsed.data;
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      const confirm = newToken();

      let userId: string;
      try {
        userId = await app.db.transaction(async (tx) => {
          // Serialise cap checks: two simultaneous signups must not both pass at cap-1.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(42)`);
          const capRows = await tx.select().from(settings).where(eq(settings.key, "account_cap"));
          const cap = typeof capRows[0]?.value === "number" ? (capRows[0].value as number) : 200;
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(users);
          if (count >= cap) throw new CapReached();

          const [u] = await tx
            .insert(users)
            .values({
              name: input.name,
              email: input.email,
              passwordHash,
              isTeacher: input.wantsTeacher,
              consentAt: new Date(),
            })
            .returning();
          await tx.insert(emailTokens).values({
            userId: u.id,
            type: "confirm",
            tokenHash: confirm.hash,
            expiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
          });
          await logEvent(tx, "account.signup", u.id, {
            email: u.email,
            wantsTeacher: input.wantsTeacher,
          });
          return u.id;
        });
      } catch (err) {
        if (err instanceof CapReached) {
          return reply.code(403).send({ error: ACCOUNT_CAP_MESSAGE });
        }
        if (pgErrorCode(err) === "23505") {
          return reply.code(409).send({ error: "An account with this email already exists." });
        }
        throw err;
      }

      const confirmUrl = `${config.appBaseUrl}/auth/confirm?token=${confirm.token}`;
      const mail = confirmEmail({ name: input.name, confirmUrl });
      await app.mailer.send({
        to: input.email,
        toUserId: userId,
        template: "confirm",
        ...mail,
      });

      if (input.wantsTeacher) {
        const admins = await app.db.select().from(users).where(eq(users.role, "admin"));
        const alert = teacherSignupAlert({
          name: input.name,
          email: input.email,
          time: new Date().toISOString(),
          consoleUrl: `${config.appBaseUrl}/admin`,
        });
        for (const admin of admins) {
          await app.mailer.send({
            to: admin.email,
            toUserId: admin.id,
            template: "teacher-alert",
            ...alert,
          });
        }
      }

      return reply.code(201).send({ ok: true });
    },
  );

  app.post("/api/auth/confirm", async (req, reply) => {
    const parsed = ConfirmInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "That link is invalid or has expired." });
    }
    const tokenHash = hashToken(parsed.data.token);
    const now = new Date();
    const updated = await app.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(emailTokens)
        .where(
          and(
            eq(emailTokens.tokenHash, tokenHash),
            eq(emailTokens.type, "confirm"),
            isNull(emailTokens.usedAt),
            gt(emailTokens.expiresAt, now),
          ),
        );
      const tok = rows[0];
      if (!tok) return false;
      await tx.update(emailTokens).set({ usedAt: now }).where(eq(emailTokens.id, tok.id));
      await tx
        .update(users)
        .set({ emailConfirmedAt: now })
        .where(eq(users.id, tok.userId));
      await logEvent(tx, "account.confirmed", tok.userId, {});
      return true;
    });
    if (!updated) {
      return reply.code(400).send({ error: "That link is invalid or has expired." });
    }
    return { ok: true };
  });

  app.post(
    "/api/auth/signin",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = SigninInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(401).send({ error: "Invalid email or password." });
      }
      const rows = await app.db.select().from(users).where(eq(users.email, parsed.data.email));
      const user = rows[0];
      const ok = user ? await argon2.verify(user.passwordHash, parsed.data.password) : false;
      if (!user || !ok) {
        return reply.code(401).send({ error: "Invalid email or password." });
      }
      if (!user.active) {
        return reply.code(403).send({ error: "This account has been deactivated." });
      }
      const session = await createSession(app.db, user.id);
      await logEvent(app.db, "auth.signin", user.id, {});
      reply.setCookie(SESSION_COOKIE, session.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: config.nodeEnv === "production",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return { user: toAuthUser(user) };
    },
  );

  app.post("/api/auth/signout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await destroySessionByToken(app.db, token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireUser }, async (req) => {
    return { user: toAuthUser(req.user!) };
  });

  app.patch("/api/auth/me", { preHandler: requireUser }, async (req, reply) => {
    const parsed = UpdateMeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const [updated] = await app.db
      .update(users)
      .set({ name: parsed.data.name })
      .where(eq(users.id, req.user!.id))
      .returning();
    return { user: toAuthUser(updated) };
  });

  app.post(
    "/api/auth/forgot",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = ForgotInputSchema.safeParse(req.body);
      if (!parsed.success) return { ok: true };
      const rows = await app.db.select().from(users).where(eq(users.email, parsed.data.email));
      const user = rows[0];
      if (user && user.active) {
        const reset = newToken();
        await app.db.insert(emailTokens).values({
          userId: user.id,
          type: "reset",
          tokenHash: reset.hash,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        });
        const mail = resetEmail({
          name: user.name,
          resetUrl: `${config.appBaseUrl}/auth/reset?token=${reset.token}`,
        });
        await app.mailer.send({ to: user.email, toUserId: user.id, template: "reset", ...mail });
      }
      return reply.code(200).send({ ok: true });
    },
  );

  app.post(
    "/api/auth/reset",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = ResetInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "That link is invalid or has expired." });
      }
      const tokenHash = hashToken(parsed.data.token);
      const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
      const now = new Date();
      const done = await app.db.transaction(async (tx) => {
        const rows = await tx
          .select()
          .from(emailTokens)
          .where(
            and(
              eq(emailTokens.tokenHash, tokenHash),
              eq(emailTokens.type, "reset"),
              isNull(emailTokens.usedAt),
              gt(emailTokens.expiresAt, now),
            ),
          );
        const tok = rows[0];
        if (!tok) return false;
        await tx.update(emailTokens).set({ usedAt: now }).where(eq(emailTokens.id, tok.id));
        // Any other outstanding reset links die with this one.
        await tx
          .update(emailTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(emailTokens.userId, tok.userId),
              eq(emailTokens.type, "reset"),
              isNull(emailTokens.usedAt),
            ),
          );
        await tx.update(users).set({ passwordHash }).where(eq(users.id, tok.userId));
        await tx.delete(sessions).where(eq(sessions.userId, tok.userId));
        await logEvent(tx, "account.password_reset", tok.userId, {});
        return true;
      });
      if (!done) return reply.code(400).send({ error: "That link is invalid or has expired." });
      return { ok: true };
    },
  );

  app.post("/api/auth/change-password", { preHandler: requireUser }, async (req, reply) => {
    const parsed = ChangePasswordInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const ok = await argon2.verify(req.user!.passwordHash, parsed.data.currentPassword);
    if (!ok) {
      return reply.code(400).send({ error: "Your current password is incorrect." });
    }
    const passwordHash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
    const currentTokenHash = hashToken(req.cookies[SESSION_COOKIE]!);
    await app.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, req.user!.id));
      await tx
        .delete(sessions)
        .where(and(eq(sessions.userId, req.user!.id), ne(sessions.tokenHash, currentTokenHash)));
      await logEvent(tx, "account.password_reset", req.user!.id, { via: "change-password" });
    });
    return { ok: true };
  });
}

class CapReached extends Error {}

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause. */
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}
