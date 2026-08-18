import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { getSetting, setSetting } from "./settings.js";

const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
const pool = new pg.Pool({ connectionString: TEST_URL });
const db = drizzle(pool, { schema });

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE "settings"');
});

afterAll(async () => {
  await pool.end();
});

describe("settings store", () => {
  test("getSetting returns undefined for a missing key", async () => {
    expect(await getSetting(db, "missing_key")).toBeUndefined();
  });

  test("setSetting writes and getSetting reads back", async () => {
    await setSetting(db, "account_cap", 200);
    expect(await getSetting(db, "account_cap")).toBe(200);
  });

  test("setSetting overwrites an existing key (upsert)", async () => {
    await setSetting(db, "account_cap", 150);
    expect(await getSetting(db, "account_cap")).toBe(150);
  });
});
