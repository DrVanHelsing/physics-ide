import { notifications } from "../db/schema.js";
import type { DbLike } from "../db/events.js";

/** Fan-out AT WRITE TIME, in the same transaction as the event (design D§2):
 *  the ledger records who acted and never who should be told — three
 *  bell-relevant event types store no recoverable audience at all, so the
 *  route that holds the recipient ids writes the delivery rows itself.
 *  `payload` is the RENDERER'S input, built at the call site — it need not
 *  equal the event payload (e.g. class.joined adds joinerId). Ids only,
 *  plus content titles; never a person's name (resolved at read, §11). */
export async function notify(
  db: DbLike,
  userIds: string[],
  eventId: number,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (userIds.length === 0) return;
  await db.insert(notifications).values(
    userIds.map((userId) => ({ userId, eventId, type, payload })),
  );
}
