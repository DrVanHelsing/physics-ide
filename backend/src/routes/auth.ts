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
  SWITCHABLE_EMAIL_KEYS,
  type AuthUser,
  type SwitchableEmailKey,
} from "@physics-ide/shared";
import { users, emailTokens, settings, sessions, notificationPrefs } from "../db/schema.js";
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
import { pgErrorCode } from "../lib/util.js";
import type { Db } from "../db/types.js";

export const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;

/** DEPLOY.md box 7, first half — per-address reset throttle. Counted in the
 *  database (not in memory: this process is one of N on Cloud Run), by
 *  joining `email_tokens` to `users` on the submitted address. `email_tokens`
 *  carries no email column (schema.ts:50-59) — it is keyed by `userId` and
 *  shared by both flows, signup inserting `type: "confirm"` and this route
 *  inserting `type: "reset"` below — so the `type` filter is load-bearing:
 *  without it, a fresh signup's confirm token would consume a stranger's
 *  reset budget. */
export const RESET_REQUEST_CAP = 3;
export const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;

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

/** ONE resolver for GET me and the PATCH reply (Plan 8 Task 8) — an absent
 *  row means the default, ON, matching withPreferences.ts's send-time read. */
async function resolvePrefs(
  db: Db,
  userId: string,
): Promise<Record<SwitchableEmailKey, boolean>> {
  const rows = await db
    .select({ key: notificationPrefs.key, enabled: notificationPrefs.enabled })
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, userId));
  const rowsByKey = new Map(rows.map((r) => [r.key, r.enabled]));
  return Object.fromEntries(
    SWITCHABLE_EMAIL_KEYS.map((k) => [k, rowsByKey.get(k) ?? true]),
  ) as Record<SwitchableEmailKey, boolean>;
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
      const claimed = await tx
        .update(emailTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(emailTokens.tokenHash, tokenHash),
            eq(emailTokens.type, "confirm"),
            isNull(emailTokens.usedAt),
            gt(emailTokens.expiresAt, now),
          ),
        )
        .returning();
      const tok = claimed[0];
      if (!tok) return false;
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
      // The empty-hash guard is the D§5 scrub's door: erasure sets
      // `passwordHash = ""` and mints a PREDICTABLE sentinel address
      // (`erased+<id>@erased.invalid`) that any classmate holding the id
      // can type. argon2.verify THROWS on an unparseable digest, so
      // without this the erased row would answer 500 instead of the
      // ordinary refusal. No live account can reach it: a real argon2
      // hash is never the empty string.
      const ok =
        user && user.passwordHash !== ""
          ? await argon2.verify(user.passwordHash, parsed.data.password)
          : false;
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
    const prefs = await resolvePrefs(app.db, req.user!.id);
    return { user: { ...toAuthUser(req.user!), notificationPrefs: prefs } };
  });

  app.patch("/api/auth/me", { preHandler: requireUser }, async (req, reply) => {
    const parsed = UpdateMeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const { name, notificationPrefs: prefsPatch } = parsed.data;
    const updated = await app.db.transaction(async (tx) => {
      let row = req.user!;
      if (name !== undefined) {
        [row] = await tx.update(users).set({ name }).where(eq(users.id, req.user!.id)).returning();
      }
      if (prefsPatch) {
        for (const [key, enabled] of Object.entries(prefsPatch)) {
          await tx
            .insert(notificationPrefs)
            .values({ userId: req.user!.id, key, enabled })
            .onConflictDoUpdate({
              target: [notificationPrefs.userId, notificationPrefs.key],
              set: { enabled },
            });
        }
      }
      return row;
    });
    const prefs = await resolvePrefs(app.db, req.user!.id);
    return { user: { ...toAuthUser(updated), notificationPrefs: prefs } };
  });

  app.post(
    "/api/auth/forgot",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = ForgotInputSchema.safeParse(req.body);
      if (!parsed.success) return { ok: true };
      const rows = await app.db.select().from(users).where(eq(users.email, parsed.data.email));
      const user = rows[0];
      // Unknown addresses mint no row below and so cannot be counted at all
      // — they never reach this block. Their only throttle is the 5/min
      // per-IP limit this route already carries (`config.rateLimit` above),
      // a DIFFERENT control from the per-address cap this block adds; both
      // stay.
      if (user && user.active) {
        const [{ count: recentResets }] = await app.db
          .select({ count: sql<number>`count(*)::int` })
          .from(emailTokens)
          .innerJoin(users, eq(emailTokens.userId, users.id))
          .where(
            and(
              eq(users.email, parsed.data.email),
              eq(emailTokens.type, "reset"),
              gt(emailTokens.createdAt, new Date(Date.now() - RESET_REQUEST_WINDOW_MS)),
            ),
          );
        if (recentResets < RESET_REQUEST_CAP) {
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
          // Accepted residual (D§10 fiat 13): this await is a real provider
          // round-trip that an unknown address's single indexed SELECT above
          // never pays — a measurable timing channel, NOT closed here. Not by
          // dropping the await (Cloud Run throttles CPU after the response,
          // so a fire-and-forget send would simply never run), and not by
          // padding to a fixed floor either (that taxes every user on a
          // rarely-used door). Accepted as-is at the 200-user cap.
          await app.mailer.send({ to: user.email, toUserId: user.id, template: "reset", ...mail });
        }
        // Over the cap: no token minted, no mail row — falls through to the
        // SAME 200 body as every other case (the anti-oracle posture).
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
        const claimed = await tx
          .update(emailTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(emailTokens.tokenHash, tokenHash),
              eq(emailTokens.type, "reset"),
              isNull(emailTokens.usedAt),
              gt(emailTokens.expiresAt, now),
            ),
          )
          .returning();
        const tok = claimed[0];
        if (!tok) return false;
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

  app.post(
    "/api/auth/change-password",
    { preHandler: requireUser, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
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
      const now = new Date();
      await app.db.transaction(async (tx) => {
        await tx.update(users).set({ passwordHash }).where(eq(users.id, req.user!.id));
        await tx
          .delete(sessions)
          .where(and(eq(sessions.userId, req.user!.id), ne(sessions.tokenHash, currentTokenHash)));
        // Any outstanding reset links for this user are now stale.
        await tx
          .update(emailTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(emailTokens.userId, req.user!.id),
              eq(emailTokens.type, "reset"),
              isNull(emailTokens.usedAt),
            ),
          );
        await logEvent(tx, "account.password_reset", req.user!.id, { via: "change-password" });
      });
      return { ok: true };
    },
  );
}

class CapReached extends Error {}
