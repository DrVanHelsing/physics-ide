/**
 * Sign-out hygiene (final review F3).
 *
 * Plan 4 made local storage hold CLOUD data: reconcile() writes every project
 * the signed-in account owns into this browser profile. On a shared lab
 * machine that must not outlive the session — the next student would find the
 * previous one's whole library in the start menu.
 *
 * Two steps, both deliberately un-throwing (sign-out must always complete):
 *   1. flushPendingSyncBeforeSignOut() — a last push attempt while the session
 *      cookie is still valid. Call it BEFORE the signout request.
 *   2. clearCloudProjectsAfterSignOut() — delete the local copy + sync meta of
 *      every project whose meta names an owner. Guest-era projects (no meta,
 *      or meta without an ownerId) are never touched: local-first stands.
 *
 * A project whose delete fails simply stays on disk. It is inert: reconcile's
 * owner gate (F1) refuses to push, delete or infer anything from meta that
 * names a different account.
 */

import { deleteProject } from "../storage/projectStore";
import { listSyncMeta, deleteSyncMeta } from "../storage/syncMeta";
import { getGlobalSyncEngine } from "./syncEngine";

/** Last chance to push parked work — the cookie is still good here. */
export async function flushPendingSyncBeforeSignOut() {
  try {
    const engine = await getGlobalSyncEngine();
    await engine.drainPending();
  } catch (err) {
    console.warn("sign-out: final sync push failed; work stays on this computer", err);
  }
}

/**
 * Remove this account's cloud-derived projects from the device, then clear the
 * engine's per-account state. Never throws.
 */
export async function clearCloudProjectsAfterSignOut() {
  let metas = {};
  try {
    metas = await listSyncMeta();
  } catch (err) {
    console.warn("sign-out: could not read sync meta; local copies stay on disk", err);
    return;
  }
  for (const [id, meta] of Object.entries(metas)) {
    if (!meta || !meta.ownerId) continue; // guest-era / unowned: local-first, untouched
    try {
      // `fromSync` marks this as a non-user delete so SyncProvider's delete
      // wiring doesn't echo it to the server as "the student deleted it" —
      // the copy is leaving THIS DEVICE, not the account.
      // eslint-disable-next-line no-await-in-loop
      await deleteProject(id, { fromSync: true });
      // eslint-disable-next-line no-await-in-loop
      await deleteSyncMeta(id);
    } catch (err) {
      console.warn(`sign-out: kept local copy of ${id} (cleanup failed)`, err);
    }
  }
  try {
    const engine = await getGlobalSyncEngine();
    engine.reset();
  } catch {
    // No engine means nothing was parked under the departing account.
  }
}
