import {
  fromBuiltin,
  fromCsvText,
  meanOfColumn,
  median,
  minOfColumn,
  maxOfColumn,
  sumOfColumn,
  stddevOfColumn,
  uniqueCount,
  mode,
  rangeOfColumn,
  countOfColumn,
  allStats,
  cellAt,
  filterRows,
  transform,
} from "../dataset/dataset.js";
import { getDataset, listDatasets } from "../dataset/datasetRegistry.js";

/* ── CSV file cache — persists across re-runs so the file dialog
   only opens once per cache key (variable name). Call clearCsvCache()
   to force a re-pick on the next run. ── */
const CSV_CACHE = new Map();

export function clearCsvCache(key) {
  if (key) CSV_CACHE.delete(key);
  else CSV_CACHE.clear();
}

function loadCsvFile(cacheKey) {
  if (CSV_CACHE.has(cacheKey)) return Promise.resolve(CSV_CACHE.get(cacheKey));
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) { resolve(null); return; }
      const text = await file.text();
      const ds = fromCsvText(text, { name: file.name });
      CSV_CACHE.set(cacheKey, ds);
      resolve(ds);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function loadSavedDataset(label) {
  const all = listDatasets();
  return all.find((ds) => ds.name === label) || getDataset(label) || null;
}

const DS_API = {
  fromBuiltin,
  loadCsvFile,
  loadSavedDataset,
  meanOfColumn, median, minOfColumn, maxOfColumn, sumOfColumn, stddevOfColumn,
  uniqueCount, mode, rangeOfColumn, countOfColumn, allStats, cellAt,
  filterRows, transform,
};

export async function runDsCode(jsCode) {
  if (!jsCode || !jsCode.trim()) return { outputs: [], error: null };

  const outputs = [];
  // eslint-disable-next-line no-new-func
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  try {
    const fn = new AsyncFunction("__ds", "__outputs", jsCode);
    await fn(DS_API, outputs);
    return { outputs, error: null };
  } catch (err) {
    console.warn("dsRunner error:", err);
    return { outputs, error: err.message };
  }
}
