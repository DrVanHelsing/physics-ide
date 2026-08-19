import { and, eq } from "drizzle-orm";
import type { Db } from "../db/types.js";
import { classMembers } from "../db/schema.js";

export class ClassAuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Route helper: replies and returns true when err is a ClassAuthError. */
export async function sendClassAuthError(
  reply: { code: (s: number) => { send: (b: object) => unknown } },
  err: unknown,
): Promise<boolean> {
  if (err instanceof ClassAuthError) {
    await reply.code(err.status).send({ error: err.message });
    return true;
  }
  return false;
}

export async function getMembership(
  db: Db,
  classId: string,
  userId: string,
): Promise<typeof classMembers.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(classMembers)
    .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, userId)));
  return rows[0];
}

/** Active teacher membership in THIS class — the isTeacher account flag is not enough. */
export async function requireClassTeacher(
  db: Db,
  classId: string,
  userId: string,
): Promise<typeof classMembers.$inferSelect> {
  const m = await getMembership(db, classId, userId);
  if (!m || m.status !== "active" || m.role !== "teacher") {
    throw new ClassAuthError(403, "Teachers only for this class.");
  }
  return m;
}
