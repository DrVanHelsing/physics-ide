import { describe, test, expect } from "vitest";
import argon2 from "argon2";
import { ARGON2_PARAMS } from "./argon2Params.js";

describe("ARGON2_PARAMS", () => {
  test("pins the OWASP argon2id baseline sized for the instance (DEPLOY.md box 3)", () => {
    expect(ARGON2_PARAMS).toEqual({
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  });

  test("a hash minted with it round-trips through verify() with no options", async () => {
    const digest = await argon2.hash("a-round-trip-password-1", ARGON2_PARAMS);
    await expect(argon2.verify(digest, "a-round-trip-password-1")).resolves.toBe(true);
    await expect(argon2.verify(digest, "the-wrong-password")).resolves.toBe(false);
  });
});
