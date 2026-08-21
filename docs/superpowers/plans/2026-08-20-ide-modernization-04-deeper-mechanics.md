# IDE Modernization — Plan 4: Deeper Mechanics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tranche 3 of the IDE deep review delivered as mechanics: the toolbox stops shipping blocks that exist in no drawer and drawers that exist in no registry — enforced in CI, both directions — and the debugger stops lying. Debug stops being a separate world a student escapes into and becomes a mode of the shell: a docked trace table beside the normal viewport, step/record folded into the header the student already knows. And every place the debugger currently asserts something false — a Pause that flips before the runtime stops, a breakpoint that can be set on a block that can never fire, an error that surfaces as `Execution error: Runtime error: …` with 300 characters of compiled JavaScript — is made truthful. (The palette, theme, rail, and all three dependency bundlings shipped in Plan 3 — this plan consumes them.)

**Architecture:** The block registry is re-categorised so its 19 block-bearing categories are exactly the toolbox's 19 block-bearing categories — the Data Science drawer splits into the ten pipeline sub-drawers the registry already modelled and never used — and `check-block-registry.mjs` is extended to enforce that correspondence in both directions. Downstream colour consumers (pane-header accents, help-page tags, start-menu badges, landing-page particles) start reading the `--cat-*` custom properties Plan 3 put in `styles/tokens.css`. On the debug side, `DebugMode.js` is deleted outright: its trace column becomes the already-written-but-unused `.debug-drawer` docked beside `GlowCanvas`, its control group fills the reserved `trace`/`debug` slots in Plan 3's `visibleControls()`, and the ~38 parallel `.dm-*` CSS rules go with it (one-file surgery on `styles/debug.css`). The runtime gains a `__phpause` acknowledgement message, a breakable-id publication, pre-`eval` breakpoint seeding, per-iteration stepping, and a pure `describeRunError` helper under `utils/`. Colour, theme, rail and bundling are Plan 3's — consumed here through `blockPalette.js`, `blocklyTheme.js` and `blocklyLib.js`.

**Tech Stack:** React 18 + Vite, plain JavaScript frontend, Vitest 4. **No new dependencies — the approved bundles (`blockly@11.2.2`, `monaco-editor@0.45.0`, six vendored GlowScript/jQuery files) landed in Plan 3.** No state library, no CSS framework, no preprocessor, no type-coercion engine (`docs/product-contract.md:39` rules it out), no websockets.

**Spec:** [docs/superpowers/reviews/2026-08-19-ide-deep-review.md](../reviews/2026-08-19-ide-deep-review.md) — "Suggested modernization roadmap → Tranche 3 — Deeper mechanics", plus the proposal tables in *Block Toolbox & Blocks* and *Debug Experience* that carry the evidence, and open questions 3, 4, 5 and 6 (all four now answered — see Global Constraints). Contract references: [docs/product-contract.md](../../product-contract.md) §36 (hat blocks + disable-orphans), §39 (minimal type system), §90 (Walkthrough Mode), §101 (offline after first load), §107 (no non-CDN origins after first load).

**Depends on:** [Plan 1 — Visual Foundation](2026-08-20-ide-modernization-01-visual-foundation.md) (the `--space-*`/`--fs-*`/`--radius-*`/`--label-*` token system, the `.btn`/`.card`/`.panel-header` primitives and the `:focus-visible` ring this plan builds on), [Plan 2 — Interaction Upgrades](2026-08-20-ide-modernization-02-interaction-upgrades.md) (the zoned 44px header and the `renderHelpers.js` component-test harness), and [Plan 3 — MakeCode Overhaul](2026-08-21-ide-modernization-03-makecode-overhaul.md) (the bundled Blockly/Monaco, the vendored GlowScript, the palette/theme/rail, the split stylesheet, and the reserved header slots this plan's debug group fills — see the consumed-interface table below). **All three land first; nothing here may start before they do.**

**Citation convention — read this before cutting any range.** Every line number in this plan was re-verified against `feature/classroom-platform` at `771bc1e` and supersedes the review's, which were taken at `10f8a9d`. But `771bc1e` is *before Tranche 2 runs*, and Plan 2 rewrites, wholesale, several of the files this plan edits most invasively. Plan 2 established the convention "cite selectors in `styles.css`, not line numbers"; this plan extends it to JavaScript:

> **Every line number in this plan is a PRE-TRANCHE-2 locator.** It is there to identify *which* code is meant — never to be cut blindly by offset. At implementation time, re-resolve it by **selector, function name, component name, prop name or JSX element**. The files Plan 2 moves or rewrites, and where the offsets will therefore be wrong: `IDELayout.js` (Tasks 3, 4, 7, 10, 11, 12, 13, 14, 15, 16), `Toolbar.js` (Tasks 7 and 9 replace the entire returned tree), `GlowCanvas.js` (Tasks 14, 15, 16), `useSimulation.js` (Task 16 rewrites `handleRun`), `useDebug.js`, `BlocklyWorkspace.js` (Task 13), `glowRunner.js` (Tasks 8, 14, 15), `styles.css` (Plan 1 and Plan 2 both), `vite.config.mjs` (Plan 2 Task 1). Where this plan cites `styles.css:NNN` it means "the rule with that selector", exactly as Plans 1 and 2 do — and since Plan 3's split, that rule lives in one of the eleven `styles/*.css` files (debug work: `debug.css`/`workspace.css`). Plan 3 additionally rewrote `Toolbar.js`'s render tree (`visibleControls`), `BlocklyWorkspace.js`'s theme/inject region, and `CodeEditor.js`'s loader — re-resolve citations into those files against the post-Plan-3 shapes named in the consumed-interface table below.

## Consumed interface from Tranche 2 (Interaction Upgrades)

Plan 2's completion criteria names what it hands to this tranche. These are the *post-Tranche-2* shapes this plan edits; when a step below quotes a pre-Tranche-2 line number in one of these files, the identifier named here is the real locator.

| Consumed from Plan 2 | The shape this plan edits |
|---|---|
| **Task 1** — the Vitest transform | `frontend/vite.config.mjs`, the `mode === "test"` branch carrying the oxc shim, inserted immediately before `optimizeDeps`. Task 1 below **extends** that branch; it does not create it, and the file is `.mjs`, not `.js`. |
| **Task 2** — the component-probe layer | `frontend/src/test/renderHelpers.js` exporting `mountComponent` / `click` / `keyDown` / `byText` / `byTitle`, plus `frontend/src/components/__tests__/Toolbar.test.js`. **This is the component-probe layer this plan extends.** New component suites go beside them under `__tests__/`, never in a new directory. |
| **Task 7** — the merged 44px header | `<header className="app-header">` holding `.app-header__identity` and three zones: `app-header__zone--primary` (Run/Stop/mode), `--view` (zoom, viewport, trace, debug), `--file` (save, workspace, File menu). Group dividers are `<span className="app-header__sep" />`. **The debug group belongs in `--view`.** |
| **Task 7** — the account chip | `Toolbar` now renders `<HeaderAccount />`, which calls `useMe()` (TanStack Query) and `useNavigate()` (router). Every suite that mounts `Toolbar` must carry `vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));` — Plan 2's own suites do. |
| **Task 8** — the quiet status bar | `GLOWSCRIPT_VERSION` is exported from `glowRunner.js`, interpolated into the three versioned script URLs, and rendered as `VPython {GLOWSCRIPT_VERSION}` in the status bar. **Task 2 below preserves the export**; `viewportTheme.test.js` asserts it is `"3.2"`. |
| **Task 9** — the two-stage collapse | The `secondaryActions` array (`viewport`, `trace`, `debug`, `reset`, `clear`, `help`), rendered as inline buttons below stage 2 and as `DropdownMenu` items at stage 2. The Trace toggle is an **entry in that array**, not inline JSX at `Toolbar.js:256-268`. |
| **Task 9, Step 3** — the preserved Trace toggle | The `onToggleTrace` / `traceVisible` props and the `.tb-btn--active` rule, deliberately kept unwired *because this plan supplies the handler*. **Task 17, Step 3a below supplies it.** |
| **Tasks 11 / 13** — explicit block insertion | `handleInsertStarterBlock` (`IDELayout.js`, the empty-state starter chips) and `insertBlock` (`BlocklyWorkspace.js`, block search). Both read `window.Blockly` — Task 1 below rewrites them — and both currently rely on `normalizeSimulationStructure` adopting the result into SETUP, which **Task 10 below replaces with an explicit attach**. |
| **Task 14** — the runtime surface | `VIEWPORT_THEME`, `viewportStyleText`, `getRuntimeWindow`, `getRuntimeCanvas`, `applyRuntimeTheme`, `resizeRuntimeCanvas`, `captureRuntimeCanvas`, `getSceneMeta` — all capability-checked. **Task 2, Step 4 below closes Plan 2 Task 14's explicit `scene.background` handoff.** |
| **Tasks 15 / 16** — the viewport shell | `GlowCanvas({ running, booting, onStatus })`: `booting` renders the boot spinner over the idle layer, `onStatus` is how `ViewportControls` reports a failed camera action. `.canvas-caption` renders below the canvas; `ViewportControls` sits inside `.canvas-viewport`. **Task 17 adds `children` and nothing else to that signature.** |
| **Task 16** — the rewritten `handleRun` | `useSimulation.js`'s `handleRun` now sets `booting` around `await runPython(code, GLOWSCRIPT_HOST_ID)`. Tasks 13, 14 and 16 below edit *that* function — find it by name — and add the third `opts` argument (`{ breakpoints, watch }`) to the call it already makes. |
| **Task 3** — the save handler | `handleSaveProject` in `IDELayout.js` (Ctrl+S and the header Save button both call it). Task 17's `<Toolbar>` prop list adds the debug props beside it without touching it. |

## Consumed interface from Plan 3 (MakeCode Overhaul)

Plan 3 lands first. These are the post-Plan-3 shapes this plan's tasks edit:

| Consumed from Plan 3 | The shape this plan edits |
|---|---|
| **Task 1** — the CSS split | `frontend/src/styles.css` is an `@import` manifest over `styles/{tokens,base,chrome,workspace,viewport,debug,pages,datapanel,primitives,platform,responsive}.css`. "styles.css: the rule with selector X" now means "the split file carrying that selector" — debug work lives in `debug.css` and `workspace.css`. |
| **Task 2** — `blocklyLib.js` | `frontend/src/utils/blockly/blocklyLib.js` default-exports the bundled namespace (`Blockly.Python` attached). No `window.Blockly` remains; new code imports the module. |
| **Task 5** — `blockPalette.js` v2 | The palette API Tasks 5/7/8 consume, plus `brightFor` and `STYLE_CATEGORY_ALIASES` (`Starter`/`Scene`) — Task 4's re-categorisation retires both aliases; delete them from `blockPalette.js` when it does. |
| **Task 6** — `blocklyTheme.js` | `getBlocklyTheme(isDark)` (Zelos-based, palette-driven, cached) and `gridColourFor(isDark)`. The inline `buildBlocklyTheme` in `BlocklyWorkspace.js` is gone. |
| **Task 8** — the rail | Toolbox categories carry `categorystyle`; rows are decorated with `--cat`/`--cat-bright`; `tokens.css` owns the `--cat-*` block, sync-tested. |
| **Task 9** — the trashcan | `WorkspaceTrash` + a Blockly delete area own deletion; the stock trashcan is off (`trashcan: false`). Debug decorations must not collide with `.workspace-trash*`. |
| **Task 10** — `visibleControls()` | `utils/toolbar/visibleControls.js` returns the header's zone lists; **the reserved `trace` and `debug` keys in the `view` zone are the slots Task 17 Step 3 fills** — their visibility rule (hidden while `runState === "idle"`) already ships; supply handlers, do not re-derive visibility in JSX. |
| **Task 11** — `WorkspaceZoom` | The on-canvas zoom cluster sits bottom-right of the blocks pane; the header zoom slider no longer exists. |
| **Task 12** — the boot atom | `.canvas-idle--booting` is the boot indicator; `.canvas-booting*` no longer exists — do not cite it. |
| **Task 13** — run lifecycle | Every import/load path routes through `endRun`; `useRuntimeReady` replaces the twin scene polls; `SimulationContext`'s value is memoised. |


## Global Constraints

- **Blockly bundling: DELIVERED IN PLAN 3 (its Task 2).** `blocklyLib.js` is the sole entry point (`Blockly.Python` attached, media vendored). This plan must not reintroduce `window.Blockly` reads or CDN tags.
- **GlowScript self-hosting: DELIVERED IN PLAN 3 (its Task 3).** Six files under `frontend/public/vendor/glowscript/` with provenance; `docs/product-contract.md:101` is already true — keep it true.
- **Monaco: BUNDLED IN PLAN 3 (its Tasks 4 and 14)** — `monaco-editor@0.45.0` exact behind a dynamic import, physics themes from the palette, `<textarea>` fallback intact. Task 14 Step 6 below edits the post-Plan-3 `CodeEditor.js`: the namespace lives on a `monacoRef`, not `window.monaco`.
- **NO other new dependencies.** `html2canvas`, `jspdf`, `arquero`, `@observablehq/plot`, `localforage` and `qrcode` are already installed and may be used; nothing else may be added. Note `blockly@11.2.2` itself declares one runtime dependency, `jsdom@25.0.1` — the frontend already carries `jsdom@^25.0.1` as a devDependency, so this adds no second copy and no decision.
- **The block palette is Plan 3's vivid v2** (review open Q4, settled twice: redesign, then re-saturated at equal AA depth). `BLOCK_PALETTE` remains the single source for category *and* block colour; red stays reserved for errors and debug highlights; AA and the 340°–15° exclusion are test-enforced in Plan 3's suite. The v1 table formerly specified in Task 3 is superseded — cite categories by name and take values from `blockPalette.js`.
- **Debug is a MODE OF THE SHELL, not a separate world** (review open Q5, settled). `DebugMode.js` is deleted. The docked `TraceTable` sits beside the normal viewport in the already-written `.debug-drawer`; step/record fold into the main `Toolbar`; the parallel `.dm-*` vocabulary is retired. Teachers who built lessons on the full-screen overlay get a strictly better workflow (edit and step without a context switch), and the review's own count of "~25 duplicate CSS rules" is an undercount — it is **38 rules at `styles.css:1531-1761`**, plus 4 Blockly decoration rules at `:839-857` which are kept and renamed.
- **DELETE the dead beginner-mode metadata** (review open Q6, settled: remove now, git preserves it). `beginnerVisible` on every registry entry, the `beginnerEnabled` option on `getBlocksForGoal`, the manifest field (`manifest/factory.js:47,80`, `manifest/migrate.js:73`) and the two schema rules (`manifest/schema.js:96,120`) all go. **Walkthrough Mode (`docs/product-contract.md:90`) rebuilds this deliberately later** as a guided flow over `BeginnerGuide.js`, not as a visibility filter — it is not blocked by this deletion.
- **The manifest schema version does NOT change.** Removing `beginnerEnabled` is a *relaxation*: `schema.js` stops requiring the field, `factory.js` stops writing it, `migrate.js` stops adding it. Existing manifests that still carry it stay valid (the validator ignores unknown keys) and are never rewritten. `SCHEMA_VERSION` stays 2 and no migration is authored.
- **UI quality standard (standing rule):** no emojis in product UI, professional inline-SVG icons only, high polish bar. New icons go in `frontend/src/components/Icons.js` in the file's existing arrow-function style.
- **New logic is written as pure helpers under `utils/` with pure-module tests** (established policy). `blockPalette.js`, `describeRunError.js` and the `instrumentor.js` changes are all pure and all TDD'd here. Blockly and debug *UI* is verified by the controller's browser pass plus **Plan 2 Task 2's component-probe layer — `frontend/src/test/renderHelpers.js` (`mountComponent` / `click` / `keyDown` / `byText` / `byTitle`) and the suites beside it under `__tests__/`**; this plan extends that layer rather than inventing a second one. New component suites import the harness, never hand-roll `createRoot` + `act`, and live at `frontend/src/<area>/__tests__/<name>.test.js`. There is no `frontend/src/__probe__/` directory and this plan does not create one.
- **Minimum supported viewport is 1024px** (review open Q7, settled in Plan 1). The docked trace drawer must not break below it; no new responsive work beyond that.
- **Every task commits on `feature/classroom-platform`.** Ports 3000/4000/5433 unchanged. Backend and shared are not touched by this plan — `npm run typecheck -w backend` and `-w shared` are run in the wrap-up only to prove that.

**Deferred (in the review or adjacent, deliberately NOT here — do not flag as missing):**

- **Self-hosted Inter / JetBrains Mono** — review open Q(c), still unanswered; Plan 1 deferred it and so does this one. The `@import` at `styles.css:5` stays.
- **Scene `title` / `caption` surfacing in React chrome** — this is **Tranche 2's** item (`precodedExamples.js:16,21,126,131,225,229` author the text; `glowRunner.js:152-177` clips it). Do not duplicate it here.
- **Search inserts the block**, wheel-zoom ↔ slider sync, "Fit to blocks", the Advanced-drawer disclosure chevron and `sim_start` pre-placed in blank projects — all **Tranche 2** roadmap items, built there. This plan fixes *why* search dead-ends (the category mismatch, Tasks 4-6) and does not redesign what clicking a result does. The one exception is forced by Task 10: deleting the top-block adoption loop would leave Plan 2's inserted block greyed, so **Task 10 Step 4 makes insertion attach explicitly** — a repair to keep Plan 2's behaviour, not new insertion design.
- **`.blocklyTreeRow` restyled as a colour-swatch pill** — DELIVERED by Plan 3 Task 8 (the MakeCode rail: bright dots, pill rows, filled selection). The `.blocklyTreeIconClosed`/`.blocklyTreeIconOpen` chevron treatment stands. The `.tb-label` straggler Plan 1 handed over remains this plan's Task 8 Step 6.
- **Viewport camera cluster, ResizeObserver + devicePixelRatio, the screenshot-capture fix, live theme sync into the iframe** — all **Tranche 2** viewport items. Task 2 changes *where* GlowScript loads from and nothing about how it renders. **The one exception is `scene.background` unification**, which Plan 2 Task 14 explicitly handed here ("the per-template hardcoded navies stay for Tranche 3"): Task 2 Step 4 below strips the seven hardcoded navies from `blockTemplates.js` and `precodedExamples.js` so Plan 2's `applyRuntimeTheme` owns the background in both themes. That closes the handoff; it is not deferred again.
- **A dataframe connection type check.** The review proposed `output: "Frame"` on the DS chain. **This is refuted by the code**: DS blocks are statement blocks that chain through `field_variable` (`ds_filter_eq_block` `args0[1]` is `{type:"field_variable", name:"VAR"}`, `ds_calc_mean_block` and `ds_linear_regression_block` likewise) — there is no value connection between them to type-check. Typing the DS pipeline would need a variable-type mechanism, which is a separate design. Task 9 does the vector chain only, which is real.
- **`e2e/` screenshot refresh.** 49 checked-in PNGs are invalidated by the palette and the debug re-home. Plan a single refresh commit after the controller's browser pass, exactly as Tranche 2 does — not churned mid-series.
- **Student-facing project history screen, assignments, admin storage panel** — classroom-platform plans, unrelated.

---

### Task 1: MOVED — Bundle Blockly

**Moved to Plan 3, Task 2** ([2026-08-21-ide-modernization-03-makecode-overhaul.md](2026-08-21-ide-modernization-03-makecode-overhaul.md)). `blocklyLib.js`, the sixteen rewritten `window.Blockly` sites, the vendored `media/`, and the removed CDN tags all land there. The task number is preserved so this document's cross-references ("nothing may start before Task 1") stay resolvable: read them as "Plan 3 must land first."

---

### Task 2: One background, not seven — the scene.background handoff

**The vendoring itself moved to Plan 3, Task 3** ([2026-08-21-ide-modernization-03-makecode-overhaul.md](2026-08-21-ide-modernization-03-makecode-overhaul.md)): the six files live in `frontend/public/vendor/glowscript/` with provenance, and the offline smoke test ran in Plan 3's wrap-up. What survives here is this task's Step 4 — the `scene.background` unification Plan 2 Task 14 handed to this tranche. It keeps its original step number so cross-references stay resolvable.

**Files:**

- Modify: `frontend/src/utils/blockly/blockTemplates.js`, `frontend/src/utils/precodedExamples.js`

**Interfaces:**

- Consumes: Plan 2's `applyRuntimeTheme` (now the sole owner of the viewport background).
- Produces: templates and examples with no hardcoded `scene.background`.

- [ ] **Step 4: One background, not seven — close Plan 2 Task 14's handoff**

The review's highest-impact viewport row is "collapse the four background definitions to one". Plan 2 Task 14 did the runtime half (`VIEWPORT_THEME` + `applyRuntimeTheme`, live in both themes) and named what it could not reach: *"the review's 'collapse the four background definitions to one' also touches `blockTemplates.js:287,703,1110` and `precodedExamples.js:17,127,226`, which is template surgery outside this tranche's bullets … the per-template hardcoded navies stay for Tranche 3."* This is Tranche 3. Left alone, a running template in **light mode** is still a dark navy rectangle framed by a light pane — exactly the defect the review cited — because each template's own first statement overwrites whatever `applyRuntimeTheme` set.

Verified against the repo at `771bc1e` — **seven** sites, not six; `precodedExamples.js:364` was missed by both the review and Plan 2:

| File | Line | Statement |
|---|---|---|
| `blockTemplates.js` | 287 | `{ type: "python_raw_block", fields: { CODE: 'scene.background = vector(0.051, 0.086, 0.161)' } },` |
| `blockTemplates.js` | 703 | `… vector(0.020, 0.035, 0.090) …` |
| `blockTemplates.js` | 1110 | `… vector(0.059, 0.071, 0.133) …` |
| `precodedExamples.js` | 17 | `scene.background = vector(0.05, 0.08, 0.16)` |
| `precodedExamples.js` | 127 | `scene.background = vector(0.06, 0.07, 0.14)` |
| `precodedExamples.js` | 226 | `scene.background = vector(0.02, 0.03, 0.09)` |
| `precodedExamples.js` | 364 | `scene.background = vector(0.05, 0.05, 0.10)` |

Delete all seven — in `blockTemplates.js` the whole `python_raw_block` entry (it does nothing else), in `precodedExamples.js` the single line from the template string. Re-run the grep to prove it:

```powershell
git grep -n "scene.background" -- frontend/src
```

Expected: **exactly one hit** — `applyRuntimeTheme` in `glowRunner.js`, which Plan 2 Task 14 wrote and which now owns the background alone, in both themes, live on a theme toggle.

Two notes. **(a)** These deletions change the *stored XML* of three block templates, so open all three in the block editor afterwards and confirm nothing else moved — a `python_raw_block` removal must not orphan the statement below it. **(b)** If a template genuinely needs a non-theme background for pedagogical reasons (a starfield scene, say), keep it and add a one-line comment saying why; do not silently leave one behind. Neither of the three does today.

- [ ] **Step 5: Verify and commit**

Run the frontend suite, then boot one template from each goal in both themes — the viewport background must follow the theme with no per-template navy overriding it.

```bash
git add -A frontend
git commit -m "fix(frontend): applyRuntimeTheme owns scene.background — per-template navies stripped (Plan 2 Task 14 handoff closed)"
```

---

### Task 3: MOVED — `blockPalette.js`

**Superseded by Plan 3, Task 5** ([2026-08-21-ide-modernization-03-makecode-overhaul.md](2026-08-21-ide-modernization-03-makecode-overhaul.md)): the palette shipped is the vivid v2 revision — the same 26 categories and API, saturation raised at equal AA-verified depth, plus the fenced decorative `bright` variants (`brightFor`, `--cat-<slug>-bright`) and `STYLE_CATEGORY_ALIASES`. Where surviving steps cite v1 hexes (e.g. `#3770A2` for Objects), read the category name — the authoritative value comes from `blockPalette.js`. Tasks 5, 7 and 8 below consume the module exactly as originally planned.

---

### Task 4: The registry — delete the phantoms, reconcile the categories, remove beginner mode

**Files:**

- Modify: `frontend/src/utils/blockly/blockRegistry.js`
- Modify: `frontend/src/utils/blockly/__tests__/blockRegistry.test.js`
- Modify: `frontend/src/utils/manifest/factory.js`, `frontend/src/utils/manifest/schema.js`, `frontend/src/utils/manifest/migrate.js`
- Modify: `frontend/src/components/layout/IDELayout.js`
- Modify: `frontend/src/utils/manifest/__tests__/factory.test.js`, `frontend/src/utils/manifest/__tests__/schema.test.js`

**Interfaces:**

- Produces: a 120-entry registry across exactly **19 block-bearing categories**, matching the toolbox Task 5 builds, one-for-one.
- Removes: `beginnerVisible` from every entry, the `{beginnerEnabled}` option from `getBlocksForGoal`, and the `beginnerEnabled` manifest field from factory / schema / migrate / import.
- Consumes: nothing. **Tasks 5 and 6 consume this one.**

> **Two stale numbers in the review, corrected here.** The review says "106 entries" (`blockRegistry.js:38-445`) and "19 of 106 block-search results dead-end". The array *is* at `:38-445`, but it now holds **125** entries — the registry grew after the review's commit. The 19 dead-ends are real and decompose exactly: **11** entries whose `category` matches no toolbox category (Starter 2, Scene 1, Transforming Data 2, Uncertainty 3, Analyzing Relationships 3) plus **8** entries whose category resolves but whose block is in no drawer (`sphere_emissive_block`, `box_opacity_block`, `helix_full_block`, `logic_compare`, `logic_operation`, `logic_negate`, `math_single`, `math_trig`). `BlockSearch.openCategory` (`BlocklyWorkspace.js:32-53`) resolves by category name and swallows the failure at `:52`, so all 19 fail silently. This task fixes 11 of them and Task 5 fixes the other 8.

- [ ] **Step 1: Delete the five phantom stock entries**

These five exist in neither `toolbox.js` nor `blocklyGenerator.js` — they are registry-only fiction and three of them shadow real custom blocks:

| Line    | Entry                                         | Why it goes                                      |
| ------- | --------------------------------------------- | ------------------------------------------------ |
| 201-203 | `logic_compare` "Compare (stock)"           | `compare_block` is the real one                |
| 204-206 | `logic_operation` "AND / OR (stock)"        | `logic_and_or_block` is the real one           |
| 207-209 | `logic_negate` "NOT (stock)"                | `logic_not_block` is the real one              |
| 221-223 | `math_single` "Math function (sqrt, abs…)" | not in the toolbox;`math_trig_block` covers it |
| 224-226 | `math_trig` "Trig (sin, cos, tan)"          | not in the toolbox;`math_trig_block` covers it |

Delete all five three-line entries. `check-block-registry.mjs` already treats `logic_*` and `math_*` prefixes as stock-sourced, so nothing else needs to change to keep it passing.

After this the registry holds **120** entries: Logic drops 7 → 4 (`compare_block`, `logic_and_or_block`, `logic_not_block`, `logic_boolean`) and Math drops 5 → 3 (`math_number`, `math_arithmetic`, `math_constant`).

- [ ] **Step 2: Re-home the four mis-categorised physics entries**

Each of these names a category the toolbox does not have, or a drawer the block does not appear in. The rule the CI check enforces from Task 6 onward: **an entry's `category` must be one of the toolbox categories the block actually appears under.**

| Entry                     | Line | `category` was | becomes          | Because                                                                                                                                |
| ------------------------- | ---- | ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `sim_start_block`       | 40   | `"Starter"`    | `"Control"`    | `toolbox.js:188`, under the "Simulation structure" label. The toolbox header comment at `:11-12` already declares Starter removed. |
| `sim_end_block`         | 43   | `"Starter"`    | `"Control"`    | `toolbox.js:189`                                                                                                                     |
| `scene_camera_block`    | 258  | `"Scene"`      | `"Objects"`    | `toolbox.js:139`, under the "Scene & camera" label inside Objects                                                                    |
| `set_colour_var_block`  | 78   | `"Values"`     | `"State"`      | `toolbox.js:170` — it appears only in the State drawer, and it *is* a State block: it sets a variable                             |
| `python_raw_block`      | 184  | `"Advanced"`   | `"Raw Python"` | `toolbox.js:368`, inside the Advanced drawer's Raw Python sub-category                                                               |
| `python_raw_expr_block` | 187  | `"Advanced"`   | `"Raw Python"` | `toolbox.js:369`                                                                                                                     |

Note `define_const_block`, `mag_block`, `norm_block` and `vector_block` each appear in *two* drawers. The rule is "one of", so their existing categories (`Values`, `Values`, `Values`, `Values`) all stand.

- [ ] **Step 3: Split the 58 data-science entries across the pipeline**

The registry already modelled three of these sub-categories (`Transforming Data`, `Uncertainty`, `Analyzing Relationships`) and `buildToolboxXml` never used them. The other seven come from the label groups the DS drawer *already* has (`toolbox.js:247,250,255,267,282,286,291,296,307,311,319`) — the pipeline structure exists, it was just never a drawer. Retag the 50 entries currently marked `"Data Science"`; the eight in the three existing sub-categories keep their names.

| New`category`               | Count | Entries                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"Load Data"`               | 4     | `ds_start_block`, `ds_load_builtin_block`, `ds_load_csv_block`, `ds_load_trace_block`                                                                                                                                                                                                                                        |
| `"Explore"`                 | 10    | `ds_show_table_block`, `ds_show_first_n_block`, `ds_show_last_n_block`, `ds_show_column_block`, `ds_count_rows_block`, `ds_count_cols_block`, `ds_list_cols_block`, `ds_count_unique_block`, `ds_show_one_cell_block`, `ds_identify_type_block`                                                                  |
| `"Statistics"`              | 13    | `ds_calc_mean_block`, `ds_calc_median_block`, `ds_calc_mode_block`, `ds_calc_min_block`, `ds_calc_max_block`, `ds_calc_range_block`, `ds_calc_sum_block`, `ds_calc_count_block`, `ds_calc_stddev_block`, `ds_all_stats_block`, `ds_compare_columns_block`, `ds_calc_percentile_block`, `ds_calc_iqr_block` |
| `"Transforming Data"`       | 2     | `ds_add_column_transform_block`, `ds_multiply_columns_block` *(unchanged)*                                                                                                                                                                                                                                                     |
| `"Uncertainty"`             | 3     | `ds_calc_std_error_block`, `ds_print_uncertainty_block`, `ds_calc_relative_uncertainty_block` *(unchanged)*                                                                                                                                                                                                                  |
| `"Analyzing Relationships"` | 3     | `ds_linear_regression_block`, `ds_chart_scatter_fit_block`, `ds_correlation_block` *(unchanged)*                                                                                                                                                                                                                             |
| `"Filter & Sort"`           | 9     | `ds_filter_eq_block`, `ds_filter_gt_block`, `ds_filter_lt_block`, `ds_sort_asc_block`, `ds_sort_desc_block`, `ds_remove_missing_block`, `ds_find_missing_block`, `ds_filter_and_block`, `ds_filter_or_block`                                                                                                       |
| `"Group & Compare"`         | 2     | `ds_group_count_block`, `ds_group_mean_block`                                                                                                                                                                                                                                                                                    |
| `"Charts"`                  | 6     | `ds_chart_bar_block`, `ds_chart_line_block`, `ds_chart_scatter_block`, `ds_chart_histogram_block`, `ds_chart_box_block`, `ds_save_chart_block`                                                                                                                                                                           |
| `"Communicate"`             | 6     | `ds_write_note_block`, `ds_print_result_block`, `ds_compare_results_block`, `ds_state_conclusion_block`, `ds_export_table_block`, `ds_show_python_block`                                                                                                                                                                 |

Total 58. `"Data Science"` no longer appears as any entry's `category` — it is a drawer parent from Task 5 onward, which is exactly what the palette's parent/child split models. Also update the section comments in the file (`/* ── Data Science (Phase C.3 vertical slice) ─────────────── */` etc.) so they name the new sub-categories in pipeline order.

The finished registry, for the assertion in Step 6: **Values 10, Objects 15, Motion 5, State 5, Control 10, Logic 4, Math 3, 3D Math 8, Raw Python 2** (62 physics + shared) **and Load Data 4, Explore 10, Statistics 13, Transforming Data 2, Uncertainty 3, Analyzing Relationships 3, Filter & Sort 9, Group & Compare 2, Charts 6, Communicate 6** (58 data science) = **120 across 19 categories**.

- [ ] **Step 4: Delete the beginner-mode metadata**

`beginnerVisible: true|false` appears on all 125 entries (120 after Step 1) and nothing consumes it. Delete the key from every entry, then:

In `frontend/src/utils/blockly/blockRegistry.js`:

- Header comment `:21` — drop `beginnerVisible` from the "One source of truth for {…}" list.
- `getBlocksForGoal` (`:467-478`) loses its options parameter entirely:

```js
export function getBlocksForGoal(goal) {
  const allowedDomains =
    goal === "physics" ? new Set(["shared", "physics"]) :
    goal === "datascience" ? new Set(["shared", "datascience"]) :
    goal === "hybrid" ? new Set(["shared", "physics", "datascience", "hybrid"]) :
    new Set(["shared", "physics", "datascience", "hybrid"]);
  return REGISTRY.filter((e) => allowedDomains.has(e.domain));
}
```

In `frontend/src/utils/manifest/factory.js`: delete the `beginnerEnabled = false,` parameter at `:47` and the `beginnerEnabled: Boolean(beginnerEnabled),` field at `:80`.

In `frontend/src/utils/manifest/schema.js`: delete `:96` (`if (typeof v.beginnerEnabled !== "boolean") return false;`) and `:120` (`… return "beginnerEnabled must be boolean";`).

In `frontend/src/utils/manifest/migrate.js`: delete `beginnerEnabled: false,` at `:73`.

In `frontend/src/components/layout/IDELayout.js`: delete `beginnerEnabled: manifest.beginnerEnabled,` at `:237` from the `handleImportProject` `createNew` call.

Add a one-line note where the field used to be validated, so the next maintainer does not re-add it by reflex — at the top of the removed block in `schema.js`:

```js
  /* No beginner-mode field. The beginner/advanced TOGGLE was removed long
     before this (toolbox.js header, docs/product-contract.md:17); its
     metadata was deleted in the Tranche-3 sweep. Walkthrough Mode
     (docs/product-contract.md:90) is a guided flow over BeginnerGuide.js,
     not a visibility filter — it will not want this field back. */
```

**This is a schema relaxation, not a version bump.** `SCHEMA_VERSION` stays 2; manifests already carrying `beginnerEnabled` stay valid (the validator ignores unknown keys) and are never rewritten. Do not author a migration.

- [ ] **Step 5: Update the tests that asserted the deleted shape**

In `frontend/src/utils/blockly/__tests__/blockRegistry.test.js`:

- `:68` — delete `expect(typeof e.beginnerVisible).toBe("boolean");` from the "every entry has the required fields" loop.
- `:109-114` — delete the whole `getBlocksForGoal with beginnerEnabled drops non-beginner entries` test.
- In its place, add the shape assertions this task earns:

```js
  test("the registry is 120 entries across 19 categories", () => {
    const entries = getAllBlockEntries();
    expect(entries).toHaveLength(120);
    const byCat = {};
    for (const e of entries) byCat[e.category] = (byCat[e.category] || 0) + 1;
    expect(byCat).toEqual({
      "Values": 10,
      "Objects": 15,
      "Motion": 5,
      "State": 5,
      "Control": 10,
      "Logic": 4,
      "Math": 3,
      "3D Math": 8,
      "Raw Python": 2,
      "Load Data": 4,
      "Explore": 10,
      "Statistics": 13,
      "Transforming Data": 2,
      "Uncertainty": 3,
      "Analyzing Relationships": 3,
      "Filter & Sort": 9,
      "Group & Compare": 2,
      "Charts": 6,
      "Communicate": 6,
    });
  });

  test("the five phantom stock entries are gone", () => {
    for (const id of ["logic_compare", "logic_operation", "logic_negate", "math_single", "math_trig"]) {
      expect(getBlockEntry(id), id).toBeNull();
    }
  });

  test("no entry carries beginner-mode metadata", () => {
    for (const e of getAllBlockEntries()) {
      expect(e).not.toHaveProperty("beginnerVisible");
    }
  });
```

In `frontend/src/utils/manifest/__tests__/factory.test.js` and `__tests__/schema.test.js`: remove any `beginnerEnabled` assertion or fixture field. Grep first — `git grep -n "beginnerEnabled\|beginnerVisible" -- frontend/src` — and fix every hit outside the registry file.

- [ ] **Step 6: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "beginnerEnabled\|beginnerVisible" -- frontend/src
```

Expected: tests green (3 new registry tests, 1 deleted); build clean; **the grep returns nothing**. `npm run check:blocks` still passes at this point — the check does not yet know about categories; Task 6 teaches it.

```powershell
git add frontend/src
git commit -m "refactor(frontend): registry to 120 entries in 19 real categories; delete the dead beginner-mode metadata"
```

---

### Task 5: The toolbox — DS pipeline drawers, the three missing Objects blocks, palette-driven colour

**Files:**

- Modify: `frontend/src/utils/blockly/toolbox.js`
- Modify: `frontend/src/utils/blockly/__tests__/blockRegistry.test.js` (extend the `buildToolboxXml` describe)

**Interfaces:**

- Consumes: `BLOCK_PALETTE` (Task 3), the reconciled registry (Task 4).
- Produces: `MASTER_TOOLBOX_XML` with 26 categories whose `colour=` attributes are interpolated from the palette, the Data Science drawer nested into ten pipeline sub-drawers, and `sphere_emissive_block` / `box_opacity_block` / `helix_full_block` present in Objects.

Three problems in one file. **(a)** Sixteen hex literals hand-picked from three unrelated palettes, none of which matches the blocks inside its own drawer. **(b)** The Data Science category holds 58 blocks under 11 inline labels — the next largest drawer is Objects at 12 — while the nesting the Advanced drawer already demonstrates at `:329` sits unused. **(c)** Three blocks are fully defined in `blocklyGenerator.js` and used by `blockTemplates.js` (`sphere_emissive_block` ×3, `box_opacity_block` ×1, `helix_full_block` ×1) but appear zero times here: a student who deletes the glowing sphere from the orbital template can never get it back.

- [x] **Step 1: MOVED — category colours come from the palette** — absorbed by Plan 3, Task 8, which went further than interpolation: every `<category>` carries `categorystyle="<name>_category"` and the theme's `categoryStyles` own the colour. The steps below must NOT reintroduce `colour="#…"` attributes — new categories added here (the DS pipeline drawers) get `categorystyle` attributes in the same convention, with names from `categoryStyleNameFor`.

- [ ] **Step 2: Add the three template-shipped Objects blocks**

In the Objects category, under the "Composable objects" label, insert `sphere_emissive_block` immediately after `sphere_trail_block` (i.e. after line 103), and `box_opacity_block` immediately after `box_block` (after line 108), and `helix_full_block` immediately after `helix_block` (after line 125). Shadow defaults mirror the sibling blocks and the field names come from `blocklyGenerator.js`:

```xml
    <block type="sphere_emissive_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="RADIUS"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">YELLOW</field><field name="CUSTOM">#ffdd55</field></shadow></value>
    </block>
```

```xml
    <block type="box_opacity_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="SIZE"><shadow type="vector_block"><field name="X">1</field><field name="Y">1</field><field name="Z">1</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#4444ff</field></shadow></value>
      <value name="OPACITY"><shadow type="math_number"><field name="NUM">0.4</field></shadow></value>
    </block>
```

```xml
    <block type="helix_full_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="AXIS"><shadow type="vector_block"><field name="X">1</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="RADIUS"><shadow type="math_number"><field name="NUM">0.3</field></shadow></value>
      <value name="COILS"><shadow type="math_number"><field name="NUM">10</field></shadow></value>
      <value name="THICKNESS"><shadow type="math_number"><field name="NUM">0.05</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#cccccc</field></shadow></value>
    </block>
```

**Before writing these, open `blocklyGenerator.js` and confirm each block's `args0` input names** (`sphere_emissive_block` at `blockRegistry.js:95`'s id, defined in the JSON array). If a name differs, use the generator's name — a `<value name="…">` that matches no input is silently dropped by Blockly and the shadow default vanishes. Objects goes from 12 to 15 top-level blocks, matching the registry's 15.

