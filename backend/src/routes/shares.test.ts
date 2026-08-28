import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { BUILT_IN_RULE_SETS } from "@physics-ide/shared";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import {
  users,
  classMembers,
  events,
  projects,
  assignments,
  assignmentWork,
  groups,
  shares,
} from "../db/schema.js";

const app = buildApp({ db: testDb });

let teacherCookie: string;
let outsiderCookie: string;
let classId: string;

type Member = { id: string; cookie: string };
const alpha = {} as Member;
const bravo = {} as Member;

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

  await makeUser("shteach@example.com", { isTeacher: true });
  const a = await makeUser("shalpha@example.com");
  const b = await makeUser("shbravo@example.com");
  await makeUser("shoutsider@example.com");

  teacherCookie = await signin("shteach@example.com");
  alpha.id = a.id;
  alpha.cookie = await signin("shalpha@example.com");
  bravo.id = b.id;
  bravo.cookie = await signin("shbravo@example.com");
  outsiderCookie = await signin("shoutsider@example.com");

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
