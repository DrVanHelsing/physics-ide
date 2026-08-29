import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq, inArray } from "drizzle-orm";
import { BUILT_IN_RULE_SETS } from "@physics-ide/shared";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { MAX_PROJECTS_PER_USER, stableStringify } from "./projects.js";
import { pgErrorCode } from "../lib/util.js";
import {
  users,
  classMembers,
  events,
  projects,
  assignments,
  assignmentWork,
  groups,
  shares,
  notifications,
} from "../db/schema.js";

const app = buildApp({ db: testDb });

let teacherCookie: string;
let teacherId: string;
let outsiderCookie: string;
let classId: string;

type Member = { id: string; cookie: string };
const alpha = {} as Member;
const bravo = {} as Member;
/** Class staff, one rung down from teacher — never a member of `classId`
 *  until a revoke test scopes them in and cleans them back out, so the
 *  roster tests' "bravo+teacher, never anyone else" shape stays true. */
const ta = {} as Member;

/** The sharer's pushed head — frozen into the share row verbatim (D§2). */
const SRC_ID = "p-share-src";
const SRC_MANIFEST = {
  schemaVersion: 2,
  id: SRC_ID,
  title: "Pendulum",
  goal: "physics",
  projectType: "custom",
  createdAt: 1000,
  updatedAt: 5000,
};

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
 * sized for humans and this file signs in four accounts. */
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

async function eventsOfType(type: string) {
  return testDb.select().from(events).where(eq(events.type, type));
}

async function notificationsFor(userId: string) {
  return testDb.select().from(notifications).where(eq(notifications.userId, userId));
}

async function pushProject(ownerId: string, projectId: string, manifest: Record<string, unknown>) {
  await testDb.insert(projects).values({
    id: projectId,
    ownerId,
    title: manifest.title as string,
    goal: "physics",
    projectType: "custom",
    manifest,
    clientUpdatedAt: manifest.updatedAt as number,
  });
}

async function postShare(cookie: string, body: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/shares",
    cookies: { pide_session: cookie },
    payload: { classId, recipientId: bravo.id, projectId: SRC_ID, ...body },
  });
}

async function setPeerSharing(on: boolean) {
  const res = await app.inject({
    method: "PATCH",
    url: `/api/classes/${classId}`,
    cookies: { pide_session: teacherCookie },
    payload: { peerSharing: on },
  });
  expect(res.statusCode).toBe(200);
}

/** The minimal NOT-NULL assignment row — direct insert on purpose: driving the
 *  whole teacher flow per refusal would triple this file for no extra truth. */
async function insertAssignment(extra: Record<string, unknown> = {}) {
  const [a] = await testDb
    .insert(assignments)
    .values({
      classId,
      createdBy: alpha.id,
      title: "Fixture",
      instructions: { type: "doc", content: [] },
      projectType: "physics",
      rules: BUILT_IN_RULE_SETS.open_practice,
      ...extra,
    })
    .returning();
  return a;
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);

  const t = await makeUser("shteach@example.com", { isTeacher: true });
  const a = await makeUser("shalpha@example.com");
  const b = await makeUser("shbravo@example.com");
  await makeUser("shoutsider@example.com");
  const ta_ = await makeUser("shta@example.com");

  teacherCookie = await signin("shteach@example.com");
  teacherId = t.id;
  alpha.id = a.id;
  alpha.cookie = await signin("shalpha@example.com");
  bravo.id = b.id;
  bravo.cookie = await signin("shbravo@example.com");
  outsiderCookie = await signin("shoutsider@example.com");
  ta.id = ta_.id;
  ta.cookie = await signin("shta@example.com");

  const classRes = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: teacherCookie },
    payload: { name: "Sharing Class" },
  });
  classId = classRes.json().class.id;
  await testDb.insert(classMembers).values([
    { classId, userId: alpha.id, role: "student", status: "active" },
    { classId, userId: bravo.id, role: "student", status: "active" },
  ]);
  // Off by default (spec §8.3) — the whole matrix but the switch-off row runs on.
  await setPeerSharing(true);

  await pushProject(alpha.id, SRC_ID, SRC_MANIFEST);
  await pushProject(bravo.id, "p-bravo-own", {
    schemaVersion: 2,
    id: "p-bravo-own",
    title: "Bravo's Own",
    goal: "physics",
    projectType: "custom",
    createdAt: 1000,
    updatedAt: 2000,
  });
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

/* Every case restores the world it disturbed: the gate checks group membership
 * BEFORE the assignment rules, so a leaked groups row would shadow every later
 * refusal and the happy path itself. */
