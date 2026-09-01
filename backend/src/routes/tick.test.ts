import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq, inArray, sql } from "drizzle-orm";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import {
  users,
  classes,
  classMembers,
  assignments,
  assignmentWork,
  emails,
  events,
  groups,
  groupMembers,
  guides,
  invites,
  marks,
  projects,
  shares,
  submissions,
  notifications,
  notificationPrefs,
  settings,
} from "../db/schema.js";

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

/* `cookie` defaults to the file's own teacher. The retention blocks at the
 * bottom pass their OWN teachers: classes.ts caps class creation at 10 per
 * teacher per hour (CLASS_CREATE_CAP), and this file already spends 7 of
 * this teacher's 10 above. */
async function makeClass(name: string, cookie: string = teacherCookie): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: cookie },
    payload: { name },
  });
  return res.json().class.id;
}

async function createPublished(
  classId: string,
  payload: Record<string, unknown>,
  cookie: string = teacherCookie,
): Promise<string> {
  const draftRes = await app.inject({
    method: "POST",
    url: `/api/classes/${classId}/assignments`,
    cookies: { pide_session: cookie },
    payload,
  });
  const id = draftRes.json().assignment.id;
  await app.inject({
    method: "POST",
    url: `/api/assignments/${id}/publish`,
    cookies: { pide_session: cookie },
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

async function notificationsFor(userId: string) {
  return testDb.select().from(notifications).where(eq(notifications.userId, userId));
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("ticker-teacher@example.com", { isTeacher: true });
  teacherCookie = await signin("ticker-teacher@example.com");
});

afterAll(async () => {
  // `settings` IS in truncateAuthTables' list now (review round 1), so the
  // next file starts clean structurally. This delete stays as this file's
  // own cleanup of the key it wrote: a `retention_years` this file leaves
  // behind is a `retention_years` it is responsible for, whatever the next
  // file does first.
  await testDb.delete(settings).where(eq(settings.key, "retention_years"));
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

  test("correct secret, nothing due yet -> 200 { reminders: 0, retentionClasses: 0, emailsPruned: 0 }", async () => {
    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reminders: 0, retentionClasses: 0, emailsPruned: 0 });
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
    expect(res.json()).toEqual({ reminders: 2, retentionClasses: 0, emailsPruned: 0 });

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
    expect(res.json()).toEqual({ reminders: 0, retentionClasses: 0, emailsPruned: 0 });
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
    expect(res.json()).toEqual({ reminders: 1, retentionClasses: 0, emailsPruned: 0 });

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
    expect(res.json()).toEqual({ reminders: 2, retentionClasses: 0, emailsPruned: 0 });

    const sent = await allDueTomorrowEmails();
    const mine = emailsWithSubjectContaining(sent, "Tick Group Assignment");
    expect(mine).toHaveLength(2);
    const recipients = mine.map((e) => e.toUserId).sort();
    expect(recipients).toEqual([b1.id, b2.id].sort());
  });
});

