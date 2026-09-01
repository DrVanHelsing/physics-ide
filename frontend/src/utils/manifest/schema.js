/**
 * Manifest schema v2.
 *
 * One source of truth for the shape of a saved project. The full plan calls
 * this Phase B.2; the rest of the project store and ProjectContext (B.3, B.4)
 * are built on top of these types and guards.
 *
 * The schema is validated by hand-written guards rather than a runtime schema
 * library. Guards are conservative: they accept partial older shapes during
 * migration but reject obvious corruption (wrong type for `goal`, missing
 * `id`, etc.).
 */

export const SCHEMA_VERSION = 2;

export const GOALS = ["physics", "datascience", "hybrid"];
export const EDITOR_MODES = ["blocks", "code"];
export const PROJECT_TYPES = ["custom", "code_blank", "code_template", "block_template"];
export const PROVENANCES = ["builtin", "csv", "trace", "transformed"];
export const CHART_TYPES = ["bar", "line", "scatter", "histogram", "box"];
export const COLUMN_TYPES = ["number", "text", "boolean", "date"];

/* ── Shape guards (return boolean) ─────────────────────────────────── */

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export function isColumn(v) {
  if (!v || typeof v !== "object") return false;
  if (!isNonEmptyString(v.name)) return false;
  if (!COLUMN_TYPES.includes(v.inferredType)) return false;
  return true;
}

export function isDatasetDescriptor(v) {
  if (!v || typeof v !== "object") return false;
  if (!isNonEmptyString(v.id)) return false;
  if (!isNonEmptyString(v.name)) return false;
  if (!Array.isArray(v.columns) || !v.columns.every(isColumn)) return false;
  if (!PROVENANCES.includes(v.provenance)) return false;
  if (!isFiniteNumber(v.rowCount)) return false;
  // Either inline rows OR a ref — both being absent is invalid for non-empty datasets.
  const hasInline = Array.isArray(v.rows);
  const hasRef = isNonEmptyString(v.rowsRef);
  if (v.rowCount > 0 && !hasInline && !hasRef) return false;
  return true;
}

export function isRunSnapshot(v) {
  if (!v || typeof v !== "object") return false;
  if (!isNonEmptyString(v.id)) return false;
  if (!isNonEmptyString(v.label)) return false;
  if (!isFiniteNumber(v.startedAt)) return false;
  if (!isFiniteNumber(v.endedAt)) return false;
  // trace or traceRef — at least one. parameterSet may be empty object.
  const hasInline = Array.isArray(v.trace);
  const hasRef = isNonEmptyString(v.traceRef);
  if (!hasInline && !hasRef) return false;
  return true;
}

/**
 * Optional hybrid pairing: couples the simulation template with its matching
 * DS analysis template (see HYBRID_TOPICS). Absent on non-hybrid projects.
 */
export function isHybridPairing(v) {
  if (v == null) return true; // optional — absent is valid
  if (typeof v !== "object") return false;
  if (!isNonEmptyString(v.simId)) return false;
  if (!isNonEmptyString(v.analysisId)) return false;
  return true;
}

/**
 * Optional hybrid analyse stash (the data-loss hotfix): the simulation
 * workspace parked in the manifest while the analysis template occupies the
 * live workspace. Present only between "Analyse this run" and "Back to
 * Simulation". Validated so a malformed stash arriving via import or sync is
 * refused at the door rather than silently restoring an empty workspace —
 * the exact failure the stash exists to prevent. `preferredEditor` is
 * optional (stashes written before it was captured stay valid).
 */
export function isHybridStash(v) {
  if (v == null) return true; // optional — absent is valid
  if (typeof v !== "object") return false;
  if (typeof v.xml !== "string") return false;
  if (typeof v.python !== "string") return false;
  if (!PROJECT_TYPES.includes(v.projectType)) return false;
  if (v.preferredEditor != null && !EDITOR_MODES.includes(v.preferredEditor)) return false;
  return true;
}

