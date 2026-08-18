import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db, pool } from "./db/client.js";
import { setSetting, getSetting } from "./db/settings.js";
import { users } from "./db/schema.js";

const existing = await getSetting(db, "account_cap");
if (existing === undefined) {
  await setSetting(db, "account_cap", 200);
  console.log("Seeded account_cap = 200");
} else {
  console.log(`account_cap already set to ${existing} — leaving as is`);
}

const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@physics-ide.local").toLowerCase();
const adminName = process.env.ADMIN_NAME ?? "Site Admin";
const adminPassword = process.env.ADMIN_PASSWORD ?? "admin-dev-password";

const found = await db.select().from(users).where(eq(users.email, adminEmail));
if (found.length === 0) {
  await db.insert(users).values({
    name: adminName,
    email: adminEmail,
    passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }),
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
