## Revised Plan: Unified Physics + Data Science IDE (Browser-First, Free-Hosting-Native)

A unified classroom IDE with three project goals (Physics Modelling, Data Science, Hybrid) where blocks and code are editing modes inside each goal. Delivered as a browser-first single-page app with zero backend in the initial phases. Auth and any server-side services are explicitly deferred until a feature requires them.

This plan replaces the previous version. It keeps the original's product decisions (goal-first IA, no block duplication, hybrid as first-class, beginner toggle as cross-cutting) and discards the premature backend stack (NestJS + Postgres + Redis + BullMQ + FastAPI) that was incompatible with the free-hosting constraint.

---

## Progress (running ledger)

Branch: `phase-a-spike`. All work browser-only; no backend, no auth.

### ✅ Phase A — Vertical slice spike (commit `5eea239`)
- `src/utils/dataset/dataset.js` — `Dataset` shape + `fromTraceBuffer` (long→wide pivot, forward fill) + `filterRows` + `meanOfColumn` + `transform`.
- `src/utils/charts/plotRender.js` — line + scatter via Observable Plot; numeric columns force `type: "linear"` with `ticks: 8`, `tickFormat: ".3~f"`, `tickRotate: -30` (fix landed for the over-condensed x-axis the user surfaced).
- `src/components/ChartOverlay.js` — modal overlay, X/Y/type/title controls, SVG + PNG export.
- `src/hooks/useDataset.js` — localForage `saveDataset` + `useDataset(id)`.
- `src/components/TraceTable.js` — "Chart" action next to Rec.CSV.
- `src/components/DebugMode.js` — threads `onSaveAsDataset`.
- `src/components/layout/IDELayout.js` — owns chart-overlay state; mounts `ChartOverlay` in all three render branches.
- `src/styles.css` — overlay styles.
- `scripts/phase-a-perf.mjs` — Node smoke test.
- `docs/phase-a-eval.md` — Gate A pass: bundle +148.63 kB gz (target ≤ 200), Arquero ops on 10 k rows 1.3–4.9 ms (target < 200 ms), pivot 21.3 ms.

### ✅ Phase B.1 + B.2 — Product contract + manifest schema (commit `731ba5f`)
- `docs/product-contract.md` — locked decisions, exclusion list, Phase D/E deferral gates.
- `src/utils/manifest/schema.js` — `SCHEMA_VERSION = 2`, hand-written shape guards (`isManifest`, `isDatasetDescriptor`, `isRunSnapshot`, `isChartSpec`, `isColumn`, `explainManifest`).
- `src/utils/manifest/factory.js` — `createManifest()` with enum validation.
- `src/utils/manifest/migrate.js` — v2 passthrough, future-schema reject, legacy v1 wrap, `readLegacyV1` helper.
- 32 Jest cases. All green.

### ✅ Phase B.3 + B.4 + B.5 — Multi-project library + goal-first start menu (commit `6f2060b`)
- `src/utils/storage/projectStore.js` — localForage CRUD; manifest validated on every read/write; project summaries under one key; 12 tests (44 total green).
- `src/contexts/ProjectContext.js` — `activeProjectId`, `activeManifest`, `projectList`, `loaded`; bootstrap auto-migrates legacy `physics-lab-state-v1` localStorage on first run.
- `src/hooks/useProject.js` — bridges ProjectContext ↔ SimulationContext (`applyManifestToWorkingState`, `captureWorkingStateInto`, `selectProject`, `createNew`, `saveCurrent`).
- `src/components/StartMenu.js` — full rewrite: Continue (project list), three goal cards (Physics, Data Science, Hybrid), wizard panel (title, start path, editor, beginner, hybrid model/data-first).
- `src/App.js` — mounts `ProjectProvider` inside `SimulationProvider`.
- `src/components/layout/IDELayout.js` — threads useProject ops into StartMenu.
- Bundle delta vs B.2: main +4.51 kB gz, CSS +603 B gz. User browser-validated.

