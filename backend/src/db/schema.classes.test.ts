import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { testDb, testPool, truncateAuthTables } from "./testClient.js";
import { users, classes, classMembers } from "./schema.js";

let teacherId: string;
let classId: string;

beforeAll(async () => {
  await truncateAuthTables();
  const [t] = await testDb
    .insert(users)
    .values({ name: "T", email: "t@example.com", passwordHash: "x", consentAt: new Date() })
    .returning();
  teacherId = t.id;
});

afterAll(async () => {
  await testPool.end();
});

describe("classes schema", () => {
  test("inserts a class with defaults", async () => {
    const [c] = await testDb
      .insert(classes)
      .values({ name: "Gr 11", joinCode: "AAA-AAA", createdBy: teacherId })
      .returning();
    classId = c.id;
    expect(c.joinMode).toBe("open");
    expect(c.archived).toBe(false);
    expect(c.subjectLabel).toBeNull();
  });

  test("join codes are unique", async () => {
    await expect(
      testDb.insert(classes).values({ name: "Dup", joinCode: "AAA-AAA", createdBy: teacherId }),
    ).rejects.toSatisfy(
      (e: { code?: string; cause?: { code?: string } }) =>
        e.code === "23505" || e.cause?.code === "23505",
    );
  });

  test("one membership row per (class, user); delete class cascades members", async () => {
    await testDb.insert(classMembers).values({ classId, userId: teacherId, role: "teacher" });
    await expect(
      testDb.insert(classMembers).values({ classId, userId: teacherId, role: "student" }),
    ).rejects.toSatisfy(
      (e: { code?: string; cause?: { code?: string } }) =>
        e.code === "23505" || e.cause?.code === "23505",
    );
    await testDb.delete(classes).where(eq(classes.id, classId));
    const left = await testDb.select().from(classMembers).where(eq(classMembers.classId, classId));
    expect(left).toHaveLength(0);
  });
});
