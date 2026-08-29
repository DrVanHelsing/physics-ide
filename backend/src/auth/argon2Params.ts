import argon2 from "argon2";

/**
 * Explicit argon2id parameters for every password hash the backend mints
 * (DEPLOY.md box 3). Left unset, `argon2.hash()` falls back to the
 * library's own defaults — memoryCost 65536 KiB (64 MiB), timeCost 3,
 * parallelism 4 — sized for a workstation, not for a metered Cloud Run
 * instance. This pins the OWASP Password Storage Cheat Sheet's argon2id
 * baseline instead: memoryCost 19456 KiB (~19 MiB), timeCost 2,
 * parallelism 1.
 *
 * Sizing rationale: at ~19 MiB RSS per concurrent hash, this is exactly
 * what the runbook's `--memory=1Gi --concurrency=20` sizing answers to. A
 * class of 30 students signing in at the start of a lesson, against Cloud
 * Run's 512 MiB default at concurrency 80, would OOM-kill the container —
 * with nowhere to shed load, since the runbook also pins
 * `--max-instances=1`.
 *
 * ONE exported const, imported by every `argon2.hash()` call site, so a
 * future change to the sizing moves one number in one place.
 *
 * Do NOT pass this to `argon2.verify()`. argon2 digests are self-describing
 * (the parameters that produced a hash are encoded in the stored string),
 * which is exactly why verify() takes no memoryCost/timeCost/parallelism —
 * only `{ secret }` — and why a hash minted under the library's old
 * defaults (or any prior value of this const) keeps verifying correctly
 * after this value changes.
 */
export const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;
