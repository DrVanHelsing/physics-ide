# IDE Modernization — Plan 2: Interaction Upgrades

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tranche 2 of the deep review delivered: *the controls do what they say, survive a reload, and work on a Chromebook.* Every keyboard shortcut the UI advertises actually fires (and Ctrl+S means **save**, not export); the fake titlebar and the flat toolbar merge into one 44px header that finally names the open project and routes to the platform; the toolbar degrades in two stages instead of silently dropping controls between 800px and 1220px; layout survives a reload; every drag handle works with a finger; the blank canvas, the start-menu landing, the boot gap and the 3D viewport all say something useful instead of nothing; the four dialogs share one accessible `<Overlay>`; and the viewport gains the camera cluster, the correct resize behaviour and the screenshot that actually captures pixels.

**Architecture:** No new architecture. Three shapes recur. (1) *Pure helper + thin hook*: new logic (`matchHotkey`, `relativeSaveLabel`, `isUniformImageData`, `clampSplit`) lands under `utils/` as a dependency-free function with a Vitest suite, and a hook in `hooks/` binds it to the DOM — this keeps the established utils-only test policy intact. (2) *Component tests as the safety net*: Task 2 installs a 40-line render-and-click harness built on React 18.3's own `act` export plus `react-dom/client`, and a Toolbar suite lands **before** the header restructure so a broken control cannot ship with CI green. (3) *Capability-checked iframe access*: the viewport work never assumes GlowScript's API is present — `glowRunner` exposes `getRuntimeWindow()`/`getRuntimeCanvas()`, and every camera control disables itself when the capability is absent rather than failing loudly.

**Tech Stack:** existing only (React 18.3, Vite 7.3.6, Vitest 4.1.10, jsdom 25, localForage, react-router-dom 7, html2canvas 1.4.1 — already a dependency). **No new dependencies.** Frontend stays plain JavaScript.

**Spec:** [docs/superpowers/reviews/2026-08-19-ide-deep-review.md](../reviews/2026-08-19-ide-deep-review.md) — "Suggested modernization roadmap → Tranche 2 — Interaction upgrades" (lines 239-253), plus the Controls & Layouts, 3D Viewport and Block Toolbox proposal tables it draws from, and the product-owner rulings on open questions 7, 8, 9, 10, 11 and 12.

---

## Product-owner rulings baked in (do not reopen)

- **Design direction.** The VS-Code-like professional-tool identity **stays**, toned to a new middle. The merged 44px header **replaces** the fake titlebar — this is the flagship "toned costume" change. The status bar keeps its status-bar identity but becomes quiet: `--bg-surface`, hairline top border, project · save state · run status, coloured from the **semantic accent token**, never the literal `#007acc`.
- **Ctrl+S = SAVE.** Implemented for real. The Help shortcuts table, the Export dropdown's `Ctrl+S` chip and README §8 all get corrected; nothing may keep advertising Ctrl+S as export.
- **Minimum viewport: 1024px.** The two-stage toolbar collapse and the one platform breakpoint target that floor. Below 1024px the app is expected to work, not to be beautiful.
- **Touch = "does not break on a tablet", not full touch support.** Pointer events on all three drag handles, and `@media (pointer: coarse)` targets of **≥ 24px**. No gesture work, no touch-specific UI.
- **Template scene title/caption revived in React chrome** (Task 15) — small, part of the viewport cluster.
- **ONE e2e screenshot pass at the END** (Task 17). No mid-series screenshot churn. See the note below — the artifacts turned out not to be committed at all.
- **Component tests land before the restructure** (Task 2), and the vitest toolchain gap that blocks them is fixed first (Task 1).
- **No emojis anywhere in product UI.** Every new affordance uses an inline SVG from `frontend/src/components/Icons.js`; new glyphs are added to that file in the same `sz(size)` style.

## Consumed interface from Tranche 1 (Visual Foundation)

**Depends on:** [Plan 1 — Visual Foundation](2026-08-20-ide-modernization-01-visual-foundation.md). Land it first. This plan consumes its tokens and primitives by name:

| Consumed | Exact names from Plan 1 Task 1 |
|---|---|
| Spacing ramp | `--space-0`…`--space-8` (4px base) |
| Type scale | `--fs-2xs` 10px · `--fs-xs` 11px · `--fs-sm` 12px · `--fs-md` 13px · `--fs-lg` 14px · … `--fs-hero` |
| Radii | `--radius-sm` · `--radius` (now **6px**) · `--radius-lg` (now **10px**) · `--radius-pill` |
| Motion | `--transition-fast` / `--transition` / `--transition-slow` |
| Focus | `--focus-ring-width` / `--focus-ring-offset` / `--focus-ring-color`, plus the global `:focus-visible` rule |
| Control metrics | `--control-h-sm/--control-h/--control-h-lg`, `--btn-pad*`, `--btn-fs`, `--on-accent`, `--btn-primary-bg` |
| Primitives | `.btn`, `.card`, `.panel-header` (introduced as comma-appended aliases — **no markup changed**, so `.tb-btn`, `.start-card` and `.pane-header` all keep working) |

Every `var(--token, <fallback>)` in this plan carries the literal Plan 1 assigns, so a task that runs out of order still renders correctly. **If Plan 1 has landed, drop the fallbacks** — they are noise, not insurance.

**Two conventions this creates:**

1. **Cite selectors in `styles.css`, not line numbers.** Plan 1 restructures that file substantially (a new `:root` block above the theme blocks, plus a colour sweep). Every `styles.css:NNN` reference in *this* plan is a **pre-Tranche-1** locator, verified at `771bc1e`, and is there to identify *which rule* is meant. After Plan 1 lands, find the rule by its selector.
2. **This tranche adds no new colour literals.** Every colour is a token or a `color-mix()` of one.

**Explicit handoffs Plan 1 passes to this tranche** (named in its Deferred list — each is claimed below, so nothing falls between the two plans):

| Handoff from Plan 1 | Claimed by |
|---|---|
| `.admin-table` overflow container and all `@media` work | Task 6 |
| The status bar's **content** and its 26px height (Plan 1 only de-blues the surface) | Task 8 |
| `.tb-btn--active` and the dead Trace toggle — "Tranche 2 decides wire-or-delete" | Task 9, Step 3 (decision recorded there) |

**And two things Plan 1 or Plan 3 already own — do NOT re-implement them here:**

- **Run as the filled primary** is Plan 1 Task 6 ("`.tb-btn--run` becomes the single filled primary in the IDE core", review Quick win 6). This plan *inherits* it and only adds the shortcut chip's on-accent colours.
- **The viewport idle state's `opacity: 0.18` contrast failure** is Plan 1 (Quick win 2). Task 16's booting overlay therefore sets its own colours rather than inheriting that layer's opacity.
- **Blockly `isDark`-at-inject and `fontStyle` 11 → 13** are Plan 3 (its `buildBlocklyTheme` task). Task 13 touches `BlocklyWorkspace.js` but must leave `:297` and the theme builder alone.
- **`DebugMode.js` is deleted by Plan 3**, which re-homes debug into the shell. Tasks 5 and 14 make small, surgical edits to that file (pointer events, reusing `GlowCanvas`) because it is the live UI until Plan 3 lands — do not invest further in it.

## Global Constraints

- **Every task commits on `feature/classroom-platform`.** One commit per task, message given verbatim in the task.
- **Frontend stays plain JavaScript.** No TypeScript in `frontend/src`, no state library, no CSS framework, **no new npm dependency** — Task 1 proves the component-test layer needs none.
- **Tests:** new *logic* is a pure function under `utils/` with a Vitest suite written first. New *components* get a render-and-click test using the Task 2 harness. Existing suites must stay green: baseline is **13 test files / 152 tests** (`npm run test -w frontend`) before Task 1.
- **Never break the guest path.** Nothing in this tranche may require a signed-in session. `SyncChip` stays signed-in-only; the guest save state is a separate, local-only readout (Task 8).
- **Never regress local-first saving.** Ctrl+S calls the existing `useProject().saveCurrent()`; it does not introduce a second save path and does not touch the 3s debounced manifest autosave (`useProject.js:61-104`) or the 2s legacy blob (`SimulationContext.js:53-56`).
- **Manifest schema untouched.** `SCHEMA_VERSION` stays 2. Layout preferences live in `localStorage` via the existing `hooks/useLocalStorage.js`, never in a manifest.
- **Capability checks, not assumptions, at the iframe boundary.** The GlowScript runtime is a third-party document loaded from `glowscript.org` (`glowRunner.js:22-31`). Every read of `frameWindow.scene` is wrapped, every control hides or disables itself when the capability is missing, and no control ever reports success it cannot verify.
- **Blockly is still a CDN global** (`window.Blockly`, `frontend/index.html`). Bundling it is a Tranche 3 decision — do not `npm i blockly` here.
- **Accessibility floor for everything new:** a real `<button>`, a `title`, an `aria-label` where the label is an icon, `:focus-visible` reachable, and ≥ 24px hit targets under `@media (pointer: coarse)`.
- **Debug Mode is out of scope.** It keeps its own shell and its own Escape handler; Task 3 explicitly disables the global hotkeys while `debugMode` is true so the two never fight. Re-homing Debug Mode is Tranche 3.

**Deferred (named in the review, deliberately NOT here — do not flag as missing):** the `BLOCK_PALETTE` module and every block/category colour change (Tranche 3); toolbox integrity work — DS sub-drawers, the three missing Objects blocks, the five phantom registry entries, `check-block-registry.mjs` extensions (Tranche 3); connection type checks and orphan-block handling (Tranche 3); every debugger-truthfulness item — breakable-id publishing, pause acknowledgement, `describeRunError`, setup/constants instrumentation, "Next frame" stepping, the docked `.debug-drawer` (Tranche 3); `helpUrl` on blocks (Tranche 3); Blockly `componentStyles` read from live CSS tokens, `isDark`-at-inject and the 11 → 13 block font (all [Plan 3](2026-08-20-ide-modernization-03-deeper-mechanics.md)); the CSS `@import` split (Plan 3); **bundling Blockly (`blockly@11.2.2`, pinned) and vendoring GlowScript — both now product-owner-approved and landing as Plan 3 Tasks 1 and 2, NOT here**; self-hosting Inter/JetBrains Mono and vendoring Monaco (still open); `beginnerVisible`/`beginnerEnabled` (open question 6); the `WelcomeGate` spinner (**obsolete** — see stale citations below).

One forward-compatibility note: Task 8 interpolates `GLOWSCRIPT_VERSION` into the three versioned `glowscript.org` URLs. Plan 3 Task 2 replaces those URLs with local `frontend/public/vendor/glowscript/` paths — the exported constant survives that change and keeps feeding the status bar.

## Stale review citations corrected before use

The review is pinned to commit `10f8a9d`; four of its claims no longer hold on `feature/classroom-platform` at `771bc1e`. Each was checked against the live file:

1. **`e2e/*.png` are NOT checked in.** `.gitignore:23` contains `e2e/`, and `git ls-files e2e` returns **0 files**. The review's "45 checked-in PNGs" (and the 49 that exist locally today) are untracked build artifacts. Consequence: the promised "single screenshot-refresh commit" **has nothing to commit**. Task 17 therefore *regenerates and reviews* the artifacts as a verification gate and commits only code and docs. Second-order note: `frontend/scripts/e2e-test.mjs:22-24` resolves `E2E_DIR` to `frontend/e2e`, while the artifacts on disk live at the repo root `e2e/` — both paths are covered by the same ignore rule, so nothing leaks into git either way, but the script's output directory is not where the existing PNGs are.
2. **`WelcomeGate` no longer returns bare `null` during an IndexedDB read.** `frontend/src/welcome/WelcomeGate.js:17-35` is now fully synchronous (`localStorage` + `sessionStorage`, no await, "no flash" by construction). The "give `WelcomeGate` a centred brand spinner" item is obsolete and is dropped, not deferred. Its file does, however, carry a `React.createElement` workaround for exactly the vitest gap Task 1 fixes — Task 1 reverts it.
3. **`useProject.js:66-97`** (the 3s debounced autosave) is now at **`useProject.js:61-104`**; the file grew during Plan 4. The behaviour claim is still correct.
4. **`BeginnerGuide.js:6`** is `"Press ▶︎ Run in the toolbar…"`; the misdirecting *"Use the Variable blocks…"* tip is at **`BeginnerGuide.js:7`**. Task 11 fixes line 7 and replaces the `▶︎` character on line 6 with an icon-free wording (UI quality standard: no non-icon glyphs in product copy).

Everything else cited in this plan — `Toolbar.js:195/216/236-241/252/257-267/294-302/316-324/341/371`, `IDELayout.js:241-243/287-329/338-343/384-388/503`, `StartMenu.js:73-82/308/356-378/468-478/482-511`, `BlocklyWorkspace.js:80/204-209/297/328/355-361/430/445/502`, `DebugMode.js:164/177`, `useExport.js:110-135`, `useSplitPane.js:27-49`, `ChartOverlay.js:36-37/50/68/114-116`, `VariableDialog.js:69-70`, `TracePromoteDialog.js:58`, `HelpPage.js:488/1972/2222-2236`, `styles.css:16/233/270-281/304-318/615-635/638-659/892-894/907-936/938-952/1770-1781/2897/2910-2915`, `hooks/useLocalStorage.js:11` — was verified line-exact against the live files while writing this plan.

---

### Task 1: PREREQUISITE — fix the vitest JSX-in-`.js` transform gap

Component tests are impossible today: importing any `.js` file containing JSX from a test fails with *"Failed to parse source for import analysis… If you are using JSX, make sure to name the file with the .jsx or .tsx extension."* This blocks Task 2 and therefore the whole tranche.

**Root cause (diagnosed, not guessed).** The app's JSX-in-`.js` shim is `esbuild: { loader: "jsx", include: /src\/.*\.js$/ }` at `frontend/vite.config.mjs:22-26`. The frontend builds and dev-serves on **Vite 7.3.6** (esbuild-based), where that option is honoured. **Vitest 4.1.10 runs on its own bundled Vite 8.2.1**, which is oxc-based and prints, on every run:

```
Both esbuild and oxc options were set. oxc options will be used and esbuild options will be ignored.
```

`vite:oxc`'s default `exclude` is `/\.js$/`, so `.js` files are never transformed in tests, and `@vitejs/plugin-react` 5.2.0 does not run Babel in a non-refresh (SSR/test) environment, so nothing else picks up the slack. The fix is to mirror the shim in oxc terms, scoped to `mode === "test"` so the app build path is untouched.

**Files:**
- Modify: `frontend/vite.config.mjs`, `frontend/src/welcome/WelcomeGate.js`
- Create: `frontend/src/test/jsxProbe.js`, `frontend/src/test/__tests__/jsxTransform.test.js`

