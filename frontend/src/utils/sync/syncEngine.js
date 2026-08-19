/**
 * The sync engine — spec §6.3. Local-first: it never blocks or fails a local
 * save; it quietly pushes after saves and reconciles on signin/online/focus.
 * Fully dependency-injected for pure-module testing.
 */

export function createSyncEngine({ api, store, meta, now = () => Date.now() }) {
  let status = { state: "idle", pendingCount: 0, lastError: null };
  let online = true;
  /* The account every push currently belongs to. Threaded down from
     reconcile/adopt/pushProject so meta always names the account whose
     session actually wrote the server row (never a previous user's id).
     Cleared by reset() on sign-out / account switch. */
  let currentOwnerId = null;
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

  /* Only these statuses carry a sentence written FOR a student — the cap,
     oversize, invalid-shape and not-found refusals the plan's Caps constraint
     says the client surfaces VERBATIM. A 5xx body is server internals
     (Postgres text, stack-shaped messages) and must never reach the chip's
     tooltip; transport failures have no server sentence at all. Both clear it. */
  const SURFACEABLE_STATUSES = new Set([400, 403, 404, 413]);
  function serverSentence(err) {
    return SURFACEABLE_STATUSES.has(err?.status) && typeof err?.message === "string" && err.message
      ? err.message
      : null;
  }

  function rememberOwner(ownerId) {
    if (ownerId) currentOwnerId = ownerId;
  }

  async function pushOne(id, ownerId) {
    const manifest = await store.loadProject(id);
    if (!manifest) return;
    const res = await api(`/api/projects/${id}`, { method: "PUT", body: { manifest } });
    /* The server writes the row under the session that made this request, so
       meta must name THAT account. Re-reading and preserving the stored
       ownerId (as this used to) leaves meta claiming a previous user after a
       shared-device account switch, which permanently disables push-after-save
       for those projects and keeps the cross-account gates below guessing. */
    const owner = ownerId ?? currentOwnerId ?? (await meta.getSyncMeta(id))?.ownerId ?? null;
    if (res.outcome === "kept-remote") {
      await store.saveProject(res.project.manifest, { preserveTimestamp: true });
      await meta.setSyncMeta(id, {
        ownerId: owner,
        remoteUpdatedAt: res.project.clientUpdatedAt,
        lastPushedAt: now(),
      });
    } else {
      await meta.setSyncMeta(id, {
        ownerId: owner,
        remoteUpdatedAt: manifest.updatedAt,
        lastPushedAt: now(),
      });
    }
  }

  /** Push, but on failure park the id for later retry via drainPending(). */
  async function pushTracked(id, ownerId) {
    try {
      await pushOne(id, ownerId);
    } catch (err) {
      pending.add(id);
      throw err;
    }
  }

  async function deleteOne(id) {
    await api(`/api/projects/${id}`, { method: "DELETE" });
    await meta.deleteSyncMeta(id);
  }

  async function pushProject(id, ownerId) {
    rememberOwner(ownerId);
    if (!online) {
      pending.add(id);
      setStatus({ state: "offline" });
      return;
    }
    setStatus({ state: "syncing" });
    try {
      await pushOne(id, ownerId);
      pending.delete(id);
      setStatus({ state: "synced", lastError: null });
    } catch (err) {
      pending.add(id);
      const offline =
        err?.status === undefined && typeof navigator !== "undefined" && !navigator.onLine;
      setStatus({ state: offline ? "offline" : "error", lastError: serverSentence(err) });
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
    if (pending.size === 0) setStatus({ state: "synced", lastError: null });
    else setStatus({ state: "error" });
  }

  async function adoptLocalProject(id, ownerId) {
    rememberOwner(ownerId);
    await meta.setSyncMeta(id, { ownerId, remoteUpdatedAt: 0, lastPushedAt: 0 });
    await pushProject(id, ownerId);
    // pushProject never throws, so a cap/oversize/validation refusal would
    // otherwise vanish. Surface the server's sentence verbatim.
    if (status.state === "error" && status.lastError) {
      console.warn(`sync: could not add project ${id} to your account — ${status.lastError}`);
    }
  }

  /** Propagate a local delete to the server. Never throws. */
  async function deleteRemoteProject(id) {
    setStatus({ state: "syncing" });
    try {
      await deleteOne(id);
      setStatus({ state: "synced", lastError: null });
    } catch (err) {
      // Meta stays in place on failure — the next reconcile() will infer the
      // same "locally absent, remote live, meta present" case and retry.
      setStatus({ state: "error", lastError: serverSentence(err) });
    }
  }

  async function reconcile(ownerId) {
    rememberOwner(ownerId);
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
    } catch (err) {
      setStatus({ state: "error", lastError: serverSentence(err) });
      return;
    }

    /* Ownership gate. A meta record only counts as "this project is adopted"
       when it belongs to the account we are reconciling for (or predates
       owner stamping — ownerId null). Meta naming ANOTHER account must be
       treated as not-adopted on every branch: never auto-pushed into this
       account's cloud (that is the shared-device cross-account leak), never
       auto-deleted, never used to infer anything. Such a project stays
       strictly local until its owner signs back in. */
    const ownedMeta = (id) => {
      const mm = metaAll[id];
      return mm && (!mm.ownerId || mm.ownerId === ownerId) ? mm : null;
    };

    const remoteById = new Map(remoteList.map((r) => [r.id, r]));
    const localById = new Map(localList.map((l) => [l.id, l]));
    let failures = 0;
    let lastFailureSentence = null;
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
          if (local && ownedMeta(r.id)) {
            if (local.updatedAt > r.clientUpdatedAt) {
              // Our copy is newer than the tombstone: revive it. The
              // server's PUT resurrects a tombstoned project with newer
              // content — most-recent-wins, as specced.
              await pushTracked(r.id, ownerId);
            } else {
              // Tag this delete as sync-applied so SyncProvider's
              // onProjectDeleted handler doesn't echo it straight back to the
              // server as if a human deleted it locally.
              await store.deleteProject(r.id, { fromSync: true });
              await meta.deleteSyncMeta(r.id);
            }
          } else if (!local && ownedMeta(r.id)) {
            // Stale meta for a project that's gone on both sides.
            await meta.deleteSyncMeta(r.id);
          }
          continue;
        }
        if (!local) {
          if (ownedMeta(r.id) && !suspectEmptyLocalIndex) {
            // Known to us before, absent now: it was deleted locally.
            // Propagate the delete instead of re-importing it.
            await deleteOne(r.id);
          } else {
            // No meta of ours (never seen before, or it belongs to another
            // account), OR the local index looks suspect (corruption reads
            // the same as "deleted everything" — don't infer a mass delete
            // from it, just re-pull/import instead).
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
          await pushTracked(r.id, ownerId);
        }
      } catch (err) {
        failures += 1;
        lastFailureSentence = serverSentence(err) ?? lastFailureSentence;
        console.warn(`sync reconcile: failed for project ${r.id}`, err);
      }
    }

    // Locals the server doesn't know: only push ones ALREADY adopted BY THIS
    // ACCOUNT (owned meta exists). A local project carrying another account's
    // meta is left alone — pushing it here is what uploaded the previous
    // student's library into the next student's cloud.
    for (const l of localList) {
      if (!remoteById.has(l.id) && ownedMeta(l.id)) {
        try {
          await pushTracked(l.id, ownerId);
        } catch (err) {
          failures += 1;
          lastFailureSentence = serverSentence(err) ?? lastFailureSentence;
          console.warn(`sync reconcile: failed for project ${l.id}`, err);
        }
      }
    }

    if (failures === 0) setStatus({ state: "synced", lastError: null });
    else setStatus({ state: "error", lastError: lastFailureSentence });
  }

  return {
    pushProject,
    drainPending,
    reconcile,
    adoptLocalProject,
    deleteRemoteProject,
    getStatus: () => status,
    /**
     * Ids parked for retry — i.e. work the server may NOT hold. Sign-out
     * cleanup reads this before deleting any local copy: a parked project is
     * unsynced by definition and must stay on disk.
     */
    getPendingIds: () => [...pending],
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
    /**
     * Forget everything that belongs to the account that just left: parked
     * ids, the remembered owner, and any error/status it produced. The engine
     * is a page-lifetime singleton, so without this a previous account's
     * pending pushes would drain under the NEXT account's session.
     */
    reset: () => {
      pending.clear();
      currentOwnerId = null;
      setStatus({ state: "idle", lastError: null });
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
