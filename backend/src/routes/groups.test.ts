import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, desc, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import {
  users,
  classMembers,
  emails,
  events,
  marks,
  projects,
  projectVersions,
  submissions,
  assignmentWork,
  groups,
  groupMembers,
} from "../db/schema.js";

const app = buildApp({ db: testDb });

let teacherCookie: string;
let classId: string;

type Member = { id: string; cookie: string };
const alpha = {} as Member;
const bravo = {} as Member;
const charlie = {} as Member;
let strangerCookie: string;

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
 * sized for humans and this file signs in five accounts (same helper shape
 * assignments.test.ts uses). */
let signinIpCounter = 0;
async function signin(email: string): Promise<string> {
  signinIpCounter += 1;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    remoteAddress: `10.98.${Math.floor(signinIpCounter / 250)}.${(signinIpCounter % 250) + 1}`,
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

async function eventsOfType(type: string) {
  return testDb.select().from(events).where(eq(events.type, type));
}

/** A published assignment in the shared class, in the given submission mode.
 *  `extra` carries whatever else a fixture needs (points, dueAt). */
async function makeAssignment(
  submissionMode: "individual" | "pair" | "group",
  title: string,
  extra: Record<string, unknown> = {},
) {
  const draft = await app.inject({
    method: "POST",
    url: `/api/classes/${classId}/assignments`,
    cookies: { pide_session: teacherCookie },
    payload: { title, submissionMode, ...extra },
  });
  const id = draft.json().assignment.id;
  await app.inject({
    method: "POST",
    url: `/api/assignments/${id}/publish`,
    cookies: { pide_session: teacherCookie },
  });
  return id as string;
}

/** The client's own pushed copy — the thing /start's FK points at. */
async function pushProject(ownerId: string, projectId: string, manifest: Record<string, unknown>) {
  await testDb.insert(projects).values({
    id: projectId,
    ownerId,
    title: "Shared Work",
    goal: "physics",
    projectType: "physics",
    manifest,
    clientUpdatedAt: (manifest.updatedAt as number) ?? Date.now(),
  });
}

async function createGroup(member: Member, assignmentId: string, name?: string) {
  return app.inject({
    method: "POST",
    url: `/api/assignments/${assignmentId}/groups`,
    cookies: { pide_session: member.cookie },
    payload: name ? { name } : {},
  });
}

async function joinGroup(member: Member, groupId: string) {
  return app.inject({
    method: "POST",
    url: `/api/groups/${groupId}/join`,
    cookies: { pide_session: member.cookie },
  });
}

async function takeBaton(member: Member, groupId: string) {
  return app.inject({
    method: "POST",
    url: `/api/groups/${groupId}/baton/take`,
    cookies: { pide_session: member.cookie },
  });
}

async function startWork(member: Member, assignmentId: string, projectId?: string) {
  return app.inject({
    method: "POST",
    url: `/api/assignments/${assignmentId}/start`,
    cookies: { pide_session: member.cookie },
    payload: projectId ? { projectId } : {},
  });
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);

  await makeUser("gteach@example.com", { isTeacher: true });
  const a = await makeUser("galpha@example.com");
  const b = await makeUser("gbravo@example.com");
  const c = await makeUser("gcharlie@example.com");
  await makeUser("gstranger@example.com");

  teacherCookie = await signin("gteach@example.com");
  alpha.id = a.id;
  alpha.cookie = await signin("galpha@example.com");
  bravo.id = b.id;
  bravo.cookie = await signin("gbravo@example.com");
  charlie.id = c.id;
  charlie.cookie = await signin("gcharlie@example.com");
  strangerCookie = await signin("gstranger@example.com");

  const classRes = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: teacherCookie },
    payload: { name: "Group Work Class" },
  });
  classId = classRes.json().class.id;
  await testDb.insert(classMembers).values([
    { classId, userId: alpha.id, role: "student", status: "active" },
    { classId, userId: bravo.id, role: "student", status: "active" },
    { classId, userId: charlie.id, role: "student", status: "active" },
  ]);
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/assignments/:id/groups", () => {
  let pairId: string;

  beforeAll(async () => {
    pairId = await makeAssignment("pair", "Forming Groups");
  });

  test("a member creates a group -> 201, auto-named Group 1, they are its only member, event logged", async () => {
    const res = await createGroup(alpha, pairId);
    expect(res.statusCode).toBe(201);
    const group = res.json().group;
    expect(group.name).toBe("Group 1");
    expect(group.projectId).toBeNull();
    expect(group.members).toEqual([{ userId: alpha.id, name: "galpha" }]);

    const rows = await testDb.select().from(groups).where(eq(groups.assignmentId, pairId));
    expect(rows).toHaveLength(1);

    const evts = await eventsOfType("group.created");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === group.id)).toBe(true);
  });

  test("the next member's group auto-names Group 2; a supplied name is used and trimmed", async () => {
    const second = await createGroup(bravo, pairId);
    expect(second.statusCode).toBe(201);
    expect(second.json().group.name).toBe("Group 2");

    const namedAssignment = await makeAssignment("group", "Named Groups");
    const named = await createGroup(charlie, namedAssignment, "  The Cannons  ");
    expect(named.statusCode).toBe(201);
    expect(named.json().group.name).toBe("The Cannons");
  });

  test("a member already in a group for this assignment cannot start a second one", async () => {
    const res = await createGroup(alpha, pairId);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("You are already in a group for this assignment.");
  });

  test("two simultaneous creations by ONE student still leave them in a single group", async () => {
    const raceId = await makeAssignment("group", "Double-Tapped Create");
    const [first, second] = await Promise.all([createGroup(charlie, raceId), createGroup(charlie, raceId)]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([201, 400]);
    const refused = first.statusCode === 400 ? first : second;
    expect(refused.json().error).toBe("You are already in a group for this assignment.");

    const rows = await testDb.select().from(groups).where(eq(groups.assignmentId, raceId));
    expect(rows).toHaveLength(1);
  });

  test("an individually-submitted assignment has no groups to form", async () => {
    const soloId = await makeAssignment("individual", "Solo Work");
    const res = await createGroup(alpha, soloId);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("This assignment is not group work.");
  });

  test("a non-member of the class 403s; an unknown assignment 404s", async () => {
    const outsider = await app.inject({
      method: "POST",
      url: `/api/assignments/${pairId}/groups`,
      cookies: { pide_session: strangerCookie },
      payload: {},
    });
    expect(outsider.statusCode).toBe(403);
    expect(outsider.json().error).toBe("Not a member of this class.");

    const missing = await app.inject({
      method: "POST",
      url: `/api/assignments/00000000-0000-0000-0000-000000000000/groups`,
      cookies: { pide_session: alpha.cookie },
      payload: {},
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error).toBe("No such assignment.");
  });

  test("a student cannot form groups on a draft — its existence is not admitted", async () => {
    const draft = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/assignments`,
      cookies: { pide_session: teacherCookie },
      payload: { title: "Unpublished Pairs", submissionMode: "pair" },
    });
    const draftId = draft.json().assignment.id;
    const res = await createGroup(charlie, draftId);
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such assignment.");
  });
});

describe("GET /api/assignments/:id/groups", () => {
  let pairId: string;
  let groupId: string;

  beforeAll(async () => {
    pairId = await makeAssignment("pair", "Listing Groups");
    groupId = (await createGroup(alpha, pairId)).json().group.id;
    await joinGroup(bravo, groupId);
  });

  test("every class member sees the groups and who is in them, plus the size cap", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${pairId}/groups`,
      cookies: { pide_session: charlie.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capacity).toBe(2);
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].id).toBe(groupId);
    expect(body.groups[0].members.map((m: { name: string }) => m.name)).toEqual(["galpha", "gbravo"]);
  });

  test("a group-mode assignment caps at six", async () => {
    const sixId = await makeAssignment("group", "Sixes");
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${sixId}/groups`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().capacity).toBe(6);
    expect(res.json().groups).toEqual([]);
  });

  test("a non-member of the class 403s", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${pairId}/groups`,
      cookies: { pide_session: strangerCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Not a member of this class.");
  });
});

