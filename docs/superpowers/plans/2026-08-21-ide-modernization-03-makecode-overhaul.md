# IDE Modernization — Plan 3: MakeCode Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The IDE's visual identity rebuilt around MakeCode's design language — vivid AA-verified category colors on a colored toolbox rail, Zelos-themed blocks, an adaptive header driven by one pure function, an on-canvas zoom cluster, the idle atom as the boot loader, a drag-summoned trashcan, palette-matched Monaco themes — and all three runtime vendors (Blockly, GlowScript, Monaco) bundled, making the offline promise fully true.

**Architecture:** A serial foundation lands first — the CSS split (`styles.css` 5,024 lines → eleven per-surface files behind an `@import` manifest) and the bundling triple (`blocklyLib.js` wrapping `blockly@11.2.2`, six GlowScript files vendored into `frontend/public/vendor/glowscript/`, `monacoLib.js` wrapping `monaco-editor@0.45.0` behind a dynamic import). Then three parallel worktree lanes over disjoint files: **blocks** (`blockPalette.js` v2 → `blocklyTheme.js` → toolbox rail → trashcan), **chrome** (`visibleControls.js` → Toolbar rewrite → `WorkspaceZoom` → boot atom → run-lifecycle repairs), **editor** (`monacoThemes.js`). `BLOCK_PALETTE` is the single colour source; the toolbox, the Blockly theme, the `--cat-*` CSS variables and the Monaco token rules all derive from it, each tie held by a pure test.

**Tech Stack:** React 18 + Vite 7, plain JavaScript, Vitest 4. **Three new dependencies, all product-owner-approved and pinned EXACT: `blockly@11.2.2`, `monaco-editor@0.45.0` (the version the CDN serves today — zero behavior change), and six vendored GlowScript/jQuery files.** Nothing else.

**Spec:** [docs/superpowers/specs/2026-08-21-ide-modernization-plan3-makecode-overhaul-design.md](../specs/2026-08-21-ide-modernization-plan3-makecode-overhaul-design.md). Contract references: `docs/product-contract.md` §101 (offline after first load), §107 (no non-CDN origins after first load) — both become fully true at Task 15.

**Probe record (2026-08-21, pre-brief, all PASS):** Blockly 11.2.2 in-package: `zelos` registered in core, `Blockly.Themes.Zelos` base theme exists, `Theme.defineTheme` roundtrips `blockStyles`/`categoryStyles`/`componentStyles`/`fontStyle`, `Trashcan`/`DeleteArea`/`DragTarget`/`ComponentManager.Capability.{DRAG_TARGET,DELETE_AREA}` public, `Events.BLOCK_DRAG === "drag"`, `setLocale` + `blockly/msg/en` (420 keys), `pythonGenerator` exported from `blockly/python`, `WorkspaceSvg` has `zoomCenter/zoomToFit/setScale/getScale`, `Toolbox.getToolboxItems` / `ToolboxCategory.getName/getDiv` exist, `utils.Rect` exists, the npm package ships `media/`. Monaco 0.45.0: no `exports` map, `esm/vs/editor/edcore.main.js` + `esm/vs/basic-languages/python/python.contribution` + `editor.worker?worker` builds under Vite to exactly 5 assets (3.0 MB main chunk, 205 KB worker, css, codicon font, 4 KB lazy python grammar) — no TS/CSS/HTML/JSON workers. Monaco 0.56 REJECTED: restructured exports, pulls the full language zoo. All six GlowScript URLs return 200.

## Global Constraints

- **Every task commits on `feature/classroom-platform`.** Ports 3000/4000/5433 unchanged. Backend and shared untouched (`npm run typecheck -w backend` / `-w shared` in wrap-up only — note `frontend` has no typecheck script; its gates are `npm run test -w frontend` and `npm run build -w frontend`).
- **Dependency approvals (product owner, explicit, scoped):** `blockly@11.2.2` pinned EXACT (Task 2); `monaco-editor@0.45.0` pinned EXACT (Task 4); six vendored GlowScript files with a provenance note (Task 3). **NO other new dependencies.**
- **Red (hue 340°–15°) is reserved** for errors, breakpoints, Stop, and delete. No palette fill, secondary, tertiary, or bright sits in that band — enforced by test.
- **The `bright` palette variants are decorative only** — rail dots and accents, never under white text, never referenced by any `blockStyle` — enforced by test.
- **UI quality standard:** no emojis in product UI; professional inline-SVG icons in the `Icons.js` idiom (`const base = {viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", strokeWidth:2, ...}` + `sz(size)` spread, arrow-function exports).
- **New logic is pure helpers under `utils/` with pure-module tests, TDD'd.** Component behavior is verified with Plan 2's probe layer `frontend/src/test/renderHelpers.js` (`mountComponent`/`click`/`keyDown`/`byText`/`byTitle`); suites live at `frontend/src/<area>/__tests__/<name>.test.js`. Suites that mount `Toolbar` carry `vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));` (path relative to the suite).
- **Minimum viewport 1024px**; `prefers-reduced-motion` respected by every new animation.
- **Citation convention:** line numbers below were verified on `feature/classroom-platform` at `144b2ca`. Re-resolve by selector / function name / component name when cutting; never cut blindly by offset.
- **Lane discipline (worktree execution):** Tasks 1–4 are strictly serial. Then lanes run in parallel worktrees — **Lane A (blocks): Tasks 5→6→7→8→9** owning `utils/blockly/*`, `styles/workspace.css`, `styles/toolbox` rules; **Lane B (chrome): Tasks 10→11→12→13** owning `Toolbar.js`, `components/layout/*`, `GlowCanvas.js`, `ViewportControls.js`, `hooks/*`, `contexts/*`, `styles/chrome.css`, `styles/viewport.css`; **Lane C (editor): Task 14** owning `CodeEditor.js`, `utils/monaco/*`. A lane never edits another lane's files; `styles/tokens.css` additions are Lane A's alone (Task 8). Task 15 runs after all lanes merge.
- **Blockly's `media/` must be served locally** (Task 2 copies it to `frontend/public/blockly-media/` and sets the `media` inject option) — bundled Blockly otherwise fetches sprites from an external default, silently re-opening the offline hole.

**Deferred (deliberately NOT here — do not flag as missing):** all Plan 4 mechanics (registry↔toolbox correspondence + CI, DS drawer split, debugger truthfulness, `DebugMode.js` deletion, beginner-metadata deletion, `describeRunError`); self-hosted Inter/JetBrains Mono (the `@import` stays at the top of the `styles.css` manifest); Walkthrough Mode; classroom features; Blockly beyond 11.2.2 / Monaco beyond 0.45.0.

---

### Task 1: The CSS split — eleven files behind a manifest, dead rules swept

**Files:**
- Modify: `frontend/src/styles.css` (becomes the `@import` manifest)
- Create: `frontend/src/styles/tokens.css`, `styles/base.css`, `styles/chrome.css`, `styles/workspace.css`, `styles/viewport.css`, `styles/debug.css`, `styles/pages.css`, `styles/datapanel.css`, `styles/primitives.css`, `styles/platform.css`, `styles/responsive.css`

**Interfaces:**
- Produces: the eleven-file layout every later task edits. Lane A owns `workspace.css` (+ the `--cat-*` block Task 8 adds to `tokens.css`); Lane B owns `chrome.css` + `viewport.css`; Plan 4 will delete `.dm-*` from `debug.css` in one-file surgery.
- Consumes: nothing.

