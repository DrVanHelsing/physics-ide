import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classes, classMembers, events, shares } from "../db/schema.js";
import { CLASS_CODE_REGEX } from "@physics-ide/shared";
import { CLASS_CREATE_CAP, CLASS_CREATE_WINDOW_MS, CLASS_CREATE_CAP_MESSAGE } from "./classes.js";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let studentCookie: string;
let unconfirmedCookie: string;
let classId: string;

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

async function signin(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

// The class-creation cap tests below each need a fully isolated per-account
// hour count, so each gets its OWN app instance (the auth.password.test.ts /
// auth.signup.test.ts idiom) rather than the shared `app` + `teacherCookie`
// this file's other describes use.
async function signinTo(targetApp: ReturnType<typeof buildApp>, email: string): Promise<string> {
  const res = await targetApp.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("teach@example.com", { isTeacher: true });
  await makeUser("kid@example.com");
  await makeUser("newbie@example.com", { emailConfirmedAt: null });
  teacherCookie = await signin("teach@example.com");
  studentCookie = await signin("kid@example.com");
  unconfirmedCookie = await signin("newbie@example.com");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/classes", () => {
  test("teacher creates a class: code minted, creator is an active teacher member, event logged", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Grade 11 Physical Sciences", subjectLabel: "2027" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    classId = body.class.id;
    expect(CLASS_CODE_REGEX.test(body.class.joinCode)).toBe(true);
    expect(body.class.joinMode).toBe("open");

    const members = await testDb.select().from(classMembers).where(eq(classMembers.classId, classId));
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("teacher");
    expect(members[0].status).toBe("active");

    const evts = await testDb.select().from(events).where(eq(events.type, "class.created"));
    expect(evts.length).toBeGreaterThanOrEqual(1);
  });

  test("a non-teacher account is refused", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: studentCookie },
      payload: { name: "Nope" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Only teacher accounts can create classes.");
  });

  test("an unconfirmed account is refused first", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: unconfirmedCookie },
      payload: { name: "Nope" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Confirm your email address first.");
  });
});

describe("GET /api/classes and /api/classes/:id", () => {
  test("lists my classes with my role; teacher detail includes the join code", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().classes).toHaveLength(1);
    expect(list.json().classes[0].myRole).toBe("teacher");

    const detail = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().class.joinCode).toBeDefined();
  });

  test("a non-member gets 404 (no existence oracle) and no join code leaks to students", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such class.");
  });
});

describe("settings, code regeneration, archive", () => {
  test("teacher updates settings; students cannot", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval", name: "Renamed" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.joinMode).toBe("approval");
    expect(res.json().class.name).toBe("Renamed");

    const deny = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: studentCookie },
      payload: { name: "Hax" },
    });
    expect(deny.statusCode).toBe(403);
  });

  test("regenerating the code changes it", async () => {
    const [before] = await testDb.select().from(classes).where(eq(classes.id, classId));
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/regenerate-code`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().joinCode).not.toBe(before.joinCode);
    expect(CLASS_CODE_REGEX.test(res.json().joinCode)).toBe(true);
  });

  test("archive blocks settings changes until unarchive", async () => {
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const blocked = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { name: "While archived" },
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error).toBe("That class is archived.");

    const un = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/unarchive`,
      cookies: { pide_session: teacherCookie },
    });
    expect(un.statusCode).toBe(200);
  });
});

describe("PATCH edge case and join-code visibility by role+status", () => {
  test("PATCH with an empty body returns 200 unchanged, not a 500", async () => {
    const [before] = await testDb.select().from(classes).where(eq(classes.id, classId));
    const res = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.name).toBe(before.name);
    expect(res.json().class.joinMode).toBe(before.joinMode);
    expect(res.json().class.joinCode).toBe(before.joinCode);
  });

  test("PATCH with unknown keys also returns 200 unchanged, not a 500", async () => {
    const [before] = await testDb.select().from(classes).where(eq(classes.id, classId));
    const res = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { foo: 1 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.name).toBe(before.name);
  });

  test("an active student member sees their role but not the join code", async () => {
    const [kid] = await testDb.select().from(users).where(eq(users.email, "kid@example.com"));
    await testDb.insert(classMembers).values({ classId, userId: kid.id, role: "student", status: "active" });
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.myRole).toBe("student");
    expect(res.json().class.joinCode).toBeUndefined();
  });

  test("the sharing switch: off by default, teacher flips it, the event records it", async () => {
    const before = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(before.json().class.peerSharing).toBe(false);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { peerSharing: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.peerSharing).toBe(true);

    const evts = await testDb.select().from(events).where(eq(events.type, "class.updated"));
    const payload = evts.at(-1)!.payload as { patch: Record<string, unknown> };
    expect(payload.patch).toEqual({ peerSharing: true });
  });

  test("a waiting teacher-role member does not see the join code", async () => {
    const [pending] = await testDb
      .insert(users)
      .values({
        name: "pending",
        email: "pending@example.com",
        passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      })
      .returning();
    await testDb
      .insert(classMembers)
      .values({ classId, userId: pending.id, role: "teacher", status: "waiting" });
    const pendingCookie = await signin("pending@example.com");
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: pendingCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.myRole).toBe("teacher");
    expect(res.json().class.joinCode).toBeUndefined();
  });
});