describe("POST /api/groups/:gid/join", () => {
  let pairId: string;
  let groupId: string;

  beforeAll(async () => {
    pairId = await makeAssignment("pair", "Joining Groups");
    groupId = (await createGroup(alpha, pairId)).json().group.id;
  });

  test("a second member joins -> 200, both members listed, event logged", async () => {
    const res = await joinGroup(bravo, groupId);
    expect(res.statusCode).toBe(200);
    expect(res.json().group.members.map((m: { userId: string }) => m.userId)).toEqual([
      alpha.id,
      bravo.id,
    ]);

    const evts = await eventsOfType("group.joined");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === groupId)).toBe(true);
  });

  test("re-joining your own group is idempotent, not an error or a duplicate row", async () => {
    const res = await joinGroup(bravo, groupId);
    expect(res.statusCode).toBe(200);
    const rows = await testDb.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
    expect(rows).toHaveLength(2);
  });

  test("a third member cannot join a full pair", async () => {
    const res = await joinGroup(charlie, groupId);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That group is full.");
  });

  test("two simultaneous joins at the last free seat: one gets in, one is told it is full", async () => {
    const raceId = await makeAssignment("pair", "Race For The Seat");
    const raceGroup = (await createGroup(alpha, raceId)).json().group.id;

    const [b, c] = await Promise.all([joinGroup(bravo, raceGroup), joinGroup(charlie, raceGroup)]);
    expect([b.statusCode, c.statusCode].sort()).toEqual([200, 400]);
    const refused = b.statusCode === 400 ? b : c;
    expect(refused.json().error).toBe("That group is full.");

    const rows = await testDb.select().from(groupMembers).where(eq(groupMembers.groupId, raceGroup));
    expect(rows).toHaveLength(2);
  });

  test("a member already in another group for the same assignment is refused", async () => {
    const twoId = await makeAssignment("group", "Two Groups One Student");
    const first = (await createGroup(alpha, twoId)).json().group.id;
    void first;
    const second = (await createGroup(bravo, twoId)).json().group.id;

    const res = await joinGroup(alpha, second);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("You are already in a group for this assignment.");
  });

  test("an unknown group 404s; a non-member of the class 403s", async () => {
    const missing = await app.inject({
      method: "POST",
      url: "/api/groups/00000000-0000-0000-0000-000000000000/join",
      cookies: { pide_session: alpha.cookie },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error).toBe("No such group.");

    const outsider = await app.inject({
      method: "POST",
      url: `/api/groups/${groupId}/join`,
      cookies: { pide_session: strangerCookie },
    });
    expect(outsider.statusCode).toBe(403);
    expect(outsider.json().error).toBe("Not a member of this class.");
  });

  test("a group that has already submitted takes no new members", async () => {
    const submittedId = await makeAssignment("group", "Already Handed In");
    const submittedGroup = (await createGroup(alpha, submittedId)).json().group.id;
    await testDb.insert(submissions).values({
      assignmentId: submittedId,
      groupId: submittedGroup,
      submittedBy: alpha.id,
      creditedIds: [alpha.id],
      manifest: { schemaVersion: 2 },
      fingerprint: "deadbeef",
    });

    const res = await joinGroup(bravo, submittedGroup);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("This group has already submitted.");
  });
});

describe("POST /api/groups/:gid/leave", () => {
  let pairId: string;
  let groupId: string;

  beforeAll(async () => {
    pairId = await makeAssignment("pair", "Leaving Groups");
    groupId = (await createGroup(alpha, pairId)).json().group.id;
    await joinGroup(bravo, groupId);
  });

  test("a member leaves -> 200, the remaining member stands alone, event logged", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${groupId}/leave`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().group.members).toEqual([{ userId: alpha.id, name: "galpha" }]);

    const evts = await eventsOfType("group.left");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === groupId)).toBe(true);
  });

  test("leaving a group you are not in 403s with the honest sentence", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${groupId}/leave`,
      cookies: { pide_session: charlie.cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Not a member of this group.");
  });

  test("leaving hands back the baton the leaver was holding", async () => {
    const batonId = await makeAssignment("pair", "Leave With The Baton");
    const batonGroup = (await createGroup(alpha, batonId)).json().group.id;
    await joinGroup(bravo, batonGroup);
    expect((await takeBaton(bravo, batonGroup)).statusCode).toBe(200);

    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${batonGroup}/leave`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(200);

    const [row] = await testDb.select().from(groups).where(eq(groups.id, batonGroup));
    expect(row.batonHolderId).toBeNull();
    expect(row.batonExpiresAt).toBeNull();
  });

  test("nobody leaves a group that has already submitted", async () => {
    const submittedId = await makeAssignment("group", "Handed In, Locked In");
    const submittedGroup = (await createGroup(alpha, submittedId)).json().group.id;
    await joinGroup(bravo, submittedGroup);
    await testDb.insert(submissions).values({
      assignmentId: submittedId,
      groupId: submittedGroup,
      submittedBy: alpha.id,
      creditedIds: [alpha.id, bravo.id],
      manifest: { schemaVersion: 2 },
      fingerprint: "cafebabe",
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${submittedGroup}/leave`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("This group has already submitted.");
  });
});