- [ ] **Step 3: Nest Data Science into the pipeline**

Replace the entire single `<category name="Data Science" …>` block (`:245-326`) with a parent drawer holding ten sub-categories. Every `<block>` element moves verbatim — same types, same `<field>` defaults, same order — only the enclosing category changes, and the inline `<label>`/`<sep>` pairs that served as fake headings go, because each group now *is* a drawer.

```xml
  <!-- ── DATA SCIENCE (datascience) — the analysis pipeline, in order ── -->
  <category name="Data Science" colour="${c("Data Science")}" expanded="false">
    <category name="Load Data" colour="${c("Load Data")}">
      <label text="Analysis structure" web-class="tb-label"></label>
      <block type="ds_start_block"></block>
      <sep gap="12"></sep>
      <label text="Bring data in" web-class="tb-label"></label>
      <block type="ds_load_builtin_block"></block>
      <block type="ds_load_csv_block"></block>
      <block type="ds_load_trace_block"></block>
    </category>

    <category name="Explore" colour="${c("Explore")}">
      <block type="ds_show_table_block"></block>
      <block type="ds_show_first_n_block"></block>
      <block type="ds_show_last_n_block"></block>
      <block type="ds_show_column_block"><field name="COL">species</field></block>
      <block type="ds_count_rows_block"></block>
      <block type="ds_count_cols_block"></block>
      <block type="ds_list_cols_block"></block>
      <block type="ds_count_unique_block"><field name="COL">species</field></block>
      <block type="ds_show_one_cell_block"><field name="ROW">0</field><field name="COL">species</field></block>
      <block type="ds_identify_type_block"><field name="COL">species</field></block>
    </category>

    <category name="Statistics" colour="${c("Statistics")}">
      <block type="ds_calc_mean_block"><field name="COL">mass</field></block>
      <block type="ds_calc_median_block"><field name="COL">mass</field></block>
      <block type="ds_calc_mode_block"><field name="COL">species</field></block>
      <block type="ds_calc_min_block"><field name="COL">mass</field></block>
      <block type="ds_calc_max_block"><field name="COL">mass</field></block>
      <block type="ds_calc_range_block"><field name="COL">mass</field></block>
      <block type="ds_calc_sum_block"><field name="COL">mass</field></block>
      <block type="ds_calc_count_block"><field name="COL">mass</field></block>
      <block type="ds_calc_stddev_block"><field name="COL">mass</field></block>
      <block type="ds_all_stats_block"><field name="COL">mass</field></block>
      <block type="ds_compare_columns_block"><field name="COL_A">bill_length_mm</field><field name="COL_B">bill_depth_mm</field></block>
      <block type="ds_calc_percentile_block"><field name="COL">mass</field><field name="P">50</field></block>
      <block type="ds_calc_iqr_block"><field name="COL">mass</field></block>
    </category>

    <category name="Transforming Data" colour="${c("Transforming Data")}">
      <block type="ds_add_column_transform_block"><field name="SOURCE_COL">x</field><field name="NEW_NAME">log_x</field><field name="TRANSFORM">log10</field></block>
      <block type="ds_multiply_columns_block"><field name="COL_A">t</field><field name="COL_B">t</field><field name="NEW_NAME">t_sq</field></block>
    </category>

    <category name="Uncertainty" colour="${c("Uncertainty")}">
      <block type="ds_calc_std_error_block"><field name="COL">mass</field></block>
      <block type="ds_print_uncertainty_block"><field name="LABEL">measurement</field></block>
      <block type="ds_calc_relative_uncertainty_block"></block>
    </category>

    <category name="Analyzing Relationships" colour="${c("Analyzing Relationships")}">
      <block type="ds_linear_regression_block"><field name="X_COL">x</field><field name="Y_COL">y</field></block>
      <block type="ds_chart_scatter_fit_block"><field name="X_COL">x</field><field name="Y_COL">y</field></block>
      <block type="ds_correlation_block"><field name="COL_A">x</field><field name="COL_B">y</field></block>
    </category>

    <category name="Filter & Sort" colour="${c("Filter & Sort")}">
      <block type="ds_filter_eq_block"><field name="COL">species</field><field name="VALUE">Adelie</field></block>
      <block type="ds_filter_gt_block"><field name="COL">mass</field><field name="VALUE">3500</field></block>
      <block type="ds_filter_lt_block"><field name="COL">mass</field><field name="VALUE">3500</field></block>
      <block type="ds_filter_and_block"><field name="COL_A">species</field><field name="VAL_A">Adelie</field><field name="COL_B">island</field><field name="VAL_B">Biscoe</field></block>
      <block type="ds_filter_or_block"><field name="COL_A">species</field><field name="VAL_A">Adelie</field><field name="COL_B">species</field><field name="VAL_B">Chinstrap</field></block>
      <sep gap="8"></sep>
      <block type="ds_sort_asc_block"><field name="COL">mass</field></block>
      <block type="ds_sort_desc_block"><field name="COL">mass</field></block>
      <sep gap="8"></sep>
      <block type="ds_remove_missing_block"><field name="COL">mass</field></block>
      <block type="ds_find_missing_block"><field name="COL">mass</field></block>
    </category>

    <category name="Group & Compare" colour="${c("Group & Compare")}">
      <block type="ds_group_count_block"><field name="COL">species</field></block>
      <block type="ds_group_mean_block"><field name="VALUE_COL">mass</field><field name="GROUP_COL">species</field></block>
    </category>

    <category name="Charts" colour="${c("Charts")}">
      <block type="ds_chart_bar_block"><field name="X_COL">species</field><field name="Y_COL">count</field></block>
      <block type="ds_chart_line_block"><field name="X_COL">date</field><field name="Y_COL">temperature</field></block>
      <block type="ds_chart_scatter_block"><field name="X_COL">bill_length_mm</field><field name="Y_COL">body_mass_g</field></block>
      <block type="ds_chart_histogram_block"><field name="COL">body_mass_g</field></block>
      <block type="ds_chart_box_block"><field name="VALUE_COL">body_mass_g</field><field name="GROUP_COL">species</field></block>
      <block type="ds_save_chart_block"><field name="X_COL">species</field><field name="Y_COL">count</field></block>
    </category>

    <category name="Communicate" colour="${c("Communicate")}">
      <block type="ds_write_note_block"></block>
      <block type="ds_print_result_block"></block>
      <block type="ds_compare_results_block"></block>
      <block type="ds_state_conclusion_block"></block>
      <block type="ds_export_table_block"></block>
      <block type="ds_show_python_block"></block>
    </category>
  </category>
```

Two notes. **`&amp;`** is required — `MASTER_TOOLBOX_XML` is parsed by `DOMParser` in `buildToolboxXml` (`:429`) and a bare `&` makes the whole document a `parsererror`, which `:433-437` catches by shipping the toolbox *unfiltered*. The registry category names stay the literal `"Filter & Sort"` / `"Group & Compare"`; only the XML attribute is escaped, and Task 6's check must compare against the decoded value. **`expanded="false"`** on the parent means Data Science opens collapsed like Advanced does — click to reveal the ten stages.

`pruneEmptyCategories` (`:460-469`) already handles nesting: it walks categories in reverse so children are evaluated first, keeps any category with a surviving `<category>` child, and drops the rest. On a physics project every DS sub-drawer empties, then the Data Science parent empties, then it goes. No change needed.

- [ ] **Step 4: Extend the toolbox tests**

Append to the `buildToolboxXml goal filtering` describe in `frontend/src/utils/blockly/__tests__/blockRegistry.test.js`:

```js
  test("the three template-shipped Objects blocks are now reachable", () => {
    const t = typesIn(buildToolboxXml("physics"));
    expect(t.has("sphere_emissive_block")).toBe(true);
    expect(t.has("box_opacity_block")).toBe(true);
    expect(t.has("helix_full_block")).toBe(true);
  });

  test("Data Science is a parent drawer with ten pipeline sub-categories", () => {
    const ds = buildToolboxXml("datascience");
    for (const name of [
      "Load Data",
      "Explore",
      "Statistics",
      "Transforming Data",
      "Uncertainty",
      "Analyzing Relationships",
      "Filter & Sort",
      "Group & Compare",
      "Charts",
      "Communicate",
    ]) {
      expect(ds, name).toContain(`name="${name}"`);
    }
    expect(ds).toContain('name="Data Science"');
  });

  test("the whole DS drawer prunes away on a physics project", () => {
    const phys = buildToolboxXml("physics");
    expect(phys).not.toContain('name="Data Science"');
    expect(phys).not.toContain('name="Statistics"');
  });

  test("category colours come from the palette, not literals", () => {
    const xml = buildToolboxXml("hybrid");
    expect(xml).toContain(`colour="${BLOCK_PALETTE.Objects.fill}"`);
    expect(xml).toContain(`colour="${BLOCK_PALETTE["Data Science"].fill}"`);
    expect(xml).not.toMatch(/colour="#(7c68c6|4a90d9|d9a54a|2da56f|3a7bd5)"/i);
  });
```

Add `import { BLOCK_PALETTE } from "../blockPalette";` to that test file's imports.

- [ ] **Step 5: Verify and commit**

```powershell
npm run test -w frontend
npm run check:blocks
npm run build -w frontend
git grep -n 'colour="#' -- frontend/src/utils/blockly/toolbox.js
```

Expected: tests green (4 new); `check:blocks` reports **120 entries, 0 duplicates, 120 toolbox ids all present**; build clean; **the grep returns nothing**.

```powershell
git add frontend/src/utils/blockly
git commit -m "feat(frontend): toolbox on the palette — DS splits into ten pipeline drawers, three lost Objects blocks return"
```

---

### Task 6: `check:blocks` validates categories and membership, both directions

**Files:**

- Modify: `frontend/scripts/check-block-registry.mjs`

**Interfaces:**

- Consumes: the reconciled registry (Task 4) and the rebuilt toolbox (Task 5).
- Produces: CI failure on (i) duplicate ids, (ii) a toolbox block id with no registry entry, (iii) **a registry id in no toolbox drawer**, (iv) **a registry category that is not a toolbox category**, (v) **a toolbox category that is neither a registry category nor a declared stock/parent drawer**, (vi) **a registry entry whose category is not one of the drawers its block actually appears in**.

Today the script checks one direction only — toolbox → registry — which is why 19 of 125 search results dead-end with CI green. Everything below is mechanical and cheap; the whole point is that this class of bug can never ship again.

- [ ] **Step 1: Rewrite the script**

Replace the whole body of `frontend/scripts/check-block-registry.mjs` with:

```js
/**
 * check-block-registry — CI guard for the canonical block registry.
 *
 * Run:  npm run check:blocks
 *
 * The registry and the toolbox must describe the SAME product, in both
 * directions. Before Tranche 3 this script checked one direction only
 * (toolbox → registry), and 19 of 125 block-search results dead-ended
 * silently: BlockSearch.openCategory (BlocklyWorkspace.js:32-53) resolves a
 * result by CATEGORY NAME and swallows the failure, so a registry entry in a
 * category the toolbox does not have, or a block in no drawer at all, looks
 * to a student like a search box that does nothing.
 *
 * Fails (exit 1) on:
 *   1. Duplicate ids in the registry.
 *   2. A toolbox block id with no registry entry.
 *   3. A registry id that appears in no toolbox drawer.
 *   4. A registry category that is not a toolbox category.
 *   5. A toolbox category that is neither a registry category nor declared
 *      below as a stock-only or parent drawer.
 *   6. A registry entry whose category is not one of the drawers its own
 *      block actually appears in. (Blocks may appear in several drawers —
 *      define_const_block is in Values and State — so the registry names the
 *      canonical home, and it has to be a real one.)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

/* Stock Blockly blocks come from blockly/blocks; we do not register them. */
const STOCK_PREFIXES = ["controls_", "variables_", "procedures_", "lists_", "text_"];
const STOCK_ONLY_IDS = new Set([
  "text",
  "logic_null", "logic_ternary",
  "math_number_property", "math_round", "math_on_list",
  "math_modulo", "math_random_int", "math_random_float",
]);

/* Drawers that legitimately hold no registry-owned block. */
const STOCK_ONLY_CATEGORIES = new Set(["Variables", "Functions", "Loops", "Text", "Lists"]);
const PARENT_CATEGORIES = new Set(["Advanced", "Data Science"]);

function isStockBlock(id) {
  if (STOCK_ONLY_IDS.has(id)) return true;
  return STOCK_PREFIXES.some((p) => id.startsWith(p));
}

const decode = (s) =>
  s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, '"');

/**
 * Walk MASTER_TOOLBOX_XML's source text and return, per category name, the
 * set of block ids declared inside it. Nesting is handled by a depth stack;
 * a block belongs to the innermost open category.
 */
function readToolbox(src) {
  const byCategory = new Map();
  const stack = [];
  const token = /<category\s+name="([^"]+)"|<\/category>|<block\s+type="([^"]+)"|<shadow\s+type="([^"]+)"/g;
  let m;
  while ((m = token.exec(src))) {
    if (m[1] !== undefined) {
      const name = decode(m[1]);
      if (!byCategory.has(name)) byCategory.set(name, new Set());
      stack.push(name);
    } else if (m[0] === "</category>") {
      stack.pop();
    } else {
      const id = m[2] || m[3];
      const here = stack[stack.length - 1];
      if (id && here && !isStockBlock(id)) byCategory.get(here).add(id);
    }
  }
  return byCategory;
}

function fail(title, lines) {
  console.error(`✘ ${title}`);
  for (const l of lines) console.error(`   - ${l}`);
  process.exit(1);
}

async function main() {
  const registryUrl = new URL("../src/utils/blockly/blockRegistry.js", import.meta.url);
  const { findDuplicateIds, findUnknownIds, getAllBlockEntries } = await import(registryUrl);

  const dups = findDuplicateIds();
  if (dups.length > 0) {
    fail(
      "Duplicate block ids found in blockRegistry.js:",
      dups.map((d) => `${d.id} (categories: '${d.first.category}' and '${d.second.category}')`),
    );
  }

  const toolboxSrc = readFileSync(resolve(repoRoot, "src/utils/blockly/toolbox.js"), "utf8");
  const byCategory = readToolbox(toolboxSrc);
  const toolboxIds = new Set([...byCategory.values()].flatMap((s) => [...s]));
  const toolboxCategories = new Set(byCategory.keys());

  const entries = getAllBlockEntries();
  const registryCategories = new Set(entries.map((e) => e.category));

  /* 2. toolbox → registry (ids) */
  const unknown = findUnknownIds([...toolboxIds]);
  if (unknown.length > 0) {
    fail("Block ids in the toolbox with no blockRegistry.js entry:", unknown);
  }

  /* 3. registry → toolbox (ids) */
  const orphanIds = entries.filter((e) => !toolboxIds.has(e.id));
  if (orphanIds.length > 0) {
    fail(
      "Registry ids that appear in NO toolbox drawer (block search would dead-end):",
      orphanIds.map((e) => `${e.id} [${e.category}]`),
    );
  }

  /* 4. registry → toolbox (categories) */
  const orphanCats = [...registryCategories].filter((c) => !toolboxCategories.has(c));
  if (orphanCats.length > 0) {
    fail("Registry categories with no matching toolbox category:", orphanCats);
  }

  /* 5. toolbox → registry (categories) */
  const strayCats = [...toolboxCategories].filter(
    (c) => !registryCategories.has(c) && !STOCK_ONLY_CATEGORIES.has(c) && !PARENT_CATEGORIES.has(c),
  );
  if (strayCats.length > 0) {
    fail(
      "Toolbox categories that own no registry block and are not declared stock-only or parent drawers:",
      strayCats,
    );
  }

  /* 6. the canonical home has to be a real one */
  const misplaced = entries.filter((e) => {
    const drawers = [...byCategory.entries()]
      .filter(([, ids]) => ids.has(e.id))
      .map(([name]) => name);
    return !drawers.includes(e.category);
  });
  if (misplaced.length > 0) {
    fail(
      "Registry entries whose category is not a drawer their block appears in:",
      misplaced.map((e) => {
        const drawers = [...byCategory.entries()]
          .filter(([, ids]) => ids.has(e.id))
          .map(([name]) => name);
        return `${e.id} says '${e.category}' but appears in: ${drawers.join(", ") || "(nowhere)"}`;
      }),
    );
  }

  console.log(
    `✔ Registry OK: ${entries.length} entries in ${registryCategories.size} categories; ` +
      `${toolboxIds.size} toolbox ids and ${toolboxCategories.size} drawers reconcile both ways.`,
  );
}

main().catch((err) => {
  console.error("check-block-registry crashed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it, and prove each new check actually bites**

```powershell
npm run check:blocks
```

Expected exactly: `✔ Registry OK: 120 entries in 19 categories; 120 toolbox ids and 26 drawers reconcile both ways.`

Then break it four ways, one at a time, confirming the message and exit code 1 each time, and **reverting after each**:

| Break                                                                                   | Expected failure                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| In`blockRegistry.js`, change `sim_start_block`'s category to `"Starter"`          | check 4 — "Registry categories with no matching toolbox category: Starter" |
| In`toolbox.js`, delete the `<block type="helix_full_block">` element                | check 3 — "Registry ids that appear in NO toolbox drawer"                  |
| In`blockRegistry.js`, change `set_colour_var_block`'s category back to `"Values"` | check 6 — "says 'Values' but appears in: State"                            |
| In`toolbox.js`, rename `<category name="Charts"` to `<category name="Graphs"`     | checks 4*and* 5 fire (4 first)                                            |

```powershell
git status --short
```

Expected: only `frontend/scripts/check-block-registry.mjs` modified — every experiment reverted.

- [ ] **Step 3: Commit**

```powershell
git add frontend/scripts/check-block-registry.mjs
git commit -m "feat(frontend): check:blocks validates ids AND category names in both directions"
```

---

### Task 7: Debug highlights off the third red

**Steps 1–3 moved to Plan 3** ([2026-08-21-ide-modernization-03-makecode-overhaul.md](2026-08-21-ide-modernization-03-makecode-overhaul.md) — Task 6: `blocklyTheme.js`, Zelos-based, palette-driven, `isDark` fixed at inject; Task 7: the 115 hue integers swapped for style names). What survives is Step 4 — the debug-highlight recolour, which is debugger work. It keeps its original step number so this document's cross-references stay resolvable.

**Files:**

- Modify: `frontend/src/styles/workspace.css` (the `.dm-bp-block` / `.dm-block-executing` rules — post-split location)

**Interfaces:**

- Consumes: Plan 3's palette (`--danger` remains the only permitted red family).
- Produces: debug decorations that are the workspace's only red.

- [ ] **Step 4: Repoint the debug highlights off the third red**

In `frontend/src/styles.css`, the breakpoint and execution decorations hardcode a *fourth* and *fifth* red/amber (`#ef4444` / `#dc2626` for `.dm-bp-block`, `#facc15` / `#d97706` for `.dm-block-executing`) against `--red: #f44747` and `--yellow: #cca700`. Now that red belongs to nothing else, route them through the tokens. Replace the four rules (currently at `:839-857`, selectors `.dm-bp-block > .blocklyPath`, `[data-theme="light"] .dm-bp-block > .blocklyPath`, `.dm-block-executing > .blocklyPath`, `[data-theme="light"] .dm-block-executing > .blocklyPath`) with two theme-agnostic rules under the names Task 17 will use:

```css
/* ── Debug decorations on Blockly blocks ────────────────────
   Red is reserved for errors and breakpoints (blockPalette.js keeps every
   category fill out of the 340-15 degree band), so these can finally be the
   product's own tokens instead of a fourth and fifth hardcoded red. */
.bp-block > .blocklyPath {
  stroke: var(--red) !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--red) 70%, transparent)) !important;
}
.block-executing > .blocklyPath {
  stroke: var(--yellow) !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--yellow) 70%, transparent)) !important;
}
```

Rename the two class names at their only JS sites — `BlocklyWorkspace.js:582,596` (`'dm-bp-block'`) and `:610,612` (`'dm-block-executing'`) — to `'bp-block'` and `'block-executing'`.

- [ ] **Step 5: Verify and commit**

Run the suite; set a breakpoint and run in both themes — the breakpoint and executing-block outlines must be the only reds on the workspace.

```bash
git add -A frontend
git commit -m "fix(frontend): debug highlights are the workspace's only red"
```

---

### Task 8: `--cat-*` tokens and everything that should have been reading them

**Files:**

- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/utils/blockly/__tests__/blockPalette.test.js`
- Modify: `frontend/src/components/HelpPage.js`
- Modify: `frontend/src/components/StartMenu.js`
- Modify: `frontend/src/welcome/GravityPlayground.js`

**Interfaces:**

- Consumes: `BLOCK_PALETTE` / `paletteCssText` (Task 3).
- Produces: 26 `--cat-*` custom properties in `styles.css`, kept honest by a test that reads the stylesheet; the three pane-header accents, the eight help-page **category** chips (a new `CategoryTag`, beside the untouched general-purpose `Tag`), the start-menu goal badges and the landing-page particles all sourced from them; `.tb-label` styled.
- Leaves alone: `Tag` and the six `.help-tag--*` rules (51 non-category uses), and Plan 2 Task 13 Step 4's `.blocklyTreeIcon` chevron.

- [x] **Step 1: MOVED — the palette lives in the stylesheet** — absorbed by Plan 3, Task 8: `styles/tokens.css` carries the full `--cat-*` (and `--cat-*-bright`) block, sync-enforced by `utils/blockly/__tests__/paletteCssSync.test.js`. The steps below consume those variables; do not re-emit them.

- [ ] **Step 2: The three pane-header accents**

`.pane-header--blocks/--code/--viewport` currently paint their 2px top stripes with `--mauve`, `--accent-blue` and `--green` — three tokens picked before the palette existed. Point them at the palette so the pane a student is looking at is coloured by what is *in* it:

```css
.pane-header--blocks   { border-top: 2px solid var(--cat-values); padding-top: 0; }
.pane-header--code     { border-top: 2px solid var(--cat-objects); padding-top: 0; }
.pane-header--viewport { border-top: 2px solid var(--cat-data-science); padding-top: 0; }
```

(Plan 1's Global Constraints keep the stripes; this only changes what they are made of.)

- [ ] **Step 3: Help-page colour tags become the actual block colours**

`HelpPage.js:26-28` defines one generic `Tag({ color = "blue", children })`, styled by six `.help-tag--*` rules (`styles.css:2520-2532`, plus six `[data-theme="light"]` overrides) that draw on `--accent-blue`, `--mauve`, `--green`, `--yellow`, `--accent-green` and `--red` — none of which is a block colour. Eight of its call sites label a block category, and three of those eight are factually wrong: `:910` labels Physics Expressions "colour 160" (teal) when those blocks are hue 230; `:1078` labels Utility "colour 330", a hue **no block uses**; `:1217` calls hue 230 teal. And "colour 230" means nothing to a 15-year-old.

> **`Tag` is used 59 times, not 8** — verified: `grep -c '<Tag color=' frontend/src/components/HelpPage.js` returns 59 (blue 15, purple 14, green 12, red 11, yellow 6, teal 5, pink 1). The other **51** call sites have no block-category meaning at all and cannot be "converted": goal badges (*Physics Modelling*, *Data Science*, *Hybrid*), toolbar and status labels (*Run*, *Stop*, *Pause*, *Resume*, *Step*, *Debug*, *Record*, *Stop Rec*), difficulty ratings (*Introductory*, *Intermediate*, *Advanced*), tab names (*Code*, *Blocks*) and export-format labels (*Export as Python*, *Code as PDF*, …). **So `Tag` keeps its signature and its six rules, and the eight category chips get a second, differently-named component.** Repointing the single `Tag` at `BLOCK_PALETTE` would throw on the first non-category use and take the whole Help page down.

Add `CategoryTag` **beside** the existing `Tag` — do not modify `Tag`, and do not delete the `.help-tag--*` rules:

```js
import { BLOCK_PALETTE } from "../utils/blockly/blockPalette";

/**
 * A block-category chip that is literally the colour of the blocks it names.
 *
 * Distinct from <Tag color="…"> on purpose. Tag is the page's general-purpose
 * chip and has 51 uses that are not block categories at all — goal badges,
 * toolbar verbs, difficulty ratings, tab and export-format names — so it keeps
 * its ad-hoc colour words and its .help-tag--* rules. Only the eight chips that
 * name a real drawer come here, where the colour is the palette's and cannot
 * drift from the blocks it describes. Before Tranche 3 these eight quoted raw
 * Blockly hue integers, three of which were wrong and one of which ("colour
 * 330") named a hue no block ever used.
 */
function CategoryTag({ category, children }) {
  const e = BLOCK_PALETTE[category];
  if (!e) throw new Error(`CategoryTag: unknown block category ${JSON.stringify(category)}`);
  return (
    <span
      className="help-tag help-tag--cat"
      style={{ background: `var(${e.token})`, color: e.on }}
    >
      {children || category}
    </span>
  );
}
```

Add one rule beside the existing `.help-tag--*` block in `styles.css` (the inline style supplies the colour, so this needs no `[data-theme="light"]` override — the fill/on pair is AA in both themes by construction):

```css
/* Block-category chips (CategoryTag). Colour comes from the palette inline;
   this only supplies the edge and the weight. The .help-tag--blue/purple/…
   rules above stay — they serve the 51 non-category chips. */
