# Classroom Platform — Plan 5: Design Alignment and the Informative Welcome Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The classroom portal stops looking like a second product. Every metric on every portal screen resolves through a token, the six shared components the system was missing get built once instead of re-invented per screen, controls a student or teacher actually presses stop being 22px IDE chrome, destructive actions adopt the outlined danger style that currently ships unused, table headers and section captions join the one micro-label system, tab bars and openable rows become operable from a keyboard, and the theme toggle finally exists outside the IDE. On top of that foundation the front page is rebuilt from a door with six adjectives into a page that tells the truth in detail — nine sections drawn from a verified capability inventory, one honest "not yet built" paragraph, and not one claim the product cannot back.

**Architecture:** A three-task serial foundation lands first — the two ramp/tracking decisions written into `tokens.css` and into the spec that governs them; the six missing primitives (`.input`, `.alert`, `.badge`, `.empty`, `.tabs`, `.range`) added to `primitives.css`; and the lane-separation move that makes the rest parallelisable — the welcome rules split out of `styles/platform.css` into their own `styles/welcome.css`, and the theme-toggle button extracted out of `Toolbar.js` into a component both lanes can mount. Then two worktree lanes run over disjoint files: **Lane P (portal)** owns `platform.css`, `responsive.css` and the auth / classes / admin / sync components, working through tokenisation → focus and touch → control sizing → system adoption → accessibility idioms → the shared page shell and header; **Lane W (welcome)** owns `welcome.css`, `welcome/*` and `Icons.js`, folding the parallel icon module into the one icon module and then rebuilding the page on the real primitive API. Both lanes merge before the alias lists in `primitives.css` are deleted — that deletion is only safe once no markup references them. The durable output is not the substitution itself but the two **conformance tests** that read the stylesheets and fail the suite the moment a literal metric reappears.

**Tech Stack:** React 18 + Vite 7, plain JavaScript, Vitest 4. **No new dependencies.** Component behaviour is verified with `frontend/src/test/renderHelpers.js` (`mountComponent` / `click` / `keyDown` / `byText` / `byTitle`); pure logic with plain Vitest; stylesheet conformance by reading the file, exactly as `frontend/src/utils/blockly/__tests__/paletteCssSync.test.js` already does.