**Interfaces:**
- Produces: JSX inside any `frontend/src/**/*.js` is transformable by Vitest. `mode === "test"` gains `oxc: { include: /src\/.*\.js$/, exclude: [], lang: "jsx", jsx: { runtime: "automatic" } }`.
- **No new dependency.** (`@testing-library/react` is *not* required — Task 2 proves render-and-click works on React 18.3's own `act` export. If a later task genuinely needs it, that is a dependency decision for the controller, not a silent `npm i`.)

- [ ] **Step 1: Write the failing proof test**

Create `frontend/src/test/jsxProbe.js` — the smallest possible JSX-bearing `.js` module:

```js
/**
 * Transform probe: a JSX-bearing .js module that exists only so a test can
 * import it. If this file stops compiling under Vitest, the JSX-in-.js shim in
 * vite.config.mjs has regressed and every component test is about to break
 * with an opaque "invalid JS syntax" error. Keep it trivial.
 */
import React from "react";

export default function JsxProbe({ label = "probe" }) {
  return <button type="button" className="jsx-probe">{label}</button>;
}
```

Create `frontend/src/test/__tests__/jsxTransform.test.js`:

```js
import { describe, test, expect } from "vitest";
import JsxProbe from "../jsxProbe";

describe("vitest transforms JSX inside .js files", () => {
  test("a JSX-bearing .js module imports and returns a React element", () => {
    expect(typeof JsxProbe).toBe("function");
    const el = JsxProbe({ label: "hello" });
    expect(el.type).toBe("button");
    expect(el.props.className).toBe("jsx-probe");
    expect(el.props.children).toBe("hello");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm run test -w frontend
```

Expected: FAIL with `Plugin: vite:import-analysis` / *"content contains invalid JS syntax… make sure to name the file with the .jsx or .tsx extension"* pointing at `jsxProbe.js`. If it instead passes, the toolchain has already been fixed — stop and re-verify the Vite/Vitest versions before changing anything.

- [ ] **Step 3: Apply the config fix**

`frontend/vite.config.mjs` — convert to the function form so `mode` is available. Change line 4 from `export default defineConfig({` to:

```js
export default defineConfig(({ mode }) => ({
```

and the final line 47 from `});` to:

```js
}));
```

Then insert this block **immediately before** the existing `optimizeDeps` key (currently line 27), leaving the `esbuild` block at lines 22-26 exactly as it is:

```js
  // Vitest 4 does NOT run on the Vite above: it bundles its own Vite 8, which
  // is oxc-based and prints "Both esbuild and oxc options were set. oxc options
  // will be used and esbuild options will be ignored." vite:oxc defaults to
  // exclude: /\.js$/, and @vitejs/plugin-react skips Babel outside a refresh
  // environment — so JSX inside .js files fails to parse in tests while dev and
  // build stay fine. Mirror the shim in oxc terms, scoped to the test mode so
  // the app's esbuild path is untouched. Proof: src/test/__tests__/jsxTransform.test.js.
  ...(mode === "test"
    ? {
        oxc: {
          include: /src\/.*\.js$/,
          exclude: [],
          lang: "jsx",
          jsx: { runtime: "automatic" },
        },
      }
    : {}),
```

All four oxc keys are load-bearing and were determined empirically:
- `include` — without it, `.js` is excluded by default and nothing changes.
- `exclude: []` — clears the default `/\.js$/` exclusion, which otherwise wins over `include`.
- `lang: "jsx"` — without it oxc parses `.js` as plain JS and reports `PARSE_ERROR: Unexpected JSX expression … JSX syntax is disabled and should be enabled via the parser options`.
- `jsx: { runtime: "automatic" }` — the string form `"automatic"` is rejected with `BUNDLER_INITIALIZE_ERROR: Invalid jsx option`.

- [ ] **Step 4: Revert the WelcomeGate workaround**

`frontend/src/welcome/WelcomeGate.js:26-33` contains a `React.createElement` call written specifically around this gap. Replace lines 26-33 with:

```js
  if (shouldShowWelcome({ signedInHint, sessionPassed })) {
    return <Navigate to="/welcome" replace />;
  }
```

(The five-line comment explaining the workaround goes with it. `frontend/src/welcome/__tests__/welcomeGate.test.js` must stay green unchanged — it exercises `shouldShowWelcome`, and now also proves the component itself compiles under the new transform.)

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **14 test files / 153 tests**, all passing (13/152 baseline + this task's 1 file / 1 test). The build must still succeed and must **not** print the oxc warning — if it does, `mode` was not threaded correctly and the block is leaking into the build config.

- [ ] **Step 6: Commit**

```powershell
git add frontend/vite.config.mjs frontend/src/test frontend/src/welcome/WelcomeGate.js
git commit -m "fix(frontend): vitest transforms JSX in .js files — oxc shim for Vitest's bundled Vite 8"
```

---

### Task 2: Component-test harness + the Toolbar control-group suite

The safety net, landed **before** any restructure. `frontend/src/**/__tests__` contains only pure-util suites today, so a toolbar rewrite can break every control with CI green.

**Files:**
- Create: `frontend/src/test/renderHelpers.js`, `frontend/src/components/__tests__/Toolbar.test.js`
- Modify: `frontend/src/setupTests.js`

**Interfaces:**
- Produces: `mountComponent(ui)` → `{ container, rerender, unmount }`; `click(el)`; `byText(container, text, selector?)`; `byTitle(container, title)`. Built on `act` (exported by **react 18.3.1** itself) and `createRoot` from `react-dom/client` — **no `@testing-library/react`, no `react-dom/test-utils`, no new dependency**.
- `setupTests.js` gains a `window.matchMedia` stub (jsdom 25 does not implement it), required by Task 9's responsive hook and harmless before then.

- [ ] **Step 1: Add the matchMedia stub**

Append to `frontend/src/setupTests.js`:

```js
/**
 * jsdom does not implement matchMedia. The IDE's responsive toolbar collapse
 * reads it, so stub a never-matching, fully-shaped MediaQueryList. Tests that
 * care about a breakpoint override window.matchMedia themselves.
 */
if (typeof globalThis.matchMedia !== "function") {
  globalThis.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
```

- [ ] **Step 2: Create the harness**

Create `frontend/src/test/renderHelpers.js`:

```js
/**
 * Minimal render-and-click helpers for component tests.
 *
 * Deliberately dependency-free: React 18.3 exports `act` from the "react"
 * package itself and `react-dom/client` provides createRoot, so component
 * tests need no @testing-library/react and no react-dom/test-utils. Keep it
 * that way — a testing library is a dependency decision, not a convenience.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";

/** Mount `ui` into a detached container. Always call unmount() in afterEach. */
export function mountComponent(ui) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Dispatch a bubbling click inside act() so React state settles. */
export function click(el) {
  if (!el) throw new Error("click(): element not found");
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Dispatch a bubbling keydown inside act(). */
export function keyDown(el, init) {
  act(() => {
    (el || window).dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
  });
}

/** Find an element by its exact whitespace-collapsed text. */
export function byText(container, text, selector = "button") {
  return (
    [...container.querySelectorAll(selector)].find(
      (el) => el.textContent.replace(/\s+/g, " ").trim() === text,
    ) || null
  );
}

/** Find an element by its title attribute (the IDE labels most icon buttons this way). */
export function byTitle(container, title) {
  return container.querySelector(`[title="${title}"]`);
}
```

- [ ] **Step 3: Write the Toolbar suite — one describe per control group**

Create `frontend/src/components/__tests__/Toolbar.test.js`. This is a *characterisation* suite: it pins today's behaviour so Tasks 7 and 9 cannot silently drop a control.

```js
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import Toolbar from "../Toolbar";
import { mountComponent, click, byText, byTitle } from "../../test/renderHelpers";

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** Every handler the Toolbar can call, so "was it wired?" is one assertion. */
function handlers() {
  return {
    onRun: vi.fn(),
    onStop: vi.fn(),
    onHome: vi.fn(),
    onHelp: vi.fn(),
    onReset: vi.fn(),
    onClearWorkspace: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleViewport: vi.fn(),
    onDebugMode: vi.fn(),
    onImport: vi.fn(),
    onImportProject: vi.fn(),
    onExportPy: vi.fn(),
    onExportBlocks: vi.fn(),
    onExportBlocksPdf: vi.fn(),
    onExportCodePdf: vi.fn(),
    onExportScreenshot: vi.fn(),
    onExportProject: vi.fn(),
    onCopyCode: vi.fn(),
    onZoomChange: vi.fn(),
  };
}

function render(props = {}) {
  const h = handlers();
  mounted = mountComponent(
    <Toolbar goal="physics" mode="blocks" running={false} isDark zoom={90} {...h} {...props} />,
  );
  return { ...mounted, h };
}

describe("Toolbar — navigation group", () => {
  test("Menu and Help are present and wired", () => {
    const { container, h } = render();
    click(byText(container, "Menu"));
    click(byText(container, "Help"));
    expect(h.onHome).toHaveBeenCalledTimes(1);
    expect(h.onHelp).toHaveBeenCalledTimes(1);
  });
});

describe("Toolbar — simulation group", () => {
  test("Run fires onRun; Stop is disabled while idle", () => {
    const { container, h } = render();
    click(byText(container, "Run"));
    expect(h.onRun).toHaveBeenCalledTimes(1);
    expect(byText(container, "Stop").disabled).toBe(true);
  });

  test("Stop is enabled and wired while running", () => {
    const { container, h } = render({ running: true });
    const stop = byText(container, "Stop");
    expect(stop.disabled).toBe(false);
    click(stop);
    expect(h.onStop).toHaveBeenCalledTimes(1);
  });

  test("a data-science project shows no simulation controls", () => {
    const { container } = render({ goal: "datascience" });
    expect(byText(container, "Run")).toBeNull();
    expect(byText(container, "Stop")).toBeNull();
    expect(byText(container, "Debug")).toBeNull();
  });
});

describe("Toolbar — workspace group", () => {
  test("Reset is always present; Clear only in blocks mode", () => {
    const { container, h } = render();
    click(byText(container, "Reset"));
    expect(h.onReset).toHaveBeenCalledTimes(1);
    click(byText(container, "Clear"));
    expect(h.onClearWorkspace).toHaveBeenCalledTimes(1);

    mounted.unmount();
    mounted = null;
    const code = render({ mode: "text" });
    expect(byText(code.container, "Clear")).toBeNull();
  });
});

describe("Toolbar — view group", () => {
  test("zoom buttons step by 10 and clamp", () => {
    const { container, h } = render({ zoom: 90 });
    click(byTitle(container, "Zoom in"));
    expect(h.onZoomChange).toHaveBeenLastCalledWith(100);
    click(byTitle(container, "Zoom out"));
    expect(h.onZoomChange).toHaveBeenLastCalledWith(80);
  });

  test("the zoom slider is absent in code mode", () => {
    const { container } = render({ mode: "text" });
    expect(container.querySelector(".tb-zoom")).toBeNull();
  });

  test("viewport and debug toggles are wired", () => {
    const { container, h } = render();
    click(byTitle(container, "Hide 3D viewport"));
    expect(h.onToggleViewport).toHaveBeenCalledTimes(1);
    click(byTitle(container, "Open Debug Mode — step-through, breakpoints, recording"));
    expect(h.onDebugMode).toHaveBeenCalledTimes(1);
  });
});

describe("Toolbar — file group", () => {
  test("both import controls render distinct hidden file inputs", () => {
    const { container } = render();
    const accepts = [...container.querySelectorAll('input[type="file"]')].map((i) => i.accept);
    expect(accepts).toEqual([".py,.xml", ".json,.physide.json"]);
  });

  test("the export dropdown opens and every item is wired", () => {
    const { container, h } = render();
    expect(container.querySelector(".tb-dropdown-menu")).toBeNull();
    click(container.querySelector(".tb-btn--dropdown"));
    const menu = container.querySelector(".tb-dropdown-menu");
    expect(menu).not.toBeNull();

    const items = [...menu.querySelectorAll(".tb-dropdown-item")];
    expect(items).toHaveLength(7);
    click(items[0]);
    expect(h.onExportPy).toHaveBeenCalledTimes(1);
    // The menu closes on selection — reopen for the next assertion.
    click(container.querySelector(".tb-btn--dropdown"));
    click([...container.querySelectorAll(".tb-dropdown-item")][6]);
    expect(h.onExportProject).toHaveBeenCalledTimes(1);
  });
});

describe("Toolbar — theme toggle", () => {
  test("the label follows the current theme and the handler fires", () => {
    const { container, h } = render({ isDark: true });
    click(byTitle(container, "Switch to light mode"));
    expect(h.onToggleTheme).toHaveBeenCalledTimes(1);
    mounted.rerender(<Toolbar goal="physics" mode="blocks" isDark={false} onToggleTheme={h.onToggleTheme} />);
    expect(byTitle(container, "Switch to dark mode")).not.toBeNull();
  });
});
```

- [ ] **Step 4: Fix the one bug this suite exposes**

`Toolbar.js:252` is a no-op ternary — `{viewportHidden ? "Viewport" : "Viewport"}` — so the button label never changes even though its `title` does (`:249`). Replace line 252 with:

```jsx
          <span className="tb-btn-label">{viewportHidden ? "Show" : "Hide"}</span>
```

and add to the `view group` describe:

```js
  test("the viewport toggle label reflects state", () => {
    const { container } = render({ viewportHidden: true });
    expect(byTitle(container, "Show 3D viewport").textContent).toContain("Show");
  });
```

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **15 files / 166 tests** (13 new Toolbar tests), all green.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/test frontend/src/setupTests.js frontend/src/components/__tests__ frontend/src/components/Toolbar.js
git commit -m "test(frontend): render-and-click harness + Toolbar control-group suite; fix no-op viewport label"
```

---

### Task 3: `useHotkeys` — Ctrl/Cmd+Enter, F5, Escape, and Ctrl/Cmd+S = Save

Every shortcut the IDE advertises is fiction today: `Toolbar.js:195` promises Ctrl+Enter, `:341` promises Ctrl+S, `:371` promises Ctrl+C, `HelpPage.js:488` and `:1972` repeat them — while the only `keydown` listeners in the repo are `DebugMode.js:177` and `HelpPage.js:241`. Ctrl+S currently triggers the browser's Save Page dialog.

**Decision recorded here:** the review also proposed `Ctrl/Cmd+Shift+C` for "copy code". That chord is claimed by Chrome's DevTools inspector and cannot be reliably prevented, and the advertised plain `Ctrl+C` would break ordinary text copying. **The copy-code shortcut is removed from the product rather than implemented** — the Export dropdown's Copy item stays, its `Ctrl+C` chip goes, and Help and README are corrected. This closes the "advertised features that do not work" gap in the honest direction.

**Files:**
- Create: `frontend/src/utils/hotkeys.js`, `frontend/src/utils/__tests__/hotkeys.test.js`, `frontend/src/hooks/useHotkeys.js`
- Modify: `frontend/src/components/layout/IDELayout.js`, `frontend/src/components/Toolbar.js`, `frontend/src/components/HelpPage.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `matchHotkey(e)` → `"run" | "save" | "stop" | null`; `isTypingTarget(el)` → boolean; `MOD_LABEL` (`"⌘"` on Apple platforms, `"Ctrl"` elsewhere); `useHotkeys({ enabled, onRun, onStop, onSave })`.
- Consumes: `useProject().saveCurrent` (already exported, `useProject.js:214`), `useSimulation().handleRun` / `.handleStop`, `useSimulationContext().setStatus`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/__tests__/hotkeys.test.js`:

```js
import { describe, test, expect } from "vitest";
import { matchHotkey, isTypingTarget } from "../hotkeys";

const ev = (over) => ({
  key: "", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over,
});

describe("matchHotkey", () => {
  test("Ctrl+Enter and Cmd+Enter run", () => {
    expect(matchHotkey(ev({ key: "Enter", ctrlKey: true }))).toBe("run");
    expect(matchHotkey(ev({ key: "Enter", metaKey: true }))).toBe("run");
  });

  test("F5 runs, but only unmodified", () => {
    expect(matchHotkey(ev({ key: "F5" }))).toBe("run");
    expect(matchHotkey(ev({ key: "F5", ctrlKey: true }))).toBeNull();
    expect(matchHotkey(ev({ key: "F5", shiftKey: true }))).toBeNull();
  });

  test("Ctrl+S and Cmd+S save, in either letter case", () => {
    expect(matchHotkey(ev({ key: "s", ctrlKey: true }))).toBe("save");
    expect(matchHotkey(ev({ key: "S", metaKey: true }))).toBe("save");
  });

  test("Ctrl+Shift+S is not save (leave Save As to the browser)", () => {
    expect(matchHotkey(ev({ key: "s", ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  test("bare Escape stops", () => {
    expect(matchHotkey(ev({ key: "Escape" }))).toBe("stop");
    expect(matchHotkey(ev({ key: "Escape", ctrlKey: true }))).toBeNull();
  });

  test("ordinary typing matches nothing", () => {
    for (const key of ["a", "s", "Enter", "Tab", " "]) {
      expect(matchHotkey(ev({ key }))).toBeNull();
    }
  });
});

describe("isTypingTarget", () => {
  test("text-entry elements and Monaco count as typing surfaces", () => {
    const host = document.createElement("div");
    host.innerHTML =
      '<input id="i"><textarea id="t"></textarea><div id="c" contenteditable="true"></div>' +
      '<div class="monaco-host"><span id="m"></span></div><div id="plain"></div>';
    document.body.appendChild(host);
    for (const id of ["i", "t", "c", "m"]) {
      expect(isTypingTarget(host.querySelector(`#${id}`))).toBe(true);
    }
    expect(isTypingTarget(host.querySelector("#plain"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    host.remove();
  });
});
```

- [ ] **Step 2: Implement the pure helper**

Create `frontend/src/utils/hotkeys.js`:

```js
/**
 * Global IDE hotkeys — pure matching, no DOM listeners and no React, so the
 * whole decision table is unit-testable.
 *
 * Deliberately small. Ctrl/Cmd+C is NOT bound: plain Ctrl+C must keep copying
 * selected text, and Ctrl+Shift+C is claimed by Chrome's element inspector.
 * The Export dropdown's "Copy Code to Clipboard" remains the only copy path.
 */

/** @returns {"run"|"save"|"stop"|null} */
export function matchHotkey(e) {
  const mod = Boolean(e.ctrlKey || e.metaKey);
  const plainMod = mod && !e.shiftKey && !e.altKey;
  const bare = !mod && !e.shiftKey && !e.altKey;

  if (plainMod && e.key === "Enter") return "run";
  if (bare && e.key === "F5") return "run";
  if (plainMod && (e.key === "s" || e.key === "S")) return "save";
  if (bare && e.key === "Escape") return "stop";
  return null;
}

/**
 * True when the event target is a text-entry surface. Bare keys (Escape, F5)
 * must not fire while a student is typing; modifier chords may, because
 * Ctrl+S inside the code editor should still save the project.
 */
export function isTypingTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], .monaco-host'),
  );
}

/** Modifier name for UI copy. Not a hotkey concern, but the one place both agree. */
export const MOD_LABEL =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "")
    ? "⌘"
    : "Ctrl";
```

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/useHotkeys.js`:

```js
/**
 * Binds the global IDE hotkeys to a single window listener.
 *
 * `enabled` is false whenever another surface owns the keyboard — the start
 * menu, Help, Debug Mode (which has its own Space/F10/Escape handler at
 * DebugMode.js:162-179) or any open dialog — so the two never fight over Escape.
 */
import { useEffect, useRef } from "react";
import { matchHotkey, isTypingTarget } from "../utils/hotkeys";

export function useHotkeys({ enabled = true, onRun, onStop, onSave }) {
  const handlersRef = useRef(null);
  handlersRef.current = { run: onRun, stop: onStop, save: onSave };

  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      const action = matchHotkey(e);
      if (!action) return;
      const bare = !(e.ctrlKey || e.metaKey);
      if (bare && isTypingTarget(e.target)) return;
      const fn = handlersRef.current[action];
      if (typeof fn !== "function") return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
```

- [ ] **Step 4: Wire it into IDELayout**

In `frontend/src/components/layout/IDELayout.js`:

1. Add `import { useHotkeys } from "../../hooks/useHotkeys";` beside the other hook imports (after line 56).
2. Add `setStatus,` to the `useSimulationContext()` destructure (the block at lines 63-70 already pulls `status`).
3. Insert immediately after the `pendingBufferRef` declaration (line 169), so every guard value is already in scope:

```js
  /* ── Global hotkeys ────────────────────────────────────────
     Disabled whenever another surface owns the keyboard: the start menu,
     Help, Debug Mode (its own handler lives at DebugMode.js:162-179), the
     trace-promote dialog and the chart overlay. */
  const handleSaveProject = useCallback(async () => {
    try {
      const saved = await proj.saveCurrent();
      setStatus(
        saved
          ? { text: `Saved “${saved.title}”`, type: "success" }
          : { text: "Nothing to save yet", type: "" },
      );
    } catch (err) {
      console.warn("Save failed:", err);
      setStatus({ text: "Could not save — your work is still on this computer", type: "error" });
    }
  }, [proj, setStatus]);

  useHotkeys({
    enabled: !showStart && !showHelp && !dbg.debugMode && !showTraceDialog && !chartDataset,
    onRun: sim.handleRun,
    onStop: sim.running ? sim.handleStop : undefined,
    onSave: handleSaveProject,
  });
```

(`handleSaveProject` is also the handler the header's Save button uses in Task 7 — it is defined here once.)

- [ ] **Step 5: Tell the truth in the UI**

`frontend/src/components/Toolbar.js`:

- Line 195 — put the promise next to the control, as a real chip. Replace the Run button's children with:

```jsx
              <PlayIcon size={13} />
              <span className="tb-btn-label">Run</span>
              <kbd className="tb-kbd">{MOD_LABEL}+Enter</kbd>
```

and add `import { MOD_LABEL } from "../utils/hotkeys";` at the top.

- Line 341 — delete the now-false chip on "Export as Python (.py)":

```jsx
        <button type="button" className="tb-dropdown-item" onClick={onExportPy}>
          <FileCodeIcon size={14} />
          <span>Export as Python (.py)</span>
        </button>
```

- Line 371 — delete the `Ctrl+C` chip on "Copy Code to Clipboard" the same way, leaving the icon and label.

`frontend/src/styles.css` — add beside `.tb-btn-label` (after line 332):

```css
/* Shortcut chip shown inline on a toolbar action */
.tb-kbd {
  font-family: var(--mono);
  font-size: var(--fs-2xs, 10px);
  line-height: 1;
  padding: 2px 4px;
  margin-left: 2px;
  color: var(--text-muted);
  background: var(--key-bg);
  border: 1px solid var(--key-border);
  border-radius: var(--radius-sm, 3px);
}
.tb-btn:hover .tb-kbd { color: var(--text-dim); }
```

- [ ] **Step 6: Correct the documentation**

`frontend/src/components/HelpPage.js`:

- Lines 1971-1974 → the Export intro no longer claims keyboard access:

```jsx
              <p>
                Physics IDE provides seven export options, all accessible from the{" "}
                <strong>Export</strong> dropdown in the toolbar. Saving your project is
                separate — <Kbd>Ctrl+S</Kbd> saves, it does not export.
              </p>
```

- Line 149 (the search-index `content` string for the shortcuts section) — replace `"keyboard shortcuts Ctrl+Z undo Ctrl+Y redo Ctrl+A select all Delete Backspace Escape close help run stop space Enter debug F10"` with:

```js
    content: "keyboard shortcuts Ctrl+Enter run F5 run Escape stop Ctrl+S save Ctrl+Z undo Ctrl+Y redo Ctrl+A select all Delete Backspace Escape close help space Enter debug F10",
```

- Lines 2221-2222 — insert the four Global rows that are now true, immediately after `<tbody>` and before the existing `Close Help page` row:

```jsx
                  <tr><td>Global</td><td><Kbd>Ctrl+Enter</Kbd></td><td>Run the simulation</td></tr>
                  <tr><td>Global</td><td><Kbd>F5</Kbd></td><td>Run the simulation</td></tr>
                  <tr><td>Global</td><td><Kbd>Esc</Kbd></td><td>Stop the simulation</td></tr>
                  <tr><td>Global</td><td><Kbd>Ctrl+S</Kbd></td><td>Save the project</td></tr>
```

- Line 2227 — the block-canvas row `<Kbd>Ctrl+C</Kbd> / <Kbd>Ctrl+V</Kbd> — Copy / paste block` stays: that is Blockly's own binding on a selected block and is genuinely true.

(README §8 is corrected in Task 17 alongside the rest of the docs sweep.)

- [ ] **Step 7: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **16 files / 175 tests** green. Then a manual pass with `npm run dev`: open a project, press Ctrl+Enter (runs), Escape (stops), Ctrl+S (status bar reads `Saved “<title>”`, **no browser Save-Page dialog**), F5 (runs, page does not reload). In the code editor, type `s` freely, then Ctrl+S — it must still save. Open Help and press Escape — Help closes and the simulation is untouched.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/utils/hotkeys.js frontend/src/utils/__tests__/hotkeys.test.js frontend/src/hooks/useHotkeys.js frontend/src/components/layout/IDELayout.js frontend/src/components/Toolbar.js frontend/src/components/HelpPage.js frontend/src/styles.css
git commit -m "feat(frontend): real keyboard shortcuts — Ctrl+Enter/F5 run, Esc stop, Ctrl+S saves (not exports)"
```

---

### Task 4: Layout persistence and last-project restore

`splitPct`, `viewportHidden` and `blocklyZoom` are plain `useState` (`SimulationContext.js:43-45`), `showStart` is hardcoded `true` (`:28`), and `hooks/useLocalStorage.js:11` — written for exactly this — is imported nowhere. In a lab where students reload after a hiccup, they re-arrange the same layout several times per lesson and land back on the start menu every time.

**Files:**
- Create: `frontend/src/utils/__tests__/layoutPrefs.test.js`, `frontend/src/utils/layoutPrefs.js`
- Modify: `frontend/src/constants/index.js`, `frontend/src/contexts/SimulationContext.js`, `frontend/src/contexts/ProjectContext.js`, `frontend/src/hooks/useProject.js`, `frontend/src/components/layout/IDELayout.js`

**Interfaces:**
- Produces: `clampSplit(v)`, `clampZoom(v)` (defensive readers for persisted values); constants `LAYOUT_SPLIT_KEY`, `LAYOUT_VIEWPORT_HIDDEN_KEY`, `LAYOUT_ZOOM_KEY`, `LAST_PROJECT_KEY`; `ProjectContext` restores the last-opened project during bootstrap; `useProject()` gains `closeProject`.
- Consumes: `hooks/useLocalStorage.js` unchanged.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/__tests__/layoutPrefs.test.js`:

```js
import { describe, test, expect } from "vitest";
import { clampSplit, clampZoom } from "../layoutPrefs";
import { SPLIT_DEFAULT, SPLIT_MIN, SPLIT_MAX, ZOOM_DEFAULT, ZOOM_MIN, ZOOM_MAX } from "../../constants";

describe("persisted layout values are defended on read", () => {
  test("clampSplit keeps sane values and repairs the rest", () => {
    expect(clampSplit(42)).toBe(42);
    expect(clampSplit(SPLIT_MIN - 10)).toBe(SPLIT_MIN);
    expect(clampSplit(SPLIT_MAX + 10)).toBe(SPLIT_MAX);
    for (const junk of [null, undefined, NaN, "wide", {}, Infinity]) {
      expect(clampSplit(junk)).toBe(SPLIT_DEFAULT);
    }
  });

  test("clampZoom keeps sane values and repairs the rest", () => {
    expect(clampZoom(120)).toBe(120);
    expect(clampZoom(ZOOM_MIN - 5)).toBe(ZOOM_MIN);
    expect(clampZoom(ZOOM_MAX + 5)).toBe(ZOOM_MAX);
    expect(clampZoom("90%")).toBe(ZOOM_DEFAULT);
  });
});
```

- [ ] **Step 2: Implement**

Create `frontend/src/utils/layoutPrefs.js`:

```js
/**
 * Defensive readers for layout preferences restored from localStorage.
 *
 * A hand-edited or half-written value must never wedge the IDE at a 0% split
 * or a 5000% zoom, so every persisted number goes through here on read.
 */
import { SPLIT_DEFAULT, SPLIT_MIN, SPLIT_MAX, ZOOM_DEFAULT, ZOOM_MIN, ZOOM_MAX } from "../constants";

function clamp(value, min, max, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampSplit(value) {
  return clamp(value, SPLIT_MIN, SPLIT_MAX, SPLIT_DEFAULT);
}

export function clampZoom(value) {
  return clamp(value, ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT);
}
```

Append to `frontend/src/constants/index.js`, under the Storage keys block (after line 9):

```js
/* Layout preferences — restored on reload so a lab machine keeps its arrangement. */
export const LAYOUT_SPLIT_KEY           = "pide_layout_split";
export const LAYOUT_VIEWPORT_HIDDEN_KEY = "pide_layout_viewport_hidden";
export const LAYOUT_ZOOM_KEY            = "pide_layout_zoom";
/* Id of the last project the student had open, so a reload returns them to it. */
export const LAST_PROJECT_KEY           = "pide_last_project";
```

- [ ] **Step 3: Back the three UI preferences with localStorage**

In `frontend/src/contexts/SimulationContext.js`, add the imports:

```js
import useLocalStorage from "../hooks/useLocalStorage";
import { clampSplit, clampZoom } from "../utils/layoutPrefs";
import {
  LAYOUT_SPLIT_KEY, LAYOUT_VIEWPORT_HIDDEN_KEY, LAYOUT_ZOOM_KEY,
} from "../constants";
```

and replace lines 42-45 (the `UI preferences` block) with:

```js
  /* ── UI preferences (persisted — hooks/useLocalStorage) ── */
  const [storedZoom,   setBlocklyZoom]    = useLocalStorage(LAYOUT_ZOOM_KEY, ZOOM_DEFAULT);
  const [storedSplit,  setSplitPct]       = useLocalStorage(LAYOUT_SPLIT_KEY, SPLIT_DEFAULT);
  const [viewportHidden, setViewportHidden] = useLocalStorage(LAYOUT_VIEWPORT_HIDDEN_KEY, false);
  const blocklyZoom = clampZoom(storedZoom);
  const splitPct    = clampSplit(storedSplit);
```

Nothing else changes: `useLocalStorage`'s setter has the same `(value | updater)` signature as `useState`'s, so `setViewportHidden((h) => !h)` at `useSimulation.js:292` and `setSplitPct(pct)` at `useSplitPane.js:35` keep working untouched.

- [ ] **Step 4: Restore the last-opened project**

In `frontend/src/contexts/ProjectContext.js`:

1. Extend the constants import at line 30 to `import { SIGNED_IN_HINT_KEY, LAST_PROJECT_KEY } from "../constants";`.
2. In the bootstrap's `else` branch (lines 77-80), replace the two statements with:

```js
        } else {
          setProjectList(list);
          /* Reopen whatever was open last, if it still exists. Guarded on the
             list we just read, so a deleted or cloud-tombstoned project can
             never resurrect itself — and only reached when the list is
             non-empty, so it cannot race the legacy-v1 resurrection above. */
          let restoredId = null;
          try {
            restoredId = localStorage.getItem(LAST_PROJECT_KEY);
          } catch {
            // Storage blocked — start at the menu.
          }
          if (restoredId && list.some((p) => p.id === restoredId)) {
            const restored = await loadProject(restoredId);
            if (cancelled) return;
            if (restored) {
              setActiveProjectId(restored.id);
              setActiveManifest(restored);
            }
          }
          setBootstrapResult({ kind: "existing", count: list.length });
        }
```

3. Record and clear the key alongside the existing state transitions. In `openProject` (lines 121-130), after `setActiveManifest(m);`:

```js
      try { localStorage.setItem(LAST_PROJECT_KEY, m.id); } catch { /* storage blocked */ }
```

In `closeProject` (lines 132-135) and in `removeProject`'s active-project branch (lines 150-153), after clearing the state:

```js
      try { localStorage.removeItem(LAST_PROJECT_KEY); } catch { /* storage blocked */ }
```

Also add the same `removeItem` to the `onProjectDeleted` subscriber (lines 100-104) so a remote tombstone clears the pointer too.

- [ ] **Step 5: Skip the start menu when a project was restored**

In `frontend/src/hooks/useProject.js`, add beside the existing migrated-project effect (lines 177-187):

```js
  /* A bootstrap-restored project should open straight into the IDE — the
     start menu is for choosing, not for re-choosing what was already open.
     Runs at most once, after the bootstrap settles. */
  const restoreAppliedRef = useRef(false);
  useEffect(() => {
    if (!proj.loaded || restoreAppliedRef.current) return;
    if (proj.bootstrapResult?.kind !== "existing") return;
    const m = proj.activeManifest;
    if (!m) return;
    restoreAppliedRef.current = true;
    applyManifestToWorkingState(m);
    sim.setShowStart(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj.loaded, proj.bootstrapResult, proj.activeManifest]);
```

and expose `closeProject` from the hook's return object (after `removeProject`, line 215):

```js
    closeProject: proj.closeProject,
```

- [ ] **Step 6: "Menu" means "I want the menu"**

In `frontend/src/components/layout/IDELayout.js`, add beside `handleHelp` (line 83):

```js
  const handleGoHome = useCallback(() => {
    sim.handleHome();
    proj.closeProject();
  }, [sim, proj]);
```

and change the Toolbar's `onHome={sim.handleHome}` (line 361) to `onHome={handleGoHome}`. Without this, a student who deliberately returns to the menu is bounced back into the project on the next reload.

- [ ] **Step 7: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **17 files / 177 tests** green. Then manually: drag the divider to ~30%, hide the viewport, zoom to 120%, reload — all three survive. Open a project, reload — the IDE reopens it directly. Click **Menu**, reload — the start menu is shown. Run `localStorage.setItem("pide_layout_split", "999")` in the console and reload — the split falls back to a sane value instead of collapsing.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/utils/layoutPrefs.js frontend/src/utils/__tests__/layoutPrefs.test.js frontend/src/constants/index.js frontend/src/contexts frontend/src/hooks/useProject.js frontend/src/components/layout/IDELayout.js
git commit -m "feat(frontend): layout and last-project persistence — split, viewport, zoom and the open project survive a reload"
```

---

### Task 5: Pointer events on all three drag handles + coarse-pointer targets

`useSplitPane.js:27-49` and `DebugMode.js:79,101` register mouse events only, so **panes cannot be resized at all on a tablet**. `.tb-btn` (`styles.css:304-318`) yields roughly 20px targets.

**Ruling applied:** "does not break on a tablet", not full touch support. Pointer Events plus a ≥ 24px coarse-pointer bump. No gestures.

**Files:**
- Modify: `frontend/src/hooks/useSplitPane.js`, `frontend/src/components/DebugMode.js`, `frontend/src/components/layout/IDELayout.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `useSplitPane()` returns `handleDividerPointerDown` (the old `handleDividerMouseDown` name is retired — there is exactly one caller, `IDELayout.js:442`). Divider elements gain `role="separator"`, `aria-orientation="vertical"`, `tabIndex={0}` and arrow-key resize.

- [ ] **Step 1: Convert the main split divider**

Replace `frontend/src/hooks/useSplitPane.js` lines 26-53 with:

```js
  /* ── Pointer-drag resize ──────────────────────────────────
     Pointer Events (not mouse events) so a stylus or finger can resize the
     panes on a tablet; setPointerCapture keeps the drag alive when the
     pointer leaves the 5px handle. */
  const handleDividerPointerDown = useCallback(
    (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      const container = handle.parentElement; // .main-layout flex row
      try { handle.setPointerCapture(e.pointerId); } catch { /* not capturable */ }

      const onMove = (ev) => {
        const rect = container.getBoundingClientRect();
        setSplitPct(
          Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ((ev.clientX - rect.left) / rect.width) * 100)),
        );
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [setSplitPct],
  );

  /* Keyboard resize — the divider is a real focusable separator. */
  const handleDividerKeyDown = useCallback(
    (e) => {
      const step = e.shiftKey ? 10 : 2;
      if (e.key === "ArrowLeft")  { e.preventDefault(); setSplitPct((p) => Math.max(SPLIT_MIN, p - step)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setSplitPct((p) => Math.min(SPLIT_MAX, p + step)); }
      if (e.key === "Home")       { e.preventDefault(); setSplitPct(SPLIT_DEFAULT); }
    },
    [setSplitPct],
  );

  return { splitPct, handleDividerPointerDown, handleDividerKeyDown };
}
```

and extend the imports at the top of the file:

```js
import { SPLIT_MIN, SPLIT_MAX, SPLIT_DEFAULT } from "../constants";
```

- [ ] **Step 2: Update the one caller**

`frontend/src/components/layout/IDELayout.js` line 80 → `const { splitPct, handleDividerPointerDown, handleDividerKeyDown } = useSplitPane();`

and lines 441-443 → a divider that is reachable by keyboard and finger:

```jsx
        {!viewportHidden && (
          <div
            className="pane-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and viewport"
            aria-valuenow={Math.round(splitPct)}
            aria-valuemin={SPLIT_MIN}
            aria-valuemax={SPLIT_MAX}
            tabIndex={0}
            onPointerDown={handleDividerPointerDown}
            onKeyDown={handleDividerKeyDown}
          />
        )}
```

with `import { SPLIT_MIN, SPLIT_MAX } from "../../constants";` added to the import block.

- [ ] **Step 3: Convert Debug Mode's two handles**

`frontend/src/components/DebugMode.js` lines 79-120 hold two mouse-only column-resize handlers. Convert both to the identical pattern — for each handler:

- rename `onMouseDown` → `onPointerDown` on the JSX element and add `role="separator" aria-orientation="vertical" tabIndex={0}`;
- inside, replace the `document.addEventListener("mousemove"/"mouseup", …)` pair with `e.currentTarget.addEventListener("pointermove"/"pointerup"/"pointercancel", …)` plus `setPointerCapture(e.pointerId)` / `releasePointerCapture(e.pointerId)` in `try/catch`, exactly as in Step 1;
- keep every existing percentage clamp and `setState` call unchanged.

Do not restructure `DebugMode` beyond this — Debug Mode is Tranche 3.

- [ ] **Step 4: Coarse-pointer target bump**

Append to `frontend/src/styles.css`, immediately before the `RESPONSIVE` banner at line 2907:

```css
/* ═══════════════════════════════════════════════════════════
   COARSE POINTER — "does not break on a tablet".
   Not full touch support: no gestures, no touch-specific UI. Just targets
   a finger can actually hit and dividers a finger can actually grab.
   ═══════════════════════════════════════════════════════════ */
@media (pointer: coarse) {
  .tb-btn        { padding: 8px 10px; min-height: 32px; }
  .tb-btn--icon  { padding: 8px; min-width: 32px; }
  .tb-dropdown-item { padding: 10px 12px; min-height: 36px; }

  .pane-divider,
  .dm-col-divider {
    width: 12px;
    min-width: 12px;
  }
  .pane-divider::before { left: -6px; right: -6px; }

  .mode-toggle button    { min-height: 32px; }
  .block-search-input    { min-height: 32px; }
  .start-project-delete  { min-width: 28px; min-height: 28px; }
}

/* The dividers are focusable separators now. Plan 1's global :focus-visible
   ring uses outline-offset, which on a 5px handle draws outside the hit area —
   pull it inside for these two, using the same tokens. */
.pane-divider:focus-visible,
.dm-col-divider:focus-visible {
  outline: var(--focus-ring-width, 2px) solid var(--focus-ring-color, var(--accent-bright));
  outline-offset: calc(-1 * var(--focus-ring-width, 2px));
}
```

(If Debug Mode's handles carry a different class name than `.dm-col-divider`, use the actual class from `DebugMode.js` — grep the file for the two handle elements and match them exactly.)

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **17 files / 177 tests** green (no new tests: this is DOM plumbing that the harness cannot meaningfully assert without a pointer simulation). Then manually, in Chrome DevTools device emulation (iPad, touch input): drag the main divider — it moves; enter Debug Mode and drag both column handles — they move. With a mouse: Tab to the divider, press Left/Right (2% per press), Shift+Left/Right (10%), Home (back to 50%). Confirm the focus ring is visible.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/hooks/useSplitPane.js frontend/src/components/DebugMode.js frontend/src/components/layout/IDELayout.js frontend/src/styles.css
git commit -m "feat(frontend): pointer-event drag handles with keyboard resize; coarse-pointer target sizes"
```

---

### Task 6: The split becomes a CSS custom property; the stacking breakpoint actually works

`IDELayout.js:384-388` writes the split as an inline `flex`/`maxWidth`, which outranks `styles.css:2910-2915`. The one stacking breakpoint is defeated by its own component: after `flex-direction` flips to `column`, the editor pane keeps its 50% **width**. There is no breakpoint at all for the platform screens, and `.admin-table` (`styles.css:4318`) is `width: 100%` with no scroll container, so a narrow viewport scrolls the whole page sideways.

**Files:**
- Modify: `frontend/src/components/layout/IDELayout.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `.main-layout` carries `style={{ "--split": ... }}`; `.editor-pane` sizes itself from `var(--split)`; the 800px breakpoint sets `--split: auto` and switches the divider to `row-resize`; a new `@media (max-width: 1024px)` block covers the platform screens (the stated minimum viewport).

- [ ] **Step 1: Move the split into a custom property**

In `frontend/src/components/layout/IDELayout.js`, change the `.main-layout` element (line 380) to carry the variable:

```jsx
      <div className="main-layout" style={{ "--split": `${splitPct}%` }}>
```

and replace the `<section className="editor-pane" style={…}>` block (lines 382-389) with:

```jsx
        <section className={`editor-pane${viewportHidden ? " editor-pane--full" : ""}`}>
```

Apply the same treatment to the three `canvas-pane` sections (lines 446-449, 460-464, 483-486): drop the inline `style` object and express the two states in CSS instead —

```jsx
          <section className={`canvas-pane${viewportHidden ? " canvas-pane--hidden" : ""}`}>
```

(keeping `canvas-pane--hybrid` on the hybrid branch: `className={`canvas-pane canvas-pane--hybrid${viewportHidden ? " canvas-pane--hidden" : ""}`}`).

- [ ] **Step 2: Express the layout in CSS**

Replace `frontend/src/styles.css` lines 597-612 (`.editor-pane` and `.canvas-pane`) with:

```css
.editor-pane {
  /* --split is written by IDELayout; the media query below can override it,
     which an inline style could not. */
  flex: 0 0 var(--split, 50%);
  max-width: var(--split, 50%);
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
}
.editor-pane--full {
  flex: 1 1 auto;
  max-width: 100%;
  border-right: none;
}
.canvas-pane {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--canvas-bg);
}
.canvas-pane--hidden { display: none; }
```

and replace the stacking rules at lines 2911-2916 with a version that actually stacks:

```css
@media (max-width: 800px) {
  .main-layout { flex-direction: column; --split: auto; }
  .editor-pane {
    flex: 1 1 auto;
    max-width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 55vh;
  }
  .pane-divider {
    width: auto;
    min-width: 0;
    height: 5px;
    min-height: 5px;
    cursor: row-resize;
  }
  .pane-divider::before { left: 0; right: 0; top: -4px; bottom: -4px; }
```

(the rest of the 800px block — `.start-menu`, `.help-shell` and friends — is unchanged and keeps its closing brace).

- [ ] **Step 3: Make the divider follow the axis**

The divider must resize on `clientY` once stacked. In `frontend/src/hooks/useSplitPane.js`, replace the single-axis line inside `onMove` with an axis check driven by the container's own computed direction — no media-query duplication in JS:

```js
      const vertical =
        getComputedStyle(container).flexDirection === "column";

      const onMove = (ev) => {
        const rect = container.getBoundingClientRect();
        const pct = vertical
          ? ((ev.clientY - rect.top) / rect.height) * 100
          : ((ev.clientX - rect.left) / rect.width) * 100;
        setSplitPct(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct)));
      };
```

with `document.body.style.cursor = vertical ? "row-resize" : "col-resize";` replacing the fixed cursor assignment, and `aria-orientation` in `IDELayout` left as `"vertical"` (it describes the separator's own orientation in the common case; the stacked case is a sub-1024px courtesy).

- [ ] **Step 4: One platform breakpoint at the stated floor**

Append to `frontend/src/styles.css`, after the 800px block:

```css
/* ═══════════════════════════════════════════════════════════
   PLATFORM SCREENS — the stated minimum viewport is 1024px.
   These screens (admin, classes, profile, auth) had zero responsive
   handling and are the ones most likely to open on a Chromebook.
   ═══════════════════════════════════════════════════════════ */
.admin-table-wrap {
  width: 100%;
  overflow-x: auto;
}

@media (max-width: 1024px) {
  .admin-shell,
  .classes-shell { padding-left: var(--space-4, 16px); padding-right: var(--space-4, 16px); }
  .classes-grid  { grid-template-columns: 1fr; }
  .admin-tabs    { overflow-x: auto; }
  .auth-card     { width: min(100%, 420px); }
}
```

Then wrap every `<table className="admin-table">` in `frontend/src/components/admin/` in `<div className="admin-table-wrap">…</div>` — grep for `admin-table` and wrap each occurrence; do not change the table markup itself. If `.admin-shell` / `.classes-shell` / `.classes-grid` are not the actual class names on those screens, grep `frontend/src/components/admin` and `frontend/src/components/classes` and use the real ones — the intent is one padding rule, one single-column rule and one scrollable tab strip.

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: 17 files / 177 tests green. Then manually at 1440px, 1024px and 780px: the split drags smoothly at all three; at 780px the panes stack and the divider resizes **vertically**; hiding the viewport gives the editor full width at every size; the admin table scrolls inside its own box rather than moving the page.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/components/layout/IDELayout.js frontend/src/hooks/useSplitPane.js frontend/src/styles.css frontend/src/components/admin
git commit -m "feat(frontend): split-pane as a CSS custom property; the stacking breakpoint works; platform screens get a 1024px floor"
```

---

### Task 7: The merged 44px header — the flagship "toned costume" change

Today: titlebar (30px, `IDELayout.js:338-343`) + toolbar (38px) + pane header (35px) = 103px of furniture before a block is visible, and three of those surfaces say the same thing — "Block Editor" at `IDELayout.js:341`, again at `:398`, and as "Mode: Blocks" at `:503`. **None of them names the open project**: `proj.activeManifest.title` is never rendered in the IDE shell. `AccountChip` is rendered only at `StartMenu.js:308`, so from inside the IDE there is no route to `/classes`, `/profile` or `/admin` (`App.js:57-59`) at all.

**Approach.** `Toolbar.js` keeps its filename and becomes the merged header — the alternative (a new `AppHeader.js`) would churn imports and invalidate the Task 2 suite for no behavioural gain. Its root element changes from `<header className="toolbar">` to `<header className="app-header">`, and its flat run of buttons becomes identity + three action zones + account.

**One small review item folded in deliberately:** "Reset" is renamed **"Back to Blocks"** (`Toolbar.js:216` — it resets to blocks mode, but students read "Reset" as "delete my work"). It is a label change inside the component being rebuilt, and Plan 1 could not make it because that plan changes no markup.

**Run's filled-primary treatment is NOT done here** — Plan 1 Task 6 already turns `.tb-btn--run` into the IDE's single filled primary. This task inherits that rule and only adds the shortcut chip's on-accent colours.

**Files:**
- Create: `frontend/src/components/common/DropdownMenu.js`, `frontend/src/components/auth/HeaderAccount.js`, `frontend/src/components/layout/ProjectTitle.js`, `frontend/src/components/layout/__tests__/ProjectTitle.test.js`
- Modify: `frontend/src/components/Toolbar.js`, `frontend/src/components/layout/IDELayout.js`, `frontend/src/hooks/useProject.js`, `frontend/src/components/Icons.js`, `frontend/src/styles.css`, `frontend/src/components/__tests__/Toolbar.test.js`

**Interfaces:**
- Produces: `<DropdownMenu trigger children align triggerClassName title />` (lifted verbatim out of `Toolbar.js:29-69` so both the header's File menu and the account menu share one implementation); `<HeaderAccount />` (compact, routes to `/classes`, `/profile`, `/admin`, sign-in/sign-up); `<ProjectTitle title onRename />` (click-to-rename, Enter commits, Escape cancels, blur commits); `useProject().renameProject(title)`; `MenuIcon`, `UserIcon` added to `Icons.js`.
- Consumes: `--header-h: 44px` (new sizing token beside `--toolbar-h` at `styles.css:88`).

- [ ] **Step 1: Lift `DropdownMenu` into a shared component**

Create `frontend/src/components/common/DropdownMenu.js` with the body of `Toolbar.js:29-69`, generalised so it is not export-specific:

```js
import React, { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../Icons";

/**
 * Click-to-open menu shared by the header's File and account menus.
 * Lifted verbatim from Toolbar.js so there is exactly one implementation.
 * Children are cloned so selecting an item always closes the menu.
 */
export default function DropdownMenu({
  trigger,
  children,
  align = "left",
  title,
  triggerClassName = "tb-btn tb-btn--dropdown",
  chevron = true,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="tb-dropdown" ref={ref}>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
        {chevron && <ChevronDownIcon size={10} />}
      </button>
      {open && (
        <div
          className={`tb-dropdown-menu ${align === "right" ? "tb-dropdown-menu--right" : ""}`}
          role="menu"
        >
          {React.Children.map(children, (child) =>
            child
              ? React.cloneElement(child, {
                  onClick: (...args) => {
                    setOpen(false);
                    child.props.onClick?.(...args);
                  },
                })
              : null,
          )}
        </div>
      )}
    </div>
  );
}
```

Delete lines 29-69 from `Toolbar.js` and import the shared component instead. The Escape-to-close behaviour is new and is the reason this lift is worth doing rather than copying.

- [ ] **Step 2: Add `renameProject`**

In `frontend/src/hooks/useProject.js`, after `addRunAndDataset` (line 202):

```js
  const renameProject = useCallback(
    async (title) => {
      const next = String(title || "").trim().slice(0, 120);
      if (!proj.activeManifest) return null;
      if (!next || next === proj.activeManifest.title) return null;
      /* Capture first: a rename is an edit, so it carries whatever the student
         has typed since the last autosave rather than dropping it. */
      const base = captureWorkingStateInto(proj.activeManifest);
      return proj.persistActive({ ...base, title: next, updatedAt: Date.now() });
    },
    [captureWorkingStateInto, proj],
  );
```

and add `renameProject,` to the returned object beside `saveCurrent` (line 214).

- [ ] **Step 3: The click-to-rename title (test first)**

Create `frontend/src/components/layout/__tests__/ProjectTitle.test.js`:

```js
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import ProjectTitle from "../ProjectTitle";
import { mountComponent, click } from "../../../test/renderHelpers";
import { act } from "react";

let mounted = null;
afterEach(() => { mounted?.unmount(); mounted = null; });

function type(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(input, k) {
  act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
}

describe("ProjectTitle", () => {
  test("renders the title as a button until it is clicked", () => {
    const onRename = vi.fn();
    mounted = mountComponent(<ProjectTitle title="Orbits" onRename={onRename} />);
    const btn = mounted.container.querySelector(".project-title");
    expect(btn.textContent).toBe("Orbits");
    expect(mounted.container.querySelector("input")).toBeNull();
    click(btn);
    expect(mounted.container.querySelector("input").value).toBe("Orbits");
  });

  test("Enter commits the new title", () => {
    const onRename = vi.fn();
    mounted = mountComponent(<ProjectTitle title="Orbits" onRename={onRename} />);
    click(mounted.container.querySelector(".project-title"));
    const input = mounted.container.querySelector("input");
    type(input, "Two-body orbits");
    key(input, "Enter");
    expect(onRename).toHaveBeenCalledWith("Two-body orbits");
    expect(mounted.container.querySelector("input")).toBeNull();
  });

  test("Escape cancels without renaming", () => {
    const onRename = vi.fn();
    mounted = mountComponent(<ProjectTitle title="Orbits" onRename={onRename} />);
    click(mounted.container.querySelector(".project-title"));
    const input = mounted.container.querySelector("input");
    type(input, "discard me");
    key(input, "Escape");
    expect(onRename).not.toHaveBeenCalled();
    expect(mounted.container.querySelector(".project-title").textContent).toBe("Orbits");
  });

  test("an untitled or absent project renders a placeholder and is not editable", () => {
    mounted = mountComponent(<ProjectTitle title="" onRename={vi.fn()} />);
    expect(mounted.container.querySelector(".project-title--empty").textContent).toBe("No project open");
    click(mounted.container.querySelector(".project-title"));
    expect(mounted.container.querySelector("input")).toBeNull();
  });
});
```

Create `frontend/src/components/layout/ProjectTitle.js`:

```js
import React, { useEffect, useRef, useState } from "react";

/**
 * The open project's name, in the header. Click to rename — the first place
 * in the IDE shell that has ever said which project is open.
 * Enter commits, Escape cancels, blur commits (students click away).
 */
export default function ProjectTitle({ title, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title || "");
  const inputRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(title || "");
  }, [title, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(title || "");
      return;
    }
    const next = draft.trim();
    if (next && next !== title) onRename?.(next);
    else setDraft(title || "");
  };

  if (!title) {
    return (
      <span className="project-title project-title--empty" title="No project is open">
        No project open
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="project-title"
        onClick={() => setEditing(true)}
        title="Click to rename this project"
      >
        {title}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="project-title-input"
      value={draft}
      maxLength={120}
      aria-label="Project name"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); inputRef.current.blur(); }
        if (e.key === "Escape") { e.preventDefault(); cancelledRef.current = true; inputRef.current.blur(); }
      }}
    />
  );
}
```

- [ ] **Step 4: The compact account control**

Create `frontend/src/components/auth/HeaderAccount.js`:

```js
import React from "react";
import { useNavigate } from "react-router-dom";
import DropdownMenu from "../common/DropdownMenu";
import { UserIcon } from "../Icons";
import { useMe, useSignout } from "../../auth/useAuth";

/**
 * Header account control. The sidebar's <AccountChip> is a stacked block of
 * links built for StartMenu.js:308 — it cannot live in a 44px bar, so this is
 * the compact form. Same destinations, same guest/member split.
 */
export default function HeaderAccount() {
  const { data: me, isLoading } = useMe();
  const signout = useSignout();
  const navigate = useNavigate();

  if (isLoading) return null;

  const label = me ? me.name : "Guest";
  return (
    <DropdownMenu
      align="right"
      title={me ? `Signed in as ${me.email}` : "You are working as a guest"}
      triggerClassName="tb-btn tb-btn--account"
      trigger={
        <>
          <UserIcon size={13} />
          <span className="tb-btn-label">{label}</span>
          {me && !me.emailConfirmed ? <span className="account-chip-badge">unconfirmed</span> : null}
        </>
      }
    >
      {me ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/classes")}>
          <span>My classes</span>
        </button>
      ) : null}
      {me ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/profile")}>
          <span>Profile</span>
        </button>
      ) : null}
      {me && me.role === "admin" ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/admin")}>
          <span>Admin console</span>
        </button>
      ) : null}
      {me ? (
        <button
          type="button"
          className="tb-dropdown-item"
          disabled={signout.isPending}
          onClick={() => {
            signout
              .mutateAsync()
              .then(() => navigate("/"))
              .catch((err) => console.warn("sign-out failed; you are still signed in", err));
          }}
        >
          <span>{signout.isPending ? "Signing out…" : "Sign out"}</span>
        </button>
      ) : null}
      {!me ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/auth/signin")}>
          <span>Sign in</span>
        </button>
      ) : null}
      {!me ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/auth/signup")}>
          <span>Create account</span>
        </button>
      ) : null}
    </DropdownMenu>
  );
}
```

Add to `frontend/src/components/Icons.js`, following the file's existing style:

```js
export const UserIcon = ({ size } = {}) => (
  <svg {...sz(size)}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

export const MenuIcon = ({ size } = {}) => (
  <svg {...sz(size)}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
);
```

- [ ] **Step 5: Restructure the Toolbar into the header**

In `frontend/src/components/Toolbar.js`:

1. Extend the signature with `projectTitle`, `onRenameProject`, `onSave`, and remove nothing.
2. Add imports: `DropdownMenu` from `../common/DropdownMenu` (wait — Toolbar lives at `components/Toolbar.js`, so the path is `./common/DropdownMenu`), `ProjectTitle` from `./layout/ProjectTitle`, `HeaderAccount` from `./auth/HeaderAccount`, and `SaveIcon`, `MenuIcon` from `./Icons`.
3. Replace the whole returned tree (lines 167-397) with the zoned header. Every existing control keeps its handler, `title` and label text so the Task 2 suite still passes; only the arrangement and the wrapper classes change:

```jsx
  return (
    <header className="app-header">
      {/* ── Identity: menu · brand · project ── */}
      <div className="app-header__identity">
        <button type="button" className="tb-btn tb-btn--nav" onClick={onHome} title="Back to Start Menu">
          <MenuIcon size={14} />
          <span className="tb-btn-label">Menu</span>
        </button>
        <span className="toolbar-logo" aria-hidden="true">
          <AtomIcon size={16} />
          <span className="toolbar-logo-text">Physics<span>IDE</span></span>
        </span>
        <span className="app-header__sep" />
        <ProjectTitle title={projectTitle} onRename={onRenameProject} />
      </div>

      {/* ── Zone 1 — primary: run/stop and the editor mode ── */}
      <div className="app-header__zone app-header__zone--primary">
        {showSimActions && (
          <>
            <button type="button" className="tb-btn tb-btn--run" onClick={onRun} title="Run simulation (Ctrl+Enter)">
              <PlayIcon size={13} />
              <span className="tb-btn-label">Run</span>
              <kbd className="tb-kbd">{MOD_LABEL}+Enter</kbd>
            </button>
            <button
              type="button"
              className={`tb-btn tb-btn--stop${running ? "" : " tb-btn--disabled"}`}
              onClick={running ? onStop : undefined}
              disabled={!running}
              title={running ? "Stop simulation" : "No simulation running"}
            >
              <StopIcon size={13} />
              <span className="tb-btn-label">Stop</span>
            </button>
          </>
        )}
        {children}
      </div>

      {/* ── Zone 2 — view: zoom, panes, debug ── */}
      <div className="app-header__zone app-header__zone--view">
        {mode === "blocks" && zoom != null && onZoomChange && (
          <ZoomSlider value={zoom} onChange={onZoomChange} />
        )}
        {showSimActions && onToggleViewport && (
          <button
            type="button"
            className="tb-btn tb-btn--subtle tb-btn--secondary"
            onClick={onToggleViewport}
            title={viewportHidden ? "Show 3D viewport" : "Hide 3D viewport"}
          >
            {viewportHidden ? <PanelRightOpenIcon size={13} /> : <PanelRightCloseIcon size={13} />}
            <span className="tb-btn-label">{viewportHidden ? "Show" : "Hide"}</span>
          </button>
        )}
        {showSimActions && onToggleTrace && (
          <button
            type="button"
            className={`tb-btn tb-btn--subtle tb-btn--secondary${traceVisible ? " tb-btn--active" : ""}`}
            onClick={onToggleTrace}
            title={traceVisible ? "Hide live trace table" : "Show live trace table"}
          >
            <TableIcon size={13} />
            <span className="tb-btn-label">Trace</span>
          </button>
        )}
        {showSimActions && onDebugMode && (
          <button
            type="button"
            className="tb-btn tb-btn--subtle tb-btn--secondary"
            onClick={onDebugMode}
            title="Open Debug Mode — step-through, breakpoints, recording"
          >
            <BugIcon size={13} />
            <span className="tb-btn-label">Debug</span>
          </button>
        )}
      </div>

      {/* ── Zone 3 — file: save, workspace, import/export ── */}
      <div className="app-header__zone app-header__zone--file">
        {onSave && (
          <button type="button" className="tb-btn tb-btn--secondary" onClick={onSave} title={`Save this project (${MOD_LABEL}+S)`}>
            <SaveIcon size={13} />
            <span className="tb-btn-label">Save</span>
          </button>
        )}
        <button type="button" className="tb-btn tb-btn--subtle tb-btn--secondary" onClick={onReset} title="Return to the block editor">
          <RefreshIcon size={13} />
          <span className="tb-btn-label">Back to Blocks</span>
        </button>
        {mode === "blocks" && onClearWorkspace && (
          <button type="button" className="tb-btn tb-btn--danger tb-btn--secondary" onClick={onClearWorkspace} title="Clear all blocks">
            <TrashIcon size={13} />
            <span className="tb-btn-label">Clear</span>
          </button>
        )}

        <input ref={importInputRef} type="file" accept=".py,.xml" style={{ display: "none" }} onChange={handleFileChange} />
        <input ref={importProjectRef} type="file" accept=".json,.physide.json" style={{ display: "none" }} onChange={handleImportProjectChange} />

        <DropdownMenu
          align="right"
          title="File — import and export"
          trigger={
            <>
              <DownloadIcon size={13} />
              <span className="tb-btn-label">File</span>
            </>
          }
        >
          {onImport ? (
            <button type="button" className="tb-dropdown-item" onClick={handleImportClick}>
              <UploadIcon size={14} />
              <span>Import blocks or Python (.py, .xml)</span>
            </button>
          ) : null}
          {onImportProject ? (
            <button type="button" className="tb-dropdown-item" onClick={handleImportProjectClick}>
              <UploadIcon size={14} />
              <span>Open project bundle (.physide.json)</span>
            </button>
          ) : null}
          <div className="tb-dropdown-divider" />
          <button type="button" className="tb-dropdown-item" onClick={onExportPy}>
            <FileCodeIcon size={14} />
            <span>Export as Python (.py)</span>
          </button>
          <button type="button" className="tb-dropdown-item" onClick={onExportBlocks}>
            <FileBlocksIcon size={14} />
            <span>Export Blocks (.xml)</span>
          </button>
          <button type="button" className="tb-dropdown-item" onClick={onExportCodePdf}>
            <FilePdfIcon size={14} />
            <span>Code as PDF</span>
          </button>
          <button type="button" className="tb-dropdown-item" onClick={onExportBlocksPdf}>
            <FilePdfIcon size={14} />
            <span>Blocks as PDF</span>
          </button>
          {onExportScreenshot ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportScreenshot}>
              <ImageIcon size={14} />
              <span>Screenshot Viewport (.png)</span>
            </button>
          ) : null}
          {onCopyCode ? (
            <button type="button" className="tb-dropdown-item" onClick={onCopyCode}>
              <CopyIcon size={14} />
              <span>Copy Code to Clipboard</span>
            </button>
          ) : null}
          {onExportProject ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportProject}>
              <DownloadIcon size={14} />
              <span>Export Project Bundle (.physide.json)</span>
            </button>
          ) : null}
        </DropdownMenu>

        <button type="button" className="tb-btn tb-btn--icon tb-btn--theme" onClick={onToggleTheme}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
          {isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
        </button>
        <button type="button" className="tb-btn tb-btn--nav tb-btn--secondary" onClick={onHelp} title="Help & Documentation">
          <HelpIcon size={14} />
          <span className="tb-btn-label">Help</span>
        </button>
      </div>

      {/* ── Account ── */}
      <div className="app-header__account">
        <HeaderAccount />
      </div>
    </header>
  );
