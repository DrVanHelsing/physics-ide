import {
  SCHEMA_VERSION,
  isManifest,
  isDatasetDescriptor,
  isRunSnapshot,
  isChartSpec,
  isColumn,
  explainManifest,
} from "../schema";
import { createManifest } from "../factory";

describe("manifest schema guards", () => {
  test("isManifest accepts a freshly built manifest", () => {
    const m = createManifest({ goal: "physics", title: "T1" });
    expect(isManifest(m)).toBe(true);
    expect(explainManifest(m)).toBeNull();
  });

  test.each([
    ["null", null],
    ["non-object", "not-an-object"],
    ["empty object", {}],
  ])("isManifest rejects %s", (_, value) => {
    expect(isManifest(value)).toBe(false);
  });

  test("isManifest rejects wrong schemaVersion", () => {
    const m = createManifest({ goal: "physics", title: "T1" });
    expect(isManifest({ ...m, schemaVersion: 1 })).toBe(false);
    expect(isManifest({ ...m, schemaVersion: SCHEMA_VERSION + 1 })).toBe(false);
  });

  test("isManifest rejects invalid goal / projectType / editor", () => {
    const m = createManifest({ goal: "physics", title: "T1" });
    expect(isManifest({ ...m, goal: "chemistry" })).toBe(false);
    expect(isManifest({ ...m, projectType: "weird" })).toBe(false);
    expect(isManifest({ ...m, preferredEditor: "voice" })).toBe(false);
  });

  test("isManifest rejects missing required arrays", () => {
    const m = createManifest({ goal: "datascience", title: "T2" });
    expect(isManifest({ ...m, datasets: null })).toBe(false);
    expect(isManifest({ ...m, runs: undefined })).toBe(false);
    expect(isManifest({ ...m, chartSpecs: "nope" })).toBe(false);
    expect(isManifest({ ...m, notes: 1 })).toBe(false);
  });

  test("isColumn enforces shape", () => {
    expect(isColumn({ name: "x", inferredType: "number" })).toBe(true);
    expect(isColumn({ name: "", inferredType: "number" })).toBe(false);
    expect(isColumn({ name: "x", inferredType: "weird" })).toBe(false);
    expect(isColumn(null)).toBe(false);
  });

  test("isDatasetDescriptor requires rows when rowCount > 0", () => {
    const base = {
      id: "ds-1",
      name: "Test",
      columns: [{ name: "t", inferredType: "number" }],
      provenance: "trace",
      rowCount: 2,
      qualityNotes: { missingCount: {}, cardinality: {}, numericRange: {} },
      source: {},
    };
    expect(isDatasetDescriptor({ ...base, rows: [{ t: 1 }, { t: 2 }] })).toBe(true);
    expect(isDatasetDescriptor({ ...base, rowsRef: "dataset:ds-1:rows" })).toBe(true);
    expect(isDatasetDescriptor({ ...base })).toBe(false); // neither rows nor rowsRef
  });

  test("isDatasetDescriptor allows empty datasets with rowCount=0", () => {
    expect(
      isDatasetDescriptor({
        id: "ds-empty",
        name: "Empty",
        columns: [],
        provenance: "trace",
        rowCount: 0,
        qualityNotes: { missingCount: {}, cardinality: {}, numericRange: {} },
        source: {},
      }),
    ).toBe(true);
  });

  test("isRunSnapshot requires id, label, startedAt, endedAt, and trace or traceRef", () => {
    const base = {
      id: "run-1",
      label: "Test run",
      notes: "",
      startedAt: 100,
      endedAt: 200,
      parameterSet: {},
    };
    expect(isRunSnapshot({ ...base, trace: [] })).toBe(true);
    expect(isRunSnapshot({ ...base, traceRef: "run:run-1:trace" })).toBe(true);
    expect(isRunSnapshot(base)).toBe(false);
    expect(isRunSnapshot({ ...base, id: "", trace: [] })).toBe(false);
  });

  test("isChartSpec requires id, type, datasetId, encodings", () => {
    const base = { id: "c1", type: "line", datasetId: "ds-1", encodings: { x: "t", y: "x" } };
    expect(isChartSpec(base)).toBe(true);
    expect(isChartSpec({ ...base, type: "pie" })).toBe(false);
    expect(isChartSpec({ ...base, datasetId: "" })).toBe(false);
    expect(isChartSpec({ ...base, encodings: null })).toBe(false);
  });

  test("explainManifest returns the first failing field name", () => {
    const m = createManifest({ goal: "physics", title: "T1" });
    expect(explainManifest({ ...m, goal: "chemistry" })).toMatch(/goal/);
    expect(explainManifest({ ...m, datasets: null })).toMatch(/datasets/);
    expect(explainManifest(null)).toMatch(/not an object/);
  });
});
