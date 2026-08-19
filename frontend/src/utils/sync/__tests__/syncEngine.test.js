import { describe, test, expect, vi } from "vitest";
import { createSyncEngine } from "../syncEngine";

function fakeWorld(overrides = {}) {
  const local = new Map(); // id -> manifest
  const metaMap = new Map(); // id -> meta
  const remote = new Map(); // id -> {clientUpdatedAt, manifest, deleted}
  const calls = [];
  const api = vi.fn(async (path, opts = {}) => {
    calls.push({ path, opts });
    if (overrides.apiError) throw Object.assign(new Error("boom"), { status: 500 });
    if (path === "/api/projects" && !opts.method) {
      return {
        projects: [...remote.entries()].map(([id, r]) => ({
          id,
          clientUpdatedAt: r.clientUpdatedAt,
          deleted: !!r.deleted,
          title: r.manifest?.title ?? "t",
          goal: "physics",
          projectType: "custom",
        })),
      };
    }
    const putMatch = path.match(/^\/api\/projects\/([^/]+)$/);
    if (putMatch && opts.method === "PUT") {
      const id = putMatch[1];
      const m = opts.body.manifest;
      const head = remote.get(id);
      if (head && !head.deleted && m.updatedAt < head.clientUpdatedAt) {
        return { outcome: "kept-remote", project: { id, clientUpdatedAt: head.clientUpdatedAt, manifest: head.manifest } };
      }
      remote.set(id, { clientUpdatedAt: m.updatedAt, manifest: m, deleted: false });
      return { outcome: "saved" };
    }
    if (putMatch && opts.method === "DELETE") {
      const id = putMatch[1];
      const head = remote.get(id);
      remote.set(id, { ...(head || { clientUpdatedAt: 0, manifest: null }), deleted: true });
      return { ok: true };
    }
    if (putMatch && !opts.method) {
      const head = remote.get(putMatch[1]);
      if (!head || head.deleted) throw Object.assign(new Error("No such project."), { status: 404 });
      return { project: { id: putMatch[1], clientUpdatedAt: head.clientUpdatedAt, manifest: head.manifest } };
    }
    throw new Error(`unexpected ${opts.method ?? "GET"} ${path}`);
  });
  const store = {
    listProjects: async () => [...local.values()].map((m) => ({ id: m.id, updatedAt: m.updatedAt })),
    loadProject: async (id) => local.get(id) ?? null,
    saveProject: async (m, opts = {}) => {
      const stamped = opts.preserveTimestamp ? { ...m } : { ...m, updatedAt: 999999 };
      local.set(m.id, stamped);
      return stamped;
    },
    deleteProject: async (id) => void local.delete(id),
  };
  const meta = {
    getSyncMeta: async (id) => metaMap.get(id) ?? null,
    setSyncMeta: async (id, v) => void metaMap.set(id, v),
    deleteSyncMeta: async (id) => void metaMap.delete(id),
    listSyncMeta: async () => Object.fromEntries(metaMap),
  };
  return { api, store, meta, local, remote, metaMap, calls };
}

function m(id, updatedAt, title = "t") {
  return { schemaVersion: 2, id, title, goal: "physics", projectType: "custom", createdAt: 1, updatedAt };
}

describe("pushProject", () => {
  test("saved outcome records meta and reaches synced", async () => {
    const w = fakeWorld();
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    await eng.pushProject("p-1");
    expect(w.remote.get("p-1").clientUpdatedAt).toBe(2000);
    expect(w.metaMap.get("p-1")).toMatchObject({ remoteUpdatedAt: 2000 });
    expect(eng.getStatus().state).toBe("synced");
  });

  test("kept-remote outcome writes the remote manifest locally WITH preserved timestamp", async () => {
    const w = fakeWorld();
    w.remote.set("p-1", { clientUpdatedAt: 9000, manifest: m("p-1", 9000, "remote"), deleted: false });
    w.local.set("p-1", m("p-1", 2000, "stale-local"));
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    await eng.pushProject("p-1");
    expect(w.local.get("p-1").title).toBe("remote");
    expect(w.local.get("p-1").updatedAt).toBe(9000); // preserved, not re-stamped
    expect(w.metaMap.get("p-1")).toMatchObject({ remoteUpdatedAt: 9000 });
  });

  test("api failure → error status, local untouched, no throw", async () => {
    const w = fakeWorld({ apiError: true });
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    await eng.pushProject("p-1");
    expect(eng.getStatus().state).toBe("error");
    expect(w.local.get("p-1").updatedAt).toBe(2000);
  });
});

