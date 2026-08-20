# IDE Modernization — Plan 1: Visual Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tranche 1 of the IDE deep review delivered: one token system, one set of primitives, and one label voice shared by the IDE core AND the platform screens — so the product stops reading as two apps stitched together. Colour becomes correct in both themes (today the entire debug/trace region has *no* light-theme behaviour), keyboard users get a focus ring for the first time in 4,496 lines, the IDE gains a primary action, and the viewport's only first-run instruction stops rendering at ~1.15:1 contrast. No behaviour changes, no new components, no new dependencies — this tranche is deliberately reviewable by looking at it.

**Architecture:** `frontend/src/styles.css` gains a third `:root` block *above* the two theme blocks holding every theme-independent primitive (space ramp, type scale, radii, motion, control metrics, focus geometry, micro-label system). The two existing theme blocks keep colour only, and their duplicated literals collapse: `#007acc` appears exactly twice in the finished file (the two `--accent` definitions) and every other accent surface derives from it via `var()`/`color-mix()`. Four style primitives — `.btn`, `.card`, `.panel-header`, plus the global `:focus-visible` ring — are extracted from the rules that already exist and adopted by both halves through comma-appended selector aliases, so **no component markup changes in this tranche**. The rogue Tailwind-400 palette hardcoded through the debug/trace/data-science regions is mapped onto the existing semantic colour tokens, which is also what gives those regions light-theme behaviour for free.

**Tech Stack:** existing only (React 18, Vite, plain JavaScript, one global CSS file, Vitest 4). **No new dependencies.** No CSS framework, no preprocessor, no CSS-module split (the `@import` split is a Tranche 3 item).

**Spec:** [docs/superpowers/reviews/2026-08-19-ide-deep-review.md](../reviews/2026-08-19-ide-deep-review.md) — "Suggested modernization roadmap → Tranche 1 — Visual foundation", plus Quick wins 1, 2, 3, 4, 6, 14, 15 and the CSS half of 16. The review's per-section proposal tables carry the evidence for every edit below; line numbers in this plan are re-verified against `feature/classroom-platform` at `f8b1b22` and supersede the review's (which were taken at `10f8a9d`).

## Global Constraints

- **The product owner's design ruling (review open Q1/Q2), already settled — do not reopen.** The VS-Code-like professional-tool identity **stays**, toned to a new middle shared with the platform screens. KEEP: the status bar as a concept, the three-pane editor density, disciplined pane headers, the dark-first editor feel. RETIRE: the fake-titlebar theatrics (Tranche 2 owns the merged header), the hard-coded `#007acc` (becomes a semantic accent token, this plan), and the full-uppercase letterspaced headers (softened to ONE system — sentence case, medium tracking, semibold — driven by four tokens, this plan). Both halves converge on one token system; neither side is adopted wholesale.
- **UI quality standard (standing rule):** no emojis in product UI, professional inline-SVG icons only, high polish bar.
- **No markup changes.** Every primitive is introduced as a comma-appended selector alias on the classes that already exist. `.js` files are touched in exactly two places in this plan, both deletions of provably-dead code (Task 12). If a task tempts you to edit JSX, it is out of scope.
- **`--radius` deliberately moves 4px → 6px and `--radius-lg` 8px → 10px** (review open Q(a), confirmed). This changes the silhouette of every surface that already uses the token — that is the point.
- **The 2px coloured pane-header stripes STAY** (`.pane-header--blocks/--code/--viewport`). Review open Q(b) was never answered, so the conservative reading of "disciplined pane headers stay" applies; retiring them needs its own decision.
- **Dark-first with a light block.** Theme-independent tokens (space/type/radius/motion/metrics) live in a new `:root` block and are declared **once**. A colour token whose value is a `var()` or `color-mix()` of another token is also declared once — it re-resolves per theme automatically. Only literal colour values are duplicated into `[data-theme="light"]`.
- **`rgba(255, 255, 255, …)` below the token blocks is a bug by construction.** After Task 4 there are zero of them; the wrap-up sweep asserts it.
- **Frontend stays plain JavaScript; tests stay pure-module.** There are 13 `*.test.js` files, none of which selects by className or renders for style assertions (verified: `grep -rln "className\|querySelector" frontend/src --include=*.test.js` is empty), so CSS refactors carry no test risk — and conversely, **CSS work is not test-verifiable**. Every task's automated gate is `npm run test -w frontend` + `npm run build -w frontend` + a `git grep` assertion; the *visual* verification is the controller's browser pass at the end of the tranche.
- **Minimum supported viewport is 1024px** (review open Q7, settled). This tranche only needs to not regress below it — no new `@media` rules, no responsive work. That is Tranche 2.
- **Every task commits on `feature/classroom-platform`.** Ports 3000/4000/5433 unchanged. Backend and shared are not touched by this plan.

**Deferred (in the review, deliberately NOT here — do not flag as missing):** self-hosting Inter/JetBrains Mono (review open Q(c), unanswered — the duplicate Inter `<link>` at `frontend/index.html:12` is deleted here, the `@import` at `styles.css:5` stays); the CSS `@import` file split (Tranche 3); `BlocklyWorkspace.js:110,134` `cursorColour: "#007acc"` and the hand-copied `componentStyles` hexes at `:99-141` (needs `getComputedStyle` at inject — Tranche 3's "read tokens at inject time"); the 16 Blockly category hues in `toolbox.js` and the 12 block hue integers (Tranche 3's `BLOCK_PALETTE`); `GravityPlayground.js:4`'s five pastel particle hexes (JS array, Tranche 3 palette module); Blockly `fontStyle.size` 11 → 13 and `isDark`-at-inject (JS, Tranche 2/3); the `.tb-label` flyout-header rules (Blockly-layer, Tranche 3); `.admin-table` overflow container and any `@media` work (Tranche 2); the status bar's *content* and its 26px height (Tranche 2 — this plan only de-blues its surface); `.debug-drawer` (Tranche 3 revives it — do not delete it); `.tb-btn--active` and the dead Trace toggle (Tranche 2 decides wire-or-delete); the `HelpPage.js` documentation corrections (Quick win 18 — prose, not visual foundation); three of the review's six proposed primitives — `.input` (from `.vdialog-input` + `.auth-input`), `.tabs`/`.tab` (from `.admin-tabs`/`.admin-tab`) and `.alert` (from `.auth-error`) — plus `.prose` (from `.auth-text`) and the role-renaming proposal that goes with them (`auth-input`→`input`, `admin-tabs/tab`→`tabs/tab`, `auth-error`→`alert alert--error`, `auth-text`→`prose`); this tranche extracts only `.btn`, `.card` and `.panel-header` (Tasks 5, 7, 8) — the remaining four are not scheduled in any of the three tranches yet and need an owner assigned before implementation.

---

### Task 1: The token layer

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Produces: a new theme-independent `:root` block (lines inserted after the `@import` at `:5`) exporting `--space-0…--space-8`, `--fs-2xs…--fs-hero`, `--lh-tight/--lh-normal`, `--fw-regular/--fw-medium/--fw-semibold/--fw-bold`, `--label-transform/--label-tracking/--label-weight/--label-fs`, `--radius-sm/--radius/--radius-lg/--radius-pill`, `--transition-fast/--transition/--transition-slow`, `--font/--mono`, `--control-h-sm/--control-h/--control-h-lg`, `--btn-pad-sm/--btn-pad/--btn-pad-lg/--btn-fs`, `--toolbar-h/--titlebar-h/--statusbar-h/--activitybar-w/--sidebar-w/--panel-header-h/--panel-header-h-compact/--pane-header-h`, `--focus-ring-width/--focus-ring-offset`, `--on-accent`.
- Produces (theme blocks): `--focus-ring-color`, `--shadow-sm`, `--scrollbar-thumb`, `--btn-primary-bg`, `--btn-primary-bg-hover`, `--label-color`.
- Produces (behaviour): `#007acc` and `rgba(0, 122, 204, …)` no longer appear anywhere in `styles.css` except the two `--accent` declarations.
- Consumes: nothing. **Every later task in this plan consumes this one.**

- [ ] **Step 1: Insert the theme-independent primitives block**

In `frontend/src/styles.css`, insert the following immediately after the `@import url(...)` line at `:5` and before the `/* ── Dark theme (default) …` comment at `:7`:

```css

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS — theme-independent primitives
   Space, type, radius, motion, control metrics, focus geometry
   and the micro-label system. Nothing in this block changes
   between light and dark; every colour token lives in the two
   theme blocks below.
   ═══════════════════════════════════════════════════════════ */
:root {
  /* ── Space ramp (4px base) ─────────────────────────────── */
  --space-0:  0;
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-7:  32px;
  --space-8:  48px;

  /* ── Type scale ────────────────────────────────────────────
     Replaces 16 ad-hoc pixel values (216 declarations, incl. the
     9px / 9.5px / 11.5px / 15px / 17px / 18px / 22px one-offs).  */
  --fs-2xs:   10px;   /* micro labels, badges                    */
  --fs-xs:    11px;   /* dense IDE chrome                        */
  --fs-sm:    12px;   /* labels, secondary UI                    */
  --fs-md:    13px;   /* body / base — matches html font-size    */
  --fs-lg:    14px;   /* form controls, prose                    */
  --fs-xl:    16px;   /* card titles                             */
  --fs-2xl:   20px;   /* screen titles                           */
  --fs-3xl:   28px;   /* display (join code)                     */
  --fs-hero:  44px;   /* welcome hero only                       */

  --lh-tight:  1.25;
  --lh-normal: 1.5;

  --fw-regular:  400;
  --fw-medium:   500;
  --fw-semibold: 600;
  --fw-bold:     700;

  /* ── Micro-label system ────────────────────────────────────
     ONE treatment for every small header in the product:
     sentence case, light tracking, semibold. Replaces the
     uppercase + 0.5–1.5px letterspaced VS Code pastiche across
     18 sites. Flip these four values to change all of them.     */
  --label-transform: none;
  --label-tracking:  0.02em;
  --label-weight:    var(--fw-semibold);
  --label-fs:        var(--fs-sm);

  /* ── Radii — three roles, nothing else ─────────────────── */
  --radius-sm:   4px;    /* controls: buttons, inputs, chips   */
  --radius:      6px;    /* cards, panels  (was 4px)           */
  --radius-lg:   10px;   /* dialogs, overlays  (was 8px)       */
  --radius-pill: 999px;

  /* ── Motion ────────────────────────────────────────────── */
  --transition-fast: 100ms ease;
  --transition:      150ms ease;
  --transition-slow: 240ms ease;

  /* ── Typography families ───────────────────────────────── */
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;

  /* ── Control metrics (consumed by .btn and .panel-header) ─ */
  --control-h-sm:  22px;
  --control-h:     30px;
  --control-h-lg:  38px;
  --btn-pad-sm:    3px var(--space-2);
  --btn-pad:       6px var(--space-3);
  --btn-pad-lg:    9px var(--space-4);
  --btn-fs:        var(--fs-sm);

  /* ── Chrome heights ────────────────────────────────────── */
  --toolbar-h:     38px;
  --titlebar-h:    30px;
  --statusbar-h:   22px;
  --activitybar-w: 48px;
  --sidebar-w:     0px;
  --panel-header-h:         36px;
  --panel-header-h-compact: 30px;
  --pane-header-h: var(--panel-header-h);

  /* ── Focus geometry (colour is --focus-ring-color, per theme) */
  --focus-ring-width:  2px;
  --focus-ring-offset: 2px;

  /* White label on filled accent/danger surfaces — identical in
     both themes, so it is declared once here. */
  --on-accent: #ffffff;
}
```

- [ ] **Step 2: Remove the tokens the new block now owns from the dark theme block**

In the dark block (`:root, [data-theme="dark"]`), delete the entire `/* Sizing */` group and the `/* Typography */` group — currently `--toolbar-h` through `--transition` and `--font`/`--mono` — **except `--shadow` and `--shadow-lg`, which are colour-bearing and stay**. Replace that whole span (the eleven `Sizing` lines plus the three `Typography` lines) with:

```css
  /* Elevation (colour-bearing — theme-specific) */
  --shadow-sm:     0 1px 3px rgba(0, 0, 0, 0.35);
  --shadow:        0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-lg:     0 8px 40px rgba(0, 0, 0, 0.5);
```

Then append, immediately before the `/* ── Alias tokens …` comment in the same dark block:

```css
  /* Derived semantics — declared once; they re-resolve per theme
     because the tokens they reference are redefined below. */
  --focus-ring-color:     var(--accent-bright);
  --label-color:          var(--text-dim);
  --scrollbar-thumb:      var(--border-hl);
  --btn-primary-bg:       var(--accent);
  --btn-primary-bg-hover: var(--accent-bright);
```

- [ ] **Step 3: Add `--shadow-sm` to the light block**

In `[data-theme="light"]`, replace the two-line group:

```css
  --shadow:        0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg:     0 8px 40px rgba(0, 0, 0, 0.12);
```

with:

```css
  --shadow-sm:     0 1px 3px rgba(0, 0, 0, 0.10);
  --shadow:        0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg:     0 8px 40px rgba(0, 0, 0, 0.12);
```

- [ ] **Step 4: Make `#007acc` semantic — dark block**

In the dark block, apply these six edits. `--accent: #007acc;` is the ONLY literal that survives.

| Current declaration | Replace with |
|---|---|
| `--bg-statusbar:  #007acc;` | `--bg-statusbar:  var(--bg-surface);` |
| `--border-focus:  #007acc;` | `--border-focus:  var(--accent);` |
| `--accent-dim:    rgba(0, 122, 204, 0.3);` | `--accent-dim:    color-mix(in srgb, var(--accent) 30%, transparent);` |
| `--run-bg:        #007acc;` | `--run-bg:        var(--accent);` |
| `--run-glow:      rgba(0, 122, 204, 0.35);` | `--run-glow:      color-mix(in srgb, var(--accent) 35%, transparent);` |
| `--accent-bg:     rgba(0, 122, 204, 0.12);` | `--accent-bg:     color-mix(in srgb, var(--accent) 12%, transparent);` |
| `--accent-border: rgba(0, 122, 204, 0.25);` | `--accent-border: color-mix(in srgb, var(--accent) 25%, transparent);` |

(`color-mix` is already used in this stylesheet at `:350`, `:947`, `:1358` and elsewhere — no new browser requirement.)

- [ ] **Step 5: Make `#007acc` semantic — light block**

In `[data-theme="light"]`, **delete** these three lines outright (the `:root` declarations above now supply them, and they re-resolve against the light `--accent` / `--bg-surface`):

```css
  --bg-statusbar:  #007acc;
  --border-focus:  #007acc;
  --run-bg:        #007acc;
```

and replace these four:

| Current declaration | Replace with |
|---|---|
| `--accent-dim:    rgba(0, 122, 204, 0.12);` | `--accent-dim:    color-mix(in srgb, var(--accent) 12%, transparent);` |
| `--run-glow:      rgba(0, 122, 204, 0.2);` | `--run-glow:      color-mix(in srgb, var(--accent) 20%, transparent);` |
| `--accent-bg:     rgba(0, 122, 204, 0.08);` | `--accent-bg:     color-mix(in srgb, var(--accent) 8%, transparent);` |
| `--accent-border: rgba(0, 122, 204, 0.2);` | `--accent-border: color-mix(in srgb, var(--accent) 20%, transparent);` |

Leave `--accent: #007acc;` exactly as it is.

- [ ] **Step 6: Mark the alias block deprecated**

In BOTH theme blocks, change the alias-block banner comment from

```css
  /* ── Alias tokens — bridge legacy component tokens to this palette ── */
```

(dark) and

```css
  /* ── Alias tokens — light-mode counterparts ──────────────────────── */
```

(light) to, respectively:

```css
  /* ── DEPRECATED alias tokens — do NOT use in new rules. ──────────────
     Canonical names: --bg-base, --bg-surface, --border-soft→--card-border,
     --border-hard→--border-hl, --text-bright, --text, --text-dim, --red,
     --mono, --font. Consumers are concentrated in the .dm-* / .trace-*
     rules and are rewritten across Tasks 3, 8 and 9; the block is deleted
     in Tranche 2 once the count reaches zero. ─────────────────────── */
```

```css
  /* ── DEPRECATED alias tokens — light-mode counterparts. See the dark
     block above. ───────────────────────────────────────────────────── */
```

- [ ] **Step 7: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "007acc\|0, 122, 204" -- frontend/src/styles.css
```

Expected: tests green (13 files), build clean, and the `git grep` returns **exactly two lines** — `--accent:        #007acc;` in each theme block. Any other hit is a straggler.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "feat(ui): semantic token layer — space/type/radius/motion primitives, one accent source"
```

---

### Task 2: The global `:focus-visible` ring

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `--focus-ring-width`, `--focus-ring-offset`, `--focus-ring-color` (Task 1).
- Produces: a zero-specificity `:where(...)` focus ring covering every interactive element in both halves of the product. Today `grep -c "focus-visible" frontend/src/styles.css` returns **0**.

- [ ] **Step 1: Add the ring next to the reset**

In `frontend/src/styles.css`, immediately after the `button { font-family: var(--font); }` rule that closes the `/* ── Reset ── */` section, add:

```css
/* ── Focus ───────────────────────────────────────────────────
   ONE ring for the whole product, at zero specificity so any
   component rule can still override it deliberately. Keyboard
   only — :focus-visible never fires on a mouse click. */
:where(
  a[href],
  button,
  input,
  select,
  textarea,
  summary,
  [role="button"],
  [role="tab"],
  [tabindex]:not([tabindex="-1"])
):focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
  border-radius: inherit;
}
```

- [ ] **Step 2: Un-trap the eight `outline: none` declarations**

Eight rules kill the outline unconditionally, which would defeat the ring on exactly the controls that need it. Because `:where()` has zero specificity, each of these still wins — so each must be narrowed to `:focus:not(:focus-visible)` or deleted. Apply all eight:

| Line | Selector | Change |
|---|---|---|
| `:517` | `.tb-zoom-slider` | delete the `outline: none;` declaration |
| `:723` | `.block-search-input` | delete the `outline: none;` declaration |
| `:1156` | `.trace-search-input` | delete the `outline: none;` declaration |
| `:1482` | `.trace-alert-input` | delete the `outline: none;` declaration |
| `:2277` | `.help-search-input` | delete the `outline: none;` declaration |
| `:2742` | `.text-fallback:focus { outline: none; }` | delete the whole rule |
| `:3010` | `.vdialog-input` | delete the `outline: none;` declaration |
| `:4008` | `.trace-promote-input:focus` | delete the `outline: none;` declaration, keep `border-color: var(--accent);` |

The four search/text inputs sit inside a bordered wrapper that already draws a `:focus-within` treatment (`.block-search-bar:focus-within` at `:706`, `.help-search-box:focus-within` at `:2263`); the new ring now lands on the input itself as well, which is the correct keyboard affordance.

- [ ] **Step 3: Promote the one real focus ring that already existed**

`.vdialog-btn--ok:focus` at `:3078` is the only hand-written ring in the file and it fires on mouse clicks too. Replace the rule:

```css
.vdialog-btn--ok:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