.help-tag--cat {
  border: 1px solid color-mix(in srgb, #000 20%, transparent);
  font-weight: var(--fw-semibold);
}
```

Then rewrite the eight **category** call sites, deleting the hue numbers entirely:

| Line | Was                                                                               | Becomes                                                                                          |
| ---- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 726  | `<Tag color="blue">colour 210</Tag> <Tag color="green">beginner friendly</Tag>` | `<CategoryTag category="Objects" />` (drop the second tag — beginner mode is gone)            |
| 755  | `<Tag color="blue">colour 210</Tag>`                                            | `<CategoryTag category="Objects" />`                                                           |
| 910  | `<Tag color="teal">colour 160</Tag>`                                            | `<CategoryTag category="Values" />` — these blocks are Values, and always were                |
| 950  | `<Tag color="yellow">colour 45</Tag>`                                           | `<CategoryTag category="Motion" />`                                                            |
| 1012 | `<Tag color="purple">colour 260</Tag>`                                          | `<CategoryTag category="Control" />`                                                           |
| 1078 | `<Tag color="pink">colour 330</Tag>`                                            | `<CategoryTag category="State" />` — the section describes `set_*` blocks; "colour 330" was fiction |
| 1161 | `<Tag color="green">colour 120/0</Tag>`                                         | `<CategoryTag category="Control" />` — Simulation Start/End now share the Control family      |
| 1217 | `<Tag color="teal">colour 230</Tag>`                                            | `<CategoryTag category="3D Math" />`                                                           |

**Convert these eight and no others.** Every remaining `<Tag color=…>` in the file is one of the 51 non-category chips and stays exactly as it is. The verification is not "no `<Tag color=` remains" — it is:

```powershell
git grep -c "<Tag color=" -- frontend/src/components/HelpPage.js     # 59 before, 51 after
git grep -c "<CategoryTag" -- frontend/src/components/HelpPage.js    # 0 before, 8 after
```

If the second grep returns anything other than 8, a non-category chip was converted by mistake and `CategoryTag`'s `throw` will take the Help page down on the next render — which is exactly the failure this split exists to prevent. Step 7's greps then prove the hue prose is gone.

- [ ] **Step 4: Start-menu goal badges**

`StartMenu.js:371` renders `<span className="start-card-badge start-card-badge--code">{GOAL_BADGE[g.id] || g.id}</span>`. Give each goal its family colour so the start menu and the toolbox agree:

```js
const GOAL_TOKEN = {
  physics: "--cat-objects",
  datascience: "--cat-data-science",
  hybrid: "--cat-values",
};
```

```jsx
                        <span
                          className="start-card-badge"
                          style={{
                            background: `var(${GOAL_TOKEN[g.id] || "--cat-advanced"})`,
                            color: "#FFFFFF",
                          }}
                        >
                          {GOAL_BADGE[g.id] || g.id}
                        </span>
```

Delete the now-unused `.start-card-badge--code` modifier rule from `styles.css` and drop the class from the JSX.

- [ ] **Step 5: Landing-page particles**

`frontend/src/welcome/GravityPlayground.js:4` holds `["#7dd3fc","#f9a8d4","#fcd34d","#86efac","#c4b5fd"]` — pastel Tailwind-300 hues appearing nowhere else in the product, on the first interactive thing a prospective teacher touches. Replace with five palette fills spanning the wheel:

```js
import { BLOCK_PALETTE } from "../utils/blockly/blockPalette";

/* The landing page's particles are the product's own category colours —
   Objects blue, Values violet, Motion amber, Data teal, Charts green — not a
   sixth palette. */
const COLORS = [
  BLOCK_PALETTE.Objects.fill,
  BLOCK_PALETTE.Values.fill,
  BLOCK_PALETTE.Motion.fill,
  BLOCK_PALETTE["Data Science"].fill,
  BLOCK_PALETTE.Charts.fill,
];
```

Keep the existing variable name if it is not `COLORS` — read line 4 and match it.

- [ ] **Step 6: The Blockly-layer straggler Plan 1 handed over**

`toolbox.js` passes `web-class="tb-label"` on 21 flyout group headers (`:46,51,58,77,90,138,158,187,191,197` and the ones inside the new DS drawers) and `.tb-label` has **zero rules anywhere** — the hook was deliberately wired and never used, and those headers are the only wayfinding inside a flyout. Add, near the other `.blockly*` overrides in `styles.css`:

```css
/* Flyout group headers (toolbox.js passes web-class="tb-label" on 21 of them,
   and until Tranche 3 the class had no rules at all). Matches the micro-label
   voice Plan 1 established for .account-chip-head. */
.tb-label {
  font-size: var(--fs-2xs);
  font-weight: var(--label-weight);
  text-transform: var(--label-transform);
  letter-spacing: var(--label-tracking);
  color: var(--label-color);
  padding: var(--space-2) var(--space-3) var(--space-1);
}
```

**Do NOT touch `.blocklyTreeIcon`.** An earlier draft of this step replaced `styles.css:2897`'s blanket `.blocklyTreeIcon { display: none }` with a `.blocklyTreeRow:not(.blocklyTreeRowParent)` scoping — that is now wrong twice over. **Plan 2 Task 13 Step 4 already replaced that rule**, with a fuller treatment: a hidden base rule plus `.blocklyTreeIcon.blocklyTreeIconClosed` / `.blocklyTreeIconOpen` drawn as a CSS triangle with `transform: rotate(90deg)` on the open state and a 140ms transition. Re-scoping by row class here would reinstate Blockly's default icon *image* and throw away Plan 2's chevron and its rotation. Plan 2's rules stand as written, and this plan's Deferred list says so.

The new nested Data Science drawer this tranche creates (Task 5) needs **no change at all**: it is a collapsible parent, so Blockly gives its row `blocklyTreeIconClosed` / `blocklyTreeIconOpen` exactly as it does Advanced, and Plan 2's rules already match on those classes rather than on the category name. If the browser pass shows the DS parent or one of its ten children rendering the chevron wrongly, express the fix as an **addition** to Plan 2's `blocklyTreeIconClosed/Open` rules — never as a replacement of them.

Also raise `.blocklyTreeLabel` to `font-size: var(--fs-sm)` if Plan 1 left it at 11px — `ux-audit.mjs:199` asserts a 13px floor on that exact selector.

- [ ] **Step 7: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -c "<CategoryTag" -- frontend/src/components/HelpPage.js
git grep -c "<Tag color=" -- frontend/src/components/HelpPage.js
git grep -n "colour 210\|colour 160\|colour 230\|colour 330\|colour 260\|colour 45\|colour 120" -- frontend/src
git grep -n "7dd3fc\|f9a8d4\|fcd34d\|86efac\|c4b5fd" -- frontend/src
git grep -n "blocklyTreeIcon" -- frontend/src/styles.css
```

Expected: tests green (2 new); build clean; **`8`**; **`51`** (the non-category chips, untouched — 59 minus the 8 converted); the last two greps return **nothing**; and the `blocklyTreeIcon` grep returns **Plan 2 Task 13 Step 4's three rules, unmodified** — if this task changed them, revert that change.

Then open the Help page in both themes and scroll it end to end. Every chip must be legible: the eight category chips carry white text on their palette fill, and the 51 generic chips are unchanged from Tranche 2.

```powershell
git add frontend/src
git commit -m "feat(frontend): --cat-* tokens and their consumers — pane accents, help tags, goal badges, landing particles"
```

---

### Task 9: Connection type checks on the vector chain

**Files:**

- Modify: `frontend/src/utils/blockly/blocklyGenerator.js`

**Interfaces:**

- Produces: `output: "Vector"` on the four blocks that produce a vector, `check: ["Vector", "Number"]` on the eight slots that consume one, and `output: "Number"` on the four that reduce a vector to a scalar.
- Consumes: nothing.

`blocklyGenerator.js` carries **17** `output: null` declarations against only **3** typed outputs (`:251`, `:267`, `:276`, all Boolean) and 5 Boolean input checks. `vector_block` (`:104`), `mag_block` (`:210`), `norm_block` (`:219`) and `get_prop_block` (`:185`) are all untyped, so a scalar snaps happily into a `pos` slot and fails much later as an opaque VPython error a student cannot map back to a block. This is Blockly's built-in connection checking — **not** the type-coercion engine `docs/product-contract.md:39` rules out, which is a different mechanism entirely ("Blockly connection checks + the new shared type tags. No coercion engine in v1." — this *is* the sanctioned half).

> **The review's dataframe half is refuted.** It proposed `output: "Frame"` on the DS chain. DS blocks are statement blocks that chain through `field_variable` — `ds_filter_eq_block`'s `args0[1]` is `{type: "field_variable", name: "VAR"}`, and `ds_calc_mean_block` and `ds_linear_regression_block` are the same shape. There is no value connection between them to check. Deferred, with the reason recorded, rather than faked.

- [ ] **Step 1: Type the producers**

| Line | Block                    | `output: null` →                                      |
| ---- | ------------------------ | -------------------------------------------------------- |
| 104  | `vector_block`         | `output: "Vector",`                                    |
| 219  | `norm_block`           | `output: "Vector",` — a unit vector is still a vector |
| 945  | `vector_compose_block` | `output: "Vector",`                                    |
| 210  | `mag_block`            | `output: "Number",` — magnitude is a scalar           |
| 908  | `dot_product_block`    | `output: "Number",` — a dot product is a scalar       |
| 896  | `cross_product_block`  | `output: "Vector",` — a cross product is a vector     |

Leave the eleven genuinely polymorphic outputs as `null`: `colour_block` (`:133`), `expr_block` (`:154`), `get_prop_block` (`:185`), `get_component_block` (`:201`), `var_read_block` (`:229`), `python_raw_expr_block` (`:771`), `math_trig_block` (`:931`), `math_min_block` (`:958`), `math_max_block` (`:970`), `math_pow_block` (`:982`), `math_clamp_block` (`:995`).

**`get_prop_block` in particular must stay `null`** and this is deliberate, not an oversight: it reads `ball.pos` (vector), `ball.radius` (number) *and* `ball.color` (vector) through one dropdown, so any fixed output type would make the common case unsnappable. Add the comment so nobody "fixes" it:

```js
      /* Deliberately untyped: the PROP dropdown spans vectors (pos, velocity,
         axis, color), numbers (radius, opacity, mass) and booleans (visible),
         so a fixed output would break more than it catches. The consuming
         slots below accept ["Vector","Number"], which is where the real
         guard lives. */
      output: null,
```

- [ ] **Step 2: Check the consumers**

Add `check: ["Vector", "Number"]` to the vector-shaped `input_value` slots. Untyped producers (`get_prop_block`, `expr_block`, `var_read_block`, …) still connect, because a `null` output matches any check — Blockly only refuses a *mismatch*, which is exactly the "minimal" behaviour the contract asks for.

| Block                                                                      | Input(s) to check |
| -------------------------------------------------------------------------- | ----------------- |
| `mag_block`                                                              | `VEC`           |
| `norm_block`                                                             | `VEC`           |
| `get_component_block`                                                    | `VEC`           |
| `cross_product_block`                                                    | `A`, `B`      |
| `dot_product_block`                                                      | `A`, `B`      |
| `sphere_block`, `sphere_trail_block`, `sphere_emissive_block`        | `POS`           |
| `box_block`, `box_opacity_block`                                       | `POS`, `SIZE` |
| `cylinder_block`, `arrow_block`, `helix_block`, `helix_full_block` | `POS`, `AXIS` |
| `label_block`, `label_full_block`, `local_light_block`               | `POS`           |
| `set_velocity_block`                                                     | `VEL`           |
| `apply_force_block`                                                      | `ACCEL`         |

Each becomes, for example:

```js
        { type: "input_value", name: "VEC", check: ["Vector", "Number"] },
```

`["Vector", "Number"]` rather than `"Vector"` on purpose: a student who snaps `mag(ball.velocity)` — a `Number` — into a slot that wants a vector is doing something VPython accepts (scalar broadcast), and refusing it would be a lie in the other direction. What this catches is `math_number` and `logic_boolean` in a `pos` slot, which is the actual failure mode.

Do **not** add checks to `RADIUS`, `TRAIL_R`, `RETAIN`, `HEIGHT`, `OPACITY`, `COILS`, `THICKNESS`, `ANGLE`, `DT`, `VALUE`, `LO`, `HI`, `BASE`, `EXP`, `NUM`, `TIMES`, `FROM`, `TO`, `BY` — they are scalars whose shadows are already `math_number`, and typing them would break `expr_block`, which students are told to use for exactly those slots.

- [ ] **Step 3: Verify by hand — this one has no unit test**

Type checks are a Blockly runtime behaviour; the pure-module policy has nothing to hook. Run the app and try to break it:

```powershell
npm run start -w frontend
```

1. Drag a `sphere` block out. Try to snap a `math_number` into its `POS` slot → **must refuse** (Blockly plays no sound and the block does not connect).
2. Snap a `vector` block into `POS` → **must connect**.
3. Snap `ball.pos` (`get_prop_block`) into `POS` → **must connect** (untyped producer).
4. Snap `mag(ball.velocity)` into `POS` → **must connect** (`Number` is in the check list).
5. Open the **Projectile**, **Spring**, **Orbits** and **Pendulum** block templates. **Every one must load with no disconnected blocks** — a template whose stored XML violates a new check would silently drop connections on load, which is the one way this task can regress a student's work.

Then confirm the generated Python is unchanged for all four templates: switch to Code view and diff by eye against the same template before this task (`git stash` / `git stash pop` if needed).

- [ ] **Step 4: Commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git add frontend/src/utils/blockly/blocklyGenerator.js
git commit -m "feat(frontend): connection type checks on the vector chain — a scalar can no longer snap into a pos slot"
```

---

### Task 10: Unified orphan handling — grey them, do not adopt them

**Files:**

- Create: `frontend/src/utils/blockly/orphans.js`, `frontend/src/utils/blockly/__tests__/orphans.test.js`
- Modify: `frontend/src/components/BlocklyWorkspace.js`, `frontend/src/components/layout/IDELayout.js`

**Interfaces:**

- Produces: `planOrphanState(topBlocks, anchorTypes)` — a pure function returning `{ enable: Set<id>, disable: Set<id> }` — and `applyOrphanState(workspace, plan)`, the thin imperative wrapper.
- Produces: `appendToSetup(workspace, block)`, exported from `BlocklyWorkspace.js` — the existing local helper, lifted so **explicit** insertion can attach explicitly (Step 4). This is what keeps Plan 2 Task 11's starter chips and Plan 2 Task 13's search-insert landing inside SETUP once the automatic adoption is gone.
- Removes: `normalizeSimulationStructure`'s top-block adoption loop (`BlocklyWorkspace.js:204-209`) and the `goal !== "datascience"` guard in `disableOrphanedBlocks` (`:243`).

`docs/product-contract.md:36` documents one behaviour for both goals: *"Physics uses `sim_start`/`sim_end`; data analyses use a `ds_start` 'Start analysis' hat. Top-level blocks outside the anchor are greyed and ignored, so 'in use vs unused' is visible."* The code does two. `disableOrphanedBlocks` (`:242-261`) greys orphans, but only when `goal === "datascience"`. For physics, `normalizeSimulationStructure` (`:204-209`) instead **force-adopts every stray top-level block into the `sim_start` SETUP slot on the next change event** — so a student who drags a block aside to think about it watches it snap into their program and silently change the generated Python. There is no undo affordance for something that happens by itself.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/blockly/__tests__/orphans.test.js`:

```js
import { describe, test, expect } from "vitest";
import { planOrphanState, ANCHOR_TYPES } from "../orphans";

/** Minimal stand-in for a Blockly top block: id, type, and its descendants. */
function block(id, type, kids = []) {
  const self = { id, type, shadow: false };
  self.descendants = [self, ...kids];
  return self;
}
const shadow = (id) => ({ id, type: "math_number", shadow: true, descendants: [] });

describe("planOrphanState", () => {
  test("no anchor on the canvas: nothing is disabled", () => {
    const tops = [block("a", "sphere_block"), block("b", "box_block")];
    expect(planOrphanState(tops, ANCHOR_TYPES)).toEqual({
      enable: new Set(["a", "b"]),
      disable: new Set(),
    });
  });

  test("with an anchor, anything not rooted in it is disabled", () => {
    const anchored = block("s", "sim_start_block", [block("s1", "sphere_block")]);
    const stray = block("x", "box_block", [block("x1", "vector_block")]);
    const plan = planOrphanState([anchored, stray], ANCHOR_TYPES);
    expect(plan.enable).toEqual(new Set(["s", "s1"]));
    expect(plan.disable).toEqual(new Set(["x", "x1"]));
  });

  test("sim_end is an anchor too — it must not grey itself out", () => {
    const plan = planOrphanState(
      [block("s", "sim_start_block"), block("e", "sim_end_block")],
      ANCHOR_TYPES,
    );
    expect(plan.disable.size).toBe(0);
  });

  test("a ds_start hat anchors a data analysis the same way", () => {
    const plan = planOrphanState(
      [block("d", "ds_start_block", [block("d1", "ds_calc_mean_block")]), block("y", "ds_chart_bar_block")],
      ANCHOR_TYPES,
    );
    expect(plan.enable).toEqual(new Set(["d", "d1"]));
    expect(plan.disable).toEqual(new Set(["y"]));
  });

  test("a hybrid canvas with both hats keeps both programs alive", () => {
    const plan = planOrphanState(
      [
        block("s", "sim_start_block", [block("s1", "sphere_block")]),
        block("d", "ds_start_block", [block("d1", "ds_show_table_block")]),
        block("z", "label_block"),
      ],
      ANCHOR_TYPES,
    );
    expect(plan.enable).toEqual(new Set(["s", "s1", "d", "d1"]));
    expect(plan.disable).toEqual(new Set(["z"]));
  });

  test("shadow blocks are never touched", () => {
    const stray = block("x", "box_block", [shadow("sh1")]);
    const plan = planOrphanState([block("s", "sim_start_block"), stray], ANCHOR_TYPES);
    expect(plan.disable.has("sh1")).toBe(false);
    expect(plan.disable).toEqual(new Set(["x"]));
  });

  test("is idempotent — planning twice gives the same plan", () => {
    const tops = [block("s", "sim_start_block", [block("s1", "sphere_block")]), block("x", "box_block")];
    expect(planOrphanState(tops, ANCHOR_TYPES)).toEqual(planOrphanState(tops, ANCHOR_TYPES));
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```powershell
npm run test -w frontend
```

Expected: FAIL — `Cannot find module '../orphans'`.

Create `frontend/src/utils/blockly/orphans.js`:

```js
/**
 * orphans — which top-level blocks are part of the program, and which are not.
 *
 * docs/product-contract.md:36 specifies ONE behaviour for both goals: top-level
 * blocks outside the anchor hat are "greyed and ignored, so 'in use vs unused'
 * is visible". Until Tranche 3 the code did two different things — data
 * analyses greyed orphans, while physics FORCE-ADOPTED every stray top-level
 * block into sim_start's SETUP slot on the next change event, so a student who
 * parked a block aside to think watched it snap into their program and
 * silently change the generated Python.
 *
 * Pure on purpose: `planOrphanState` takes plain {id, type, descendants[]}
 * shapes so it is testable without a live workspace, and `applyOrphanState`
 * is the two-line imperative half.
 */

/** Hat blocks that root a program. A canvas with none is left fully enabled. */
export const ANCHOR_TYPES = Object.freeze(["sim_start_block", "sim_end_block", "ds_start_block"]);

/**
 * @param {Array<{id:string,type:string,descendants:Array<{id:string,shadow:boolean}>}>} topBlocks
 * @param {ReadonlyArray<string>} anchorTypes
 * @returns {{enable: Set<string>, disable: Set<string>}}
 */
export function planOrphanState(topBlocks, anchorTypes = ANCHOR_TYPES) {
  const anchors = new Set(anchorTypes);
  const enable = new Set();
  const disable = new Set();

  const hasAnchor = topBlocks.some((b) => anchors.has(b.type));

  for (const top of topBlocks) {
    // No hat anywhere → a legacy or half-built canvas. Leave everything alone
    // rather than greying out a project the student has not anchored yet.
    const target = !hasAnchor || anchors.has(top.type) ? enable : disable;
    for (const b of top.descendants || []) {
      if (b.shadow) continue;
      target.add(b.id);
    }
  }
  return { enable, disable };
}

/** Apply a plan to a live Blockly workspace. Guards on isEnabled so it can run
 *  inside the change listener without an event storm. Returns true if it changed
 *  anything. */
export function applyOrphanState(workspace, plan) {
  let changed = false;
  for (const [ids, want] of [
    [plan.enable, true],
    [plan.disable, false],
  ]) {
    for (const id of ids) {
      const b = workspace.getBlockById(id);
      if (!b || b.isEnabled() === want) continue;
      b.setEnabled(want);
      changed = true;
    }
  }
  return changed;
}

/** Read a live workspace into the plain shape planOrphanState wants. */
export function readTopBlocks(workspace) {
  return workspace.getTopBlocks(false).map((top) => ({
    id: top.id,
    type: top.type,
    descendants: top.getDescendants(false).map((b) => ({ id: b.id, shadow: b.isShadow() })),
  }));
}
```

- [ ] **Step 3: Wire it into the workspace and delete the adoption loop**

In `frontend/src/components/BlocklyWorkspace.js`, add:

```js
import { ANCHOR_TYPES, planOrphanState, applyOrphanState, readTopBlocks } from "../utils/blockly/orphans";
```

Replace the whole of `disableOrphanedBlocks` (`:235-261`, comment block included) with:

```js
/* ── Orphan handling, one behaviour for every goal ─────────────
   docs/product-contract.md:36: top-level blocks outside the anchor hat are
   greyed and ignored, so "in use vs unused" is visible. No goal check — a
   physics canvas and a data canvas behave identically, and neither adopts. */
function greyOrphanedBlocks(workspace) {
  if (!workspace) return false;
  return applyOrphanState(workspace, planOrphanState(readTopBlocks(workspace), ANCHOR_TYPES));
}
```

Then, inside `normalizeSimulationStructure`, **delete lines 204-209** — the "Move any other top-level statement blocks into SETUP" loop:

```js
  // Move any other top-level statement blocks into SETUP.
  const topBlocks = workspace.getTopBlocks(true);
  for (const top of topBlocks) {
    if (top === simStart || top === simEnd) continue;
    appendToSetup(top);
  }
```

Everything else in that function stays: chaining blocks that were dropped *directly under* `sim_start` into SETUP (`:196-202`) is a student's explicit gesture, not an adoption, and keeping `sim_end` as the final top-level block (`:211-230`) is structural.

Finally, update the three call sites to drop the `goal` argument: `:368` (`disableOrphanedBlocks(workspace, goalRef.current)` → `greyOrphanedBlocks(workspace)`), `:385` (same), and `:456` inside the goal-change effect (`disableOrphanedBlocks(ws, goal)` → `greyOrphanedBlocks(ws)`).

- [ ] **Step 4: Make explicit insertion attach explicitly — Plan 2 Tasks 11 and 13 depend on it**

Deleting the adoption loop is right (`docs/product-contract.md:36`), but it silently invalidates two Tranche 2 features unless this step lands with it. **Plan 2 Task 11 Step 6.2** comments its starter-chip inserter with *"`normalizeSimulationStructure` … adopts the new top-level block into the `sim_start` SETUP slot on the next change event, which is exactly where a beginner wants it"*, and **Plan 2 Task 13 Step 1** makes the same promise for search-insert: *"For physics projects `normalizeSimulationStructure` then adopts the new top-level block into the `sim_start` SETUP slot … which is where a student searching for `sphere` wants it."* Plan 2's own acceptance step is *"click 'A ball that falls' — a sphere block appears, is adopted into SETUP"*. After Step 3 above, both would drop a **greyed-out orphan** onto the canvas instead.

The distinction the contract draws is between a block the *student* put somewhere and a block the *program* moved on its own. **An insert is the student's gesture; a drag-aside is not.** So insertion attaches explicitly, and only insertion.

1. `appendToSetup` already exists as a local helper inside `normalizeSimulationStructure`'s enclosing scope (`BlocklyWorkspace.js:174`, called at `:200`, `:208` and `:214`). Lift it out of that scope and export it, unchanged in behaviour:

```js
/**
 * Attach `block` to the end of sim_start's SETUP statement input.
 *
 * Exported since Tranche 3 because explicit insertion — a block-search result,
 * an empty-state starter chip — has to attach itself now that the automatic
 * top-block adoption loop is gone (Task 10, product-contract.md:36). Returns
 * false when there is no sim_start to attach to (a data-science or
 * not-yet-anchored canvas), so callers can leave the block where it landed.
 */
export function appendToSetup(workspace, block) {
  …the existing body, taking the workspace explicitly instead of closing over it…
}
```

Keep the three internal calls working by passing the workspace through; behaviour there is unchanged.

2. In `insertBlock` (`BlocklyWorkspace.js`, from **Plan 2 Task 13 Step 1**), call it after `domToWorkspace` and before the centring/`select()`:

```js
      const block = ids && ids.length ? ws.getBlockById(ids[ids.length - 1]) : null;
      if (!block) return false;

      /* An insert is the student asking for the block to be in their program.
         The automatic adoption loop that used to do this is gone (Task 10), so
         attach explicitly — and only here, never on a drag-aside. */
      const attached = appendToSetup(ws, block);
      if (!attached) {
        …the existing centring block, so an unattached block still lands in view…
      }
      block.select();
      return true;
```

3. In `handleInsertStarterBlock` (`IDELayout.js`, from **Plan 2 Task 11 Step 6.2**), do the same and replace Plan 2's now-false comment:

```js
      const ids = Blockly.Xml.domToWorkspace(dom, ws);
      const block = ids && ids.length ? ws.getBlockById(ids[ids.length - 1]) : null;
      /* Explicit attach: Tranche 3 removed the adoption loop this used to
         rely on (Task 10). A starter chip is a request to add the block to
         the program, so it goes into SETUP — a block dragged aside does not. */
      if (block) appendToSetup(ws, block);
```

with `import { appendToSetup } from "../BlocklyWorkspace";` (or from wherever the helper lands if Task 17's restructure moves it — resolve by symbol).

4. Record it in Task 10's own rationale so the next reader sees both halves: the greying is the default, the attach is the exception, and the exception is exactly "the student pointed at this block".

- [ ] **Step 5: Verify by hand and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
npm run start -w frontend
```

Expected: 7 new tests green. In the browser, on a **physics** project: drag a `sphere` block out of `sim_start` and drop it on empty canvas → it must **grey out and stay where you put it**, and the generated Python must lose the sphere. Drag it back inside → it must re-colour and reappear in the code. Then confirm the same on a **data science** project (unchanged behaviour) and on a **hybrid** one with both hats (both programs stay live).

Then re-run **Plan 2's two acceptance checks**, which Step 4 exists to preserve: search `sphere` and click the result → the block appears **attached inside SETUP**, selected, not greyed; and on a blank physics project click the starter chip *"A ball that falls"* → same. If either lands greyed, Step 4 was skipped or `appendToSetup` returned false — check that `sim_start` is on the canvas.

```powershell
git add frontend/src
git commit -m "fix(frontend): orphan blocks are greyed, never adopted — one behaviour for every goal (product-contract.md:36)"
```

---

### Task 11: `helpUrl` on every block, deep-linked to the block reference

**Files:**

- Modify: `frontend/src/utils/blockly/blocklyGenerator.js`
- Modify: `frontend/src/components/HelpPage.js`
- Modify: `frontend/src/components/layout/IDELayout.js`

**Interfaces:**

- Produces: `helpUrl` on all 116 custom block definitions, derived mechanically from the registry id; `HelpPage` accepting a `focusBlockId` prop and scrolling to (and briefly highlighting) the matching anchor.
- Consumes: the reconciled registry (Task 4).

There are **zero** `helpUrl` occurrences across the whole repo, despite an extensive in-app block reference at `HelpPage.js:900-930` and `:1075-1092`. Right-click → Help is dead on every block, which is the single most discoverable "what does this do" gesture Blockly gives away for free.

- [ ] **Step 1: Derive it, do not type it 116 times**

In `frontend/src/utils/blockly/blocklyGenerator.js`, inside `defineCustomBlocksAndGenerator` and **after** the `Blockly.defineBlocksWithJsonArray([...])` call completes, add:

```js
  /* Right-click → Help, on every block we own. Derived from the block id so
     it cannot drift: there were zero helpUrl declarations before Tranche 3,
     while HelpPage.js has carried a full block reference the whole time.
     Stock Blockly blocks keep their own upstream help URLs. */
  for (const entry of REGISTRY_BLOCK_CATALOGUE) {
    const def = Blockly.Blocks[entry.type];
    if (!def) continue;              // stock block, or not yet registered
    if (def.helpUrl) continue;       // never clobber an upstream URL
    def.helpUrl = `#/help?block=${entry.type}`;
  }
