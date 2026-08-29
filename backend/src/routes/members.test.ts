import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { buildApp, RATE_LIMIT_MESSAGE } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classes, classMembers, emails, invites, notifications, events } from "../db/schema.js";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let kidCookie: string;
let kid2Cookie: string;
let kidId: string;
let kid2Id: string;
let teacherId: string;
let openClass: { id: string; joinCode: string };

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

// Each signin gets its own source IP — the auth route's per-IP rate limit is
// sized for humans, and this file's notification-fan-out block (Task 5)
// pushes the total signin count in this file past what one shared IP allows.
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

async function notificationsFor(userId: string) {
  return testDb.select().from(notifications).where(eq(notifications.userId, userId));
}

// Same idiom as signin's own IP rotation above: every real join-by-code call
// below gets its own source IP so it can never brush against the route's
// per-IP throttle, whatever that limit is set to or however many join calls
// this file grows to. (The dedicated rate-limit test further down deliberately
// keeps ONE shared IP across its own app instance — that's the limiter itself
// under test.)
let joinIpCounter = 0;
function nextJoinIp(): string {
  joinIpCounter += 1;
  return `10.97.${Math.floor(joinIpCounter / 250)}.${(joinIpCounter % 250) + 1}`;
}

async function createClass(cookie: string, name: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: cookie },
    payload: { name },
  });
  return res.json().class as { id: string; joinCode: string };
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  const t = await makeUser("mteach@example.com", { isTeacher: true });
  teacherId = t.id;
  const k = await makeUser("mkid@example.com");
  kidId = k.id;
  const k2 = await makeUser("mkid2@example.com");
  kid2Id = k2.id;
  teacherCookie = await signin("mteach@example.com");
  kidCookie = await signin("mkid@example.com");
  kid2Cookie = await signin("mkid2@example.com");
  openClass = await createClass(teacherCookie, "Open Class");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/classes/join", () => {
  test("open class: joins active, sloppy code input accepted", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: kidCookie },
      payload: { code: ` ${openClass.joinCode.toLowerCase().replace("-", " ")} ` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, status: "active", classId: openClass.id });
  });

  test("joining again is refused politely", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: kidCookie },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("You're already in this class.");
  });

  test("unknown code → one generic message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: kid2Cookie },
      payload: { code: "ZZZ-ZZZ" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No class has that code.");
  });

  test("approval mode → waiting; teacher approves → active", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: kid2Cookie },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("waiting");

    const approve = await app.inject({
      method: "POST",
      url: `/api/classes/${openClass.id}/members/${kid2Id}/approve`,
      cookies: { pide_session: teacherCookie },
    });
    expect(approve.statusCode).toBe(200);
    const [row] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.userId, kid2Id)));
    expect(row.status).toBe("active");
  });

  test("paused mode refuses joiners", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "paused" },
    });
    const extra = await makeUser("mkid3@example.com");
    const cookie3 = await signin("mkid3@example.com");
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: cookie3 },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Joining this class is paused.");
    void extra;
  });

  test("archived class refuses joiners with its own message", async () => {
    const second = await createClass(teacherCookie, "To Archive");
    await app.inject({
      method: "POST",
      url: `/api/classes/${second.id}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: kid2Cookie },
      payload: { code: second.joinCode },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That class is archived.");
  });
});

describe("roster", () => {
  test("teacher sees members; students may not read the roster", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${openClass.id}/members`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const roster = res.json().members as Array<{ email: string; role: string; status: string }>;
    expect(roster.length).toBeGreaterThanOrEqual(3);
    expect(roster.some((m) => m.role === "teacher")).toBe(true);

    const deny = await app.inject({
      method: "GET",
      url: `/api/classes/${openClass.id}/members`,
      cookies: { pide_session: kidCookie },
    });
    expect(deny.statusCode).toBe(403);
  });

  test("deny removes a waiting member entirely", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval" },
    });
    await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: (await signin("mkid3@example.com")) },
      payload: { code: openClass.joinCode },
    });
    const [waiting] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.status, "waiting")));
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${openClass.id}/members/${waiting.userId}/deny`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const left = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.userId, waiting.userId)));
    expect(left).toHaveLength(0);
  });

  test("removing a student works; removing the last teacher is refused", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/classes/${openClass.id}/members/${kidId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);

    const last = await app.inject({
      method: "DELETE",
      url: `/api/classes/${openClass.id}/members/${teacherId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(last.statusCode).toBe(400);
    expect(last.json().error).toBe("A class must keep at least one teacher.");
  });
});

