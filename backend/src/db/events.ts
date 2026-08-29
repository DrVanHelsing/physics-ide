import type { Db } from "./types.js";
import { events } from "./schema.js";

/** Accepts the Db or a transaction — both expose the same .insert() surface. */
type DbLike = Pick<Db, "insert">;

/** Returns the event id so notify() (Plan 8) can reference the ledger row it fans out for. */
export async function logEvent(
  db: DbLike,
  type: string,
  actorId: string | null,
  payload: Record<string, unknown> = {},
): Promise<number> {
  const [row] = await db.insert(events).values({ type, actorId, payload }).returning({ id: events.id });
  return row.id;
}
