/**
 * Phase A perf smoke — quick measurements outside the browser.
 *
 * Run: node scripts/phase-a-perf.mjs
 *
 * Replicates the fromTraceBuffer algorithm + exercises Arquero ops directly so
 * we get real numbers without dragging in CRA's build pipeline. Plot rendering
 * needs a DOM and is validated manually in the browser.
 */
import * as aq from "arquero";

/* Inlined copy of fromTraceBuffer (algorithm only) — keep in sync with
   src/utils/dataset/dataset.js if you change one. */
const NUMBER_RE = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
function inferTypeFromSample(s) {
  if (s === null || s === undefined || s === "") return "text";
  if (typeof s === "number") return "number";
  const str = String(s).trim();
  return NUMBER_RE.test(str) ? "number" : "text";
}
function coerce(v, type) {
  if (v === null || v === undefined || v === "") return null;
  if (type === "number") {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  }
  return String(v);
}
function fromTraceBuffer(buffer) {
  if (!buffer || buffer.length === 0) return { rows: [], columns: [] };
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
  const nameList = [...names];
  const types = {};
  for (const name of nameList) {
    const sample = buffer.find((r) => r.name === name);
    types[name] = inferTypeFromSample(sample ? sample.value : null);
  }
  const sortedTs = [...byT.keys()].sort((a, b) => a - b);
  const t0 = sortedTs[0];
  const last = Object.fromEntries(nameList.map((n) => [n, null]));
  const rows = sortedTs.map((t) => {
    for (const e of byT.get(t)) last[e.name] = coerce(e.value, types[e.name]);
    return { t: (t - t0) / 1000, ...last };
  });
  const columns = [{ name: "t", inferredType: "number" }, ...nameList.map((n) => ({ name: n, inferredType: types[n] }))];
  return { rows, columns, rowCount: rows.length };
}

/* Synthetic generator — long-format like the real trace recordBuffer. */
function synthTraceBuffer(rowsPerVar, varNames) {
  const buf = [];
  const tStart = Date.now();
  for (let i = 0; i < rowsPerVar; i++) {
    const t = tStart + i * 16;
    for (const name of varNames) {
      const value =
        name === "x" ? i * 0.05 :
        name === "y" ? 10 + i * 0.02 - 0.001 * i * i :
        name === "vx" ? 3 + Math.sin(i / 50) :
        2 + Math.cos(i / 50);
      buf.push({ t, name, value, delta: null, min: null, max: null });
    }
  }
  return buf;
}

function ms(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}
function now() {
  return process.hrtime.bigint();
}

/* Run scenarios at two scales to expose growth shape. */
for (const rowsPerVar of [1000, 2500, 10000]) {
  const vars = ["x", "y", "vx", "vy"];
  const totalLongRows = rowsPerVar * vars.length;
  console.log(`\n── ${totalLongRows} long-format rows (${rowsPerVar} timestamps × ${vars.length} vars) ──`);

  const buf = synthTraceBuffer(rowsPerVar, vars);

  let t = now();
  const ds = fromTraceBuffer(buf);
  console.log(`fromTraceBuffer pivot:         ${ms(t).toFixed(1)} ms  -> ${ds.rowCount} rows × ${ds.columns.length} cols`);

  t = now();
  const table = aq.from(ds.rows);
  console.log(`aq.from(rows):                 ${ms(t).toFixed(1)} ms`);

  t = now();
  const filt = table.filter((d) => d.t > 5);
  console.log(`Arquero filter (t > 5):        ${ms(t).toFixed(1)} ms  -> ${filt.numRows()} rows`);

  t = now();
  const grouped = table
    .derive({ bucket: (d) => Math.floor(d.t) })
    .groupby("bucket")
    .rollup({ mean_x: aq.op.mean("x"), mean_y: aq.op.mean("y"), n: aq.op.count() });
  console.log(`Arquero groupby+mean(x,y):     ${ms(t).toFixed(1)} ms  -> ${grouped.numRows()} groups`);

  t = now();
  const sorted = table.orderby(aq.desc("y"));
  sorted.numRows();
  console.log(`Arquero sort desc by y:        ${ms(t).toFixed(1)} ms`);

  t = now();
  let mx = 0,
    my = 0,
    n = 0;
  for (const r of ds.rows) {
    if (typeof r.x === "number") {
      mx += r.x;
      my += r.y;
      n++;
    }
  }
  console.log(`Plain JS mean x,y:             ${ms(t).toFixed(1)} ms  -> x=${(mx / n).toFixed(3)} y=${(my / n).toFixed(3)}`);
}
console.log("\nDone.");