describe("reconcile", () => {
  test("pulls newer remotes, pushes newer locals, deletes tombstoned, imports unknown-remote", async () => {
    const w = fakeWorld();
    // remote newer than local
    w.local.set("p-newer-remote", m("p-newer-remote", 1000, "old-local"));
    w.metaMap.set("p-newer-remote", { ownerId: "u-1", remoteUpdatedAt: 1000, lastPushedAt: 1 });
    w.remote.set("p-newer-remote", { clientUpdatedAt: 5000, manifest: m("p-newer-remote", 5000, "new-remote") });
    // local newer than remote
    w.local.set("p-newer-local", m("p-newer-local", 8000, "new-local"));
    w.metaMap.set("p-newer-local", { ownerId: "u-1", remoteUpdatedAt: 2000, lastPushedAt: 1 });
    w.remote.set("p-newer-local", { clientUpdatedAt: 2000, manifest: m("p-newer-local", 2000) });
    // tombstoned remotely, known locally
    w.local.set("p-gone", m("p-gone", 3000));
    w.metaMap.set("p-gone", { ownerId: "u-1", remoteUpdatedAt: 3000, lastPushedAt: 1 });
    w.remote.set("p-gone", { clientUpdatedAt: 3000, manifest: m("p-gone", 3000), deleted: true });
    // exists remotely only
    w.remote.set("p-cloud-only", { clientUpdatedAt: 4000, manifest: m("p-cloud-only", 4000, "cloud") });

    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");

    expect(w.local.get("p-newer-remote").title).toBe("new-remote");
    expect(w.local.get("p-newer-remote").updatedAt).toBe(5000);
    expect(w.remote.get("p-newer-local").clientUpdatedAt).toBe(8000);
    expect(w.local.has("p-gone")).toBe(false);
    expect(w.metaMap.has("p-gone")).toBe(false);
    expect(w.local.get("p-cloud-only").title).toBe("cloud");
    expect(eng.getStatus().state).toBe("synced");
  });

  test("guest-only local projects (no meta) are NOT auto-pushed by reconcile", async () => {
    const w = fakeWorld();
    w.local.set("p-guest", m("p-guest", 1000));
    const eng = createSyncEngine({ ...w, now: () => 2 });
    await eng.reconcile("u-1");
    expect(w.remote.has("p-guest")).toBe(false);
  });

  test("adoptLocalProject pushes a guest project and stamps its meta", async () => {
    const w = fakeWorld();
    w.local.set("p-guest", m("p-guest", 1000));
    const eng = createSyncEngine({ ...w, now: () => 2 });
    await eng.adoptLocalProject("p-guest", "u-1");
    expect(w.remote.get("p-guest").clientUpdatedAt).toBe(1000);
    expect(w.metaMap.get("p-guest")).toMatchObject({ ownerId: "u-1" });
  });
});

describe("status & offline", () => {
  test("setOnline(false) parks pushes as pending; going online drains", async () => {
    const w = fakeWorld();
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5 });
    eng.setOnline(false);
    await eng.pushProject("p-1");
    expect(eng.getStatus()).toMatchObject({ state: "offline", pendingCount: 1 });
    expect(w.remote.has("p-1")).toBe(false);
    eng.setOnline(true);
    await eng.drainPending();
    expect(w.remote.get("p-1").clientUpdatedAt).toBe(2000);
    expect(eng.getStatus().state).toBe("synced");
  });

  test("subscribe fires on transitions and unsubscribes cleanly", async () => {
    const w = fakeWorld();
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5 });
    const seen = [];
    const un = eng.subscribe((s) => seen.push(s.state));
    await eng.pushProject("p-1");
    expect(seen).toContain("syncing");
    expect(seen[seen.length - 1]).toBe("synced");
    un();
    await eng.pushProject("p-1");
    expect(seen[seen.length - 1]).toBe("synced"); // no new entries after unsubscribe
  });
});

