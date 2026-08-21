# IDE Modernization — Plan 3: MakeCode Overhaul — Design

**Date:** 2026-08-21
**Status:** Approved section-by-section in brainstorming; this document is the written record.
**Branch:** `feature/classroom-platform`
**Supersedes:** the visual/bundling scope of `docs/superpowers/plans/2026-08-20-ide-modernization-03-deeper-mechanics.md`, which is re-scoped to Plan 4 (see §12).

## 1. Purpose and scope

Plan 3 rebuilds the IDE's visual identity around MakeCode's design language — chunky Zelos blocks, a colored toolbox rail, vivid category colors on both themes — and closes the dependency story by bundling all three runtime vendors (Blockly, GlowScript, Monaco). The debugger, registry, and toolbox *mechanics* stay in the existing 19-task document, which becomes Plan 4 via one careful editing pass (§12).

Restructure decision (Approach A): Plan 3 gets this fresh spec and a fresh plan document; the existing doc is renamed to Plan 4 and edited, never rewritten.

## 2. Locked decisions

1. **Layout:** rail | workspace | viewport — current orientation. The toolbox becomes a MakeCode-style colored rail.
2. **Themes:** both light and dark chrome, one fixed category color system on both.
3. **Adaptive header:** all four axes (mode, goal, role, run state) through one pure `visibleControls()`; the zoom slider is removed in favor of an on-canvas +/−/fit cluster.
4. **Plan split:** Plan 3 = MakeCode overhaul + bundling; Plan 4 = mechanics.
5. **Renderer:** Zelos (MakeCode's own), not restyled Geras.
6. **Restructure:** Approach A (fresh Plan 3 doc; existing doc re-scoped to Plan 4).
7. **Palette:** vivid v2 (§4) — near-maximum saturation at AA-passing depth, bright decorative variants.

Standing constraints that bind every section: no emojis in product UI, professional inline-SVG icons only (`Icons.js` vocabulary); red (hue 340°–15°) reserved for errors, breakpoints, Stop, and delete; minimum viewport 1024px; no new dependencies beyond the three named vendor bundles; every task commits on `feature/classroom-platform`.

## 3. Architecture

**Serial foundation, then three parallel lanes.** Two refactors touch everything, so they land first, alone:

1. **CSS split.** `frontend/src/styles.css` (measured during plan-writing: 5,024 lines) breaks into eleven per-surface files behind an `@import` manifest, ordered so every rule family stays on the same side of the primitives layer as today (no cascade tie can flip): `tokens`, `base`, `chrome` (header, toolbar, status bar), `workspace` (Blockly host + toolbox rail), `viewport`, `debug` (so Plan 4's `.dm-*` deletion is one-file surgery), `pages`, `datapanel`, `primitives`, `platform`, `responsive`. The dead-CSS sweep (Plan 02 residual) happens during the split — the one moment every rule is already under review. A pure test reads the split sheets and asserts the `--cat-*` custom properties match `BLOCK_PALETTE` exactly, so the files cannot drift from the module.
2. **Bundling triple.** Blockly `11.2.2` pinned exact as `utils/blockly/blocklyLib.js` (the old plan's Task 1, unchanged in substance); GlowScript's six runtime files vendored into `frontend/public/vendor/glowscript/` with a provenance note (old Task 2, unchanged); **Monaco bundled** via the `monaco-editor` package — new scope, superseding the old plan's "Monaco stays on CDN" deferral. Monaco loads by dynamic import on first entry into code mode, so its ~4 MB of assets never touch initial IDE load. The `<textarea>` fallback in `CodeEditor.js` survives as the init-failure guard.

**Then three worktree lanes over disjoint files:**

| Lane | Owns | Delivers |
|---|---|---|
| Blocks | `utils/blockly/*`, `toolbox.css`, `workspace.css` | `blockPalette.js` v2, `blocklyTheme.js` (Zelos, light+dark), the rail, the trashcan |
| Chrome | `Toolbar.js`, `layout/*`, `hooks/*`, `chrome.css`, `viewport.css` | `visibleControls()`, on-canvas zoom cluster, boot atom, Plan-02 lifecycle residuals |
| Editor | `CodeEditor.js`, Monaco theme modules | `physics-light` / `physics-dark` themes |

**One color source.** `BLOCK_PALETTE` remains the single origin of every category color in the product: toolbox `colour=` attributes, Blockly `blockStyles`, the `--cat-*` CSS variables, and the Monaco token mappings all derive from it, each tie held by a pure test.

## 4. Palette v2 — vivid within AA

WCAG contrast constrains luminance, not saturation. v2 keeps every hue and family from the AA-verified v1 table and re-solves each color at near-maximum saturation and the same AA-passing depth. Generator parameters (design-time tool; the shipped module is a static table whose test *recomputes* everything from the hexes):

- Fill: saturation 0.92 (main drawers + DS pipeline), 0.55 (Advanced children), 0.18 (Advanced), 0.08 (Raw Python); HSL lightness solved so white-on-fill ≥ 4.75:1.
- Secondary (`colourSecondary`, carries white text): saturation −0.06, solved ≥ 4.55:1.
- Tertiary (`colourTertiary`, outline): solved at 2.0:1 against white, lightness cap 0.95 — keeps an edge on the dark `#1e1e1e` workspace.
- **Bright** (new, decorative only): saturation +0.08 at lightness 0.52. Used for rail dots and accents. **Never under white text; never referenced by any `blockStyle`** — a test enforces both.

| Category | Fill | White:fill | Secondary | White:sec | Tertiary | Bright |
|---|---|---|---|---|---|---|
| Objects | `#0973D1` | 4.79 | `#1077D2` | 4.57 | `#79BDF9` | `#0A8DFF` |
| Motion | `#B05D07` | 4.76 | `#B2610D` | 4.56 | `#F8A552` | `#FF860A` |
| Values | `#743BF7` | 5.66 | `#7741F1` | 5.51 | `#C3AAFB` | `#550AFF` |
| State | `#D7099A` | 4.78 | `#DB119F` | 4.57 | `#FB96DC` | `#FF0AB6` |
| Control | `#BB0AF0` | 4.76 | `#BE1EEE` | 4.56 | `#E59CFB` | `#C70AFF` |
| Logic | `#137AAD` | 4.76 | `#1A7DAE` | 4.58 | `#66C1EE` | `#19AAF0` |
| Math | `#3B54F7` | 5.53 | `#4159F1` | 5.35 | `#A7B3FB` | `#0A2BFF` |
| Variables | `#BB5421` | 4.77 | `#BB5A29` | 4.56 | `#EAA888` | `#E46525` |
| Data Science | `#058178` | 4.75 | `#0A847C` | 4.56 | `#09CDBF` | `#0AFFEE` |
| Advanced | `#62748D` | 4.77 | `#6A7788` | 4.56 | `#AEB8C7` | `#6580A4` |
| Load Data | `#077CA0` | 4.77 | `#0C7FA3` | 4.58 | `#28C6F6` | `#0AC6FF` |
| Explore | `#057F84` | 4.80 | `#0A8387` | 4.56 | `#09CBD2` | `#0AF7FF` |
| Statistics | `#058269` | 4.77 | `#0A856C` | 4.58 | `#09CFA7` | `#0AFFCD` |
| Transforming Data | `#06844D` | 4.76 | `#0A8750` | 4.57 | `#09D179` | `#0AFF93` |
| Uncertainty | `#068530` | 4.77 | `#0A8834` | 4.58 | `#09D34B` | `#0AFF5B` |
| Analyzing Relationships | `#068512` | 4.80 | `#0A8916` | 4.56 | `#09D41C` | `#0AFF21` |
| Filter & Sort | `#1F8506` | 4.76 | `#24880A` | 4.56 | `#31D309` | `#3BFF0A` |
| Group & Compare | `#3F8205` | 4.77 | `#43850A` | 4.57 | `#65CF09` | `#7BFF0A` |
| Charts | `#617C05` | 4.78 | `#647F0A` | 4.58 | `#9AC608` | `#C6FF0A` |
| Communicate | `#877106` | 4.78 | `#8A740A` | 4.58 | `#D7B409` | `#FFD60A` |
| 3D Math | `#6168D1` | 4.76 | `#666DCB` | 4.55 | `#B0B3E8` | `#3741D2` |
| Raw Python | `#6D7380` | 4.76 | `#747679` | 4.56 | `#B4B7BF` | `#717E98` |
| Loops | `#B43CC6` | 4.77 | `#B149C1` | 4.57 | `#DCA4E5` | `#BE37D2` |
| Text | `#25806F` | 4.78 | `#2D8373` | 4.56 | `#4CCBB2` | `#37D2B4` |
| Lists | `#597D24` | 4.79 | `#5E802C` | 4.57 | `#90C740` | `#93D237` |
| Functions | `#BF38B1` | 4.76 | `#BE42B2` | 4.55 | `#E4A1DD` | `#D237C2` |

Known limits, accepted: yellows (Charts, Communicate) cannot be both light and AA under white text — they stay gold-olive and their neon bright dots carry the energy; State's magenta sits at hue 318°, the closest approach to the reserved red band, and reads pink, not red. The module keeps the v1 API surface (`BLOCK_PALETTE`, `CATEGORY_NAMES`, `getCategoryColour`, `styleNameFor`, `cssVarFor`, `paletteCssText`, `blockStylesFromPalette`, `relativeLuminance`, `contrastRatio`, `hueOf`) plus `brightFor(name)`.

## 5. Toolbox rail and Zelos

The toolbox renders as a MakeCode-style rail: one row per drawer — bright color dot, label — with the active drawer's row filled with its category fill and white text. Same fills on both chromes: a student who switches theme keeps their color map. Blocks render with the Zelos renderer (verified during plan-writing: Zelos is *already* the injected renderer — the overhaul is entirely theme-level, no renderer swap); both Blockly themes (light and dark) are built by `blocklyTheme.js` from `BLOCK_PALETTE` — `blockStyles` from fill/secondary/tertiary, `componentStyles` from the design tokens, category styles from the same table. Block definitions stop carrying hue integers and use `style: "<category>_blocks"` (as the old plan specified; the task moves here because the theme does). The drawer disclosure chevron from Plan 2 stands. Drawer *contents* (registry correspondence, the Data Science sub-drawer split) remain Plan 4 mechanics — the rail styles whatever drawers exist.

## 6. Adaptive header

One pure function in the chrome lane:

```
visibleControls({ mode, goal, role, runState }) → { primary: [...], view: [...], file: [...] }
```

Axis values, corrected during plan-writing to match the code as it exists: `mode` = `blocks | text` (the state's real values), `goal` = `physics | datascience | hybrid` (three, from the manifest), `role` = `guest | user | admin` plus the separate `isTeacher` boolean (there is no student/teacher account role — `student`/`ta`/`teacher` are class-membership roles), `runState` = `idle | booting | running`. `Toolbar` renders purely from the returned descriptor lists. The goal axis already has a consumer today — `showSimActions = goal === "physics" || goal === "hybrid"` gates Run/Stop/viewport/trace/debug — and that rule is absorbed into the matrix rather than invented. Plan 2's two-stage collapse composes: `visibleControls` decides *whether* a control exists; the collapse decides *where* it renders.

The matrix. "Always" means present for every axis combination; enablement (disabled states) follows today's behavior unless stated.

| Control | Zone | Rule |
|---|---|---|
| Run | primary | Visible unless `running`; disabled + acknowledged while `booting` (Plan 2 behavior formalized) |
| Stop | primary | Visible while `booting` or `running` |
| Mode toggle | primary | Always |
| Zoom slider | — | **Removed from every configuration** (§7) |
| Viewport camera actions | view | Hidden while `idle` — no scene to point a camera at |
| Trace slot | view | Reserved descriptor; ships hidden-while-`idle`; Plan 4 wires the handler |
| Debug slot | view | Reserved descriptor; same default; Plan 4 supplies the group and may refine the rule |
| Reset, Clear | view (secondary) | Always visible; enablement unchanged |
| Help | view (secondary) | Always |
| Save | file | Always; `guest` sees local-save wording |
| Workspace actions | file | Always |
| File menu | file | Always |
| Account chip | file | Always; `guest` renders "Sign in" |
| Teacher classroom controls | file | Descriptor slot defined; population lands with the classroom plans, not Plan 3 |

The `goal` axis is plumbed through the signature but no Plan 3 control varies by it yet; its first consumers arrive with Plan 4 and the classroom plans. Block search lives in the workspace pane, not the header, and exists only in blocks mode inherently — noted for completeness, not a header row. Every row above becomes one assertion in the pure test suite.

## 7. On-canvas zoom cluster

A +/−/fit vertical cluster docked bottom-right of the block workspace (MakeCode's position), replacing the header slider. It drives the same workspace-zoom API the slider drove, so wheel-zoom stays in sync by construction. Styled from tokens in `chrome.css` — the cluster is chrome-lane work, and `toolbox.css`/`workspace.css` belong to the blocks lane. Hidden in code mode along with the workspace it controls.

## 8. Boot animation — the idle atom is the loader

The viewport's existing atom mark (`GlowCanvas.js`: nucleus circle + three ellipse orbits at 0°/60°/120°, `currentColor`) animates **in place** during `booting` — no overlay:

- Orbits spin at staggered periods (≈2s / 2.6s reverse / 3.2s, linear infinite); nucleus pulses (scale 1→1.3 with an opacity dip, ≈1.6s ease-in-out).
- The mark tints from muted grey to the accent token; the hint line swaps to "Starting simulation…".
- The `.canvas-booting` overlay and its spinner are **deleted**. The Plan 2 booting state machine is untouched.
- First frame: the idle layer unmounts as today (running && !booting).
- Boot failure: animation stops, mark returns to muted grey, the existing error banner reports.
- `prefers-reduced-motion`: no orbit spin; slow nucleus opacity pulse only.

## 9. Trashcan

No trashcan at rest. On block-drag start, a line-style can (drawn in the `Icons.js` idiom) fades in bottom-right of the workspace. Drag-over opens the lid and scales the target up, tinted red — the one legitimate red in the workspace. Drop shrinks the block into the can over ≈180ms with a small settle. Dragging a block onto the rail also deletes (Blockly's native toolbox-delete, styled: the rail tints as a delete zone). No confirmation; Ctrl+Z already covers undo. Implementation rides Blockly's trashcan and drag APIs — surface confirmed by a pre-brief probe (§11).

## 10. Monaco: bundled and theme-matched

`monaco-editor` joins the bundle, pinned EXACT — the version is chosen and written into the Plan 3 document during the Monaco worker probe (§11), the same pin-in-plan convention Blockly follows. It loads by dynamic import on first code-mode entry. Two first-party themes, `physics-light` and `physics-dark`, generated from the palette: function calls in Objects azure, keywords in Control violet, numbers in Motion orange, strings in the DS-pipeline green (Transforming Data: `#06844D` light / `#09D179` dark), comments neutral — light theme uses the AA fills directly (all ≥4.5:1 on white), dark uses each category's tertiary tint on `#1e1e1e`, checked by the same contrast test. Editor chrome (background, selection, caret, line numbers) maps from the design tokens. The `<textarea>` fallback keeps its plain styling and its job: catching init failure. Monaco's Vite worker setup is the one recognized bundling risk and gets the first probe.

## 11. Testing, error handling, execution

**Pure, TDD'd:** `blockPalette.js` (recomputed contrasts ≥4.5:1, no fill in 340°–15°, brights absent from every `blockStyle`), `blocklyTheme.js` (every category styled, Zelos named in both themes), `visibleControls()` (one assertion per matrix row), Monaco theme builders (AA against their own backgrounds), the `--cat-*` stylesheet sync test.

**Component probes** (Plan 2 `renderHelpers` layer, suites under `__tests__/`): Toolbar renders exactly what `visibleControls` returns as axes change; GlowCanvas in `booting` carries the animated-atom class and contains no spinner element.

**Pre-brief browser probes** (before any task brief is written): Zelos theme injection; Blockly trashcan/drag API surface; Monaco worker bundling under Vite; vendored GlowScript files. Plan-defect prevention, per the Plan-02 lesson.

**e2e:** selectors follow the new rail and header; the 49 invalidated screenshots refresh in a single end-of-plan commit. The offline smoke test upgrades to a full pass — Monaco bundling closes the last CDN hole; `docs/product-contract.md` §101/§107 become fully true and the Monaco exception note is removed.

**Error handling:** Monaco init failure → `<textarea>` fallback, unchanged. Blockly's "failed to load" panel survives as a module-init guard. Boot failure → §8. No new error surfaces.

**Execution:** serial foundation (CSS split, bundling triple) → three worktree lanes (§3) with controller merges; Haiku for pure-transcription tasks. Plan-02 residuals distributed: handleImport/loadWorkspaceXml bypassing `endRun`, `useDragResize`/`useRuntimeReady` extractions, and SimulationContext memoisation → chrome lane; DPR-sharp rendering → the GlowScript vendoring task (owning the source enables the real fix); stale Export-dropdown wording in `Physics_IDE_User_Guide.md` → wrap-up docs pass.

## 12. The Plan 4 re-scope pass

`2026-08-20-ide-modernization-03-deeper-mechanics.md` → renamed `2026-08-20-ide-modernization-04-deeper-mechanics.md`, then one editing pass:

- Every task or step Plan 3 absorbs becomes a one-line tombstone pointing at Plan 3 — at minimum Tasks 1, 2, 3 (Blockly bundling, GlowScript vendoring, palette), plus whichever theme/`blockStyles`/toolbox-styling steps of later tasks the pass identifies as now Plan 3's (the old doc spreads them across the tasks that consume Task 3). **Task numbers do not shift** — the doc's dense internal cross-references ("Task 10 Step 4") stay valid; a step-level absorption tombstones the step, never renumbers.
- "Depends on" repoints to Plan 3's document.
- A "Consumed interface from Plan 3" table joins the existing Plan 2 one: `blocklyLib.js`, `blockPalette` v2 (+`brightFor`), `blocklyTheme.js`, the rail's DOM/CSS vocabulary, the reserved trace/debug descriptor slots in `visibleControls`, and the split stylesheet layout (`.dm-*` deletions now land in `viewport.css`/`workspace.css`).
- The "Monaco stays on the CDN this tranche" constraint and its deferral entry are removed as superseded.
- Palette references inside surviving tasks re-cite v2 values by name, not hex.

## 13. Out of scope

Plan 4 mechanics (registry correspondence and CI enforcement, the Data Science drawer split, all debugger truthfulness work, beginner-metadata deletion, `describeRunError`); self-hosted Inter/JetBrains Mono (still deferred, still an open question); Walkthrough Mode; classroom-platform features; any Blockly version beyond 11.2.2.
