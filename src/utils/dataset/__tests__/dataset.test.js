/**
 * Tests for the productionized dataset module (Phase C.2).
 */

import {
  fromTraceBuffer,
  fromCsvText,
  fromBuiltin,
  BUILTIN_IDS,
  filterRows,
  meanOfColumn,
  median,
  mode,
  minOfColumn,
  maxOfColumn,
  rangeOfColumn,
  sumOfColumn,
  countOfColumn,
  stddevOfColumn,
  uniqueCount,
  numericColumns,
  pickColumn,
  columnNames,
  transform,
  serializeDescriptor,
} from "../dataset";

function fixture() {
  return {
    id: "fx-1",
    name: "fixture",
    columns: [
      { name: "name", inferredType: "text" },
      { name: "value", inferredType: "number" },
      { name: "group", inferredType: "text" },
    ],
    rows: [
      { name: "a", value: 1, group: "x" },
      { name: "b", value: 2, group: "x" },
      { name: "c", value: 3, group: "y" },
      { name: "d", value: 4, group: "y" },
      { name: "e", value: 5, group: "y" },
    ],
    rowCount: 5,
    provenance: "trace",
    source: {},
    qualityNotes: { missingCount: {}, cardinality: {}, numericRange: {} },
  };
}

describe("fromTraceBuffer", () => {
  test("pivots long-format trace rows to wide-format dataset", () => {
    const t0 = 1_700_000_000_000;
    const buf = [
      { t: t0,      name: "x", value: 1 },
      { t: t0,      name: "y", value: 10 },
      { t: t0 + 16, name: "x", value: 2 },
      { t: t0 + 16, name: "y", value: 20 },
      { t: t0 + 32, name: "x", value: 3 },
    ];
    const ds = fromTraceBuffer(buf, { name: "demo" });
    expect(ds.rowCount).toBe(3);
    expect(columnNames(ds)).toEqual(["t", "x", "y"]);
    expect(ds.rows[0].t).toBe(0);
    expect(ds.rows[1].t).toBeCloseTo(0.016);
    expect(ds.rows[2].y).toBe(20); // forward-filled from row 1
  });

  test("returns empty dataset on empty input", () => {
    const ds = fromTraceBuffer([], { name: "empty" });
    expect(ds.rowCount).toBe(0);
    expect(ds.rows).toEqual([]);
  });
});

describe("statistical helpers", () => {
  test("meanOfColumn computes the arithmetic mean", () => {
    expect(meanOfColumn(fixture(), "value")).toBe(3);
  });
  test("median picks the middle value (odd count)", () => {
    expect(median(fixture(), "value")).toBe(3);
  });
  test("median averages the two middles (even count)", () => {
    const ds = fixture();
    ds.rows.push({ name: "f", value: 6, group: "z" });
    ds.rowCount = 6;
    expect(median(ds, "value")).toBe(3.5);
  });
  test("mode returns the most frequent value", () => {
    const ds = fixture();
    expect(mode(ds, "group")).toBe("y");
  });
  test("min, max, range, sum, count", () => {
    const ds = fixture();
    expect(minOfColumn(ds, "value")).toBe(1);
    expect(maxOfColumn(ds, "value")).toBe(5);
    expect(rangeOfColumn(ds, "value")).toBe(4);
    expect(sumOfColumn(ds, "value")).toBe(15);
    expect(countOfColumn(ds, "value")).toBe(5);
  });
  test("stddev of {1,2,3,4,5} (sample) ≈ 1.5811", () => {
    expect(stddevOfColumn(fixture(), "value")).toBeCloseTo(1.5811, 3);
  });
  test("uniqueCount", () => {
    expect(uniqueCount(fixture(), "group")).toBe(2);
    expect(uniqueCount(fixture(), "name")).toBe(5);
  });
  test("returns null on empty / non-numeric columns where appropriate", () => {
    const empty = { ...fixture(), rows: [], rowCount: 0 };
    expect(meanOfColumn(empty, "value")).toBeNull();
    expect(median(empty, "value")).toBeNull();
    expect(stddevOfColumn(empty, "value")).toBeNull();
  });
});

