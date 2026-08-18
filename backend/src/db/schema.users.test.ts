import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
import { users, sessions } from "./schema.js";

const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
const pool = new pg.Pool({ connectionString: TEST_URL });
const db = drizzle(pool, { schema });

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE "sessions", "email_tokens", "emails", "users" CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe("users + sessions schema", () => {
  test("inserts a user with defaults and reads it back", async () => {
    const [u] = await db
      .insert(users)
      .values({
        name: "Test Person",
        email: "person@example.com",
        passwordHash: "x",
        consentAt: new Date(),
      })
      .returning();
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.role).toBe("user");
    expect(u.isTeacher).toBe(false);
    expect(u.active).toBe(true);
    expect(u.emailConfirmedAt).toBeNull();
  });

  test("duplicate email violates the unique constraint", async () => {
    // drizzle 0.44 may wrap driver errors (DrizzleQueryError with the pg error on .cause)
    await expect(
      db.insert(users).values({
        name: "Dup",
        email: "person@example.com",
        passwordHash: "x",
        consentAt: new Date(),
      }),
    ).rejects.toSatisfy(
      (e: { code?: string; cause?: { code?: string } }) =>
        e.code === "23505" || e.cause?.code === "23505",
    );
  });

  test("deleting a user cascades to their sessions", async () => {
    const [u] = await db
      .insert(users)
      .values({ name: "S", email: "s@example.com", passwordHash: "x", consentAt: new Date() })
      .returning();
    await db.insert(sessions).values({
      tokenHash: "hash-1",
      userId: u.id,
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    await db.delete(users).where(eq(users.id, u.id));
    const left = await db.select().from(sessions).where(eq(sessions.userId, u.id));
    expect(left).toHaveLength(0);
  });
});
