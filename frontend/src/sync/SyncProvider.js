import { useEffect, useRef, useState } from "react";
import { useMe } from "../auth/useAuth";
import { listProjects, saveProject, onProjectSaved, onProjectDeleted } from "../utils/storage/projectStore";
import { getSyncMeta, listSyncMeta } from "../utils/storage/syncMeta";
import { getGlobalSyncEngine } from "../utils/sync/syncEngine";
import { readLegacyV1, migrate } from "../utils/manifest/migrate";
import GuestImportPrompt from "./GuestImportPrompt";

/**
 * Invisible wiring: signed-in sessions get push-after-save, push-after-delete,
 * and reconcile on signin/focus/online. Signed-out sessions leave everything
 * untouched (guest saves and deletes never touch the engine).
 */
export default function SyncProvider({ children }) {
  const { data: me } = useMe();
  const engineRef = useRef(null);
  /* Unadopted locals present at sign-in = guest-era work. Task 9's §3.2 offer
     owns those; anything saved later without meta was created signed-in and
     is adopted automatically. */
  const guestIdsRef = useRef(new Set());
  /* True when the guest-era snapshot below could not be built (storage
     unreadable). Provenance is then UNKNOWN, so the auto-adopt branch is
     disabled — never upload guest work without the §3.2 offer. Pushes for
     projects that already hold meta are unaffected. */
  const snapshotFailedRef = useRef(false);
  /* The account the wiring last ran for, so an account SWITCH (or sign-out)
     can reset the page-lifetime engine singleton. */
  const lastOwnerIdRef = useRef(null);
  /* Spec §3.2 offer state: null when nothing to show, otherwise
     { count, ids } describing the unadopted guest-era projects found at
     sign-in. */
  const [importPrompt, setImportPrompt] = useState(null);
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    const ownerId = me?.id ?? null;
    const accountChanged = lastOwnerIdRef.current !== ownerId;
    lastOwnerIdRef.current = ownerId;
    if (!me) {
      // Signed out: a previous account's parked ids must never drain under
      // whoever signs in next (the engine is a page-lifetime singleton).
      if (accountChanged) engineRef.current?.reset();
      return undefined;
    }
    let disposed = false;
    let unsubSave = () => {};
    let unsubDelete = () => {};
    (async () => {
      let engine;
      try {
        engine = await getGlobalSyncEngine();
      } catch (err) {
        // Without an engine there is nothing the subscriptions below could
        // call. Fail loudly in the console rather than silently.
        console.warn("sync wiring: the sync engine could not be built", err);
        return;
      }
      if (disposed) return;
      engineRef.current = engine;
      if (accountChanged) engine.reset();
      engine.setOnline(navigator.onLine);

      // Read the local project list BEFORE reconcile (not after): a save
      // that lands while the awaited reconcile below is still running would
      // otherwise have no sync meta yet and get permanently misclassified as
      // guest-era. Filtering this pre-reconcile snapshot by POST-reconcile
      // `metas` still excludes cloud-pulled and tombstone-removed projects
      // (both get meta); anything saved mid-reconcile is simply absent from
      // `locals` and gets adopted normally on its next save instead.
      //
      // Every await from here on is individually contained: a rejection must
      // never skip the onProjectSaved/onProjectDeleted subscriptions at the
      // bottom, which would silently kill push-after-save for the whole
      // session while the chip still read "Synced".
      let locals = [];
      let snapshotFailed = false;
      try {
        locals = await listProjects();
      } catch (err) {
        snapshotFailed = true;
        console.warn("sync wiring: could not read the local project list", err);
      }
      if (disposed) return;
      try {
        await engine.reconcile(me.id);
      } catch {
        // The engine's reconcile is never-throwing after its own review
        // rounds; this is defense in depth so a future regression there
        // can't permanently kill push-after-save for the whole session.
        // Reconcile re-runs on focus/online regardless.
      }
      if (disposed) return;

      // Legacy v1 backfill: cloud pulled nothing and there were no local
      // projects to begin with, but a v1 blob is still on disk. This is the
      // signed-in resurrection case ProjectContext's bootstrap guard skips
      // (SIGNED_IN_HINT_KEY steers it toward the cloud pull above instead).
      // Uses a FRESH listProjects() (post-reconcile) — if the cloud pulled
      // anything down, the list is non-empty and no resurrection happens.
      // Runs BEFORE the guest-set snapshot below (so a resurrected project
      // lands in the §3.2 offer) and BEFORE the onProjectSaved subscription
      // is registered (so this save can't trigger auto-adoption).
      let resurrectedId = null;
      try {
        if ((await listProjects()).length === 0) {
          const legacy = readLegacyV1();
          if (legacy) {
            const saved = await saveProject(migrate(legacy));
            resurrectedId = saved.id;
          }
        }
      } catch (err) {
        // migrate() throws by design on corrupt/future-schema blobs, and
        // saveProject can reject (e.g. IndexedDB failure) — either way this
        // must not skip the snapshot, the prompt, or the onProjectSaved
        // subscription below (that would silently kill push-after-save for
        // the whole session, exactly what the reconcile try/catch above
        // guards against).
        console.warn("sync wiring: legacy v1 backfill failed", err);
      }
      if (disposed) return;

      let metas = {};
      try {
        metas = await listSyncMeta();
      } catch (err) {
        snapshotFailed = true;
        console.warn("sync wiring: could not read sync meta", err);
      }
      if (disposed) return;
      snapshotFailedRef.current = snapshotFailed;
      // An unreadable snapshot means "which projects are guest-era" is
      // unknown — use an EMPTY guest set and let the flag disable auto-adopt,
      // so nothing is uploaded without the §3.2 offer either way.
      guestIdsRef.current = snapshotFailed
        ? new Set()
        : new Set(locals.filter((l) => !metas[l.id]).map((l) => l.id));
      // The resurrected project can't be in `locals` (that snapshot was
      // taken pre-reconcile, before this save happened) — add it explicitly
      // so the §3.2 offer includes it and a later save doesn't silently
      // auto-adopt it.
      if (resurrectedId && !snapshotFailed) guestIdsRef.current.add(resurrectedId);

      if (guestIdsRef.current.size > 0 && !localStorage.getItem(`pide_guest_import_declined:${me.id}`)) {
        setImportPrompt({ count: guestIdsRef.current.size, ids: Array.from(guestIdsRef.current) });
      }

      unsubSave = onProjectSaved(async (manifest, opts) => {
        try {
          if (opts?.preserveTimestamp) return; // sync-pulled writes never re-push
          const meta = await getSyncMeta(manifest.id);
          if (meta && meta.ownerId && meta.ownerId !== me.id) return; // another account's project
          if (meta) {
            engine.pushProject(manifest.id, me.id);
            return;
          }
          if (guestIdsRef.current.has(manifest.id)) return; // guest-era: wait for the §3.2 offer
          if (snapshotFailedRef.current) return; // provenance unknown: never misadopt
          await engine.adoptLocalProject(manifest.id, me.id); // born signed-in: adopt now
        } catch (err) {
          console.warn("sync wiring: onProjectSaved handler failed", err);
        }
      });

      unsubDelete = onProjectDeleted((id, opts) => {
        if (opts?.fromSync) return; // sync-applied deletes must not echo back to the server
        (async () => {
          try {
            const meta = await getSyncMeta(id);
            if (!meta) return; // guest-era/unadopted local: untouched
            if (meta.ownerId && meta.ownerId !== me.id) return; // another account's project
            engine.deleteRemoteProject(id).catch(() => {}); // belt-and-suspenders; engine never throws
          } catch (err) {
            console.warn("sync wiring: onProjectDeleted handler failed", err);
          }
        })();
      });
    })().catch((err) => {
      // Last-resort net: nothing above should reject any more, and an
      // unhandled rejection here would be invisible outside devtools.
      console.warn("sync wiring: failed to wire this session", err);
    });

    const onFocus = () => engineRef.current?.reconcile(me.id);
    const onOnline = () => {
      engineRef.current?.setOnline(true);
      engineRef.current?.drainPending(me.id); // explicit owner: never a live singleton
      engineRef.current?.reconcile(me.id);
    };
    const onOffline = () => engineRef.current?.setOnline(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      disposed = true;
      unsubSave();
      unsubDelete();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      // Sign-out, or switching to a different account, must not leave the
      // previous account's §3.2 offer showing (and definitely must not let
      // its ids get adopted into a different account via a stale closure).
      setImportPrompt(null);
      setImportBusy(false);
    };
    // Only `me.id` is used inside this effect — object-identity churn from
    // unrelated profile field changes must not tear down and rebuild the
    // whole wiring (that would re-open the mid-reconcile window above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  const handleAcceptImport = async () => {
    if (!importPrompt || !me) return;
    setImportBusy(true);
    const engine = engineRef.current;
    try {
      for (const id of importPrompt.ids) {
        // eslint-disable-next-line no-await-in-loop
        await engine.adoptLocalProject(id, me.id);
        guestIdsRef.current.delete(id);
      }
      // adoptLocalProject never throws — a cap/oversize/invalid refusal comes
      // back on the status instead. Surface the server's sentence verbatim.
      const sentence = engine.getStatus?.().lastError;
      if (sentence) console.warn(`sync wiring: guest import — ${sentence}`);
      setImportPrompt(null);
    } catch (err) {
      // Leave the prompt open on failure rather than latching on
      // "Bringing them in…" forever — ids already adopted above were
      // deleted from guestIdsRef as they succeeded, so clicking "Bring
      // them in" again only retries what's left.
      console.warn("sync wiring: guest import accept failed", err);
    } finally {
      setImportBusy(false);
    }
  };

  const handleDeclineImport = () => {
    if (me) localStorage.setItem(`pide_guest_import_declined:${me.id}`, "1");
    setImportPrompt(null);
  };

  return (
    <>
      {/* Always mounted (see GuestImportPrompt's own comment) — only its
          content is conditional on importPrompt. */}
      <GuestImportPrompt
        open={!!importPrompt}
        count={importPrompt?.count ?? 0}
        onAccept={handleAcceptImport}
        onDecline={handleDeclineImport}
        busy={importBusy}
      />
      {children}
    </>
  );
}
