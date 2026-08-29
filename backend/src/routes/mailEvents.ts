import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { emails } from "../db/schema.js";
import { config } from "../config.js";
import { normaliseMessageId, brevoStatus } from "../email/brevoMailer.js";

const MAIL_SECRET_HEADER = "x-mail-secret";

/* Same posture, same shape as tick.ts's TICK_SECRET idiom: a wrong secret
 * and a missing one must look identical to the caller (global constraint —
 * no leak about *why* the door didn't open), so the guard below is a plain
 * `!==` against a non-optional config value with no undefined case, and
 * both failure paths return this exact sentence. */
const FORBIDDEN = "Forbidden.";
const INVALID_EVENT = "Invalid event.";

/** Brevo's transactional-webhook event vocabulary, copied from
 *  developers.brevo.com/docs/transactional-webhooks (see brevoMailer.ts's
 *  docblock for the full citation, retrieved 2026-08-29) — not remembered,
 *  fetched. Only "delivered" and the three bounce/blocked outcomes move
 *  this app's own status; the rest (opens, clicks, unsubscribes, the
 *  provider's own "request"/"deferred"/"error" lifecycle events, spam
 *  complaints) are legitimate webhook traffic this app never asked to act
 *  on, so they 200 and do nothing. */
const BREVO_EVENTS = [
  "request",
  "delivered",
  "hard_bounce",
  "soft_bounce",
  "blocked",
  "spam",
  "invalid_email",
  "deferred",
  "error",
  "unsubscribed",
  "opened",
  "unique_opened",
  "click",
  "proxy_open",
  "unique_proxy_open",
] as const;

const BOUNCE_EVENTS = new Set<string>(["hard_bounce", "soft_bounce", "blocked"]);

/* The provider's own field name is hyphenated ("message-id"), not the
 * camelCase "messageId" the SEND response uses — bracket notation is
 * required since `message-id` is not a valid identifier. */
const MailEventSchema = z.object({
  event: z.enum(BREVO_EVENTS),
  email: z.string(),
  "message-id": z.string(),
});

/** null = an event this app doesn't track (200s with no write). Resolves
 *  through brevoMailer.ts's shared `brevoStatus` vocabulary rather than a
 *  free-floating literal here, so the two files can't drift (M6). */
function statusFor(event: (typeof BREVO_EVENTS)[number]): string | null {
  if (event === "delivered") return brevoStatus.delivered;
  if (BOUNCE_EVENTS.has(event)) return brevoStatus.bounced;
  return null;
}

export function mailEventsRoutes(app: FastifyInstance): void {
  app.post(
    "/api/mail/events",
    // The only public door Plan 9 opens — Task 7 throttles everything else.
    // This must live inside a plugin scope (this function, registered via
    // `app.register` in app.ts AFTER the rate-limit plugin) or the config
    // below is silently inert (app.ts:54-57's own note).
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (req, reply) => {
      // Guard first, and the exact same reply either way.
      if (req.headers[MAIL_SECRET_HEADER] !== config.mailWebhookSecret) {
        return reply.code(403).send({ error: FORBIDDEN });
      }

      const parsed = MailEventSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: INVALID_EVENT });
      }

      const status = statusFor(parsed.data.event);
      if (status === null) {
        return { ok: true };
      }

      // Normalised the same way Task 3 normalises it at write time (see
      // brevoMailer.ts), so the lookup below is a canonical-to-canonical
      // match rather than a stored spelling matched against an assumed
      // inbound one. The webhook already presents the id bare, so this is
      // a no-op today — but it means a bracketed id would still match.
      const messageId = normaliseMessageId(parsed.data["message-id"]);
      if (messageId === null) {
        return { ok: true };
      }

      // An UPDATE ... WHERE that matches zero rows IS "no write" — no
      // separate SELECT-then-branch is needed. Webhooks retry on a non-2xx;
      // an unknown message-id (a row this app never wrote, or one already
      // pruned by retention) must not 404, or the provider hammers this
      // endpoint forever for a lookup that will never succeed.
      await app.db.update(emails).set({ status }).where(eq(emails.providerId, messageId));

      return { ok: true };
    },
  );
}
