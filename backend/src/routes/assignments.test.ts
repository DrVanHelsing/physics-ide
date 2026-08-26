import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { BUILT_IN_RULE_SETS } from "@physics-ide/shared";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classMembers, assignments, events, projects, submissions, assignmentWork, marks } from "../db/schema.js";

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

describe("rule sets: GET/POST/DELETE /api/rule-sets", () => {
  let teacher2Cookie: string;

  beforeAll(async () => {
    await makeUser("bteach@example.com", { isTeacher: true });
    teacher2Cookie = await signin("bteach@example.com");
  });

  test("a student account gets 403 (\"Teachers only.\")", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/rule-sets",
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Teachers only.");
  });

  test("teacher saves \"Gr11 practicals\" -> 201, and GET lists it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/rule-sets",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Gr11 practicals", rules: BUILT_IN_RULE_SETS.standard_classwork },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().ruleSet.name).toBe("Gr11 practicals");

    const list = await app.inject({
      method: "GET",
      url: "/api/rule-sets",
      cookies: { pide_session: teacherCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().ruleSets).toHaveLength(1);
    expect(list.json().ruleSets[0].name).toBe("Gr11 practicals");

    const evts = await eventsOfType("ruleset.saved");
    expect(
      evts.some((e) => (e.payload as Record<string, unknown>).name === "Gr11 practicals"),
    ).toBe(true);
  });

  test("saving the same name again overwrites (list still length 1, rules updated)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/rule-sets",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Gr11 practicals", rules: BUILT_IN_RULE_SETS.locked_assessment },
    });
    expect(res.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: "/api/rule-sets",
      cookies: { pide_session: teacherCookie },
    });
    expect(list.json().ruleSets).toHaveLength(1);
    expect(list.json().ruleSets[0].rules.debug).toBe(false);
  });

  test("another teacher's list does not contain it", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/rule-sets",
      cookies: { pide_session: teacher2Cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().ruleSets).toHaveLength(0);
  });

  test("delete -> 204 and gone", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/rule-sets",
      cookies: { pide_session: teacherCookie },
    });
    const ruleSetId = list.json().ruleSets[0].id;

    const del = await app.inject({
      method: "DELETE",
      url: `/api/rule-sets/${ruleSetId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(del.statusCode).toBe(204);

    const evts = await eventsOfType("ruleset.deleted");
    expect(
      evts.some((e) => (e.payload as Record<string, unknown>).ruleSetId === ruleSetId),
    ).toBe(true);

    const after = await app.inject({
      method: "GET",
      url: "/api/rule-sets",
      cookies: { pide_session: teacherCookie },
    });
    expect(after.json().ruleSets).toHaveLength(0);
  });
});

describe("starter pinning: POST/DELETE /api/assignments/:id/starter", () => {
  let starterAssignmentId: string;
  let teacherProjectId: string;
  let teacherUserId: string;

  beforeAll(async () => {
    const [teacherRow] = await testDb.select().from(users).where(eq(users.email, "ateach@example.com"));
    teacherUserId = teacherRow.id;
    teacherProjectId = "p-starter-teacher-project";
    await testDb.insert(projects).values({
      id: teacherProjectId,
      ownerId: teacherUserId,
      title: "Starter Source",
      goal: "Practice",
      projectType: "physics",
      manifest: { schemaVersion: 2, marker: "teacher-starter" },
      clientUpdatedAt: Date.now(),
    });

    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Starter Pin Test" },
    });
    starterAssignmentId = draftRes.json().assignment.id;
  });

  test("teacher pins own project -> assignment hasStarter true", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${starterAssignmentId}/starter`,
      cookies: { pide_session: teacherCookie },
      payload: { projectId: teacherProjectId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.hasStarter).toBe(true);

    const [row] = await testDb.select().from(assignments).where(eq(assignments.id, starterAssignmentId));
    expect(row.starterManifest).toEqual({ schemaVersion: 2, marker: "teacher-starter" });

    const evts = await eventsOfType("assignment.starter_pinned");
    expect(
      evts.some((e) => (e.payload as Record<string, unknown>).assignmentId === starterAssignmentId),
    ).toBe(true);
  });

  test("pinning someone else's projectId -> 404", async () => {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Starter 404 Test" },
    });
    const otherAssignmentId = draftRes.json().assignment.id;

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${otherAssignmentId}/starter`,
      cookies: { pide_session: teacherCookie },
      payload: { projectId: "p-does-not-exist" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such project.");
  });

  test("DELETE clears the starter", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/assignments/${starterAssignmentId}/starter`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.hasStarter).toBe(false);

    const [row] = await testDb.select().from(assignments).where(eq(assignments.id, starterAssignmentId));
    expect(row.starterManifest).toBeNull();

    const evts = await eventsOfType("assignment.starter_cleared");
    expect(
      evts.some((e) => (e.payload as Record<string, unknown>).assignmentId === starterAssignmentId),
    ).toBe(true);
  });

  test("pinning after a submission exists -> 400", async () => {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Starter Submission Guard Test" },
    });
    const guardedAssignmentId = draftRes.json().assignment.id;

    const [student] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    await testDb.insert(submissions).values({
      assignmentId: guardedAssignmentId,
      submittedBy: student.id,
      creditedIds: [],
      manifest: {},
      fingerprint: "x",
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${guardedAssignmentId}/starter`,
      cookies: { pide_session: teacherCookie },
      payload: { projectId: teacherProjectId },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/assignments/:id/start", () => {
  let openAssignmentId: string;
  let studentProjectId: string;
  let studentId: string;

  beforeAll(async () => {
    const [studentRow] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    studentId = studentRow.id;

    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Start Work Test" },
    });
    openAssignmentId = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${openAssignmentId}/publish`,
      cookies: { pide_session: teacherCookie },
    });

    studentProjectId = "p-start-work-student-project";
    await testDb.insert(projects).values({
      id: studentProjectId,
      ownerId: studentId,
      title: "My Copy",
      goal: "physics",
      projectType: "physics",
      manifest: { schemaVersion: 2, marker: "student-copy" },
      clientUpdatedAt: Date.now(),
    });
  });

  test("a member with a pushed project starts -> 201, work.projectId, event logged", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${openAssignmentId}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId: studentProjectId },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().work.projectId).toBe(studentProjectId);

    const rows = await testDb
      .select()
      .from(assignmentWork)
      .where(eq(assignmentWork.assignmentId, openAssignmentId));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(studentId);
    expect(rows[0].ownerId).toBe(studentId);
    expect(rows[0].projectId).toBe(studentProjectId);

    const evts = await eventsOfType("assignment.started");
    expect(
      evts.some((e) => (e.payload as Record<string, unknown>).assignmentId === openAssignmentId),
    ).toBe(true);
  });

  test("starting again returns 200 with the existing row and does not insert a second one", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${openAssignmentId}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId: studentProjectId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().work.projectId).toBe(studentProjectId);

    const rows = await testDb
      .select()
      .from(assignmentWork)
      .where(eq(assignmentWork.assignmentId, openAssignmentId));
    expect(rows).toHaveLength(1);
  });

  test("two genuinely concurrent first-time starts for the same user never 500 — one wins, one adopts", async () => {
    // A fresh assignment so this doesn't collide with the sequential
    // idempotency test's already-started state above.
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Concurrent Start Test" },
    });
    const raceAssignmentId = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${raceAssignmentId}/publish`,
      cookies: { pide_session: teacherCookie },
    });

    const [a, b] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/api/assignments/${raceAssignmentId}/start`,
        cookies: { pide_session: studentCookie },
        payload: { projectId: studentProjectId },
      }),
      app.inject({
        method: "POST",
        url: `/api/assignments/${raceAssignmentId}/start`,
        cookies: { pide_session: studentCookie },
        payload: { projectId: studentProjectId },
      }),
    ]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    expect(a.json().work.projectId).toBe(studentProjectId);
    expect(b.json().work.projectId).toBe(studentProjectId);

    const rows = await testDb
      .select()
      .from(assignmentWork)
      .where(eq(assignmentWork.assignmentId, raceAssignmentId));
    expect(rows).toHaveLength(1);
  });

  test("a non-member 403s", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${openAssignmentId}/start`,
      cookies: { pide_session: strangerCookie },
      payload: { projectId: studentProjectId },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Not a member of this class.");
  });

  test("starting a draft assignment 400s", async () => {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Still Draft" },
    });
    const draftId = draftRes.json().assignment.id;

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${draftId}/start`,
      cookies: { pide_session: teacherCookie },
      payload: { projectId: studentProjectId },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("This assignment is not open.");
  });

  test("starting a closed assignment 400s", async () => {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Soon Closed" },
    });
    const closedId = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${closedId}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    await app.inject({
      method: "POST",
      url: `/api/assignments/${closedId}/close`,
      cookies: { pide_session: teacherCookie },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${closedId}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId: studentProjectId },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("This assignment is not open.");
  });

  test("a projectId the caller does not own 404s", async () => {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Foreign Project Test" },
    });
    const aId = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${aId}/publish`,
      cookies: { pide_session: teacherCookie },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${aId}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId: "p-does-not-exist-for-student" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such project.");
  });
});

describe("GET /api/assignments/:id — starterSeed and myWork", () => {
  let seedAssignmentId: string;
  let seedTeacherProjectId: string;
  let seedStudentProjectId: string;
  let studentId: string;

  beforeAll(async () => {
    const [teacherRow] = await testDb.select().from(users).where(eq(users.email, "ateach@example.com"));
    const [studentRow] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    studentId = studentRow.id;

    seedTeacherProjectId = "p-seed-teacher-project";
    await testDb.insert(projects).values({
      id: seedTeacherProjectId,
      ownerId: teacherRow.id,
      title: "Seed Source",
      goal: "datascience",
      projectType: "block_template",
      manifest: {
        schemaVersion: 2,
        id: "m-seed",
        title: "Seed Source",
        goal: "datascience",
        projectType: "block_template",
        preferredEditor: "blocks",
        workspace: { xml: "<xml>seed</xml>" },
        source: { python: "" },
      },
      clientUpdatedAt: Date.now(),
    });

    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Seeded Assignment" },
    });
    seedAssignmentId = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${seedAssignmentId}/starter`,
      cookies: { pide_session: teacherCookie },
      payload: { projectId: seedTeacherProjectId },
    });
    await app.inject({
      method: "POST",
      url: `/api/assignments/${seedAssignmentId}/publish`,
      cookies: { pide_session: teacherCookie },
    });
  });

  test("starterSeed is present for a student before they start, derived from the starter manifest", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${seedAssignmentId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().assignment;
    expect(body.myWork).toBeNull();
    expect(body.starterSeed).toEqual({
      goal: "datascience",
      workspaceXml: "<xml>seed</xml>",
      python: "",
      preferredEditor: "blocks",
    });
    // Students now get their own rules too (only the teacher LIST omits them).
    expect(body.rules).toBeDefined();
  });

  test("starterSeed disappears and myWork reflects the row once the student has started", async () => {
    seedStudentProjectId = "p-seed-student-copy";
    await testDb.insert(projects).values({
      id: seedStudentProjectId,
      ownerId: studentId,
      title: "My Copy",
      goal: "datascience",
      projectType: "block_template",
      manifest: { schemaVersion: 2, marker: "student-copy" },
      clientUpdatedAt: Date.now(),
    });

    const start = await app.inject({
      method: "POST",
      url: `/api/assignments/${seedAssignmentId}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId: seedStudentProjectId },
    });
    expect(start.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${seedAssignmentId}`,
      cookies: { pide_session: studentCookie },
    });
    const body = res.json().assignment;
    expect(body.starterSeed).toBeNull();
    expect(body.myWork).toEqual({
      projectId: seedStudentProjectId,
      startedAt: expect.any(Number),
    });
  });
});

