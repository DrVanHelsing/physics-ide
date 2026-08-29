import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { config } from "./config.js";
import { db, pool } from "./db/client.js";
import { setSetting, getSetting } from "./db/settings.js";
import { users } from "./db/schema.js";
import { ARGON2_PARAMS } from "./auth/argon2Params.js";

/** The value ADMIN_PASSWORD falls back to when unset — dev/test only. Named
 *  so the production check below can refuse it explicitly, not just its
 *  absence: an operator who copies the dev value into a prod env file gets
 *  the same abort as one who forgot to set it at all. */
export const DEV_DEFAULT_ADMIN_PASSWORD = "admin-dev-password";

/** DEPLOY.md box 5. Checked unconditionally, before any DB work — including
 *  the account_cap read directly below — and deliberately NOT placed inside
 *  the "admin row already exists" branch further down, where the existing
 *  dev-only warning lives. Mirroring that placement would let a production
 *  re-run against an already-existing admin pass silently with the dev
 *  default still sitting in the environment. An operator should never run a
 *  production seed without knowing the password it would use, and the
 *  runbook sets it anyway. */
export const PRODUCTION_ADMIN_PASSWORD_REQUIRED =
  "ADMIN_PASSWORD is required when NODE_ENV=production — refusing to seed with the dev default.";

if (
  config.nodeEnv === "production" &&
  (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === DEV_DEFAULT_ADMIN_PASSWORD)
) {
  console.error(PRODUCTION_ADMIN_PASSWORD_REQUIRED);
  process.exit(1);
}

const existing = await getSetting(db, "account_cap");
if (existing === undefined) {
  await setSetting(db, "account_cap", 200);
  console.log("Seeded account_cap = 200");
} else {
  console.log(`account_cap already set to ${existing} — leaving as is`);
}

const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@physics-ide.local").toLowerCase();
const adminName = process.env.ADMIN_NAME ?? "Site Admin";
const adminPassword = process.env.ADMIN_PASSWORD ?? DEV_DEFAULT_ADMIN_PASSWORD;

const found = await db.select().from(users).where(eq(users.email, adminEmail));
if (found.length === 0) {
  await db.insert(users).values({
    name: adminName,
    email: adminEmail,
    passwordHash: await argon2.hash(adminPassword, ARGON2_PARAMS),
    role: "admin",
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  console.log(`Seeded admin account ${adminEmail}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log("WARNING: dev default admin password in use — set ADMIN_PASSWORD before any deploy.");
  }
} else {
  console.log(`Admin account ${adminEmail} already exists — leaving as is`);
}

await pool.end();
