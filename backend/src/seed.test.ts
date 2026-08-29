import { describe, test, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { eq } from "drizzle-orm";
import { testDb, testPool, TEST_URL } from "./db/testClient.js";
import { users } from "./db/schema.js";

/**
 * seed.ts is a top-level-await SCRIPT (it runs its work — and, as of Task 6,
 * its production abort check — as a side effect of being imported, then
 * calls `pool.end()` at the very end). Statically or dynamically importing
 * it from inside THIS process would execute that side effect for real
 * against whatever DATABASE_URL this test process resolves to — not a safe
 * way to test it. Instead this file spawns it as an actual child process
 * (via the same `tsx` runtime `npm run seed` uses) with a controlled env,
 * and inspects its exit code / stderr / the test DB's resulting rows.
 *
 * The abort sentence below is a DELIBERATE literal duplicate of seed.ts's
 * exported `PRODUCTION_ADMIN_PASSWORD_REQUIRED` — not an import of it, for
 * the reason above. Keep the two in sync.
 */
const PRODUCTION_ADMIN_PASSWORD_REQUIRED =
  "ADMIN_PASSWORD is required when NODE_ENV=production — refusing to seed with the dev default.";
const DEV_DEFAULT_ADMIN_PASSWORD = "admin-dev-password";

const require = createRequire(import.meta.url);
const tsxCli = path.join(path.dirname(require.resolve("tsx/package.json")), "dist", "cli.mjs");
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedScript = path.join(backendDir, "src", "seed.ts");

/** Every var config.ts's production superRefine requires, so a run under
 *  NODE_ENV=production fails (or succeeds) on the ADMIN_PASSWORD check
 *  specifically — not on some unrelated missing production var. Points
 *  DATABASE_URL at the real, already-migrated test database so a run that
 *  gets PAST the abort check can be verified by querying it afterward. */
const PRODUCTION_ENV_BASE = {
  NODE_ENV: "production",
  TICK_SECRET: "a-real-tick-secret",
  MAIL_DRIVER: "brevo",
  MAIL_FROM: "no-reply@example.com",
  BREVO_API_KEY: "a-real-brevo-key",
  MAIL_WEBHOOK_SECRET: "a-real-webhook-secret",
  DATABASE_URL: TEST_URL,
};

function runSeed(overrides: Record<string, string | undefined>) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...PRODUCTION_ENV_BASE };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return spawnSync(process.execPath, [tsxCli, seedScript], {
    env,
    encoding: "utf-8",
    timeout: 30_000,
  });
}

afterAll(async () => {
  await testPool.end();
});

describe("seed — production admin password is mandatory (DEPLOY.md box 5)", () => {
  test("NODE_ENV=production with ADMIN_PASSWORD unset aborts, before any DB work, with the named sentence", async () => {
    const email = `seed-abort-missing-${Date.now()}@example.com`;
    const result = runSeed({ ADMIN_PASSWORD: undefined, ADMIN_EMAIL: email });

    // process.exit(1) specifically — not just "non-zero": a signal-killed
    // child also has status !== 0 (status === null in that case), which a
    // bare `.not.toBe(0)` would have let slide.
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(PRODUCTION_ADMIN_PASSWORD_REQUIRED);

    // No admin row for this run's unique email, and the account_cap read/
    // write (the first console output on the success path, "Seeded
    // account_cap = 200" or "account_cap already set to ... ") never
    // printed either — both signals a partial/misplaced abort could still
    // pass on their own. Placement itself (top-of-module vs. inside the
    // "admin already exists" branch, Ruling 11) is pinned separately below
    // by the pre-existing-admin case, which the row-absence check here
    // cannot distinguish.
    expect(result.stdout).not.toContain("account_cap");
    const rows = await testDb.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(0);
  });

  test("NODE_ENV=production with ADMIN_PASSWORD explicitly set to the dev default also aborts", async () => {
    const email = `seed-abort-devdefault-${Date.now()}@example.com`;
    const result = runSeed({ ADMIN_PASSWORD: DEV_DEFAULT_ADMIN_PASSWORD, ADMIN_EMAIL: email });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(PRODUCTION_ADMIN_PASSWORD_REQUIRED);
    expect(result.stdout).not.toContain("account_cap");

    const rows = await testDb.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(0);
  });

  test("NODE_ENV=production with ADMIN_PASSWORD unset ALSO aborts when the admin row already exists (Ruling 11's exact scenario)", async () => {
    // The two cases above both use a timestamp-unique ADMIN_EMAIL, so
    // `found.length === 0` is true in the child regardless of WHERE the
    // abort sits — including if a future edit moved it inside the "admin
    // already exists" branch, exactly the mistake Ruling 11 forbids (that
    // placement is modelled three lines away by the existing dev-only
    // warning). Pre-inserting a row at this run's ADMIN_EMAIL — bypassing
    // the script entirely — makes `found.length === 0` FALSE in the child,
    // so this test can only pass if the abort fires unconditionally, before
    // that branch is even reached.
    const email = `seed-abort-existing-${Date.now()}@example.com`;
    await testDb.insert(users).values({
      name: "Pre-existing Admin",
      email,
      passwordHash: "x",
      role: "admin",
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });

    const result = runSeed({ ADMIN_PASSWORD: undefined, ADMIN_EMAIL: email });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(PRODUCTION_ADMIN_PASSWORD_REQUIRED);
    expect(result.stdout).not.toContain("account_cap");
  });

  test("NODE_ENV=production with a real ADMIN_PASSWORD set seeds the admin normally, no abort", async () => {
    const email = `seed-ok-${Date.now()}@example.com`;
    const result = runSeed({
      ADMIN_PASSWORD: "a-genuinely-different-production-password-1",
      ADMIN_EMAIL: email,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("ADMIN_PASSWORD is required");

    const rows = await testDb.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
    // Proves ARGON2_PARAMS actually reached THIS hash call, not just that
    // the const has the right value (argon2Params.test.ts) or that verify()
    // still works (self-describing, so it would pass even against
    // `ARGON2_PARAMS = {}`). The encoded digest's cost segment — the
    // `$`-delimited field right after `$argon2id$v=19$` — carries the real
    // parameters; a partial revert of this hash site changes it. Compared
    // as a sorted array, not a fixed-order literal: this argon2 binding
    // encodes it as `m=...,p=...,t=...`, not the `m,t,p` order some argon2
    // references use, and that order is a library encoding detail, not a
    // property worth pinning here.
    const costSegment = rows[0].passwordHash.split("$")[3];
    expect(costSegment?.split(",").sort()).toEqual(["m=19456", "p=1", "t=2"]);
  });

  test("outside production, an unset ADMIN_PASSWORD still only warns (unchanged dev path)", async () => {
    const email = `seed-dev-${Date.now()}@example.com`;
    const result = runSeed({
      NODE_ENV: "development",
      TICK_SECRET: undefined,
      MAIL_DRIVER: undefined,
      MAIL_FROM: undefined,
      BREVO_API_KEY: undefined,
      MAIL_WEBHOOK_SECRET: undefined,
      ADMIN_PASSWORD: undefined,
      ADMIN_EMAIL: email,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain("ADMIN_PASSWORD is required");
    expect(result.stdout).toContain("WARNING: dev default admin password in use");

    const rows = await testDb.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(1);
  });
});
