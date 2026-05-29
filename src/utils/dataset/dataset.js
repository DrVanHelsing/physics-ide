/**
 * Dataset — phase-A minimal implementation.
 *
 * A Dataset is the unified shape consumed by foundational DS blocks and chart
 * blocks. In this spike we only build the slice needed for trace -> chart:
 *   - fromTraceBuffer: long-format trace -> wide-format dataset (one row per t)
 *   - filterRows / meanOfColumn: enough to feed the demo
 *
 * Arquero is used for the table operations. We keep the wrapper thin: blocks
 * call into `transform(ds, op)` etc., and the dataset shape is the contract.
 */
import * as aq from "arquero";

/* ── Shape (informal — JSDoc) ──────────────────────────────────────────
 *
 *   Dataset {
 *     id, name, columns, rows, rowCount, provenance, source, qualityNotes
 *   }
 *   Column { name, inferredType: 'number'|'text'|'boolean'|'date' }
 *   Row    { [colName]: value }
 *   QualityNotes { missingCount: {col: n}, cardinality: {col: n}, numericRange?: {col: [lo, hi]} }
 */

const NUMBER_RE = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;

function inferTypeFromSample(sample) {
  if (sample === null || sample === undefined || sample === "") return "text";
  if (typeof sample === "number") return "number";
  if (typeof sample === "boolean") return "boolean";
  const s = String(sample).trim();
  if (NUMBER_RE.test(s)) return "number";
  if (s === "true" || s === "false") return "boolean";
  return "text";
}

function coerce(value, type) {
  if (value === null || value === undefined || value === "") return null;
  if (type === "number") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? null : n;
  }
  if (type === "boolean") return value === true || value === "true";
  return String(value);
}

function profile(rows, columns) {
  const missingCount = {};
  const cardinality = {};
  const numericRange = {};
  for (const col of columns) {
    let missing = 0;
    const distinct = new Set();
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) {
      const v = r[col.name];
      if (v === null || v === undefined || v === "") {
        missing++;
        continue;
      }
      distinct.add(v);
      if (col.inferredType === "number") {
        const n = typeof v === "number" ? v : parseFloat(v);
        if (!Number.isNaN(n)) {
          if (n < lo) lo = n;
          if (n > hi) hi = n;
        }
      }
    }
    missingCount[col.name] = missing;
    cardinality[col.name] = distinct.size;
    if (col.inferredType === "number" && lo !== Infinity) {
      numericRange[col.name] = [lo, hi];
    }
  }
  return { missingCount, cardinality, numericRange };
}

/* ── Construction ──────────────────────────────────────────────────── */

function emptyDataset(provenance = "trace", opts = {}) {
  return {
    id: opts.id || `ds-${Date.now()}`,
    name: opts.name || "Empty dataset",
    columns: [],
    rows: [],
    rowCount: 0,
    provenance,
    source: opts.source || {},
    qualityNotes: { missingCount: {}, cardinality: {}, numericRange: {} },
  };
}

/**
 * fromTraceBuffer(buffer, opts)
 *
 * Buffer rows look like: { t, name, value, delta, min, max }.
 * Multiple variables may share a `t` (batched). Pivot to wide:
 *   - One row per unique `t` (normalized to seconds from start).
 *   - One column per unique variable name.
 *   - Forward-fill missing variable values across timestamps so chart blocks
 *     can render a continuous line.
 */
