import { describe, test, expect } from "vitest";
import { normalizeClassCode, CLASS_CODE_REGEX } from "@physics-ide/shared";

describe("class code helpers reach the frontend", () => {
  test("normalize + regex round-trip", () => {
    const code = normalizeClassCode(" kq4 7pm ");
    expect(code).toBe("KQ4-7PM");
    expect(CLASS_CODE_REGEX.test(code)).toBe(true);
  });
});