export function isChartSpec(v) {
  if (!v || typeof v !== "object") return false;
  if (!isNonEmptyString(v.id)) return false;
  if (!CHART_TYPES.includes(v.type)) return false;
  if (!isNonEmptyString(v.datasetId)) return false;
  if (!v.encodings || typeof v.encodings !== "object") return false;
  return true;
}

export function isManifest(v) {
  if (!v || typeof v !== "object") return false;
  if (v.schemaVersion !== SCHEMA_VERSION) return false;
  if (!isNonEmptyString(v.id)) return false;
  if (!isNonEmptyString(v.title)) return false;
  if (!GOALS.includes(v.goal)) return false;
  if (!PROJECT_TYPES.includes(v.projectType)) return false;
  if (!EDITOR_MODES.includes(v.preferredEditor)) return false;
  /* No beginner-mode field. The beginner/advanced TOGGLE was removed long
     before this (toolbox.js header, docs/product-contract.md:17); its
     metadata was deleted in the Tranche-3 sweep. Walkthrough Mode
     (docs/product-contract.md:90) is a guided flow over BeginnerGuide.js,
     not a visibility filter — it will not want this field back. */
  if (!isFiniteNumber(v.createdAt)) return false;
  if (!isFiniteNumber(v.updatedAt)) return false;
  if (!v.workspace || typeof v.workspace !== "object") return false;
  if (!v.source || typeof v.source !== "object") return false;
  if (!Array.isArray(v.datasets) || !v.datasets.every(isDatasetDescriptor)) return false;
  if (!Array.isArray(v.runs) || !v.runs.every(isRunSnapshot)) return false;
  if (!Array.isArray(v.chartSpecs) || !v.chartSpecs.every(isChartSpec)) return false;
  if (!Array.isArray(v.notes)) return false;
  if (!v.checkpointState || typeof v.checkpointState !== "object") return false;
  if (!isHybridPairing(v.hybridPairing)) return false;
  if (!isHybridStash(v.hybridStash)) return false;
  return true;
}

/* ── A precise failure reason (useful for tests + dev tools) ──────── */

export function explainManifest(v) {
  if (!v || typeof v !== "object") return "not an object";
  if (v.schemaVersion !== SCHEMA_VERSION) return `schemaVersion ${v.schemaVersion} (expected ${SCHEMA_VERSION})`;
  if (!isNonEmptyString(v.id)) return "missing or empty id";
  if (!isNonEmptyString(v.title)) return "missing or empty title";
  if (!GOALS.includes(v.goal)) return `invalid goal '${v.goal}'`;
  if (!PROJECT_TYPES.includes(v.projectType)) return `invalid projectType '${v.projectType}'`;
  if (!EDITOR_MODES.includes(v.preferredEditor)) return `invalid preferredEditor '${v.preferredEditor}'`;
  if (!isFiniteNumber(v.createdAt)) return "createdAt must be a finite number";
  if (!isFiniteNumber(v.updatedAt)) return "updatedAt must be a finite number";
  if (!v.workspace || typeof v.workspace !== "object") return "workspace missing";
  if (!v.source || typeof v.source !== "object") return "source missing";
  if (!Array.isArray(v.datasets)) return "datasets must be an array";
  const badDs = v.datasets.findIndex((d) => !isDatasetDescriptor(d));
  if (badDs >= 0) return `datasets[${badDs}] is invalid`;
  if (!Array.isArray(v.runs)) return "runs must be an array";
  const badRun = v.runs.findIndex((r) => !isRunSnapshot(r));
  if (badRun >= 0) return `runs[${badRun}] is invalid`;
  if (!Array.isArray(v.chartSpecs)) return "chartSpecs must be an array";
  const badChart = v.chartSpecs.findIndex((c) => !isChartSpec(c));
  if (badChart >= 0) return `chartSpecs[${badChart}] is invalid`;
  if (!Array.isArray(v.notes)) return "notes must be an array";
  if (!v.checkpointState || typeof v.checkpointState !== "object") return "checkpointState must be an object";
  if (!isHybridPairing(v.hybridPairing)) return "hybridPairing must be { simId, analysisId } or absent";
  if (!isHybridStash(v.hybridStash)) return "hybridStash must be { xml, python, projectType, preferredEditor? } or absent";
  return null;
}