describe("POST /api/assignments/:id/start — the group branch", () => {
  let pairId: string;
  let groupId: string;
  const founderProjectId = "p-group-shared-project";

  beforeAll(async () => {
    pairId = await makeAssignment("pair", "Group Start Work");
    groupId = (await createGroup(alpha, pairId)).json().group.id;
    await joinGroup(bravo, groupId);
    await pushProject(alpha.id, founderProjectId, {
      schemaVersion: 2,
      marker: "founder-copy",
      updatedAt: 1000,
    });
  });

  test("starting a group assignment without a group says so", async () => {
    const res = await startWork(charlie, pairId, "p-nothing");
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Join a group before starting this assignment.");
  });

  test("a projectId the founder does not own 404s — the FK never gets a chance to fire", async () => {
    const res = await startWork(alpha, pairId, "p-not-mine-at-all");
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such project.");

    const rows = await testDb
      .select()
      .from(assignmentWork)
      .where(eq(assignmentWork.assignmentId, pairId));
    expect(rows).toHaveLength(0);
  });

  test("the first member's start stamps the group's project and one group-keyed work row", async () => {
    const res = await startWork(alpha, pairId, founderProjectId);
    expect(res.statusCode).toBe(201);
    expect(res.json().work.projectId).toBe(founderProjectId);

    const rows = await testDb
      .select()
      .from(assignmentWork)
      .where(eq(assignmentWork.assignmentId, pairId));
    expect(rows).toHaveLength(1);
    expect(rows[0].groupId).toBe(groupId);
    expect(rows[0].userId).toBeNull();
    expect(rows[0].ownerId).toBe(alpha.id);
    expect(rows[0].projectId).toBe(founderProjectId);

    const [group] = await testDb.select().from(groups).where(eq(groups.id, groupId));
    expect(group.ownerId).toBe(alpha.id);
    expect(group.projectId).toBe(founderProjectId);

    const evts = await eventsOfType("assignment.started");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === groupId)).toBe(true);
  });

  test("a later member starts with no project of their own and adopts the group's row", async () => {
    const res = await startWork(bravo, pairId);
    expect(res.statusCode).toBe(200);
    expect(res.json().work.projectId).toBe(founderProjectId);

    const rows = await testDb
      .select()
      .from(assignmentWork)
      .where(eq(assignmentWork.assignmentId, pairId));
    expect(rows).toHaveLength(1);
  });

  test("two members starting at the same instant produce exactly one shared work row", async () => {
    const raceId = await makeAssignment("pair", "Simultaneous Group Start");
    const raceGroup = (await createGroup(alpha, raceId)).json().group.id;
    await joinGroup(bravo, raceGroup);
    const raceProject = "p-group-race-project";
    const bravoProject = "p-group-race-bravo";
    await pushProject(alpha.id, raceProject, { schemaVersion: 2, updatedAt: 1000 });
    await pushProject(bravo.id, bravoProject, { schemaVersion: 2, updatedAt: 1000 });

    const [a, b] = await Promise.all([
      startWork(alpha, raceId, raceProject),
      startWork(bravo, raceId, bravoProject),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);

    const rows = await testDb
      .select()
      .from(assignmentWork)
      .where(eq(assignmentWork.assignmentId, raceId));
    expect(rows).toHaveLength(1);
    const [group] = await testDb.select().from(groups).where(eq(groups.id, raceGroup));
    expect(group.projectId).toBe(rows[0].projectId);
    expect(group.ownerId).toBe(rows[0].ownerId);
  });

  test("the student assignment read resolves myWork and myGroup through the group, for EVERY member", async () => {
    for (const member of [alpha, bravo]) {
      const res = await app.inject({
        method: "GET",
        url: `/api/assignments/${pairId}`,
        cookies: { pide_session: member.cookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json().assignment;
      expect(body.myWork).toEqual({ projectId: founderProjectId, startedAt: expect.any(Number) });
      expect(body.myGroup.id).toBe(groupId);
      expect(body.myGroup.members.map((m: { userId: string }) => m.userId)).toEqual([
        alpha.id,
        bravo.id,
      ]);
      expect(body.starterSeed).toBeNull();
    }
  });

  test("a member of the class with no group reads myGroup null and myWork null", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${pairId}`,
      cookies: { pide_session: charlie.cookie },
    });
    expect(res.json().assignment.myGroup).toBeNull();
    expect(res.json().assignment.myWork).toBeNull();
  });

  test("an individually-submitted assignment still reports myGroup null", async () => {
    const soloId = await makeAssignment("individual", "Still Solo");
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${soloId}`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(res.json().assignment.myGroup).toBeNull();
  });
});

describe("the baton — GET /api/groups/:gid/baton and POST .../baton/take", () => {
  let batonId: string;
  let groupId: string;

  beforeAll(async () => {
    batonId = await makeAssignment("pair", "The Baton");
    groupId = (await createGroup(alpha, batonId)).json().group.id;
    await joinGroup(bravo, groupId);
  });

  test("before anyone picks it up the baton is nobody's", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/groups/${groupId}/baton`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().baton).toEqual({ holderId: null, holderName: null, expiresAt: null });
  });

  test("taking a free baton grants a 90-second lease and logs it", async () => {
    const before = Date.now();
    const res = await takeBaton(alpha, groupId);
    expect(res.statusCode).toBe(200);
    const baton = res.json().baton;
    expect(baton.holderId).toBe(alpha.id);
    expect(baton.holderName).toBe("galpha");
    expect(baton.expiresAt).toBeGreaterThanOrEqual(before + 89_000);
    expect(baton.expiresAt).toBeLessThanOrEqual(Date.now() + 90_000);

    const evts = await eventsOfType("group.baton_taken");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === groupId)).toBe(true);
  });

  test("the other member reads who is holding it and until when", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/groups/${groupId}/baton`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.json().baton.holderId).toBe(alpha.id);
    expect(res.json().baton.holderName).toBe("galpha");
    expect(res.json().baton.expiresAt).toEqual(expect.any(Number));
  });

  test("a second member cannot take a live baton — 409 naming the holder and the expiry", async () => {
    const res = await takeBaton(bravo, groupId);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Another member holds the baton.");
    expect(res.json().baton.holderId).toBe(alpha.id);
    expect(res.json().baton.holderName).toBe("galpha");
    expect(res.json().baton.expiresAt).toEqual(expect.any(Number));
  });

  test("the holder re-taking simply renews the lease", async () => {
    const [before] = await testDb.select().from(groups).where(eq(groups.id, groupId));
    await testDb
      .update(groups)
      .set({ batonExpiresAt: new Date(Date.now() + 5_000) })
      .where(eq(groups.id, groupId));
    void before;

    const res = await takeBaton(alpha, groupId);
    expect(res.statusCode).toBe(200);
    expect(res.json().baton.holderId).toBe(alpha.id);
    expect(res.json().baton.expiresAt).toBeGreaterThan(Date.now() + 60_000);
  });

  test("an expired lease is takeable — this is the UI's Take over", async () => {
    await testDb
      .update(groups)
      .set({ batonExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(groups.id, groupId));

    const res = await takeBaton(bravo, groupId);
    expect(res.statusCode).toBe(200);
    expect(res.json().baton.holderId).toBe(bravo.id);
    expect(res.json().baton.expiresAt).toBeGreaterThan(Date.now() + 60_000);
  });

  test("someone outside the group cannot see or take its baton", async () => {
    const read = await app.inject({
      method: "GET",
      url: `/api/groups/${groupId}/baton`,
      cookies: { pide_session: charlie.cookie },
    });
    expect(read.statusCode).toBe(403);
    expect(read.json().error).toBe("Not a member of this group.");

    const take = await takeBaton(charlie, groupId);
    expect(take.statusCode).toBe(403);
    expect(take.json().error).toBe("Not a member of this group.");
  });
});