describe("review fix: tombstone recency (finding 1)", () => {
  test("local newer than the tombstone survives and revives the remote", async () => {
    const w = fakeWorld();
    w.local.set("p-revive", m("p-revive", 5000, "still-here"));
    w.metaMap.set("p-revive", { ownerId: "u-1", remoteUpdatedAt: 3000, lastPushedAt: 1 });
    w.remote.set("p-revive", { clientUpdatedAt: 3000, manifest: m("p-revive", 3000, "tombstoned"), deleted: true });
    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");
    expect(w.local.has("p-revive")).toBe(true);
    expect(w.local.get("p-revive").title).toBe("still-here");
    expect(w.remote.get("p-revive").deleted).toBe(false);
    expect(w.remote.get("p-revive").clientUpdatedAt).toBe(5000);
  });

  test("local at or before the tombstone's timestamp is still deleted (existing behavior)", async () => {
    const w = fakeWorld();
    w.local.set("p-gone", m("p-gone", 3000));
    w.metaMap.set("p-gone", { ownerId: "u-1", remoteUpdatedAt: 3000, lastPushedAt: 1 });
    w.remote.set("p-gone", { clientUpdatedAt: 3000, manifest: m("p-gone", 3000), deleted: true });
    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");
    expect(w.local.has("p-gone")).toBe(false);
    expect(w.metaMap.has("p-gone")).toBe(false);
  });

  test("tombstone with no local copy but stale meta just clears the meta", async () => {
    const w = fakeWorld();
    w.metaMap.set("p-stale", { ownerId: "u-1", remoteUpdatedAt: 3000, lastPushedAt: 1 });
    w.remote.set("p-stale", { clientUpdatedAt: 3000, manifest: m("p-stale", 3000), deleted: true });
    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");
    expect(w.metaMap.has("p-stale")).toBe(false);
    expect(w.local.has("p-stale")).toBe(false);
  });
});

describe("review fix: delete propagation (finding 2)", () => {
  test("deleteRemoteProject deletes on the server and clears local meta", async () => {
    const w = fakeWorld();
    w.remote.set("p-1", { clientUpdatedAt: 2000, manifest: m("p-1", 2000), deleted: false });
    w.metaMap.set("p-1", { ownerId: "u-1", remoteUpdatedAt: 2000, lastPushedAt: 1 });
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    await eng.deleteRemoteProject("p-1");
    expect(w.remote.get("p-1").deleted).toBe(true);
    expect(w.metaMap.has("p-1")).toBe(false);
    expect(eng.getStatus().state).toBe("synced");
  });

  test("deleteRemoteProject failure leaves meta in place, sets error, never throws", async () => {
    const w = fakeWorld({ apiError: true });
    w.metaMap.set("p-1", { ownerId: "u-1", remoteUpdatedAt: 2000, lastPushedAt: 1 });
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    await expect(eng.deleteRemoteProject("p-1")).resolves.toBeUndefined();
    expect(w.metaMap.has("p-1")).toBe(true);
    expect(eng.getStatus().state).toBe("error");
  });

  test("reconcile infers a local delete: remote live + meta present + local absent -> DELETE issued, not re-imported", async () => {
    const w = fakeWorld();
    w.remote.set("p-was-local", { clientUpdatedAt: 2000, manifest: m("p-was-local", 2000, "gone-locally"), deleted: false });
    w.metaMap.set("p-was-local", { ownerId: "u-1", remoteUpdatedAt: 2000, lastPushedAt: 1 });
    // no local entry: it was deleted on this device
    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");
    expect(w.calls.some((c) => c.path === "/api/projects/p-was-local" && c.opts.method === "DELETE")).toBe(true);
    expect(w.metaMap.has("p-was-local")).toBe(false);
    expect(w.local.has("p-was-local")).toBe(false);
    expect(w.remote.get("p-was-local").deleted).toBe(true);
    expect(eng.getStatus().state).toBe("synced");
  });

  test("remote live + NO meta + local absent is still imported (unchanged)", async () => {
    const w = fakeWorld();
    w.remote.set("p-cloud-only", { clientUpdatedAt: 4000, manifest: m("p-cloud-only", 4000, "cloud") });
    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");
    expect(w.local.get("p-cloud-only").title).toBe("cloud");
  });
});

describe("review fix: subscriber isolation (finding 3)", () => {
  test("a throwing subscriber never breaks pushProject or other subscribers", async () => {
    const w = fakeWorld();
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    const seen = [];
    eng.subscribe(() => {
      throw new Error("bad subscriber");
    });
    eng.subscribe((s) => seen.push(s.state));
    await expect(eng.pushProject("p-1")).resolves.toBeUndefined();
    expect(seen[seen.length - 1]).toBe("synced");
  });
});

