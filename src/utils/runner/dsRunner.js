import {
  fromBuiltin,
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
  filterRows,
  transform,
} from "../dataset/dataset.js";

const DS_API = {
  fromBuiltin,
  meanOfColumn, median, minOfColumn, maxOfColumn, sumOfColumn, stddevOfColumn,
  uniqueCount, mode, rangeOfColumn, countOfColumn,
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