describe("the group project — GET/PUT /api/groups/:gid/project", () => {
  let projectAssignmentId: string;
  let groupId: string;
  const sharedProjectId = "p-group-project-head";
  // A real manifest: a group save writes into an ordinary project row on the
  // founder's account, so it has to satisfy the same contract their own
  // client's push does.
  const v1 = {
    schemaVersion: 2,
    id: sharedProjectId,
    title: "Shared Work",
    goal: "physics",
    projectType: "physics",
    createdAt: 1,
    updatedAt: 1_000,
    marker: "v1",
  };

  beforeAll(async () => {
    projectAssignmentId = await makeAssignment("group", "Shared Project");
    groupId = (await createGroup(alpha, projectAssignmentId)).json().group.id;
    await joinGroup(bravo, groupId);
    await pushProject(alpha.id, sharedProjectId, v1);
    await startWork(alpha, projectAssignmentId, sharedProjectId);
  });

  test("a member reads the server head, attributed to the founder before anyone has saved", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: bravo.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.manifest).toEqual(v1);
    expect(body.clientUpdatedAt).toBe(1_000);
    expect(body.savedBy).toBe(alpha.id);
  });

  test("saving without the baton is refused — nobody is holding it yet", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: bravo.cookie },
      payload: { manifest: { ...v1, marker: "sneaky", updatedAt: 2_000 } },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Take the baton before saving.");
  });

  test("the baton-holder saves: the head moves, the previous head is archived to the SAVER's name", async () => {
    expect((await takeBaton(bravo, groupId)).statusCode).toBe(200);
    const v2 = { ...v1, marker: "v2-by-bravo", updatedAt: 2_000 };

    const res = await app.inject({
      method: "PUT",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: bravo.cookie },
      payload: { manifest: v2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, clientUpdatedAt: 2_000 });

    const [head] = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, alpha.id), eq(projects.id, sharedProjectId)));
    expect(head.manifest).toEqual(v2);
    expect(head.clientUpdatedAt).toBe(2_000);

    const versions = await testDb
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.ownerId, alpha.id), eq(projectVersions.projectId, sharedProjectId)))
      .orderBy(desc(projectVersions.id));
    expect(versions).toHaveLength(1);
    expect(versions[0].manifest).toEqual(v1);
    expect(versions[0].savedBy).toBe(bravo.id);
    expect(versions[0].reason).toBe("overwrite");

    const evts = await eventsOfType("group.project_saved");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === groupId)).toBe(true);
  });

  test("the read now credits the member who actually saved it — spec §5.5 attribution", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(res.json().savedBy).toBe(bravo.id);
    expect((res.json().manifest as Record<string, unknown>).marker).toBe("v2-by-bravo");
  });

  test("a stale personal-engine push by the founder does not steal credit for the head", async () => {
    // The founder's own client still syncs this project personally (they own
    // it), and an offline copy can arrive stale. projects.ts files that under
    // `conflict-loser` in the FOUNDER's name and leaves the head alone — the
    // one version row that must never be mistaken for the head's author.
    const stalePush = await app.inject({
      method: "PUT",
      url: `/api/projects/${sharedProjectId}`,
      cookies: { pide_session: alpha.cookie },
      payload: { manifest: { ...v1, marker: "alphas-stale-offline-copy", updatedAt: 1_500 } },
    });
    expect(stalePush.statusCode).toBe(200);
    expect(stalePush.json().outcome).toBe("kept-remote");

    const versions = await testDb
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.ownerId, alpha.id), eq(projectVersions.projectId, sharedProjectId)))
      .orderBy(desc(projectVersions.id));
    expect(versions[0].reason).toBe("conflict-loser");
    expect(versions[0].savedBy).toBe(alpha.id);

    const res = await app.inject({
      method: "GET",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: bravo.cookie },
    });
    expect((res.json().manifest as Record<string, unknown>).marker).toBe("v2-by-bravo");
    expect(res.json().savedBy).toBe(bravo.id);
  });

  test("the other member cannot save while the baton is held", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: alpha.cookie },
      payload: { manifest: { ...v1, marker: "stomp", updatedAt: 3_000 } },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("Another member holds the baton.");

    const [head] = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, alpha.id), eq(projects.id, sharedProjectId)));
    expect((head.manifest as Record<string, unknown>).marker).toBe("v2-by-bravo");
  });

  test("saving renews the holder's lease — a long editing session never locks itself out", async () => {
    await testDb
      .update(groups)
      .set({ batonExpiresAt: new Date(Date.now() + 3_000) })
      .where(eq(groups.id, groupId));

    const res = await app.inject({
      method: "PUT",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: bravo.cookie },
      payload: { manifest: { ...v1, marker: "v3-still-bravo", updatedAt: 3_500 } },
    });
    expect(res.statusCode).toBe(200);

    const [row] = await testDb.select().from(groups).where(eq(groups.id, groupId));
    expect(row.batonHolderId).toBe(bravo.id);
    expect(row.batonExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 60_000);
  });

  test("a manifest too large to sync is refused with the same sentence a personal push gets", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: bravo.cookie },
      payload: { manifest: { ...v1, blob: "x".repeat(420 * 1024), updatedAt: 4_500 } },
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().error).toBe("This project is too large to sync. Export it as a file instead.");
  });

  test("a manifest without a timestamp is refused before anything is written", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: bravo.cookie },
      payload: { manifest: { schemaVersion: 2 } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That doesn't look like a valid project.");
  });

  test("a group save is held to the OWNER's manifest contract — the row is theirs to sync back", async () => {
    const refusals: Record<string, Record<string, unknown>> = {
      "names a different project": { ...v1, id: "p-some-other-project", updatedAt: 6_000 },
      "carries no schemaVersion": { ...v1, schemaVersion: undefined, updatedAt: 6_100 },
      "carries the wrong schemaVersion": { ...v1, schemaVersion: 1, updatedAt: 6_200 },
      "has an over-long title": { ...v1, title: "t".repeat(201), updatedAt: 6_300 },
      "has an over-long goal": { ...v1, goal: "g".repeat(41), updatedAt: 6_400 },
      "has no title at all": { ...v1, title: undefined, updatedAt: 6_500 },
    };
    for (const [why, manifest] of Object.entries(refusals)) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/groups/${groupId}/project`,
        cookies: { pide_session: bravo.cookie },
        payload: { manifest },
      });
      expect(res.statusCode, why).toBe(400);
      expect(res.json().error, why).toBe("That doesn't look like a valid project.");
    }

    // Nothing was written by any of them.
    const [head] = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, alpha.id), eq(projects.id, sharedProjectId)));
    expect((head.manifest as Record<string, unknown>).marker).toBe("v3-still-bravo");
  });

  test("someone outside the group can neither read nor write it", async () => {
    const read = await app.inject({
      method: "GET",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: charlie.cookie },
    });
    expect(read.statusCode).toBe(403);
    expect(read.json().error).toBe("Not a member of this group.");

    const write = await app.inject({
      method: "PUT",
      url: `/api/groups/${groupId}/project`,
      cookies: { pide_session: charlie.cookie },
      payload: { manifest: { ...v1, updatedAt: 4_000 } },
    });
    expect(write.statusCode).toBe(403);
    expect(write.json().error).toBe("Not a member of this group.");
  });

  test("a group that has not started work has no project to read or write yet", async () => {
    const freshId = await makeAssignment("group", "Not Started Yet");
    const freshGroup = (await createGroup(charlie, freshId)).json().group.id;

    const read = await app.inject({
      method: "GET",
      url: `/api/groups/${freshGroup}/project`,
      cookies: { pide_session: charlie.cookie },
    });
    expect(read.statusCode).toBe(404);
    expect(read.json().error).toBe("This group has not started work yet.");

    await takeBaton(charlie, freshGroup);
    const write = await app.inject({
      method: "PUT",
      url: `/api/groups/${freshGroup}/project`,
      cookies: { pide_session: charlie.cookie },
      payload: { manifest: { schemaVersion: 2, updatedAt: 5_000 } },
    });
    expect(write.statusCode).toBe(404);
    expect(write.json().error).toBe("This group has not started work yet.");
  });

  test("the personal sync engine is untouched: the founder's own PUT still owns their copy", async () => {
    const soloProjectId = "p-founder-personal-copy";
    const res = await app.inject({
      method: "PUT",
      url: `/api/projects/${soloProjectId}`,
      cookies: { pide_session: alpha.cookie },
      payload: {
        manifest: {
          schemaVersion: 2,
          id: soloProjectId,
          title: "Personal",
          goal: "physics",
          projectType: "physics",
          createdAt: 1,
          updatedAt: 9_000,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().outcome).toBe("saved");
  });
});

/* ─────────────────────────── Task 23 ───────────────────────────
 * Group submit and the group mark (spec §5.5 / §7.3). These live beside
 * the group fixture above rather than in assignments.test.ts because every
 * one of them needs a formed, started group — the same reason Task 21's
 * own start-branch tests live here.
 */

/** The four-field seed shape the marking room reads back (starterSeedFrom). */
function groupManifest(projectId: string, marker: string, updatedAt: number) {
  return {
    schemaVersion: 2,
    id: projectId,
    title: "Group Work",
    goal: "physics",
    projectType: "physics",
    preferredEditor: "blocks",
    workspace: { xml: `<xml>${marker}</xml>` },
    source: { python: `print('${marker}')` },
    createdAt: 1,
    updatedAt,
  };
}

function submitFor(member: Member, assignmentId: string) {
  return app.inject({
    method: "POST",
    url: `/api/assignments/${assignmentId}/submit`,
    cookies: { pide_session: member.cookie },
  });
}

function readAssignment(member: Member, assignmentId: string) {
  return app.inject({
    method: "GET",
    url: `/api/assignments/${assignmentId}`,
    cookies: { pide_session: member.cookie },
  });
}

function emailsTo(userId: string, template: string) {
  return testDb
    .select()
    .from(emails)
    .where(and(eq(emails.toUserId, userId), eq(emails.template, template)));
}

function marksOf(assignmentId: string) {
  return testDb.select().from(marks).where(eq(marks.assignmentId, assignmentId));
}

describe("Task 23: groups are student-only (ruling R7)", () => {
  let pairId: string;
  let taCookie: string;

  beforeAll(async () => {
    pairId = await makeAssignment("pair", "Students Only");
    const ta = await makeUser("gta@example.com");
    await testDb.insert(classMembers).values({ classId, userId: ta.id, role: "ta", status: "active" });
    taCookie = await signin("gta@example.com");
  });

  test("a teacher cannot form a group — a staff member in one would poison the credit list", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${pairId}/groups`,
      cookies: { pide_session: teacherCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Groups are for students.");
    expect(await testDb.select().from(groups).where(eq(groups.assignmentId, pairId))).toHaveLength(0);
  });

  test("a TA cannot join an existing group either", async () => {
    const gid = (await createGroup(alpha, pairId)).json().group.id;
    const res = await app.inject({
      method: "POST",
      url: `/api/groups/${gid}/join`,
      cookies: { pide_session: taCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Groups are for students.");
    expect(await testDb.select().from(groupMembers).where(eq(groupMembers.groupId, gid))).toHaveLength(1);
  });
});

describe("Task 23: group submit — POST /api/assignments/:id/submit", () => {
  let submitId: string;
  let groupId: string;
  const projectId = "p-task23-submit";
  const head = groupManifest(projectId, "group-head", 3_000);

  beforeAll(async () => {
    submitId = await makeAssignment("pair", "Group Submit");
    groupId = (await createGroup(alpha, submitId)).json().group.id;
    await joinGroup(bravo, groupId);
    await pushProject(alpha.id, projectId, head);
    await startWork(alpha, submitId, projectId);
  });

  test("a class member with no group is told to join one before there is anything to submit", async () => {
    const res = await submitFor(charlie, submitId);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Join a group before starting this assignment.");
  });

  test("a group that has not started work yet has nothing to hand in", async () => {
    const freshId = await makeAssignment("pair", "Group Submit Before Start");
    await createGroup(alpha, freshId);
    const res = await submitFor(alpha, freshId);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Start this assignment before submitting.");
  });

  test("ANY member submits: the GROUP head is snapshotted, every member is credited, one receipt each", async () => {
    // bravo, not the founder — spec §5.5's "any member can press Submit".
    const res = await submitFor(bravo, submitId);
    expect(res.statusCode).toBe(201);
    const body = res.json().submission;
    expect(body.attempt).toBe(1);
    expect(body.late).toBe(false);

    const [row] = await testDb.select().from(submissions).where(eq(submissions.id, body.id));
    expect(row.groupId).toBe(groupId);
    expect(row.submitterId).toBeNull();
    expect(row.submittedBy).toBe(bravo.id);
    expect(row.creditedIds).toEqual([alpha.id, bravo.id]);
    expect(row.manifest).toEqual(head);
    expect(row.isCurrent).toBe(true);

    for (const member of [alpha, bravo]) {
      const receipts = await emailsTo(member.id, "submission-receipt");
      const mine = receipts.filter((e) => e.subject.includes("Group Submit"));
      expect(mine).toHaveLength(1);
      expect(mine[0].bodyText).toContain("galpha");
      expect(mine[0].bodyText).toContain("gbravo");
    }

    const evts = await eventsOfType("assignment.submitted");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === groupId)).toBe(true);
  });

  test("\"submitted for all of them\": the member who did NOT press it reads the same submission", async () => {
    const res = await readAssignment(alpha, submitId);
    expect(res.statusCode).toBe(200);
    const mine = res.json().assignment.mySubmission;
    expect(mine.attempt).toBe(1);
    expect(mine.credited.map((c: { name: string }) => c.name)).toEqual(["galpha", "gbravo"]);
  });

  test("a resubmit supersedes the GROUP's own previous attempt, whoever presses it", async () => {
    const res = await submitFor(alpha, submitId);
    expect(res.statusCode).toBe(201);
    expect(res.json().submission.attempt).toBe(2);

    const rows = await testDb
      .select()
      .from(submissions)
      .where(and(eq(submissions.assignmentId, submitId), eq(submissions.groupId, groupId)));
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.isCurrent)).toHaveLength(1);
    expect(rows.find((r) => r.isCurrent)!.attempt).toBe(2);
  });

  test("the Due soon strip counts the group's submission for a member who never pressed Submit", async () => {
    const dueId = await makeAssignment("pair", "Group Due Soon", { dueAt: Date.now() + 86_400_000 });
    const gid = (await createGroup(alpha, dueId)).json().group.id;
    await joinGroup(bravo, gid);
    const pid = "p-task23-duesoon";
    await pushProject(alpha.id, pid, groupManifest(pid, "due-soon", 4_000));
    await startWork(alpha, dueId, pid);
    expect((await submitFor(bravo, dueId)).statusCode).toBe(201);

    const res = await app.inject({
      method: "GET",
      url: "/api/assignments/upcoming",
      cookies: { pide_session: alpha.cookie },
    });
    const row = res.json().dueSoon.find((d: { assignmentId: string }) => d.assignmentId === dueId);
    expect(row).toBeDefined();
    expect(row.submitted).toBe(true);
  });
});