### ✅ Phase B.6 — Block registry (commit `3ba1d27`)
- `src/utils/blockly/blockRegistry.js` — canonical metadata for 67 blocks (`{id, category, domain, conceptLabel, keywords, beginnerVisible}`). One canonical category per block; `BY_ID` lookup; `getBlocksByCategory`, `getBlocksByDomain`, `getBlocksForGoal({beginnerEnabled})`; `BLOCK_CATALOGUE` (search index) built from registry; `findDuplicateIds`, `findUnknownIds`.
- `src/utils/blockly/blocklyGenerator.js` — 90-line manual `BLOCK_CATALOGUE` deleted; named export re-aliased to the registry.
- `scripts/check-block-registry.mjs` + `npm run check:blocks` — CI guard. Fails on duplicate ids or unregistered toolbox ids. Stock Blockly ids allowlisted. Current: 67 entries, 0 duplicates, 59 toolbox ids all present.
- `src/utils/blockly/__tests__/blockRegistry.test.js` — 10 cases mirror the CI script; suite total now 54 green.
- **Deferred to Phase C with DS blocks:** swap `TOOLBOX_XML` for a registry-generated XML (preserves shadow defaults and labels). Doing it without DS blocks in hand buys nothing.

### ⏳ Phase B.7 — Generator separation (rolled into Phase C)
- Per-domain generator files (`shared.js`, `physics.js`, `datascience.js`) and the registration loop land alongside DS generator additions. B.6's registry is the prerequisite and is in place.

### ✅ Phase B.8 — Capability-driven toolbar
- `src/components/Toolbar.js` — accepts `goal` prop (default `"physics"`). `showSimActions = goal === 'physics' || 'hybrid'` gates Run/Stop, Viewport toggle, Trace toggle, and Debug button. Global actions (Menu, Help, Reset, Beginner, Import, Export, Theme, Mode) stay visible across goals.
- `src/components/layout/IDELayout.js` — passes `goal` from `proj.activeManifest?.goal || 'physics'`.

### ✅ Phase B.9 — Layout primitives
- `src/components/DataPanel.js` — scaffold panel for the active project's datasets, with goal-aware empty states (DS goal: "load builtin / CSV"; hybrid goal: "record a run, then click Chart").
- `src/components/layout/IDELayout.js` — right pane swaps `GlowCanvas` for `DataPanel` when `goal === 'datascience'`. Physics + hybrid keep the 3D viewport.
- `src/styles.css` — DataPanel theming.

### ✅ Phase B.10 — Hosting
- `vercel.json` — CRA framework preset, SPA rewrite (`/(.*) → /index.html`), one-year immutable cache on `/static/*`.
- `DEPLOY.md` — Vercel and Cloudflare Pages procedures, CI smoke recipe, rollback notes, "no backend / no auth in v1" reinforcement.
- CI smoke flow (manual for now): `npm run check:blocks && CI=true npm test && npm run build` — all three pass on current HEAD.

### Phase C — Foundational DS + Hybrid

