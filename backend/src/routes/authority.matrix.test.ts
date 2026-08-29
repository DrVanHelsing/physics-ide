import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import type { RouteOptions } from "fastify";
import { BUILT_IN_RULE_SETS } from "@physics-ide/shared";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { classMembers, invites, marks, projects, projectVersions, shares, users } from "../db/schema.js";

/* ═══════════════════════════════════════════════════════════════════════
 * THE AUTHORITY MATRIX (memo §6b)
 *
 * Every mutating route in the tree, against ONE world, from eight actor
 * seats. This is a REFUSAL matrix, not a happy-path suite: a refusal by
 * definition changes nothing, so a single fixture built once in beforeAll
 * serves every row. The one ALLOWED bucket per route is deliberately
 * omitted here — it stays asserted in the per-file suite that owns it,
 * because exercising it would mutate the shared world out from under the
 * rows that follow.
 *
 * The sentences are asserted VERBATIM. That is the point of the file: the
 * staff refusal is one string ("Teachers and assistants only.") and the
 * teacher refusal is one string ("Teachers only for this class."), and a
 * route that quietly grows its own wording is a finding, not a variant.
 *
 * Where a route 404s a stranger by design — the draft posture — the row
 * says 404. The matrix records the product's ACTUAL privacy posture; it
 * does not argue with it.
 *
 * ── The enumeration (grep of app.post|put|patch|delete over
 *    backend/src/routes/*.ts, cross-checked at runtime by the coverage
 *    test at the bottom of this file, which walks fastify's own router):
 *    61 mutating routes = 52 rows + 9 named skips.
 *
 *      assignments.ts 17 · auth.ts 8 (all skipped) · admin.ts 6 ·
 *      classes.ts 5 · groups.ts 5 · guides.ts 4 · invites.ts 4 ·
 *      members.ts 4 · projects.ts 3 · shares.ts 3 · notifications.ts 1 ·
 *      tick.ts 1 (skipped)
 *
 * ── The nine skips, each named in SKIPPED below:
 *    · six anonymous-by-design auth doors (signup, confirm, signin,
 *      signout, forgot, reset) — they have no actor to refuse; being
 *      reachable without a session IS their contract.
 *    · two self-scoped auth routes (PATCH /api/auth/me, POST
 *      /api/auth/change-password) — they act on the caller's own row and
 *      nobody else's, so there is no cross-actor authority to test.
 *    · POST /api/tick — guarded by a shared secret header, not by a
 *      session at all (tick.test.ts owns that door).
 * ═══════════════════════════════════════════════════════════════════════ */

const app = buildApp({ db: testDb });

/** Fastify's own view of what got registered — collected before ready() so
 *  the coverage test can prove no mutating route is silently missing. */
const registeredMutating: string[] = [];
app.addHook("onRoute", (route: RouteOptions) => {
  const methods = Array.isArray(route.method) ? route.method : [route.method];
  for (const m of methods) {
    if (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") {
      registeredMutating.push(`${m} ${route.url}`);
    }
  }
});

/* ── The eight actor seats ── */

type Bucket =
  | "anon"
  | "unconfirmed"
  | "studentIn"
  | "studentOut"
  | "ta"
  | "teacher"
  | "teacherOther"
  | "admin";

/** `studentIn` is inside the group of the published group assignment;
 *  `studentOut` is the class's other student, outside that group (and the
 *  recipient of the pending share). Both are active members of the class —
 *  the out-of-class seats are `teacherOther`, `unconfirmed`, `admin` and
 *  `anon`. */
const cookies: Partial<Record<Bucket, string>> = {};
function cookieFor(bucket: Bucket): Record<string, string> {
  const c = cookies[bucket];
  return c ? { pide_session: c } : {};
}

/* ── Every sentence, once, verbatim from the route that owns it ── */

