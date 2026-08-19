import { useEffect, useRef } from "react";
import { useMe } from "../auth/useAuth";
import { listProjects, onProjectSaved, onProjectDeleted } from "../utils/storage/projectStore";
import { getSyncMeta, listSyncMeta } from "../utils/storage/syncMeta";
import { getGlobalSyncEngine } from "../utils/sync/syncEngine";

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

  useEffect(() => {
    if (!me) return undefined;
    let disposed = false;
    let unsubSave = () => {};
    let unsubDelete = () => {};
    (async () => {
      const engine = await getGlobalSyncEngine();
      if (disposed) return;
      engineRef.current = engine;
      engine.setOnline(navigator.onLine);

      // Read the local project list BEFORE reconcile (not after): a save
      // that lands while the awaited reconcile below is still running would
      // otherwise have no sync meta yet and get permanently misclassified as
      // guest-era. Filtering this pre-reconcile snapshot by POST-reconcile
      // `metas` still excludes cloud-pulled and tombstone-removed projects
      // (both get meta); anything saved mid-reconcile is simply absent from
      // `locals` and gets adopted normally on its next save instead.
      const locals = await listProjects();
      try {
        await engine.reconcile(me.id);
      } catch {
        // The engine's reconcile is never-throwing after its own review
        // rounds; this is defense in depth so a future regression there
        // can't permanently kill push-after-save for the whole session.
        // Reconcile re-runs on focus/online regardless.
      }
      if (disposed) return;

      const metas = await listSyncMeta();
      guestIdsRef.current = new Set(locals.filter((l) => !metas[l.id]).map((l) => l.id));

      unsubSave = onProjectSaved(async (manifest, opts) => {
        try {
          if (opts?.preserveTimestamp) return; // sync-pulled writes never re-push
          const meta = await getSyncMeta(manifest.id);
          if (meta && meta.ownerId && meta.ownerId !== me.id) return; // another account's project
          if (meta) {
            engine.pushProject(manifest.id);
            return;
          }
          if (guestIdsRef.current.has(manifest.id)) return; // guest-era: wait for the §3.2 offer
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
    })();

    const onFocus = () => engineRef.current?.reconcile(me.id);
    const onOnline = () => {
      engineRef.current?.setOnline(true);
      engineRef.current?.drainPending();
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
    };
    // Only `me.id` is used inside this effect — object-identity churn from
    // unrelated profile field changes must not tear down and rebuild the
    // whole wiring (that would re-open the mid-reconcile window above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  return children;
}
