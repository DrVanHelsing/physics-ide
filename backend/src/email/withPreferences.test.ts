import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { users, notificationPrefs } from "../db/schema.js";
import { withPreferences } from "./withPreferences.js";
import type { Mailer } from "./mailer.js";

let studentId: string;

beforeAll(async () => {
  await truncateAuthTables();
  const [u] = await testDb
    .insert(users)
    .values({ name: "Student", email: "wp-student@example.com", passwordHash: "x", consentAt: new Date() })
    .returning();
  studentId = u.id;
});

afterAll(async () => {
  await testPool.end();
});

function fakeInner(): Mailer {
  return { send: vi.fn(async () => {}) };
}

const baseMsg = { to: "wp-student@example.com", subject: "s", text: "t" };

describe("withPreferences", () => {
  test("switchable template + enabled:false row -> inner is NOT called", async () => {
    await testDb.insert(notificationPrefs).values({ userId: studentId, key: "due-tomorrow", enabled: false });
    const inner = fakeInner();
    const mailer = withPreferences(testDb, inner);
    await mailer.send({ ...baseMsg, toUserId: studentId, template: "due-tomorrow" });
    expect(inner.send).not.toHaveBeenCalled();
  });

  test("switchable template + no pref row -> inner IS called (absent means ON)", async () => {
    const inner = fakeInner();
    const mailer = withPreferences(testDb, inner);
    await mailer.send({ ...baseMsg, toUserId: studentId, template: "marks-released" });
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  test("switchable template + enabled:true row -> inner IS called", async () => {
    await testDb.insert(notificationPrefs).values({ userId: studentId, key: "work-returned", enabled: true });
    const inner = fakeInner();
    const mailer = withPreferences(testDb, inner);
    await mailer.send({ ...baseMsg, toUserId: studentId, template: "work-returned" });
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  test("non-switchable template ('confirm') + a smuggled false row for that key -> STILL called (fail-open)", async () => {
    await testDb.insert(notificationPrefs).values({ userId: studentId, key: "confirm", enabled: false });
    const inner = fakeInner();
    const mailer = withPreferences(testDb, inner);
    await mailer.send({ ...baseMsg, toUserId: studentId, template: "confirm" });
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  test("toUserId: null -> inner IS called (no account to look a pref up against)", async () => {
    const inner = fakeInner();
    const mailer = withPreferences(testDb, inner);
    await mailer.send({ ...baseMsg, toUserId: null, template: "due-tomorrow" });
    expect(inner.send).toHaveBeenCalledTimes(1);
  });
});