```

The two file `<input>`s move above the menu (they were inline beside their buttons at `:287-293` and `:309-315`); their refs and handlers are unchanged.

- [ ] **Step 6: Delete the titlebar and feed the header**

In `frontend/src/components/layout/IDELayout.js`:

- Delete lines 337-343 (the `{/* VS Code-style title bar */}` comment and the entire `.titlebar` div).
- Add three props to the `<Toolbar>` element:

```jsx
        projectTitle={proj.activeManifest?.title || ""}
        onRenameProject={proj.renameProject}
        onSave={handleSaveProject}
```

(`handleSaveProject` was defined in Task 3, Step 4.)

- The redundant `pane-header` label stays for now — it is the *pane's* identity, not the window's. Only the third copy goes, in Task 8.

- [ ] **Step 7: Style the header**

In `frontend/src/styles.css`, add `--header-h: 44px;` beside `--toolbar-h` at line 88, then replace the `TITLE BAR` section (lines 230-254) and the `.toolbar` rule (lines 270-281) with:

```css
/* ═══════════════════════════════════════════════════════════
   APP HEADER — one 44px bar replacing the fake titlebar and the
   flat toolbar. Identity on the left, three action zones, account
   on the right. Reclaims 30px and kills the triple mode label.
   ═══════════════════════════════════════════════════════════ */