describe("Task 23: the inbox and reminders for group work", () => {
  let inboxId: string;
  let submittedGroupId: string;
  let waitingGroupId: string;
  const delta = {} as Member;

  beforeAll(async () => {
    const d = await makeUser("gdelta@example.com");
    delta.id = d.id;
    delta.cookie = await signin("gdelta@example.com");
    await testDb.insert(classMembers).values({ classId, userId: delta.id, role: "student", status: "active" });

    inboxId = await makeAssignment("group", "Group Inbox");
    submittedGroupId = (await createGroup(alpha, inboxId, "The Pair")).json().group.id;
    await joinGroup(bravo, submittedGroupId);
    waitingGroupId = (await createGroup(charlie, inboxId, "The Solo")).json().group.id;
    const pid = "p-task23-inbox";
    await pushProject(alpha.id, pid, groupManifest(pid, "inbox", 5_000));
    await startWork(alpha, inboxId, pid);
    await submitFor(alpha, inboxId);
    // delta joins no group at all — still on the roster, still owed a row.
  });

  test("one row per group with its members named; a student in no group is their own row", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${inboxId}/inbox`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const rows = res.json().rows;
    expect(rows).toHaveLength(3);

    const pair = rows.find((r: { name: string }) => r.name === "The Pair");
    expect(pair.kind).toBe("group");
    expect(pair.groupId).toBe(submittedGroupId);
    expect(pair.studentId).toBeNull();
    expect(pair.members.map((m: { name: string }) => m.name)).toEqual(["galpha", "gbravo"]);
    expect(pair.state).toBe("submitted");
    expect(pair.attempt).toBe(1);
    expect(pair.markStatus).toBe("none");

    const solo = rows.find((r: { name: string }) => r.name === "The Solo");
    expect(solo.kind).toBe("group");
    expect(solo.groupId).toBe(waitingGroupId);
    expect(solo.state).toBe("missing");
    expect(solo.submittedAt).toBeNull();

    const ungrouped = rows.find((r: { name: string }) => r.name === "gdelta");
    expect(ungrouped.kind).toBe("student");
    expect(ungrouped.studentId).toBe(delta.id);
    expect(ungrouped.groupId).toBeNull();
    expect(ungrouped.state).toBe("missing");
  });

  test("remind reaches every member of a group that has not handed in, and every ungrouped student", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${inboxId}/remind`,
      cookies: { pide_session: teacherCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    // charlie (a group of one that hasn't submitted) and delta (no group).
    expect(res.json().reminded).toBe(2);

    for (const member of [charlie, delta]) {
      const sent = (await emailsTo(member.id, "due-reminder")).filter((e) =>
        e.subject.includes("Group Inbox"),
      );
      expect(sent).toHaveLength(1);
    }
    for (const member of [alpha, bravo]) {
      const sent = (await emailsTo(member.id, "due-reminder")).filter((e) =>
        e.subject.includes("Group Inbox"),
      );
      expect(sent).toHaveLength(0);
    }
  });
});

