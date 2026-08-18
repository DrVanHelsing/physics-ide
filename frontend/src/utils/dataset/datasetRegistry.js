/**
 * datasetRegistry — module-level store for promoted/runtime datasets.
 *
 * Datasets created from trace records or CSV at runtime are registered here
 * so that DS blocks can load them by name without touching localForage
 * (which is async and unavailable inside the AsyncFunction sandbox).
 */

const REGISTRY = new Map(); // id → Dataset

export function registerDataset(dataset) {
  if (dataset && dataset.id) REGISTRY.set(dataset.id, dataset);
}

export function getDataset(id) {
  return REGISTRY.get(id) || null;
}

export function listDatasets() {
  return Array.from(REGISTRY.values());
}

export function removeDataset(id) {
  REGISTRY.delete(id);
}

export function clearRegistry() {
  REGISTRY.clear();
}