const ANON = { code: 401, error: "Not signed in." } as const; // auth/guards.ts requireUser
const UNCONFIRMED = { code: 403, error: "Confirm your email address first." } as const; // requireConfirmed
const NOT_ADMIN = { code: 403, error: "Admin only." } as const; // requireAdmin
const NOT_CLASS_TEACHER = { code: 403, error: "Teachers only for this class." } as const; // requireClassTeacher
const NOT_CLASS_STAFF = { code: 403, error: "Teachers and assistants only." } as const; // requireClassStaff (Task 1's ONE string)
const NOT_CLASS_MEMBER = { code: 403, error: "Not a member of this class." } as const;
const NOT_TEACHER_ACCOUNT = { code: 403, error: "Teachers only." } as const; // assignments.ts isTeacherAccount
const NOT_TEACHER_ACCOUNT_CLASSES = {
  code: 403,
  error: "Only teacher accounts can create classes.",
} as const;
const NOT_GROUP_MEMBER = { code: 403, error: "Not a member of this group." } as const;
const GROUPS_ARE_FOR_STUDENTS = { code: 403, error: "Groups are for students." } as const;
const ALREADY_GROUPED = { code: 400, error: "You are already in a group for this assignment." } as const;
const GROUP_ALREADY_SUBMITTED = { code: 400, error: "This group has already submitted." } as const;
const NO_BATON = { code: 409, error: "Take the baton before saving." } as const;
const JOIN_A_GROUP_FIRST = { code: 400, error: "Join a group before starting this assignment." } as const;
const NO_SUCH_PROJECT = { code: 404, error: "No such project." } as const;
const NO_SUCH_VERSION = { code: 404, error: "No such version." } as const;
const NO_SUCH_SHARE = { code: 404, error: "No such share." } as const;
const SELF_SHARE = { code: 400, error: "You can't share a project with yourself." } as const;
const ALREADY_PENDING = {
  code: 409,
  error: "Already shared with them — it's waiting on their class page.",
} as const;
const REVOKE_FORBIDDEN = {
  code: 403,
  error: "Only the sharer or the class teacher can revoke a share.",
} as const;

/* ── The world ── */

const WORK_PROJECT = "p-am-work"; // the group's shared project (started + submitted)
const SHARE_SOURCE = "p-am-src"; // studentIn's own project — the pending share's source
const OUT_PROJECT = "p-am-out"; // studentOut's own project

let classId: string;
let otherClassId: string;
let assignmentId: string;
let groupId: string;
let guideId: string;
let inviteId: string;
let ruleSetId: string;
let shareId: string;
let versionId: number;

let studentInId: string;
let studentOutId: string;
let unconfirmedId: string;

function manifest(id: string, title: string, updatedAt: number) {
  return {
    schemaVersion: 2,
    id,
    title,
    goal: "physics",
    projectType: "custom",
    createdAt: 1000,
    updatedAt,
  };
}

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

/* Each signin gets its own source IP — the auth route's per-IP rate limit is
 * sized for humans and this file signs in seven accounts. */
