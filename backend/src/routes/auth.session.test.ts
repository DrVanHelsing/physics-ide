import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq, and } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, sessions, notificationPrefs } from "../db/schema.js";
import { newToken } from "../auth/tokens.js";

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
    expect(String(raw)).toContain("SameSite=Lax");
    expect(String(raw)).toContain("Path=/");
    expect(String(raw)).toContain("Max-Age=2592000");
    expect(String(raw)).not.toContain("Secure");
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

describe("argon2 parameter migration (DEPLOY.md box 3)", () => {
  test("a user hashed under the library's un-pinned defaults still signs in after ARGON2_PARAMS pins explicit costs", async () => {
    // argon2.verify() takes no memoryCost/timeCost/parallelism — VerifyOptions
    // is just `{ secret }` — because argon2 digests are self-describing: the
    // parameters that produced a hash travel inside the stored string. This
    // pins that regression directly: a hash minted with the library's bare
    // defaults (no ARGON2_PARAMS, the shape every hash predating this task
    // has) must keep verifying after the hash sites start passing explicit
    // memoryCost/timeCost/parallelism.
    await testDb.insert(users).values({
      name: "Old Hash Person",
      email: "oldhash@example.com",
      passwordHash: await argon2.hash("old-defaults-pw-1", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "oldhash@example.com", password: "old-defaults-pw-1" },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("session rejection", () => {
  test("expired session → 401", async () => {
    const [user] = await testDb.select().from(users).where(eq(users.email, "sess@example.com"));
    const { token, hash } = newToken();
    await testDb.insert(sessions).values({
      tokenHash: hash,
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token },
    });
    expect(res.statusCode).toBe(401);
  });

  test("inactive user with a live session → 401", async () => {
    const signin = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "sess@example.com", password: "a-long-password" },
    });
    const token = cookieOf(signin);
    try {
      await testDb.update(users).set({ active: false }).where(eq(users.email, "sess@example.com"));

      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        cookies: { pide_session: token! },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await testDb.update(users).set({ active: true }).where(eq(users.email, "sess@example.com"));
    }
  });
});

const ALL_ON = {
  "submission-receipt": true,
  "marks-released": true,
  "work-returned": true,
  "due-tomorrow": true,
  "due-reminder": true,
};

describe("notification prefs (Plan 8 Task 8)", () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await testDb.insert(users).values({
      name: "Prefs Person",
      email: "prefs@example.com",
      passwordHash: await argon2.hash("prefs-password-1", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });
    const signin = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "prefs@example.com", password: "prefs-password-1" },
    });
    token = cookieOf(signin)!;
    userId = signin.json().user.id;
  });

  test("GET me resolves all five keys to true when no rows exist", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.notificationPrefs).toEqual(ALL_ON);
  });

  test("a prefs-only PATCH (no name) succeeds, leaves the name unchanged, one row is written, and the reply carries the resolved map", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { pide_session: token },
      payload: { notificationPrefs: { "due-tomorrow": false } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.name).toBe("Prefs Person");
    expect(res.json().user.notificationPrefs).toEqual({ ...ALL_ON, "due-tomorrow": false });

    const rows = await testDb
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, userId));
    expect(rows).toHaveLength(1);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token },
    });
    expect(me.json().user.notificationPrefs).toEqual({ ...ALL_ON, "due-tomorrow": false });
  });

  test("PATCHing the same key again upserts — one row, not two", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { pide_session: token },
      payload: { notificationPrefs: { "due-tomorrow": true } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.notificationPrefs).toEqual(ALL_ON);

    const rows = await testDb
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].enabled).toBe(true);
  });

  test("an unknown key is stripped by the schema — 200, no row written", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { pide_session: token },
      payload: { notificationPrefs: { nonsense: false } },
    });
    expect(res.statusCode).toBe(200);
    const rows = await testDb
      .select()
      .from(notificationPrefs)
      .where(and(eq(notificationPrefs.userId, userId), eq(notificationPrefs.key, "nonsense")));
    expect(rows).toHaveLength(0);
  });

  test("a non-boolean pref value is rejected with 400", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { pide_session: token },
      payload: { notificationPrefs: { "due-tomorrow": "false" } },
    });
    expect(res.statusCode).toBe(400);
  });

  test("a name-only PATCH still works exactly as before, and leaves prefs untouched", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { pide_session: token },
      payload: { name: "Prefs Person Renamed" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.name).toBe("Prefs Person Renamed");
    expect(res.json().user.notificationPrefs).toEqual(ALL_ON);
  });
});
