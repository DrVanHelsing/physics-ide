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
