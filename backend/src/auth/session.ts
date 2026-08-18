import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/types.js";
import { sessions, users } from "../db/schema.js";
import { newToken, hashToken } from "./tokens.js";

export const SESSION_COOKIE = "pide_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(
  db: Db,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hash, userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserBySessionToken(
  db: Db,
  token: string,
): Promise<typeof users.$inferSelect | null> {
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  const row = rows[0];
  if (!row || !row.user.active) return null;
  return row.user;
}

export async function destroySessionByToken(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function destroyAllUserSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
