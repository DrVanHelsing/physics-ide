/**
 * The sync engine — spec §6.3. Local-first: it never blocks or fails a local
 * save; it quietly pushes after saves and reconciles on signin/online/focus.
 * Fully dependency-injected for pure-module testing.
 */

export function createSyncEngine({ api, store, meta, now = () => Date.now() }) {
  let status = { state: "idle", pendingCount: 0, lastError: null };
  let online = true;
  /* Account generation. reset() — which runs on every sign-out and account
     switch — bumps it, invalidating every in-flight continuation started under
     the previous account.

     Why an epoch and not just a stamped ownerId: the SESSION COOKIE is the
     authority, not our bookkeeping. Any fetch dispatched after the next user's
     cookie is live lands on the server under THAT user, whatever we stamp
     locally. A detached loop (e.g. the sign-out flush's bounded drain, which
     keeps running after its timeout loses the race) must therefore never
     DISPATCH again across an account transition. Every path that calls the api
     after an await captures the epoch on entry and re-checks it immediately
     before each api call — and before each store/meta write and status write
     that follows one — so a stale continuation stops silently and leaves no
     trace. */
  let epoch = 0;
  const pending = new Set();
  const listeners = new Set();

  /** True when this continuation belongs to an account that has since left. */
  const stale = (myEpoch) => myEpoch !== epoch;

  function setStatus(next, myEpoch) {
    if (myEpoch !== undefined && stale(myEpoch)) return; // stale epochs never touch the chip
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

  async function pushOne(id, ownerId, myEpoch) {
    const manifest = await store.loadProject(id);
    if (!manifest) return;
    if (stale(myEpoch)) return; // the account left while we read from disk
    const res = await api(`/api/projects/${id}`, { method: "PUT", body: { manifest } });
    if (stale(myEpoch)) return; // never write bookkeeping for a departed session
    /* The server writes the row under the session that made this request, so
       meta must name THAT account. The owner is always passed in explicitly —
       there is deliberately no live "current account" singleton to fall back
       on, because a detached continuation would read whatever account happens
       to be signed in later. Failing that, the record's own stored ownerId. */
    const owner = ownerId ?? (await meta.getSyncMeta(id))?.ownerId ?? null;
    if (stale(myEpoch)) return;
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
  async function pushTracked(id, ownerId, myEpoch) {
    try {
      await pushOne(id, ownerId, myEpoch);
    } catch (err) {
      pending.add(id);
      throw err;
    }
  }

  async function deleteOne(id, myEpoch) {
    if (stale(myEpoch)) return;
    await api(`/api/projects/${id}`, { method: "DELETE" });
    if (stale(myEpoch)) return;
    await meta.deleteSyncMeta(id);
  }

  async function pushProjectAt(id, ownerId, myEpoch) {
    if (stale(myEpoch)) return;
    if (!online) {
      pending.add(id);
      setStatus({ state: "offline" }, myEpoch);
      return;
    }
    setStatus({ state: "syncing" }, myEpoch);
    try {
      await pushOne(id, ownerId, myEpoch);
      if (stale(myEpoch)) return;
      pending.delete(id);
      setStatus({ state: "synced", lastError: null }, myEpoch);
    } catch (err) {
      if (stale(myEpoch)) return;
      pending.add(id);
      const offline =
        err?.status === undefined && typeof navigator !== "undefined" && !navigator.onLine;
      setStatus({ state: offline ? "offline" : "error", lastError: serverSentence(err) }, myEpoch);
    }
  }

  async function pushProject(id, ownerId) {
    return pushProjectAt(id, ownerId, epoch);
  }

  /**
   * Retry every parked id. `ownerId` is required for correct stamping — the
   * sign-out flush passes the DEPARTING user's id, snapshotted before the
   * signout request, and the wiring passes the signed-in user's.
   */
  async function drainPending(ownerId) {
    const myEpoch = epoch;
    const ids = [...pending];
    for (const id of ids) {
      if (stale(myEpoch)) return; // account transition mid-drain: dispatch nothing more
      // eslint-disable-next-line no-await-in-loop
      await pushProjectAt(id, ownerId, myEpoch);
      if (!online) return;
    }
    if (stale(myEpoch)) return;
    // Empty `ids` skips the loop entirely, so re-check `online` here too —
    // otherwise draining an empty queue while offline would falsely claim
    // "synced" (the early return above never gets a chance to fire).
    if (!online) {
      setStatus({ state: "offline" }, myEpoch);
      return;
    }
    if (pending.size === 0) setStatus({ state: "synced", lastError: null }, myEpoch);
    else setStatus({ state: "error" }, myEpoch);
  }

  async function adoptLocalProject(id, ownerId) {
    const myEpoch = epoch;
    if (stale(myEpoch)) return;
    await meta.setSyncMeta(id, { ownerId, remoteUpdatedAt: 0, lastPushedAt: 0 });
    await pushProjectAt(id, ownerId, myEpoch);
    if (stale(myEpoch)) return;
    // pushProject never throws, so a cap/oversize/validation refusal would
    // otherwise vanish. Surface the server's sentence verbatim.
    if (status.state === "error" && status.lastError) {
      console.warn(`sync: could not add project ${id} to your account — ${status.lastError}`);
    }
  }

  /** Propagate a local delete to the server. Never throws. */
  async function deleteRemoteProject(id) {
    const myEpoch = epoch;
    setStatus({ state: "syncing" }, myEpoch);
    try {
      await deleteOne(id, myEpoch);
      setStatus({ state: "synced", lastError: null }, myEpoch);
    } catch (err) {
      // Meta stays in place on failure — the next reconcile() will infer the
      // same "locally absent, remote live, meta present" case and retry.
      setStatus({ state: "error", lastError: serverSentence(err) }, myEpoch);
    }
  }

  async function reconcile(ownerId) {
    const myEpoch = epoch;
    if (!online) {
      setStatus({ state: "offline" }, myEpoch);
      return;
    }
    setStatus({ state: "syncing" }, myEpoch);

    let remoteList;
    let localList;
    let metaAll;
    try {
      ({ projects: remoteList } = await api("/api/projects"));
      if (stale(myEpoch)) return;
      localList = await store.listProjects();
      metaAll = await meta.listSyncMeta();
      // A malformed response (missing `projects`) must end reconcile on the
      // normal "error" status path, not reject with an uncaught TypeError —
      // keep the shape check inside the same try as the fetch it validates.
      if (!Array.isArray(remoteList)) {
        throw new Error("malformed /api/projects response: missing projects array");
      }
    } catch (err) {
      setStatus({ state: "error", lastError: serverSentence(err) }, myEpoch);
      return;
    }
    if (stale(myEpoch)) return;

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
      if (stale(myEpoch)) return; // account transition mid-reconcile: stop dispatching
      try {
        const local = localById.get(r.id);
        if (r.deleted) {
          if (local && ownedMeta(r.id)) {
            if (local.updatedAt > r.clientUpdatedAt) {
              // Our copy is newer than the tombstone: revive it. The
              // server's PUT resurrects a tombstoned project with newer
              // content — most-recent-wins, as specced.
              await pushTracked(r.id, ownerId, myEpoch);
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
            await deleteOne(r.id, myEpoch);
          } else {
            // No meta of ours (never seen before, or it belongs to another
            // account), OR the local index looks suspect (corruption reads
            // the same as "deleted everything" — don't infer a mass delete
            // from it, just re-pull/import instead).
            const { project } = await api(`/api/projects/${r.id}`);
            if (stale(myEpoch)) return;
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
          if (stale(myEpoch)) return;
          await store.saveProject(project.manifest, { preserveTimestamp: true });
          await meta.setSyncMeta(r.id, {
            ownerId,
            remoteUpdatedAt: project.clientUpdatedAt,
            lastPushedAt: now(),
          });
        } else if (r.clientUpdatedAt < local.updatedAt) {
          await pushTracked(r.id, ownerId, myEpoch);
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
      if (stale(myEpoch)) return;
      if (!remoteById.has(l.id) && ownedMeta(l.id)) {
        try {
          await pushTracked(l.id, ownerId, myEpoch);
        } catch (err) {
          failures += 1;
          lastFailureSentence = serverSentence(err) ?? lastFailureSentence;
          console.warn(`sync reconcile: failed for project ${l.id}`, err);
        }
      }
    }

    if (failures === 0) setStatus({ state: "synced", lastError: null }, myEpoch);
    else setStatus({ state: "error", lastError: lastFailureSentence }, myEpoch);
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
     * ids, and any error/status it produced. Bumping the epoch also KILLS
     * every in-flight continuation started under that account — a detached
     * drain (the sign-out flush's, say) will find itself stale and stop before
     * dispatching another request, so nothing can land on the server under the
     * next user's cookie. The engine is a page-lifetime singleton; without
     * this a previous account's pending pushes would drain under the next
     * account's session.
     */
    reset: () => {
      epoch += 1;
      pending.clear();
      setStatus({ state: "idle", lastError: null });
    },
    /** Test/diagnostic hook: the current account generation. */
    getEpoch: () => epoch,
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
