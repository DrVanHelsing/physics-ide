import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { BUILT_IN_RULE_SETS } from "@physics-ide/shared";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import {
  users,
  classMembers,
  assignments,
  events,
  projects,
  projectVersions,
  submissions,
  assignmentWork,
  marks,
  emails,
  groups,
  groupMembers,
  notifications,
} from "../db/schema.js";
import { stableStringify } from "./projects.js";

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

/* Each signin gets its own source IP: the auth route's per-IP rate limit is
 * sized for humans, and this file's describes (merged from several Stage C
 * lanes) collectively sign in more accounts than one IP's window allows.
 * auth.test.ts's dedicated rate-limit suites control their own addresses,
 * so this changes nothing about what they verify. */
let signinIpCounter = 0;
async function signin(email: string): Promise<string> {
  signinIpCounter += 1;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    remoteAddress: `10.99.${Math.floor(signinIpCounter / 250)}.${(signinIpCounter % 250) + 1}`,
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

async function eventsOfType(type: string) {
  return testDb.select().from(events).where(eq(events.type, type));
}

async function notificationsFor(userId: string) {
  return testDb.select().from(notifications).where(eq(notifications.userId, userId));
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

  // Task 5, site 1: active students of the class are notified; the teacher
  // who published it and a waiting (not yet approved) member get nothing.
  test("publish notifies active students with assignment.published — a waiting member and the teacher get nothing", async () => {
    const [studentRow] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    const [teacherRow] = await testDb.select().from(users).where(eq(users.email, "ateach@example.com"));
    const waiting = await makeUser("apub-notify-waiting@example.com");
    await testDb
      .insert(classMembers)
      .values({ classId, userId: waiting.id, role: "student", status: "waiting" });

    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Notify Publish" },
    });
    const id = draftRes.json().assignment.id as string;
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);

    const logged = await eventsOfType("assignment.published");
    const myEvent = logged.find((e) => (e.payload as { assignmentId?: string }).assignmentId === id);
    expect(myEvent).toBeDefined();

    const studentNotifs = (await notificationsFor(studentRow.id)).filter((n) => n.eventId === myEvent!.id);
    expect(studentNotifs).toHaveLength(1);
    expect(studentNotifs[0].type).toBe("assignment.published");
    expect(studentNotifs[0].payload).toEqual({ assignmentId: id, classId });

    // Negative: a waiting member and the publishing teacher get nothing.
    expect(await notificationsFor(waiting.id)).toHaveLength(0);
    expect((await notificationsFor(teacherRow.id)).filter((n) => n.eventId === myEvent!.id)).toHaveLength(0);
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

/* Final fix wave, I4: PATCH used to accept submissionMode/individualWork at
   any stage. Flipping either one after students have started orphans the work
   rows the myWork / inbox / gradebook reads all key off — an individual's row
   under a group assignment, or the reverse — so the same STARTER_LOCKED shape
   applies: the mode is a starting decision, fixed once there is work. */
describe("PATCH /api/assignments/:id — the submission mode locks once work exists (final fix wave I4)", () => {
  const LOCKED = "Students have started — the submission mode is fixed once work exists.";
  let studentId: string;
  let seq = 0;

  beforeAll(async () => {
    const [studentRow] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    studentId = studentRow.id;
  });

  async function publishedAssignment(title: string) {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title },
    });
    const id = draftRes.json().assignment.id as string;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    return id;
  }

  async function startWorkOn(id: string) {
    seq += 1;
    const projectId = `p-mode-lock-${seq}`;
    await testDb.insert(projects).values({
      id: projectId,
      ownerId: studentId,
      title: "My Copy",
      goal: "physics",
      projectType: "physics",
      manifest: { schemaVersion: 2, marker: `mode-lock-${seq}` },
      clientUpdatedAt: Date.now(),
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId },
    });
    expect(res.statusCode).toBe(201);
    return projectId;
  }

  function patch(id: string, payload: Record<string, unknown>) {
    return app.inject({
      method: "PATCH",
      url: `/api/assignments/${id}`,
      cookies: { pide_session: teacherCookie },
      payload,
    });
  }

  test("before anyone has started, the mode is still the teacher's to change", async () => {
    const id = await publishedAssignment("Mode Lock — Nobody Started");
    expect((await patch(id, { submissionMode: "pair" })).statusCode).toBe(200);
    // ...and back again, this time with individualWork, which only an
    // individually-submitted assignment may carry.
    expect((await patch(id, { submissionMode: "individual", individualWork: true })).statusCode).toBe(200);

    const [row] = await testDb.select().from(assignments).where(eq(assignments.id, id));
    expect(row.submissionMode).toBe("individual");
    expect(row.individualWork).toBe(true);
  });

  test("once a student has started — before any submission — the mode is refused with the honest sentence", async () => {
    const id = await publishedAssignment("Mode Lock — Work Started");
    await startWorkOn(id);

    const res = await patch(id, { submissionMode: "pair" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(LOCKED);

    const [row] = await testDb.select().from(assignments).where(eq(assignments.id, id));
    expect(row.submissionMode).toBe("individual");
  });

  test("individualWork is locked by the same rule, and a submission locks it too", async () => {
    const id = await publishedAssignment("Mode Lock — Submitted");
    await startWorkOn(id);
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(submitRes.statusCode).toBe(201);

    const res = await patch(id, { individualWork: true });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(LOCKED);

    const [row] = await testDb.select().from(assignments).where(eq(assignments.id, id));
    expect(row.individualWork).toBe(false);
  });

  test("re-sending the SAME mode is not a change and is still accepted, alongside everything else that stays editable", async () => {
    const id = await publishedAssignment("Mode Lock — Same Value");
    await startWorkOn(id);

    const res = await patch(id, { submissionMode: "individual", individualWork: false, points: 42 });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.points).toBe(42);
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

describe("POST /api/assignments/:id/submit", () => {
  // A dedicated class AND a dedicated student — the shared top-level
  // `classId`/`akid@example.com` pair is asserted against by the /upcoming
  // describe block below (dueSoon/recentFeedback), and a late-window or
  // overdue assignment submitted here would leak into those counts (a
  // late_window assignment is a dueSoon candidate regardless of the 14-day
  // window). Shadowing `studentCookie`/`studentId` here keeps every helper
  // and test below unchanged while pointing them at the isolated account.
  let submitClassId: string;
  let studentId: string;
  let studentCookie: string;

  function fingerprintOf(manifest: unknown): string {
    return crypto.createHash("sha256").update(stableStringify(manifest)).digest("hex");
  }

  async function createPublished(payload: Record<string, unknown>) {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${submitClassId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload,
    });
    return draftRes.json().assignment.id;
  }

  async function publish(id: string) {
    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/publish`,
      cookies: { pide_session: teacherCookie },
    });
  }

  async function pushAndStart(assignmentId: string, projectId: string, manifest: Record<string, unknown>) {
    await testDb.insert(projects).values({
      id: projectId,
      ownerId: studentId,
      title: "My Copy",
      goal: "physics",
      projectType: "physics",
      manifest,
      clientUpdatedAt: Date.now(),
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId },
    });
    expect(res.statusCode).toBe(201);
  }

  beforeAll(async () => {
    const student = await makeUser("submitkid@example.com");
    studentId = student.id;
    studentCookie = await signin("submitkid@example.com");

    const classRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Submit Test Class" },
    });
    submitClassId = classRes.json().class.id;
    await testDb
      .insert(classMembers)
      .values({ classId: submitClassId, userId: studentId, role: "student", status: "active" });
  });

  test("submit before start -> 400", async () => {
    const id = await createPublished({ title: "Submit Before Start" });
    await publish(id);

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Start this assignment before submitting.");
  });

  test("submit snapshots the current server-head manifest of the linked project, fingerprinted with stableStringify", async () => {
    const id = await createPublished({ title: "Snapshot Test" });
    await publish(id);
    const projectId = "p-submit-snapshot";
    const manifest = { schemaVersion: 2, marker: "server-head", nested: { b: 2, a: 1 } };
    await pushAndStart(id, projectId, manifest);

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json().submission;
    expect(body.attempt).toBe(1);
    expect(body.late).toBe(false);
    expect(body.fingerprint).toBe(fingerprintOf(manifest));
    expect(typeof body.submittedAt).toBe("number");

    const [row] = await testDb
      .select()
      .from(submissions)
      .where(eq(submissions.id, body.id));
    expect(row.manifest).toEqual(manifest);
    expect(row.fingerprint).toBe(fingerprintOf(manifest));
    expect(row.isCurrent).toBe(true);
    expect(row.submitterId).toBe(studentId);
    expect(row.creditedIds).toEqual([studentId]);
  });

  // Task 5, site 6: every credited id is notified — for individual work
  // that's just the submitter, pinned via the submission's OWN creditedIds
  // rather than a hardcoded [studentId].
  test("submit notifies every credited id with assignment.submitted, eventId pointing at the submit event", async () => {
    const id = await createPublished({ title: "Submit Notify Test" });
    await publish(id);
    const projectId = "p-submit-notify";
    await pushAndStart(id, projectId, { schemaVersion: 2, marker: "notify" });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(201);
    const submissionId = res.json().submission.id as string;

    const [row] = await testDb.select().from(submissions).where(eq(submissions.id, submissionId));
    expect(row.creditedIds).toEqual([studentId]);

    const logged = await eventsOfType("assignment.submitted");
    const myEvent = logged.find((e) => (e.payload as { submissionId?: string }).submissionId === submissionId);
    expect(myEvent).toBeDefined();

    for (const creditedId of row.creditedIds as string[]) {
      const notifs = (await notificationsFor(creditedId)).filter((n) => n.eventId === myEvent!.id);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("assignment.submitted");
      expect(notifs[0].payload).toEqual({ assignmentId: id, classId: submitClassId, attempt: row.attempt });
    }
  });

  test("resubmit flips isCurrent off the previous attempt and increments attempt", async () => {
    const id = await createPublished({ title: "Resubmit Test" });
    await publish(id);
    const projectId = "p-resubmit";
    const manifestV1 = { schemaVersion: 2, marker: "v1" };
    await pushAndStart(id, projectId, manifestV1);

    const first = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().submission.attempt).toBe(1);
    const firstId = first.json().submission.id;

    // The project's own server head moves between attempts, same as a real
    // edit-then-resubmit — submit always reads whatever is there NOW.
    const manifestV2 = { schemaVersion: 2, marker: "v2" };
    await testDb
      .update(projects)
      .set({ manifest: manifestV2 })
      .where(eq(projects.id, projectId));

    const second = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().submission.attempt).toBe(2);
    expect(second.json().submission.fingerprint).toBe(fingerprintOf(manifestV2));

    const rows = await testDb.select().from(submissions).where(eq(submissions.assignmentId, id));
    expect(rows).toHaveLength(2);
    const firstRow = rows.find((r) => r.id === firstId)!;
    const secondRow = rows.find((r) => r.id === second.json().submission.id)!;
    expect(firstRow.isCurrent).toBe(false);
    expect(secondRow.isCurrent).toBe(true);
  });

  test("two genuinely concurrent submits for the same student never produce duplicate isCurrent rows or a shared attempt number (Task 10's concurrency-test style)", async () => {
    const id = await createPublished({ title: "Concurrent Submit Test" });
    await publish(id);
    const projectId = "p-concurrent-submit";
    await pushAndStart(id, projectId, { schemaVersion: 2, marker: "concurrent" });

    const [a, b] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/api/assignments/${id}/submit`,
        cookies: { pide_session: studentCookie },
      }),
      app.inject({
        method: "POST",
        url: `/api/assignments/${id}/submit`,
        cookies: { pide_session: studentCookie },
      }),
    ]);

    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    const attempts = [a.json().submission.attempt, b.json().submission.attempt].sort((x, y) => x - y);
    expect(attempts).toEqual([1, 2]);

    const rows = await testDb.select().from(submissions).where(eq(submissions.assignmentId, id));
    expect(rows).toHaveLength(2);
    const currentRows = rows.filter((r) => r.isCurrent);
    expect(currentRows).toHaveLength(1);
    expect(currentRows[0].attempt).toBe(2);
  });

  test("submit inside the late window sets late: true", async () => {
    const now = Date.now();
    const id = await createPublished({
      title: "Late Window Submit",
      dueAt: now - 1000,
      lateUntil: now + 10 * 60 * 1000,
    });
    await publish(id);
    const projectId = "p-late-window";
    await pushAndStart(id, projectId, { schemaVersion: 2, marker: "late" });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().submission.late).toBe(true);

    const [row] = await testDb.select().from(submissions).where(eq(submissions.id, res.json().submission.id));
    expect(row.late).toBe(true);
  });

  test("after lateUntil -> 400 (\"The due date has passed.\")", async () => {
    // /start itself refuses outside open/late_window, so the assignment has
    // to be started while its dates still allow that, then moved into the
    // past — the same "closed later, was open when the student began" shape
    // a real overdue assignment has.
    const id = await createPublished({ title: "Past Late Until" });
    await publish(id);
    const projectId = "p-past-late-until";
    await pushAndStart(id, projectId, { schemaVersion: 2, marker: "too-late" });

    const now = Date.now();
    const patch = await app.inject({
      method: "PATCH",
      url: `/api/assignments/${id}`,
      cookies: { pide_session: teacherCookie },
      payload: { dueAt: now - 20 * 60 * 1000, lateUntil: now - 10 * 60 * 1000 },
    });
    expect(patch.statusCode).toBe(200);

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("The due date has passed.");
  });

  test("the receipt lands in the emails table addressed to the submitter", async () => {
    const id = await createPublished({ title: "Receipt Test" });
    await publish(id);
    const projectId = "p-receipt";
    await pushAndStart(id, projectId, { schemaVersion: 2, marker: "receipt" });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(201);
    const { fingerprint, attempt } = res.json().submission;

    const rows = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toUserId, studentId));
    const receipt = rows.find((r) => r.template === "submission-receipt" && r.subject.includes("Receipt Test"));
    expect(receipt).toBeDefined();
    expect(receipt!.toEmail).toBe("submitkid@example.com");
    expect(receipt!.bodyText).toContain(fingerprint);
    expect(receipt!.bodyText).toContain(String(attempt));
  });

  test("a student with a RETURNED, unreleased mark may resubmit even while the assignment is manually closed (fiat D§11.2)", async () => {
    const id = await createPublished({ title: "Returned Mark Reopen" });
    await publish(id);
    const projectId = "p-returned-reopen";
    await pushAndStart(id, projectId, { schemaVersion: 2, marker: "reopen" });

    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/close`,
      cookies: { pide_session: teacherCookie },
    });

    // Closed, no returned mark yet -> still refused.
    const stillClosed = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(stillClosed.statusCode).toBe(400);
    expect(stillClosed.json().error).toBe("This assignment is closed.");

    // Task 18 doesn't exist yet — a returned, unreleased mark row is seeded
    // directly, exactly as the brief calls for.
    await testDb.insert(marks).values({
      assignmentId: id,
      studentId,
      points: null,
      status: "draft",
      returned: true,
      markedBy: studentId,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().submission.attempt).toBe(1);
  });

  test("marks_released -> 400 with the SAME sentence AssignmentPage's own gateSentence uses for Start, even with a returned+unreleased mark on file", async () => {
    const id = await createPublished({ title: "Marks Released Submit Refusal" });
    await publish(id);
    const projectId = "p-marks-released-refusal";
    await pushAndStart(id, projectId, { schemaVersion: 2, marker: "marks-released" });

    // Task 18 doesn't exist yet — status flip seeded directly, same idiom
    // as the returned-mark row above.
    await testDb.update(assignments).set({ status: "marks_released" }).where(eq(assignments.id, id));

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("This assignment is closed — marks have been released.");

    // D§11.2's reopen is scoped to Closed specifically ("until marks
    // release") — a returned+unreleased mark must NOT reopen submission
    // once marks_released, even though the exact same mark row reopens a
    // manually-closed assignment in the test above.
    await testDb.insert(marks).values({
      assignmentId: id,
      studentId,
      points: null,
      status: "draft",
      returned: true,
      markedBy: studentId,
    });
    const stillRefused = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(stillRefused.statusCode).toBe(400);
    expect(stillRefused.json().error).toBe("This assignment is closed — marks have been released.");
  });

  test("a non-member 403s", async () => {
    const id = await createPublished({ title: "Non Member Submit" });
    await publish(id);

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: strangerCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Not a member of this class.");
  });
});

describe("GET /api/assignments/:id/my-submission", () => {
  let studentId: string;

  beforeAll(async () => {
    const [studentRow] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    studentId = studentRow.id;
  });

  test("no submission yet -> { submission: null }", async () => {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "No Submission Yet" },
    });
    const id = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/publish`,
      cookies: { pide_session: teacherCookie },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/my-submission`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ submission: null });
  });

  test("a current submission is returned; a superseded one is not", async () => {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "My Submission Round Trip" },
    });
    const id = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    const projectId = "p-my-submission";
    await testDb.insert(projects).values({
      id: projectId,
      ownerId: studentId,
      title: "My Copy",
      goal: "physics",
      projectType: "physics",
      manifest: { schemaVersion: 2, marker: "my-submission" },
      clientUpdatedAt: Date.now(),
    });
    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId },
    });
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(submitRes.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/my-submission`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().submission).toEqual(submitRes.json().submission);
  });

  test("a non-member 403s", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${assignmentId}/my-submission`,
      cookies: { pide_session: strangerCookie },
    });
    expect(res.statusCode).toBe(403);
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

/* ── Task 16: inbox ── */
describe("GET /api/assignments/:id/inbox / POST /api/assignments/:id/remind", () => {
  let inboxClassId: string;
  let taCookie: string;
  let submittedId: string;
  let lateId: string;
  let missingId: string;
  let inboxStudentCookie: string;

  async function createPublished(payload: Record<string, unknown>) {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${inboxClassId}/assignments`,
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

  async function seedSubmission(
    id: string,
    studentId: string,
    opts: { late?: boolean; attempt?: number } = {},
  ) {
    await testDb.insert(submissions).values({
      assignmentId: id,
      submitterId: studentId,
      submittedBy: studentId,
      creditedIds: [studentId],
      manifest: { schemaVersion: 2 },
      fingerprint: `fp-${studentId}-${opts.attempt ?? 1}`,
      late: opts.late ?? false,
      isCurrent: true,
      attempt: opts.attempt ?? 1,
    });
  }

  beforeAll(async () => {
    const classRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Inbox Test Class" },
    });
    inboxClassId = classRes.json().class.id;

    const ta = await makeUser("inboxta@example.com");
    taCookie = await signin("inboxta@example.com");
    await testDb
      .insert(classMembers)
      .values({ classId: inboxClassId, userId: ta.id, role: "ta", status: "active" });

    const submittedUser = await makeUser("inbox-submitted@example.com");
    const lateUser = await makeUser("inbox-late@example.com");
    const missingUser = await makeUser("inbox-missing@example.com");
    submittedId = submittedUser.id;
    lateId = lateUser.id;
    missingId = missingUser.id;
    inboxStudentCookie = await signin("inbox-submitted@example.com");
    await testDb.insert(classMembers).values([
      { classId: inboxClassId, userId: submittedId, role: "student", status: "active" },
      { classId: inboxClassId, userId: lateId, role: "student", status: "active" },
      { classId: inboxClassId, userId: missingId, role: "student", status: "active" },
    ]);
  });

  describe("GET /api/assignments/:id/inbox", () => {
    let viewAssignmentId: string;

    beforeAll(async () => {
      viewAssignmentId = await createPublished({ title: "Inbox View Assignment" });
      await seedSubmission(viewAssignmentId, submittedId, { late: false, attempt: 1 });
      await seedSubmission(viewAssignmentId, lateId, { late: true, attempt: 2 });
      await testDb.insert(marks).values([
        {
          assignmentId: viewAssignmentId,
          studentId: submittedId,
          points: 8,
          status: "released",
          markedBy: submittedId,
          releasedAt: new Date(),
        },
        {
          assignmentId: viewAssignmentId,
          studentId: lateId,
          points: null,
          status: "draft",
          markedBy: lateId,
        },
      ]);
    });

    test("teacher sees all three rows — submitted, late, missing — with correct late/attempt/markStatus and the assignment phase", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/assignments/${viewAssignmentId}/inbox`,
        cookies: { pide_session: teacherCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.phase).toBe("open");
      expect(body.rows).toHaveLength(3);

      const byId = Object.fromEntries(body.rows.map((r: { studentId: string }) => [r.studentId, r]));
      expect(byId[submittedId]).toMatchObject({
        state: "submitted",
        late: false,
        attempt: 1,
        markStatus: "released",
      });
      expect(typeof byId[submittedId].submittedAt).toBe("number");
      expect(byId[lateId]).toMatchObject({
        state: "submitted",
        late: true,
        attempt: 2,
        markStatus: "draft",
      });
      expect(byId[missingId]).toMatchObject({
        state: "missing",
        late: false,
        submittedAt: null,
        attempt: null,
        markStatus: "none",
      });

      // Exactly the cross-lane contract fields — no incidental leakage (e.g.
      // email, or Task 23's internal `recipients` list). `kind`/`groupId`/
      // `members` joined the contract with Task 23's group rows; an
      // individual assignment answers "student" / null / [] for them.
      expect(Object.keys(byId[missingId]).sort()).toEqual(
        [
          "kind",
          "studentId",
          "groupId",
          "name",
          "members",
          "state",
          "late",
          "submittedAt",
          "attempt",
          "markStatus",
        ].sort(),
      );
      expect(byId[missingId].kind).toBe("student");
      expect(byId[missingId].groupId).toBeNull();
      expect(byId[missingId].members).toEqual([]);
    });

    test("a TA may also view the inbox", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/assignments/${viewAssignmentId}/inbox`,
        cookies: { pide_session: taCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().rows).toHaveLength(3);
    });

    test("a student is refused — staff only", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/assignments/${viewAssignmentId}/inbox`,
        cookies: { pide_session: inboxStudentCookie },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Teachers and assistants only.");
    });

    test("a non-member is refused", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/assignments/${viewAssignmentId}/inbox`,
        cookies: { pide_session: strangerCookie },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Teachers and assistants only.");
    });

    test("no such assignment -> 404", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/assignments/00000000-0000-0000-0000-000000000000/inbox",
        cookies: { pide_session: teacherCookie },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/assignments/:id/remind", () => {
    let remindAssignmentId: string;

    beforeAll(async () => {
      remindAssignmentId = await createPublished({ title: "Remind Test Assignment" });
      // Only the submitted student has turned it in — both the late student
      // (from the OTHER assignment above; this one is fresh) and the missing
      // student are "missing" for THIS assignment.
      await seedSubmission(remindAssignmentId, submittedId, { late: false, attempt: 1 });
    });

    test("teacher: emails every missing student once, logs assignment.reminded, and replies with the count", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/assignments/${remindAssignmentId}/remind`,
        cookies: { pide_session: teacherCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ reminded: 2 });

      const sent = await testDb.select().from(emails).where(eq(emails.template, "due-reminder"));
      const mine = sent.filter((e) => e.subject.includes("Remind Test Assignment"));
      expect(mine).toHaveLength(2);
      const recipients = mine.map((e) => e.toUserId).sort();
      expect(recipients).toEqual([lateId, missingId].sort());
      expect(mine.every((e) => e.status === "dev")).toBe(true);

      const logged = await eventsOfType("assignment.reminded");
      const myEvent = logged.find((e) => (e.payload as { assignmentId?: string }).assignmentId === remindAssignmentId);
      expect(myEvent).toBeDefined();
      expect((myEvent!.payload as { remindedCount?: number }).remindedCount).toBe(2);
      expect(myEvent!.actorId).not.toBeNull();
    });

    // Task 5, site 5: every missing student (the route's own `recipients`
    // list) is notified; the already-submitted student gets nothing. A
    // fresh assignment keeps this test's event lookup unambiguous — the
    // happy-path test above already minted its own assignment.reminded row.
    test("notifies every missing student with assignment.reminded; the already-submitted student gets nothing", async () => {
      const freshId = await createPublished({ title: "Remind Notify Assignment" });
      await seedSubmission(freshId, submittedId, { late: false, attempt: 1 });

      const res = await app.inject({
        method: "POST",
        url: `/api/assignments/${freshId}/remind`,
        cookies: { pide_session: teacherCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ reminded: 2 });

      const logged = await eventsOfType("assignment.reminded");
      const myEvent = logged.find((e) => (e.payload as { assignmentId?: string }).assignmentId === freshId);
      expect(myEvent).toBeDefined();

      for (const id of [lateId, missingId]) {
        const notifs = (await notificationsFor(id)).filter((n) => n.eventId === myEvent!.id);
        expect(notifs).toHaveLength(1);
        expect(notifs[0].type).toBe("assignment.reminded");
        expect(notifs[0].payload).toEqual({ assignmentId: freshId, classId: inboxClassId });
      }

      const submittedNotifs = (await notificationsFor(submittedId)).filter((n) => n.eventId === myEvent!.id);
      expect(submittedNotifs).toHaveLength(0);
    });

    test("a TA may not remind — teacher only", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/assignments/${remindAssignmentId}/remind`,
        cookies: { pide_session: taCookie },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Teachers only for this class.");
    });

    test("a non-member is refused", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/assignments/${remindAssignmentId}/remind`,
        cookies: { pide_session: strangerCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    test("nothing missing -> reminded: 0, no emails sent", async () => {
      const fullId = await createPublished({ title: "Everyone Already Submitted" });
      await seedSubmission(fullId, submittedId, { attempt: 1 });
      await seedSubmission(fullId, lateId, { attempt: 1 });
      await seedSubmission(fullId, missingId, { attempt: 1 });

      const res = await app.inject({
        method: "POST",
        url: `/api/assignments/${fullId}/remind`,
        cookies: { pide_session: teacherCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ reminded: 0 });

      const sent = await testDb.select().from(emails).where(eq(emails.template, "due-reminder"));
      expect(sent.some((e) => e.subject.includes("Everyone Already Submitted"))).toBe(false);
    });
  });
});


/* ── Task 19: gradebook ── */
describe("GET /api/classes/:id/gradebook", () => {
  let gradebookClassId: string;
  let taCookie: string;
  let teacherIdForGradebook: string;
  let taId: string;
  // Names/titles chosen so alphabetical order and creation order DISAGREE —
  // a test that only checked one would pass even if the route sorted by the
  // wrong key.
  let zachId: string; // "Zach Wolfe" — created FIRST, sorts SECOND by name
  let amyId: string; // "Amy Chen" — created SECOND, sorts FIRST by name
  let zetaLabId: string; // "Zeta Lab" — created FIRST, sorts SECOND by title
  let alphaLabId: string; // "Alpha Lab" — created SECOND, sorts FIRST by title

  beforeAll(async () => {
    const [teacherRow] = await testDb.select().from(users).where(eq(users.email, "ateach@example.com"));
    teacherIdForGradebook = teacherRow.id;

    const classRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Gradebook Test Class" },
    });
    gradebookClassId = classRes.json().class.id;

    const zach = await makeUser("gb-zach@example.com", { name: "Zach Wolfe" });
    zachId = zach.id;
    const amy = await makeUser("gb-amy@example.com", { name: "Amy Chen" });
    amyId = amy.id;
    const ta = await makeUser("gb-ta@example.com");
    taId = ta.id;
    taCookie = await signin("gb-ta@example.com");

    await testDb.insert(classMembers).values([
      { classId: gradebookClassId, userId: zachId, role: "student", status: "active" },
      { classId: gradebookClassId, userId: amyId, role: "student", status: "active" },
      { classId: gradebookClassId, userId: taId, role: "ta", status: "active" },
    ]);

    async function makeAssignment(title: string, points: number | null) {
      const res = await app.inject({
        method: "POST",
        url: `/api/classes/${gradebookClassId}/assignments`,
        cookies: { pide_session: teacherCookie },
        payload: { title, points },
      });
      return res.json().assignment.id;
    }
    zetaLabId = await makeAssignment("Zeta Lab", 10);
    alphaLabId = await makeAssignment("Alpha Lab", null);

    // Zach turned in Zeta Lab late; it's already been marked and released.
    await testDb.insert(submissions).values({
      assignmentId: zetaLabId,
      submitterId: zachId,
      submittedBy: zachId,
      creditedIds: [zachId],
      manifest: { schemaVersion: 2, marker: "gradebook-zeta" },
      fingerprint: "gradebook-zeta-fp",
      late: true,
      isCurrent: true,
      attempt: 1,
    });
    await testDb.insert(marks).values({
      assignmentId: zetaLabId,
      studentId: zachId,
      points: 8,
      status: "released",
      markedBy: teacherIdForGradebook,
    });

    // Zach never submitted Alpha Lab (points-less), but the TA already left
    // a DRAFT mark — the grid is a preparation tool, so this must show up,
    // flagged as a draft, not be hidden or treated as "missing".
    await testDb.insert(marks).values({
      assignmentId: alphaLabId,
      studentId: zachId,
      points: 1,
      status: "draft",
      markedBy: taId,
    });

    // Amy has neither submitted nor been marked for anything — every one of
    // her cells should read as genuinely missing.
  });

  test("a student gets 403 — this route is staff-only, same idiom as GET /members", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${gradebookClassId}/gradebook`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Teachers and assistants only.");
  });

  test("a non-member 403s", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${gradebookClassId}/gradebook`,
      cookies: { pide_session: strangerCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test("teacher sees students sorted by name and assignments sorted by creation order — both disagreeing with the other's sort key", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${gradebookClassId}/gradebook`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.students).toEqual([
      { id: amyId, name: "Amy Chen" },
      { id: zachId, name: "Zach Wolfe" },
    ]);
    expect(body.assignments).toEqual([
      { id: zetaLabId, title: "Zeta Lab", points: 10 },
      { id: alphaLabId, title: "Alpha Lab", points: null },
    ]);
  });

  test("cells: a released mark, a draft mark on an unsubmitted points-less assignment, and two genuinely missing cells", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${gradebookClassId}/gradebook`,
      cookies: { pide_session: teacherCookie },
    });
    const cells = res.json().cells;
    expect(cells).toHaveLength(4);

    function cellFor(studentId: string, assignmentId: string) {
      return cells.find((c: { studentId: string; assignmentId: string }) =>
        c.studentId === studentId && c.assignmentId === assignmentId,
      );
    }

    // Zach × Zeta Lab: submitted late, released for 8/10.
    expect(cellFor(zachId, zetaLabId)).toEqual({
      studentId: zachId,
      assignmentId: zetaLabId,
      points: 8,
      released: true,
      late: true,
      missing: false,
    });

    // Zach × Alpha Lab: never submitted, but a TA draft exists — NOT missing,
    // and released stays false (drafts are visible, never silently promoted).
    expect(cellFor(zachId, alphaLabId)).toEqual({
      studentId: zachId,
      assignmentId: alphaLabId,
      points: 1,
      released: false,
      late: false,
      missing: false,
    });

    // Amy has nothing on file for either assignment — genuinely missing.
    expect(cellFor(amyId, zetaLabId)).toEqual({
      studentId: amyId,
      assignmentId: zetaLabId,
      points: null,
      released: false,
      late: false,
      missing: true,
    });
    expect(cellFor(amyId, alphaLabId)).toEqual({
      studentId: amyId,
      assignmentId: alphaLabId,
      points: null,
      released: false,
      late: false,
      missing: true,
    });
  });

  test("a TA also gets 200 and sees the same draft mark value the teacher does — the grid doesn't hide drafts from TAs", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${gradebookClassId}/gradebook`,
      cookies: { pide_session: taCookie },
    });
    expect(res.statusCode).toBe(200);
    const cells = res.json().cells;
    const draftCell = cells.find(
      (c: { studentId: string; assignmentId: string }) =>
        c.studentId === zachId && c.assignmentId === alphaLabId,
    );
    expect(draftCell.points).toBe(1);
    expect(draftCell.released).toBe(false);
  });
});