with nothing — delete it. The global ring now covers it, with the correct `:focus-visible` semantics.

- [ ] **Step 4: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -c "outline: none" -- frontend/src/styles.css
git grep -c "focus-visible" -- frontend/src/styles.css
```

Expected: tests green, build clean, `outline: none` count **0**, `focus-visible` count **1**.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "feat(ui): one global :focus-visible ring; remove the eight outline:none traps"
```

---

### Task 3: Map the rogue palette onto semantic tokens

**Files:**
- Modify: `frontend/src/styles.css`, `frontend/src/components/TraceTable.js`

**Interfaces:**
- Consumes: the existing semantic colour tokens `--red`, `--green`, `--yellow`, `--accent-blue`, `--mauve`, `--accent`, `--text`, `--text-muted`, `--bg-base`, plus `--on-accent` (Task 1).
- Produces: zero hardcoded Tailwind-family hexes below the token blocks; the debug/trace region and the data-science regression readouts gain light-theme behaviour for the first time. `--rec-color` (referenced but never defined) is retired.

This is the review's Quick win 3, scoped to the complete set found at `f8b1b22`. **Every site is listed — there is no "and the rest".**

- [ ] **Step 1: Debug highlights and Monaco glyphs (`styles.css:838-877`)**

Replace the whole span from `/* Breakpoint red highlight …` through `.dbg-executing-line { … }` with:

```css
/* Breakpoint red highlight — outline/glow on breakpointed block */
.dm-bp-block > .blocklyPath {
  stroke: var(--red) !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--red) 85%, transparent)) !important;
}
/* Execution highlight — bright outline/glow on the currently running block */
.dm-block-executing > .blocklyPath {
  stroke: var(--yellow) !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--yellow) 80%, transparent)) !important;
}

/* ── Code-editor debug decorations (Monaco) ────────────────── */
/* Red dot in the glyph margin for breakpointed lines */
.dbg-glyph-bp {
  border-radius: 50%;
  background: radial-gradient(
    circle at 50% 55%,
    var(--red) 38%,
    color-mix(in srgb, var(--red) 55%, #000) 60%,
    transparent 62%
  );
  cursor: pointer;
  width: 100%;
  height: 100%;
}
/* Arrow in the glyph margin for the executing line */
.dbg-glyph-executing {
  background: currentColor;
  color: var(--yellow);
  -webkit-mask: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><polygon points='2,4 10,8 2,12'/></svg>") center/10px no-repeat;
  mask: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><polygon points='2,4 10,8 2,12'/></svg>") center/10px no-repeat;
  width: 100%;
  height: 100%;
}
/* Background highlight for the executing line */
.dbg-executing-line {
  background: color-mix(in srgb, var(--yellow) 12%, transparent) !important;
}
```

This deletes the two `[data-theme="light"]` override rules at `:844-847` and `:854-857` (they existed only because the dark values were literals; `--red`/`--yellow` already carry the light values `#cd3131`/`#795e00`). The glyph SVG moves from a `fill`-baked data URI to a mask so its colour comes from the token — the data URI could not be themed otherwise.

- [ ] **Step 2: The trace-table sweep (`styles.css:1048-1519`)**

Apply this complete table. Each row is a literal find-and-replace within the named line; every occurrence on that line changes.

| Line | Current fragment | Replace with |
|---|---|---|
| 1048 | `var(--green, #4ade80)` | `var(--green)` |
| 1301 | `var(--green, #4ade80)` | `var(--green)` |
| 1302 | `#f87171` | `var(--red)` |
| 1352 | `drop-shadow(0 0 3px #f87171)` | `drop-shadow(0 0 3px var(--red))` |
| 1357 | `#60a5fa` | `var(--accent-blue)` |
| 1358 | `#60a5fa` | `var(--accent-blue)` |
| 1361 | `#93c5fd` | `var(--accent-bright)` |
| 1362 | `#60a5fa` | `var(--accent-blue)` |
| 1367 | `#f87171` | `var(--red)` |
| 1370 | `#f87171` | `var(--red)` |
| 1380 | `#f87171` | `var(--red)` |
| 1381 | `#f87171` | `var(--red)` |
| 1382 | `#f87171` | `var(--red)` |
| 1398 | `#60a5fa` | `var(--accent-blue)` |
| 1399 | `#60a5fa` | `var(--accent-blue)` |
| 1400 | `#60a5fa` | `var(--accent-blue)` |
| 1431 | `#60a5fa` | `var(--accent-blue)` |
| 1432 | `#c084fc` | `var(--mauve)` |
| 1500 | `var(--green, #4ade80)` (twice) | `var(--green)` |
| 1501 | `#f87171` (twice) | `var(--red)` |
| 1510 | `#f87171` | `var(--red)` |
| 1511 | `#f87171` | `var(--red)` |
| 1519 | `#f87171` | `var(--red)` |

- [ ] **Step 3: The DebugMode chrome sweep (`styles.css:1618-1701`)**

| Line | Current fragment | Replace with |
|---|---|---|
| 1618 | `#f87171` | `var(--red)` |
| 1619 | `#f87171` | `var(--red)` |
| 1627 | `#f87171` | `var(--red)` |
| 1633 | `#f87171` | `var(--red)` |
| 1642 | `background: #dc2626;` | `background: var(--red);` |
| 1643 | `color: #fff;` | `color: var(--on-accent);` |
| 1700 | `background: #f59e0b;` | `background: var(--yellow);` |
| 1701 | `color: #000;` | `color: var(--bg-base);` |

Line 1701 is `.dm-paused-badge`, which pinned `color: #000` on amber regardless of theme; `--bg-base` gives `#1e1e1e` on `#cca700` in dark (~7:1) and `#ffffff` on `#795e00` in light (~7.9:1).

- [ ] **Step 4: The data-science readouts (`styles.css:3240-3374`)**

| Line | Current fragment | Replace with |
|---|---|---|
| 3240 | `var(--accent-warn, #f5a623)` | `var(--yellow)` |
| 3246 | `var(--text-muted, #9a9a9a)` | `var(--text-muted)` |
| 3288 | `var(--accent, #2da56f)` | `var(--accent)` |
| 3289 | `var(--accent, #2da56f)` | `var(--accent)` |
| 3298 | `var(--accent, #2da56f)` | `var(--accent)` |
| 3324 | `var(--text, #e6e6e6)` | `var(--text)` |
| 3339 | `#93c5fd` | `var(--accent-bright)` |
| 3343 | `#4ade80` | `var(--green)` |
| 3344 | `#86efac` | `color-mix(in srgb, var(--green) 75%, var(--text))` |
| 3345 | `#fbbf24` | `var(--yellow)` |
| 3346 | `#f87171` | `var(--red)` |
| 3351 | `#2da56f` | `var(--accent)` |
| 3374 | `var(--text, #e6e6e6)` | `var(--text)` |

`--accent-warn` was never defined anywhere, so `.ds-*` warnings have always rendered as the fallback `#f5a623`. `#86efac` (the "strong" regression tier) measured ~1.6:1 on white — the four `.ds-regression-quality--*` tiers now step green → mixed-green → yellow → red and are legible in both themes.

- [ ] **Step 5: Dialog error colours (`styles.css:3025-3032`)**

| Line | Current fragment | Replace with |
|---|---|---|
| 3025 | `var(--error, #e06c75)` | `var(--red)` |
| 3026 | `rgba(224, 108, 117, 0.08)` | `color-mix(in srgb, var(--red) 8%, transparent)` |
| 3032 | `var(--error, #e06c75)` | `var(--red)` |

- [ ] **Step 6: `#fff` on filled surfaces → `--on-accent`**

Every remaining `#fff` / `#ffffff` below the token blocks is a label on a filled accent surface. Replace at these exact lines, and **leave `:4386` alone** (`.join-qr { background: #fff }` — a QR quiet zone must be true white in both themes):

| Line | Selector | Change |
|---|---|---|
| 479 | `.tb-dropdown-item:hover` | `color: #fff;` → `color: var(--on-accent);` |
| 1886 | `.start-sidebar-logo-icon` | `color: #ffffff;` → `color: var(--on-accent);` |
| 2690 | `.help-lesson-num` | `color: #fff;` → `color: var(--on-accent);` |
| 2831 | `.blocklyTreeSelected .blocklyTreeLabel` | `color: #fff !important;` → `color: var(--on-accent) !important;` |
| 3072 | `.vdialog-btn--ok` | `color: #fff;` → `color: var(--on-accent);` |
| 3779 | `.ds-primary-action` group | `color: #fff;` → `color: var(--on-accent);` |
| 3838 | `.trace-promote-ok` group | `color: #fff;` → `color: var(--on-accent);` |
| 4085 | `.ds-saved-trace-load` group | `color: #fff;` → `color: var(--on-accent);` |
| 4238 | `.auth-submit` | `color: #fff;` → `color: var(--on-accent);` |

Also replace the two `var(--accent, #2da56f)` fallbacks at `:3836` and `:3837` with `var(--accent)`.

- [ ] **Step 7: Remaining tinted literals**

