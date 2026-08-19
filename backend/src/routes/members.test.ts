import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classes, classMembers } from "../db/schema.js";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let kidCookie: string;
let kid2Cookie: string;
let kidId: string;
let kid2Id: string;
let teacherId: string;
let openClass: { id: string; joinCode: string };

async function makeUser(email: string, opts: Record<string, unknown> = {}) {
  const [u] = await testDb
    .insert(users)
    .values({
      name: email.split("@")[0],
      email,
      passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
      ...opts,
    })
    .returning();
  return u;
}

async function signin(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

async function createClass(cookie: string, name: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: cookie },
    payload: { name },
  });
  return res.json().class as { id: string; joinCode: string };
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  const t = await makeUser("mteach@example.com", { isTeacher: true });
  teacherId = t.id;
  const k = await makeUser("mkid@example.com");
  kidId = k.id;
  const k2 = await makeUser("mkid2@example.com");
  kid2Id = k2.id;
  teacherCookie = await signin("mteach@example.com");
  kidCookie = await signin("mkid@example.com");
  kid2Cookie = await signin("mkid2@example.com");
  openClass = await createClass(teacherCookie, "Open Class");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/classes/join", () => {
  test("open class: joins active, sloppy code input accepted", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kidCookie },
      payload: { code: ` ${openClass.joinCode.toLowerCase().replace("-", " ")} ` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, status: "active", classId: openClass.id });
  });

  test("joining again is refused politely", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kidCookie },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("You're already in this class.");
  });

  test("unknown code → one generic message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kid2Cookie },
      payload: { code: "ZZZ-ZZZ" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No class has that code.");
  });

  test("approval mode → waiting; teacher approves → active", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kid2Cookie },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("waiting");

    const approve = await app.inject({
      method: "POST",
      url: `/api/classes/${openClass.id}/members/${kid2Id}/approve`,
      cookies: { pide_session: teacherCookie },
    });
    expect(approve.statusCode).toBe(200);
    const [row] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.userId, kid2Id)));
    expect(row.status).toBe("active");
  });

  test("paused mode refuses joiners", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "paused" },
    });
    const extra = await makeUser("mkid3@example.com");
    const cookie3 = await signin("mkid3@example.com");
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: cookie3 },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Joining this class is paused.");
    void extra;
  });

  test("archived class refuses joiners with its own message", async () => {
    const second = await createClass(teacherCookie, "To Archive");
    await app.inject({
      method: "POST",
      url: `/api/classes/${second.id}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kid2Cookie },
      payload: { code: second.joinCode },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That class is archived.");
  });
});

describe("roster", () => {
  test("teacher sees members; students may not read the roster", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${openClass.id}/members`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const roster = res.json().members as Array<{ email: string; role: string; status: string }>;
    expect(roster.length).toBeGreaterThanOrEqual(3);
    expect(roster.some((m) => m.role === "teacher")).toBe(true);

    const deny = await app.inject({
      method: "GET",
      url: `/api/classes/${openClass.id}/members`,
      cookies: { pide_session: kidCookie },
    });
    expect(deny.statusCode).toBe(403);
  });

  test("deny removes a waiting member entirely", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval" },
    });
    await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: (await signin("mkid3@example.com")) },
      payload: { code: openClass.joinCode },
    });
    const [waiting] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.status, "waiting")));
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${openClass.id}/members/${waiting.userId}/deny`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const left = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.userId, waiting.userId)));
    expect(left).toHaveLength(0);
  });

  test("removing a student works; removing the last teacher is refused", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/classes/${openClass.id}/members/${kidId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);

    const last = await app.inject({
      method: "DELETE",
      url: `/api/classes/${openClass.id}/members/${teacherId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(last.statusCode).toBe(400);
    expect(last.json().error).toBe("A class must keep at least one teacher.");
  });
});
