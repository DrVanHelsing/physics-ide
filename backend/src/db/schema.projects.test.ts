import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { testDb, testPool, truncateAuthTables } from "./testClient.js";
import { users, projects, projectVersions } from "./schema.js";

let ownerA: string;
let ownerB: string;

beforeAll(async () => {
  await truncateAuthTables();
  const [a] = await testDb
    .insert(users)
    .values({ name: "A", email: "pa@example.com", passwordHash: "x", consentAt: new Date() })
    .returning();
  const [b] = await testDb
    .insert(users)
    .values({ name: "B", email: "pb@example.com", passwordHash: "x", consentAt: new Date() })
    .returning();
  ownerA = a.id;
  ownerB = b.id;
});

afterAll(async () => {
  await testPool.end();
});

describe("projects schema", () => {
  test("same client id may exist under two owners (composite pk)", async () => {
    const base = {
      id: "p-shared-id",
      title: "T",
      goal: "physics",
      projectType: "custom",
      manifest: { schemaVersion: 2 },
      clientUpdatedAt: 1000,
    };
    await testDb.insert(projects).values({ ...base, ownerId: ownerA });
    await testDb.insert(projects).values({ ...base, ownerId: ownerB });
    const rows = await testDb.select().from(projects).where(eq(projects.id, "p-shared-id"));
    expect(rows).toHaveLength(2);
  });

  test("duplicate (owner, id) violates the pk", async () => {
    await expect(
      testDb.insert(projects).values({
        id: "p-shared-id",
        ownerId: ownerA,
        title: "Dup",
        goal: "physics",
        projectType: "custom",
        manifest: {},
        clientUpdatedAt: 1,
      }),
    ).rejects.toSatisfy(
      (e: { code?: string; cause?: { code?: string } }) =>
        e.code === "23505" || e.cause?.code === "23505",
    );
  });

  test("deleting a head cascades its versions", async () => {
    await testDb.insert(projectVersions).values({
      ownerId: ownerA,
      projectId: "p-shared-id",
      manifest: { schemaVersion: 2 },
      clientUpdatedAt: 999,
      savedBy: ownerA,
      reason: "overwrite",
    });
    await testDb
      .delete(projects)
      .where(and(eq(projects.ownerId, ownerA), eq(projects.id, "p-shared-id")));
    const left = await testDb
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.ownerId, ownerA), eq(projectVersions.projectId, "p-shared-id")));
    expect(left).toHaveLength(0);
  });
});
