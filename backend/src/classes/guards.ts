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

/** Teacher or TA — the two staff hats (spec §2.1). Was three private copies
 *  (assignments.ts, groups.ts, guides.ts). */
export function isStaffRole(role: string): boolean {
  return role === "teacher" || role === "ta";
}

const STAFF_ONLY = "Teachers and assistants only.";

/** Active teacher-or-TA membership in THIS class — requireClassTeacher's
 *  exact shape, one rung looser. One predicate, one sentence, where eight
 *  hand-inlined copies used to live in assignments.ts. */
export async function requireClassStaff(
  db: Db,
  classId: string,
  userId: string,
): Promise<typeof classMembers.$inferSelect> {
  const m = await getMembership(db, classId, userId);
  if (!m || m.status !== "active" || !isStaffRole(m.role)) {
    throw new ClassAuthError(403, STAFF_ONLY);
  }
  return m;
}