```

`REGISTRY_BLOCK_CATALOGUE` is already imported at `:17`. Blockly reads `helpUrl` off the block definition object at render time, so setting it after `defineBlocksWithJsonArray` is enough; no JSON edits, no 116 duplicated strings.

- [ ] **Step 2: Give every block-reference heading a real anchor**

`HelpPage.js` renders its block reference as prose. Add an `id` to each block's entry so the URL has something to reach. Find the component that renders one block row in the reference (search for `help-h3` and the block-list rendering around `:900-930` and `:1075-1092`) and give it:

```jsx
<div className="help-block-entry" id={`help-block-${blockId}`}>
```

If the reference does not currently carry the block id per row, add it from the registry rather than by hand — import `getAllBlockEntries` and key the rows off `entry.id` / `entry.conceptLabel`, which is also what keeps the reference from drifting as blocks are added.

- [ ] **Step 3: Route the deep link**

`HelpPage` gains a prop:

```jsx
export default function HelpPage({ onClose, focusBlockId }) {
```

and an effect that runs once after mount:

```jsx
  /* Deep link from a block's right-click → Help (helpUrl "#/help?block=<id>"). */
  useEffect(() => {
    if (!focusBlockId) return;
    const el = document.getElementById(`help-block-${focusBlockId}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("help-block-entry--focused");
    const t = setTimeout(() => el.classList.remove("help-block-entry--focused"), 2000);
    return () => clearTimeout(t);
  }, [focusBlockId]);
```

with the highlight styled in `styles.css`:

```css
.help-block-entry--focused {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
  border-radius: var(--radius);
}
```

In `frontend/src/components/layout/IDELayout.js`, hold the focused id beside `showHelp` and open Help when a `helpUrl` hash arrives. Add near `handleHelp` (`:83`):

```js
  /* Blockly opens helpUrl by navigating; intercept the hash instead of
     letting it change the route. */
  const [helpBlockId, setHelpBlockId] = useState(null);
  useEffect(() => {
    const onHash = () => {
      const m = /^#\/help\?block=([A-Za-z0-9_]+)$/.exec(window.location.hash);
      if (!m) return;
      setHelpBlockId(m[1]);
      setShowHelp(true);
      // Restore the URL so Help is closable and the route is untouched.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, [setShowHelp]);
```

and pass it at all three `<HelpPage …>` call sites (`:280`, `:291`, `:335`), clearing it on close:

```jsx
{showHelp && (
  <HelpPage
    focusBlockId={helpBlockId}
    onClose={() => { setShowHelp(false); setHelpBlockId(null); }}
  />
)}
```

Extend the React import at `:21` with `useEffect`.

- [ ] **Step 4: Verify by hand and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
npm run start -w frontend
```

In the browser: right-click a `sphere` block → **Help** → the Help overlay opens scrolled to the Sphere entry with a focus ring on it. Right-click `ds_calc_mean_block` in a data project → the same. Close Help → the URL is unchanged and the workspace is where you left it. Then:

```powershell
git grep -c "helpUrl" -- frontend/src
git add frontend/src
git commit -m "feat(frontend): helpUrl on every block, deep-linked into the in-app block reference"
```

---

### Task 12: One label voice

**Files:**

- Modify: `frontend/src/utils/blockly/blocklyGenerator.js`

**Interfaces:**

- Produces: twelve block labels rewritten from Python call syntax to natural language, with the Python form moved into the tooltip's first line.
- Consumes: nothing. Purely a copy change; no generator output changes.

The drawer currently mixes two voices with no rule: `"Simulation Start %1"` (`:844`), `"forever %1 do %2"` (`:644`) and `"time step dt = %1"` (`:672`) sit beside `rate( %1 )` (`:635`), `mag( %1 )` (`:207`), `cross( %1 , %2 )` (`:890`) and `code: %1` (`:761`). `rate( 100 )` is directly beside `forever do` in the same flyout. Twelve labels are Python call forms; every other block is already natural language, so the rule is: **natural language on the block, the Python form as the tooltip's first line.**

- [ ] **Step 1: Rewrite the twelve**

| Line | Block                    | `message0` was             | becomes                             | tooltip gains, as its first line                                          |
| ---- | ------------------------ | ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------- |
| 98   | `vector_block`         | `"vector( %1 , %2 , %3 )"` | `"vector x %1  y %2  z %3"`       | `vector(x, y, z) — `                                                   |
| 152  | `expr_block`           | `"( %1 )"`                 | `"expression %1"`                 | `Any Python expression. `                                               |
| 207  | `mag_block`            | `"mag( %1 )"`              | `"length of %1"`                  | `mag(v) — `                                                            |
| 216  | `norm_block`           | `"norm( %1 )"`             | `"direction of %1"`               | `norm(v) — `                                                           |
| 635  | `rate_block`           | `"rate( %1 )"`             | `"run at %1 steps per second"`    | `rate(n) — `                                                           |
| 760  | `python_raw_block`     | `"code: %1"`               | `"run Python %1"`                 | *(tooltip already explains it; prefix with `Raw Python statement. `)* |
| 890  | `cross_product_block`  | `"cross( %1 , %2 )"`       | `"cross product of %1 and %2"`    | `cross(a, b) — `                                                       |
| 902  | `dot_product_block`    | `"dot( %1 , %2 )"`         | `"dot product of %1 and %2"`      | `dot(a, b) — `                                                         |
| 938  | `vector_compose_block` | `"vector( %1 , %2 , %3 )"` | `"build vector x %1  y %2  z %3"` | `vector(x, y, z) — `                                                   |
| 952  | `math_min_block`       | `"min( %1 , %2 )"`         | `"smaller of %1 and %2"`          | `min(a, b) — `                                                         |
| 964  | `math_max_block`       | `"max( %1 , %2 )"`         | `"larger of %1 and %2"`           | `max(a, b) — `                                                         |
| 988  | `math_clamp_block`     | `"clamp( %1 , %2 , %3 )"`  | `"keep %1 between %2 and %3"`     | `clamp(value, lo, hi) — `                                              |

`vector_block` and `vector_compose_block` share a label today; the "build" prefix on the composable one is what tells a student which is which — the first takes typed numbers, the second takes slots.

- [ ] **Step 2: Record the rule where the next person will hit it**

Add to the header comment of `blocklyGenerator.js`, under the category list:

```
 * Label voice (one rule, Tranche 3):
 *   message0 is NATURAL LANGUAGE — "length of %1", not "mag( %1 )". The
 *   Python form belongs on the first line of the tooltip, where a student
 *   who wants to read the generated code can find it. Twelve blocks were
 *   converted; a new block that names a Python function on its face is a
 *   review comment.
```

- [ ] **Step 3: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -nE 'message0: "[a-z_]+\( ' -- frontend/src/utils/blockly/blocklyGenerator.js
```

Expected: tests green (the Python generator is untouched — these are labels, not code); build clean; **the grep returns nothing**.

Then confirm no generator regression: open each of the four block templates, switch to Code view, and check the Python is byte-identical to before.

```powershell
git add frontend/src/utils/blockly/blocklyGenerator.js
git commit -m "refactor(frontend): one label voice — natural language on the block, Python in the tooltip"
```

---

### Task 13: `describeRunError` — errors a student can act on

**Files:**

- Create: `frontend/src/utils/runner/describeRunError.js`, `frontend/src/utils/runner/__tests__/describeRunError.test.js`
- Modify: `frontend/src/utils/runner/glowRunner.js`
- Modify: `frontend/src/hooks/useSimulation.js`
- Modify: `frontend/src/constants/index.js`

**Interfaces:**

- Produces: `describeRunError(err)` → `{ title, detail, line, raw }` — pure, no DOM, no imports.
- Produces: `DEBUG_RUNNER` in `constants/index.js`, gating the three per-run source dumps.
- Produces: swallowed async rejections routed through `setStatus({type:"error"})` + `setRunning(false)`.

Three failures compound today. **(a)** Errors are wrapped up to three times — `compileSource` throws `"Compile error: …"` (`:256-264`), `executeCompiled` rethrows `"Runtime error: …"` (`:368`, `:380`), and `runPython` wraps that again as `"Execution error: …"` (`:484`) — so a student reads `Execution error: Runtime error: …`, referencing JavaScript rather than Python, with 120 characters of raw source (`:257`) or 300 characters of compiled JS (`:472`) appended. **(b)** Two async rejection paths only `console.error` (`:375-378`, `:396-402`), so a simulation can die mid-flight while the status still reads "Simulation started", the running dot keeps pulsing, and the trace table freezes on its last values. **(c)** Up to 4000 characters of Python source is logged every run under a leftover `/* ── DEBUG ── */` comment (`:219-223`), plus 1000 characters of compiled JS (`:362-367`) and more at `:452-456`, burying the one console message that matters.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/runner/__tests__/describeRunError.test.js`:

```js
import { describe, test, expect } from "vitest";
import { describeRunError } from "../describeRunError";

describe("describeRunError", () => {
  test("unwraps the triple prefix glowRunner builds", () => {
    const d = describeRunError(
      new Error("Execution error: Runtime error: NameError: name 'balll' is not defined"),
    );
    expect(d.title).not.toMatch(/Execution error|Runtime error/);
    expect(d.title).toBe("There's no variable called “balll”.");
    expect(d.raw).toContain("Execution error:");
  });

  test("strips the source preview compileSource appends", () => {
    const d = describeRunError(
      new Error("Compile error: Unexpected token at line 7 | src: sphere ( pos = vector 0 0 0 )"),
    );
    expect(d.detail).not.toContain("| src:");
    expect(d.line).toBe(7);
  });

  test("strips the compiled-JS preview the no-canvas path appends", () => {
    const d = describeRunError(
      new Error(
        "Execution error: GlowScript executed but no canvas was rendered. __main__: function. Preview: var x = 1; var y",
      ),
    );
    expect(d.detail).not.toContain("Preview:");
    expect(d.title).toBe("The simulation ran but drew nothing.");
  });

  test("maps a missing-object error to plain English", () => {
    const d = describeRunError(new Error("Runtime error: TypeError: ball is undefined"));
    expect(d.title).toBe("Something used “ball” before it was created.");
  });

  test("maps an indentation error", () => {
    const d = describeRunError(new Error("Compile error: IndentationError: expected an indented block (line 12)"));
    expect(d.title).toBe("A line is indented wrongly.");
    expect(d.line).toBe(12);
  });

  test("maps a divide-by-zero", () => {
    const d = describeRunError(new Error("Runtime error: ZeroDivisionError: division by zero"));
    expect(d.title).toBe("Something was divided by zero.");
  });

  test("maps the engine-not-loaded failures to one offline sentence", () => {
    for (const msg of [
      "Failed to load script: /vendor/glowscript/glow.3.2.min.js",
      "GlowScript compiler did not load (RScompiler). Diagnostics: {}",
      "GlowScript runtime dependency missing: jQuery UI resizable() not loaded. Diagnostics: {}",
    ]) {
      const d = describeRunError(new Error(msg));
      expect(d.title, msg).toBe("The 3D engine could not start.");
      expect(d.detail, msg).toMatch(/reload the page/i);
    }
  });

  test("an empty program says so", () => {
    const d = describeRunError(new Error("Compile error: VPython source is empty."));
    expect(d.title).toBe("There's nothing to run yet.");
  });

  test("an unrecognised message survives intact, minus the wrappers", () => {
    const d = describeRunError(new Error("Execution error: Runtime error: something entirely new"));
    expect(d.title).toBe("The simulation stopped with an error.");
    expect(d.detail).toBe("something entirely new");
    expect(d.line).toBeNull();
  });

  test("accepts a bare string and a null without throwing", () => {
    expect(describeRunError("Runtime error: ZeroDivisionError: division by zero").title).toBe(
      "Something was divided by zero.",
    );
    const d = describeRunError(null);
    expect(d.title).toBe("The simulation stopped with an error.");
    expect(d.detail).toBe("");
  });

  test("is pure — the same input always gives the same output", () => {
    const e = new Error("Runtime error: ZeroDivisionError: division by zero");
    expect(describeRunError(e)).toEqual(describeRunError(e));
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

Create `frontend/src/utils/runner/describeRunError.js`:

```js
/**
 * describeRunError — turn a runner exception into something a 15-year-old can act on.
 *
 * glowRunner wraps failures up to three times: compileSource throws
 * "Compile error: …", executeCompiled rethrows "Runtime error: …", and
 * runPython wraps that again as "Execution error: …". It then appends either
 * 120 characters of raw source or 300 characters of compiled JavaScript. A
 * student was reading "Execution error: Runtime error: TypeError: ball is
 * undefined | src: sphere ( pos = vect…" and learning nothing.
 *
 * Pure: no DOM, no imports, no side effects. Technical payloads survive on
 * `.raw` for the console; nothing is thrown away, it is just not shouted.
 */

const WRAPPERS = /^(?:Execution error:\s*|Runtime error:\s*|Compile error:\s*)+/;
const SOURCE_PREVIEW = /\s*\|\s*src:.*$/s;
const JS_PREVIEW = /\s*Preview:.*$/s;
const DIAGNOSTICS = /\s*Diagnostics:.*$/s;
const MAIN_NOTE = /\s*__main__:\s*\w+\.?/;

/** [matcher, title, detail-builder] — first match wins, so order is meaning. */
const RULES = [
  [
    /Failed to load script|did not load|did not initialize|dependency missing/i,
    "The 3D engine could not start.",
    () =>
      "The simulation engine files did not load. Check your connection, then reload the page and press Run again.",
  ],
  [
    /VPython source is empty/i,
    "There's nothing to run yet.",
    () => "Add some blocks (or write some code) before pressing Run.",
  ],
  [
    /no canvas was rendered/i,
    "The simulation ran but drew nothing.",
    () =>
      "Your program finished without creating any 3D objects. Add a sphere, box or arrow inside Simulation Start.",
  ],
  [
    /NameError: name '([^']+)' is not defined/i,
    (m) => `There's no variable called “${m[1]}”.`,
    (m) =>
      `Check the spelling, or create it before you use it — a "set" block above the line that reads it.`,
  ],
  [
    /(?:TypeError:\s*)?(\w+) is (?:undefined|not defined)/i,
    (m) => `Something used “${m[1]}” before it was created.`,
    (m) => `Move the block that creates “${m[1]}” above the block that uses it.`,
  ],
  [
    /IndentationError/i,
    "A line is indented wrongly.",
    () => "In Code view, make sure every line inside a loop or an if is indented by the same amount.",
  ],
  [
    /ZeroDivisionError|division by zero/i,
    "Something was divided by zero.",
    () => "A value you divided by reached 0. Check the denominators in your formulas.",
  ],
  [
    /SyntaxError|Unexpected token|Unexpected identifier/i,
    "Python couldn't read one of your lines.",
    (m, rest) => `There's a typo near${m.index != null ? "" : ""} the reported line. ${rest}`.trim(),
  ],
  [
    /AttributeError: .*has no attribute '([^']+)'/i,
    (m) => `That object has no property called “${m[1]}”.`,
    () => "Check the property name — spheres have pos, radius, color and velocity, for example.",
  ],
  [
    /is not a function|is not callable/i,
    "Something was used as if it were a function.",
    () => "Check for a missing operator, or a variable name that shadows a built-in like mag or norm.",
  ],
];

function firstLineNumber(text) {
  const m = /(?:\bline\s+|\(line\s+)(\d+)/i.exec(text);
  return m ? Number(m[1]) : null;
}

/**
 * @param {unknown} err
 * @returns {{title: string, detail: string, line: number|null, raw: string}}
 */
export function describeRunError(err) {
  const raw = err == null ? "" : String(err && err.message ? err.message : err);

  let text = raw.replace(WRAPPERS, "");
  const line = firstLineNumber(text);
  text = text
    .replace(SOURCE_PREVIEW, "")
    .replace(JS_PREVIEW, "")
    .replace(DIAGNOSTICS, "")
    .replace(MAIN_NOTE, "")
    .trim();

  for (const [pattern, title, detail] of RULES) {
    const m = pattern.exec(text);
    if (!m) continue;
    return {
      title: typeof title === "function" ? title(m) : title,
      detail: typeof detail === "function" ? detail(m, text) : detail,
      line,
      raw,
    };
  }

  return { title: "The simulation stopped with an error.", detail: text, line, raw };
}
```

- [ ] **Step 3: Gate the console dumps**

Add to `frontend/src/constants/index.js`, in the trace/debug section:

```js
/** Per-run source and compiled-JS dumps. Off in production; up to 4 KB of
 *  console noise per run when on, which used to bury the one message that
 *  mattered. Set to `true` locally when working on the generator. */
export const DEBUG_RUNNER = import.meta.env?.DEV === true;
```

In `frontend/src/utils/runner/glowRunner.js`, add `import { DEBUG_RUNNER } from "../../constants";` and wrap all three dumps:

- `:219-223` — the `/* ── DEBUG ── */` Python-source log in `buildSource`. Wrap in `if (DEBUG_RUNNER) { … }` and delete the stale `── DEBUG ──` comment.
- `:362-367` — the compiled-JS preview in the `eval` catch. Wrap the `console.error`'s preview argument: keep `console.error("[PhysicsIDE] eval() failed:", runtimeErr.message)` unconditional (that one matters) and gate only the `"\nCompiled JS preview…"` half.
- `:452-456` — the code-instrumentation count log. Wrap in `if (DEBUG_RUNNER)`.

- [ ] **Step 4: Stop swallowing async rejections**

The two `.catch(() => console.error(...))` paths need a way to reach React. Add a module-level sink at the top of `glowRunner.js`, beside `activeFrameWindow` (`:11-12`):

```js
/** Set by useSimulation so a rejection AFTER runPython resolves can still
 *  reach the status bar. Before Tranche 3 these only console.error'd, so a
 *  dead simulation went on claiming it was running. */
let runtimeErrorSink = null;

export function setRuntimeErrorSink(fn) {
  runtimeErrorSink = typeof fn === "function" ? fn : null;
}

function reportAsyncRuntimeError(err) {
  console.error("[PhysicsIDE] runtime error after start:", err);
  if (runtimeErrorSink) runtimeErrorSink(err);
}
```

Replace the two swallow sites:

```js
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.catch(reportAsyncRuntimeError);
      }
```

```js
      if (result && typeof result.then === "function") {
        result.catch(reportAsyncRuntimeError);
      }
```

And install a frame-level net inside `createRuntimeFrame`, immediately before `return iframe;` (`:194`):

```js
  const frameWindow = iframe.contentWindow;
  frameWindow.addEventListener("error", (e) => reportAsyncRuntimeError(e.error || e.message));
  frameWindow.addEventListener("unhandledrejection", (e) => reportAsyncRuntimeError(e.reason));
```

- [ ] **Step 5: Surface it in the shell**

In `frontend/src/hooks/useSimulation.js`, import both new pieces:

```js
import {
  runPython,
  stopPython,
  setBreakpoints as syncBreakpointsToIframe,
  setRuntimeErrorSink,
} from "../utils/runner/glowRunner";
import { describeRunError } from "../utils/runner/describeRunError";
```

Rewrite the `handleRun` catch (`:67-71`):

```js
    } catch (err) {
      const d = describeRunError(err);
      console.error("[PhysicsIDE]", d.raw);
      setRunning(false);
      setStatus({
        text: d.line ? `${d.title} (line ${d.line})` : d.title,
        detail: d.detail,
        type: "error",
      });
    }
```

and register the sink once, near the top of the hook body:

```js
  /* A rejection AFTER runPython resolves used to only console.error, leaving
     the status bar claiming "Simulation started" over a dead simulation. */
  useEffect(() => {
    setRuntimeErrorSink((err) => {
      const d = describeRunError(err);
      setRunning(false);
      setStatus({ text: d.title, detail: d.detail, type: "error" });
    });
    return () => setRuntimeErrorSink(null);
  }, [setRunning, setStatus]);
```

Extend the react import at `:8` to `{ useCallback, useEffect }`. The extra `detail` field on the status object is additive — `IDELayout.js:497-500` renders `status.text` and ignores unknown keys, so nothing breaks; Task 17 renders `detail` in the docked problem strip.

- [ ] **Step 6: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: 11 new tests green. Then prove it in the browser: in Code view, run `sphere(pos=balll)` and confirm the status bar reads **There's no variable called "balll".** rather than `Execution error: Runtime error: …`. Run an empty program and confirm **There's nothing to run yet.** Check the console: at most one line per run in a production build.

```powershell
git add frontend/src
git commit -m "feat(frontend): describeRunError — plain-English failures, no swallowed async errors, gated source dumps"
```

---

### Task 14: Breakable ids — only offer a breakpoint where one can fire

**Files:**

- Modify: `frontend/src/utils/blockly/traceRegistry.js`
- Modify: `frontend/src/utils/blockly/blocklyGenerator.js`
- Modify: `frontend/src/contexts/DebugContext.js`
- Modify: `frontend/src/hooks/useSimulation.js`
- Modify: `frontend/src/utils/runner/glowRunner.js`
- Modify: `frontend/src/components/BlocklyWorkspace.js`
- Modify: `frontend/src/components/CodeEditor.js`
- Modify: `frontend/src/styles.css`

**Interfaces:**

- Produces: `breakableIds()` on the trace registry; `breakableIds` + `isBreakable(id)` on `DebugContext`; a context-menu "Set breakpoint" / "Remove breakpoint" entry that is *disabled with a reason* on non-breakable blocks; a hollow marker on breakable blocks while debug mode is on; a `runPython(code, hostId, { breakpoints })` option that seeds the set **before** `eval`.
- Consumes: `blocklyLib` (Task 1).

Two lies, one root cause. **(a)** `BlocklyWorkspace.js:528-539` lets a click on any element with `data-id` toggle a breakpoint, and the UI confirms it with a red glow and an "N bp" badge — but only checkpoints can pause (`glowRunner.js:342-344`), and a checkpoint exists only where the generator called `tr()`: **seven block types**, at `blocklyGenerator.js:2126, 2133, 2144, 2151, 2158, 2182, 2286` (`update_position_block`, `apply_force_block`, `set_scalar_block`, `set_attr_expr_block`, `add_attr_expr_block`, `time_step_block`, `define_const_block`). A breakpoint on `sphere(...)`, `rate(100)`, an `if`, or a loop header never fires, and nothing says so. **(b)** Even on a breakable block, a breakpoint meant to catch the *first* iteration is skipped: `useSimulation.js:61-62` syncs breakpoints **after** `await runPython`, which itself waits 120 ms at `glowRunner.js:468` after `__main__()` has already started the loop, and `executeCompiled` resets the set to empty at `:290`.

- [ ] **Step 1: Publish the breakable set**

In `frontend/src/utils/blockly/traceRegistry.js`, append:

```js
/**
 * The block ids that can actually hold a breakpoint.
 *
 * Only a trace checkpoint can pause the runtime (glowRunner.js injects the
 * pause loop alongside each `_phtr_` assignment), and a checkpoint exists only
 * where the generator called tr() — seven block types. Before Tranche 3 the UI
 * happily accepted a breakpoint on any block and then never fired it.
 *
 * Valid only after a code-generation pass; call it from the same place that
 * reads `traceRegistry`.
 */
export function breakableIds() {
  const out = new Set();
  for (const e of traceRegistry) if (e.blockId) out.add(e.blockId);
  return out;
}
```

For **code** projects the equivalent already exists: `instrumentPythonForDebug` returns entries whose `blockId` is `line_<N>` (`instrumentor.js:119-121`). Task 16 extends that set; nothing changes here.

- [ ] **Step 2: Carry it on the context**

In `frontend/src/contexts/DebugContext.js`, add state and a setter beside `breakpoints` (`:24-26`):

```js
  const [breakableIds, setBreakableIds] = useState(() => new Set());
```

an `isBreakable` helper:

```js
  /** A breakpoint on a non-breakable block would be accepted and never fire. */
  const isBreakable = (blockId) => breakableIds.has(blockId);
```

guard `toggleBreakpoint` so a breakpoint can never be *set* where it cannot fire (removing one is always allowed, so an old project's stale breakpoints can be cleared):

```js
  const toggleBreakpoint = (blockId) => {
    if (!blockId) return;
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else if (breakableIds.has(blockId)) next.add(blockId);
      return next;
    });
  };
```

and add `breakableIds, setBreakableIds, isBreakable` to the context `value` object at `:46-52`.

Publish into it from wherever code generation completes. In `frontend/src/hooks/useSimulation.js`, `syncFromBlocks` (`:43-50`) is the single funnel — extend it:

```js
  const syncFromBlocks = useCallback(() => {
    if (!workspaceRef.current) return pythonCode;
    if (workspaceRef.current.getAllBlocks(false).length === 0) return pythonCode;
    const generated = generatePythonFromWorkspace(workspaceRef.current);
    setBreakableIds(breakableIdsFromRegistry());
    const code = generated || DEFAULT_PYTHON_CODE;
    setPythonCode(code);
    return code;
  }, [pythonCode, setPythonCode, setBreakableIds, workspaceRef]);
```

with `import { breakableIds as breakableIdsFromRegistry } from "../utils/blockly/traceRegistry";` and `setBreakableIds` destructured from `useDebugContext()` at `:39`.

- [ ] **Step 3: Seed breakpoints BEFORE `eval`**

In `frontend/src/utils/runner/glowRunner.js`, give `executeCompiled` and `runPython` an options parameter. At `:286` and `:290`:

```js
async function executeCompiled(frameWindow, compiledCode, traceEntries, initialBreakpoints) {
  activeFrameWindow = frameWindow;
  frameWindow.__physide_paused = false;
  frameWindow.__physide_steps = 0;
  /* Seeded BEFORE eval so a breakpoint aimed at the FIRST iteration — the
     common case when debugging initial conditions — actually catches it.
     Until Tranche 3 this was `new Set()` and useSimulation re-armed it after
     `await runPython`, which returns 120 ms after __main__() starts the loop. */
  frameWindow.__physide_breakpoints =
    initialBreakpoints instanceof Set ? new Set(initialBreakpoints) : new Set(initialBreakpoints || []);
```

At `:406` and `:462`:

```js
export async function runPython(codeString, hostId = "glowscript-host", opts = {}) {
```

```js
    await executeCompiled(frameWindow, compiledCode, traceEntries, opts.breakpoints);
```

Then in `frontend/src/hooks/useSimulation.js`, `handleRun` passes them in and stops re-arming afterwards. Replace `:60-62`:

```js
      stopPython(GLOWSCRIPT_HOST_ID);
      await runPython(code, GLOWSCRIPT_HOST_ID, {
        breakpoints: debugMode ? breakpointsRef.current : new Set(),
      });
```

The `debugMode ? … : new Set()` is the second half of the review's finding: `useDebug.js:33-43` clears running/paused/recording on exit but never `breakpoints`, so a student who left debug mode and pressed Run got a simulation that froze on the first iteration with no PAUSED indicator and no Resume control anywhere — indistinguishable from a hang. Breakpoints are now *kept* (so re-entering debug mode finds them) but only *armed* in debug mode.

Delete the now-dead `syncBreakpointsToIframe(breakpointsRef.current);` line that followed the `await`. `setBreakpoints` (the exported runner function) stays — `DebugContext`'s effect at `:30-33` still uses it to push *changes* into a running frame.

Add the chip the review asks for. In `frontend/src/contexts/DebugContext.js`, that same effect becomes:

```js
  useEffect(() => {
    breakpointsRef.current = breakpoints;
    syncBreakpointsToIframe(breakpoints);
  }, [breakpoints]);
```

(unchanged) — and Task 17 renders `breakpoints.size` in the toolbar's debug group, where it is visible in both modes.

- [ ] **Step 4: Replace click-anywhere with a context-menu entry that tells the truth**

In `frontend/src/components/BlocklyWorkspace.js`, delete the `domClickHandler` breakpoint toggle in `ReadOnlyBlockly` (`:524-539` plus its `addEventListener`/`removeEventListener` at `:539` and `:554`) — Task 17 deletes `ReadOnlyBlockly`'s debug role entirely, and the editable workspace needs a gesture that does not fight dragging.

Register the context-menu item once, in the mount effect after `Blockly.inject` (after `:339`):

```js
    /* Right-click → breakpoint. A click-anywhere toggle would fight dragging
       in the editable workspace, and the old one accepted breakpoints on
       blocks that can never pause. This entry is DISABLED with a reason on
       those, which is the whole point: the debugger stops lying. */
    const BP_ITEM_ID = "physide_toggle_breakpoint";
    if (!Blockly.ContextMenuRegistry.registry.getItem(BP_ITEM_ID)) {
      Blockly.ContextMenuRegistry.registry.register({
        id: BP_ITEM_ID,
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        weight: 20,
        preconditionFn: (scope) =>
          debugApiRef.current.isBreakable(scope.block.id) ? "enabled" : "disabled",
        displayText: (scope) => {
          const api = debugApiRef.current;
          if (!api.isBreakable(scope.block.id)) {
            return "Can't pause here — this block doesn't report a value";
          }
          return api.breakpoints.has(scope.block.id) ? "Remove breakpoint" : "Set breakpoint";
        },
        callback: (scope) => debugApiRef.current.toggleBreakpoint(scope.block.id),
      });
    }
```

`debugApiRef` is a ref the component keeps current, so the `[]`-deps mount effect never closes over stale state. Add near `goalRef` (`:282`), with the props threaded from `IDELayout` in Task 17:

```js
  const debugApiRef = useRef({ isBreakable: () => false, toggleBreakpoint: () => {}, breakpoints: new Set() });
  debugApiRef.current = { isBreakable, toggleBreakpoint, breakpoints };
```

Also add Alt+click as the fast path for students who find right-click slow, in the same effect:

```js
    const altClickHandler = (e) => {
      if (!e.altKey) return;
      const block = Blockly.common.getSelected();
      if (!block) return;
      e.preventDefault();
      debugApiRef.current.toggleBreakpoint(block.id);
    };
    hostRef.current.addEventListener("click", altClickHandler);
```

with the matching `removeEventListener` in the cleanup at `:441-447`.

- [ ] **Step 5: Mark what is breakable, legibly**

Extend the breakpoint-decoration effect (currently `ReadOnlyBlockly`'s at `:571-599`, moving to `BlocklyWorkspace` in Task 17) so it paints two states, not one:

```js
  /* Two markers, not one: a solid red outline where a breakpoint is SET, and
     a hollow dashed outline on every block that CAN hold one while debug mode
     is on. A student can now see the difference between "I didn't set it" and
     "this block can never pause". */
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    for (const block of ws.getAllBlocks(false)) {
      const g = block.getSvgRoot();
      if (!g) continue;
      g.classList.toggle("bp-block", breakpoints.has(block.id));
      g.classList.toggle("bp-available", debugMode && !breakpoints.has(block.id) && isBreakable(block.id));
    }
  }, [breakpoints, debugMode, breakableIds]);
```

and in `frontend/src/styles.css`, beside the `.bp-block` rule Task 7 wrote:

```css
/* Breakpoint CAN be set here (debug mode only). Deliberately quiet: it is an
   affordance, not a state. */
.bp-available > .blocklyPath {
  stroke: color-mix(in srgb, var(--red) 55%, transparent) !important;
  stroke-width: 2px !important;
  stroke-dasharray: 4 4 !important;
}
```

- [ ] **Step 6: Only instrumentable lines get a Monaco gutter breakpoint**

`CodeEditor.js` currently makes every line clickable. Pass the breakable set in and refuse the rest. In `frontend/src/components/CodeEditor.js`, the component already takes `breakpointLines` and `onToggleLineBreakpoint`; add `breakableLines` (a `Set<number>`) and, in the glyph-margin click handler, ignore a click on a line not in it — plus render a hollow glyph on the ones that are. The line set is derived in `IDELayout` from the same `breakableIds`:

```js
  const breakableLines = new Set(
    [...dbg.breakableIds].flatMap((id) => {
      const m = /^line_(\d+)$/.exec(String(id));
      return m ? [Number(m[1])] : [];
    }),
  );
```

- [ ] **Step 7: Verify by hand and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
npm run start -w frontend
```

In the browser, on a **physics** block project with debug mode on:

1. Right-click an `update position` block → **Set breakpoint** is enabled. Set it; the block gets a solid red outline.
2. Right-click a `sphere` block → the entry reads **Can't pause here — this block doesn't report a value** and is greyed. It cannot be clicked.
3. Every `set`, `add to`, `update position`, `apply force`, `time step` and `define constant` block shows a dashed hollow outline; nothing else does.
4. Set a breakpoint on `time step dt` and press **Run**. It must pause on the **first** iteration — the trace table shows one row and stops.
5. Leave debug mode, press **Run**: the simulation runs freely and does not freeze.
6. Re-enter debug mode: the breakpoint is still there.

```powershell
git add frontend/src
git commit -m "fix(frontend): breakpoints only where they can fire, seeded before eval, and not armed outside debug mode"
```

---

### Task 15: Pause tells the truth; stepping advances a frame

**Files:**

- Modify: `frontend/src/utils/runner/glowRunner.js`
- Modify: `frontend/src/contexts/DebugContext.js`
- Modify: `frontend/src/hooks/useDebug.js`
- Modify: `frontend/src/hooks/useTrace.js`
- Modify: `frontend/src/constants/index.js`

**Interfaces:**

- Produces: a `__phpause` acknowledgement posted from the runtime; `pauseState` on `DebugContext` (`"running" | "pausing" | "paused"`); `stepFrame()` alongside `stepPython()`; an `iteration` / `stepOfFrame` readout carried on the trace channel.
- Consumes: Task 14's breakable ids.

**Pause lies.** `glowRunner.js:498-503` sets `__physide_paused = true`, a flag consumed only at the next trace checkpoint, while `useDebug.js:45-48` flips React's `paused` immediately. On a program with no traced variables the Pause button lights up, the PAUSED badge appears, and the simulation keeps running — the UI actively asserts a machine state that is false.

**Stepping is the wrong unit.** `glowRunner.js:346-353` decrements `__physide_steps` at *each* trace checkpoint, and `DebugMode.js:229` titles the control "Step forward one trace event". In a loop with four traced variables, four presses of F10 advance a single timestep and the viewport barely moves. A physics student thinks in frames.

**And the highlight vanishes while paused.** `useTrace.js:70-74` clears `executingBlockId` on an unconditional 250 ms timer (`constants/index.js:31`). When execution actually pauses, trace events stop arriving, so a quarter-second later the student is paused with nothing indicating where.

- [ ] **Step 1: Acknowledge the pause from inside the runtime**

In `frontend/src/utils/runner/glowRunner.js`, extend the injected checkpoint (the template string at `:338-354`). The additions are the two `__phpause` posts and the frame counter:

```js
        return (
          prefix + value + semi +
          "try{parent.postMessage({type:'__phtr',n:'" + dn +
          "',v:String(_phtr_" + safeName +
          "),b:'" + bid + "',i:(window.__physide_iter||0)},'*');" +
          "if(window.__physide_breakpoints&&window.__physide_breakpoints.has('" + bid + "')){" +
          "window.__physide_paused=true;window.__physide_steps=0;}" +
          "if(window.__physide_paused){" +
          "if(window.__physide_steps>0){window.__physide_steps--;}" +
          "else{" +
          "parent.postMessage({type:'__phpause',paused:true,b:'" + bid + "',i:(window.__physide_iter||0)},'*');" +
          "await new Promise(function(r){" +
          "var _pi=setInterval(function(){" +
          "if(!window.__physide_paused||window.__physide_steps>0){" +
          "clearInterval(_pi);" +
          "if(window.__physide_steps>0)window.__physide_steps--;" +
          "parent.postMessage({type:'__phpause',paused:false},'*');" +
          "r();}},30);})}" +
          "}}catch(_e){}"
        );
```

For per-frame stepping the runtime needs to know where a frame boundary is. `rate()` is the one call every simulation loop makes, so instrument it in the same regex pass, immediately after the trace injection block (still inside `executeCompiled`):

```js
  /* Frame boundaries. Every VPython animation loop calls rate(); that call is
     the only reliable "one timestep has elapsed" marker available without a
     Python-level AST pass. The counter feeds the "iteration N" readout, and
     __physide_frame_steps makes "Next frame" a real unit rather than "next
     trace event" (which advanced a quarter of a timestep in a four-variable
     loop). */
  traceInjected = traceInjected.replace(
    /\b(await\s+)?rate\s*\(/g,
    "window.__physide_iter=(window.__physide_iter||0)+1;" +
      "if(window.__physide_frame_steps>0){window.__physide_frame_steps--;" +
      "if(window.__physide_frame_steps===0){window.__physide_paused=true;window.__physide_steps=0;}}" +
      "$&",
  );
```

and initialise the two new globals in `executeCompiled` beside the others:

```js
  frameWindow.__physide_iter = 0;
  frameWindow.__physide_frame_steps = 0;
```

Add the exported control:

```js
/** Advance exactly one animation frame (one rate() call), then pause again. */
export function stepFrame() {
  if (!activeFrameWindow) return;
  activeFrameWindow.__physide_frame_steps = 1;
  activeFrameWindow.__physide_steps = 0;
  activeFrameWindow.__physide_paused = false;
}
```

- [ ] **Step 2: Only claim "paused" once the runtime says so**

Add to `frontend/src/constants/index.js`:

```js
/** How long to wait for the runtime's __phpause acknowledgement before telling
 *  the student the truth: this program has nothing to pause on. */
export const PAUSE_ACK_TIMEOUT_MS = 1000;
```

In `frontend/src/contexts/DebugContext.js`, replace the boolean `paused` story with a three-state one. `paused` itself lives on `SimulationContext` and stays (other code reads it); what is added here is the honest intermediate:

```js
  /** "running" | "pausing" | "paused" — the UI must never claim "paused"
   *  before the runtime acknowledges. glowRunner sets a flag that is only
   *  consumed at the next trace checkpoint; a program with no traced values
   *  never reaches one. */
  const [pauseState, setPauseState] = useState("running");
```

exported on the context value.

In `frontend/src/hooks/useTrace.js`, handle the new message alongside `__phtr` in `handleMessage` (`:81-94`):

```js
    const handleMessage = (event) => {
      if (event.data?.type === "__phpause") {
        if (event.data.paused) {
          setPauseState("paused");
          setPaused(true);
          if (pauseAckTimerRef.current) clearTimeout(pauseAckTimerRef.current);
        } else {
          setPauseState("running");
          setPaused(false);
        }
        if (typeof event.data.i === "number") setIteration(event.data.i);
        return;
      }
      if (event.data?.type === "__phtr") {
        if (typeof event.data.i === "number") setIteration(event.data.i);
        traceBatch[event.data.n] = { v: event.data.v, b: event.data.b || "" };
        …unchanged…
      }
    };
```

with `pauseAckTimerRef`, `setPauseState` and `setIteration` pulled from the contexts, and `iteration` added to `TraceContext` as plain state.

In `frontend/src/hooks/useDebug.js`, rewrite `handlePause` (`:45-48`):

```js
  const handlePause = useCallback(() => {
    pausePython();
    setPauseState("pausing");
    if (pauseAckTimerRef.current) clearTimeout(pauseAckTimerRef.current);
    pauseAckTimerRef.current = setTimeout(() => {
      /* No checkpoint was reached. Tell the student why instead of showing a
         PAUSED badge over a simulation that never stopped. */
      resumePython();
      setPauseState("running");
      setPaused(false);
      setStatus({
        text: "Can't pause this simulation — it has no traced values.",
        detail:
          "Pausing happens where a block reports a value. Add a “set”, “update position” or “time step” block inside your loop, then try again.",
        type: "error",
      });
    }, PAUSE_ACK_TIMEOUT_MS);
  }, [setPauseState, setPaused, setStatus, pauseAckTimerRef]);
```

`handleResume` clears the timer and sets `pauseState` to `"running"`. `handleStep` keeps `stepPython()` as **Next value**; add its sibling:

```js
  /** The dominant control: one full animation frame. */
  const handleStepFrame = useCallback(() => {
    setPauseState("pausing");
    stepFrame();
  }, [setPauseState]);
```

exported alongside the rest, with `stepFrame` added to the `glowRunner` import at `:8`.

- [ ] **Step 3: Pin the highlight while paused**

In `frontend/src/hooks/useTrace.js`, gate the 250 ms clear (`:70-74`) on the pause state:

```js
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => {
          /* Do NOT clear while paused: trace events stop arriving when the
             runtime stops, so the highlight would vanish a quarter-second
             after the pause and leave the student stopped at nowhere. */
          if (pauseStateRef.current !== "running") return;
          setExecutingBlockId(null);
          try { workspaceRef.current?.highlightBlock(null); } catch (_) {}
        }, HIGHLIGHT_DURATION_MS);
```

`pauseStateRef` is a ref mirror of `pauseState`, added to `DebugContext` the same way `breakpointsRef` already is (`:29-33`) — the effect at `:36-103` has `[]` deps and must not close over state.

The same rule applies to Monaco's executing-line arrow at `CodeEditor.js:139-154`: it is driven by `executingLine`, which derives from `executingBlockId`, so pinning the id pins the arrow with no further change.

- [ ] **Step 4: Verify by hand and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
npm run start -w frontend
```

1. Open the **Projectile** block template, enter debug mode, press **Run**, press **Pause**. The badge must read *Pausing…* briefly and then *Paused*, and the block that stopped must stay highlighted indefinitely.
2. Press **Next frame** repeatedly. The ball must move a visible step each press, and the iteration readout must increment by exactly 1.
3. Press **Next value**. The readout's step-within-frame must advance without the iteration changing.
4. In Code view, run a program with **no** traced variables (`from vpython import *` plus a bare `sphere()`), press **Pause**: after about a second the status must read **Can't pause this simulation — it has no traced values.** and the simulation must still be running — no PAUSED badge.

```powershell
git add frontend/src
git commit -m "fix(frontend): pause is acknowledged by the runtime; Next frame steps a real timestep; highlight pins while paused"
```

---

### Task 16: Setup constants, watch expressions, and values a student can read

**Files:**

- Modify: `frontend/src/utils/runner/instrumentor.js`
- Modify: `frontend/src/utils/runner/__tests__/instrumentor.test.js` (create if absent)
- Modify: `frontend/src/utils/runner/glowRunner.js`
- Modify: `frontend/src/components/TraceTable.js`
- Modify: `frontend/src/contexts/TraceContext.js`
- Modify: `frontend/src/styles.css` (Step 5 only)

**Interfaces:**

- Produces: `instrumentPythonForDebug(source, { watch = [] })` → `{ source, entries }`, where entries now include out-of-loop top-level assignments (`scope: "setup"`) and any watch expressions (`scope: "watch"`), alongside the existing in-loop ones (`scope: "loop"`).
- Produces: a collapsed **Setup / constants** section in the trace table and a watch input that arms an expression for the next run.
- Produces (Step 5, the review's *trace-table value legibility* row): a wider value column, fixed-precision numeric formatting, and min/max + snapshot diff behind an expand-on-click detail row.

`instrumentor.js:100` (`if (!inLoop) continue;`) means mass, `g`, the spring constant, the initial velocity and any out-of-loop `dt` never appear in the trace table — precisely the values a physics student checks first when a simulation misbehaves. And there is no way to ask "what is `0.5*m*v**2` right now" without editing the program.

- [ ] **Step 1: Write the failing test**

Create (or extend) `frontend/src/utils/runner/__tests__/instrumentor.test.js`:

```js
import { describe, test, expect } from "vitest";
import { instrumentPythonForDebug } from "../instrumentor";

const SRC = [
  "GlowScript 3.2 VPython",
  "m = 2.5",
  "g = vector(0, -9.81, 0)",
  "ball = sphere(pos=vector(0,0,0), radius=0.5)",
  "dt = 0.01",
  "while True:",
  "    rate(100)",
  "    ball.velocity = ball.velocity + g * dt",
  "    t = t + dt",
].join("\n");

describe("instrumentPythonForDebug", () => {
  test("still traces in-loop assignments, tagged loop", () => {
    const { entries } = instrumentPythonForDebug(SRC);
    const loop = entries.filter((e) => e.scope === "loop");
    expect(loop.map((e) => e.displayName)).toEqual(["t"]);
    expect(loop[0].blockId).toMatch(/^line_\d+$/);
  });

  test("top-level constants are traced ONCE, before the loop, tagged setup", () => {
    const { source, entries } = instrumentPythonForDebug(SRC);
    const setup = entries.filter((e) => e.scope === "setup").map((e) => e.displayName);
    expect(setup).toEqual(["m", "g", "dt"]);
    // The probe is emitted at top level, i.e. with no indentation.
    expect(source).toMatch(/^_phtr_m_line2 = str\(m\)$/m);
    expect(source).toMatch(/^_phtr_dt_line5 = str\(dt\)$/m);
  });

  test("object constructors are still skipped in both scopes", () => {
    const { entries } = instrumentPythonForDebug(SRC);
    expect(entries.some((e) => e.displayName === "ball")).toBe(false);
  });

  test("watch expressions are appended inside the loop, tagged watch", () => {
    const { source, entries } = instrumentPythonForDebug(SRC, { watch: ["0.5*m*mag(ball.velocity)**2"] });
    const watch = entries.filter((e) => e.scope === "watch");
    expect(watch).toHaveLength(1);
    expect(watch[0].displayName).toBe("0.5*m*mag(ball.velocity)**2");
    expect(watch[0].blockId).toBe("watch_0");
    expect(source).toContain("_phtr_watch_0 = str(0.5*m*mag(ball.velocity)**2)");
    // …and it must be indented into the loop body, not left at top level.
    expect(source).toMatch(/^ {4}_phtr_watch_0 = str\(/m);
  });

  test("a watch expression is sanitised, not executed blindly", () => {
    const { entries } = instrumentPythonForDebug(SRC, {
      watch: ["import os", "", "   ", "m", "a\nb"],
    });
    expect(entries.filter((e) => e.scope === "watch").map((e) => e.displayName)).toEqual(["m"]);
  });

  test("a source with no while loop still yields setup entries", () => {
    const { entries } = instrumentPythonForDebug("a = 1\nb = 2\n");
    expect(entries.map((e) => [e.displayName, e.scope])).toEqual([
      ["a", "setup"],
      ["b", "setup"],
    ]);
  });

  test("is pure — same input, same output, no shared state between calls", () => {
    const a = instrumentPythonForDebug(SRC);
    const b = instrumentPythonForDebug(SRC);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

In `frontend/src/utils/runner/instrumentor.js`:

1. Change the signature and add the watch sanitiser:

```js
/** A watch expression is a single line of Python that must not smuggle in a
 *  statement. Anything with a newline, a leading keyword, or nothing in it is
 *  dropped rather than run. */
const WATCH_REJECT = /^\s*(?:import|from|def|class|while|for|if|return|del|global|nonlocal|raise|assert|with|pass|break|continue)\b/;

function sanitiseWatch(list) {
  return (Array.isArray(list) ? list : [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length > 0 && !s.includes("\n") && !WATCH_REJECT.test(s) && !s.includes("="));
}

export function instrumentPythonForDebug(pythonSource, { watch = [] } = {}) {
```

2. Replace the bail-out at `:100` (`if (!inLoop) continue;`) so top-level assignments are probed too. The entry gains a `scope`, and existing entries gain `scope: "loop"`:

```js
    const am = line.match(ASSIGN_RE);
    if (!am) continue;

    const indent  = am[1];
    const varName = am[2];

    if (BUILTINS.has(varName))   continue;
    if (varName.startsWith('_')) continue;

    /* Skip VPython object constructor assignments */
    const eqIdx  = line.search(/(?:[+\-*/%&|^]|\*\*|\/\/)?=(?!=)/);
    const rhsTrim = eqIdx >= 0 ? line.slice(eqIdx + 1).trim() : '';
    if (SKIP_CONSTRUCTORS.some(c => rhsTrim.startsWith(c))) continue;

    let scope;
    if (inLoop) {
      /* Inside the loop body proper — not the `while` header's own indent. */
      if (indent.length <= loopBaseIndent) continue;
      scope = 'loop';
    } else {
      /* Top level only. A constant assigned inside an if/for/def is not a
         "setup constant"; probing it there would fire at an unpredictable
         time and read as noise. */
      if (indent.length !== 0) continue;
      scope = 'setup';
    }

    const lineNum  = i + 1;
    const safeName = `${varName}_line${lineNum}`;
    const blockId  = `line_${lineNum}`;

    entries.push({ safeName, displayName: varName, blockId, scope });
    output.push(`${indent}_phtr_${safeName} = str(${varName})`);
```

3. After the main loop, append the watch probes into the loop body. The instrumentor already knows the first loop's base indent; capture the *body* indent of the last in-loop line it saw (add `let loopBodyIndent = null;` beside `loopBaseIndent`, set it the first time a `scope === 'loop'` line is emitted, and default to `loopBaseIndent + 4` spaces if the loop body had no assignment):

```js
  const watches = sanitiseWatch(watch);
  if (watches.length > 0) {
    const bodyIndent = loopBodyIndent ?? (loopBaseIndent >= 0 ? ' '.repeat(loopBaseIndent + 4) : '');
    /* Watches are appended to the END of the loop body so they observe the
       values AFTER the frame's updates, which is what a student watching
       "total energy" expects. Emitted at top level when there is no loop. */
    const insertAt = lastLoopLineIndex >= 0 ? lastLoopLineIndex + 1 : output.length;
    const lines = watches.map((expr, n) => `${bodyIndent}_phtr_watch_${n} = str(${expr})`);
    output.splice(insertAt, 0, ...lines);
    watches.forEach((expr, n) => {
      entries.push({
        safeName: `watch_${n}`,
        displayName: expr,
        blockId: `watch_${n}`,
        scope: 'watch',
      });
    });
  }
```

(track `lastLoopLineIndex` as the `output.length - 1` after each `scope === 'loop'` push.)

4. Update the JSDoc to describe the options bag, the three scopes and why setup probes exist.

- [ ] **Step 3: Thread the watch list through the runner**

In `frontend/src/utils/runner/glowRunner.js`, `runPython`'s auto-instrumentation call at `:448`:

```js
      const result = instrumentPythonForDebug(source, { watch: opts.watch || [] });
```

Block projects reach the instrumentor only when `traceRegistry.length === 0` (`:447`), so watches on a block project need the same treatment. Change that branch to always instrument when watches are present:

```js
    let compilableSource = source;
    let traceEntries = traceRegistry;
    const watch = opts.watch || [];
    if (traceRegistry.length === 0 || watch.length > 0) {
      const result = instrumentPythonForDebug(source, { watch });
      compilableSource = result.source;
      codeTraceEntries = result.entries;
      /* Block projects already have tr() checkpoints in the generated source;
         keep them and add the instrumentor's watch entries on top. */
      traceEntries = traceRegistry.length === 0
        ? codeTraceEntries
        : [...traceRegistry, ...codeTraceEntries.filter((e) => e.scope === "watch")];
      …
```

- [ ] **Step 4: Show them**

In `frontend/src/contexts/TraceContext.js`, carry `scope` through `updateTrace` — the batch entries gain `s` alongside `v` and `b`, set from the entry's scope in the postMessage payload (extend the injected `postMessage` in `glowRunner.js` with `s:'<scope>'`, interpolated from `entry.scope || 'loop'`).

In `frontend/src/components/TraceTable.js`, reuse the section-row pattern that already exists at `:541-553` (`Pinned` / `All variables`) for two more sections, rendered in this order: **Watch**, **Setup / constants** (collapsed by default), **Live values**. The collapse is one piece of local state:

```jsx
  const [setupOpen, setSetupOpen] = useState(false);
```

```jsx
              {setupRows.length > 0 && (
                <>
                  <tr className="trace-section-row">
                    <td colSpan={5}>
                      <button
                        type="button"
                        className="trace-section-toggle"
                        onClick={() => setSetupOpen((v) => !v)}
                        aria-expanded={setupOpen}
                      >
                        <ChevronRightIcon size={10} />
                        <span className="trace-section-label">
                          Setup / constants ({setupRows.length})
                        </span>
                      </button>
                    </td>
                  </tr>
                  {setupOpen && renderRows(setupRows, false)}
                </>
              )}
```

with `.trace-section-toggle` styled off the tokens, and the chevron rotated 90° when `aria-expanded="true"`.

Add the watch input to the trace panel header — one text field, Enter to arm:

```jsx
        <form
          className="trace-watch"
          onSubmit={(e) => {
            e.preventDefault();
            const v = watchDraft.trim();
            if (!v) return;
            onAddWatch(v);
            setWatchDraft("");
          }}
        >
          <input
            className="trace-watch-input"
            value={watchDraft}
            onChange={(e) => setWatchDraft(e.target.value)}
            placeholder="Watch an expression…"
            spellCheck={false}
          />
        </form>
```

`onAddWatch` appends to a `watch` array held in `TraceContext`, which `handleRun` reads and passes as `runPython(code, host, { breakpoints, watch })`. **Watches arm on the next run, not the current one** — say so, right under the input:

```jsx
        {watch.length > 0 && (
          <p className="trace-watch-note">
            {watch.length} watch{watch.length === 1 ? "" : "es"} — press Run to see {watch.length === 1 ? "it" : "them"}.
          </p>
        )}
```

- [ ] **Step 5: Value legibility — the review's second Debug row**

The review's Tranche 3 roadmap bullet ends "…, trace-table value legibility", and its Debug table spells it out: *give values tabular-numeric mono, fixed decimals and a wider value column; move min/max and the snapshot diff into an expand-on-click detail row.* Steps 1-4 add sections and a watch box and touch none of it, so it lands here.

Verified against the live file, two of the five sub-items are already done and must not be "fixed" again: `.trace-value` and `.trace-delta` already carry `font-variant-numeric: tabular-nums` (`styles.css`, the `.trace-value` rule), and min/max already renders. What is actually wrong:

1. **The value is truncated to 14 characters** (`TraceTable.js:213`, `truncate(value, 14)`) inside a `.trace-col--value` that is only **36%** of a ~320px drawer — about 115px. A VPython vector prints as `<1.234, -0.567, 8.901>`; a student sees `<1.234, -0.5…` and has to hover for the `title`. Widen the value column and shorten the sparkline's: in `styles.css`, `.trace-col--name` 28% → **26%**, `.trace-col--value` 36% → **46%**, `.trace-col--spark` 36% → **28%**, and raise the truncation to `truncate(value, 24)`.
2. **No fixed decimals**, so a column jitters between `0.1` and `0.10000000000000009` and the eye cannot track it. Format numerically-parseable values to a fixed width in `TraceTable.js`, leaving non-numeric strings (vectors, booleans, object reprs) exactly as they arrive:

```js
/* A trace value that parses as a number is rendered at fixed precision so a
   column of them lines up and stops jittering between 0.1 and
   0.10000000000000009. Anything else — vectors, booleans, reprs — is passed
   through untouched; guessing at their shape is how you lose information. */
function formatTraceValue(raw) {
  const s = String(raw ?? "");
  if (!/^-?\d*\.?\d+(?:e[-+]?\d+)?$/i.test(s.trim())) return s;
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (Number.isInteger(n) && Math.abs(n) < 1e6) return String(n);
  return Math.abs(n) >= 1e5 || (Math.abs(n) < 1e-3 && n !== 0)
    ? n.toExponential(3)
    : n.toFixed(4);
}
```

and render `truncate(formatTraceValue(value), 24)`.

3. **min/max and the snapshot diff crowd the sparkline cell.** Move them behind a per-row disclosure, reusing the same collapse idiom Step 4 introduced for Setup / constants — one `expandedRow` id in local state, a click on the row's value cell toggling it, and a second `<tr className="trace-row-detail">` rendered underneath when open:

```jsx
              {expandedId === entry.id && (
                <tr className="trace-row-detail">
                  <td colSpan={5}>
                    <span className="trace-detail-item">min <b>{minStr ?? "—"}</b></span>
                    <span className="trace-detail-item">max <b>{maxStr ?? "—"}</b></span>
                    <span className="trace-detail-item">since snapshot <b>{snapshotStr ?? "—"}</b></span>
                    <span className="trace-detail-item">block <b>{blockId || "—"}</b></span>
                  </td>
                </tr>
              )}
```

```css
/* Expand-on-click detail row — min/max and the snapshot diff used to fight the
   sparkline for a 115px cell. */
.trace-row-detail td {
  padding: var(--space-1) var(--space-2) var(--space-2);
  background: color-mix(in srgb, var(--bg-titlebar) 55%, transparent);
}
.trace-detail-item {
  display: inline-flex;
  gap: var(--space-1);
  margin-right: var(--space-3);
  font-size: var(--fs-2xs);
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}
.trace-detail-item b { color: var(--text); font-weight: var(--fw-semibold); }
```

Keep the sparkline itself in the row — it is the one thing that reads at a glance. The `.trace-minmax` rule and its markup move into the detail row; delete them from the spark cell.

**Do not** add a mono font stack: the review's "tabular-numeric mono" is satisfied by `tabular-nums` on the existing family, and switching the trace table to `--font-mono` alone would make it the only mono surface outside the code editor.

- [ ] **Step 6: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
npm run start -w frontend
```

Expected: 7 new instrumentor tests green. In the browser, on the **Spring** code template: run it, and the trace table must show a collapsed **Setup / constants (4)** section holding `m`, `k`, `dt` and the initial position — values that were invisible before. Type `0.5*k*x**2` into the watch box, press Enter, press Run: a **Watch** row appears and updates. Type `import os` and press Enter: nothing is armed.

Then read the values, which is what Step 5 is for: a full vector prints without an ellipsis at the drawer's default width; a float column holds a fixed number of decimals and stops jittering; clicking a row opens a detail line with min, max and the snapshot diff, and clicking again closes it. Check it at the 200px drawer minimum too — the value may truncate there, but the row must not overflow.

```powershell
git add frontend/src
git commit -m "feat(frontend): trace setup constants and watch expressions — the values students actually check"
```

---

### Task 17: Debug comes home — a docked drawer, a toolbar group, and 38 fewer CSS rules

**Files:**

- Delete: `frontend/src/components/DebugMode.js`
- Create: `frontend/src/components/DebugDrawer.js`, `frontend/src/hooks/useDebugHotkeys.js`, `frontend/src/utils/export/downloadCsv.js`, `frontend/src/utils/export/__tests__/downloadCsv.test.js`
- Modify: `frontend/src/components/layout/IDELayout.js`, `frontend/src/components/Toolbar.js`, `frontend/src/components/GlowCanvas.js`, `frontend/src/components/TraceTable.js`, `frontend/src/components/BlocklyWorkspace.js`, `frontend/src/hooks/useDebug.js`, `frontend/src/styles.css`
- Create: `frontend/src/components/__tests__/ToolbarDebug.test.js`

**Interfaces:**

- Produces: `<DebugDrawer>` — the docked trace panel — rendered as the second child of `.canvas-wrap`, lateral to a new `.canvas-column` holding the viewport and its caption; a debug control group in the header's `app-header__zone--view`; `useDebugHotkeys()`; `downloadCsv(rows, filename)`.
- Produces: the `onToggleTrace` / `traceVisible` handler pair **Plan 2 Task 9 Step 3 deliberately preserved for this plan** (Step 3a).
- Consumes: Plan 2's `secondaryActions` array, `app-header__sep`, `GlowCanvas({running, booting, onStatus})`, and `renderHelpers.js`.
- Removes: `DebugMode.js` (371 lines), the `if (dbg.debugMode) return …` early-return branch at `IDELayout.js:287-329`, the 38 `.dm-*` rules at `styles.css:1531-1761`, and the CSV writer duplicated verbatim at `DebugMode.js:260-279` and `TraceTable.js:283-295`.

> **Every line number in this task is a pre-Tranche-2 locator.** Plan 2 rewrites `Toolbar.js`'s entire returned tree (Tasks 7 and 9), restructures `IDELayout.js` (Tasks 3, 4, 10-16) and rewrites `GlowCanvas.js` (Tasks 14, 15, 16). Resolve every citation below by component, function, prop or selector name — the offsets will not match.

Today `IDELayout.js:287-329` early-returns an entirely separate tree, replacing titlebar, toolbar, split pane and status bar with `DebugMode`'s own three-column shell. Entering debug *stops* the running simulation (`useDebug.js:25-31`) while `HelpPage.js:517-519` promises "the simulation pauses immediately", so a student who clicks Debug mid-run lands on a blank black rectangle and has to find Run again inside a toolbar they have never seen. The debug branch renders no `.status-bar`, so a compile or runtime failure set at `useSimulation.js:67-71` lands in a component that is not on screen — the one mode whose entire purpose is finding faults is the one mode that cannot show them. Meanwhile `styles.css` carries a complete slide-in trace drawer (`.debug-drawer`, `.debug-drawer-handle`) that **no component uses**, and the Trace toggle — an entry in Plan 2's `secondaryActions` array after Task 9 — is rendered but never handed a handler.

- [ ] **Step 1: Extract the duplicated CSV writer first**

Create `frontend/src/utils/export/downloadCsv.js`:

```js
/**
 * downloadCsv — one CSV writer.
 *
 * This function existed twice, verbatim, at DebugMode.js:260-279 and
 * TraceTable.js:283-295, behind two controls that were on screen at the same
 * time with different labels and different disabled rules.
 *
 * `toCsvRows` is the pure half and is what the test covers; the download
 * itself is three lines of DOM.
 */

/** @param {Array<{t:number,name:string,value:unknown,delta:*,min:*,max:*}>} buffer */
export function toCsvRows(buffer) {
  const header = "timestamp_ms,variable,value,delta,min,max";
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = (buffer || []).map(
    (r) => `${r.t},${esc(r.name)},${esc(r.value)},${r.delta ?? ""},${r.min ?? ""},${r.max ?? ""}`,
  );
  return [header, ...rows].join("\n") + "\n";
}

export function downloadCsv(buffer, filename = `recording_${Date.now()}.csv`) {
  if (!buffer || buffer.length === 0) return false;
  const blob = new Blob([toCsvRows(buffer)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
```

Create `frontend/src/utils/export/__tests__/downloadCsv.test.js`:

```js
import { describe, test, expect } from "vitest";
import { toCsvRows } from "../downloadCsv";

describe("toCsvRows", () => {
  test("writes a header and one row per sample", () => {
    const csv = toCsvRows([{ t: 10, name: "x", value: 1.5, delta: 0.5, min: 1, max: 2 }]);
    expect(csv).toBe('timestamp_ms,variable,value,delta,min,max\n10,"x","1.5",0.5,1,2\n');
  });

  test("null delta/min/max become empty fields, not the string null", () => {
    const csv = toCsvRows([{ t: 1, name: "v", value: "<1, 2, 3>", delta: null, min: null, max: null }]);
    expect(csv).toContain('1,"v","<1, 2, 3>",,,\n');
    expect(csv).not.toContain("null");
  });

  test("quotes inside a value are escaped, not broken", () => {
    const csv = toCsvRows([{ t: 1, name: 'he said "hi"', value: 'a"b' }]);
    expect(csv).toContain('"he said ""hi""","a""b"');
  });

  test("an empty buffer is still a valid one-line CSV", () => {
    expect(toCsvRows([])).toBe("timestamp_ms,variable,value,delta,min,max\n");
    expect(toCsvRows(null)).toBe("timestamp_ms,variable,value,delta,min,max\n");
  });
});
```

Then point `TraceTable.js`'s `exportRecordingCsv` (`:282-295`) at it — delete the function body and call `downloadCsv(buffer)` at its one call site.

- [ ] **Step 2: The docked drawer**

Create `frontend/src/components/DebugDrawer.js`:

```jsx
/**
 * DebugDrawer — the trace table, docked beside the live viewport.
 *
 * Debug used to be a separate world: IDELayout early-returned a whole other
 * tree (its own titlebar, toolbar, split pane and — critically — no status
 * bar, so the one mode meant for finding faults was the one mode that could
 * not show them). It is now a mode of the shell. The .debug-drawer rules this
 * renders into have existed in styles.css since before Tranche 3 and had no
 * consumer at all.
 */
import React, { useCallback, useRef, useState } from "react";
import TraceTable from "./TraceTable";

const MIN_PX = 200;
const MAX_PX = 500;

export default function DebugDrawer({
  traceData,
  onHighlight,
  onClearTrace,
  recording,
  onStartRecord,
  onStopRecord,
  recordBuffer,
  onSaveAsDataset,
  watch,
  onAddWatch,
  onRemoveWatch,
  iteration,
}) {
  const [width, setWidth] = useState(320);
  const drawerRef = useRef(null);

  const startResize = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = drawerRef.current?.getBoundingClientRect().width ?? 320;
    const onMove = (ev) =>
      setWidth(Math.min(MAX_PX, Math.max(MIN_PX, startW + (startX - ev.clientX))));
    const onUp = (ev) => {
      ev.currentTarget?.releasePointerCapture?.(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const nudge = useCallback((e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setWidth((w) => Math.min(MAX_PX, Math.max(MIN_PX, w + (e.key === "ArrowLeft" ? 16 : -16))));
  }, []);

  return (
    <>
      <div
        className="debug-drawer-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the trace panel"
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={nudge}
      />
      <aside className="debug-drawer" ref={drawerRef} style={{ width }}>
        <TraceTable
          data={traceData}
          onHighlight={onHighlight}
          onClear={onClearTrace}
          recording={recording}
          onStartRecord={onStartRecord}
          onStopRecord={onStopRecord}
          recordBuffer={recordBuffer}
          onSaveAsDataset={onSaveAsDataset}
          watch={watch}
          onAddWatch={onAddWatch}
          onRemoveWatch={onRemoveWatch}
          iteration={iteration}
        />
      </aside>
    </>
  );
}
```

**Where it mounts — restructure, do not assume.** At `771bc1e` `.canvas-wrap` is a flex **row** with `.canvas-viewport` on `flex: 1`, which is why the unused `.debug-drawer` rules were written for it. **Plan 2 Task 15 Step 7 changes that**: it adds a `.canvas-caption` strip below the canvas and switches `.canvas-wrap` to `flex-direction: column` to make room for it. Docking the drawer as a plain sibling after Plan 2 lands would stack it *under* the viewport and put it in a fight with the caption for vertical space — and "debug is a mode of the shell" depends entirely on the drawer being **lateral**.

So give the column its own box instead of borrowing the wrap's axis. In `frontend/src/styles.css`:

```css
/* .canvas-wrap is the ROW: viewport column | drag handle | trace drawer.
   Plan 2 Task 15 Step 7 made it a column to seat .canvas-caption beneath the
   canvas; that stacking now lives on .canvas-column, and this supersedes that
   step's `flex-direction: column` change. The drawer is lateral by design —
   docking it under the viewport would halve the scene on a 1024px screen. */
.canvas-wrap {
  flex: 1;
  overflow: hidden;
  background: var(--canvas-bg);
  display: flex;
  flex-direction: row;
  position: relative;
}
.canvas-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
```

`.canvas-viewport` keeps `flex: 1; min-width: 0; min-height: 0` (it is now the column's growing child) and `.canvas-caption` keeps `flex: 0 0 auto` exactly as Plan 2 wrote it — no other rule changes.

Then in `frontend/src/components/GlowCanvas.js`, wrap the viewport and caption in `.canvas-column` and render `children` as the wrap's second child. **The signature gains `children` and nothing else** — `booting` (Plan 2 Task 16 Step 2, the boot spinner over the idle layer) and `onStatus` (Plan 2 Task 15 Step 7, how `ViewportControls` reports a failed camera action) are both load-bearing and must survive:

```jsx
function GlowCanvas({ running, booting, onStatus, children }) {
  return (
    <div className="canvas-wrap">
      <div className="canvas-column">
        <div className="canvas-viewport" ref={viewportRef}>
          …unchanged: idle layer, booting overlay, #glowscript-host, hint, <ViewportControls …/>…
        </div>
        {/* …unchanged: Plan 2's .canvas-caption block… */}
      </div>
      {children}
    </div>
  );
}
```

Everything inside `.canvas-viewport` — including the two effects Plan 2 Task 14 added and the `sceneMeta` effect from Task 15 — is untouched.

- [ ] **Step 3: Fold the controls into the toolbar**

In `frontend/src/components/Toolbar.js`, add the debug group **at the end of `app-header__zone--view`**, after the `secondaryActions` render (inline or overflow), rendered only while debug mode is on. Use the existing `.tb-btn` classes — the whole point is that there is no second button vocabulary.

> **Two corrections to an earlier draft of this step.** (1) It said "replace the dead Trace toggle at `Toolbar.js:256-268`". After **Plan 2 Task 9 Step 3** (sub-item 5, "Extract the collapsible controls into one array") the toggle is no longer inline JSX at all — it is the `trace` entry in the `secondaryActions` array. **Do not delete it; Step 3a below wires it.** (2) The group is *added to* the view zone, not substituted for anything: Plan 2's completion criteria says outright that a Plan 3 debug group "belongs in `app-header__zone--view` and, if collapsible, in Task 9's `secondaryActions` array". These controls are **not** collapsible — a student mid-step cannot lose Next frame into an overflow menu — so they render inline in the view zone and stage 2 shortens their labels rather than hiding them (see the CSS below).

```jsx
      {/* ── Debug controls (only while debug mode is on) ── */}
      {debugMode && (
        <>
          <span className="app-header__sep" />
          <button
            type="button"
            className="tb-btn"
            onClick={paused ? onResume : onPause}
            disabled={!running}
            title={paused ? "Resume (Space)" : "Pause (Space)"}
          >
            {paused ? <PlayIcon size={13} /> : <PauseIcon size={13} />}
            <span className="tb-btn-label">{paused ? "Resume" : "Pause"}</span>
          </button>
          <button
            type="button"
            className="tb-btn tb-btn--primary-ghost"
            onClick={onStepFrame}
            disabled={!running}
            title="Advance one animation frame (F10)"
          >
            <StepForwardIcon size={13} />
            <span className="tb-btn-label">Next frame</span>
          </button>
          <button
            type="button"
            className="tb-btn tb-btn--subtle"
            onClick={onStepValue}
            disabled={!running}
            title="Advance to the next reported value (Shift+F10)"
          >
            <span className="tb-btn-label">Next value</span>
          </button>
          <button
            type="button"
            className={`tb-btn${recording ? " tb-btn--active" : ""}`}
            onClick={recording ? onStopRecord : onStartRecord}
            title={recording ? "Stop recording" : "Record every value to CSV"}
          >
            <RecordIcon size={12} />
            <span className="tb-btn-label">{recording ? "Stop Rec" : "Record"}</span>
          </button>
          {breakpointCount > 0 && (
            <span className="tb-chip" title={`${breakpointCount} breakpoint${breakpointCount === 1 ? "" : "s"} set`}>
              {breakpointCount} bp
            </span>
          )}
          <span className="tb-chip tb-chip--quiet" aria-live="polite">
            {pauseState === "paused"
              ? `Paused · iteration ${iteration}`
              : pauseState === "pausing"
                ? "Pausing…"
                : `iteration ${iteration}`}
          </span>
        </>
      )}
```

"Next frame" is the dominant control and "Next value" the secondary one — the review's point exactly: in a loop with four traced variables, four presses of the old Step advanced a single timestep.

Two identifiers in that JSX need their definitions supplied here, because neither exists in the repo or in Plans 1 and 2. **`<span className="app-header__sep" />`** is Plan 2 Task 7 Step 5's group divider — used above in place of the `<SeparatorDot />` an earlier draft invented, which is defined nowhere. And **`.tb-btn--primary-ghost`** is new: Plan 1 Task 6 defines `--run`, `--stop`, `--subtle`, `--active`, `--danger` and `--icon`, none of which reads as "dominant but not the filled primary" — Run keeps that role. Add all three rules to `styles.css`:

```css
/* The one control a student presses over and over while stepping. Weightier
   than --subtle, deliberately not the filled primary — Run owns that (Plan 1
   Task 6) and a debug session must not grow a second filled button. */
.tb-btn--primary-ghost {
  color: var(--accent-bright);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  font-weight: var(--fw-semibold);
}
.tb-btn--primary-ghost:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: var(--accent);
}

.tb-chip {
  display: inline-flex;
  align-items: center;
  height: var(--control-h-sm);
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
  background: color-mix(in srgb, var(--red) 18%, transparent);
  color: var(--red);
  white-space: nowrap;
}
.tb-chip--quiet {
  background: transparent;
  color: var(--text-dim);
  font-weight: var(--fw-regular);
  font-variant-numeric: tabular-nums;
}

/* Stage 2 shortens the debug group rather than collapsing it — see Step 3's
   note. Plan 2's .app-header--stage1 rule hides .tb-btn--secondary labels;
   these buttons are deliberately not --secondary, so they keep their words
   until the narrowest stage. */
.app-header--stage2 .tb-chip--quiet { display: none; }
```

Import `PauseIcon`, `StepForwardIcon` and `RecordIcon` (already exported from `Icons.js`), and add the matching props to the component signature.

The Debug button itself becomes a toggle: its `secondaryActions` entry (Plan 2 Task 9 Step 3, `key: "debug"`) gains `active: debugMode` and its `short` flips between **Debug** and **Exit Debug** — the array's renderer already appends `tb-btn--active` from `a.active`, so no new JSX is needed.

- [ ] **Step 3a: Wire the Trace toggle Plan 2 preserved for this task**

Plan 1 deferred "`.tb-btn--active` and the dead Trace toggle — Tranche 2 decides wire-or-delete". **Plan 2 Task 9 Step 3 decided: "Keep both, do not wire, do not delete"**, on the explicit grounds that *"Plan 3 revives `.debug-drawer` … as a docked `TraceTable` beside the normal viewport and supplies exactly this handler"*, and its completion criteria repeats that `onToggleTrace` and `.tb-btn--active` are deliberately preserved for this plan. **This step is where the chain closes**, and it closes by wiring, not by deleting — the review's proposal is a lightweight "watch my numbers while I work" mode available *without* entering Debug, and the drawer this task builds is exactly that panel. There is nothing downstream to hand it to.

In `frontend/src/components/layout/IDELayout.js`:

```js
  /* The trace drawer has two independent reasons to be open: the student is
     debugging, or the student just wants to watch their numbers while they
     work. Plan 2 built the toggle (Task 9's secondaryActions 'trace' entry)
     and deliberately left it unwired for this task to supply the handler. */
  const [traceVisible, setTraceVisible] = useState(false);
  const traceOpen = dbg.debugMode || traceVisible;
```

Pass `traceVisible={traceVisible}` and `onToggleTrace={() => setTraceVisible((v) => !v)}` into `<Toolbar>` alongside the debug props in Step 4, and gate the drawer on `traceOpen` rather than on `dbg.debugMode` (Step 4.3). Three consequences to keep straight:

- The `secondaryActions` `trace` entry now renders in every simulation project, not only in debug mode — that is the point, and `showSimActions && onToggleTrace` already scopes it correctly.
- Leaving debug mode does **not** close the drawer if the student opened it themselves. `handleExitDebug` must not touch `traceVisible`.
- The drawer renders `TraceTable` either way; the toolbar's debug *controls* still key off `debugMode` alone. Watching values and stepping through them stay separate gestures.

- [ ] **Step 4: Delete the separate world**

In `frontend/src/components/layout/IDELayout.js`:

1. **Delete the whole `if (dbg.debugMode) { return (…) }` branch at `:286-329`.** Everything in it now has a home in the main shell.
2. Delete `import DebugMode from "../DebugMode";` at `:31`.
3. In the physics and hybrid viewport branches (`:469` and `:490`), pass the drawer as a child. **Keep every prop Plan 2 put on these call sites** — Plan 2 Task 16 Step 2 sets all three of them to `<GlowCanvas running={running} booting={sim.booting} onStatus={setStatus} />`, and dropping `booting` silently removes the boot acknowledgement (the fix for "students click Run repeatedly because nothing acknowledges the first click") while dropping `onStatus` makes camera-control failures silent again. This task **adds `children` and changes nothing else**:

```jsx
              <GlowCanvas running={running} booting={sim.booting} onStatus={setStatus}>
                {traceOpen && (
                  <DebugDrawer
                    traceData={traceData}
                    onHighlight={(id) => { try { workspaceRef.current?.highlightBlock(id); } catch (_) {} }}
                    onClearTrace={trc.handleClearTrace}
                    recording={trc.recording}
                    onStartRecord={trc.handleStartRecord}
                    onStopRecord={trc.handleStopRecord}
                    recordBuffer={recordBufferRef.current}
                    onSaveAsDataset={handleSaveAsDataset}
                    watch={trc.watch}
                    onAddWatch={trc.addWatch}
                    onRemoveWatch={trc.removeWatch}
                    iteration={trc.iteration}
                  />
                )}
              </GlowCanvas>
```

4. Pass the debug props into `<Toolbar>` (`:345-378` — after Plan 2 Task 7 this is the single `<Toolbar …>` call, found by name): `debugMode`, `paused`, `pauseState`, `iteration`, `recording`, `breakpointCount={dbg.breakpoints.size}`, `onPause`, `onResume`, `onStepFrame`, `onStepValue`, `onStartRecord`, `onStopRecord`, `onDebugMode={dbg.debugMode ? dbg.handleExitDebug : dbg.handleEnterDebug}`, and — from Step 3a — `traceVisible={traceVisible}` and `onToggleTrace={() => setTraceVisible((v) => !v)}`. Leave every prop Plan 2 already passes (`projectTitle`, `onRenameProject`, `onSave`, `onScaleChange`, …) exactly as it is.
5. Thread the breakpoint API into `<BlocklyWorkspace>` (`:403-410`): `debugMode={dbg.debugMode}`, `breakpoints={dbg.breakpoints}`, `breakableIds={dbg.breakableIds}`, `isBreakable={dbg.isBreakable}`, `onToggleBreakpoint={dbg.toggleBreakpoint}`, `executingBlockId={dbg.executingBlockId}` — the props `ReadOnlyBlockly` used to take, now on the editable workspace, exactly as Task 14 assumed.
6. Add `useDebugHotkeys()` beside the other hooks at `:74-80`.
7. Render the status detail Task 13 added. In the status bar (`:496-505`), extend the message span:

```jsx
        <span className={running ? "console-bar console-bar--running" : statusClass}>
          {running && <span className="status-dot" />}
          {status.text}
          {status.detail && <span className="console-bar__detail">{status.detail}</span>}
        </span>
```

`.console-bar__detail` has no rule anywhere in the repo or in Plans 1 and 2, so without one `describeRunError`'s second sentence inherits the status-bar font at full weight and crowds the 26px strip Plan 2 Task 8 just made quiet. Add it beside the other `.console-bar*` rules:

```css
/* The second sentence of a describeRunError result (Task 13). Quieter and
   narrower than the title beside it — the strip is 26px and the title has to
   stay the thing you read first. The full text is still on the element's
   title attribute and in the console. */
.console-bar__detail {
  color: var(--text-dim);
  font-family: var(--font);
  font-weight: var(--fw-regular);
  margin-left: var(--space-2);
  max-width: 40ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

(If Plan 2 Task 10's `RunErrorBanner` is on screen it already carries the same `detail` at full width; the strip's copy is the glanceable one, not the only one.)

- [ ] **Step 4a: Null the shared workspace ref on dispose — the dead variable click**

The review's Debug table has a row this tranche would otherwise leave untouched: *"expose a `highlightBlockId` prop … null `workspaceRef.current` on cleanup"*. Its evidence: clicking a variable name in the trace table — styled `cursor: pointer` at `TraceTable.js:202-208` — calls `onHighlight(blockId)`, which reaches `workspaceRef.current?.highlightBlock(id)`, and that ref points at a **disposed** workspace. Nothing happens, every time. Step 4.3 above wires the drawer with exactly that pattern, so without this the affordance is still dead after the tranche that claims the debugger stops lying.

**Corrected against the live repo — the finding's locator is half right.** `BlocklyWorkspace.js`'s *own* `workspaceRef` **is** nulled in the mount-effect cleanup today (`workspace.dispose(); workspaceRef.current = null;`). The ref that goes stale is the **shared** one: `SimulationContext.js:48` creates it, `useSimulation.js:126-128`'s `handleWorkspaceReady` fills it via the `onWorkspaceReady` prop, and nothing ever empties it. That is the ref `IDELayout`'s `onHighlight` reads.

In `frontend/src/components/BlocklyWorkspace.js`, in the same cleanup, tell the owner as well:

```js
    return () => {
      resizeObserver.disconnect();
      workspace.removeChangeListener(listener);
      workspace.removeChangeListener(constListener);
      workspace.dispose();
      workspaceRef.current = null;
      /* And empty the SHARED ref too. handleWorkspaceReady (useSimulation.js)
         wrote SimulationContext's workspaceRef when this workspace mounted and
         nothing ever cleared it, so after a goal change or a project switch
         IDELayout's onHighlight — the trace table's click-a-variable-to-find-
         the-block gesture — was calling highlightBlock on a disposed
         workspace and silently doing nothing, every time. */
      onReadyRef.current?.(null);
    };
```

`handleWorkspaceReady` is `(ws) => { workspaceRef.current = ws; }`, so `null` is already a valid argument; no change is needed there. Then make the two consumers null-safe rather than merely `try`-wrapped — a `null` ref must read as "no workspace", not as a swallowed exception:

```js
  onHighlight={(id) => {
    const ws = workspaceRef.current;
    if (!ws) return;
    try { ws.highlightBlock(id); } catch (_) {}
  }}
```

Verify it by hand in Step 10: with a simulation traced, **switch project goal (or open a different project) and then click a variable name in the trace table** — the block highlights, or nothing happens but the console is clean; before this change the same gesture threw into a swallowed catch. Then click a variable during a normal run: its block must light up.

- [ ] **Step 5: Debug keys, guarded**

Create `frontend/src/hooks/useDebugHotkeys.js`:

```js
/**
 * useDebugHotkeys — Space / F10 / Shift+F10 while debug mode is on.
 *
 * The old handler (DebugMode.js:162-179) was a bare window listener that
 * unconditionally exited debug on Escape — so with the "Save run as dataset"
 * dialog or Help open on top, Escape tore down the whole debug session and
 * discarded the recording context. Escape is NOT bound here at all: closing
 * an overlay is the overlay's job, and leaving debug mode is a toolbar click.
 *
 * Composes alongside Tranche 2's global useHotkeys rather than inside it —
 * these keys are debug-scoped and must not exist when debug mode is off.
 */
import { useEffect } from "react";
import { useDebugContext } from "../contexts/DebugContext";
import { useSimulationContext } from "../contexts/SimulationContext";
import { useDebug } from "./useDebug";

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function useDebugHotkeys() {
  const { debugMode } = useDebugContext();
  const { running, paused } = useSimulationContext();
  const { handlePause, handleResume, handleStep, handleStepFrame } = useDebug();

  useEffect(() => {
    if (!debugMode) return undefined;
    const handler = (e) => {
      const el = e.target;
      if (TYPING.has(el?.tagName) || el?.isContentEditable) return;
      if (el?.closest?.(".monaco-editor, .blocklyDiv")) return;
      if (e.code === "Space" && running) {
        e.preventDefault();
        (paused ? handleResume : handlePause)();
      } else if (e.code === "F10") {
        e.preventDefault();
        (e.shiftKey ? handleStep : handleStepFrame)();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [debugMode, running, paused, handlePause, handleResume, handleStep, handleStepFrame]);
}
```

- [ ] **Step 6: Entering debug pauses, it does not stop**

`useDebug.js:25-31` calls `stopPython` + `setRunning(false)`, while `HelpPage.js:517-519` promises the opposite. Make the promise true:

```js
  const handleEnterDebug = useCallback(() => {
    /* Do NOT stop. HelpPage.js:517-519 has always promised "the simulation
       pauses immediately"; stopping meant a student who clicked Debug mid-run
       landed on a blank black rectangle. */
    if (runningRef.current) {
      pausePython();
      setPauseState("pausing");
    }
    setDebugMode(true);
    setStatus({ text: "Debug mode — breakpoints armed on the next Run", type: "" });
  }, [setDebugMode, setStatus, setPauseState, runningRef]);
```

`handleExitDebug` keeps clearing recording and `pauseState`, and resumes rather than stops:

```js
  const handleExitDebug = useCallback(() => {
    resumePython();
    setPauseState("running");
    setPaused(false);
    setRecording(false);
    recordingRef.current = false;
    setDebugMode(false);
    setStatus({ text: running ? "Simulation running" : "Ready", type: "" });
  }, [setPaused, setRecording, recordingRef, setDebugMode, setStatus, setPauseState, running]);
```

It must **not** touch `traceVisible` (Step 3a): if the student opened the trace drawer themselves, leaving debug mode takes the debug *controls* away and leaves their panel where they put it.

- [ ] **Step 7: Correct the three false Help claims**

While the truth is fresh, fix `HelpPage.js`:

| Line    | Claim                                                 | Reality after this task                                                                                                                                                                                         |
| ------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 517-519 | "the simulation pauses immediately"                   | **now true** — Step 6 makes it so. Leave the sentence, add: "Your blocks stay on screen; the trace panel opens beside the viewport."                                                                     |
| 552-553 | "Stop clears trace data"                              | **false** — `useSimulation.js:58` clears it on **Run**. Rewrite: "Pressing Run clears the trace table and starts a fresh recording; Stop leaves the last values on screen so you can read them." |
| 590-591 | "breakpoints are discarded when you leave Debug Mode" | **false** — they are kept, and now deliberately so. Rewrite: "Breakpoints are remembered when you leave Debug Mode, but they only pause the simulation while Debug Mode is on."                          |

Add the two facts students cannot otherwise discover, in the same section:

> Breakpoints go on blocks that report a value — the "set", "add to", "update position", "apply force", "time step" and "define constant" blocks. Those blocks show a dashed outline in Debug Mode; right-clicking any other block tells you it can't pause there.
>
> The trace table shows every variable that changes inside your loop, plus a collapsed **Setup / constants** section for the values you set before it. To watch anything else — total energy, say — type the expression into the watch box and press Run.

- [ ] **Step 8: Delete the parallel vocabulary**

Delete `frontend/src/components/DebugMode.js` (371 lines).

In `frontend/src/styles.css`, delete the **38** `.dm-*` rules between `.dm-overlay` and `.dm-panel--trace .trace-scroll` (currently `:1531-1761`): `.dm-overlay`, `.dm-topbar`, `.dm-topbar-sep`, `.dm-topbar-group`, `.dm-topbar-hint`, `.dm-exit-btn` (+`:hover`), `.dm-ctrl-btn` (+`:hover`, `:disabled`, `--active`, `--run`, `--run:hover`, `--step`, `--rec-active`), `.dm-rec-dot`, `.dm-rec-count`, `.dm-bp-badge`, `.dm-body`, `.dm-panel`, `.dm-panel--blocks`, `.dm-panel--viewport`, `.dm-panel--trace`, `.dm-panel-header`, `.dm-panel-title`, `.dm-panel-hint`, `.dm-paused-badge`, `.dm-resize-handle` (+`:hover`, `--left`, `--right`), `.dm-blockly-wrap` (+ its two descendant rules), `.dm-code-wrap` (+ its two), `.dm-glowhost`, `.dm-panel--trace .trace-panel`, `.dm-panel--trace .trace-scroll`.

Two of these carried behaviour that must survive, and both move to the drawer's own selectors:

```css
/* Was .dm-panel--trace .trace-panel / .trace-scroll — the trace panel needs a
   scroll context inside a fixed-width drawer. */
.debug-drawer .trace-panel { height: 100%; min-height: 0; }
.debug-drawer .trace-scroll { flex: 1; min-height: 0; overflow-y: auto; }
```

**Two dangling aliases, not one.** Plan 1 Task 8 Step 1 comma-appended *both* names onto its primitives: `.dm-panel-header` into `.panel-header`'s selector list, and `.dm-panel-title` into `.panel-header__title`'s, which after Plan 1 reads `.panel-header__title, .dm-panel-title, .vdialog-title`. Plan 1 Task 8 Step 2 then reduced the standalone `.dm-panel-header` rule to a two-property override and **deleted the standalone `.dm-panel-title` rule outright** — so by the time this step runs, `.dm-panel-title`'s only remaining occurrence *is* that alias, and "delete it" means strip the selector, not find a rule. Deleting the `.dm-*` block without stripping both names leaves the primitives carrying selectors that match nothing:

```powershell
git grep -n "dm-panel-header\|dm-panel-title" -- frontend/src/styles.css
```

Expected after this step: **nothing**. Both names come out of `.panel-header` and `.panel-header__title` respectively; `.vdialog-title` stays.

**Keep** the four Blockly decoration rules Task 7 renamed (`.bp-block`, `.block-executing`, `.bp-available`) — they are block decorations, not shell chrome.

- [ ] **Step 9: A probe for the new toolbar group**

Create `frontend/src/components/__tests__/ToolbarDebug.test.js`, **using Plan 2 Task 2's harness** — `mountComponent` / `click` / `byText` from `../../test/renderHelpers` — beside Plan 2's own `Toolbar.test.js`. No hand-rolled `createRoot` + `act` boilerplate: there is one component-probe layer and this is it.

The `vi.mock` is not optional. After Plan 2 Task 7 the `Toolbar` renders `<HeaderAccount />`, which calls `useMe()` (TanStack Query) and `useNavigate()` (router); without the mock **every test in this file throws on mount**. Plan 2's own suites carry the same line for the same reason.

```js
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import Toolbar from "../Toolbar";
import { mountComponent, click, byText } from "../../test/renderHelpers";

/* HeaderAccount calls useMe() (TanStack Query) and useNavigate() (router);
   neither has a provider in a bare component mount. Same line, same reason,
   as Plan 2 Task 7 Step 8. */
vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const base = { goal: "physics", mode: "blocks", isDark: true, iteration: 0, pauseState: "running" };

function render(props = {}) {
  mounted?.unmount();
  mounted = mountComponent(<Toolbar {...base} {...props} />);
  return mounted.container;
}

describe("Toolbar debug group", () => {
  test("is absent until debug mode is on", () => {
    const container = render({ debugMode: false, running: true });
    expect(byText(container, "Next frame")).toBeNull();
    expect(byText(container, "Record")).toBeNull();
  });

  test("Next frame is the dominant control and fires onStepFrame", () => {
    const onStepFrame = vi.fn();
    const container = render({ debugMode: true, running: true, onStepFrame });
    const btn = byText(container, "Next frame");
    expect(btn).toBeTruthy();
    expect(btn.className).toContain("tb-btn--primary-ghost");
    click(btn);
    expect(onStepFrame).toHaveBeenCalledTimes(1);
  });

  test("Pause flips to Resume when paused", () => {
    const onResume = vi.fn();
    const container = render({ debugMode: true, running: true, paused: true, onResume });
    expect(byText(container, "Pause")).toBeNull();
    click(byText(container, "Resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  test("step controls are disabled when nothing is running", () => {
    const container = render({ debugMode: true, running: false });
    expect(byText(container, "Next frame").disabled).toBe(true);
    expect(byText(container, "Next value").disabled).toBe(true);
  });

  test("the pause chip says Pausing… before the runtime acknowledges", () => {
    const container = render({ debugMode: true, running: true, pauseState: "pausing" });
    expect(container.textContent).toContain("Pausing…");
    expect(container.textContent).not.toContain("Paused ·");
  });

  test("the breakpoint chip appears only when breakpoints are set", () => {
    let container = render({ debugMode: true, running: true, breakpointCount: 0 });
    expect(container.textContent).not.toContain("bp");
    container = render({ debugMode: true, running: true, breakpointCount: 3 });
    expect(container.textContent).toContain("3 bp");
  });

  test("the Trace toggle is wired and reflects traceVisible", () => {
    /* Plan 2 Task 9 Step 3 kept this control unwired specifically for Step 3a
       above to supply the handler. If this test fails, the chain reopened. */
    const onToggleTrace = vi.fn();
    const container = render({ running: true, onToggleTrace, traceVisible: true });
    const btn = byText(container, "Trace");
    expect(btn).toBeTruthy();
    expect(btn.className).toContain("tb-btn--active");
    click(btn);
    expect(onToggleTrace).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 10: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "dm-" -- frontend/src
git grep -n "DebugMode" -- frontend/src
git grep -n "__probe__\|SeparatorDot" -- frontend/src
```

Expected: tests green (4 CSV + 7 `ToolbarDebug`); build clean; **the first grep returns only `.bp-block` / `.block-executing` neighbours if any comment mentions the old names — no `.dm-` selector or class string; the second and third return nothing.** (The third is a guard against the two identifiers an earlier draft of this task invented: there is no `__probe__` directory and no `SeparatorDot` component.)

Then the browser pass, which is what this task is really for:

```powershell
npm run start -w frontend
```

1. Open the **Projectile** block template and press **Run**. Press **Debug** *while it is running*: the simulation **keeps its frame on screen**, the trace drawer slides in **beside** the viewport (not beneath it — that is Step 2's `.canvas-column`), and the toolbar grows Pause / Next frame / Next value / Record. Nothing is replaced.
2. Edit a block *while in debug mode* — this was impossible before.
3. Drag the drawer handle; tab to it and use ← / → to resize.
4. Cause a runtime error while in debug mode: the status bar shows it, because there is only one status bar now — and its second sentence renders quietly in `.console-bar__detail` rather than crowding the strip.
5. Press **Exit Debug**: the debug controls leave the toolbar and the simulation resumes. The drawer closes **unless** you opened it yourself with the Trace toggle (Step 3a) — in which case it stays.
6. Press **Trace** *without* entering debug mode on a running simulation: the drawer opens with the live trace table and no debug controls appear. Press it again to close. This is the mode Plan 2 preserved the toggle for.
7. Run a template that authors a `scene.caption`: the caption strip still sits **below** the canvas inside `.canvas-column`, with the drawer beside both.
8. At 1024px width, confirm the drawer at its 200px minimum still leaves a usable viewport.

```powershell
git add -A frontend/src
git commit -m "refactor(frontend): debug is a mode of the shell — docked trace drawer, toolbar group, DebugMode and 38 .dm-* rules deleted"
```

---

### Task 18: MOVED — the `styles.css` split

**Superseded by Plan 3, Task 1** ([2026-08-21-ide-modernization-03-makecode-overhaul.md](2026-08-21-ide-modernization-03-makecode-overhaul.md)), which split the monolith into eleven files behind an `@import` manifest (`tokens`, `base`, `chrome`, `workspace`, `viewport`, `debug`, `pages`, `datapanel`, `primitives`, `platform`, `responsive`) with the dead-CSS sweep folded in. Debug work in this plan edits `styles/debug.css` and `styles/workspace.css`; Task 17's `.dm-*` deletion is one-file surgery on `debug.css`. The palette parity test already lives at its final path (`utils/blockly/__tests__/paletteCssSync.test.js`).

---

### Task 19: Wrap-up — the full sweep, the docs, the handoff

**Files:**

- Modify: `README.md`, `docs/product-contract.md`

- [ ] **Step 1: The straggler sweep**

Run all twelve assertions. Every one must hold before this tranche is called done.

```powershell
git grep -n "window.Blockly" -- frontend/src
git grep -n "glowscript.org\|cdn.jsdelivr.net/npm/blockly" -- frontend/src frontend/index.html
git grep -nE "colour: [0-9]+" -- frontend/src/utils/blockly
git grep -n 'colour="#' -- frontend/src/utils/blockly/toolbox.js
git grep -n "beginnerEnabled\|beginnerVisible" -- frontend/src
git grep -n "dm-ctrl\|dm-panel\|dm-topbar\|dm-overlay\|DebugMode" -- frontend/src
git grep -nE "colour (45|120|160|210|230|260|330)" -- frontend/src/components/HelpPage.js
git grep -n "scene.background" -- frontend/src/utils/blockTemplates.js frontend/src/utils/precodedExamples.js
git grep -n "__probe__\|SeparatorDot" -- frontend/src
git grep -c "helpUrl" -- frontend/src/utils/blockly/blocklyGenerator.js
git grep -c "GLOWSCRIPT_VERSION" -- frontend/src/utils/runner/glowRunner.js
git grep -c "<CategoryTag" -- frontend/src/components/HelpPage.js
```

Expected, in order: **nothing** ×9, then **1**, **4** (the export plus the three interpolated filenames), **8**.

The last four are this tranche's cross-plan gates and are the ones most likely to have been skipped: `scene.background` closes Plan 2 Task 14's handoff (Task 2 Step 4); `__probe__`/`SeparatorDot` prove no invented identifier survived; `GLOWSCRIPT_VERSION` proves Task 2 Step 3 replaced the object and not the export above it; and `8` proves Task 8 Step 3 converted the eight category chips and left the other 51 `<Tag color=…>` uses alone.

- [ ] **Step 2: The full verification sweep**

```powershell
npm run test
npm run check:blocks
npm run build -w frontend
npm run typecheck -w backend
npm run typecheck -w shared
```

Expected: every workspace green; `✔ Registry OK: 120 entries in 19 categories; 120 toolbox ids and 26 drawers reconcile both ways.`; build clean; both typechecks silent (this plan does not touch backend or shared — that is what these two prove). Record exact totals in the commit body.

- [ ] **Step 3: The offline smoke test, once more, on the finished tranche**

Repeat Task 2 Step 5 (the offline smoke test) against the final build. Expected: with `*://*.glowscript.org/*`, `*://cdn.jsdelivr.net/*` and `*://fonts.googleapis.com/*` all blocked, the IDE loads, **the block editor renders** (bundled Blockly — this is the part Task 1 bought), a template runs and draws in the 3D viewport, and debug mode pauses and steps. Only Monaco degrades, to its `<textarea>` fallback. **This is the sentence `docs/product-contract.md:101` has been promising since v1.**

- [ ] **Step 4: Update the contract's stack notes**

In `docs/product-contract.md`, the "Runtime abstraction" row (`:38`) says "Physics stays in `src/utils/runner/glowRunner.js`" — still true, but the origin changed. Append to that row's rationale cell:

```
The GlowScript 3.2 runtime is vendored at `frontend/public/vendor/glowscript/` (six files, provenance and SHA-256s recorded there) so §101's offline promise holds; Blockly is a pinned-exact npm dependency, not a CDN script.
```

And the "Block toolbox" row (`:34`) gains:

```
Category and block colour come from one module, `src/utils/blockly/blockPalette.js`, and `npm run check:blocks` validates registry↔toolbox ids AND category names in both directions.
```

Line `:107` ("No HTTP requests to non-CDN origins after first load. Smoke-tested in CI.") can now be strengthened — change it to:

```
- No HTTP requests to any third-party origin after first load, except the Monaco CDN (which degrades to a plain textarea). Blockly is bundled; the GlowScript runtime is vendored. Smoke-tested by blocking glowscript.org and jsDelivr in DevTools.
```

- [ ] **Step 5: Update README**

Immediately after the Plan 1 design-token paragraph (the one beginning "The interface runs on one design-token system"), add:

```markdown
Block colour is a design system, not a set of literals: `src/utils/blockly/blockPalette.js`
is the single source for all 26 categories, mirrored as `--cat-*` custom properties that the
pane accents, help-page tags, start-menu badges and landing-page particles all read. Every
fill clears WCAG AA against its label (worst 4.95:1, against ten of twelve failures before),
and red is reserved for errors and breakpoints. The toolbox and the block registry are held
to each other in both directions by `npm run check:blocks`, so a block can no longer ship in
a template but exist in no drawer — and the Data Science drawer now mirrors the analysis
pipeline: Load Data → Explore → Statistics → Transforming Data → Uncertainty → Analyzing
Relationships → Filter & Sort → Group & Compare → Charts → Communicate.

Debug is a mode of the shell rather than a separate screen: the trace table docks beside the
live viewport, step and record sit in the toolbar you already know, and you can edit blocks
while stepping. It also tells the truth now — a breakpoint can only be set where one can
fire (right-click a block to see), Pause waits for the runtime to acknowledge before
claiming to be paused, "Next frame" advances one animation frame, setup constants and your
own watch expressions appear in the trace table, and failures read like
"There's no variable called “balll”." instead of
"Execution error: Runtime error: NameError…".

Blockly is bundled (`blockly@11.2.2`, pinned exact) and the GlowScript 3.2 runtime is
vendored under `frontend/public/vendor/glowscript/`, so the IDE genuinely runs offline after
first load — a filtered school network no longer renders the block editor or the 3D viewport
inert. Monaco is still loaded from a CDN and falls back to a plain textarea without it.
```

- [ ] **Step 6: Commit**

```powershell
git add README.md docs/product-contract.md
git commit -m "docs: the block palette, the toolbox contract, the honest debugger, and offline-for-real"
```

- [ ] **Step 7: Hand off for the browser pass**

Report to the controller that the tranche is ready. Name the ten surfaces this plan deliberately changed, and ask for both themes on each:

1. **The block editor, physics goal** — every category is a new colour; chips and blocks match; block text is 13px; `sim_end` is purple, not red; orphaned blocks grey out instead of snapping into the program.
2. **The block editor, data-science goal** — Data Science is a collapsed parent drawer holding ten pipeline stages.
3. **The block editor, hybrid goal** — both families visible at once; check they read as two families, not twenty-six colours.
4. **Debug mode** — the drawer docks *beside* a running viewport (lateral, with Plan 2's caption strip still beneath the canvas); the header's view zone grows a debug group; breakpoints are offered only where they can fire; Pause says "Pausing…" first; "Next frame" moves the ball one step.
5. **The trace table** — Setup / constants collapsed section; the watch box; wide values with fixed decimals; the expand-on-click detail row; clicking a variable name highlights its block.
6. **The Help page** — the eight category chips are the actual block colours and the other 51 chips are unchanged; the three false Debug claims are corrected; right-click → Help on any block lands on its entry.
7. **The start menu** — goal badges in family colours.
8. **The welcome page** — the playground particles are product colours.
9. **The viewport in light mode, running a template** — the background is the light theme's, not a hardcoded navy (Task 2 Step 4).
10. **The Trace toggle without Debug** — the drawer opens on its own, the toggle shows its active state, and no debug controls appear.

Also flag: the 49 `e2e/*.png` are invalidated by items 1-5 and 9. Recommend a single screenshot-refresh commit *after* this pass, not during.

---

## Completion criteria (what the next tranche may assume)

- **Two dependencies landed, both approved and both closing a real hole.** `blockly@11.2.2` is pinned exact in `frontend/package.json` and enters through one module (`src/utils/blockly/blocklyLib.js`); `window.Blockly` does not exist. The GlowScript 3.2 runtime is six vendored files under `frontend/public/vendor/glowscript/` with provenance and SHA-256s recorded. **With `glowscript.org`, jsDelivr and Google Fonts all blocked, the IDE loads, the block editor renders and a simulation runs** — `docs/product-contract.md:101` is finally true. Monaco remains on its CDN with the `<textarea>` fallback, named in Deferred.
- **One palette, 26 categories, verified.** `src/utils/blockly/blockPalette.js` is the single source for category *and* block colour, consumed by the toolbox XML, the Blockly theme's `blockStyles`, and 26 `--cat-*` custom properties in `styles/tokens.css` whose values a test holds byte-identical to `paletteCssText()`. Every fill clears AA against white (worst **4.95:1**, best **6.10:1**); every `colourSecondary` does too (worst **4.56:1**); no fill sits in the 340°–15° band, so **red now means error, breakpoint or stop, and nothing else**. A future tranche can retheme the product by editing one table.
- **The registry and the toolbox describe the same product, enforced.** 120 entries in exactly 19 block-bearing categories; 26 drawers; `npm run check:blocks` fails on a registry id in no drawer, a registry category with no drawer, a drawer with no registry blocks that is not declared stock-or-parent, and an entry whose category is not a drawer its own block appears in. The 19 silently dead-ending search results are 0. The three template-shipped Objects blocks are reachable. The Data Science drawer is the analysis pipeline.
- **The debugger stops lying.** A breakpoint can only be *set* where a checkpoint exists, and the context menu says why when it cannot; breakable blocks carry a dashed marker in debug mode; breakpoints are seeded before `eval`, so a first-iteration breakpoint fires; they are kept across a debug-mode exit but armed only inside it; Pause shows "Pausing…" and becomes "Paused" only on the runtime's `__phpause` acknowledgement, or tells the student the program has nothing to pause on; "Next frame" advances one `rate()` call with a live iteration readout; the execution highlight pins while paused; setup constants and watch expressions are traced; and `describeRunError` replaces `Execution error: Runtime error: …` plus 300 characters of compiled JS with one sentence and a line number.
- **Debug is a mode, not a world.** `DebugMode.js` is deleted; the trace table docks in the `.debug-drawer` that existed unused for a release, **lateral** to the viewport (a new `.canvas-column` carries Plan 2's caption strip, so `.canvas-wrap` stays the row); step and record live in the header's `app-header__zone--view`; the 38 `.dm-*` shell rules are gone, `.dm-panel-header` and `.dm-panel-title` are stripped from Plan 1's primitive alias lists, and the four Blockly decorations are renamed `.bp-block` / `.bp-available` / `.block-executing`; there is one status bar, so debug failures are visible, with `.console-bar__detail` carrying the second sentence quietly; entering debug pauses rather than stops, and a student can edit blocks while stepping. `downloadCsv` exists once.
- **The Trace toggle Plan 2 preserved is wired, and the drawer has two doors.** `onToggleTrace` / `traceVisible` are supplied from `IDELayout`, the drawer opens on `debugMode || traceVisible`, and `.tb-btn--active` finally has its on-state — so "watch my numbers while I work" exists without entering Debug, which is what the review asked for. Nothing about that chain is left for a fourth tranche.
- **Explicit insertion attaches; a drag-aside does not.** `appendToSetup(workspace, block)` is exported and called by block search and the empty-state starter chips, so Plan 2 Tasks 11 and 13 keep their promised behaviour after the adoption loop is deleted.
- **The trace table is readable.** Values are wider (46% of the drawer, truncated at 24 characters, not 14), numeric values are fixed-precision, and min/max plus the snapshot diff sit in an expand-on-click detail row instead of crowding the sparkline. The shared `workspaceRef` is nulled on dispose, so clicking a variable name actually highlights its block.
- **One background, not seven.** The hardcoded navies at `blockTemplates.js:287,703,1110` and `precodedExamples.js:17,127,226,364` are deleted; Plan 2's `applyRuntimeTheme` owns `scene.background` alone, in both themes. This closes Plan 2 Task 14's explicit handoff — the review's "collapse the four background definitions to one" is done, not deferred a second time.
- **The type system did the sanctioned half.** `output: "Vector"` / `"Number"` on six producers, `check: ["Vector", "Number"]` on twenty vector slots — Blockly's own connection checking, per `docs/product-contract.md:39`, with no coercion engine. The DS "Frame" half is refuted in Deferred with the evidence, not silently skipped.
- **Orphans obey the contract.** One behaviour for every goal: greyed and ignored, never adopted (`docs/product-contract.md:36`). The force-adoption loop is gone, and `planOrphanState` is a pure, tested function.
- **Every block has `helpUrl`**, deep-linked to its entry in the in-app reference; twelve Python-call labels are natural language with the Python form in the tooltip; the beginner-mode metadata is deleted across registry, factory, schema, migrate and import, with `SCHEMA_VERSION` still 2 and no migration authored — **Walkthrough Mode rebuilds this deliberately later** as a guided flow over `BeginnerGuide.js`.
- **`styles.css` is seven `@import`ed files in cascade order**, proven by a byte-identical built-CSS diff. New CSS has an obvious home.
- **New pure helpers, all tested:** `blockPalette.js` (13 tests), `orphans.js` (7), `describeRunError.js` (11), `instrumentor.js` (7 new), `downloadCsv.js` (4). New suites on **Plan 2 Task 2's harness**, not a second one: `utils/blockly/__tests__/blocklyLib.test.js` (4) and `components/__tests__/ToolbarDebug.test.js` (7). No `frontend/src/__probe__/` directory exists or is created.
- **Not changed, and still open:** Monaco's CDN dependency and self-hosted fonts; the `.blocklyTreeRow` pill and colour swatch; the whole viewport camera cluster, ResizeObserver/DPR and the screenshot fix (Tranche 2's, and landed there); scene `title`/`caption` surfacing (Tranche 2's); a dataframe type check (refuted, with the evidence); the 49 `e2e/*.png` awaiting one refresh commit. **`.blocklyTreeIcon` is Plan 2 Task 13 Step 4's chevron and this plan leaves it exactly as Plan 2 wrote it.**
