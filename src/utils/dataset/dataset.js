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
 * transform(ds, op) — phase-C will route through here for every block op.
 * For Phase A we expose it but only support a couple of ops.
 *
 *   op = { kind: 'select', columns: string[] }
 *   op = { kind: 'sort',   column: string, dir?: 'asc'|'desc' }
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
    default:
      return ds;
  }
}

/* ── Helpers used by chart blocks ──────────────────────────────────── */

export function numericColumns(ds) {
  return ds.columns.filter((c) => c.inferredType === "number").map((c) => c.name);
}

export function pickColumn(ds, colName) {
  return ds.rows.map((r) => r[colName]);
}
