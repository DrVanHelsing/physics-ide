import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users } from "../db/schema.js";

const app = buildApp({ db: testDb });

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await testDb.insert(users).values({
    name: "Session Person",
    email: "sess@example.com",
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  await testDb.insert(users).values({
    name: "Frozen",
    email: "frozen@example.com",
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    active: false,
    consentAt: new Date(),
  });
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

function cookieOf(res: { cookies: Array<{ name: string; value: string }> }): string | undefined {
  return res.cookies.find((c) => c.name === "pide_session")?.value;
}

describe("signin / me / signout", () => {
  test("wrong password → generic 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "sess@example.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid email or password.");
  });

  test("unknown email → the same generic 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "nobody@example.com", password: "whatever-pw" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid email or password.");
  });

  test("deactivated account → 403 with the honest message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "frozen@example.com", password: "a-long-password" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("This account has been deactivated.");
  });

  test("good credentials set an httpOnly cookie and /me works; signout kills it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "sess@example.com", password: "a-long-password" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: "sess@example.com", emailConfirmed: true });
    const raw = res.headers["set-cookie"];
    expect(String(raw)).toContain("HttpOnly");
    const token = cookieOf(res);
    expect(token).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token! },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.name).toBe("Session Person");

    const rename = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { pide_session: token! },
      payload: { name: "Renamed Person" },
    });
    expect(rename.statusCode).toBe(200);
    expect(rename.json().user.name).toBe("Renamed Person");

    const out = await app.inject({
      method: "POST",
      url: "/api/auth/signout",
      cookies: { pide_session: token! },
    });
    expect(out.statusCode).toBe(200);

    const meAfter = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token! },
    });
    expect(meAfter.statusCode).toBe(401);
  });

  test("/me without a cookie → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Not signed in.");
  });
});
