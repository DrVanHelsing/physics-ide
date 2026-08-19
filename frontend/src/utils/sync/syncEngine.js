/**
 * The sync engine — spec §6.3. Local-first: it never blocks or fails a local
 * save; it quietly pushes after saves and reconciles on signin/online/focus.
 * Fully dependency-injected for pure-module testing.
 */

export function createSyncEngine({ api, store, meta, now = () => Date.now() }) {
  let status = { state: "idle", pendingCount: 0 };
  let online = true;
  const pending = new Set();
  const listeners = new Set();

  function setStatus(next) {
    status = { ...status, ...next, pendingCount: pending.size };
    for (const fn of listeners) fn(status);
  }

  async function pushOne(id) {
    const manifest = await store.loadProject(id);
    if (!manifest) return;
    const res = await api(`/api/projects/${id}`, { method: "PUT", body: { manifest } });
    if (res.outcome === "kept-remote") {
      await store.saveProject(res.project.manifest, { preserveTimestamp: true });
      await meta.setSyncMeta(id, {
        ownerId: (await meta.getSyncMeta(id))?.ownerId ?? null,
        remoteUpdatedAt: res.project.clientUpdatedAt,
        lastPushedAt: now(),
      });
    } else {
      await meta.setSyncMeta(id, {
        ownerId: (await meta.getSyncMeta(id))?.ownerId ?? null,
        remoteUpdatedAt: manifest.updatedAt,
        lastPushedAt: now(),
      });
    }
  }

  async function pushProject(id) {
    if (!online) {
      pending.add(id);
      setStatus({ state: "offline" });
      return;
    }
    setStatus({ state: "syncing" });
    try {
      await pushOne(id);
      pending.delete(id);
      setStatus({ state: "synced" });
    } catch (err) {
      pending.add(id);
      setStatus({ state: err?.status === undefined && !navigator?.onLine ? "offline" : "error" });
    }
  }

  async function drainPending() {
    const ids = [...pending];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await pushProject(id);
      if (!online) return;
    }
  }

  async function adoptLocalProject(id, ownerId) {
    await meta.setSyncMeta(id, { ownerId, remoteUpdatedAt: 0, lastPushedAt: 0 });
    await pushProject(id);
  }

  async function reconcile(ownerId) {
    if (!online) {
      setStatus({ state: "offline" });
      return;
    }
    setStatus({ state: "syncing" });
    try {
      const { projects: remoteList } = await api("/api/projects");
      const remoteById = new Map(remoteList.map((r) => [r.id, r]));
      const localList = await store.listProjects();
      const localById = new Map(localList.map((l) => [l.id, l]));
      const metaAll = await meta.listSyncMeta();

      for (const r of remoteList) {
        const local = localById.get(r.id);
        if (r.deleted) {
          if (local && metaAll[r.id]) {
            await store.deleteProject(r.id);
            await meta.deleteSyncMeta(r.id);
          }
          continue;
        }
        if (!local) {
          const { project } = await api(`/api/projects/${r.id}`);
          await store.saveProject(project.manifest, { preserveTimestamp: true });
          await meta.setSyncMeta(r.id, {
            ownerId,
            remoteUpdatedAt: project.clientUpdatedAt,
            lastPushedAt: now(),
          });
          continue;
        }
        if (r.clientUpdatedAt > local.updatedAt) {
          const { project } = await api(`/api/projects/${r.id}`);
          await store.saveProject(project.manifest, { preserveTimestamp: true });
          await meta.setSyncMeta(r.id, {
            ownerId,
            remoteUpdatedAt: project.clientUpdatedAt,
            lastPushedAt: now(),
          });
        } else if (r.clientUpdatedAt < local.updatedAt) {
          await pushOne(r.id);
        }
      }

      // Locals the server doesn't know: only push ones ALREADY adopted (meta exists).
      for (const l of localList) {
        if (!remoteById.has(l.id) && metaAll[l.id]) {
          await pushOne(l.id);
        }
      }
      setStatus({ state: "synced" });
    } catch {
      setStatus({ state: "error" });
    }
  }

  return {
    pushProject,
    drainPending,
    reconcile,
    adoptLocalProject,
    getStatus: () => status,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setOnline: (v) => {
      online = v;
      setStatus({ state: v ? status.state : "offline" });
    },
    dispose: () => listeners.clear(),
  };
}

let globalEngine = null;

/** Lazily wires the real dependencies. Import cost only when first used. */
export async function getGlobalSyncEngine() {
  if (globalEngine) return globalEngine;
  const { api } = await import("../api/client");
  const store = await import("../storage/projectStore");
  const meta = await import("../storage/syncMeta");
  globalEngine = createSyncEngine({ api, store, meta });
  return globalEngine;
}