**Spec:** [docs/classroom-platform.md](../../classroom-platform.md) **§18 The design contract** (clauses D1–D16, rev 3) is binding on every task here. Supporting: §3.1 (the front page's three doors), §13 (the 1024px floor), §14 (the screen inventory), [docs/product-contract.md](../../product-contract.md)'s five design Locked-decision rows and its Design-system quality gates, and [docs/classroom-platform-stack.md](../../classroom-platform-stack.md) §2 (the design system as a shared dependency; the load-bearing manifest order).

**Research inputs:** [Design-Alignment Delta](../reviews/2026-08-22-classroom-platform-design-alignment.md) (clauses C1–C18, the substitution tables, the per-surface work list) and the [Welcome Page Brief](../reviews/2026-08-22-welcome-page-brief.md) (audience analysis, the section-by-section outline, the explicit non-claims list). **Where either disagrees with [`.superpowers/classroom-spec-alignment-report.md`](../../../.superpowers/classroom-spec-alignment-report.md), the report wins** — it re-checked the research against the tree and found four places the research was wrong. Where any of the three disagrees with the tree as verified below, this plan says so and follows the tree.

**Depends on:** IDE Modernization Plans [1](2026-08-20-ide-modernization-01-visual-foundation.md) (tokens, the three primitives, the one focus ring), [2](2026-08-20-ide-modernization-02-interaction-upgrades.md) (`renderHelpers.js`, the zoned header), [3](2026-08-21-ide-modernization-03-makecode-overhaul.md) (the eleven-file stylesheet split behind the manifest, `visibleControls.js`, the `--cat-*` block) and [4](2026-08-20-ide-modernization-04-deeper-mechanics.md) — **all four have shipped.** Classroom Plans 1–4 built the screens this plan realigns. **Nothing here depends on unshipped work.**

---

## Citation convention — read this before cutting any range

Every line number in this plan was verified against `feature/classroom-platform` at **`6df894a`** (clean tree) while the plan was being written. They supersede the research documents' citations, several of which were taken at earlier commits and a handful of which are off by one or two lines (each such correction is named in the task that touches it).

> **A line number here is a locator, never an offset to cut by.** Re-resolve it at implementation time by **CSS selector, declaration text, component name, function name, JSX element or string literal**. Several tasks in this plan renumber the files that later tasks cite — Task 3 removes 68 lines from the middle of `platform.css`, and Task 4 rewrites almost every declaration in it. After Task 3, every `platform.css:2NN` citation below is stale by construction; find the **selector**. This is the same convention Plans 2, 3 and 4 used and for the same reason.

**Two corrections to the research, applied throughout:**

- The alignment delta cites `AdminConsole.js:243-244` for the health readout; the actual lines are **`AdminConsole.js:242-243`**.
- The welcome brief cites `frontend/src/constants.js`; the file is **`frontend/src/constants/index.js`** (imported as `"../constants"`). `WELCOME_PASSED_SESSION_KEY` is at `:68`, `SIGNED_IN_HINT_KEY` at `:61`, `THEME_STORAGE_KEY` at `:9`.

---

## Controller rulings — the spec's two open decisions, now closed

`docs/classroom-platform.md` §18 lists two decisions as deliberately unsettled (lines 550–554). Both are decided here, and **Task 1 writes them into the spec before any code lands**, per D16 and the contract's change protocol.

**Decision 1 — the welcome page's section rhythm. Extend the ramp: add `--space-9: 64px` and use it for all three gaps.**
The page's three big vertical gaps are 56px, 64px and 72px (`platform.css:245, 254, 270`) and the ramp stops at `--space-8: 48px` (`tokens.css:18`). The welcome page is a marketing-shaped surface and legitimately needs more air than app chrome; collapsing all three to 48px would cramp a page that is about to grow from four sections to nine. Adding one rung to a shared ramp is a smaller, more honest change than special-casing one page with an escape hatch. **Recorded as a deliberate design-system extension, not a silent edit** — it goes into §18's clause list and into `product-contract.md`'s locked decisions, not just into `tokens.css`.

**Decision 2 — tracking. Two fall back, one survives as a named token.**
- `.auth-brand`'s hardcoded `0.02em` (`platform.css:20`) → `var(--label-tracking)`. It was always the same number; it just was not spelled as the token.
- The welcome hero's `letter-spacing: 0.5px` (`platform.css:215`) → **dropped entirely.** A px tracking on a 44px display face is the only px-based tracking in the product, and at that size Inter needs none.
- The join code's `0.08em` (`platform.css:180`) → **survives, as a new named token `--tracking-code: 0.08em`.** Spec §3.3 chose the join-code alphabet specifically so that no two characters look alike; a monospace code read off a projector needs that air. It becomes a token with a stated purpose rather than a magic number sitting in one rule.

---

## Global Constraints

- **Every task commits on `feature/classroom-platform`.** Ports 3000/4000/5433 unchanged.
- **`backend/` and `shared/` are untouched.** Proved in the wrap-up with `npm run typecheck -w backend` and `npm run typecheck -w shared`. Note `frontend` has **no** typecheck script; its gates are `npm run test -w frontend` and `npm run build -w frontend`.
- **No new dependencies.** Not for icons, not for syntax highlighting, not for a testing library. `renderHelpers.js` is the component harness and it stays dependency-free by design (`frontend/src/test/renderHelpers.js:1-9`).
- **No emoji in product UI, ever** (D10, standing owner rule 2026-08-19). Icons are inline SVG from `frontend/src/components/Icons.js` in its one idiom: `const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }` and `sz(size)` with a `size` prop defaulting to 16 (`Icons.js:8-9`). A new surface imports from that module or adds an export to it; **no second icon file.**
- **AA contrast holds.** No colour change is in scope — the colour layer is already fully adopted (one hardcoded hex in the whole portal stylesheet, `platform.css:186`, and Task 7 removes it). Any new colour is a `color-mix` over an existing semantic token.
- **The reserved red hue band (340°–15°) stays reserved** for errors, breakpoints, Stop and the outlined danger style. No portal surface introduces a red accent, a red category or a filled red button. Enforced by `frontend/src/utils/blockly/__tests__/blockPalette.test.js:42-51`.
- **`prefers-reduced-motion` guards every animation**, and the house pattern is **degrade the motion, keep the affordance** — a reveal that animates in becomes a thing that is simply already there, never a thing that never appears. `frontend/scripts/e2e-test.mjs:1782-1798` fails the build if the guard is missing from shipped CSS.
- **`data-theme` only.** No `prefers-color-scheme` rule exists anywhere in app CSS and none may be added. Dark binds to bare `:root` (`tokens.css:96-97`), light is one override block (`tokens.css:197`), the attribute goes on `<html>` via `contexts/ThemeContext.js:23-30`. A new colour that varies by theme is declared in **both** blocks, or it silently keeps its dark value in light mode.
- **1024px is the floor** (`platform.css:283-295`). Nothing load-bearing disappears at it. The one deliberate exception in this plan is the welcome page, which is explicitly built to read on a phone because a student scanning a projected QR code lands there on one — that is a claim about *this page*, never about the IDE.
- **Placement rules for new CSS (C15/D-supporting).** `frontend/src/styles.css` is a 17-line `@import` manifest and **its order is load-bearing**. New *shared* primitives go in `primitives.css`; portal-screen rules go in `platform.css`; welcome rules go in `welcome.css` (created in Task 3, imported after `platform.css`). `platform.css`'s responsive block must stay at the end of its file — the comment at `platform.css:282-295` explains why, and it is right. **The four executed classroom plans instruct "Append to `frontend/src/styles.css`" (plan 02 lines 2882, 3368; plan 03 line 2202; plan 04 lines 1798, 1880, 2217). That instruction is wrong and must never be repeated.**
- **Component tests live at `frontend/src/<area>/__tests__/<name>.test.js`.** Vitest collects `src/**/*.test.js` (`frontend/vite.config.mjs:62`). `setupTests.js` already stubs `matchMedia` (never-matching) and `TextEncoder`/`TextDecoder`. Suites that mount a portal screen needing router or query context must provide it or mock the hook — follow `components/auth/__tests__/HeaderAccount.test.js`.
- **Every task states its verification and every task ends in a commit.** A task whose only change is mechanical CSS substitution must ship a conformance test with it; that is the whole point of this plan.

---

## Lane ownership

Tasks 1–3 are strictly serial and land on `feature/classroom-platform` before either lane starts. Then Lane P and Lane W run in parallel worktrees. Tasks 13 and 14 run after both lanes merge.

| Lane | Tasks (in order) | Files owned exclusively |
|---|---|---|
| **Foundation** (serial) | 1 → 2 → 3 | `styles/tokens.css`, `styles/primitives.css`, `styles/pages.css`, `styles.css`, `components/Toolbar.js`, `components/layout/ThemeToggleButton.js`, `styles/__tests__/metricLint.js`, `docs/classroom-platform.md`, `docs/product-contract.md` |
| **Lane P — portal** | 4 → 5 → 6 → 7 → 8 → 9 | `styles/platform.css`, `styles/responsive.css`, `styles/__tests__/platformTokens.test.js`, `components/auth/*`, `components/classes/*`, `components/admin/*`, `sync/*`, `components/layout/PortalHeader.js` |
| **Lane W — welcome** | 10 → 11 → 12 | `styles/welcome.css`, `styles/__tests__/welcomeTokens.test.js`, `welcome/*`, `components/Icons.js` |
| **Merge** (serial) | 13 → 14 | `styles/primitives.css` (again), `docs/*`, `frontend/e2e/` |

**Files two tasks touch — stated owner, no exceptions:**

| File | Touched by | Owner rule |
|---|---|---|
| `styles/primitives.css` | Task 2 (adds six primitives), Task 13 (deletes the alias lists) | Foundation writes it; **Lanes P and W only consume it, never edit it.** Task 13 runs after both lanes merge. |
| `styles/platform.css` | Tasks 3, 4, 6, 7, 8, 9 | Task 3 (foundation) removes the welcome block. Thereafter **Lane P alone**, serially. (Task 5 is the one Lane P task that does not touch it — it owns `responsive.css` only.) |
| `styles/welcome.css` | Task 3 (creates), Tasks 11, 12 | Task 3 creates it by verbatim move. Thereafter **Lane W alone**. |
| `components/Icons.js` | Task 10 (adds exports) | **Lane W writes it.** Lane P's Task 7 only *imports* `SearchIcon` (`Icons.js:128`), `CheckIcon` (`:148`) and `AlertTriangleIcon` (`:298`), all of which already exist — Lane P adds no export and must not. |
| `components/layout/ThemeToggleButton.js` | Task 3 (creates), Task 9 (mounts), Task 11 (mounts) | Created in the foundation precisely so both lanes can import it read-only. **Neither lane edits it.** |
| `components/auth/AccountChip.js` | Task 6 (nav rows), Task 7 (`ACCOUNT` casing, badge) | Both in Lane P, serial. Task 6 first. |
| `docs/classroom-platform.md`, `docs/product-contract.md` | Task 1 (decisions), Task 14 (final docs pass) | Task 1 is foundation; Task 14 is post-merge. No overlap in time. |
| `docs/superpowers/plans/2026-08-1{8,9}-classroom-platform-0*.md` | Task 14 only (stale banners) | Nothing else touches the executed plan records. |

---

## Deferred — deliberately NOT here, do not flag as missing

- **Assignments and everything downstream of them** (submissions, marking, feedback, gradebook, the instructions/guide editor, per-assignment workspace rules, pairs and groups). That is the next plan, and it is the reason this one exists first: building new assignment screens on un-tokenised, alias-driven CSS would only deepen the debt.
- **Portal end-to-end coverage.** `docs/e2e-checklist.md` has zero portal suites (A1–A18 are all IDE) and Playwright golden flows were deferred by classroom Plan 2. Task 14 records the gap in the checklist; **building the suites is not in scope.**
- **A build-wired token lint.** The two conformance tests here run in `npm run test -w frontend`, which is the ship gate. Wiring an additional `check:*` script is deferred until there is a second thing for it to check.
- **Retiring the IDE's own magic z-indices.** Task 1 adds the `--z-*` scale and Task 7 adopts `--z-toast` for the one portal offender (`platform.css:200`, `z-index: 4000`). `.app-header`'s 50 (`chrome.css:15`) and `.overlay-backdrop`'s 900 / `.vdialog-overlay`'s 1000 (`pages.css:842`, `:863`) are IDE surfaces and stay as they are.
- **Any colour change**, the block palette, and the deprecated alias tokens (`--bg-toolbar`, `--bg-sidebar`, `--font-mono`, `--error` at `tokens.css:185-191`). The portal correctly uses none of the deprecated four; keep it that way.
- **Splitting `.admin-table-wrap` out of `pages.css`.** It lives at `pages.css:834-837`, is the one portal selector outside `platform.css`, and carries no metric literals. Leave it.
- **Real email delivery, the notification bell, peer sharing, admin data requests, browsable version history.** All named in the welcome brief's non-claims list; none may appear on the page in any form.

---

### Task 1: Extend the ramp — `--space-9`, `--tracking-code`, the `--z-*` scale, and both open decisions closed in the spec

**Files:**
- Modify: `frontend/src/styles/tokens.css`
- Modify: `docs/classroom-platform.md` (§18 — the Open decisions block becomes a record of decisions taken; D1's scale list gains the new rung)
- Modify: `docs/product-contract.md` (the design amendment's pointer to the two open decisions; the Design tokens locked-decision row)
- Create: `frontend/src/styles/__tests__/tokenRamp.test.js`

**Interfaces:**
- Produces: `--space-9: 64px`, `--tracking-code: 0.08em`, `--z-header/--z-dropdown/--z-overlay/--z-dialog/--z-toast`. Every later task consumes these.
- Consumes: nothing.

Paperwork first. `docs/product-contract.md`'s change protocol says *"Land the change in code only after the contract reflects it"*, and §18's D16 says extending a ramp is a decision that gets written down. This task does both in one commit so the record and the code cannot drift.

- [ ] **Step 1: Write the failing test** — `frontend/src/styles/__tests__/tokenRamp.test.js`:

```js
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* __dirname + resolve() rather than import.meta.url — see the note in
   utils/blockly/__tests__/paletteCssSync.test.js for why the URL form trips
   Vite's compile-time asset rewrite under Vitest's jsdom environment. */
const CSS = readFileSync(resolve(__dirname, "../tokens.css"), "utf8");

/** The declaration value for a token at bare :root, whitespace-collapsed. */
function tokenValue(name) {
  const m = CSS.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

describe("token ramp extensions (Plan 5, 2026-08-22)", () => {
  test("the spacing ramp gains exactly one rung at 64px", () => {
    expect(tokenValue("--space-8")).toBe("48px");
    expect(tokenValue("--space-9")).toBe("64px");
    // One rung, not a habit: nothing above it.
    expect(tokenValue("--space-10")).toBeNull();
  });

  test("the join code's tracking is a named token, not a magic number", () => {
    expect(tokenValue("--tracking-code")).toBe("0.08em");
    expect(tokenValue("--label-tracking")).toBe("0.02em");
  });

  test("the z-index scale exists and is ordered", () => {
    const z = ["--z-header", "--z-dropdown", "--z-overlay", "--z-dialog", "--z-toast"]
      .map((n) => Number(tokenValue(n)));
    expect(z).toEqual([50, 100, 900, 1000, 1100]);
  });
});
```

- [ ] **Step 2: Run it to fail** — `npm run test -w frontend -- tokenRamp` → FAIL (three tokens missing).

- [ ] **Step 3: Add the tokens.** In `frontend/src/styles/tokens.css`, in the bare `:root` block (`:8-93`):

Under the space ramp, immediately after `--space-8: 48px;` (`:18`):

```css
  /* One rung above the app-chrome ramp, added 2026-08-22 (Plan 5) for the
     welcome page's section rhythm: a marketing-shaped surface legitimately
     needs more air than app chrome, and its three gaps (56/64/72px) had all
     fallen off the top of the ramp. Recorded in classroom-platform.md §18 and
     in product-contract.md's locked decisions — extending a ramp is a
     decision, not an edit. Use it for page-level section rhythm only. */
  --space-9:  64px;
```

Immediately after `--label-fs: var(--fs-sm);` (`:49`), inside the micro-label block's trailing space:

```css
  /* Display tracking for the class join code, and nothing else. Spec §3.3
     chose that alphabet so no two characters look alike; a monospace code
     read off a projector needs the air. Named rather than inlined so the
     one place it is legitimate is visible. */
  --tracking-code:   0.08em;
```

After the focus-geometry pair (`:86-88`):

```css
  /* ── Stacking order ────────────────────────────────────────
     Retires the magic numbers. The portal's toast was z-index: 4000
     against a product whose highest real layer is 1000. */
  --z-header:   50;
  --z-dropdown: 100;
  --z-overlay:  900;
  --z-dialog:   1000;
  --z-toast:    1100;
```

- [ ] **Step 4: Run the test to pass** — `npm run test -w frontend -- tokenRamp` → PASS. Then the full suite: `npm run test -w frontend` → all green (no existing rule reads any of the three names yet, so nothing can regress).

- [ ] **Step 5: Close the decisions in the spec.** In `docs/classroom-platform.md`, rewrite the **"Open decisions — deliberately not settled here"** block (`:548-554`) as **"Decisions taken"**, dated 22 August 2026, recording:
  1. *The welcome page's section rhythm.* The ramp was **extended once**, with a single new rung at 64px, and all three gaps now use it. State the reasoning in the file's own voice: a marketing-shaped page needs more air than app chrome, and adding one shared rung is a smaller change than special-casing a page. State that the rung is for page-level section rhythm and that a second extension would need its own decision.
  2. *Letter-spacing.* The brand wordmark falls back to the one tracking value; the front-page hero drops tracking entirely; **the join code's wider tracking survives as a named token** for exactly the reason §3.3 gives.

  Also amend **D1** (`:514`) so its scale list names the ramp honestly: *"a 4px spacing ramp of nine rungs"* rather than a count that the extension has just falsified. Add the revision-3 amendment line's counterpart at the top of the file in the existing style — a short dated note that §18's two open decisions were closed on 22 August 2026 and how.

- [ ] **Step 6: Mirror into the contract.** In `docs/product-contract.md`, amend the **Design tokens** locked-decision row so its description names the nine-rung ramp and the two new named tokens, and update the design-system amendment's line pointing at "two open decisions" so it points at the decisions taken and where they are recorded. Do not add a new amendment — this is a resolution of the existing one.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/styles/__tests__/tokenRamp.test.js docs/classroom-platform.md docs/product-contract.md
git commit -m "feat(frontend): extend the ramp once — --space-9, --tracking-code, the --z-* scale; spec §18's two open decisions closed"
```

---

### Task 2: The six shared components the system does not have — `.input`, `.alert`, `.badge`, `.empty`, `.tabs`, `.range`

**Files:**
- Modify: `frontend/src/styles/primitives.css` (append three new primitive sections after `.panel-header`)
- Modify: `frontend/src/styles/pages.css` (delete the `.start-empty` rule at `:243-251`; it is promoted)
- Create: `frontend/src/styles/__tests__/primitivesTokens.test.js`

**Interfaces:**
- Produces: `.input`, `.alert` + `.alert--info/--success/--warning/--danger`, `.badge` + `.badge--warning/--success/--danger/--accent`, `.empty`, `.tabs` + `.tab` + `.tab--on`, `.range`. **Lanes P and W both consume these and neither may edit this file.**
- Consumes: Task 1's tokens (`--z-*` not used here).

`primitives.css` currently exposes exactly three components — `.btn` (`:6`), `.card` (`:140`), `.panel-header` (`:178`) — and every one of the six below is currently re-invented on the portal. Build each from the idiom the IDE already established, named in the table:

| New | Faked today at | Built from |
|---|---|---|
| `.input` | `.auth-input` (`platform.css:36-44`), reused for the class code, the admin search and the cap field | `--bg-input`, `--border`, `--radius-sm`, `--control-h`, `--fs-lg`; matches `.btn`'s shape; **no `:focus` rule** (D8) |
| `.alert` ×4 | `.auth-error` (`platform.css:66-72`) — a form-field error box doing duty as a whole-page failure state at `ClassChrome.js:27`, `InviteLandingPage.js:67`, `JoinClassPage.js:83` | the `.run-error-banner` idiom (`chrome.css:526-544`): `color-mix(… 12%)` fill, `color-mix(… 35%)` border, generalised over `--accent`/`--success`/`--warning`/`--danger` |
| `.badge` ×4 | `.account-chip-badge` (`platform.css:93-100`) and `.class-archived-badge` (`:167-175`) — verbatim duplicates, both with a non-token `border-radius: 3px` | the `.tb-chip` shape (`chrome.css:247-264`): `--radius-pill`, `--fs-2xs`, `--fw-semibold`, `color-mix` tint |
| `.empty` | bare `auth-text auth-text--dim` paragraphs at `ClassesHome.js:96-102` and `ClassChrome.js:77-79` | promote `.start-empty` (`pages.css:243-251`) — it is already exactly right |
| `.tabs` / `.tab` | `.admin-tabs` / `.admin-tab` (`platform.css:109-119`), which has **no `:hover` rule at all** | the same shape plus `--bg-hover`; the 2px active underline in `--accent` |
| `.range` | `GravityPlayground.js:123-131` is a raw unthemed `<input type="range">` — the page's one interactive control. The IDE's zoom slider that would have been the precedent was deleted in `4f11684` | `--bg-input` track, `--border`, `--radius-pill`, `--accent` thumb, `--control-h-sm` thumb size |

- [ ] **Step 1: Write the failing test** — `frontend/src/styles/__tests__/primitivesTokens.test.js`:

```js
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS = readFileSync(resolve(__dirname, "../primitives.css"), "utf8");
const PAGES = readFileSync(resolve(__dirname, "../pages.css"), "utf8");

const REQUIRED = [
  ".input", ".alert", ".alert--info", ".alert--success", ".alert--warning",
  ".alert--danger", ".badge", ".empty", ".tabs", ".tab", ".tab--on", ".range",
];

describe("primitives.css — the six components the portal was re-inventing", () => {
  test("every new primitive is declared here", () => {
    for (const sel of REQUIRED) {
      expect(CSS).toMatch(new RegExp(`(^|[,\\s])\\${sel}[\\s,{]`, "m"));
    }
  });

  test(".start-empty is promoted, not duplicated", () => {
    expect(CSS).toContain(".start-empty");     // aliased onto .empty here
    expect(PAGES).not.toContain(".start-empty"); // and gone from pages.css
  });

  test("no primitive redefines the one focus ring", () => {
    // D8: exactly one :focus rule ships, and it is the :where() block in
    // tokens.css. .input in particular must not repeat .auth-input's mistake.
    expect(CSS).not.toMatch(/:focus\b/);
  });

  test("the danger colours stay inside the reserved red band's own token", () => {
    // No portal primitive introduces a red literal; --red/--danger only.
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
```

- [ ] **Step 2: Run it to fail** — `npm run test -w frontend -- primitivesTokens` → FAIL.

- [ ] **Step 3: Append the primitives** to `frontend/src/styles/primitives.css`, after the `.panel-header` section ends (currently `:224`). Every value is a token; no literal metric appears:

```css
/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .input
   Same shape as .btn so a field and a button sitting side by
   side line up. NO :focus rule: tokens.css's zero-specificity
   :focus-visible ring is the only one in the product (D8), and
   .auth-input:focus is the cautionary tale of what a 0-1-1
   override does to it product-wide.
   ═══════════════════════════════════════════════════════════ */
.input,
.auth-input {
  min-height: var(--control-h);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font);
  font-size: var(--fs-lg);
  color: var(--text-bright);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.input:disabled,
.auth-input:disabled { opacity: 0.5; cursor: not-allowed; }
/* A code entered by a human off a projector reads as the code it is. */
.input--code {
  font-family: var(--mono);
  letter-spacing: var(--tracking-code);
  text-transform: uppercase;
}

/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .alert
   Generalises .run-error-banner (chrome.css) over the four
   semantic colours. --alert-color is the one knob.
   ═══════════════════════════════════════════════════════════ */
.alert {
  --alert-color: var(--accent);
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--fs-md);
  color: var(--alert-color);
  background: color-mix(in srgb, var(--alert-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--alert-color) 35%, transparent);
  border-radius: var(--radius-sm);
}
.alert svg { flex-shrink: 0; }
.alert--info    { --alert-color: var(--accent); }
.alert--success { --alert-color: var(--success); }
.alert--warning { --alert-color: var(--warning); }
.alert--danger,
.auth-error     { --alert-color: var(--danger); }

/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .badge
   The .tb-chip shape (chrome.css), tinted by --badge-color.
   ═══════════════════════════════════════════════════════════ */
.badge,
.account-chip-badge,
.class-archived-badge {
  --badge-color: var(--text-dim);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: var(--space-2);
  padding: 0 var(--space-2);
  font-size: var(--fs-2xs);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--label-tracking);
  line-height: var(--lh-tight);
  color: var(--badge-color);
  background: color-mix(in srgb, var(--badge-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--badge-color) 35%, transparent);
  border-radius: var(--radius-pill);
  vertical-align: middle;
}
.badge--accent  { --badge-color: var(--accent-bright); }
.badge--success { --badge-color: var(--success); }
.badge--warning,
.account-chip-badge,
.class-archived-badge { --badge-color: var(--warning); }
.badge--danger  { --badge-color: var(--danger); }

/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .empty
   Promoted verbatim out of pages.css, where the IDE's start
   menu already had exactly the right treatment.
   ═══════════════════════════════════════════════════════════ */
.empty,
.start-empty {
  margin: 0 0 var(--space-6);
  padding: var(--space-4);
  font-size: var(--fs-md);
  color: var(--text-dim);
  background: var(--card-bg);
  border: 1px dashed var(--card-border);
  border-radius: var(--radius);
}
/* An empty state inside a grid is a statement about the grid, not a cell. */
.empty--full { grid-column: 1 / -1; }

/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .tabs / .tab
   ARIA lives in the markup (D14); this is the treatment only.
   ═══════════════════════════════════════════════════════════ */
.tabs,
.admin-tabs {
  display: flex;
  gap: var(--space-1);
}
.tab,
.admin-tab {
  padding: var(--space-2) var(--space-4);
  font-family: var(--font);
  font-size: var(--fs-md);
  color: var(--text-dim);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--transition), background var(--transition);
}
.tab:hover,
.admin-tab:hover { background: var(--bg-hover); color: var(--text); }
.tab--on,
.tab[aria-selected="true"],
.tab[aria-current="page"],
.admin-tab--on {
  color: var(--text-bright);
  border-bottom-color: var(--accent);
}

/* ═══════════════════════════════════════════════════════════
   PRIMITIVES — .range
   The product had no themed slider: the IDE's zoom slider was
   deleted in 4f11684 and the welcome playground's control is
   raw. Both WebKit and Firefox pseudo-elements, because a
   half-themed slider looks worse than an unthemed one.
   ═══════════════════════════════════════════════════════════ */
.range {
  appearance: none;
  -webkit-appearance: none;
  height: var(--control-h-sm);
  background: transparent;
  cursor: pointer;
}
.range::-webkit-slider-runnable-track {
  height: var(--space-1);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
}
.range::-moz-range-track {
  height: var(--space-1);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
}
.range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: var(--space-4);
  height: var(--space-4);
  margin-top: calc(-1 * var(--space-2) + var(--space-1));
  background: var(--accent);
  border: 1px solid var(--accent-bright);
  border-radius: var(--radius-pill);
}
.range::-moz-range-thumb {
  width: var(--space-4);
  height: var(--space-4);
  background: var(--accent);
  border: 1px solid var(--accent-bright);
  border-radius: var(--radius-pill);
}
```

Note the aliasing strategy: `.auth-input`, `.auth-error`, `.account-chip-badge`, `.class-archived-badge`, `.admin-tabs`, `.admin-tab` are comma-appended here **only so the portal keeps rendering while Lane P migrates the markup**. They are added to the retirement list in Task 13, which deletes them along with the older aliases. `.start-empty` is different — it is the IDE's live class and it stays.

- [ ] **Step 4: Delete the promoted rule.** Remove `.start-empty { … }` from `frontend/src/styles/pages.css` (`:243-251`). Its only consumer is `components/StartMenu.js:372` and it now resolves from `primitives.css`. **Cascade check:** `pages.css` loads *before* `primitives.css` in the manifest, so the rule moves later in source order; grep proves there is no second `.start-empty` rule anywhere to be overridden (`Select-String -Path frontend/src -Pattern "start-empty" -Recurse` returns exactly the two hits above).

- [ ] **Step 5: Run the test to pass** — `npm run test -w frontend -- primitivesTokens` → PASS. Full suite green. `npm run build -w frontend` → clean.

- [ ] **Step 6: Visual check.** `npm run dev`; in both themes open the IDE start menu (`.start-empty` unchanged), `/auth/signin` (inputs unchanged in shape), `/classes` and `/admin`. Nothing should look different yet — this task adds vocabulary, it does not change any screen.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles/primitives.css frontend/src/styles/pages.css frontend/src/styles/__tests__/primitivesTokens.test.js
git commit -m "feat(frontend): six shared primitives — .input, .alert, .badge, .empty, .tabs, .range; .start-empty promoted out of pages.css"
```

---

### Task 3: Lane-separation groundwork — `welcome.css` split out, `ThemeToggleButton` extracted, the metric linter written

**Files:**
- Create: `frontend/src/styles/welcome.css` (verbatim move of `platform.css:212-280` plus the welcome half of `:276-280`)
- Modify: `frontend/src/styles/platform.css` (the welcome block removed), `frontend/src/styles.css` (manifest gains one line)
- Create: `frontend/src/components/layout/ThemeToggleButton.js`
- Modify: `frontend/src/components/Toolbar.js` (the `themeToggle` renderer at `:254-262` delegates)
- Create: `frontend/src/styles/__tests__/metricLint.js` (the shared checker — a helper, not a suite), `frontend/src/styles/__tests__/metricLint.test.js`, `frontend/src/components/layout/__tests__/ThemeToggleButton.test.js`

**Interfaces:**
- Produces: `styles/welcome.css` on the manifest after `platform.css`; `ThemeToggleButton` as a two-prop component; `metricLint.js` exporting `metricViolations(css)`.
- Consumes: nothing. **This task exists so Lanes P and W never touch the same file.**

- [ ] **Step 1: Move the welcome rules verbatim.** Cut `frontend/src/styles/platform.css` lines **212–280** (from the `/* ---- Welcome screen (Plan 4, user-requested) ---- */` comment through `.welcome-reveal.is-on`) into a new `frontend/src/styles/welcome.css`, plus the three welcome selectors inside the reduced-motion block at `:276-280` (`.welcome-orbit__path`, `.welcome-reveal`, `.welcome-btn`) — that whole `@media (prefers-reduced-motion: reduce)` block is welcome-only, so it moves entire. **No reformatting and no value changes in this task**; Task 4 tokenises what stays in `platform.css` and Tasks 11–12 rewrite what moved. Head the new file:

```css
/* ═══════════════════════════════════════════════════════════
   WELCOME — the front page at /welcome.
   Split out of platform.css on 2026-08-22 so the portal and the
   front page can be worked on independently. Loads AFTER
   platform.css in the manifest (styles.css) and after
   primitives.css, so it may override either; nothing in the
   portal may rely on overriding it.

   The responsive region at the end of this file must stay at the
   end, for the same reason platform.css documents at its own:
   the base rules here are unconditional and equal-specificity,
   so source order decides.
   ═══════════════════════════════════════════════════════════ */
```

- [ ] **Step 2: Add it to the manifest.** In `frontend/src/styles.css`, insert `@import "./styles/welcome.css";` **between** the `platform.css` and `responsive.css` lines. Order matters and the file says so at the top.

- [ ] **Step 3: Prove the move is lossless.** `npm run build -w frontend` → clean. `npm run dev` → `/welcome` renders byte-identically in both themes (spot-check the hero size, the orbit, the card grid, the playground and the reveal-on-scroll). `npm run test -w frontend` → green.

- [ ] **Step 4: Extract the theme toggle.** Create `frontend/src/components/layout/ThemeToggleButton.js`:

```js
import React from "react";
import { SunIcon, MoonIcon } from "../Icons";

/**
 * The one theme toggle. Extracted from Toolbar's CONTROL_RENDERERS so the
 * portal header and the front page can mount it too — until now `useTheme()`
 * was consumed in exactly two places and a visitor on /welcome, /auth/*,
 * /classes, /profile or /admin had no way to switch (spec §18 D9).
 *
 * Stateless on purpose: the IDE header already holds isDark/onToggle as
 * props, and portal surfaces read them straight from useTheme().
 */
export default function ThemeToggleButton({ isDark, onToggle, className = "tb-btn tb-btn--icon tb-btn--theme" }) {
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
    </button>
  );
}
```

Note the addition of `aria-label`: the button has no visible text, so `title` alone was carrying the accessible name. `DropdownMenu.js:9-14` already writes the reasoning down for the product — a `title` is not a label (WCAG 2.5.3).

- [ ] **Step 5: Delegate from `Toolbar.js`.** Replace the body of `CONTROL_RENDERERS.themeToggle` (find it by the key name; currently `Toolbar.js:254-262`) with `themeToggle: () => <ThemeToggleButton isDark={isDark} onToggle={onToggleTheme} />,` and add the import. `SunIcon`/`MoonIcon` may become unused in `Toolbar.js` — remove them from its import list only if nothing else in the file uses them.

- [ ] **Step 6: Test the extracted component** — `frontend/src/components/layout/__tests__/ThemeToggleButton.test.js` using `mountComponent`/`click`/`byTitle`: renders the sun with `isDark`, the moon without, fires `onToggle` once per click, and carries an `aria-label` equal to its title. Then run the existing header suites — `npm run test -w frontend -- Toolbar` → `Toolbar.test.js`, `ToolbarDebug.test.js` and `ToolbarResponsive.test.js` all still pass (if any asserts on the toggle by `title`, the title string is unchanged by design).

- [ ] **Step 7: Write the metric linter** — `frontend/src/styles/__tests__/metricLint.js`. It is imported by Tasks 4 and 11, so it is written here, before the lanes split. Vitest collects `src/**/*.test.js` only, so this `.js` helper is not itself collected:

```js
/**
 * Reads a stylesheet and reports literal metrics on the properties spec
 * §18 D1 governs. The point is not this pass — it is that the pass cannot
 * silently regress once it has landed.
 *
 * Deliberately NOT covered, and why:
 *   width / height / max-width / min-width / inset offsets — layout
 *     dimensions (a 420px form, a 1000px body, a 220px card track, a 260px
 *     canvas) sit on no ramp and were never meant to.
 *   border-width — the product writes 1px and 2px hairlines literally
 *     everywhere, including workspace.css's category strips. There is no
 *     border-width token and D16 says inventing one is a decision, not a
 *     side effect of a substitution pass.
 *   animation-duration — the three duration tokens govern UI transitions.
 *     A 13-second orbit period is a keyframe animation, not a transition.
 *
 * A declaration may opt out by carrying `metric-exempt` in a comment on its
 * own line, which must state a reason. That is the escape hatch D16 asks for:
 * visible, greppable, and never silent.
 */
const COVERED = [
  "font-size", "font-weight", "line-height", "letter-spacing",
  "border-radius",
  "gap", "row-gap", "column-gap",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "z-index",
  "transition", "transition-duration",
];

const DECL = new RegExp(String.raw`(?:^|[;{])\s*(${COVERED.join("|")})\s*:\s*([^;}]+)`, "g");
const UNIT = /(?:^|[\s,(])-?\d*\.?\d+(?:px|em|rem|s|ms)\b/;
const BARE = new Set(["font-weight", "line-height", "z-index"]);

/** Blank out every var(...) — fallback included — so var(--space-4, 16px)
 *  does not read as a literal. Loops for nested fallbacks. */
function stripVars(value) {
  let out = value;
  let prev;
  do {
    prev = out;
    out = out.replace(/var\([^()]*\)/g, " ");
  } while (out !== prev);
  return out;
}

/** → array of "selector-ish line :: prop: value" strings; empty means clean. */
export function metricViolations(css) {
  const found = [];
  const lines = css.split("\n");
  lines.forEach((line, i) => {
    if (line.includes("metric-exempt")) return;
    if (i > 0 && lines[i - 1].includes("metric-exempt")) return;
    for (const m of line.matchAll(DECL)) {
      const prop = m[1];
      const raw = m[2].trim();
      const value = stripVars(raw);
      const literal =
        UNIT.test(value) ||
        (BARE.has(prop) && /(?:^|\s)\d*\.?\d+(?:\s|$)/.test(value.replace(/(?:^|\s)0(?:\s|$)/g, " ")));
      if (literal) found.push(`${i + 1}: ${prop}: ${raw}`);
    }
  });
  return found;
}
```

- [ ] **Step 8: Self-test the linter** — `frontend/src/styles/__tests__/metricLint.test.js`. A linter nobody trusts gets disabled, so prove it on fixtures: `font-size: 13px` flagged; `font-size: var(--fs-md)` clean; `padding: var(--space-4, 16px)` clean (the fallback must not trip it); `margin: 0 auto` clean; `border-radius: 50%` clean; `line-height: 1.55` flagged; `line-height: var(--lh-normal)` clean; `z-index: 4000` flagged; `width: 420px` clean (not covered); `border: 1px solid var(--border)` clean (not covered); `animation-duration: 7s` clean (not covered); `transition: opacity 0.5s ease` flagged; `transition: opacity var(--transition-slow)` clean; and a line preceded by `/* metric-exempt: orbit geometry */` clean.

- [ ] **Step 9: Full gates** — `npm run test -w frontend` green, `npm run build -w frontend` clean.

- [ ] **Step 10: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(frontend): welcome rules split into styles/welcome.css; ThemeToggleButton extracted from Toolbar; metric linter added"
```

---

### Task 4 (Lane P): Tokenise `platform.css` end to end, with the test that keeps it tokenised

**Files:**
- Modify: `frontend/src/styles/platform.css` (every covered declaration)
- Create: `frontend/src/styles/__tests__/platformTokens.test.js`

**Interfaces:**
- Produces: a `platform.css` with zero literal metrics on covered properties, and the standing assertion of that fact.
- Consumes: Task 1's `--space-9`/`--tracking-code`/`--z-*`, Task 3's `metricLint.js`.

Mechanical, table-driven, and the highest-leverage task in the plan. Line numbers below are **post-Task-3** (the welcome block is gone, so the file ends around line 237); resolve every one by selector.

**Off-ramp values snap up** (2→4, 6→8, 10→12, 14→16, 18→20, 26→24 where it is a bottom margin). Four off-scale font sizes resolve to the scale that was designed to replace them — `tokens.css:20-31` names 15px, 17px, 18px and 22px as exactly the one-offs the ramp retired.

| Selector | Now | Becomes |
|---|---|---|
| `.auth-page` | `padding: 24px` | `var(--space-6)` |
| `.auth-brand` | `font-weight: 700`; `letter-spacing: 0.02em` | `var(--fw-bold)`; `var(--label-tracking)` — **Decision 2** |
| `.auth-title` | `margin: 14px 0 18px`; `font-size: 20px` | `var(--space-4) 0 var(--space-5)`; `var(--fs-2xl)` |
| `.auth-form` | `gap: 12px` | `var(--space-3)` |
| `.auth-label` | `gap: 4px`; `font-size: 12px` | `var(--space-1)`; `var(--fs-sm)` |
| `.auth-input` | `border-radius: 4px`; `padding: 8px 10px`; `font-size: 14px` | **delete all three** — the `.input` primitive supplies them (Task 2). Keep only `background`/`border`/`color` if they still differ; they do not, so the rule collapses to nothing and the selector is dropped from `platform.css` entirely. |
| `.auth-input:focus` | `outline: 1px solid var(--border-focus)` | **Delete the whole rule** (D8). It overrides `tokens.css:294-312`'s zero-specificity ring at 0-1-1 — *accidentally*, not deliberately — giving every portal field a 1px ring instead of the 2px `--focus-ring-color` ring with offset, and firing on **mouse click** because it is `:focus`, not `:focus-visible`. It is the only `:focus` rule on the portal and there are no portal `:focus-visible` rules at all. Step 1's test asserts the file is `:focus`-free, so this deletion is what turns that assertion green. |
| `.auth-doors` | `gap: 8px` | `var(--space-2)` |
| `.auth-door` | `gap: 6px`; `border-radius: 4px`; `padding: 8px 10px`; `font-size: 13px` | `var(--space-2)`; `var(--radius-sm)`; `var(--space-2) var(--space-3)`; `var(--fs-md)` |
| `.auth-consent` | `gap: 8px`; `font-size: 12px` | `var(--space-2)`; `var(--fs-sm)` |
| `.auth-error` | `font-size: 13px`; `border-radius: 4px`; `padding: 8px 10px` | **delete** — `.alert--danger` supplies them |
| `.auth-footer` | `margin-top: 16px`; `font-size: 12px` | `var(--space-4)`; `var(--fs-sm)` |
| `.auth-text` | `font-size: 14px`; `line-height: 1.5` | `var(--fs-lg)`; `var(--lh-normal)` |
| `.auth-text--dim` | `font-size: 12px` | `var(--fs-sm)` |
| `.account-chip` | `margin-top: 14px`; `padding-top: 12px`; `gap: 6px` | `var(--space-4)`; `var(--space-3)`; `var(--space-2)` |
| `.account-chip-head` | `font-size: 10px` | `var(--label-fs)` — Task 7 makes the whole rule the micro-label |
| `.account-chip-name` | `font-size: 13px` | `var(--fs-md)` |
| `.account-chip-badge` | `margin-left: 6px`; `font-size: 10px`; `border-radius: 3px`; `padding: 0 4px` | **delete all four** — `.badge` supplies them |
| `.admin-header`, `.classes-header` | `padding: 18px 24px 0` | `var(--space-5) var(--space-6) 0` |
| `.admin-header h1`, `.classes-header h1` | `font-size: 18px`; `margin: 10px 0 12px` | `var(--fs-2xl)`; `var(--space-3) 0 var(--space-3)` |
| `.admin-tabs` | `gap: 4px` | **delete** — `.tabs` supplies it |
| `.admin-tab` | `padding: 8px 14px`; `font-size: 13px`; `border-bottom: 2px` | **delete the rule** — `.tab` supplies all of it, including the `:hover` the portal never had |
| `.admin-body`, `.classes-body` | `padding: 20px 24px`; `gap: 14px` | `var(--space-5) var(--space-6)`; `var(--space-4)` |
| `.admin-cap` | `gap: 10px`; `font-size: 14px` | `var(--space-3)`; `var(--fs-lg)` |
| `.admin-table` | `font-size: 13px` | `var(--fs-md)` |
| `.admin-table th` | `font-weight: 500`; `padding: 6px 8px` | Task 7 replaces the hand-rolled label; here just `padding: var(--space-2)` |
| `.admin-table td` | `padding: 6px 8px` | `var(--space-2)` |
| `.admin-actions` | `gap: 6px` | `var(--space-2)` |
| `.admin-mail-body` | `border-radius: 4px`; `padding: 10px`; `font-size: 12px` | `var(--radius-sm)`; `var(--space-3)`; `var(--fs-sm)` |
| `.admin-health` | `font-size: 14px`; `gap: 6px` | `var(--fs-lg)`; `var(--space-2)` |
| `.classes-actions` | `gap: 8px` | `var(--space-2)` |
| `.classes-wall` | `gap: 12px` | `var(--space-3)` |
| `.class-card-name` | `font-size: 15px` | `var(--fs-xl)` — it is a card title, which is that token's stated role (`tokens.css:28`) |
| `.class-card-label` | `font-size: 12px`; `margin-top: 2px` | `var(--fs-sm)`; `var(--space-1)` |
| `.class-card-meta` | `font-size: 11px`; `margin-top: 8px` | `var(--fs-xs)`; `var(--space-2)` |
| `.classes-archived summary` | `font-size: 13px`; `margin: 6px 0` | `var(--fs-md)`; `var(--space-2) 0` |
| `.class-archived-badge` | `margin-left: 8px`; `font-size: 10px`; `border-radius: 3px`; `padding: 0 4px` | **delete all four** — `.badge` supplies them |
| `.join-panel` | `gap: 16px` | `var(--space-4)` |
| `.join-code-big` | `font-size: 28px`; `letter-spacing: 0.08em`; `border-radius: 6px`; `padding: 10px 16px` | `var(--fs-3xl)`; `var(--tracking-code)` — **Decision 2**; `var(--radius)`; `var(--space-3) var(--space-4)` |
| `.join-qr` | `padding: 8px`; `border-radius: 6px` | `var(--space-2)`; `var(--radius)`. **The `background: #fff` is Task 7's**, leave it here. |
| `.sync-chip` | `font-size: 11px`; `margin-right: 14px` | `var(--fs-xs)`; `var(--space-4)` |
| `.guest-import` | `top: 12px`; `z-index: 4000`; `gap: 10px`; `border-radius: 6px`; `padding: 10px 14px`; `font-size: 13px` | `var(--space-3)`; `var(--z-toast)`; `var(--space-3)`; `var(--radius)`; `var(--space-3) var(--space-4)`; `var(--fs-md)` |
| `@media (max-width: 1024px)` block | `var(--space-4, 16px)` ×2 | drop the fallbacks — `var(--space-4)` |

- [ ] **Step 1: Write the failing test** — `frontend/src/styles/__tests__/platformTokens.test.js`:

```js
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { metricViolations } from "./metricLint";

const CSS = readFileSync(resolve(__dirname, "../platform.css"), "utf8");

describe("platform.css conforms to the design contract", () => {
  test("D1 — no literal metric on any covered property", () => {
    expect(metricViolations(CSS)).toEqual([]);
  });

  test("D8 — the portal defines no focus style of its own", () => {
    expect(CSS).not.toMatch(/:focus\b/);
  });

  test("D7/D10 — no hardcoded colour and no emoji", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Anything outside the BMP, plus the emoji-presentation ranges.
    expect(CSS).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  test("D9 — the portal never reads the OS colour preference", () => {
    expect(CSS).not.toContain("prefers-color-scheme");
  });

  test("the 1024px responsive block stays last", () => {
    const media = CSS.lastIndexOf("@media (max-width: 1024px)");
    expect(media).toBeGreaterThan(CSS.lastIndexOf(".guest-import"));
    expect(media).toBeGreaterThan(CSS.lastIndexOf(".classes-wall"));
  });
});
```

- [ ] **Step 2: Run it to fail** — `npm run test -w frontend -- platformTokens` → FAIL, and the failure lists every remaining literal with its line. That list is the work queue for Step 3.

- [ ] **Step 3: Apply the table.** Work top-down through `platform.css`, selector by selector, using the failure list to confirm nothing was missed. Where the table says **delete**, the declaration is gone because a Task-2 primitive supplies it — verify each deletion by checking the primitive's own declaration, not by assuming.

- [ ] **Step 4: Run to pass** — `npm run test -w frontend -- platformTokens` → PASS with an empty violation list. Full suite green. `npm run build -w frontend` clean.

- [ ] **Step 5: Visual diff pass.** `npm run dev`, both themes, every portal route: `/auth/signup`, `/auth/signin`, `/auth/forgot`, `/profile`, `/classes`, a class's People and Settings tabs, `/join`, `/admin` (all four tabs). Expect *small* deliberate shifts where a value snapped up a rung (6→8 gaps, 10→12 paddings, 18→20 title margin) and **three visible type changes**: class-card names 15→16px, screen titles 18→20px, and the auth field font unchanged at 14px. Nothing should reflow badly; if something does, that is a layout bug the literals were hiding — fix the layout, never re-introduce the literal.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/styles/platform.css frontend/src/styles/__tests__/platformTokens.test.js
git commit -m "refactor(frontend): tokenise platform.css end to end — 96 literals retired, the accidental focus override deleted, conformance test locks it in"
```

---

### Task 5 (Lane P): The touch floor — the coarse-pointer block finally names the portal

**Files:**
- Modify: `frontend/src/styles/responsive.css` (extend the coarse-pointer block at `:6-23`)

**Interfaces:**
- Produces: portal controls a finger can actually hit; the ring behaviour Task 4 unblocked, verified in a browser.
- Consumes: Task 2's primitives (so the selectors named below exist), Task 4 (which deleted the focus override and stabilised the file).

- [ ] **Step 1: Extend the coarse-pointer block.** In `frontend/src/styles/responsive.css`, inside the existing `@media (pointer: coarse)` block (`:6-23`), add the portal's interactive classes. Today the block names only `.tb-btn`, `.tb-btn--icon`, `.tb-dropdown-item`, `.pane-divider`, `.debug-drawer-handle`, `.mode-toggle button`, `.block-search-input`, `.start-project-delete`, `.project-title` — **not one portal class** — so on the shared Chromebook and tablet this platform explicitly targets, every classroom control stays small:

```css
  /* The portal was absent from this block entirely: on the shared classroom
     Chromebook this product targets, Approve / Deny / Remove / Archive were
     all sub-32px. Spec §18 D12: the coarse-pointer rule must name the
     portal's classes, not only the IDE's. */
  .btn           { min-height: 32px; }
  .btn--sm       { min-height: 32px; padding: var(--space-1) var(--space-2); }
  .input,
  .auth-input    { min-height: 32px; }
  .tab,
  .admin-tab     { min-height: 36px; }
  .auth-door     { min-height: 36px; }
  .class-card    { padding: var(--space-5); }
  .range         { height: 36px; }
```

Note `.btn--sm` keeps its dense *typography* and gains the height — a table-row action stays visually light while becoming hittable, which is exactly the carve-out D3 allows ("table-row actions may use the small variant only if D12's coarse-pointer rule also enlarges them for touch").

- [ ] **Step 2: Verify the suite.** `npm run test -w frontend` → green. `npm run build -w frontend` → clean.

- [ ] **Step 3: Prove the ring and the targets in a browser.** `npm run dev`. On `/auth/signin`: **click** a field with the mouse — no ring appears (it used to, because of the rule Task 4 deleted). **Tab** into it — the 2px offset accent ring appears. In the DevTools device toolbar, emulate a touch device and confirm the portal buttons report ≥32px in the box model. Then run `node frontend/scripts/e2e-test.mjs` and confirm the existing focus-ring assertions still pass — deleting an accidental override can only make them more true, but check rather than assume.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/responsive.css
git commit -m "fix(frontend): coarse-pointer block finally covers portal controls — no more 22px Approve on a classroom tablet"
```

---

### Task 6 (Lane P): Portal controls become `.btn` at the default height; the account chip becomes a real nav row

**Files:**
- Modify: `frontend/src/components/classes/ClassesHome.js` (`:50`, `:54`), `frontend/src/components/classes/PeopleTab.js` (`:80`, `:89`, `:128`, `:167`, `:182`, `:189`, `:232`, `:243`), `frontend/src/components/classes/SettingsTab.js` (`:56`, `:81`, `:85`), `frontend/src/components/classes/ClassChrome.js` (`:28`), `frontend/src/components/admin/AdminConsole.js` (`:82`, `:121`, `:125`, `:130`, `:134`), `frontend/src/sync/GuestImportPrompt.js` (`:10`, `:13`), `frontend/src/components/auth/AccountChip.js` (`:17`, `:20`, `:34`, `:37`, `:41`, `:46`), `frontend/src/components/auth/SignUpPage.js` (`:106`), `frontend/src/components/classes/JoinClassPage.js` (`:85`), `frontend/src/components/classes/ClassesHome.js` (`:80`), `frontend/src/components/auth/ProfilePage.js` (`:60`, `:85`)
- Modify: `frontend/src/styles/platform.css` (add `.nav-row`; `.classes-actions`/`.admin-actions` unchanged)
- Create: `frontend/src/components/classes/__tests__/portalControls.test.js`

**Interfaces:**
- Produces: portal markup that uses the canonical `.btn` API. **No alias name survives in these files.**
- Consumes: `primitives.css`'s `.btn`/`.btn--primary`/`.btn--lg`/`.btn--block`/`.btn--sm`.

`--control-h: 30px` is the product default (`tokens.css:68`); `--control-h-sm: 22px` exists for dense IDE chrome. But `.admin-btn` is pinned to `--control-h-sm` + `--btn-pad-sm` + `--fs-xs` at `primitives.css:115-121` and it is the portal's universal button — so Approve, Deny, Remove, Archive, Deactivate, Resend, Send reset, Reactivate, New class, Join a class, Copy join link, Regenerate code and both guest-import buttons all render 22px tall with 11px text on a screen a teacher is using at arm's length. **D3 is binding: any control a teacher or student presses on a full-screen portal route is `--control-h` or larger.**

The migration is a class-name change, not a CSS change — `.btn` alone is not in the `--sm` group, so switching the markup *is* the fix:

| Alias today | Canonical |
|---|---|
| `admin-btn` | `btn` |
| `admin-btn admin-btn--primary` | `btn btn--primary` |
| `auth-submit` | `btn btn--primary btn--lg btn--block` |
| `account-chip-btn` | `nav-row` (it is **not** a button — see Step 3) |
| `account-chip-btn account-chip-btn--primary` | `nav-row nav-row--primary` |

- [ ] **Step 1: Write the failing test** — `frontend/src/components/classes/__tests__/portalControls.test.js`. Read the portal source files and assert the alias names are gone. This is a lint-shaped test and it is the thing that stops the aliases creeping back in when the next screen is written:

```js
import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "../../..");   // frontend/src
const DIRS = ["components/auth", "components/classes", "components/admin", "sync", "welcome"];
const ALIASES = ["admin-btn", "auth-submit", "account-chip-btn", "welcome-btn"];

function portalSources() {
  const out = [];
  for (const d of DIRS) {
    for (const f of readdirSync(join(ROOT, d))) {
      if (f.endsWith(".js")) out.push([`${d}/${f}`, readFileSync(join(ROOT, d, f), "utf8")]);
    }
  }
  return out;
}

describe("the portal uses the primitive API, not the migration aliases", () => {
  test("no legacy button alias appears in portal markup", () => {
    const hits = [];
    for (const [name, src] of portalSources()) {
      for (const alias of ALIASES) {
        if (src.includes(`"${alias}`) || src.includes(` ${alias}`)) hits.push(`${name}: ${alias}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
```

*(`welcome/` is in `DIRS` and `welcome-btn` is in `ALIASES` deliberately — Lane W's Task 11 retires that one. Until Lane W merges, this test fails on the welcome page. **Scope the `DIRS` list to the four portal directories in this task and add `welcome` in Task 11**, so each lane's test goes green on its own work. Task 13 asserts the final combined state.)*

- [ ] **Step 2: Run it to fail**, then rewrite the class names across the files listed above. Mechanical, one file at a time. `PeopleTab.js:167`, `SettingsTab.js:56`, `ClassesHome.js:80`, `ProfilePage.js:60` and `:85`, `SignUpPage.js:106` and `JoinClassPage.js:85` are the `auth-submit` form buttons; the rest are `admin-btn`.

- [ ] **Step 3: Build the account chip's nav rows properly.** `.account-chip-btn` is not a button — it is a stacked list of links in the StartMenu sidebar, and `primitives.css:135` has to override `justify-content` to undo the base primitive it was aliased onto. Add to `frontend/src/styles/platform.css`, next to the `.account-chip` rules:

```css
/* The account chip's rows are navigation, not buttons: left-aligned, full
   width, no button chrome to undo. They were aliased onto .btn purely so
   Plan 1 didn't have to touch this markup, and primitives.css then had to
   override justify-content to make the alias behave. */
.nav-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: var(--control-h);
  padding: var(--space-2) var(--space-3);
  font-size: var(--btn-fs);
  color: var(--text);
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition),
              color var(--transition);
}
.nav-row:hover:not(:disabled) {
  background: var(--card-bg-hover);
  border-color: var(--border-hl);
  color: var(--text-bright);
}
.nav-row:disabled { opacity: 0.5; cursor: not-allowed; }
.nav-row--primary {
  background: var(--btn-primary-bg);
  border-color: var(--btn-primary-bg);
  color: var(--on-accent);
  font-weight: var(--fw-semibold);
}
.nav-row--primary:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
  border-color: var(--btn-primary-bg-hover);
  color: var(--on-accent);
}
```

Then switch `AccountChip.js`'s six `account-chip-btn` sites to `nav-row` / `nav-row nav-row--primary`. **Do not** delete `.account-chip-btn` from `primitives.css` here — that is Task 13, after Lane W has merged.

- [ ] **Step 4: Run to pass** — `npm run test -w frontend -- portalControls` PASS; full suite green; `npm run test -w frontend -- platformTokens` still green (the new `.nav-row` block is fully tokenised).

- [ ] **Step 5: Browser check.** Both themes. Every portal control is now 30px with 12px text; the primary buttons on the auth forms are 38px full-width; the StartMenu account chip still reads as a stack of left-aligned rows, with the Create-account row filled. Measure one Approve button in DevTools: `min-height: 30px`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components frontend/src/sync frontend/src/styles/platform.css
git commit -m "fix(frontend): portal controls are 30px .btn, not 22px IDE chrome; the account chip becomes a real nav row"
```

