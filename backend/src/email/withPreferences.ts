import { and, eq } from "drizzle-orm";
import { SWITCHABLE_EMAIL_KEYS } from "@physics-ide/shared";
import { notificationPrefs } from "../db/schema.js";
import type { Db } from "../db/types.js";
import type { Mailer } from "./mailer.js";

const SWITCHABLE = new Set<string>(SWITCHABLE_EMAIL_KEYS);

/** The §9 switches, enforced at the ONE seam every send passes through
 *  (design D§4): thirteen call sites gain the gate with zero route edits,
 *  and tick.ts's due-tomorrow — the one send the spec itself marks
 *  switchable — becomes gated without touching tick.ts. Fails OPEN for
 *  essential mail: no toUserId (the two invite sends — the recipient may
 *  have no account) or a non-switchable template sends unconditionally.
 *  An absent pref row means the default, ON. */
export function withPreferences(db: Db, inner: Mailer): Mailer {
  return {
    async send(msg) {
      if (msg.toUserId == null || !SWITCHABLE.has(msg.template)) return inner.send(msg);
      const rows = await db
        .select({ enabled: notificationPrefs.enabled })
        .from(notificationPrefs)
        .where(and(eq(notificationPrefs.userId, msg.toUserId), eq(notificationPrefs.key, msg.template)));
      if (rows[0]?.enabled === false) return; // switched off — the email never leaves
      return inner.send(msg);
    },
  };
}
