import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classMembers, assignments, events } from "../db/schema.js";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let studentCookie: string;
let strangerCookie: string;
let classId: string;
let assignmentId: string;

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
  const teacher = await makeUser("ateach@example.com", { isTeacher: true });
  const student = await makeUser("akid@example.com");
  await makeUser("stranger@example.com");
  teacherCookie = await signin("ateach@example.com");
  studentCookie = await signin("akid@example.com");
  strangerCookie = await signin("stranger@example.com");

  const classRes = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: teacherCookie },
    payload: { name: "Assignments Test Class" },
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

describe("POST /api/classes/:id/assignments", () => {
  test("teacher creates a draft in their class -> 201, status draft, event assignment.created", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Projectile Motion Lab" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    assignmentId = body.assignment.id;
    expect(body.assignment.classId).toBe(classId);
    expect(body.assignment.title).toBe("Projectile Motion Lab");
    expect(body.assignment.phase).toBe("draft");
    expect(body.assignment.opensAt).toBeNull();
    expect(body.assignment.hasStarter).toBe(false);

    const evts = await eventsOfType("assignment.created");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).assignmentId === assignmentId)).toBe(
      true,
    );
  });

  test("a student in the class cannot create (403 from requireClassTeacher)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: studentCookie },
      payload: { title: "Nope" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Teachers only for this class.");
  });
});

describe("GET /api/classes/:id/assignments", () => {
  test("student list omits drafts; teacher list includes them", async () => {
    const studentList = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: studentCookie },
    });
    expect(studentList.statusCode).toBe(200);
    expect(studentList.json().assignments).toHaveLength(0);

    const teacherList = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
    });
    expect(teacherList.statusCode).toBe(200);
    const teacherAssignments = teacherList.json().assignments;
    expect(teacherAssignments).toHaveLength(1);
    expect(teacherAssignments[0].id).toBe(assignmentId);
    expect(teacherAssignments[0].submittedCount).toBe(0);
  });
});

describe("GET /api/assignments/:id", () => {
  test("student gets 404 for a draft (existence not admitted), teacher gets it", async () => {
    const studentRes = await app.inject({
      method: "GET",
      url: `/api/assignments/${assignmentId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(studentRes.statusCode).toBe(404);
    expect(studentRes.json().error).toBe("No such assignment.");

    const teacherRes = await app.inject({
      method: "GET",
      url: `/api/assignments/${assignmentId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(teacherRes.statusCode).toBe(200);
    const body = teacherRes.json();
    expect(body.assignment.id).toBe(assignmentId);
    expect(body.assignment.instructions).toBeDefined();
    expect(body.assignment.rules).toBeDefined();
    expect(body.assignment.myWork).toBeNull();
  });
});

describe("POST /api/assignments/:id/publish", () => {
  test("publish stamps publishedAt; student list now shows it with phase open", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.phase).toBe("open");

    const [row] = await testDb.select().from(assignments).where(eq(assignments.id, assignmentId));
    expect(row.publishedAt).not.toBeNull();
    expect(row.status).toBe("published");

    const evts = await eventsOfType("assignment.published");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).assignmentId === assignmentId)).toBe(
      true,
    );

    const studentList = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: studentCookie },
    });
    expect(studentList.json().assignments).toHaveLength(1);
    expect(studentList.json().assignments[0].phase).toBe("open");
  });
});

describe("PATCH /api/assignments/:id", () => {
  test("moving dueAt before opensAt -> 400 with the friendly message", async () => {
    const now = Date.now();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/assignments/${assignmentId}`,
      cookies: { pide_session: teacherCookie },
      payload: { opensAt: now + 100_000, dueAt: now + 50_000 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("The due date must come after the open date.");

    const [row] = await testDb.select().from(assignments).where(eq(assignments.id, assignmentId));
    expect(row.opensAt).toBeNull();
    expect(row.dueAt).toBeNull();
  });

  test("a valid patch updates the row and logs assignment.updated", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/assignments/${assignmentId}`,
      cookies: { pide_session: teacherCookie },
      payload: { points: 50 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.points).toBe(50);

    const evts = await eventsOfType("assignment.updated");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).assignmentId === assignmentId)).toBe(
      true,
    );
  });
});

describe("POST /api/assignments/:id/close", () => {
  test("close stamps closedAt; phase reads closed", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/close`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.phase).toBe("closed");

    const [row] = await testDb.select().from(assignments).where(eq(assignments.id, assignmentId));
    expect(row.closedAt).not.toBeNull();

    const evts = await eventsOfType("assignment.closed");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).assignmentId === assignmentId)).toBe(
      true,
    );
  });
});

describe("DELETE /api/assignments/:id", () => {
  test("a published assignment cannot be deleted; a draft can be", async () => {
    const deny = await app.inject({
      method: "DELETE",
      url: `/api/assignments/${assignmentId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(deny.statusCode).toBe(400);

    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Throwaway draft" },
    });
    const draftId = draftRes.json().assignment.id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/assignments/${draftId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(del.statusCode).toBe(204);

    const rows = await testDb.select().from(assignments).where(eq(assignments.id, draftId));
    expect(rows).toHaveLength(0);
  });
});

describe("non-members are refused everywhere", () => {
  test("a stranger to the class gets 403 on every assignment route", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: strangerCookie },
      payload: { title: "Nope" },
    });
    expect(create.statusCode).toBe(403);

    const list = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: strangerCookie },
    });
    expect(list.statusCode).toBe(403);

    const getById = await app.inject({
      method: "GET",
      url: `/api/assignments/${assignmentId}`,
      cookies: { pide_session: strangerCookie },
    });
    expect(getById.statusCode).toBe(403);

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/assignments/${assignmentId}`,
      cookies: { pide_session: strangerCookie },
      payload: { points: 10 },
    });
    expect(patch.statusCode).toBe(403);

    const publish = await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/publish`,
      cookies: { pide_session: strangerCookie },
    });
    expect(publish.statusCode).toBe(403);

    const close = await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/close`,
      cookies: { pide_session: strangerCookie },
    });
    expect(close.statusCode).toBe(403);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/assignments/${assignmentId}`,
      cookies: { pide_session: strangerCookie },
    });
    expect(del.statusCode).toBe(403);
  });
});