let signinIpCounter = 0;
async function signin(email: string): Promise<string> {
  signinIpCounter += 1;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    remoteAddress: `10.96.${Math.floor(signinIpCounter / 250)}.${(signinIpCounter % 250) + 1}`,
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

/** A fixture step that must succeed — a silent 4xx here would turn every
 *  row that depends on it into a lie about the product. */
function ok<T extends { statusCode: number; body: string }>(res: T, what: string): T {
  if (res.statusCode >= 300) {
    throw new Error(`fixture step failed: ${what} → ${res.statusCode} ${res.body}`);
  }
  return res;
}

async function pushProject(ownerId: string, projectId: string, m: Record<string, unknown>) {
  await testDb.insert(projects).values({
    id: projectId,
    ownerId,
    title: m.title as string,
    goal: "physics",
    projectType: "custom",
    manifest: m,
    clientUpdatedAt: m.updatedAt as number,
  });
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);

  const teacher = await makeUser("amteacher@example.com", { isTeacher: true });
  const ta = await makeUser("amta@example.com");
  const studentIn = await makeUser("amstudentin@example.com");
  const studentOut = await makeUser("amstudentout@example.com");
  const teacherOther = await makeUser("amteacherother@example.com", { isTeacher: true });
  const unconfirmed = await makeUser("amunconfirmed@example.com", { emailConfirmedAt: null });
  await makeUser("amadmin@example.com", { role: "admin" });

  studentInId = studentIn.id;
  studentOutId = studentOut.id;
  unconfirmedId = unconfirmed.id;

  cookies.teacher = await signin("amteacher@example.com");
  cookies.ta = await signin("amta@example.com");
  cookies.studentIn = await signin("amstudentin@example.com");
  cookies.studentOut = await signin("amstudentout@example.com");
  cookies.teacherOther = await signin("amteacherother@example.com");
  cookies.unconfirmed = await signin("amunconfirmed@example.com");
  cookies.admin = await signin("amadmin@example.com");
  // `anon` deliberately has no cookie at all.

  /* The class: peer sharing ON (off by default, spec §8.3), a teacher, a
   * TA and two students. */
  const classRes = ok(
    await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: cookieFor("teacher"),
      payload: { name: "Authority Matrix Class" },
    }),
    "create class",
  );
  classId = classRes.json().class.id;
  await testDb.insert(classMembers).values([
    { classId, userId: ta.id, role: "ta", status: "active" },
    { classId, userId: studentIn.id, role: "student", status: "active" },
    { classId, userId: studentOut.id, role: "student", status: "active" },
  ]);
  ok(
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: cookieFor("teacher"),
      payload: { peerSharing: true },
    }),
    "switch peer sharing on",
  );

  /* A second class, so `teacherOther` is a real teacher somewhere and not
   * merely an account with the flag set. */
  const otherRes = ok(
    await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: cookieFor("teacherOther"),
      payload: { name: "Some Other Class" },
    }),
    "create the other class",
  );
  otherClassId = otherRes.json().class.id;

  /* A PUBLISHED group assignment — published so the student-facing 404
   * draft posture never masks an authority refusal, group-mode so the
   * group routes have something real to refuse against. */
  const draft = ok(
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: cookieFor("teacher"),
      payload: { title: "Matrix Assignment", submissionMode: "group", points: 10 },
    }),
    "create assignment",
  );
  assignmentId = draft.json().assignment.id;
  ok(
    await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/publish`,
      cookies: cookieFor("teacher"),
    }),
    "publish assignment",
  );

  /* studentIn's group, its shared project, its submission. */
  const groupRes = ok(
    await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/groups`,
      cookies: cookieFor("studentIn"),
      payload: {},
    }),
    "form group",
  );
  groupId = groupRes.json().group.id;

  await pushProject(studentInId, WORK_PROJECT, manifest(WORK_PROJECT, "Group Work", 2000));
  await pushProject(studentInId, SHARE_SOURCE, manifest(SHARE_SOURCE, "Shareable", 3000));
  await pushProject(studentOutId, OUT_PROJECT, manifest(OUT_PROJECT, "Their Own", 4000));

  ok(
    await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/start`,
      cookies: cookieFor("studentIn"),
      payload: { projectId: WORK_PROJECT },
    }),
    "start group work",
  );
  ok(
    await app.inject({
      method: "POST",
      url: `/api/assignments/${assignmentId}/submit`,
      cookies: cookieFor("studentIn"),
      payload: {},
    }),
    "submit group work",
  );

  /* A DRAFT mark on studentIn — draft, so the group-return and per-student
   * return rows meet the staff gate rather than the released-return
   * teacher-only gate one rung further in. */
  ok(
    await app.inject({
      method: "PUT",
      url: `/api/assignments/${assignmentId}/marks/${studentInId}`,
      cookies: cookieFor("teacher"),
      payload: { points: 5, comment: "Draft" },
    }),
    "draft a mark",
  );

  const guideRes = ok(
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/guides`,
      cookies: cookieFor("teacher"),
      payload: { title: "Matrix Guide", body: { type: "doc", content: [] } },
    }),
    "create guide",
  );
  guideId = guideRes.json().guide.id;

  ok(
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: cookieFor("teacher"),
      payload: { emails: ["aminvitee@example.com"], role: "student" },
    }),
    "send invite",
  );
  const inviteRows = await testDb.select().from(invites).where(eq(invites.classId, classId));
  inviteId = inviteRows[0].id;

  const ruleSetRes = ok(
    await app.inject({
      method: "POST",
      url: "/api/rule-sets",
      cookies: cookieFor("teacher"),
      payload: { name: "Matrix Rules", rules: BUILT_IN_RULE_SETS.open_practice },
    }),
    "save rule set",
  );
  ruleSetId = ruleSetRes.json().ruleSet.id;

  /* One PENDING share, studentIn → studentOut, of studentIn's own project
   * (never the group's — a group project cannot be shared out at all). */
  const shareRes = ok(
    await app.inject({
      method: "POST",
      url: "/api/shares",
      cookies: cookieFor("studentIn"),
      payload: { classId, recipientId: studentOutId, projectId: SHARE_SOURCE },
    }),
    "create share",
  );
  shareId = shareRes.json().share.id;

  /* One archived version of studentIn's own project, so the restore row has
   * a real (owner, project, version) triple to be refused against. */
  const [version] = await testDb
    .insert(projectVersions)
    .values({
      ownerId: studentInId,
      projectId: SHARE_SOURCE,
      manifest: manifest(SHARE_SOURCE, "Shareable", 2500),
      clientUpdatedAt: 2500,
      savedBy: studentInId,
      reason: "overwrite",
    })
    .returning();
  versionId = version.id;
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

/* ── The table ── */

type Expect = number | { code: number; error: string };
type Row = {
  /** EXACTLY `${method} ${route template}` — the coverage test matches on it. */
  name: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: () => string;
  body?: () => unknown;
  /** Omitted bucket = the allowed one, covered by the route's own suite. */
  expect: Partial<Record<Bucket, Expect>>;
};

/** Every non-admin seat, refused by requireAdmin with the same sentence.
 *  `unconfirmed` is included on purpose: requireAdmin checks the ROLE, not
 *  the confirmation, so an unconfirmed non-admin is refused as a non-admin. */