.app-header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: 0 var(--space-2, 8px);
  height: var(--header-h);
  min-height: var(--header-h);
  background: var(--bg-titlebar);
  border-bottom: 1px solid var(--border);
  z-index: 50;
  user-select: none;
}
.app-header__identity {
  display: flex;
  align-items: center;
  gap: var(--space-1, 4px);
  min-width: 0;
  flex: 0 1 auto;
}
.app-header__zone {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}
/* The primary zone takes the slack, so Run sits near the optical centre. */
.app-header__zone--primary { flex: 1 1 auto; justify-content: center; }
.app-header__zone--view    { margin-left: auto; }
.app-header__account       { flex: 0 0 auto; margin-left: var(--space-1, 4px); }
.app-header__sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  opacity: 0.6;
  margin: 0 var(--space-1, 4px);
  flex-shrink: 0;
}

/* ── The open project's name ── */
.project-title {
  max-width: 26ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-md, 13px);
  font-weight: 500;
  color: var(--text-bright);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius, 4px);
  padding: 3px 6px;
  cursor: text;
}
.project-title:hover { background: var(--bg-hover); border-color: var(--border); }
.project-title--empty { color: var(--text-muted); font-style: italic; cursor: default; }
.project-title--empty:hover { background: transparent; border-color: transparent; }
.project-title-input {
  width: 26ch;
  font: inherit;
  font-size: var(--fs-md, 13px);
  font-weight: 500;
  color: var(--text-bright);
  background: var(--bg-input);
  border: 1px solid var(--accent);
  border-radius: var(--radius, 4px);
  padding: 3px 6px;
}

/* Run is already the filled primary (Plan 1 Task 6). Its shortcut chip just
   needs to sit on that fill instead of on the bar. */
.tb-btn--run .tb-kbd {
  color: var(--on-accent);
  background: color-mix(in srgb, var(--on-accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--on-accent) 22%, transparent);
}
.tb-btn--account { color: var(--text-dim); max-width: 18ch; }
.tb-btn--account .tb-btn-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

Delete the now-orphaned `.titlebar`, `.titlebar-text`, `.titlebar-text strong` rules and the `--titlebar-h` token's only IDE consumer. **Leave `--titlebar-h` defined** — `.start-titlebar` (`StartMenu.js:265-269`) still uses `--bg-titlebar`, and token deletion is Tranche 1's job.

- [ ] **Step 8: Update the Toolbar suite for the new labels**

In `frontend/src/components/__tests__/Toolbar.test.js`:
- `byText(container, "Reset")` → `byText(container, "Back to Blocks")`.
- The export-dropdown test: the trigger's label is now `File` and the menu holds **9** items (2 import + 7 export), in this order — `[0]` Import blocks/Python, `[1]` Open project bundle, `[2]` Export as Python, `[3]` Export Blocks, `[4]` Code as PDF, `[5]` Blocks as PDF, `[6]` Screenshot, `[7]` Copy Code, `[8]` Export Project Bundle. Update `expect(items).toHaveLength(7)` to `toHaveLength(9)`, and **both** indexed clicks: `click(items[0])` → `click(items[2])` (still asserting `h.onExportPy`), and the reopened click on index `[6]` → index `[8]` (still asserting `h.onExportProject`). Updating only the length and the last index and leaving `click(items[0])` alone is not enough: index `0` now points at the new Import-blocks button, which only opens a hidden file input and never calls `onExportPy`, so the test fails without reindexing that first click too.
- Add a describe for the new zones:

```js
describe("Toolbar — header identity", () => {
  test("the project title renders and rename is wired", () => {
    const onRenameProject = vi.fn();
    const { container } = render({ projectTitle: "Orbits", onRenameProject });
    expect(container.querySelector(".project-title").textContent).toBe("Orbits");
  });

  test("Save is wired when a handler is supplied and absent otherwise", () => {
    const onSave = vi.fn();
    const { container } = render({ onSave });
    click(byText(container, "Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test("the three action zones are present", () => {
    const { container } = render();
    expect(container.querySelector(".app-header__zone--primary")).not.toBeNull();
    expect(container.querySelector(".app-header__zone--view")).not.toBeNull();
    expect(container.querySelector(".app-header__zone--file")).not.toBeNull();
  });
});
```

`HeaderAccount` calls `useMe()` (TanStack Query) and `useNavigate()` (router), so the Toolbar suite must not mount it: add `vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));` at the top of the test file, right after the imports, with a comment saying why.

- [ ] **Step 9: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **19 files / 186 tests** green (4 `ProjectTitle` tests + 3 header tests, existing Toolbar tests adjusted). Then manually: the window chrome is one 44px bar; the project name shows and renames (Enter commits, Escape cancels, the start-menu list reflects the new name); Run is a filled green pill; the account control opens and `My classes` navigates to `/classes` and back; the total chrome above the canvas is 44 + 35 = 79px, down from 103px.

- [ ] **Step 10: Commit**

```powershell
git add frontend/src/components frontend/src/hooks/useProject.js frontend/src/styles.css
git commit -m "feat(frontend): merged 44px header — brand, click-to-rename project title, three action zones, account menu"
```

---

### Task 8: The quiet status bar — project · save state · run status

`--bg-statusbar: #007acc` (`styles.css:16`, identical in the light block at `:128`) makes the status bar the loudest element on screen and the only surface that never changes with theme. It also carries the *third* copy of the mode label (`IDELayout.js:503`) and a hardcoded `"VPython 3.2"` with nothing keeping it in sync with the six pinned URLs at `glowRunner.js:22-31`. Guests get no save confirmation at all — `SyncChip` returns `null` when `useMe()` has no user (`SyncChip.js:45`), which is the default classroom case.

**Files:**
- Create: `frontend/src/utils/relativeTime.js`, `frontend/src/utils/__tests__/relativeTime.test.js`, `frontend/src/components/layout/SaveState.js`
- Modify: `frontend/src/components/layout/IDELayout.js`, `frontend/src/components/StartMenu.js`, `frontend/src/utils/runner/glowRunner.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `relativeTime(ms, now?)` (lifted out of `StartMenu.js:164-171` so two callers share one implementation); `<SaveState updatedAt />` — renders `<SyncChip />` for signed-in users and a local-only `Saved on this computer · <relative>` for guests; `GLOWSCRIPT_VERSION` exported from `glowRunner.js`.

- [ ] **Step 1: Lift and test `relativeTime`**

Create `frontend/src/utils/__tests__/relativeTime.test.js`:

```js
import { describe, test, expect } from "vitest";
import { relativeTime } from "../relativeTime";

const NOW = 1_700_000_000_000;

describe("relativeTime", () => {
  test("names the recent past in words a student reads at a glance", () => {
    expect(relativeTime(NOW, NOW)).toBe("just now");
    expect(relativeTime(NOW - 30_000, NOW)).toBe("just now");
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe("5 min ago");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3 h ago");
  });

  test("falls back to a date beyond a day, and to empty for no timestamp", () => {
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toBe(new Date(NOW - 3 * 86_400_000).toLocaleDateString());
    expect(relativeTime(0, NOW)).toBe("");
    expect(relativeTime(null, NOW)).toBe("");
    expect(relativeTime(undefined, NOW)).toBe("");
  });
});
```

Create `frontend/src/utils/relativeTime.js` with the body of `StartMenu.js:164-171`, parameterised on `now` so it is testable:

```js
/** "just now" / "5 min ago" / "3 h ago" / a date. Shared by the start menu and the status bar. */
export function relativeTime(ms, now = Date.now()) {
  if (!ms) return "";
  const delta = now - ms;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)} min ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString();
}
```

Delete `StartMenu.js:162-171` and import the shared helper instead: `import { relativeTime } from "../utils/relativeTime";`.

- [ ] **Step 2: A save state guests can see**

Create `frontend/src/components/layout/SaveState.js`:

```js
import React from "react";
import { useMe } from "../../auth/useAuth";
import SyncChip from "../../sync/SyncChip";
import { relativeTime } from "../../utils/relativeTime";

/**
 * Save state for the status bar.
 *
 * Signed in: SyncChip owns the sentence (spec §6.3 copy, verbatim).
 * Guest: the same reassurance without any network claim — a student editing
 * for 40 minutes currently gets zero confirmation that anything is saved.
 */
export default function SaveState({ updatedAt }) {
  const { data: me } = useMe();
  if (me) return <SyncChip />;
  const when = relativeTime(updatedAt);
  if (!when) return null;
  return (
    <span className="sync-chip" title="Your work is stored in this browser on this computer.">
      Saved on this computer · {when}
    </span>
  );
}
```

- [ ] **Step 3: Repopulate the status bar**

In `frontend/src/components/layout/IDELayout.js`, replace the status bar (lines 495-505) with:

```jsx
      {/* ── Status bar — quiet: project · save state · run status ── */}
      <div className="status-bar">
        <span className="status-bar__project" title={proj.activeManifest?.title || ""}>
          {proj.activeManifest?.title || "No project open"}
        </span>
        <SaveState updatedAt={proj.activeManifest?.updatedAt} />
        <span className="status-bar__spacer" />
        <span className={running ? "console-bar console-bar--running" : statusClass}>
          {running && <span className="status-dot" />}
          {status.text}
        </span>
        <span className="status-bar__engine">VPython {GLOWSCRIPT_VERSION}</span>
      </div>
```

with `import SaveState from "./SaveState";` and `import { GLOWSCRIPT_VERSION } from "../../utils/runner/glowRunner";` added. The mode readout is gone — the header's `ModeToggle` already shows it, and the pane header names the editor.

- [ ] **Step 4: Stop hardcoding the engine version**

In `frontend/src/utils/runner/glowRunner.js`, above `GLOWSCRIPT_SCRIPTS` (line 22):

```js
/** The GlowScript release the six pinned URLs below belong to. Exported so the
 *  status bar cannot drift from what actually loads (IDELayout.js used to
 *  hardcode "VPython 3.2" with nothing keeping the two in step). */
export const GLOWSCRIPT_VERSION = "3.2";
```

and interpolate it into the three versioned URLs so a bump is a one-line change:

```js
  glow: `https://www.glowscript.org/package/glow.${GLOWSCRIPT_VERSION}.min.js`,
  compiler: `https://www.glowscript.org/package/RScompiler.${GLOWSCRIPT_VERSION}.min.js`,
  run: `https://www.glowscript.org/package/RSrun.${GLOWSCRIPT_VERSION}.min.js`,
