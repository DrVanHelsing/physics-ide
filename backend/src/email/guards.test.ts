import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { users, emails } from "../db/schema.js";
import { withPreferences } from "./withPreferences.js";
import {
  suppressErased,
  neverThrow,
  selectMailDriver,
  BREVO_CONFIG_INCOMPLETE,
  type MinimalLogger,
} from "./guards.js";
import { BREVO_SEND_URL } from "./brevoMailer.js";
import type { Db } from "../db/types.js";
import type { Mailer } from "./mailer.js";

function fakeInner(impl?: () => Promise<void>): Mailer {
  return { send: vi.fn(impl ?? (async () => {})) };
}

function fakeLogger(): MinimalLogger {
  return { error: vi.fn() };
}

/** A db whose SELECT always rejects — stands in for withPreferences' own
 *  notification_prefs read failing, without needing a real outage. */
function poisonDb(): Db {
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.reject(new Error("db down")),
      }),
    }),
  } as unknown as Db;
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
  test("dev returns a Mailer that writes to the pretend inbox (createDevMailer) — asserted by actually sending, not just shape", async () => {
    const mailer = selectMailDriver({ mailDriver: "dev" }, testDb);
    await mailer.send({
      to: "guards-dev-driver@example.com",
      template: "confirm",
      subject: "s",
      text: "t",
    });
    const rows = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toEmail, "guards-dev-driver@example.com"));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("dev");
  });

  // Task 2's placeholder asserted that `brevo` threw BREVO_DRIVER_NOT_IMPLEMENTED.
  // Task 3 made it real, so the assertion moves to what the branch does now.
  //
  // This MUST send through the object selectMailDriver actually returned. An
  // earlier version of this test built its own createBrevoMailer alongside
  // and asserted only `typeof selected.send` against the returned one, which
  // still passed if the brevo branch fell back to createDevMailer — the exact
  // regression the checkbox exists to prevent, and the one the Task 2
  // placeholder DID catch. Mutate the branch to `return createDevMailer(db)`
  // and all three row assertions below fail.
  test("brevo returns the REAL driver — asserted by sending through the returned mailer itself", async () => {
    // selectMailDriver builds the driver with createBrevoMailer's DEFAULT
    // fetchImpl, and a default parameter resolves the global `fetch` when the
    // function is called — so the spy has to be in place before the branch runs.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ messageId: "<guards.1@relay.domain.com>" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    try {
      const selected = selectMailDriver(
        { mailDriver: "brevo", mailFrom: "no-reply@example.com", brevoApiKey: "k" },
        testDb,
      );
      await selected.send({
        to: "guards-brevo-driver@example.com",
        template: "confirm",
        subject: "s",
        text: "open http://x/confirm?token=liveTOKEN_1",
      });

      // It went to the provider, not to the pretend inbox.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][0]).toBe(BREVO_SEND_URL);

      const rows = await testDb
        .select()
        .from(emails)
        .where(eq(emails.toEmail, "guards-brevo-driver@example.com"));
      expect(rows).toHaveLength(1);
      // The three things that separate the real postman from the pretend
      // inbox: the dev driver writes status "dev", a full clickable body, and
      // never a provider id.
      expect(rows[0].status).toBe("sent");
      expect(rows[0].bodyText).toContain("token=REDACTED");
      expect(rows[0].providerId).toBe("guards.1@relay.domain.com");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("brevo without MAIL_FROM or BREVO_API_KEY refuses loudly rather than posting undefined", () => {
    expect(() => selectMailDriver({ mailDriver: "brevo", brevoApiKey: "k" }, testDb)).toThrow(
      BREVO_CONFIG_INCOMPLETE,
    );
    expect(() =>
      selectMailDriver({ mailDriver: "brevo", mailFrom: "a@example.com" }, testDb),
    ).toThrow(BREVO_CONFIG_INCOMPLETE);
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
    const driver = fakeInner();
    const log = fakeLogger();
    // A DB that rejects the SELECT withPreferences runs before ever reaching
    // suppressErased or the driver — proves the outer wrapper must be
    // neverThrow, not something narrower wrapped only around the driver.
    const mailer = neverThrow(log, withPreferences(poisonDb(), suppressErased(driver)));
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

  test("suppressErased sits AT the driver, not hoisted above withPreferences: an erased-user send still lets the (poisoned) pref SELECT run and fail first", async () => {
    const driver = fakeInner();
    const log = fakeLogger();
    const mailer = neverThrow(log, withPreferences(poisonDb(), suppressErased(driver)));
    await mailer.send({
      ...baseMsg,
      to: "gone@erased.invalid",
      toUserId: studentId,
      template: "marks-released",
    });
    // If suppressErased were hoisted ABOVE withPreferences (e.g.
    // suppressErased(withPreferences(...))), the erased check would
    // short-circuit before the pref SELECT ever touched the (poisoned) db,
    // and this would resolve silently with no log at all. Because
    // suppressErased sits innermost, at the driver, withPreferences' SELECT
    // runs first regardless, hits the poisoned db, and neverThrow catches +
    // logs it — the same failure signature as the non-erased poisoned-db
    // case above. A test that only checked driver.send was never called
    // (true under either order) would not catch a reordering; this one does.
    expect(driver.send).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledTimes(1);
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