describe("last-teacher guard is status-gated", () => {
  test("a waiting teacher may be removed; the sole active teacher still cannot be", async () => {
    const t2 = await makeUser("mteach2@example.com", { isTeacher: true });
    const teacher2Cookie = await signin("mteach2@example.com");
    const freshClass = await createClass(teacher2Cookie, "Fresh Class");

    const waitingTeacher = await makeUser("mkid4@example.com");
    await testDb.insert(classMembers).values({
      classId: freshClass.id,
      userId: waitingTeacher.id,
      role: "teacher",
      status: "waiting",
    });

    // Removing a WAITING teacher must not be blocked by the last-teacher guard.
    const removeWaiting = await app.inject({
      method: "DELETE",
      url: `/api/classes/${freshClass.id}/members/${waitingTeacher.id}`,
      cookies: { pide_session: teacher2Cookie },
    });
    expect(removeWaiting.statusCode).toBe(200);

    const [stillActive] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, freshClass.id), eq(classMembers.userId, t2.id)));
    expect(stillActive.status).toBe("active");

    // The sole ACTIVE teacher is still protected.
    const removeLastActive = await app.inject({
      method: "DELETE",
      url: `/api/classes/${freshClass.id}/members/${t2.id}`,
      cookies: { pide_session: teacher2Cookie },
    });
    expect(removeLastActive.statusCode).toBe(400);
    expect(removeLastActive.json().error).toBe("A class must keep at least one teacher.");
  });
});

