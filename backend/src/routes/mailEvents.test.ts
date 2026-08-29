import { describe, test, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { emails } from "../db/schema.js";

const app = buildApp({ db: testDb });

async function mailEvent(secret: string | undefined, body: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/mail/events",
    headers: secret !== undefined ? { "x-mail-secret": secret } : {},
    payload: body,
  });
}

async function seedEmail(providerId: string | null, status = "sent") {
  const [row] = await testDb
    .insert(emails)
    .values({
      toEmail: "student@example.com",
      template: "due-tomorrow",
      subject: "Due tomorrow",
      bodyText: "Body",
      status,
      providerId,
    })
    .returning();
  return row;
}

async function statusOf(id: number) {
  const [row] = await testDb.select().from(emails).where(eq(emails.id, id));
  return row.status;
}

beforeAll(async () => {
  await truncateAuthTables();
});

afterEach(async () => {
  await truncateAuthTables();
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

const VALID_BODY = { event: "delivered", email: "student@example.com", "message-id": "some-id@relay.domain.com" };

/* Declared independently here, not imported from mailEvents.ts — the
 * admin.test.ts idiom for "refusal sentences asserted verbatim" (global
 * constraint). Importing the const would let the route and the test drift
 * together silently; re-declaring the literal means a wording change in
 * the route is a test failure, not a passing no-op. */
const FORBIDDEN = "Forbidden.";
const INVALID_EVENT = "Invalid event.";

describe("POST /api/mail/events — secret guard", () => {
  test("no header -> 403, no leak about why", async () => {
    const res = await mailEvent(undefined, VALID_BODY);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: FORBIDDEN });
  });

  test("wrong secret -> 403 with the exact same refusal as a missing header", async () => {
    const noHeader = await mailEvent(undefined, VALID_BODY);
    const wrong = await mailEvent("not-the-secret", VALID_BODY);
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toEqual(noHeader.json());
    expect(wrong.json()).toEqual({ error: FORBIDDEN });
  });

  // Fix round 1, IMPORTANT 1: proves the guard runs BEFORE the write, not
  // merely that it returns the right status code. A regression that moved
  // the secret check below the UPDATE would still 403 here and every other
  // test in this file would stay green — this is the one that would catch
  // it, mirroring the unknown-id "no write" test's instinct below.
  test("no header or wrong secret -> the matching row is never touched", async () => {
    const row = await seedEmail("some-id@relay.domain.com", "sent");
    await mailEvent(undefined, VALID_BODY);
    await mailEvent("not-the-secret", VALID_BODY);
    expect(await statusOf(row.id)).toBe("sent");
  });

  test("correct secret and a well-formed body -> 200 { ok: true }, not a 403", async () => {
    const res = await mailEvent(config.mailWebhookSecret, VALID_BODY);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe("POST /api/mail/events — body validation", () => {
  test("missing message-id -> 400", async () => {
    const res = await mailEvent(config.mailWebhookSecret, { event: "delivered", email: "a@b.com" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: INVALID_EVENT });
  });

  test("an event outside Brevo's vocabulary -> 400", async () => {
    const res = await mailEvent(config.mailWebhookSecret, {
      event: "not_a_real_event",
      email: "a@b.com",
      "message-id": "x@relay.domain.com",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: INVALID_EVENT });
  });
});

describe("POST /api/mail/events — delivered and bounced", () => {
  test("a delivered event moves the row to delivered", async () => {
    const row = await seedEmail("deliver-me@relay.domain.com");
    const res = await mailEvent(config.mailWebhookSecret, {
      event: "delivered",
      email: "student@example.com",
      "message-id": "deliver-me@relay.domain.com",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(await statusOf(row.id)).toBe("delivered");
  });

  // Fix round 1, IMPORTANT 2: the schema is deliberately non-strict — Brevo's
  // real payload (brevoMailer.ts:23) carries `ts_event`, `tag`, `sending_ip`
  // and more alongside the three fields this route reads. This test IS the
  // record of that decision: a later "tighten this up" edit to `.strict()`
  // would 400 every real webhook (Brevo retries, then gives up, statuses
  // silently freeze), and this is the test that would catch it.
  test("a full-shaped Brevo payload (extra fields alongside the three read) still updates the row", async () => {
    const row = await seedEmail("full-shape@relay.domain.com");
    const res = await mailEvent(config.mailWebhookSecret, {
      event: "delivered",
      email: "student@example.com",
      "message-id": "full-shape@relay.domain.com",
      ts_event: 1735689600,
      tag: "due-tomorrow",
      sending_ip: "1.2.3.4",
      subject: "Due tomorrow",
      "X-Mailin-custom": "custom-tracking-id",
    });
    expect(res.statusCode).toBe(200);
    expect(await statusOf(row.id)).toBe("delivered");
  });

  test.each(["hard_bounce", "soft_bounce", "blocked"])("a %s event moves the row to bounced", async (event) => {
    const row = await seedEmail(`bounce-${event}@relay.domain.com`);
    const res = await mailEvent(config.mailWebhookSecret, {
      event,
      email: "student@example.com",
      "message-id": `bounce-${event}@relay.domain.com`,
    });
    expect(res.statusCode).toBe(200);
    expect(await statusOf(row.id)).toBe("bounced");
  });

  test("an event this app doesn't track (opened) 200s and leaves the row untouched", async () => {
    const row = await seedEmail("opened-me@relay.domain.com", "sent");
    const res = await mailEvent(config.mailWebhookSecret, {
      event: "opened",
      email: "student@example.com",
      "message-id": "opened-me@relay.domain.com",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(await statusOf(row.id)).toBe("sent");
  });
});

/* THE TRAP (see brevoMailer.ts's docblock): the send response's id arrives
 * angle-bracketed, the webhook's does not. Task 3 stores it stripped, and
 * the webhook normalises the inbound id with the SAME function
 * (normaliseMessageId, exported from brevoMailer.ts for this) before
 * looking it up — so even if some event type ever presented the bracketed
 * form, the lookup would still land on the bare, stored spelling. */
describe("POST /api/mail/events — inbound id normalisation", () => {
  test("a bracketed inbound message-id still matches the bare, stored providerId", async () => {
    const row = await seedEmail("bracket-me@relay.domain.com");
    const res = await mailEvent(config.mailWebhookSecret, {
      event: "delivered",
      email: "student@example.com",
      "message-id": "<bracket-me@relay.domain.com>",
    });
    expect(res.statusCode).toBe(200);
    expect(await statusOf(row.id)).toBe("delivered");
  });
});

/* Webhooks retry; a 404 for a message-id this app never wrote (or already
 * pruned by retention) would just make the provider hammer this endpoint
 * forever. 200-and-drop is correct, and "no write" is the whole point of
 * the test — nothing in the table is touched by an id nothing matches. */
describe("POST /api/mail/events — unknown message-id", () => {
  test("200 { ok: true } and no write for a message-id nothing in the table holds", async () => {
    const row = await seedEmail("some-other-id@relay.domain.com", "sent");
    // Fix round 1, MINOR 7: dev-inbox rows (providerId NULL) are the most
    // numerous in this table. Correct by SQL semantics (NULL = anything is
    // never true) and unreachable anyway once messageId !== null above, but
    // nothing pinned it — this row proves a dev row can't be swept.
    const devRow = await seedEmail(null, "dev");
    const res = await mailEvent(config.mailWebhookSecret, {
      event: "delivered",
      email: "nobody@example.com",
      "message-id": "totally-unknown-id@relay.domain.com",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    // The unrelated row already in the table proves the write genuinely
    // didn't happen anywhere, not merely that no error was thrown.
    expect(await statusOf(row.id)).toBe("sent");
    expect(await statusOf(devRow.id)).toBe("dev");
  });
});

/* app.ts:41-44's own note: a route registered directly on the root instance
 * has a SILENTLY INERT `config.rateLimit` — the rate-limit plugin hasn't
 * booted yet when that route registers. Proving the 429 actually fires is
 * the only way to know mailEventsRoutes was registered as a plugin scope,
 * not directly on root the way the bare health-check route is. */
describe("POST /api/mail/events — rate limit (its own gate; Task 7 throttles everything else)", () => {
  test("allows 120 requests per minute then returns 429", async () => {
    // Fresh instance: the limiter's in-memory store is per-app, so this
    // can't interfere with the other tests' request counts (the
    // auth.signup.test.ts idiom).
    const rlApp = buildApp({ db: testDb });
    try {
      // Wrong secret: cheap (no DB write, no zod success path) and the
      // limiter counts in its onRequest hook, before the handler — and
      // therefore before either the secret guard or validation — runs.
      for (let i = 0; i < 120; i++) {
        const res = await rlApp.inject({ method: "POST", url: "/api/mail/events", payload: {} });
        expect(res.statusCode).toBe(403);
      }
      const res121 = await rlApp.inject({ method: "POST", url: "/api/mail/events", payload: {} });
      expect(res121.statusCode).toBe(429);
    } finally {
      await rlApp.close();
    }
  });
});
