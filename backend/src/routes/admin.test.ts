import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { BUILT_IN_RULE_SETS } from "@physics-ide/shared";
import { buildApp } from "../app.js";
import { config } from "../config.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { getSetting, setSetting } from "../db/settings.js";
import {
  users,
  emails,
  sessions,
  emailTokens,
  events,
  notifications,
  notificationPrefs,
  classes,
  classMembers,
  invites,
  guides,
  assignments,
  assignmentWork,
  projects,
  projectVersions,
  groups,
  groupMembers,
  submissions,
  marks,
  ruleSets,
  shares,
} from "../db/schema.js";

const app = buildApp({ db: testDb });
let adminCookie: string;
let adminId: string;
let studentId: string;

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  const hash = await argon2.hash("admin-password-1", { type: argon2.argon2id });
  const [root] = await testDb
    .insert(users)
    .values({
      name: "Root",
      email: "root@example.com",
      passwordHash: hash,
      role: "admin",
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    })
    .returning();
  adminId = root.id;
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

  /* Task 8's retention clock. `wouldDelete` is measured as a DELTA from a
   * baseline taken before the fixtures below exist, so this test is blind
   * to whatever archived classes earlier describe blocks in this file may
   * have left behind. */
  test("GET/PUT retention: default of 3 years, a live wouldDelete count keyed on archivedAt, and a same-transaction event", async () => {
    const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;

    const baseline = await app.inject({
      method: "GET",
      url: "/api/admin/retention",
      cookies: { pide_session: adminCookie },
    });
    expect(baseline.statusCode).toBe(200);
    expect(baseline.json().retentionYears).toBe(3);
    const baselineCount = baseline.json().wouldDelete as number;
    expect(typeof baselineCount).toBe("number");

    await testDb.insert(classes).values([
      {
        name: "Ancient Archived Class",
        joinCode: "RETOLD01",
        createdBy: adminId,
        archived: true,
        archivedAt: new Date(Date.now() - 4 * YEAR_MS),
      },
      {
        name: "Recently Archived Class",
        joinCode: "RETNEW01",
        createdBy: adminId,
        archived: true,
        archivedAt: new Date(Date.now() - 30 * DAY_MS),
      },
    ]);

    // At the default 3 years, only the 4-year-old class crosses the line.
    const at3 = await app.inject({
      method: "GET",
      url: "/api/admin/retention",
      cookies: { pide_session: adminCookie },
    });
    expect(at3.json().wouldDelete).toBe(baselineCount + 1);

    // A candidate preview (?years=10) never touches the stored setting and
    // excludes the same class at a longer horizon.
    const at10 = await app.inject({
      method: "GET",
      url: "/api/admin/retention?years=10",
      cookies: { pide_session: adminCookie },
    });
    expect(at10.json()).toMatchObject({ retentionYears: 10, wouldDelete: baselineCount });
    expect(await getSetting(testDb, "retention_years")).toBeUndefined();

    const put = await app.inject({
      method: "PUT",
      url: "/api/admin/retention",
      cookies: { pide_session: adminCookie },
      payload: { retentionYears: 1 },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toMatchObject({ ok: true, retentionYears: 1 });
    expect(await getSetting(testDb, "retention_years")).toBe(1);
    const changeEvents = await testDb.select().from(events).where(eq(events.type, "settings.retention_changed"));
    expect(
      changeEvents.some((e) => (e.payload as { retentionYears?: number }).retentionYears === 1),
    ).toBe(true);

    // At the new 1-year setting, the 30-day-old class is still too young —
    // the count is unchanged from the 3-year baseline delta.
    const afterPut = await app.inject({
      method: "GET",
      url: "/api/admin/retention",
      cookies: { pide_session: adminCookie },
    });
    expect(afterPut.json()).toMatchObject({ retentionYears: 1, wouldDelete: baselineCount + 1 });

    const bad = await app.inject({
      method: "PUT",
      url: "/api/admin/retention",
      cookies: { pide_session: adminCookie },
      payload: { retentionYears: 0 },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe("Retention period must be a whole number of years, 1–50.");

    await setSetting(testDb, "retention_years", 3);
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

  /* Final review I2 (mirrored, admin-only): `Math.max(1, 1.5)` is still
   * 1.5 — a fractional or negative `limit` used to reach Postgres as an
   * invalid bigint literal / a negative LIMIT (both 500s, verified against
   * this same test DB via the notifications.ts sibling of this bug). */
  test("a fractional or negative limit never reaches Postgres malformed", async () => {
    const badFrac = await app.inject({
      method: "GET",
      url: "/api/admin/emails?limit=1.5",
      cookies: { pide_session: adminCookie },
    });
    expect(badFrac.statusCode).toBe(200);
    expect(Array.isArray(badFrac.json().emails)).toBe(true);

    const badNeg = await app.inject({
      method: "GET",
      url: "/api/admin/emails?limit=-1",
      cookies: { pide_session: adminCookie },
    });
    expect(badNeg.statusCode).toBe(200);
    expect(Array.isArray(badNeg.json().emails)).toBe(true);
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
    // §10's second promise: "storage used" — pg_database_size(current_database())
    // always returns a positive count for a live, non-empty database.
    expect(typeof res.json().storageBytes).toBe("number");
    expect(res.json().storageBytes).toBeGreaterThan(0);
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

/* ═══════════════════════════════════════════════════════════════════════
 * Plan 8 Task 9 — POST /api/admin/users/:id/erase (design D§5)
 *
 * Erasure is an in-place PII SCRUB, never `DELETE FROM users`. The class
 * RECORD survives — memberships, submissions, marks, the events ledger —
 * and the PERSON does not: the identifying columns are overwritten, the
 * delivery state (sessions, email tokens, notifications, prefs) is
 * deleted, their own projects go, and the group's shared workspace stays.
 *
 * The world these cases run against is built by `seedStudentWorld`, which
 * is deliberately a REUSABLE helper: D§5's erase sweep and D§6's export
 * list are the SAME table read twice (plan self-review 6), so Task 10's
 * export suite seeds its student with this same function.
 * ═══════════════════════════════════════════════════════════════════════ */

/* The refusals, verbatim — file-level consts on both sides of the wire. */
const ALREADY_ERASED = "They have already been erased.";
const SELF_ERASE = "You can't erase your own account.";
const CONFIRM_MISMATCH = "The confirmation doesn't match this account's email.";
const NO_SUCH_ACCOUNT = "No such account.";
/** D§5 fiat 6: the scrub WRITES the same literal the read-time fallback
 *  resolves TO, so a scrubbed row and an unresolvable id never disagree. */
const ERASED_NAME = "Removed student";

const WORLD_PASSWORD = "a-long-password";

/* Each world signs in three or four seats and the signin door is rate
 * limited to 10 per minute PER IP — every world signin gets its own source
 * address (the shares.test.ts idiom) so the file's older 127.0.0.1 signins
 * keep their own budget. */
let worldIp = 0;
async function signinFrom(email: string, password: string = WORLD_PASSWORD) {
  worldIp += 1;
  return app.inject({
    method: "POST",
    url: "/api/auth/signin",
    remoteAddress: `10.42.${Math.floor(worldIp / 250)}.${(worldIp % 250) + 1}`,
    payload: { email, password },
  });
}

/** One person: their id, the email they signed up with, a live cookie. */
type Seat = { id: string; email: string; cookie: string };

async function makeSeat(email: string, extra: Record<string, unknown> = {}): Promise<Seat> {
  const [u] = await testDb
    .insert(users)
    .values({
      name: email.split("@")[0],
      email,
      passwordHash: await argon2.hash(WORLD_PASSWORD, { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
      ...extra,
    })
    .returning();
  const res = await signinFrom(email);
  expect(res.statusCode).toBe(200);
  return { id: u.id, email, cookie: res.cookies.find((c) => c.name === "pide_session")!.value };
}

function manifestFor(id: string, title: string) {
  return {
    schemaVersion: 2,
    id,
    title,
    goal: "physics",
    projectType: "custom",
    createdAt: 1000,
    updatedAt: 5000,
  };
}

async function pushProject(ownerId: string, id: string, title: string) {
  const manifest = manifestFor(id, title);
  await testDb.insert(projects).values({
    id,
    ownerId,
    title,
    goal: "physics",
    projectType: "custom",
    manifest,
    clientUpdatedAt: manifest.updatedAt,
  });
  return manifest;
}

/** Everything the D§5 sweep and the D§6 export name, for ONE student. */
type StudentWorld = {
  teacher: Seat;
  student: Seat;
  classmate: Seat;
  classId: string;
  assignmentId: string;
  groupId: string;
  /** Theirs alone — the scrub deletes it, and its versions follow. */
  personalProjectId: string;
  /** The group's shared workspace, owned by them — it SURVIVES (D§5 fiat 7). */
  groupProjectId: string;
  /** The classmate's copy of the accepted share, attributed to the student. */
  copyProjectId: string;
  acceptedShareId: string;
  pendingOutShareId: string;
  pendingInShareId: string;
  submissionId: string;
  markId: string;
  emailTokenId: string;
  notificationId: number;
};

/** One student with a row in EVERY bucket the sweep names: a personal
 *  project (+ a version, + an assignment_work row), a group-linked project
 *  (+ a version), a pending outgoing share, an accepted outgoing share, a
 *  pending incoming share, a submission, a mark, a class membership, a
 *  group membership, a session, an email token, a notification, a pref. */
async function seedStudentWorld(tag: string): Promise<StudentWorld> {
  const teacher = await makeSeat(`${tag}-teach@example.com`, { isTeacher: true });
  const student = await makeSeat(`${tag}-kid@example.com`);
  const classmate = await makeSeat(`${tag}-mate@example.com`);

  const [cls] = await testDb
    .insert(classes)
    .values({
      name: `${tag} Class`,
      joinCode: `${tag}-code`,
      // The share routes fail closed on the class switch — this world
      // mints real shares through the real doors, so it is on.
      peerSharing: true,
      createdBy: teacher.id,
    })
    .returning();
  await testDb.insert(classMembers).values([
    { classId: cls.id, userId: teacher.id, role: "teacher", status: "active" },
    { classId: cls.id, userId: student.id, role: "student", status: "active" },
    { classId: cls.id, userId: classmate.id, role: "student", status: "active" },
  ]);

  const [assignment] = await testDb
    .insert(assignments)
    .values({
      classId: cls.id,
      createdBy: teacher.id,
      title: `${tag} Assignment`,
      instructions: { type: "doc", content: [] },
      projectType: "physics",
      rules: BUILT_IN_RULE_SETS.open_practice,
      status: "published",
      publishedAt: new Date(),
    })
    .returning();

  const personalProjectId = `p-${tag}-personal`;
  const groupProjectId = `p-${tag}-groupwork`;
  const classmateSourceId = `p-${tag}-mate-src`;
  await pushProject(student.id, personalProjectId, "Their own work");
  await pushProject(student.id, groupProjectId, "The group's workspace");
  await pushProject(classmate.id, classmateSourceId, "A classmate's work");
  await testDb.insert(projectVersions).values([
    {
      ownerId: student.id,
      projectId: personalProjectId,
      manifest: manifestFor(personalProjectId, "Their own work"),
      clientUpdatedAt: 4000,
      savedBy: student.id,
      reason: "overwrite",
    },
    {
      ownerId: student.id,
      projectId: groupProjectId,
      manifest: manifestFor(groupProjectId, "The group's workspace"),
      clientUpdatedAt: 4000,
      savedBy: student.id,
      reason: "overwrite",
    },
  ]);

  // The `groups.projectId` row is what MARKS the workspace as the group's
  // (D§5 fiat 7) — the scrub reads exactly this to know what to spare.
  const [group] = await testDb
    .insert(groups)
    .values({
      assignmentId: assignment.id,
      name: `${tag} Pair`,
      ownerId: student.id,
      projectId: groupProjectId,
    })
    .returning();
  await testDb.insert(groupMembers).values([
    { groupId: group.id, userId: student.id },
    { groupId: group.id, userId: classmate.id },
  ]);
  await testDb.insert(assignmentWork).values({
    assignmentId: assignment.id,
    userId: student.id,
    ownerId: student.id,
    projectId: personalProjectId,
  });

  const [submission] = await testDb
    .insert(submissions)
    .values({
      assignmentId: assignment.id,
      submitterId: student.id,
      submittedBy: student.id,
      creditedIds: [student.id],
      manifest: manifestFor(personalProjectId, "Their own work"),
      fingerprint: `${tag}-fingerprint`,
      isCurrent: true,
    })
    .returning();
  const [mark] = await testDb
    .insert(marks)
    .values({
      assignmentId: assignment.id,
      studentId: student.id,
      points: 8,
      comment: "Good work",
      markedBy: teacher.id,
      status: "released",
      releasedAt: new Date(),
    })
    .returning();

  const [token] = await testDb
    .insert(emailTokens)
    .values({
      userId: student.id,
      type: "reset",
      tokenHash: `${tag}-reset-hash`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning();

  const [ev] = await testDb
    .insert(events)
    .values({ type: "assignment.marks_released", actorId: teacher.id, payload: { classId: cls.id } })
    .returning();
  const [note] = await testDb
    .insert(notifications)
    .values({
      userId: student.id,
      eventId: ev.id,
      type: "assignment.marks_released",
      payload: { classId: cls.id, assignmentId: assignment.id },
    })
    .returning();
  await testDb
    .insert(notificationPrefs)
    .values({ userId: student.id, key: "due-tomorrow", enabled: false });

  // The three shares, through the real routes: an accepted outgoing one
  // (so the classmate ends up with a real attributed copy), a still-pending
  // outgoing one, and a pending one addressed TO them.
  const acceptedRes = await app.inject({
    method: "POST",
    url: "/api/shares",
    cookies: { pide_session: student.cookie },
    payload: { classId: cls.id, recipientId: classmate.id, projectId: personalProjectId },
  });
  expect(acceptedRes.statusCode).toBe(201);
  const acceptedShareId = acceptedRes.json().share.id as string;
  const copyProjectId = `p-${tag}-copy`;
  const acceptRes = await app.inject({
    method: "POST",
    url: `/api/shares/${acceptedShareId}/accept`,
    cookies: { pide_session: classmate.cookie },
    payload: { projectId: copyProjectId },
  });
  expect(acceptRes.statusCode).toBe(200);

  const pendingOutRes = await app.inject({
    method: "POST",
    url: "/api/shares",
    cookies: { pide_session: student.cookie },
    payload: { classId: cls.id, recipientId: classmate.id, projectId: personalProjectId },
  });
  expect(pendingOutRes.statusCode).toBe(201);

  const pendingInRes = await app.inject({
    method: "POST",
    url: "/api/shares",
    cookies: { pide_session: classmate.cookie },
    payload: { classId: cls.id, recipientId: student.id, projectId: classmateSourceId },
  });
  expect(pendingInRes.statusCode).toBe(201);

  return {
    teacher,
    student,
    classmate,
    classId: cls.id,
    assignmentId: assignment.id,
    groupId: group.id,
    personalProjectId,
    groupProjectId,
    copyProjectId,
    acceptedShareId,
    pendingOutShareId: pendingOutRes.json().share.id as string,
    pendingInShareId: pendingInRes.json().share.id as string,
    submissionId: submission.id,
    markId: mark.id,
    emailTokenId: token.id,
    notificationId: note.id,
  };
}

async function erase(userId: string, confirm: unknown) {
  return app.inject({
    method: "POST",
    url: `/api/admin/users/${userId}/erase`,
    cookies: { pide_session: adminCookie },
    payload: confirm === undefined ? {} : { confirm },
  });
}

describe("erase: the refusals", () => {
  let world: StudentWorld;

  beforeAll(async () => {
    world = await seedStudentWorld("erx");
  });

  test("an unknown id -> 404, and a malformed one gets the SAME sentence", async () => {
    const unknown = await erase("00000000-0000-4000-8000-000000000000", "nobody@example.com");
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error).toBe(NO_SUCH_ACCOUNT);

    const malformed = await erase("not-a-uuid", "nobody@example.com");
    expect(malformed.statusCode).toBe(404);
    expect(malformed.json().error).toBe(NO_SUCH_ACCOUNT);
  });

  test("an admin cannot erase their own account", async () => {
    const res = await erase(adminId, "root@example.com");
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe(SELF_ERASE);
  });

  test("a wrong confirmation, and a missing one, are both the same 400", async () => {
    const wrong = await erase(world.student.id, "someone-else@example.com");
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error).toBe(CONFIRM_MISMATCH);

    const missing = await erase(world.student.id, undefined);
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error).toBe(CONFIRM_MISMATCH);

    // Refused means untouched: the row is still theirs.
    const [row] = await testDb.select().from(users).where(eq(users.id, world.student.id));
    expect(row.erasedAt).toBeNull();
    expect(row.email).toBe(world.student.email);
  });
});

describe("erase: the scrub", () => {
  let world: StudentWorld;
  let before: typeof users.$inferSelect;

  beforeAll(async () => {
    world = await seedStudentWorld("ers");
    [before] = await testDb.select().from(users).where(eq(users.id, world.student.id));
    // Two delivery-log rows, one of each shape the log actually contains.
    await testDb.insert(emails).values([
      // Keyed by id: what the log used to keep past an erasure - their real
      // address, and a body the `token=` redaction never touches.
      {
        toEmail: world.student.email,
        toUserId: world.student.id,
        template: "marks-released",
        subject: "Feedback released — ers Assignment",
        bodyText: "Score: 8/10\n\nGood work",
        status: "sent",
      },
      // Keyed by ADDRESS ONLY, `to_user_id` NULL - the exact shape both
      // invite sends write (invites.ts:79 and :183 pass only `to:`, since an
      // invitation goes out before the recipient has an account). A delete
      // matching on `toUserId` alone would leave this row, with their real
      // address in it, behind forever.
      {
        toEmail: world.student.email,
        toUserId: null,
        template: "class-invite",
        subject: "You are invited to ers Class — Physics IDE",
        bodyText: "Join here: http://x/join/invite?token=REDACTED",
        status: "sent",
      },
    ]);
    const res = await erase(world.student.id, world.student.email);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  test("the users row SURVIVES, scrubbed field by field", async () => {
    const rows = await testDb.select().from(users).where(eq(users.id, world.student.id));
    expect(rows).toHaveLength(1);
    const u = rows[0];
    expect(u.name).toBe(ERASED_NAME);
    expect(u.email).toBe(`erased+${world.student.id}@erased.invalid`);
    expect(u.passwordHash).toBe("");
    expect(u.role).toBe("user");
    expect(u.isTeacher).toBe(false);
    expect(u.emailConfirmedAt).toBeNull();
    expect(u.active).toBe(false);
    expect(u.erasedAt).not.toBeNull();
    // The two columns the design keeps: consent and account age are the
    // record of a decision, not a detail about the person.
    expect(u.consentAt.getTime()).toBe(before.consentAt.getTime());
    expect(u.createdAt.getTime()).toBe(before.createdAt.getTime());
  });

  test("the email log is GONE for them: no address, and no body carrying their marks or their teacher's words", async () => {
    // `emails.toUserId` has no FK, so nothing cascades — the erase
    // transaction deletes these explicitly or they survive forever. This is
    // the half seam-level suppression cannot reach: suppression stops
    // FUTURE sends, it does not unwrite what was already logged.
    const mails = await testDb.select().from(emails).where(eq(emails.toUserId, world.student.id));
    expect(mails).toHaveLength(0);
    // The by-address arm is the load-bearing one: invite mail carries no
    // `toUserId` at all, so this is the assertion that fails if the erase
    // matches on the id alone. D§5's promise is that a real address and a
    // real body do not survive an erasure - not that most of them don't.
    const byAddress = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toEmail, world.student.email));
    expect(byAddress).toHaveLength(0);
  });

  test("delivery state is GONE: sessions, email tokens, notifications, prefs", async () => {
    expect(
      await testDb.select().from(sessions).where(eq(sessions.userId, world.student.id)),
    ).toHaveLength(0);
    expect(
      await testDb.select().from(emailTokens).where(eq(emailTokens.userId, world.student.id)),
    ).toHaveLength(0);
    expect(
      await testDb.select().from(notifications).where(eq(notifications.userId, world.student.id)),
    ).toHaveLength(0);
    expect(
      await testDb
        .select()
        .from(notificationPrefs)
        .where(eq(notificationPrefs.userId, world.student.id)),
    ).toHaveLength(0);
  });

  test("the class RECORD is kept: memberships, submission, mark, events", async () => {
    // D§5: the marking inbox and the gradebook build their rosters from
    // membership — deleting these rows would make the surviving marks
    // invisible, which is §11's promise broken at the view level.
    expect(
      await testDb.select().from(classMembers).where(eq(classMembers.userId, world.student.id)),
    ).toHaveLength(1);
    expect(
      await testDb.select().from(groupMembers).where(eq(groupMembers.userId, world.student.id)),
    ).toHaveLength(1);
    const submissionRows = await testDb
      .select()
      .from(submissions)
      .where(eq(submissions.id, world.submissionId));
    expect(submissionRows).toHaveLength(1);
    expect(submissionRows[0].submitterId).toBe(world.student.id);
    const markRows = await testDb.select().from(marks).where(eq(marks.id, world.markId));
    expect(markRows).toHaveLength(1);
    expect(markRows[0].points).toBe(8);
    // The append-only ledger is never touched: their own actions stay.
    const theirEvents = await testDb.select().from(events).where(eq(events.actorId, world.student.id));
    expect(theirEvents.length).toBeGreaterThan(0);
  });

  test("their own project is GONE with its versions; the GROUP's workspace survives", async () => {
    const personal = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, world.student.id), eq(projects.id, world.personalProjectId)));
    expect(personal).toHaveLength(0);
    expect(
      await testDb
        .select()
        .from(projectVersions)
        .where(
          and(
            eq(projectVersions.ownerId, world.student.id),
            eq(projectVersions.projectId, world.personalProjectId),
          ),
        ),
    ).toHaveLength(0);
    // The assignment_work row rode the project's composite cascade.
    expect(
      await testDb
        .select()
        .from(assignmentWork)
        .where(eq(assignmentWork.projectId, world.personalProjectId)),
    ).toHaveLength(0);

    // D§5 fiat 7: erasing one member must not destroy the group's work.
    const groupWork = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, world.student.id), eq(projects.id, world.groupProjectId)));
    expect(groupWork).toHaveLength(1);
    expect(
      await testDb
        .select()
        .from(projectVersions)
        .where(
          and(
            eq(projectVersions.ownerId, world.student.id),
            eq(projectVersions.projectId, world.groupProjectId),
          ),
        ),
    ).toHaveLength(1);
    const groupRows = await testDb.select().from(groups).where(eq(groups.id, world.groupId));
    expect(groupRows[0].projectId).toBe(world.groupProjectId);
  });

  test("shares: pending rows on both sides GO, the accepted row stays with an emptied manifest", async () => {
    expect(
      await testDb.select().from(shares).where(eq(shares.id, world.pendingOutShareId)),
    ).toHaveLength(0);
    expect(
      await testDb.select().from(shares).where(eq(shares.id, world.pendingInShareId)),
    ).toHaveLength(0);

    const accepted = await testDb.select().from(shares).where(eq(shares.id, world.acceptedShareId));
    expect(accepted).toHaveLength(1);
    expect(accepted[0].status).toBe("accepted");
    expect(accepted[0].frozenManifest).toEqual({});
    // D§8's promise: the recipient's copy is their OWN project, untouched.
    const copy = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, world.classmate.id), eq(projects.id, world.copyProjectId)));
    expect(copy).toHaveLength(1);
  });

  test("one account.erased event, actored by the admin, naming only the subject", async () => {
    const logged = await testDb.select().from(events).where(eq(events.type, "account.erased"));
    const mine = logged.filter((e) => (e.payload as { subject?: string }).subject === world.student.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].actorId).toBe(adminId);
    expect(mine[0].payload).toEqual({ subject: world.student.id });
  });

  test("the picker drops them; the record-facing gradebook keeps them, marks intact", async () => {
    // Person-facing: you cannot hand work to someone who is gone.
    const roster = await app.inject({
      method: "GET",
      url: `/api/shares/roster/${world.classId}`,
      cookies: { pide_session: world.classmate.cookie },
    });
    expect(roster.statusCode).toBe(200);
    const members = roster.json().members as Array<{ userId: string }>;
    expect(members.some((m) => m.userId === world.student.id)).toBe(false);
    expect(members.some((m) => m.userId === world.teacher.id)).toBe(true);

    // Record-facing: the same membership row still renders the row §11
    // keeps — now under the scrubbed name, with the mark still on it.
    const gradebook = await app.inject({
      method: "GET",
      url: `/api/classes/${world.classId}/gradebook`,
      cookies: { pide_session: world.teacher.cookie },
    });
    expect(gradebook.statusCode).toBe(200);
    const body = gradebook.json() as {
      students: Array<{ id: string; name: string }>;
      cells: Array<{ studentId: string; assignmentId: string; points: number | null; released: boolean }>;
    };
    const studentRow = body.students.find((s) => s.id === world.student.id);
    expect(studentRow).toBeDefined();
    expect(studentRow!.name).toBe(ERASED_NAME);
    const cell = body.cells.find(
      (c) => c.studentId === world.student.id && c.assignmentId === world.assignmentId,
    );
    expect(cell).toBeDefined();
    expect(cell!.points).toBe(8);
    expect(cell!.released).toBe(true);
  });

  test("the attribution resolves live through the scrubbed row: Removed student", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/shares/attributions",
      cookies: { pide_session: world.classmate.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().attributions[world.copyProjectId]).toEqual({
      sharerId: world.student.id,
      shareId: world.acceptedShareId,
      sharerName: ERASED_NAME,
    });
  });

  test("GET /api/admin/users carries erased: true for them and false for everyone else", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json().users as Array<{ id: string; name: string; erased: boolean }>;
    const scrubbed = rows.find((r) => r.id === world.student.id);
    expect(scrubbed).toBeDefined();
    expect(scrubbed!.erased).toBe(true);
    expect(scrubbed!.name).toBe(ERASED_NAME);
    expect(rows.find((r) => r.id === world.classmate.id)!.erased).toBe(false);
  });

  test("erasing twice: the naive repeat is a mismatch, and naming the scrubbed email is 409", async () => {
    // The guard order is 404 -> self -> confirm -> already (D§5): you can
    // never act on an account without naming the email it carries NOW.
    const repeat = await erase(world.student.id, world.student.email);
    expect(repeat.statusCode).toBe(400);
    expect(repeat.json().error).toBe(CONFIRM_MISMATCH);

    const named = await erase(world.student.id, `erased+${world.student.id}@erased.invalid`);
    expect(named.statusCode).toBe(409);
    expect(named.json().error).toBe(ALREADY_ERASED);
  });
});