describe("archived classes refuse roster mutations", () => {
  // Membership rows are seeded directly (rather than via a real join + signin) so
  // these tests don't burn the /api/auth/signin rate-limit budget shared across the file.
  test("approve after archive is refused", async () => {
    const archivedClass = await createClass(teacherCookie, "Archive Approve");
    const waiter = await makeUser("mwaiter-approve@example.com");
    await testDb.insert(classMembers).values({
      classId: archivedClass.id,
      userId: waiter.id,
      role: "student",
      status: "waiting",
    });
    await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClass.id}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClass.id}/members/${waiter.id}/approve`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That class is archived.");
  });

  test("deny after archive is refused", async () => {
    const archivedClass = await createClass(teacherCookie, "Archive Deny");
    const waiter = await makeUser("mwaiter-deny@example.com");
    await testDb.insert(classMembers).values({
      classId: archivedClass.id,
      userId: waiter.id,
      role: "student",
      status: "waiting",
    });
    await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClass.id}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClass.id}/members/${waiter.id}/deny`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That class is archived.");
  });

  test("remove after archive is refused", async () => {
    const archivedClass = await createClass(teacherCookie, "Archive Remove");
    const member = await makeUser("mmember-remove@example.com");
    await testDb.insert(classMembers).values({
      classId: archivedClass.id,
      userId: member.id,
      role: "student",
      status: "active",
    });
    await app.inject({
      method: "POST",
      url: `/api/classes/${archivedClass.id}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/classes/${archivedClass.id}/members/${member.id}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That class is archived.");
  });
});

describe("only an active teacher may approve", () => {
  test("an active TA gets 403 from approve", async () => {
    const taClass = await createClass(teacherCookie, "TA Approve Check");
    const ta = await makeUser("mta-approve@example.com");
    await testDb.insert(classMembers).values({
      classId: taClass.id,
      userId: ta.id,
      role: "ta",
      status: "active",
    });
    const taCookie = await signin("mta-approve@example.com");
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${taClass.id}/members/${ta.id}/approve`,
      cookies: { pide_session: taCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("removing a member revokes their outstanding pending invites", () => {
  test("teacher invites X; X joins by code instead; removing X revokes the invite; the old link 400s", async () => {
    const revokeClass = await createClass(teacherCookie, "Revoke On Removal");
    const targetEmail = "mrevokeinvitee@example.com";
    await makeUser(targetEmail);
    const targetCookie = await signin(targetEmail);

    await app.inject({
      method: "POST",
      url: `/api/classes/${revokeClass.id}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: [targetEmail], role: "student" },
    });
    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, targetEmail)));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const join = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: targetCookie },
      payload: { code: revokeClass.joinCode },
    });
    expect(join.statusCode).toBe(200);
    expect(join.json().status).toBe("active");

    const [targetUser] = await testDb.select().from(users).where(eq(users.email, targetEmail));
    const remove = await app.inject({
      method: "DELETE",
      url: `/api/classes/${revokeClass.id}/members/${targetUser.id}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(remove.statusCode).toBe(200);

    const [invRow] = await testDb
      .select()
      .from(invites)
      .where(and(eq(invites.classId, revokeClass.id), eq(invites.email, targetEmail)));
    expect(invRow.status).toBe("revoked");

    const accept = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: targetCookie },
      payload: { token },
    });
    expect(accept.statusCode).toBe(400);
    expect(accept.json().error).toBe("That invite link is no longer valid.");
  });
});

/* Task 5, site 8: the class.joined / class.join_requested ternary fans out
 * to the class's active teachers ONLY — never the joiner, never a fellow
 * student. Fresh class + fresh accounts per test so the recipient set is
 * unambiguous (openClass above has accumulated members across many earlier
 * describes in this file). */
describe("notification fan-out for class join (Task 5, site 8)", () => {
  test("an open-mode join notifies active teachers with class.joined; the joiner and a fellow student get nothing", async () => {
    const t = await makeUser("mnotify-teach@example.com", { isTeacher: true });
    const teachCookie = await signin("mnotify-teach@example.com");
    const cls = await createClass(teachCookie, "Notify Open Class");
    const fellow = await makeUser("mnotify-fellow@example.com");
    await testDb
      .insert(classMembers)
      .values({ classId: cls.id, userId: fellow.id, role: "student", status: "active" });

    const joiner = await makeUser("mnotify-joiner@example.com");
    const joinerCookie = await signin("mnotify-joiner@example.com");
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: joinerCookie },
      payload: { code: cls.joinCode },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("active");

    const teacherNotifs = await notificationsFor(t.id);
    expect(teacherNotifs).toHaveLength(1);
    expect(teacherNotifs[0].type).toBe("class.joined");
    expect(teacherNotifs[0].payload).toEqual({ classId: cls.id, joinerId: joiner.id });

    const [ev] = await testDb.select().from(events).where(eq(events.id, teacherNotifs[0].eventId));
    expect(ev.type).toBe("class.joined");
    expect(ev.actorId).toBe(joiner.id);

    // Negative: neither the joiner nor a fellow student is addressed.
    expect(await notificationsFor(joiner.id)).toHaveLength(0);
    expect(await notificationsFor(fellow.id)).toHaveLength(0);
  });

  test("an approval-mode join notifies active teachers with class.join_requested", async () => {
    const t = await makeUser("mnotify-teach2@example.com", { isTeacher: true });
    const teachCookie = await signin("mnotify-teach2@example.com");
    const cls = await createClass(teachCookie, "Notify Approval Class");
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${cls.id}`,
      cookies: { pide_session: teachCookie },
      payload: { joinMode: "approval" },
    });

    const joiner = await makeUser("mnotify-joiner2@example.com");
    const joinerCookie = await signin("mnotify-joiner2@example.com");
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      remoteAddress: nextJoinIp(),
      cookies: { pide_session: joinerCookie },
      payload: { code: cls.joinCode },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("waiting");

    const teacherNotifs = await notificationsFor(t.id);
    expect(teacherNotifs).toHaveLength(1);
    expect(teacherNotifs[0].type).toBe("class.join_requested");
    expect(teacherNotifs[0].payload).toEqual({ classId: cls.id, joinerId: joiner.id });

    // Negative: the joiner (still waiting) gets nothing for their own request.
    expect(await notificationsFor(joiner.id)).toHaveLength(0);
  });
});

/* DEPLOY.md box 8 — join-code guessing. Plain per-IP throttle (no DB
 * counting, no lock): app.ts:54-57's own note says a route registered
 * directly on the root instance has a SILENTLY INERT `config.rateLimit` —
 * memberRoutes is `app.register`ed (app.ts:63), so proving the 429 fires is
 * the only way to know this route's config actually took effect, the
 * auth.signup.test.ts / mailEvents.test.ts idiom. */
describe("join rate limit (60/min per IP, DEPLOY.md box 8)", () => {
  test("allows 60 requests per minute then returns 429", async () => {
    // Fresh instance: the limiter's in-memory store is per-app, so this
    // can't interfere with the rest of this file's request count against
    // the shared `app`.
    const rlApp = buildApp({ db: testDb });
    try {
      // No session cookie: requireConfirmed (a preHandler) would 401 this,
      // but the rate-limit plugin hooks onRequest, which runs BEFORE any
      // preHandler — so the limiter counts (and eventually blocks) these
      // regardless of the 401 the handler chain would otherwise produce.
      for (let i = 0; i < 60; i++) {
        const res = await rlApp.inject({
          method: "POST",
          url: "/api/classes/join",
          payload: { code: "AAA-000" },
        });
        expect(res.statusCode).toBe(401);
      }
      const res61 = await rlApp.inject({
        method: "POST",
        url: "/api/classes/join",
        payload: { code: "AAA-000" },
      });
      expect(res61.statusCode).toBe(429);
      // DEPLOY.md box 8 — house copy, not the plugin's own default body,
      // via app.ts's shared errorResponseBuilder.
      expect(res61.json().error).toBe(RATE_LIMIT_MESSAGE);
    } finally {
      await rlApp.close();
    }
  });
});
