import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classMembers, guides, events } from "../db/schema.js";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let studentCookie: string;
let strangerCookie: string;
let classId: string;
let guideId: string;

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

async function eventsOfType(type: string) {
  return testDb.select().from(events).where(eq(events.type, type));
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  const teacher = await makeUser("gteach@example.com", { isTeacher: true });
  const student = await makeUser("gkid@example.com");
  await makeUser("gstranger@example.com");
  teacherCookie = await signin("gteach@example.com");
  studentCookie = await signin("gkid@example.com");
  strangerCookie = await signin("gstranger@example.com");

  const classRes = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: teacherCookie },
    payload: { name: "Guides Test Class" },
  });
  classId = classRes.json().class.id;
  await testDb
    .insert(classMembers)
    .values({ classId, userId: student.id, role: "student", status: "active" });
  void teacher;
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/classes/:id/guides", () => {
  test("teacher creates a draft guide -> 201, publishedAt null, event guide.created", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/guides`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Lab Safety", body: { type: "doc", content: [] } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    guideId = body.guide.id;
    expect(body.guide.classId).toBe(classId);
    expect(body.guide.title).toBe("Lab Safety");
    expect(body.guide.publishedAt).toBeNull();

    const evts = await eventsOfType("guide.created");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).guideId === guideId)).toBe(true);
  });

  test("a student in the class cannot create (403 from requireClassTeacher)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/guides`,
      cookies: { pide_session: studentCookie },
      payload: { title: "Nope", body: { type: "doc", content: [] } },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Teachers only for this class.");
  });
});

describe("GET /api/classes/:id/guides", () => {
  test("student list omits drafts; teacher list includes them", async () => {
    const studentList = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/guides`,
      cookies: { pide_session: studentCookie },
    });
    expect(studentList.statusCode).toBe(200);
    expect(studentList.json().guides).toHaveLength(0);

    const teacherList = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/guides`,
      cookies: { pide_session: teacherCookie },
    });
    expect(teacherList.statusCode).toBe(200);
    const teacherGuides = teacherList.json().guides;
    expect(teacherGuides).toHaveLength(1);
    expect(teacherGuides[0].id).toBe(guideId);
  });
});

describe("GET /api/guides/:id", () => {
  test("student gets 404 for a draft (existence not admitted), teacher gets it with the body", async () => {
    const studentRes = await app.inject({
      method: "GET",
      url: `/api/guides/${guideId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(studentRes.statusCode).toBe(404);
    expect(studentRes.json().error).toBe("No such guide.");

    const teacherRes = await app.inject({
      method: "GET",
      url: `/api/guides/${guideId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(teacherRes.statusCode).toBe(200);
    const body = teacherRes.json();
    expect(body.guide.id).toBe(guideId);
    expect(body.guide.body).toEqual({ type: "doc", content: [] });
  });
});

describe("PATCH /api/guides/:id", () => {
  test("a valid patch updates the row and logs guide.updated", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/guides/${guideId}`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Lab Safety — Revised" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().guide.title).toBe("Lab Safety — Revised");

    const evts = await eventsOfType("guide.updated");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).guideId === guideId)).toBe(true);
  });

  test("a student cannot patch (403)", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/guides/${guideId}`,
      cookies: { pide_session: studentCookie },
      payload: { title: "Nope" },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("POST /api/guides/:id/publish", () => {
  test("publish stamps publishedAt; student can now read it and it appears in the student list", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/guides/${guideId}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().guide.publishedAt).not.toBeNull();

    const [row] = await testDb.select().from(guides).where(eq(guides.id, guideId));
    expect(row.publishedAt).not.toBeNull();

    const evts = await eventsOfType("guide.published");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).guideId === guideId)).toBe(true);

    const studentRead = await app.inject({
      method: "GET",
      url: `/api/guides/${guideId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(studentRead.statusCode).toBe(200);
    expect(studentRead.json().guide.body).toEqual({ type: "doc", content: [] });

    const studentList = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/guides`,
      cookies: { pide_session: studentCookie },
    });
    expect(studentList.json().guides).toHaveLength(1);
    expect(studentList.json().guides[0].id).toBe(guideId);
  });

  test("publishing an already-published guide -> 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/guides/${guideId}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("DELETE /api/guides/:id", () => {
  test("a teacher can delete a guide even after it is published — guides carry no student work", async () => {
    const del = await app.inject({
      method: "DELETE",
      url: `/api/guides/${guideId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(del.statusCode).toBe(204);

    const rows = await testDb.select().from(guides).where(eq(guides.id, guideId));
    expect(rows).toHaveLength(0);

    const evts = await eventsOfType("guide.deleted");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).guideId === guideId)).toBe(true);
  });
});

describe("non-members are refused everywhere", () => {
  let otherGuideId: string;

  beforeAll(async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/guides`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Stranger Target", body: { type: "doc", content: [] } },
    });
    otherGuideId = createRes.json().guide.id;
  });

  test("a stranger to the class gets 403 on every guide route", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/guides`,
      cookies: { pide_session: strangerCookie },
      payload: { title: "Nope", body: { type: "doc", content: [] } },
    });
    expect(create.statusCode).toBe(403);

    const list = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/guides`,
      cookies: { pide_session: strangerCookie },
    });
    expect(list.statusCode).toBe(403);

    const getById = await app.inject({
      method: "GET",
      url: `/api/guides/${otherGuideId}`,
      cookies: { pide_session: strangerCookie },
    });
    expect(getById.statusCode).toBe(403);

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/guides/${otherGuideId}`,
      cookies: { pide_session: strangerCookie },
      payload: { title: "Nope" },
    });
    expect(patch.statusCode).toBe(403);

    const publish = await app.inject({
      method: "POST",
      url: `/api/guides/${otherGuideId}/publish`,
      cookies: { pide_session: strangerCookie },
    });
    expect(publish.statusCode).toBe(403);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/guides/${otherGuideId}`,
      cookies: { pide_session: strangerCookie },
    });
    expect(del.statusCode).toBe(403);
  });
});