const ADMIN_ONLY_SEATS: Partial<Record<Bucket, Expect>> = {
  anon: ANON,
  unconfirmed: NOT_ADMIN,
  studentIn: NOT_ADMIN,
  studentOut: NOT_ADMIN,
  ta: NOT_ADMIN,
  teacher: NOT_ADMIN,
  teacherOther: NOT_ADMIN,
};

/** Every seat but the class teacher, on a requireClassTeacher route. Note
 *  `admin`: a platform admin has NO class authority — the console is not a
 *  master key into a classroom. */
const CLASS_TEACHER_ONLY_SEATS: Partial<Record<Bucket, Expect>> = {
  anon: ANON,
  unconfirmed: UNCONFIRMED,
  studentIn: NOT_CLASS_TEACHER,
  studentOut: NOT_CLASS_TEACHER,
  ta: NOT_CLASS_TEACHER,
  teacherOther: NOT_CLASS_TEACHER,
  admin: NOT_CLASS_TEACHER,
};

/** Every seat but the two staff hats, on a requireClassStaff route. */
const CLASS_STAFF_ONLY_SEATS: Partial<Record<Bucket, Expect>> = {
  anon: ANON,
  unconfirmed: UNCONFIRMED,
  studentIn: NOT_CLASS_STAFF,
  studentOut: NOT_CLASS_STAFF,
  teacherOther: NOT_CLASS_STAFF,
  admin: NOT_CLASS_STAFF,
};

