import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { eq, sql, and, isNull, gt } from "drizzle-orm";
import {
  SignupInputSchema,
  ConfirmInputSchema,
  ACCOUNT_CAP_MESSAGE,
  type AuthUser,
} from "@physics-ide/shared";
import { users, emailTokens, settings } from "../db/schema.js";
import { logEvent } from "../db/events.js";
import { newToken, hashToken } from "../auth/tokens.js";
import { confirmEmail, teacherSignupAlert } from "../email/templates.js";
import { config } from "../config.js";

export const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

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
}

class CapReached extends Error {}

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause. */
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}
