import { describe, test, expect } from "vitest";
import {
  SignupInputSchema,
  SigninInputSchema,
  ResetInputSchema,
  AuthUserSchema,
  UpdateMeInputSchema,
  PASSWORD_MIN_LENGTH,
  ACCOUNT_CAP_MESSAGE,
} from "./auth.js";

describe("auth schemas", () => {
  const goodSignup = {
    name: "Thabo M",
    email: "  Thabo@Example.COM ",
    password: "correct-horse-battery",
    wantsTeacher: false,
    consent: true,
  };

  test("valid signup parses, email is trimmed and lowercased", () => {
    const parsed = SignupInputSchema.parse(goodSignup);
    expect(parsed.email).toBe("thabo@example.com");
    expect(parsed.name).toBe("Thabo M");
  });

  test("consent must be literally true", () => {
    expect(SignupInputSchema.safeParse({ ...goodSignup, consent: false }).success).toBe(false);
  });

  test(`password shorter than ${PASSWORD_MIN_LENGTH} is rejected`, () => {
    expect(
      SignupInputSchema.safeParse({ ...goodSignup, password: "short" }).success,
    ).toBe(false);
  });

  test("signin requires a well-formed email and any non-empty password", () => {
    expect(SigninInputSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(SigninInputSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(SigninInputSchema.safeParse({ email: "A@B.co", password: "pw" }).success).toBe(true);
  });

  test("reset enforces the same password floor", () => {
    expect(ResetInputSchema.safeParse({ token: "t".repeat(40), password: "short" }).success).toBe(false);
    expect(
      ResetInputSchema.safeParse({ token: "t".repeat(40), password: "long-enough-pass" }).success,
    ).toBe(true);
  });

  test("AuthUser shape", () => {
    const u = {
      id: "6f5e4d3c-2b1a-4c9d-8e7f-0a1b2c3d4e5f",
      name: "A",
      email: "a@b.co",
      role: "user",
      isTeacher: true,
      emailConfirmed: false,
    };
    expect(AuthUserSchema.parse(u)).toEqual(u);
  });

  test("cap message is the spec's exact sentence", () => {
    expect(ACCOUNT_CAP_MESSAGE).toBe(
      "This site is at capacity — ask your teacher or the site owner.",
    );
  });

  test("UpdateMe: name is optional so a prefs-only PATCH is reachable", () => {
    expect(UpdateMeInputSchema.safeParse({}).success).toBe(true);
    expect(
      UpdateMeInputSchema.safeParse({ notificationPrefs: { "due-tomorrow": false } }).success,
    ).toBe(true);
    expect(UpdateMeInputSchema.safeParse({ name: "A Name" }).success).toBe(true);
    expect(UpdateMeInputSchema.safeParse({ name: "" }).success).toBe(false);
  });

  test("UpdateMe: notificationPrefs strips unknown keys and rejects non-boolean values", () => {
    const parsed = UpdateMeInputSchema.parse({
      notificationPrefs: { "due-tomorrow": false, "nonsense-key": true },
    });
    expect(parsed.notificationPrefs).toEqual({ "due-tomorrow": false });
    expect(
      UpdateMeInputSchema.safeParse({ notificationPrefs: { "due-tomorrow": "false" } }).success,
    ).toBe(false);
  });
});