const MATRIX: Array<{ file: string; rows: Row[] }> = [
  /* ═══ admin.ts — requireAdmin: 401 for the anonymous, "Admin only." for
   *     every signed-in seat that is not the platform admin. ═══ */
  {
    file: "admin.ts",
    rows: [
      {
        name: "POST /api/admin/users/:id/deactivate",
        method: "POST",
        path: () => `/api/admin/users/${unconfirmedId}/deactivate`,
        expect: ADMIN_ONLY_SEATS,
      },
      {
        name: "POST /api/admin/users/:id/reactivate",
        method: "POST",
        path: () => `/api/admin/users/${unconfirmedId}/reactivate`,
        expect: ADMIN_ONLY_SEATS,
      },
      {
        name: "POST /api/admin/users/:id/resend-confirmation",
        method: "POST",
        path: () => `/api/admin/users/${unconfirmedId}/resend-confirmation`,
        expect: ADMIN_ONLY_SEATS,
      },
      {
        name: "POST /api/admin/users/:id/send-reset",
        method: "POST",
        path: () => `/api/admin/users/${unconfirmedId}/send-reset`,
        expect: ADMIN_ONLY_SEATS,
      },
      {
        name: "POST /api/admin/users/:id/erase",
        method: "POST",
        path: () => `/api/admin/users/${unconfirmedId}/erase`,
        // The confirmation is deliberately WRONG: every seat here is
        // refused by requireAdmin before the body is ever read, and a
        // matching one would scrub the fixture out from under the rows
        // that follow if that guard ever regressed.
        body: () => ({ confirm: "not-their-email@example.com" }),
        expect: ADMIN_ONLY_SEATS,
      },
      {
        name: "PUT /api/admin/cap",
        method: "PUT",
        path: () => "/api/admin/cap",
        body: () => ({ cap: 500 }),
        expect: ADMIN_ONLY_SEATS,
      },
    ],
  },

  /* ═══ assignments.ts — three different gates in one file: the class
   *     teacher (authoring), the class staff (marking), and the ACCOUNT-level
   *     teacher flag (rule sets, which are a teacher's own scratch space and
   *     belong to no class). Plus the two member-scoped student routes. ═══ */
  {
    file: "assignments.ts",
    rows: [
      {
        name: "POST /api/classes/:id/assignments",
        method: "POST",
        path: () => `/api/classes/${classId}/assignments`,
        body: () => ({ title: "Nope" }),
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        // Membership, not staffing, is the gate — and then the group gate.
        // Staff can never be in a group (groups are student-only), so no
        // staff seat can start group work at all.
        name: "POST /api/assignments/:id/start",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/start`,
        body: () => ({ projectId: WORK_PROJECT }),
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          teacherOther: NOT_CLASS_MEMBER,
          admin: NOT_CLASS_MEMBER,
          studentOut: JOIN_A_GROUP_FIRST,
          ta: JOIN_A_GROUP_FIRST,
          teacher: JOIN_A_GROUP_FIRST,
        },
      },
      {
        name: "PATCH /api/assignments/:id",
        method: "PATCH",
        path: () => `/api/assignments/${assignmentId}`,
        body: () => ({ title: "Renamed by a stranger" }),
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/assignments/:id/publish",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/publish`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/assignments/:id/close",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/close`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "DELETE /api/assignments/:id",
        method: "DELETE",
        path: () => `/api/assignments/${assignmentId}`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        // Account-level: teacher, teacherOther and admin are all teacher
        // ACCOUNTS and are allowed here (their own scratch space), so the
        // refusals are the three non-teacher accounts.
        name: "POST /api/rule-sets",
        method: "POST",
        path: () => "/api/rule-sets",
        body: () => ({ name: "Nope", rules: BUILT_IN_RULE_SETS.open_practice }),
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          studentIn: NOT_TEACHER_ACCOUNT,
          studentOut: NOT_TEACHER_ACCOUNT,
          ta: NOT_TEACHER_ACCOUNT,
        },
      },
      {
        name: "DELETE /api/rule-sets/:id",
        method: "DELETE",
        path: () => `/api/rule-sets/${ruleSetId}`,
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          studentIn: NOT_TEACHER_ACCOUNT,
          studentOut: NOT_TEACHER_ACCOUNT,
          ta: NOT_TEACHER_ACCOUNT,
        },
      },
      {
        name: "POST /api/assignments/:id/starter",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/starter`,
        body: () => ({ projectId: WORK_PROJECT }),
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "DELETE /api/assignments/:id/starter",
        method: "DELETE",
        path: () => `/api/assignments/${assignmentId}/starter`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/assignments/:id/submit",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/submit`,
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          teacherOther: NOT_CLASS_MEMBER,
          admin: NOT_CLASS_MEMBER,
          studentOut: JOIN_A_GROUP_FIRST,
          ta: JOIN_A_GROUP_FIRST,
          teacher: JOIN_A_GROUP_FIRST,
        },
      },
      {
        name: "POST /api/assignments/:id/remind",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/remind`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "PUT /api/assignments/:id/marks/:studentId",
        method: "PUT",
        path: () => `/api/assignments/${assignmentId}/marks/${studentInId}`,
        body: () => ({ points: 1 }),
        expect: CLASS_STAFF_ONLY_SEATS,
      },
      {
        name: "PUT /api/assignments/:id/marks/group/:gid",
        method: "PUT",
        path: () => `/api/assignments/${assignmentId}/marks/group/${groupId}`,
        body: () => ({ points: 1 }),
        expect: CLASS_STAFF_ONLY_SEATS,
      },
      {
        // Staff-wide while the marks are drafts; the released-return
        // teacher-only rung is assignments.test.ts's, not the matrix's.
        name: "POST /api/assignments/:id/marks/group/:gid/return",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/marks/group/${groupId}/return`,
        body: () => ({ comment: "Have another look." }),
        expect: CLASS_STAFF_ONLY_SEATS,
      },
      {
        // Release is TEACHER-only, one rung tighter than drafting: the TA
        // seat is refused here with the teacher sentence, not the staff one.
        name: "POST /api/assignments/:id/marks/release",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/marks/release`,
        body: () => ({ all: true }),
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/assignments/:id/marks/:studentId/return",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/marks/${studentInId}/return`,
        body: () => ({ comment: "Have another look." }),
        expect: CLASS_STAFF_ONLY_SEATS,
      },
    ],
  },

  /* ═══ classes.ts ═══ */
  {
    file: "classes.ts",
    rows: [
      {
        // Account-level again: every teacher account (and the admin) may
        // create a class, so the refusals are the three that may not.
        name: "POST /api/classes",
        method: "POST",
        path: () => "/api/classes",
        body: () => ({ name: "Not yours to make" }),
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          studentIn: NOT_TEACHER_ACCOUNT_CLASSES,
          studentOut: NOT_TEACHER_ACCOUNT_CLASSES,
          ta: NOT_TEACHER_ACCOUNT_CLASSES,
        },
      },
      {
        name: "PATCH /api/classes/:id",
        method: "PATCH",
        path: () => `/api/classes/${classId}`,
        body: () => ({ peerSharing: false }),
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/classes/:id/regenerate-code",
        method: "POST",
        path: () => `/api/classes/${classId}/regenerate-code`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/classes/:id/archive",
        method: "POST",
        path: () => `/api/classes/${classId}/archive`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/classes/:id/unarchive",
        method: "POST",
        path: () => `/api/classes/${classId}/unarchive`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
    ],
  },

  /* ═══ groups.ts — two gates past class membership: forming/joining is
   *     STUDENT-only (a staff member in a group would be credited on its
   *     submission), and everything the group OWNS is group-member-only. ═══ */
  {
    file: "groups.ts",
    rows: [
      {
        name: "POST /api/assignments/:id/groups",
        method: "POST",
        path: () => `/api/assignments/${assignmentId}/groups`,
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          teacherOther: NOT_CLASS_MEMBER,
          admin: NOT_CLASS_MEMBER,
          ta: GROUPS_ARE_FOR_STUDENTS,
          teacher: GROUPS_ARE_FOR_STUDENTS,
          studentIn: ALREADY_GROUPED,
        },
      },
      {
        name: "POST /api/groups/:gid/join",
        method: "POST",
        path: () => `/api/groups/${groupId}/join`,
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          teacherOther: NOT_CLASS_MEMBER,
          admin: NOT_CLASS_MEMBER,
          ta: GROUPS_ARE_FOR_STUDENTS,
          teacher: GROUPS_ARE_FOR_STUDENTS,
          // The roster freezes at hand-in: the receipt already names who
          // was credited, so neither student may change it now.
          studentIn: GROUP_ALREADY_SUBMITTED,
          studentOut: GROUP_ALREADY_SUBMITTED,
        },
      },
      {
        name: "POST /api/groups/:gid/leave",
        method: "POST",
        path: () => `/api/groups/${groupId}/leave`,
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          teacherOther: NOT_CLASS_MEMBER,
          admin: NOT_CLASS_MEMBER,
          ta: NOT_GROUP_MEMBER,
          teacher: NOT_GROUP_MEMBER,
          studentOut: NOT_GROUP_MEMBER,
          studentIn: GROUP_ALREADY_SUBMITTED,
        },
      },
      {
        name: "POST /api/groups/:gid/baton/take",
        method: "POST",
        path: () => `/api/groups/${groupId}/baton/take`,
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          teacherOther: NOT_CLASS_MEMBER,
          admin: NOT_CLASS_MEMBER,
          ta: NOT_GROUP_MEMBER,
          teacher: NOT_GROUP_MEMBER,
          studentOut: NOT_GROUP_MEMBER,
        },
      },
      {
        name: "PUT /api/groups/:gid/project",
        method: "PUT",
        path: () => `/api/groups/${groupId}/project`,
        body: () => ({ manifest: manifest(WORK_PROJECT, "Group Work", 9000) }),
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          teacherOther: NOT_CLASS_MEMBER,
          admin: NOT_CLASS_MEMBER,
          ta: NOT_GROUP_MEMBER,
          teacher: NOT_GROUP_MEMBER,
          studentOut: NOT_GROUP_MEMBER,
          // A member of the group, but nobody is holding the baton — and
          // nobody can be: the baton/take row above omits `studentIn` (its
          // one allowed seat), so no test in this file ever takes the lease.
          // Declaration order is what guarantees that, since the runner emits
          // tests in MATRIX order and vitest runs a file's tests in order.
          studentIn: NO_BATON,
        },
      },
    ],
  },

  /* ═══ guides.ts — the guide is loaded FIRST, so a stranger meets the
   *     teacher gate (403) rather than the draft 404: guide existence is
   *     not hidden from a signed-in caller on the write paths. ═══ */
  {
    file: "guides.ts",
    rows: [
      {
        name: "POST /api/classes/:id/guides",
        method: "POST",
        path: () => `/api/classes/${classId}/guides`,
        body: () => ({ title: "Nope", body: { type: "doc", content: [] } }),
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "PATCH /api/guides/:id",
        method: "PATCH",
        path: () => `/api/guides/${guideId}`,
        body: () => ({ title: "Renamed by a stranger" }),
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/guides/:id/publish",
        method: "POST",
        path: () => `/api/guides/${guideId}/publish`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "DELETE /api/guides/:id",
        method: "DELETE",
        path: () => `/api/guides/${guideId}`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
    ],
  },

  /* ═══ invites.ts ═══ */
  {
    file: "invites.ts",
    rows: [
      {
        name: "POST /api/classes/:id/invites",
        method: "POST",
        path: () => `/api/classes/${classId}/invites`,
        body: () => ({ emails: ["nope@example.com"], role: "student" }),
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/invites/:id/revoke",
        method: "POST",
        path: () => `/api/invites/${inviteId}/revoke`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/invites/:id/resend",
        method: "POST",
        path: () => `/api/invites/${inviteId}/resend`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        // The TOKEN is the authority here, not the seat: every confirmed
        // caller may present one, and a bad one is a 400 that invites.test.ts
        // owns. Only the two session gates are authority questions.
        name: "POST /api/invites/accept",
        method: "POST",
        path: () => "/api/invites/accept",
        body: () => ({ token: "x".repeat(40) }),
        expect: { anon: ANON, unconfirmed: UNCONFIRMED },
      },
    ],
  },

  /* ═══ members.ts ═══ */
  {
    file: "members.ts",
    rows: [
      {
        // Like invite-accept: the join CODE is the authority. Every other
        // seat is entitled to try, so only the session gates are refusals.
        name: "POST /api/classes/join",
        method: "POST",
        path: () => "/api/classes/join",
        body: () => ({ code: "ZZZZ-ZZZZ" }),
        expect: { anon: ANON, unconfirmed: UNCONFIRMED },
      },
      {
        name: "POST /api/classes/:id/members/:userId/approve",
        method: "POST",
        path: () => `/api/classes/${classId}/members/${studentOutId}/approve`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "POST /api/classes/:id/members/:userId/deny",
        method: "POST",
        path: () => `/api/classes/${classId}/members/${studentOutId}/deny`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
      {
        name: "DELETE /api/classes/:id/members/:userId",
        method: "DELETE",
        path: () => `/api/classes/${classId}/members/${studentOutId}`,
        expect: CLASS_TEACHER_ONLY_SEATS,
      },
    ],
  },

  /* ═══ notifications.ts (Plan 8) — self-scoped: the route acts on the
   *     caller's own rows and nobody else's, so there is no cross-actor
   *     authority to test — only the two session gates. The blessed
   *     self-scoped single-shape members.ts's /api/classes/join and
   *     invites.ts's /api/invites/accept already use above. ═══ */
  {
    file: "notifications.ts",
    rows: [
      {
        name: "POST /api/notifications/read",
        method: "POST",
        path: () => "/api/notifications/read",
        expect: { anon: ANON, unconfirmed: UNCONFIRMED },
      },
    ],
  },

  /* ═══ projects.ts — the IDE core, and the ONE route family gated by
   *     requireUser rather than requireConfirmed: an unconfirmed account
   *     may still sync its own work (spec §3.1 lets them look around and
   *     keep working; it is joining and creating classes that wait).
   *
   *     Every row here is self-scoped by ownerId — there is no cross-owner
   *     reach to refuse. A PUT names the CALLER's own project, a DELETE of
   *     someone else's id is an idempotent no-op, and only restore has an
   *     observable refusal for a non-owner: 404, the ownership posture. ═══ */
  {
    file: "projects.ts",
    rows: [
      {
        name: "PUT /api/projects/:id",
        method: "PUT",
        path: () => `/api/projects/${SHARE_SOURCE}`,
        body: () => ({ manifest: manifest(SHARE_SOURCE, "Shareable", 9000) }),
        expect: { anon: ANON },
      },
      {
        name: "DELETE /api/projects/:id",
        method: "DELETE",
        path: () => `/api/projects/${SHARE_SOURCE}`,
        expect: { anon: ANON },
      },
      {
        name: "POST /api/projects/:id/versions/:versionId/restore",
        method: "POST",
        path: () => `/api/projects/${SHARE_SOURCE}/versions/${versionId}/restore`,
        expect: {
          anon: ANON,
          // Not "Confirm your email first" — requireUser is the gate, and
          // then the row simply is not theirs.
          unconfirmed: NO_SUCH_VERSION,
          studentOut: NO_SUCH_VERSION,
          ta: NO_SUCH_VERSION,
          teacher: NO_SUCH_VERSION,
          teacherOther: NO_SUCH_VERSION,
          admin: NO_SUCH_VERSION,
        },
      },
    ],
  },

  /* ═══ shares.ts (Plan 7) ═══ */
  {
    file: "shares.ts",
    rows: [
      {
        // One gate, five refusals, each with its own sentence: outsiders
        // never learn the class exists as anything but "not yours"; class
        // staff are inside the class but do not own the project; and the
        // named recipient is the sharer themselves.
        name: "POST /api/shares",
        method: "POST",
        path: () => "/api/shares",
        body: () => ({ classId, recipientId: studentOutId, projectId: SHARE_SOURCE }),
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          teacherOther: NOT_CLASS_MEMBER,
          admin: NOT_CLASS_MEMBER,
          ta: NO_SUCH_PROJECT,
          teacher: NO_SUCH_PROJECT,
          studentOut: SELF_SHARE,
          studentIn: ALREADY_PENDING,
        },
      },
      {
        // The draft posture, at its strictest: a share that is not yours to
        // accept does not exist for you — including for the person who sent
        // it and for the class's own teacher.
        name: "POST /api/shares/:id/accept",
        method: "POST",
        path: () => `/api/shares/${shareId}/accept`,
        body: () => ({ projectId: "p-am-copy" }),
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          studentIn: NO_SUCH_SHARE,
          ta: NO_SUCH_SHARE,
          teacher: NO_SUCH_SHARE,
          teacherOther: NO_SUCH_SHARE,
          admin: NO_SUCH_SHARE,
        },
      },
      {
        // Two postures on one route, deliberately: people with standing on
        // the share (its recipient, the class's staff) get the honest
        // "only the sharer or the teacher" sentence; people with none get
        // the 404 that does not admit the share exists.
        name: "POST /api/shares/:id/revoke",
        method: "POST",
        path: () => `/api/shares/${shareId}/revoke`,
        expect: {
          anon: ANON,
          unconfirmed: UNCONFIRMED,
          studentOut: REVOKE_FORBIDDEN,
          ta: REVOKE_FORBIDDEN,
          teacherOther: NO_SUCH_SHARE,
          admin: NO_SUCH_SHARE,
        },
      },
    ],
  },
];