describe("POST /api/tick — a manually closed assignment stays quiet", () => {
  test("closedAt set (status still 'published', still due tomorrow) -> no email, no dedupe row", async () => {
    const classId = await makeClass("Tick Closed Class");
    const student = await makeUser("tick-closed-student@example.com");
    await testDb.insert(classMembers).values({ classId, userId: student.id, role: "student", status: "active" });
    const assignmentId = await createPublished(classId, {
      title: "Tick Closed Assignment",
      submissionMode: "individual",
      dueAt: Date.now() + 24 * HOUR,
    });
    const closeRes = await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/close`,
      cookies: { pide_session: teacherCookie },
    });
    expect(closeRes.statusCode).toBe(200);
    // Closing never touches `status` (spec: a published assignment closes,
    // it never un-publishes) — this is exactly the row shape the fix has to
    // exclude by `closedAt`, not by `status`.
    expect(closeRes.json().assignment.phase).toBe("closed");

    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reminders: 0, retentionClasses: 0, emailsPruned: 0 });

    const sent = await allDueTomorrowEmails();
    expect(emailsWithSubjectContaining(sent, "Tick Closed Assignment")).toHaveLength(0);
    const logged = await dueReminderEvents();
    expect(logged.some((e) => (e.payload as { assignmentId?: string }).assignmentId === assignmentId)).toBe(false);
  });
});

describe("POST /api/tick — overlapping ticks send at most once", () => {
  test("two concurrent ticks across many newly-missing (assignment, student) pairs produce exactly one email each", async () => {
    const classId = await makeClass("Tick Concurrency Class");
    const students = await Promise.all(
      Array.from({ length: 5 }, (_, i) => makeUser(`tick-concurrent-student-${i}@example.com`)),
    );
    await testDb
      .insert(classMembers)
      .values(students.map((s) => ({ classId, userId: s.id, role: "student", status: "active" })));
    // Several assignments, several students, nobody submitted: many
    // (assignment, student) pairs to decide on in one tick, widening the
    // window a second, overlapping tick actually has to land in — this is
    // what makes the race observable rather than theoretical.
    const assignmentIds = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        createPublished(classId, {
          title: `Tick Concurrency Assignment ${i}`,
          submissionMode: "individual",
          dueAt: Date.now() + 24 * HOUR,
        }),
      ),
    );

    // Fired together, not sequentially — this is what Cloud Scheduler's
    // at-least-once/retry semantics (or a slow dev-interval call overlapping
    // the next) actually looks like: two ticks racing to decide "not yet
    // reminded" before either has written its dedupe rows.
    const [res1, res2] = await Promise.all([tick(config.tickSecret), tick(config.tickSecret)]);
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    const expectedPairs = assignmentIds.length * students.length;
    // Whichever call wins the advisory lock first sends every pair; the
    // other blocks, then re-reads and finds every dedupe row already
    // there. Exactly one send per pair between the two calls, however the
    // race falls — never `2 * expectedPairs`.
    expect(res1.json().reminders + res2.json().reminders).toBe(expectedPairs);

    const sent = await allDueTomorrowEmails();
    const mine = sent.filter((e) => e.subject.startsWith("Due tomorrow — Tick Concurrency Assignment"));
    expect(mine).toHaveLength(expectedPairs);
    const pairKey = (e: (typeof mine)[number]) => `${e.subject}:${e.toUserId}`;
    expect(new Set(mine.map(pairKey)).size).toBe(expectedPairs);

    const logged = await dueReminderEvents();
    const forThese = logged.filter((e) =>
      assignmentIds.includes((e.payload as { assignmentId?: string }).assignmentId ?? ""),
    );
    expect(forThese).toHaveLength(expectedPairs);
  });
});

/* Task 5, site 7: the DUE_REMINDER_SENT ledger row that IS the dedupe key
 * also carries the delivery — notify(tx, [student.id], eid, ...) beside the
 * logEvent inside the same advisory-locked transaction. classId comes from
 * the ASSIGNMENT row, not the roster helper (which returns only id/name/email). */
describe("POST /api/tick — notification fan-out (Task 5, site 7)", () => {
  test("a reminded student gets one assignment.due_reminder_sent notification, eventId pointing at the dedupe ledger row", async () => {
    const classId = await makeClass("Tick Notify Class");
    const student = await makeUser("tick-notify-student@example.com");
    await testDb.insert(classMembers).values({ classId, userId: student.id, role: "student", status: "active" });
    const assignmentId = await createPublished(classId, {
      title: "Tick Notify Assignment",
      submissionMode: "individual",
      dueAt: Date.now() + 24 * HOUR,
    });

    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);

    const logged = await dueReminderEvents();
    const ev = logged.find(
      (e) =>
        (e.payload as { assignmentId?: string; userId?: string }).assignmentId === assignmentId &&
        (e.payload as { assignmentId?: string; userId?: string }).userId === student.id,
    );
    expect(ev).toBeDefined();

    const studentNotifs = await notificationsFor(student.id);
    const mine = studentNotifs.filter((n) => n.eventId === ev!.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].type).toBe("assignment.due_reminder_sent");
    expect(mine[0].payload).toEqual({ assignmentId, classId });
  });
});

/* Task 7 (design D§4): the withPreferences seam gates due-tomorrow EMAIL
 * only — this app instance never injects a fake mailer (see `buildApp` at
 * the top of this file), so its sends run through the real dev-mailer path
 * app.ts wraps in withPreferences. The bell must never be preference-gated,
 * so the events row and the notification row are pinned to still land. */
describe("POST /api/tick — a due-tomorrow: false preference gates the email only", () => {
  test("no emails row for the student; the events row and the notification still land", async () => {
    const classId = await makeClass("Tick Prefs Class");
    const student = await makeUser("tick-prefs-student@example.com");
    await testDb.insert(classMembers).values({ classId, userId: student.id, role: "student", status: "active" });
    await testDb.insert(notificationPrefs).values({ userId: student.id, key: "due-tomorrow", enabled: false });
    const assignmentId = await createPublished(classId, {
      title: "Tick Prefs Assignment",
      submissionMode: "individual",
      dueAt: Date.now() + 24 * HOUR,
    });

    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reminders: 1, retentionClasses: 0, emailsPruned: 0 });

    const sent = await allDueTomorrowEmails();
    expect(emailsWithSubjectContaining(sent, "Tick Prefs Assignment")).toHaveLength(0);

    const logged = await dueReminderEvents();
    const ev = logged.find(
      (e) =>
        (e.payload as { assignmentId?: string; userId?: string }).assignmentId === assignmentId &&
        (e.payload as { assignmentId?: string; userId?: string }).userId === student.id,
    );
    expect(ev).toBeDefined();

    const studentNotifs = await notificationsFor(student.id);
    const mine = studentNotifs.filter((n) => n.eventId === ev!.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].type).toBe("assignment.due_reminder_sent");
  });
});

/* ══ Task 9 (design D§7): retention — the sweep, its keep/delete partition,
 *  its cap, its idempotency, and the emails log's own 180-day prune.
 *
 *  These blocks sit LAST in this file ON PURPOSE. Every tick above them runs
 *  before a single archived class or an aged email row exists, so their
 *  `{ reminders, retentionClasses, emailsPruned }` assertions stay honest
 *  zeros in the two new fields — put these blocks higher and the file's own
 *  seed data would start being swept out from under the reminder tests. ══ */

const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

type SeededClass = {
  classId: string;
  name: string;
  assignmentId: string;
  submitterId: string;
  slackerId: string;
  groupId: string;
  groupProjectId: string;
  individualProjectId: string;
};

async function seedProjectRow(ownerId: string, id: string) {
  await testDb.insert(projects).values({
    id,
    ownerId,
    title: `Project ${id}`,
    goal: "physics",
    projectType: "custom",
    manifest: { schemaVersion: 2, id, title: `Project ${id}` },
    clientUpdatedAt: Date.now(),
  });
}

/** Everything one class owns, in one helper: the rows that cascade off
 *  `classes.id` (members, invites, assignments and, transitively,
 *  submissions/marks/groups/group_members/assignment_work), the two rows
 *  that DON'T cascade — a `guides` and a `shares` row — a bell row whose
 *  only link to the class is a denormalised payload id, and the two
 *  `projects` rows D§10 fiat 11 says must SURVIVE the sweep (a group's
 *  shared workspace and one student's individual assignment work).
 *
 *  The assignment is due TOMORROW and `slacker` has not submitted: that is
 *  D§7's ordering proof in seed form — a swept class must never have a
 *  reminder queued for it, which only holds if the sweep runs BEFORE the
 *  reminder transaction. */
async function seedFullClass(label: string, teacher: { id: string; cookie: string }): Promise<SeededClass> {
  const name = `Retention ${label}`;
  const classId = await makeClass(name, teacher.cookie);
  const submitter = await makeUser(`retention-${label}-submitter@example.com`);
  const slacker = await makeUser(`retention-${label}-slacker@example.com`);
  await testDb.insert(classMembers).values([
    { classId, userId: submitter.id, role: "student", status: "active" },
    { classId, userId: slacker.id, role: "student", status: "active" },
  ]);

  const assignmentId = await createPublished(
    classId,
    {
      title: `${name} Assignment`,
      submissionMode: "individual",
      dueAt: Date.now() + 24 * HOUR,
    },
    teacher.cookie,
  );
  await seedSubmission(assignmentId, submitter.id);
  await testDb.insert(marks).values({
    assignmentId,
    studentId: submitter.id,
    points: 7,
    markedBy: teacher.id,
    status: "released",
    releasedAt: new Date(),
  });

  const groupProjectId = `retention-${label}-group-project`;
  await seedProjectRow(submitter.id, groupProjectId);
  const [group] = await testDb
    .insert(groups)
    .values({ assignmentId, name: `${name} Group`, ownerId: submitter.id, projectId: groupProjectId })
    .returning();
  await testDb.insert(groupMembers).values([
    { groupId: group.id, userId: submitter.id },
    { groupId: group.id, userId: slacker.id },
  ]);

  const individualProjectId = `retention-${label}-individual-project`;
  await seedProjectRow(slacker.id, individualProjectId);
  await testDb.insert(assignmentWork).values({
    assignmentId,
    userId: slacker.id,
    ownerId: slacker.id,
    projectId: individualProjectId,
  });

  await testDb.insert(guides).values({
    classId,
    createdBy: teacher.id,
    title: `${name} Guide`,
    body: { type: "doc", content: [] },
  });
  await testDb.insert(invites).values({
    classId,
    email: `retention-${label}-invitee@example.com`,
    role: "student",
    tokenHash: `retention-${label}-token-hash`,
    invitedBy: teacher.id,
  });
  await testDb.insert(shares).values({
    classId,
    sharerId: submitter.id,
    recipientId: slacker.id,
    sourceOwnerId: submitter.id,
    sourceProjectId: groupProjectId,
    frozenManifest: { schemaVersion: 2 },
    sourceClientUpdatedAt: Date.now(),
  });

  // A bell row for this class, hand-seeded ON TOP of the ones publish
  // already fanned out. `notifications` has NO FK to `classes` — the only
  // link is this denormalised payload id — so nothing cascades it away.
  const [ev] = await testDb
    .insert(events)
    .values({ type: "assignment.published", actorId: teacher.id, payload: { assignmentId, classId } })
    .returning();
  await testDb.insert(notifications).values([
    { userId: submitter.id, eventId: ev.id, type: "assignment.published", payload: { assignmentId, classId } },
    { userId: slacker.id, eventId: ev.id, type: "assignment.published", payload: { assignmentId, classId } },
  ]);

  return {
    classId,
    name,
    assignmentId,
    submitterId: submitter.id,
    slackerId: slacker.id,
    groupId: group.id,
    groupProjectId,
    individualProjectId,
  };
}

/** Archive through the REAL route (Task 8's clock starts there and nowhere
 *  else), then backdate `archivedAt` directly — the brief's own seeding. */
async function archiveBackdated(classId: string, cookie: string, ageMs: number) {
  const res = await app.inject({
    method: "POST",
    url: `/api/classes/${classId}/archive`,
    cookies: { pide_session: cookie },
  });
  expect(res.statusCode).toBe(200);
  await testDb
    .update(classes)
    .set({ archivedAt: new Date(Date.now() - ageMs) })
    .where(eq(classes.id, classId));
}

async function notificationsForClass(classId: string) {
  return testDb
    .select()
    .from(notifications)
    .where(sql`${notifications.payload}->>'classId' = ${classId}`);
}

describe("POST /api/tick — the retention sweep (design D§7)", () => {
  let swept: SeededClass;
  let keptUnarchived: SeededClass;
  let keptRecent: SeededClass;
  let sweptNotificationIds: number[];
  let keptRecentNotificationIds: number[];
  let sweptMemberCount: number;
  let firstTickBody: { reminders: number; retentionClasses: number; emailsPruned: number };

  beforeAll(async () => {
    // The period is a SETTING, never a constant — pinned here so the
    // partition below is measured against a known three-year clock whatever
    // an earlier test file left in `settings`.
    await setSetting(testDb, "retention_years", 3);

    const t = await makeUser("retention-teacher@example.com", { isTeacher: true });
    const teacher = { id: t.id, cookie: await signin("retention-teacher@example.com") };

    swept = await seedFullClass("swept", teacher);
    keptUnarchived = await seedFullClass("kept-unarchived", teacher);
    keptRecent = await seedFullClass("kept-recent", teacher);

    await archiveBackdated(swept.classId, teacher.cookie, 4 * YEAR);
    // Old enough by date, but NEVER archived: the `archived = true` half of
    // the predicate is the only thing sparing it.
    await testDb
      .update(classes)
      .set({ archived: false, archivedAt: new Date(Date.now() - 4 * YEAR) })
      .where(eq(classes.id, keptUnarchived.classId));
    await archiveBackdated(keptRecent.classId, teacher.cookie, 1 * YEAR);

    sweptNotificationIds = (await notificationsForClass(swept.classId)).map((n) => n.id);
    keptRecentNotificationIds = (await notificationsForClass(keptRecent.classId)).map((n) => n.id);
    const memberRows = await testDb
      .select()
      .from(classMembers)
      .where(eq(classMembers.classId, swept.classId));
    sweptMemberCount = memberRows.length;

    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    firstTickBody = res.json();
  });

  test("the response carries the honest names — { reminders, retentionClasses, emailsPruned }", () => {
    // reminders: 2 — one unsubmitted student in each SURVIVING class. The
    // swept class's own unsubmitted student contributes nothing, which is
    // exactly D§7's ordering rule: sweep first, then remind, so a reminder
    // is never queued for a class that stops existing in the same tick.
    expect(firstTickBody).toEqual({ reminders: 2, retentionClasses: 1, emailsPruned: 0 });
    expect(Object.keys(firstTickBody).sort()).toEqual(["emailsPruned", "reminders", "retentionClasses"]);
  });

  test("the class row and every class-scoped table for it are empty", async () => {
    expect(await testDb.select().from(classes).where(eq(classes.id, swept.classId))).toHaveLength(0);
    expect(
      await testDb.select().from(classMembers).where(eq(classMembers.classId, swept.classId)),
    ).toHaveLength(0);
    expect(await testDb.select().from(invites).where(eq(invites.classId, swept.classId))).toHaveLength(0);
    expect(await testDb.select().from(guides).where(eq(guides.classId, swept.classId))).toHaveLength(0);
    expect(await testDb.select().from(shares).where(eq(shares.classId, swept.classId))).toHaveLength(0);
    expect(
      await testDb.select().from(assignments).where(eq(assignments.classId, swept.classId)),
    ).toHaveLength(0);
    expect(
      await testDb.select().from(submissions).where(eq(submissions.assignmentId, swept.assignmentId)),
    ).toHaveLength(0);
    expect(await testDb.select().from(marks).where(eq(marks.assignmentId, swept.assignmentId))).toHaveLength(0);
    expect(await testDb.select().from(groups).where(eq(groups.id, swept.groupId))).toHaveLength(0);
    expect(
      await testDb.select().from(groupMembers).where(eq(groupMembers.groupId, swept.groupId)),
    ).toHaveLength(0);
    expect(
      await testDb.select().from(assignmentWork).where(eq(assignmentWork.assignmentId, swept.assignmentId)),
    ).toHaveLength(0);
  });

  test("the class's bell rows go too — `notifications` has no FK for a cascade to follow", async () => {
    expect(sweptNotificationIds.length).toBeGreaterThanOrEqual(2);
    expect(
      await testDb.select().from(notifications).where(inArray(notifications.id, sweptNotificationIds)),
    ).toHaveLength(0);
    expect(await notificationsForClass(swept.classId)).toHaveLength(0);
  });

  test("the SURVIVING classes keep their bell rows — the payload-keyed delete is scoped, not global", async () => {
    // Pinned by pre-tick ids, not a bare count: the reminder pass writes
    // NEW bell rows for the kept classes in this same tick, so a count
    // alone would stay green through a delete-every-notification bug.
    expect(keptRecentNotificationIds.length).toBeGreaterThanOrEqual(1);
    expect(
      await testDb
        .select()
        .from(notifications)
        .where(inArray(notifications.id, keptRecentNotificationIds)),
    ).toHaveLength(keptRecentNotificationIds.length);
  });

  test("NO projects row is touched — the group's shared workspace and the individual assignment project both survive (fiat 11)", async () => {
    expect(
      await testDb
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, swept.submitterId), eq(projects.id, swept.groupProjectId))),
    ).toHaveLength(1);
    expect(
      await testDb
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, swept.slackerId), eq(projects.id, swept.individualProjectId))),
    ).toHaveLength(1);
  });

  test("one class.retention_deleted event records the class, its name and its counts", async () => {
    const rows = await testDb.select().from(events).where(eq(events.type, "class.retention_deleted"));
    const mine = rows.filter((e) => (e.payload as { classId?: string }).classId === swept.classId);
    expect(mine).toHaveLength(1);
    const payload = mine[0].payload as {
      classId: string;
      name: string;
      counts: Record<string, number>;
    };
    expect(payload.name).toBe(swept.name);
    expect(payload.counts).toEqual({
      // The teacher's own membership row plus the two students.
      members: sweptMemberCount,
      invites: 1,
      assignments: 1,
      assignmentWork: 1,
      submissions: 1,
      marks: 1,
      groups: 1,
      groupMembers: 2,
      guides: 1,
      shares: 1,
      notifications: sweptNotificationIds.length,
    });
  });

  test("the events ledger is never pruned — the swept class's own history survives it", async () => {
    const created = await testDb.select().from(events).where(eq(events.type, "class.created"));
    expect(created.some((e) => (e.payload as { classId?: string }).classId === swept.classId)).toBe(true);
    const archived = await testDb.select().from(events).where(eq(events.type, "class.archived"));
    expect(archived.some((e) => (e.payload as { classId?: string }).classId === swept.classId)).toBe(true);
  });

  test("no reminder was ever queued or mailed for the class the sweep was about to delete", async () => {
    const logged = await dueReminderEvents();
    expect(
      logged.some((e) => (e.payload as { assignmentId?: string }).assignmentId === swept.assignmentId),
    ).toBe(false);
    const sent = await allDueTomorrowEmails();
    expect(emailsWithSubjectContaining(sent, "Retention swept Assignment")).toHaveLength(0);
  });

  test("an UNARCHIVED old class and a recently-archived one both survive", async () => {
    expect(await testDb.select().from(classes).where(eq(classes.id, keptUnarchived.classId))).toHaveLength(1);
    expect(await testDb.select().from(classes).where(eq(classes.id, keptRecent.classId))).toHaveLength(1);
    // And their work with them.
    expect(
      await testDb.select().from(assignments).where(eq(assignments.classId, keptRecent.classId)),
    ).toHaveLength(1);
  });

  test("idempotent: a second tick sweeps nothing and writes no second event", async () => {
    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    expect(res.json().retentionClasses).toBe(0);
    expect(await testDb.select().from(events).where(eq(events.type, "class.retention_deleted"))).toHaveLength(1);
  });
});

describe("POST /api/tick — the emails log prunes at 180 days (D§7 / fiat 7)", () => {
  let oldId: number;
  let recentId: number;

  beforeAll(async () => {
    const [oldRow] = await testDb
      .insert(emails)
      .values({
        toEmail: "retention-old@example.com",
        template: "confirm-email",
        subject: "Two hundred days old",
        bodyText: "old",
        createdAt: new Date(Date.now() - 200 * DAY),
      })
      .returning();
    const [recentRow] = await testDb
      .insert(emails)
      .values({
        toEmail: "retention-recent@example.com",
        template: "confirm-email",
        subject: "One hundred days old",
        bodyText: "recent",
        createdAt: new Date(Date.now() - 100 * DAY),
      })
      .returning();
    oldId = oldRow.id;
    recentId = recentRow.id;
  });

  test("a 200-day-old row goes, a 100-day-old row stays, and the tick reports the count", async () => {
    const res = await tick(config.tickSecret);
    expect(res.statusCode).toBe(200);
    expect(res.json().emailsPruned).toBe(1);
    expect(await testDb.select().from(emails).where(eq(emails.id, oldId))).toHaveLength(0);
    expect(await testDb.select().from(emails).where(eq(emails.id, recentId))).toHaveLength(1);
  });

  test("idempotent: the next tick prunes nothing", async () => {
    const res = await tick(config.tickSecret);
    expect(res.json().emailsPruned).toBe(0);
    expect(await testDb.select().from(emails).where(eq(emails.id, recentId))).toHaveLength(1);
  });
});

describe("POST /api/tick — the sweep is capped at five classes per tick (D§7)", () => {
  const ids: string[] = [];

  beforeAll(async () => {
    // Its own teacher: classes.ts's CLASS_CREATE_CAP is 10 per teacher per
    // hour, and seven more on the retention teacher would run it over.
    await makeUser("retention-cap-teacher@example.com", { isTeacher: true });
    const cookie = await signin("retention-cap-teacher@example.com");
    for (let i = 0; i < 7; i += 1) {
      const id = await makeClass(`Retention Cap ${i}`, cookie);
      ids.push(id);
      await archiveBackdated(id, cookie, 4 * YEAR);
    }
  });

  test("seven eligible classes: one tick sweeps five, the next sweeps the remaining two, the third sweeps none", async () => {
    const first = await tick(config.tickSecret);
    expect(first.statusCode).toBe(200);
    expect(first.json().retentionClasses).toBe(5);
    expect(await testDb.select().from(classes).where(inArray(classes.id, ids))).toHaveLength(2);

    const second = await tick(config.tickSecret);
    expect(second.json().retentionClasses).toBe(2);
    expect(await testDb.select().from(classes).where(inArray(classes.id, ids))).toHaveLength(0);

    const third = await tick(config.tickSecret);
    expect(third.json().retentionClasses).toBe(0);

    // One ledger row per class, never one per tick.
    const rows = await testDb.select().from(events).where(eq(events.type, "class.retention_deleted"));
    expect(rows.filter((e) => ids.includes((e.payload as { classId?: string }).classId ?? ""))).toHaveLength(7);
  });
});

describe("POST /api/tick — a retention failure cannot stop the reminder pass (isolate-and-log)", () => {
  test("sweep failure -> 200, retentionFailed: true, reminders still go out", async () => {
    // A fresh class with one unsubmitted student, so the reminder pass has
    // exactly one thing to prove it ran — every earlier (assignment,
    // student) pair in this file is already deduped by its own tick.
    const t = await makeUser("retention-failure-teacher@example.com", { isTeacher: true });
    const teacher = { id: t.id, cookie: await signin("retention-failure-teacher@example.com") };
    await seedFullClass("retention-failure", teacher);

    // Real fault injection at the integration level: with `settings` gone,
    // the sweep's period read throws before it can select a single class.
    // D§7's named harm is reminders stopping indefinitely behind a broken
    // sweep — this pins the isolation that prevents it.
    await testPool.query('ALTER TABLE "settings" RENAME TO "settings_broken"');
    try {
      const res = await tick(config.tickSecret);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.retentionFailed).toBe(true);
      expect(body.retentionClasses).toBe(0);
      expect(body.emailsPruned).toBe(0);
      expect(body.reminders).toBe(1);
      // The failure key appears ONLY on failure — the happy-path shape
      // test above pins its absence.
      expect(Object.keys(body).sort()).toEqual([
        "emailsPruned",
        "reminders",
        "retentionClasses",
        "retentionFailed",
      ]);
    } finally {
      await testPool.query('ALTER TABLE "settings_broken" RENAME TO "settings"');
    }
  });
});