export function fromTraceBuffer(buffer, opts = {}) {
  if (!buffer || buffer.length === 0) return emptyDataset("trace", opts);

  // Group rows by timestamp without an O(n^2) filter.
  const byT = new Map();
  const names = new Set();
  for (const r of buffer) {
    names.add(r.name);
    let bucket = byT.get(r.t);
    if (!bucket) {
      bucket = [];
      byT.set(r.t, bucket);
    }
    bucket.push(r);
  }

  // Infer per-variable type from the first non-empty sample.
  const nameList = [...names];
  const types = {};
  for (const name of nameList) {
    const sample = buffer.find((r) => r.name === name && r.value !== undefined && r.value !== "");
    types[name] = inferTypeFromSample(sample ? sample.value : null);
  }

  // Build rows in sorted-t order with forward fill.
  const sortedTs = [...byT.keys()].sort((a, b) => a - b);
  const t0 = sortedTs[0];
  const lastValues = Object.fromEntries(nameList.map((n) => [n, null]));
  const rows = sortedTs.map((t) => {
    for (const entry of byT.get(t)) {
      lastValues[entry.name] = coerce(entry.value, types[entry.name]);
    }
    return { t: (t - t0) / 1000, ...lastValues };
  });

  const columns = [
    { name: "t", inferredType: "number" },
    ...nameList.map((name) => ({ name, inferredType: types[name] })),
  ];

  return {
    id: opts.id || `trace-${Date.now()}`,
    name: opts.name || "Recorded run",
    columns,
    rows,
    rowCount: rows.length,
    provenance: "trace",
    source: { runId: opts.runId, ...(opts.source || {}) },
    qualityNotes: profile(rows, columns),
  };
}

/* ── Operations (thin Arquero wrappers) ────────────────────────────── */

function toAq(ds) {
  return aq.from(ds.rows);
}

function fromAq(table, base, opts = {}) {
  const rows = table.objects();
  const columns = table.columnNames().map((name) => {
    const existing = base.columns.find((c) => c.name === name);
    if (existing) return existing;
    const sample = rows.find((r) => r[name] !== null && r[name] !== undefined && r[name] !== "");
    return { name, inferredType: inferTypeFromSample(sample ? sample[name] : null) };
  });
  return {
    ...base,
    id: opts.id || `${base.id}-x${Date.now().toString(36).slice(-4)}`,
    name: opts.name || base.name,
    columns,
    rows,
    rowCount: rows.length,
    provenance: "transformed",
    source: { parentDatasetId: base.id, ops: [...(base.source?.ops || []), opts.op].filter(Boolean) },
    qualityNotes: profile(rows, columns),
  };
}

export function filterRows(ds, predicate) {
  if (!ds || ds.rowCount === 0) return ds;
  const out = ds.rows.filter(predicate);
  const columns = ds.columns;
  return {
    ...ds,
    id: `${ds.id}-flt${Date.now().toString(36).slice(-4)}`,
    rows: out,
    rowCount: out.length,
    columns,
    provenance: "transformed",
    source: { parentDatasetId: ds.id, ops: [...(ds.source?.ops || []), "filter"] },
    qualityNotes: profile(out, columns),
  };
}

export function meanOfColumn(ds, colName) {
  if (!ds || ds.rowCount === 0) return null;
  let sum = 0;
  let count = 0;
  for (const r of ds.rows) {
    const v = r[colName];
    const n = typeof v === "number" ? v : parseFloat(v);
    if (!Number.isNaN(n) && n !== null) {
      sum += n;
      count++;
    }
  }
  return count > 0 ? sum / count : null;
}

/**
 * transform(ds, op) — single entry point all DS block ops route through.
 *
 *   op = { kind: 'select',    columns: string[] }
 *   op = { kind: 'sort',      column: string, dir?: 'asc'|'desc' }
 *   op = { kind: 'filter',    column: string, op: '='|'>'|'<'|'>='|'<='|'!=', value: any }
 *   op = { kind: 'groupBy',   column: string, agg: 'count'|'mean'|'sum'|'min'|'max', valueColumn?: string }
 *   op = { kind: 'limit',     n: number, from: 'head'|'tail' }
 *   op = { kind: 'distinct',  column: string }
 *   op = { kind: 'dropMissing', column: string }
 */
