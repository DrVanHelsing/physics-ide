import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { getSetting, setSetting } from "../db/settings.js";
import { users, emails, sessions } from "../db/schema.js";

const app = buildApp({ db: testDb });
let adminCookie: string;
let studentId: string;

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  const hash = await argon2.hash("admin-password-1", { type: argon2.argon2id });
  await testDb.insert(users).values({
    name: "Root",
    email: "root@example.com",
    passwordHash: hash,
    role: "admin",
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  const [student] = await testDb
    .insert(users)
    .values({
      name: "Kid",
      email: "kid@example.com",
      passwordHash: await argon2.hash("kid-password-1", { type: argon2.argon2id }),
      consentAt: new Date(),
    })
    .returning();
  studentId = student.id;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email: "root@example.com", password: "admin-password-1" },
  });
  adminCookie = res.cookies.find((c) => c.name === "pide_session")!.value;
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("admin guard", () => {
  test("a non-admin is refused with 403", async () => {
    const kid = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "kid@example.com", password: "kid-password-1" },
    });
    const kidCookie = kid.cookies.find((c) => c.name === "pide_session")!.value;
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      cookies: { pide_session: kidCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test("an anonymous request is refused with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Not signed in.");
  });
});

describe("people", () => {
  test("lists and searches users", async () => {
    const all = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      cookies: { pide_session: adminCookie },
    });
    expect(all.statusCode).toBe(200);
    expect(all.json().users.length).toBeGreaterThanOrEqual(2);

    const search = await app.inject({
      method: "GET",
      url: "/api/admin/users?q=kid",
      cookies: { pide_session: adminCookie },
    });
    expect(search.json().users).toHaveLength(1);
    expect(search.json().users[0].email).toBe("kid@example.com");
  });

  test("deactivate kills sessions and blocks signin; reactivate restores", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "kid@example.com", password: "kid-password-1" },
    });
    const before = await testDb.select().from(sessions).where(eq(sessions.userId, studentId));
    expect(before.length).toBeGreaterThanOrEqual(1);

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${studentId}/deactivate`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const liveSessions = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.userId, studentId));
    expect(liveSessions).toHaveLength(0);

    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "kid@example.com", password: "kid-password-1" },
    });
    expect(blocked.statusCode).toBe(403);

    await app.inject({
      method: "POST",
      url: `/api/admin/users/${studentId}/reactivate`,
      cookies: { pide_session: adminCookie },
    });
    const back = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "kid@example.com", password: "kid-password-1" },
    });
    expect(back.statusCode).toBe(200);
  });

  test("an admin cannot deactivate their own account", async () => {
    const [admin] = await testDb.select().from(users).where(eq(users.email, "root@example.com"));
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${admin.id}/deactivate`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("You cannot deactivate your own account.");
  });

  test("resend-confirmation mails a fresh confirm link (only to unconfirmed accounts)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${studentId}/resend-confirmation`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const mails = await testDb.select().from(emails).where(eq(emails.toEmail, "kid@example.com"));
    expect(mails.some((m) => m.template === "confirm")).toBe(true);
  });

  test("send-reset mails a reset link", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${studentId}/send-reset`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const mails = await testDb.select().from(emails).where(eq(emails.toEmail, "kid@example.com"));
    expect(mails.some((m) => m.template === "reset")).toBe(true);
  });
});

describe("cap, emails, health", () => {
  test("GET/PUT cap", async () => {
    const before = await app.inject({
      method: "GET",
      url: "/api/admin/cap",
      cookies: { pide_session: adminCookie },
    });
    expect(before.json()).toMatchObject({ cap: 200 });
    expect(typeof before.json().count).toBe("number");

    const put = await app.inject({
      method: "PUT",
      url: "/api/admin/cap",
      cookies: { pide_session: adminCookie },
      payload: { cap: 150 },
    });
    expect(put.statusCode).toBe(200);
    expect(await getSetting(testDb, "account_cap")).toBe(150);
    await setSetting(testDb, "account_cap", 200);
  });

  test("email log returns newest first", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/emails?limit=5",
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().emails;
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.length).toBeLessThanOrEqual(5);
    expect(new Date(list[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(list[list.length - 1].createdAt).getTime(),
    );
  });

  test("health reports counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/health",
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, db: "ok" });
    expect(typeof res.json().users).toBe("number");
    expect(typeof res.json().cap).toBe("number");
    expect(typeof res.json().emailsLogged).toBe("number");
  });
});

describe("classes list", () => {
  test("admin sees every class with size and teacher names; read-only", async () => {
    const [t] = await testDb
      .insert(users)
      .values({
        name: "List Teacher",
        email: "listteach@example.com",
        passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
        isTeacher: true,
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      })
      .returning();
    const signinRes = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "listteach@example.com", password: "a-long-password" },
    });
    const tCookie = signinRes.cookies.find((c) => c.name === "pide_session")!.value;
    await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: tCookie },
      payload: { name: "Admin Visible Class" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/classes",
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().classes as Array<{
      name: string;
      activeMembers: number;
      teachers: string[];
    }>;
    const row = list.find((c) => c.name === "Admin Visible Class");
    expect(row).toBeDefined();
    expect(row!.activeMembers).toBe(1);
    expect(row!.teachers).toContain("List Teacher");
    void t;
  });
});
