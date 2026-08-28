import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
export const testPool = new pg.Pool({ connectionString: TEST_URL });
export const testDb = drizzle(testPool, { schema });

/** Wipe every auth-domain table between test files. */
export async function truncateAuthTables(): Promise<void> {
  await testPool.query(
    'TRUNCATE TABLE "shares", "guides", "rule_sets", "marks", "submissions", "group_members", "groups", "assignment_work", "assignments", "project_versions", "projects", "invites", "class_members", "classes", "sessions", "email_tokens", "emails", "events", "users" CASCADE',
  );
}
