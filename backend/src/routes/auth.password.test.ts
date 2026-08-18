import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq, and } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, emails, sessions, emailTokens, events } from "../db/schema.js";
import { newToken } from "../auth/tokens.js";
import { RESET_TTL_MS } from "./auth.js";

const app = buildApp({ db: testDb });

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await testDb.insert(users).values({
    name: "Reset Person",
    email: "reset@example.com",
    passwordHash: await argon2.hash("old-password-1", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

async function signin(password: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email: "reset@example.com", password },
  });
}

describe("forgot / reset", () => {
  test("forgot always answers ok, and mails a reset link when the account exists", async () => {
    const unknown = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "ghost@example.com" },
    });
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json()).toEqual({ ok: true });
    const ghostMail = await testDb.select().from(emails).where(eq(emails.toEmail, "ghost@example.com"));
    expect(ghostMail).toHaveLength(0);

    const known = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "reset@example.com" },
    });
    expect(known.statusCode).toBe(200);
    const mails = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "reset@example.com"), eq(emails.template, "reset")));
    expect(mails).toHaveLength(1);
    expect(mails[0].bodyText).toContain("/auth/reset?token=");
  });

  test("reset changes the password, is single-use, and kills every session", async () => {
    const live = await signin("old-password-1");
    expect(live.statusCode).toBe(200);

    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "reset@example.com"), eq(emails.template, "reset")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token, password: "new-password-1" },
    });
    expect(res.statusCode).toBe(200);

    const [u] = await testDb.select().from(users).where(eq(users.email, "reset@example.com"));
    const liveSessions = await testDb.select().from(sessions).where(eq(sessions.userId, u.id));
    expect(liveSessions).toHaveLength(0);

    expect((await signin("old-password-1")).statusCode).toBe(401);
    expect((await signin("new-password-1")).statusCode).toBe(200);

    const again = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token, password: "sneaky-password" },
    });
    expect(again.statusCode).toBe(400);
  });
});

describe("reset hardening", () => {
  const hApp = buildApp({ db: testDb });

  afterAll(async () => {
    await hApp.close();
  });

  test("retiring a reset token retires every other outstanding one for that user", async () => {
    await testDb.insert(users).values({
      name: "Hardening Person",
      email: "hardening@example.com",
      passwordHash: await argon2.hash("hardening-pw-1", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });

    await hApp.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "hardening@example.com" },
    });
    await hApp.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "hardening@example.com" },
    });

    const mails = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "hardening@example.com"), eq(emails.template, "reset")))
      .orderBy(emails.id);
    expect(mails).toHaveLength(2);
    const token1 = /token=([A-Za-z0-9_-]+)/.exec(mails[0].bodyText)![1];
    const token2 = /token=([A-Za-z0-9_-]+)/.exec(mails[1].bodyText)![1];

    const second = await hApp.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token: token2, password: "hardened-pw-2" },
    });
    expect(second.statusCode).toBe(200);

    const first = await hApp.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token: token1, password: "sneaky-pw-3" },
    });
    expect(first.statusCode).toBe(400);
    expect(first.json().error).toBe("That link is invalid or has expired.");

    const auditRows = await testDb
      .select()
      .from(events)
      .where(eq(events.type, "account.password_reset"));
    expect(auditRows.length).toBeGreaterThan(0);
  });

  test("forgot skips inactive users without mailing them", async () => {
    await testDb.insert(users).values({
      name: "Inactive Person",
      email: "inactive@example.com",
      passwordHash: await argon2.hash("inactive-pw-1", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
      active: false,
    });

    const res = await hApp.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "inactive@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const mails = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toEmail, "inactive@example.com"));
    expect(mails).toHaveLength(0);
  });

  test("an expired token is rejected with the uniform message", async () => {
    const [u] = await testDb.select().from(users).where(eq(users.email, "hardening@example.com"));
    const expired = newToken();
    await testDb.insert(emailTokens).values({
      userId: u.id,
      type: "reset",
      tokenHash: expired.hash,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await hApp.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token: expired.token, password: "another-pw-4" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That link is invalid or has expired.");
  });

  test("RESET_TTL_MS is 60 minutes", () => {
    expect(RESET_TTL_MS).toBe(60 * 60 * 1000);
  });
});

describe("change password (signed in)", () => {
  test("requires the current password and keeps only the current session", async () => {
    const s1 = await signin("new-password-1");
    const s2 = await signin("new-password-1");
    const token1 = s1.cookies.find((c) => c.name === "pide_session")!.value;
    const token2 = s2.cookies.find((c) => c.name === "pide_session")!.value;

    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { pide_session: token1 },
      payload: { currentPassword: "wrong-guess", newPassword: "brand-new-pw-1" },
    });
    expect(bad.statusCode).toBe(400);

    const good = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { pide_session: token1 },
      payload: { currentPassword: "new-password-1", newPassword: "brand-new-pw-1" },
    });
    expect(good.statusCode).toBe(200);

    const me1 = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token1 },
    });
    expect(me1.statusCode).toBe(200);
    const me2 = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token2 },
    });
    expect(me2.statusCode).toBe(401);
  });
});
