import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, desc, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import {
  users,
  classMembers,
  events,
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

/** A published assignment in the shared class, in the given submission mode. */
async function makeAssignment(submissionMode: "individual" | "pair" | "group", title: string) {
  const draft = await app.inject({
    method: "POST",
    url: `/api/classes/${classId}/assignments`,
    cookies: { pide_session: teacherCookie },
    payload: { title, submissionMode },
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
  const v1 = { schemaVersion: 2, id: sharedProjectId, marker: "v1", updatedAt: 1_000 };

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
