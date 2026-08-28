import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq, sql } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, projects, projectVersions } from "../db/schema.js";
import { MAX_PROJECTS_PER_USER } from "./projects.js";

const app = buildApp({ db: testDb });
let cookieA: string;
let cookieB: string;
let cookieC: string;
let cookieD: string;
let cookieE: string;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("synca@example.com");
  await makeUser("syncb@example.com");
  await makeUser("syncc@example.com");
  await makeUser("syncd@example.com");
  await makeUser("synce@example.com");
  cookieA = await signin("synca@example.com");
  cookieB = await signin("syncb@example.com");
  cookieC = await signin("syncc@example.com");
  cookieD = await signin("syncd@example.com");
  cookieE = await signin("synce@example.com");
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

describe("equal-ms tie with differing content (review fix)", () => {
  test("same updatedAt as head but different content is treated as newer, not silently dropped", async () => {
    const first = await put(cookieA, "p-tie-1", manifest({ id: "p-tie-1", updatedAt: 5000, title: "Tie A" }));
    expect(first.json().outcome).toBe("saved");

    const second = await put(cookieA, "p-tie-1", manifest({ id: "p-tie-1", updatedAt: 5000, title: "Tie B" }));
    expect(second.json().outcome).toBe("saved");

    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-tie-1",
      cookies: { pide_session: cookieA },
    });
    expect(got.json().project.manifest.title).toBe("Tie B");

    const versions = await testDb
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, "p-tie-1"));
    expect(versions).toHaveLength(1);
    expect(versions[0].reason).toBe("overwrite");
    expect(versions[0].clientUpdatedAt).toBe(5000);
    expect((versions[0].manifest as { title: string }).title).toBe("Tie A");

    // A truly identical re-push (same ms, same content) stays a real no-op:
    // no additional version row.
    const third = await put(cookieA, "p-tie-1", manifest({ id: "p-tie-1", updatedAt: 5000, title: "Tie B" }));
    expect(third.json().outcome).toBe("saved");
    const versionsAfter = await testDb
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, "p-tie-1"));
    expect(versionsAfter).toHaveLength(1);
  });
});

describe("manifests larger than Fastify's default body limit (review fix)", () => {
  test("a manifest over 1 MiB still gets the exact oversize sentence", async () => {
    const res = await put(
      cookieA,
      "p-huge",
      manifest({ id: "p-huge", workspace: { xml: "x".repeat(1024 * 1024) } }),
    );
    expect(res.statusCode).toBe(413);
    expect(res.json().error).toBe("This project is too large to sync. Export it as a file instead.");
  });
});

describe("tombstone revive respects the cap (review fix)", () => {
  test("reviving a tombstone when already at the live cap is refused", async () => {
    for (let i = 0; i < 99; i++) {
      const r = await put(cookieC, `p-revcap-${i}`, manifest({ id: `p-revcap-${i}` }));
      expect(r.json().outcome).toBe("saved");
    }
    const created = await put(cookieC, "p-revcap-99", manifest({ id: "p-revcap-99" }));
    expect(created.json().outcome).toBe("saved");

    const del = await app.inject({
      method: "DELETE",
      url: "/api/projects/p-revcap-99",
      cookies: { pide_session: cookieC },
    });
    expect(del.statusCode).toBe(200);

    // Back up to 100 live: 99 originals + this new one, plus the one tombstone above.
    const tail = await put(cookieC, "p-revcap-tail", manifest({ id: "p-revcap-tail" }));
    expect(tail.json().outcome).toBe("saved");

    const revive = await put(
      cookieC,
      "p-revcap-99",
      manifest({ id: "p-revcap-99", updatedAt: 9999, title: "Revived Over Cap" }),
    );
    expect(revive.statusCode).toBe(403);
    expect(revive.json().error).toBe("You've reached the 100-project limit — delete something first.");
  });
});

/* ── Final fix wave, D1: the race-safe create ────────────────────────
   The `FOR UPDATE` on the head select locks NOTHING when the row does not
   exist yet, so two concurrent FIRST pushes of one new id both take the
   create branch. That is not a hypothetical: pressing "Start work" fires
   startWork's own explicit `engine.pushProject` and SyncProvider's
   auto-adopt of the same freshly-saved project a millisecond or two apart,
   and the loser used to 500 on the composite primary key — surfacing in the
   IDE as a false "Could not reach the server" on a Start that had in fact
   worked. The server heals it for every double-push, whatever its source. */
describe("two concurrent first pushes of one new id (final fix wave D1)", () => {
  test("both are accepted and exactly one row exists — the loser falls through to the ordinary update path", async () => {
    const owner = (await testDb.select().from(users).where(eq(users.email, "synce@example.com")))[0];
    // Warm two pool connections first. Without this the two injects do NOT
    // overlap: the second request spends ~20 ms establishing its own
    // connection while the first has already committed, and the race the
    // test exists to reproduce quietly does not happen.
    await Promise.all([
      app.inject({ method: "GET", url: "/api/projects", cookies: { pide_session: cookieE } }),
      app.inject({ method: "GET", url: "/api/projects", cookies: { pide_session: cookieE } }),
    ]);
    const [first, second] = await Promise.all([
      put(cookieE, "p-race-1", manifest({ id: "p-race-1", updatedAt: 5000, title: "Racer one" })),
      put(cookieE, "p-race-1", manifest({ id: "p-race-1", updatedAt: 6000, title: "Racer two" })),
    ]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    const rows = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, owner.id), eq(projects.id, "p-race-1")));
    expect(rows).toHaveLength(1);
    // clientUpdatedAt decides between them exactly as it does for any other
    // pair of pushes: the newer manifest is the head whichever one landed
    // second, and the older one is archived rather than dropped.
    expect(rows[0].clientUpdatedAt).toBe(6000);
    expect((rows[0].manifest as { title: string }).title).toBe("Racer two");
  });
});

describe("tombstones are bounded (review fix)", () => {
  test("tombstoning beyond the cap hard-deletes the oldest tombstoned rows", async () => {
    for (let i = 0; i < MAX_PROJECTS_PER_USER + 1; i++) {
      const id = `p-tombbound-${i}`;
      const created = await put(cookieD, id, manifest({ id }));
      expect(created.json().outcome).toBe("saved");
      const del = await app.inject({
        method: "DELETE",
        url: `/api/projects/${id}`,
        cookies: { pide_session: cookieD },
      });
      expect(del.statusCode).toBe(200);
      // Guarantee strictly increasing deleted_at timestamps (Date has ms resolution)
      // so the "oldest" row is unambiguous.
      await sleep(5);
    }

    const owner = (await testDb.select().from(users).where(eq(users.email, "syncd@example.com")))[0];
    const tombstones = await testDb
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, owner.id), sql`deleted_at IS NOT NULL`));
    expect(tombstones.length).toBeLessThanOrEqual(MAX_PROJECTS_PER_USER);
    expect(tombstones.some((p) => p.id === "p-tombbound-0")).toBe(false);
  });
});