describe("GET /api/assignments/upcoming", () => {
  const DAY = 24 * 60 * 60 * 1000;
  let studentId: string;
  let teacherId: string;
  let upcomingClassId: string;
  let freshCookie: string;

  async function createPublished(payload: Record<string, unknown>) {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${upcomingClassId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload,
    });
    const id = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    return id;
  }

  beforeAll(async () => {
    const [studentRow] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    studentId = studentRow.id;
    const [teacherRow] = await testDb.select().from(users).where(eq(users.email, "ateach@example.com"));
    teacherId = teacherRow.id;

    const classRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Upcoming Strip Test Class" },
    });
    upcomingClassId = classRes.json().class.id;
    await testDb
      .insert(classMembers)
      .values({ classId: upcomingClassId, userId: studentId, role: "student", status: "active" });

    await makeUser("freshstudent@example.com");
    freshCookie = await signin("freshstudent@example.com");
  });

  test("empty result: a member of no classes with no marks gets both lists empty", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/assignments/upcoming",
      cookies: { pide_session: freshCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ dueSoon: [], recentFeedback: [] });
  });

  describe("dueSoon", () => {
    let inWindowId: string;
    let tooFarId: string;
    let lateWindowId: string;
    let submittedId: string;
    let groupOnlyId: string;
    let staleSubmissionId: string;

    beforeAll(async () => {
      const now = Date.now();
      inWindowId = await createPublished({ title: "Due in 2 days", dueAt: now + 2 * DAY });
      tooFarId = await createPublished({ title: "Due in 20 days", dueAt: now + 20 * DAY });
      lateWindowId = await createPublished({
        title: "Just went late",
        dueAt: now - 2 * 60 * 60 * 1000,
        lateUntil: now + DAY,
      });
      submittedId = await createPublished({ title: "Already submitted", dueAt: now + 3 * DAY });
      groupOnlyId = await createPublished({ title: "Group submission only", dueAt: now + 3 * DAY });
      staleSubmissionId = await createPublished({ title: "Superseded submission", dueAt: now + 3 * DAY });

      await testDb.insert(submissions).values({
        assignmentId: submittedId,
        submitterId: studentId,
        submittedBy: studentId,
        creditedIds: [studentId],
        manifest: {},
        fingerprint: "submitted-1",
        isCurrent: true,
      });
      // Group submission: no submitterId (groupId instead) — group membership
      // resolution is Stage D, so this must NOT read as "submitted" yet.
      await testDb.insert(submissions).values({
        assignmentId: groupOnlyId,
        groupId: "11111111-1111-1111-1111-111111111111",
        submittedBy: studentId,
        creditedIds: [studentId],
        manifest: {},
        fingerprint: "group-1",
        isCurrent: true,
      });
      await testDb.insert(submissions).values({
        assignmentId: staleSubmissionId,
        submitterId: studentId,
        submittedBy: studentId,
        creditedIds: [studentId],
        manifest: {},
        fingerprint: "stale-old",
        isCurrent: false,
      });
    });

    test("includes an assignment due within 14 days and excludes one due much later", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/assignments/upcoming",
        cookies: { pide_session: studentCookie },
      });
      expect(res.statusCode).toBe(200);
      const ids = res.json().dueSoon.map((d: { assignmentId: string }) => d.assignmentId);
      expect(ids).toContain(inWindowId);
      expect(ids).not.toContain(tooFarId);
    });

    test("a past-due assignment still in its late window shows up regardless of the 14-day window", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/assignments/upcoming",
        cookies: { pide_session: studentCookie },
      });
      const row = res.json().dueSoon.find((d: { assignmentId: string }) => d.assignmentId === lateWindowId);
      expect(row).toBeDefined();
      expect(row.className).toBe("Upcoming Strip Test Class");
      expect(row.classId).toBe(upcomingClassId);
    });

    test("submitted reflects a current individual submission; unsubmitted assignments read false", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/assignments/upcoming",
        cookies: { pide_session: studentCookie },
      });
      const list = res.json().dueSoon;
      expect(list.find((d: { assignmentId: string }) => d.assignmentId === submittedId).submitted).toBe(
        true,
      );
      expect(list.find((d: { assignmentId: string }) => d.assignmentId === inWindowId).submitted).toBe(
        false,
      );
    });

    test("a superseded (non-current) submission does not count as submitted", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/assignments/upcoming",
        cookies: { pide_session: studentCookie },
      });
      const row = res
        .json()
        .dueSoon.find((d: { assignmentId: string }) => d.assignmentId === staleSubmissionId);
      expect(row.submitted).toBe(false);
    });

    test("a group-only submission (no submitterId) does not count as submitted", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/assignments/upcoming",
        cookies: { pide_session: studentCookie },
      });
      const row = res.json().dueSoon.find((d: { assignmentId: string }) => d.assignmentId === groupOnlyId);
      expect(row.submitted).toBe(false);
    });

    test("archiving the class removes its assignments from dueSoon", async () => {
      const before = await app.inject({
        method: "GET",
        url: "/api/assignments/upcoming",
        cookies: { pide_session: studentCookie },
      });
      expect(before.json().dueSoon.map((d: { assignmentId: string }) => d.assignmentId)).toContain(
        inWindowId,
      );

      await app.inject({
        method: "POST",
        url: `/api/classes/${upcomingClassId}/archive`,
        cookies: { pide_session: teacherCookie },
      });

      const after = await app.inject({
        method: "GET",
        url: "/api/assignments/upcoming",
        cookies: { pide_session: studentCookie },
      });
      expect(after.json().dueSoon).toEqual([]);
    });
  });

  describe("recentFeedback", () => {
    let feedbackClassId: string;
    let releasedAssignmentId: string;
    let olderReleasedAssignmentId: string;
    let draftMarkAssignmentId: string;
    let staleReleaseAssignmentId: string;

    beforeAll(async () => {
      const classRes = await app.inject({
        method: "POST",
        url: "/api/classes",
        cookies: { pide_session: teacherCookie },
        payload: { name: "Feedback Strip Test Class" },
      });
      feedbackClassId = classRes.json().class.id;
      await testDb
        .insert(classMembers)
        .values({ classId: feedbackClassId, userId: studentId, role: "student", status: "active" });

      async function makeAssignment(title: string) {
        const res = await app.inject({
          method: "POST",
          url: `/api/classes/${feedbackClassId}/assignments`,
          cookies: { pide_session: teacherCookie },
          payload: { title },
        });
        return res.json().assignment.id;
      }
      releasedAssignmentId = await makeAssignment("Released Recently");
      olderReleasedAssignmentId = await makeAssignment("Released A Few Days Before That");
      draftMarkAssignmentId = await makeAssignment("Marked But Not Released");
      staleReleaseAssignmentId = await makeAssignment("Released Long Ago");

      const now = Date.now();
      // Task 18 (marking) doesn't exist yet — mark rows are seeded directly,
      // exactly as the brief calls for.
      await testDb.insert(marks).values({
        assignmentId: releasedAssignmentId,
        studentId,
        points: 8,
        status: "released",
        markedBy: teacherId,
        releasedAt: new Date(now - 3 * DAY),
      });
      await testDb.insert(marks).values({
        assignmentId: olderReleasedAssignmentId,
        studentId,
        points: 6,
        status: "released",
        markedBy: teacherId,
        releasedAt: new Date(now - 6 * DAY),
      });
      await testDb.insert(marks).values({
        assignmentId: draftMarkAssignmentId,
        studentId,
        points: 7,
        status: "draft",
        markedBy: teacherId,
        releasedAt: null,
      });
      await testDb.insert(marks).values({
        assignmentId: staleReleaseAssignmentId,
        studentId,
        points: 9,
        status: "released",
        markedBy: teacherId,
        releasedAt: new Date(now - 20 * DAY),
      });
    });

    test("only released marks within the last 14 days appear, newest first", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/assignments/upcoming",
        cookies: { pide_session: studentCookie },
      });
      const feedback = res.json().recentFeedback;
      const ids = feedback.map((f: { assignmentId: string }) => f.assignmentId);
      expect(ids).not.toContain(draftMarkAssignmentId);
      expect(ids).not.toContain(staleReleaseAssignmentId);
      expect(ids.indexOf(releasedAssignmentId)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(olderReleasedAssignmentId)).toBeGreaterThan(ids.indexOf(releasedAssignmentId));

      const row = feedback.find((f: { assignmentId: string }) => f.assignmentId === releasedAssignmentId);
      expect(row.classId).toBe(feedbackClassId);
      expect(row.title).toBe("Released Recently");
      expect(typeof row.releasedAt).toBe("number");
    });
  });
});
