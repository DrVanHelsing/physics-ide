import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import argon2 from "argon2";
import { eq, and } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, emails, sessions, emailTokens, events } from "../db/schema.js";
import { newToken } from "../auth/tokens.js";
import type { Mailer } from "../email/mailer.js";
import { RESET_TTL_MS, RESET_REQUEST_CAP, RESET_REQUEST_WINDOW_MS } from "./auth.js";

const app = buildApp({ db: testDb });

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await testDb.insert(users).values({
    name: "Reset Person",
    email: "reset@example.com",
    passwordHash: await argon2.hash("old-password-1", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

async function signin(password: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email: "reset@example.com", password },
  });
}

describe("forgot / reset", () => {
  test("forgot always answers ok, and mails a reset link when the account exists", async () => {
    const unknown = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "ghost@example.com" },
    });
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json()).toEqual({ ok: true });
    const ghostMail = await testDb.select().from(emails).where(eq(emails.toEmail, "ghost@example.com"));
    expect(ghostMail).toHaveLength(0);

    const known = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "reset@example.com" },
    });
    expect(known.statusCode).toBe(200);
    const mails = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "reset@example.com"), eq(emails.template, "reset")));
    expect(mails).toHaveLength(1);
    expect(mails[0].bodyText).toContain("/auth/reset?token=");
  });

  test("reset changes the password, is single-use, and kills every session", async () => {
    const live = await signin("old-password-1");
    expect(live.statusCode).toBe(200);

    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "reset@example.com"), eq(emails.template, "reset")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token, password: "new-password-1" },
    });
    expect(res.statusCode).toBe(200);

    const [u] = await testDb.select().from(users).where(eq(users.email, "reset@example.com"));
    const liveSessions = await testDb.select().from(sessions).where(eq(sessions.userId, u.id));
    expect(liveSessions).toHaveLength(0);

    expect((await signin("old-password-1")).statusCode).toBe(401);
    expect((await signin("new-password-1")).statusCode).toBe(200);

    const again = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token, password: "sneaky-password" },
    });
    expect(again.statusCode).toBe(400);
  });
});

describe("reset hardening", () => {
  const hApp = buildApp({ db: testDb });

  afterAll(async () => {
    await hApp.close();
  });

  test("retiring a reset token retires every other outstanding one for that user", async () => {
    await testDb.insert(users).values({
      name: "Hardening Person",
      email: "hardening@example.com",
      passwordHash: await argon2.hash("hardening-pw-1", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });

    await hApp.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "hardening@example.com" },
    });
    await hApp.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "hardening@example.com" },
    });

    const mails = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "hardening@example.com"), eq(emails.template, "reset")))
      .orderBy(emails.id);
    expect(mails).toHaveLength(2);
    const token1 = /token=([A-Za-z0-9_-]+)/.exec(mails[0].bodyText)![1];
    const token2 = /token=([A-Za-z0-9_-]+)/.exec(mails[1].bodyText)![1];

    const second = await hApp.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token: token2, password: "hardened-pw-2" },
    });
    expect(second.statusCode).toBe(200);

    const first = await hApp.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token: token1, password: "sneaky-pw-3" },
    });
    expect(first.statusCode).toBe(400);
    expect(first.json().error).toBe("That link is invalid or has expired.");

    const auditRows = await testDb
      .select()
      .from(events)
      .where(eq(events.type, "account.password_reset"));
    expect(auditRows.length).toBeGreaterThan(0);
  });

  test("forgot skips inactive users without mailing them", async () => {
    await testDb.insert(users).values({
      name: "Inactive Person",
      email: "inactive@example.com",
      passwordHash: await argon2.hash("inactive-pw-1", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
      active: false,
    });

    const res = await hApp.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "inactive@example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const mails = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toEmail, "inactive@example.com"));
    expect(mails).toHaveLength(0);
  });

  test("an expired token is rejected with the uniform message", async () => {
    const [u] = await testDb.select().from(users).where(eq(users.email, "hardening@example.com"));
    const expired = newToken();
    await testDb.insert(emailTokens).values({
      userId: u.id,
      type: "reset",
      tokenHash: expired.hash,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await hApp.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token: expired.token, password: "another-pw-4" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That link is invalid or has expired.");
  });

  test("RESET_TTL_MS is 60 minutes", () => {
    expect(RESET_TTL_MS).toBe(60 * 60 * 1000);
  });

  test("change-password retires an outstanding reset token minted before it", async () => {
    await testDb.insert(users).values({
      name: "Defensive Person",
      email: "defensive@example.com",
      passwordHash: await argon2.hash("defensive-pw-1", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });

    const signinRes = await hApp.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "defensive@example.com", password: "defensive-pw-1" },
    });
    expect(signinRes.statusCode).toBe(200);
    const sessionToken = signinRes.cookies.find((c) => c.name === "pide_session")!.value;

    await hApp.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "defensive@example.com" },
    });
    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "defensive@example.com"), eq(emails.template, "reset")));
    const preMintedToken = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const changed = await hApp.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { pide_session: sessionToken },
      payload: { currentPassword: "defensive-pw-1", newPassword: "defensive-pw-2" },
    });
    expect(changed.statusCode).toBe(200);

    const stale = await hApp.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token: preMintedToken, password: "sneaky-pw-5" },
    });
    expect(stale.statusCode).toBe(400);
    expect(stale.json().error).toBe("That link is invalid or has expired.");
  });
});