export function transform(ds, op) {
  if (!ds || ds.rowCount === 0) return ds;
  const t = toAq(ds);
  switch (op.kind) {
    case "select":
      return fromAq(t.select(op.columns), ds, { op: `select(${op.columns.join(",")})` });
    case "sort": {
      const dir = op.dir === "desc" ? aq.desc(op.column) : op.column;
      return fromAq(t.orderby(dir), ds, { op: `sort(${op.column}${op.dir === "desc" ? " desc" : ""})` });
    }
    case "filter": {
      const out = filterByComparison(ds.rows, op.column, op.op || "=", op.value);
      return fromAq(aq.from(out), ds, { op: `filter(${op.column} ${op.op} ${stringify(op.value)})` });
    }
    case "limit": {
      const n = Math.max(0, op.n | 0);
      const out = op.from === "tail" ? ds.rows.slice(-n) : ds.rows.slice(0, n);
      return fromAq(aq.from(out), ds, { op: `${op.from === "tail" ? "tail" : "head"}(${n})` });
    }
    case "distinct": {
      const seen = new Set();
      const out = [];
      for (const r of ds.rows) {
        const v = r[op.column];
        if (!seen.has(v)) {
          seen.add(v);
          out.push(r);
        }
      }
      return fromAq(aq.from(out), ds, { op: `distinct(${op.column})` });
    }
    case "dropMissing": {
      const out = ds.rows.filter((r) => {
        const v = r[op.column];
        return v !== null && v !== undefined && v !== "";
      });
      return fromAq(aq.from(out), ds, { op: `dropMissing(${op.column})` });
    }
    case "groupBy":
      return aggregateGroupBy(ds, op);
    default:
      return ds;
  }
}

function filterByComparison(rows, column, comparator, value) {
  const numericValue = typeof value === "number" ? value : parseFloat(value);
  const valueIsNumeric = !Number.isNaN(numericValue) && value !== null && value !== "";
  return rows.filter((r) => {
    const cell = r[column];
    if (cell === null || cell === undefined || cell === "") return false;
    if (valueIsNumeric && typeof cell === "number") {
      switch (comparator) {
        case "=":  return cell === numericValue;
        case "!=": return cell !== numericValue;
        case ">":  return cell >  numericValue;
        case "<":  return cell <  numericValue;
        case ">=": return cell >= numericValue;
        case "<=": return cell <= numericValue;
        default:   return false;
      }
    }
    switch (comparator) {
      case "=":  return String(cell) === String(value);
      case "!=": return String(cell) !== String(value);
      case ">":  return String(cell) >  String(value);
      case "<":  return String(cell) <  String(value);
      case ">=": return String(cell) >= String(value);
      case "<=": return String(cell) <= String(value);
      default:   return false;
    }
  });
}

function aggregateGroupBy(ds, op) {
  const groups = new Map();
  for (const r of ds.rows) {
    const key = r[op.column];
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { key, rows: [] };
      groups.set(key, bucket);
    }
    bucket.rows.push(r);
  }
  const agg = op.agg || "count";
  const valueCol = op.valueColumn;
  const outRows = [];
  for (const { key, rows } of groups.values()) {
    let v;
    if (agg === "count") v = rows.length;
    else if (valueCol) {
      const nums = rows
        .map((r) => (typeof r[valueCol] === "number" ? r[valueCol] : parseFloat(r[valueCol])))
        .filter((n) => Number.isFinite(n));
      if (nums.length === 0) v = null;
      else if (agg === "mean") v = nums.reduce((s, n) => s + n, 0) / nums.length;
      else if (agg === "sum")  v = nums.reduce((s, n) => s + n, 0);
      else if (agg === "min")  v = Math.min(...nums);
      else if (agg === "max")  v = Math.max(...nums);
      else v = null;
    } else {
      v = null;
    }
    outRows.push({ [op.column]: key, [`${agg}${valueCol ? "_" + valueCol : ""}`]: v });
  }
  const newColumns = [
    { name: op.column, inferredType: inferTypeFromSample(outRows[0]?.[op.column]) },
    { name: `${agg}${valueCol ? "_" + valueCol : ""}`, inferredType: "number" },
  ];
  return {
    ...ds,
    id: `${ds.id}-gb${Date.now().toString(36).slice(-4)}`,
    columns: newColumns,
    rows: outRows,
    rowCount: outRows.length,
    provenance: "transformed",
    source: { parentDatasetId: ds.id, ops: [...(ds.source?.ops || []), `groupBy(${op.column} ${agg})`] },
    qualityNotes: profile(outRows, newColumns),
  };
}

