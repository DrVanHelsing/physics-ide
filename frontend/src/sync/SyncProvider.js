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
      await engine.reconcile(me.id);
      if (disposed) return;

      const locals = await listProjects();
      const metas = await listSyncMeta();
      guestIdsRef.current = new Set(locals.filter((l) => !metas[l.id]).map((l) => l.id));

      unsubSave = onProjectSaved(async (manifest, opts) => {
        if (opts?.preserveTimestamp) return; // sync-pulled writes never re-push
        const meta = await getSyncMeta(manifest.id);
        if (meta && meta.ownerId && meta.ownerId !== me.id) return; // another account's project
        if (meta) {
          engine.pushProject(manifest.id);
          return;
        }
        if (guestIdsRef.current.has(manifest.id)) return; // guest-era: wait for the §3.2 offer
        await engine.adoptLocalProject(manifest.id, me.id); // born signed-in: adopt now
      });

      unsubDelete = onProjectDeleted((id) => {
        (async () => {
          const meta = await getSyncMeta(id);
          if (!meta) return; // guest-era/unadopted local: untouched
          if (meta.ownerId && meta.ownerId !== me.id) return; // another account's project
          engine.deleteRemoteProject(id).catch(() => {}); // belt-and-suspenders; engine never throws
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
  }, [me]);

  return children;
}