describe("review fix: per-project reconcile isolation (finding 4)", () => {
  test("one project's failure during reconcile does not abort the others; final state is error", async () => {
    const w = fakeWorld();
    w.local.set("p-good", m("p-good", 1000, "old"));
    w.metaMap.set("p-good", { ownerId: "u-1", remoteUpdatedAt: 1000, lastPushedAt: 1 });
    w.remote.set("p-good", { clientUpdatedAt: 5000, manifest: m("p-good", 5000, "fresh") });
    w.remote.set("p-bad", { clientUpdatedAt: 5000, manifest: m("p-bad", 5000, "unreachable") });
    // no local/meta for p-bad -> triggers the import branch -> GET on it throws
    const realApi = w.api;
    w.api = vi.fn(async (path, opts = {}) => {
      if (path === "/api/projects/p-bad" && !opts.method) {
        throw Object.assign(new Error("boom"), { status: 500 });
      }
      return realApi(path, opts);
    });
    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");
    expect(w.local.get("p-good").title).toBe("fresh");
    expect(w.local.has("p-bad")).toBe(false);
    expect(eng.getStatus().state).toBe("error");
  });
});

describe("review fix: reconcile push failures track pending (finding 5)", () => {
  test("a push failure during reconcile is tracked as pending and retried by drainPending", async () => {
    const w = fakeWorld();
    w.local.set("p-push-fail", m("p-push-fail", 8000, "local-newer"));
    w.metaMap.set("p-push-fail", { ownerId: "u-1", remoteUpdatedAt: 2000, lastPushedAt: 1 });
    w.remote.set("p-push-fail", { clientUpdatedAt: 2000, manifest: m("p-push-fail", 2000) });
    let fail = true;
    const realApi = w.api;
    w.api = vi.fn(async (path, opts = {}) => {
      if (path === "/api/projects/p-push-fail" && opts.method === "PUT" && fail) {
        throw Object.assign(new Error("boom"), { status: 500 });
      }
      return realApi(path, opts);
    });
    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");
    expect(eng.getStatus().pendingCount).toBe(1);
    expect(eng.getStatus().state).toBe("error");

    fail = false;
    await eng.drainPending();
    expect(w.remote.get("p-push-fail").clientUpdatedAt).toBe(8000);
    expect(eng.getStatus().state).toBe("synced");
  });
});

describe("review fix: drainPending aggregate status (finding 6)", () => {
  test("two pending ids, first fails, second succeeds -> final state is not synced while pendingCount > 0", async () => {
    const w = fakeWorld();
    w.local.set("p-a", m("p-a", 2000));
    w.local.set("p-b", m("p-b", 3000));
    const realApi = w.api;
    w.api = vi.fn(async (path, opts = {}) => {
      if (path === "/api/projects/p-a" && opts.method === "PUT") {
        throw Object.assign(new Error("boom"), { status: 500 });
      }
      return realApi(path, opts);
    });
    const eng = createSyncEngine({ ...w, now: () => 9999 });
    eng.setOnline(false);
    await eng.pushProject("p-a");
    await eng.pushProject("p-b");
    eng.setOnline(true);
    await eng.drainPending();
    expect(eng.getStatus().pendingCount).toBe(1);
    expect(eng.getStatus().state).toBe("error");
  });
});

describe("review fix: setOnline restores idle (finding 7)", () => {
  test("setOnline(true) restores idle status when nothing is pending", async () => {
    const w = fakeWorld();
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    eng.setOnline(false);
    expect(eng.getStatus().state).toBe("offline");
    eng.setOnline(true);
    expect(eng.getStatus().state).toBe("idle");
  });
});

describe("review fix: getGlobalSyncEngine promise cache (finding 8)", () => {
  test("concurrent calls share the same in-flight promise and resolve to the same instance", async () => {
    const { getGlobalSyncEngine } = await import("../syncEngine");
    const p1 = getGlobalSyncEngine();
    const p2 = getGlobalSyncEngine();
    expect(p1).toBe(p2);
    const [e1, e2] = await Promise.all([p1, p2]);
    expect(e1).toBe(e2);
  });
});