function stringify(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

/* ── Statistical helpers (used directly by the Describing-Data blocks) ── */

export function numericValues(ds, colName) {
  const out = [];
  for (const r of ds.rows) {
    const v = r[colName];
    const n = typeof v === "number" ? v : parseFloat(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function median(ds, colName) {
  const nums = numericValues(ds, colName).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

export function mode(ds, colName) {
  if (!ds || ds.rowCount === 0) return null;
  const counts = new Map();
  for (const r of ds.rows) {
    const v = r[colName];
    if (v === null || v === undefined || v === "") continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let bestValue = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  }
  return bestValue;
}

export function minOfColumn(ds, colName) {
  const nums = numericValues(ds, colName);
  return nums.length === 0 ? null : Math.min(...nums);
}

export function maxOfColumn(ds, colName) {
  const nums = numericValues(ds, colName);
  return nums.length === 0 ? null : Math.max(...nums);
}

export function rangeOfColumn(ds, colName) {
  const lo = minOfColumn(ds, colName);
  const hi = maxOfColumn(ds, colName);
  return lo === null || hi === null ? null : hi - lo;
}

export function sumOfColumn(ds, colName) {
  const nums = numericValues(ds, colName);
  return nums.length === 0 ? null : nums.reduce((s, n) => s + n, 0);
}

export function countOfColumn(ds, colName) {
  return numericValues(ds, colName).length;
}

export function stddevOfColumn(ds, colName) {
  const nums = numericValues(ds, colName);
  if (nums.length < 2) return null;
  const m = nums.reduce((s, n) => s + n, 0) / nums.length;
  const v = nums.reduce((s, n) => s + (n - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

export function uniqueCount(ds, colName) {
  const seen = new Set();
  for (const r of ds.rows) {
    const v = r[colName];
    if (v !== null && v !== undefined && v !== "") seen.add(v);
  }
  return seen.size;
}

/* ── CSV import ───────────────────────────────────────────────────────
 * Plain-JS CSV parser. Handles quoted fields with embedded commas and
 * escaped quotes. Recognises empty / "NA" / "null" as missing. Header
 * row is required (first non-empty line).
 */

const MISSING_TOKENS = new Set(["", "NA", "na", "N/A", "n/a", "null", "NULL", "None"]);

function parseCsvText(text) {
  const rows = [];
  let cur = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { buf += '"'; i++; }
        else inQuotes = false;
      } else {
        buf += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cur.push(buf);
      buf = "";
    } else if (ch === "\n") {
      cur.push(buf);
      buf = "";
      rows.push(cur);
      cur = [];
    } else if (ch === "\r") {
      // ignore CR; LF terminates the line
    } else {
      buf += ch;
    }
  }
  if (buf.length > 0 || cur.length > 0) {
    cur.push(buf);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

export function fromCsvText(text, opts = {}) {
  const grid = parseCsvText(String(text || ""));
  if (grid.length === 0) return emptyDataset("csv", opts);
  const headers = grid[0].map((h) => String(h).trim());
  const bodyRaw = grid.slice(1);

  // Type inference per column: scan the first N non-missing samples.
  const sampleLimit = 100;
  const types = headers.map((_, colIdx) => {
    let votes = { number: 0, boolean: 0, text: 0 };
    let scanned = 0;
    for (let r = 0; r < bodyRaw.length && scanned < sampleLimit; r++) {
      const raw = bodyRaw[r][colIdx];
      if (raw === undefined || MISSING_TOKENS.has(String(raw).trim())) continue;
      scanned++;
      votes[inferTypeFromSample(String(raw).trim())]++;
    }
    if (votes.number >= votes.text && votes.number >= votes.boolean) return "number";
    if (votes.boolean > votes.text) return "boolean";
    return "text";
  });

  const rows = bodyRaw.map((rowCells) => {
    const obj = {};
    headers.forEach((h, i) => {
      const raw = rowCells[i];
      if (raw === undefined || MISSING_TOKENS.has(String(raw).trim())) {
        obj[h] = null;
      } else {
        obj[h] = coerce(String(raw).trim(), types[i]);
      }
    });
    return obj;
  });

  const columns = headers.map((name, i) => ({ name, inferredType: types[i] }));
  return {
    id: opts.id || `csv-${Date.now()}`,
    name: opts.name || opts.originalFilename || "Imported CSV",
    columns,
    rows,
    rowCount: rows.length,
    provenance: "csv",
    source: { originalFilename: opts.originalFilename || null },
    qualityNotes: profile(rows, columns),
  };
}

/* ── Built-in datasets ────────────────────────────────────────────────
 * The data ships inline as JSON modules so they are cache-friendly and
 * available offline. fromBuiltin lazy-imports so a physics-only project
 * never pulls them into the first-load bundle.
 */

const BUILTIN_LOADERS = {
  planets:  () => import("./builtins/planets.json"),
  penguins: () => import("./builtins/penguins.json"),
  weather:  () => import("./builtins/weather.json"),
};

export const BUILTIN_IDS = Object.keys(BUILTIN_LOADERS);

export async function fromBuiltin(id, opts = {}) {
  const loader = BUILTIN_LOADERS[id];
  if (!loader) throw new Error(`fromBuiltin: unknown id '${id}'`);
  const module = await loader();
  const raw = module.default || module;
  if (!Array.isArray(raw.columns) || !Array.isArray(raw.rows)) {
    throw new Error(`fromBuiltin('${id}'): JSON missing columns or rows`);
  }
  const columns = raw.columns.map((c) => ({ name: c.name, inferredType: c.inferredType || "text" }));
  return {
    id: opts.id || `builtin-${id}-${Date.now().toString(36).slice(-4)}`,
    name: opts.name || raw.name || id,
    columns,
    rows: raw.rows,
    rowCount: raw.rows.length,
    provenance: "builtin",
    source: { builtinId: id },
    qualityNotes: profile(raw.rows, columns),
  };
}

/* ── Serialization (inline vs rowsRef split for the manifest) ───────── */

const INLINE_ROW_LIMIT = 1000;

export function serializeDescriptor(ds, { inlineLimit = INLINE_ROW_LIMIT } = {}) {
  const base = {
    id: ds.id,
    name: ds.name,
    columns: ds.columns,
    provenance: ds.provenance,
    source: ds.source || {},
    qualityNotes: ds.qualityNotes,
    rowCount: ds.rowCount,
  };
  if (ds.rowCount <= inlineLimit) {
    return { ...base, rows: ds.rows };
  }
  return { ...base, rowsRef: `dataset:${ds.id}:rows` };
}

export function hydrateDescriptor(descriptor, rowsResolver) {
  if (Array.isArray(descriptor.rows)) {
    return { ...descriptor, rows: descriptor.rows };
  }
  if (descriptor.rowsRef && typeof rowsResolver === "function") {
    const rows = rowsResolver(descriptor.rowsRef);
    return { ...descriptor, rows };
  }
  return { ...descriptor, rows: [] };
}

/* ── Helpers used by chart blocks ──────────────────────────────────── */

export function numericColumns(ds) {
  return ds.columns.filter((c) => c.inferredType === "number").map((c) => c.name);
}

export function pickColumn(ds, colName) {
  return ds.rows.map((r) => r[colName]);
}

export function columnNames(ds) {
  return ds.columns.map((c) => c.name);
}

export function toCsvText(ds) {
  if (!ds || !ds.columns || !ds.rows) return "";
  const headers = ds.columns.map((c) => c.name);
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.map(esc).join(","),
    ...ds.rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ];
  return lines.join("\n");
}
