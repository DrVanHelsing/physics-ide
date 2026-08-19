/**
 * Sync metadata — deliberately OUTSIDE manifests so SCHEMA_VERSION stays 2.
 * One record per project: { ownerId, remoteUpdatedAt, lastPushedAt }.
 */
import localforage from "localforage";

const metaStore = localforage.createInstance({
  name: "physics-ide",
  storeName: "sync-meta",
});

const PREFIX = "sync-meta:";

export async function getSyncMeta(projectId) {
  const v = await metaStore.getItem(PREFIX + projectId);
  return v || null;
}

export async function setSyncMeta(projectId, meta) {
  await metaStore.setItem(PREFIX + projectId, {
    ownerId: meta.ownerId,
    remoteUpdatedAt: meta.remoteUpdatedAt,
    lastPushedAt: meta.lastPushedAt,
  });
}

export async function deleteSyncMeta(projectId) {
  await metaStore.removeItem(PREFIX + projectId);
}

export async function listSyncMeta() {
  const out = {};
  await metaStore.iterate((value, key) => {
    if (key.startsWith(PREFIX)) out[key.slice(PREFIX.length)] = value;
  });
  return out;
}

export async function _resetSyncMetaForTests() {
  await metaStore.clear();
}
