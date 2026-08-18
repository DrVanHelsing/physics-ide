import type { Db } from "./types.js";
import { events } from "./schema.js";

/** Accepts the Db or a transaction — both expose the same .insert() surface. */
type DbLike = Pick<Db, "insert">;

export async function logEvent(
  db: DbLike,
  type: string,
  actorId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(events).values({ type, actorId, payload });
}
