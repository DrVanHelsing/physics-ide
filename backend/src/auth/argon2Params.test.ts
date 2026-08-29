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

  test("a hash minted with it encodes the real cost segment (the check every hash-call-site test reuses)", async () => {
    // verify() can't tell ARGON2_PARAMS apart from `{}` — digests are
    // self-describing, so a correctly-shaped hash verifies either way. What
    // DOES distinguish them is the encoded digest itself: the third
    // `$`-delimited field, right after `$argon2id$v=19$`, carries the real
    // memoryCost/timeCost/parallelism. Every route/script test that hashes
    // a password (auth.signup.test.ts, auth.password.test.ts x2,
    // seed.test.ts) repeats this exact check against its own call site, so
    // a partial revert of any one of the four `argon2.hash()` sites fails
    // there specifically.
    //
    // Compared as a SORTED array, not a fixed-order literal string: this
    // argon2 binding (node-argon2 0.45) encodes the segment as
    // `m=...,p=...,t=...` — NOT the `m,t,p` order some argon2 references
    // use — and that ordering is the library's encoding choice, not a
    // property worth pinning.
    const digest = await argon2.hash("a-cost-segment-check-1", ARGON2_PARAMS);
    const costSegment = digest.split("$")[3];
    expect(costSegment?.split(",").sort()).toEqual(["m=19456", "p=1", "t=2"]);
  });
});