describe("forgot — per-address cap", () => {
  test("RESET_REQUEST_CAP is 3 per RESET_REQUEST_WINDOW_MS (1 hour)", () => {
    expect(RESET_REQUEST_CAP).toBe(3);
    expect(RESET_REQUEST_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  test("the 4th request within the window gets the same 200 body, mints no token, sends no mail", async () => {
    const capApp = buildApp({ db: testDb });
    try {
      await testDb.insert(users).values({
        name: "Capped Person",
        email: "capped@example.com",
        passwordHash: await argon2.hash("capped-pw-1", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      });

      for (let i = 0; i < RESET_REQUEST_CAP; i++) {
        const res = await capApp.inject({
          method: "POST",
          url: "/api/auth/forgot",
          payload: { email: "capped@example.com" },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ ok: true });
      }

      const fourth = await capApp.inject({
        method: "POST",
        url: "/api/auth/forgot",
        payload: { email: "capped@example.com" },
      });
      // Same body as every under-cap and unknown-address response — the
      // anti-oracle posture (DEPLOY.md box 7).
      expect(fourth.statusCode).toBe(200);
      expect(fourth.json()).toEqual({ ok: true });

      const [u] = await testDb.select().from(users).where(eq(users.email, "capped@example.com"));
      const resetTokens = await testDb
        .select()
        .from(emailTokens)
        .where(and(eq(emailTokens.userId, u.id), eq(emailTokens.type, "reset")));
      expect(resetTokens).toHaveLength(RESET_REQUEST_CAP);

      const mails = await testDb
        .select()
        .from(emails)
        .where(and(eq(emails.toEmail, "capped@example.com"), eq(emails.template, "reset")));
      expect(mails).toHaveLength(RESET_REQUEST_CAP);
    } finally {
      await capApp.close();
    }
  });

  test("a same-address confirm token (signup's, not reset's) doesn't consume the reset budget", async () => {
    // Regression for the join+type-filter requirement: email_tokens has no
    // email column and is shared by both flows (schema.ts:50-59), so a
    // count that forgot only `type` OR forgot the join would let a fresh
    // signup confirm token count against a stranger's reset budget.
    const joinApp = buildApp({ db: testDb });
    try {
      await testDb.insert(users).values({
        name: "Join Person",
        email: "joincheck@example.com",
        passwordHash: await argon2.hash("join-pw-1", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      });
      const [u] = await testDb.select().from(users).where(eq(users.email, "joincheck@example.com"));

      for (let i = 0; i < RESET_REQUEST_CAP; i++) {
        const t = newToken();
        await testDb.insert(emailTokens).values({
          userId: u.id,
          type: "confirm",
          tokenHash: t.hash,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        });
      }

      const res = await joinApp.inject({
        method: "POST",
        url: "/api/auth/forgot",
        payload: { email: "joincheck@example.com" },
      });
      expect(res.statusCode).toBe(200);

      const resetTokens = await testDb
        .select()
        .from(emailTokens)
        .where(and(eq(emailTokens.userId, u.id), eq(emailTokens.type, "reset")));
      expect(resetTokens).toHaveLength(1);
    } finally {
      await joinApp.close();
    }
  });

  test("unknown, capped, and known-under-cap addresses all answer the identical 200 body", async () => {
    const shapeApp = buildApp({ db: testDb });
    // This route also carries a 5/min PER-IP limit (`config.rateLimit` on the
    // route above) — a different control from the per-address cap under
    // test here. This test fires more than 5 requests against one app
    // instance, so each call gets its own `remoteAddress` to keep it clear
    // of that budget entirely; without the override, one more assertion
    // here could start failing on a 429 instead of the cap this test means
    // to pin.
    let shapeIp = 0;
    const nextIp = () => `10.95.0.${++shapeIp}`;
    try {
      await testDb.insert(users).values({
        name: "Shape Person",
        email: "shapecheck@example.com",
        passwordHash: await argon2.hash("shape-pw-1", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      });

      const unknown = await shapeApp.inject({
        method: "POST",
        url: "/api/auth/forgot",
        payload: { email: "nobody-shape@example.com" },
        remoteAddress: nextIp(),
      });

      const known = await shapeApp.inject({
        method: "POST",
        url: "/api/auth/forgot",
        payload: { email: "shapecheck@example.com" },
        remoteAddress: nextIp(),
      });

      for (let i = 0; i < RESET_REQUEST_CAP - 1; i++) {
        await shapeApp.inject({
          method: "POST",
          url: "/api/auth/forgot",
          payload: { email: "shapecheck@example.com" },
          remoteAddress: nextIp(),
        });
      }
      const capped = await shapeApp.inject({
        method: "POST",
        url: "/api/auth/forgot",
        payload: { email: "shapecheck@example.com" },
        remoteAddress: nextIp(),
      });

      expect(unknown.statusCode).toBe(200);
      expect(known.statusCode).toBe(200);
      expect(capped.statusCode).toBe(200);
      expect(unknown.json()).toEqual({ ok: true });
      expect(known.json()).toEqual({ ok: true });
      expect(capped.json()).toEqual({ ok: true });
      expect(unknown.json()).toEqual(known.json());
      expect(known.json()).toEqual(capped.json());
    } finally {
      await shapeApp.close();
    }
  });

  test("a reset token older than the window doesn't consume the address's budget", async () => {
    // Regression for the `createdAt > now() - 1 hour` clause: a stale reset
    // token (past RESET_REQUEST_WINDOW_MS) must not count, or an address
    // that legitimately used its budget an hour+ ago would stay throttled
    // forever.
    const staleApp = buildApp({ db: testDb });
    try {
      await testDb.insert(users).values({
        name: "Stale Window Person",
        email: "stalewindow@example.com",
        passwordHash: await argon2.hash("stale-pw-1", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      });
      const [u] = await testDb
        .select()
        .from(users)
        .where(eq(users.email, "stalewindow@example.com"));

      const stale = newToken();
      await testDb.insert(emailTokens).values({
        userId: u.id,
        type: "reset",
        tokenHash: stale.hash,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
        createdAt: new Date(Date.now() - (RESET_REQUEST_WINDOW_MS + 60_000)),
      });

      // The stale row above must not count: all RESET_REQUEST_CAP requests
      // here still succeed, and only THEN does the cap bite.
      for (let i = 0; i < RESET_REQUEST_CAP; i++) {
        const res = await staleApp.inject({
          method: "POST",
          url: "/api/auth/forgot",
          payload: { email: "stalewindow@example.com" },
        });
        expect(res.statusCode).toBe(200);
      }

      const resetTokens = await testDb
        .select()
        .from(emailTokens)
        .where(and(eq(emailTokens.userId, u.id), eq(emailTokens.type, "reset")));
      // The stale row plus RESET_REQUEST_CAP fresh ones.
      expect(resetTokens).toHaveLength(RESET_REQUEST_CAP + 1);

      const capped = await staleApp.inject({
        method: "POST",
        url: "/api/auth/forgot",
        payload: { email: "stalewindow@example.com" },
      });
      expect(capped.statusCode).toBe(200);
      const afterCap = await testDb
        .select()
        .from(emailTokens)
        .where(and(eq(emailTokens.userId, u.id), eq(emailTokens.type, "reset")));
      expect(afterCap).toHaveLength(RESET_REQUEST_CAP + 1);
    } finally {
      await staleApp.close();
    }
  });

  test("another user's reset tokens don't count toward this address's budget", async () => {
    // Regression for the `eq(users.email, ...)` join predicate: without it
    // (or with a plain userId-less count), a global reset-token count would
    // throttle every address off of a handful of unrelated users' activity.
    const otherApp = buildApp({ db: testDb });
    try {
      await testDb.insert(users).values([
        {
          name: "Busy Neighbour",
          email: "busyneighbour@example.com",
          passwordHash: await argon2.hash("busy-pw-1", { type: argon2.argon2id }),
          emailConfirmedAt: new Date(),
          consentAt: new Date(),
        },
        {
          name: "Quiet Person",
          email: "quietperson@example.com",
          passwordHash: await argon2.hash("quiet-pw-1", { type: argon2.argon2id }),
          emailConfirmedAt: new Date(),
          consentAt: new Date(),
        },
      ]);
      const [neighbour] = await testDb
        .select()
        .from(users)
        .where(eq(users.email, "busyneighbour@example.com"));

      // Exhaust — and go past — the neighbour's own budget.
      for (let i = 0; i < RESET_REQUEST_CAP + 1; i++) {
        const t = newToken();
        await testDb.insert(emailTokens).values({
          userId: neighbour.id,
          type: "reset",
          tokenHash: t.hash,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        });
      }

      const res = await otherApp.inject({
        method: "POST",
        url: "/api/auth/forgot",
        payload: { email: "quietperson@example.com" },
      });
      expect(res.statusCode).toBe(200);

      const [quiet] = await testDb.select().from(users).where(eq(users.email, "quietperson@example.com"));
      const resetTokens = await testDb
        .select()
        .from(emailTokens)
        .where(and(eq(emailTokens.userId, quiet.id), eq(emailTokens.type, "reset")));
      expect(resetTokens).toHaveLength(1);
    } finally {
      await otherApp.close();
    }
  });

  test("concurrent requests for the same address cannot blow past the cap", async () => {
    // Proves the advisory-lock serialisation, not just the cap's arithmetic:
    // fires RESET_REQUEST_CAP + 2 requests at once. A plain check-then-act
    // (no lock) lets several of them read the same under-cap count and all
    // insert — this test fails against that shape and holds against the
    // lock.
    //
    // Every call targets the SAME address (the per-address lock is what's
    // under test) but gets its OWN `remoteAddress`: this route also carries
    // a 5/min per-IP limit (`config.rateLimit` on the route), and firing
    // RESET_REQUEST_CAP + 2 = 5 requests from one shared default IP would
    // sit at that limit's exact boundary with zero margin — a future 429
    // there would read as a broken advisory lock when it's actually an
    // unrelated rate-limit collision (the same coupling the shape test
    // above avoids with its own `nextIp()`).
    const raceApp = buildApp({ db: testDb });
    let raceIp = 0;
    const nextRaceIp = () => `10.94.0.${++raceIp}`;
    try {
      await testDb.insert(users).values({
        name: "Race Person",
        email: "race@example.com",
        passwordHash: await argon2.hash("race-pw-1", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      });

      const results = await Promise.all(
        Array.from({ length: RESET_REQUEST_CAP + 2 }, () =>
          raceApp.inject({
            method: "POST",
            url: "/api/auth/forgot",
            payload: { email: "race@example.com" },
            remoteAddress: nextRaceIp(),
          }),
        ),
      );
      for (const res of results) {
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ ok: true });
      }

      const [u] = await testDb.select().from(users).where(eq(users.email, "race@example.com"));
      const resetTokens = await testDb
        .select()
        .from(emailTokens)
        .where(and(eq(emailTokens.userId, u.id), eq(emailTokens.type, "reset")));
      expect(resetTokens.length).toBeLessThanOrEqual(RESET_REQUEST_CAP);

      const mails = await testDb
        .select()
        .from(emails)
        .where(and(eq(emails.toEmail, "race@example.com"), eq(emails.template, "reset")));
      expect(mails.length).toBeLessThanOrEqual(RESET_REQUEST_CAP);
    } finally {
      await raceApp.close();
    }
  });
});

describe("forgot — mail failure is swallowed by neverThrow, not surfaced", () => {
  test("a rejecting mailer still answers 200 with the standard body, and the failure is recorded", async () => {
    // Task 2 moved the injectable mailer INSIDE the seam wrappers (app.ts):
    // buildApp({ db, mailer }) puts this fake in the driver position with
    // neverThrow wrapping it, so this is a real drive of the route, not a
    // grep-level or eyeball assertion.
    const rejecting: Mailer = {
      send: vi.fn(async () => {
        throw new Error("provider unreachable");
      }),
    };
    const failApp = buildApp({ db: testDb, mailer: rejecting });
    const errorSpy = vi.spyOn(failApp.log, "error");
    try {
      await testDb.insert(users).values({
        name: "Oracle Person",
        email: "oracle@example.com",
        passwordHash: await argon2.hash("oracle-pw-1", { type: argon2.argon2id }),
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      });

      const res = await failApp.inject({
        method: "POST",
        url: "/api/auth/forgot",
        payload: { email: "oracle@example.com" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
      expect(rejecting.send).toHaveBeenCalledTimes(1);
      // The failure is recorded: neverThrow logs once instead of letting the
      // rejection reach this handler (which would otherwise 500 a request
      // whose real work — the token row — already committed).
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      await failApp.close();
    }
  });
});

describe("change password (signed in)", () => {
  test("requires the current password and keeps only the current session", async () => {
    const s1 = await signin("new-password-1");
    const s2 = await signin("new-password-1");
    const token1 = s1.cookies.find((c) => c.name === "pide_session")!.value;
    const token2 = s2.cookies.find((c) => c.name === "pide_session")!.value;

    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { pide_session: token1 },
      payload: { currentPassword: "wrong-guess", newPassword: "brand-new-pw-1" },
    });
    expect(bad.statusCode).toBe(400);

    const good = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { pide_session: token1 },
      payload: { currentPassword: "new-password-1", newPassword: "brand-new-pw-1" },
    });
    expect(good.statusCode).toBe(200);

    const me1 = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token1 },
    });
    expect(me1.statusCode).toBe(200);
    const me2 = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token2 },
    });
    expect(me2.statusCode).toBe(401);
  });
});