describe("POST /api/shares — the D§5 gate", () => {
  // A4d: the gate's untested first branch — a well-formed but unknown
  // class id never even reaches the membership check.
  test("an unknown but well-formed class id -> 404 No such class.", async () => {
    const res = await postShare(alpha.cookie, { classId: "00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such class.");
  });

  test("the class switch is off -> 403", async () => {
    await setPeerSharing(false);
    try {
      const res = await postShare(alpha.cookie);
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Peer sharing is off for this class.");
    } finally {
      await setPeerSharing(true);
    }
  });

  test("the sharer is not in the class -> 403", async () => {
    const res = await postShare(outsiderCookie);
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Not a member of this class.");
  });

  test("the recipient is not an active member -> 400", async () => {
    await testDb
      .update(classMembers)
      .set({ status: "waiting" })
      .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, bravo.id)));
    try {
      const res = await postShare(alpha.cookie);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("They're not an active member of this class.");
    } finally {
      await testDb
        .update(classMembers)
        .set({ status: "active" })
        .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, bravo.id)));
    }
  });

  test("sharing with yourself -> 400", async () => {
    const res = await postShare(alpha.cookie, { recipientId: alpha.id });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("You can't share a project with yourself.");
  });

  test("a project the sharer does not own -> 404", async () => {
    const res = await postShare(alpha.cookie, { projectId: "p-bravo-own" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such project.");
  });

  test("a tombstoned project -> 404", async () => {
    await testDb
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(and(eq(projects.ownerId, alpha.id), eq(projects.id, SRC_ID)));
    try {
      const res = await postShare(alpha.cookie);
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("No such project.");
    } finally {
      await testDb
        .update(projects)
        .set({ deletedAt: null })
        .where(and(eq(projects.ownerId, alpha.id), eq(projects.id, SRC_ID)));
    }
  });

  test("a group's shared project -> 403", async () => {
    const a = await insertAssignment({ submissionMode: "group" });
    await testDb.insert(groups).values({
      assignmentId: a.id,
      name: "Group 1",
      ownerId: alpha.id,
      projectId: SRC_ID,
    });
    try {
      const res = await postShare(alpha.cookie);
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe(
        "A group's shared project belongs to the whole group — it can't be shared out.",
      );
    } finally {
      // The groups row cascades with its assignment.
      await testDb.delete(assignments).where(eq(assignments.id, a.id));
    }
  });

  test("assignment work marked individual -> 403", async () => {
    const a = await insertAssignment({
      individualWork: true,
      rules: BUILT_IN_RULE_SETS.open_practice,
    });
    await testDb.insert(assignmentWork).values({
      assignmentId: a.id,
      userId: alpha.id,
      ownerId: alpha.id,
      projectId: SRC_ID,
    });
    try {
      const res = await postShare(alpha.cookie);
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("This assignment is individual work — it can't be shared.");
    } finally {
      await testDb.delete(assignments).where(eq(assignments.id, a.id));
    }
  });

  test("assignment rules with export off -> 403", async () => {
    const a = await insertAssignment({
      individualWork: false,
      rules: BUILT_IN_RULE_SETS.locked_assessment,
    });
    await testDb.insert(assignmentWork).values({
      assignmentId: a.id,
      userId: alpha.id,
      ownerId: alpha.id,
      projectId: SRC_ID,
    });
    try {
      const res = await postShare(alpha.cookie);
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe(
        "This assignment's rules don't allow copies to leave the workspace.",
      );
    } finally {
      await testDb.delete(assignments).where(eq(assignments.id, a.id));
    }
  });

  test("an archived class -> 400", async () => {
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    try {
      const res = await postShare(alpha.cookie);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("That class is archived.");
    } finally {
      await app.inject({
        method: "POST",
        url: `/api/classes/${classId}/unarchive`,
        cookies: { pide_session: teacherCookie },
      });
    }
  });

  test("the gate left nothing behind — no shares row from any refusal", async () => {
    expect(await testDb.select().from(shares)).toHaveLength(0);
    expect(await eventsOfType("project.shared")).toHaveLength(0);
  });
});