| Line | Selector | Current | Replace with |
|---|---|---|---|
| 358 | `.tb-btn--stop:hover:not(:disabled)` | `rgba(244, 71, 71, 0.12)` | `color-mix(in srgb, var(--red) 12%, transparent)` |
| 377 | `.tb-btn--active` | `rgba(86, 156, 214, 0.12)` | `color-mix(in srgb, var(--accent-blue) 12%, transparent)` |
| 386 | `.tb-btn--danger:hover` | `rgba(244, 71, 71, 0.08)` | `color-mix(in srgb, var(--red) 8%, transparent)` |
| 2066 | `.start-card:hover` | `box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);` | `box-shadow: var(--shadow-sm);` |
| 2101 | `.start-card-badge--code` | `rgba(86, 156, 214, 0.15)` | `color-mix(in srgb, var(--accent-blue) 15%, transparent)` |
| 2105 | `.start-card-badge--blocks` | `rgba(197, 134, 192, 0.15)` | `color-mix(in srgb, var(--mauve) 15%, transparent)` |
| 4433 | `.welcome-orbit__sun` | `rgba(250, 204, 21, 0.35)` | `color-mix(in srgb, var(--yellow) 35%, transparent)` |

Then **delete** the two now-redundant light overrides at `:2108-2113`:

```css
[data-theme="light"] .start-card-badge--code {
  background: rgba(4, 81, 165, 0.1);
}
[data-theme="light"] .start-card-badge--blocks {
  background: rgba(175, 0, 219, 0.1);
}
```

- [ ] **Step 8: Retire the phantom `--rec-color`**

In `frontend/src/components/TraceTable.js:414`, change:

```js
              <span className="trace-alert-badge" style={{ background: "var(--rec-color, #e53e3e)" }}
```

to:

```js
              <span className="trace-alert-badge" style={{ background: "var(--red)" }}
```

`--rec-color` is defined in no stylesheet, so this element has always rendered the `#e53e3e` fallback — a fourth red with no light-theme behaviour.

- [ ] **Step 9: Verify zero stragglers**

The grep is scoped to the three files this task's Files list actually touches or defers by name (`styles.css`, `TraceTable.js`, `GravityPlayground.js`). It deliberately excludes `frontend/src/utils/blockly/toolbox.js` (`#2da56f` — already named in this plan's Deferred list as one of the 16 Blockly category hues owned by Tranche 3's `BLOCK_PALETTE`) and `frontend/src/utils/charts/chartSpec.js` / `frontend/src/utils/charts/plotRender.js` (both carry `#2da56f` / `#e6e6e6` fallbacks but are chart-rendering JS outside this tranche's CSS-only scope and are not touched by any task in this plan):

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "f87171\|4ade80\|86efac\|fbbf24\|60a5fa\|c084fc\|93c5fd\|ef4444\|dc2626\|facc15\|d97706\|f59e0b\|ff9999\|80ffdb\|e06c75\|2da56f\|e6e6e6\|9a9a9a\|f5a623\|991b1b\|rec-color" -- frontend/src/styles.css frontend/src/components/TraceTable.js frontend/src/welcome/GravityPlayground.js
```

Expected: tests green, build clean. The `git grep` returns **only** `frontend/src/styles.css:1798`, `:1799`, `:1801`, `:1810` (`#ff9999` / `#80ffdb` in the status bar — Task 4 owns those) and `frontend/src/welcome/GravityPlayground.js:4` (`#86efac` in the deferred particle array). Anything else is a straggler; fix it before committing.

- [ ] **Step 10: Commit**

```powershell
git add frontend/src/styles.css frontend/src/components/TraceTable.js
git commit -m "fix(ui): map the rogue Tailwind palette onto semantic tokens — light theme reaches debug, trace and DS readouts"
```

---

### Task 4: White-alpha leaks and the de-blued status bar

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 1 tokens; the semantic colours from Task 3.
- Produces: zero `rgba(255, 255, 255, …)` below line 209 of `styles.css`; the status bar becomes a themed surface built on `--bg-surface` rather than a permanently-`#007acc` strip whose text is white in both themes.

The status bar is the last surface carrying the hard-coded VS Code blue. Its *concept* stays (Tranche 2 owns repopulating its content and its 26px height); its colour becomes semantic here, which is also the only way to fix the two white-alpha leaks that sit on it.

- [ ] **Step 1: The dropdown shortcut hint (`styles.css:495`)**

```css
.tb-dropdown-item:hover .tb-dropdown-shortcut {
  color: rgba(255,255,255,0.6);
}
```

→

```css
.tb-dropdown-item:hover .tb-dropdown-shortcut {
  color: color-mix(in srgb, var(--on-accent) 70%, transparent);
}
```

(The hovered row background is `var(--accent)` in both themes — see `:477-480` — so an on-accent colour is correct here, unlike the status bar.)

While in this rule, change `.tb-dropdown-shortcut`'s `font-family: 'JetBrains Mono', monospace;` at `:492` to `font-family: var(--mono);` — one of the review's three `var(--mono)` bypasses.

- [ ] **Step 2: The status bar surface (`styles.css:1770-1817`)**

`.status-dot`'s closing brace sits at `:1813`, immediately followed — still inside this same span, not past it — by the pre-existing `@keyframes statusPulse { 0%, 100% {...} 50% {...} }` block at `:1814-1817`. Replace the whole span from `.status-bar {` through the closing brace of that `@keyframes statusPulse` block (i.e. through `:1817`, not just `.status-dot`'s own closing brace) with:

```css
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-3);
  height: var(--statusbar-h);
  min-height: var(--statusbar-h);
  font-size: var(--fs-sm);
  color: var(--text-dim);
  background: var(--bg-statusbar);
  border-top: 1px solid var(--border);
  user-select: none;
  z-index: 50;
}
.status-bar span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-sm);
}

.console-bar {
  padding: 0;
  font-size: var(--fs-sm);
  font-family: var(--mono);
  color: var(--text);
  background: transparent;
  border: none;
}
.console-bar--error { color: var(--red); }
.console-bar--success { color: var(--green); }
.console-bar--running {
  color: var(--accent-bright);
  font-weight: var(--fw-medium);
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--accent-bright);
  flex-shrink: 0;
  animation: statusPulse 1.2s ease infinite;
}
@keyframes statusPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.3; }
}
```

Also update the section banner two lines above from `STATUS BAR (VS Code blue bottom bar)` to `STATUS BAR`.

- [ ] **Step 3: The welcome-page card borders (`styles.css:4462` and `:4476`)**

In `.welcome-card`:

```css
  background: var(--bg-surface); border: 1px solid rgba(255, 255, 255, 0.06);
```

→

```css
  background: var(--bg-surface); border: 1px solid var(--card-border);
```

In `.welcome-playground__canvas`:

```css
  background: var(--bg-surface); border: 1px solid rgba(255, 255, 255, 0.06);
```

→

```css
  background: var(--bg-surface); border: 1px solid var(--card-border);
```

Both borders are currently invisible on `#ffffff` in light theme — this is the review's Quick win 4.

- [ ] **Step 4: The guest-import shadow (`styles.css:4419`)**

```css
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
```

→

```css
  box-shadow: var(--shadow-lg);
```

- [ ] **Step 5: The last two `var(--mono)` bypasses**

| Line | Selector | Change |
|---|---|---|
| 547 | `.tb-zoom-value` (or the rule at that line carrying `'JetBrains Mono'`) | set `font-family: var(--mono);` |
| 4378 | `.join-code-big` | `font-family: Consolas, monospace;` → `font-family: var(--mono);` |

`.join-code-big` is the 28px code a teacher projects to the class; `Consolas` does not exist on macOS or ChromeOS, so it currently falls back to the browser's generic mono there.

- [ ] **Step 6: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "rgba(255, *255, *255" -- frontend/src/styles.css
git grep -n "JetBrains Mono\|Consolas" -- frontend/src/styles.css
```

Expected: tests green, build clean. The first grep returns **only** lines inside the two theme blocks (all above line ~210: `--bg-card`, `--bg-hover`, `--bg-active`, `--glass-border`, `--card-*`, `--btn-*`, `--key-*`, `--border-soft`). The second returns **exactly one line** — the `--mono` definition in the primitives block.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "fix(ui): close the white-alpha leaks; status bar becomes a themed surface, not VS Code blue"
```

---

### Task 5: The `.btn` primitive, adopted by the platform screens

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `--control-h*`, `--btn-pad*`, `--btn-fs`, `--radius-sm`, `--btn-primary-bg`, `--on-accent`, `--fw-*`, `--transition` (Task 1).
- Produces: `.btn` with `--primary` / `--ghost` / `--danger` / `--sm` / `--lg` / `--block` modifiers. `.admin-btn`, `.welcome-btn`, `.account-chip-btn`, `.auth-submit` and `.vdialog-btn` become selector-list aliases — **no JSX changes**. Every "primary" in the product becomes the same filled treatment.

Today five classes claim to be primary with two contradictory definitions: `.vdialog-btn--ok` (`:3069`) and `.auth-submit` (`:4234`) are filled accent; `.welcome-btn--primary` (`:4454`), `.admin-btn--primary` (`:4421`) and `.account-chip-btn--primary` (`:4284`) are merely outlined. Padding ranges `4px 8px` → `10px 18px` and font-size `12px` → `14px` across peers.

- [ ] **Step 1: Add the primitive**

Insert a new section immediately **before** the `/* ============================================================
   AUTH & ACCOUNT SCREENS (Plan 2)` banner at `:4158`:

