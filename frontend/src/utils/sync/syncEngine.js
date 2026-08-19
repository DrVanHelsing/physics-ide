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
    for (const fn of listeners) {
      try {
        fn(status);
      } catch {
        // A misbehaving subscriber must never break the engine.
      }
    }
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

  /** Push, but on failure park the id for later retry via drainPending(). */
  async function pushTracked(id) {
    try {
      await pushOne(id);
    } catch (err) {
      pending.add(id);
      throw err;
    }
  }

  async function deleteOne(id) {
    await api(`/api/projects/${id}`, { method: "DELETE" });
    await meta.deleteSyncMeta(id);
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
      const offline =
        err?.status === undefined && typeof navigator !== "undefined" && !navigator.onLine;
      setStatus({ state: offline ? "offline" : "error" });
    }
  }

  async function drainPending() {
    const ids = [...pending];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await pushProject(id);
      if (!online) return;
    }
    // Empty `ids` skips the loop entirely, so re-check `online` here too —
    // otherwise draining an empty queue while offline would falsely claim
    // "synced" (the early return above never gets a chance to fire).
    if (!online) {
      setStatus({ state: "offline" });
      return;
    }
    setStatus({ state: pending.size === 0 ? "synced" : "error" });
  }

  async function adoptLocalProject(id, ownerId) {
    await meta.setSyncMeta(id, { ownerId, remoteUpdatedAt: 0, lastPushedAt: 0 });
    await pushProject(id);
  }

  /** Propagate a local delete to the server. Never throws. */
  async function deleteRemoteProject(id) {
    setStatus({ state: "syncing" });
    try {
      await deleteOne(id);
      setStatus({ state: "synced" });
    } catch {
      // Meta stays in place on failure — the next reconcile() will infer the
      // same "locally absent, remote live, meta present" case and retry.
      setStatus({ state: "error" });
    }
  }

  async function reconcile(ownerId) {
    if (!online) {
      setStatus({ state: "offline" });
      return;
    }
    setStatus({ state: "syncing" });

    let remoteList;
    let localList;
    let metaAll;
    try {
      ({ projects: remoteList } = await api("/api/projects"));
      localList = await store.listProjects();
      metaAll = await meta.listSyncMeta();
      // A malformed response (missing `projects`) must end reconcile on the
      // normal "error" status path, not reject with an uncaught TypeError —
      // keep the shape check inside the same try as the fetch it validates.
      if (!Array.isArray(remoteList)) {
        throw new Error("malformed /api/projects response: missing projects array");
      }
    } catch {
      setStatus({ state: "error" });
      return;
    }

    const remoteById = new Map(remoteList.map((r) => [r.id, r]));
    const localById = new Map(localList.map((l) => [l.id, l]));
    let failures = 0;
    // An empty local index alongside populated sync meta is indistinguishable
    // from "the local project index is corrupt" — treat that combination as
    // suspect and skip delete-inference this pass (pulls/imports still run
    // normally). A later reconcile with a healthy local list resumes
    // inference; genuine local deletes still propagate immediately via
    // deleteRemoteProject's own wiring, independent of reconcile.
    const suspectEmptyLocalIndex = localList.length === 0 && Object.keys(metaAll).length > 0;

    for (const r of remoteList) {
      try {
        const local = localById.get(r.id);
        if (r.deleted) {
          if (local && metaAll[r.id]) {
            if (local.updatedAt > r.clientUpdatedAt) {
              // Our copy is newer than the tombstone: revive it. The
              // server's PUT resurrects a tombstoned project with newer
              // content — most-recent-wins, as specced.
              await pushTracked(r.id);
            } else {
              // Tag this delete as sync-applied so SyncProvider's
              // onProjectDeleted handler doesn't echo it straight back to the
              // server as if a human deleted it locally.
              await store.deleteProject(r.id, { fromSync: true });
              await meta.deleteSyncMeta(r.id);
            }
          } else if (!local && metaAll[r.id]) {
            // Stale meta for a project that's gone on both sides.
            await meta.deleteSyncMeta(r.id);
          }
          continue;
        }
        if (!local) {
          if (metaAll[r.id] && !suspectEmptyLocalIndex) {
            // Known to us before, absent now: it was deleted locally.
            // Propagate the delete instead of re-importing it.
            await deleteOne(r.id);
          } else {
            // No meta (never seen before), OR the local index looks suspect
            // (corruption reads the same as "deleted everything" — don't
            // infer a mass delete from it, just re-pull/import instead).
            const { project } = await api(`/api/projects/${r.id}`);
            await store.saveProject(project.manifest, { preserveTimestamp: true });
            await meta.setSyncMeta(r.id, {
              ownerId,
              remoteUpdatedAt: project.clientUpdatedAt,
              lastPushedAt: now(),
            });
          }
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
          await pushTracked(r.id);
        }
      } catch (err) {
        failures += 1;
        console.warn(`sync reconcile: failed for project ${r.id}`, err);
      }
    }

    // Locals the server doesn't know: only push ones ALREADY adopted (meta exists).
    for (const l of localList) {
      if (!remoteById.has(l.id) && metaAll[l.id]) {
        try {
          await pushTracked(l.id);
        } catch (err) {
          failures += 1;
          console.warn(`sync reconcile: failed for project ${l.id}`, err);
        }
      }
    }

    setStatus({ state: failures === 0 ? "synced" : "error" });
  }

  return {
    pushProject,
    drainPending,
    reconcile,
    adoptLocalProject,
    deleteRemoteProject,
    getStatus: () => status,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setOnline: (v) => {
      online = v;
      if (v) {
        setStatus({ state: status.state === "offline" ? "idle" : status.state });
      } else {
        setStatus({ state: "offline" });
      }
    },
    dispose: () => listeners.clear(),
  };
}

let globalEnginePromise = null;

/**
 * Lazily wires the real dependencies. Caches the in-flight build promise (not
 * the resolved engine) so concurrent first callers all share one build; a
 * failed build clears the cache so a later call can retry.
 */
export function getGlobalSyncEngine() {
  if (!globalEnginePromise) {
    globalEnginePromise = (async () => {
      const { api } = await import("../api/client");
      const store = await import("../storage/projectStore");
      const meta = await import("../storage/syncMeta");
      return createSyncEngine({ api, store, meta });
    })().catch((err) => {
      globalEnginePromise = null;
      throw err;
    });
  }
  return globalEnginePromise;
}
