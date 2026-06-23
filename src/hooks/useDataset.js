/**
 * useDataset — phase-A loader hook.
 *
 * Reads a dataset by id from localForage. Phase A only ever stores under the
 * key 'dataset:{id}:rows' as a full Dataset object (rows + columns inline).
 * Phase C will split big row arrays into their own keys.
 */
import { useEffect, useState } from "react";
import localforage from "localforage";

const store = localforage.createInstance({ name: "physics-ide", storeName: "datasets" });

export function getDatasetStore() {
  return store;
}

export async function saveDataset(dataset) {
  await store.setItem(`dataset:${dataset.id}:rows`, dataset);
  return dataset;
}

export function useDataset(id) {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setDataset(null);
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    store
      .getItem(`dataset:${id}:rows`)
      .then((value) => {
        if (cancelled) return;
        setDataset(value || null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDataset(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { dataset, loading };
}
