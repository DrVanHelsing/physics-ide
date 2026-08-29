import { describe, test, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { eq } from "drizzle-orm";
import { testDb, testPool } from "./db/testClient.js";
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
  DATABASE_URL: "postgres://postgres:physics@localhost:5433/physics_ide_test",
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

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(PRODUCTION_ADMIN_PASSWORD_REQUIRED);

    // "before any DB work": no admin row exists for this run's unique email —
    // the account_cap read and the admin insert both never ran.
    const rows = await testDb.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(0);
  });

  test("NODE_ENV=production with ADMIN_PASSWORD explicitly set to the dev default also aborts", async () => {
    const email = `seed-abort-devdefault-${Date.now()}@example.com`;
    const result = runSeed({ ADMIN_PASSWORD: DEV_DEFAULT_ADMIN_PASSWORD, ADMIN_EMAIL: email });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(PRODUCTION_ADMIN_PASSWORD_REQUIRED);

    const rows = await testDb.select().from(users).where(eq(users.email, email));
    expect(rows).toHaveLength(0);
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
