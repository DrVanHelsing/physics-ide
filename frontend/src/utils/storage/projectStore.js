/**
 * Project store — Phase B.3.
 *
 * Multi-project library backed by localForage. The manifest itself stays in
 * `manifest:{id}`; the lightweight summary needed to render the start-menu
 * project list lives under a single `project-list` key so we don't have to
 * load every manifest on app startup.
 *
 * Dataset blobs (`dataset:{id}:rows`) and run-trace blobs (`run:{id}:trace`)
 * land in their own localForage stores so this one stays focused.
 *
 * No backend. No network. No auth. Per docs/product-contract.md.
 */

import localforage from "localforage";
import {
  isManifest,
  explainManifest,
  SCHEMA_VERSION,
} from "../manifest/schema";
import { migrate } from "../manifest/migrate";

const PROJECT_LIST_KEY = "project-list";
const MANIFEST_PREFIX = "manifest:";

const projectStore = localforage.createInstance({
  name: "physics-ide",
  storeName: "projects",
});

const datasetStore = localforage.createInstance({
  name: "physics-ide",
  storeName: "datasets",
});

const runStore = localforage.createInstance({
  name: "physics-ide",
  storeName: "runs",
});

/* ── List management ──────────────────────────────────────── */

function summarize(manifest) {
  return {
    id: manifest.id,
    title: manifest.title,
    goal: manifest.goal,
    projectType: manifest.projectType,
    updatedAt: manifest.updatedAt,
    createdAt: manifest.createdAt,
    thumbnail: manifest.thumbnail || null,
  };
}

export async function listProjects() {
  const list = (await projectStore.getItem(PROJECT_LIST_KEY)) || [];
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function writeList(list) {
  await projectStore.setItem(PROJECT_LIST_KEY, list);
}

async function upsertSummary(manifest) {
  const list = (await projectStore.getItem(PROJECT_LIST_KEY)) || [];
  const next = Array.isArray(list) ? list.filter((p) => p.id !== manifest.id) : [];
  next.push(summarize(manifest));
  await writeList(next);
}

async function removeSummary(id) {
  const list = (await projectStore.getItem(PROJECT_LIST_KEY)) || [];
  if (!Array.isArray(list)) return;
  await writeList(list.filter((p) => p.id !== id));
}

/* ── CRUD on individual projects ──────────────────────────── */

export async function loadProject(id) {
  if (!id) return null;
  const raw = await projectStore.getItem(MANIFEST_PREFIX + id);
  if (!raw) return null;
  const m = migrate(raw); // future-proof: re-migrate on read if a newer build saved an older shape
  if (!isManifest(m)) {
    throw new Error(`loadProject('${id}'): ${explainManifest(m) || "invalid manifest"}`);
  }
  return m;
}

export async function saveProject(manifest, opts = {}) {
  if (!isManifest(manifest)) {
    throw new Error(`saveProject: ${explainManifest(manifest) || "invalid manifest"}`);
  }
  const stamped = opts.preserveTimestamp
    ? { ...manifest }
    : { ...manifest, updatedAt: Date.now() };
  await projectStore.setItem(MANIFEST_PREFIX + stamped.id, stamped);
  await upsertSummary(stamped);
  return stamped;
}

export async function deleteProject(id) {
  if (!id) return;
  await projectStore.removeItem(MANIFEST_PREFIX + id);
  await removeSummary(id);
  // Clean up associated dataset and run blobs.
  await pruneStoreByPrefix(datasetStore, `dataset:`, (key) => key.includes(`:${id}:`) || keyOwnedByProject(key, id));
  await pruneStoreByPrefix(runStore, `run:`, (key) => keyOwnedByProject(key, id));
}

function keyOwnedByProject(_key, _projectId) {
  // Phase A datasets are stored under `dataset:{datasetId}:rows`, not keyed by
  // project. Until the dataset descriptor carries its parent project id, we
  // cannot safely delete cross-project data here — so we leave orphan blobs
  // alone. Phase C will add the parent linkage and a cleanup pass.
  return false;
}

async function pruneStoreByPrefix(store, prefix, predicate) {
  const keys = await store.keys();
  for (const key of keys) {
    if (typeof key === "string" && key.startsWith(prefix) && predicate(key)) {
      await store.removeItem(key);
    }
  }
}

/* ── Export / Import (JSON only in v1; ZIP lands in B / C) ─── */

export function exportProjectJson(manifest) {
  if (!isManifest(manifest)) {
    throw new Error(`exportProjectJson: ${explainManifest(manifest) || "invalid manifest"}`);
  }
  return JSON.stringify(manifest, null, 2);
}

export async function importProjectFromText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("importProject: not valid JSON");
  }
  const migrated = migrate(raw);
  if (!isManifest(migrated)) {
    throw new Error(`importProject: ${explainManifest(migrated) || "invalid manifest"}`);
  }
  return migrated;
}

/* ── Test-only helper ───────────────────────────────────────
 * Wipes every localForage store this module touches. Only call from tests.
 */
export async function _resetAllProjectStorageForTests() {
  await projectStore.clear();
  await datasetStore.clear();
  await runStore.clear();
}

/* ── Constants other modules need ───────────────────────────── */
export const STORE_KEYS = {
  PROJECT_LIST: PROJECT_LIST_KEY,
  MANIFEST_PREFIX,
  SCHEMA_VERSION,
};
