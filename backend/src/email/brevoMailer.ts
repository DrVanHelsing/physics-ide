import { eq } from "drizzle-orm";
import { emails } from "../db/schema.js";
import type { Db } from "../db/types.js";
import type { Mailer, MailMessage } from "./mailer.js";

/**
 * The real postman. Everything on the wire below is copied from Brevo's own
 * live documentation, NOT from memory — a fake built from remembered strings
 * passes its own tests whatever the truth is, and the only step that would
 * discover the mismatch is the provisioning session at the end of the plan.
 *
 * Sources, retrieved 2026-08-29:
 *   - https://developers.brevo.com/docs/send-a-transactional-email
 *     POST https://api.brevo.com/v3/smtp/email
 *     Headers: `api-key`, `content-type: application/json`, `accept: application/json`
 *     Body:    { sender: { name?, email }, to: [{ email, name? }], subject,
 *                textContent | htmlContent | templateId }
 *     Success: { "messageId": "<201798300811.5787683@relay.domain.com>" }
 *   - https://developers.brevo.com/docs/transactional-webhooks
 *     Events:  request, delivered, hard_bounce, soft_bounce, blocked, spam,
 *              invalid_email, deferred, error, unsubscribed, opened,
 *              unique_opened, click, proxy_open, unique_proxy_open
 *     Payload: { "event": "...", "email": "...", "message-id": "...", "ts_event": ..., ... }
 *
 * THE ONE MISMATCH, and why `providerId` is normalised at write time:
 * the send response's `messageId` is ANGLE-BRACKETED
 * (`"<201798300811.5787683@relay.domain.com>"`) but the webhook's
 * correlation field is spelled `message-id` (hyphenated, not camelCase) and
 * its value is BARE (`"201798300811.5787683@relay.domain.com"`). Stored raw,
 * every webhook lookup would miss by exactly two characters and every
 * delivery event would silently fall through Task 4's 200-and-drop path. So
 * the brackets come off here, once, on the way in — the column holds the
 * form the webhook will present, and the webhook can match on equality.
 */

/** Brevo's transactional send endpoint. */
export const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

/** Node's `fetch` has no default timeout. Every one of the thirteen
 *  `app.mailer.send(...)` sites awaits inside a request handler, behind
 *  `--max-instances=1` — a provider that accepts the connection and then
 *  answers nothing would pin the single instance until the socket died of
 *  old age. One deadline, applied to the only outbound call there is. */
export const SEND_TIMEOUT_MS = 10_000;

/** The three statuses this driver writes (the dev driver's is "dev"). */
export const brevoStatus = {
  /** Written BEFORE the provider is called. */
  sending: "sending",
  sent: "sent",
  failed: "failed",
} as const;

const SEND_REFUSED = "Brevo refused the send";

/** DEPLOY.md box 1: the production mail driver must not persist raw token
 *  URLs. The confirm, reset and invite links are single-use credentials —
 *  a `body_text` holding a live one turns the admin console's email log,
 *  and every backup of it, into a set of working keys to other people's
 *  accounts. The message that goes ON THE WIRE keeps the real link; only
 *  the stored copy is redacted. `createDevMailer` is untouched — the
 *  pretend inbox stays clickable, which ~20 existing assertions rely on. */
export function redactTokens(text: string): string {
  return text.replace(/token=[A-Za-z0-9_-]+/g, "token=REDACTED");
}

/** The send response's id arrives angle-bracketed; the webhook's does not.
 *  Strip the brackets so the stored value is the one the webhook will
 *  present. Idempotent, so an unbracketed id passes through unchanged. */
function normaliseMessageId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().replace(/^<+/, "").replace(/>+$/, "").trim();
  return id.length > 0 ? id : null;
}

/**
 * ROW FIRST, THEN THE WIRE. The row is INSERTed with status `sending`, the
 * provider is called, and only then is the row UPDATEd with the outcome.
 * Writing it afterwards loses two ways: a `delivered` webhook arriving in
 * the same second finds no row and hits the 200-and-drop path, so the
 * status never updates; and a crash between the provider accepting the mail
 * and the insert leaves a real send with no record at all — which makes
 * "what was sent" a lie in exactly the direction that matters.
 *
 * `send()` REJECTS on failure and the row says `failed`. It is not this
 * driver's job to swallow: `neverThrow` sits outermost in app.ts's fixed
 * composition and is the single place a mail failure stops being the
 * request's problem.
 */
export function createBrevoMailer(
  db: Db,
  config: { mailFrom: string; brevoApiKey: string },
  fetchImpl: typeof fetch = fetch,
): Mailer {
  return {
    async send(msg: MailMessage) {
      const [row] = await db
        .insert(emails)
        .values({
          toEmail: msg.to,
          toUserId: msg.toUserId ?? null,
          template: msg.template,
          subject: msg.subject,
          bodyText: redactTokens(msg.text),
          status: brevoStatus.sending,
        })
        .returning({ id: emails.id });

      let providerId: string | null;
      try {
        const res = await fetchImpl(BREVO_SEND_URL, {
          method: "POST",
          headers: {
            "api-key": config.brevoApiKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender: { email: config.mailFrom },
            to: [{ email: msg.to }],
            subject: msg.subject,
            // The REAL text — the recipient needs a link that works.
            textContent: msg.text,
          }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`${SEND_REFUSED}: HTTP ${res.status}`);
        // A 2xx with an unreadable body is still an accepted send: the mail
        // is gone whatever the parser thinks, so the row says `sent` and
        // simply carries no correlation id.
        const parsed = await res.json().catch(() => null);
        providerId = normaliseMessageId((parsed as { messageId?: unknown } | null)?.messageId);
      } catch (err) {
        await db
          .update(emails)
          .set({ status: brevoStatus.failed })
          .where(eq(emails.id, row.id));
        throw err;
      }

      await db
        .update(emails)
        .set({ status: brevoStatus.sent, providerId })
        .where(eq(emails.id, row.id));
    },
  };
}
