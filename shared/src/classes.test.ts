import { describe, test, expect } from "vitest";
import {
  CLASS_CODE_ALPHABET,
  CLASS_CODE_REGEX,
  normalizeClassCode,
  JOIN_MODES,
  CreateClassInputSchema,
  UpdateClassSettingsInputSchema,
  JoinByCodeInputSchema,
  InviteInputSchema,
} from "./classes.js";

describe("class codes", () => {
  test("alphabet has no lookalike characters", () => {
    for (const bad of ["I", "L", "O", "0", "1"]) {
      expect(CLASS_CODE_ALPHABET).not.toContain(bad);
    }
    expect(CLASS_CODE_ALPHABET).toHaveLength(31);
  });

  test("normalizeClassCode uppercases, strips spaces, inserts the dash", () => {
    expect(normalizeClassCode(" kq4 7pm ")).toBe("KQ4-7PM");
    expect(normalizeClassCode("kq4-7pm")).toBe("KQ4-7PM");
    expect(normalizeClassCode("KQ47PM")).toBe("KQ4-7PM");
  });

  test("regex accepts a normalized code and rejects malformed ones", () => {
    expect(CLASS_CODE_REGEX.test("KQ4-7PM")).toBe(true);
    expect(CLASS_CODE_REGEX.test("KQ4-7P")).toBe(false);
    expect(CLASS_CODE_REGEX.test("KO4-7PM")).toBe(false); // O is not in the alphabet
  });

  test("JoinByCodeInputSchema normalizes then validates", () => {
    expect(JoinByCodeInputSchema.parse({ code: "kq4 7pm" }).code).toBe("KQ4-7PM");
    expect(JoinByCodeInputSchema.safeParse({ code: "nope" }).success).toBe(false);
  });
});

describe("class schemas", () => {
  test("create requires a 1-100 char name; subject label optional", () => {
    expect(CreateClassInputSchema.parse({ name: " Grade 11 " }).name).toBe("Grade 11");
    expect(CreateClassInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(
      CreateClassInputSchema.parse({ name: "A", subjectLabel: "Physical Sciences" }).subjectLabel,
    ).toBe("Physical Sciences");
  });

  test("settings update accepts partial fields and only known join modes", () => {
    expect(UpdateClassSettingsInputSchema.parse({ joinMode: "approval" }).joinMode).toBe("approval");
    expect(UpdateClassSettingsInputSchema.safeParse({ joinMode: "locked" }).success).toBe(false);
    expect(UpdateClassSettingsInputSchema.parse({}).name).toBeUndefined();
  });

  test("invites: 1-50 emails, role must be a class role", () => {
    const ok = InviteInputSchema.parse({ emails: [" A@b.co "], role: "student" });
    expect(ok.emails).toEqual(["a@b.co"]);
    expect(InviteInputSchema.safeParse({ emails: [], role: "student" }).success).toBe(false);
    expect(InviteInputSchema.safeParse({ emails: ["a@b.co"], role: "admin" }).success).toBe(false);
    expect(JOIN_MODES).toEqual(["open", "approval", "paused"]);
  });
});