describe("transform", () => {
  test("filter '> 2' keeps rows above threshold", () => {
    const out = transform(fixture(), { kind: "filter", column: "value", op: ">", value: 2 });
    expect(out.rowCount).toBe(3);
    expect(out.rows.every((r) => r.value > 2)).toBe(true);
  });
  test("filter '=' on text column", () => {
    const out = transform(fixture(), { kind: "filter", column: "group", op: "=", value: "y" });
    expect(out.rowCount).toBe(3);
  });
  test("limit head", () => {
    const out = transform(fixture(), { kind: "limit", n: 2, from: "head" });
    expect(out.rowCount).toBe(2);
    expect(out.rows[0].name).toBe("a");
  });
  test("limit tail", () => {
    const out = transform(fixture(), { kind: "limit", n: 2, from: "tail" });
    expect(out.rowCount).toBe(2);
    expect(out.rows[1].name).toBe("e");
  });
  test("distinct on group", () => {
    const out = transform(fixture(), { kind: "distinct", column: "group" });
    expect(out.rowCount).toBe(2);
  });
  test("dropMissing", () => {
    const ds = fixture();
    ds.rows.push({ name: "f", value: null, group: "z" });
    ds.rowCount = 6;
    const out = transform(ds, { kind: "dropMissing", column: "value" });
    expect(out.rowCount).toBe(5);
  });
  test("groupBy count", () => {
    const out = transform(fixture(), { kind: "groupBy", column: "group", agg: "count" });
    expect(out.rowCount).toBe(2);
    const byGroup = Object.fromEntries(out.rows.map((r) => [r.group, r.count]));
    expect(byGroup).toEqual({ x: 2, y: 3 });
  });
  test("groupBy mean", () => {
    const out = transform(fixture(), { kind: "groupBy", column: "group", agg: "mean", valueColumn: "value" });
    expect(out.rowCount).toBe(2);
    const byGroup = Object.fromEntries(out.rows.map((r) => [r.group, r.mean_value]));
    expect(byGroup.x).toBe(1.5);
    expect(byGroup.y).toBe(4);
  });
  test("sort desc", () => {
    const out = transform(fixture(), { kind: "sort", column: "value", dir: "desc" });
    expect(out.rows.map((r) => r.value)).toEqual([5, 4, 3, 2, 1]);
  });
  test("select", () => {
    const out = transform(fixture(), { kind: "select", columns: ["name", "value"] });
    expect(columnNames(out)).toEqual(["name", "value"]);
  });
});

describe("filterRows + helpers", () => {
  test("filterRows with predicate", () => {
    const out = filterRows(fixture(), (r) => r.value % 2 === 1);
    expect(out.rowCount).toBe(3);
  });
  test("numericColumns / pickColumn / columnNames", () => {
    expect(numericColumns(fixture())).toEqual(["value"]);
    expect(pickColumn(fixture(), "value")).toEqual([1, 2, 3, 4, 5]);
    expect(columnNames(fixture())).toEqual(["name", "value", "group"]);
  });
});

describe("fromCsvText", () => {
  test("parses a basic CSV with header inference", () => {
    const csv = "name,value,group\na,1,x\nb,2,x\nc,3,y";
    const ds = fromCsvText(csv);
    expect(ds.rowCount).toBe(3);
    expect(columnNames(ds)).toEqual(["name", "value", "group"]);
    expect(ds.rows[0]).toEqual({ name: "a", value: 1, group: "x" });
    expect(ds.provenance).toBe("csv");
  });
  test("handles quoted commas inside fields", () => {
    const csv = 'name,note\nalice,"hello, world"\nbob,plain';
    const ds = fromCsvText(csv);
    expect(ds.rows[0].note).toBe("hello, world");
  });
  test("treats empty / NA / null as missing", () => {
    const csv = "x,y\n1,\n2,NA\n3,null\n4,5";
    const ds = fromCsvText(csv);
    expect(ds.rows.map((r) => r.y)).toEqual([null, null, null, 5]);
  });
  test("returns empty dataset on empty input", () => {
    expect(fromCsvText("").rowCount).toBe(0);
  });
});

describe("fromBuiltin", () => {
  test("BUILTIN_IDS exposes the three datasets", () => {
    expect(BUILTIN_IDS).toEqual(expect.arrayContaining(["planets", "penguins", "weather"]));
  });
  test("loads planets and returns a valid Dataset", async () => {
    const ds = await fromBuiltin("planets");
    expect(ds.rowCount).toBeGreaterThan(0);
    expect(ds.provenance).toBe("builtin");
    expect(ds.source.builtinId).toBe("planets");
    expect(numericColumns(ds)).toEqual(expect.arrayContaining(["mass_earth", "radius_km", "period_days", "distance_au", "moons"]));
    // Sanity: Earth is in the table with mass ~1.0
    const earth = ds.rows.find((r) => r.name === "Earth");
    expect(earth).toBeDefined();
    expect(earth.mass_earth).toBe(1.0);
  });
  test("loads penguins with the expected species distribution", async () => {
    const ds = await fromBuiltin("penguins");
    expect(ds.rowCount).toBeGreaterThanOrEqual(20);
    const species = new Set(ds.rows.map((r) => r.species));
    expect(species.has("Adelie")).toBe(true);
    expect(species.has("Chinstrap")).toBe(true);
    expect(species.has("Gentoo")).toBe(true);
  });
  test("rejects unknown ids", async () => {
    await expect(fromBuiltin("not_a_dataset")).rejects.toThrow(/unknown/);
  });
});

describe("serializeDescriptor", () => {
  test("inlines rows when count is under the limit", () => {
    const out = serializeDescriptor(fixture(), { inlineLimit: 10 });
    expect(Array.isArray(out.rows)).toBe(true);
    expect(out.rowsRef).toBeUndefined();
  });
  test("emits rowsRef when count exceeds the limit", () => {
    const big = { ...fixture(), rowCount: 2000 };
    const out = serializeDescriptor(big, { inlineLimit: 1000 });
    expect(out.rows).toBeUndefined();
    expect(out.rowsRef).toBe("dataset:fx-1:rows");
  });
});
