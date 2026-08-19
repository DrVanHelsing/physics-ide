import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users } from "../db/schema.js";

const app = buildApp({ db: testDb });
let cookie: string;
let cookieCap: string;

function manifest(updatedAt: number, title: string) {
  return {
    schemaVersion: 2,
    id: "p-hist-1",
    title,
    goal: "physics",
    projectType: "custom",
    createdAt: 1,
    updatedAt,
  };
}

/** Like manifest() but with a caller-chosen id, for the cap-on-restore scenario below. */
function capManifest(id: string, updatedAt: number, title: string) {
  return {
    schemaVersion: 2,
    id,
    title,
    goal: "physics",
    projectType: "custom",
    createdAt: 1,
    updatedAt,
  };
}

async function put(cookieVal: string, id: string, m: Record<string, unknown>) {
  return app.inject({
    method: "PUT",
    url: `/api/projects/${id}`,
    cookies: { pide_session: cookieVal },
    payload: { manifest: m },
  });
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await testDb.insert(users).values({
    name: "H",
    email: "hist@example.com",
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  await testDb.insert(users).values({
    name: "HC",
    email: "histcap@example.com",
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email: "hist@example.com", password: "a-long-password" },
  });
  cookie = res.cookies.find((c) => c.name === "pide_session")!.value;
  const resCap = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email: "histcap@example.com", password: "a-long-password" },
  });
  cookieCap = resCap.cookies.find((c) => c.name === "pide_session")!.value;

  for (const [ts, title] of [
    [1000, "v1"],
    [2000, "v2"],
    [3000, "v3"],
  ] as const) {
    await app.inject({
      method: "PUT",
      url: "/api/projects/p-hist-1",
      cookies: { pide_session: cookie },
      payload: { manifest: manifest(ts, title) },
    });
  }
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("version history", () => {
  test("lists archived heads newest-first, without the live head", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/projects/p-hist-1/versions",
      cookies: { pide_session: cookie },
    });
    expect(res.statusCode).toBe(200);
    const v = res.json().versions as Array<{ clientUpdatedAt: number; reason: string }>;
    expect(v.map((x) => x.clientUpdatedAt)).toEqual([2000, 1000]);
    expect(v.every((x) => x.reason === "overwrite")).toBe(true);
  });

  test("restore makes the old content the new head with a FRESH timestamp", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/projects/p-hist-1/versions",
      cookies: { pide_session: cookie },
    });
    const v1 = list.json().versions.find((x: { clientUpdatedAt: number }) => x.clientUpdatedAt === 1000);
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/p-hist-1/versions/${v1.versionId}/restore`,
      cookies: { pide_session: cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().clientUpdatedAt).toBeGreaterThan(3000);

    const head = await app.inject({
      method: "GET",
      url: "/api/projects/p-hist-1",
      cookies: { pide_session: cookie },
    });
    expect(head.json().project.manifest.title).toBe("v1");
    expect(head.json().project.manifest.updatedAt).toBe(res.json().clientUpdatedAt);

    const after = await app.inject({
      method: "GET",
      url: "/api/projects/p-hist-1/versions",
      cookies: { pide_session: cookie },
    });
    expect(after.json().versions.some((x: { reason: string }) => x.reason === "restore")).toBe(true);
  });

  test("restoring a foreign or unknown version 404s", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p-hist-1/versions/999999/restore",
      cookies: { pide_session: cookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such version.");
  });
});

describe("restore respects the cap when reviving a tombstone (controller ruling)", () => {
  test("restoring a version of a tombstoned project while owner is at the live cap is refused with the exact sentence", async () => {
    // Target project, with a version to restore.
    const first = await put(cookieCap, "p-histcap-target", capManifest("p-histcap-target", 1000, "cap-v1"));
    expect(first.json().outcome).toBe("saved");
    const second = await put(cookieCap, "p-histcap-target", capManifest("p-histcap-target", 2000, "cap-v2"));
    expect(second.json().outcome).toBe("saved");

    // Fill out to 100 live projects total: the target plus 99 fillers.
    for (let i = 0; i < 99; i++) {
      const id = `p-histcap-${i}`;
      const r = await put(cookieCap, id, capManifest(id, 1000, "filler"));
      expect(r.json().outcome).toBe("saved");
    }

    const list = await app.inject({
      method: "GET",
      url: "/api/projects/p-histcap-target/versions",
      cookies: { pide_session: cookieCap },
    });
    const versionId = list.json().versions[0].versionId;

    // Tombstone the target: live count drops to 99, freeing a cap slot.
    const del = await app.inject({
      method: "DELETE",
      url: "/api/projects/p-histcap-target",
      cookies: { pide_session: cookieCap },
    });
    expect(del.statusCode).toBe(200);

    // Refill that slot so the owner is back at the 100-live cap while the
    // target itself stays tombstoned.
    const tail = await put(cookieCap, "p-histcap-tail", capManifest("p-histcap-tail", 1000, "tail"));
    expect(tail.json().outcome).toBe("saved");

    const restore = await app.inject({
      method: "POST",
      url: `/api/projects/p-histcap-target/versions/${versionId}/restore`,
      cookies: { pide_session: cookieCap },
    });
    expect(restore.statusCode).toBe(403);
    expect(restore.json().error).toBe("You've reached the 100-project limit — delete something first.");
  });
});