#### ✅ Phase C.2 — Dataset module + built-in datasets (commit `ca40524`)
- `src/utils/dataset/dataset.js` productionized. `transform(ds, op)` covers filter / limit / distinct / dropMissing / groupBy (count, mean, sum, min, max) on top of the existing select / sort. Statistical helpers: median, mode, min, max, range, sum, count, stddev (sample), uniqueCount, numericValues. `fromCsvText` parses quoted-comma CSV with type + missing-value inference. `fromBuiltin(id)` dynamic-imports JSON modules. `serializeDescriptor` splits inline vs `rowsRef` for the manifest.
- `src/utils/dataset/builtins/{planets.json, penguins.json, weather.json}` — planets 9 rows (NASA values), penguins 30-row teaching subset across three species, weather 28 rows (Cape Town vs Johannesburg, two winter weeks). All lazy-imported so physics-only projects never pay for them on first load.
- `src/utils/dataset/__tests__/dataset.test.js` — 32 cases. Suite total now 86 green.
- `src/setupTests.js` — polyfills TextDecoder / TextEncoder for jsdom (Arquero's flechette dep needs them).
- `package.json` — `jest.transformIgnorePatterns` whitelists Arquero, @uwdata, apache-arrow, @observablehq, internmap, d3-*.

#### ✅ Phase C.3 — DS runtime + vertical slice (commit `373ef9b`)
- `src/utils/runner/dsRunner.js` — JS sandbox via `new Function` with Arquero + dataset module in scope.
- `src/utils/blockly/dsGenerator.js` — JS code generator for DS blocks (separate from Python reveal generator).
- 3-block vertical slice: `ds_load_builtin_block`, `ds_show_table_block`, `ds_calc_mean_block`.
- `DataPanel.js` — table renderer wired to DS output events.
- Drag-end bug fixed: `generatePythonFromWorkspace` call moved out of the change listener critical path.

#### ✅ Phase C.4 — Stat + utility blocks (commit `36f5733`)
- 8 more DS blocks fully wired: median, min, max, sum, spread, show-first-N, count-rows, count-unique.
- Registry: 78 entries. Toolbox: 70 IDs.

#### ✅ Phase C.5 — Explore / Describe / Filter / Sort / Group blocks
- **3 generator fixes:** Python generators added for `ds_show_first_n_block`, `ds_count_rows_block`, `ds_count_unique_block`.
- **DataPanel:** now renders all table outputs (not just the first); stacked with labels when multiple tables are present.
- **Cat 2 remaining (4 blocks):** `ds_show_last_n_block`, `ds_count_cols_block`, `ds_list_cols_block`, `ds_show_column_block`.
- **Cat 3 remaining (3 blocks):** `ds_calc_mode_block`, `ds_calc_range_block`, `ds_calc_count_block`.
- **Cat 4 — Filter/Sort/Group (8 blocks):** `ds_filter_eq_block`, `ds_filter_gt_block`, `ds_filter_lt_block`, `ds_sort_asc_block`, `ds_sort_desc_block`, `ds_remove_missing_block`, `ds_group_count_block`, `ds_group_mean_block`.
- `dsRunner.js` extended: `mode`, `rangeOfColumn`, `countOfColumn` added to DS_API.
- Toolbox reorganised into four labelled sections: Load data / Explore / Statistics / Filter and Sort / Group and Compare.
- Registry: 93 entries. Toolbox: 85 IDs. Tests: 86 passing.

#### 🟡 Phase C.6+ — DS block implementations (remaining)

**Design decision pending:** DS block execution. The existing block flow (`generatePythonFromWorkspace` → `runPython` → GlowScript iframe) targets VPython — it does not work for DS blocks that operate on JS-side `Dataset` objects. Three options:

  1. **Generate JS and eval client-side** (recommended). DS blocks emit JS via a new `Blockly.JavaScript` generator namespace; the runtime executes that JS via the `Function` constructor inside a sandbox that exposes Arquero, the dataset module, and the built-in loaders. Same blocks also emit Python for the "Show generated Python" reveal (visualisation only — never executed). Lowest implementation cost, fits free-hosting (no extra runtime).
  2. **Pyodide in-browser.** Real Python execution for both physics and DS. ~10 MB runtime download. Heavy but unifies the model. Probably wrong for v1 given the bundle-size pressure.
  3. **Custom block-tree walker.** Skip code generation; interpret the workspace directly against the dataset module. Simplest mental model but loses the "Show generated Python" reveal pattern that the foundational doc treats as load-bearing.

Recommended path: option 1.

**Vertical-slice C.3 (next step):** 3-block proof of runtime, not the full 59 at once.
  - `load_builtin_dataset` (Cat 1) — picks penguins / weather / planets, outputs `dataset`.
  - `show_table` (Cat 2) — takes `dataset`, renders it in `DataPanel`.
  - `calc_mean` (Cat 3) — takes `dataset` + column name, outputs `number`.
  Plus the runtime scaffolding: `src/utils/runner/dsRunner.js`, a JS generator alongside the existing Python one, and a `DataPanel` table renderer.

If the slice works, the remaining 56 blocks are pattern repetition over the same infrastructure.

#### ⏳ Phase C.6+ — Remaining DS work
- **Remaining blocks:** Cat 5 charts (bar, line, scatter, histogram, box + axis/title/colour blocks), Cat 6 communication blocks (write-note, print-result, state-conclusion, export-table, save-chart), Cat 1 type blocks (identify-type, ask-type), Cat 4 missing-data find block, combined-filter (AND/OR) blocks, compare-two-columns, show-all-stats.
- Chart system: `chartSpec.js` + Plot bindings for all five foundational chart types (bar / line / scatter / histogram / box). Phase A handles line + scatter.
- Trace-to-dataset productionization: variable selection UI, time-window selector, `RunSnapshot` persistence, `RunComparisonView`.
- Template packs for DS and Hybrid.
- Guidance layer for beginner mode.
- Bundle import/export (JSON + lazy JSZip).
- Quality bar: tests, manual flows, perf budgets.

### Phases D + E — Deferred, no work in progress
- Both behind explicit triggers in `docs/product-contract.md`. Do not start.

---

### Hosting Strategy (locked)
- Frontend: static SPA hosted on Cloudflare Pages or Vercel (both free, generous limits, no cold starts on the critical path).
- Templates and built-in datasets: static JSON shipped with the build, served from the same CDN.
- Persistence: browser storage (localStorage / IndexedDB) + explicit file download/upload of project bundles. No database.
- Execution: client-side. GlowScript/VPython already runs in the browser; foundational DS runs on a JS table library (Arquero or equivalent) in the browser.
- Auth: not built. Not designed. Not stubbed. Deferred until a real feature requires it. See Phase D.
- Heavy compute: not introduced in this plan. If ever needed, a single serverless function or a Hugging Face Space can be added without touching the existing architecture.

### Success Outcomes (initial release)
- Students can create Physics, Data Science, or Hybrid projects from one goal-first start flow.
- Blocks have zero category duplication; discoverable by search and concept labels.
- A simulation run can be promoted into a dataset and charted without leaving the app.
- Foundational DS (six categories from [docs/foundational_ds_blocks.md](docs/foundational_ds_blocks.md)) is supported end to end in the browser.
- Built-in datasets work offline; CSV import works; CSV / chart / project bundle export works.
- Generated Python is hidden by default and revealed on demand.
- Beginner guidance is a universal toggle.
- The entire app loads, runs, and saves work without ever talking to a server.

### Non-Goals (initial release)
- No accounts, login, or any auth.
- No cloud save, no sharing via URL, no collaboration.
- No teacher dashboard or classroom orchestration.
- No machine learning, no joins across tables, no advanced statistics.
- No background jobs, no server-side execution, no Python worker.
- No microservices, no runtime strategy interface (concrete code only until a second runtime exists).

---

## Phase Overview

| Phase | Goal | Backend? | Auth? |
|---|---|---|---|
| **A** — Vertical slice spike | Prove trace → dataset → chart loop end-to-end | No | No |
| **B** — Foundations | Manifest, state refactor, block registry, goal-first menu | No | No |
| **C** — Foundational DS + Hybrid | DS block set, trace-to-dataset, hybrid templates | No | No |
| **D** — *Deferred* cloud save | Optional Supabase-backed save *if* user demand justifies it | Supabase only | Still no — anonymous keyed bundles |
| **E** — *Deferred* multi-user | Auth + sharing + classroom features, *only when* required | Yes | Yes |

Phases A–C are the initial release. D and E are explicitly out of scope until a feature need is documented and approved.

---

## Phase A — Vertical Slice Spike (1–2 weeks)

**Purpose:** prove the trace-to-dataset pedagogical loop before committing to any structural refactor. Done in a branch, throwaway-quality where needed. Output is a working demo and a written go/no-go on the data model.

**Steps**

1. Pick one existing physics example (projectile is simplest).
2. Hand-author a minimal manifest JSON for that one project (no schema validation, no migration yet).
3. Implement a one-button "Promote trace to dataset" action in [src/components/TraceTable.js](src/components/TraceTable.js) that takes the current trace and yields a table value (just a JS array of objects + column metadata).
4. Drop in a JS data library evaluation: try Arquero on a real trace; confirm filter / sort / group / mean run at trace-scale in the browser (target: 10k rows < 100ms for basic ops).
5. Implement one chart from a dataset using whichever charting lib comes out of the eval (Chart.js, Observable Plot, or Vega-Lite — pick the lightest that handles the foundational chart set).
6. Hand-author one "filter rows where" block and one "mean of column" block to feed the chart from the dataset.
7. Validate the loop with a real example: run the projectile sim → promote → filter to t > 1s → compute mean velocity → bar chart of velocity by phase.

**Gate:**
- The loop works on one example.
- Library choice is documented with bundle-size and performance numbers.
- A short decision doc states: dataset shape, supported column types, what the chart spec looks like.

If the gate fails (e.g., perf is bad, library doesn't fit), redesign before Phase B. Do not paper over.

---

## Phase B — Foundations (browser-only)

**Purpose:** lock the product contract, refactor state, and replace the start flow. No backend. No auth.

**Steps**

1. **Product contract and scope lock.** Document the locked decisions from the original plan (goals, modes, beginner toggle, foundational DS only, hybrid entry choice, no duplication). Lock the exclusion list.

2. **Project manifest schema (versioned JSON).**
   - Required fields: id, schemaVersion, title, goal (`physics` | `datascience` | `hybrid`), preferredEditor (`blocks` | `code`), beginnerEnabled, createdAt, updatedAt.
   - Authoring: workspaceXml, sourceCode (optional), generatedCode (optional snapshot).
   - Data: datasets[] (descriptor + inline rows for small built-ins, blob refs for larger), schema, provenance.
   - Simulation: runs[] (config, trace snapshot, label, notes).
   - Analysis: chartSpecs[], notes[].
   - Guidance: checkpointState.
   - Persistence is local: serialized to localStorage for the active project; exported as a single `.physide.json` bundle (or a `.zip` containing the JSON + any large blob datasets).
   - Ship one migration handler covering all existing local saves → schemaVersion 1. Include a real test fixture.

3. **State refactor.** Extend [src/contexts/SimulationContext.js](src/contexts/SimulationContext.js) and [src/contexts/TraceContext.js](src/contexts/TraceContext.js) to separate:
   - `projectGoal` vs `editorMode` vs `executionState`.
   - `datasetState` (datasets, active dataset id) vs `simulationState` (current run, history) vs `analysisState` (chart specs, notes).
   - `guidanceState` (beginner on/off, checkpoint progress).
   - Add stable selectors for: current goal, current workspace, current dataset, current run, current chart.
   - Keep the existing single-project local workflow; do not introduce multi-project state yet.

4. **Goal-first start menu.** Rewrite [src/components/StartMenu.js](src/components/StartMenu.js):
   - Primary cards: Physics, Data Science, Hybrid.
   - Secondary actions: Continue recent (from localStorage), Import bundle, Open template.
   - Project creation wizard: goal → start path (blank / template / import) → for hybrid only, entry path (model-first / data-first) → editor default → beginner on/off.

5. **Canonical block registry.** Introduce a single metadata-driven block registry replacing hardcoded XML in [src/components/BlocklyWorkspace.js](src/components/BlocklyWorkspace.js):
   - Each block entry: `id`, `category`, `domain` (`shared` | `physics` | `datascience` | `hybrid`), `conceptLabel`, `tooltip`, `inputs`, `output`, `beginnerVisible`, `generatorId`.
   - Toolbox XML is generated from the registry per goal and per beginner state.
   - Add a build-time check that fails if any block id appears in more than one category.
   - Search-first discovery: text search across labels, concept tags, tooltips.

6. **Canonical taxonomy.** Implement the categories from the original plan, anchored to the registry:
   - Shared: Variables and Types, Lists and Tables, Core Math and Comparison, Logic and Control, Output and Notes.
   - Physics: Scene and Objects, Motion and Forces, Simulation Control and Telemetry.
   - Data Science: the six categories from [docs/foundational_ds_blocks.md](docs/foundational_ds_blocks.md) (What is Data, Exploring, Describing, Asking Questions, Seeing Data, Communicating Findings).
   - Hybrid helpers: Trace to Dataset, Compare Runs, Parameter Sweep Summary.

7. **Layout and toolbar refresh.**
   - Persistent panels: authoring area, data panel, trace panel, output overlays.
   - Goal-specific defaults (physics → sim viewport prioritized, DS → data panel prioritized, hybrid → balanced).
   - Capability-driven toolbar in [src/components/Toolbar.js](src/components/Toolbar.js): each action declares which goals/runtimes it applies to; the toolbar renders the relevant subset.

8. **Hosting setup.** Configure deployment to Cloudflare Pages (or Vercel — both fit). Confirm production build, asset CDN, and that templates load offline once cached. Document the deploy procedure in a `DEPLOY.md`.

**Gate B:** manifest schema approved; registry contains all current physics blocks with zero duplication; goal-first menu works; app deploys to Cloudflare Pages and runs without any network calls after first load.

---

## Phase C — Foundational DS + Hybrid (browser-only)

**Purpose:** ship the foundational DS block set and the hybrid trace-to-dataset path. Still no backend, no auth.

**Steps**

9. **Block-level types (minimal).** Add type tags to registry entries used for connection validation:
   - `number`, `text`, `boolean`, `list`, `column`, `dataset`, `grouped-dataset`, `chart-spec`, plus the physics types already present (`vector`, `object-ref`).
   - Compatibility matrix lives in the registry; Blockly connection checks read from it.
   - No coercion engine in v1. Mismatches produce a beginner-friendly message ("a chart needs a dataset, not a number"). The full type system from the original plan (with coercion policy) is deferred.

10. **Dataset abstraction.** Implement a single `Dataset` shape used everywhere (built-in, CSV, trace-derived, transformed):
    - `columns` (name + inferred type + optional confirmed type), `rows`, `provenance`, `qualityNotes` (missing count, cardinality, numeric range), `displayPreferences`.
    - Built-in datasets: ship 3–5 small classroom-friendly tables as static JSON in the build (e.g. penguins-subset, weather-subset, planets). No network fetch.
    - CSV import: header inference, type inference, missing-value detection. Done in the browser.

11. **Foundational DS block implementations.** Build out the six categories from [docs/foundational_ds_blocks.md](docs/foundational_ds_blocks.md) on top of Arquero (or equivalent). Each block:
    - Operates on the `Dataset` shape.
    - Produces visible output on run (design principle #2 from the foundational doc).
    - Has a generator function that emits clean Python (revealed only on demand).
    - Has at least one unit test against a fixture dataset.

12. **Charts.** Implement the chart blocks (bar, line, scatter, histogram, box). Render in an overlay panel. Charts read a chart-spec object from the dataset; export to PNG via existing [src/utils/exportUtils.js](src/utils/exportUtils.js) patterns.

13. **Trace-to-dataset (productionize Phase A).**
    - "Save run as dataset" action in [src/components/TraceTable.js](src/components/TraceTable.js).
    - Variable / time-window selection UI.
    - Run metadata preserved (parameter set, label, notes).
    - Multi-run comparison view (side-by-side or overlaid traces).
    - Extend [src/hooks/useTrace.js](src/hooks/useTrace.js) to persist named runs into the manifest.

14. **Template packs.** Migrate [src/utils/blockTemplates.js](src/utils/blockTemplates.js) and [src/utils/precodedExamples.js](src/utils/precodedExamples.js) to metadata-based packs:
    - Physics: projectile, orbit, spring, pendulum.
    - DS: table orientation, basic stats, filter-and-group, chart choice, conclusion writing.
    - Hybrid: one parameter-sweep investigation, one trace-to-dataset analysis.
    - Each template carries goal, topic, level, estimated time, required concepts, expected outputs, and optional guided prompts.

15. **Import / export bundles.**
    - Export a project as `.physide.json` (or `.zip` if large dataset blobs are included).
    - Import: validate against manifest schema, run migration if older `schemaVersion`, replace current project (partial-merge is a v1.x decision; see Decisions below).
    - CSV export for datasets; PNG export for charts; existing PDF export (via [src/utils/pdfExport.js](src/utils/pdfExport.js)) continues to work.
    - Generated Python export remains an opt-in reveal/download.

16. **Guidance layer.** Implement beginner-mode behavior consistently across goals:
    - Prompt cards tied to current block / concept.
    - Recommended next-step suggestions surfaced inline.
    - Checkpoint state lives in the manifest.
    - Teacher dashboards stay out of scope; design the data shape so they can be added later without migration.

17. **Quality bar.**
    - Tests: block registry duplication check, manifest round-trip (export → import yields identical state), foundational DS unit tests per block, type-compatibility tests.
    - Manual classroom flows: one physics lesson, one DS lesson, one hybrid model-first, one hybrid data-first.
    - Performance: cold start under 3s on Cloudflare Pages, trace render smooth at 5k rows, dataset ops on 10k rows complete under 200ms.

**Gate C (release gate):**
- Zero duplicated blocks.
- All foundational DS blocks from the doc are implemented and pass tests.
- Trace-to-dataset → analysis → chart works end to end.
- Bundle round-trip works for all four flows above.
- App deployed to Cloudflare Pages, works offline after first load.
- No backend exists. No auth exists. No accounts exist.

Ship as v1.0.

---

## Phase D — Cloud Save (DEFERRED — do not start without a documented need)

Only begin Phase D if at least one of these is true and written down somewhere a future maintainer can find:
- Multiple users have explicitly asked for cross-device save.
- A classroom workflow has emerged that requires sharing project links.
- Bundle export/import is provably insufficient for the actual usage pattern.

**If green-lit:**
- Backend: Supabase free tier (Postgres + storage + 1GB). No NestJS service. No Redis. No queue.
- Anonymous-key model first: each browser generates a UUID kept in localStorage; cloud save is keyed off that UUID with no login. Sharing is via opaque URL token.
- Schema: one `projects` table storing the same manifest JSON used locally. No new data model.
- Replaces nothing — local save remains the default. Cloud is opt-in per project.
- No auth in Phase D. Auth is Phase E.

**Out of scope for Phase D:** anything that requires identity (multi-device same-user sync, collaboration, comments, classroom rosters).

---

## Phase E — Multi-User / Auth (DEFERRED — only when a feature requires identity)

Only begin Phase E when a specific feature requires it. Auth is not infrastructure to "set up early"; it is a feature with a cost.

Likely triggers (none committed):
- Teacher dashboards.
- Classroom rosters.
- Collaboration / comments.
- Cross-device same-user sync.

**If green-lit, the smallest version:** Supabase auth (email magic link or Google OAuth, whichever the actual users prefer). One `users` table linking auth ids to existing anonymous project keys (so anonymous work isn't lost on sign-in). No separate identity service. No role system until roles are needed.

---

## Block Inventory Mapping (Phase C deliverable)

Per the original plan, each foundational DS block from [docs/foundational_ds_blocks.md](docs/foundational_ds_blocks.md) must have a row in an inventory table tracking:
- `blockId`, `category`, `domain`, `conceptLabel`.
- `inputTypes`, `outputType`.
- `arqueroOpId` (or equivalent) — how it's implemented client-side.
- `pythonGeneratorId` — how it emits Python on reveal.
- `testFixtureId` — which fixture dataset exercises it.

This table is the canonical source for both registry entries and tests. Build it once in Phase C step 11 and keep it in `src/utils/blockly/dsRegistry.js` (or similar).

---

## Relevant files (grounded in the current codebase)

- [src/components/StartMenu.js](src/components/StartMenu.js) — replace with goal-first creator (Phase B step 4).
- [src/components/BlocklyWorkspace.js](src/components/BlocklyWorkspace.js) — toolbox generation from registry (Phase B step 5).
- [src/components/Toolbar.js](src/components/Toolbar.js) — capability-driven actions (Phase B step 7).
- [src/components/TraceTable.js](src/components/TraceTable.js) — trace-to-dataset entry point (Phase A, Phase C step 13).
- [src/components/DebugMode.js](src/components/DebugMode.js) — preserve debug strengths; expose analysis bridges.
- [src/contexts/SimulationContext.js](src/contexts/SimulationContext.js) — state separation (Phase B step 3).
- [src/contexts/TraceContext.js](src/contexts/TraceContext.js) — named runs, run history (Phase C step 13).
- [src/hooks/useSimulation.js](src/hooks/useSimulation.js) — goal-aware orchestration.
- [src/hooks/useTrace.js](src/hooks/useTrace.js) — trace persistence into manifest.
- [src/hooks/useLocalStorage.js](src/hooks/useLocalStorage.js) — manifest persistence layer.
- [src/utils/storage.js](src/utils/storage.js) — bundle import/export.
- [src/utils/blockly/blocklyGenerator.js](src/utils/blockly/blocklyGenerator.js) — typed generator contracts.
- [src/utils/blockly/traceRegistry.js](src/utils/blockly/traceRegistry.js) — extend for DS instrumentation hooks.
- [src/utils/blockTemplates.js](src/utils/blockTemplates.js) — metadata-based template packs (Phase C step 14).
- [src/utils/precodedExamples.js](src/utils/precodedExamples.js) — align code templates with goal taxonomy.
- [src/utils/runner/glowRunner.js](src/utils/runner/glowRunner.js) — keep as the physics runner; no abstraction wrapper yet.
- [src/utils/exportUtils.js](src/utils/exportUtils.js), [src/utils/pdfExport.js](src/utils/pdfExport.js) — extend for CSV / PNG / bundle export.
- [docs/foundational_ds_blocks.md](docs/foundational_ds_blocks.md) — authoritative DS scope.
- [docs/Physics_Data_Science_Integration_Vision.md](docs/Physics_Data_Science_Integration_Vision.md) — product vision alignment.

New files to introduce:
- `src/utils/blockly/blockRegistry.js` — canonical metadata registry.
- `src/utils/blockly/dsRegistry.js` — DS block inventory table.
- `src/utils/dataset/dataset.js` — `Dataset` shape + helpers (Arquero adapter).
- `src/utils/manifest/schema.js` — manifest schema + migrations + validators.
- `src/utils/charts/chartSpec.js` — chart spec shape + render adapters.
- `DEPLOY.md` — Cloudflare Pages / Vercel deployment notes.

---

## Verification

1. Phase A: trace-to-dataset → filter → chart works on the projectile example end-to-end.
2. Goal-first creation flow works for all three goals with both editor defaults and beginner toggle.
3. No block appears in more than one category (enforced by build-time check).
4. Every foundational DS block has a registry entry, an implementation, a generator, and at least one passing test.
5. Hybrid flows work end-to-end for model-first and data-first starts.
6. Bundle round-trip (export → import) produces an identical project across all four flows.
7. Generated Python reveal works on demand and remains hidden by default.
8. App loads, runs, and saves work fully offline after first load on Cloudflare Pages.
9. Cold start under 3s; trace render smooth at 5k rows; dataset ops on 10k rows under 200ms.
10. No HTTP requests to any non-CDN origin during normal use.

---

## Decisions (locked unless re-opened)

- Initial release is browser-only. No backend. No auth. No accounts.
- Hosting target is Cloudflare Pages or Vercel (free static SPA hosting). No always-on servers.
- Persistence is localStorage + downloadable bundles. No cloud save until Phase D is justified.
- Auth is a Phase E feature, not infrastructure. It will not be designed, stubbed, or "made future-ready" before then.
- Foundational DS scope is fixed to the six categories in [docs/foundational_ds_blocks.md](docs/foundational_ds_blocks.md).
- DS execution runs in the browser on a JS table library (Arquero or equivalent chosen in Phase A). No Python service.
- Charts use a single library chosen in Phase A based on bundle size and the foundational chart set.
- Menu IA is project-goal-first.
- Block duplication is disallowed and enforced at build time.
- Hybrid is a first-class goal.
- Beginner guidance is cross-cutting and non-forking.
- No runtime strategy interface until a concrete second runtime exists. Until then, modelling stays in [src/utils/runner/glowRunner.js](src/utils/runner/glowRunner.js) and DS ops live in dataset/chart modules — both called directly from the relevant block generators.
- Block-level type system is minimal (connection validation only). No coercion engine in v1.
- Bundle import is full-replace in v1. Partial merge is a v1.x consideration.
- Built-in datasets ship inline with the build, not fetched at runtime.

---

## Risks and mitigations

- **Risk:** Arquero or chosen chart lib doesn't meet performance targets in Phase A.
  - **Mitigation:** Phase A is a real gate. If the library doesn't fit, swap before committing. Worst case: write minimal table ops directly (filter/sort/group/aggregate are ~100 lines of vanilla JS each).
- **Risk:** Bundle size grows past acceptable limits when adding a chart lib + table lib + Blockly + GlowScript.
  - **Mitigation:** Measure in Phase A. Prefer lighter libs (Chart.js over Vega-Lite if the chart set allows). Code-split DS modules so physics-only projects don't pay for them on first load.
- **Risk:** localStorage quota (~5–10MB) is too small for projects with large trace histories or datasets.
  - **Mitigation:** Move dataset and trace blobs to IndexedDB; keep manifest metadata in localStorage. Use IndexedDB before quota becomes a problem (Phase B step 2).
- **Risk:** Block sprawl resurfaces over time.
  - **Mitigation:** Registry is the only path to add a block. CI duplication check blocks regressions.
- **Risk:** Bundle import partial-merge ambiguity (full replace might frustrate users who want to merge a dataset into an existing project).
  - **Mitigation:** Ship full-replace in v1 with a clear confirmation dialog. Revisit in v1.x with one concrete user workflow as the spec.
- **Risk:** Pressure to add auth "just in case" for future classroom features.
  - **Mitigation:** This document locks auth to Phase E. Re-open the decision with a written feature need, not a vague "we might need it."

---

## What changed vs the previous plan

- **Removed:** NestJS + Fastify, PostgreSQL, Redis, BullMQ, FastAPI Python worker, eight-service backend, auth model, runtime strategy interface, capability contract abstraction, block-level type coercion engine.
- **Deferred (with explicit gates):** cloud save, auth, multi-user, teacher features, second runtime, full type system.
- **Added:** Phase A vertical-slice spike before any refactor, hosting target lock to a free static CDN, explicit zero-backend rule for v1, library choice gated on real measurements.
- **Kept:** goal-first IA, no block duplication, hybrid as first-class, beginner toggle as cross-cutting, shared dataset abstraction, trace-to-dataset pipeline, canonical block registry, manifest schema with versioning, foundational DS scope as defined in the docs.

---

## Further considerations (to revisit, not to act on now)

1. When (and only when) Phase D is greenlit, decide between Supabase, Cloudflare D1 + R2, or PocketBase based on the actual feature spec at that time. Do not pre-decide.
2. Manual table entry block — defer to v1.1 unless Phase C user testing surfaces it as critical.
3. Bundle partial-merge behavior — spec in v1.x with one concrete workflow.
4. Whether the "Show generated Python" reveal should also offer "copy as Jupyter notebook" — defer.