describe("erase: a teacher takes the same path", () => {
  let teacher: Seat;
  let classId: string;
  let assignmentId: string;
  let guideId: string;
  let inviteId: string;

  beforeAll(async () => {
    teacher = await makeSeat("ert-teach@example.com", { isTeacher: true });
    const [cls] = await testDb
      .insert(classes)
      .values({ name: "Erased Teacher Class", joinCode: "ert-code", createdBy: teacher.id })
      .returning();
    classId = cls.id;
    await testDb
      .insert(classMembers)
      .values({ classId, userId: teacher.id, role: "teacher", status: "active" });
    const [a] = await testDb
      .insert(assignments)
      .values({
        classId,
        createdBy: teacher.id,
        title: "Theirs",
        instructions: { type: "doc", content: [] },
        projectType: "physics",
        rules: BUILT_IN_RULE_SETS.open_practice,
      })
      .returning();
    assignmentId = a.id;
    const [g] = await testDb
      .insert(guides)
      .values({ classId, createdBy: teacher.id, title: "A guide", body: { type: "doc", content: [] } })
      .returning();
    guideId = g.id;
    const [inv] = await testDb
      .insert(invites)
      .values({
        classId,
        email: "someone@example.com",
        role: "student",
        tokenHash: "ert-invite-hash",
        invitedBy: teacher.id,
      })
      .returning();
    inviteId = inv.id;
  });

  test("the scrub succeeds where a hard delete would hit four bare FKs", async () => {
    const res = await erase(teacher.id, teacher.email);
    expect(res.statusCode).toBe(200);

    // The four `no action` FKs a `DELETE FROM users` would fail on.
    const classRows = await testDb.select().from(classes).where(eq(classes.id, classId));
    expect(classRows).toHaveLength(1);
    expect(classRows[0].createdBy).toBe(teacher.id);
    expect(
      await testDb.select().from(assignments).where(eq(assignments.id, assignmentId)),
    ).toHaveLength(1);
    expect(await testDb.select().from(guides).where(eq(guides.id, guideId))).toHaveLength(1);
    expect(await testDb.select().from(invites).where(eq(invites.id, inviteId))).toHaveLength(1);

    // The teacher hat comes off with everything else (D§5: one mechanism).
    const [u] = await testDb.select().from(users).where(eq(users.id, teacher.id));
    expect(u.isTeacher).toBe(false);
    expect(u.name).toBe(ERASED_NAME);

    // Their class still names them, through the surviving scrubbed row.
    const adminClasses = await app.inject({
      method: "GET",
      url: "/api/admin/classes",
      cookies: { pide_session: adminCookie },
    });
    const listed = (adminClasses.json().classes as Array<{ name: string; teachers: string[] }>).find(
      (c) => c.name === "Erased Teacher Class",
    );
    expect(listed!.teachers).toEqual([ERASED_NAME]);
  });

  test("every door is shut behind them: the live session, the old email, the sentinel", async () => {
    // 1. The session they were holding — destroyed inside the scrub, and
    //    `active=false` would refuse it even if one survived.
    const stale = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: teacher.cookie },
    });
    expect(stale.statusCode).toBe(401);
    expect(stale.json().error).toBe("Not signed in.");

    // 2. The credentials they used to have: the email they name no longer
    //    belongs to any row, so the door is the ordinary wrong-credentials
    //    one. (The brief anticipated the deactivated-door 403 here; the
    //    scrub rewrites the email, so signin never finds the row to get
    //    that far. Refused either way — asserted as it actually behaves.)
    const oldEmail = await signinFrom("ert-teach@example.com");
    expect(oldEmail.statusCode).toBe(401);
    expect(oldEmail.json().error).toBe("Invalid email or password.");

    // 3. The sentinel address is public arithmetic — any classmate holds
    //    the id. An empty passwordHash must refuse, never throw a 500.
    const sentinel = await signinFrom(`erased+${teacher.id}@erased.invalid`);
    expect(sentinel.statusCode).toBe(401);
    expect(sentinel.json().error).toBe("Invalid email or password.");

    // 4. And the reset door stays shut: `forgot` only mints for an ACTIVE
    //    account, so a scrubbed one can never be handed a new password.
    const forgot = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      remoteAddress: "10.43.0.1",
      payload: { email: `erased+${teacher.id}@erased.invalid` },
    });
    expect(forgot.statusCode).toBe(200);
    expect(
      await testDb.select().from(emailTokens).where(eq(emailTokens.userId, teacher.id)),
    ).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * Plan 8 Task 9 review (binding) — two more doors close behind an erased
 * account: reactivate and send-reset must both refuse a scrubbed row with
 * 409 ALREADY_ERASED, the same sentence `erase` itself gives on a repeat.
 * Without this, an erased shell stays admin-revivable even though D§5
 * suppresses the People-tab buttons that would normally guard it.
 * ═══════════════════════════════════════════════════════════════════════ */