---

### Task 7 (Lane P): The system adopted — danger, semantic status, badges, micro-labels, empty states, section headings

**Files:**
- Modify: `frontend/src/components/classes/PeopleTab.js`, `SettingsTab.js`, `ClassChrome.js`, `ClassesHome.js`, `frontend/src/components/admin/AdminConsole.js`, `frontend/src/components/auth/AccountChip.js`, `frontend/src/components/auth/ProfilePage.js`, `frontend/src/sync/SyncChip.js`, `frontend/src/sync/GuestImportPrompt.js`
- Modify: `frontend/src/styles/platform.css` (`.admin-table th`, `.account-chip-head`, `.admin-health`, `.sync-chip*`, `.join-qr`, `.admin-mail-body`)
- Create: `frontend/src/components/admin/__tests__/adminStatus.test.js`, `frontend/src/sync/__tests__/syncChip.test.js`

**Interfaces:**
- Produces: portal screens that speak the design system's semantic vocabulary.
- Consumes: `.alert`, `.badge`, `.empty` from Task 2; `SearchIcon`/`CheckIcon`/`AlertTriangleIcon` from `Icons.js` (existing exports — **this task adds no export; `Icons.js` is Lane W's file**).

Seven changes, each independently visible:

- [ ] **Step 1: Destructive actions adopt `.btn--danger`.** `primitives.css:104-113` defines it as a `color-mix(in srgb, var(--red) 45%, transparent)` border with `--red` text on a transparent field — **never a filled red** — and it is used **zero times product-wide**. Add `btn--danger` to: `PeopleTab.js:89` (Deny), `:128` (Remove), `:189` (Revoke), `SettingsTab.js:85` (Archive this class), `AdminConsole.js:121` (Deactivate). **Not** Reactivate, **not** Resend, **not** Regenerate code — those are not destructive.

- [ ] **Step 2: Whole-page failures become alerts, form errors stay form errors.** `ClassChrome.js:27`, `InviteLandingPage.js:67` and `JoinClassPage.js:83` all render `.auth-error` — a form-field error box doing duty as a whole-screen failure state. Switch the three whole-page cases to `className="alert alert--danger"` with `role="alert"`. `SignUpPage.js:105`, `ClassesHome.js:79`, `PeopleTab.js:105` and `AdminConsole.js:97` stay as inline form errors but also switch to `alert alert--danger` — the primitive covers both; the difference is the ARIA role and where it sits.

- [ ] **Step 3: Semantic status colour, with a second channel.** D13: colour is never the only channel.
  - `AdminConsole.js:242-243` (**not** `:243-244` as the research says) prints `API: {h.ok ? "running" : "trouble"}` and the DB status in identical `--text` grey. Render each as a `.badge` — `badge--success` with a `CheckIcon` when healthy, `badge--danger` with an `AlertTriangleIcon` when not — so the word, the glyph and the colour all say the same thing. Wrap the `<ul className="admin-health">` in a `.card`; `platform.css`'s `.admin-health` is a bare list with no surface treatment.
  - `SettingsTab.js` shares one `msg` state between success (`:22`, `"Saved."`) and failure (`:24`, the server's message) and renders both through `auth-text auth-text--dim` at `:78`. Split it into `msg` and `error`: success renders `alert alert--success` with `role="status"`, failure renders `alert alert--danger` with `role="alert"`.
  - `SyncChip.js:47-49` carries its state only in colour plus a `title`. Give each state a leading glyph and keep the words it already has (the copy is verbatim-correct per spec §6.3 and must not change). Add the missing `.sync-chip--idle` rule in `platform.css` — `idle` is the initial state (`SyncChip.js:17`) and currently falls through to `--text-dim` by accident rather than by rule. Adopt the `.tb-chip` shape.
  - `ProfilePage.js:47-50` interpolates "site admin · teacher · email not yet confirmed" into one `<p>` with `·` separators. Render the role as a `.badge--accent` and the unconfirmed state as a `.badge--warning`, matching what `AccountChip.js:32` already does for the same fact.

- [ ] **Step 4: Table headers join the micro-label system.** `platform.css`'s `.admin-table th` hand-rolls one with `color: var(--text-muted)` and `font-weight: 500`. Table headers are precisely the case `--label-*` exists for (D6):

```css
.admin-table th {
  text-align: left;
  padding: var(--space-2);
  font-size: var(--label-fs);
  font-weight: var(--label-weight);
  text-transform: var(--label-transform);
  letter-spacing: var(--label-tracking);
  color: var(--label-color);
  border-bottom: 1px solid var(--border);
}
```

Do the same for `.account-chip-head` (`--label-fs` / `--label-weight` / `--label-transform` / `--label-tracking` / `--label-color`).

- [ ] **Step 5: Casing out of the DOM.** `AccountChip.js:16` and `:29` type the literal string **`ACCOUNT`** in the markup. `--label-transform: none` was set specifically to abolish the uppercase pastiche across 18 sites; baking caps into markup makes it the one micro-label the token cannot reach. **D7: casing is a CSS decision, never a string decision.** Both become `Account`.

- [ ] **Step 6: Empty states escape the grid.** `ClassesHome.js:96-102` puts a bare `<p className="auth-text auth-text--dim">` *inside* `.classes-wall`, which is `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` — so the sentence renders inside one 220px column. Switch it to `<p className="empty empty--full">`. Do the same for `ClassChrome.js:77-79`'s assignments placeholder (`className="empty"`; it is not in a grid). While there: the placeholder's copy is correct and must stay — the Assignments tab saying so itself is the thing the welcome page's honesty paragraph points at.

- [ ] **Step 7: Section headings stop borrowing the auth H1.** `PeopleTab.js:71, 104, 147, 173, 226` and `SettingsTab.js:60, 79` use `<h2 className="auth-title">`. `.auth-title` is the auth page's **H1** at `--fs-2xl` with a big margin. There is no H2 step between `--fs-xl` (16px) and `--fs-2xl` (20px), and `primitives.css:203-210`'s `.panel-header__title` is exactly that step (`--fs-md` + `--fw-semibold`) — but it is a panel-header child, not a page section heading. Add one rule to `platform.css` and use it at all seven sites:

```css
/* Section heading inside a portal body. Not .auth-title — that is the
   auth page's H1 and borrowing it flattened the heading hierarchy on
   every class screen. */
.section-title {
  margin: var(--space-5) 0 var(--space-2);
  font-size: var(--fs-xl);
  font-weight: var(--fw-semibold);
  color: var(--text-bright);
}
```

**The research's count of four `auth-title` H2s in `PeopleTab.js` is wrong — there are five** (it missed `:226`, the "Joining" heading inside `JoinPanel`). All five move.

- [ ] **Step 8: Two small honesty fixes while the files are open.**
  - `.admin-mail-body` is a `<pre>` (`AdminConsole.js:178`) with no `font-family`, so the pretend inbox renders in the browser's default monospace instead of JetBrains Mono. Add `font-family: var(--mono);`. Spec §9 now requires it — the body is program output.
  - `.join-qr` paints the last hardcoded hex in the portal, `background: #fff`, and `PeopleTab.js:220` renders `QRCode.toCanvas` at default black-on-white, so dark mode shows a white slab with no border. **Keep the white backing** — a QR projected on a whiteboard *should* be high-contrast white, and that is defensible — but express it as `background: var(--on-accent)` (the product's one theme-independent white, `tokens.css:92`) and add `border: 1px solid var(--card-border)` so it reads as a card in dark mode instead of a hole.

- [ ] **Step 9: Test.** `adminStatus.test.js` mounts `AdminConsole`'s `HealthTab` with a stubbed query and asserts: healthy renders a `.badge--success` containing the word `running`, unhealthy renders `.badge--danger` containing `trouble`, and neither relies on colour alone (both carry an `svg` and a word). `syncChip.test.js` asserts each of the five states renders its documented verbatim string and a distinct class, including `sync-chip--idle`. Follow `components/auth/__tests__/HeaderAccount.test.js` for how to satisfy `useMe()` / router context.

- [ ] **Step 10: Gates + browser.** Full suite green; `platformTokens` still green; `npm run build -w frontend` clean. In the browser, both themes: the Health tab, a class's People tab (Deny/Remove now outlined red), Settings (Archive outlined red; save success green, save failure red), an empty class wall, the profile badges, and the QR in dark mode.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components frontend/src/sync frontend/src/styles/platform.css
git commit -m "feat(frontend): portal adopts the system — .btn--danger, semantic status with a second channel, badges, micro-label table headers, real empty states"
```

---

### Task 8 (Lane P): The interaction idioms — tabs with ARIA, keyboard-reachable rows, status announcements

**Files:**
- Modify: `frontend/src/components/admin/AdminConsole.js` (`:24-35`, `:37-40`, `:170`, `:91-96`), `frontend/src/components/classes/ClassChrome.js` (`:55-65`), `frontend/src/components/classes/PeopleTab.js` (`:240`), `frontend/src/components/classes/JoinClassPage.js` (`:59-64`), `frontend/src/components/classes/InviteLandingPage.js` (`:63-68`), `frontend/src/components/auth/ProfilePage.js` (`:89`), `frontend/src/sync/GuestImportPrompt.js` (`:5-17`), `frontend/src/sync/SyncChip.js` (`:46-50`)
- Create: `frontend/src/components/admin/__tests__/adminTabs.test.js`, `frontend/src/components/classes/__tests__/classTabs.test.js`

**Interfaces:**
- Produces: a portal a keyboard user can operate and a screen reader can follow.
- Consumes: `.tabs`/`.tab` from Task 2; `tokens.css:306` already provisions a focus ring for `[role="tab"]` that nothing currently uses.

- [ ] **Step 1: Write the failing tests first.** `adminTabs.test.js`: mount `AdminConsole` with an admin `me`, assert `[role="tablist"]` exists, that exactly one `[role="tab"]` has `aria-selected="true"`, that `keyDown` with `ArrowRight` moves selection and `Home`/`End` jump to the ends, and that the panel below carries `role="tabpanel"` with `aria-labelledby` pointing at the selected tab's id. `classTabs.test.js`: mount `ClassChrome` and assert the **link** tabs carry `aria-current="page"` on the active one and nothing else — link tabs take `aria-current`, not the tablist pattern, because they navigate rather than switch panels.

- [ ] **Step 2: Button tabs get the full pattern.** `AdminConsole.js:24-35` renders four `<button>`s with no roles and selection carried by colour plus a 2px underline. Wrap the `<nav>` as `role="tablist"`, give each button `role="tab"`, `aria-selected`, `id={`admin-tab-${t}`}`, `aria-controls={`admin-panel-${t}`}` and `tabIndex={t === tab ? 0 : -1}`, and add roving-arrow-key handling. Wrap the panel region (`:37-40`) in a single `<div role="tabpanel" id aria-labelledby>` rather than four bare conditionals. **While the markup is open, move the class names onto the canonical primitive**: `admin-tabs` → `tabs`, `admin-tab` → `tab`, `admin-tab admin-tab--on` → `tab tab--on`. Task 13 deletes the aliases and its test forbids the old names, so this is where they leave the codebase.

- [ ] **Step 3: Link tabs get `aria-current`.** `ClassChrome.js:55-65` — the `<nav className="admin-tabs">` becomes `className="tabs"`, each `<Link>` becomes `className="tab"`, and the active one gains `aria-current="page"`. The `.tab[aria-current="page"]` selector from Task 2 already styles it, so the `admin-tab--on` conditional class **disappears entirely** — selection stops being a class the component computes and becomes a fact the markup states. Link tabs take `aria-current`, **not** the tablist pattern: they navigate, they do not switch panels.

- [ ] **Step 4: Nothing is click-only.** `AdminConsole.js:170` is `<tr className="admin-mail-row" onClick={…}>` with no `tabIndex`, no `role`, no `onKeyDown`, and `cursor: pointer` in CSS. It looks interactive, is unreachable by keyboard, and because it is not focusable the global ring can never apply to it. Add `tabIndex={0}`, `role="button"`, `aria-expanded={openId === m.id}`, and an `onKeyDown` that opens on Enter and Space (and calls `preventDefault()` on Space so the page does not scroll).

- [ ] **Step 5: Every state readout announces.** Add `role="status"` + `aria-live="polite"` to: the guest-import toast (`GuestImportPrompt.js:6`), the sync chip (`SyncChip.js:47`), the "Copied!" confirmation (`PeopleTab.js:240` — give it a `CheckIcon` too, per the research's 2.15), "Name updated." (`ProfilePage.js:89`), the join success/pending state (`JoinClassPage.js:59-64`), and the invite landing tri-state (`InviteLandingPage.js:63-68`, whose "One moment…" also needs `aria-busy="true"`). `SettingsTab.js`'s save messages got theirs in Task 7. **Two are not just attributes:** `JoinClassPage.js:23` navigates away after a silent 900ms `setTimeout`, and `InviteLandingPage.js:37` does the same — the announcement must render *before* the redirect fires or nobody hears it, which the `role="status"` on the already-rendered paragraph achieves as written. Do not lengthen the timeout.

- [ ] **Step 6: The admin search gets its icon and its clear button.** `AdminConsole.js:91-96` is a bare input. The IDE's equivalent, `.help-search-box` (`pages.css:349-392`), already has an icon, a clear button and `:focus-within` — mirror that shape using `SearchIcon` (`Icons.js:128`) and `XIcon` (`Icons.js:144`), both existing exports. The clear button needs an `aria-label` ("Clear search"), because it has no visible text.

- [ ] **Step 7: Run the tests to pass**, full suite green, `platformTokens` green.

- [ ] **Step 8: Keyboard pass in the browser.** `/admin`: Tab to the tab bar, arrow between tabs, confirm the ring lands on the tab and the panel changes; Tab into the Emails table, confirm a mail row takes focus and opens on Enter and on Space. `/classes/:id`: Tab across the link tabs, confirm the current one is announced. Turn on a screen reader (Windows Narrator is enough) and confirm the sync chip and the "Copied!" toast announce.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components frontend/src/sync
git commit -m "feat(frontend): portal accessibility idioms — ARIA tabs, keyboard-openable mail rows, seven live-region announcements, searchable admin list"
```

---

### Task 9 (Lane P): One page shell, one portal header — the theme toggle reachable off the IDE

**Files:**
- Create: `frontend/src/components/layout/PortalHeader.js`, `frontend/src/components/layout/__tests__/PortalHeader.test.js`
- Modify: `frontend/src/styles/platform.css` (`.page`/`.page-header`/`.page-body` replace the duplicated `.admin-*`/`.classes-*` shells)
- Modify: `frontend/src/components/admin/AdminConsole.js`, `frontend/src/components/classes/ClassesHome.js`, `frontend/src/components/classes/ClassChrome.js`, `frontend/src/components/classes/PeopleTab.js`, `frontend/src/components/classes/SettingsTab.js`, `frontend/src/components/auth/AuthLayout.js`

**Interfaces:**
- Produces: `<PortalHeader identity nav actions>` and the `.page` shell. The next plan's assignment screens use both.
- Consumes: `ThemeToggleButton` (Task 3, read-only), `HeaderAccount` (`components/auth/HeaderAccount.js`), `.tabs`/`.tab` (Task 2).

`.admin-page`/`.admin-header`/`.admin-body` and `.classes-page`/`.classes-header`/`.classes-body` are byte-for-byte duplicates differing only in nothing at all after Task 4 tokenised both to the same values. Neither is flex-laid-out — the brand `<Link>`, the `<h1>` and the `<nav>` simply stack as blocks — and the "admin" namespace has become the portal's generic namespace, reaching as far as `sync/GuestImportPrompt.js`. Worse, **the theme toggle is IDE-only**: `useTheme()` is consumed in exactly two places (`components/GlowCanvas.js:15`, `components/layout/IDELayout.js:75`), so a visitor on `/welcome`, `/auth/*`, `/classes`, `/profile` or `/admin` has no way to switch. D9 says the toggle must be reachable from every screen.

- [ ] **Step 1: Write the failing test** — `PortalHeader.test.js`: renders the brand link, renders a nav slot when given one and omits it when not, renders `ThemeToggleButton` and `HeaderAccount` in the right cluster, and calls `useTheme().toggle` when the toggle is clicked. Mock `HeaderAccount` the way the existing header suites do: `vi.mock("../../auth/HeaderAccount", () => ({ default: () => null }));` (path relative to the suite).

- [ ] **Step 2: Build the header** — `frontend/src/components/layout/PortalHeader.js`, on the IDE's own zone idiom (`chrome.css:6-24`): `height: var(--header-h)` (44px), `background: var(--bg-titlebar)`, a bottom border, an identity slot, a nav slot and a right cluster. The right cluster uses `.tb-btn` so it inherits the coarse-pointer bump for free — `HeaderAccount.js:22-31` already reaches into `tb-btn` / `tb-dropdown-item` / `UserIcon` and is currently the *only* portal surface covered by that block. Generalise it; do not fork it.

```js
import React from "react";
import { Link } from "react-router-dom";
import ThemeToggleButton from "./ThemeToggleButton";
import HeaderAccount from "../auth/HeaderAccount";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * The one portal header. Same zone idiom as the IDE's app-header so a portal
 * screen and an IDE screen read as one product: identity, then whatever the
 * screen navigates by, then a right cluster carrying the theme toggle and the
 * account control (spec §18 D9 — before this, light mode was unreachable
 * outside the IDE).
 *
 * `title` renders as the screen's H1 below the bar when given; `nav` is the
 * screen's own tab row. Both optional: /classes has a title and no nav, a
 * class page has both.
 */
export default function PortalHeader({ title, nav, home = "/" }) {
  const { isDark, toggle } = useTheme();
  return (
    <header className="page-header">
      <div className="page-header__bar">
        <Link to={home} className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <div className="page-header__spacer" />
        <ThemeToggleButton isDark={isDark} onToggle={toggle} />
        <HeaderAccount />
      </div>
      {title ? <h1 className="page-header__title">{title}</h1> : null}
      {nav}
    </header>
  );
}
```

- [ ] **Step 3: Collapse the two shells into one** in `frontend/src/styles/platform.css`. Replace the `.admin-page`/`.admin-header`/`.admin-header h1`/`.admin-body` and `.classes-page`/`.classes-header`/`.classes-header h1`/`.classes-body` blocks with a single `.page`/`.page-header`/`.page-header__bar`/`.page-header__title`/`.page-body` set, all tokenised. Keep `.admin-page`/`.classes-page` (etc.) as comma aliases **only if** some markup still needs them at the end of the task — the aim is that none does, and Step 4 removes the last of them. Update the `@media (max-width: 1024px)` block at the end of the file to name `.page-header__bar` and `.page-body` instead of the four old names. **That block must stay at the end of the file** — the comment above it explains why, and it is correct.

```css
.page { min-height: 100vh; background: var(--bg-base); color: var(--text); }
.page-header {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 0 var(--space-6);
}
.page-header__bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--header-h);
  min-height: var(--header-h);
}
.page-header__spacer { flex: 1; min-width: 0; }
.page-header__title {
  margin: var(--space-3) 0;
  font-size: var(--fs-2xl);
  color: var(--text-bright);
}
.page-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 1000px;
  padding: var(--space-5) var(--space-6);
}
```

- [ ] **Step 4: Move the five screens onto it.** `AdminConsole.js` (`:18-36`), `ClassesHome.js` (`:12-18`, `:47`), `ClassChrome.js` (`:45-66`, `:23-34`, `:76`), `PeopleTab.js` (`:67`), `SettingsTab.js` (`:32`): `admin-page`/`classes-page` → `page`; the hand-rolled `<header>` → `<PortalHeader title=… nav=…>`; `admin-body`/`classes-body` → `page-body`. `AuthLayout.js` keeps its centred-card shape (it is a different screen type) but gains the theme toggle in a top-right corner — an evaluating teacher should be able to see both themes before creating an account.

- [ ] **Step 5: Run the tests to pass.** Full suite green — `adminTabs.test.js` and `classTabs.test.js` from Task 8 must still pass through the new header, which is the point of writing them first.

- [ ] **Step 6: Browser check.** Every portal route in both themes; toggle the theme from `/classes`, from `/admin`, from `/auth/signin`, and confirm it persists across a reload (`THEME_STORAGE_KEY`, `ThemeContext.js:26`) and that the IDE agrees. At exactly 1024px wide, confirm nothing load-bearing is hidden — the header bar shortens, it does not drop controls.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components frontend/src/styles/platform.css
git commit -m "feat(frontend): one portal page shell and one portal header — theme toggle and account control reachable from every screen"
```

---

### Task 10 (Lane W): One icon module — `WelcomeIcons.js` folded into `Icons.js`, the duplicate `BlocksIcon` resolved

**Files:**
- Modify: `frontend/src/components/Icons.js`
- Delete: `frontend/src/welcome/WelcomeIcons.js`
- Modify: `frontend/src/welcome/WelcomePage.js` (imports only — the rewrite is Task 11)
- Modify: `frontend/src/styles/welcome.css` (`.welcome-card__icon svg` sizing rule)
- Create: `frontend/src/components/__tests__/iconsIdiom.test.js`

**Interfaces:**
- Produces: `Icons.js` gains `OrbitIcon`, `ChartIcon`, `LocalFirstIcon`, `PrivacyIcon` and the ~8 section icons Task 11 needs. **Lane P imports from this file but never edits it.**
- Consumes: nothing.

`frontend/src/welcome/WelcomeIcons.js` is a parallel module re-implementing `Icons.js`'s conventions at `strokeWidth="1.6"` with a hardcoded 28px size and no `size` prop, and it **redefines `BlocksIcon`** (`WelcomeIcons.js:32-39`, two overlapping rounded squares) against `Icons.js:27-29` (a 2×2 grid of four squares). The product ships two different "blocks" icons. D10 allows one icon module.

- [ ] **Step 1: Write the failing test** — `frontend/src/components/__tests__/iconsIdiom.test.js`. Read `Icons.js` as text and assert the module-level invariants, plus a mounted spot-check:

```js
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { mountComponent } from "../../test/renderHelpers";
import * as Icons from "../Icons";

const SRC = readFileSync(resolve(__dirname, "../Icons.js"), "utf8");

describe("one icon module, one idiom (spec §18 D10)", () => {
  test("the welcome fork is gone", () => {
    expect(existsSync(resolve(__dirname, "../../welcome/WelcomeIcons.js"))).toBe(false);
  });

  test("the welcome icons live here now", () => {
    for (const n of ["OrbitIcon", "ChartIcon", "LocalFirstIcon", "PrivacyIcon",
                     "BlocksIcon", "GraduationCapIcon"]) {
      expect(typeof Icons[n]).toBe("function");
    }
  });

  test("every export takes a size prop and defaults to 16", () => {
    const { container, unmount } = mountComponent(
      <div>{Object.values(Icons).map((I, i) => <I key={i} />)}</div>,
    );
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg.getAttribute("width")).toBe("16");
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    }
    unmount();
  });

  test("no emoji anywhere in the module", () => {
    expect(SRC).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });
});
```

- [ ] **Step 2: Run it to fail**, then move the five icons `Icons.js` does not already have into it, rewritten in the house idiom — `({ size } = {}) =>`, `{...sz(size)}`, `strokeWidth` inherited from `base` (2) unless a per-icon exception is justified the way `AtomIcon` (`Icons.js:47-54`) and `SpringIcon` (`:68-70`) justify theirs at 1.5:

  - `OrbitIcon` — from `WelcomeIcons.js:42-49`. Keep the geometry; it is distinct from `AtomIcon`'s three-ellipse figure.
  - `ChartIcon` — from `WelcomeIcons.js:52-60`.
  - `LocalFirstIcon` — from `WelcomeIcons.js:63-71`.
  - `PrivacyIcon` — from `WelcomeIcons.js:84-91`.
  - `ClassroomIcon` — **do not add it.** `Icons.js:242-244` already exports `GraduationCapIcon` with the same mortarboard geometry. `WelcomePage` imports that instead. (The research's file list says to move all six; five is correct.)

- [ ] **Step 3: Resolve the duplicate `BlocksIcon`.** Keep `Icons.js:27-29`'s four-square grid — it is the one the IDE header, the help page sidebar (`HelpPage.js:222`) and the start wizard already show, so changing it would change the IDE to match the front page rather than the other way round. Delete the welcome variant outright. Record the resolution in a comment above the export.

- [ ] **Step 4: Add the section icons Task 11 needs.** Audit first — most already exist and adding a duplicate is exactly the failure this task is fixing. Verified present and reusable: `CodeIcon` (`:31`), `BugIcon` (`:274`), `TableIcon` (`:246`), `SearchIcon` (`:128`), `DownloadIcon` (`:15`), `SaveIcon` (`:226`), `LayersIcon` (`:108`), `PackageIcon` (`:19`), `CameraIcon` (`:322`), `GlobeIcon` (`:60`), `CheckIcon` (`:148`), `UsersIcon` (`:116`), `BookOpenIcon` (`:88`), `RecordIcon` (`:278`), `AlertTriangleIcon` (`:298`). **Add only what is genuinely missing** — a `ScatterIcon` for the regression section and a `WifiOffIcon` for the offline section are the two likely gaps; confirm against the section list in Task 11 before adding either, and add nothing speculatively.

- [ ] **Step 5: Delete `WelcomeIcons.js`** and update `WelcomePage.js`'s import block (`:4-11`) to pull from `"../components/Icons"`. In `welcome.css`, delete `.welcome-card__icon svg { width: 28px; height: 28px; }` — the size is a `size={28}` prop now, which is the whole reason the prop exists.

- [ ] **Step 6: Run to pass.** `npm run test -w frontend -- iconsIdiom` PASS; full suite green; `npm run build -w frontend` clean.

- [ ] **Step 7: Browser check.** `/welcome` in both themes: the six card icons render at 28px, stroke weight now matches the IDE's (visibly slightly heavier — that is the correction), and the blocks card shows the same glyph as the IDE header's Blocks toggle.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Icons.js frontend/src/welcome frontend/src/styles/welcome.css frontend/src/components/__tests__/iconsIdiom.test.js
git rm frontend/src/welcome/WelcomeIcons.js
git commit -m "refactor(frontend): fold WelcomeIcons into the one icon module; duplicate BlocksIcon resolved to the IDE's geometry"
```

---

### Task 11 (Lane W): The informative welcome page

**Files:**
- Modify: `frontend/src/welcome/WelcomePage.js` (rewritten, longer, same `go()` contract)
- Modify: `frontend/src/styles/welcome.css` (base rules rewritten onto tokens)
- Create: `frontend/src/welcome/__tests__/welcomePage.test.js`, `frontend/src/styles/__tests__/welcomeTokens.test.js`
- **Unchanged and must stay unchanged:** `frontend/src/welcome/WelcomeGate.js`, `frontend/src/constants/index.js`

**Interfaces:**
- Produces: the front page. `WelcomeGate`'s contract is untouched.
- Consumes: `.btn`/`.card`/`.badge`/`.empty`/`.alert` (Tasks 2), `ThemeToggleButton` (Task 3, read-only), `Icons.js` (Task 10).

**The two hard constraints, first, because they are the easiest things to break:**

1. **The gate is correct and must not be touched.** `WelcomeGate.js` implements the v2 contract: `shouldShowWelcome({ signedInHint, sessionPassed })` returns `!signedInHint && !sessionPassed`; `signedInHint` reads `SIGNED_IN_HINT_KEY` from **localStorage**; `sessionPassed` reads `WELCOME_PASSED_SESSION_KEY` from **sessionStorage**; the whole decision is synchronous; blocked storage is caught and treated as a fresh guest; `/welcome` stays ungated and permanently reachable; signed-in visitors are never hijacked. Its four-case truth table is already tested at `welcome/__tests__/welcomeGate.test.js`. **Do not resurrect the v1 gate still shown in classroom Plan 4 Task 10's code blocks** (`localStorage WELCOME_SEEN_KEY`, a `projectCount` grandfather, an async `listProjects()` read) — that document contradicts itself and the shipped code is the truth.
2. **Every CTA routes through `go()`.** `WelcomePage`'s `go(path)` helper (`:26-34`) writes `WELCOME_PASSED_SESSION_KEY` before navigating. A single `<Link to="/">` added anywhere on a nine-screen page bounces the visitor straight back to `/welcome` and looks like an infinite loop. **Audit rule: zero `<Link>` or `navigate()` calls to `/`, `/auth/signup` or `/auth/signin` on this page that do not go through `go()`.** Step 1's test enforces it.

- [ ] **Step 1: Write the failing tests.** `frontend/src/welcome/__tests__/welcomePage.test.js`:

```js
import { describe, test, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { mountComponent, click, byText } from "../../test/renderHelpers";
import WelcomePage from "../WelcomePage";
import { WELCOME_PASSED_SESSION_KEY } from "../../constants";

const SRC = readFileSync(resolve(__dirname, "../WelcomePage.js"), "utf8");
const mount = () => mountComponent(<MemoryRouter><WelcomePage /></MemoryRouter>);

describe("the front page", () => {
  beforeEach(() => sessionStorage.clear());

  test("every internal CTA goes through go() — the single easiest way to break this page", () => {
    // No bare navigation to the three gated destinations.
    expect(SRC).not.toMatch(/<Link\s+to=["']\/(auth\/sign(in|up))?["']/);
    expect(SRC).not.toMatch(/navigate\(\s*["']\/(auth\/sign(in|up))?["']\s*\)/);
  });

  test("the three doors keep their exact promise, order and destinations", () => {
    const { container, unmount } = mount();
    const labels = [...container.querySelectorAll(".welcome-hero button")].map(
      (b) => b.textContent.replace(/\s+/g, " ").trim(),
    );
    expect(labels).toEqual([
      "Use the IDE — no account needed",
      "Create an account",
      "Sign in",
    ]);
    unmount();
  });

  test("a CTA stamps the session pass before navigating", () => {
    const { container, unmount } = mount();
    click(byText(container, "Use the IDE — no account needed"));
    expect(sessionStorage.getItem(WELCOME_PASSED_SESSION_KEY)).toBe("1");
    unmount();
  });

  test("heading order is repaired: one h1, sections are h2, cards are h3", () => {
    const { container, unmount } = mount();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("h2").length).toBeGreaterThan(5);
    // No h3 without an h2 above it, and no card title promoted to h2.
    const order = [...container.querySelectorAll("h1,h2,h3")].map((h) => h.tagName);
    expect(order[0]).toBe("H1");
    expect(order.includes("H3")).toBe(true);
    unmount();
  });

  test("landmarks and labelled sections", () => {
    const { container, unmount } = mount();
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    for (const s of container.querySelectorAll("section")) {
      expect(s.getAttribute("aria-labelledby")).toBeTruthy();
    }
    unmount();
  });

  test("the non-claims list is honoured — no promise the product cannot keep", () => {
    const banned = [
      /version history/i, /restore a previous/i, /roll ?back/i,
      /assignment[s]? (are|is) (available|here)/i, /marking is/i, /gradebook/i,
      /exam mode/i, /lockdown/i, /collision/i, /cloud/i,
      /we('| ha)?ve sent/i, /check your inbox/i,
      /every run captures/i, /unlimited/i, /schools? (use|trust)/i,
      /press run to see your analysis/i,
    ];
    for (const re of banned) expect(SRC).not.toMatch(re);
  });

  test("no emoji", () => {
    expect(SRC).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });
});
```

And `frontend/src/styles/__tests__/welcomeTokens.test.js`, the twin of Task 4's, importing the same `metricViolations` helper and additionally asserting no `prefers-color-scheme`, no `:focus` rule, no hardcoded hex, and that the reduced-motion block and the responsive block both sit at the end of the file.

- [ ] **Step 2: Run them to fail.**

- [ ] **Step 3: Write the page.** Structure: hero → doors → "what it is" band → seven substantive sections → numbers strip → playground → classrooms → footer. Roughly nine screens of scroll on a laptop. Every section carries an eyebrow micro-label, one `<h2>`, two to four sentences, and **where possible one concrete artefact** — a code sample, a keycap row, a chip list — rather than more prose. Shape:

```js
<main className="welcome">
  <a className="welcome-skip" href="#welcome-main">Skip to content</a>
  <div className="welcome-toolbar"><ThemeToggleButton isDark={isDark} onToggle={toggle} /></div>
  <header className="welcome-hero"> …orbit, h1, tagline, sub-line, three doors, reassurance… </header>
  <div id="welcome-main" />
  <section className="welcome-band" aria-labelledby="s-what"> …three inline statements… </section>
  <section className="welcome-section" aria-labelledby="s-editor"> … </section>
  … six more …
  <section className="welcome-numbers" aria-labelledby="s-numbers"> …six stat tiles… </section>
  <section className="welcome-play" aria-labelledby="s-play"> <GravityPlayground /> </section>
  <section className="welcome-section" aria-labelledby="s-class"> …classrooms + the honest paragraph… </section>
  <footer className="welcome-foot"> …scope line, no-billing line, repeat CTA, quiet auth links… </footer>
</main>
```

**Copy, to be used close to verbatim.** Every claim traces to the verified inventory; the "do not write" notes are traps found in the current copy.

| § | Eyebrow | Headline | Substance |
|---|---|---|---|
| 1 Hero | — | `Physics IDE` (h1) | Tagline replaces "Build, run, and understand physics — right in your browser." with: *"Build a physics simulation with blocks or with Python, watch it run in 3D, then analyse the data it produced — all in the browser, with no account and nothing to install."* Sub-line, `--text-dim`: *"Free, offline-capable, and open to guests. Built for physics classrooms."* Three doors unchanged in text, order and destination. Under them: *"Guests get the complete IDE. Nothing is held back."* **Do not write:** "the world's first", "AI-powered", any user or school count. |
| 2 What it is | — | — | Three inline statements, no cards: **Runs in your browser.** GlowScript 3.2 VPython, the Monaco code editor and the block editor all ship with the app; no server does your physics. **Two editors, one project.** Drag blocks or write Python — the toolbar toggle switches views, and the blocks generate readable Python you can flip to and inspect. **Three kinds of project.** Physics modelling, data science, or hybrid. |
| 3 Blocks and code | `The editor` | `Start with blocks. Move to Python when you're ready.` | 151 block types: **120 purpose-built for physics and data across 19 drawers**, plus 31 standard Blockly blocks in the Advanced drawer. The toolbox filters itself to the project's goal — a physics project never shows data blocks; a data project never shows Objects or Motion. Search the whole library by name or keyword from the box above the canvas. Right-click any block → **Help** jumps to its entry in the built-in documentation. **Artefact:** a side-by-side — a described block stack left, the generated Python right, `--mono` on `--bg-input` with `--accent-blue`/`--accent-green` accents, hand-spanned (no highlighting library). This is the page's highest-value visual: it proves "readable Python" instead of asserting it. **Do not write:** that Python edits round-trip back into blocks. |
| 4 The viewport | `Watch it run` | `Physics you can see happening.` | Live 3D via GlowScript 3.2 VPython, shipped with the app, so it works offline. Spheres, boxes, cylinders, arrows, helixes and springs, glowing spheres, trails, text labels, point lights, scene and camera. Motion: set velocity, update position, apply force, gravity, rotation — plus vector maths. Camera controls float over the scene while it runs: reset camera, fit to view, fullscreen, snapshot to a new tab. Drag the divider to resize, or hide the viewport and work full-width. **Artefact:** a `<kbd>` row in the IDE's own `.tb-kbd` treatment — `Ctrl` `Enter` run · `Esc` stop · `Ctrl` `S` save. **Exactly these.** **Do not write:** "collisions" (no collision block exists), "Ctrl+C to copy" (deliberately unbound). |
| 5 The debugger | `Look inside` | `A debugger that doesn't lie to you.` | The strongest differentiator; give it a full section. Pause and resume with `Space`, step one animation frame with `F10`, step to the next reported value with `Shift+F10` — all while the simulation stays on screen. Breakpoints by right-click or Alt-click; blocks that *can* pause show a dashed outline, blocks with a breakpoint a solid red one, and the toolbar shows how many are set. **If a program has no traced values to pause on, it says so plainly instead of hanging** — call this out; it is the "doesn't lie" claim and it is real. A live variable panel groups setup constants, live loop values and your own watch expressions, each row with a sparkline. Pin, filter, threshold-alert, snapshot to compare, click a name to light up the block that sets it. Type any Python expression into the watch box — total energy, say — and see it every frame on the next run. |
| 6 Run → dataset | `Measure it` | `Turn a simulation into data you can analyse.` | **Record a run** to capture every value, then export CSV — or press **Chart** to turn that recording into a dataset. When saving a run as a dataset, choose which variables to keep and crop to a time range. Hybrid projects stack the viewport and the data panel in one pane. **Do not write:** "every run captures data" — recording is opt-in. |
| 7 Data science | `Analyse` | `A full data pipeline, in the same blocks.` | 58 of the 120 blocks, and today the page gives it one card. **Load:** six built-in datasets with column descriptions — Planets (9 rows), Palmer Penguins (30), Weather / Cape Town vs Johannesburg (28), Pendulum lab measurements (56), Spring / Hooke's law (8), Free fall (12) — or your own CSV, or a dataset promoted from a run. **Explore / Describe / Uncertainty / Relationships / Linearise / Shape / Chart / Communicate**, one short line each, as the brief spells them out. Least-squares fit reports slope, intercept, R² and n as an equation with a plain-English verdict — Excellent, Strong, Moderate or Weak. Charts: bar, line, scatter, histogram, box plot, scatter-with-regression; charts save as image files. **The pipeline re-runs as you change blocks.** **Do not write:** "press Run to see your analysis" — data-science projects have no Run button by design, and teaching a student a control that isn't there is the worst kind of error this page can make. Do not name a chart file format. |
| 8 Starting points | `Don't start from nothing` | `18 worked projects, ready to open.` | Four pre-coded Python examples (Projectile with drag and telemetry; Spring-Mass with live energy; a Sun–Earth–Moon three-body orbit on velocity-Verlet; a Nonlinear Damped Pendulum). The same four as block templates. Seven data-science investigations. Three hybrid topics pairing a simulation with its analysis. An empty canvas offers one-click starter chips and a rotating beginner tip. A short wizard asks for a title, blank or template, and which editor to open in. Built-in documentation with 14 searchable sections. **Artefact:** the three hybrid topics as chips — *measure damping from the pendulum*, *measure g from the projectile*, *find k from the spring*. They are the most striking single fact about the product. |
| 9 Yours, offline | `Your work` | `Saved on your computer first. Always.` | Named, renameable projects that save themselves as you work and appear on a Continue list with how long ago you touched them. Export as `.py`, `.xml`, a PDF of the code, a PDF of the blocks, a PNG of the viewport, or a complete `.physide.json` bundle; or copy the code. Open back in `.py`, `.xml`, `.physide.json`. Signed in, work also syncs — after every save, after every delete, and again when you sign in, return to the tab, or come back online. The sync chip tells you the truth at a glance. Sign up after working as a guest and you'll be offered a one-click import of your browser projects — or decline. On a shared computer, signing out clears the projects pulled from your account; guest work stays put. Limits stated plainly: 100 projects per account and a size cap per project, both with plain-English messages. **Conflict handling, worded exactly this way and no further:** *"If the same project is edited in two places, the most recent edit wins and the older version is kept rather than discarded."* **Do not write:** "browse your version history", "restore an earlier version". The backend keeps versions; no frontend code calls those endpoints, so a student cannot reach a single old one today. |
| 10 Numbers | — | — | Six mono, tabular-figure stat tiles following `.tb-chip--quiet`: `151` block types · `18` worked projects · `6` built-in datasets · `6` chart types · `14` documentation sections · `0` servers doing your physics. The last is the rhetorical one and it is literally true. |
| 11 Playground | `Try it` | `Rules in, motion out.` | Keep `GravityPlayground`, moved here from the middle of the page. Body: *"Drag the gravity slider and click to drop a ball. This box runs the same idea the IDE does — you write the rule, the simulation plays it out."* |
| 12 For classrooms | `For teachers` | `Classes today. Assignments next.` | Lead with the "next" so nobody feels sold to. Anyone can sign up as a teacher — one checkbox at signup, no approval queue. Create a class with a name and an optional subject or year label. Four ways in: a short join code (like `KQ4-7PM`), a copyable link, a QR code for the board, and email invites pasted as a list. Invite as students, teaching assistants or co-teachers; pending invites can be resent or revoked. Three join policies: **open**, **approval**, **paused**; regenerate the code to retire the old one. A People tab with the full roster and the ability to remove a member. Archive at year end — read-only for everyone, unarchive later. Five roles. A site-wide 200-account cap enforced by the system. **The honest paragraph, in a `.card--panel`, not hidden:** *"**Not yet built.** Assignments, submissions, marking, feedback and a gradebook are designed but not shipped. A class today holds its roster, its join settings and its people — the Assignments tab says so itself. When marking arrives it will be announced here."* **Privacy, its own short block:** *"No tracking, no paste detection, no webcam, no keystroke logging. The platform keeps an append-only record of account signups, class joins and join requests — that is the whole of the monitoring, and it exists so a join can be audited, not so a student can be watched."* **Say nothing about email delivery.** Confirmation is a real gate and the constraint may be stated, but only the dev mailer exists; the page must never promise a message will arrive. |
| 13 Footer | — | — | `The IDE needs a laptop or desktop — 1024px or wider. This page reads fine on a phone.` Replace `Free for classrooms.` (it reads like a pricing tier) with `No charge and no billing. A hard 200-account cap keeps the site small on purpose.` Repeat the primary CTA — `Open the IDE`, through `go()`. A quiet link back up to `Create an account` / `Sign in` for the student who scrolled past the hero. |

- [ ] **Step 4: The numbers ledger.** Before the copy is final, re-derive **every numeral on the page** from the tree and write the derivation into a comment block at the top of `WelcomePage.js`. Verified while this plan was written, at `6df894a`:

| Claim | Derivation | Status |
|---|---|---|
| 151 block types | `toolbox.js` `<block type=…>` unique count | **151** ✓ |
| 120 purpose-built, **19 drawers** | `npm run check:blocks` → *"120 entries in 19 categories; 120 toolbox ids and 26 drawers reconcile both ways"* | ✓ — see the correction below |
| 31 standard Blockly blocks | toolbox unique types minus registry ids | **31** ✓ |
| 4 + 4 + 7 + 3 = 18 worked projects | `precodedExamples.js` EXAMPLES = 4; `blockTemplates.js` `BLOCK_TEMPLATES` = 4, `DS_TEMPLATES` = 10 (7 data-science + 3 hybrid analyses), `HYBRID_TOPICS` = 3 | **18** ✓ |
| 6 built-in datasets | `utils/dataset/dataset.js:699-706` `BUILTIN_LOADERS` | **6** ✓ (planets, penguins, weather, pendulum, spring, freefall) |
| 14 documentation sections | `components/HelpPage.js` — 14 section objects, 14 sidebar entries | **14** ✓ |
| 6 chart types | the Charts drawer's block list | **re-derive before shipping** |
| Row counts 9/30/28/56/8/12 | `utils/dataset/builtins/*.json` | **re-derive before shipping** |
| 5 roles, 4 join doors, 3 join policies, 200, 100 | `docs/classroom-platform.md` §3, §4, §11 and the shipped code | ✓ per the alignment report |

> **A correction to the welcome brief, applied.** The brief's §3 says *"19 drawers: Values, Objects, Motion, State, Control, Logic, Math, Variables, a ten-stage Data Science drawer, and Advanced (3D Math, Raw Python, Loops, Text, Lists, Functions)"* — but that enumeration names 26 things, not 19. The toolbox has **26 drawers**, of which **19 own purpose-built blocks**; the other seven are the two parent drawers (Data Science, Advanced) and the five stock-only drawers (Variables, Functions, Loops, Text, Lists). The copy above states the checkable version — *"120 purpose-built for physics and data across 19 drawers, plus 31 standard Blockly blocks in the Advanced drawer"* — and drops the enumeration. **Rule for whoever writes the final copy: if a claim cannot be pointed at a file, it does not ship.**

- [ ] **Step 5: Rewrite `welcome.css`'s base rules onto tokens**, per Task 4's discipline and the substitutions below. The **section rhythm** for §2–§12 is `var(--space-9)` — Decision 1. The **hero tracking is dropped**, not converted — Decision 2:

| Selector | Now | Becomes |
|---|---|---|
| `.welcome` | `padding: 48px 20px 64px`; `color: var(--text-bright)` | `var(--space-8) var(--space-5) var(--space-9)`; `var(--text)` — body text is `--text`, `--text-bright` is for headings |
| `.welcome-hero h1` | `font-size: 44px`; `margin: 18px 0 6px`; `letter-spacing: 0.5px` | `var(--fs-hero)`; `var(--space-5) 0 var(--space-2)`; **delete the tracking** |
| `.welcome-tagline` | `font-size: 17px`; `margin: 0 0 26px` | `var(--fs-xl)`; `0 0 var(--space-6)` |
| `.welcome-cta` | `gap: 12px` | `var(--space-3)` |
| section blocks | `margin: 56px / 64px / 72px auto 0` | `var(--space-9) auto 0` — all three |
| `.welcome-features` | `gap: 16px` | `var(--space-4)` |
| `.welcome-card h2` (now `h3`) | `font-size: 16px`; `margin: 10px 0 6px` | `var(--fs-xl)`; `var(--space-3) 0 var(--space-2)` |
| `.welcome-card p` | `font-size: 13px`; `line-height: 1.55` | `var(--fs-md)`; `var(--lh-normal)` |
| `.welcome-play h2` | `font-size: 22px`; `margin-bottom: 4px` | `var(--fs-2xl)`; `var(--space-1)` |
| `.welcome-play p`, `.welcome-foot p` | `font-size: 14px` | `var(--fs-lg)` |
| `.welcome-playground` | `margin-top: 14px` | `var(--space-4)` |
| `.welcome-playground__canvas` | `border-radius: 8px` | `var(--radius)` |
| `.welcome-playground__controls` | `gap: 12px`; `margin-top: 10px`; `font-size: 13px` | `var(--space-3)`; `var(--space-3)`; `var(--fs-md)` |
| `.welcome-playground__hint` | `font-size: 12px` | `var(--fs-sm)` |
| `.welcome-reveal` | `transition: opacity 0.5s ease, transform 0.5s ease` | `opacity var(--transition-slow), transform var(--transition-slow)` — **note: this is a halving (500ms → 240ms), a real if small design change hiding inside a "mechanical" table. It is the right call — 0.5s was a fourth duration in a three-duration system — but check the reveal still reads as a reveal and does not snap.** |
| `.welcome-orbit*` geometry | `width/height/margin` in px | **exempt.** Prefix each rule with `/* metric-exempt: decorative orbit geometry — a figure, not a ramp value */`. The negative margins are half-width centring for an absolutely positioned circle; the linter's own self-test covers this case. |
| `.welcome-btn`, `.welcome-btn--small` | — | **delete both rules.** `.btn`/`.btn--lg`/`.btn--sm` supply them once the markup moves. |

New rules this page needs, all tokenised: `.welcome-eyebrow` (the four `--label-*` vars plus a 2px `--cat-*` top rule or dot — **never** hand-written uppercase and letterspacing), `.welcome-skip` (visible on focus only), `.welcome-toolbar`, `.welcome-band`, `.welcome-compare` (the blocks↔Python grid), `.welcome-code` (`--mono`, `--bg-input`, `--border`, `--radius-sm`), `.welcome-stat` (`--mono` + `font-variant-numeric: tabular-nums`, following `.tb-chip--quiet`), `.welcome-chips`.

**Section identity uses `--cat-*`, exactly as pane headers do** (`workspace.css:65-67`): editor → `--cat-values`, code → `--cat-objects`, viewport/motion → `--cat-motion`, debugger → `--cat-control`, data science → `--cat-data-science`, classrooms → `--cat-communicate`. Resolve by name; never string-concatenate a variable name. **`--cat-*-bright` is decorative only** — orbit dots, glow, the playground's balls — never a colour text sits on. **The reserved red band is off limits**: no red accent, no red category, no filled red button on this page.

**One filled primary visible at a time.** The hero's "Use the IDE" is `.btn .btn--primary .btn--lg`; the footer's repeat may also be primary because the two are never on screen together. Nothing else on the page is filled — secondary doors are plain `.btn .btn--lg`, in-section links are `.btn--ghost`.

- [ ] **Step 6: Accessibility, non-negotiable.** One `<main>`; `<section>`s with `aria-labelledby` pointing at their headings; one `<footer>`; a skip link, because the page is about to be nine screens long and the doors are at the top. **Heading order repaired**: the page currently uses `<h2>` for both section titles *and* card titles — sections are `h2`, cards inside them are `h3`. Decorative marks (`.welcome-orbit`, card icons) stay `aria-hidden="true"` — already correct at `WelcomePage.js:51` and `:76`. **Do not override the global focus ring.**

- [ ] **Step 7: Run everything to pass.** `npm run test -w frontend -- welcomePage welcomeTokens` PASS; add `"welcome"` to Task 6's `portalControls.test.js` `DIRS` list and confirm it goes green (the `welcome-btn` alias is now gone from markup); full suite; `npm run build -w frontend`.

- [ ] **Step 8: Read the page as each of the three readers.** Guest: does it say what the thing does, that it needs no account, and that nothing is held back? Student on a join code: are the doors reachable and is the "needs a laptop" line findable? Teacher: is the "Not yet built" paragraph impossible to miss, and is there a single sentence that overpromises? **If a sentence cannot be pointed at a file, cut it.**

- [ ] **Step 9: Commit**

```bash
git add frontend/src/welcome frontend/src/styles/welcome.css frontend/src/styles/__tests__/welcomeTokens.test.js
git commit -m "feat(frontend): the front page becomes informative — nine sections from the verified inventory, one honest not-yet-built paragraph, gate untouched"
```

---

### Task 12 (Lane W): The welcome page's responsive behaviour and its one interactive control

**Files:**
- Modify: `frontend/src/styles/welcome.css` (the responsive region at the end of the file)
- Modify: `frontend/src/welcome/GravityPlayground.js`
- Create: `frontend/src/welcome/__tests__/gravityPlayground.test.js`

**Interfaces:**
- Produces: a page that works at the 1024px floor and on a phone; a labelled, themed, accessible slider.
- Consumes: `.range` (Task 2), `.btn--sm` (Task 2).

The welcome page is **currently absent from the portal's only responsive block** — `platform.css`'s `@media (max-width: 1024px)` names admin, classes and auth selectors and no welcome selector at all — so the 44px hero, the 260px canvas and the `minmax(260px, 1fr)` grid have never had any small-screen handling.

- [ ] **Step 1: The breakpoints**, appended at the end of `welcome.css` under a placement comment mirroring `platform.css:282-295`'s:
  - **≥1280px:** three-column feature grid, six-across numbers strip, side-by-side blocks/Python comparison.
  - **1024–1280px (the stated minimum):** two-column grid, numbers strip wraps to 3×2, the comparison stays side by side. **Nothing is hidden.** The 1024px rule is that nothing load-bearing disappears at the floor — only that it shortens.
  - **≤1024px:** single-column cards; the hero becomes `clamp(var(--fs-2xl), 6vw, var(--fs-hero))`; section rhythm steps down one rung (`--space-9` → `--space-7`); the comparison stacks.
  - **≤720px (phone — a deliberate, stated exception):** the rest of the product has no obligation below 1024px, but this page does, because a student scanning a projected QR code lands here on a phone. The three doors become `.btn--block` and stack; the numbers strip becomes 2×3; the playground canvas shrinks and keeps `touch-action: none`; and **the footer's "the IDE needs a laptop" line is given real prominence at this width** — it is the most important sentence on that screen and it pre-empts the worst first impression the product can make.

  `clamp()` with token arguments passes the metric linter (the values are all `var()`); the `6vw` middle term is a viewport unit, not a ramp value, and the linter does not cover `vw`. Note it in a comment anyway.

- [ ] **Step 2: The slider becomes a real control.** `GravityPlayground.js:122-131` has a `<label htmlFor>` already (good) but the input is a raw, unstyled `<input type="range">` with no `aria-valuetext` and no visible value readout in the product's own type. Give it `className="range"`, an `aria-valuetext={`${gravity.toFixed(1)} metres per second squared`}`, and split the label into a text label plus a `--mono` tabular-figure readout. Switch the Play/Pause button from `welcome-btn welcome-btn--small` to `btn btn--sm` — that retires the last `.welcome-btn` site in the codebase and is what makes Task 13 safe.

- [ ] **Step 3: The canvas gets a text alternative and an honest statement about its keyboard story.** `GravityPlayground.js:112`'s `<canvas>` has no accessible name and its click-to-drop interaction has no keyboard equivalent. Give it `role="img"` with an `aria-label` describing what it shows ("A box of coloured balls falling and bouncing under the gravity you set"), and add a visible line stating that the drop interaction is decorative and that the slider is the control that matters. **Do not** invent a keyboard drop just to tick a box; an honest statement is the better answer and the brief says so.

- [ ] **Step 4: Reduced motion — degrade, don't delete.** The existing guard is already the product's reference implementation and `GravityPlayground.js:29-46` is already correct: reduced motion means the box renders one static frame and moves only when the visitor asks (slider, click, Play). Extend the CSS guard to cover the new sections: the orbit stops spinning but keeps its shape (mirroring the boot atom, which stops orbiting and keeps a slow nucleus pulse); reveals resolve to their final state rather than never appearing; nothing new animates without a guard. `frontend/scripts/e2e-test.mjs:1782-1798` fails the build if the guard is missing from shipped CSS — keep it satisfiable.

- [ ] **Step 5: Test.** `gravityPlayground.test.js` with `mountComponent`: the slider has an accessible label and an `aria-valuetext` carrying units; changing it updates the readout; the Play/Pause button toggles `aria-pressed`; with `matchMedia` stubbed to match `prefers-reduced-motion`, the component mounts paused (`aria-pressed="false"`, label "Play"). Override `window.matchMedia` in the suite — `setupTests.js`'s stub never matches by default, which is exactly what makes this overridable.

- [ ] **Step 6: Measure it.** DevTools device toolbar at 1280, 1200, 1024, 900 and 390px wide, both themes. At 1024 nothing is hidden. At 390 the three doors are full-width and reachable without scrolling, the numbers strip is 2×3, and the laptop-scope line is prominent. Confirm `document.body` never scrolls horizontally at any width.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles/welcome.css frontend/src/welcome
git commit -m "feat(frontend): welcome page responds from 1280px to a phone; the playground slider becomes a labelled, themed .range"
```

---

### Task 13 (After both lanes merge): Alias retirement — the comma lists and their correction rules deleted

**Files:**
- Modify: `frontend/src/styles/primitives.css`
- Modify: `frontend/src/styles/__tests__/primitivesTokens.test.js`, `frontend/src/components/classes/__tests__/portalControls.test.js`

**Interfaces:**
- Produces: a `primitives.css` whose selectors are the API and nothing else.
- Consumes: every markup migration in Tasks 6, 7, 9, 11 and 12. **This task is only safe once all of them have landed.**

D2: the alias lists are migration debt, not an interface. They exist so the 2026-08-20 modernization did not have to touch classroom markup, and **every one of them carries a correction rule that undoes the base it was aliased onto** — `primitives.css:52-66` and `:135` exist purely to make aliases behave. Adding a screen must never mean adding a name to three comma lists.

- [ ] **Step 1: Prove nothing references them.** Extend `portalControls.test.js` to cover all five portal directories (`components/auth`, `components/classes`, `components/admin`, `sync`, `welcome`) and the full alias list: `admin-btn`, `admin-btn--primary`, `welcome-btn`, `welcome-btn--small`, `account-chip-btn`, `auth-submit`, `auth-input`, `auth-error`, `auth-card`, `class-card`, `welcome-card`, `classes-newform`, `account-chip-badge`, `class-archived-badge`, `admin-tabs`, `admin-tab`, `admin-tab--on`, `auth-title`. Run it — it should already pass if Tasks 6–12 did their work. **Anything it flags is a missed site; fix the markup, never re-add the alias.**

- [ ] **Step 2: Delete from `primitives.css`:**
  - the `.btn` base group's aliases (`:6-11` and the matching `:hover` / `:disabled` groups at `:32-50`): `.admin-btn`, `.welcome-btn`, `.account-chip-btn`, `.auth-submit`. **Keep `.vdialog-btn`** — that is IDE markup this plan never touched.
  - the legacy base-alias overrides at `:52-66` in full (`.account-chip-btn` display/background pair, `.admin-btn` background pair, `.welcome-btn` block) and the `justify-content` correction at `:135`.
  - the `--primary` group's aliases (`:69-89`): `.admin-btn--primary`, `.welcome-btn--primary`, `.account-chip-btn--primary`, `.auth-submit`. **Keep `.vdialog-btn--ok`.**
  - `.admin-btn` and `.account-chip-btn` from the `.btn--sm` group (`:115-121`) — this is the pin that made every portal control 22px.
  - `.welcome-btn` and `.auth-submit` from the `.btn--lg` group (`:122-128`) and `.auth-submit` from `.btn--block` (`:129-132`).
  - the `.card` group's portal aliases (`:140-145`, `:153-159`, `:163-168`, `:169-173`): `.class-card`, `.welcome-card`, `.auth-card`, `.classes-newform`. **Keep `.start-card`** — IDE markup.
  - the Task-2 transitional aliases: `.auth-input`, `.auth-error`, `.account-chip-badge`, `.class-archived-badge`, `.admin-tabs`, `.admin-tab`, `.admin-tab--on`.

- [ ] **Step 3: Tighten the primitives test.** Add to `primitivesTokens.test.js` a case asserting the retired names no longer appear in `primitives.css` at all, and that `.vdialog-btn`, `.vdialog-btn--ok`, `.pane-header`, `.vdialog-header`, `.start-card` and `.start-empty` — the IDE aliases this plan deliberately keeps — still do. That distinction is the whole point: the portal migrated, the IDE did not, and the file should say which is which.

- [ ] **Step 4: Full verification.** `npm run test -w frontend` all green. `npm run build -w frontend` clean. Then a **complete browser sweep in both themes**, because this is the task that breaks things if a site was missed: `/welcome` (top to bottom, every CTA), `/auth/signup`, `/auth/signin`, `/auth/forgot`, `/auth/check-email`, `/profile`, `/classes`, a class's Assignments, People and Settings tabs, `/join`, `/join/CODE`, `/admin` (all four tabs), the IDE start menu (account chip), and the guest-import toast. An unstyled button anywhere means a missed markup site.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/primitives.css frontend/src/styles/__tests__ frontend/src/components/classes/__tests__
git commit -m "refactor(frontend): retire the portal alias lists and their correction rules — .btn/.card/.panel-header are the API again"
```

---

### Task 14 (Final): Wrap-up — suites, build, typechecks, docs pass, browser-pass checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-08-18-classroom-platform-01-foundation.md`, `-02-accounts.md`, `-03-classes.md`, `docs/superpowers/plans/2026-08-19-classroom-platform-04-sync.md` (stale-warning banners only — **never edit their task bodies**)
- Modify: `docs/e2e-checklist.md` (record the portal coverage gap)
- Modify: `docs/classroom-platform.md` §18 (the Forward references block — strike what this plan delivered)
- Refresh: `frontend/e2e/*.png` if the suite's screenshots drift

- [ ] **Step 1: The full gate.**

```bash
npm run test -w frontend        # every suite, including the four new conformance suites
npm run build -w frontend       # clean
npm run typecheck -w backend    # proves backend untouched
npm run typecheck -w shared     # proves shared untouched
npm run check:blocks            # 120 entries in 19 categories; 120 ids and 26 drawers reconcile
git diff --stat main -- backend shared   # must be empty
```

- [ ] **Step 2: End-to-end.** Start the dev server and run `node frontend/scripts/e2e-test.mjs`. The IDE suites A1–A18 must all still pass — this plan touched `Toolbar.js` once (Task 3's delegation) and `pages.css` once (Task 2's `.start-empty` promotion), and both are places the suite looks. Fix selector drift in the script, never in the product. Run `node frontend/scripts/ux-audit.mjs`.

- [ ] **Step 3: Stale-warning banners on the four executed classroom plans.** The spec-alignment report explicitly recommended this and explicitly left it undone. Add a short banner at the top of each of the four files — a record of what a reader must **not** follow, not an edit to the record itself:
  - *"**Append to `frontend/src/styles.css`"** (plan 02 lines 2882, 3368; plan 03 line 2202; plan 04 lines 1798, 1880, 2217) is wrong — that file is now a 17-line manifest with load-bearing order. Shared primitives go in `primitives.css`, portal rules in `platform.css`, welcome rules in `welcome.css`.*
  - *Plan 04 Task 10's `FEATURES` array (lines 2126–2133) specifies **emoji icons** — a direct violation of the standing no-emoji rule (spec §18 D10). Shipped code never carried them.*
  - *Plan 04 Task 10's `WelcomeGate` code block and its four-case test specify the **superseded v1 gate**, contradicting the file's own header note and the shipped synchronous sessionStorage gate.*
  - *Plan 04 Task 10's CSS block is pre-token and dark-only.*
  - *Plan 01's **"CDN script tags must be preserved byte-for-byte"** is now impossible — Blockly and Monaco are bundled and GlowScript is vendored.*
  - *Plans 02/03/04's **"No @testing-library — screens are verified by the controller's browser pass"** is superseded: `frontend/src/test/renderHelpers.js` is a dependency-free component-test harness and portal screens are component-tested.*
  - *Plans 02/03's **"no edits under `frontend/src/components` except the named ones"** is no longer a usable boundary: header controls are added through `utils/toolbar/visibleControls.js`.*
  - **Do not** repeat the alignment report's claim that Plan 04's sync-chip status bar "no longer exists." The spec-alignment report checked it: `IDELayout.js` renders `<div className="status-bar">` holding `<SaveState />`, styled against a live `--statusbar-h` token, and `SaveState.js` is a wrapper that renders `SyncChip`. The status bar is alive; the instruction that is stale is only the chip's exact mount point.

- [ ] **Step 4: Docs pass.** In `docs/classroom-platform.md` §18, mark the Forward-references block: items 1 (tokenise), 2 (the missing components), 3 (page shell + portal header + theme toggle), 4 (alias retirement) and 5 (fold the icon module) are **delivered by this plan**; item 6 (portal e2e) and item 7 (a build-wired lint) remain open, with a note that the two conformance suites cover D1/D7/D8/D9/D10 inside `npm run test`. In `docs/e2e-checklist.md`, add a short "Not yet covered" note naming the five portal surfaces with zero coverage — recording the gap, not filling it.

- [ ] **Step 5: The human browser-pass checklist.** Write it into the commit body and hand it to the controller:

  **Both themes, every item:**
  1. `/welcome` — read top to bottom on a laptop. Every CTA lands where it says (and none bounces back to `/welcome`). Theme toggle top-right works. Skip link appears on first Tab.
  2. `/welcome` at 390px — three doors reachable without scrolling, numbers strip 2×3, "the IDE needs a laptop" line prominent, no horizontal scroll.
  3. `/welcome` with OS "reduce motion" on — orbit keeps its shape but stops spinning, sections are simply present rather than never appearing, the playground renders a static frame and still drops a ball on click.
  4. `/auth/signup` — click a field with the mouse: **no ring**. Tab into it: 2px offset ring. Submit button is 38px, full width.
  5. `/classes` with no classes — the empty state spans the wall, not one 220px column.
  6. A class → People — Deny, Remove and Revoke are outlined red, never filled. Copy join link announces "Copied!". The QR reads as a bordered card in dark mode, not a hole.
  7. A class → Settings — save success is green and announces; force a failure (rename to an invalid value) and confirm it is red and announces as an alert.
  8. `/admin` — arrow-key across the tab bar; Tab into the Emails table and open a mail row with Enter *and* with Space; the mail body renders in JetBrains Mono; the Health tab shows a word, a glyph and a colour.
  9. Toggle the theme from `/classes`, `/admin` and `/auth/signin`; reload; confirm it persisted and the IDE agrees.
  10. Any portal screen at exactly 1024px — nothing load-bearing hidden.
  11. On a touch device or with touch emulation — every portal button is comfortably hittable.
  12. The IDE itself — start menu, a physics run, a data-science project, debug mode. **This plan must have changed nothing there** except the theme-toggle button's new `aria-label`.

- [ ] **Step 6: Final commit**

```bash
git add docs frontend/e2e
git commit -m "docs: Plan 5 wrap-up — stale banners on the executed classroom plans, §18 forward references struck, portal e2e gap recorded"
```

---

## Self-review — contradictions found and fixed while writing this plan

Recorded rather than silently corrected, because the next plan's author will hit the same seams.

1. **The tagline's font size was specified two different ways.** The alignment delta's C1 maps `.welcome-tagline`'s 17px to `--fs-xl` (16px); the welcome brief's §3.1 maps it to `--fs-lg` (14px). **Resolved to `--fs-xl`**, following the delta — it is the design contract's own source and its stated reasoning (a sentence sitting under a 44px hero reads as body prose at 16px) is the better argument. The brief's parenthetical, that 17px is a named one-off the scale replaced, is correct either way.
2. **The playground canvas radius was specified two different ways** — `--radius` (delta) versus `--radius-lg` or `--radius` (brief). **Resolved to `--radius`**, because that is the value the conformance table asserts and a canvas inside a page is a panel, which is that token's stated role.
3. **The hero tracking was specified two different ways** — the brief converts `0.5px` to `--label-tracking`, the controller ruling drops it. **The ruling wins and Task 11 says so explicitly**, because a plan that quietly follows the research over an explicit decision is how decisions get lost.
4. **The research's "fold six welcome icons into `Icons.js`" is five.** `ClassroomIcon` duplicates the existing `GraduationCapIcon` (`Icons.js:242-244`) with the same mortarboard geometry; adding it would create a second duplicate-icon problem while fixing the first. Task 10 imports the existing export.
5. **The research undercounts `.auth-title` H2 sites in `PeopleTab.js`** — it names four (`:71, 104, 147, 173`) and there are five; `:226`, the "Joining" heading inside `JoinPanel`, was missed. Task 7 moves all five.
6. **Three citations were off by one or two lines** and are corrected inline: `AdminConsole.js:243-244` → `:242-243`; `ClassChrome.js:78-80` → `:77-79`; `PeopleTab.js:236-241` (the "Copied!" confirmation) → `:240`. `frontend/src/constants.js` → `frontend/src/constants/index.js`.
7. **The brief's "19 drawers" enumeration names 26 things.** Corrected in Task 11's copy to the checkable form, with the derivation recorded.
8. **The alignment report asks for the tab underline's 2px to be "tied to a token." It is not tied to one, deliberately.** There is no border-width token in the system, the IDE writes 2px literally for the same purpose at `workspace.css:65-67`, and D16 says inventing a token is a decision rather than a side effect of a substitution pass. The metric linter therefore does not cover `border-width`, and Task 3's helper says so in a comment.
9. **`platform.css` and `welcome.css` would have been edited by both lanes.** Task 3 exists solely to remove that collision, and it also extracts `ThemeToggleButton` for the same reason — Task 9 (Lane P) and Task 11 (Lane W) both mount it, so it must exist before either lane starts and neither may edit it.
10. **`.start-empty` moves later in the cascade** when Task 2 promotes it out of `pages.css` into `primitives.css`. Verified safe: a repo-wide grep finds exactly one rule and one consumer (`StartMenu.js:372`), so there is nothing for the reordering to break. The step says to re-run that grep rather than trust this note.
11. **Task 6's `portalControls.test.js` would fail in Lane P if it covered `welcome/`.** Its `DIRS` list is deliberately scoped to the four portal directories in Task 6 and widened in Task 11, so each lane's suite goes green on its own work; Task 13 asserts the final combined state. This is called out in both tasks.
12. **Two tasks contradicted each other over the focus override.** The first draft had Task 4's conformance test assert `platform.css` contains no `:focus` rule while Task 4's own substitution table said "Task 5 deletes it, leave it alone here" — a task that could not pass its own gate. **Resolved by deleting the override in Task 4**, where the test that asserts it lives; Task 5 shrank to the coarse-pointer block plus the browser verification of the ring, and now owns `responsive.css` alone. The lane table records that it is the one Lane P task not touching `platform.css`.
13. **Steps whose code could not be fully verified**, flagged so they are treated as sketches rather than transcriptions: the `.range` pseudo-element metrics (thumb centring across WebKit and Firefox needs a browser to tune — the token arithmetic in Task 2 is a starting point, not a measured result); the exact `<kbd>` row markup for §4 (the `.tb-kbd` treatment is verified at `chrome.css:165-176`, but its use outside a `.tb-btn` is new); and the "6 chart types" and dataset row counts in Task 11, which Step 4 explicitly requires re-deriving before the copy ships.
