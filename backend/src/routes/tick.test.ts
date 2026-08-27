import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classMembers, emails, events, groups, groupMembers, submissions } from "../db/schema.js";

const app = buildApp({ db: testDb });

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

let teacherCookie: string;

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

let signinIpCounter = 0;
async function signin(email: string): Promise<string> {
  signinIpCounter += 1;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    remoteAddress: `10.97.${Math.floor(signinIpCounter / 250)}.${(signinIpCounter % 250) + 1}`,
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

async function makeClass(name: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: teacherCookie },
    payload: { name },
  });
  return res.json().class.id;
}

async function createPublished(classId: string, payload: Record<string, unknown>): Promise<string> {
  const draftRes = await app.inject({
    method: "POST",
    url: `/api/classes/${classId}/assignments`,
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

async function seedSubmission(assignmentId: string, studentId: string) {
  await testDb.insert(submissions).values({
    assignmentId,
    submitterId: studentId,
    submittedBy: studentId,
    creditedIds: [studentId],
    manifest: { schemaVersion: 2 },
    fingerprint: `fp-${studentId}-${assignmentId}`,
    isCurrent: true,
    attempt: 1,
  });
}

async function seedGroup(assignmentId: string, memberIds: string[], name: string) {
  const [group] = await testDb.insert(groups).values({ assignmentId, name }).returning();
  await testDb
    .insert(groupMembers)
    .values(memberIds.map((userId) => ({ groupId: group.id, userId })));
  return group.id;
}

async function seedGroupSubmission(assignmentId: string, groupId: string, memberIds: string[]) {
  await testDb.insert(submissions).values({
    assignmentId,
    groupId,
    submittedBy: memberIds[0],
    creditedIds: memberIds,
    manifest: { schemaVersion: 2 },
    fingerprint: `fp-group-${groupId}`,
    isCurrent: true,
    attempt: 1,
  });
}

async function tick(secret?: string) {
  return app.inject({
    method: "POST",
    url: "/api/tick",
    headers: secret !== undefined ? { "x-tick-secret": secret } : {},
  });
}

function emailsWithSubjectContaining(rows: (typeof emails.$inferSelect)[], needle: string) {
  return rows.filter((e) => e.subject.includes(needle));
}

async function allDueTomorrowEmails() {
  return testDb.select().from(emails).where(eq(emails.template, "due-tomorrow"));
}

async function dueReminderEvents() {
  return testDb.select().from(events).where(eq(events.type, "assignment.due_reminder_sent"));
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("ticker-teacher@example.com", { isTeacher: true });
  teacherCookie = await signin("ticker-teacher@example.com");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/tick — secret guard", () => {
  test("no header -> 403, no leak about why", async () => {
    const res = await tick(undefined);
    expect(res.statusCode).toBe(403);
    expect(typeof res.json().error).toBe("string");
  });

  test("wrong secret -> 403 with the exact same refusal as a missing header", async () => {
    const noHeader = await tick(undefined);
    const wrong = await tick("not-the-secret");
    expect(wrong.statusCode).toBe(403);
    expect(wrong.json()).toEqual(noHeader.json());
  });

  test("correct secret, nothing due yet -> 200 { sent: 0 }", async () => {
    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sent: 0 });
  });
});