describe("POST /api/shares — the hand-off", () => {
  test("the happy path -> 201, frozen from the server head, ledgered", async () => {
    const res = await postShare(alpha.cookie);
    expect(res.statusCode).toBe(201);
    const share = res.json().share;
    expect(share).toEqual({
      id: expect.any(String),
      classId,
      recipientId: bravo.id,
      status: "pending",
    });

    const rows = await testDb.select().from(shares);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(share.id);
    expect(rows[0].sharerId).toBe(alpha.id);
    expect(rows[0].sourceOwnerId).toBe(alpha.id);
    expect(rows[0].sourceProjectId).toBe(SRC_ID);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].copyProjectId).toBeNull();
    expect(rows[0].frozenManifest).toEqual(SRC_MANIFEST);
    expect(rows[0].sourceClientUpdatedAt).toBe(5000);

    const logged = await eventsOfType("project.shared");
    expect(logged).toHaveLength(1);
    expect(logged[0].actorId).toBe(alpha.id);
    expect(logged[0].payload).toEqual({
      shareId: share.id,
      classId,
      recipientId: bravo.id,
      sourceOwnerId: alpha.id,
      sourceProjectId: SRC_ID,
      sourceClientUpdatedAt: 5000,
      sourceAttribution: null,
    });

    // Task 5, site 10: the recipient (and only the recipient) is notified,
    // eventId pointing at the ledger row just asserted above.
    const recipientNotifs = await notificationsFor(bravo.id);
    const mineNotif = recipientNotifs.filter((n) => n.eventId === logged[0].id);
    expect(mineNotif).toHaveLength(1);
    expect(mineNotif[0].type).toBe("project.shared");
    expect(mineNotif[0].payload).toEqual({
      shareId: share.id,
      classId,
      sharerId: alpha.id,
      title: "Pendulum",
    });
    // Negative: the sharer (alpha) is not addressed about their own share.
    expect((await notificationsFor(alpha.id)).filter((n) => n.eventId === logged[0].id)).toHaveLength(0);
  });

  test("sharing the same project with the same person twice -> 409", async () => {
    await pushProject(alpha.id, "p-share-dup", {
      schemaVersion: 2,
      id: "p-share-dup",
      title: "Second Pendulum",
      goal: "physics",
      projectType: "custom",
      createdAt: 1000,
      updatedAt: 7000,
    });
    const first = await postShare(alpha.cookie, { projectId: "p-share-dup" });
    expect(first.statusCode).toBe(201);
    const second = await postShare(alpha.cookie, { projectId: "p-share-dup" });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe(
      "Already shared with them — it's waiting on their class page.",
    );
    // The refusal wrote nothing: still one row for this pair.
    const rows = await testDb
      .select()
      .from(shares)
      .where(eq(shares.sourceProjectId, "p-share-dup"));
    expect(rows).toHaveLength(1);
  });

  /* D§1's dup-check is deliberately class-blind: it keys on
   * (sourceOwnerId, sourceProjectId, recipientId, status=pending), not on
   * classId. A second class both alpha and bravo belong to still finds the
   * first class's pending row and refuses — pinned here so that behavior
   * reads as intended, not as an oversight. */
  test("the dup-check is class-blind: a pending share to the same recipient for the same project via a DIFFERENT class also 409s", async () => {
    await pushProject(alpha.id, "p-share-dup-cross-class", {
      schemaVersion: 2,
      id: "p-share-dup-cross-class",
      title: "Cross-Class Pendulum",
      goal: "physics",
      projectType: "custom",
      createdAt: 1000,
      updatedAt: 7000,
    });
    const first = await postShare(alpha.cookie, { projectId: "p-share-dup-cross-class" });
    expect(first.statusCode).toBe(201);

    const otherClassRes = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Other Sharing Class" },
    });
    const otherClassId = otherClassRes.json().class.id;
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${otherClassId}`,
      cookies: { pide_session: teacherCookie },
      payload: { peerSharing: true },
    });
    await testDb.insert(classMembers).values([
      { classId: otherClassId, userId: alpha.id, role: "student", status: "active" },
      { classId: otherClassId, userId: bravo.id, role: "student", status: "active" },
    ]);
    try {
      const second = await app.inject({
        method: "POST",
        url: "/api/shares",
        cookies: { pide_session: alpha.cookie },
        payload: { classId: otherClassId, recipientId: bravo.id, projectId: "p-share-dup-cross-class" },
      });
      expect(second.statusCode).toBe(409);
      expect(second.json().error).toBe(
        "Already shared with them — it's waiting on their class page.",
      );
      // Still just the one pending row from the first class.
      const rows = await testDb
        .select()
        .from(shares)
        .where(eq(shares.sourceProjectId, "p-share-dup-cross-class"));
      expect(rows).toHaveLength(1);
    } finally {
      await testDb.delete(classMembers).where(eq(classMembers.classId, otherClassId));
    }
  });

  test("a malformed body -> 400 without touching the table", async () => {
    const before = await testDb.select().from(shares);
    const res = await postShare(alpha.cookie, { projectId: "not-a-project-id" });
    expect(res.statusCode).toBe(400);
    expect(await testDb.select().from(shares)).toHaveLength(before.length);
  });

  test("signed out -> 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/shares",
      payload: { classId, recipientId: bravo.id, projectId: SRC_ID },
    });
    expect(res.statusCode).toBe(401);
  });
});

/* A1: the friendly read-then-409 dup check above is TOCTOU under concurrent
 * identical POSTs — shares_pending_dedup_idx (schema.ts) is the real
 * backstop. These two tests go straight at the table, bypassing the route,
 * to prove the partial unique index exists and fires, and that its WHERE
 * clause is scoped to pending only (a resolved row never blocks a fresh
 * share of the same triple). */
describe("shares — the pending-share unique backstop (A1)", () => {
  function directShareRow(projectId: string) {
    return {
      classId,
      sharerId: alpha.id,
      recipientId: bravo.id,
      sourceOwnerId: alpha.id,
      sourceProjectId: projectId,
      frozenManifest: {
        schemaVersion: 2,
        id: projectId,
        title: "Backstop Fixture",
        goal: "physics",
        projectType: "custom",
        createdAt: 1000,
        updatedAt: 1000,
      },
      sourceClientUpdatedAt: 1000,
    };
  }

  test("a second direct pending insert for the same (sourceOwnerId, sourceProjectId, recipientId) triple hits the unique violation", async () => {
    const projectId = "p-backstop-race";
    await testDb.insert(shares).values(directShareRow(projectId));
    try {
      let caught: unknown = null;
      try {
        await testDb.insert(shares).values(directShareRow(projectId));
      } catch (err) {
        caught = err;
      }
      expect(caught).not.toBeNull();
      expect(pgErrorCode(caught)).toBe("23505");
      // The race loser never landed: still exactly one row for this triple.
      const rows = await testDb.select().from(shares).where(eq(shares.sourceProjectId, projectId));
      expect(rows).toHaveLength(1);
    } finally {
      await testDb.delete(shares).where(eq(shares.sourceProjectId, projectId));
    }
  });

  test("a REVOKED row and a fresh pending row for the same triple coexist — the WHERE clause scopes to pending only", async () => {
    const projectId = "p-backstop-coexist";
    await pushProject(alpha.id, projectId, {
      schemaVersion: 2,
      id: projectId,
      title: "Coexist Fixture",
      goal: "physics",
      projectType: "custom",
      createdAt: 1000,
      updatedAt: 6000,
    });
    try {
      const first = await postShare(alpha.cookie, { projectId });
      expect(first.statusCode).toBe(201);
      const firstId = first.json().share.id as string;

      const revoke = await app.inject({
        method: "POST",
        url: `/api/shares/${firstId}/revoke`,
        cookies: { pide_session: alpha.cookie },
      });
      expect(revoke.statusCode).toBe(200);

      // Resolved (revoked), so a fresh share of the same triple through the
      // route succeeds — the partial index never sees the revoked row.
      const second = await postShare(alpha.cookie, { projectId });
      expect(second.statusCode).toBe(201);

      const rows = await testDb.select().from(shares).where(eq(shares.sourceProjectId, projectId));
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.status).sort()).toEqual(["pending", "revoked"]);
    } finally {
      await testDb.delete(shares).where(eq(shares.sourceProjectId, projectId));
    }
  });

  // Reviewer finding: the route-side 23505->409 mapping (shares.ts's nested
  // savepoint around the insert) was previously untested — the read-then-409
  // check above queries the SAME predicate the index enforces, so single
  // threaded it always wins the race and the catch branch never fires. Two
  // requests fired together are the only way to force the TOCTOU window: one
  // wins the read, the other either also passes the read (and is caught by
  // shares_pending_dedup_idx at insert time) or loses the read outright.
  // Either way the assertion is the same and is correct under BOTH outcomes
  // — non-flaky — and fails loudly (statuses wouldn't sort to [201, 409]) if
  // the race loser ever gets an unhandled 500 instead of the 409.
  test("two identical concurrent POST /api/shares — the race loser gets 409 ALREADY_PENDING, never a 500", async () => {
    const projectId = "p-backstop-concurrent";
    await pushProject(alpha.id, projectId, {
      schemaVersion: 2,
      id: projectId,
      title: "Concurrent Fixture",
      goal: "physics",
      projectType: "custom",
      createdAt: 1000,
      updatedAt: 1000,
    });
    try {
      const [a, b] = await Promise.all([
        postShare(alpha.cookie, { projectId }),
        postShare(alpha.cookie, { projectId }),
      ]);
      const statuses = [a.statusCode, b.statusCode].sort((x, y) => x - y);
      expect(statuses).toEqual([201, 409]);
      const loser = a.statusCode === 409 ? a : b;
      expect(loser.json().error).toBe(
        "Already shared with them — it's waiting on their class page.",
      );
      const rows = await testDb.select().from(shares).where(eq(shares.sourceProjectId, projectId));
      expect(rows).toHaveLength(1);
    } finally {
      await testDb.delete(shares).where(eq(shares.sourceProjectId, projectId));
    }
  });
});

/* The gate's rules loop refuses on BOTH an unparseable rules blob and a
 * parsed one with exportAndCopy off — one sentence, two branches. Without a
 * positive case the whole loop could be refusing everything (a schema that
 * failed to parse open_practice, say) and the export-off row would still be
 * green, so the pair below pins the loop from both sides. */
describe("POST /api/shares — the assignment-rules loop, both ways", () => {
  /** The rules fixture: alpha's project linked to an assignment as her work. */
  async function withWork(
    projectId: string,
    updatedAt: number,
    rules: unknown,
    run: () => Promise<void>,
  ) {
    await pushProject(alpha.id, projectId, {
      schemaVersion: 2,
      id: projectId,
      title: "Rules Fixture",
      goal: "physics",
      projectType: "custom",
      createdAt: 1000,
      updatedAt,
    });
    const a = await insertAssignment({ individualWork: false, rules });
    await testDb.insert(assignmentWork).values({
      assignmentId: a.id,
      userId: alpha.id,
      ownerId: alpha.id,
      projectId,
    });
    // The link is the whole point of these two tests — if it silently failed
    // to land, the loop would never run and a 201 would prove nothing.
    const linked = await testDb
      .select()
      .from(assignmentWork)
      .where(and(eq(assignmentWork.ownerId, alpha.id), eq(assignmentWork.projectId, projectId)));
    expect(linked).toHaveLength(1);
    try {
      await run();
    } finally {
      // assignment_work cascades with its assignment.
      await testDb.delete(assignments).where(eq(assignments.id, a.id));
      await testDb.delete(shares).where(eq(shares.sourceProjectId, projectId));
    }
  }

  test("rules that allow export -> 201, the loop lets the share through", async () => {
    await withWork("p-rules-ok", 8000, BUILT_IN_RULE_SETS.open_practice, async () => {
      const res = await postShare(alpha.cookie, { projectId: "p-rules-ok" });
      expect(res.statusCode).toBe(201);
      expect(res.json().share.status).toBe("pending");
      const rows = await testDb
        .select()
        .from(shares)
        .where(eq(shares.sourceProjectId, "p-rules-ok"));
      expect(rows).toHaveLength(1);
      expect(rows[0].sourceClientUpdatedAt).toBe(8000);
    });
  });

  test("rules that will not parse -> 403, failing closed on the export sentence", async () => {
    await withWork("p-rules-junk", 9000, { nonsense: true }, async () => {
      const res = await postShare(alpha.cookie, { projectId: "p-rules-junk" });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe(
        "This assignment's rules don't allow copies to leave the workspace.",
      );
      expect(
        await testDb.select().from(shares).where(eq(shares.sourceProjectId, "p-rules-junk")),
      ).toHaveLength(0);
    });
  });
});

/** A fresh project + pending share, alpha -> bravo, on its own project id so
 *  each test's assertions never depend on rows other tests left behind. */
async function freshPendingShare(suffix: string): Promise<string> {
  const projectId = `p-inc-${suffix}`;
  await pushProject(alpha.id, projectId, {
    schemaVersion: 2,
    id: projectId,
    title: `Fixture ${suffix}`,
    goal: "physics",
    projectType: "custom",
    createdAt: 1000,
    updatedAt: 4000,
  });
  const res = await postShare(alpha.cookie, { projectId });
  expect(res.statusCode).toBe(201);
  return res.json().share.id as string;
}

describe("GET /api/shares/incoming", () => {
  test("lists the pending share addressed to the caller: sharerName + frozen title, newest first", async () => {
    const shareId = await freshPendingShare("list");
    const res = await app.inject({
      method: "GET",
      url: `/api/shares/incoming?classId=${classId}`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(200);
    const entry = (res.json().shares as Array<{ id: string }>).find((s) => s.id === shareId);
    expect(entry).toEqual({
      id: shareId,
      classId,
      title: "Fixture list",
      sharerName: "shalpha",
      createdAt: expect.any(Number),
    });
  });

  test("a revoked, lapsed, or accepted share does not show up", async () => {
    const revokedId = await freshPendingShare("revoked");
    const lapsedId = await freshPendingShare("lapsed");
    const acceptedId = await freshPendingShare("accepted");

    const revokeRes = await app.inject({
      method: "POST",
      url: `/api/shares/${revokedId}/revoke`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(revokeRes.statusCode).toBe(200);
    // accept doesn't exist yet (Task 9) — a direct table write stands in for it.
    await testDb
      .update(shares)
      .set({ status: "lapsed", resolvedAt: new Date() })
      .where(eq(shares.id, lapsedId));
    await testDb
      .update(shares)
      .set({ status: "accepted", resolvedAt: new Date() })
      .where(eq(shares.id, acceptedId));

    const res = await app.inject({
      method: "GET",
      url: `/api/shares/incoming?classId=${classId}`,
      cookies: { pide_session: bravo.cookie },
    });
    const ids = (res.json().shares as Array<{ id: string }>).map((s) => s.id);
    expect(ids).not.toContain(revokedId);
    expect(ids).not.toContain(lapsedId);
    expect(ids).not.toContain(acceptedId);
  });

  // A4b: two pending shares, distinct createdAt set directly (defaultNow()
  // gives no ordering guarantee tight enough to assert on) — pins index
  // order, the "Untitled project" fallback for a titleless frozen manifest,
  // and that createdAt crosses the wire as epoch MILLISECONDS.
  test("two pending shares: newest first, a titleless manifest falls back to 'Untitled project', createdAt is epoch ms", async () => {
    const olderId = await freshPendingShare("order-older");
    const newerId = await freshPendingShare("order-newer");
    const now = Date.now();
    await testDb
      .update(shares)
      .set({ createdAt: new Date(now - 60_000) })
      .where(eq(shares.id, olderId));
    await testDb.update(shares).set({ createdAt: new Date(now) }).where(eq(shares.id, newerId));
    // Strip the title from the OLDER row's frozen manifest directly.
    await testDb
      .update(shares)
      .set({
        frozenManifest: {
          schemaVersion: 2,
          id: "p-inc-order-older",
          goal: "physics",
          projectType: "custom",
          createdAt: 1000,
          updatedAt: 4000,
        },
      })
      .where(eq(shares.id, olderId));

    const res = await app.inject({
      method: "GET",
      url: `/api/shares/incoming?classId=${classId}`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().shares as Array<{ id: string; title: string; createdAt: number }>;
    const olderIdx = list.findIndex((s) => s.id === olderId);
    const newerIdx = list.findIndex((s) => s.id === newerId);
    expect(olderIdx).toBeGreaterThan(-1);
    expect(newerIdx).toBeGreaterThan(-1);
    // Newest first: the later-created row comes BEFORE the earlier one.
    expect(newerIdx).toBeLessThan(olderIdx);
    expect(list[olderIdx].title).toBe("Untitled project");
    expect(list[newerIdx].createdAt).toBeGreaterThan(1_600_000_000_000);
    expect(list[olderIdx].createdAt).toBeGreaterThan(1_600_000_000_000);
  });
});

describe("GET /api/shares/roster/:classId", () => {
  test("active members minus the caller, name-ordered, names only — never alpha, never an email key", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/shares/roster/${classId}`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(res.statusCode).toBe(200);
    const members = res.json().members as Array<Record<string, unknown>>;
    expect(members).toEqual([
      { userId: bravo.id, name: "shbravo", role: "student" },
      { userId: teacherId, name: "shteach", role: "teacher" },
    ]);
    expect(Object.keys(members[0])).toEqual(["userId", "name", "role"]);
    expect(members.some((m) => m.userId === alpha.id)).toBe(false);
  });

  test("the switch off -> 403 SHARING_OFF, not a roster browse through a disabled feature", async () => {
    await setPeerSharing(false);
    try {
      const res = await app.inject({
        method: "GET",
        url: `/api/shares/roster/${classId}`,
        cookies: { pide_session: alpha.cookie },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Peer sharing is off for this class.");
    } finally {
      await setPeerSharing(true);
    }
  });
});