describe("Task 23: the group mark", () => {
  let seq = 0;

  /** A published group assignment with alpha+bravo grouped, work started and
   *  one submission on file — the state the marking room actually opens on. */
  async function groupFixture(title: string, extra: Record<string, unknown> = { points: 10 }) {
    seq += 1;
    const aid = await makeAssignment("group", title, extra);
    const gid = (await createGroup(alpha, aid, `Marked Group ${seq}`)).json().group.id;
    await joinGroup(bravo, gid);
    const pid = `p-task23-mark-${seq}`;
    await pushProject(alpha.id, pid, groupManifest(pid, `mark-${seq}`, 1_000));
    await startWork(alpha, aid, pid);
    const sub = await submitFor(alpha, aid);
    return { aid, gid, pid, submissionId: sub.json().submission.id as string };
  }

  function putGroupMark(aid: string, gid: string, cookie: string, body: Record<string, unknown>) {
    return app.inject({
      method: "PUT",
      url: `/api/assignments/${aid}/marks/group/${gid}`,
      cookies: { pide_session: cookie },
      payload: body,
    });
  }

  function releaseMarks(aid: string, studentIds: string[]) {
    return app.inject({
      method: "POST",
      url: `/api/assignments/${aid}/marks/release`,
      cookies: { pide_session: teacherCookie },
      payload: { studentIds },
    });
  }

  test("the marking room reads the group's submission: members named, the snapshot, the attempt history", async () => {
    const { aid, gid } = await groupFixture("Group Marking Read");
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${aid}/submissions/group/${gid}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.submission.groupId).toBe(gid);
    expect(body.submission.groupName).toBe("Marked Group 1");
    expect(body.submission.members.map((m: { name: string }) => m.name)).toEqual(["galpha", "gbravo"]);
    expect(body.submission.workspaceXml).toContain("mark-1");
    expect(body.submission.python).toContain("mark-1");
    expect(body.history).toHaveLength(1);
    expect(body.groupMark).toBeNull();
  });

  test("a group with nothing handed in 404s rather than pretending", async () => {
    const emptyId = await makeAssignment("group", "Group Never Submitted");
    const gid = (await createGroup(alpha, emptyId)).json().group.id;
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${emptyId}/submissions/group/${gid}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No submission from this group.");
  });

  test("the timeline resolves the GROUP's shared project and names the member who saved each checkpoint", async () => {
    const { aid, gid, pid } = await groupFixture("Group Timeline");
    await takeBaton(bravo, gid);
    await app.inject({
      method: "PUT",
      url: `/api/groups/${gid}/project`,
      cookies: { pide_session: bravo.cookie },
      payload: { manifest: groupManifest(pid, "second-pass", 2_000) },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${aid}/timeline/group/${gid}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0].reason).toBe("overwrite");
    expect(body.versions[0].savedByName).toBe("gbravo");
    expect(body.submissions).toHaveLength(1);

    const evts = await eventsOfType("assignment.timeline_viewed");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === gid)).toBe(true);
  });

  test("a group that never started has no timeline to read", async () => {
    const freshId = await makeAssignment("group", "Group Timeline Unstarted");
    const gid = (await createGroup(alpha, freshId)).json().group.id;
    const res = await app.inject({
      method: "GET",
      url: `/api/assignments/${freshId}/timeline/group/${gid}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("This group has not started this assignment.");
  });

  test("one mark for the group writes one draft row per member, based on the group's own submission", async () => {
    const { aid, gid, submissionId } = await groupFixture("One Mark For The Group");
    const res = await putGroupMark(aid, gid, teacherCookie, {
      points: 8,
      comment: "Good teamwork.",
      privateNote: "bravo did the graphs",
      adjustments: [],
    });
    expect(res.statusCode).toBe(200);
    const gm = res.json().groupMark;
    expect(gm.points).toBe(8);
    expect(gm.status).toBe("draft");
    expect(gm.basedOnSubmissionId).toBe(submissionId);
    expect(gm.members).toEqual([
      { studentId: alpha.id, name: "galpha", adjustment: 0, points: 8 },
      { studentId: bravo.id, name: "gbravo", adjustment: 0, points: 8 },
    ]);

    const rows = await marksOf(aid);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.points).toBe(8);
      expect(row.comment).toBe("Good teamwork.");
      expect(row.privateNote).toBe("bravo did the graphs");
      expect(row.status).toBe("draft");
      expect(row.returned).toBe(false);
      expect(row.basedOnSubmissionId).toBe(submissionId);
    }

    const evts = await eventsOfType("assignment.group_mark_drafted");
    expect(evts.some((e) => (e.payload as Record<string, unknown>).groupId === gid)).toBe(true);
  });

  test("a per-member adjustment lands on that member alone, and the read gives the group's own points back", async () => {
    const { aid, gid } = await groupFixture("Adjusted Group Mark");
    const res = await putGroupMark(aid, gid, teacherCookie, {
      points: 8,
      comment: "One carried the load.",
      privateNote: "",
      adjustments: [{ studentId: bravo.id, adjustment: -2 }],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().groupMark.points).toBe(8);
    expect(res.json().groupMark.members).toEqual([
      { studentId: alpha.id, name: "galpha", adjustment: 0, points: 8 },
      { studentId: bravo.id, name: "gbravo", adjustment: -2, points: 6 },
    ]);

    // Re-read through the marking room: the base and the adjustment survive
    // the round trip, or the panel could not prefill honestly.
    const read = await app.inject({
      method: "GET",
      url: `/api/assignments/${aid}/submissions/group/${gid}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(read.json().groupMark.points).toBe(8);
    expect(read.json().groupMark.members[1]).toEqual({
      studentId: bravo.id,
      name: "gbravo",
      adjustment: -2,
      points: 6,
    });
  });

  test("an adjustment that would push a member below zero or past the total is refused", async () => {
    const { aid, gid } = await groupFixture("Adjustment Out Of Range");
    const res = await putGroupMark(aid, gid, teacherCookie, {
      points: 8,
      comment: "",
      privateNote: "",
      adjustments: [{ studentId: bravo.id, adjustment: 5 }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That adjustment puts a member outside the assignment's own total.");
    expect(await marksOf(aid)).toHaveLength(0);
  });

  test("release fans out: every member's row is released and emailed their OWN total", async () => {
    const { aid, gid } = await groupFixture("Group Release");
    await putGroupMark(aid, gid, teacherCookie, {
      points: 8,
      comment: "Solid write-up.",
      privateNote: "",
      adjustments: [{ studentId: bravo.id, adjustment: 1 }],
    });

    const res = await releaseMarks(aid, [alpha.id, bravo.id]);
    expect(res.statusCode).toBe(200);
    expect(res.json().released.sort()).toEqual([alpha.id, bravo.id].sort());
    expect(res.json().refused).toEqual([]);

    const rows = await marksOf(aid);
    expect(rows.every((r) => r.status === "released" && r.releasedAt != null && !r.returned)).toBe(true);

    const alphaMail = (await emailsTo(alpha.id, "marks-released")).filter((e) =>
      e.subject.includes("Group Release"),
    );
    const bravoMail = (await emailsTo(bravo.id, "marks-released")).filter((e) =>
      e.subject.includes("Group Release"),
    );
    expect(alphaMail[0].bodyText).toContain("8/10");
    expect(bravoMail[0].bodyText).toContain("9/10");
    expect(alphaMail[0].bodyText).toContain("Solid write-up.");
  });

  test("a group draft written against a superseded attempt is refused for every member", async () => {
    const { aid, gid } = await groupFixture("Stale Group Draft");
    await putGroupMark(aid, gid, teacherCookie, { points: 7, comment: "", privateNote: "", adjustments: [] });
    expect((await submitFor(bravo, aid)).statusCode).toBe(201); // attempt 2 supersedes the draft

    const res = await releaseMarks(aid, [alpha.id, bravo.id]);
    expect(res.statusCode).toBe(200);
    expect(res.json().released).toEqual([]);
    expect(res.json().refused.map((r: { error: string }) => r.error)).toEqual([
      "This draft was written against a previous attempt — re-save it before releasing.",
      "This draft was written against a previous attempt — re-save it before releasing.",
    ]);
    expect((await marksOf(aid)).every((r) => r.status === "draft")).toBe(true);
  });

  test("a member's earlier individual mark row is replaced by the group's mark, return cleared", async () => {
    const { aid, gid } = await groupFixture("Pre-existing Mark Row");
    const returned = await app.inject({
      method: "POST",
      url: `/api/assignments/${aid}/marks/${bravo.id}/return`,
      cookies: { pide_session: teacherCookie },
      payload: { comment: "Redo the graph." },
    });
    expect(returned.statusCode).toBe(200);

    await putGroupMark(aid, gid, teacherCookie, { points: 6, comment: "Group mark.", privateNote: "", adjustments: [] });

    const rows = await marksOf(aid);
    expect(rows).toHaveLength(2);
    const bravoRow = rows.find((r) => r.studentId === bravo.id)!;
    expect(bravoRow.points).toBe(6);
    expect(bravoRow.comment).toBe("Group mark.");
    expect(bravoRow.returned).toBe(false);
  });

  test("a points-less group assignment keeps points null and carries no adjustment", async () => {
    const { aid, gid } = await groupFixture("Points-less Group", { points: null });
    const res = await putGroupMark(aid, gid, teacherCookie, {
      points: 9,
      comment: "Complete.",
      privateNote: "",
      adjustments: [{ studentId: bravo.id, adjustment: 2 }],
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().groupMark.points).toBeNull();
    expect(res.json().groupMark.members.every((m: { points: number | null }) => m.points === null)).toBe(true);
    expect((await marksOf(aid)).every((r) => r.points === null && r.adjustment === 0)).toBe(true);
  });

  test("return for changes sends the WHOLE group back, emails each member, and reopens submit while closed", async () => {
    const { aid, gid } = await groupFixture("Group Returned");
    const res = await app.inject({
      method: "POST",
      url: `/api/assignments/${aid}/marks/group/${gid}/return`,
      cookies: { pide_session: teacherCookie },
      payload: { comment: "Show your working." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().groupMark.returned).toBe(true);
    expect(res.json().groupMark.status).toBe("draft");

    const rows = await marksOf(aid);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.returned && r.status === "draft" && r.releasedAt == null)).toBe(true);
    for (const member of [alpha, bravo]) {
      const sent = (await emailsTo(member.id, "work-returned")).filter((e) => e.subject.includes("Group Returned"));
      expect(sent).toHaveLength(1);
      expect(sent[0].bodyText).toContain("Show your working.");
    }

    await app.inject({
      method: "POST",
      url: `/api/assignments/${aid}/close`,
      cookies: { pide_session: teacherCookie },
    });
    // D§11.2: the return is the authority — the group may resubmit even shut.
    const resubmit = await submitFor(bravo, aid);
    expect(resubmit.statusCode).toBe(201);
    expect(resubmit.json().submission.attempt).toBe(2);
  });

  test("a student can neither read the group's submission nor write its mark", async () => {
    const { aid, gid } = await groupFixture("Group Mark Staff Only");
    const read = await app.inject({
      method: "GET",
      url: `/api/assignments/${aid}/submissions/group/${gid}`,
      cookies: { pide_session: alpha.cookie },
    });
    expect(read.statusCode).toBe(403);
    expect(read.json().error).toBe("Teachers and assistants only.");

    const write = await putGroupMark(aid, gid, alpha.cookie, {
      points: 10,
      comment: "",
      privateNote: "",
      adjustments: [],
    });
    expect(write.statusCode).toBe(403);
    expect(await marksOf(aid)).toHaveLength(0);
  });

  test("a group belonging to another assignment is not markable through this one", async () => {
    const { aid } = await groupFixture("Group Cross Assignment A");
    const other = await groupFixture("Group Cross Assignment B");
    const res = await putGroupMark(aid, other.gid, teacherCookie, {
      points: 5,
      comment: "",
      privateNote: "",
      adjustments: [],
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such group.");
  });
});
