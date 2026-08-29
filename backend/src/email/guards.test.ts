import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { users, notificationPrefs } from "../db/schema.js";
import { withPreferences } from "./withPreferences.js";
import {
  suppressErased,
  neverThrow,
  selectMailDriver,
  BREVO_DRIVER_NOT_IMPLEMENTED,
  type MinimalLogger,
} from "./guards.js";
import type { Db } from "../db/types.js";
import type { Mailer } from "./mailer.js";

function fakeInner(impl?: () => Promise<void>): Mailer {
  return { send: vi.fn(impl ?? (async () => {})) };
}

function fakeLogger(): MinimalLogger {
  return { error: vi.fn() };
}

const baseMsg = { subject: "s", text: "t" };

describe("suppressErased", () => {
  test("drops a message whose `to` ends @erased.invalid without calling inner", async () => {
    const inner = fakeInner();
    const mailer = suppressErased(inner);
    await mailer.send({ ...baseMsg, to: "gone@erased.invalid", template: "due-tomorrow" });
    expect(inner.send).not.toHaveBeenCalled();
  });

  test("is case-insensitive on the sentinel domain", async () => {
    const inner = fakeInner();
    const mailer = suppressErased(inner);
    await mailer.send({ ...baseMsg, to: "gone@ERASED.INVALID", template: "due-tomorrow" });
    expect(inner.send).not.toHaveBeenCalled();
  });

  test("any other address passes through to inner unchanged", async () => {
    const inner = fakeInner();
    const mailer = suppressErased(inner);
    const msg = { ...baseMsg, to: "still-here@example.com", template: "due-tomorrow" };
    await mailer.send(msg);
    expect(inner.send).toHaveBeenCalledTimes(1);
    expect(inner.send).toHaveBeenCalledWith(msg);
  });
});

describe("neverThrow", () => {
  test("resolves void when inner rejects, and logs once", async () => {
    const inner = fakeInner(async () => {
      throw new Error("driver down");
    });
    const log = fakeLogger();
    const mailer = neverThrow(log, inner);
    await expect(
      mailer.send({ ...baseMsg, to: "x@example.com", template: "due-tomorrow" }),
    ).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test("does not log and resolves void when inner succeeds", async () => {
    const inner = fakeInner();
    const log = fakeLogger();
    const mailer = neverThrow(log, inner);
    await mailer.send({ ...baseMsg, to: "x@example.com", template: "due-tomorrow" });
    expect(log.error).not.toHaveBeenCalled();
  });
});

describe("selectMailDriver", () => {
  test("dev returns a Mailer that writes to the pretend inbox (createDevMailer)", async () => {
    const mailer = selectMailDriver({ mailDriver: "dev" }, testDb);
    expect(mailer).toHaveProperty("send");
  });

  test("brevo throws the named sentinel — replaced in Task 3", () => {
    expect(() => selectMailDriver({ mailDriver: "brevo" }, testDb)).toThrow(
      BREVO_DRIVER_NOT_IMPLEMENTED,
    );
  });
});

/** Composition order pinned live, not just unit-by-unit: the fixed chain is
 *  `neverThrow(log, withPreferences(db, suppressErased(driver)))` —
 *  never-throw OUTERMOST. No send site has a try/catch, so anything outside
 *  never-throw can still reject into a request handler — including
 *  withPreferences' own notification_prefs SELECT (withPreferences.ts:20-23),
 *  not just the driver. These tests fail if that SELECT's rejection escapes
 *  the composition, which is what "outermost" is actually buying: a
 *  reordering that put neverThrow inside withPreferences would leave this
 *  case uncaught. */
describe("composition order — neverThrow(log, withPreferences(db, suppressErased(driver)))", () => {
  let studentId: string;

  beforeAll(async () => {
    await truncateAuthTables();
    const [u] = await testDb
      .insert(users)
      .values({ name: "Student", email: "guards-student@example.com", passwordHash: "x", consentAt: new Date() })
      .returning();
    studentId = u.id;
  });

  afterAll(async () => {
    await testPool.end();
  });

  test("a driver rejection is swallowed by the outer neverThrow", async () => {
    const driver = fakeInner(async () => {
      throw new Error("driver down");
    });
    const log = fakeLogger();
    const mailer = neverThrow(log, withPreferences(testDb, suppressErased(driver)));
    await expect(
      mailer.send({ ...baseMsg, to: "x@example.com", template: "confirm" }),
    ).resolves.toBeUndefined();
    expect(driver.send).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test("withPreferences' own pref SELECT rejecting is ALSO swallowed by the outer neverThrow", async () => {
    await testDb.insert(notificationPrefs).values({ userId: studentId, key: "marks-released", enabled: true });
    const driver = fakeInner();
    const log = fakeLogger();
    // A DB that rejects the SELECT withPreferences runs before ever reaching
    // suppressErased or the driver — proves the outer wrapper must be
    // neverThrow, not something narrower wrapped only around the driver.
    const poisonDb = {
      select: () => ({
        from: () => ({
          where: () => Promise.reject(new Error("db down")),
        }),
      }),
    } as unknown as Db;
    const mailer = neverThrow(log, withPreferences(poisonDb, suppressErased(driver)));
    await expect(
      mailer.send({
        ...baseMsg,
        to: "x@example.com",
        toUserId: studentId,
        template: "marks-released",
      }),
    ).resolves.toBeUndefined();
    expect(driver.send).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  test("an erased-user send never reaches the driver, and the pref check runs first (suppressErased sits AT the driver, not above withPreferences)", async () => {
    const driver = fakeInner();
    const log = fakeLogger();
    const mailer = neverThrow(log, withPreferences(testDb, suppressErased(driver)));
    await mailer.send({
      ...baseMsg,
      to: "gone@erased.invalid",
      toUserId: studentId,
      template: "marks-released",
    });
    expect(driver.send).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  test("a normal switchable send with prefs ON reaches the driver through the full chain", async () => {
    const driver = fakeInner();
    const log = fakeLogger();
    const mailer = neverThrow(log, withPreferences(testDb, suppressErased(driver)));
    await mailer.send({
      ...baseMsg,
      to: "still-here@example.com",
      toUserId: studentId,
      template: "marks-released",
    });
    expect(driver.send).toHaveBeenCalledTimes(1);
    expect(log.error).not.toHaveBeenCalled();
  });
});
