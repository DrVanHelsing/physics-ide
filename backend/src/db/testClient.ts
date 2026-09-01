import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
export const testPool = new pg.Pool({ connectionString: TEST_URL });
export const testDb = drizzle(testPool, { schema });

/** Wipe every auth-domain table between test files. */
export async function truncateAuthTables(): Promise<void> {
  // Repair the one fault tick.test.ts injects (renaming `settings` away to
  // prove the sweep fails alone): a run killed inside that test's window
  // would otherwise leave `settings_broken` behind and brick every later
  // file's TRUNCATE, with no repair path short of manual SQL.
  await testPool.query('ALTER TABLE IF EXISTS "settings_broken" RENAME TO "settings"');
  await testPool.query(
    'TRUNCATE TABLE "notifications", "notification_prefs", "shares", "guides", "rule_sets", "marks", "submissions", "group_members", "groups", "assignment_work", "assignments", "project_versions", "projects", "invites", "class_members", "classes", "sessions", "email_tokens", "emails", "events", "settings", "users" CASCADE',
  );
}
