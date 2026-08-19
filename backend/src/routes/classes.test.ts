import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classes, classMembers, events } from "../db/schema.js";
import { CLASS_CODE_REGEX } from "@physics-ide/shared";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let studentCookie: string;
let unconfirmedCookie: string;
let classId: string;

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

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("teach@example.com", { isTeacher: true });
  await makeUser("kid@example.com");
  await makeUser("newbie@example.com", { emailConfirmedAt: null });
  teacherCookie = await signin("teach@example.com");
  studentCookie = await signin("kid@example.com");
  unconfirmedCookie = await signin("newbie@example.com");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/classes", () => {
  test("teacher creates a class: code minted, creator is an active teacher member, event logged", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Grade 11 Physical Sciences", subjectLabel: "2027" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    classId = body.class.id;
    expect(CLASS_CODE_REGEX.test(body.class.joinCode)).toBe(true);
    expect(body.class.joinMode).toBe("open");

    const members = await testDb.select().from(classMembers).where(eq(classMembers.classId, classId));
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("teacher");
    expect(members[0].status).toBe("active");

    const evts = await testDb.select().from(events).where(eq(events.type, "class.created"));
    expect(evts.length).toBeGreaterThanOrEqual(1);
  });

  test("a non-teacher account is refused", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: studentCookie },
      payload: { name: "Nope" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Only teacher accounts can create classes.");
  });

  test("an unconfirmed account is refused first", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: unconfirmedCookie },
      payload: { name: "Nope" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Confirm your email address first.");
  });
});

describe("GET /api/classes and /api/classes/:id", () => {
  test("lists my classes with my role; teacher detail includes the join code", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().classes).toHaveLength(1);
    expect(list.json().classes[0].myRole).toBe("teacher");

    const detail = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().class.joinCode).toBeDefined();
  });

  test("a non-member gets 404 (no existence oracle) and no join code leaks to students", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such class.");
  });
});

describe("settings, code regeneration, archive", () => {
  test("teacher updates settings; students cannot", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval", name: "Renamed" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.joinMode).toBe("approval");
    expect(res.json().class.name).toBe("Renamed");

    const deny = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: studentCookie },
      payload: { name: "Hax" },
    });
    expect(deny.statusCode).toBe(403);
  });

  test("regenerating the code changes it", async () => {
    const [before] = await testDb.select().from(classes).where(eq(classes.id, classId));
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/regenerate-code`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().joinCode).not.toBe(before.joinCode);
    expect(CLASS_CODE_REGEX.test(res.json().joinCode)).toBe(true);
  });

  test("archive blocks settings changes until unarchive", async () => {
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const blocked = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { name: "While archived" },
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error).toBe("That class is archived.");

    const un = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/unarchive`,
      cookies: { pide_session: teacherCookie },
    });
    expect(un.statusCode).toBe(200);
  });
});
