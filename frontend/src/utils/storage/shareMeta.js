/**
 * Share attribution sidecar — deliberately OUTSIDE manifests, mirroring
 * utils/storage/assignmentMeta.js exactly (same localforage instance, its
 * own store). One record per ACCEPTED COPY: { shareId, sharerId,
 * sharerName }. `sharerName` is a CACHE so the label renders offline
 * (design D§7) — the server never denormalises the name
 * (projects.attribution carries ids only, so §11 erasure acts in ONE
 * place) and refreshShareAttributions() re-resolves it whenever the
 * client is online. The manifest is never touched (contract D§2).
 */
import localforage from "localforage";

const metaStore = localforage.createInstance({
  name: "physics-ide",
  storeName: "share-meta",
});

const PREFIX = "share-meta:";

export async function getShareAttribution(projectId) {
  const v = await metaStore.getItem(PREFIX + projectId);
  return v || null;
}

export async function setShareAttribution(projectId, attribution) {
  await metaStore.setItem(PREFIX + projectId, {
    shareId: attribution.shareId,
    sharerId: attribution.sharerId,
    sharerName: attribution.sharerName,
  });
}

export async function deleteShareAttribution(projectId) {
  await metaStore.removeItem(PREFIX + projectId);
}

export async function listShareAttribution() {
  const out = {};
  await metaStore.iterate((value, key) => {
    if (key.startsWith(PREFIX)) out[key.slice(PREFIX.length)] = value;
  });
  return out;
}

export async function _resetShareMetaForTests() {
  await metaStore.clear();
}