describe("two more doors close behind an erased account", () => {
  let world: StudentWorld;

  beforeAll(async () => {
    world = await seedStudentWorld("erg");
    const res = await erase(world.student.id, world.student.email);
    expect(res.statusCode).toBe(200);
  });

  test("reactivate refuses an erased account with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${world.student.id}/reactivate`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe(ALREADY_ERASED);
  });

  test("send-reset refuses an erased account with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${world.student.id}/send-reset`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe(ALREADY_ERASED);
  });
});

describe("a merely-deactivated account still reactivates (no regression)", () => {
  test("reactivate succeeds for a deactivated, NOT erased, account", async () => {
    const seat = await makeSeat("erg-plain-deactivated@example.com");
    const deactivate = await app.inject({
      method: "POST",
      url: `/api/admin/users/${seat.id}/deactivate`,
      cookies: { pide_session: adminCookie },
    });
    expect(deactivate.statusCode).toBe(200);

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${seat.id}/reactivate`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    const [row] = await testDb.select().from(users).where(eq(users.id, seat.id));
    expect(row.active).toBe(true);
    expect(row.erasedAt).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * Final review finding I3 — an erased student must leave the ACTIVE
 * reminder surfaces (the daily tick, the teacher's Remind button) while
 * staying on the record-facing gradebook. `seedStudentWorld`'s own
 * assignment is already submitted, so it can never surface in a "missing"
 * list — a second, deliberately UNSUBMITTED assignment is added here to
 * exercise the actual bug (nobody can sign into a scrubbed account, so it
 * must never be reminded, notified, or emailed about one).
 * ═══════════════════════════════════════════════════════════════════════ */
describe("erase: an erased student leaves the reminder surfaces, not the gradebook", () => {
  let world: StudentWorld;
  let unsubmittedAssignmentId: string;
  const HOUR = 60 * 60 * 1000;

  beforeAll(async () => {
    world = await seedStudentWorld("erm");

    const draft = await app.inject({
      method: "POST",
      url: `/api/classes/${world.classId}/assignments`,
      cookies: { pide_session: world.teacher.cookie },
      payload: {
        title: "erm Reminder Assignment",
        submissionMode: "individual",
        dueAt: Date.now() + 24 * HOUR,
      },
    });
    expect(draft.statusCode).toBe(201);
    unsubmittedAssignmentId = draft.json().assignment.id;
    const published = await app.inject({
      method: "POST",
      url: `/api/assignments/${unsubmittedAssignmentId}/publish`,
      cookies: { pide_session: world.teacher.cookie },
    });
    expect(published.statusCode).toBe(200);

    const res = await erase(world.student.id, world.student.email);
    expect(res.statusCode).toBe(200);
  });

  test("the daily tick reminds the non-erased classmate but sends nothing — no event, no bell row, no email — for the erased student", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/tick",
      headers: { "x-tick-secret": config.tickSecret },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reminders).toBe(1); // the classmate only

    const logged = await testDb.select().from(events).where(eq(events.type, "assignment.due_reminder_sent"));
    const forThisAssignment = logged.filter(
      (e) => (e.payload as { assignmentId?: string }).assignmentId === unsubmittedAssignmentId,
    );
    expect(forThisAssignment).toHaveLength(1);
    expect((forThisAssignment[0].payload as { userId?: string }).userId).toBe(world.classmate.id);

    const studentNotifs = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, world.student.id));
    expect(studentNotifs).toHaveLength(0);

    const studentMails = await testDb.select().from(emails).where(eq(emails.toUserId, world.student.id));
    expect(studentMails).toHaveLength(0);
  });

  test("the teacher's Remind button excludes the erased student from the count and sends them no notification", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${unsubmittedAssignmentId}/remind`,
      cookies: { pide_session: world.teacher.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reminded).toBe(1); // the classmate only

    const studentNotifs = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, world.student.id));
    expect(studentNotifs).toHaveLength(0);

    const classmateNotifs = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.userId, world.classmate.id));
    expect(classmateNotifs.some((n) => n.type === "assignment.reminded")).toBe(true);
  });

  test("the gradebook still lists the erased student as Removed student, with their (unrelated, already-released) mark intact — the D§5 guarantee holds under this scenario too", async () => {
    const gradebook = await app.inject({
      method: "GET",
      url: `/api/classes/${world.classId}/gradebook`,
      cookies: { pide_session: world.teacher.cookie },
    });
    expect(gradebook.statusCode).toBe(200);
    const body = gradebook.json() as {
      students: Array<{ id: string; name: string }>;
      cells: Array<{ studentId: string; assignmentId: string; points: number | null; released: boolean }>;
    };
    const studentRow = body.students.find((s) => s.id === world.student.id);
    expect(studentRow).toBeDefined();
    expect(studentRow!.name).toBe(ERASED_NAME);
    const cell = body.cells.find(
      (c) => c.studentId === world.student.id && c.assignmentId === world.assignmentId,
    );
    expect(cell).toBeDefined();
    expect(cell!.points).toBe(8);
    expect(cell!.released).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * Plan 8 Task 10 — GET /api/admin/users/:id/export (design D§6)
 *
 * An ordinary JSON body: everything theirs, their own audit trail and
 * nobody else's. D§5's erase sweep and D§6's export list are the same
 * table read twice (plan self-review 6), so this world is built with the
 * SAME `seedStudentWorld` helper Task 9 wrote — extended in-line, here,
 * with the five buckets the erasure sweep never touches (a student
 * authoring a class/assignment/guide/invite/rule-set is unrealistic in
 * the product, but the export's WHERE clauses are generic `createdBy =
 * :id` / `ownerId = :id`, and Task 9's own "a teacher takes the same
 * path" block already seeds those four tables by hand for the same
 * reason) and the one event D§6 says must NEVER come back: a teacher's
 * `assignment.timeline_viewed`, fired through the REAL route so the
 * student genuinely is the subject of someone else's action.
 * ═══════════════════════════════════════════════════════════════════════ */
const EXPORT_NOTE =
  "This export contains your account, your work, and the actions you took. " +
  "It does not contain other people's actions — including a teacher's record of viewing your work.";

type ExportBody = {
  note: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isTeacher: boolean;
    emailConfirmed: boolean;
    createdAt: string;
    consentAt: string;
    passwordHash?: string;
  };
  classMemberships: Array<{ userId: string }>;
  projects: Array<{ id: string; manifest: unknown }>;
  projectVersions: Array<Record<string, unknown>>;
  assignmentWork: Array<{ userId: string | null; groupId: string | null }>;
  submissions: Array<{ id: string; submitterId: string | null; groupId: string | null }>;
  marksReceived: Array<{
    id: string;
    assignmentId: string;
    points: number | null;
    comment: string;
    released: boolean;
    returned: boolean;
    privateNote?: string;
    studentId?: string;
  }>;
  groups: Array<{ id: string; ownerId: string | null }>;
  groupMemberships: Array<{ userId: string }>;
  ruleSets: Array<{ id: string; ownerId: string }>;
  sharesSent: Array<{ id: string; sharerId: string }>;
  sharesReceived: Array<{ id: string; recipientId: string }>;
  authoredClasses: Array<{ id: string; createdBy: string }>;
  authoredAssignments: Array<{ id: string; createdBy: string }>;
  authoredGuides: Array<{ id: string; createdBy: string }>;
  sentInvites: Array<{ id: string; invitedBy: string }>;
  emails: Array<{ toUserId: string | null; template: string }>;
  events: Array<{ type: string; actorId: string | null; payload: unknown }>;
};

const EXPORT_KEYS = [
  "note",
  "user",
  "classMemberships",
  "projects",
  "projectVersions",
  "assignmentWork",
  "submissions",
  "marksReceived",
  "groups",
  "groupMemberships",
  "ruleSets",
  "sharesSent",
  "sharesReceived",
  "authoredClasses",
  "authoredAssignments",
  "authoredGuides",
  "sentInvites",
  "emails",
  "events",
];

async function exportOf(userId: string) {
  return app.inject({
    method: "GET",
    url: `/api/admin/users/${userId}/export`,
    cookies: { pide_session: adminCookie },
  });
}

describe("export", () => {
  let world: StudentWorld;
  let draftAssignmentId: string;
  let group2Id: string;
  let groupSubmissionId: string;
  let lateJoiner: Seat;

  beforeAll(async () => {
    world = await seedStudentWorld("exp");

    // The five buckets seedStudentWorld's erasure-focused world doesn't
    // populate for a STUDENT — hand-seeded the same way Task 9's "a
    // teacher takes the same path" block seeds them for a teacher.
    await testDb.insert(classes).values({
      name: "exp Authored Class",
      joinCode: "exp-authored-code",
      createdBy: world.student.id,
    });
    await testDb.insert(assignments).values({
      classId: world.classId,
      createdBy: world.student.id,
      title: "exp Authored Assignment",
      instructions: { type: "doc", content: [] },
      projectType: "physics",
      rules: BUILT_IN_RULE_SETS.open_practice,
    });
    await testDb.insert(guides).values({
      classId: world.classId,
      createdBy: world.student.id,
      title: "exp Guide",
      body: { type: "doc", content: [] },
    });
    await testDb.insert(invites).values({
      classId: world.classId,
      email: "exp-invitee@example.com",
      role: "student",
      tokenHash: "exp-invite-hash",
      invitedBy: world.student.id,
    });
    await testDb.insert(ruleSets).values({
      ownerId: world.student.id,
      name: "exp Rule Set",
      rules: BUILT_IN_RULE_SETS.open_practice,
    });

    // An email addressed to them: the admin's own send-reset door, through
    // the real route — the student is active and not yet erased here.
    const mailRes = await app.inject({
      method: "POST",
      url: `/api/admin/users/${world.student.id}/send-reset`,
      cookies: { pide_session: adminCookie },
    });
    expect(mailRes.statusCode).toBe(200);

    // The actorId-only privacy ruling's fixture: a teacher's OWN action,
    // ABOUT the student, through the real timeline route — never a
    // hand-seeded events row standing in for it.
    const timelineRes = await app.inject({
      method: "GET",
      url: `/api/assignments/${world.assignmentId}/timeline/${world.student.id}`,
      cookies: { pide_session: world.teacher.cookie },
    });
    expect(timelineRes.statusCode).toBe(200);

    // Review finding 1's fixtures: the world's released mark carries a
    // teacher privateNote (never seeded by seedStudentWorld itself) that
    // must never leave the server, PLUS a second, DRAFT (unreleased,
    // unreturned) mark that must not appear in the export AT ALL.
    await testDb
      .update(marks)
      .set({ privateNote: "SECRET-MARKER-RELEASED" })
      .where(eq(marks.id, world.markId));

    const [draftAssignment] = await testDb
      .insert(assignments)
      .values({
        classId: world.classId,
        createdBy: world.teacher.id,
        title: "exp Draft-Only Assignment",
        instructions: { type: "doc", content: [] },
        projectType: "physics",
        rules: BUILT_IN_RULE_SETS.open_practice,
        status: "published",
        publishedAt: new Date(),
      })
      .returning();
    draftAssignmentId = draftAssignment.id;
    await testDb.insert(marks).values({
      assignmentId: draftAssignmentId,
      studentId: world.student.id,
      points: 3,
      comment: "not yet seen",
      privateNote: "SECRET-MARKER-DRAFT",
      markedBy: world.teacher.id,
      status: "draft",
      returned: false,
    });

    // Review finding 2's fixture: a GROUP-mode assignment with the student
    // + a credited groupmate as submitter, plus a THIRD member who joined
    // the group but was never credited on the submission — the credit
    // list, not group membership, is what makes a submission theirs.
    const [groupAssignment] = await testDb
      .insert(assignments)
      .values({
        classId: world.classId,
        createdBy: world.teacher.id,
        title: "exp Group Assignment",
        instructions: { type: "doc", content: [] },
        projectType: "physics",
        submissionMode: "group",
        rules: BUILT_IN_RULE_SETS.open_practice,
        status: "published",
        publishedAt: new Date(),
      })
      .returning();
    const groupProjectId2 = `p-exp-group2`;
    await pushProject(world.student.id, groupProjectId2, "Group submission workspace");
    const [group2] = await testDb
      .insert(groups)
      .values({
        assignmentId: groupAssignment.id,
        name: "exp Group 2",
        ownerId: world.student.id,
        projectId: groupProjectId2,
      })
      .returning();
    group2Id = group2.id;
    lateJoiner = await makeSeat("exp-late-joiner@example.com");
    await testDb.insert(groupMembers).values([
      { groupId: group2.id, userId: world.student.id },
      { groupId: group2.id, userId: world.classmate.id },
      // Joined the group; never credited on the submission below.
      { groupId: group2.id, userId: lateJoiner.id },
    ]);
    await testDb.insert(assignmentWork).values({
      assignmentId: groupAssignment.id,
      userId: null,
      groupId: group2.id,
      ownerId: world.student.id,
      projectId: groupProjectId2,
    });
    const [groupSubmission] = await testDb
      .insert(submissions)
      .values({
        assignmentId: groupAssignment.id,
        submitterId: null,
        groupId: group2.id,
        submittedBy: world.student.id,
        creditedIds: [world.student.id, world.classmate.id],
        manifest: manifestFor(groupProjectId2, "Group submission workspace"),
        fingerprint: "exp-group-fingerprint",
        isCurrent: true,
      })
      .returning();
    groupSubmissionId = groupSubmission.id;
  });

  test("every key is present, the note is verbatim, and the user row carries no secret", async () => {
    const res = await exportOf(world.student.id);
    expect(res.statusCode).toBe(200);
    const body = res.json() as ExportBody;
    expect(Object.keys(body).sort()).toEqual([...EXPORT_KEYS].sort());
    expect(body.note).toBe(EXPORT_NOTE);
    expect(body.user.id).toBe(world.student.id);
    expect(body.user.email).toBe(world.student.email);
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  test("one row lands in every bucket the world seeded", async () => {
    const res = await exportOf(world.student.id);
    const body = res.json() as ExportBody;
    expect(body.classMemberships.some((r) => r.userId === world.student.id)).toBe(true);
    expect(body.projects.some((p) => p.id === world.personalProjectId)).toBe(true);
    expect(body.projects.some((p) => p.id === world.groupProjectId)).toBe(true);
    expect(body.projectVersions.length).toBeGreaterThanOrEqual(2);
    expect(body.assignmentWork.length).toBeGreaterThanOrEqual(1);
    expect(body.submissions.some((s) => s.submitterId === world.student.id)).toBe(true);
    expect(body.marksReceived.some((m) => m.assignmentId === world.assignmentId)).toBe(true);
    expect(body.groups.some((g) => g.id === world.groupId)).toBe(true);
    expect(body.groupMemberships.some((m) => m.userId === world.student.id)).toBe(true);
    expect(body.ruleSets.some((r) => r.ownerId === world.student.id)).toBe(true);
    const sentIds = body.sharesSent.map((s) => s.id);
    expect(sentIds).toEqual(expect.arrayContaining([world.acceptedShareId, world.pendingOutShareId]));
    expect(body.sharesReceived.map((s) => s.id)).toEqual(
      expect.arrayContaining([world.pendingInShareId]),
    );
    expect(body.authoredClasses.some((c) => c.createdBy === world.student.id)).toBe(true);
    expect(body.authoredAssignments.some((a) => a.createdBy === world.student.id)).toBe(true);
    expect(body.authoredGuides.some((g) => g.createdBy === world.student.id)).toBe(true);
    expect(body.sentInvites.some((i) => i.invitedBy === world.student.id)).toBe(true);
    expect(body.emails.some((e) => e.toUserId === world.student.id && e.template === "reset")).toBe(
      true,
    );
  });

  test("projects carry the FULL manifest; projectVersions are metadata only, no manifest key", async () => {
    const res = await exportOf(world.student.id);
    const body = res.json() as ExportBody;
    const personal = body.projects.find((p) => p.id === world.personalProjectId);
    expect(personal).toBeDefined();
    expect(personal!.manifest).toEqual(manifestFor(world.personalProjectId, "Their own work"));

    expect(body.projectVersions.length).toBeGreaterThan(0);
    for (const v of body.projectVersions) {
      expect(v).not.toHaveProperty("manifest");
      expect(Object.keys(v).sort()).toEqual(["createdAt", "id", "label"].sort());
    }
  });

  test("events: their own action is present; the teacher's timeline_viewed about them is ABSENT", async () => {
    const res = await exportOf(world.student.id);
    const body = res.json() as ExportBody;
    expect(body.events.length).toBeGreaterThan(0);
    expect(body.events.every((e) => e.actorId === world.student.id)).toBe(true);
    expect(body.events.some((e) => e.type === "project.shared")).toBe(true);
    expect(body.events.some((e) => e.type === "assignment.timeline_viewed")).toBe(false);
  });

  test("an unknown id -> 404, and a malformed one gets the SAME sentence", async () => {
    const unknown = await exportOf("00000000-0000-4000-8000-000000000000");
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error).toBe(NO_SUCH_ACCOUNT);

    const malformed = await app.inject({
      method: "GET",
      url: "/api/admin/users/not-a-uuid/export",
      cookies: { pide_session: adminCookie },
    });
    expect(malformed.statusCode).toBe(404);
    expect(malformed.json().error).toBe(NO_SUCH_ACCOUNT);
  });

  test("a non-admin is refused with 403 (GET has no matrix seat)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${world.student.id}/export`,
      cookies: { pide_session: world.student.cookie },
    });
    expect(res.statusCode).toBe(403);
  });

  // Plan 8 Task 10 review, finding 1 (critical): a raw select on `marks`
  // read `privateNote` — staff-only everywhere else in the product — and
  // every draft mark straight into the export. Fixed by reusing
  // `toMyMark`, the exact function assignments.ts already uses to draw
  // that boundary for the student's own in-app read.
  test("marksReceived: privateNote never leaks, and a draft/unreleased mark is absent entirely", async () => {
    const res = await exportOf(world.student.id);
    const body = res.json() as ExportBody;
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("SECRET-MARKER-RELEASED");
    expect(raw).not.toContain("SECRET-MARKER-DRAFT");
    expect(raw).not.toContain("privateNote");

    // The draft row is absent entirely, not merely stripped of its note.
    expect(body.marksReceived.some((m) => m.assignmentId === draftAssignmentId)).toBe(false);

    // The released mark IS present, shaped to the student-facing boundary.
    const released = body.marksReceived.find((m) => m.assignmentId === world.assignmentId);
    expect(released).toBeDefined();
    expect(released).toMatchObject({ points: 8, comment: "Good work", released: true, returned: false });
    expect(released).not.toHaveProperty("privateNote");
    expect(released).not.toHaveProperty("studentId");
  });

  // Plan 8 Task 10 review, finding 2 (important): assignmentWork/submissions
  // were filtered on userId/submitterId ONLY, both null for group-mode
  // rows, so a group member's own graded work was invisible in their own
  // export. Fixed: submissions join by creditedIds membership (the credit
  // authority), assignmentWork by the student's current group memberships.
  test("group-mode: assignmentWork follows group membership; submissions follow the credited list, not mere membership", async () => {
    const res = await exportOf(world.student.id);
    const body = res.json() as ExportBody;
    expect(body.assignmentWork.some((w) => w.groupId === group2Id)).toBe(true);
    expect(body.submissions.some((s) => s.id === groupSubmissionId)).toBe(true);

    const lateRes = await exportOf(lateJoiner.id);
    const lateBody = lateRes.json() as ExportBody;
    // The late joiner IS a current member of the group, so the group's
    // ongoing assignment_work row is theirs too.
    expect(lateBody.assignmentWork.some((w) => w.groupId === group2Id)).toBe(true);
    // But they were never credited on THIS submission — group membership
    // alone does not retroactively grant them someone else's graded work.
    expect(lateBody.submissions.some((s) => s.id === groupSubmissionId)).toBe(false);
  });
});