describe("POST /api/tick — window edges (individual work)", () => {
  let classId: string;
  let studentId: string;

  beforeAll(async () => {
    classId = await makeClass("Tick Window Class");
    const student = await makeUser("tick-window-student@example.com");
    studentId = student.id;
    await testDb.insert(classMembers).values({ classId, userId: studentId, role: "student", status: "active" });
  });

  test("just inside the 23h floor and the 25h ceiling are reminded; just outside either edge are not", async () => {
    const now = Date.now();
    const insideLowerId = await createPublished(classId, {
      title: "Edge Inside Lower",
      submissionMode: "individual",
      dueAt: now + 23 * HOUR + 10 * MIN,
    });
    const outsideLowerId = await createPublished(classId, {
      title: "Edge Outside Lower",
      submissionMode: "individual",
      dueAt: now + 23 * HOUR - 10 * MIN,
    });
    const insideUpperId = await createPublished(classId, {
      title: "Edge Inside Upper",
      submissionMode: "individual",
      dueAt: now + 25 * HOUR - 10 * MIN,
    });
    const outsideUpperId = await createPublished(classId, {
      title: "Edge Outside Upper",
      submissionMode: "individual",
      dueAt: now + 25 * HOUR + 10 * MIN,
    });
    void outsideLowerId;
    void outsideUpperId;

    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sent: 2 });

    const sent = await allDueTomorrowEmails();
    expect(emailsWithSubjectContaining(sent, "Edge Inside Lower")).toHaveLength(1);
    expect(emailsWithSubjectContaining(sent, "Edge Inside Upper")).toHaveLength(1);
    expect(emailsWithSubjectContaining(sent, "Edge Outside Lower")).toHaveLength(0);
    expect(emailsWithSubjectContaining(sent, "Edge Outside Upper")).toHaveLength(0);

    const logged = await dueReminderEvents();
    const forInsideLower = logged.filter(
      (e) => (e.payload as { assignmentId?: string }).assignmentId === insideLowerId,
    );
    expect(forInsideLower).toHaveLength(1);
    expect((forInsideLower[0].payload as { userId?: string }).userId).toBe(studentId);
    const forInsideUpper = logged.filter(
      (e) => (e.payload as { assignmentId?: string }).assignmentId === insideUpperId,
    );
    expect(forInsideUpper).toHaveLength(1);
  });

  test("dedupe: a second tick sends nothing new for the same assignments", async () => {
    const before = await allDueTomorrowEmails();
    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sent: 0 });
    const after = await allDueTomorrowEmails();
    expect(after).toHaveLength(before.length);
  });
});

describe("POST /api/tick — a submitted student is skipped", () => {
  test("only the student without a current submission is reminded", async () => {
    const classId = await makeClass("Tick Submitted Class");
    const submitted = await makeUser("tick-submitted@example.com");
    const missing = await makeUser("tick-missing@example.com");
    await testDb.insert(classMembers).values([
      { classId, userId: submitted.id, role: "student", status: "active" },
      { classId, userId: missing.id, role: "student", status: "active" },
    ]);
    const assignmentId = await createPublished(classId, {
      title: "Tick Submitted Assignment",
      submissionMode: "individual",
      dueAt: Date.now() + 24 * HOUR,
    });
    await seedSubmission(assignmentId, submitted.id);

    const res = await tick(config.tickSecret);
    expect(res.json()).toEqual({ sent: 1 });

    const sent = await allDueTomorrowEmails();
    const mine = emailsWithSubjectContaining(sent, "Tick Submitted Assignment");
    expect(mine).toHaveLength(1);
    expect(mine[0].toUserId).toBe(missing.id);
  });
});

describe("POST /api/tick — a group-submission member is skipped", () => {
  test("every member of a group that already submitted is skipped; a group that hasn't submitted gets both members reminded", async () => {
    const classId = await makeClass("Tick Group Class");
    const a1 = await makeUser("tick-groupA-1@example.com");
    const a2 = await makeUser("tick-groupA-2@example.com");
    const b1 = await makeUser("tick-groupB-1@example.com");
    const b2 = await makeUser("tick-groupB-2@example.com");
    await testDb.insert(classMembers).values([
      { classId, userId: a1.id, role: "student", status: "active" },
      { classId, userId: a2.id, role: "student", status: "active" },
      { classId, userId: b1.id, role: "student", status: "active" },
      { classId, userId: b2.id, role: "student", status: "active" },
    ]);
    const assignmentId = await createPublished(classId, {
      title: "Tick Group Assignment",
      submissionMode: "pair",
      dueAt: Date.now() + 24 * HOUR,
    });
    const groupAId = await seedGroup(assignmentId, [a1.id, a2.id], "Group A");
    const groupBId = await seedGroup(assignmentId, [b1.id, b2.id], "Group B");
    await seedGroupSubmission(assignmentId, groupAId, [a1.id, a2.id]);
    void groupBId;

    const res = await tick(config.tickSecret);
    expect(res.json()).toEqual({ sent: 2 });

    const sent = await allDueTomorrowEmails();
    const mine = emailsWithSubjectContaining(sent, "Tick Group Assignment");
    expect(mine).toHaveLength(2);
    const recipients = mine.map((e) => e.toUserId).sort();
    expect(recipients).toEqual([b1.id, b2.id].sort());
  });
});