/** The nine mutating routes deliberately outside the matrix, by name. */
const SKIPPED = [
  // Anonymous by design — the doors into the product. No session to refuse.
  "POST /api/auth/signup",
  "POST /api/auth/confirm",
  "POST /api/auth/signin",
  "POST /api/auth/signout",
  "POST /api/auth/forgot",
  "POST /api/auth/reset",
  // Self-scoped — they write the caller's own row and nobody else's.
  "PATCH /api/auth/me",
  "POST /api/auth/change-password",
  // Guarded by a shared secret header, not a session (tick.test.ts).
  "POST /api/tick",
];

/* ── The runner ── */

for (const { file, rows } of MATRIX) {
  describe(`the authority matrix — ${file}`, () => {
    for (const row of rows) {
      for (const [bucket, expected] of Object.entries(row.expect) as Array<[Bucket, Expect]>) {
        test(`${row.name} — ${bucket} is refused`, async () => {
          const res = await app.inject({
            method: row.method,
            url: row.path(),
            cookies: cookieFor(bucket),
            payload: row.body?.() ?? {},
          });
          if (typeof expected === "number") {
            expect(res.statusCode).toBe(expected);
          } else {
            expect(res.statusCode).toBe(expected.code);
            expect(res.json().error).toBe(expected.error);
          }
        });
      }
    }
  });
}