The current `styles.css` is 5,024 lines. Move ranges **verbatim** (no reformatting, no renaming — the ONLY permitted deletions are Step 4's audited dead rules). Within each file, keep ascending original order. The grouping keeps every family on the same side of the primitives layer as it is today, so no same-specificity cascade tie can flip:

| New file | Moved ranges (current `styles.css` lines) | Contents |
|---|---|---|
| `tokens.css` | 7–319 | design tokens, dark + light theme blocks, reset, `:focus-visible` |
| `base.css` | 2929–3012 | fallback panels, scrollbars, `fadeIn`/`fadeUp`/`slideUp` + hybrid pane rules |
| `chrome.css` | 320–759, 1958–2036 | app header, app shell, toolbar (incl. `.tb-zoom*`, `.mode-toggle*`), status bar |
| `workspace.css` | 760–1045, 3013–3136, 4946–4993 | main layout + divider, Blockly host + block search + dbg glyphs, Blockly overrides (`.blocklyTree*` etc.), `.blockly-stage`/`.blockly-empty*` |
| `viewport.css` | 1046–1162, 1169–1187, 4995–5024 | canvas/GlowScript idle + controls + caption, `.canvas-wrap`/`.canvas-viewport`, `.canvas-booting*` |
| `debug.css` | 1163–1957 EXCEPT 1169–1187 (→ `viewport.css`) | section banner, debug drawer + `.trace-*` + full-screen `.dm-*` |
| `pages.css` | 2037–2928, 3203–3328, 3772–4036 | start menu, help page, admin-table/overlay/vdialog, start wizard |
| `datapanel.css` | 3330–3771, 4037–4402 | data panel + `.ds-*`, chart overlay, trace-promote, saved-trace, beginner guide |
| `primitives.css` | 4403–4631 | `.btn`, `.card`, `.panel-header` |
| `platform.css` | 4632–4945 | auth, account chip, admin console, classes, sync chip, guest import, welcome, reduced-motion + 1024px blocks |
| `responsive.css` | 3137–3202 | coarse-pointer + 800px media blocks |

- [ ] **Step 1: Create `frontend/src/styles/` and move the ranges** per the table. Cut each range from `styles.css` into its file. Work bottom-up (highest line ranges first) so earlier ranges keep their line numbers while you cut.

- [ ] **Step 2: Rewrite `frontend/src/styles.css` as the manifest** — exactly this content (fonts `@import` must stay first; file order is load-bearing for the cascade):

```css
/* ═══════════════════════════════════════════════════════════
   Physics IDE — stylesheet manifest. Order is load-bearing:
   each file sits on the same side of primitives.css as its
   rules did in the pre-split monolith.
   ═══════════════════════════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/chrome.css";
@import "./styles/workspace.css";
@import "./styles/viewport.css";
@import "./styles/debug.css";
@import "./styles/pages.css";
@import "./styles/datapanel.css";
@import "./styles/primitives.css";
@import "./styles/platform.css";
@import "./styles/responsive.css";
```

- [ ] **Step 3: Build to prove the split is lossless plumbing-wise.** Run: `npm run build -w frontend` → succeeds. Run: `npm run test -w frontend` → all suites pass (none read styles.css yet).

- [ ] **Step 4: Dead-CSS sweep.** For every class selector in the moved files, check for a user: `Select-String -Path frontend/src -Pattern "<name>" -Recurse` (strip the leading dot; for BEM variants check the base). A rule may be deleted ONLY if all of: zero matches in `frontend/src/**/*.js`; not a Blockly-injected class (`.blockly*`); not reached via a dynamic template (`tb-btn--${...}` style interpolation — check for the prefix); not a `[data-theme]` or media-query variant of a live rule. List every deleted selector in the commit body. When in doubt, keep it.

- [ ] **Step 5: Visual + audit verification.** Start `npm run dev`, load the IDE in both themes, open start menu, help, a physics project and a DS project — no visual regressions. Run `node frontend/scripts/ux-audit.mjs` → header height still ~48px, no new violations.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/styles.css frontend/src/styles/
git commit -m "refactor(frontend): split styles.css into 11 per-surface files behind an @import manifest; dead-CSS sweep"
```

---

### Task 2: Bundle Blockly — `blockly@11.2.2` exact, `blocklyLib.js`, media vendored

**Files:**
- Modify: `frontend/package.json`, `frontend/index.html`
- Create: `frontend/src/utils/blockly/blocklyLib.js`, `frontend/src/utils/blockly/__tests__/blocklyLib.test.js`, `frontend/public/blockly-media/` (copied from the package)
- Modify (all 16 `window.Blockly` sites): `frontend/src/hooks/useSplitPane.js:19-20`, `frontend/src/hooks/useSimulation.js:270-274`, `frontend/src/utils/export/exportUtils.js:21-26`, `frontend/src/utils/blockly/dsGenerator.js:5`, `frontend/src/components/BlocklyWorkspace.js:63,360,545,572,640`, `frontend/src/utils/blockly/blocklyGenerator.js:2796`, `frontend/src/components/layout/IDELayout.js:168`

**Interfaces:**
- Produces: `frontend/src/utils/blockly/blocklyLib.js` default-exporting the Blockly namespace with `blockly/blocks` registered, English locale installed, and `Blockly.Python` attached (the name all 115 generator sites and `getPythonGen` already use).
- Consumes: nothing. **Every later Blockly task imports this module.**

- [ ] **Step 1: Write the failing test** — `frontend/src/utils/blockly/__tests__/blocklyLib.test.js`:

```js
import { describe, test, expect } from "vitest";
import Blockly from "../blocklyLib";

describe("blocklyLib", () => {
  test("is the pinned bundled namespace, fully assembled", () => {
    expect(Blockly.VERSION).toBe("11.2.2");
    expect(typeof Blockly.inject).toBe("function");
    // Python generator attached under the legacy global's name
    expect(typeof Blockly.Python.workspaceToCode).toBe("function");
    // locale installed (blockly/msg/en side-effect)
    expect(Blockly.Msg.DUPLICATE_BLOCK).toBeTruthy();
    // standard blocks registered (blockly/blocks side-effect)
    expect(Blockly.Blocks.controls_if).toBeTruthy();
    // the renderer the app injects with
    expect(Blockly.registry.hasItem(Blockly.registry.Type.RENDERER, "zelos")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to fail** — `npm run test -w frontend -- blocklyLib` → FAIL (module not found).

- [ ] **Step 3: Install and write the module.** Run `npm i -w frontend --save-exact blockly@11.2.2`. Create `frontend/src/utils/blockly/blocklyLib.js`:

```js
/**
 * The one Blockly entry point. Every module that used to read window.Blockly
 * imports this instead. Side-effects on import: standard blocks registered,
 * English locale installed, Python generator attached as Blockly.Python —
 * the name the generator layer has always used, so its 115 call sites and
 * getPythonGen() keep working unchanged.
 */
import Blockly from "blockly/core";
import "blockly/blocks";
import * as En from "blockly/msg/en";
import { pythonGenerator } from "blockly/python";

Blockly.setLocale(En.default ?? En);
Blockly.Python = pythonGenerator;

export default Blockly;
```

- [ ] **Step 4: Run the test to pass** — `npm run test -w frontend -- blocklyLib` → PASS.

- [ ] **Step 5: Vendor the media.** Copy `frontend/node_modules/blockly/media/*` to `frontend/public/blockly-media/` (commit the files). In `BlocklyWorkspace.js`, add `media: "/blockly-media/",` to BOTH inject options objects (main at :390-407, read-only at :579-587).

- [ ] **Step 6: Rewrite the 16 sites.** In each file from the list, add `import Blockly from "<relative>/utils/blockly/blocklyLib";` (correct relative path) and replace `window.Blockly` reads with the import. Mechanical rules: `const Blockly = window.Blockly;` lines are deleted; guards like `if (!Blockly)` / `typeof window.Blockly?.svgResize === "function"` become plain calls (the import cannot be absent at runtime); `BlocklyWorkspace.js:359-364`'s load-failure gate becomes a try/catch around the inject call that sets the same `loadError` state (`"Blockly failed to initialize."`) — the `.fallback-panel` render at :551-553 stays.

- [ ] **Step 7: Remove the CDN tags** — delete `frontend/index.html` lines 13–18 (the comment + four `cdn.jsdelivr.net/npm/blockly@11` script tags).

- [ ] **Step 8: Verify everything still works.** `npm run test -w frontend` → all pass. `npm run build -w frontend` → clean. `npm run dev`: workspace renders, drag a block, run a simulation, block search inserts, XML import works, export .py/.xml works, split-pane resize works (the `useSplitPane` site).

- [ ] **Step 9: Commit**

```bash
git add -A frontend
git commit -m "feat(frontend): bundle blockly@11.2.2 exact — blocklyLib.js replaces all 16 window.Blockly sites, media vendored, CDN tags removed"
```

---

### Task 3: Vendor GlowScript + the DPR-sharp spike

**Files:**
- Create: `frontend/public/vendor/glowscript/` (six files + `PROVENANCE.md`), `frontend/src/utils/runner/__tests__/glowScriptsLocal.test.js`
- Modify: `frontend/src/utils/runner/glowRunner.js` (the `GLOWSCRIPT_SCRIPTS` map at :27-36; the DPR spike touches `viewportStyleText`/`resizeRuntimeCanvas` only if it passes)

**Interfaces:**
- Produces: six same-origin script URLs under `/vendor/glowscript/`; unchanged exports (`GLOWSCRIPT_VERSION`, `runPython`, …).
- Consumes: nothing.

- [ ] **Step 1: Download the six files** into `frontend/public/vendor/glowscript/` with these exact names (three interpolate `GLOWSCRIPT_VERSION` = "3.2"):

```bash
cd frontend/public/vendor/glowscript
curl -fLo jquery.min.js               https://cdn.jsdelivr.net/npm/jquery@2.1.4/dist/jquery.min.js
curl -fLo jquery.textchange.custom.js https://www.glowscript.org/lib/jquery/IDE/jquery.textchange.custom.js
curl -fLo jquery-ui.custom.min.js     https://www.glowscript.org/lib/jquery/IDE/jquery-ui.custom.min.js
curl -fLo glow.3.2.min.js             https://www.glowscript.org/package/glow.3.2.min.js
curl -fLo RScompiler.3.2.min.js       https://www.glowscript.org/package/RScompiler.3.2.min.js
curl -fLo RSrun.3.2.min.js            https://www.glowscript.org/package/RSrun.3.2.min.js
```

Write `PROVENANCE.md` beside them: source URL, download date, byte size and `sha256` of each file (compute with `Get-FileHash`), plus "GlowScript 3.2 / jQuery 2.1.4; MIT-licensed; vendored byte-identical, no modifications."

- [ ] **Step 2: Write the failing test** — `frontend/src/utils/runner/__tests__/glowScriptsLocal.test.js`:

```js
import { describe, test, expect } from "vitest";
import { GLOWSCRIPT_SCRIPTS, GLOWSCRIPT_VERSION } from "../glowRunner";

describe("vendored GlowScript", () => {
  test("every runtime script is same-origin", () => {
    const urls = Object.values(GLOWSCRIPT_SCRIPTS);
    expect(urls).toHaveLength(6);
    for (const u of urls) {
      expect(u, u).toMatch(/^\/vendor\/glowscript\//);
      expect(u, u).not.toMatch(/^https?:/);
    }
  });
  test("the versioned names still interpolate the exported version", () => {
    expect(GLOWSCRIPT_SCRIPTS.glow).toBe(`/vendor/glowscript/glow.${GLOWSCRIPT_VERSION}.min.js`);
  });
});
```

- [ ] **Step 3: Run to fail** (`GLOWSCRIPT_SCRIPTS` is not exported yet) → FAIL.

- [ ] **Step 4: Rewrite the map** in `frontend/src/utils/runner/glowRunner.js` (:27-36) and export it:

```js
const VENDOR_BASE = "/vendor/glowscript";
export const GLOWSCRIPT_SCRIPTS = {
  jquery: `${VENDOR_BASE}/jquery.min.js`,
  jqueryTextChange: `${VENDOR_BASE}/jquery.textchange.custom.js`,
  jqueryUi: `${VENDOR_BASE}/jquery-ui.custom.min.js`,
  glow: `${VENDOR_BASE}/glow.${GLOWSCRIPT_VERSION}.min.js`,
  compiler: `${VENDOR_BASE}/RScompiler.${GLOWSCRIPT_VERSION}.min.js`,
  run: `${VENDOR_BASE}/RSrun.${GLOWSCRIPT_VERSION}.min.js`,
};
```

(The runtime iframe is a same-origin `about:blank` document, so root-relative URLs resolve against the app origin in dev and prod alike; `loadScriptInFrame` needs no change.)

- [ ] **Step 5: Run to pass**, then verify live: `npm run dev`, run a physics sim — first frame renders; DevTools Network shows the six scripts served from `localhost:3000/vendor/glowscript/`, nothing from `glowscript.org`.

- [ ] **Step 6: Commit the vendoring**

```bash
git add -A frontend
git commit -m "feat(frontend): self-host GlowScript — six runtime files vendored under public/vendor/glowscript with provenance; runner loads same-origin"
```

- [ ] **Step 7: DPR spike (bounded, either outcome commits).** Hypothesis from `resizeRuntimeCanvas`'s measured notes (`runner/glowRunner.js:598-621`): GlowScript's GL viewport tracks `scene.width/height` (CSS px, never DPR-multiplied), so setting `scene.width = css * dpr` and letting CSS display the canvas at `css` px keeps buffer and viewport in sync at DPR scale — sharp with **no runtime patch**. Try: in `resizeRuntimeCanvas`'s preferred path, set `scene.width = Math.round(cssWidth * dpr)` / same for height, and in `viewportStyleText` add `canvas { width: 100% !important; height: 100% !important; }` so the DPR-sized buffer displays at CSS size. Verify with `node frontend/e2e/hidpi-probe.mjs` (crisp = backing store ≈ css×dpr AND content fills the buffer) AND a manual interaction check: mouse rotate/zoom and object picking must still track the cursor correctly (GlowScript maps pointer events through the canvas size — a factor-of-dpr offset here is the bail signal). **Pass** → keep, note measurements in the commit. **Fail** → revert the two edits, append the measured failure mode to the comment block at :598-621, and commit that note. Timebox: half a day.

- [ ] **Step 8: Commit the spike outcome**

```bash
git add -A frontend
git commit -m "feat(frontend): DPR-sharp viewport via scene-at-DPR sizing [OR] docs: DPR spike refuted — measurements recorded"
```

---

### Task 4: Bundle Monaco — `monaco-editor@0.45.0` exact, dynamic import, fallback intact

**Files:**
- Modify: `frontend/package.json`, `frontend/index.html` (remove lines 20–21), `frontend/src/components/CodeEditor.js`
- Create: `frontend/src/utils/monaco/monacoLib.js`, `frontend/src/components/__tests__/CodeEditor.test.js`

**Interfaces:**
- Produces: `frontend/src/utils/monaco/monacoLib.js` default-exporting the monaco namespace (editor + all editing features + python monarch grammar + bundled worker). **Loaded ONLY via `import("../utils/monaco/monacoLib")` from CodeEditor** so the ~3 MB chunk stays out of the initial bundle.
- Consumes: nothing. Task 14 imports the same module inside its theme-application step.

- [ ] **Step 1: Write the failing test** — `frontend/src/components/__tests__/CodeEditor.test.js`:

```js
import { describe, test, expect, vi } from "vitest";
import { mountComponent } from "../../test/renderHelpers";
import CodeEditor from "../CodeEditor";

vi.mock("../../utils/monaco/monacoLib", () => {
  throw new Error("simulated bundle failure");
});

describe("CodeEditor fallback", () => {
  test("renders the plain textarea when the Monaco bundle fails to load", async () => {
    const { container } = await mountComponent(
      <CodeEditor value="x = 1" onChange={() => {}} isDark />
    );
    // the dynamic import rejects -> fallback state -> textarea
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector("textarea.text-fallback")).toBeTruthy();
    expect(container.querySelector(".monaco-host")).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run to fail** — `npm run test -w frontend -- CodeEditor` → FAIL (module `utils/monaco/monacoLib` does not exist; the component still reads `window.require`).

- [ ] **Step 3: Install and write the module.** `npm i -w frontend --save-exact monaco-editor@0.45.0`. Create `frontend/src/utils/monaco/monacoLib.js`:

```js
/**
 * Bundled Monaco 0.45.0 — the exact version the CDN served, so behavior is
 * unchanged. edcore.main = the editor with all editing features and NO
 * language services; python's monarch grammar is the only language.
 * This module must only ever be reached through dynamic import() — it is
 * the code-mode chunk, not initial-load code.
 */
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

export default monaco;
```

- [ ] **Step 4: Rewrite `CodeEditor.js`'s load effect** (:33-53). Replace the `window.require` AMD block with a dynamic import; hold the namespace in a ref (`monacoRef`) and replace every later `window.monaco` read (`:99-103` setTheme effect, the two `deltaDecorations` effects at `:136`/`:153`) with `monacoRef.current`:

```js
  useEffect(() => {
    let disposed = false;
    import("../utils/monaco/monacoLib")
      .then(({ default: monaco }) => {
        if (disposed || !hostRef.current) return;
        monacoRef.current = monaco;
        const editor = monaco.editor.create(hostRef.current, {
          value: valueRef.current,
          language: "python",
          theme: isDarkRef.current ? "vs-dark" : "vs",
          minimap: { enabled: false },
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          fontSize: 14,
          readOnly: readOnlyRef.current,
          domReadOnly: readOnlyRef.current,
          glyphMargin: !!onToggleBpRef.current,
        });
        /* …existing editorRef wiring, onChange subscription, dispose handling
           stay as they are — only the acquisition path changed… */
      })
      .catch(() => {
        if (!disposed) setFallback(true);
      });
    return () => { disposed = true; /* existing dispose */ };
  }, []);
```

(`isDarkRef` is a new ref mirroring the `isDark` prop, same pattern as `valueRef` — it also fixes the old hardcoded-`"vs-dark"`-on-first-paint bug. Task 14 swaps these built-in theme names for the physics themes.) The `<textarea>` fallback at :156-165 is untouched.

- [ ] **Step 5: Remove the loader tag** — delete `frontend/index.html` lines 20–21 (comment + `monaco-editor@0.45.0/min/vs/loader.min.js`). The duplicated CDN path string inside `CodeEditor.js` (:41) disappears with Step 4.

- [ ] **Step 6: Run to pass** — `npm run test -w frontend -- CodeEditor` → PASS; full suite passes.

- [ ] **Step 7: Verify the chunking.** `npm run build -w frontend` → build output contains a separate multi-MB chunk + `editor.worker` + a small lazy `python` chunk, and the *initial* entry chunk did not grow by more than a few KB. `npm run dev`: switch to code mode — Monaco appears with highlighting and find widget (Ctrl+F); breakpoint glyphs still render in debug contexts; kill the network in DevTools and reload — code mode still works (bundled), textarea never appears.

- [ ] **Step 8: Commit**

```bash
git add -A frontend
git commit -m "feat(frontend): bundle monaco-editor@0.45.0 exact behind a dynamic import — CDN loader removed, textarea fallback intact"
```

---

### Task 5 (Lane A): `blockPalette.js` — the vivid v2 palette, AA-verified, brights fenced

**Files:**
- Create: `frontend/src/utils/blockly/blockPalette.js`, `frontend/src/utils/blockly/__tests__/blockPalette.test.js`

**Interfaces:**
- Produces: `BLOCK_PALETTE` (26 categories), `CATEGORY_NAMES`, `getCategoryColour(name)`, `styleNameFor(name)`, `categoryStyleNameFor(name)`, `cssVarFor(name)`, `brightFor(name)`, `paletteCssText()`, `blockStylesFromPalette()`, `categoryStylesFromPalette()`, `relativeLuminance(hex)`, `contrastRatio(hexA, hexB)`, `hueOf(hex)`, and `STYLE_CATEGORY_ALIASES` (`{ Starter: "Control", Scene: "Objects" }` — the two registry categories without palette entries; Plan 4's re-categorisation retires them).
- Consumes: nothing. **Tasks 6, 7, 8 and 14 consume this one.**

Each entry: `{ slug, fill, secondary, tertiary, bright, on: "#FFFFFF" }`; `styleNameFor` returns `` `${slug.replace(/-/g, "_")}_blocks` ``, `categoryStyleNameFor` returns `` `${slug.replace(/-/g, "_")}_category` ``, `cssVarFor` returns `` `--cat-${slug}` ``. The full v2 table (fill / secondary / tertiary / bright — spec §4 carries the contrast arithmetic):

| Category | slug | fill | secondary | tertiary | bright |
|---|---|---|---|---|---|
| Objects | objects | `#0973D1` | `#1077D2` | `#79BDF9` | `#0A8DFF` |
| Motion | motion | `#B05D07` | `#B2610D` | `#F8A552` | `#FF860A` |
| Values | values | `#743BF7` | `#7741F1` | `#C3AAFB` | `#550AFF` |
| State | state | `#D7099A` | `#DB119F` | `#FB96DC` | `#FF0AB6` |
| Control | control | `#BB0AF0` | `#BE1EEE` | `#E59CFB` | `#C70AFF` |
| Logic | logic | `#137AAD` | `#1A7DAE` | `#66C1EE` | `#19AAF0` |
| Math | math | `#3B54F7` | `#4159F1` | `#A7B3FB` | `#0A2BFF` |
| Variables | variables | `#BB5421` | `#BB5A29` | `#EAA888` | `#E46525` |
| Data Science | data-science | `#058178` | `#0A847C` | `#09CDBF` | `#0AFFEE` |
| Advanced | advanced | `#62748D` | `#6A7788` | `#AEB8C7` | `#6580A4` |
| Load Data | load-data | `#077CA0` | `#0C7FA3` | `#28C6F6` | `#0AC6FF` |
| Explore | explore | `#057F84` | `#0A8387` | `#09CBD2` | `#0AF7FF` |
| Statistics | statistics | `#058269` | `#0A856C` | `#09CFA7` | `#0AFFCD` |
| Transforming Data | transforming-data | `#06844D` | `#0A8750` | `#09D179` | `#0AFF93` |
| Uncertainty | uncertainty | `#068530` | `#0A8834` | `#09D34B` | `#0AFF5B` |
| Analyzing Relationships | analyzing-relationships | `#068512` | `#0A8916` | `#09D41C` | `#0AFF21` |
| Filter & Sort | filter-sort | `#1F8506` | `#24880A` | `#31D309` | `#3BFF0A` |
| Group & Compare | group-compare | `#3F8205` | `#43850A` | `#65CF09` | `#7BFF0A` |
| Charts | charts | `#617C05` | `#647F0A` | `#9AC608` | `#C6FF0A` |
| Communicate | communicate | `#877106` | `#8A740A` | `#D7B409` | `#FFD60A` |
| 3D Math | 3d-math | `#6168D1` | `#666DCB` | `#B0B3E8` | `#3741D2` |
| Raw Python | raw-python | `#6D7380` | `#747679` | `#B4B7BF` | `#717E98` |
| Loops | loops | `#B43CC6` | `#B149C1` | `#DCA4E5` | `#BE37D2` |
| Text | text | `#25806F` | `#2D8373` | `#4CCBB2` | `#37D2B4` |
| Lists | lists | `#597D24` | `#5E802C` | `#90C740` | `#93D237` |
| Functions | functions | `#BF38B1` | `#BE42B2` | `#E4A1DD` | `#D237C2` |

`paletteCssText()` emits, for every category, `--cat-<slug>: <fill>;` **and** `--cat-<slug>-bright: <bright>;` inside a single `:root { … }` block. `blockStylesFromPalette()` maps every category to `{ colourPrimary: fill, colourSecondary: secondary, colourTertiary: tertiary }` under `styleNameFor(name)`. `categoryStylesFromPalette()` maps every category to `{ colour: fill }` under `categoryStyleNameFor(name)`.

- [ ] **Step 1: Write the failing test** — `frontend/src/utils/blockly/__tests__/blockPalette.test.js`:

```js
import { describe, test, expect } from "vitest";
import {
  BLOCK_PALETTE, CATEGORY_NAMES, getCategoryColour, styleNameFor,
  categoryStyleNameFor, cssVarFor, brightFor, paletteCssText,
  blockStylesFromPalette, categoryStylesFromPalette,
  relativeLuminance, contrastRatio, hueOf,
} from "../blockPalette";

const AA = 4.5;

describe("colour helpers", () => {
  test("relativeLuminance matches WCAG reference points", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });
  test("contrastRatio matches known pairs", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#0973D1", "#FFFFFF")).toBeGreaterThanOrEqual(4.75);
  });
  test("hueOf reads hue angles", () => {
    expect(hueOf("#FF0000")).toBeCloseTo(0, 1);
    expect(hueOf("#00FF00")).toBeCloseTo(120, 1);
  });
});

describe("BLOCK_PALETTE v2", () => {
  test("26 categories, unique fills, unique slugs", () => {
    expect(CATEGORY_NAMES).toHaveLength(26);
    expect(new Set(CATEGORY_NAMES.map((n) => BLOCK_PALETTE[n].fill)).size).toBe(26);
    expect(new Set(CATEGORY_NAMES.map((n) => BLOCK_PALETTE[n].slug)).size).toBe(26);
  });
  test("every fill and secondary clears AA under white", () => {
    for (const n of CATEGORY_NAMES) {
      const { fill, secondary, on } = BLOCK_PALETTE[n];
      expect(on).toBe("#FFFFFF");
      expect(contrastRatio(fill, on), `${n} fill`).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(secondary, on), `${n} secondary`).toBeGreaterThanOrEqual(AA);
    }
  });
  test("no colour anywhere sits in the reserved red band (340°–15°)", () => {
    for (const n of CATEGORY_NAMES) {
      const e = BLOCK_PALETTE[n];
      for (const key of ["fill", "secondary", "tertiary", "bright"]) {
        const h = hueOf(e[key]);
        const inBand = h >= 340 || h <= 15;
        expect(inBand, `${n}.${key} hue ${h}`).toBe(false);
      }
    }
  });
  test("brights are decorative only — never in any blockStyle", () => {
    const styles = blockStylesFromPalette();
    const brights = new Set(CATEGORY_NAMES.map((n) => brightFor(n)));
    for (const s of Object.values(styles)) {
      for (const v of Object.values(s)) expect(brights.has(v), v).toBe(false);
    }
  });
  test("derived artefacts are complete and consistent", () => {
    const styles = blockStylesFromPalette();
    const cats = categoryStylesFromPalette();
    const css = paletteCssText();
    for (const n of CATEGORY_NAMES) {
      expect(styles[styleNameFor(n)].colourPrimary).toBe(BLOCK_PALETTE[n].fill);
      expect(cats[categoryStyleNameFor(n)].colour).toBe(BLOCK_PALETTE[n].fill);
      expect(css).toContain(`${cssVarFor(n)}: ${BLOCK_PALETTE[n].fill};`);
      expect(css).toContain(`${cssVarFor(n)}-bright: ${brightFor(n)};`);
      expect(getCategoryColour(n)).toBe(BLOCK_PALETTE[n].fill);
    }
  });
});
```

- [ ] **Step 2: Run to fail** → FAIL (module missing).
- [ ] **Step 3: Implement** `blockPalette.js` — the 26-entry table above as a literal object, the pure helpers (WCAG luminance per the standard formula: sRGB channels linearized with the 0.04045/12.92/2.4 piecewise, weights .2126/.7152/.0722; `hueOf` via max/min channel arithmetic). No imports.
- [ ] **Step 4: Run to pass**, run the full suite.
- [ ] **Step 5: Commit** — `git add frontend/src/utils/blockly/blockPalette.js frontend/src/utils/blockly/__tests__/blockPalette.test.js && git commit -m "feat(frontend): vivid v2 block palette — 26 AA-verified categories with fenced decorative brights"`

---

### Task 6 (Lane A): `blocklyTheme.js` — Zelos-based themes from the palette, extraction + bug fixes

**Files:**
- Create: `frontend/src/utils/blockly/blocklyTheme.js`, `frontend/src/utils/blockly/__tests__/blocklyTheme.test.js`
- Modify: `frontend/src/components/BlocklyWorkspace.js` (delete the inline `buildBlocklyTheme` at :150-198; four call sites at :368, :545-549, :577, :640-646; grid colours at :396 and :584)

**Interfaces:**
- Consumes: Task 2's `blocklyLib`, Task 5's `blockStylesFromPalette`/`categoryStylesFromPalette`.
- Produces: `getBlocklyTheme(isDark)` returning a cached `Blockly.Theme` named `physics-dark`/`physics-light`, and `gridColourFor(isDark)`.

- [ ] **Step 1: Write the failing test** — `frontend/src/utils/blockly/__tests__/blocklyTheme.test.js`:

```js
import { describe, test, expect } from "vitest";
import { getBlocklyTheme, gridColourFor } from "../blocklyTheme";
import { CATEGORY_NAMES, styleNameFor, categoryStyleNameFor, BLOCK_PALETTE } from "../blockPalette";

describe("getBlocklyTheme", () => {
  test("both themes carry every category's block and category styles", () => {
    for (const isDark of [true, false]) {
      const t = getBlocklyTheme(isDark);
      expect(t.name).toBe(isDark ? "physics-dark" : "physics-light");
      for (const n of CATEGORY_NAMES) {
        expect(t.blockStyles[styleNameFor(n)].colourPrimary).toBe(BLOCK_PALETTE[n].fill);
        expect(t.categoryStyles[categoryStyleNameFor(n)].colour).toBe(BLOCK_PALETTE[n].fill);
      }
      expect(t.fontStyle.size).toBe(13);
    }
  });
  test("themes are cached, not redefined per call", () => {
    expect(getBlocklyTheme(true)).toBe(getBlocklyTheme(true));
  });
  test("grid colour follows the theme", () => {
    expect(gridColourFor(true)).not.toBe(gridColourFor(false));
  });
});
```

- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement** `blocklyTheme.js`:

```js
import Blockly from "./blocklyLib";
import { blockStylesFromPalette, categoryStylesFromPalette } from "./blockPalette";

/* componentStyles carried over verbatim from the inline buildBlocklyTheme
   (BlocklyWorkspace.js pre-extraction), values unchanged. */
const COMPONENT_STYLES = {
  dark: {
    workspaceBackgroundColour: "#1e1e1e",
    toolboxBackgroundColour: "#252526",
    toolboxForegroundColour: "#cccccc",
    flyoutBackgroundColour: "#1e1e1e",
    flyoutForegroundColour: "#cccccc",
    flyoutOpacity: 0.98,
    scrollbarColour: "#505050",
    scrollbarOpacity: 0.55,
    insertionMarkerColour: "#569cd6",
    insertionMarkerOpacity: 0.5,
    cursorColour: "#007acc",
  },
  light: {
    workspaceBackgroundColour: "#ffffff",
    toolboxBackgroundColour: "#f3f3f3",
    toolboxForegroundColour: "#333333",
    flyoutBackgroundColour: "#f3f3f3",
    flyoutForegroundColour: "#333333",
    flyoutOpacity: 0.98,
    scrollbarColour: "#c8c8c8",
    scrollbarOpacity: 0.55,
    insertionMarkerColour: "#0451a5",
    insertionMarkerOpacity: 0.5,
    cursorColour: "#007acc",
  },
};

const FONT_STYLE = {
  family: "'Inter', 'Segoe UI', system-ui, sans-serif",
  weight: "500",
  size: 13, // was 11 — Zelos geometry carries 13 comfortably (MakeCode uses larger still)
};

export function gridColourFor(isDark) {
  return isDark ? "#2a2c40" : "#dddddd";
}

const cache = {};
export function getBlocklyTheme(isDark) {
  const key = isDark ? "physics-dark" : "physics-light";
  if (!cache[key]) {
    cache[key] = Blockly.Theme.defineTheme(key, {
      name: key,
      base: Blockly.Themes.Zelos,
      blockStyles: blockStylesFromPalette(),
      categoryStyles: categoryStylesFromPalette(),
      componentStyles: COMPONENT_STYLES[isDark ? "dark" : "light"],
      fontStyle: FONT_STYLE,
    });
  }
  return cache[key];
}
```

- [ ] **Step 4: Rewire `BlocklyWorkspace.js`.** Delete the inline `buildBlocklyTheme` (:150-198). Replace its four call sites with `getBlocklyTheme(...)` imported from `../utils/blockly/blocklyTheme`. **Fix the hardcoded-dark bug while there:** the initial inject (:368) currently passes `buildBlocklyTheme(Blockly, true)` regardless of the prop — it becomes `getBlocklyTheme(isDark)` (add `isDark` to the values the mount effect reads via a ref, same pattern the file already uses for `goalRef`). Replace the main workspace's hardcoded grid `colour: "#3c3c3c"` (:396) and ReadOnly's conditional (:584) with `gridColourFor(isDark)`.
- [ ] **Step 5: Run to pass** — new suite + full suite (existing BlocklyWorkspace suites keep passing).
- [ ] **Step 6: Visual check** — `npm run dev`: blocks now render with vivid palette fills in Zelos geometry on BOTH themes; first paint in light mode is light (bug fixed).
- [ ] **Step 7: Commit** — `git commit -am "feat(frontend): blocklyTheme.js — Zelos-based physics themes built from the palette; initial-inject theme bug fixed; grid follows theme"`

---

### Task 7 (Lane A): Every block definition swaps `colour:` for `style:` (115 lines)

**Files:**
- Modify: `frontend/src/utils/blockly/blocklyGenerator.js` (the 115 hue-integer `colour:` lines inside the `defineBlocksWithJsonArray` array starting at :92)
- Create: `frontend/src/utils/blockly/__tests__/blockStyles.test.js`

**Interfaces:**
- Consumes: Task 5's `styleNameFor`, the registry's `category` field (`blockRegistry.js` — every entry carries one), Task 6's theme.
- Produces: every custom block styled by category; the alias map `STYLE_CATEGORY_ALIASES`.

The style for each block is `styleNameFor(<its registry category>)`. Registry categories map onto palette names directly except two aliases (Plan 4's re-categorisation reconciles these properly): `Starter → Control`, `Scene → Objects`. The 4 hex `colour:` values on `field_colour` fields (:131, :142, :792, :814) are field defaults, NOT block colours — they stay.

- [ ] **Step 1: Write the failing test** — `frontend/src/utils/blockly/__tests__/blockStyles.test.js`:

```js
import { describe, test, expect } from "vitest";
import Blockly from "../blocklyLib";
import { defineCustomBlocksAndGenerator } from "../blocklyGenerator";
import { getAllBlockEntries } from "../blockRegistry";
import { styleNameFor, STYLE_CATEGORY_ALIASES } from "../blockPalette";

describe("block styles", () => {
  test("every registered custom block uses its category's style, no hue integers remain", () => {
    defineCustomBlocksAndGenerator(Blockly);
    for (const entry of getAllBlockEntries()) {
      if (!Blockly.Blocks[entry.id]) continue; // registry entries without a JSON definition are Plan 4's problem
      const category = STYLE_CATEGORY_ALIASES[entry.category] ?? entry.category;
      // Instantiate headlessly and read the resolved style name.
      const ws = new Blockly.Workspace();
      try {
        const block = ws.newBlock(entry.id);
        expect(block.getStyleName(), entry.id).toBe(styleNameFor(category));
        expect(block.hue_, `${entry.id} still has a hue`).toBeFalsy();
      } finally {
        ws.dispose();
      }
    }
  });
});
```

(If `getStyleName` proves unavailable on headless blocks in jsdom, assert on `block.styleName_` — one of the two is set by `setStyle`; resolve at implementation, the assertion intent is fixed.)

- [ ] **Step 2: Run to fail** — blocks still carry `colour:` hues.
- [ ] **Step 3: The transcription pass** (mechanical — suited to a fast model): in `blocklyGenerator.js`'s JSON array, for each of the 115 block definitions replace `colour: <int>,` with `style: "<styleNameFor(category)>",` where the category comes from that block's `BLOCK_REGISTRY` entry (aliases above). Work registry-entry-by-registry-entry, not hue-by-hue — the hue integers do NOT map 1:1 onto categories (e.g. `set_colour_var_block` is hue 30 but category Values). Leave the four `field_colour` hex lines alone.
- [ ] **Step 4: Run to pass**; full suite.
- [ ] **Step 5: Visual check** — every drawer's flyout blocks match their category colour; the chip/block mismatch (Values chip vs Values block, etc.) is gone.
- [ ] **Step 6: Commit** — `git commit -am "feat(frontend): all 115 block definitions styled by category via the palette — hue integers retired"`

---

### Task 8 (Lane A): The MakeCode rail — categorystyle toolbox, colored dots, `--cat-*` sync

**Files:**
- Modify: `frontend/src/utils/blockly/toolbox.js` (the 16 `colour="#…"` attributes), `frontend/src/components/BlocklyWorkspace.js` (rail decoration after inject), `frontend/src/styles/workspace.css` (`.blocklyTree*` rules at the moved 3013-3136 block), `frontend/src/styles/tokens.css` (the `--cat-*` block)
- Create: `frontend/src/utils/blockly/__tests__/paletteCssSync.test.js`

**Interfaces:**
- Consumes: Task 5 (`BLOCK_PALETTE`, `categoryStyleNameFor`, `paletteCssText`), Task 6 (theme `categoryStyles`).
- Produces: the rail's CSS contract — every category row exposes `--cat` and `--cat-bright` custom properties on its own div; `tokens.css` carries the 52 `--cat-*` variables.

- [ ] **Step 1: Write the failing sync test** — `frontend/src/utils/blockly/__tests__/paletteCssSync.test.js`:

```js
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { paletteCssText } from "../blockPalette";

const tokensCss = readFileSync(
  fileURLToPath(new URL("../../../styles/tokens.css", import.meta.url)),
  "utf8"
);

describe("tokens.css ↔ BLOCK_PALETTE", () => {
  test("the stylesheet carries the palette verbatim", () => {
    for (const line of paletteCssText().split("\n")) {
      const decl = line.trim();
      if (decl.startsWith("--cat-")) expect(tokensCss).toContain(decl);
    }
  });
});
```

- [ ] **Step 2: Run to fail**, then append the generated block to `tokens.css`: run `node -e "import('./frontend/src/utils/blockly/blockPalette.js').then(m => console.log(m.paletteCssText()))"` and paste the emitted `:root { … }` block at the end of `tokens.css` under a `/* ── Category colours — generated from blockPalette.js, sync enforced by paletteCssSync.test.js ── */` banner. Run to pass.

- [ ] **Step 3: Toolbox uses categorystyle.** In `toolbox.js`, replace each of the 16 `colour="#…"` attributes (:45,76,145,166,186,209,228,243,246,329,330,367,372,386,403,416) with `categorystyle="<categoryStyleNameFor(name)>"` — e.g. `<category name="Motion" categorystyle="motion_category">`. The `custom="VARIABLE"`/`custom="PROCEDURE"` attributes stay. Category names in the XML are exactly the palette names, so the mapping is 1:1 by name.

- [ ] **Step 4: Decorate the rail rows.** In `BlocklyWorkspace.js`, after both `Blockly.inject(...)` calls and after every `ws.updateToolbox(...)` (:531-540), run a shared helper (place it beside `resizeBlocklyWorkspace`):

```js
import { BLOCK_PALETTE } from "../utils/blockly/blockPalette";

function decorateToolboxRows(workspace) {
  const toolbox = workspace.getToolbox?.();
  if (!toolbox) return;
  for (const item of toolbox.getToolboxItems()) {
    const entry = BLOCK_PALETTE[item.getName?.()];
    const div = item.getDiv?.();
    if (!entry || !div) continue;
    div.style.setProperty("--cat", `var(--cat-${entry.slug})`);
    div.style.setProperty("--cat-bright", `var(--cat-${entry.slug}-bright)`);
  }
}
```

- [ ] **Step 5: The rail CSS.** Rework the `.blocklyTree*` block in `workspace.css` (moved lines 3013-3136): rows become MakeCode pills — `border-radius: var(--radius)`, a 14px round dot via `.blocklyTreeRow::before { content: ""; width: 14px; height: 14px; border-radius: 50%; background: var(--cat-bright, var(--text-dim)); }` (flex row, gap 10px), label `font-weight: 500`; the selected row fills with the category colour — Blockly already paints `.blocklyTreeSelected` from the category style, keep that and set `.blocklyTreeSelected .blocklyTreeLabel { color: #fff; font-weight: 600; }`; the Plan 2 disclosure chevron rules (`.blocklyTreeIconClosed`/`.blocklyTreeIconOpen`) stand untouched. Both chromes use the same `--cat-*` values by design.

- [ ] **Step 6: Verify.** Full suite passes (sync test now green). `npm run dev`: rail shows colored dots on both themes, active drawer fills with its colour, flyout background unchanged, goal switch (physics ↔ datascience project) keeps decoration (the `updateToolbox` re-decoration path). Keyboard toolbox navigation still works.
- [ ] **Step 7: Commit** — `git commit -am "feat(frontend): MakeCode rail — categorystyle toolbox, bright category dots, --cat-* tokens sync-tested"`

---

### Task 9 (Lane A): The trashcan — summoned by drag, delete area API

**Files:**
- Create: `frontend/src/components/WorkspaceTrash.js`, `frontend/src/components/__tests__/WorkspaceTrash.test.js`
- Modify: `frontend/src/components/BlocklyWorkspace.js` (inject options: `trashcan: false`; drag listener; render `<WorkspaceTrash>`), `frontend/src/components/Icons.js` (add `TrashLidIcon`), `frontend/src/styles/workspace.css`

**Interfaces:**
- Consumes: `blocklyLib` (`Blockly.DeleteArea`, `Blockly.ComponentManager.Capability`, `Blockly.utils.Rect`, `Blockly.Events.BLOCK_DRAG`).
- Produces: `WorkspaceTrash({ workspaceRef })` — the entire delete surface. Blockly's own trashcan is off.

Design: no can at rest. On drag start (`Events.BLOCK_DRAG`, `isStart: true`) the wrapper gains `.is-dragging-block`, fading the can in bottom-right. The can registers itself as a Blockly **delete area** via the component manager, so Blockly's native drag system handles the actual deletion (and its built-in dispose animation shrinks the block); hover state comes from the delete area's `onDragEnter`/`onDragExit` — lid opens (CSS transform on the lid `<g>`), target scales 1.15, stroke turns `var(--danger)`. Dragging onto the toolbox rail also deletes (Blockly's native flyout/toolbox delete stays enabled); `.is-dragging-block .blocklyToolboxDiv` gets a `var(--danger)`-tinted inset shadow as the zone hint. No confirmation — Ctrl+Z covers undo.

- [ ] **Step 1: Write the failing component test:**

```js
import { describe, test, expect, vi } from "vitest";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import WorkspaceTrash from "../WorkspaceTrash";

function fakeWorkspace() {
  const listeners = [];
  return {
    addChangeListener: (fn) => listeners.push(fn),
    removeChangeListener: vi.fn(),
    getComponentManager: () => ({ addComponent: vi.fn(), removeComponent: vi.fn() }),
    fire: (e) => listeners.forEach((fn) => fn(e)),
  };
}

describe("WorkspaceTrash", () => {
  test("hidden at rest, shown during a block drag", async () => {
    const ws = fakeWorkspace();
    const { container } = await mountComponent(
      <WorkspaceTrash workspaceRef={{ current: ws }} />
    );
    expect(container.querySelector(".workspace-trash--visible")).toBeFalsy();
    await act(() => ws.fire({ type: "drag", isStart: true }));
    expect(container.querySelector(".workspace-trash--visible")).toBeTruthy();
    await act(() => ws.fire({ type: "drag", isStart: false }));
    expect(container.querySelector(".workspace-trash--visible")).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement `WorkspaceTrash.js`.** A component that (a) subscribes to the workspace's change listener for `type === "drag"` toggling `visible` (and clearing `hover`), (b) registers a `Blockly.DeleteArea` subclass with the component manager while visible:

```js
import Blockly from "../utils/blockly/blocklyLib";

class TrashZone extends Blockly.DeleteArea {
  constructor(getRect, setHover) {
    super();
    this.id = "physicsTrashZone";
    this.getRect = getRect;
    this.setHover = setHover;
  }
  getClientRect() {
    const r = this.getRect();
    return r ? new Blockly.utils.Rect(r.top, r.bottom, r.left, r.right) : null;
  }
  onDragEnter() { this.setHover(true); }
  onDragExit() { this.setHover(false); }
  onDrop() { this.setHover(false); }
}
```

registered with `workspace.getComponentManager().addComponent({ component: zone, weight: 1, capabilities: [Blockly.ComponentManager.Capability.DELETE_AREA, Blockly.ComponentManager.Capability.DRAG_TARGET] })` and removed on unmount/hide; (c) renders the can — `TrashLidIcon` in the `Icons.js` idiom (lid path in its own `<g class="workspace-trash__lid">`, body + two vertical lines, `strokeWidth 1.6`) inside `<div className={...}>` positioned by CSS; rect measured from its own `getBoundingClientRect()`.

In `BlocklyWorkspace.js`: set `trashcan: false` in the main inject options (:391-ish) and render `<WorkspaceTrash workspaceRef={workspaceRef} />` inside `.blockly-workspace-wrapper`.

- [ ] **Step 4: CSS** in `workspace.css`: `.workspace-trash` fixed bottom-right of the wrapper, `opacity: 0; pointer-events: none; transition: opacity var(--transition), transform var(--transition);` — `--visible` gets `opacity: .9`; `--hover` gets `transform: scale(1.15); color: var(--danger);` and the lid `g` rotates `-28deg` (transform-origin at the hinge); `.is-dragging-block .blocklyToolboxDiv { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--danger) 55%, transparent); }`; `@media (prefers-reduced-motion: reduce)` drops the scale transition.
- [ ] **Step 5: Run to pass**; full suite.
- [ ] **Step 6: Live check** — drag a block: can fades in; over the can: lid opens, red; drop: block shrinks away (Blockly's dispose animation) and the can settles; drag onto the rail: rail tints, drop deletes; Ctrl+Z restores. No can visible at rest in either theme.
- [ ] **Step 7: Commit** — `git commit -am "feat(frontend): drag-summoned trashcan via Blockly delete-area API; rail doubles as delete zone; stock trashcan off"`

---

### Task 10 (Lane B): `visibleControls()` — the adaptive header, matrix-tested

**Files:**
- Create: `frontend/src/utils/toolbar/visibleControls.js`, `frontend/src/utils/toolbar/__tests__/visibleControls.test.js`
- Modify: `frontend/src/components/Toolbar.js`, `frontend/src/components/layout/IDELayout.js` (pass `booting`, drop `zoom`/`onZoomChange`)

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `visibleControls({ mode, goal, role, isTeacher, runState })` → `{ primary: string[], view: string[], file: string[] }` of control keys, plus the exported key lists `PRIMARY_KEYS`/`VIEW_KEYS`/`FILE_KEYS`. Toolbar renders ONLY what the lists contain. **Plan 4 consumes the reserved `trace` and `debug` slots.**

Axes: `mode: "blocks" | "text"`, `goal: "physics" | "datascience" | "hybrid"`, `role: "guest" | "user" | "admin"`, `isTeacher: boolean`, `runState: "idle" | "booting" | "running"`. The matrix (absorbing today's scattered conditionals — `showSimActions` at `Toolbar.js:112`, the ZoomSlider gate at :232-234, the `mode === "blocks"` clear gate at :177):

```js
const SIM_GOALS = new Set(["physics", "hybrid"]);

export function visibleControls({ mode, goal, role, isTeacher, runState }) {
  const sim = SIM_GOALS.has(goal);
  return {
    primary: [
      ...(sim && runState !== "running" ? ["run"] : []),
      ...(sim && runState !== "idle" ? ["stop"] : []),
      "modeToggle",
    ],
    view: [
      // zoom slider intentionally absent from every configuration — the
      // on-canvas cluster owns zoom (Task 11).
      ...(sim ? ["viewport"] : []),
      // Reserved slots: Plan 4's debug group fills these. Hidden while idle.
      ...(sim && runState !== "idle" ? ["trace", "debug"] : []),
      "reset",
      ...(mode === "blocks" ? ["clear"] : []),
      "help",
    ],
    file: [
      "save",
      "fileMenu",
      "themeToggle",
      ...(role === "guest" ? ["signIn"] : ["account"]),
      // Teacher classroom controls: no key yet — the slot is the isTeacher
      // parameter itself, so the classroom plans add their control as a
      // one-line matrix change, not an API change.
    ],
  };
}
```

Notes the implementer must keep: `run` stays visible-but-disabled during `booting` is WRONG under this matrix — during `booting` both `run` (absent: `runState !== "running"` keeps it, so it IS present and rendered disabled+acknowledged exactly as today) — i.e. `run` is present in `idle` and `booting` (disabled + acknowledged in booting, exactly Plan 2's behavior), absent while `running`; `stop` present in `booting` and `running`. `signIn`/`account` are both rendered by `HeaderAccount` today — the key only decides which wrapper state Toolbar asks for; `HeaderAccount` keeps owning its internals.

- [ ] **Step 1: Write the failing matrix test** — one assertion per rule:

```js
import { describe, test, expect } from "vitest";
import { visibleControls } from "../visibleControls";

const base = { mode: "blocks", goal: "physics", role: "user", isTeacher: false, runState: "idle" };
const v = (over) => visibleControls({ ...base, ...over });

describe("visibleControls", () => {
  test("run/stop lifecycle", () => {
    expect(v({ runState: "idle" }).primary).toEqual(["run", "modeToggle"]);
    expect(v({ runState: "booting" }).primary).toEqual(["run", "stop", "modeToggle"]);
    expect(v({ runState: "running" }).primary).toEqual(["stop", "modeToggle"]);
  });
  test("datascience goal hides every sim control", () => {
    const out = v({ goal: "datascience", runState: "running" });
    expect(out.primary).toEqual(["modeToggle"]);
    expect(out.view).not.toContain("viewport");
    expect(out.view).not.toContain("trace");
    expect(out.view).not.toContain("debug");
  });
  test("hybrid goal behaves like physics", () => {
    expect(v({ goal: "hybrid" }).primary).toContain("run");
  });
  test("zoom never appears in any configuration", () => {
    for (const goal of ["physics", "datascience", "hybrid"])
      for (const runState of ["idle", "booting", "running"])
        for (const mode of ["blocks", "text"])
          for (const zone of Object.values(v({ goal, runState, mode })))
            expect(zone).not.toContain("zoom");
  });
  test("trace/debug slots exist only while a sim is live", () => {
    expect(v({ runState: "idle" }).view).not.toContain("trace");
    expect(v({ runState: "booting" }).view).toEqual(expect.arrayContaining(["trace", "debug"]));
    expect(v({ runState: "running" }).view).toEqual(expect.arrayContaining(["trace", "debug"]));
  });
  test("clear is blocks-mode only; help and reset always", () => {
    expect(v({ mode: "text" }).view).not.toContain("clear");
    expect(v({ mode: "blocks" }).view).toContain("clear");
    for (const mode of ["blocks", "text"]) {
      expect(v({ mode }).view).toContain("help");
      expect(v({ mode }).view).toContain("reset");
    }
  });
  test("guest sees sign-in, others the account chip; file basics always", () => {
    expect(v({ role: "guest" }).file).toContain("signIn");
    expect(v({ role: "guest" }).file).not.toContain("account");
    expect(v({ role: "user" }).file).toContain("account");
    expect(v({ role: "admin" }).file).toContain("account");
    for (const role of ["guest", "user", "admin"])
      expect(v({ role }).file).toEqual(expect.arrayContaining(["save", "fileMenu", "themeToggle"]));
  });
});
```

- [ ] **Step 2: Run to fail; implement the module** (code above); run to pass.
- [ ] **Step 3: Rewire Toolbar.** `Toolbar` gains a `booting` prop (IDELayout passes `sim.booting`) and derives `runState = booting ? "booting" : running ? "running" : "idle"`; reads `role` from `useMe()` (`null` → `"guest"`, else `me.role`) and `isTeacher` from `me?.isTeacher ?? false`. Compute `const zones = visibleControls({ mode: modeValue, goal, role, isTeacher, runState })`. Each existing JSX control is keyed into a lookup (`CONTROL_RENDERERS = { run: () => <button …existing Run JSX… />, … }`) and zones render by mapping their key lists — the JSX for each control is today's, relocated, not redesigned. The `secondaryActions` array collapses into the same mechanism: its members ARE the `view` keys, and the stage-2 `DropdownMenu` renders `zones.view` entries instead of a parallel array. **Delete the `ZoomSlider` component (:40-73), its call site (:232-234), and the `zoom`/`onZoomChange` props**; delete the corresponding props from IDELayout's `<Toolbar …>` (:446-447). The reserved `trace`/`debug` keys render exactly as today (trace only when `onToggleTrace` exists — still Plan 4's handler; debug via `onDebugMode`).
- [ ] **Step 4: Component probe.** Extend `frontend/src/components/__tests__/Toolbar.test.js`: mounting with `goal="datascience"` renders no Run button; with `running` no Run but a Stop; with `mode="text"` no Clear item; the zoom slider is gone (`container.querySelector(".tb-zoom")` is null). Keep the `HeaderAccount` mock line.
- [ ] **Step 5: Full suite + live check** in both themes at three widths (wide, stage-1 1280, stage-2 1120): collapse still works, dividers sane, keyboard access unchanged.
- [ ] **Step 6: Commit** — `git commit -am "feat(frontend): adaptive header — Toolbar renders from pure visibleControls() across all four axes; zoom slider removed"`

---

### Task 11 (Lane B): The on-canvas zoom cluster

**Files:**
- Create: `frontend/src/components/WorkspaceZoom.js`, `frontend/src/components/__tests__/WorkspaceZoom.test.js`
- Modify: `frontend/src/components/layout/IDELayout.js` (render it over the blocks pane), `frontend/src/components/BlocklyWorkspace.js` (push restored zoom at mount), `frontend/src/styles/chrome.css` (cluster styles; delete `.tb-zoom*` rules)

**Interfaces:**
- Consumes: `sim.handleZoomChange` (`useSimulation.js:158-168` — `setScale(pct/100)` + `resize()`), `blocklyZoom` from context, `workspaceRef` for `zoomToFit`.
- Produces: `WorkspaceZoom({ zoom, onZoomChange, workspaceRef })` — a +/−/fit/percent cluster docked bottom-right of the blocks pane, blocks mode only.

- [ ] **Step 1: Write the failing test:**

```js
import { describe, test, expect, vi } from "vitest";
import { act } from "react";
import { mountComponent, click } from "../../test/renderHelpers";
import WorkspaceZoom from "../WorkspaceZoom";

describe("WorkspaceZoom", () => {
  test("steps, clamps, and fits", async () => {
    const onZoomChange = vi.fn();
    const ws = { zoomToFit: vi.fn(), getScale: () => 1.23 };
    const { container } = await mountComponent(
      <WorkspaceZoom zoom={195} onZoomChange={onZoomChange} workspaceRef={{ current: ws }} />
    );
    expect(container.textContent).toContain("195%");
    await act(() => click(container.querySelector('[title="Zoom in"]')));
    expect(onZoomChange).toHaveBeenCalledWith(200); // clamped to ZOOM_MAX
    await act(() => click(container.querySelector('[title="Zoom out"]')));
    expect(onZoomChange).toHaveBeenCalledWith(185);
    await act(() => click(container.querySelector('[title="Fit blocks to view"]')));
    expect(ws.zoomToFit).toHaveBeenCalled();
    expect(onZoomChange).toHaveBeenLastCalledWith(123); // read back after fit
  });
});
```

- [ ] **Step 2: Run to fail; implement.** Buttons use `ZoomInIcon`/`ZoomOutIcon` and `ScanIcon` (all exist in `Icons.js`), `className="workspace-zoom__btn"`, clamp with `ZOOM_MIN`/`ZOOM_MAX` from `constants/index.js` (35/200, step 10); fit calls `ws.zoomToFit()` then `onZoomChange(Math.round(ws.getScale() * 100))` so the persisted value tracks. Render in `IDELayout.js` inside the blocks-pane wrapper (beside `<BlocklyWorkspace>`; visible only when `mode === "blocks"`, which the pane already guarantees) with `zoom={blocklyZoom}` and `onZoomChange={sim.handleZoomChange}`.
- [ ] **Step 3: Mount-restore fix.** In `BlocklyWorkspace.js`'s mount effect, after inject: `workspace.setScale((initialZoomRef.current ?? 90) / 100);` with `initialZoomRef` mirroring a new `initialZoom` prop that IDELayout feeds from `blocklyZoom` — the localStorage-restored zoom finally reaches the workspace (today `startScale: 0.9` always wins; the wheel-sync listener at :427-437 keeps the readout honest afterwards).
- [ ] **Step 4: CSS** in `chrome.css`: `.workspace-zoom` — absolute, `right: var(--space-4); bottom: var(--space-4);`, vertical flex, `var(--radius)` card on `var(--bg-surface)` with `var(--border)` and elevation token, buttons 32px square; **delete the now-dead `.tb-zoom`, `.tb-zoom-slider`, `.tb-zoom-label` rules** (moved lines 677–721). Keep clear of the trashcan's corner (trashcan sits inside the Blockly wrapper bottom-right too — offset the cluster `bottom` by 56px so both fit; during drag the cluster hides: `.is-dragging-block .workspace-zoom { opacity: 0; }`).
- [ ] **Step 5: Full suite + live check**: wheel zoom updates the cluster's percent label; buttons step; fit frames the blocks; reload restores last zoom; e2e note — `.tb-zoom` selectors do not appear in the e2e scripts (verified), no selector updates needed here.
- [ ] **Step 6: Commit** — `git commit -am "feat(frontend): on-canvas workspace zoom cluster (+/−/fit); restored zoom reaches the workspace at mount; header slider CSS removed"`

---

### Task 12 (Lane B): The idle atom is the loader

**Files:**
- Modify: `frontend/src/components/GlowCanvas.js` (:76-105), `frontend/src/styles/viewport.css`
- Create: `frontend/src/components/__tests__/GlowCanvasBoot.test.js`

**Interfaces:**
- Consumes: the existing `booting` prop (Plan 2's state machine, untouched).
- Produces: `.canvas-idle--booting` as the only boot indicator. `.canvas-booting*` is deleted everywhere.

- [ ] **Step 1: Write the failing test** — `frontend/src/components/__tests__/GlowCanvasBoot.test.js`:

```js
import { describe, test, expect, vi } from "vitest";
import { mountComponent } from "../../test/renderHelpers";
import GlowCanvas from "../GlowCanvas";

vi.mock("../../utils/runner/glowRunner", async (orig) => ({
  ...(await orig()),
  applyRuntimeTheme: vi.fn(),
  getSceneMeta: () => ({}),
  getRuntimeScene: () => null,
}));

describe("GlowCanvas boot state", () => {
  test("booting animates the idle atom in place — no spinner overlay", async () => {
    const { container } = await mountComponent(<GlowCanvas running booting onStatus={() => {}} />);
    expect(container.querySelector(".canvas-idle--booting")).toBeTruthy();
    expect(container.querySelector(".canvas-booting")).toBeFalsy();
    expect(container.querySelector(".canvas-booting__spinner")).toBeFalsy();
    expect(container.textContent).toContain("Starting simulation");
  });
  test("idle shows the static atom and the Run hint", async () => {
    const { container } = await mountComponent(<GlowCanvas running={false} booting={false} onStatus={() => {}} />);
    expect(container.querySelector(".canvas-idle--booting")).toBeFalsy();
    expect(container.textContent).toContain("Press");
  });
});
```

(Mirror the mock shape of the existing GlowCanvas/viewport suites if they already mock the runner differently — extend, don't fork.)

- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Rework the JSX** (:76-105). Delete the whole `{booting && (<div className="canvas-booting">…)}` block. The idle layer becomes:

```jsx
        {(!running || booting) && (
          <div className={`canvas-idle${booting ? " canvas-idle--booting" : ""}`}>
            <div className="canvas-idle-inner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}
                   strokeLinecap="round" strokeLinejoin="round" className="canvas-idle-atom">
                <circle className="canvas-idle-atom__nucleus" cx="12" cy="12" r="2" fill="currentColor" />
                <ellipse className="canvas-idle-atom__orbit" cx="12" cy="12" rx="10" ry="4" />
                <g transform="rotate(60 12 12)"><ellipse className="canvas-idle-atom__orbit" cx="12" cy="12" rx="10" ry="4" /></g>
                <g transform="rotate(120 12 12)"><ellipse className="canvas-idle-atom__orbit" cx="12" cy="12" rx="10" ry="4" /></g>
              </svg>
              <p className="canvas-idle-label">3D Viewport</p>
              <p className="canvas-idle-hint">
                {booting ? "Starting simulation…" : (<>Press <strong>Run</strong> to start the simulation</>)}
              </p>
            </div>
          </div>
        )}
```

(The two rotated orbits move into `<g>` wrappers so CSS can spin each ellipse about its own center without clobbering the base rotation — CSS `transform` overrides the SVG attribute on the same element.)

- [ ] **Step 4: CSS** in `viewport.css`. Delete the `.canvas-booting*` rules and `@keyframes canvas-boot-spin` (moved lines 4995–5024). Add, beside `.canvas-idle-atom` (which keeps its 48px / `--accent` / 0.35 base):

```css
.canvas-idle-atom__orbit,
.canvas-idle-atom__nucleus { transform-box: fill-box; transform-origin: center; }

.canvas-idle--booting .canvas-idle-atom { opacity: 1; }
.canvas-idle--booting .canvas-idle-atom__orbit { animation: atom-orbit 2s linear infinite; }
.canvas-idle--booting g:nth-of-type(1) .canvas-idle-atom__orbit { animation-duration: 2.6s; animation-direction: reverse; }
.canvas-idle--booting g:nth-of-type(2) .canvas-idle-atom__orbit { animation-duration: 3.2s; }
.canvas-idle--booting .canvas-idle-atom__nucleus { animation: atom-nucleus 1.6s ease-in-out infinite; }

@keyframes atom-orbit { to { transform: rotate(360deg); } }
@keyframes atom-nucleus {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

@media (prefers-reduced-motion: reduce) {
  .canvas-idle--booting .canvas-idle-atom__orbit { animation: none; }
  .canvas-idle--booting .canvas-idle-atom__nucleus { animation: atom-nucleus 2.4s ease-in-out infinite; }
}
```

- [ ] **Step 5: Run to pass**; full suite (any existing suite asserting `.canvas-booting` gets updated to the new contract — that's the point of the change).
- [ ] **Step 6: Live check**: click Run — the atom spins up in place, tint lifts to accent, label swaps; first frame — the layer fades out (existing unmount); Stop mid-boot — atom returns to rest; boot failure (e.g. temporarily rename a vendored script) — animation stops, error banner reports.
- [ ] **Step 7: Commit** — `git commit -am "feat(frontend): the idle atom is the boot loader — spinner overlay deleted, reduced-motion respected"`

---

### Task 13 (Lane B): Run-lifecycle repairs — every load path ends the run; context memoised; ready-poll extracted

**Files:**
- Modify: `frontend/src/hooks/useSimulation.js` (:242-251 `loadWorkspaceXml`, :260-302 `handleImport`), `frontend/src/components/layout/IDELayout.js` (:306-327 `handleImportProject`, the `selectProject` path at :358), `frontend/src/contexts/SimulationContext.js` (:90-118), `frontend/src/components/GlowCanvas.js` (:47-56), `frontend/src/components/ViewportControls.js` (:69-78)
- Create: `frontend/src/hooks/useRuntimeReady.js`, `frontend/src/hooks/__tests__/useRuntimeReady.test.js`

**Interfaces:**
- Consumes: `endRun` (`useSimulation.js:37-43`).
- Produces: `useRuntimeReady({ enabled, tries, intervalMs, onReady })` → `ready: boolean`; a memoised `SimulationContext` value; the invariant *"every path that replaces the workspace or project goes through `endRun`"*.

- [ ] **Step 1: endRun routing.** In `useSimulation.js`, `loadWorkspaceXml` and both `handleImport` branches currently hand-roll `stopPython(...); setRunning(false);` — omitting `setBooting(false)` and the `runGenerationRef` bump, so a project imported mid-boot can have the stale boot flip state later (the exact bug class Plan 2 fixed for runs). Replace those hand-rolled pairs with the same `endRun({ runGenerationRef, setRunning, setBooting, setStatus })` call `handleStop` uses (the ctx object is already in scope in the hook). In `IDELayout.js`, `handleImportProject` (:306-327) and the start-menu `selectProject` path (:358) never stop anything: call `sim.handleStop()` first thing in both (idempotent when nothing runs).
- [ ] **Step 2: Regression tests.** Extend the existing `useSimulation` suite: after `handleImport` of an `.xml` file while `booting` is true, `booting` is false and `runGenerationRef.current` incremented; same for `loadWorkspaceXml`. (The suite already mounts the hook against a mock context — follow its pattern.)
- [ ] **Step 3: Memoise the context.** In `SimulationContext.js`, wrap the `value` literal (:90-118) in `useMemo` keyed on every state value it carries (the refs are stable and stay out of the dep list). No consumer change.
- [ ] **Step 4: Extract the ready-poll.** Write the failing hook test (fake timers: `enabled: false` → stays false and no timer; `enabled: true` with a probe that returns null twice then a scene → `ready` flips on the third tick; unmount clears the interval). Implement `useRuntimeReady`:

```js
import { useEffect, useState } from "react";
import { getRuntimeScene } from "../utils/runner/glowRunner";

/** Polls for the GlowScript scene after a run starts. One implementation for
 *  the two former copies (GlowCanvas ~9s, ViewportControls ~6s). */
export function useRuntimeReady({ enabled, tries = 40, intervalMs = 150, onReady } = {}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!enabled) { setReady(false); return undefined; }
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      const scene = getRuntimeScene();
      if (scene) { clearInterval(id); setReady(true); onReady?.(scene); }
      else if (count >= tries) clearInterval(id);
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, tries, intervalMs]);
  return ready;
}
```

Replace `GlowCanvas.js:47-56` (use `tries: 60`, `onReady: () => setSceneMeta(getSceneMeta())`) and `ViewportControls.js:69-78` (defaults) with the hook.
- [ ] **Step 5: Full suite + live check** — import a project while a sim boots: no ghost boot state; camera cluster still enables when the scene arrives.
- [ ] **Step 6: Commit** — `git commit -am "fix(frontend): imports and project loads end the run properly; SimulationContext memoised; useRuntimeReady replaces twin polls"`

---

### Task 14 (Lane C): Monaco speaks the palette — `physics-light` / `physics-dark`

**Files:**
- Create: `frontend/src/utils/monaco/monacoThemes.js`, `frontend/src/utils/monaco/__tests__/monacoThemes.test.js`
- Modify: `frontend/src/components/CodeEditor.js` (theme registration + selection)

**Interfaces:**
- Consumes: Task 5's `BLOCK_PALETTE`/`contrastRatio`, Task 4's `monacoLib` (dynamic).
- Produces: `MONACO_THEMES` (two `IStandaloneThemeData` objects), `VPYTHON_BUILTINS`, `registerPhysicsThemes(monaco)`, `physicsThemeName(isDark)`.

- [ ] **Step 1: Write the failing test:**

```js
import { describe, test, expect } from "vitest";
import { MONACO_THEMES, physicsThemeName, VPYTHON_BUILTINS } from "../monacoThemes";
import { contrastRatio } from "../../blockly/blockPalette";

describe("physics Monaco themes", () => {
  test("names resolve", () => {
    expect(physicsThemeName(true)).toBe("physics-dark");
    expect(physicsThemeName(false)).toBe("physics-light");
  });
  test("every token colour clears AA on its editor background", () => {
    for (const name of ["physics-dark", "physics-light"]) {
      const t = MONACO_THEMES[name];
      const bg = t.colors["editor.background"];
      for (const rule of t.rules) {
        if (!rule.foreground) continue;
        expect(contrastRatio(`#${rule.foreground}`, bg), `${name}:${rule.token}`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  test("the VPython vocabulary is tokenized", () => {
    for (const b of ["sphere", "vector", "rate", "box", "arrow"]) {
      expect(VPYTHON_BUILTINS).toContain(b);
    }
  });
});
```

- [ ] **Step 2: Run to fail; implement `monacoThemes.js`.** Colours from the palette — light uses AA fills, dark uses tertiary tints on `#1e1e1e` (`comment` uses neutral greys):

```js
import { BLOCK_PALETTE } from "../blockly/blockPalette";

export const VPYTHON_BUILTINS = [
  "sphere", "box", "cylinder", "cone", "arrow", "ring", "helix", "curve",
  "label", "vector", "vec", "rate", "color", "mag", "norm", "cross", "dot",
  "graph", "gcurve", "gdots", "canvas", "scene",
];

const P = BLOCK_PALETTE;
const strip = (hex) => hex.slice(1);

export const MONACO_THEMES = {
  "physics-light": {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: strip(P["Control"].fill) },
      { token: "type.identifier.vpython", foreground: strip(P["Objects"].fill) },
      { token: "number", foreground: strip(P["Motion"].fill) },
      { token: "string", foreground: strip(P["Transforming Data"].fill) },
      { token: "comment", foreground: "6D7380" },
    ],
    colors: { "editor.background": "#ffffff" },
  },
  "physics-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: strip(P["Control"].tertiary) },
      { token: "type.identifier.vpython", foreground: strip(P["Objects"].tertiary) },
      { token: "number", foreground: strip(P["Motion"].tertiary) },
      { token: "string", foreground: strip(P["Transforming Data"].tertiary) },
      { token: "comment", foreground: "8B949E" },
    ],
    colors: { "editor.background": "#1e1e1e" },
  },
};

export function physicsThemeName(isDark) {
  return isDark ? "physics-dark" : "physics-light";
}

/** Register both themes and teach python's monarch grammar the VPython
 *  vocabulary (as a distinct token so the Objects azure lands on calls). */
export async function registerPhysicsThemes(monaco) {
  const { language } = await import(
    "monaco-editor/esm/vs/basic-languages/python/python.js"
  );
  monaco.languages.setMonarchTokensProvider("python", {
    ...language,
    typeKeywords: VPYTHON_BUILTINS,
    tokenizer: {
      ...language.tokenizer,
      root: [
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@typeKeywords": "type.identifier.vpython",
              "@keywords": "keyword",
              "@default": "identifier",
            },
          },
        ],
        ...language.tokenizer.root,
      ],
    },
  });
  for (const [name, data] of Object.entries(MONACO_THEMES)) {
    monaco.editor.defineTheme(name, data);
  }
}
```

(0.45's python monarch definition keys its identifier rule on `@keywords`; the prepended rule adds the builtin case ahead of it. If the shipped grammar's structure differs in detail, adapt inside `registerPhysicsThemes` only — the exported theme data and test do not move.)

- [ ] **Step 3: Wire CodeEditor.** In the Task 4 load effect, after acquiring `monaco`: `await registerPhysicsThemes(monaco);` then create with `theme: physicsThemeName(isDarkRef.current)`; the isDark effect (:99-103 shape) calls `monaco.editor.setTheme(physicsThemeName(isDark))`.
- [ ] **Step 4: Run to pass**; full suite; live check — code mode shows violet keywords, azure `sphere(`/`vector(` calls, orange numbers in both themes; toggling theme swaps instantly; the fallback textarea is untouched.
- [ ] **Step 5: Commit** — `git commit -am "feat(frontend): Monaco physics themes from the palette — VPython builtins tokenized, AA-tested against both backgrounds"`

---

### Task 15 (After all lanes merge): Wrap-up — offline truth, docs, e2e refresh

**Files:**
- Modify: `docs/product-contract.md` (§101, §107, the Monaco exception note), `docs/Physics_IDE_User_Guide.md` (the stale "Export dropdown" wording — the control is the header **File** menu since Plan 2), `frontend/scripts/e2e-test.mjs` + `frontend/scripts/ux-audit.mjs` (selector updates only if a header/toolbox selector changed)
- Delete: the stale repo-root `e2e/` directory (49 PNGs + `results.json` from 2026-06-01 — the live suite writes to `frontend/e2e/`)
- Refresh: `frontend/e2e/*.png` (single commit)

- [ ] **Step 1: Contract + guide.** `product-contract.md`: §101/§107 lose their Monaco/CDN carve-outs — Blockly, GlowScript and Monaco are all same-origin now; state it plainly. `Physics_IDE_User_Guide.md`: fix the Export-dropdown wording to the current File-menu reality (Plan 02 residual).
- [ ] **Step 2: Offline smoke.** `npm run build -w frontend`, serve `dist` (`npm run preview -w frontend`), open with DevTools → Network → Offline after first load: blocks editor, code editor, and a physics run all work; the only network rows are the Google-Fonts `@import` (documented deferral) — no jsdelivr, no glowscript.org.
- [ ] **Step 3: Suites + build + untouched workspaces.** `npm run test -w frontend` (all green), `npm run build -w frontend`, `npm run typecheck -w backend`, `npm run typecheck -w shared` (prove untouched), `npm run check:blocks`.
- [ ] **Step 4: e2e.** Start the dev server, run `node frontend/scripts/e2e-test.mjs` → 142/142 (fix any selector drift in the scripts — `.app-header` and `[role="tab"]` survive this plan by design; `.tb-zoom` never appears in the scripts). Run `node frontend/scripts/ux-audit.mjs`. Delete the stale root `e2e/` copy. Commit the refreshed `frontend/e2e/` PNGs as ONE commit: `test(e2e): screenshot refresh after the MakeCode overhaul`.
- [ ] **Step 5: Final commit + wrap.** `git commit -am "docs: offline promise fully true — contract §101/§107 updated; user-guide File-menu wording; stale root e2e/ removed"`. Report suite counts in the close-out.
