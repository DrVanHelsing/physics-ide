import { describe, test, expect } from "vitest";
import { shouldShowWelcome } from "../WelcomeGate";

/* v2 truth table (user directive 2026-08-19): the front door is session-
   scoped, not first-visit-only. Two inputs, four cases. */
describe("shouldShowWelcome", () => {
  test("fresh guest: no hint, no session pass → welcome", () => {
    expect(shouldShowWelcome({ signedInHint: false, sessionPassed: false })).toBe(true);
  });
  test("session pass → IDE for the rest of this browser session", () => {
    expect(shouldShowWelcome({ signedInHint: false, sessionPassed: true })).toBe(false);
  });
  test("signed-in hint → IDE (never hijack a member)", () => {
    expect(shouldShowWelcome({ signedInHint: true, sessionPassed: false })).toBe(false);
  });
  test("signed in AND session-passed → IDE", () => {
    expect(shouldShowWelcome({ signedInHint: true, sessionPassed: true })).toBe(false);
  });
});