describe("the authority matrix — coverage", () => {
  test("every mutating route in the tree is a row or a named skip", async () => {
    await app.ready();
    const covered = new Set(MATRIX.flatMap((s) => s.rows).map((r) => r.name));
    const skipped = new Set(SKIPPED);
    const missing = registeredMutating.filter((r) => !covered.has(r) && !skipped.has(r));
    expect(missing).toEqual([]);
  });

  test("no row names a route that no longer exists", async () => {
    await app.ready();
    const registered = new Set(registeredMutating);
    const stale = [...MATRIX.flatMap((s) => s.rows).map((r) => r.name), ...SKIPPED].filter(
      (name) => !registered.has(name),
    );
    expect(stale).toEqual([]);
  });

  test("no row is vacuously empty", () => {
    // The runner iterates `Object.entries(row.expect)`, so a row emptied to
    // `{}` emits ZERO tests while still satisfying all three checks above —
    // a silenced row would pass as covered. Non-empty is the whole bar: a
    // single seat is legitimate (the two self-scoped projects.ts rows carry
    // only `anon`, and that omission is load-bearing), so no minimum count.
    for (const r of MATRIX.flatMap((s) => s.rows)) {
      expect(Object.keys(r.expect).length, r.name).toBeGreaterThan(0);
    }
  });

  test("the enumeration adds up: 61 mutating routes = 52 rows + 9 skips", async () => {
    await app.ready();
    expect(MATRIX.flatMap((s) => s.rows)).toHaveLength(52);
    expect(SKIPPED).toHaveLength(9);
    expect(new Set(registeredMutating).size).toBe(61);
  });
});

