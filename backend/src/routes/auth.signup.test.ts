import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, emails, emailTokens, events } from "../db/schema.js";
import { hashToken } from "../auth/tokens.js";
import { ACCOUNT_CAP_MESSAGE } from "@physics-ide/shared";

const app = buildApp({ db: testDb });

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

function signupBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Learner One",
    email: "learner1@example.com",
    password: "a-long-password",
    wantsTeacher: false,
    consent: true,
    ...overrides,
  };
}

describe("POST /api/auth/signup", () => {
  test("creates a user, a confirm token, a confirm email, and a signup event", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/signup", payload: signupBody() });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });

    const [u] = await testDb.select().from(users).where(eq(users.email, "learner1@example.com"));
    expect(u).toBeDefined();
    expect(u.role).toBe("user");
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
    expect(u.emailConfirmedAt).toBeNull();

    const toks = await testDb.select().from(emailTokens).where(eq(emailTokens.userId, u.id));
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("confirm");

    const mails = await testDb.select().from(emails).where(eq(emails.toEmail, u.email));
    expect(mails).toHaveLength(1);
    expect(mails[0].template).toBe("confirm");
    expect(mails[0].bodyText).toContain("/auth/confirm?token=");

    const evts = await testDb.select().from(events).where(eq(events.type, "account.signup"));
    expect(evts.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects a duplicate email with 409", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/signup", payload: signupBody() });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("An account with this email already exists.");
  });

  test("rejects invalid input with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: signupBody({ password: "short", email: "x@y.co" }),
    });
    expect(res.statusCode).toBe(400);
    expect(typeof res.json().error).toBe("string");
  });

  test("a teacher signup also alerts every admin (spec §3.1)", async () => {
    await testDb.insert(users).values({
      name: "Site Admin",
      email: "admin@example.com",
      passwordHash: "x",
      role: "admin",
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: signupBody({ email: "teacher1@example.com", wantsTeacher: true }),
    });
    expect(res.statusCode).toBe(201);
    const alerts = await testDb.select().from(emails).where(eq(emails.template, "teacher-alert"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].toEmail).toBe("admin@example.com");
    expect(alerts[0].bodyText).toContain("teacher1@example.com");
  });

  test("signup number cap+1 is refused with the spec's exact sentence", async () => {
    const [{ n }] = (await testPool.query('SELECT count(*)::int AS n FROM "users"')).rows as [
      { n: number },
    ];
    await setSetting(testDb, "account_cap", n);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: signupBody({ email: "overflow@example.com" }),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe(ACCOUNT_CAP_MESSAGE);
    await setSetting(testDb, "account_cap", 200);
  });
});

describe("POST /api/auth/confirm", () => {
  test("a valid token confirms the account and is single-use", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: signupBody({ email: "confirmme@example.com" }),
    });
    const [u] = await testDb.select().from(users).where(eq(users.email, "confirmme@example.com"));
    const [mail] = await testDb.select().from(emails).where(eq(emails.toEmail, u.email));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const res1 = await app.inject({ method: "POST", url: "/api/auth/confirm", payload: { token } });
    expect(res1.statusCode).toBe(200);
    const [after] = await testDb.select().from(users).where(eq(users.id, u.id));
    expect(after.emailConfirmedAt).not.toBeNull();

    const res2 = await app.inject({ method: "POST", url: "/api/auth/confirm", payload: { token } });
    expect(res2.statusCode).toBe(400);
  });

  test("an unknown token is refused", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/confirm",
      payload: { token: hashToken("nonsense").slice(0, 43) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That link is invalid or has expired.");
  });
});
