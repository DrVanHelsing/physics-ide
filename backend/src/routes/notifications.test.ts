import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, assignments, notifications, events } from "../db/schema.js";
import { logEvent } from "../db/events.js";
import { notify } from "../notifications/notify.js";

const app = buildApp({ db: testDb });

let classId: string;
const className = "Notifications Class";

type Member = { id: string; cookie: string };
const teacher = {} as Member;
const alpha = {} as Member;
const bravo = {} as Member;
let unconfirmedCookie: string;

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
 * sized for humans and this file signs in several accounts (the
 * groups.test.ts / authority.matrix.test.ts idiom). */
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

/** A published assignment row, inserted directly (bypassing the assignments
 *  route) — all this suite needs is a real row an assignmentId can resolve
 *  against, plus one it can stop resolving against once deleted. */
async function makeAssignment(title: string): Promise<string> {
  const [row] = await testDb
    .insert(assignments)
    .values({
      classId,
      createdBy: teacher.id,
      title,
      instructions: { type: "doc", content: [] },
      projectType: "physics",
      rules: {},
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  return row.id;
}

function getNotifications(cookie: string, qs = "") {
  return app.inject({
    method: "GET",
    url: `/api/notifications${qs}`,
    cookies: { pide_session: cookie },
  });
}

function postRead(cookie: string, body: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/notifications/read",
    cookies: { pide_session: cookie },
    payload: body,
  });
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);

  const t = await makeUser("nteach@example.com", { isTeacher: true });
  const a = await makeUser("nalpha@example.com");
  const b = await makeUser("nbravo@example.com");
  await makeUser("nunconfirmed@example.com", { emailConfirmedAt: null });

  teacher.id = t.id;
  teacher.cookie = await signin("nteach@example.com");
  alpha.id = a.id;
  alpha.cookie = await signin("nalpha@example.com");
  bravo.id = b.id;
  bravo.cookie = await signin("nbravo@example.com");
  unconfirmedCookie = await signin("nunconfirmed@example.com");

  const classRes = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: teacher.cookie },
    payload: { name: className },
  });
  classId = classRes.json().class.id;
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("GET /api/notifications", () => {
  test("an anonymous request is refused", async () => {
    const res = await app.inject({ method: "GET", url: "/api/notifications" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Not signed in.");
  });

  test("an unconfirmed account is refused by the guard", async () => {
    const res = await getNotifications(unconfirmedCookie);
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Confirm your email address first.");
  });

  test("a confirmed account with nothing waiting reads the empty state", async () => {
    const res = await getNotifications(alpha.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ notifications: [], unreadCount: 0 });
  });

  let publishedAssignmentId: string;

  test("assignment.published renders the class name and title, addressed only to its recipient", async () => {
    publishedAssignmentId = await makeAssignment("Orbital Mechanics");
    await testDb.transaction(async (tx) => {
      const eid = await logEvent(tx, "assignment.published", teacher.id, {
        assignmentId: publishedAssignmentId,
      });
      await notify(tx, [alpha.id], eid, "assignment.published", {
        assignmentId: publishedAssignmentId,
        classId,
      });
    });

    const res = await getNotifications(alpha.cookie);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.notifications).toHaveLength(1);
    const row = body.notifications[0];
    expect(row.text).toBe(`New assignment in ${className}: “Orbital Mechanics”`);
    expect(row.href).toBe(`/classes/${classId}/assignments/${publishedAssignmentId}`);
    expect(row.readAt).toBeNull();
    expect(body.unreadCount).toBe(1);

    // Addressing is per-row: bravo was never notified, so bravo's inbox stays empty.
    const bravoRes = await getNotifications(bravo.cookie);
    expect(bravoRes.json()).toEqual({ notifications: [], unreadCount: 0 });
  });

  let sharedNotificationId: number;

  test("project.shared resolves the sharer's name live — an erased sharer reads Removed student", async () => {
    const sharer = await makeUser("nsharer@example.com");
    await testDb.transaction(async (tx) => {
      const eid = await logEvent(tx, "project.shared", sharer.id, { shareId: "s-1", classId });
      await notify(tx, [alpha.id], eid, "project.shared", {
        shareId: "s-1",
        classId,
        sharerId: sharer.id,
        title: "Pendulum",
      });
    });

    const before = await getNotifications(alpha.cookie);
    const beforeRow = before
      .json()
      .notifications.find((n: { type: string }) => n.type === "project.shared");
    expect(beforeRow).toBeDefined();
    expect(beforeRow.text).toBe(`${sharer.name} shared “Pendulum” with you`);
    sharedNotificationId = beforeRow.id;

    // Erase the sharer directly, the way the admin erase route would.
    await testDb.delete(users).where(eq(users.id, sharer.id));

    const after = await getNotifications(alpha.cookie);
    const afterRow = after
      .json()
      .notifications.find((n: { id: number }) => n.id === sharedNotificationId);
    expect(afterRow).toBeDefined();
    expect(afterRow.text).toBe("Removed student shared “Pendulum” with you");
  });

  test("a deleted assignment renders the generic fallback text — never a 500, never a dropped row", async () => {
    const fallbackAssignmentId = await makeAssignment("Vanishing Assignment");
    await testDb.transaction(async (tx) => {
      const eid = await logEvent(tx, "assignment.published", teacher.id, {
        assignmentId: fallbackAssignmentId,
      });
      await notify(tx, [alpha.id], eid, "assignment.published", {
        assignmentId: fallbackAssignmentId,
        classId,
      });
    });
    await testDb.delete(assignments).where(eq(assignments.id, fallbackAssignmentId));

    const res = await getNotifications(alpha.cookie);
    expect(res.statusCode).toBe(200);
    const row = res
      .json()
      .notifications.find((n: { href: string }) => n.href.includes(fallbackAssignmentId));
    expect(row).toBeDefined();
    expect(row.text).toBe("A new assignment was published");
  });

  test("class.join_requested hrefs to the class's People tab, where approval actually lives — final review M4", async () => {
    const joiner = await makeUser("njoinreq@example.com");
    await testDb.transaction(async (tx) => {
      const eid = await logEvent(tx, "class.join_requested", joiner.id, { classId, joinerId: joiner.id });
      await notify(tx, [teacher.id], eid, "class.join_requested", { classId, joinerId: joiner.id });
    });

    const res = await getNotifications(teacher.cookie);
    expect(res.statusCode).toBe(200);
    const row = res
      .json()
      .notifications.find((n: { type: string }) => n.type === "class.join_requested");
    expect(row).toBeDefined();
    expect(row.text).toBe(`${joiner.name} asked to join ${className}`);
    expect(row.href).toBe(`/classes/${classId}/people`);
  });

  describe("ordering and the limit query param", () => {
    const gamma = {} as Member;

    beforeAll(async () => {
      const g = await makeUser("ngamma@example.com");
      gamma.id = g.id;
      gamma.cookie = await signin("ngamma@example.com");

      await testDb.transaction(async (tx) => {
        const eid = await logEvent(tx, "class.joined", alpha.id, { classId, joinerId: alpha.id });
        await notify(tx, [gamma.id], eid, "class.joined", { classId, joinerId: alpha.id });
      });
      await testDb.transaction(async (tx) => {
        const eid = await logEvent(tx, "class.joined", bravo.id, { classId, joinerId: bravo.id });
        await notify(tx, [gamma.id], eid, "class.joined", { classId, joinerId: bravo.id });
      });
    });

    test("newest first; a limited page still reports the true unread count", async () => {
      const full = await getNotifications(gamma.cookie);
      expect(full.statusCode).toBe(200);
      const rows = full.json().notifications;
      expect(rows).toHaveLength(2);
      expect(rows[0].id).toBeGreaterThan(rows[1].id);
      expect(full.json().unreadCount).toBe(2);

      const limited = await getNotifications(gamma.cookie, "?limit=1");
      expect(limited.json().notifications).toHaveLength(1);
      expect(limited.json().notifications[0].id).toBe(rows[0].id);
      expect(limited.json().unreadCount).toBe(2);
    });
  });

  /* Final review I2: `Number("-1") || 30` used to reach Postgres as
   * `LIMIT -1` ("ERROR: LIMIT must not be negative", a 500), and
   * `Number("1.5")` reached it as `LIMIT 1.5` ("invalid input syntax for
   * type bigint", also a 500) — verified against this same test DB. Every
   * one of these must come back 200, matching the "never a 500" posture
   * this plan states verbatim elsewhere (shares.ts, admin.ts). */
  describe("the limit query param clamps instead of ever reaching Postgres malformed", () => {
    const delta = {} as Member;
    let deltaAssignmentId: string;

    beforeAll(async () => {
      const d = await makeUser("ndelta@example.com");
      delta.id = d.id;
      delta.cookie = await signin("ndelta@example.com");
      deltaAssignmentId = await makeAssignment("Delta Limit Assignment");

      // Three rows: enough to distinguish "the default page size" (30, so
      // all three come back) from "?limit=1" (exactly one).
      for (let i = 0; i < 3; i++) {
        await testDb.transaction(async (tx) => {
          const eid = await logEvent(tx, "assignment.published", teacher.id, {
            assignmentId: deltaAssignmentId,
          });
          await notify(tx, [delta.id], eid, "assignment.published", {
            assignmentId: deltaAssignmentId,
            classId,
          });
        });
      }
    });

    test.each(["-1", "1.5", "0", "abc"])(
      "?limit=%s -> 200, falls back to the default page size (never a 500)",
      async (bad) => {
        const res = await getNotifications(delta.cookie, `?limit=${bad}`);
        expect(res.statusCode).toBe(200);
        expect(res.json().notifications).toHaveLength(3);
      },
    );

    test("?limit=1 still returns exactly one row", async () => {
      const res = await getNotifications(delta.cookie, "?limit=1");
      expect(res.statusCode).toBe(200);
      expect(res.json().notifications).toHaveLength(1);
    });

    test("?limit=99999 caps at 100", async () => {
      const [ev] = await testDb
        .insert(events)
        .values({
          type: "assignment.published",
          actorId: teacher.id,
          payload: { assignmentId: deltaAssignmentId },
        })
        .returning();
      // Past the 3 already seeded, well past the 100 cap.
      await testDb.insert(notifications).values(
        Array.from({ length: 105 }, () => ({
          userId: delta.id,
          eventId: ev.id,
          type: "assignment.published",
          payload: { assignmentId: deltaAssignmentId, classId },
        })),
      );

      const res = await getNotifications(delta.cookie, "?limit=99999");
      expect(res.statusCode).toBe(200);
      expect(res.json().notifications).toHaveLength(100);
    });
  });
});

