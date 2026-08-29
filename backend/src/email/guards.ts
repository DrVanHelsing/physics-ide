import type { Db } from "../db/types.js";
import { createDevMailer, type Mailer, type MailMessage } from "./mailer.js";
import { createBrevoMailer } from "./brevoMailer.js";

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

/** config.ts's superRefine already refuses to parse a `brevo` environment
 *  without both of these, so reaching this is a programming error rather
 *  than a misconfiguration — but the driver takes them as required strings,
 *  and a boot that silently posted `undefined` as its api-key would fail
 *  once per send instead of once, loudly, at startup. */
export const BREVO_CONFIG_INCOMPLETE =
  "MAIL_DRIVER=brevo requires MAIL_FROM and BREVO_API_KEY.";

/** Picks the Mailer implementation named by config.mailDriver. `dev` is the
 *  pretend inbox (byte-identical to before this task: full bodies,
 *  clickable tokens, status `dev`); `brevo` is the real postman, which
 *  writes its own rows with redacted bodies and honest statuses. */
export function selectMailDriver(
  config: { mailDriver: "dev" | "brevo"; mailFrom?: string; brevoApiKey?: string },
  db: Db,
): Mailer {
  if (config.mailDriver === "brevo") {
    if (!config.mailFrom || !config.brevoApiKey) throw new Error(BREVO_CONFIG_INCOMPLETE);
    return createBrevoMailer(db, { mailFrom: config.mailFrom, brevoApiKey: config.brevoApiKey });
  }
  return createDevMailer(db);
}