```css
/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .btn
   The IDE core and the platform screens share these. Legacy
   class names are comma-appended aliases so no markup changes.
   ═══════════════════════════════════════════════════════════ */
.btn,
.admin-btn,
.welcome-btn,
.account-chip-btn,
.vdialog-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--control-h);
  padding: var(--btn-pad);
  font-family: var(--font);
  font-size: var(--btn-fs);
  font-weight: var(--fw-medium);
  line-height: 1;
  color: var(--text);
  background: var(--btn-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--transition), border-color var(--transition),
              color var(--transition);
}
.btn:hover:not(:disabled),
.admin-btn:hover:not(:disabled),
.welcome-btn:hover:not(:disabled),
.account-chip-btn:hover:not(:disabled),
.vdialog-btn:hover:not(:disabled) {
  background: var(--btn-bg-hover);
  border-color: var(--border-hl);
  color: var(--text-bright);
}
.btn:disabled,
.admin-btn:disabled,
.welcome-btn:disabled,
.account-chip-btn:disabled,
.vdialog-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* One filled primary for the whole product. */
.btn--primary,
.admin-btn--primary,
.welcome-btn--primary,
.account-chip-btn--primary,
.auth-submit,
.vdialog-btn--ok {
  background: var(--btn-primary-bg);
  border: 1px solid var(--btn-primary-bg);
  color: var(--on-accent);
  font-weight: var(--fw-semibold);
}
.btn--primary:hover:not(:disabled),
.admin-btn--primary:hover:not(:disabled),
.welcome-btn--primary:hover:not(:disabled),
.account-chip-btn--primary:hover:not(:disabled),
.auth-submit:hover:not(:disabled),
.vdialog-btn--ok:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
  border-color: var(--btn-primary-bg-hover);
  color: var(--on-accent);
}

.btn--ghost,
.vdialog-btn--cancel {
  background: transparent;
  border-color: transparent;
  color: var(--text-dim);
}
.btn--ghost:hover:not(:disabled),
.vdialog-btn--cancel:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: transparent;
  color: var(--text);
}

.btn--danger {
  background: transparent;
  border-color: color-mix(in srgb, var(--red) 45%, transparent);
  color: var(--red);
}
.btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--red) 12%, transparent);
  border-color: var(--red);
  color: var(--red);
}

.btn--sm,
.admin-btn,
.account-chip-btn {
  min-height: var(--control-h-sm);
  padding: var(--btn-pad-sm);
  font-size: var(--fs-xs);
}
.btn--lg,
.welcome-btn,
.auth-submit {
  min-height: var(--control-h-lg);
  padding: var(--btn-pad-lg);
  font-size: var(--fs-lg);
}
.btn--block,
.auth-submit {
  width: 100%;
}

/* .account-chip-btn is a left-aligned nav row, not a centred button. */
.account-chip-btn { justify-content: flex-start; text-align: left; }
```

- [ ] **Step 2: Strip the superseded declarations from the five legacy rules**

Each legacy rule must lose the properties the primitive now owns, keeping only what is genuinely local. Apply all five:

`.auth-submit` at `:4234` — replace the whole rule and its `:disabled` line with:

```css
.auth-submit { margin-top: var(--space-1); }
```

(`:disabled` is covered by the primitive; the old `opacity: 0.6` becomes `0.5`.)

`.account-chip-btn` at `:4271` — replace the rule with:

```css
.account-chip-btn {
  display: flex;
  background: var(--card-bg);
}
```

and replace `.account-chip-btn:hover { background: var(--bg-card-hover); }` at `:4283` with:

```css
.account-chip-btn:hover { background: var(--card-bg-hover); }
```

and **delete** `.account-chip-btn--primary { border-color: var(--accent); color: var(--accent-bright); }` at `:4284` (the primitive supplies the filled treatment).

`.admin-btn` at `:4308` — replace the rule with:

```css
.admin-btn { background: var(--card-bg); }
```

and replace `.admin-btn:hover { background: var(--bg-card-hover); }` at `:4317` with:

```css
.admin-btn:hover { background: var(--card-bg-hover); }
```

and **delete** `.admin-btn--primary { border-color: var(--accent); color: var(--accent-bright); }` at `:4421`.

`.welcome-btn` at `:4448` — replace the rule, its `:hover` and `--primary` line with:

```css
.welcome-btn {
  background: var(--bg-surface);
  border-color: var(--border-hl);
  transition: transform var(--transition), background var(--transition),
              border-color var(--transition), color var(--transition);
}
.welcome-btn:hover { transform: translateY(-1px); }
.welcome-btn--small {
  min-height: var(--control-h-sm);
  padding: var(--btn-pad-sm);
  font-size: var(--fs-sm);
}
```