/* A2: a malformed :id/:classId can never exist — same posture as missing,
 * never a 500. GET /api/shares/incoming already zod-parses its ?classId
 * query param (verified above, left as-is). */
describe("uuid param parsing on the share routes (A2)", () => {
  test("POST /api/shares/:id/accept with a malformed id -> 404 No such share.", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/shares/not-a-uuid/accept",
      cookies: { pide_session: bravo.cookie },
      payload: { projectId: "p-copy-malformed" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such share.");
  });

  test("POST /api/shares/:id/revoke with a malformed id -> 404 No such share.", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/shares/not-a-uuid/revoke",
      cookies: { pide_session: alpha.cookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such share.");
  });

  test("GET /api/shares/roster/:classId with a malformed id -> 404 No such class.", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/shares/roster/not-a-uuid",
      cookies: { pide_session: alpha.cookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such class.");
  });
});

describe("POST /api/shares/:id/revoke", () => {
  test("the sharer revokes a pending share: flips to revoked, resolvedAt set, logged", async () => {
    const shareId = await freshPendingShare("revoke-happy");
    const res = await app.inject({
      method: "POST",
      url: `/api/shares/${shareId}/revoke`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const [row] = await testDb.select().from(shares).where(eq(shares.id, shareId));
    expect(row.status).toBe("revoked");
    expect(row.resolvedAt).not.toBeNull();

    const logged = await eventsOfType("project.share_revoked");
    const entry = logged.find((e) => (e.payload as { shareId: string }).shareId === shareId);
    expect(entry).toBeDefined();
    expect(entry!.actorId).toBe(alpha.id);
    expect(entry!.payload).toEqual({
      shareId,
      classId,
      sharerId: alpha.id,
      recipientId: bravo.id,
    });
  });

  test("the recipient cannot revoke -> 403 REVOKE_FORBIDDEN", async () => {
    const shareId = await freshPendingShare("revoke-recipient");
    const res = await app.inject({
      method: "POST",
      url: `/api/shares/${shareId}/revoke`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Only the sharer or the class teacher can revoke a share.");
  });

  // CONTROLLER RULING: a TA sees the share exists (staff, not a stranger —
  // maySee widened to isStaffRole) but is not the sharer or the teacher, so
  // this lands on 403 REVOKE_FORBIDDEN, never the draft-404 a non-party gets.
  test("a TA (class staff, not the sharer or teacher) cannot revoke -> 403 REVOKE_FORBIDDEN", async () => {
    await testDb.insert(classMembers).values({ classId, userId: ta.id, role: "ta", status: "active" });
    try {
      const shareId = await freshPendingShare("revoke-ta");
      const res = await app.inject({
        method: "POST",
        url: `/api/shares/${shareId}/revoke`,
        cookies: { pide_session: ta.cookie },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Only the sharer or the class teacher can revoke a share.");
    } finally {
      await testDb
        .delete(classMembers)
        .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, ta.id)));
    }
  });

  // A4a: a plain student who is neither sharer, recipient, nor staff has no
  // standing on the share at all — the draft 404, same posture a stranger
  // outside the class entirely would get (contrast with the TA above, whose
  // staff hat earns them the honest 403).
  test("an active non-party plain student (not sharer, not recipient, not staff) -> 404 NO_SUCH_SHARE", async () => {
    const stranger = await makeUser("shstranger@example.com");
    const strangerCookie = await signin("shstranger@example.com");
    await testDb
      .insert(classMembers)
      .values({ classId, userId: stranger.id, role: "student", status: "active" });
    try {
      const shareId = await freshPendingShare("revoke-stranger-student");
      const res = await app.inject({
        method: "POST",
        url: `/api/shares/${shareId}/revoke`,
        cookies: { pide_session: strangerCookie },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("No such share.");
    } finally {
      await testDb
        .delete(classMembers)
        .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, stranger.id)));
      await testDb.delete(users).where(eq(users.id, stranger.id));
    }
  });

  test("revoking a share twice -> 409 SHARE_RESOLVED", async () => {
    const shareId = await freshPendingShare("revoke-twice");
    const first = await app.inject({
      method: "POST",
      url: `/api/shares/${shareId}/revoke`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: "POST",
      url: `/api/shares/${shareId}/revoke`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("That share has already been dealt with.");
  });

  // D§2 fiat, pinned: project.share_revoked mints NOTHING — the ledger row
  // above is the whole record. Counted as a delta (not an absolute zero)
  // because earlier tests in this file already minted notifications for
  // unrelated shares.
  test("revoking a share mints no notification row — the D§2 fiat", async () => {
    const shareId = await freshPendingShare("revoke-zero-mint");
    const before = await testDb.select().from(notifications);

    const res = await app.inject({
      method: "POST",
      url: `/api/shares/${shareId}/revoke`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(res.statusCode).toBe(200);

    const after = await testDb.select().from(notifications);
    expect(after).toHaveLength(before.length);
  });
});

// D§2 fiat, pinned in the suite that owns share resolution: switching a
// class's peer sharing off lapses every pending share (classes.ts's
// lapsePendingShares, driven here through the same setPeerSharing helper
// this file already uses for the D§5 gate), but project.share_lapsed mints
// NOTHING — same posture as revoke above, delta not absolute-zero.
describe("PATCH peerSharing:false lapses pending shares, minting no notification (Task 5, D§2)", () => {
  test("a pending share lapses on switch-off but mints no notification row", async () => {
    const shareId = await freshPendingShare("lapse-zero-mint");
    const before = await testDb.select().from(notifications);

    await setPeerSharing(false);
    try {
      const [row] = await testDb.select().from(shares).where(eq(shares.id, shareId));
      expect(row.status).toBe("lapsed");

      const after = await testDb.select().from(notifications);
      expect(after).toHaveLength(before.length);
    } finally {
      await setPeerSharing(true);
    }
  });
});

/** A fresh alpha->bravo pending share on its own project id, for the accept
 *  tests — self-contained (no reliance on any other describe block's
 *  leftover rows) so each case's fixture hygiene doesn't leak into the next.
 *  `updatedAt` defaults to 5000, matching the SRC_MANIFEST convention this
 *  file already uses, so the happy-path clientUpdatedAt assertion reads as
 *  a normal fixture value rather than a magic number. */
async function freshAcceptShare(suffix: string, updatedAt = 5000) {
  const projectId = `p-acc-${suffix}`;
  const manifest = {
    schemaVersion: 2,
    id: projectId,
    title: `Accept Fixture ${suffix}`,
    goal: "physics",
    projectType: "custom",
    createdAt: 1000,
    updatedAt,
  };
  await pushProject(alpha.id, projectId, manifest);
  const res = await postShare(alpha.cookie, { projectId });
  expect(res.statusCode).toBe(201);
  return { shareId: res.json().share.id as string, projectId, manifest };
}

async function acceptShare(cookie: string, shareId: string, projectId: string) {
  return app.inject({
    method: "POST",
    url: `/api/shares/${shareId}/accept`,
    cookies: { pide_session: cookie },
    payload: { projectId },
  });
}

describe("POST /api/shares/:id/accept", () => {
  test("bravo accepts: the copy is minted with the frozen manifest, attributed, ledgered", async () => {
    const { shareId, projectId, manifest } = await freshAcceptShare("happy");
    const res = await acceptShare(bravo.cookie, shareId, "p-copy-1");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const expectedManifest = { ...manifest, id: "p-copy-1" };
    expect(body.manifest).toEqual(expectedManifest);
    expect(body.attribution).toEqual({ sharerId: alpha.id, shareId, sharerName: "shalpha" });

    const rows = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, bravo.id), eq(projects.id, "p-copy-1")));
    expect(rows).toHaveLength(1);
    expect(rows[0].manifest).toEqual(expectedManifest);
    expect(rows[0].clientUpdatedAt).toBe(5000);
    expect(rows[0].attribution).toEqual({ sharerId: alpha.id, shareId });
    // The load-bearing property: the row's stored manifest and the reply's
    // manifest are canonically identical — this is what makes the client's
    // later push land in projects.ts's identical-re-push no-op branch.
    expect(stableStringify(rows[0].manifest)).toBe(stableStringify(body.manifest));

    const [shareRow] = await testDb.select().from(shares).where(eq(shares.id, shareId));
    expect(shareRow.status).toBe("accepted");
    expect(shareRow.copyProjectId).toBe("p-copy-1");
    expect(shareRow.resolvedAt).not.toBeNull();

    const logged = await eventsOfType("project.share_accepted");
    // A4c: exactly one — not just "at least one" — project.share_accepted
    // event for this share.
    const matching = logged.filter((e) => (e.payload as { shareId: string }).shareId === shareId);
    expect(matching).toHaveLength(1);
    const entry = matching[0];
    expect(entry.actorId).toBe(bravo.id);
    expect(entry.payload).toEqual({
      shareId,
      classId,
      sharerId: alpha.id,
      sourceOwnerId: alpha.id,
      sourceProjectId: projectId,
      sourceClientUpdatedAt: 5000,
      copyProjectId: "p-copy-1",
    });

    // Task 5, site 11: the original sharer (and only the sharer) is
    // notified, eventId pointing at the share_accepted ledger row above.
    const sharerNotifs = await notificationsFor(alpha.id);
    const mineNotif = sharerNotifs.filter((n) => n.eventId === entry.id);
    expect(mineNotif).toHaveLength(1);
    expect(mineNotif[0].type).toBe("project.share_accepted");
    expect(mineNotif[0].payload).toEqual({
      shareId,
      classId,
      recipientId: bravo.id,
      title: manifest.title,
    });
    // Negative: the accepting recipient (bravo) is not addressed about their
    // own acceptance.
    expect((await notificationsFor(bravo.id)).filter((n) => n.eventId === entry.id)).toHaveLength(0);
  });

  test("the copy survives the source's death: tombstoning the source doesn't touch the frozen manifest", async () => {
    const { shareId, projectId, manifest } = await freshAcceptShare("tomb");
    await testDb
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(and(eq(projects.ownerId, alpha.id), eq(projects.id, projectId)));

    const res = await acceptShare(bravo.cookie, shareId, "p-copy-tomb");
    expect(res.statusCode).toBe(200);
    expect(res.json().manifest).toEqual({ ...manifest, id: "p-copy-tomb" });
  });

  test("the cap: bravo at 100 live projects -> 403 with the share's own sentence, share stays pending", async () => {
    const { shareId } = await freshAcceptShare("cap");
    const fillIds = Array.from({ length: MAX_PROJECTS_PER_USER }, (_, i) => `p-cap-fill-${i}`);
    await testDb.insert(projects).values(
      fillIds.map((id) => ({
        id,
        ownerId: bravo.id,
        title: "Filler",
        goal: "physics",
        projectType: "custom",
        manifest: {
          schemaVersion: 2,
          id,
          title: "Filler",
          goal: "physics",
          projectType: "custom",
          createdAt: 1000,
          updatedAt: 1000,
        },
        clientUpdatedAt: 1000,
      })),
    );
    try {
      const res = await acceptShare(bravo.cookie, shareId, "p-copy-cap");
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe(
        "You're at the 100-project limit — the copy needs a free slot. Delete something first, then add it.",
      );
      const [shareRow] = await testDb.select().from(shares).where(eq(shares.id, shareId));
      expect(shareRow.status).toBe("pending");
      expect(shareRow.copyProjectId).toBeNull();
      const copyRows = await testDb
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, bravo.id), eq(projects.id, "p-copy-cap")));
      expect(copyRows).toHaveLength(0);
    } finally {
      await testDb
        .delete(projects)
        .where(and(eq(projects.ownerId, bravo.id), inArray(projects.id, fillIds)));
    }
  });

  test("double accept -> 409 SHARE_RESOLVED", async () => {
    const { shareId } = await freshAcceptShare("double");
    const first = await acceptShare(bravo.cookie, shareId, "p-copy-double");
    expect(first.statusCode).toBe(200);
    const second = await acceptShare(bravo.cookie, shareId, "p-copy-double-2");
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe("That share has already been dealt with.");
  });

  test("accepting a revoked share -> 409 SHARE_RESOLVED", async () => {
    const { shareId } = await freshAcceptShare("revoked");
    const revoke = await app.inject({
      method: "POST",
      url: `/api/shares/${shareId}/revoke`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(revoke.statusCode).toBe(200);
    const res = await acceptShare(bravo.cookie, shareId, "p-copy-revoked");
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("That share has already been dealt with.");
  });

  test("a stranger accepting -> 404 NO_SUCH_SHARE", async () => {
    const { shareId } = await freshAcceptShare("stranger");
    const res = await acceptShare(outsiderCookie, shareId, "p-copy-stranger");
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such share.");
  });

  test("the sharer accepting their own share -> 404 NO_SUCH_SHARE", async () => {
    const { shareId } = await freshAcceptShare("sharer-self");
    const res = await acceptShare(alpha.cookie, shareId, "p-copy-sharer-self");
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such share.");
  });

  test("a recipient whose membership went waiting -> 403 NOT_A_MEMBER, share stays pending", async () => {
    const { shareId } = await freshAcceptShare("waiting");
    await testDb
      .update(classMembers)
      .set({ status: "waiting" })
      .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, bravo.id)));
    try {
      const res = await acceptShare(bravo.cookie, shareId, "p-copy-waiting");
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Not a member of this class.");
      const [shareRow] = await testDb.select().from(shares).where(eq(shares.id, shareId));
      expect(shareRow.status).toBe("pending");
    } finally {
      await testDb
        .update(classMembers)
        .set({ status: "active" })
        .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, bravo.id)));
    }
  });

  test("reusing the source's own id as the copy id is legal — it collides only if the recipient owns it", async () => {
    const { shareId, projectId } = await freshAcceptShare("reuse-id");
    const res = await acceptShare(bravo.cookie, shareId, projectId);
    expect(res.statusCode).toBe(200);
    const bravoRows = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, bravo.id), eq(projects.id, projectId)));
    expect(bravoRows).toHaveLength(1);
    // Alpha's own project under that same id is untouched — the composite
    // (ownerId, id) primary key means the two rows never collide.
    const alphaRows = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, alpha.id), eq(projects.id, projectId)));
    expect(alphaRows).toHaveLength(1);
  });

  test("COPY_ID_TAKEN: accepting with an id the recipient already owns -> 409, share stays pending", async () => {
    await pushProject(bravo.id, "p-copy-9", {
      schemaVersion: 2,
      id: "p-copy-9",
      title: "Bravo Already Has This",
      goal: "physics",
      projectType: "custom",
      createdAt: 1000,
      updatedAt: 1000,
    });
    const { shareId } = await freshAcceptShare("taken");
    const res = await acceptShare(bravo.cookie, shareId, "p-copy-9");
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("That project id is already in use — try again.");
    const [shareRow] = await testDb.select().from(shares).where(eq(shares.id, shareId));
    expect(shareRow.status).toBe("pending");
    expect(shareRow.copyProjectId).toBeNull();
  });

  // A4e: the previously unreachable branch — a frozen manifest that no
  // longer parses (corrupted directly, since the route itself only ever
  // freezes an already-valid manifest at share time).
  test("INVALID_MANIFEST: a corrupted frozenManifest -> 400, the branch nothing else reaches", async () => {
    const { shareId } = await freshAcceptShare("invalid-manifest");
    await testDb.update(shares).set({ frozenManifest: { garbage: true } }).where(eq(shares.id, shareId));
    const res = await acceptShare(bravo.cookie, shareId, "p-copy-invalid-manifest");
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That doesn't look like a valid project.");
    const [shareRow] = await testDb.select().from(shares).where(eq(shares.id, shareId));
    expect(shareRow.status).toBe("pending");
    expect(shareRow.copyProjectId).toBeNull();
  });
});

