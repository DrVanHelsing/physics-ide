import { describe, test, expect } from "vitest";
import { SWITCHABLE_EMAIL_KEYS, NotificationPrefsPatchSchema } from "./notifications.js";

describe("notification preference contracts", () => {
  test("the switchable keys are exactly the five template strings", () => {
    expect(SWITCHABLE_EMAIL_KEYS).toEqual([
      "submission-receipt",
      "marks-released",
      "work-returned",
      "due-tomorrow",
      "due-reminder",
    ]);
  });

  test("a partial patch of any subset of the five keys parses", () => {
    const ok = NotificationPrefsPatchSchema.safeParse({ "due-tomorrow": false, "marks-released": true });
    expect(ok.success).toBe(true);
    expect(ok.data).toEqual({ "due-tomorrow": false, "marks-released": true });
  });

  test("an empty patch parses (partial by design)", () => {
    expect(NotificationPrefsPatchSchema.safeParse({}).success).toBe(true);
  });

  test("an unknown key is silently stripped, not rejected", () => {
    const parsed = NotificationPrefsPatchSchema.parse({ "due-tomorrow": false, "not-a-real-key": true });
    expect(parsed).toEqual({ "due-tomorrow": false });
  });

  test("a non-boolean value for a real key is rejected", () => {
    expect(NotificationPrefsPatchSchema.safeParse({ "due-tomorrow": "false" }).success).toBe(false);
    expect(NotificationPrefsPatchSchema.safeParse({ "marks-released": 1 }).success).toBe(false);
  });
});