```

(the three jQuery URLs are unversioned and stay as they are).

- [ ] **Step 5: Quiet the surface**

In `frontend/src/styles.css`, change `--statusbar-h` (line 90) from `22px` to `26px` and replace lines 1770-1788 with:

```css
.status-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: 0 var(--space-3, 12px);
  height: var(--statusbar-h);
  min-height: var(--statusbar-h);
  font-size: var(--fs-xs, 11px);
  color: var(--text-dim);
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  user-select: none;
  z-index: 50;
}
.status-bar span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-xs, 11px);
}
.status-bar__project {
  max-width: 28ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text);
}
.status-bar__spacer { flex: 1; }
.status-bar__engine { color: var(--text-muted); font-family: var(--mono); }
```

and repoint the console colours off the white-on-blue assumption (lines 1790-1803):

```css
.console-bar {
  padding: 0;
  font-size: var(--fs-xs, 11px);
  font-family: var(--mono);
  color: var(--text-dim);
  background: transparent;
  border: none;
}
.console-bar--error   { color: var(--red); }
.console-bar--success { color: var(--green); }
.console-bar--running { color: var(--accent); font-weight: 500; }
```

After Plan 1 lands there is exactly **one** `--bg-statusbar` declaration left, not two: Plan 1 Task 1 Step 4 rewrites the dark block's copy to `var(--bg-surface)`, and Step 5 deletes the light block's copy outright (the `:root` cascade now supplies it). The `.status-bar` rule just above already reads `background: var(--bg-surface);` directly — a repoint, not a resolve-through-the-alias — so `--bg-statusbar` has no consumer left in the IDE shell either way. Step 6 below deletes the declaration for good, along with the other seven alias tokens the review flagged as still surviving past Tranche 1.

- [ ] **Step 6: Retire the deprecated alias tokens Plan 1 marked but did not delete**

Plan 1 Task 1 Step 6 marks the `Alias tokens` block `DEPRECATED` in both theme blocks and says outright: "the block is deleted in Tranche 2 once the count reaches zero." Plan 1 Task 9 Step 3 converts the six aliases with consumers inside `styles.css:1006-1765` (pre-Plan-1 line numbers) to their canonical names — `--border-hard`→`--border-hl`, `--text-secondary`→`--text`, `--text-primary`→`--text-bright`, `--sans`→`--font`, `--fg`→`--text`, `--fg-muted`→`--text-dim` — but that sweep is scoped to that one region and does not cover `--bg-app` or `--border-soft`, and it stops at line 1765. This step finishes the job for the whole file, using the same canonical names Plan 1 already established (its Step 6 banner comment names `--bg-base` for `--bg-app` and `--border-soft`→`--card-border`):

| Alias | Canonical |
|---|---|
| `var(--border-hard)` | `var(--border-hl)` |
| `var(--border-soft)` | `var(--card-border)` |
| `var(--text-secondary)` | `var(--text)` |
| `var(--text-primary)` | `var(--text-bright)` |
| `var(--sans, system-ui, sans-serif)` / `var(--sans)` | `var(--font)` |
| `var(--fg)` | `var(--text)` |
| `var(--fg-muted)` | `var(--text-dim)` |
| `var(--bg-app)` | `var(--bg-base)` |

All eight are a no-op visually: `--bg-app`/`--border-soft`/etc. and their canonical replacements resolve to identical values in both theme blocks today.

Verified against the live file (pre-Plan-1 line numbers; Plan 1 shifts everything below its `:root` primitives block, so locate by selector once it has landed): the consumers left **outside** `1006-1765` are `.data-panel` (`:3089`, `var(--bg-app)`), `.start-project-row` (`:3539`, `var(--bg-app)`), `.start-wizard` (`:3600`, `var(--bg-app)`), `.chart-overlay-inner` (`:3803`, `var(--bg-app)`), `.canvas-controls-hint` above the converted range (`:948`, `var(--border-soft)`), and the `.trace-promote-*` / `.beginner-guide-dismiss` cluster at `:3963-4156` (`var(--fg)` / `var(--fg-muted)`). Rewrite every one to its canonical name from the table above.

Then delete, from **both** theme blocks: the `--bg-app`, `--border-soft`, `--border-hard`, `--text-primary`, `--text-secondary`, `--fg`, `--fg-muted` and `--sans` declarations (leave `--bg-toolbar`, `--bg-sidebar`, `--font-mono` and `--error` in place — they are not part of the eight the review named as still surviving, and this step does not audit them), and trim the `DEPRECATED` banner comment's "Canonical names" list to drop the ones just retired. Delete the one surviving `--bg-statusbar` declaration (Step 5, above) the same way.

```powershell
git grep -n "\-\-bg-app\b\|--fg\b\|--text-primary\b\|--text-secondary\b\|--sans\b\|--border-hard\b\|--border-soft\b\|--fg-muted\b\|--bg-statusbar\b" -- frontend/src
```

Expected: empty. Any hit is either a straggler consumer this step missed or one of the four aliases (`--bg-toolbar`/`--bg-sidebar`/`--font-mono`/`--error`) matched by an overlapping pattern — narrow the grep and re-check before treating it as a failure.

- [ ] **Step 7: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **20 files / 188 tests** green. Then manually, signed out: the status bar reads `<project> · Saved on this computer · <time> · <status> · VPython 3.2` on a quiet grey strip; edit a block, wait ~3s, and the relative time refreshes on the next render. Signed in: the `SyncChip` sentence appears in the same slot. Toggle the theme — the status bar retheme s with everything else, which the blue bar never did. Spot-check `.data-panel`, the start-menu project rows and wizard, and the chart overlay — all render with the same colours as before Step 6, since the rewrite is value-for-value.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/utils/relativeTime.js frontend/src/utils/__tests__/relativeTime.test.js frontend/src/components frontend/src/utils/runner/glowRunner.js frontend/src/styles.css
git commit -m "feat(frontend): quiet status bar — project, guest-aware save state, run status, live engine version; retire the deprecated alias tokens"
```

---

### Task 9: Two-stage responsive collapse with an overflow menu

`.toolbar` had no `flex-wrap` and no overflow rule, `.tb-btn` is `white-space: nowrap` (`styles.css:317`) and `.app-shell` is `overflow: hidden` (`:264`). Between 800px and ~1220px — the projector and tablet-landscape band — Export and the theme toggle silently vanish with no way to reach them. With the header now carrying *more* content (project title, account), this gets worse before it gets better.

**Thresholds** (chosen against the 1024px floor so stage 2 is active *at* the floor, not below it): **stage 1 at ≤ 1280px** — secondary labels drop to icons, the zoom slider goes; **stage 2 at ≤ 1120px** — the whole view zone plus Back to Blocks, Clear and Help move into an overflow menu.

**Files:**
- Create: `frontend/src/hooks/useMediaQuery.js`, `frontend/src/components/__tests__/ToolbarResponsive.test.js`
- Modify: `frontend/src/components/Toolbar.js`, `frontend/src/components/Icons.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `useMediaQuery(query)` → boolean, SSR-safe and listener-cleaned; `MoreHorizontalIcon` reused as the overflow trigger (already in `Icons.js:224` — no new icon needed); constants `HEADER_STAGE1_QUERY` / `HEADER_STAGE2_QUERY` exported from `Toolbar.js` so the tests and the CSS agree on one number.

- [ ] **Step 1: The hook**

Create `frontend/src/hooks/useMediaQuery.js`:

```js
import { useEffect, useState } from "react";

/**
 * Subscribe to a media query. Used by the header's two-stage collapse, where
 * moving controls into an overflow menu is a DOM change CSS cannot express.
 * jsdom has no matchMedia — setupTests.js stubs a never-matching one.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/src/components/__tests__/ToolbarResponsive.test.js`:

```js
import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import Toolbar, { HEADER_STAGE1_QUERY, HEADER_STAGE2_QUERY } from "../Toolbar";
import { mountComponent, click, byText } from "../../test/renderHelpers";

vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));

let mounted = null;
const realMatchMedia = globalThis.matchMedia;

/** Make exactly the listed queries match. */
function setViewport(...matching) {
  globalThis.matchMedia = (query) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

beforeEach(() => setViewport());
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  globalThis.matchMedia = realMatchMedia;
});

function render(props = {}) {
  mounted = mountComponent(
    <Toolbar goal="physics" mode="blocks" running={false} isDark zoom={90}
             onZoomChange={vi.fn()} onToggleViewport={vi.fn()} onDebugMode={vi.fn()}
             onReset={vi.fn()} onClearWorkspace={vi.fn()} onHelp={vi.fn()} {...props} />,
  );
  return mounted;
}

describe("header collapse — wide (no query matches)", () => {
  test("everything is inline and there is no overflow menu", () => {
    const { container } = render();
    expect(container.querySelector(".tb-zoom")).not.toBeNull();
    expect(byText(container, "Debug")).not.toBeNull();
    expect(container.querySelector(".tb-btn--overflow")).toBeNull();
    expect(container.querySelector(".app-header--stage1")).toBeNull();
  });
});

describe("header collapse — stage 1 (<= 1280px)", () => {
  test("the zoom slider goes and the header is marked compact", () => {
    setViewport(HEADER_STAGE1_QUERY);
    const { container } = render();
    expect(container.querySelector(".tb-zoom")).toBeNull();
    expect(container.querySelector(".app-header--stage1")).not.toBeNull();
    // Controls are still directly clickable — only their labels are CSS-hidden.
    expect(byText(container, "Debug")).not.toBeNull();
    expect(container.querySelector(".tb-btn--overflow")).toBeNull();
  });
});

describe("header collapse — stage 2 (<= 1120px)", () => {
  test("secondary controls move into the overflow menu and stay reachable", () => {
    setViewport(HEADER_STAGE1_QUERY, HEADER_STAGE2_QUERY);
    const onDebugMode = vi.fn();
    const { container } = render({ onDebugMode });

    expect(byText(container, "Debug")).toBeNull();
    const trigger = container.querySelector(".tb-btn--overflow");
    expect(trigger).not.toBeNull();
    click(trigger);

    const menu = container.querySelector(".tb-dropdown-menu");
    for (const label of ["Debug", "Hide 3D viewport", "Back to Blocks", "Clear", "Help"]) {
      expect(menu.textContent).toContain(label);
    }
    click([...menu.querySelectorAll(".tb-dropdown-item")].find((b) => b.textContent.includes("Debug")));
    expect(onDebugMode).toHaveBeenCalledTimes(1);
  });

  test("Run, Stop, Save, File and the project title never collapse", () => {
    setViewport(HEADER_STAGE1_QUERY, HEADER_STAGE2_QUERY);
    const { container } = render({ onSave: vi.fn(), projectTitle: "Orbits" });
    expect(byText(container, "Run")).not.toBeNull();
    expect(byText(container, "Stop")).not.toBeNull();
    expect(byText(container, "Save")).not.toBeNull();
    expect(byText(container, "File")).not.toBeNull();
    expect(container.querySelector(".project-title")).not.toBeNull();
  });
});
```

- [ ] **Step 3: Implement the collapse**

In `frontend/src/components/Toolbar.js`:

1. Export the two queries so the tests, the component and the CSS share one number:

```js
export const HEADER_STAGE1_QUERY = "(max-width: 1280px)";
export const HEADER_STAGE2_QUERY = "(max-width: 1120px)";
```

2. Inside the component, after the capability flags (line 140):

```js
  const stage1 = useMediaQuery(HEADER_STAGE1_QUERY);
  const stage2 = useMediaQuery(HEADER_STAGE2_QUERY);
```

3. Gate the zoom slider on `!stage1` (it is the widest control at ~160px and Blockly provides wheel zoom anyway; Task 13 adds Fit-to-blocks in the pane header as the recovery affordance):

```jsx
        {mode === "blocks" && zoom != null && onZoomChange && !stage1 && (
          <ZoomSlider value={zoom} onChange={onZoomChange} />
        )}
```

4. **Decision on the dead Trace toggle** (Plan 1 explicitly deferred "`.tb-btn--active` and the dead Trace toggle — Tranche 2 decides wire-or-delete" to this plan). **Keep both, do not wire, do not delete.** `Toolbar.js:257-267` renders the toggle only when `onToggleTrace` is passed, and `IDELayout.js:345-378` never passes it — so it is inert today, not broken. Plan 3 revives `.debug-drawer` (`styles.css:954-1004`) as a docked `TraceTable` beside the normal viewport and supplies exactly this handler, and its `.tb-btn--active` rule is that drawer's on-state. Deleting them now means re-adding them in the next tranche. Record the decision as a comment above the toggle:

```jsx
      {/* Reserved for Plan 3's docked trace drawer, which supplies onToggleTrace.
         Inert until then — the toggle does not render without the handler. */}
```

5. Extract the collapsible controls into one array so inline and overflow render from a single source — no duplicated JSX to drift:

```js
  /* Controls that survive on a projector as menu items rather than buttons.
     Run, Stop, Save, File, the theme toggle, the project title and the mode
     toggle are NEVER collapsed — they are the reason the header exists. */
  const secondaryActions = [
    showSimActions && onToggleViewport && {
      key: "viewport",
      label: viewportHidden ? "Show 3D viewport" : "Hide 3D viewport",
      short: viewportHidden ? "Show" : "Hide",
      icon: viewportHidden ? PanelRightOpenIcon : PanelRightCloseIcon,
      onClick: onToggleViewport,
    },
    showSimActions && onToggleTrace && {
      key: "trace",
      label: traceVisible ? "Hide live trace table" : "Show live trace table",
      short: "Trace",
      icon: TableIcon,
      onClick: onToggleTrace,
      active: traceVisible,
    },
    showSimActions && onDebugMode && {
      key: "debug",
      label: "Open Debug Mode — step-through, breakpoints, recording",
      short: "Debug",
      icon: BugIcon,
      onClick: onDebugMode,
    },
    onReset && {
      key: "reset",
      label: "Return to the block editor",
      short: "Back to Blocks",
      icon: RefreshIcon,
      onClick: onReset,
    },
    mode === "blocks" && onClearWorkspace && {
      key: "clear",
      label: "Clear all blocks",
      short: "Clear",
      icon: TrashIcon,
      onClick: onClearWorkspace,
      danger: true,
    },
    onHelp && { key: "help", label: "Help & Documentation", short: "Help", icon: HelpIcon, onClick: onHelp },
  ].filter(Boolean);
```

6. Render them one way or the other. In the view zone, replace the hand-written viewport/trace/debug buttons with:

```jsx
        {!stage2 &&
          secondaryActions.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`tb-btn tb-btn--secondary ${a.danger ? "tb-btn--danger" : "tb-btn--subtle"}${a.active ? " tb-btn--active" : ""}`}
              onClick={a.onClick}
              title={a.label}
            >
              <a.icon size={13} />
              <span className="tb-btn-label">{a.short}</span>
            </button>
          ))}
        {stage2 && (
          <DropdownMenu
            align="right"
            title="More actions"
            triggerClassName="tb-btn tb-btn--subtle tb-btn--overflow"
            chevron={false}
            trigger={<MoreHorizontalIcon size={16} />}
          >
            {secondaryActions.map((a) => (
              <button key={a.key} type="button" className="tb-dropdown-item" onClick={a.onClick}>
                <a.icon size={14} />
                <span>{a.short}</span>
                <span className="tb-dropdown-shortcut">{a.label}</span>
              </button>
            ))}
          </DropdownMenu>
        )}
```

and remove the corresponding buttons from the file zone (Back to Blocks, Clear) and the trailing Help button — they now live in `secondaryActions`. The overflow trigger is `MoreHorizontalIcon` (`Icons.js:224`), an existing inline SVG; give it `aria-label="More actions"` via the `title` prop, which `DropdownMenu` already forwards.

7. Add `className={`app-header${stage1 ? " app-header--stage1" : ""}${stage2 ? " app-header--stage2" : ""}`}` to the root `<header>`.

- [ ] **Step 4: Stage-1 label hiding in CSS**

Append to `frontend/src/styles.css` after the `.app-header` block:

```css
/* Stage 1 (<= 1280px): secondary controls become icons. Primary controls,
   the project title and the account label keep their words. */
.app-header--stage1 .tb-btn--secondary .tb-btn-label { display: none; }
.app-header--stage1 .tb-btn--secondary { padding: 5px 7px; }
.app-header--stage1 .project-title,
.app-header--stage1 .project-title-input { max-width: 18ch; width: 18ch; }
.app-header--stage1 .toolbar-logo-text { display: none; }

/* Stage 2 (<= 1120px): the overflow menu carries what no longer fits. */
.tb-btn--overflow { padding: 5px 7px; }
.app-header--stage2 .tb-btn--account .tb-btn-label { display: none; }
.app-header--stage2 .app-header__zone--file .tb-btn--secondary .tb-btn-label { display: none; }
```

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **21 files / 193 tests** green. Then manually, resizing the window from 1440px down: at 1280px the zoom slider and the secondary labels go and nothing jumps; at 1120px the `⋯` menu appears and every collapsed control is inside it and works; at 1024px — the stated floor — Run, Stop, the mode toggle, Save, File, the account control and the project title are all still directly clickable and nothing is clipped. Confirm the header never wraps and never scrolls horizontally.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/hooks/useMediaQuery.js frontend/src/components frontend/src/styles.css
git commit -m "feat(frontend): two-stage header collapse with an overflow menu — nothing vanishes between 1024px and 1280px"
```

---

### Task 10: One `<Overlay>` wrapper, `dialogService.alert`, and an error that persists

Four overlays, four different levels of manners. `ChartOverlay.js:114-116` has no keydown handler, no dialog semantics and no backdrop dismiss — and it is the payoff screen after a recorded run. `TracePromoteDialog.js:58` declares `aria-modal` but ignores Escape. `VariableDialog.js:69-70` and `HelpPage.js:240` do handle it. Meanwhile `IDELayout.js:241-243` fires a native `alert()` while `useSimulation.js:264` uses the custom dialog service in the same flow, and runtime errors land in a 22px strip (`styles.css:1790-1799`) shared with success messages and overwritten by the next status string.

**Files:**
- Create: `frontend/src/components/common/Overlay.js`, `frontend/src/components/common/__tests__/Overlay.test.js`, `frontend/src/components/layout/RunErrorBanner.js`
- Modify: `frontend/src/components/ChartOverlay.js`, `frontend/src/components/TracePromoteDialog.js`, `frontend/src/components/VariableDialog.js`, `frontend/src/components/layout/IDELayout.js`, `frontend/src/styles.css`, `frontend/src/test/renderHelpers.js`

**Interfaces:**
- Produces: `<Overlay onClose label className dismissOnBackdrop children />` — Escape closes, backdrop click closes (opt-out), `role="dialog" aria-modal="true" aria-label`, focus moves in on mount and returns to the previously focused element on unmount; `<RunErrorBanner text onDismiss />`.
- **HelpPage is deliberately left alone.** It is a 2,250-line full-screen document with its own search, sidebar and keyboard handling at `HelpPage.js:240-241`, not a dialog. Wrapping it is a Tranche 3 concern if it is ever worth doing; forcing it through `Overlay` here would be a large, risky diff for no behavioural gain.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/common/__tests__/Overlay.test.js`:

```js
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import Overlay from "../Overlay";
import { mountComponent, click, keyDown } from "../../../test/renderHelpers";

let mounted = null;
afterEach(() => { mounted?.unmount(); mounted = null; });

