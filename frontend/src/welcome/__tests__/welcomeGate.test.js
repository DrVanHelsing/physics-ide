import { describe, test, expect } from "vitest";
import { shouldShowWelcome } from "../WelcomeGate";

describe("shouldShowWelcome", () => {
  test("brand-new visitor: no flag, no hint, no projects → welcome", () => {
    expect(shouldShowWelcome({ seenFlag: false, signedInHint: false, projectCount: 0 })).toBe(true);
  });
  test("seen-flag set → IDE, regardless of the rest", () => {
    expect(shouldShowWelcome({ seenFlag: true, signedInHint: false, projectCount: 0 })).toBe(false);
  });
  test("signed-in hint → IDE (never hijack a member)", () => {
    expect(shouldShowWelcome({ seenFlag: false, signedInHint: true, projectCount: 0 })).toBe(false);
  });
  test("existing guest work → IDE (never hijack a guest with projects)", () => {
    expect(shouldShowWelcome({ seenFlag: false, signedInHint: false, projectCount: 3 })).toBe(false);
  });
});
