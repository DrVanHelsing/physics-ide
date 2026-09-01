# IDE simplification audit — user findings verified, duplication inventoried (1 September 2026)

Two independent audits, run on the live tree at Plan 9 mid-execution (post-`0092d1f`), both
driving the real IDE headlessly at 1440x900 and ~1100px plus a full code inventory. Audit 1
verified four user-reported findings; audit 2 is the control-by-control duplication sweep the
user then asked for ("there shouldn't be duplicate functionality/buttons/layouts with their
own controls shown in addition to all others"). Both agents' full reports are concatenated
below, unedited. Screenshots (24 `dup-*.png` + audit-1's captures) and raw inventory JSON
were session artifacts; every finding also carries its file:line evidence, which is the
durable half.

**What this feeds, and the three calls it surfaces (controller synthesis):**

1. **A hotfix candidate that should not wait for any redesign:** "Analyse this run →"
   destroys the user's simulation workspace — hard XML replacement, no confirmation, no
   undo, autosaved into permanence within ~3s. Confirmed end-to-end in-browser. This is
   data loss behind a single unguarded click, in the same product whose Clear Workspace
   confirms and whose project delete (finding 9 below) also doesn't. Smallest honest fix
   is a guard + a real return path, not a redesign.
2. **The simplification pass itself** — audit 2's ranked top-10 plus the layout-layer and
   consistency findings are the ground for a design doc. It is Plan-10-adjacent but NOT in
   Plan 10's locked scope (mobile audit + gate; runner visual defaults), so it needs its own
   slot — the user's sequencing call.
3. **The graphing gap needs a scope ruling:** live Trinket-style graph blocks are pure
   block-registry + generator work (the vendored GlowScript runtime already ships
   gcurve/gdots/gdisplay), but Plan 10's locked scope says NO new blocks — the user
   explicitly refused added block complexity there. Adding live graphing is therefore a
   deliberate scope amendment only the user can make.

Signed-in-only surfaces (RulesChip, BatonChip, NotificationBell, Share, History, BriefPane)
were outside both audits' guest-session reach and remain unaudited for duplication.

---
# Physics IDE UX Audit — 2026-09-01

Scope: `frontend/src`, `shared/src`, `docs/` (repo-root `.worktrees/` excluded from all greps). Dev servers verified live at http://localhost:3000 (vite) and http://localhost:4000 (backend) before browser testing. Browser verification used Puppeteer (repo root `node_modules/puppeteer`) driven from throwaway scripts in `frontend/scripts/*.tmp.mjs`, all deleted after use; screenshots saved to this scratchpad directory only.

---

## Claim 1 — "One option I couldn't find was the option to create a graph display then add a graph to it… I tried the help as well but nothing seemed obvious."

**VERDICT: CONFIRMED.** No block anywhere creates a live graph display or plots x/y series during a running simulation (no Trinket-style `gdisplay`/`gcurve`/`gdots`/`plot(x,y)`). The only graphing blocks in the product are Data Science blocks that chart an already-recorded dataset after the run — a materially different capability from what the user was looking for, and the docs never say so explicitly.

**(a) Block registry / toolbox / generators** — no live-plotting block exists.
- `frontend/src/utils/blockly/blockRegistry.js` — no `graph`/`gcurve`/`gdisplay` entries at all. The only "plot"-flavoured entries are Data Science chart blocks: lines 342, 368, 414, 417, 419–420, 425–426 (`box plot`, `bar chart`, `line chart`, `scatter plot`, `box plot`) — all operate on a `df` dataset, not on live simulation state.
- `frontend/src/utils/blockly/blocklyGenerator.js` — `ds_chart_scatter_block` (line 1484), `ds_chart_box_block` (line 1513), `ds_chart_scatter_fit_block` (line 1833) generate `scatter_plot(df, …)` / `box_plot(df, …)` Python calls (lines 2653, 2668, 2737, 2822) — again dataset-driven, not scene-driven.
- Category rail in the toolbox (confirmed live in-browser, screenshot `05-hybrid-project-opened.png`) is: Values, Objects, Motion, State, Control, Logic, Math, Variables, Data Science, Advanced. There is no "Graphs" category and no block under any category that instantiates a display surface for live time-series data during a run.

**(b) Vendored GlowScript runtime does ship the primitives** — `gcurve`/`gdisplay`/`gdots` exist in `frontend/public/vendor/glowscript/glow.3.2.min.js` and `RScompiler.3.2.min.js` (grep confirmed matches in both files). So the underlying VPython engine *could* support a live graph if a block or hand-written code called it — the gap is entirely in the block layer and generator, not the runtime.

**(c) Help / user guide never covers live graphing.** Grepped `docs/Physics_IDE_User_Guide.md` and `frontend/src/components/HelpPage.js` for `graph|gcurve|gdisplay|gdots|plot|chart` — every hit is about the Data Science chart blocks (`HelpPage.js` lines 1521–1543, "Chart blocks" table: bar/line/scatter/scatter+fit/histogram/box, all dataset-driven) or the hybrid "Analyse this run" loop-closure (lines 502–519, 1835–1841). Nothing in either document mentions plotting a variable live while the 3D simulation runs, and nothing tells the user that this isn't possible — the user's "I tried the help as well but nothing seemed obvious" is accurate; the help doesn't cover it because the feature doesn't exist, and doesn't say so.

**(d) The actual mechanism is "record, then chart later," not live `gcurve`.** Confirmed in code and live in-browser:
- `frontend/src/components/DataPanel.js` lines 289–294 — the empty-state hint for a Physics/Hybrid project's Data panel literally reads: *"Run the simulation, open Debug Mode, record a few variables, then click **Chart** on the trace panel to promote the run into a dataset."* Verified verbatim on-screen, screenshot `05-hybrid-project-opened.png`.
- Flow: Run → Debug Mode → watch/record variables in `TraceTable` (`frontend/src/components/TraceTable.js`, Record/Stop/Chart buttons around lines 450–491) → `TracePromoteDialog` (`frontend/src/components/TracePromoteDialog.js`) saves the recording as a static dataset → `ChartOverlay` (`frontend/src/components/ChartOverlay.js`) shows a **post-hoc, static** line/scatter chart of that saved dataset (screenshot `11-chart-overlay.png` — a modal chart of `alpha` vs `t` from a completed run).
- This is fundamentally different from Trinket's `gdisplay`/`gcurve`: nothing updates live while the simulation runs; the chart only exists after the run is stopped and explicitly promoted through a 4-step modal flow (Debug → Record → Stop → Chart → Save dataset). A user scanning the toolbox for a "graph" block during a live run — as the report describes — will not find one, and the help text never redirects them to this alternate, after-the-fact path.

**Root cause:** product-level gap, not a bug — live time-series graphing during a run was never implemented; only post-run dataset charting exists, and the docs don't disambiguate the two.

**Smallest-change direction:** name the existing "record → Chart" path more discoverably from where the user is actually looking (the toolbox/Help search for "graph"), without necessarily building live `gcurve`.

---

## Claim 2 — "When using a hybrid project, recording a dataset, and using it to perform an analysis on the data recorded — in this new block view I am unable to return to the simulation workspace/block editor."

**VERDICT: CONFIRMED, and worse than "hard to find" — it is a one-way, unwarned, autosaved destructive replacement with no in-app path back.** Fully reproduced end-to-end in the browser.

**Reproduction (all screenshots in this directory):**
1. Created a Hybrid project from the "Simple Pendulum" template (wizard: Hybrid → Template → Pendulum → Model-first → Create). `05-hybrid-project-opened.png` shows one single Blockly workspace containing both the full physics block chain (Scene setup, Colours, Pendulum parameters, physics loop) **and** the Data Science / Advanced categories in the same toolbox rail — hybrid mode is not two separate block views, it's one workspace, one toolbox.
2. Ran the simulation, opened Debug Mode, watched/recorded variables, stopped recording, clicked **Chart** → **Save dataset** → `ChartOverlay` opened showing the recorded run (`11-chart-overlay.png`).
3. Clicked the overlay's **"Analyse this run →"** button (only present because this hybrid template has a paired analysis, `hybridPairing`). Result: `12-after-analyse-swap.png` — the Block Editor pane now shows **only** the paired analysis block chain ("Start analysis · Pendulum: measure the damping coefficient · run_data = trace dataset · show table · filtered = … · fit = linear fit · scatter+fit chart · conclusion"). The entire original physics block chain from step 1 (scene setup, colours, `L`/`m`/`b`/`theta` parameters, the simulation loop) is **gone** from the canvas — not hidden, not collapsed, not tabbed away — replaced.
4. Clicked the toolbar's **"Back to Blocks"** button (visible the whole time) — no effect on the swapped-out content (`13-after-back-to-blocks-click.png` is pixel-identical to `12-after-analyse-swap.png`, just the status bar now reads "Reset to blocks mode").
5. Waited 3.5s (past the 3000ms autosave debounce) — `14-after-autosave-wait.png` confirms "Saved on this computer · just now": the analysis-only workspace, with the physics blocks gone, is now the **persisted** state of the project.

**Root cause — precise:**
- `frontend/src/components/layout/IDELayout.js:375-389` (`handleAnalyseRun`): looks up the paired analysis template's XML and calls `sim.loadWorkspaceXml(xml)` with **only** that template's XML — nothing from the current workspace is merged, saved, or referenced.
- `frontend/src/hooks/useSimulation.js:316-329` (`loadWorkspaceXml`): its own comment says exactly what it does — *"swaps the current blocks for the paired analysis template."* It calls `setWorkspaceXml(xml || "")` unconditionally; there is no stash of the previous XML anywhere in this function or its caller.
- `IDELayout.js:373` then bumps `workspaceReloadKey`, which remounts `<BlocklyWorkspace key={...} initialXml={workspaceXml}>` — a fresh Blockly instance with a fresh undo stack, so **Ctrl+Z does not help either** (undo history does not survive the remount).
- The toolbar's **"Back to Blocks"** control (`Toolbar.js:317-323`, handler `useSimulation.js:207-215` `handleResetToBlocks`) is unconditionally present in every goal/mode (`frontend/src/utils/toolbar/visibleControls.js:63`, `"reset"` is in the `view` array with no gating) — but it only sets `mode="blocks"` and regenerates Python from **whatever XML is currently loaded**. It does nothing to recall the pre-swap XML; it's a red herring for this specific problem despite its label implying otherwise.
- Contrast: the genuinely destructive "Clear all blocks" action **does** show a native confirm dialog ("Clear all blocks from the workspace? This cannot be undone.", `useSimulation.js:384`). `handleAnalyseRun` has **no such confirmation** — the swap happens instantly and silently on a single click of "Analyse this run →".
- `frontend/src/hooks/useProject.js:82-96` — the debounced autosave (`MANIFEST_AUTOSAVE_MS = 3000`, `frontend/src/constants/index.js:51`) watches `sim.workspaceXml` and persists any change that differs from the saved manifest. The swapped (analysis-only) XML differs, so it autosaves within 3 seconds — overwriting the manifest's stored physics blocks too. No version history / revert feature exists anywhere in the codebase (grepped `revert|version history|restore previous` — no hits). So after ~3 seconds, the original simulation is not recoverable through the app at all, short of the toolbox rail still being present so the user could hand-rebuild it from scratch (parameter values, colours, geometry — all lost).

**This is not "undiscoverable" — it is functionally gone.** The user's framing ("unable to return to the simulation workspace") is exactly right; the mechanism is worse than a missing button, it's an unrecoverable data-loss path that both the docs (`HelpPage.js:511-519`, `1835-1841`) and the UI describe/present as a normal, celebrated feature ("the loop closure") with no warning.

**Smallest-change direction:** stash/restore the pre-swap workspace XML (or block the autosave from persisting over it) so "Analyse this run" is reversible.

---

## Claim 3 — "This entire UI/UX is extremely busy with a lot going on."

**VERDICT: Characterized, not falsifiable as stated (per the brief).** Inventory at 1440×900, comparing a Physics-only project to a Hybrid project with the Data panel populated, using the same DOM-based visible-element count in both cases.

| State | Screenshot | Visible `<button>`s | Visible inputs/selects | Toolbox category rows | Structural panes | Status-bar segments | Resizable divider present |
|---|---|---|---|---|---|---|---|
| Physics-only, blank, idle | `P1-physics-only-blank.png` | 21 | 1 | 9 | 2 (editor-pane, canvas-pane) | 5 | yes |
| Physics-only, running | `P2-physics-only-running.png` | 23 | 1 | 9 | 2 | 5 | yes |
| Hybrid, blank, idle | (inventory only, matches `05-hybrid-project-opened.png`) | 18 | 1 | 10 | 4 (+ hybrid-viewport, hybrid-datapanel) | 5 | yes |
| **Hybrid, Data panel populated, normal (not debugging)** | `B2-hybrid-datapanel-populated-normal.png` | **24** | 1 | 10 | 4 | 5 | yes |
| Hybrid, Data panel populated, **Debug Mode active** (recording UI) | `B1-hybrid-datapanel-populated-debugmode.png` | **72** | 3 | 10 | 4 | 5 | yes |

Reading the numbers: a Hybrid project with its data panel showing content is only modestly busier than Physics-only at rest (24 vs 21 visible buttons; +1 toolbox category for "Data Science"; +2 structural sub-panes because the right side is split into a 3D viewport strip and a Data panel strip stacked vertically). The dramatic jump is **Debug Mode**, which is available in both Physics-only and Hybrid: opening it adds a per-variable trace/watch table where every row carries its own pin/bell/expand controls, more than tripling the visible-button count (24 → 72) and adding 2 more inputs. Debug Mode is also the *documented, required* path to record a dataset (Claim 1(d)/Claim 2), so a user doing exactly what the app tells them to do to get a graph will pass through the busiest state in the product.

Screenshots for visual reference: `P1-physics-only-blank.png` (physics baseline) and `B2-hybrid-datapanel-populated-normal.png` (hybrid with a saved dataset showing) show the product side by side at the same viewport size.

**Smallest-change direction:** none prescribed per the brief (inventory only); the Debug-Mode trace table's per-row control density is the single largest driver of "busy" if a reduction were pursued.

---

## Claim 4 — "I want the data/3d viewports to be resizable, and perhaps modals/popups/overlays to save space and better encapsulate different functionality."

**VERDICT: Partly confirmed / partly already true — resizing exists on two of three candidate axes, and a shared Overlay/modal system already exists and is used for auxiliary dialogs, but not for the two main content viewports.**

**Resizability — what exists today:**
1. **Editor pane ↔ everything-on-the-right (Physics, Data Science, and Hybrid alike): resizable.** `frontend/src/components/layout/IDELayout.js:770-783` renders a `.pane-divider` (`role="separator"`, `aria-label="Resize editor and viewport"`) between `.editor-pane` and `.canvas-pane`, driven by `frontend/src/hooks/useSplitPane.js`: pointer-drag (lines 24-62) and keyboard (ArrowLeft/ArrowRight/Home, lines 64-73) resize, clamped to `SPLIT_MIN`/`SPLIT_MAX`. This is real, working, accessible resizing. Confirmed present in every screenshot taken (`hasDivider: true` in every inventory dump).
2. **Debug drawer (trace/variables panel) width: resizable.** `frontend/src/components/DebugDrawer.js:20-66` — a `.debug-drawer-handle` separator, pointer-drag + arrow-key resize, clamped 200–500px.
3. **3D viewport ↔ Data panel split, inside a Hybrid project: NOT resizable.** `frontend/src/styles/base.css:63-83` — `.hybrid-viewport { flex: 0 0 55%; }` and `.hybrid-datapanel { flex: 0 0 45%; }` are hard-coded flex-basis percentages. There is no divider element between them in the JSX (`IDELayout.js:797-822` renders `.hybrid-viewport` and `.hybrid-datapanel` back-to-back with nothing else in between) and no CSS `resize` property. So the one split that most directly maps to the user's "data/3d viewports… resizable" request — the split *between* the two — is fixed at 55/45 today. This is the concrete gap behind the claim.

**Overlay/modal inventory — what already exists (`frontend/src/components/common/Overlay.js`, a shared focus-managed dialog wrapper: Escape closes, backdrop click closes, focus moves in/out):**
- In the IDE proper: `ChartOverlay.js` (post-run chart), `TracePromoteDialog.js` (save-run-as-dataset), `VariableDialog.js` (variable editor), `assignments/BriefPane.js:227` (assignment brief "pop out"). These are all **auxiliary dialogs**, not the primary content surfaces.
- In the portal/admin side (outside the IDE shell): `admin/AdminConsole.js`, `admin/DataRequestsTab.js`, `sharing/ShareDialog.js`.
- `StartMenu.js` and `HelpPage.js` are full-screen overlay-style screens but are bespoke (do not import the shared `Overlay` component) — noted in `ChartOverlay.js`'s own header comment ("Modeled on the fullscreen-overlay pattern used by StartMenu and HelpPage").
- The 3D viewport and Data panel themselves are **always docked**, never overlay/modal surfaces — they are permanent flex children of `.canvas-pane` / `.canvas-pane--hybrid`, not candidates the existing `Overlay` system currently covers.

**Smallest-change direction:** add a drag handle between `.hybrid-viewport` and `.hybrid-datapanel` using the same pattern as the existing `useSplitPane`/`DebugDrawer` handles, rather than building new resize infrastructure from scratch.

---

## Files referenced (absolute paths)
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\utils\blockly\blockRegistry.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\utils\blockly\blocklyGenerator.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\utils\blockly\toolbox.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\public\vendor\glowscript\glow.3.2.min.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\docs\Physics_IDE_User_Guide.md`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\HelpPage.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\DataPanel.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\ChartOverlay.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\TracePromoteDialog.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\TraceTable.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\layout\IDELayout.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\hooks\useSimulation.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\hooks\useProject.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\hooks\useSplitPane.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\DebugDrawer.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\Toolbar.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\utils\toolbar\visibleControls.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\styles\base.css`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\components\common\Overlay.js`
- `C:\Users\tredi\Documents\Projects\Physics IDE\frontend\src\constants\index.js`

## Screenshots (this directory)
`05-hybrid-project-opened.png`, `06-running.png`, `07-debug-open.png`, `08-recording.png`, `09-recorded.png`, `10-trace-promote-dialog.png`, `11-chart-overlay.png`, `12-after-analyse-swap.png`, `13-after-back-to-blocks-click.png`, `14-after-autosave-wait.png`, `P1-physics-only-blank.png`, `P2-physics-only-running.png`, `B1-hybrid-datapanel-populated-debugmode.png`, `B2-hybrid-datapanel-populated-normal.png`, plus early navigation screenshots `00-welcome-page.png` through `04-wizard-filled.png`.


---

# Physics IDE — UI/UX duplication & simplification audit
**Date:** 2026-09-01 · **Branch:** `feature/classroom-platform` · **Scope:** the IDE at `/` (welcome gate, start menu, physics / data-science / hybrid modes, debug tools, overlays). Portal screens (`/classes`, `/admin`, …) are out of scope except where IDE chrome bleeds into them.
**Method:** `frontend/src/utils/toolbar/visibleControls.js` + component JSX as the authority for what *can* render; live Puppeteer probes at 1440×900, 1200×900 and 1100×900 for what *does* render. Every claim below carries a `file:line` or a screenshot filename.
**Screenshots:** all `dup-*.png` in this directory. Raw per-surface control dumps: `dup-inventory-1.json`, `dup-inventory-2.json`, `dup-inventory-3.json`.

---

## TOP 10 SIMPLIFICATION WINS (ranked)

| # | Win | Evidence | Smallest-change direction |
|---|-----|----------|---------------------------|
| 1 | **`Record` renders twice at once, wired to the same two handlers, with two labels and two enabled rules.** SimControls "Record"/"Stop Rec" and TraceTable "Record"/"REC" are visible simultaneously the moment debug mode is on. | `IDELayout.js:592-593` and `:479-480` pass the *same* `trc.handleStartRecord` / `handleStopRecord` to both; `SimControls.js:125-133`; `TraceTable.js:450-472`. `dup-31-debug-on.png`, `dup-35-chart-overlay.png` (one says "Stop Rec", the other "REC", same instant). | **Keep one** — delete the SimControls copy; recording is a *trace-panel* action and the panel is always open in debug mode. |
| 2 | **Two "fit the blocks to the view" buttons in the same pane, 620 px apart, with different icons.** `block-search-fit` (MaximizeIcon, top-right of the blocks pane) and `workspace-zoom__btn` "Fit blocks to view" (ScanIcon, bottom-right cluster). | `BlocklyWorkspace.js:116-134` vs `WorkspaceZoom.js:46-54`. Both visible in every blocks screenshot, e.g. `dup-03-physics-blocks-1440.png` at `[685,87]` and `[666,748]`. | **Delete** `block-search-fit`; the on-canvas zoom cluster already owns fit and shows the resulting %. |
| 3 | **`Back to Blocks` duplicates the mode toggle's `Blocks` tab and renders even when already in blocks mode**, where its only remaining effect is "stop the run" — under a label that says nothing about stopping. | `visibleControls.js:63` puts `reset` in *every* configuration; `Toolbar.js:317-323`; `useSimulation.js:207-215` = `endRun` + `setMode("blocks")`. Visible beside an active `Blocks` tab in `dup-03/22/24/30/31`. | **Delete** — the mode toggle already changes mode and Stop already stops; nothing is left. |
| 4 | **The `Trace` header button is inert while Debug mode is on, and lies about its state.** `traceOpen = dbg.debugMode \|\| traceVisible`, so with debug on the drawer cannot be closed, yet the button still reads "Show live trace table" while the drawer is already open. | `IDELayout.js:203-205`; `Toolbar.js:299-306`. `dup-31-debug-on.png`: `.trace-panel` present *and* button title = "Show live trace table", no `tb-btn--active`. | **Merge** into the Debug toggle (one "Debug" control opens mode + drawer), or make the drawer genuinely closable in debug. |
| 5 | **Every editor pane carries a 36 px header whose entire content is a label the mode toggle 20 px above already shows** — and in Code-View-Only projects the two strings are byte-identical. | `IDELayout.js:678-692` ("Block Editor"), `:742-755` ("Code View Only") vs `ModeToggle.js:24` `codeLabel` (`IDELayout.js:658`). `dup-08-physics-code-1440.png`: header "Code View Only", tab "Code View Only". | **Delete** the blocks/code `pane-header`; move the read-only badge into the mode toggle's tab. Recovers 36 px in every view. |
| 6 | **Three "fit"/"reset" verbs across three panes share two icons in a crossed pattern.** ScanIcon = "Fit blocks to view" *and* "Fit scene to view" (different targets, same icon); MaximizeIcon = "Fit all blocks on screen" (same target as ScanIcon, different icon). "Reset camera" (canvas) and "Back to Blocks" (`reset` key) also collide on the word. | `WorkspaceZoom.js:2,46-54`; `ViewportControls.js:2,97-101`; `BlocklyWorkspace.js:133`; `visibleControls.js:63`. `dup-30-running-blocks.png`. | **Keep-one per target** and fix the icon mapping: one fit idiom per pane, one icon per verb. |
| 7 | **Two screenshot paths with two different destinations and no cross-reference.** File ▸ "Screenshot Viewport (.png)" downloads a file; the canvas cluster's camera icon opens the image in a new tab. Both gated on the same `exportAndCopy` rule. | `Toolbar.js:216-221` → `useExport.js:115`; `ViewportControls.js:116-131`. Both live in `dup-30-running-blocks.png`. | **Keep one** — the on-canvas camera, which is where the picture is. |
| 8 | **A 3-layer, ~147 px chrome stack before the first block, and at 1100 px with debug on the viewport's control strip is twice as wide as the viewport.** | Measured: `.app-header` 44 + `.pane-header--blocks` 36 + `.block-search` 41 + `.status-bar` 26 = 147 px (`dup-03`). `dup-33-debug-1100.png`: `.sim-controls` w=434 inside `.pane-header--viewport` w=545, while `.canvas-column` = **w=221**. | **Merge** — collapse pane headers into the app header (win #5) and let the sim controls collapse like everything else. |
| 9 | **Deleting a whole project has no confirmation; clearing blocks inside one does.** Inverted safety. | `StartMenu.js:533-541` → `IDELayout.js:555` → `ProjectContext.js:196-207` (no `confirm`). vs `useSimulation.js:381-389` (`confirm("Clear all blocks…")`). | **Add confirm** to project delete (or drop it from `Clear`) so one destructive idiom governs both. |
| 10 | **Overflow menu items print their own tooltip as a fake keyboard shortcut**, so every collapsed item reads "Hide Hide 3D viewport", "Clear Clear all blocks", "Help Help & Documentation". | `Toolbar.js:380-386` puts `a.label` into `.tb-dropdown-shortcut` (`chrome.css:375`), a slot styled for hotkeys. `dup-13-physics-1100-overflow-open.png`. | **Delete** the `.tb-dropdown-shortcut` span, or put the real hotkey there. |

---

## 1. Per-surface control inventory

Counts are *visible interactive elements* (buttons, links, inputs, menu items, resize separators) as measured in-browser. Blockly's SVG-rendered toolbox categories, block fields and flyout blocks are **not** counted (they are not DOM controls); the toolbox is counted once as a layer.

### 1.0 Welcome gate — `/` signed-out (`dup-00-landing.png`) — 25 controls
`WelcomePage.js`. This is what `/` renders before the IDE. Included because it is the IDE's only door.

| Control | Action | Location |
|---|---|---|
| "Skip to content" | a11y skip link | `welcome/WelcomePage.js` |
| Gravity range slider (`input.range`, value 9.8) | hero demo gravity | welcome hero |
| "Moon 1.6" / "Earth 9.8" / "Jupiter 24.8" | hero demo presets | welcome hero |
| "Trails" (`welcome-hero__trails`) | hero demo toggle | welcome hero |
| "Reset" (`welcome-hero__reset`) | hero demo reset | welcome hero |
| "Use the IDE — no account needed" | enter IDE | hero CTA |
| Brand link, About, For teachers, Contact | nav | header |
| Theme toggle (`tb-btn--theme`) | theme | header — `ThemeToggleButton.js:13` |
| "Sign in" (linklike) | auth | header |
| "Open the IDE" (`btn--primary btn--sm`) | enter IDE | header |
| 4 × example tiles | seed a project | mid page |
| "Join your class" | portal | mid page |
| About (footer), "Open the IDE" (2nd), Privacy, "Create an account", "Sign in" (2nd) | — | footer |

> **Note for the brief:** the *Gravity slider + Moon/Earth/Jupiter + Trails/Reset* cluster seen in earlier screenshots belongs to **this hero demo**, not to the IDE's 3D viewport. The IDE viewport's actual overlay is the 4-button camera cluster in §1.6. They are, however, a *fourth* run/reset/preset idiom in the product.

**Duplication inside this surface:** 3 CTAs into the IDE ("Use the IDE — no account needed", "Open the IDE" ×2), 2 "Sign in", 2 account-creation entries with 2 different strings ("Create an account" / "Create account").

### 1.1 Start menu (`dup-01-startmenu.png`) — 15 controls
`StartMenu.js:353-512`

| Control | Action | Location |
|---|---|---|
| "Documentation" | opens HelpPage | `StartMenu.js:381-383` |
| "Open File…" | hidden `<input accept=".py,.xml,.json,.physide.json">` | `StartMenu.js:385-398` |
| `AccountChip`: "Sign in" / "Create account" (stacked `nav-row` links) | auth | `StartMenu.js:399` → `auth/AccountChip.js:13-25` |
| 3 × goal card (Physics / Data Science / Hybrid) | open the wizard | `StartMenu.js:452-481` |
| 8 × template card (4 Blocks, 4 Code) | create project immediately | `StartMenu.js:485-506` |
| *(with saved projects)* per-row `start-project-open` + `start-project-delete` | open / delete | `StartMenu.js:517-542` |

No theme toggle, no header, no status bar. Its own VS-Code-style `.start-titlebar` (h=30) and `.start-sidebar` are a chrome vocabulary used nowhere else.

### 1.2 Start menu — wizard open (`dup-20-wizard-physics.png` blank path, 12; `dup-21-wizard-template-path.png` template path, 20)
`StartMenu.js:565-700`

Title input · Cancel (✕, `:573`) · 2 radio pairs (start path, editor) · **8 template rows** when the "template" start path is chosen (`:615-644`) · Cancel · "Create project".

**Duplication:** the 8 templates are reachable two ways with two different UIs — as cards on the start page (`:485-506`, one click, creates immediately) and as rows inside the wizard (`:619-644`, three clicks). Same 8 items, same `templateId`, two layouts.

### 1.3 Physics IDE — blocks view, idle, 1440 (`dup-03-physics-blocks-1440.png`) — 23 controls

**Layers (px):** `.app-header` y0 h44 · `.pane-header--blocks` y44 h36 · `.block-search` y80 h41 · `.status-bar` y874 h26 · plus on-canvas `.workspace-zoom` (h127) and the Blockly toolbox rail (w180).

| Control | Action | Location |
|---|---|---|
| "Menu" (`tb-btn--nav`) | back to start menu | `Toolbar.js:341-344` |
| Atom logo + "PhysicsIDE" (non-interactive) | — | `Toolbar.js:345-348` |
| Project title button | inline rename | `Toolbar.js:350` → `ProjectTitle.js:45-56` |
| "Blocks" / "Code View Only" (`mode-toggle`) | switch editor | `IDELayout.js:654-659` → `ModeToggle.js:6-26` |
| "Hide" (`viewport`) | hide 3D pane | `Toolbar.js:287-293` |
| "Back to Blocks" (`reset`) | stop run + set blocks mode | `Toolbar.js:317-323` |
| "Clear" (`clear`, danger) | clear all blocks (confirms) | `Toolbar.js:324-331` |
| "Help" | HelpPage overlay | `Toolbar.js:332` |
| "Save" | save project | `Toolbar.js:144-155` |
| "File" ▾ | import/export menu | `Toolbar.js:156-268` |
| Theme toggle | dark/light | `Toolbar.js:269` |
| "Guest" ▾ | account menu | `Toolbar.js:405` → `auth/HeaderAccount.js` |
| Block search input (+ clear ✕) | find & insert a block | `BlocklyWorkspace.js:100-115` |
| Fit-all (Maximize) | `zoomToFit()` + `scrollCenter()` | `BlocklyWorkspace.js:116-134` |
| Zoom in / Zoom out / Fit blocks to view / "N%" | workspace zoom | `WorkspaceZoom.js:28-55` |
| 3 × starter chips ("A ball that falls", "An animation loop", "Gravity") | insert block XML | `IDELayout.js:730-736` → `BlocklyEmptyState.js` |
| "Dismiss tip" ✕ | dismiss a coach tip | `BeginnerGuide.js:46-48` |
| `.pane-divider` | resize split (pointer + arrow keys) | `IDELayout.js:770-783` |
| "Run" | start simulation | `IDELayout.js:576-595` → `SimControls.js:77-88` |

Status bar (non-interactive here): project title · `SaveState` · `RulesChip` · `BatonChip` · `AttributionChip` · run status · "VPython 3.2" (`IDELayout.js:839-859`).

**Not reachable in this state (code says they exist):** `trace` and `debug` are gated on `sim && (live || traceVisible || debugMode)` — `visibleControls.js:61-62`. See §1.5.

### 1.4 Physics IDE — code view, 1440 (`dup-08-physics-code-1440.png`) — 14 controls
Loses: Clear (blocks-only, `visibleControls.js:64`), block search, fit-all, the whole zoom cluster, starter chips, coach tip. Gains: Monaco's hidden `textarea.inputarea`.
`.pane-header--code` (h36) reads **"Code View Only"** — identical to the active mode-toggle tab 20 px above it (`IDELayout.js:748-749` vs `:658`).

### 1.5 Physics IDE — running (`dup-30-running-blocks.png`) — 25 controls
`Run` → `Stop` (`SimControls.js:68,79-88`). Two new header buttons appear: **"Trace"** and **"Debug"**. The canvas cluster appears (§1.6). `.canvas-caption` (h32) appears under the viewport.

### 1.6 3D viewport pane + on-canvas cluster
| Layer | Contents | Location |
|---|---|---|
| `.pane-header--viewport` h36 | Globe icon + "3D Viewport" + `<SimControls>` | `IDELayout.js:802-807`, `:825-830` |
| `.sim-controls` (idle/running) | one Run/Stop toggle (w=61–66) | `SimControls.js:77-88` |
| `.sim-controls` (debug on) | + Pause/Resume · Next frame · Next value · Record/Stop Rec · `N bp` chip · iteration chip → **w=482** | `SimControls.js:93-146` |
| `.canvas-controls` h32, 4 buttons | Reset camera · Fit scene to view · Fullscreen viewport · Copy a snapshot to a new tab | `ViewportControls.js:83-133` |
| `.canvas-controls-hint` | "Drag: rotate · Wheel: zoom · Right-drag: pan" (auto-hides) | `GlowCanvas.js:128-132` |
| `.canvas-idle` (not running) | atom animation + "3D Viewport" + "Press **Run** to start the simulation" | `GlowCanvas.js:94-121` |
| `.canvas-caption` h32 | scene title/caption read back from the runtime | `GlowCanvas.js:134-139` |

### 1.7 Debug mode ON (`dup-31-debug-on.png`) — 41 controls
Header `Debug` → `Exit Debug` (`Toolbar.js:307-316`). SimControls grows the 4-button step group. **The trace drawer opens automatically** (`IDELayout.js:205`) bringing 11 more controls. `.canvas-column` shrinks to w=391 (from 715).

### 1.8 Debug drawer / trace panel — 11 controls + 2 inputs
`DebugDrawer.js:68-95` (resize handle, `TraceTable`) · `TraceTable.js:424-566`

| Control | Action | Location |
|---|---|---|
| `.debug-drawer-handle` | resize drawer (px, arrow keys) | `DebugDrawer.js:70-81` |
| "Record" / "REC" | start/stop recording | `TraceTable.js:450-472` |
| "Rec.CSV" | `downloadCsv(recordBuffer)` | `TraceTable.js:473-481` |
| "Chart" | promote recording → dataset → ChartOverlay | `TraceTable.js:482-492` |
| "Snap" / ✕ Snap | snapshot / clear snapshot | `TraceTable.js:496-504` |
| "CSV" | `exportCsv(data)` (live values) | `TraceTable.js:506-514` |
| "Clear" | clear trace data | `TraceTable.js:516-523` |
| Watch expression input | add a watch | `TraceTable.js:527-544` |
| Filter input | filter rows | `TraceTable.js:552-566` |
| "Setup / constants (N)" | collapse section | `TraceTable.js:613-623` |
| per-row: pin, expand, alert edit/save/delete | — | `TraceTable.js:399-422` |

Drawer header stack before the first data row: `.trace-panel-header` **110 px** + `.trace-search-bar` **26 px** = 136 px, inside a 320 px-wide drawer.

### 1.9 Data-science IDE (`dup-22-ds-blocks.png` 18 · `dup-23-ds-code.png` 13)
Right pane is `DataPanel` (`IDELayout.js:786-796`). Header (h36): Table icon + "Data" + meta + a single `↺` button, "Re-pick CSV files on next run" (`DataPanel.js:249-255`).
Header loses `Hide` (no `viewport` key — `visibleControls.js:55`) and **has no Run at all**: DS code executes implicitly inside `handleWorkspaceChange` (`IDELayout.js:290-326`).
DS **code** view (`dup-23-ds-code.png`) has *no execution path whatsoever* — Monaco edits call `setPythonCode`, which never reaches `runDsCode`. Nothing runs; the panel silently keeps the last blocks result.

### 1.10 Hybrid (`dup-24-hybrid.png`) — 20 controls
`.canvas-pane--hybrid` splits vertically: `.hybrid-viewport` (y44 h457, its own `pane-header--viewport` + SimControls) over `.hybrid-datapanel` (y501 h374, its own `data-panel-header`). Two panel headers stacked in one 830 px column, on top of the editor's pane header and the app header: **4 horizontal chrome bands**.
The single "Run" button runs only the simulation half; the data half re-runs implicitly on every block change (`IDELayout.js:290`).

### 1.11 File menu expanded (`dup-04-physics-filemenu.png`) — 33 controls (10 menu items)
`Toolbar.js:156-268`: Import blocks or Python (.py, .xml) · Open project bundle (.physide.json) · ─ · Export as Python (.py) · Export Blocks (.xml) · Code as PDF · Blocks as PDF · Screenshot Viewport (.png) · Copy Code to Clipboard · Export Project Bundle (.physide.json) · *(+ Share… and ─ History & restore, signed-in only)*.
Trigger icon is `DownloadIcon` (`Toolbar.js:165`) on a menu whose first two items are imports.

### 1.12 Account menu expanded (`dup-05-physics-accountmenu.png`) — 25 controls (2 items as guest)
`auth/HeaderAccount.js:33-72`: guest → Sign in, Create account; member → My classes, Profile, (Admin console), Sign out.

### 1.13 Overflow menu at 1100 (`dup-12`/`dup-13`) — 22 / 26 controls
`Toolbar.js:371-388`. Contains exactly `zones.view` (Hide, Back to Blocks, Clear, Help — plus Trace/Debug when live). Each item renders `short` **and** `label` (`:383-384`).

### 1.14 Stage-1 at 1200 (`dup-14-physics-1200-stage1.png`) — 25 controls
View-zone buttons drop their labels and become 29×25 icon-only; **Save keeps its label**, File keeps its label. Three label policies in one 44 px row.

### 1.15 Blockly's own chrome
- Stock trashcan **off** (`BlocklyWorkspace.js:398`), zoom controls **off** (`:411`), scrollbars on, grid 25/3/snap (`:409`).
- `WorkspaceTrash.js` replaces the trashcan: invisible at rest, fades in on drag, registered as a `DeleteArea` — **no confirmation**.
- Workspace context menu (`dup-06-blockly-contextmenu.png`, 6 items): Undo · Redo · Clean up Blocks · Collapse Blocks · Expand Blocks · **Delete 2 Blocks**.
- Block context menu in debug (`dup-34-debug-block-contextmenu.png`, 8 items): Duplicate · Add Comment · Inline Inputs · Collapse Block · Disable Block · Delete 2 Blocks · **Help** · breakpoint item (`BlocklyWorkspace.js:451-462`).

### 1.16 Overlays
| Overlay | Wrapper | Close idiom | Backdrop-dismiss | Location |
|---|---|---|---|---|
| HelpPage (`dup-36-help-page.png`, **53 controls**: close, search, 15 nav items + the whole IDE header still live underneath) | hand-rolled `.help-overlay` | text button "Close" | no | `HelpPage.js:324-337` |
| StartMenu | `.start-menu-overlay` + `.start-titlebar` | none (leave by opening/creating) | no | `StartMenu.js:354-360` |
| ChartOverlay | `common/Overlay` | ✕ icon | yes | `ChartOverlay.js:121-143` |
| TracePromoteDialog | `common/Overlay` | ✕ icon **and** "Cancel" | yes | `TracePromoteDialog.js:68,137` |
| VariableDialog | `common/Overlay` | "Cancel" only | yes | `VariableDialog.js:119-125` |

ChartOverlay adds its own toolbar: Type/X/Y selects, Title input, **SVG** and **PNG** download buttons (`ChartOverlay.js:146-200`) — a third and fourth export path.

---

## 2. The duplication table

### 2a. One action, two or more triggers

| Action | Triggers | Locations | Agree? | Direction |
|---|---|---|---|---|
| **Start/stop recording** | ① SimControls Record/"Stop Rec" ② TraceTable Record/"REC" | `SimControls.js:125-133` · `TraceTable.js:450-472`; both fed `trc.handleStartRecord/handleStopRecord` (`IDELayout.js:479-480, 592-593`) | ✗ labels differ; ✗ TraceTable disables at `data.size===0`, SimControls never disables | **Keep one** (TraceTable) |
| **Fit blocks to view** | ① `block-search-fit` ② `workspace-zoom` fit | `BlocklyWorkspace.js:116-134` · `WorkspaceZoom.js:46-54` | ✗ MaximizeIcon vs ScanIcon; ✗ ① also `scrollCenter()`; ✗ ① doesn't update the % readout | **Delete ①** |
| **Go to blocks mode** | ① ModeToggle "Blocks" ② header "Back to Blocks" | `ModeToggle.js:8-16` · `Toolbar.js:317-323` → `useSimulation.js:207-215` | ✗ ② also ends the run; ✗ ② renders while already in blocks | **Delete ②** |
| **Stop the simulation** | ① Stop toggle ② "Back to Blocks" ③ Esc / Ctrl+Enter | `SimControls.js:68` · `useSimulation.js:208` · `utils/hotkeys.js` via `useHotkeys.js:12` | ✗ ② is not labelled as a stop | **Keep ①+③** |
| **Screenshot the viewport** | ① File ▸ "Screenshot Viewport (.png)" ② canvas camera "Copy a snapshot to a new tab" | `Toolbar.js:216-221` · `ViewportControls.js:116-131` | ✗ file download vs new tab; ✓ both gated on `exportAndCopy` | **Keep ②** |
| **Export CSV** | ① "Rec.CSV" ② "CSV" ③ DS `download csv` block ④ ChartOverlay SVG/PNG | `TraceTable.js:473-481` · `:506-514` · `IDELayout.js:296-304` · `ChartOverlay.js:185-199` | ✗ 4 idioms, 4 destinations | **Demote** ①② into one "Export…" split control |
| **Import a file** | ① StartMenu "Open File…" (all 4 extensions) ② File ▸ "Import blocks or Python" ③ File ▸ "Open project bundle" | `StartMenu.js:392-398` · `Toolbar.js:170-181` | ✗ 1 control vs 2; ✗ different accept lists | **Merge** ②③ into one "Open…" |
| **Open Help** | ① header "Help" ② StartMenu "Documentation" ③ block context-menu "Help" | `Toolbar.js:332` · `StartMenu.js:381-383` · Blockly built-in | ✗ 3 different labels for one page | **Rename** to one word |
| **Sign in / Create account** | ① header account menu ② StartMenu `AccountChip` ③ welcome header ④ welcome footer | `HeaderAccount.js:63-72` · `AccountChip.js:13-25` · `WelcomePage.js` | ✗ dropdown vs stacked links vs buttons; ✗ "Create account" vs "Create an account" | **Keep one component** — mount `HeaderAccount` in the start menu too |
| **Pick a template** | ① start-page template card ② wizard template row | `StartMenu.js:485-506` · `:615-644` | ✗ 1 click vs 3; same 8 items | **Delete ②** (wizard's "template" start path) |
| **Delete blocks** | ① header "Clear" (all) ② drag to `WorkspaceTrash` ③ context-menu "Delete N Blocks" | `Toolbar.js:324-331` · `WorkspaceTrash.js` · Blockly built-in | ✗ ① confirms, ②③ don't | **Keep all three** (different scopes) but align the confirm rule |
| **Theme toggle** | ① IDE header ② welcome header ③ portal header | `Toolbar.js:269` → `ThemeToggleButton.js` (one component, three mounts) | ✓ already one component | **No change** |
| **Zoom the workspace** | ① `workspace-zoom` +/− ② Ctrl+wheel ③ pinch | `WorkspaceZoom.js:16-17` · `BlocklyWorkspace.js:408-411` | ✓ both report through `onScaleChange` | **No change** |

### 2b. Panels carrying their own control sets that overlap global chrome

| Panel | Its own controls | Overlap with global chrome |
|---|---|---|
| Viewport pane header (`IDELayout.js:802-807, 825-830`) | Run/Stop + 4 debug buttons + 2 chips (w up to 482) | Run/Stop *used to* be header controls (`visibleControls.js:21-27`); the split now means the header owns Trace/Debug **toggles** while the pane owns the debug **actions** — one feature, two bars, 44 px apart |
| On-canvas camera cluster (`ViewportControls.js:135-152`) | Reset camera · Fit scene · Fullscreen · Snapshot | Snapshot ↔ File ▸ Screenshot; Fit scene ↔ Fit blocks (same icon) |
| Blocks pane search bar (`BlocklyWorkspace.js:98-134`) | search + fit | Fit ↔ `WorkspaceZoom` fit |
| On-canvas zoom cluster (`WorkspaceZoom.js`) | +/−/fit/% | Was a header slider; `visibleControls.js:52-54` records the header slot as deliberately empty |
| Trace panel header (`TraceTable.js:448-566`) | Record · Rec.CSV · Chart · Snap · CSV · Clear · watch · filter | Record ↔ SimControls Record; Clear ↔ header Clear (same word, different target, both on screen — `dup-34`) |
| Data panel header (`DataPanel.js:236-256`) | `↺` re-pick CSV | Only control in a full 36 px band |
| Run-error banner (`RunErrorBanner.js:14-34`) | Copy error · Dismiss | Duplicates the status bar's error channel (`IDELayout.js:848-857`) |
| HelpPage (`HelpPage.js:324-377`) | Close · search · 15 nav items | Its own search bar is the 3rd search idiom; the IDE header stays live behind it |

### 2c. Same concept, two (or more) UIs

| Concept | Idiom A | Idiom B | Idiom C |
|---|---|---|---|
| Modal overlay | `common/Overlay` (Escape, backdrop, focus return) — Chart/Trace/Variable | `.help-overlay`, hand-rolled `role="dialog"`, own Escape, no backdrop dismiss (`HelpPage.js:324`) | `.start-menu-overlay`, no dialog role, own titlebar (`StartMenu.js:354`) |
| Closing an overlay | ✕ icon (Chart, TracePromote) | text "Close" (Help) | "Cancel" only (VariableDialog) / none (StartMenu) |
| Search input | `.block-search-input` + ✕ (`BlocklyWorkspace.js:102-114`) | `.trace-search-input` + ✕ (`TraceTable.js:552-566`) | `.help-search-input` + ✕ (`HelpPage.js:341-356`) |
| Account UI | `HeaderAccount` dropdown (`HeaderAccount.js:20-73`) | `AccountChip` stacked links (`AccountChip.js`) — the file itself records this at `HeaderAccount.js:8-11` | — |
| Tabs / segmented control | `.mode-toggle` 2-button segment (`ModeToggle.js`) | `.help-nav-item` vertical list (`HelpPage.js:366-375`) | `.start-wizard-radio` cards (`StartMenu.js:703-716`) |
| Pane resize | `.pane-divider`, `%`-valued, arrow keys (`IDELayout.js:770-783`) | `.debug-drawer-handle`, `px`-valued, arrow keys reversed (`DebugDrawer.js:62-81`) | — |
| Onboarding on an empty canvas | `BlocklyEmptyState` chips (`IDELayout.js:730-736`) | `BeginnerGuide` tip strip (`BeginnerGuide.js:41-49`) | `.canvas-idle` "Press **Run**" (`GlowCanvas.js:116-118`) — **all three at once**, `dup-03` |
| Error reporting | `RunErrorBanner` (39 px, persists) | `.console-bar` in the status bar (26 px, overwritten) | `.ds-runner-error` in the data panel (`DataPanel.js:273-278`) |
| Button base class | `.tb-btn` (15 modifiers) | `.canvas-control` · `.workspace-zoom__btn` · `.block-search-fit` · `.trace-icon-btn` · `.trace-clear-btn` · `.trace-rec-btn` · `.trace-pin-btn` · `.trace-alert-btn` · `.chart-overlay-action` · `.help-close-btn` · `.start-action-btn` · `.blockly-empty__chip` · `.beginner-guide-dismiss` · `.data-panel-reload-csv` · `.nav-row` | `.btn`/`.btn--sm` (portal) leaks into `BatonChip.js:229` inside the IDE status bar |
| Execution model | explicit Run (physics) | implicit re-run on every block change (DS, `IDELayout.js:290`) | **both at once** in hybrid, behind one Run button |

### 2d. Controls that render but are inert / vestigial

| Control | Where | Why inert |
|---|---|---|
| **"Trace" toggle while Debug is on** | `Toolbar.js:299-306` | `traceOpen = debugMode \|\| traceVisible` (`IDELayout.js:205`) — pressing it cannot close the drawer, and its label/`--active` state are wrong before the first press (`dup-31`) |
| **"Back to Blocks" while already in blocks mode** | `Toolbar.js:317-323` | `setMode("blocks")` is a no-op; only `endRun` survives, under a label that never says "stop" |
| **`signIn` / `account` matrix keys** | `visibleControls.js:76` | `CONTROL_RENDERERS` has no entry for either (`Toolbar.js:140-270`); `renderZone` returns null. `HeaderAccount` renders from its own always-on slot at `Toolbar.js:405`. Two of five file-zone keys are documentation, not wiring |
| **`isTeacher` parameter** | `visibleControls.js:34` | eslint-disabled unused; reserved slot |
| **"Clear" in DS/blocks after switching to code** | `visibleControls.js:64` | Correctly hidden — but the blocks it would clear still exist and still generate the code shown |
| **Coach tip "Press Run in the toolbar"** | `BeginnerGuide.js:6` | Run left the toolbar for the viewport pane header (`SimControls.js:14-26`). Stale instruction |
| **Monaco breakpoint gutter** | `CodeEditor.js:8-17` | Already removed; documented as never-wired |
| **"Next value" / "Next frame" / "Pause" after a run ends** | `SimControls.js:100,110,120` | `disabled={!running}` — 3 dead buttons persist in a 482 px strip (`dup-35`) |

---

## 3. Layout-layer counts (measured, 1440×900 unless noted)

| View | Horizontal chrome bands | Total px | Detail |
|---|---|---|---|
| Physics blocks, idle | 4 | **147** | header 44 + pane-header 36 + block-search 41 + status 26 |
| Physics code, idle | 3 | **106** | header 44 + pane-header 36 + status 26 |
| Physics blocks, running with an error | 5 | **186** | + run-error-banner 39 |
| Physics + debug + trace | 5 (+ drawer's own 2) | **186 + 136** | drawer: trace-panel-header 110 + search-bar 26 |
| Data science | 4 | **142** | header 44 + editor pane-header 36 + block-search 41 + status 26 (+ data-panel-header 36 in the right pane) |
| **Hybrid** | **5 stacked in one column** | header 44 + editor pane-header 36 + block-search 41 + `pane-header--viewport` 36 + `data-panel-header` 36 + status 26 | `.hybrid-viewport` gets 457 px, `.hybrid-datapanel` 374 px |
| Help open | 6 | header 44 + `.help-topbar` + status 26 + everything still behind it | 53 live controls |

**On-canvas overlay layers (not counted above):** `.workspace-zoom` (127×42, blocks pane) · `.canvas-controls` (116×32, viewport) · `.canvas-controls-hint` · `.canvas-caption` (32) · `BlocklyEmptyState` · `BeginnerGuide` · Blockly toolbox rail (180 px wide).

**Where two layers could be one:**
1. `.app-header` + `.pane-header--blocks/--code` — the pane header carries only a label the mode toggle already shows (win #5).
2. `.pane-header--viewport` + `.sim-controls` — a 36 px band whose only content is one 61 px button when idle. Fold Run/Stop back into the header's primary zone beside the mode toggle; keep the *debug step group* in the pane.
3. `.block-search` (41 px) + `.workspace-zoom` — the fit button belongs to the zoom cluster; the search bar could be a toolbox-rail affordance rather than a full-width band.
4. `.run-error-banner` (39 px) + `.console-bar` in `.status-bar` — two error channels; the banner is the good one, so the status bar's error state is redundant.
5. `.data-panel-header` (36 px) for a single `↺` — merge into the pane it heads.

---

## 4. Consistency findings (where the same action appears twice, do the two agree?)

| # | Finding | Evidence |
|---|---|---|
| C1 | **Record disagrees on label** — "Stop Rec" (SimControls) vs "REC" (TraceTable) at the same instant | `SimControls.js:132` vs `TraceTable.js:460`; `dup-35-chart-overlay.png` |
| C2 | **Record disagrees on enabled-state** — TraceTable disables at `data.size===0`, SimControls never disables | `TraceTable.js:468` vs `SimControls.js:125-133` |
| C3 | **Two fit-blocks buttons disagree on icon** — MaximizeIcon vs ScanIcon | `BlocklyWorkspace.js:133` vs `WorkspaceZoom.js:52` |
| C4 | **One icon, two targets** — ScanIcon is "Fit blocks to view" *and* "Fit scene to view" | `WorkspaceZoom.js:52` vs `ViewportControls.js:98` |
| C5 | **Two fit-blocks buttons disagree on behaviour** — only `block-search-fit` calls `scrollCenter()`; only `WorkspaceZoom` writes the % back through `onZoomChange` | `BlocklyWorkspace.js:126-127` vs `WorkspaceZoom.js:19-24` |
| C6 | **"Clear" means two different things on screen at once** — header Clear = all blocks (danger red, confirms); trace Clear = trace data (plain, no confirm) | `Toolbar.js:324-331` vs `TraceTable.js:516-523`; both in `dup-34` |
| C7 | **Destructive-confirm rule is inverted** — deleting a whole project doesn't confirm, clearing blocks does | `ProjectContext.js:196-207` vs `useSimulation.js:384` |
| C8 | **Mode label duplicated verbatim** — mode-toggle tab and pane header both read "Code View Only" | `IDELayout.js:658` vs `:748-749`; `dup-08` |
| C9 | **Status bar echoes the toggle** — `handleModeChange` writes "Switched to Code editor" / "Switched to Blocks editor" into the status bar, restating what the active tab shows | `useSimulation.js:224-231` |
| C10 | **Trace button's label and `--active` state are wrong** before its first press in debug mode | `Toolbar.js:301,305` vs `IDELayout.js:205`; `dup-31` |
| C11 | **Three label-collapse policies in one 44 px row at stage 1** — view-zone buttons go icon-only, Save keeps its label, File keeps its label, account keeps "Guest" (until stage 2) | `dup-14-physics-1200-stage1.png` vs `dup-12` |
| C12 | **Overflow items restate their tooltip in the shortcut slot** — "Hide Hide 3D viewport" | `Toolbar.js:383-384`; `chrome.css:375`; `dup-13` |
| C13 | **Two account UIs, two strings** — "Create account" (both in-app) vs "Create an account" (welcome footer) | `HeaderAccount.js:70` / `AccountChip.js:21` vs `WelcomePage.js` |
| C14 | **File menu's trigger icon is a download arrow on a menu that opens with two imports** | `Toolbar.js:165` vs `:170-181` |
| C15 | **Two resize handles, opposite key semantics** — `.pane-divider` reports a %, `.debug-drawer-handle` reports px and ← *widens* | `IDELayout.js:776-778` vs `DebugDrawer.js:62-66` |
| C16 | **Coach tip points at a control that moved** — "Press Run in the toolbar" | `BeginnerGuide.js:6` vs `SimControls.js:14-26` |
| C17 | **Three onboarding surfaces fire simultaneously** on an empty canvas | `dup-03-physics-blocks-1440.png` |
| C18 | **Two execution models, one Run button** — hybrid's data half auto-runs on block change while the sim half waits for Run | `IDELayout.js:290-326` vs `:576-595` |
| C19 | **DS code view has no execution path at all** — Monaco edits never reach `runDsCode` | `IDELayout.js:287-331`; `dup-23-ds-code.png` (no Run, no re-run trigger) |
| C20 | **~16 distinct button base classes** in the IDE, including a portal-vocabulary `.btn--sm` inside the IDE status bar | §2c last row; `BatonChip.js:229` |

---

## 5. Headline control counts per surface

| Surface | Visible controls | Screenshot |
|---|---|---|
| Welcome gate `/` (signed out) | 25 | `dup-00-landing.png` |
| Start menu | 15 | `dup-01-startmenu.png` |
| Start menu + wizard (blank path) | 12 | `dup-20-wizard-physics.png` |
| Start menu + wizard (template path) | 20 | `dup-21-wizard-template-path.png` |
| Physics · blocks · idle · 1440 | 23 | `dup-03-physics-blocks-1440.png` |
| Physics · code · 1440 | 14 | `dup-08-physics-code-1440.png` |
| Physics · blocks · running | 25 | `dup-30-running-blocks.png` |
| Physics · debug ON (drawer auto-opens) | 41 | `dup-31-debug-on.png` |
| Physics · debug + trace toggled | 41 | `dup-32-debug-and-trace.png` |
| Physics · debug @1100 (stage 2) | 36 | `dup-33-debug-1100.png` |
| Physics · debug + block context menu | **49** | `dup-34-debug-block-contextmenu.png` |
| Physics · Help open (over debug) | **53** | `dup-36-help-page.png` |
| Physics · File menu open | 33 | `dup-04-physics-filemenu.png` |
| Physics · account menu open | 25 | `dup-05-physics-accountmenu.png` |
| Physics · workspace context menu | 29 | `dup-06-blockly-contextmenu.png` |
| Physics @1200 (stage 1) | 25 | `dup-14-physics-1200-stage1.png` |
| Physics @1100 (stage 2) | 22 | `dup-12-physics-1100-stage2.png` |
| Physics @1100 + overflow open | 26 | `dup-13-physics-1100-overflow-open.png` |
| Data science · blocks | 18 | `dup-22-ds-blocks.png` |
| Data science · code | 13 | `dup-23-ds-code.png` |
| Hybrid · idle | 20 | `dup-24-hybrid.png` |

---

## 6. What I could not verify, and why

1. **ChartOverlay live.** The "Chart" button stayed disabled at *0 rows* — the seeded blocks produced no traced values before the run ended, so the promote path never fired (`dup-35-chart-overlay.png` shows `.chart-overlay` absent). Its 8 controls in §1.16 come from `ChartOverlay.js:120-203` (code), not from the browser. A concurrent audit's `11-chart-overlay.png` in this directory does show it rendered.
2. **`TracePromoteDialog` live.** Same cause — it is reached from the same 0-row path (`IDELayout.js:863-869`). Inventory from `TracePromoteDialog.js:59-142`.
3. **The Blockly flyout.** My programmatic `mousedown` on `.blocklyTreeRow` did not open a flyout in headless; `.blocklyFlyout` measured 0×0 in every capture. Toolbox categories and flyout blocks are SVG, not DOM controls, so they are excluded from all counts by design.
4. **Signed-in states.** All probes ran as a guest (backend returned 401 for `/api/me` throughout). So `RulesChip`, `BatonChip`, `AttributionChip`, `NotificationBell`, File ▸ **Share…** and File ▸ **History & restore**, and the member branch of the account menu are inventoried from code only (`Toolbar.js:241-265, 404`; `layout/*.js`). Rules-gated hiding (`visibleControls.js:67,70`; `Toolbar.js:106-107`; `ViewportControls.js:81`) is likewise code-only.
5. **`BriefPane`** (`IDELayout.js:670`) renders only inside assignment work, which needs a signed-in student with a published assignment — not reachable as a guest. It adds a sixth chrome band when present.
6. **Blockly's stock zoom/trashcan** are configured off (`BlocklyWorkspace.js:398,411`) and I confirmed they never appear in any capture — so the "Blockly built-in zoom vs on-canvas cluster vs header remnant" triple named in the brief is in fact a **pair** (`block-search-fit` vs `WorkspaceZoom`); the header slider is genuinely gone (`visibleControls.js:52-54`).
7. **The Gravity/Moon/Earth/Jupiter/Trails/Reset cluster** from the earlier screenshots is the **welcome hero demo**, not the IDE viewport (`dup-00-landing.png`, `.welcome-hero__trails` / `.welcome-hero__reset`). The IDE's on-canvas cluster is the 4-button camera group in §1.6.

---

*Probe scripts (`frontend/scripts/dup-audit*.tmp.mjs`) were deleted after the run, per instruction. No tracked file was modified.*