describe("Overlay", () => {
  test("carries dialog semantics", () => {
    mounted = mountComponent(<Overlay onClose={vi.fn()} label="Save run"><p>body</p></Overlay>);
    const el = mounted.container.querySelector('[role="dialog"]');
    expect(el.getAttribute("aria-modal")).toBe("true");
    expect(el.getAttribute("aria-label")).toBe("Save run");
  });

  test("Escape closes", () => {
    const onClose = vi.fn();
    mounted = mountComponent(<Overlay onClose={onClose} label="X"><p>body</p></Overlay>);
    keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a backdrop click closes but a click inside does not", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <Overlay onClose={onClose} label="X"><button type="button" id="inner">ok</button></Overlay>,
    );
    click(mounted.container.querySelector("#inner"));
    expect(onClose).not.toHaveBeenCalled();
    click(mounted.container.querySelector(".overlay-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("dismissOnBackdrop={false} keeps the backdrop inert", () => {
    const onClose = vi.fn();
    mounted = mountComponent(
      <Overlay onClose={onClose} label="X" dismissOnBackdrop={false}><p>body</p></Overlay>,
    );
    click(mounted.container.querySelector(".overlay-backdrop"));
    expect(onClose).not.toHaveBeenCalled();
  });

  test("focus moves in on mount and returns on unmount", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    mounted = mountComponent(
      <Overlay onClose={vi.fn()} label="X"><button type="button" id="first">ok</button></Overlay>,
    );
    expect(mounted.container.querySelector(".overlay-panel").contains(document.activeElement)).toBe(true);

    mounted.unmount();
    mounted = null;
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
```

- [ ] **Step 2: Implement `Overlay`**

Create `frontend/src/components/common/Overlay.js`:

```js
import React, { useEffect, useRef } from "react";

/**
 * One modal wrapper for every dialog in the IDE.
 *
 * Escape closes, the backdrop closes, the dialog announces itself, focus moves
 * in on mount and returns to whatever opened it on unmount. Before this, each
 * of the four overlays implemented a different subset — ChartOverlay, the
 * payoff screen after a recorded run, implemented none of it.
 *
 * Not a focus TRAP: a trap needs a sentinel pair and careful Tab handling, and
 * every dialog here is short. Moving focus in and restoring it out is the part
 * that matters for a keyboard user; trapping is a Tranche 3 refinement.
 */
export default function Overlay({
  onClose,
  label,
  className = "",
  panelClassName = "",
  dismissOnBackdrop = true,
  children,
}) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    openerRef.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable || panel)?.focus?.();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const opener = openerRef.current;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div
      className={`overlay-backdrop ${className}`}
      onMouseDown={(e) => {
        if (dismissOnBackdrop && e.target === e.currentTarget) onCloseRef.current?.();
      }}
    >
      <div
        ref={panelRef}
        className={`overlay-panel ${panelClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
```

Note the test clicks the backdrop while the component uses `onMouseDown` — `click()` in the harness dispatches a `MouseEvent("click")`. Change the harness call in the backdrop tests to `act(() => el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })))`, or simpler: add a `mouseDown(el)` helper to `renderHelpers.js` mirroring `click` and use it in those two tests. Use the helper — `mousedown` is what every dialog in this codebase already listens for (`VariableDialog.js:83`, `DropdownMenu`).

Add to `frontend/src/styles.css`:

```css
/* ── Shared modal wrapper ── */
.overlay-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  backdrop-filter: blur(var(--overlay-blur));
}
.overlay-panel {
  max-width: min(96vw, 1100px);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  outline: none;
}
```

- [ ] **Step 3: Adopt it in the three dialogs**

- `frontend/src/components/ChartOverlay.js` — replace lines 114-116's `<div className="chart-overlay"><div className="chart-overlay-inner">` (and its two closing `</div>`s) with `<Overlay onClose={onClose} label={`Chart — ${title}`} className="chart-overlay" panelClassName="chart-overlay-inner">` … `</Overlay>`. The existing `.chart-overlay` / `.chart-overlay-inner` rules keep working because both class names are still applied.
- `frontend/src/components/TracePromoteDialog.js` — same treatment on lines 58-59, `label="Save run as dataset"`, `dismissOnBackdrop={false}` (a half-filled form should not vanish on a stray click), and delete the now-redundant `role`/`aria-modal` attributes.
- `frontend/src/components/VariableDialog.js` — same treatment on lines 81-92. Keep `onKeyDown={handleKeyDown}` on the inner element for **Enter** (commit), and delete the `if (e.key === "Escape") handleCancel();` line at `:70` — `Overlay` owns Escape now. Pass `dismissOnBackdrop={state.type !== "alert"}`, preserving the existing rule at `:83`.

- [ ] **Step 4: Replace the raw `alert()`**

In `frontend/src/components/layout/IDELayout.js`, add `import * as dialogService from "../../utils/export/dialogService";` and change lines 240-243 to:

```js
    } catch (err) {
      console.warn("Import failed:", err);
      await dialogService.alert(
        `Could not open that file.\n\n${err.message}\n\nCheck that it is a .physide.json project bundle exported from Physics IDE.`,
      );
    }
```

`dialogService.alert` routes to `VariableDialog` when it is mounted (`dialogService.js:27-30`), which it always is in the IDE shell (`IDELayout.js:334`), and falls back to `window.alert` otherwise — so this strictly improves on the native dialog and never loses the message.

- [ ] **Step 5: An error that stays put**

Create `frontend/src/components/layout/RunErrorBanner.js`:

```js
import React, { useState } from "react";
import { AlertTriangleIcon, CopyIcon, XIcon } from "../Icons";

/**
 * Runtime and compile errors used to land in the 22px status strip, sharing it
 * with success messages and being overwritten by the next status string. A
 * student who looked away missed it entirely. This banner persists until it is
 * dismissed and can hand the text to a teacher.
 */
export default function RunErrorBanner({ text, onDismiss }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <div className="run-error-banner" role="alert">
      <AlertTriangleIcon size={14} />
      <span className="run-error-banner__text">{text}</span>
      <button
        type="button"
        className="tb-btn tb-btn--subtle"
        title="Copy this error to the clipboard"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        <CopyIcon size={12} />
        <span className="tb-btn-label">{copied ? "Copied" : "Copy error"}</span>
      </button>
      <button type="button" className="tb-btn tb-btn--icon" onClick={onDismiss} aria-label="Dismiss error">
        <XIcon size={12} />
      </button>
    </div>
  );
}
```

Wire it in `IDELayout.js`. Add state beside the other UI state (after line 90):

```js
  /* The last error we showed in the banner, so dismissing it does not
     immediately re-show the same status string on the next render. */
  const [dismissedError, setDismissedError] = useState(null);
  const bannerText = status.type === "error" && status.text !== dismissedError ? status.text : null;
```

and render it at the top of the right-hand pane in all three branches — insert directly after each `pane-header--viewport` div (lines 466-468, 487-489) and above `<DataPanel>` in the data-science branch:

```jsx
            <RunErrorBanner text={bannerText} onDismiss={() => setDismissedError(status.text)} />
```

Add to `frontend/src/styles.css`:

```css
.run-error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font-size: var(--fs-sm, 12px);
  color: var(--red);
  background: color-mix(in srgb, var(--red) 12%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--red) 35%, transparent);
}
.run-error-banner__text {
  flex: 1;
  min-width: 0;
  font-family: var(--mono);
  overflow-wrap: anywhere;
  max-height: 4.5em;
  overflow-y: auto;
}
.run-error-banner svg { flex-shrink: 0; }
```

- [ ] **Step 6: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **22 files / 198 tests** green. Then manually: record a run and open the chart — Escape closes it, a backdrop click closes it, and focus returns to whatever opened it; open "Save run as dataset" — Escape closes it, a backdrop click does **not**; import a corrupt `.physide.json` — the styled dialog appears, not the browser's; run a program with a deliberate error (`sphere(radius="x")`) — the banner appears above the viewport, survives the next status change, copies, and dismisses.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/components frontend/src/styles.css frontend/src/test/renderHelpers.js
git commit -m "feat(frontend): shared Overlay wrapper for the dialogs; dialogService.alert replaces alert(); persistent run-error banner"
```

---

### Task 11: The blank canvas says something — `sim_start` pre-placed and a ghost overlay

`e2e/ux-toolbox-physics.png` shows an empty grid with a trashcan and nothing else. `IDELayout.js:400-411` renders `BlocklyWorkspace` with no empty-state branch. `BeginnerGuide.js` is a complete, working component **imported nowhere** — and its second tip (`BeginnerGuide.js:7`) actively misdirects: *"Use the Variable blocks to create objects like balls and springs"*, when objects live in **Objects** (`toolbox.js:76`) and **Variables** (`:243`) is Blockly's stock drawer containing no object blocks.

Meanwhile `manifest/factory.js:12-30` already ships a `DS_STARTER_XML` for data-science and hybrid projects — a blank *physics* project gets nothing. This task closes both gaps with the pattern already in the file.

**Files:**
- Create: `frontend/src/components/BlocklyEmptyState.js`, `frontend/src/utils/manifest/__tests__/factory.starter.test.js`
- Modify: `frontend/src/utils/manifest/factory.js`, `frontend/src/components/BlocklyWorkspace.js`, `frontend/src/components/layout/IDELayout.js`, `frontend/src/components/BeginnerGuide.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `PHYSICS_STARTER_XML` (a `sim_start_block` + `sim_end_block` pair) applied to blank physics projects; `BlocklyWorkspace` gains an `onBlockCountChange(n)` prop that reports the **non-frame** block count — `sim_start_block`/`sim_end_block`/`ds_start_block` are excluded (Step 3), so a freshly seeded blank project reports `0` even though its two-block frame is already on the canvas; `<BlocklyEmptyState goal onInsert checkpointState onDismissTip />` renders over an empty canvas and disappears the moment real content lands.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/manifest/__tests__/factory.starter.test.js`:

```js
import { describe, test, expect } from "vitest";
import { createManifest } from "../factory";

describe("blank projects open on something, not nothing", () => {
  test("a blank physics project is pre-seeded with the simulation frame", () => {
    const m = createManifest({ goal: "physics" });
    expect(m.workspace.xml).toContain('type="sim_start_block"');
    expect(m.workspace.xml).toContain('type="sim_end_block"');
  });

  test("an explicit workspaceXml always wins (templates and imports are untouched)", () => {
    const m = createManifest({ goal: "physics", workspaceXml: "<xml><block type='sphere_block'/></xml>" });
    expect(m.workspace.xml).toBe("<xml><block type='sphere_block'/></xml>");
  });

  test("data-science and hybrid keep their own starter", () => {
    for (const goal of ["datascience", "hybrid"]) {
      expect(createManifest({ goal }).workspace.xml).toContain('type="ds_start_block"');
    }
  });

  test("a code-first blank project is NOT seeded — its editor is Python", () => {
    const m = createManifest({ goal: "physics", projectType: "code_blank", preferredEditor: "code" });
    expect(m.workspace.xml).toBe("");
  });
});
```

- [ ] **Step 2: Seed blank physics projects**

In `frontend/src/utils/manifest/factory.js`, add beside `DS_STARTER_XML` (after line 30):

```js
/* A blank physics project opens on the frame every simulation needs, so the
   first thing a student sees is a place to put blocks rather than an empty
   grid and a trashcan. Mirrors DS_STARTER_XML above. */
const PHYSICS_STARTER_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="sim_start_block" x="40" y="40">
    <field name="TITLE">My Simulation</field>
    <next>
      <block type="sim_end_block">
        <field name="MSG">Simulation complete.</field>
      </block>
    </next>
  </block>
</xml>`;
```

and replace the `defaultXml` expression (lines 68-71) with:

```js
  const isCodeFirst = projectType === "code_blank" || preferredEditor === "code";
  let defaultXml = workspaceXml || "";
  if (!workspaceXml && !isCodeFirst) {
    defaultXml = goal === "datascience" || goal === "hybrid" ? DS_STARTER_XML : PHYSICS_STARTER_XML;
  }
```

(`normalizeSimulationStructure` at `BlocklyWorkspace.js:196-232` already knows how to keep this pair well-formed, and `blockTemplates.js:257-278` builds every template the same way — so this seed is exactly the shape the rest of the system expects. `sim_start_block` and `sim_end_block` are exactly the two types Step 3's block-count filter excludes below — the seeded frame must not itself count as content, or the empty-state overlay in Step 6 would never render on a fresh project.)

- [ ] **Step 3: Report the block count out of the workspace — excluding the frame**

`sim_start_block`, `sim_end_block` and `ds_start_block` are scaffold, not content — Step 2 seeds the first two into every blank physics project (and `DS_STARTER_XML` seeds the third into every blank data-science/hybrid one), so a raw `workspace.getAllBlocks(false).length` reads 2 on a project the student has not touched at all. Gating the overlay on that raw count would mean it never shows. Count only what the student placed.

In `frontend/src/components/BlocklyWorkspace.js`:

1. Add a module-level helper beside the file's other top-level declarations:

```js
/* Scaffold, not content — a freshly seeded project must still read as "empty"
   even though its frame is already on the canvas (factory.js's
   PHYSICS_STARTER_XML / DS_STARTER_XML). Keep this set in sync with those
   two constants. */
const FRAME_BLOCK_TYPES = new Set(["sim_start_block", "sim_end_block", "ds_start_block"]);

function countContentBlocks(workspace) {
  return workspace.getAllBlocks(false).filter((b) => !FRAME_BLOCK_TYPES.has(b.type)).length;
}
```

2. Add `onBlockCountChange` to the component signature (line 274) and a ref beside the others (after line 285): `const onCountRef = useRef(onBlockCountChange); onCountRef.current = onBlockCountChange;`
3. Inside the change listener, after the existing `onChangeRef.current(xmlText, code);` call (line 377):

```js
        onCountRef.current?.(countContentBlocks(workspace));
```

4. And once at setup, after the initial `normalizeSimulationStructure(workspace)` call (line 384):

```js
    onCountRef.current?.(countContentBlocks(workspace));
```

- [ ] **Step 4: The ghost overlay**

Create `frontend/src/components/BlocklyEmptyState.js`:

```js
import React from "react";
import BeginnerGuide from "./BeginnerGuide";
import { AtomIcon, SpringIcon, GlobeIcon, TableIcon } from "./Icons";

/**
 * Shown over an empty block canvas. One line of guidance plus starter chips
 * that inject real block XML — the fastest path from "blank grid" to "there is
 * a sphere on my screen". Hidden the moment a block lands.
 *
 * pointer-events are off on the layer and back on for the chips, so a student
 * can still drag from the flyout straight through it.
 */
const CHIPS = {
  physics: [
    {
      id: "sphere",
      label: "A ball that falls",
      icon: AtomIcon,
      xml:
        '<block type="sphere_block">' +
        '<field name="NAME">ball</field>' +
        "</block>",
    },
    {
      id: "loop",
      label: "An animation loop",
      icon: SpringIcon,
      xml: '<block type="forever_block"><statement name="BODY"><block type="rate_block"><field name="FPS">100</field></block></statement></block>',
    },
    {
      id: "gravity",
      label: "Gravity",
      icon: GlobeIcon,
      xml: '<block type="physics_const_block"><field name="CONST">g</field></block>',
    },
  ],
  datascience: [
    { id: "load", label: "Load a dataset", icon: TableIcon, xml: '<block type="ds_load_builtin_block"><field name="ID">penguins</field></block>' },
    { id: "table", label: "Show the table", icon: TableIcon, xml: '<block type="ds_show_table_block"></block>' },
  ],
};

export default function BlocklyEmptyState({ goal = "physics", onInsert, checkpointState, onDismissTip }) {
  const chips = CHIPS[goal] || CHIPS.physics;
  return (
    <div className="blockly-empty" aria-live="polite">
      <div className="blockly-empty__inner">
        <p className="blockly-empty__lead">
          Drag a block from the toolbox on the left — or start with one of these.
        </p>
        <div className="blockly-empty__chips">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="blockly-empty__chip"
              onClick={() => onInsert?.(chip.xml)}
              title={`Add: ${chip.label}`}
            >
              <chip.icon size={14} />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
        <BeginnerGuide goal={goal} checkpointState={checkpointState} onDismiss={onDismissTip} />
      </div>
    </div>
  );
}
```

**Verify the four block types and their field names against `frontend/src/utils/blockly/blocklyGenerator.js` before writing this file** — `sphere_block`, `forever_block`, `rate_block`, `physics_const_block`, `ds_load_builtin_block` and `ds_show_table_block` must all exist with the field names used above (grep each `type` and read its `init`). If a field name differs, use the real one; if a block does not exist, drop that chip rather than inventing it. A chip that inserts nothing is worse than one fewer chip.

- [ ] **Step 5: Fix the misdirecting tip**

In `frontend/src/components/BeginnerGuide.js`, replace lines 6-8:

```js
    { id: "ph-run",   text: "Press Run in the toolbar to start your simulation." },
    { id: "ph-var",   text: "Open the Objects drawer to add balls, boxes and springs to your scene." },
    { id: "ph-trace", text: "Click Record in the Variables panel to capture data while simulating." },
```

Line 6 loses the `▶︎` character (UI quality standard: professional icons, not glyphs in copy). Line 7 now points at **Objects** (`toolbox.js:76`), where object blocks actually live.

- [ ] **Step 6: Wire it into the layout**

In `frontend/src/components/layout/IDELayout.js`:

1. State beside the other UI state: `const [blockCount, setBlockCount] = useState(null);` (`null` = not measured yet, so the overlay never flashes before Blockly reports).
2. An insert handler beside `handleWorkspaceChange`:

```js
  const handleInsertStarterBlock = useCallback((blockXml) => {
    const ws = workspaceRef.current;
    const Blockly = window.Blockly;
    if (!ws || !Blockly) return;
    try {
      const dom = Blockly.utils.xml.textToDom(
        `<xml xmlns="https://developers.google.com/blockly/xml">${blockXml}</xml>`,
      );
      Blockly.Xml.domToWorkspace(dom, ws);
      /* normalizeSimulationStructure (BlocklyWorkspace.js:196-232) adopts the
         new top-level block into the sim_start SETUP slot on the next change
         event, which is exactly where a beginner wants it. */
    } catch (err) {
      console.warn("Could not insert starter block:", err);
    }
  }, [workspaceRef]);
```

3. Wrap the editable workspace (lines 403-410) so the overlay can sit over it:

```jsx
                <div className="blockly-stage">
                  <BlocklyWorkspace
                    key={`ws-${workspaceReloadKey}`}
                    initialXml={workspaceXml}
                    onWorkspaceReady={sim.handleWorkspaceReady}
                    onWorkspaceChange={handleWorkspaceChange}
                    onBlockCountChange={setBlockCount}
                    isDark={isDark}
                    goal={goal}
                  />
                  {/* blockCount is the non-frame count BlocklyWorkspace reports via
                     countContentBlocks (Step 3) — a freshly seeded blank physics
                     project already carries sim_start_block + sim_end_block but
                     still reads 0 here, so the overlay renders directly over them. */}
                  {blockCount === 0 && (
                    <BlocklyEmptyState
                      goal={goal}
                      onInsert={handleInsertStarterBlock}
                      checkpointState={proj.activeManifest?.checkpointState}
                    />
                  )}
                </div>
```

- [ ] **Step 7: Style it**

Append to `frontend/src/styles.css`:

```css
/* ── Empty block canvas ── */
.blockly-stage { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.blockly-empty {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;   /* dragging from the flyout must still work */
  padding: var(--space-4, 16px);
}
.blockly-empty__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
  max-width: 460px;
  text-align: center;
}
.blockly-empty__lead {
  margin: 0;
  font-size: var(--fs-md, 13px);
  color: var(--text-dim);
}
.blockly-empty__chips { display: flex; flex-wrap: wrap; gap: var(--space-2, 8px); justify-content: center; }
.blockly-empty__chip {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  font-size: var(--fs-sm, 12px);
  color: var(--text);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius, 6px);
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition);
}
.blockly-empty__chip:hover { background: var(--card-bg-hover); border-color: var(--card-border-hover); }
.blockly-empty .beginner-guide { pointer-events: auto; }
```

- [ ] **Step 8: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **23 files / 202 tests** green. Then manually: create a blank physics project — `Simulation Start` / `Simulation End` are already on the canvas *and* the ghost overlay sits above them with three chips (the frame's two blocks do not count against the empty gate — Step 3); click "A ball that falls" — a sphere block appears, is adopted into SETUP, the non-frame count becomes 1, and the overlay disappears; delete the sphere block — the count returns to 0 and the overlay reappears; create a blank *code* project — no seeded XML, no overlay; create a DS project — the existing DS starter (`ds_start_block`, also frame-excluded) is untouched. Confirm you can still drag a block out of the flyout straight through the overlay area.

- [ ] **Step 9: Commit**

```powershell
git add frontend/src/utils/manifest frontend/src/components frontend/src/styles.css
git commit -m "feat(frontend): blank canvas empty state — sim_start pre-placed, starter chips, BeginnerGuide finally rendered"
```

---

### Task 12: Templates on the start-menu landing, and a Continue empty state

`StartMenu.js:356-378` renders three abstract goal cards, and `e2e/ux-start-menu.png` shows roughly 600px of empty space beneath them. The eight physics templates live at `:482-511`, reachable only through the Template `RadioCard` at `:468-478` — three clicks deep. `CARD_ICONS` at `:73-82` is already mapped for exactly this and is used only inside the wizard.

**Files:**
- Modify: `frontend/src/components/StartMenu.js`, `frontend/src/styles.css`

**Interfaces:**
- Consumes: `EXAMPLES` (4 code templates), `BLOCK_TEMPLATES` (4 block templates), `DS_TEMPLATES`, `HYBRID_TOPICS`, `CARD_ICONS`, and the existing `buildManifestSpec` — the landing cards call the **same** spec builder as the wizard, so a template opened from the landing is byte-identical to one opened three clicks deep.

- [ ] **Step 1: Surface the templates**

In `frontend/src/components/StartMenu.js`, add a landing-level template list beside `templatesForGoal` (after line 260):

```js
  /* The eight physics templates, surfaced on the landing instead of three
     clicks deep behind the wizard's Template radio. Same shape the wizard
     uses, so one card component renders both. */
  const featuredTemplates = useMemo(
    () => [
      ...BLOCK_TEMPLATES.map((t) => ({ id: t.id, title: t.title, description: t.description, kind: "blocks" })),
      ...EXAMPLES.map((e) => ({ id: e.id, title: e.title, description: e.description, kind: "code" })),
    ],
    [],
  );

  const openTemplate = (tpl) => {
    onCreate?.(
      buildManifestSpec({
        goal: "physics",
        title: "",
        startPath: "template",
        templateId: tpl.id,
        editor: tpl.kind === "code" ? "code" : "blocks",
      }),
    );
  };
```

Then, inside the non-wizard branch, after the `Create New` grid (line 378) add:

```jsx
              {/* Start from a worked example */}
              <p className="start-section-label">Start from a template</p>
              <div className="start-grid start-grid--templates">
                {featuredTemplates.map((tpl) => {
                  const Icon = CARD_ICONS[tpl.id] || (tpl.kind === "blocks" ? BlocksIcon : CodeIcon);
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      className="start-card start-card--template"
                      onClick={() => openTemplate(tpl)}
                    >
                      <div className="start-card-icon"><Icon size={20} /></div>
                      <div className="start-card-body">
                        <span className={`start-card-badge start-card-badge--${tpl.kind}`}>
                          {tpl.kind === "code" ? "Code" : "Blocks"}
                        </span>
                        <h3 className="start-card-title">{tpl.title}</h3>
                        <p className="start-card-desc">{tpl.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
```

- [ ] **Step 2: A Continue section that is never just absent**

Replace the `projectList.length > 0 &&` guard (lines 339-353) with a branch that always renders the section:

```jsx
              <p className="start-section-label">Continue</p>
              {projectList.length > 0 ? (
                <div className="start-project-list">
                  {projectList.map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      onOpen={() => onOpenProject?.(p.id)}
                      onDelete={() => onDeleteProject?.(p.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="start-empty">
                  Nothing saved yet. Pick a goal below to start from scratch, or open a template —
                  your work is saved on this computer automatically.
                </p>
              )}
```

- [ ] **Step 3: Style the two additions**

Append to `frontend/src/styles.css`, beside the existing `.start-grid` rules:

```css
.start-grid--templates {
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  margin-bottom: var(--space-6, 24px);
}
.start-card--template { align-items: flex-start; }
.start-card-badge--blocks {
  color: var(--mauve);
  background: color-mix(in srgb, var(--mauve) 14%, transparent);
}
.start-empty {
  margin: 0 0 var(--space-6, 24px);
  padding: var(--space-4, 16px);
  font-size: var(--fs-md, 13px);
  color: var(--text-dim);
  background: var(--card-bg);
  border: 1px dashed var(--card-border);
  border-radius: var(--radius, 6px);
}
```

(`.start-card-badge--code` already exists — it is used at `StartMenu.js:371`. Reuse it for the code kind; only the blocks variant is new.)

- [ ] **Step 4: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: 23 files / 202 tests green (no new tests: this is composition over existing, already-tested spec building). Then manually: a fresh browser profile shows `Continue` with the empty-state sentence, three goal cards, then eight template cards with their real icons; clicking `Projectile (Blocks Template)` opens exactly what the wizard's Template → Projectile path opens (compare the block counts); the empty space below the fold is gone.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/StartMenu.js frontend/src/styles.css
git commit -m "feat(frontend): templates surfaced on the start-menu landing; Continue gets an empty state"
```

---

### Task 13: Blockly — search inserts the block, zoom stays in sync, and there is a way back

Four bugs that share one theme: the block editor's affordances do not follow through.

- `BlocklyWorkspace.js:80` — the only action a search result takes is `openCategory(item.category)`, which opens a flyout that may hold 58 items with no indication of which one matched.
- `BlocklyWorkspace.js:355-361` explicitly discards `VIEWPORT_CHANGE`, so wheel zoom desyncs the toolbar readout — a fixed "90%" across every e2e screenshot.
- `BlocklyWorkspace.js:328` sets `controls: false`, so a student who scrolls their blocks off screen has no recovery affordance at all.
- `styles.css:2897` hides `.blocklyTreeIcon` unconditionally, so "Advanced" (`toolbox.js:329`) — the only collapsible category, holding 6 nested categories and 47 blocks — looks identical to the 9 leaf categories.

**Files:**
- Modify: `frontend/src/components/BlocklyWorkspace.js`, `frontend/src/components/layout/IDELayout.js`, `frontend/src/components/Icons.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `BlockSearch` inserts the matched block at the workspace centre and selects it, falling back to `openCategory` when insertion fails; `BlocklyWorkspace` gains `onScaleChange(pct)`; a `Fit` button in the block-search bar calling `zoomToFit()` + `scrollCenter()`; `MaximizeIcon` reused for Fit (already at `Icons.js:164`).

- [ ] **Step 1: Make search insert**

In `frontend/src/components/BlocklyWorkspace.js`, add beside `openCategory` (after line 53):

```js
  /**
   * Create the matched block at the centre of the current view and select it.
   * Falls back to opening its category — the old behaviour — when the block
   * cannot be constructed (a registry entry with no generator definition, or a
   * stock Blockly block that needs flyout context).
   */
  function insertBlock(item) {
    const ws = workspaceRef.current;
    const Blockly = window.Blockly;
    if (!ws || !Blockly) return false;
    try {
      const dom = Blockly.utils.xml.textToDom(
        `<xml xmlns="https://developers.google.com/blockly/xml"><block type="${item.type}"></block></xml>`,
      );
      const ids = Blockly.Xml.domToWorkspace(dom, ws);
      const block = ids && ids.length ? ws.getBlockById(ids[ids.length - 1]) : null;
      if (!block) return false;

      const metrics = ws.getMetricsManager?.().getViewMetrics(true);
      if (metrics) {
        const xy = block.getRelativeToSurfaceXY();
        block.moveBy(
          metrics.left + metrics.width / 2 - xy.x - 40,
          metrics.top + metrics.height / 2 - xy.y - 20,
        );
      }
      block.select();
      return true;
    } catch (e) {
      return false;
    }
  }
```

and change the result button's handler (line 80) to:

```jsx
                  onMouseDown={() => {
                    if (!insertBlock(item)) openCategory(item.category);
                    setQuery("");
                    setOpen(false);
                  }}
```

For physics projects `normalizeSimulationStructure` (`:196-232`) then adopts the new top-level block into the `sim_start` SETUP slot on the next change event — which is where a student searching for `sphere` wants it. For data-science projects `disableOrphanedBlocks` (`:242-261`) greys it until it is attached to the `ds_start_block` hat, which is the documented behaviour (`docs/product-contract.md:36`).

**Note the pre-existing bug this does not fix:** `openCategory` resolves by category *name* and swallows failures at `:52`, and five registry categories have no matching toolbox category, so 19 of 106 search results dead-end. Insertion now covers most of them; the registry/toolbox reconciliation is Tranche 3 and stays there.

- [ ] **Step 2: Keep the zoom readout honest**

In the change listener (lines 355-362), split `VIEWPORT_CHANGE` out of the ignore list:

```js
        if (event.type === Blockly.Events.VIEWPORT_CHANGE) {
          /* Wheel zoom is a real zoom — report it so the toolbar readout
             stops claiming a fixed 90%. Rounded, and compared before
             emitting, so setScale → VIEWPORT_CHANGE → setScale cannot loop. */
          const pct = Math.round(workspace.getScale() * 100);
          if (pct !== lastScaleRef.current) {
            lastScaleRef.current = pct;
            onScaleRef.current?.(pct);
          }
          return;
        }
        if (event.type === Blockly.Events.UI || event.type === "block_drag") {
          return;
        }
```

with, beside the other refs (after line 285):

```js
  const onScaleRef = useRef(onScaleChange);
  onScaleRef.current = onScaleChange;
  const lastScaleRef = useRef(null);
```

and `onScaleChange` added to the component signature (line 274).

In `frontend/src/components/layout/IDELayout.js`, pass it through — the setter already exists on the context:

```jsx
                    onScaleChange={setBlocklyZoom}
```

adding `setBlocklyZoom` to the `useSimulationContext()` destructure. `handleZoomChange` (`useSimulation.js:113-123`) writes the same integer back, so the round trip settles immediately.

- [ ] **Step 3: A way back — Fit to blocks**

In `BlockSearch`'s returned tree, add a button beside the search bar (after line 72's closing `</div>`):

```jsx
      <button
        type="button"
        className="block-search-fit"
        title="Fit all blocks on screen"
        aria-label="Fit all blocks on screen"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const ws = workspaceRef.current;
          if (!ws) return;
          try {
            ws.zoomToFit();
            ws.scrollCenter();
          } catch (e) {
            console.warn("Could not fit blocks to view:", e);
          }
        }}
      >
        <MaximizeIcon size={12} />
      </button>
```

with `MaximizeIcon` added to the `./Icons` import at line 8, and the wrapper at line 56 changed to `<div className="block-search block-search--with-fit">`. Both `zoomToFit()` and `scrollCenter()` are Blockly v11 core workspace APIs; `zoomToFit` also fires `VIEWPORT_CHANGE`, so the toolbar readout follows it for free thanks to Step 2.

Style it in `frontend/src/styles.css` beside the other `.block-search-*` rules:

```css
.block-search--with-fit { display: flex; align-items: center; gap: 4px; }
.block-search--with-fit .block-search-bar { flex: 1; min-width: 0; }
.block-search-fit {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius, 4px);
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition);
}
.block-search-fit:hover { color: var(--text-bright); border-color: var(--border-hl); }
```

- [ ] **Step 4: Give the Advanced drawer its chevron back**

Replace `frontend/src/styles.css` lines 2897-2899 with:

```css
/* Leaf categories have no disclosure state, so their icon slot is noise —
   but "Advanced" (toolbox.js:329) is collapsible and holds 6 nested
   categories / 47 blocks behind a row that looks identical to the 9 leaves.
   Hide the icon only where it means nothing. */
.blocklyTreeIcon {
  display: none !important;
}
.blocklyTreeIcon.blocklyTreeIconClosed,
.blocklyTreeIcon.blocklyTreeIconOpen {
  display: inline-block !important;
  width: 12px !important;
  height: 12px !important;
  margin-right: 6px !important;
  background-image: none !important;
  border-left: 4px solid var(--text-dim) !important;
  border-top: 4px solid transparent !important;
  border-bottom: 4px solid transparent !important;
  transition: transform 140ms ease !important;
}
.blocklyTreeIcon.blocklyTreeIconOpen { transform: rotate(90deg) !important; }
```

**Verification note:** the two class names are Blockly v11's collapsible-category icon classes. If the chevron does not appear, inspect the "Advanced" row's icon element in DevTools, read the actual class names, and substitute them — nothing else in this rule changes. The failure mode is benign: the icon stays hidden exactly as it is today, so this cannot regress.

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: 23 files / 202 tests green. Then manually: search `sphere` and press the result — a sphere block appears at the centre of the view, selected, adopted into SETUP, and the search box clears; wheel-zoom the canvas — the header readout tracks it and the slider thumb moves; drag the blocks far off screen and press **Fit** — everything returns, centred, at a sensible scale; the "Advanced" category shows a chevron that rotates when it opens, and the 9 leaf categories do not.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/components frontend/src/styles.css
git commit -m "feat(frontend): block search inserts the block; wheel zoom syncs the readout; Fit to blocks; Advanced drawer chevron"
```

---

### Task 14: Viewport plumbing — runtime handles, correct resize, live theme

`GlowCanvas.js` is 49 lines: an idle placeholder, a host div and a static hint. Everything real happens inside an iframe (`glowRunner.js:131-195`), so React can put nothing *in* the scene — but it can talk *to* it, and today it does not. Three consequences:

- `glowRunner.js:170-177` CSS-stretches the canvas to `100%/100% !important`; only Blockly has a `ResizeObserver` (`BlocklyWorkspace.js:430`). Dragging the divider scales the existing drawing buffer instead of reallocating it, and there is no `devicePixelRatio` handling at all — every simulation is soft on a Retina or a 1.25×-scaled Chromebook.
- `glowRunner.js:121-129` reads the theme **once**, inside `createRuntimeFrame`; `ThemeContext.js:24` sets the attribute on `documentElement`; nothing bridges them. Toggling mid-run leaves the viewport in the old theme while every pane around it rethemes instantly.
- `activeFrameWindow` (`glowRunner.js:12`) is module-private, so no UI can reach the scene — which is why greps for `fullscreen`, `resetCamera` and `autoscale` return no affordance anywhere in `frontend/src`.

This task is the plumbing. Task 15 is the UI it enables.

**Files:**
- Create: `frontend/src/utils/runner/__tests__/viewportTheme.test.js`
- Modify: `frontend/src/utils/runner/glowRunner.js`, `frontend/src/components/GlowCanvas.js`, `frontend/src/components/DebugMode.js`

**Interfaces:**
- Produces, from `glowRunner.js`: `VIEWPORT_THEME` (`{ dark: {bg, text, link}, light: {…} }` — the literals at `:127-129` factored out); `viewportStyleText(theme)` (pure, returns the `<style>` body); `getRuntimeWindow()`, `getRuntimeCanvas()`; `applyRuntimeTheme(isDark)`; `resizeRuntimeCanvas(cssWidth, cssHeight, dpr)`. Every runtime accessor returns `null`/`false` rather than throwing when nothing is running.
- **Deliberately not done here:** the review's "collapse the four background definitions to one" also touches `blockTemplates.js:287,703,1110` and `precodedExamples.js:17,127,226`, which is template surgery outside this tranche's bullets. The runtime's two themed backgrounds are unified and made live; the per-template hardcoded navies stay for Tranche 3.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/runner/__tests__/viewportTheme.test.js`:

```js
import { describe, test, expect } from "vitest";
import { VIEWPORT_THEME, viewportStyleText, GLOWSCRIPT_VERSION } from "../glowRunner";

describe("viewport theme", () => {
  test("both themes are complete and distinct", () => {
    for (const key of ["dark", "light"]) {
      expect(VIEWPORT_THEME[key]).toMatchObject({
        bg: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        text: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        link: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      });
    }
    expect(VIEWPORT_THEME.dark.bg).not.toBe(VIEWPORT_THEME.light.bg);
  });

  test("the style text carries the theme into every surface the scene paints", () => {
    const css = viewportStyleText(VIEWPORT_THEME.light);
    for (const part of ["html, body", "#glowscript-root", "#glowscript canvas"]) {
      expect(css).toContain(part);
    }
    // The background appears on body, the root, the host and the canvas.
    expect(css.split(VIEWPORT_THEME.light.bg).length - 1).toBeGreaterThanOrEqual(4);
    expect(css).toContain(VIEWPORT_THEME.light.link);
  });

  test("the pinned engine version is the one the URLs interpolate", () => {
    expect(GLOWSCRIPT_VERSION).toBe("3.2");
  });
});
```

- [ ] **Step 2: Factor the theme out and expose the runtime**

In `frontend/src/utils/runner/glowRunner.js`, replace the inline literals at lines 121-129 and the template `<style>` body at `:149-186` with a shared source:

```js
/** The two viewport themes. Deep-space black for dark, clean off-white for light. */
export const VIEWPORT_THEME = {
  dark:  { bg: "#040611", text: "#dde4f8", link: "#7db5ff" },
  light: { bg: "#f2f4f8", text: "#111827", link: "#1d4ed8" },
};

/** Pure: the runtime frame's stylesheet for a given theme. Injected at frame
 *  creation and re-injected on every theme toggle, so a running simulation
 *  rethemes with the panes around it instead of staying in the old theme. */
export function viewportStyleText({ bg, text, link }) {
  return `
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0;
        width: 100%; height: 100%;
        overflow: hidden;
        background: ${bg};
        color: ${text};
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
      }
      #glowscript-root { width: 100%; height: 100%; overflow: hidden; background: ${bg}; }
      #glowscript { width: 100%; height: 100%; background: ${bg}; }
      #glowscript canvas {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        background: ${bg};
        outline: none;
        border: none;
      }
      #glowscript-root * { color: ${text} !important; }
      #glowscript a { color: ${link} !important; }
      div[id="glowscript"] > div { font-family: system-ui, sans-serif !important; font-size: 12px !important; }
  `;
}

function currentViewportTheme() {
  const attr =
    document.documentElement.getAttribute("data-theme") ||
    document.body.getAttribute("data-theme") ||
    "dark";
  return attr === "light" ? VIEWPORT_THEME.light : VIEWPORT_THEME.dark;
}
```

`createRuntimeFrame` then writes `<style id="physide-theme">${viewportStyleText(currentViewportTheme())}</style>` — the `id` is what makes the live update possible — and everything else in that function is unchanged.

Append the runtime accessors at the end of the file:

```js
/* ── Parent → runtime handles ──────────────────────────────
   The scene lives in a separate document, so every accessor below is a
   capability check as much as a getter: nothing is running, the frame was
   torn down, or GlowScript never finished loading are all normal states,
   and every caller must be able to render a disabled control instead. */

/** The live runtime frame's window, or null. */
export function getRuntimeWindow() {
  return activeFrameWindow || null;
}

/** The <canvas> GlowScript draws into, or null. */
export function getRuntimeCanvas() {
  try {
    return activeFrameWindow?.document?.querySelector("canvas") || null;
  } catch {
    return null;   // cross-document access can throw if the frame was replaced
  }
}

/** Re-theme a RUNNING simulation in place. No reload, no lost run. */
export function applyRuntimeTheme(isDark) {
  const win = getRuntimeWindow();
  if (!win) return false;
  const theme = isDark ? VIEWPORT_THEME.dark : VIEWPORT_THEME.light;
  try {
    const styleEl = win.document.getElementById("physide-theme");
    if (styleEl) styleEl.textContent = viewportStyleText(theme);
    const scene = win.scene;
    if (scene && typeof win.vec === "function") {
      const n = (h) => parseInt(h, 16) / 255;
      scene.background = win.vec(n(theme.bg.slice(1, 3)), n(theme.bg.slice(3, 5)), n(theme.bg.slice(5, 7)));
    }
    return true;
  } catch (err) {
    console.warn("Could not retheme the running viewport:", err);
    return false;
  }
}

/** Reallocate the drawing buffer for a new CSS size at the display's pixel
 *  ratio. Without this the buffer is merely stretched on every divider drag,
 *  and a 1.25x Chromebook renders every simulation soft. */
export function resizeRuntimeCanvas(cssWidth, cssHeight, dpr = window.devicePixelRatio || 1) {
  const win = getRuntimeWindow();
  const canvas = getRuntimeCanvas();
  if (!win || !canvas || cssWidth < 1 || cssHeight < 1) return false;
  try {
    const scene = win.scene;
    if (scene && typeof scene.width === "number") {
      /* Preferred path: GlowScript owns the buffer and reallocates properly. */
      scene.width = Math.round(cssWidth);
      scene.height = Math.round(cssHeight);
    }
    const ratio = Math.min(dpr, 2);   // cap: a 3x buffer buys nothing here and costs frames
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    return true;
  } catch (err) {
    console.warn("Could not resize the runtime canvas:", err);
    return false;
  }
}
```

- [ ] **Step 3: Observe and react in GlowCanvas**

Rewrite `frontend/src/components/GlowCanvas.js`'s body to add the two effects, leaving the existing markup exactly as it is:

```js
import React, { useEffect, useRef } from "react";
import { applyRuntimeTheme, resizeRuntimeCanvas } from "../utils/runner/glowRunner";
import { useTheme } from "../contexts/ThemeContext";

function GlowCanvas({ running }) {
  const viewportRef = useRef(null);
  const { isDark } = useTheme();

  /* Keep the drawing buffer matched to the box, at the display's pixel ratio.
     Debounced ~100ms so a divider drag is one reallocation, not sixty. */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver !== "function") return undefined;
    let timer = null;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        resizeRuntimeCanvas(box.width, box.height);
      }, 100);
    });
    ro.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  /* Theme the LIVE frame — no reload, so a mid-run toggle keeps the run. */
  useEffect(() => {
    if (!running) return;
    applyRuntimeTheme(isDark);
  }, [isDark, running]);

  return (
    <div className="canvas-wrap">
      <div className="canvas-viewport" ref={viewportRef}>
        {/* …existing idle layer, #glowscript-host and controls hint, unchanged… */}
      </div>
    </div>
  );
}
```

(Keep the whole existing JSX inside `.canvas-viewport` — only the `ref` and the two effects are new. `useTheme()` is safe here: `ThemeProvider` wraps everything at `App.js:42`.)

- [ ] **Step 4: Reuse GlowCanvas in Debug Mode**

`DebugMode.js:337-345` hand-rolls a bare host div with no idle state and no hint, and labels it "3-D Simulation" against `IDELayout.js:488`'s "3D Viewport". Replace that block with `<GlowCanvas running={running} />` and change the label to `3D Viewport`. This is a five-line change that gives Debug Mode the resize and theme behaviour for free and removes a duplicated host.

If `.dm-glowhost`'s sizing rules conflict with `.canvas-wrap`, keep the `.dm-glowhost` wrapper as the outer element and put `<GlowCanvas>` inside it — do not restyle Debug Mode here.

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **24 files / 205 tests** green. Then manually: run a simulation, drag the divider slowly — the scene reflows crisply rather than stretching, and the console shows no resize warnings; on a HiDPI display, compare an object's edge before and after (it should be visibly sharper); toggle the theme **mid-run** — the viewport background follows within a frame and the simulation keeps running; enter Debug Mode with no simulation running — the idle card and hint are there, matching the main viewport.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/utils/runner/glowRunner.js frontend/src/utils/runner/__tests__ frontend/src/components/GlowCanvas.js frontend/src/components/DebugMode.js
git commit -m "feat(frontend): viewport plumbing — runtime handles, ResizeObserver with devicePixelRatio, live theme sync into the iframe"
```

---

### Task 15: The viewport camera cluster, a screenshot that captures pixels, and the scene caption

`GlowCanvas.js:37-41` and `styles.css:938-952`: the viewport's only chrome is a permanently-on, `pointer-events: none` caption. **A student who spins the camera off the object has no way back except Stop and Run, which restarts the simulation and loses the run.** And "Screenshot Viewport (.png)" (`useExport.js:110-135`) runs html2canvas over `#glowscript-host` (`:111`), which since the iframe refactor contains an `<iframe>` wrapping a WebGL canvas — html2canvas can rasterise neither, so it almost certainly yields a flat rectangle **while reporting success at `:130`**.

**Files:**
- Create: `frontend/src/utils/image.js`, `frontend/src/utils/__tests__/image.test.js`, `frontend/src/components/ViewportControls.js`
- Modify: `frontend/src/utils/runner/glowRunner.js`, `frontend/src/components/GlowCanvas.js`, `frontend/src/hooks/useExport.js`, `frontend/src/components/ChartOverlay.js`, `frontend/src/components/Icons.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `isUniformImageData(data)` (pure, `Uint8ClampedArray` → boolean); `captureRuntimeCanvas()` in `glowRunner` → `Promise<string|null>` (a PNG data URL, captured inside the frame's own `requestAnimationFrame`); `getSceneMeta()` → `{ title, caption }`; `<ViewportControls running />`; `CrosshairIcon`, `ScanIcon`, `FullscreenIcon`, `CameraIcon` added to `Icons.js`.

- [ ] **Step 1: Four inline SVG icons**

Add to `frontend/src/components/Icons.js`, in the file's existing style (`base` viewBox 24, `currentColor`, no fills unless deliberate):

```js
export const CrosshairIcon = ({ size } = {}) => (
  <svg {...sz(size)}><circle cx="12" cy="12" r="7"/><line x1="12" y1="1" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="1" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="23" y2="12"/></svg>
);

export const ScanIcon = ({ size } = {}) => (
  <svg {...sz(size)}><path d="M3 8V5a2 2 0 012-2h3"/><path d="M21 8V5a2 2 0 00-2-2h-3"/><path d="M3 16v3a2 2 0 002 2h3"/><path d="M21 16v3a2 2 0 01-2 2h-3"/><circle cx="12" cy="12" r="3"/></svg>
);

export const FullscreenIcon = ({ size } = {}) => (
  <svg {...sz(size)}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
);

export const CameraIcon = ({ size } = {}) => (
  <svg {...sz(size)}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
);
```

- [ ] **Step 2: Blank-capture detection (test first)**

Create `frontend/src/utils/__tests__/image.test.js`:

```js
import { describe, test, expect } from "vitest";
import { isUniformImageData } from "../image";

/** n RGBA pixels, all identical unless `spot` names one to change. */
function pixels(n, spot) {
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = 10; data[i * 4 + 1] = 10; data[i * 4 + 2] = 15; data[i * 4 + 3] = 255;
  }
  if (spot != null) data[spot * 4] = 200;
  return data;
}

describe("isUniformImageData", () => {
  test("a flat rectangle is uniform — this is the blank WebGL capture", () => {
    expect(isUniformImageData(pixels(64))).toBe(true);
  });

  test("one different pixel is enough to call it real", () => {
    expect(isUniformImageData(pixels(64, 30))).toBe(false);
  });

  test("degenerate inputs are treated as uniform (i.e. as a failure)", () => {
    expect(isUniformImageData(new Uint8ClampedArray(0))).toBe(true);
    expect(isUniformImageData(null)).toBe(true);
  });
});
```

Create `frontend/src/utils/image.js`:

```js
/**
 * A WebGL canvas without preserveDrawingBuffer reads back as a single flat
 * colour once the frame has been composited. That is indistinguishable from a
 * successful capture unless you look at the pixels — which is why the viewport
 * screenshot has been silently exporting an empty rectangle and reporting
 * success. Detecting it is the difference between a bug and an honest error.
 */
export function isUniformImageData(data) {
  if (!data || data.length < 8) return true;
  const [r, g, b, a] = [data[0], data[1], data[2], data[3]];
  for (let i = 4; i < data.length; i += 4) {
    if (data[i] !== r || data[i + 1] !== g || data[i + 2] !== b || data[i + 3] !== a) return false;
  }
  return true;
}
```

- [ ] **Step 3: Capture at the source**

Append to `frontend/src/utils/runner/glowRunner.js`:

```js
/**
 * Capture the live 3D scene as a PNG data URL, from the canvas itself rather
 * than through html2canvas (which can rasterise neither a cross-document
 * iframe nor WebGL pixels). Runs inside the FRAME's own requestAnimationFrame
 * so the read happens as close to a draw as the parent can arrange.
 *
 * Returns null when nothing is running or the read throws — the caller must
 * still verify the pixels, because a successful read can be a blank buffer.
 */
export function captureRuntimeCanvas() {
  const win = getRuntimeWindow();
  const canvas = getRuntimeCanvas();
  if (!win || !canvas) return Promise.resolve(null);
  return new Promise((resolve) => {
    const read = () => {
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("Could not read the runtime canvas:", err);
        resolve(null);
      }
    };
    try {
      if (typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(read);
      else read();
    } catch {
      read();
    }
  });
}

/** The scene's authored title and caption, if the program set them.
 *  precodedExamples.js:16,21 authors both; GlowScript renders them as sibling
 *  divs that this runtime's overflow:hidden pushes out of view. */
export function getSceneMeta() {
  const win = getRuntimeWindow();
  const clean = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 240) : "");
  try {
    return { title: clean(win?.scene?.title), caption: clean(win?.scene?.caption) };
  } catch {
    return { title: "", caption: "" };
  }
}
```

- [ ] **Step 4: Rewrite the screenshot export**

Replace `frontend/src/hooks/useExport.js` lines 109-135 with:

```js
  /* ── Export screenshot of 3D viewport ─────────────────────
     Captured from the runtime canvas (glowRunner.captureRuntimeCanvas), then
     VERIFIED: a WebGL read-back can succeed and still be a blank buffer, and
     reporting success on an empty PNG is worse than reporting failure. */
  const handleExportScreenshot = useCallback(async () => {
    const dataUrl = await captureRuntimeCanvas();
    if (!dataUrl) {
      setStatus({
        text: "Nothing to capture — press Run first, then take the screenshot while it is running.",
        type: "error",
      });
      return;
    }
    const name = await getExportName();
    if (!name) return;
    setStatus({ text: "Capturing screenshot...", type: "" });
    try {
      const ok = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const probe = document.createElement("canvas");
            probe.width = 32;
            probe.height = 32;
            const ctx = probe.getContext("2d");
            ctx.drawImage(img, 0, 0, 32, 32);
            resolve(!isUniformImageData(ctx.getImageData(0, 0, 32, 32).data));
          } catch {
            resolve(false);
          }
        };
        img.onerror = () => resolve(false);
        img.src = dataUrl;
      });
      if (!ok) {
        setStatus({
          text: "Screenshot came out blank — the 3D engine did not keep the last frame. Try again while the simulation is running.",
          type: "error",
        });
        return;
      }
      const link = document.createElement("a");
      link.download = `${name}.png`;
      link.href = dataUrl;
      link.click();
      setStatus({ text: `Screenshot saved as ${name}.png`, type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: "Screenshot failed", type: "error" });
    }
  }, [getExportName, setStatus]);