(`.welcome-btn--primary` is deleted here — the primitive's filled rule covers it. The `@media (prefers-reduced-motion: reduce)` block at the end of the file already neutralises `.welcome-btn { transition: none; }`; leave it.)

`.vdialog-btn` at `:3045` — replace the rule with:

```css
.vdialog-btn { min-width: 68px; }
```

and **delete** the `.vdialog-btn--cancel`, `.vdialog-btn--cancel:hover`, `.vdialog-btn--ok` and `.vdialog-btn--ok:hover` rules at `:3059-3077` (all four are now supplied by the primitive's `--ghost` and `--primary` aliases).

- [ ] **Step 3: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "accent-bright); *}" -- frontend/src/styles.css
```

Expected: tests green, build clean, and the grep returns **no** `--primary` rule (every outlined-primary definition is gone). Spot-check by eye that `.btn--primary` appears exactly once as a definition.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "feat(ui): .btn primitive with one filled primary; five legacy button classes become aliases"
```

---

### Task 6: `.tb-btn` on tokens, and Run becomes the IDE's primary action

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 1 tokens, Task 5's `--btn-primary-bg` / `--on-accent`.
- Produces: the toolbar keeps its deliberate IDE density (it is NOT folded into `.btn`) but is rebuilt on tokens; `.tb-btn--run` becomes the single filled primary in the IDE core, and Reset/Clear/Viewport demote to ghost weight.

Today Run is a transparent green text link at exactly the same visual weight as Reset and Clear (`:344-351`), while every platform screen has one filled accent primary. This is the review's Quick win 6.

- [ ] **Step 1: Retune the base toolbar button (`styles.css:304-337`)**

Replace `.tb-btn`, `.tb-btn-label` and `.tb-btn--icon` with:

```css
.tb-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
  color: var(--text-dim);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast);
  white-space: nowrap;
  line-height: 1;
}
.tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text-bright);
}
.tb-btn:active {
  background: var(--bg-active);
}
.tb-btn svg {
  opacity: 0.85;
  flex-shrink: 0;
}
.tb-btn-label {
  font-size: var(--fs-sm);
}

/* Icon-only buttons */
.tb-btn--icon {
  padding: var(--space-1) 5px;
}
```

The base colour moves `--text` → `--text-dim` so that ghost controls sit *below* the primary in the hierarchy; the `--subtle` modifier at `:368-373` therefore becomes a no-op and can stay as-is (it is still applied in markup and now simply matches the base).

- [ ] **Step 2: Promote Run (`styles.css:344-351`)**

Replace:

```css
/* Run (green accent) */
.tb-btn--run {
  background: transparent;
  color: var(--green);
  font-weight: 500;
}
.tb-btn--run:hover {
  background: color-mix(in srgb, var(--green) 12%, transparent);
}
```

with:

```css
/* Run — the IDE core's one filled primary action. */
.tb-btn--run {
  padding: var(--space-1) var(--space-3);
  background: var(--btn-primary-bg);
  border-color: var(--btn-primary-bg);
  color: var(--on-accent);
  font-weight: var(--fw-semibold);
}
.tb-btn--run:hover {
  background: var(--btn-primary-bg-hover);
  border-color: var(--btn-primary-bg-hover);
  color: var(--on-accent);
}
.tb-btn--run svg { opacity: 1; }
```

- [ ] **Step 3: Give Stop a filled-destructive treatment while it is live (`styles.css:354-365`)**

Replace the `.tb-btn--stop` group with:

```css
/* Stop — destructive weight only while a run is actually stoppable. */
.tb-btn--stop {
  color: var(--red);
  border-color: color-mix(in srgb, var(--red) 45%, transparent);
}
.tb-btn--stop:hover:not(:disabled) {
  background: color-mix(in srgb, var(--red) 12%, transparent);
  border-color: var(--red);
  color: var(--red);
}
.tb-btn--stop:disabled,
.tb-btn--stop.tb-btn--disabled {
  opacity: 0.35;
  border-color: transparent;
  cursor: not-allowed;
  pointer-events: none;
}
```

- [ ] **Step 4: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "font-size: 12px" -- frontend/src/styles.css | Select-String "tb-btn"
```

Expected: tests green, build clean, no `tb-btn` rule left carrying a literal font size.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "feat(ui): Run becomes a filled primary; toolbar buttons rebuilt on tokens"
```

---

### Task 7: The `.card` primitive and the card-family collapse

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: `.card` with `--interactive` / `--panel` / `--lg` modifiers, aliased onto `.start-card`, `.class-card`, `.welcome-card`, `.auth-card` and `.classes-newform`; the `--bg-card` / `--bg-card-hover` token pair is **deleted** and its eight consumers rewritten to `--card-bg` / `--card-bg-hover`.

Two rival card families exist with different values — `--bg-card: rgba(255,255,255,0.04)` vs `--card-bg: rgba(255,255,255,0.025)` — and the newer `.class-card` has no transition at all, so its hover snaps while `.start-card`'s eases. This is the review's Quick win 14 plus the token collapse.

- [ ] **Step 1: Rewrite the eight `--bg-card` consumers**

| Line | Selector | Change |
|---|---|---|
| 2315 | `.help-search-result-item` | `var(--bg-card)` → `var(--card-bg)` |
| 2325 | `.help-search-result-item:hover` | `var(--bg-card-hover)` → `var(--card-bg-hover)` |
| 4274 | `.account-chip-btn` (as rewritten in Task 5) | already `var(--card-bg)` — confirm |
| 4283 | `.account-chip-btn:hover` | already `var(--card-bg-hover)` — confirm |
| 4309 | `.admin-btn` (as rewritten in Task 5) | already `var(--card-bg)` — confirm |
| 4317 | `.admin-btn:hover` | already `var(--card-bg-hover)` — confirm |
| 4354 | `.class-card` | `var(--bg-card)` → `var(--card-bg)` |
| 4361 | `.class-card:hover` | `var(--bg-card-hover)` → `var(--card-bg-hover)` |

(The four `account-chip`/`admin` rows were already converted in Task 5 Step 2 — this step confirms them and fixes the four that were not.)

- [ ] **Step 2: Delete the losing token pair**

In the dark block, delete:

```css
  --bg-card:       rgba(255, 255, 255, 0.04);
  --bg-card-hover: rgba(255, 255, 255, 0.065);
```

In `[data-theme="light"]`, delete:

```css
  --bg-card:       rgba(0, 0, 0, 0.03);
  --bg-card-hover: rgba(0, 0, 0, 0.05);
```

- [ ] **Step 3: Add the primitive**

Immediately after the `.btn` primitive section added in Task 5, append:

```css
/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .card
   ═══════════════════════════════════════════════════════════ */
.card,
.start-card,
.class-card,
.welcome-card,
.classes-newform {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: var(--space-4);
  transition: background var(--transition), border-color var(--transition),
              box-shadow var(--transition);
}
.card--interactive:hover,
.start-card:hover,
.class-card:hover {
  background: var(--card-bg-hover);
  border-color: var(--card-border-hover);
  box-shadow: var(--shadow-sm);
}

/* Opaque surface variant — cards that sit directly on --bg-base
   and must not read as translucent (auth, welcome, playground). */
.card--panel,
.welcome-card,
.auth-card {
  background: var(--bg-surface);
  border-color: var(--card-border);
}
.card--lg,
.auth-card {
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}
```

- [ ] **Step 4: Strip the superseded declarations from the five legacy card rules**

`.start-card` at `:2050` — replace the rule and its `:hover` with:

```css
.start-card {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  cursor: pointer;
  text-align: left;
}
```

(the `:hover` rule is deleted — the primitive's `--interactive` alias covers it).

`.class-card` at `:4352` — replace the rule and its `:hover` with:

```css
.class-card {
  display: block;
  color: var(--text);
  text-decoration: none;
}
```

`.welcome-card` at `:4461` — replace the rule with:

```css
.welcome-card { padding: var(--space-5); }
```

`.auth-card` at `:4169` — replace the rule with:

```css
.auth-card {
  width: 100%;
  max-width: 420px;
}
```

`.classes-newform` at `:4350` — replace the rule with:

```css
.classes-newform { max-width: 420px; }
```

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "bg-card" -- frontend/src
```

Expected: tests green, build clean, and the grep returns **zero lines** — `--bg-card` and `--bg-card-hover` no longer exist anywhere.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "feat(ui): .card primitive; collapse the two rival card token families into --card-*"
```

---

### Task 8: The `.panel-header` primitive and the one label voice

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `--panel-header-h`, `--panel-header-h-compact`, `--label-*`, `--space-*`, `--fs-*` (Task 1).
- Produces: `.panel-header` (+ `--compact` and `__title`) aliased onto `.pane-header`, `.dm-panel-header` and `.vdialog-header`; all 18 `text-transform: uppercase` sites routed through `--label-transform` / `--label-tracking` / `--label-weight`; `.pane-header` and `.canvas-controls-hint` move off `--text-muted`.

Four unrelated definitions of "bar at the top of a container" exist today — `.pane-header` (`:638`, 35px, 11px/600 uppercase/0.8px), `.dm-panel-header` (`:1669`, 28px, not uppercase), `.vdialog-header` (`:2970`, 12px/600) and the `admin`/`classes` `h1` headers (`:4293`, `:4347`, 18px).

- [ ] **Step 1: Add the primitive**

Append to the primitives section created in Task 5 (after `.card`):

```css
/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .panel-header
   ═══════════════════════════════════════════════════════════ */
.panel-header,
.pane-header,
.dm-panel-header,
.vdialog-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  height: var(--panel-header-h);
  min-height: var(--panel-header-h);
  flex-shrink: 0;
  font-size: var(--label-fs);
  font-weight: var(--label-weight);
  text-transform: var(--label-transform);
  letter-spacing: var(--label-tracking);
  color: var(--label-color);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  user-select: none;
  overflow: hidden;
}
.panel-header--compact,
.dm-panel-header {
  height: var(--panel-header-h-compact);
  min-height: var(--panel-header-h-compact);
  padding: 0 var(--space-2);
}
.panel-header__title,
.dm-panel-title,
.vdialog-title {
  font-size: var(--fs-md);
  font-weight: var(--fw-semibold);
  color: var(--text-bright);
  letter-spacing: var(--label-tracking);
  white-space: nowrap;
}
```

- [ ] **Step 2: Strip the three legacy header rules**

`.pane-header` at `:638` — replace the rule with:

```css
.pane-header { color: var(--text-dim); }
```

Keep `.pane-header svg { opacity: 0.7; }` and the three `.pane-header--blocks/--code/--viewport` stripe rules exactly as they are (the stripes stay by ruling). Keep `.pane-header--code-preview` at `:878` but change its `font-size: 10px; letter-spacing: 0.6px;` to `font-size: var(--fs-xs); letter-spacing: var(--label-tracking);`.

`.dm-panel-header` at `:1669` — replace the rule with:

```css
.dm-panel-header { background: var(--bg-toolbar); border-bottom-color: var(--border-hl); }
```

`.dm-panel-title` at `:1682` — delete the rule entirely (the `.panel-header__title` alias supplies it).

`.vdialog-header` at `:2970` — replace the rule with:

```css
.vdialog-header {
  height: auto;
  min-height: var(--panel-header-h);
  padding: var(--space-3) var(--space-4) var(--space-2);
  background: var(--bg-titlebar);
}
```

`.vdialog-title` at `:2978` — delete the rule entirely.

- [ ] **Step 3: Route all 18 uppercase sites through the label tokens**

In every rule below, replace `text-transform: uppercase;` with `text-transform: var(--label-transform);` and replace the `letter-spacing` declaration in the same rule with `letter-spacing: var(--label-tracking);`. This is the complete set — verify the count afterwards.

| Line | Selector | Its current letter-spacing |
|---|---|---|
| 647 | `.pane-header` | `0.8px` — **already removed in Step 2**; skip |
| 824 | `.block-search-item-cat` | `0.02em` |
| 922 | `.canvas-idle-label` | `1.5px` |
| 1040 | `.trace-panel-title` | `0.8px` |
| 1203 | `.trace-th` | `0.7px` |
| 1220 | `.trace-section-label` | `0.8px` |
| 1452 | `.trace-alert-lbl` | `0.5px` |
| 1921 | `.start-actions-label` | `0.8px` |
| 2032 | `.start-section-label` | `0.8px` |
| 2094 | `.start-card-badge` | `0.5px` |
| 2142 | `.start-blank-section` | `1px` |
| 2361 | `.help-sidebar-label` | `0.8px` |
| 2581 | `.help-table th` | `0.5px` |
| 3108 | `.data-panel-title` | `0.04em` |
| 3362 | `.ds-uncertainty-label` | `0.05em` |
| 3649 | `.start-wizard-field > legend` | `0.04em` |
| 3986 | `.trace-promote-field > span:first-child` | `0.05em` |
| 4102 | `.ds-saved-traces-label` | `0.06em` |

Also normalise the two remaining letterspaced micro-labels that are not uppercase: `.account-chip-head` at `:4259` (`letter-spacing: 0.08em`) and `.join-code-big` at `:4380` (`letter-spacing: 0.08em` — **leave this one**, a projected code needs the tracking). Change only `.account-chip-head` to `letter-spacing: var(--label-tracking);`.

- [ ] **Step 4: Fix the two `--text-muted` contrast failures**

`--text-muted` is `#6a6a6a` on `--bg-surface` `#252526` — about 2.8:1, below AA at 11px. Two rules carrying the product's most-read labels move to `--text-dim` (`#9d9d9d`, ~5.3:1):

- `.pane-header` — done in Step 2 (`color: var(--text-dim);`).
- `.canvas-controls-hint` at `:946` — `color: var(--text-muted);` → `color: var(--text-dim);`. While there, change `border-radius: 6px;` → `border-radius: var(--radius);` and `font-size: 11px;` → `font-size: var(--fs-xs);`.

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -c "text-transform: uppercase" -- frontend/src/styles.css
git grep -c "text-transform: var(--label-transform)" -- frontend/src/styles.css
```

Expected: tests green, build clean, literal-uppercase count **0**, tokenised count **17** (18 sites minus `.pane-header`, whose declaration was deleted with the rule).

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "feat(ui): .panel-header primitive and one label voice — sentence case via tokens across 18 sites"
```

---

### Task 9: Lift the debug and trace panels to platform scale

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 1 type scale and radii; Task 8's `.panel-header`.
- Produces: the debug/trace region runs on `--fs-2xs`…`--fs-md` and `--radius-sm`/`--radius`/`--radius-pill` instead of 9-11px type and 3-4px radii, against the platform's 12-14px and 6px.

The review measured this region at "9-11px type and 3-4px radii against the platform's 13-15px and 6-8px". Below is the complete set of declarations in the region (`styles.css:1006-1765`), each with its replacement.

The `.dm-*` chrome rules below are deliberately included even though Tranche 3 later deletes them — DebugMode is the shipping UI until then, and this tranche must be independently shippable. The `.trace-*` rules survive as the docked drawer.

- [ ] **Step 1: The type sweep**

| Line | Selector | Current | Replace with |
|---|---|---|---|
| 1038 | `.trace-panel-title` | `font-size: 11px;` | `font-size: var(--label-fs);` |
| 1071 | `.trace-var-count` | `font-size: 10px;` | `font-size: var(--fs-2xs);` |
| 1080 | `.trace-icon-btn` | `font-size: 10px;` | `font-size: var(--fs-xs);` |
| 1110 | `.trace-clear-btn` | `font-size: 10px;` | `font-size: var(--fs-xs);` |
| 1157 | `.trace-search-input` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1192 | `.trace-table` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1201 | `.trace-th` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |
| 1218 | `.trace-section-label` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |
| 1281 | `.trace-varname` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1293 | `.trace-value` | `font-size: 11px;` | `font-size: var(--fs-md);` |
| 1297 | `.trace-delta` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |
| 1313 | `.trace-minmax` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |
| 1326 | `.trace-empty` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1378 | `.trace-alert-badge` | `font-size: 10px;` | `font-size: var(--fs-2xs);` |
| 1397 | `.trace-snap-badge` | `font-size: 10px;` | `font-size: var(--fs-2xs);` |
| 1417 | `.trace-snap-val` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |
| 1427 | `.trace-snap-diff` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |
| 1449 | `.trace-alert-lbl` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |
| 1466 | `.trace-alert-select` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1479 | `.trace-alert-input` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1494 | `.trace-alert-del` | `font-size: 10px;` | `font-size: var(--fs-xs);` |
| 1573 | `.dm-topbar-hint` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1585 | `.dm-exit-btn` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1602 | `.dm-ctrl-btn` | `font-size: 11px;` | `font-size: var(--fs-sm);` |
| 1632 | `.dm-rec-count` | `font-size: 10px;` | `font-size: var(--fs-2xs);` |
| 1644 | `.dm-bp-badge` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |
| 1689 | `.dm-panel-hint` | `font-size: 10px;` | `font-size: var(--fs-xs);` |
| 1702 | `.dm-paused-badge` | `font-size: 9px;` | `font-size: var(--fs-2xs);` |

(`.dm-panel-title` at `:1683` was deleted in Task 8; do not look for it.)

- [ ] **Step 2: The radius sweep**

| Line | Selector | Current | Replace with |
|---|---|---|---|
| 1047 | `.trace-live-dot` | `border-radius: 50%;` | `border-radius: var(--radius-pill);` |
| 1075 | `.trace-var-count` | `border-radius: 10px;` | `border-radius: var(--radius-pill);` |
| 1084 | `.trace-icon-btn` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 1114 | `.trace-clear-btn` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 1383 | `.trace-alert-badge` | `border-radius: 10px;` | `border-radius: var(--radius-pill);` |
| 1401 | `.trace-snap-badge` | `border-radius: 10px;` | `border-radius: var(--radius-pill);` |
| 1464 | `.trace-alert-select` | `border-radius: 3px;` | `border-radius: var(--radius-sm);` |
| 1477 | `.trace-alert-input` | `border-radius: 3px;` | `border-radius: var(--radius-sm);` |
| 1492 | `.trace-alert-del` | `border-radius: 3px;` | `border-radius: var(--radius-sm);` |
| 1518 | `.trace-rec-dot` | `border-radius: 50%;` | `border-radius: var(--radius-pill);` |
| 1590 | `.dm-exit-btn` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 1606 | `.dm-ctrl-btn` | `border-radius: 4px;` | `border-radius: var(--radius-sm);` |
| 1626 | `.dm-rec-dot` | `border-radius: 50%;` | `border-radius: var(--radius-pill);` |
| 1641 | `.dm-bp-badge` | `border-radius: 10px;` | `border-radius: var(--radius-pill);` |
| 1699 | `.dm-paused-badge` | `border-radius: 3px;` | `border-radius: var(--radius-sm);` |

Leave `:1186` (`.trace-scroll::-webkit-scrollbar-thumb`) and `:1759` (`.dm-panel--trace .trace-panel { border-radius: 0 }`) — the first is deleted in Task 10, the second is a deliberate square corner.

- [ ] **Step 3: Retire the deprecated aliases in this region**

Replace, across `styles.css:1006-1765` only:

| Alias | Canonical |
|---|---|
| `var(--border-hard)` | `var(--border-hl)` |
| `var(--text-secondary)` | `var(--text)` |
| `var(--text-primary)` | `var(--text-bright)` |
| `var(--sans, system-ui, sans-serif)` | `var(--font)` |
| `var(--fg)` | `var(--text)` |
| `var(--fg-muted)` | `var(--text-dim)` |

- [ ] **Step 4: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "font-size: 9px\|font-size: 9.5px\|font-size: 10px\|font-size: 11px" -- frontend/src/styles.css
```

Expected: tests green, build clean, and **no hit falls between lines 1006 and 1765**. (Hits outside that range belong to the IDE core and migrate lazily — that is the review's explicit instruction and is not this tranche's scope.)

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "feat(ui): debug and trace panels lifted to the shared type scale and radii"
```

---

### Task 10: One global scrollbar treatment

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: `--scrollbar-thumb` (Task 1), `--radius-sm`.
- Produces: one 8px scrollbar for the whole product, replacing one global block (10px, hardcoded grey, no light variant) and five local overrides across three widths and four thumb radii. The platform screens declare none and currently inherit the chunky 10px. Net line reduction. This is the review's Quick win 15.

- [ ] **Step 1: Rewrite the global block (`styles.css:2745-2756`)**

Replace the `SCROLLBARS (VS Code style)` section body with:

```css
* {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  background-clip: content-box;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
  background-clip: content-box;
}
::-webkit-scrollbar-corner { background: transparent; }
```

- [ ] **Step 2: Delete the five local overrides**

| Lines | What to delete |
|---|---|
| 767-768 | the `scrollbar-width: thin;` + `scrollbar-color: var(--border-hl) transparent;` pair inside `.block-search-dropdown` |
| 770-782 | the four `.block-search-dropdown::-webkit-scrollbar*` rules |
| 1181-1182 | the `scrollbar-width` / `scrollbar-color` pair inside `.trace-scroll` |
| 1184-1186 | the three `.trace-scroll::-webkit-scrollbar*` rules |
| 1971-1973 | the three `.start-content::-webkit-scrollbar*` rules |
| 2249-2250 | the two `.help-sidebar::-webkit-scrollbar*` rules |
| 2413-2415 | the three `.help-content::-webkit-scrollbar*` rules |

(Line numbers are pre-deletion; work **bottom-up** — 2413 first, 767 last — so earlier deletions do not shift later ones.)

- [ ] **Step 3: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -c "webkit-scrollbar" -- frontend/src/styles.css
git grep -c "scrollbar-color" -- frontend/src/styles.css
```

Expected: tests green, build clean, `webkit-scrollbar` count **5** (the five rules in the single global block), `scrollbar-color` count **1**.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "refactor(ui): one 8px scrollbar treatment; delete five local overrides"
```

---

### Task 11: Make the viewport's idle state visible

**Files:**
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: Task 1 tokens; Task 8's `--text-dim` move.
- Produces: the most-seen first-run screen in the product goes from ~1.15:1 to legible in both themes.

`.canvas-idle-inner` applies `opacity: 0.18` to the glyph, the label AND the hint together (`:907-913`). `--text-muted` `#6a6a6a` at 18% over `--canvas-bg` `#0a0a0f` measures ~1.15:1; light theme is ~1.14:1. The pane's only instruction to a first-time student — "Press **Run** to start the simulation" (`GlowCanvas.js:25-28`) — is effectively invisible. This is the review's Quick win 2.

- [ ] **Step 1: Replace the idle block (`styles.css:907-936`)**

Replace `.canvas-idle-inner` through `.canvas-idle-hint strong` with:

```css
.canvas-idle-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  max-width: 320px;
  text-align: center;
}
.canvas-idle-atom {
  width: 48px;
  height: 48px;
  color: var(--accent);
  opacity: 0.35;
}
.canvas-idle-label {
  font-size: var(--label-fs);
  font-weight: var(--label-weight);
  text-transform: var(--label-transform);
  letter-spacing: var(--label-tracking);
  color: var(--text-dim);
  margin: 0;
}
.canvas-idle-hint {
  font-size: var(--fs-md);
  line-height: var(--lh-normal);
  color: var(--text);
  margin: 0;
  text-align: center;
}
.canvas-idle-hint strong {
  color: var(--accent-bright);
  font-weight: var(--fw-semibold);
}
```

`strong` moves from `--green` to `--accent-bright` so the word "Run" matches the Run button, which Task 6 made a filled `--accent` primary. The blanket opacity is gone; only the decorative atom glyph keeps one, at a value that still reads as decoration.

- [ ] **Step 2: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "opacity: 0.18" -- frontend/src/styles.css
```

Expected: tests green, build clean, grep returns **zero lines**.

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/styles.css
git commit -m "fix(ui): the viewport idle state is legible — per-element colour instead of a blanket 18% opacity"
```

---

### Task 12: Dead-code deletions

**Files:**
- Modify: `frontend/src/styles.css`, `frontend/index.html`, `frontend/src/components/BlocklyWorkspace.js`

**Interfaces:**
- Produces: four provably-inert code paths removed. This is the CSS/JS half of the review's Quick win 16.

Each deletion below was re-verified at `f8b1b22`; do not extend the list.

- [ ] **Step 1: The two pre-iframe viewport rules**

`frontend/src/utils/runner/glowRunner.js:131` creates an `<iframe>` inside `#glowscript-host`, not a `<div>` and not a `<canvas>`. Both of these rules have therefore targeted nothing since the iframe refactor.

In `frontend/src/styles.css`, delete `:892-894`:

```css
.glow-host div {
  background: var(--canvas-bg) !important;
}
```

In `frontend/index.html`, delete the entire `<style>` element at `:45-48`:

```html
    <style>
      /* GlowScript injects canvases; make sure they fill the host */
      .glow-host canvas { display: block; width: 100% !important; height: 100% !important; }
    </style>
```

- [ ] **Step 2: The duplicate Inter request**

`frontend/src/styles.css:5` already `@import`s Inter **and** JetBrains Mono from Google Fonts. `frontend/index.html:12` requests Inter a second time. Delete only the `<link>` line, keeping both `<link rel="preconnect">` lines (they still help the `@import`):

```html
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Change the surrounding comment from `<!-- Inter font -->` to `<!-- Fonts are requested by styles.css @import; these preconnects warm the origins -->`.

- [ ] **Step 3: The dead Blockly grid-colour writer**

`frontend/src/styles.css:2893-2895` declares `.blocklyMainBackground + .blocklyGridPattern line { stroke: var(--border) !important; }`. An author `!important` rule always beats a presentation attribute, so the `setAttribute("stroke", …)` in the theme effect can never take effect.

In `frontend/src/components/BlocklyWorkspace.js`, delete these four lines from the `useEffect` that reacts to theme changes (they are the last statements in the effect body, after `ws.setTheme(theme);`):

```js
    // Update grid colour
    const gridColour = isDark ? "#2a2c40" : "#ddd";
    const svgGrid = ws.getParentSvg()?.querySelector(".blocklyGridPattern line");
    if (svgGrid) svgGrid.setAttribute("stroke", gridColour);
```

Leave the `grid:` options at `:326` and `:510` alone — those are read by Blockly at inject time and are live.

- [ ] **Step 4: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
git grep -n "glow-host div\|glow-host canvas\|gridColour" -- frontend
git grep -c "fonts.googleapis.com" -- frontend/index.html
```

Expected: tests green, build clean, first grep returns **zero lines**, second returns **0** (only the `preconnect` to `fonts.googleapis.com` remains — if it reports 1, confirm the hit is the `preconnect`, not a stylesheet `<link>`).

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/styles.css frontend/index.html frontend/src/components/BlocklyWorkspace.js
git commit -m "chore(ui): delete the pre-iframe viewport rules, the duplicate Inter request and the dead grid-colour writer"
```

---

### Task 13: Wrap-up — the full sweep and the README note

**Files:**
- Modify: `README.md`

- [ ] **Step 1: The straggler sweep**

Run all six assertions. Every one must hold before this tranche is called done.

```powershell
git grep -n "007acc\|0, 122, 204" -- frontend/src/styles.css
git grep -n "rgba(255, *255, *255" -- frontend/src/styles.css
git grep -c "text-transform: uppercase" -- frontend/src/styles.css
git grep -c "outline: none" -- frontend/src/styles.css
git grep -n "bg-card\|rec-color\|accent-warn" -- frontend/src
git grep -c "focus-visible" -- frontend/src/styles.css
```

Expected, in order: **2 lines** (the two `--accent` declarations); **only lines above ~210** (inside the theme blocks); **0**; **0**; **0 lines**; **1**.

- [ ] **Step 2: The full verification sweep**

```powershell
npm run test
npm run check:blocks
npm run build -w frontend
npm run typecheck -w backend
npm run typecheck -w shared
```

Expected: every workspace green, registry OK, build clean, typechecks silent. Record exact totals in the commit body if they moved.

- [ ] **Step 3: Update README**

Immediately after the Plan 4 sync paragraph (the one beginning "Signed-in work now syncs" and ending "Returning visitors go straight to the IDE."), add:

```markdown
The interface runs on one design-token system shared by the IDE and the classroom screens:
`--space-*` (4px ramp), `--fs-*` (type scale), three radii (`--radius-sm` 4px controls,
`--radius` 6px cards and panels, `--radius-lg` 10px dialogs), motion, elevation and a
`--label-*` group that gives every small header the same sentence-case voice. Colour is
semantic — `#007acc` now exists only as the two `--accent` definitions and every accent
surface derives from it — so the debug, trace and data-science regions finally follow the
light theme. Three primitives (`.btn`, `.card`, `.panel-header`) are shared by both halves
via selector aliases, there is one global `:focus-visible` ring, and Run is a filled primary.
When adding CSS: use the tokens, never a raw hex below the theme blocks, and never
`rgba(255,255,255,…)` — reach for `var(--card-border)` or a `color-mix()` on a token.
```

- [ ] **Step 4: Commit**

```powershell
git add README.md
git commit -m "docs: the shared design-token system and style primitives in the README"
```

- [ ] **Step 5: Hand off for the browser pass**

CSS work is not test-verifiable. Report to the controller that the tranche is ready for a browser pass, and name the seven screens whose appearance this plan deliberately changed, in both themes: the IDE shell (Run is now a filled blue pill; the status bar is a themed grey strip with a hairline top border, no longer VS Code blue; pane headers are sentence case at 12px in `--text-dim`), the idle 3D viewport (the "Press Run" hint is legible), Debug Mode (12-13px body, 6px radii, red/amber highlights now theme-correct), the start menu (`--radius` 4px → 6px everywhere), the classes wall (`.class-card` now eases on hover and carries the alpha card border), the auth screens (`.auth-card` at 10px radius, submit unchanged), and the welcome page (card and playground borders now visible in light theme; every button converged on the shared `.btn`).

---

## Completion criteria (what Tranche 2 may assume)

- **A complete token system on `:root`**, dark-first with a light block: `--space-0…8`, `--fs-2xs…--fs-hero`, `--lh-tight/--lh-normal`, `--fw-regular…--fw-bold`, `--label-transform/--label-tracking/--label-weight/--label-fs/--label-color`, `--radius-sm/--radius/--radius-lg/--radius-pill`, `--transition-fast/--transition/--transition-slow`, `--shadow-sm/--shadow/--shadow-lg`, `--control-h-sm/--control-h/--control-h-lg`, `--btn-pad-sm/--btn-pad/--btn-pad-lg/--btn-fs`, `--btn-primary-bg/--btn-primary-bg-hover`, `--panel-header-h/--panel-header-h-compact/--pane-header-h`, `--focus-ring-width/--focus-ring-offset/--focus-ring-color`, `--on-accent`, `--scrollbar-thumb`. New rules use them; a raw pixel or hex in a new rule is a review comment.
- **`#007acc` exists exactly twice** — the two `--accent` declarations. `--bg-statusbar`, `--border-focus`, `--run-bg`, `--accent-dim`, `--run-glow`, `--accent-bg` and `--accent-border` all derive from it, so retheming the product is a one-line change.
- **Three primitives are live and aliased**: `.btn` (+ `--primary/--ghost/--danger/--sm/--lg/--block`), `.card` (+ `--interactive/--panel/--lg`), `.panel-header` (+ `--compact`, `__title`). `.admin-btn`, `.welcome-btn`, `.account-chip-btn`, `.vdialog-btn`, `.auth-submit`, `.start-card`, `.class-card`, `.welcome-card`, `.auth-card`, `.classes-newform`, `.pane-header`, `.dm-panel-header` and `.vdialog-header` are aliases — **Tranche 2 may rename any of them to the role name without touching CSS values**, since the review confirmed no test and no snapshot selects by className.
- **One `:focus-visible` ring** covers every interactive element at zero specificity; no `outline: none` remains to defeat it. Tranche 2's keyboard work (`useHotkeys`, the merged header, the `<Overlay>` wrapper) inherits a working focus model.
- **One filled primary per surface**: Run in the IDE core, `.auth-submit`/`.btn--primary` on the platform screens, `.vdialog-btn--ok` in dialogs — all the same treatment. Tranche 2's toolbar restructure can move Run without re-deciding its weight.
- **Light theme is correct everywhere**, including the debug/trace region and the data-science regression readouts, which previously had no `[data-theme="light"]` behaviour at all. `rgba(255,255,255,…)` below the theme blocks is zero, so any future occurrence is a straightforward bug.
- **One label voice**, driven by four tokens across 17 sites — Tranche 2's new headers (merged 44px bar, quiet status bar) adopt `.panel-header` rather than inventing a fifth definition.
- **One 8px scrollbar** with a light variant; the platform screens no longer inherit the chunky untinted 10px.
- Not changed, and still open for Tranche 2/3: the fake titlebar and the triple mode label; the status bar's *content* and height; every keyboard shortcut the UI advertises; responsive behaviour below 1024px; the Blockly palette, `componentStyles` hexes and `cursorColour`; `GravityPlayground`'s particle hexes; the `@import` file split; self-hosted fonts; the `.debug-drawer` rules (kept deliberately for Tranche 3 to revive); the 2px pane-header stripes (review open Q(b), still unanswered).