/* ── Task 20: GET /api/assignments/:id/timeline/:studentId ── */
// The History screen's teacher feed — the product's first cross-user read.
// Own describe block, own isolated class/assignment/project, same pattern
// the "submit" describe above uses (shadowed cookies rather than reaching
// for the shared top-level fixtures, so nothing here leaks into them).
describe("GET /api/assignments/:id/timeline/:studentId", () => {
  let timelineClassId: string;
  let timelineAssignmentId: string;
  let timelineStudentId: string;
  let timelineStudentCookie: string;
  let otherStudentCookie: string;
  let taCookie: string;
  let timelineProjectId: string;
  let teacherId: string;

  beforeAll(async () => {
    const [teacherRow] = await testDb.select().from(users).where(eq(users.email, "ateach@example.com"));
    teacherId = teacherRow.id;

    const student = await makeUser("timelinekid@example.com");
    timelineStudentId = student.id;
    timelineStudentCookie = await signin("timelinekid@example.com");
    const other = await makeUser("timelineother@example.com");
    otherStudentCookie = await signin("timelineother@example.com");
    const ta = await makeUser("timelineta@example.com");
    taCookie = await signin("timelineta@example.com");

    const classRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Timeline Test Class" },
    });
    timelineClassId = classRes.json().class.id;
    await testDb.insert(classMembers).values([
      { classId: timelineClassId, userId: timelineStudentId, role: "student", status: "active" },
      { classId: timelineClassId, userId: other.id, role: "student", status: "active" },
      { classId: timelineClassId, userId: ta.id, role: "ta", status: "active" },
    ]);

    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${timelineClassId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Timeline Test Assignment" },
    });
    timelineAssignmentId = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${timelineAssignmentId}/publish`,
      cookies: { pide_session: teacherCookie },
    });

    timelineProjectId = "p-timeline-student";
    await testDb.insert(projects).values({
      id: timelineProjectId,
      ownerId: timelineStudentId,
      title: "Timeline Project",
      goal: "physics",
      projectType: "physics",
      manifest: { schemaVersion: 2, marker: "head" },
      clientUpdatedAt: Date.now(),
    });
    const startRes = await app.inject({
      method: "POST",
      url: `/api/assignments/${timelineAssignmentId}/start`,
      cookies: { pide_session: timelineStudentCookie },
      payload: { projectId: timelineProjectId },
    });
    expect(startRes.statusCode).toBe(201);

    // Two checkpoints in the linked project's history (same table the
    // owner-scoped /api/projects/:id/versions route already reads).
    await testDb.insert(projectVersions).values([
      {
        ownerId: timelineStudentId,
        projectId: timelineProjectId,
        manifest: { marker: "v1" },
        clientUpdatedAt: Date.now() - 2000,
        savedBy: timelineStudentId,
        reason: "overwrite",
      },
      {
        ownerId: timelineStudentId,
        projectId: timelineProjectId,
        manifest: { marker: "v2" },
        clientUpdatedAt: Date.now() - 1000,
        savedBy: timelineStudentId,
        reason: "conflict-loser",
      },
    ]);
    // One submission marker.
    await testDb.insert(submissions).values({
      assignmentId: timelineAssignmentId,
      submitterId: timelineStudentId,
      submittedBy: timelineStudentId,
      creditedIds: [timelineStudentId],
      manifest: { marker: "head" },
      fingerprint: "timeline-fp",
      late: false,
      isCurrent: true,
      attempt: 1,
    });
  });

  test("teacher reads the student's timeline through the assignment_work link — checkpoints in plain reasons, a submission marker, event logged", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${timelineAssignmentId}/timeline/${timelineStudentId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.versions).toHaveLength(2);
    expect(body.versions.map((v: { reason: string }) => v.reason).sort()).toEqual([
      "conflict-loser",
      "overwrite",
    ]);
    for (const v of body.versions) {
      expect(v).toHaveProperty("versionId");
      expect(v).toHaveProperty("clientUpdatedAt");
      expect(typeof v.savedAt).toBe("string");
    }

    expect(body.submissions).toHaveLength(1);
    expect(body.submissions[0]).toMatchObject({ attempt: 1, late: false });
    expect(body.submissions[0]).toHaveProperty("id");
    expect(typeof body.submissions[0].createdAt).toBe("string");

    const evts = await eventsOfType("assignment.timeline_viewed");
    expect(
      evts.some(
        (e) =>
          e.actorId === teacherId &&
          (e.payload as Record<string, unknown>).assignmentId === timelineAssignmentId &&
          (e.payload as Record<string, unknown>).studentId === timelineStudentId,
      ),
    ).toBe(true);
  });

  test("a TA (not just the teacher) can read it too — staff, not teacher-only", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${timelineAssignmentId}/timeline/${timelineStudentId}`,
      cookies: { pide_session: taCookie },
    });
    expect(res.statusCode).toBe(200);
  });

  test("a student cannot read another student's timeline -> 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${timelineAssignmentId}/timeline/${timelineStudentId}`,
      cookies: { pide_session: otherStudentCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Teachers and assistants only.");
  });

  test("a non-member of the class is refused too", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${timelineAssignmentId}/timeline/${timelineStudentId}`,
      cookies: { pide_session: strangerCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test("a student who hasn't started the assignment -> 404 (no work row to resolve)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${timelineAssignmentId}/timeline/${(await makeUser("timelinenostart@example.com")).id}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(404);
  });
});


/* ── Task 17: the marking room's read ── */
// GET /api/assignments/:id/submissions/:studentId — the exam script itself
// (spec §7.2): a staff-only read of one student's current submission
// snapshot plus their full attempt history. 404 (not an empty body) when
// the student has no submission at all — same "don't pretend it exists"
// posture NO_SUCH_ASSIGNMENT uses elsewhere in this file.
describe("GET /api/assignments/:id/submissions/:studentId", () => {
  let studentId: string;
  let taCookie: string;

  beforeAll(async () => {
    const [studentRow] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    studentId = studentRow.id;

    const ta = await makeUser("marking-ta@example.com");
    await testDb.insert(classMembers).values({ classId, userId: ta.id, role: "ta", status: "active" });
    taCookie = await signin("marking-ta@example.com");
  });

  async function makePublishedAssignment(title: string) {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title },
    });
    const id = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    return id as string;
  }

  async function submitAs(assignmentId: string, projectId: string, manifest: object) {
    await testDb.insert(projects).values({
      id: projectId,
      ownerId: studentId,
      title: "Student Copy",
      goal: "physics",
      projectType: "physics",
      manifest,
      clientUpdatedAt: Date.now(),
    });
    await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId },
    });
    return app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/submit`,
      cookies: { pide_session: studentCookie },
    });
  }

  test("404 when the assignment doesn't exist", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/00000000-0000-0000-0000-000000000000/submissions/${studentId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  test("404 when the student has no submission for this assignment", async () => {
    const id = await makePublishedAssignment("No Submission For Marking");
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/submissions/${studentId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(404);
  });

  test("a student — even the submitter reading their own work — is refused: this read is staff only", async () => {
    const id = await makePublishedAssignment("Staff Only Gate");
    await submitAs(id, "p-staff-gate", {
      schemaVersion: 2,
      workspace: { xml: "<xml/>" },
      source: { python: "" },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/submissions/${studentId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test("a non-member is refused", async () => {
    const id = await makePublishedAssignment("Stranger Gate");
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/submissions/${studentId}`,
      cookies: { pide_session: strangerCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  test("a teacher reads the current snapshot: studentName, attempt, late, fingerprint, workspaceXml, python", async () => {
    const id = await makePublishedAssignment("Marking Room Snapshot");
    const manifest = {
      schemaVersion: 2,
      workspace: { xml: "<xml><block type='sim_start_block'/></xml>" },
      source: { python: "print('hi')" },
    };
    const submitRes = await submitAs(id, "p-marking-snapshot", manifest);
    expect(submitRes.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/submissions/${studentId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.submission.studentId).toBe(studentId);
    expect(body.submission.studentName).toBe("akid");
    expect(body.submission.attempt).toBe(1);
    expect(body.submission.late).toBe(false);
    expect(body.submission.fingerprint).toBe(submitRes.json().submission.fingerprint);
    expect(body.submission.workspaceXml).toBe(manifest.workspace.xml);
    expect(body.submission.python).toBe(manifest.source.python);
    expect(body.history).toHaveLength(1);
    expect(body.history[0]).toMatchObject({ attempt: 1, fingerprint: body.submission.fingerprint });
  });

  test("a TA — not only the teacher — may read the snapshot", async () => {
    const id = await makePublishedAssignment("TA Reads Too");
    await submitAs(id, "p-marking-ta", {
      schemaVersion: 2,
      workspace: { xml: "<xml>ta</xml>" },
      source: { python: "ta" },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/submissions/${studentId}`,
      cookies: { pide_session: taCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().submission.workspaceXml).toBe("<xml>ta</xml>");
  });

  test("a second attempt: the current snapshot is the LATEST attempt; history holds both, newest first", async () => {
    const id = await makePublishedAssignment("Marking Room Multi Attempt");
    const projectId = "p-marking-multi";
    const submit1 = await submitAs(id, projectId, {
      schemaVersion: 2,
      workspace: { xml: "<xml>v1</xml>" },
      source: { python: "v1" },
    });
    expect(submit1.statusCode).toBe(201);

    // Same linked project, a fresh server-head manifest — mirrors a student
    // editing and re-submitting (submit.ts reads the CURRENT project head).
    await testDb
      .update(projects)
      .set({ manifest: { schemaVersion: 2, workspace: { xml: "<xml>v2</xml>" }, source: { python: "v2" } } })
      .where(eq(projects.id, projectId));
    const submit2 = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(submit2.statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/submissions/${studentId}`,
      cookies: { pide_session: teacherCookie },
    });
    const body = res.json();
    expect(body.submission.attempt).toBe(2);
    expect(body.submission.workspaceXml).toBe("<xml>v2</xml>");
    expect(body.history.map((h: { attempt: number }) => h.attempt)).toEqual([2, 1]);
  });
});

/* ── Task 18: marks — drafts, release, return for changes ── */
// PUT (TA-or-teacher drafts) / POST release (teacher only, per-student or
// all) / POST return (TA-or-teacher). Its own dedicated class+student+TA,
// same isolation reasoning the submit/gradebook describes already use —
// fresh assignments per test avoid the marks table's (assignmentId,
// studentId) unique constraint colliding with any other describe's rows.
describe("Task 18: marks — PUT / release / return", () => {
  let markingClassId: string;
  let studentId: string;
  let taCookie: string;
  let taId: string;
  let strangerId: string;

  async function makePublishedAssignment(payload: Record<string, unknown>) {
    const draftRes = await app.inject({
      method: "POST",
      url: `/api/classes/${markingClassId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload,
    });
    const id = draftRes.json().assignment.id;
    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/publish`,
      cookies: { pide_session: teacherCookie },
    });
    return id as string;
  }

  async function submitAs(assignmentId: string, projectId: string, manifest: object = { schemaVersion: 2 }) {
    await testDb.insert(projects).values({
      id: projectId,
      ownerId: studentId,
      title: "Student Copy",
      goal: "physics",
      projectType: "physics",
      manifest,
      clientUpdatedAt: Date.now(),
    });
    await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/start`,
      cookies: { pide_session: studentCookie },
      payload: { projectId },
    });
    return app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/submit`,
      cookies: { pide_session: studentCookie },
    });
  }

  function putMark(assignmentId: string, cookie: string, body: Record<string, unknown>) {
    return app.inject({
      method: "PUT",
      url: `/api/assignments/${assignmentId}/marks/${studentId}`,
      cookies: { pide_session: cookie },
      payload: body,
    });
  }

  function returnMark(assignmentId: string, cookie: string, targetId: string, body: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/marks/${targetId}/return`,
      cookies: { pide_session: cookie },
      payload: body,
    });
  }

  function releaseMarks(assignmentId: string, cookie: string, body: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/marks/release`,
      cookies: { pide_session: cookie },
      payload: body,
    });
  }

  function markRow(assignmentId: string) {
    return testDb
      .select()
      .from(marks)
      .where(and(eq(marks.assignmentId, assignmentId), eq(marks.studentId, studentId)))
      .then((rows) => rows[0]);
  }

  function myMarkOf(assignmentId: string) {
    return app
      .inject({ method: "GET", url: `/api/assignments/${assignmentId}`, cookies: { pide_session: studentCookie } })
      .then((res) => res.json().assignment.myMark);
  }

  beforeAll(async () => {
    const [studentRow] = await testDb.select().from(users).where(eq(users.email, "akid@example.com"));
    studentId = studentRow.id;
    const [strangerRow] = await testDb.select().from(users).where(eq(users.email, "stranger@example.com"));
    strangerId = strangerRow.id;

    const classRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Marking Test Class" },
    });
    markingClassId = classRes.json().class.id;
    await testDb.insert(classMembers).values({ classId: markingClassId, userId: studentId, role: "student", status: "active" });

    const ta = await makeUser("marks-ta@example.com");
    await testDb.insert(classMembers).values({ classId: markingClassId, userId: ta.id, role: "ta", status: "active" });
    taId = ta.id;
    taCookie = await signin("marks-ta@example.com");
  });

  test("a TA saves a draft via PUT — status stays draft, markedBy is the TA, basedOnSubmissionId is the current submission", async () => {
    const id = await makePublishedAssignment({ title: "TA Draft", points: 10 });
    const submitRes = await submitAs(id, "p-ta-draft");
    expect(submitRes.statusCode).toBe(201);

    const res = await putMark(id, taCookie, { points: 7, comment: "Good start", privateNote: "watch this one" });
    expect(res.statusCode).toBe(200);
    const mark = res.json().mark;
    expect(mark.points).toBe(7);
    expect(mark.comment).toBe("Good start");
    expect(mark.privateNote).toBe("watch this one");
    expect(mark.status).toBe("draft");
    expect(mark.returned).toBe(false);
    expect(mark.basedOnSubmissionId).toBe(submitRes.json().submission.id);

    const [row] = await testDb.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.studentId, studentId)));
    expect(row.markedBy).toBe((await testDb.select().from(users).where(eq(users.email, "marks-ta@example.com")))[0].id);
  });

  test("a TA cannot release — 403, and the mark it drafted stays a draft", async () => {
    const id = await makePublishedAssignment({ title: "TA Cannot Release", points: 10 });
    await submitAs(id, "p-ta-no-release");
    await putMark(id, taCookie, { points: 5, comment: "", privateNote: "" });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/release`,
      cookies: { pide_session: taCookie },
      payload: { studentIds: [studentId] },
    });
    expect(res.statusCode).toBe(403);

    const [row] = await testDb.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.studentId, studentId)));
    expect(row.status).toBe("draft");
  });

  test("a student cannot PUT a mark — 403, staff only", async () => {
    const id = await makePublishedAssignment({ title: "Student Cannot Mark", points: 10 });
    const res = await putMark(id, studentCookie, { points: 5, comment: "", privateNote: "" });
    expect(res.statusCode).toBe(403);
  });

  test("points may not exceed the assignment's own points", async () => {
    const id = await makePublishedAssignment({ title: "Points Cap", points: 10 });
    const res = await putMark(id, teacherCookie, { points: 11, comment: "", privateNote: "" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That is more than the assignment is out of.");
  });

  test("a points-less assignment: PUT always stores points: null regardless of what's sent — existence is what marks it complete", async () => {
    const id = await makePublishedAssignment({ title: "Points Less Draft", points: null });
    const res = await putMark(id, teacherCookie, { points: 999, comment: "nice work", privateNote: "" });
    expect(res.statusCode).toBe(200);
    expect(res.json().mark.points).toBeNull();

    const [row] = await testDb.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.studentId, studentId)));
    expect(row.points).toBeNull();
  });

  test("the teacher releases one student by studentIds — status flips to released, releasedAt is set, an email lands", async () => {
    const id = await makePublishedAssignment({ title: "Teacher Releases One", points: 10 });
    await submitAs(id, "p-release-one");
    await putMark(id, teacherCookie, { points: 9, comment: "Excellent.", privateNote: "" });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/release`,
      cookies: { pide_session: teacherCookie },
      payload: { studentIds: [studentId] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.released).toEqual([studentId]);
    expect(body.refused).toEqual([]);

    const [row] = await testDb.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.studentId, studentId)));
    expect(row.status).toBe("released");
    expect(row.releasedAt).not.toBeNull();

    const emailRows = await testDb.select().from(emails).where(eq(emails.toUserId, studentId));
    const released = emailRows.find((e) => e.template === "marks-released" && e.subject.includes("Teacher Releases One"));
    expect(released).toBeDefined();
    // D§10 fiat 12's data minimisation: the release email is a NOTIFICATION,
    // not a copy of the mark. Neither the score nor the teacher's comment
    // travels by email any more (both stay on the marking screen, in the
    // bell and in the export) — so this asserts their ABSENCE, which is the
    // property the fiat actually bought.
    expect(released!.bodyText).not.toContain("9/10");
    expect(released!.bodyText).not.toContain("Excellent.");
    expect(released!.bodyText).toContain("are ready");
    expect(released!.bodyText).toContain("Sign in to Physics IDE to see them.");
    // The switch-off footer, asserted in the STORED body. templates.test.ts
    // proves the template emits it; this proves it survives the trip through
    // the mailer into the row — a property the DRIVER could break on its own.
    expect(released!.bodyText).toContain("switch these emails off");
  });

  // Task 5, site 2: recipients are exactly the release route's own
  // `releasable` list — the released student is notified, eventId pointing
  // at the marks_released ledger row.
  test("release notifies the released student with assignment.marks_released", async () => {
    const id = await makePublishedAssignment({ title: "Release Notify", points: 10 });
    await submitAs(id, "p-release-notify");
    await putMark(id, teacherCookie, { points: 9, comment: "Nice.", privateNote: "" });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/release`,
      cookies: { pide_session: teacherCookie },
      payload: { studentIds: [studentId] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().released).toEqual([studentId]);

    const logged = await eventsOfType("assignment.marks_released");
    const myEvent = logged.find((e) => (e.payload as { assignmentId?: string }).assignmentId === id);
    expect(myEvent).toBeDefined();

    const notifs = (await notificationsFor(studentId)).filter((n) => n.eventId === myEvent!.id);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("assignment.marks_released");
    expect(notifs[0].payload).toEqual({ assignmentId: id, classId: markingClassId });
  });

  test("release-all flips the assignment's stored status to marks_released and releases every draft in one go", async () => {
    const id = await makePublishedAssignment({ title: "Release All Stamps Assignment", points: 10 });
    await submitAs(id, "p-release-all");
    await putMark(id, teacherCookie, { points: 6, comment: "", privateNote: "" });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/release`,
      cookies: { pide_session: teacherCookie },
      payload: { all: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().released).toEqual([studentId]);

    const [aRow] = await testDb.select().from(assignments).where(eq(assignments.id, id));
    expect(aRow.status).toBe("marks_released");
    expect(aRow.marksReleasedAt).not.toBeNull();
  });

  test("stale-draft refusal: a draft written against a superseded attempt is refused with the D§11.3 sentence, and stays a draft", async () => {
    const id = await makePublishedAssignment({ title: "Stale Draft Refusal", points: 10 });
    const projectId = "p-stale-draft";
    const submit1 = await submitAs(id, projectId, { schemaVersion: 2, marker: "v1" });
    expect(submit1.statusCode).toBe(201);
    await putMark(id, teacherCookie, { points: 4, comment: "first pass", privateNote: "" });

    // The student resubmits — a NEWER current attempt now exists that the
    // draft above was never written against.
    await testDb.update(projects).set({ manifest: { schemaVersion: 2, marker: "v2" } }).where(eq(projects.id, projectId));
    const submit2 = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(submit2.statusCode).toBe(201);

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/release`,
      cookies: { pide_session: teacherCookie },
      payload: { studentIds: [studentId] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().released).toEqual([]);
    expect(res.json().refused).toEqual([
      { studentId, error: "This draft was written against a previous attempt — re-save it before releasing." },
    ]);

    const [row] = await testDb.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.studentId, studentId)));
    expect(row.status).toBe("draft");

    // Re-saving against the NEW current attempt clears the staleness and
    // release succeeds.
    await putMark(id, teacherCookie, { points: 4, comment: "first pass", privateNote: "" });
    const retry = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/release`,
      cookies: { pide_session: teacherCookie },
      payload: { studentIds: [studentId] },
    });
    expect(retry.json().released).toEqual([studentId]);
  });

  test("return for changes: sets returned, emails workReturned with the comment, and reopens submit-after-close (D§11.2) through the real routes", async () => {
    const id = await makePublishedAssignment({ title: "Return Reopens Submit", points: 10 });
    const projectId = "p-return-reopen";
    const submit1 = await submitAs(id, projectId, { schemaVersion: 2, marker: "reopen-v1" });
    expect(submit1.statusCode).toBe(201);

    await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/close`,
      cookies: { pide_session: teacherCookie },
    });
    const stillClosed = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(stillClosed.statusCode).toBe(400);

    const returnRes = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/${studentId}/return`,
      cookies: { pide_session: teacherCookie },
      payload: { comment: "Please redo part 2." },
    });
    expect(returnRes.statusCode).toBe(200);
    expect(returnRes.json().mark.returned).toBe(true);
    expect(returnRes.json().mark.comment).toBe("Please redo part 2.");

    const emailRows = await testDb.select().from(emails).where(eq(emails.toUserId, studentId));
    const returned = emailRows.find((e) => e.template === "work-returned" && e.subject.includes("Return Reopens Submit"));
    expect(returned).toBeDefined();
    expect(returned!.bodyText).toContain("Please redo part 2.");

    const reopened = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(reopened.statusCode).toBe(201);
    expect(reopened.json().submission.attempt).toBe(2);
  });

  // Task 5, site 3: recipients are [studentId] — the mark_returned route's
  // own target.
  test("return notifies the student with assignment.mark_returned", async () => {
    const id = await makePublishedAssignment({ title: "Return Notify", points: 10 });
    await submitAs(id, "p-return-notify");
    await putMark(id, teacherCookie, { points: 5, comment: "", privateNote: "" });

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/${studentId}/return`,
      cookies: { pide_session: teacherCookie },
      payload: { comment: "Please redo part 2." },
    });
    expect(res.statusCode).toBe(200);

    const logged = await eventsOfType("assignment.mark_returned");
    const myEvent = logged.find(
      (e) => (e.payload as { assignmentId?: string; studentId?: string }).assignmentId === id,
    );
    expect(myEvent).toBeDefined();

    const notifs = (await notificationsFor(studentId)).filter((n) => n.eventId === myEvent!.id);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("assignment.mark_returned");
    expect(notifs[0].payload).toEqual({ assignmentId: id, classId: markingClassId });
  });

  /* Final fix wave, I3. Ruling R5 turned Return into an UN-RELEASE (status
     back to draft, releasedAt cleared, submission reopened even on a closed
     assignment). The route's gate was still the plain staff one, so a TA
     could reverse a release only a teacher is allowed to make — the same
     authority inversion the release route itself is built to prevent. The
     gate now splits by what is being returned: a released row is the
     teacher's, a draft is still ordinary marking work. */
  test("a TA cannot return a RELEASED mark — that would undo a release only the teacher may make", async () => {
    const id = await makePublishedAssignment({ title: "TA Cannot Unrelease", points: 10 });
    await submitAs(id, "p-ta-unrelease");
    await putMark(id, teacherCookie, { points: 8, comment: "Good.", privateNote: "" });
    await releaseMarks(id, teacherCookie, { studentIds: [studentId] });
    expect((await markRow(id)).status).toBe("released");

    const res = await returnMark(id, taCookie, studentId, { comment: "Please redo part 2." });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Only the class teacher can return a mark that has already been released.");

    const row = await markRow(id);
    expect(row.status).toBe("released");
    expect(row.releasedAt).not.toBeNull();
    expect(row.returned).toBe(false);
  });

  test("the teacher CAN return a released mark — the un-release is theirs to make", async () => {
    const id = await makePublishedAssignment({ title: "Teacher May Unrelease", points: 10 });
    await submitAs(id, "p-teacher-unrelease");
    await putMark(id, teacherCookie, { points: 8, comment: "Good.", privateNote: "" });
    await releaseMarks(id, teacherCookie, { studentIds: [studentId] });

    const res = await returnMark(id, teacherCookie, studentId, { comment: "Please redo part 2." });
    expect(res.statusCode).toBe(200);

    const row = await markRow(id);
    expect(row.status).toBe("draft");
    expect(row.releasedAt).toBeNull();
    expect(row.returned).toBe(true);
  });

  test("a TA can still return a DRAFT mark — nothing has been released to undo", async () => {
    const id = await makePublishedAssignment({ title: "TA May Return Draft", points: 10 });
    await submitAs(id, "p-ta-return-draft");
    await putMark(id, taCookie, { points: 5, comment: "Draft.", privateNote: "" });

    const res = await returnMark(id, taCookie, studentId, { comment: "Have another go." });
    expect(res.statusCode).toBe(200);
    expect((await markRow(id)).returned).toBe(true);
  });

  test("return requires a non-empty comment", async () => {
    const id = await makePublishedAssignment({ title: "Return Needs Comment", points: 10 });
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/${studentId}/return`,
      cookies: { pide_session: teacherCookie },
      payload: { comment: "   " },
    });
    expect(res.statusCode).toBe(400);
  });

  test("404 on PUT/release/return for a non-existent assignment", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const put = await app.inject({
      method: "PUT",
      url: `/api/assignments/${fakeId}/marks/${studentId}`,
      cookies: { pide_session: teacherCookie },
      payload: { points: 1, comment: "", privateNote: "" },
    });
    expect(put.statusCode).toBe(404);
    const release = await app.inject({
      method: "POST",
      url: `/api/assignments/${fakeId}/marks/release`,
      cookies: { pide_session: teacherCookie },
      payload: { all: true },
    });
    expect(release.statusCode).toBe(404);
    const ret = await app.inject({
      method: "POST",
      url: `/api/assignments/${fakeId}/marks/${studentId}/return`,
      cookies: { pide_session: teacherCookie },
      payload: { comment: "x" },
    });
    expect(ret.statusCode).toBe(404);
  });

  test("the marking room's submission read (Task 17) now carries the staff mark shape, including privateNote", async () => {
    const id = await makePublishedAssignment({ title: "Submission Read Carries Mark", points: 10 });
    await submitAs(id, "p-submission-mark");
    await putMark(id, teacherCookie, { points: 8, comment: "solid", privateNote: "confidential note" });

    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}/submissions/${studentId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().mark).toMatchObject({
      studentId,
      points: 8,
      comment: "solid",
      privateNote: "confidential note",
      status: "draft",
    });
  });

  test("student privacy: GET /api/assignments/:id — a plain draft never surfaces as myMark, and privateNote never appears in the payload at all", async () => {
    const id = await makePublishedAssignment({ title: "Privacy Draft Not Visible", points: 10 });
    await submitAs(id, "p-privacy-draft");
    await putMark(id, teacherCookie, { points: 8, comment: "for later", privateNote: "SECRET-MARKER-XYZ" });

    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.myMark).toBeNull();
    expect(JSON.stringify(res.json())).not.toContain("SECRET-MARKER-XYZ");
  });

  test("student read: a released mark surfaces as myMark with released: true; a returned-but-unreleased mark surfaces with returned: true", async () => {
    const releasedId = await makePublishedAssignment({ title: "Released Visible To Student", points: 10 });
    await submitAs(releasedId, "p-released-visible");
    await putMark(releasedId, teacherCookie, { points: 10, comment: "Perfect.", privateNote: "" });
    await app.inject({
      method: "POST",
      url: `/api/assignments/${releasedId}/marks/release`,
      cookies: { pide_session: teacherCookie },
      payload: { studentIds: [studentId] },
    });
    const releasedRes = await app.inject({
      method: "GET",
      url: `/api/assignments/${releasedId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(releasedRes.json().assignment.myMark).toEqual({
      points: 10,
      comment: "Perfect.",
      released: true,
      returned: false,
    });

    const returnedId = await makePublishedAssignment({ title: "Returned Visible To Student", points: 10 });
    await submitAs(returnedId, "p-returned-visible");
    await app.inject({
      method: "POST",
      url: `/api/assignments/${returnedId}/marks/${studentId}/return`,
      cookies: { pide_session: teacherCookie },
      payload: { comment: "Fix the units." },
    });
    const returnedRes = await app.inject({
      method: "GET",
      url: `/api/assignments/${returnedId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(returnedRes.json().assignment.myMark).toEqual({
      points: null,
      comment: "Fix the units.",
      released: false,
      returned: true,
    });
  });

  /* ── Fix round 1: the mark state machine (controller ruling R5) ──
   * Each of the three writes settles `returned` (and, for return, `status`
   * and `releasedAt`) rather than leaving the row in a state no surface can
   * render honestly: return un-releases, a fresh draft supersedes the
   * return, and release ends the return episode. */

  test("R5: a fresh draft after a return clears returned — the resubmitted student never sees the unreleased draft", async () => {
    const id = await makePublishedAssignment({ title: "Draft Supersedes Return", points: 10 });
    await submitAs(id, "p-draft-supersedes-return", { schemaVersion: 2, marker: "supersede-v1" });

    expect((await returnMark(id, teacherCookie, studentId, { comment: "Redo the graph." })).statusCode).toBe(200);
    expect(await myMarkOf(id)).toMatchObject({ returned: true, released: false, comment: "Redo the graph." });

    // The student takes the invitation up.
    const resubmit = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(resubmit.statusCode).toBe(201);

    // The teacher starts marking the new attempt. That draft is staff-only
    // business — the return episode is over, so nothing leaks.
    const put = await putMark(id, teacherCookie, { points: 6, comment: "UNRELEASED-DRAFT-MARKER", privateNote: "" });
    expect(put.statusCode).toBe(200);
    expect(put.json().mark.returned).toBe(false);
    expect((await markRow(id)).returned).toBe(false);

    expect(await myMarkOf(id)).toBeNull();
    const studentPayload = await app.inject({
      method: "GET",
      url: `/api/assignments/${id}`,
      cookies: { pide_session: studentCookie },
    });
    expect(JSON.stringify(studentPayload.json())).not.toContain("UNRELEASED-DRAFT-MARKER");
  });

  test("R5: return after release un-releases the row — the student sees a return, not a mark, and can resubmit while closed", async () => {
    const id = await makePublishedAssignment({ title: "Return After Release", points: 10 });
    await submitAs(id, "p-return-after-release", { schemaVersion: 2, marker: "rar-v1" });
    await putMark(id, teacherCookie, { points: 9, comment: "Nearly.", privateNote: "" });
    expect((await releaseMarks(id, teacherCookie, { studentIds: [studentId] })).json().released).toEqual([studentId]);

    await app.inject({ method: "POST", url: `/api/assignments/${id}/close`, cookies: { pide_session: teacherCookie } });
    const shut = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(shut.statusCode).toBe(400);

    // D§11.2: the teacher's Return is the authority — it takes the mark back.
    const ret = await returnMark(id, teacherCookie, studentId, { comment: "Second thoughts — redo part 3." });
    expect(ret.statusCode).toBe(200);
    expect(ret.json().mark.status).toBe("draft");
    expect(ret.json().mark.releasedAt).toBeNull();
    const row = await markRow(id);
    expect(row.status).toBe("draft");
    expect(row.releasedAt).toBeNull();
    expect(row.returned).toBe(true);

    expect(await myMarkOf(id)).toEqual({
      points: 9,
      comment: "Second thoughts — redo part 3.",
      released: false,
      returned: true,
    });

    // The email's "You can resubmit" promise is now true.
    const reopened = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(reopened.statusCode).toBe(201);
  });

  test("R5: release after a return clears returned — no released-and-returned row, and a closed assignment stays shut", async () => {
    const id = await makePublishedAssignment({ title: "Release After Return", points: 10 });
    await submitAs(id, "p-release-after-return", { schemaVersion: 2, marker: "rr-v1" });
    expect((await returnMark(id, teacherCookie, studentId, { comment: "Have another go." })).statusCode).toBe(200);

    await putMark(id, teacherCookie, { points: 7, comment: "Better.", privateNote: "" });
    expect((await releaseMarks(id, teacherCookie, { studentIds: [studentId] })).json().released).toEqual([studentId]);

    const row = await markRow(id);
    expect(row.status).toBe("released");
    expect(row.returned).toBe(false);
    expect(row.releasedAt).not.toBeNull();
    expect(await myMarkOf(id)).toEqual({ points: 7, comment: "Better.", released: true, returned: false });

    // A released row can never hold the door open: submit stays shut once closed.
    await app.inject({ method: "POST", url: `/api/assignments/${id}/close`, cookies: { pide_session: teacherCookie } });
    const shut = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/submit`,
      cookies: { pide_session: studentCookie },
    });
    expect(shut.statusCode).toBe(400);
  });

  /* ── Fix round 1: the TARGET of a mark must be a student of this class ──
   * Membership was checked for the caller only, so a teacher of any class
   * could write orphan mark rows against — and email — arbitrary user ids. */

  test("PUT refuses a target who is not a member of the class — 404, and no orphan mark row", async () => {
    const id = await makePublishedAssignment({ title: "Target Not A Member", points: 10 });
    const res = await app.inject({
      method: "PUT",
      url: `/api/assignments/${id}/marks/${strangerId}`,
      cookies: { pide_session: teacherCookie },
      payload: { points: 5, comment: "", privateNote: "" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such student in this class.");
    const rows = await testDb.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.studentId, strangerId)));
    expect(rows).toHaveLength(0);
  });

  test("PUT refuses a target who is staff in the class rather than a student — 404", async () => {
    const id = await makePublishedAssignment({ title: "Target Is Staff", points: 10 });
    const res = await app.inject({
      method: "PUT",
      url: `/api/assignments/${id}/marks/${taId}`,
      cookies: { pide_session: teacherCookie },
      payload: { points: 5, comment: "", privateNote: "" },
    });
    expect(res.statusCode).toBe(404);
    const rows = await testDb.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.studentId, taId)));
    expect(rows).toHaveLength(0);
  });

  test("return refuses a target who is not a student of the class — 404, no row and no email", async () => {
    const id = await makePublishedAssignment({ title: "Return Target Not A Member", points: 10 });
    const before = await testDb.select().from(emails).where(eq(emails.toUserId, strangerId));
    const res = await returnMark(id, teacherCookie, strangerId, { comment: "you have been returned" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such student in this class.");
    const rows = await testDb.select().from(marks).where(and(eq(marks.assignmentId, id), eq(marks.studentId, strangerId)));
    expect(rows).toHaveLength(0);
    const after = await testDb.select().from(emails).where(eq(emails.toUserId, strangerId));
    expect(after).toHaveLength(before.length);
  });

  /* ── Fix round 1: release and return bodies are zod-validated from
   * @physics-ide/shared, with honest refusal sentences. */

  test("release refuses a body naming neither studentIds nor all, and one naming both — real sentences", async () => {
    const id = await makePublishedAssignment({ title: "Release Body Validated", points: 10 });
    const neither = await releaseMarks(id, teacherCookie, {});
    expect(neither.statusCode).toBe(400);
    expect(neither.json().error).toBe("Choose which students to release marks for.");

    const both = await releaseMarks(id, teacherCookie, { all: true, studentIds: [studentId] });
    expect(both.statusCode).toBe(400);
    expect(both.json().error).toBe("Release either a list of students or all of them, not both.");
  });

  test("return refuses a missing or over-long comment with a real sentence", async () => {
    const id = await makePublishedAssignment({ title: "Return Body Validated", points: 10 });
    const missing = await returnMark(id, teacherCookie, studentId, {});
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error).toBe("Say what needs to change — the student sees this.");

    const tooLong = await returnMark(id, teacherCookie, studentId, { comment: "x".repeat(5001) });
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().error).toBe("That comment is too long.");
  });

  // Task 5, site 4: recipients are the group's member ids — `markable`, the
  // same list the route's own email fan-out already uses. The group and its
  // membership are seeded directly (groups/groupMembers), the way tick.ts's
  // own suite builds a group fixture — markableGroup needs only an active
  // student membership per member, no real submission.
  test("group return notifies every group member with assignment.group_mark_returned", async () => {
    const groupmate = await makeUser("marks-groupmate@example.com");
    await testDb
      .insert(classMembers)
      .values({ classId: markingClassId, userId: groupmate.id, role: "student", status: "active" });

    const id = await makePublishedAssignment({
      title: "Group Return Notify",
      points: 10,
      submissionMode: "pair",
    });
    const [group] = await testDb.insert(groups).values({ assignmentId: id, name: "Notify Group" }).returning();
    await testDb.insert(groupMembers).values([
      { groupId: group.id, userId: studentId },
      { groupId: group.id, userId: groupmate.id },
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${id}/marks/group/${group.id}/return`,
      cookies: { pide_session: teacherCookie },
      payload: { comment: "Show your working." },
    });
    expect(res.statusCode).toBe(200);

    const logged = await eventsOfType("assignment.group_mark_returned");
    const myEvent = logged.find((e) => (e.payload as { groupId?: string }).groupId === group.id);
    expect(myEvent).toBeDefined();

    for (const memberId of [studentId, groupmate.id]) {
      const notifs = (await notificationsFor(memberId)).filter((n) => n.eventId === myEvent!.id);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].type).toBe("assignment.group_mark_returned");
      expect(notifs[0].payload).toEqual({ assignmentId: id, classId: markingClassId });
    }
  });
});
