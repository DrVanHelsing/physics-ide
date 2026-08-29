import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import argon2 from "argon2";
import { testDb, testPool, truncateAuthTables } from "./db/testClient.js";
import { setSetting } from "./db/settings.js";
import { users } from "./db/schema.js";

/**
 * DEPLOY.md boxes 2 and 4 (trustProxy reaching Fastify, and the session
 * cookie carrying Secure) both need a Fastify instance built under a
 * PRODUCTION-shaped env — but config.ts runs `EnvSchema.parse(process.env)`
 * once at module load and freezes the result into a `const` (config.ts:78),
 * and app.ts/auth.ts both read that frozen `config` at their own module
 * load. A test that does `process.env.NODE_ENV = "production"` and then
 * calls a statically-imported `buildApp` would still see whatever config
 * the module cache first evaluated (nodeEnv === "test" in this suite) — the
 * assertions below would fail in a way that tempts "fixing" the route
 * instead of the test.
 *
 * Mechanism chosen (option (a) from the Task 6 brief, the SAME pattern Task
 * 2's config.test.ts already established): `vi.resetModules()` +
 * `vi.stubEnv(...)` + a dynamic `await import("./app.js")` per case, so each
 * case gets a genuinely fresh module graph built from its own env. Every
 * production-required var (TICK_SECRET, MAIL_WEBHOOK_SECRET,
 * MAIL_DRIVER=brevo plus its MAIL_FROM/BREVO_API_KEY companions) has to be
 * stubbed too, or EnvSchema.parse throws before buildApp is ever reached.
 */

const PRODUCTION_ENV = {
  NODE_ENV: "production",
  TICK_SECRET: "a-real-tick-secret",
  MAIL_DRIVER: "brevo",
  MAIL_FROM: "no-reply@example.com",
  BREVO_API_KEY: "a-real-brevo-key",
  MAIL_WEBHOOK_SECRET: "a-real-webhook-secret",
} as const;

function stubAll(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterAll(async () => {
  await testPool.end();
});

describe("trustProxy reaches Fastify (DEPLOY.md box 2)", () => {
  // Task 2 already wires `trustProxy: config.trustProxy` into the Fastify
  // factory in app.ts — this is the verification that wiring actually
  // reaches Fastify, not a second wiring of it. `request.ip` is the
  // observable surface: Fastify only honours X-Forwarded-For over the raw
  // socket address when trustProxy is truthy (fastify/lib/request.js).
  test("TRUST_PROXY=true makes Fastify trust X-Forwarded-For for request.ip", async () => {
    stubAll({ TRUST_PROXY: "true" });
    const { buildApp } = await import("./app.js");
    const app = buildApp({ db: testDb });
    // Test-only route added to the real buildApp() instance — proves the
    // wiring on THIS instance, not a hand-rolled Fastify() that would only
    // prove Fastify's own trustProxy behaviour in isolation.
    app.get("/__test-only/ip", async (req) => ({ ip: req.ip }));
    try {
      const res = await app.inject({
        method: "GET",
        url: "/__test-only/ip",
        headers: { "x-forwarded-for": "9.9.9.9" },
        remoteAddress: "5.5.5.5",
      });
      expect(res.json().ip).toBe("9.9.9.9");
    } finally {
      await app.close();
    }
  });

  test("the TRUST_PROXY default (unset -> false) uses the raw socket address, not X-Forwarded-For", async () => {
    const { buildApp } = await import("./app.js");
    const app = buildApp({ db: testDb });
    app.get("/__test-only/ip", async (req) => ({ ip: req.ip }));
    try {
      const res = await app.inject({
        method: "GET",
        url: "/__test-only/ip",
        headers: { "x-forwarded-for": "9.9.9.9" },
        remoteAddress: "5.5.5.5",
      });
      expect(res.json().ip).toBe("5.5.5.5");
    } finally {
      await app.close();
    }
  });
});

describe("Secure session cookie (DEPLOY.md box 4)", () => {
  beforeAll(async () => {
    await truncateAuthTables();
    await setSetting(testDb, "account_cap", 200);
    await testDb.insert(users).values({
      name: "Cookie Person",
      email: "cookieperson@example.com",
      passwordHash: await argon2.hash("cookie-person-pw-1", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });
  });

  async function signinSetCookieHeader(): Promise<string> {
    const { buildApp } = await import("./app.js");
    const app = buildApp({ db: testDb });
    try {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/signin",
        payload: { email: "cookieperson@example.com", password: "cookie-person-pw-1" },
      });
      expect(res.statusCode).toBe(200);
      return String(res.headers["set-cookie"]);
    } finally {
      await app.close();
    }
  }

  test("NODE_ENV=production sets Secure on the session cookie", async () => {
    stubAll(PRODUCTION_ENV);
    const setCookie = await signinSetCookieHeader();
    expect(setCookie).toContain("Secure");
  });

  test("outside production (this suite's own NODE_ENV=test) the cookie carries no Secure", async () => {
    const setCookie = await signinSetCookieHeader();
    expect(setCookie).not.toContain("Secure");
  });
});
