/**
 * Sign-out hygiene (final review F3, hardened in the residual round).
 *
 * Plan 4 made local storage hold CLOUD data: reconcile() writes every project
 * the signed-in account owns into this browser profile. On a shared lab
 * machine that must not outlive the session — the next student would find the
 * previous one's whole library in the start menu.
 *
 * Two steps, both deliberately un-throwing (sign-out must always complete):
 *   1. flushPendingSyncBeforeSignOut() — a BOUNDED last push attempt while the
 *      session cookie is still valid. Call it BEFORE the signout request.
 *   2. clearCloudProjectsAfterSignOut() — remove the local copy + sync meta of
 *      every project the server PROVABLY holds current. Anything else stays.
 *
 * The discriminator is the whole safety story: `adoptLocalProject` stamps meta
 * BEFORE the push lands, so "has an ownerId" does NOT mean "the server has it".
 * A project refused permanently (413 oversize / 403 cap / 400 invalid) or
 * parked for retry is owned-but-unsynced, and deleting it here would destroy
 * the only copy — a hard delete, with no archive anywhere. So a local copy is
 * removed only when the server's copy is at least as new AND the id is not
 * parked in the engine's pending queue. Everything else — including its meta —
 * stays on disk: F1's owner gates keep it inert under any other account, and
 * the same user's next sign-in resumes it normally.
 */

import { loadProject, deleteProject } from "../storage/projectStore";
import { listSyncMeta, deleteSyncMeta } from "../storage/syncMeta";
import { getGlobalSyncEngine } from "./syncEngine";

/** Sign-out must not hang on a dead network; parked work is protected anyway. */
export const SIGN_OUT_FLUSH_TIMEOUT_MS = 4000;

/**
 * Pure decision: may this project's local copy leave the device?
 * `pendingIds` is a Set of ids the engine has parked for retry.
 */
export function shouldDropLocalCopy({ meta, manifest, pendingIds }) {
  if (!meta || !meta.ownerId) return false; // guest-era / unowned: local-first, untouched
  if (!manifest) return false; // already gone locally — leave the meta so a pending local delete still propagates
  if (pendingIds?.has?.(manifest.id)) return false; // parked for retry: the server may not have it
  return (meta.remoteUpdatedAt ?? 0) >= (manifest.updatedAt ?? 0); // server holds it current
}

/**
 * Last chance to push parked work — the cookie is still good here. Bounded:
 * on a hung or very slow link this resolves after SIGN_OUT_FLUSH_TIMEOUT_MS so
 * the signout request still goes out promptly (leaving the session alive on a
 * shared machine is the worse failure). Anything that didn't make it is kept
 * on disk by shouldDropLocalCopy above.
 */
export async function flushPendingSyncBeforeSignOut(timeoutMs = SIGN_OUT_FLUSH_TIMEOUT_MS) {
  let timer = null;
  try {
    const engine = await getGlobalSyncEngine();
    const bound = new Promise((resolve) => {
      timer = setTimeout(() => {
        console.warn("sign-out: final sync push timed out; unsynced work stays on this computer");
        resolve();
      }, timeoutMs);
    });
    await Promise.race([engine.drainPending(), bound]);
  } catch (err) {
    console.warn("sign-out: final sync push failed; work stays on this computer", err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Remove this account's safely-synced projects from the device, then clear the
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

  let engine = null;
  let pendingIds = new Set();
  try {
    engine = await getGlobalSyncEngine();
    pendingIds = new Set(engine.getPendingIds());
  } catch (err) {
    // No engine means no pending knowledge. Fail SAFE: treat every project as
    // possibly-unsynced rather than deleting on an unverified assumption.
    console.warn("sign-out: sync engine unavailable; local copies stay on disk", err);
    return;
  }

  for (const [id, meta] of Object.entries(metas)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const manifest = await loadProject(id).catch(() => null);
      if (!shouldDropLocalCopy({ meta, manifest, pendingIds })) continue;
      // META FIRST, then the copy. An interruption between the two must not
      // leave owned meta with no local project: the next same-user sign-in
      // would read that as "deleted on this device" and TOMBSTONE the live
      // cloud project. The reverse leftover — a local copy with no meta —
      // simply reads as guest-era work and gets re-offered by §3.2.
      // eslint-disable-next-line no-await-in-loop
      await deleteSyncMeta(id);
      // `fromSync` marks this as a non-user delete so SyncProvider's delete
      // wiring doesn't echo it to the server as "the student deleted it" —
      // the copy is leaving THIS DEVICE, not the account.
      // eslint-disable-next-line no-await-in-loop
      await deleteProject(id, { fromSync: true });
    } catch (err) {
      console.warn(`sign-out: kept local copy of ${id} (cleanup failed)`, err);
    }
  }

  engine.reset();
}
