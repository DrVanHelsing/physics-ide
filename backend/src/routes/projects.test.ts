import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, projects, projectVersions } from "../db/schema.js";

const app = buildApp({ db: testDb });
let cookieA: string;
let cookieB: string;

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    id: "p-sync-1",
    title: "Sync Me",
    goal: "physics",
    projectType: "custom",
    preferredEditor: "blocks",
    beginnerEnabled: false,
    createdAt: 1000,
    updatedAt: 2000,
    workspace: { xml: "<xml/>" },
    source: { python: "print(1)" },
    datasets: [],
    runs: [],
    chartSpecs: [],
    notes: [],
    checkpointState: {},
    ...overrides,
  };
}

async function makeUser(email: string) {
  await testDb.insert(users).values({
    name: email.split("@")[0],
    email,
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
}

async function signin(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

async function put(cookie: string, id: string, m: Record<string, unknown>) {
  return app.inject({
    method: "PUT",
    url: `/api/projects/${id}`,
    cookies: { pide_session: cookie },
    payload: { manifest: m },
  });
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("synca@example.com");
  await makeUser("syncb@example.com");
  cookieA = await signin("synca@example.com");
  cookieB = await signin("syncb@example.com");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("PUT /api/projects/:id", () => {
  test("first push creates the head; list and get see it", async () => {
    const res = await put(cookieA, "p-sync-1", manifest());
    expect(res.statusCode).toBe(200);
    expect(res.json().outcome).toBe("saved");

    const list = await app.inject({
      method: "GET",
      url: "/api/projects",
      cookies: { pide_session: cookieA },
    });
    expect(list.json().projects).toHaveLength(1);
    expect(list.json().projects[0]).toMatchObject({
      id: "p-sync-1",
      clientUpdatedAt: 2000,
      deleted: false,
    });

    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(got.json().project.manifest.title).toBe("Sync Me");
  });

  test("newer push wins and archives the old head as a version", async () => {
    const res = await put(cookieA, "p-sync-1", manifest({ updatedAt: 3000, title: "Newer" }));
    expect(res.json().outcome).toBe("saved");
    const versions = await testDb
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, "p-sync-1"));
    expect(versions).toHaveLength(1);
    expect(versions[0].reason).toBe("overwrite");
    expect(versions[0].clientUpdatedAt).toBe(2000);
  });

  test("older push loses: head untouched, loser archived, remote returned", async () => {
    const res = await put(cookieA, "p-sync-1", manifest({ updatedAt: 2500, title: "Stale" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().outcome).toBe("kept-remote");
    expect(res.json().project.manifest.title).toBe("Newer");
    expect(res.json().project.clientUpdatedAt).toBe(3000);

    const losers = await testDb
      .select()
      .from(projectVersions)
      .where(
        and(eq(projectVersions.projectId, "p-sync-1"), eq(projectVersions.reason, "conflict-loser")),
      );
    expect(losers).toHaveLength(1);
    expect(losers[0].clientUpdatedAt).toBe(2500);
  });

  test("equal timestamp re-push is idempotent-saved (no version spam)", async () => {
    const before = (
      await testDb.select().from(projectVersions).where(eq(projectVersions.projectId, "p-sync-1"))
    ).length;
    const res = await put(cookieA, "p-sync-1", manifest({ updatedAt: 3000, title: "Newer" }));
    expect(res.json().outcome).toBe("saved");
    const after = (
      await testDb.select().from(projectVersions).where(eq(projectVersions.projectId, "p-sync-1"))
    ).length;
    expect(after).toBe(before);
  });

  test("manifest id must match the URL id; malformed manifests refused", async () => {
    const bad = await put(cookieA, "p-other", manifest());
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe("That doesn't look like a valid project.");
    const junk = await put(cookieA, "p-junk", { manifest: "nope" } as never);
    expect(junk.statusCode).toBe(400);
  });

  test("oversized manifests are refused with the exact sentence", async () => {
    const res = await put(
      cookieA,
      "p-big",
      manifest({ id: "p-big", workspace: { xml: "x".repeat(400 * 1024) } }),
    );
    expect(res.statusCode).toBe(413);
    expect(res.json().error).toBe("This project is too large to sync. Export it as a file instead.");
  });

  test("owner isolation: B cannot read or overwrite A's project", async () => {
    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieB },
    });
    expect(got.statusCode).toBe(404);
    expect(got.json().error).toBe("No such project.");
    // B pushing the same id creates B's OWN head, untouched A's
    const res = await put(cookieB, "p-sync-1", manifest({ title: "B's copy" }));
    expect(res.json().outcome).toBe("saved");
    const rows = await testDb.select().from(projects).where(eq(projects.id, "p-sync-1"));
    expect(rows).toHaveLength(2);
  });
});

describe("DELETE and tombstones", () => {
  test("delete tombstones: list shows deleted, get 404s, delete is idempotent, event logged", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(res.statusCode).toBe(200);
    const list = await app.inject({
      method: "GET",
      url: "/api/projects",
      cookies: { pide_session: cookieA },
    });
    expect(list.json().projects.find((p: { id: string }) => p.id === "p-sync-1").deleted).toBe(true);
    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(got.statusCode).toBe(404);
    const again = await app.inject({
      method: "DELETE",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(again.statusCode).toBe(200);
  });

  test("pushing NEWER content to a tombstone revives it", async () => {
    const res = await put(cookieA, "p-sync-1", manifest({ updatedAt: 9000, title: "Revived" }));
    expect(res.json().outcome).toBe("saved");
    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(got.statusCode).toBe(200);
    expect(got.json().project.manifest.title).toBe("Revived");
  });
});

describe("the 100-project cap", () => {
  test("project 101 is refused with the exact sentence", async () => {
    const countRows = await testDb
      .select()
      .from(projects)
      .where(eq(projects.ownerId, (await testDb.select().from(users).where(eq(users.email, "syncb@example.com")))[0].id));
    const start = countRows.length;
    for (let i = start; i < 100; i++) {
      const r = await put(cookieB, `p-cap-${i}`, manifest({ id: `p-cap-${i}` }));
      expect(r.json().outcome).toBe("saved");
    }
    const over = await put(cookieB, "p-cap-overflow", manifest({ id: "p-cap-overflow" }));
    expect(over.statusCode).toBe(403);
    expect(over.json().error).toBe("You've reached the 100-project limit — delete something first.");
  });
});