```

with `import { captureRuntimeCanvas } from "../utils/runner/glowRunner";` and `import { isUniformImageData } from "../utils/image";` added. html2canvas is no longer imported here; it remains a dependency for `pdfExport.js` and `ChartOverlay`.

- [ ] **Step 5: Fix ChartOverlay's PNG export while we are here**

`ChartOverlay.js:36-37` checks only for a **global** `window.html2canvas`, which `index.html` never loads — so the SVG fallback always runs, hardcoding `#0a0a0f` at `:50` (light-theme chart exports come out black) and leaving the `scale: 2` retina path at `:68` dead. Replace lines 35-37 with the same dynamic import `useExport.js:121-124` already uses, and read the background from the token:

```js
async function downloadPng(containerEl, filename) {
  const bg =
    getComputedStyle(document.documentElement).getPropertyValue("--bg-base").trim() || "#0a0a0f";
  const html2canvas =
    typeof window.html2canvas === "function"
      ? window.html2canvas
      : (await import("html2canvas")).default;
```

and change the two hardcoded `"#0a0a0f"` occurrences (`:50` and `:68`) to `bg`. The SVG fallback stays as the last resort but is now unreachable in practice.

- [ ] **Step 6: The camera cluster**

Create `frontend/src/components/ViewportControls.js`:

```js
import React, { useEffect, useState } from "react";
import { CrosshairIcon, ScanIcon, FullscreenIcon, CameraIcon } from "./Icons";
import { getRuntimeWindow, captureRuntimeCanvas } from "../utils/runner/glowRunner";

/**
 * Overlay camera cluster. Before this, recovering a camera that had been spun
 * off the object required Stop → Run, which restarts the simulation and loses
 * the run.
 *
 * Every action is capability-checked against the live GlowScript scene: if the
 * runtime is not there or does not expose what an action needs, the button is
 * disabled with a plain-English title rather than failing silently.
 */
function withScene(fn) {
  const win = getRuntimeWindow();
  if (!win || !win.scene) return false;
  try {
    fn(win.scene, win);
    return true;
  } catch (err) {
    console.warn("Viewport control failed:", err);
    return false;
  }
}

export default function ViewportControls({ running, hostRef, onStatus }) {
  const [ready, setReady] = useState(false);

  /* The scene appears a moment after `running` flips — poll briefly rather
     than reaching into the runtime's load sequence. */
  useEffect(() => {
    if (!running) { setReady(false); return undefined; }
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      const win = getRuntimeWindow();
      if (win?.scene) { setReady(true); clearInterval(id); }
      else if (tries > 40) clearInterval(id);   // ~6s, then give up quietly
    }, 150);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return null;

  const disabledTitle = ready ? null : "Waiting for the 3D engine…";

  const actions = [
    {
      key: "reset",
      icon: CrosshairIcon,
      label: "Reset camera",
      run: () =>
        withScene((scene, win) => {
          if (typeof win.vec === "function") {
            scene.forward = win.vec(0, 0, -1);
            scene.up = win.vec(0, 1, 0);
          }
        }),
    },
    {
      key: "fit",
      icon: ScanIcon,
      label: "Fit scene to view",
      run: () => withScene((scene) => { scene.autoscale = true; }),
    },
    {
      key: "fullscreen",
      icon: FullscreenIcon,
      label: "Fullscreen viewport",
      run: () => {
        const el = hostRef?.current;
        if (!el) return false;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else el.requestFullscreen?.();
        return true;
      },
    },
    {
      key: "shot",
      icon: CameraIcon,
      label: "Copy a snapshot to a new tab",
      run: async () => {
        const url = await captureRuntimeCanvas();
        if (!url) return false;
        const w = window.open();
        if (w) w.document.write(`<img src="${url}" alt="Simulation snapshot" style="max-width:100%">`);
        return Boolean(w);
      },
    },
  ];

  return (
    <div className="canvas-controls" role="group" aria-label="Viewport camera controls">
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          className="canvas-control"
          disabled={!ready && a.key !== "fullscreen"}
          title={(!ready && a.key !== "fullscreen" && disabledTitle) || a.label}
          aria-label={a.label}
          onClick={async () => {
            const ok = await a.run();
            if (!ok) onStatus?.({ text: `${a.label} is not available for this simulation.`, type: "error" });
          }}
        >
          <a.icon size={14} />
        </button>
      ))}
    </div>
  );
}
```

**Verification requirement:** `scene.forward`, `scene.up`, `scene.autoscale` and `window.vec` are the GlowScript 3.2 VPython surface, but the review's viewport lens could not run a live browser pass, so **these four property names must be confirmed in DevTools against a running simulation before this task is signed off** (open the runtime iframe's console and evaluate `scene.forward`, `scene.autoscale`, `typeof vec`). If a name differs, correct it here; if a capability is genuinely absent, delete that action rather than shipping a button that does nothing. The `withScene` wrapper guarantees a wrong guess degrades to a disabled control plus a status line, never a crash.

- [ ] **Step 7: The scene caption strip**

In `frontend/src/components/GlowCanvas.js`, add the cluster and the caption:

```js
  const [sceneMeta, setSceneMeta] = useState({ title: "", caption: "" });

  /* precodedExamples.js authors explanatory scene.title / scene.caption text
     that the runtime's overflow:hidden pushes out of view. Read it back and
     render it in React chrome instead of losing it. */
  useEffect(() => {
    if (!running) { setSceneMeta({ title: "", caption: "" }); return undefined; }
    const id = setTimeout(() => setSceneMeta(getSceneMeta()), 700);
    return () => clearTimeout(id);
  }, [running]);
```

and inside `.canvas-viewport`, after the host div:

```jsx
        <ViewportControls running={running} hostRef={viewportRef} onStatus={onStatus} />
```

with the caption below the canvas, inside `.canvas-wrap`:

```jsx
      {(sceneMeta.title || sceneMeta.caption) && (
        <div className="canvas-caption">
          {sceneMeta.title && <strong>{sceneMeta.title}</strong>}
          {sceneMeta.caption && <span>{sceneMeta.caption}</span>}
        </div>
      )}
```

`.canvas-wrap` is `flex-direction: row` (`styles.css:960-967`) — change it to `column` and give `.canvas-viewport` `flex: 1` so the caption strip sits beneath the canvas. Pass `onStatus={setStatus}` down from `IDELayout` (it already has `setStatus` from Task 3).

Add to `frontend/src/styles.css`:

```css
/* ── Viewport camera cluster ── */
.canvas-controls {
  position: absolute;
  top: var(--space-2, 8px);
  right: var(--space-2, 8px);
  z-index: 3;
  display: flex;
  gap: 2px;
  padding: 2px;
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius, 6px);
  box-shadow: var(--shadow);
}
.canvas-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--text-dim);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  transition: color var(--transition), background var(--transition);
}
.canvas-control:hover:not(:disabled) { color: var(--text-bright); background: var(--bg-hover); }
.canvas-control:disabled { opacity: 0.4; cursor: default; }
@media (pointer: coarse) { .canvas-control { width: 32px; height: 32px; } }

/* ── Authored scene title / caption ── */
.canvas-caption {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2, 8px) var(--space-3, 12px);
  font-size: var(--fs-sm, 12px);
  color: var(--text-dim);
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  max-height: 5.5em;
  overflow-y: auto;
}
.canvas-caption strong { color: var(--text); font-weight: 600; }
```

- [ ] **Step 8: Auto-fade the permanent hint**

`GlowCanvas.js:38` and `styles.css:938`: the drag/wheel/pan caption sits permanently over the bottom-right of every simulation. Hide it after the first pointer interaction or 6 seconds:

```js
  const [hintVisible, setHintVisible] = useState(true);
  useEffect(() => {
    if (!running) { setHintVisible(true); return undefined; }
    const el = viewportRef.current;
    const hide = () => setHintVisible(false);
    const id = setTimeout(hide, 6000);
    el?.addEventListener("pointerdown", hide, { once: true });
    return () => {
      clearTimeout(id);
      el?.removeEventListener("pointerdown", hide);
    };
  }, [running]);
```

and gate the existing element on `running && hintVisible`.

- [ ] **Step 9: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: **25 files / 208 tests** green. Then manually, on a running projectile template: spin the camera away and press **Reset camera** — the view returns without restarting; press **Fit scene** — the whole scene is framed; press **Fullscreen** — the viewport fills the screen and Escape returns; press **Snapshot** — a new tab shows the actual scene, not a flat rectangle. Then File → *Screenshot Viewport (.png)* while running — the saved PNG shows the scene; press it while **stopped** — a clear error, not a success toast and an empty file. Open a `precodedExamples` template — its authored title and caption appear in the strip beneath the canvas. Export a chart PNG in light mode — the background is light, not black. The drag/wheel hint fades after ~6s or on first interaction.

- [ ] **Step 10: Commit**

```powershell
git add frontend/src/utils frontend/src/components frontend/src/hooks/useExport.js frontend/src/styles.css
git commit -m "feat(frontend): viewport camera cluster, verified canvas screenshot, themed chart export, authored scene caption"
```

---

### Task 16: A `booting` phase between Run and the first frame

`useSimulation.js:55-61` sets `running = true` **before** `await runPython`, and `GlowCanvas.js:35` hides the idle layer immediately — so pressing Run replaces the only guidance on screen with a blank rectangle for however long six CDN scripts take to load and compile. Students click Run repeatedly because nothing acknowledges the first click.

**Files:**
- Modify: `frontend/src/contexts/SimulationContext.js`, `frontend/src/hooks/useSimulation.js`, `frontend/src/components/GlowCanvas.js`, `frontend/src/components/layout/IDELayout.js`, `frontend/src/styles.css`

**Interfaces:**
- Produces: `booting` / `setBooting` on `SimulationContext`; `useSimulation()` returns `booting`; `<GlowCanvas running booting />`.
- **Not in scope:** the idle layer's `opacity: 0.18` contrast failure (`styles.css:907-913`, ~1.15:1 in both themes) belongs to Tranche 1's viewport-idle item. The booting overlay below therefore sets its own colours explicitly instead of inheriting that opacity.

- [ ] **Step 1: Add the phase**

In `frontend/src/contexts/SimulationContext.js`, beside the simulation flags (line 38):

```js
  /* True from the moment Run is pressed until the runtime has loaded and
     compiled. `running` flips immediately (the UI must disable Run), so
     without this there is no state that means "asked, not yet drawing". */
  const [booting, setBooting] = useState(false);
```

and add `booting, setBooting,` to the context `value` beside `running`.

In `frontend/src/hooks/useSimulation.js`, pull `setBooting` from the context destructure and wrap the run:

```js
  const handleRun = useCallback(async () => {
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    setStatus({ text: "Starting simulation…", type: "" });
    setRunning(true);
    setBooting(true);
    setPaused(false);
    setTraceData(new Map());
    try {
      stopPython(GLOWSCRIPT_HOST_ID);
      await runPython(code, GLOWSCRIPT_HOST_ID);
      syncBreakpointsToIframe(breakpointsRef.current);
      setStatus({
        text: debugMode ? "Debug simulation started" : "Simulation started",
        type: "success",
      });
    } catch (err) {
      console.error(err);
      setRunning(false);
      setStatus({ text: err.message || "Runtime error", type: "error" });
    } finally {
      setBooting(false);
    }
  }, [mode, pythonCode, syncFromBlocks, debugMode, breakpointsRef, setRunning, setBooting, setPaused, setStatus, setTraceData]);
```

Also add `setBooting(false)` to `handleStop` (line 75-79) and `handleResetToBlocks` (`:82-91`), and return `booting` from the hook (beside `running`, line 275).

- [ ] **Step 2: Acknowledge the click**

In `frontend/src/components/GlowCanvas.js`, accept `booting` and keep the idle layer beneath a spinner while it is true:

```jsx
        {(!running || booting) && (
          <div className="canvas-idle">
            {/* …existing idle inner, unchanged… */}
          </div>
        )}
        {booting && (
          <div className="canvas-booting" role="status">
            <span className="canvas-booting__spinner" aria-hidden="true" />
            <span className="canvas-booting__label">Starting simulation…</span>
          </div>
        )}
```

and pass it through from `IDELayout.js` at all three `<GlowCanvas>` call sites: `<GlowCanvas running={running} booting={sim.booting} onStatus={setStatus} />`.

- [ ] **Step 3: Style it**

Append to `frontend/src/styles.css`:

```css
/* ── Boot acknowledgement — the gap between Run and the first frame ── */
.canvas-booting {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3, 12px);
  background: color-mix(in srgb, var(--canvas-bg) 82%, transparent);
  pointer-events: none;
}
.canvas-booting__spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border-hl);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: canvas-boot-spin 800ms linear infinite;
}
.canvas-booting__label {
  font-size: var(--fs-md, 13px);
  color: var(--text-dim);
}
@keyframes canvas-boot-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .canvas-booting__spinner { animation: none; border-top-color: var(--accent); }
}
```

- [ ] **Step 4: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: 25 files / 208 tests green. Then manually, with the network throttled to Slow 3G in DevTools: press Run — the spinner and "Starting simulation…" appear immediately over the idle card, the status bar reads `Starting simulation…`, and both clear the moment the scene appears. Break the connection entirely and press Run — the booting overlay clears and the error banner from Task 10 explains what happened; the overlay never sticks. Confirm the spinner is still when `prefers-reduced-motion` is set.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/contexts/SimulationContext.js frontend/src/hooks/useSimulation.js frontend/src/components frontend/src/styles.css
git commit -m "feat(frontend): booting phase between Run and the first frame — the first click is acknowledged"
```

---

### Task 17: Wrap-up — docs, the full sweep, and the e2e pass

**Files:**
- Modify: `README.md`, `docs/e2e-checklist.md`

- [ ] **Step 1: Correct README §8**

`README.md:336-348`. Replace the three Global rows (lines 340-342) with what is now true:

```markdown
| Global | Ctrl+Enter | Run simulation |
| Global | F5 | Run simulation |
| Global | Esc | Stop simulation |
| Global | Ctrl+S | Save the project |
```

The `Ctrl+S | Export as Python (.py)` and `Ctrl+C | Copy code to clipboard` rows are deleted: Ctrl+S now saves, and there is no keyboard binding for copying code (Ctrl+C must keep copying selected text; Ctrl+Shift+C is claimed by the browser's element inspector). Export lives in the header's **File** menu.

- [ ] **Step 2: Add the tranche paragraph to README**

Immediately after the sync paragraph added by Plan 4 (the one beginning "Signed-in work now syncs"), add:

```markdown
The IDE shell is one 44px header: the project name is shown and renamed by clicking it, actions
sit in three zones (run · view · file), and the account menu routes to your classes and profile
without leaving the editor. Below 1280px the secondary controls become icons and below 1120px they
move into an overflow menu, so nothing disappears on a projector or a Chromebook — the supported
floor is a 1024px viewport. Keyboard: **Ctrl+Enter** or **F5** runs, **Esc** stops, **Ctrl+S**
saves. Layout (split, viewport visibility, zoom) and the project you had open survive a reload.
A blank physics project opens on a simulation frame with one-click starter blocks; the 3D viewport
has camera controls (reset · fit · fullscreen · snapshot), reallocates its buffer at your display's
pixel ratio, and follows the theme without restarting the run.
```

- [ ] **Step 3: Note the e2e reality in the checklist**

In `docs/e2e-checklist.md`, under "How to run", replace the two output lines with:

```markdown
Automated results: `frontend/e2e/results.json`
Screenshots: `frontend/e2e/*.png` — **untracked build artifacts** (`.gitignore:23` ignores `e2e/`
at any depth). They are documentation you regenerate, not fixtures you commit; a UI change does not
"invalidate" anything in git. Note that `scripts/e2e-test.mjs` resolves its output to
`frontend/e2e/`, while older runs left artifacts at the repository root `e2e/`.
UX report: `docs/ux-audit.md`
```

- [ ] **Step 4: Regenerate the e2e artifacts and review them**

This is the single end-of-tranche screenshot pass the product owner asked for. It is a **verification gate, not a commit** — see the stale-citation note at the top of this plan.

```powershell
# terminal 1
npm run dev
# terminal 2
node frontend/scripts/e2e-test.mjs
node frontend/scripts/ux-audit.mjs
```

Expected: the suite exits 0. Review every regenerated PNG against the tranche's changes — in particular `A1-bootstrap`, `A2-physics-blank-blocks` (the starter frame and ghost overlay must be visible), `A11-toolbar-before`/`A11-toolbar-after` (now the merged header), `A12-export-dropdown` (now the **File** menu, 9 items), `A5-physics-running` (camera cluster present), `ux-start-menu` (templates on the landing, no dead space) and `ux-toolbox-physics` (Advanced chevron, Fit button).

If a check fails because it selects a control by an old label — `Reset`, `Export`, `Import`, `Open…` — **update the selector in `frontend/scripts/e2e-test.mjs` to the new label** (`Back to Blocks`, `File`) and rerun. That script edit *is* committed. Do not weaken an assertion to make it pass.

Run `git status` afterwards and confirm no `*.png` is staged: if any appears, the ignore rule has been changed and that change is out of scope.

- [ ] **Step 5: The full verification sweep**

```powershell
npm run test
npm run check:blocks
npm run build -w frontend
npm run typecheck -w backend
npm run typecheck -w shared
```

Expected: every workspace green, registry OK, build clean, typechecks silent. Frontend: **25 test files / 208 tests** (from a 13/152 baseline). Record the exact totals in the commit body if they differ — a drift means a task was implemented differently and the difference is worth naming.

- [ ] **Step 6: Manual acceptance pass at the stated floor**

With the browser at exactly **1024 × 768**, walk the first ten minutes of a student's experience:

1. Fresh profile → start menu shows Continue's empty state, three goals, eight templates.
2. Create a blank physics project → the header names it; the canvas shows the simulation frame plus starter chips; the status bar says it is saved on this computer.
3. Rename the project in the header → the name updates in the header, the status bar and the start-menu list.
4. Click a starter chip → a block appears and the overlay goes.
5. Ctrl+Enter → the boot spinner, then the scene; the camera cluster works; Escape stops it.
6. Ctrl+S → `Saved “…”`, no browser dialog.
7. Toggle the theme mid-run → everything including the viewport rethemes.
8. Resize to 1120px and 1280px → the collapse stages behave; nothing is unreachable.
9. Reload → the project reopens with the same split, zoom and viewport state.
10. In DevTools device emulation (iPad) → both dividers drag, no control is smaller than 24px.

- [ ] **Step 7: Commit**

```powershell
git add README.md docs/e2e-checklist.md frontend/scripts/e2e-test.mjs
git commit -m "docs: interaction upgrades in the README quickstart; e2e artifacts are untracked, selectors follow the new header"
```

---

## Completion criteria (what Tranche 3 may assume)

- **Toolchain.** Vitest transforms JSX inside `frontend/src/**/*.js`. `frontend/src/test/renderHelpers.js` provides `mountComponent` / `click` / `mouseDown` / `keyDown` / `byText` / `byTitle`, with **no testing-library dependency**, and `setupTests.js` stubs `matchMedia`. Any component may now be tested; Tranche 3 has no excuse for shipping a UI change untested.
- **Named modules exist at these paths:** `utils/hotkeys.js`, `utils/layoutPrefs.js`, `utils/relativeTime.js`, `utils/image.js`, `hooks/useHotkeys.js`, `hooks/useMediaQuery.js`, `components/common/Overlay.js`, `components/common/DropdownMenu.js`, `components/layout/ProjectTitle.js`, `components/layout/SaveState.js`, `components/layout/RunErrorBanner.js`, `components/BlocklyEmptyState.js`, `components/ViewportControls.js`, `components/auth/HeaderAccount.js`.
- **glowRunner exports a parent→runtime surface:** `GLOWSCRIPT_VERSION`, `VIEWPORT_THEME`, `viewportStyleText`, `getRuntimeWindow`, `getRuntimeCanvas`, `applyRuntimeTheme`, `resizeRuntimeCanvas`, `captureRuntimeCanvas`, `getSceneMeta` — all capability-checked and null-safe. Tranche 3's debugger work (pause acknowledgement, breakpoint seeding, `onerror` on the frame) builds on these rather than reaching into module state.
- **The shell is one 44px header** (`.app-header`) with identity + three zones + account; `.titlebar` and its rules are gone; the status bar is a quiet 26px strip on `--bg-surface` carrying project · save state · run status; `--bg-statusbar` is deleted (Task 8, Step 6), along with the seven other deprecated alias tokens Plan 1 marked but left standing (`--bg-app`, `--border-hard`, `--border-soft`, `--text-primary`, `--text-secondary`, `--fg`, `--fg-muted`) — every consumer now reads the canonical token directly.
- **Every advertised shortcut fires:** Ctrl/Cmd+Enter and F5 run, Escape stops, Ctrl/Cmd+S saves. Nothing in the product, the Help page or the README claims a shortcut that does not exist.
- **State survives a reload:** split, viewport visibility, Blockly zoom and the open project. `hooks/useLocalStorage.js` finally has consumers.
- **Every drag handle is a Pointer Events separator** with keyboard resize and a coarse-pointer size bump; the supported floor is 1024px and the header degrades in two stages above it.
- **The four dialogs share `<Overlay>`**; no `window.alert` remains in `frontend/src` outside `dialogService`'s documented fallback; runtime errors persist in a dismissible banner rather than being overwritten by the next status string.
- **The blank canvas, the start-menu landing, the boot gap and the idle viewport all say something.** `BeginnerGuide` is rendered; its Objects/Variables misdirection is corrected; blank physics projects open on a `sim_start`/`sim_end` frame.
- **Blockly:** search inserts and selects the block, wheel zoom and the header readout agree, `Fit to blocks` exists, and the Advanced drawer is visually distinguishable from the nine leaf categories.
- **The viewport:** camera cluster, `ResizeObserver` + `devicePixelRatio`, live theme sync, a screenshot that verifies its own pixels, and the authored `scene.title`/`scene.caption` surfaced in React chrome.
- **Specifically for [Plan 3 — Deeper Mechanics](2026-08-20-ide-modernization-03-deeper-mechanics.md), which declares a dependency on this tranche:** the `Toolbar` restructure it adds its debug group to is Task 7's zoned header — its group belongs in `app-header__zone--view` and, if collapsible, in Task 9's `secondaryActions` array; the component-probe layer it extends is Task 2's `renderHelpers.js`; the `.debug-drawer` it revives is still present and its `onToggleTrace` prop and `.tb-btn--active` rule are deliberately preserved (Task 9, Step 3); and `DebugMode.js`, which it deletes, has been touched only surgically here.
- **Still open, unchanged, for Plan 3 or later:** block and category colour (`BLOCK_PALETTE`, AA contrast), toolbox integrity and registry reconciliation, connection type checks, orphan-block handling, every debugger-truthfulness item, `helpUrl`, Debug Mode re-homing, the CSS `@import` split, bundling Blockly and vendoring GlowScript (approved, Plan 3) — and self-hosting Monaco and the two fonts, which remain genuinely undecided.