describe("PATCH peerSharing:false lapses pending shares (D§8)", () => {
  test("pending shares lapse with one project.share_lapsed event each; an accepted row stands", async () => {
    const [teacherUser] = await testDb.select().from(users).where(eq(users.email, "teach@example.com"));
    const [kidUser] = await testDb.select().from(users).where(eq(users.email, "kid@example.com"));

    const created = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Lapse Class" },
    });
    const lapseClassId = created.json().class.id;
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${lapseClassId}`,
      cookies: { pide_session: teacherCookie },
      payload: { peerSharing: true },
    });

    const manifest = {
      schemaVersion: 2,
      id: "p-lapse",
      title: "Lapse Fixture",
      goal: "physics",
      projectType: "custom",
      createdAt: 1000,
      updatedAt: 2000,
    };
    const [pending] = await testDb
      .insert(shares)
      .values({
        classId: lapseClassId,
        sharerId: teacherUser.id,
        recipientId: kidUser.id,
        sourceOwnerId: teacherUser.id,
        sourceProjectId: "p-lapse-pending",
        frozenManifest: manifest,
        sourceClientUpdatedAt: 2000,
        status: "pending",
      })
      .returning();
    const [accepted] = await testDb
      .insert(shares)
      .values({
        classId: lapseClassId,
        sharerId: teacherUser.id,
        recipientId: kidUser.id,
        sourceOwnerId: teacherUser.id,
        sourceProjectId: "p-lapse-accepted",
        frozenManifest: manifest,
        sourceClientUpdatedAt: 2000,
        status: "accepted",
        copyProjectId: "p-lapse-accepted-copy",
        resolvedAt: new Date(),
      })
      .returning();

    const res = await app.inject({
      method: "PATCH",
      url: `/api/classes/${lapseClassId}`,
      cookies: { pide_session: teacherCookie },
      payload: { peerSharing: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.peerSharing).toBe(false);

    const [pendingAfter] = await testDb.select().from(shares).where(eq(shares.id, pending.id));
    expect(pendingAfter.status).toBe("lapsed");
    expect(pendingAfter.resolvedAt).not.toBeNull();

    const [acceptedAfter] = await testDb.select().from(shares).where(eq(shares.id, accepted.id));
    expect(acceptedAfter.status).toBe("accepted");
    expect(acceptedAfter.resolvedAt?.getTime()).toBe(accepted.resolvedAt?.getTime());

    const lapsedEvents = await testDb.select().from(events).where(eq(events.type, "project.share_lapsed"));
    const matching = lapsedEvents.filter((e) => (e.payload as { shareId: string }).shareId === pending.id);
    expect(matching).toHaveLength(1);
    expect(matching[0].payload).toEqual({
      shareId: pending.id,
      classId: lapseClassId,
      sharerId: teacherUser.id,
      recipientId: kidUser.id,
    });
    expect(lapsedEvents.some((e) => (e.payload as { shareId: string }).shareId === accepted.id)).toBe(
      false,
    );
  });
});

describe("POST /api/classes/:id/archive lapses pending shares", () => {
  test("pending shares lapse on archive with one project.share_lapsed event each; an accepted row stands; accepting the lapsed share now 409s", async () => {
    const [teacherUser] = await testDb.select().from(users).where(eq(users.email, "teach@example.com"));
    const [kidUser] = await testDb.select().from(users).where(eq(users.email, "kid@example.com"));

    const created = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Archive Lapse Class" },
    });
    const archiveClassId = created.json().class.id;
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${archiveClassId}`,
      cookies: { pide_session: teacherCookie },
      payload: { peerSharing: true },
    });
    await testDb
      .insert(classMembers)
      .values({ classId: archiveClassId, userId: kidUser.id, role: "student", status: "active" });

    const manifest = {
      schemaVersion: 2,
      id: "p-arc-lapse",
      title: "Archive Lapse Fixture",
      goal: "physics",
      projectType: "custom",
      createdAt: 1000,
      updatedAt: 2000,
    };
    const [pending] = await testDb
      .insert(shares)
      .values({
        classId: archiveClassId,
        sharerId: teacherUser.id,
        recipientId: kidUser.id,
        sourceOwnerId: teacherUser.id,
        sourceProjectId: "p-arc-lapse-pending",
        frozenManifest: manifest,
        sourceClientUpdatedAt: 2000,
        status: "pending",
      })
      .returning();
    const [accepted] = await testDb
      .insert(shares)
      .values({
        classId: archiveClassId,
        sharerId: teacherUser.id,
        recipientId: kidUser.id,
        sourceOwnerId: teacherUser.id,
        sourceProjectId: "p-arc-lapse-accepted",
        frozenManifest: manifest,
        sourceClientUpdatedAt: 2000,
        status: "accepted",
        copyProjectId: "p-arc-lapse-accepted-copy",
        resolvedAt: new Date(),
      })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${archiveClassId}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().archived).toBe(true);

    const [pendingAfter] = await testDb.select().from(shares).where(eq(shares.id, pending.id));
    expect(pendingAfter.status).toBe("lapsed");
    expect(pendingAfter.resolvedAt).not.toBeNull();

    const [acceptedAfter] = await testDb.select().from(shares).where(eq(shares.id, accepted.id));
    expect(acceptedAfter.status).toBe("accepted");
    expect(acceptedAfter.resolvedAt?.getTime()).toBe(accepted.resolvedAt?.getTime());

    const lapsedEvents = await testDb.select().from(events).where(eq(events.type, "project.share_lapsed"));
    const matching = lapsedEvents.filter((e) => (e.payload as { shareId: string }).shareId === pending.id);
    expect(matching).toHaveLength(1);
    expect(matching[0].payload).toEqual({
      shareId: pending.id,
      classId: archiveClassId,
      sharerId: teacherUser.id,
      recipientId: kidUser.id,
    });
    expect(lapsedEvents.some((e) => (e.payload as { shareId: string }).shareId === accepted.id)).toBe(
      false,
    );

    // The seam shut end to end: accepting the now-lapsed share 409s.
    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/shares/${pending.id}/accept`,
      cookies: { pide_session: studentCookie },
      payload: { projectId: "p-arc-lapse-copy" },
    });
    expect(acceptRes.statusCode).toBe(409);
    expect(acceptRes.json().error).toBe("That share has already been dealt with.");
  });
});

/* DEPLOY.md box 8 — class-creation cap. DB-counted (this is a role-checked,
 * authenticated route, not an anonymous door), closed against the same
 * check-then-act race Task 5's per-address reset cap named a CRITICAL for:
 * every test below gets its OWN account (and, for the concurrency case, its
 * own app instance too) so its hour count can't be polluted by classes this
 * file's shared `app`/`teacherCookie` already created above. */
describe("class creation cap (10/hour per account, DEPLOY.md box 8)", () => {
  test("CLASS_CREATE_CAP is 10 per CLASS_CREATE_WINDOW_MS (1 hour)", () => {
    expect(CLASS_CREATE_CAP).toBe(10);
    expect(CLASS_CREATE_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  test("10 classes succeed; the 11th is refused with the exact sentence and writes nothing", async () => {
    const capApp = buildApp({ db: testDb });
    try {
      await testDb.insert(users).values({
        name: "Cap Teacher",
        email: "capteacher@example.com",
        passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
        isTeacher: true,
      });
      const capCookie = await signinTo(capApp, "capteacher@example.com");
      for (let i = 0; i < CLASS_CREATE_CAP; i++) {
        const res = await capApp.inject({
          method: "POST",
          url: "/api/classes",
          cookies: { pide_session: capCookie },
          payload: { name: `Cap Class ${i}` },
        });
        expect(res.statusCode).toBe(201);
      }
      const [capTeacher] = await testDb
        .select()
        .from(users)
        .where(eq(users.email, "capteacher@example.com"));

      const over = await capApp.inject({
        method: "POST",
        url: "/api/classes",
        cookies: { pide_session: capCookie },
        payload: { name: "One Too Many" },
      });
      expect(over.statusCode).toBe(429);
      expect(over.json().error).toBe(CLASS_CREATE_CAP_MESSAGE);

      const after = await testDb.select().from(classes).where(eq(classes.createdBy, capTeacher.id));
      expect(after).toHaveLength(CLASS_CREATE_CAP);
    } finally {
      await capApp.close();
    }
  });

  test("a class created outside the window doesn't count toward the cap", async () => {
    const staleApp = buildApp({ db: testDb });
    try {
      const [staleTeacher] = await testDb
        .insert(users)
        .values({
          name: "Stale Cap Teacher",
          email: "stalecapteacher@example.com",
          passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
          emailConfirmedAt: new Date(),
          consentAt: new Date(),
          isTeacher: true,
        })
        .returning();
      // CLASS_CREATE_CAP rows, all OUTSIDE the window — must not count.
      await testDb.insert(classes).values(
        Array.from({ length: CLASS_CREATE_CAP }, (_, i) => ({
          name: `Stale Class ${i}`,
          joinCode: `stale-${randomUUID()}`,
          createdBy: staleTeacher.id,
          createdAt: new Date(Date.now() - (CLASS_CREATE_WINDOW_MS + 60_000)),
        })),
      );

      const staleCookie = await signinTo(staleApp, "stalecapteacher@example.com");
      const res = await staleApp.inject({
        method: "POST",
        url: "/api/classes",
        cookies: { pide_session: staleCookie },
        payload: { name: "Fresh After Stale" },
      });
      expect(res.statusCode).toBe(201);
    } finally {
      await staleApp.close();
    }
  });

  test("another account's classes don't count toward this account's cap", async () => {
    const otherApp = buildApp({ db: testDb });
    try {
      const [busyTeacher] = await testDb
        .insert(users)
        .values({
          name: "Busy Cap Teacher",
          email: "busycapteacher@example.com",
          passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
          emailConfirmedAt: new Date(),
          consentAt: new Date(),
          isTeacher: true,
        })
        .returning();
      // Exhaust — and go past — the neighbour's own budget.
      await testDb.insert(classes).values(
        Array.from({ length: CLASS_CREATE_CAP + 1 }, (_, i) => ({
          name: `Busy Class ${i}`,
          joinCode: `busy-${randomUUID()}`,
          createdBy: busyTeacher.id,
        })),
      );

      await testDb.insert(users).values({
        name: "Quiet Cap Teacher",
        email: "quietcapteacher@example.com",
        passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
        isTeacher: true,
      });
      const quietCookie = await signinTo(otherApp, "quietcapteacher@example.com");
      const res = await otherApp.inject({
        method: "POST",
        url: "/api/classes",
        cookies: { pide_session: quietCookie },
        payload: { name: "Quiet's First Class" },
      });
      expect(res.statusCode).toBe(201);
    } finally {
      await otherApp.close();
    }
  });

  test("concurrent creations from the same account cannot blow past the cap", async () => {
    // Proves the advisory-lock serialisation, not just the cap's
    // arithmetic: seeds CAP - 1 already-created classes (exactly one slot
    // left) then fires 5 concurrent creations. A plain check-then-act (no
    // lock) lets several of them read the same under-cap count and all
    // insert — this test fails against that shape and holds against the
    // lock.
    const raceApp = buildApp({ db: testDb });
    try {
      const [raceTeacher] = await testDb
        .insert(users)
        .values({
          name: "Race Cap Teacher",
          email: "racecapteacher@example.com",
          passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
          emailConfirmedAt: new Date(),
          consentAt: new Date(),
          isTeacher: true,
        })
        .returning();
      await testDb.insert(classes).values(
        Array.from({ length: CLASS_CREATE_CAP - 1 }, (_, i) => ({
          name: `Race Seed ${i}`,
          joinCode: `race-seed-${randomUUID()}`,
          createdBy: raceTeacher.id,
        })),
      );

      const raceCookie = await signinTo(raceApp, "racecapteacher@example.com");
      // POST /api/classes carries no per-IP rate limit (only join-by-code
      // does), so this isn't strictly load-bearing here — but a distinct
      // remoteAddress per request keeps the intent unambiguous and matches
      // the auth.password.test.ts idiom for every concurrent-request test.
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          raceApp.inject({
            method: "POST",
            url: "/api/classes",
            cookies: { pide_session: raceCookie },
            remoteAddress: `10.93.0.${i + 1}`,
            payload: { name: `Race Class ${i}` },
          }),
        ),
      );
      const created = results.filter((r) => r.statusCode === 201);
      const refused = results.filter((r) => r.statusCode === 429);
      expect(created).toHaveLength(1);
      expect(refused).toHaveLength(4);

      const totalNow = await testDb.select().from(classes).where(eq(classes.createdBy, raceTeacher.id));
      expect(totalNow).toHaveLength(CLASS_CREATE_CAP);
    } finally {
      await raceApp.close();
    }
  });
});