describe("POST /api/notifications/read", () => {
  let bravoNotificationId: number;

  beforeAll(async () => {
    await testDb.transaction(async (tx) => {
      const eid = await logEvent(tx, "class.joined", alpha.id, { classId, joinerId: alpha.id });
      await notify(tx, [bravo.id], eid, "class.joined", { classId, joinerId: alpha.id });
    });
    const [row] = await testDb.select().from(notifications).where(eq(notifications.userId, bravo.id));
    bravoNotificationId = row.id;
  });

  test("no body marks every one of the caller's unread rows read; another user's row is untouched", async () => {
    const res = await postRead(alpha.cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const after = await getNotifications(alpha.cookie);
    expect(after.json().unreadCount).toBe(0);
    for (const n of after.json().notifications) {
      expect(n.readAt).not.toBeNull();
    }

    const bravoRes = await getNotifications(bravo.cookie);
    const bravoRow = bravoRes
      .json()
      .notifications.find((n: { id: number }) => n.id === bravoNotificationId);
    expect(bravoRow).toBeDefined();
    expect(bravoRow.readAt).toBeNull();
  });

  test("{ ids } marks only the named row, leaving its sibling unread", async () => {
    await testDb.transaction(async (tx) => {
      const eid = await logEvent(tx, "class.joined", teacher.id, { classId, joinerId: bravo.id });
      await notify(tx, [alpha.id], eid, "class.joined", { classId, joinerId: bravo.id });
    });
    await testDb.transaction(async (tx) => {
      const eid = await logEvent(tx, "class.joined", teacher.id, { classId, joinerId: bravo.id });
      await notify(tx, [alpha.id], eid, "class.joined", { classId, joinerId: bravo.id });
    });

    const before = await getNotifications(alpha.cookie);
    const unread = before.json().notifications.filter((n: { readAt: unknown }) => n.readAt === null);
    expect(unread).toHaveLength(2);
    const [newest, older] = unread;

    const res = await postRead(alpha.cookie, { ids: [newest.id] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const after = await getNotifications(alpha.cookie);
    const afterNewest = after.json().notifications.find((n: { id: number }) => n.id === newest.id);
    const afterOlder = after.json().notifications.find((n: { id: number }) => n.id === older.id);
    expect(afterNewest.readAt).not.toBeNull();
    expect(afterOlder.readAt).toBeNull();
    expect(after.json().unreadCount).toBe(1);
  });

  /* Final review M5: `z.array(z.number().int())` had no upper bound, so a
   * confirmed user could post ~100k ids into one IN clause. `.max(200)`
   * closes it — chosen shape: an over-long `ids` array fails the schema
   * the SAME way any other malformed body already does on this route (see
   * `const ids = parsed.success ? parsed.data.ids : undefined` above), so
   * it silently falls back to this route's existing no-`ids` behaviour
   * (mark every one of the caller's own unread rows read) rather than a
   * 400 — this route has never returned 400 for a bad body, and scoping
   * stays on `req.user!.id` either way, so there is nothing unsafe about
   * the fallback. */
  test("{ ids } with more than 200 entries is refused by the schema and falls back to marking every unread row read (final review M5)", async () => {
    await testDb.transaction(async (tx) => {
      const eid = await logEvent(tx, "class.joined", teacher.id, { classId, joinerId: bravo.id });
      await notify(tx, [alpha.id], eid, "class.joined", { classId, joinerId: bravo.id });
    });
    const before = await getNotifications(alpha.cookie);
    expect(before.json().unreadCount).toBeGreaterThan(0);

    const oversized = Array.from({ length: 201 }, (_, i) => i + 1);
    const res = await postRead(alpha.cookie, { ids: oversized });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const after = await getNotifications(alpha.cookie);
    expect(after.json().unreadCount).toBe(0);
  });
});