/* §11/D§9: the online name-refresh feed — names resolved at read time (so
 * erasure has one place to act) and a re-share chain that still labels only
 * the immediate sharer while the ledger keeps the whole provenance. */
describe("GET /api/shares/attributions", () => {
  test("bravo's map carries p-copy-1 with alpha's live name", async () => {
    // p-copy-1 was minted by the "bravo accepts" happy-path test above —
    // this block runs after it (fileParallelism is off, tests run in
    // declared order), so the row is already there.
    const [shareRow] = await testDb.select().from(shares).where(eq(shares.copyProjectId, "p-copy-1"));
    expect(shareRow).toBeDefined();

    const res = await app.inject({
      method: "GET",
      url: "/api/shares/attributions",
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().attributions["p-copy-1"]).toEqual({
      sharerId: alpha.id,
      shareId: shareRow.id,
      sharerName: "shalpha",
    });
  });

  test("erasure: alpha's user row deleted directly — her own projects cascade away, but the recipient's copy and the shares row survive (no FK), and every name that resolves reads Removed student", async () => {
    const erAlpha = await makeUser("sherase-alpha@example.com");
    const erBravo = await makeUser("sherase-bravo@example.com");
    const erAlphaCookie = await signin("sherase-alpha@example.com");
    const erBravoCookie = await signin("sherase-bravo@example.com");
    await testDb.insert(classMembers).values([
      { classId, userId: erAlpha.id, role: "student", status: "active" },
      { classId, userId: erBravo.id, role: "student", status: "active" },
    ]);
    try {
      await pushProject(erAlpha.id, "p-erase-src", {
        schemaVersion: 2,
        id: "p-erase-src",
        title: "Erasure Fixture",
        goal: "physics",
        projectType: "custom",
        createdAt: 1000,
        updatedAt: 3000,
      });
      const acceptedShareRes = await app.inject({
        method: "POST",
        url: "/api/shares",
        cookies: { pide_session: erAlphaCookie },
        payload: { classId, recipientId: erBravo.id, projectId: "p-erase-src" },
      });
      expect(acceptedShareRes.statusCode).toBe(201);
      const acceptedShareId = acceptedShareRes.json().share.id as string;
      const acceptRes = await acceptShare(erBravoCookie, acceptedShareId, "p-erase-copy");
      expect(acceptRes.statusCode).toBe(200);

      // A second, still-PENDING share, alive when alpha is erased — the
      // fresh incoming row the brief asks for.
      await pushProject(erAlpha.id, "p-erase-src-2", {
        schemaVersion: 2,
        id: "p-erase-src-2",
        title: "Erasure Fixture 2",
        goal: "physics",
        projectType: "custom",
        createdAt: 1000,
        updatedAt: 3000,
      });
      const pendingShareRes = await app.inject({
        method: "POST",
        url: "/api/shares",
        cookies: { pide_session: erAlphaCookie },
        payload: { classId, recipientId: erBravo.id, projectId: "p-erase-src-2" },
      });
      expect(pendingShareRes.statusCode).toBe(201);
      const pendingShareId = pendingShareRes.json().share.id as string;

      // The erasure itself — a direct delete on `users`, the way an admin's
      // erasure flow would do it. Neither `shares` nor `projects.attribution`
      // carries an FK to `users` (D§4/D§9), so this must NOT cascade either.
      await testDb.delete(users).where(eq(users.id, erAlpha.id));

      // alpha's OWN projects DID cascade away (projects.ownerId -> users FK).
      const alphaProjectsAfter = await testDb
        .select()
        .from(projects)
        .where(eq(projects.ownerId, erAlpha.id));
      expect(alphaProjectsAfter).toHaveLength(0);

      // SURVIVAL 1: the recipient's copy row.
      const copyRows = await testDb
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, erBravo.id), eq(projects.id, "p-erase-copy")));
      expect(copyRows).toHaveLength(1);
      expect(copyRows[0].attribution).toEqual({ sharerId: erAlpha.id, shareId: acceptedShareId });

      // SURVIVAL 2: the `shares` row itself, untouched.
      const [survivingShareRow] = await testDb.select().from(shares).where(eq(shares.id, acceptedShareId));
      expect(survivingShareRow).toBeDefined();
      expect(survivingShareRow.sharerId).toBe(erAlpha.id);

      const attrRes = await app.inject({
        method: "GET",
        url: "/api/shares/attributions",
        cookies: { pide_session: erBravoCookie },
      });
      expect(attrRes.statusCode).toBe(200);
      expect(attrRes.json().attributions["p-erase-copy"]).toEqual({
        sharerId: erAlpha.id,
        shareId: acceptedShareId,
        sharerName: "Removed student",
      });

      const incomingRes = await app.inject({
        method: "GET",
        url: `/api/shares/incoming?classId=${classId}`,
        cookies: { pide_session: erBravoCookie },
      });
      expect(incomingRes.statusCode).toBe(200);
      const pendingEntry = (incomingRes.json().shares as Array<{ id: string; sharerName: string }>).find(
        (s) => s.id === pendingShareId,
      );
      expect(pendingEntry).toBeDefined();
      expect(pendingEntry!.sharerName).toBe("Removed student");
    } finally {
      await testDb.delete(shares).where(eq(shares.recipientId, erBravo.id));
      await testDb.delete(users).where(eq(users.id, erBravo.id));
    }
  });

  test("the chain: bravo re-shares p-copy-1 onward to a fresh charlie — the new event's sourceAttribution names the FIRST share, and charlie's own attribution names bravo, not alpha", async () => {
    const [firstShareRow] = await testDb.select().from(shares).where(eq(shares.copyProjectId, "p-copy-1"));
    expect(firstShareRow).toBeDefined();

    const charlie = await makeUser("shcharlie@example.com");
    const charlieCookie = await signin("shcharlie@example.com");
    await testDb.insert(classMembers).values({ classId, userId: charlie.id, role: "student", status: "active" });
    try {
      const chainRes = await app.inject({
        method: "POST",
        url: "/api/shares",
        cookies: { pide_session: bravo.cookie },
        payload: { classId, recipientId: charlie.id, projectId: "p-copy-1" },
      });
      expect(chainRes.statusCode).toBe(201);
      const chainShareId = chainRes.json().share.id as string;

      // The ledger keeps the WHOLE provenance: sourceAttribution on the new
      // event equals the FIRST share's identity, not bravo's own.
      const logged = await eventsOfType("project.shared");
      const entry = logged.find((e) => (e.payload as { shareId: string }).shareId === chainShareId);
      expect(entry).toBeDefined();
      expect((entry!.payload as { sourceAttribution: unknown }).sourceAttribution).toEqual({
        sharerId: alpha.id,
        shareId: firstShareRow.id,
      });

      // The LABEL names only the immediate sharer: bravo, not alpha.
      const acceptRes = await acceptShare(charlieCookie, chainShareId, "p-chain-copy");
      expect(acceptRes.statusCode).toBe(200);
      expect(acceptRes.json().attribution).toEqual({
        sharerId: bravo.id,
        shareId: chainShareId,
        sharerName: "shbravo",
      });

      const attrRes = await app.inject({
        method: "GET",
        url: "/api/shares/attributions",
        cookies: { pide_session: charlieCookie },
      });
      expect(attrRes.statusCode).toBe(200);
      expect(attrRes.json().attributions["p-chain-copy"]).toEqual({
        sharerId: bravo.id,
        shareId: chainShareId,
        sharerName: "shbravo",
      });
    } finally {
      await testDb.delete(shares).where(eq(shares.recipientId, charlie.id));
      await testDb.delete(users).where(eq(users.id, charlie.id));
    }
  });
});
