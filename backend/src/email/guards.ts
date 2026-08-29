import type { Db } from "../db/types.js";
import { createDevMailer, type Mailer, type MailMessage } from "./mailer.js";

/** Retention's erased-user rewrite (D§3) points a departed user's stored
 *  `to` at this sentinel domain so any address a stale send still carries —
 *  a due-tomorrow reminder queued before the erasure, say — never reaches a
 *  real inbox. Dropped silently, before the driver: the address was
 *  deliberately destroyed, so there is nothing to log and nothing to retry. */
const ERASED_SUFFIX = "@erased.invalid";

/** Sits directly on the driver (innermost in the fixed order below): drops
 *  any message whose `to` ends `@erased.invalid` without calling `inner`
 *  and without writing anything anywhere. */
export function suppressErased(inner: Mailer): Mailer {
  return {
    async send(msg: MailMessage) {
      if (msg.to.toLowerCase().endsWith(ERASED_SUFFIX)) return;
      return inner.send(msg);
    },
  };
}

/** The subset of Fastify's logger this file needs — a fake in tests doesn't
 *  have to grow the rest of FastifyBaseLogger to stand in for it. */
export interface MinimalLogger {
  error(obj: unknown, msg?: string): void;
}

/** MUST be the OUTERMOST wrapper: `neverThrow(log, withPreferences(db,
 *  suppressErased(driver)))`. No `app.mailer.send(...)` call site wraps its
 *  await in a try/catch (there are thirteen of them across the route
 *  files), so any rejection this doesn't sit outside of propagates straight
 *  into a request handler and 500s a route whose real work — the invite
 *  row, the membership change, whatever the send was a side effect of —
 *  already committed. That includes withPreferences' own notification_prefs
 *  SELECT (withPreferences.ts:20-23): a DB hiccup on that read is just as
 *  capable of taking down a handler as a driver failure is, so neverThrow
 *  has to wrap withPreferences too, not just the driver. */
export function neverThrow(log: MinimalLogger, inner: Mailer): Mailer {
  return {
    async send(msg: MailMessage) {
      try {
        await inner.send(msg);
      } catch (err) {
        log.error({ err, template: msg.template }, "mailer send failed");
      }
    },
  };
}

/** Replaced in Task 3 once the real Brevo driver exists. */
export const BREVO_DRIVER_NOT_IMPLEMENTED = "MAIL_DRIVER=brevo has no driver yet — Task 3 adds it.";

/** Picks the Mailer implementation named by config.mailDriver. `dev` is the
 *  pretend inbox (byte-identical to today); `brevo` throws until Task 3
 *  lands the real driver, so a production boot that reaches this branch
 *  fails loudly instead of quietly writing live mail into the dev table. */
export function selectMailDriver(config: { mailDriver: "dev" | "brevo" }, db: Db): Mailer {
  if (config.mailDriver === "brevo") throw new Error(BREVO_DRIVER_NOT_IMPLEMENTED);
  return createDevMailer(db);
}