/* The fixture world is asserted once, so a row that passes for the wrong
 * reason (an assignment that never published, a share that never landed)
 * fails HERE with a legible message instead of hiding inside 300 refusals. */
describe("the authority matrix — the world it runs against", () => {
  test("the class, the assignment, the group, the share and the mark all exist", async () => {
    const classRes = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: cookieFor("teacher"),
    });
    expect(classRes.json().class.peerSharing).toBe(true);
    expect(classRes.json().class.activeMembers).toBe(4);
    expect(otherClassId).not.toBe(classId);

    const assignmentRes = await app.inject({
      method: "GET",
      url: `/api/assignments/${assignmentId}`,
      cookies: cookieFor("teacher"),
    });
    expect(assignmentRes.json().assignment.phase).toBe("open");
    expect(assignmentRes.json().assignment.submissionMode).toBe("group");

    const shareRows = await testDb.select().from(shares).where(eq(shares.id, shareId));
    expect(shareRows[0].status).toBe("pending");
    expect(shareRows[0].recipientId).toBe(studentOutId);

    // A DRAFT mark, not a released one: the group-return and per-student
    // return rows meet the staff gate only while the marks are drafts.
    const markRows = await testDb.select().from(marks).where(eq(marks.studentId, studentInId));
    expect(markRows).toHaveLength(1);
    expect(markRows[0].status).toBe("draft");
  });
});
