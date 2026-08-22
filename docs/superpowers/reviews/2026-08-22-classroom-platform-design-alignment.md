# Classroom Platform Design-Alignment Delta

**Produced:** 2026-08-22 by a multi-agent discovery workflow (design-system map, surface audit, spec inventory, capability inventory).
**Status:** research input — not yet applied.
**Note:** the report's header cites branch commit 9d46c84; the audit was performed against the working tree at HEAD (363fce4, post-IDE-modernization). Treat file:line citations as current-tree references and re-verify before cutting.

---

# Design-Alignment Delta — Classroom Platform

**Branch** `feature/classroom-platform` @ `9d46c84` · repo root `C:\Users\tredi\Documents\Projects\Physics IDE` · nothing modified.

---

## 0. Diagnosis in one paragraph

The design system split cleanly into two layers and the platform adopted exactly one of them. **Colour is fully adopted** — one hardcoded hex in 305 lines of `frontend/src/styles/platform.css` (line 186, `.join-qr { background: #fff }`), zero hex in any platform `.js`, and `ThemeProvider` wraps every route in `frontend/src/App.js:42-73`, so both themes already resolve on every screen. **Metrics, primitives, icons and accessibility are not adopted**: `platform.css` uses `var(--fs-*)` once and `var(--space-*)` three times against 36 literal font-sizes and 47 literal spacings, uses `var(--radius*)`, `var(--fw-*)`, `var(--lh-*)` zero times, and the canonical class names `.btn` / `.card` / `.panel-header` appear zero times in platform markup — every consumer reaches them through a legacy alias in `frontend/src/styles/primitives.css:6-11, 69-74, 140-145`. Meanwhile the **specs are design-silent by construction**: `docs/classroom-platform.md`, `docs/classroom-platform-stack.md` and `docs/product-contract.md` say nothing about tokens, themes, icons, fonts, control sizing or responsive behaviour, so the modernization's largest visual decisions live only in executed plan documents and MEMORY.md — outside the contract that governs deviation. Three specific spec claims are now flatly false (stack §2 line 30, spec §14's screen inventory, spec §3.1's door labels), and one (§5.4) is under-specified against the adaptive header in a way that will produce wrong code if implemented as written.

The delta is therefore: **one binding design contract to write down, one mechanical tokenisation pass, four new shared primitives, one shared page chrome, and ~14 spec edits.**

---

## 1. The design contract the platform must adopt

Stated as numbered clauses. Each is checkable; each names its source of truth in the repo.

### C1 — Tokens are the only source of every metric

No literal `px` for spacing, type, radius, line-height, weight, control height, or duration in `platform.css` or in any platform JSX `style={}`. Source: `frontend/src/styles/tokens.css:8-93` (all geometry lives at bare `:root`, theme-independent).

The substitution table, resolved for every literal now in `platform.css`:

| Literal now | Token | Notes |
|---|---|---|
| `10px` fs | `--fs-2xs` | `.account-chip-head:88`, `.account-chip-badge:95`, `.class-archived-badge:169` |
| `11px` fs | `--fs-xs` | `.class-card-meta:164`, `.sync-chip:188` |
| `12px` fs | `--fs-sm` | `:33, :63, :74, :77, :141` |
| `13px` fs | `--fs-md` | `:56, :68, :116, :123, :166, :208, :252, :265` |
| `14px` fs | `--fs-lg` | `:42, :76, :121, :143, :256, :271` |
| `28px` fs | `--fs-3xl` | `.join-code-big:179` |
| `44px` fs | `--fs-hero` | `.welcome-hero h1:215` |
| **`15px`** | **`--fs-xl` (16px)** | `.class-card-name:162` — it is a card title, which is the stated role of `--fs-xl` (`tokens.css:28`) |
| **`17px`** | **`--fs-xl` (16px)** | `.welcome-tagline:216` — sits under a 44px hero; 16px reads as body-prose |
| **`18px`** | **`--fs-2xl` (20px)** | `.admin-header h1:108`, `.classes-header h1:152` — "screen titles" (`tokens.css:29`) |
| **`22px`** | **`--fs-2xl` (20px)** | `.welcome-play h2:255` |
| `3px` radius | `--radius-sm` | `.account-chip-badge:98`, `.class-archived-badge:172` |
| `4px` radius | `--radius-sm` | `:39, :52, :70, :138` |
| `6px` radius | `--radius` | `:183, :186, :206` |
| `8px` radius | `--radius` | `.welcome-playground__canvas:259` |
| `1.5` / `1.55` lh | `--lh-normal` | `:76, :252` |
| `700` weight | `--fw-bold` | `.auth-brand:17` |
| `500` weight | `--fw-medium` | `.admin-table th:127` — but see C5, this should be the label system instead |
| `0.5s` transition | `--transition-slow` | `.welcome-reveal:273` |
| `2 / 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24px` spacing | `--space-1…--space-6` | off-ramp values (2, 6, 10, 14, 18) snap **up**: 2→4, 6→8, 10→12, 14→16, 18→20 |

**Two values need a decision, not a substitution — flag them to the owner:**

- **Welcome section rhythm** `56px / 64px / 72px` (`platform.css:245, 254, 270`). The ramp stops at `--space-8: 48px`. Either collapse all three to `--space-8`, or extend the ramp once with `--space-9: 64px` in `tokens.css:18`. Extending the ramp is a design-system change and must be a written decision, not a silent edit.
- **Letter-spacing** — the system has exactly one tracking token (`--label-tracking: 0.02em`, `tokens.css:47`). The platform adds three more: `0.5px` on the 44px hero (`:215`), `0.08em` on the join code (`:180`), and the hardcoded `0.02em` on `.auth-brand:20`. Resolution: `.auth-brand` → `var(--label-tracking)`; hero → drop tracking or use `--label-tracking`; the join code's `0.08em` is **legitimate and should be kept** — spec §3.3 chose the code alphabet for legibility and mono display type needs the tracking — but it must become a named token (`--tracking-code: 0.08em`) rather than a magic number.

### C2 — Three primitives, and the aliases are a migration debt, not an API

`.btn`, `.card`, `.panel-header` (`primitives.css:6, 140, 178`) are the only button, card and section-header. **New platform markup uses the canonical class**; the alias lists exist so the 2026-08-20 modernization didn't have to touch classroom markup, and every alias carries a correction rule that undoes the base (`primitives.css:52-66, 115-135, 161-173`). Adding a new screen must not mean adding a new selector to three comma lists.

Concrete migration: `.admin-btn` → `.btn`; `.admin-btn--primary` → `.btn .btn--primary`; `.auth-submit` → `.btn .btn--primary .btn--lg .btn--block`; `.account-chip-btn` → a real nav-row class (it is not a button — `primitives.css:135` has to override `justify-content` to make it one); `.welcome-btn` → `.btn .btn--lg`; `.auth-card`/`.class-card`/`.welcome-card`/`.classes-newform` → `.card` with `--panel` / `--interactive` / `--lg` modifiers.

### C3 — Default control size is 30px; 22px is IDE chrome only

`--control-h: 30px` is the product default (`tokens.css:68`). `--control-h-sm: 22px` exists for dense IDE chrome. `.admin-btn` is pinned to `--control-h-sm` + `--btn-pad-sm` + `--fs-xs` at `primitives.css:115-121`, and it is the platform's universal button across 19 usages — so Approve, Deny, Remove, Archive, Deactivate, Send reset, New class, Join a class, Copy join link all render 22px tall with 11px text. **Binding rule: any control a teacher or student presses on a full-screen platform route is `--control-h` or larger.** Table row actions may use `.btn--sm`, but only if C10's coarse-pointer clause covers them.

### C4 — One filled primary per surface; destructive is outlined; red is reserved

`.btn--primary` (`primitives.css:69-89`) is the only filled button. `.btn--danger` (`primitives.css:104-113`) is `color-mix(in srgb, var(--red) 45%, transparent)` border + `--red` text, **never** a filled red — and it is currently used **zero times product-wide**. Every destructive platform action must adopt it: Remove student, Deny, Revoke invite, Deactivate account, Archive class. Hue 340°–15° stays reserved for errors and breakpoints (enforced by `frontend/src/utils/blockly/__tests__/blockPalette.test.js:42-51`); no platform surface may introduce a red accent or category.

### C5 — Every small header uses the micro-label system, including table headers

`--label-transform / --label-tracking / --label-weight / --label-fs / --label-color` (`tokens.css:41-49, :180`) is the one treatment. Two platform violations are structural rather than cosmetic:

- `.admin-table th` (`platform.css:124-130`) hand-rolls a micro-label with `color: var(--text-muted)` + `font-weight: 500`. Table headers are precisely the case the system exists for.
- `AccountChip.js:16` and `:29` type the literal string **`ACCOUNT`** in the DOM. `--label-transform: none` was set specifically to abolish the uppercase pastiche across 18 sites; baking caps into markup makes it the one micro-label the token cannot reach. **Rule: casing is a CSS decision, never a string decision.**

### C6 — Exactly one focus ring; no component writes `:focus`

`tokens.css:294-312` declares the ring inside `:where(...)` at **zero specificity** so components can override it *deliberately*. `platform.css:44` — `.auth-input:focus { outline: 1px solid var(--border-focus) }` — overrides it *accidentally* at 0-1-1, giving every platform form field a 1px ring instead of the 2px `--focus-ring-color` ring with offset, and firing on mouse click because it is `:focus` not `:focus-visible`. It is the only `:focus` override on the platform and there are no platform `:focus-visible` rules at all. **Delete it.** The only sanctioned variant is the negative offset for thin drag handles (`responsive.css:28-32`).

Corollary: a control the user perceives must be the thing that receives focus. `SignUpPage.js:57-62` wraps a native radio in `.auth-door`, so the ring lands on a ~13px dot inside a full-width card.

### C7 — `data-theme` only, tokens only, and the toggle must be reachable everywhere

No `prefers-color-scheme` path exists anywhere in app CSS and none may be added. Dark is bound to bare `:root` (`tokens.css:96-97`), light is one override block (`:197`), the attribute goes on `<html>` via `ThemeContext.js:24`. Derived role tokens are declared once in the dark block and re-resolve under light by `var()` (`tokens.css:177-183`) — **new role tokens must follow that pattern or they silently keep dark values in light mode.**

Two platform consequences:
- **The toggle is IDE-only.** `useTheme()` is consumed in exactly two places (`components/GlowCanvas.js:15`, `components/layout/IDELayout.js:75`); the control renders from `visibleControls.js`'s `themeToggle` key in the IDE header. A visitor on `/welcome`, `/auth/*`, `/classes`, `/profile` or `/admin` has no way to switch. Fix belongs to C11's shared chrome.
- **The QR is the one un-themed element.** `platform.css:186` paints `#fff` and `PeopleTab.js:220` renders `QRCode.toCanvas` at default black-on-white, so dark mode shows a white slab with no `--card-border`.

### C8 — One icon module, one idiom, no second fork

`frontend/src/components/Icons.js:8-9`: `viewBox "0 0 24 24"`, `fill none`, `stroke currentColor`, `strokeWidth 2`, round caps/joins, `sz(size)` with a `size` prop defaulting 16. Solid glyphs opt out per shape. **A new surface imports from `Icons.js` or adds an export there.**

`frontend/src/welcome/WelcomeIcons.js` is a parallel module re-implementing the same conventions at `strokeWidth 1.6` with a fixed 28px size and no `size` prop, and it **redefines `BlocksIcon`** (`WelcomeIcons.js:32`) with different geometry from `Icons.js:27` — the product ships two different "blocks" icons. It must be folded into `Icons.js` and deleted.

Separately: `Icons.js` exports 75+ icons and the entire classroom platform imports it **once** (`UserIcon` in `HeaderAccount.js:4`). Auth, classes, admin and the join flow are 100% text-only. No-emoji is fully upheld (a Unicode scan across `components/auth`, `components/classes`, `components/admin`, `welcome/`, `sync/` and `platform.css` is clean) — the gap is under-use, not violation.

### C9 — Three durations, and reduced-motion is mandatory

`--transition-fast / --transition / --transition-slow` (`tokens.css:57-60`). Any new animation carries a `@media (prefers-reduced-motion: reduce)` guard, and the house pattern is **degrade the motion, don't delete the affordance** (`viewport.css:50-53`, `workspace.css:517-524`, `platform.css:276-280`). `frontend/scripts/e2e-test.mjs:1788-1797` fails the build if the guard is missing from shipped CSS. The welcome page is currently the *only* platform surface that has one — it is the reference, and it is correct.

### C10 — 1024px floor, and the coarse-pointer block must cover platform classes

`platform.css:283` states the floor; the header's two collapse stages are chosen so stage 2 is active *at* the floor, not below it (`Toolbar.js:37-41`), and nothing load-bearing may be hidden at stage 2 (`Toolbar.js:129-140`, `chrome.css:266-276`). `responsive.css:6-23` names only `.tb-btn`, `.tb-dropdown-item`, `.mode-toggle button`, `.block-search-input`, `.start-project-delete`, `.project-title`, `.pane-divider`, `.debug-drawer-handle` — **no platform class**. On the shared Chromebook/tablet this platform explicitly targets, every classroom control stays 22px. Combined with C3 this is the single highest-impact defect in the audit.

### C11 — One shared platform chrome, built from the header idiom the IDE already has

`.admin-page/.admin-header/.admin-body` (`platform.css:102-120`) and `.classes-page/.classes-header/.classes-body` (`:146-153`) are byte-for-byte duplicates differing only in `gap`; neither is flex-laid-out (brand `<Link>`, `<h1>` and `<nav>` just stack as blocks); the "admin" namespace has become the platform's generic namespace, reaching as far as `sync/GuestImportPrompt.js:10`.

Contract: **one `.page` shell** (`.page` / `.page-header` / `.page-body`) plus **one platform header** built on the IDE's own zone idiom — `height: var(--header-h)` (44px), `background: var(--bg-titlebar)`, `border-bottom`, identity slot / nav slot / right cluster — with the right cluster using `.tb-btn` so it inherits the coarse-pointer bump for free, and carrying the **theme toggle** and the **account control** (C7). `HeaderAccount.js:22-31` already reaches into `tb-btn` / `tb-dropdown-item` / `UserIcon` and is the only platform surface covered by the touch-target block; generalise that, don't fork it.

### C12 — Four primitives the system does not have yet, and the platform needs all four

`primitives.css` exposes only three. There is no `.input`, `.alert`, `.badge`, `.empty`, `.tabs` or `.modal`. Each is currently re-invented on the platform:

| Missing primitive | Where it is faked now | What it must be built from |
|---|---|---|
| **`.input` / `.field`** | `.auth-input` (`platform.css:36-44`), reused for the class code, the admin search, the cap input | `--bg-input`, `--border`, `--radius-sm`, `--control-h`, `--fs-lg`; match `.btn`'s shape; **no `:focus` rule** (C6) |
| **`.alert`** (info / success / warning / danger) | `.auth-error` (`:66-72`) — a form-field error box doing duty as a whole-page failure state at `ClassChrome.js:27`, `InviteLandingPage.js:67`, `JoinClassPage.js:83` | the `.run-error-banner` idiom (`chrome.css:526-544`): `color-mix(--red 12%)` fill, `color-mix(--red 35%)` border — generalised over `--red/--yellow/--green/--accent`; `role="alert"` or `role="status"` per variant |
| **`.badge`** | `.account-chip-badge` (`:93-100`) and `.class-archived-badge` (`:167-175`), verbatim duplicates, both with non-token `border-radius: 3px` | `--radius-pill` or `--radius-sm`, `--fs-2xs`, `--label-*`; tint via `color-mix` on a passed semantic colour; the `.tb-chip` shape (`chrome.css:247-264`) is the reference |
| **`.empty`** | bare `auth-text auth-text--dim` paragraphs at `ClassesHome.js:96-102` and `ClassChrome.js:78-80` | the IDE already has it: `.start-empty` (`pages.css:243-251`) — dashed `--card-border`, `--card-bg`, `--space-4`, `--fs-md`, `--radius`. Promote it into `primitives.css` and use it. |

Also needed: a **`.tabs` / `.tab`** primitive with real ARIA (C13) and a **range input** treatment — `GravityPlayground.js:123-131` is a raw unthemed `<input type="range">`, the landing page's one interactive control, and the IDE's zoom slider that would have been the precedent was deleted in `4f11684`.

### C13 — The non-optional accessibility idioms, applied to the platform

The IDE has been getting these (commit `79b3fd2` added `role="status"` to the boot hint); the platform has none of them.

1. **Tab bars carry ARIA.** `AdminConsole.js:24-35` (buttons) and `ClassChrome.js:55-65` (links) both render a visual tab row with no `role="tablist"`/`role="tab"`/`aria-selected`, no `aria-current="page"`, and no `role="tabpanel"` on the content below (`AdminConsole.js:37-40`). Selection is colour + a 2px underline only. `tokens.css:306` already provisions a focus ring for `[role="tab"]` that nothing uses. Link-based tabs take `aria-current="page"`; button-based tabs take the full tablist pattern.
2. **Nothing is click-only.** `AdminConsole.js:170` — `<tr className="admin-mail-row" onClick={…}>` with no `tabIndex`, no `role="button"`, no `onKeyDown`, and `cursor: pointer` at `platform.css:133`. It looks interactive, is unreachable by keyboard, and because it is not focusable the global ring can never apply.
3. **Every state readout announces.** `role="status"` + `aria-live="polite"` on: the guest-import toast (`GuestImportPrompt.js:6`), the sync chip (`SyncChip.js:47-49`), "Copied!" (`PeopleTab.js:236-241`), "Name updated." (`ProfilePage.js:89`), "Saved." (`SettingsTab.js:78`), the join success/pending state (`JoinClassPage.js:60-64`), and the invite landing tri-state (`InviteLandingPage.js:65-67` — which also needs `aria-busy` on "One moment…").
4. **Colour is never the sole channel.** `SyncChip.js:47-49` carries state only in colour + a `title`; `AdminConsole.js:243-244` prints `API: running` / `trouble` and the DB status in identical `--text` grey. Add a glyph or a word.
5. **`title` is not `aria-label`** when it doesn't contain the visible label (WCAG 2.5.3 — the reasoning is written at `DropdownMenu.js:9-14`), and Escape handlers inside overlays `stopPropagation()` so they can't reach the global stop hotkey.

### C14 — Semantic colour exists; use it

`--success` / `--warning` / `--danger` (`tokens.css:133-135`, aliases of `--green`/`--yellow`/`--red`) appear **zero times** on the platform. Health status, save confirmations, save failures, late flags, unconfirmed-email state and archived state must all resolve through them.

### C15 — Placement rules for new CSS

`frontend/src/styles.css` is a 17-line `@import` manifest and **its order is load-bearing** — each file sits on the same side of `primitives.css` as its rules did in the pre-split monolith. `platform.css` is imported *after* `primitives.css` (line 16). All four classroom plans instruct "Append to `frontend/src/styles.css`" (plan 02 lines 2882, 3368; plan 03 line 2202; plan 04 lines 1798, 1880, 2217) — that instruction is now wrong and must never be repeated. New shared primitives go in `primitives.css`; platform-screen rules go in `platform.css`; and `platform.css:282-295` already documents that its responsive block must stay at the end of the file, below the unconditional base rules it overrides.

### C16 — A z-index scale (currently absent)

Live values: `.app-header` 50 (`chrome.css`), `.overlay-backdrop` 900 (`pages.css:845`), `.vdialog-overlay` 1000 (`pages.css:866`), `.guest-import` **4000** (`platform.css:200`). Propose `--z-header: 50; --z-dropdown: 100; --z-overlay: 900; --z-dialog: 1000; --z-toast: 1100` in `tokens.css` and retire the magic number.

### C17 — Extending the IDE header is a data change, not a JSX change

`frontend/src/utils/toolbar/visibleControls.js:18-20` exports `PRIMARY_KEYS`/`VIEW_KEYS`/`FILE_KEYS`; `:22-62` is the pure `visibleControls({ mode, goal, role, isTeacher, runState, debugMode, traceVisible })`; `Toolbar.js:267-272` renders each zone through `CONTROL_RENDERERS`. The file already reserves the classroom slot in its own comment: *"Teacher classroom controls: no key yet — the slot is the `isTeacher` parameter itself, so the classroom plans add their control as a one-line matrix change, not an API change."* Any classroom control added to the IDE header goes through that function and gets a renderer, and must be handled by the stage-2 overflow menu (`Toolbar.js:364-381`). The classroom plans' "edit Toolbar.js" idiom is dead.

### C18 — New panes identify by `--cat-*`, not a fresh hue

A pane header takes a 2px top border in a category token (`workspace.css:65-67`). The instructions side panel promised by spec §6.2 is a new pane and must pick one — **`--cat-communicate` (#877106)** is the semantically right choice from the 26 available (`tokens.css:316-367`). Never string-concatenate a slug; resolve through `cssVarFor(name)` (`blockPalette.js:276-278`). Related: spec §15.4's "coloured initials instead of photos" now sits upstream of a palette it predates — those initials must draw from `--cat-*`, not a fresh ad-hoc set. `--cat-*-bright` is decorative only (asserted at `blockPalette.test.js:52-58`).

---

## 2. Per-surface work list, ordered by impact

Impact = (users affected) × (severity) × (how wrong it looks next to the modernized IDE). **QF** = quick fix; **PT** = plan task (see §4).

### Tier 0 — Cross-cutting, breaks usability on the target hardware

**0.1 — Control sizing across the whole platform (PT).** `frontend/src/styles/primitives.css:115-121` (remove `.admin-btn`, `.account-chip-btn` from the `.btn--sm` group) + every platform component that writes `className="admin-btn"`: `ClassesHome.js:50,54`; `PeopleTab.js:80,88,184,191,232,242`; `SettingsTab.js:81,85`; `ClassChrome.js:28`; `AdminConsole.js:121,125,130,134`; `GuestImportPrompt.js:10,13`; `AccountChip.js:17-61`. Move to `.btn` at `--control-h`. `.account-chip-btn` is not a button at all — build it as a nav row and delete the `justify-content` correction at `primitives.css:135`.

**0.2 — Coarse-pointer coverage (QF, one block).** `frontend/src/styles/responsive.css:6-23` — add the platform's interactive classes to the existing `@media (pointer: coarse)` block: `.btn` on platform routes, `.admin-tab`/`.tab`, `.auth-input`/`.input`, `.auth-door`, `.class-card`, `.admin-table td .btn`. Without this, 0.1's fix still leaves table-row actions under-sized on a tablet.

**0.3 — Delete the focus-ring override (QF, one line).** `frontend/src/styles/platform.css:44`. Delete `.auth-input:focus { outline: 1px solid var(--border-focus); }` entirely; the zero-specificity ring at `tokens.css:294-312` takes over immediately. Verify against the e2e ring assertions.

### Tier 1 — Systemic: the metric layer and the shared chrome

**1.1 — Tokenise `platform.css` end to end (QF, mechanical; 36 + 47 + 13 sites).** Apply C1's table across `frontend/src/styles/platform.css`. This forces the four off-scale survivors (15/17/18/22px at `:162, :216, :108, :152, :255`) to resolve — `tokens.css:20-31` names those exact values as one-offs the scale replaced. Two items park for a decision (welcome section rhythm; hero tracking) per C1.

**1.2 — Extract one page shell and one platform header (PT).** Collapse `.classes-page/.classes-header/.classes-body` (`platform.css:146-153`) into `.admin-*`'s equivalents as a single `.page` shell in `primitives.css`; make the header flex-laid-out per C11 (`ClassChrome.js:47-51`, `AdminConsole.js`, `ClassesHome.js`); add the theme toggle and the account control to its right cluster. Renames touch `ClassChrome.js:55-65`, `ClassesHome.js`, `AdminConsole.js:24-35`, `ProfilePage.js`.

**1.3 — Build the four missing primitives (PT).** Per C12, into `frontend/src/styles/primitives.css`: `.input`, `.alert` (4 variants), `.badge`, `.empty` (promote `.start-empty` from `pages.css:243-251`). Then retire `.auth-input`, `.auth-error`, `.account-chip-badge`, `.class-archived-badge` and the bare `auth-text--dim` empty states.

**1.4 — Tabs, with ARIA and a hover state (PT).** `frontend/src/components/classes/ClassChrome.js:55-65` (link tabs → `aria-current="page"`) and `frontend/src/components/admin/AdminConsole.js:24-35, :37-40` (button tabs → full `tablist`/`tab`/`tabpanel`). `platform.css:110-119` — `.admin-tab` has **no `:hover` rule at all**; add `--bg-hover`, and tie the 2px active underline to a token.

### Tier 2 — Per-surface defects with visible or functional consequences

**2.1 — Classes wall empty state renders in one 220px column (QF).** `ClassesHome.js:96-102` puts a bare `<p>` inside `.classes-wall`, which is `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` (`platform.css:156`). Move it outside the grid or give it `grid-column: 1 / -1`, and switch it to the `.empty` primitive from 1.3.

**2.2 — Destructive actions get `.btn--danger` (QF).** `PeopleTab.js:80,88` (Deny, Remove), `:191` (Revoke), `SettingsTab.js:81,85` (Archive), `AdminConsole.js:121` (Deactivate). Currently all neutral 22px buttons; `.btn--danger` (`primitives.css:104-113`) is unused product-wide.

**2.3 — Semantic status colour (QF).** `AdminConsole.js:243-244` — health `running`/`trouble` and DB status in `--success`/`--danger` with a glyph, not grey. `SettingsTab.js:78` — split the shared `msg` state so a save failure is `--danger` with `role="alert"` and a save success is `--success` with `role="status"`; today both render through `auth-text--dim`. `platform.css:143` `.admin-health` is a bare `<ul>` with no card/stat treatment — wrap it in `.card`.

**2.4 — Table header uses the micro-label system (QF).** `platform.css:124-130` — replace the hand-rolled `--text-muted` + `font-weight: 500` with `--label-fs`/`--label-weight`/`--label-transform`/`--label-tracking`/`--label-color`. Also derive `.admin-table td` row height (`:131`) from a control metric so rows and the buttons inside them share a rhythm.

**2.5 — `ACCOUNT` caps out of the DOM (QF, two lines).** `frontend/src/components/auth/AccountChip.js:16` and `:29` → sentence case in markup; `platform.css:87-91` `.account-chip-head` → `--label-fs` / `--label-color`.

**2.6 — Keyboard-reachable mail rows (QF).** `AdminConsole.js:170` — add `tabIndex={0}`, `role="button"`, `onKeyDown` (Enter/Space), `aria-expanded`. Also `platform.css:135-142` — `.admin-mail-body` is a `<pre>` (`AdminConsole.js:178`) with no `font-family`, so the pretend inbox renders in browser-default monospace instead of JetBrains Mono; add `var(--mono)`.

**2.7 — Join code: one typography for entry and display (QF/PT).** `platform.css:177-185` `.join-code-big` writes `28px` and `6px` literally (→ `--fs-3xl`, `--radius`) and needs the `--tracking-code` token from C1. `JoinClassPage.js:75-81` enters the same value in a proportional 14px Inter input — it should be `--mono` with the same tracking, uppercase-transformed in CSS.

**2.8 — QR is the one un-themed element (PT).** `platform.css:186` `#fff` + `PeopleTab.js:220` `QRCode.toCanvas` defaults. Give the canvas explicit light/dark colours from tokens, or keep the white backing but add `--card-border` and `--radius` and justify it (a projected QR *should* be high-contrast white — that is defensible; the missing border and the hardcoded hex are not).

**2.9 — Status announcements (QF, ~7 sites).** Per C13.3: `GuestImportPrompt.js:6`, `SyncChip.js:47-49`, `PeopleTab.js:236-241`, `ProfilePage.js:89`, `SettingsTab.js:78`, `JoinClassPage.js:60-64` (plus its unannounced 900ms redirect at `:23`), `InviteLandingPage.js:65-67`.

**2.10 — Sync chip (QF).** `platform.css:188` — literal `11px`/`14px`; no `.sync-chip--idle` rule even though `idle` is the initial state (`SyncChip.js:17`), so the default render silently falls through to `--text-dim`. Add the idle variant, add an icon or word so colour is not the sole channel, adopt the `.tb-chip` shape (`chrome.css:247-264`).

**2.11 — Guest-import toast (QF).** `platform.css:195-211` — six literals (`12px`, `10px`, `6px`, `10px 14px`, `13px`, `z-index: 4000`) → tokens + C16's scale; `GuestImportPrompt.js:10,13` off the `admin-btn` namespace.

**2.12 — The `.auth-door` segmented control is overloaded (PT).** Built for two short labels on signup (`SignUpPage.js:55-62`), reused at `SettingsTab.js:61-77` for a three-option join-mode picker carrying sentences like *"Open — anyone with the code joins instantly"* in a `flex: 1` row with `font-size: 13px` and no wrap allowance. It also has an ARIA hole: `role="radiogroup"` on the wrapper with nothing carrying `role="radio"`/`aria-checked`. Build one real segmented/radio-card primitive, or split into two controls. Same file: `SettingsTab.js:67-72` fires the PATCH on selection with no pending/disabled state on the group (`patch.isPending` is only wired to the Save button at `:56`).

**2.13 — Welcome page (PT).** `platform.css:213-280`: `17px`→`--fs-xl`, `22px`→`--fs-2xl`, `44px`→`--fs-hero`, `8px`→`--radius`, `1.55`→`--lh-normal`, `0.5s`→`--transition-slow`, the 56/64/72 rhythm decision, the `0.5px` tracking. Then two structural items: the welcome page is **absent from `platform.css:296-304`'s only responsive block**, so the 44px hero, the 260px canvas and the `minmax(260px, 1fr)` grid have no small-screen handling; and `GravityPlayground.js:123-131`'s raw `<input type="range">` needs a themed treatment (C12).

**2.14 — Fold `WelcomeIcons.js` into `Icons.js` (PT).** Delete `frontend/src/welcome/WelcomeIcons.js`; move `OrbitIcon`/`ChartIcon`/`LocalFirstIcon`/`ClassroomIcon`/`PrivacyIcon` into `frontend/src/components/Icons.js` in the house idiom (`size` prop, `strokeWidth 2` unless a per-icon exception is justified as `AtomIcon` is at `Icons.js:48`), and resolve the **duplicate `BlocksIcon`** (`WelcomeIcons.js:32` vs `Icons.js:27`) to one geometry. Update `WelcomePage.js` imports; `platform.css:250` `.welcome-card__icon svg { width: 28px; height: 28px }` becomes a `size` prop.

**2.15 — Give the platform icons (PT).** Highest-value insertions from `Icons.js`: `SearchIcon` (`Icons.js:128`) + clear button on the admin user search (`AdminConsole.js:91-96`) — the IDE's equivalent `.help-search-box` (`pages.css:349-392`) already has icon, clear and `:focus-within`; `CheckIcon` (`Icons.js:148`) on the "Copied!" confirmation (`PeopleTab.js:236-241`); status glyphs on health and sync; role/state glyphs on badges.

**2.16 — Inline spacing out of JSX (QF, six sites).** `ProfilePage.js:64` (`marginTop: 18`), `:89`, `:90` (`marginTop: 12` twice), `PeopleTab.js:230` (`marginTop: 8`), `:251` (`marginTop: 6`), `SettingsTab.js:61` (`maxWidth: 520` — which sits beside `.classes-newform`'s CSS `max-width: 420px` on the same screen, `platform.css:155`). Three values (18, 6, 520) have no ramp equivalent.

**2.17 — Section headings stop borrowing the auth H1 (QF).** `PeopleTab.js:71,104,147,173` and `SettingsTab.js:60,79` use `<h2 className="auth-title">`; `.auth-title` (`platform.css:23-27`) is the auth page's H1 at 20px with `margin: 14px 0 18px`. There is no H2 step between `--fs-xl` (16px) and `--fs-2xl` (20px) — either use `--fs-xl` + `--fw-semibold` for section H2s, or use `.panel-header__title` (`primitives.css:203-210`), which is exactly that.

**2.18 — Profile account status becomes badges (QF).** `ProfilePage.js:47-50` renders "site admin · teacher · email not yet confirmed" as an interpolated `<p className="auth-text">` with `·` separators, while `.account-chip-badge` already exists for the unconfirmed state elsewhere. Use 1.3's `.badge`.

---

## 3. Exact spec-document edits

### 3.1 `docs/classroom-platform.md` (rev 2, 474 lines, untouched since 18 Aug 17:06)

**Numbering recommendation:** do **not** renumber. Every cross-reference in the file points at §5.5, §8, §11, §13, §14 by number. Append the new design section as **`## 18. The design contract`** after §17, and add forward pointers from §1 and §14. Mark the file **rev 3** with a dated amendment line at the top, per the file's own change-protocol culture.

| # | Location | Status | What it should say instead |
|---|---|---|---|
| **S1** | **§3.1, line 75** — *"The front page offers three doors: **Try the IDE** (guest, no account), **I'm a student**, and **I'm a teacher**."* | **Stale** | What shipped is `/welcome` with three CTAs — *Use the IDE — no account needed* / *Create an account* / *Sign in* — and the student/teacher choice moved **inside** the signup form (`.auth-doors`/`.auth-door`, `SignUpPage.js:55-62`). Rewrite: *"The front page (`/welcome`) offers three doors: **Use the IDE** (guest, no account), **Create an account**, and **Sign in**. The student-or-teacher choice is made inside the signup form, not at the door."* |
| **S2** | **§14, line 371 preamble + line 377** | **Provably incomplete by its own rule** (*"if a screen is not on this list, it does not exist"*) | Add the welcome page as a real row: `| Front page (/welcome) | Guest entry · sign in · sign up · what the IDE is |`. Add the missing invite-landing row (`/join/invite`, `InviteLandingPage.js`). Amend the *IDE workspace* row (line 379) to name the theme toggle. Add one sentence to the preamble: *"Every screen on this list is built from the shared design system in §18 — tokens, the three primitives, and the one icon module. A screen that invents its own metrics is not finished."* Plan 4 Task 10 itself says *"Spec §14's screen list gains this screen by that directive"* — the amendment was never made. |
| **S3** | **§5.4, lines 158-166 and line 180** | **Under-specified against the shipped header — will produce wrong code** | Line 180's *"Switched-off tools disappear from the workspace entirely"* was written against a fixed toolbar. Rewrite the enforcement paragraph to name the mechanism: *"A switched-off tool is removed from `visibleControls()`'s key list for that assignment — never CSS-hidden, never disabled-in-place — and must also be handled by the stage-2 overflow menu, so a rule cannot be dodged by narrowing the window."* Then re-point three of the six named surfaces at their current identities: **Debug mode** is now a docked debug drawer plus a toolbar debug group (breakpoint validity, watch expressions, setup constants); **Export & copy … screenshots** is now the viewport camera cluster's pixel capture; **Templates / Advanced blocks** sit in the single toolbox + Advanced drawer. Add: *the zoom slider named nowhere in this spec no longer exists — the on-canvas cluster owns zoom.* |
| **S4** | **§5.4, line 183** — *"Students always see a small note in the workspace listing what their teacher has switched off"* | **Missing surface spec** | This note is an unbuilt screen element with no home. Specify it: which chrome slot it occupies, that it is a `.tb-chip`-shaped readout with `aria-live="polite"` and a `title` carrying the untruncated string, and that it is **load-bearing** — so per the 1024px rule (`Toolbar.js:129-140`, `chrome.css:266-276`) it must **shorten at stage 2, not disappear**, exactly as the pause readout does. |
| **S5** | **§6.2, line 205** — the instructions side panel | **Missing design guidance** | Add: it is a pane, so it takes `.pane-header` with a 2px `--cat-*` accent strip (`workspace.css:65-67`); recommend `--cat-communicate`. Popped-out state uses the glass/overlay tokens (`tokens.css:145-153`). It must respect C10 — the panel is load-bearing inside an assignment and cannot vanish at 1024px. |
| **S6** | **§6.3, line ~211** — the sync-chip copy | **Copy correct, home stale, a11y missing** | The verbatim strings survive and are still right. Add: the chip lives in `frontend/src/components/layout/SaveState.js`, **not** the old status-bar row Plan 4 Task 8 described; it carries `role="status"` + `aria-live="polite"`; and its state must be legible without colour. |
| **S7** | **§7.2, lines 240-247** — *"the same blocks, code, 3D viewport, data panel and debug tools the student had … exactly as the student built it"* | **Needs a caveat it does not carry** | Theme is per-viewer: a marker sees the submission in **their** theme (`ThemeContext.js:24`, `physics-light`/`physics-dark` for both Blockly and Monaco), not the student's. Block colours come from the v2 26-category palette, so any archived screenshot of a pre-modernization submission will not match a re-render. State both, and state which is authoritative for a dispute. |
| **S8** | **§9, lines 288-310** — emails and the pretend inbox | **Missing** | The pretend-inbox body is program output and must render in `--mono` (`AdminConsole.js:178` currently does not). The in-app bell is an unbuilt surface — specify it as a dropdown using the one `DropdownMenu` implementation (`components/common/DropdownMenu.js`), not a new popover. |
| **S9** | **§10, lines 311-322** — the admin corner | **Missing** | Health must use `--success`/`--warning`/`--danger` with a non-colour channel; the console's five panels are a tab bar and take the ARIA tablist pattern; the cap panel's numeric input is the `.input` primitive. |
| **S10** | **§13, line 361** — *"Phone apps — the website works on phones for reading, joining, and checking marks; building work is a laptop activity."* | **Stale framing** | Restate against what shipped: *"**1024px is the stated minimum viewport for building work.** Below it there is no support obligation. Coarse-pointer targets and the two-stage header collapse mean the IDE does not break on a tablet, but no gestures and no touch-specific UI are provided. Reading, joining and checking marks work on a phone; there is still no phone app."* |
| **S11** | **§15.4, line 425** — *"No profile photos — coloured initials instead."* | **Not contradicted, but under-specified** | Add: those initials draw their colour from the `--cat-*` ramp (`tokens.css:314-368`) resolved through `cssVarFor()`, never from a fresh ad-hoc set, and the label uses `--on-accent` white with the palette's AA guarantee against white already tested at `blockPalette.test.js:34-41`. |
| **S12** | **New `## 18. The design contract`** | **Missing entirely** | ~1 page carrying C1–C18 above in prose, plus the pointer *"the implementation lives in `frontend/src/styles/tokens.css`, `primitives.css` and `frontend/src/components/Icons.js`; those three files are the ground truth and this section is their contract."* Cross-link from §1 (one line: *"how it must look is §18"*) and from §12 (a seventh leanness rule: *"7. **One design system.** Every screen is assembled from the same tokens and primitives — new visual vocabulary is a decision, not a side effect."*). |

### 3.2 `docs/classroom-platform-stack.md`

| # | Location | Status | What it should say |
|---|---|---|---|
| **T1** | **§2, line 30** — *"The IDE core … moves into `frontend/` essentially untouched. Nothing about the simulation experience is rebuilt."* | **Flatly wrong** | Four modernization tranches rebuilt exactly that: a design-token layer, three primitives, the adaptive zoned header, the on-canvas zoom cluster, the idle-atom boot loader, the 26-category Blockly palette with `physics-light`/`physics-dark` Zelos themes, matching Monaco themes, and a docked debug drawer. Replace with: *"The IDE core moved into `frontend/` and was then **modernized in place** (Aug 20–21 2026): design tokens, shared primitives, an adaptive header, and a light/dark theme pair now apply to the IDE and the portal alike. The simulation **engine** is unchanged — GlowScript, Arquero, Observable Plot — but the IDE is no longer a black box the portal merely wraps: they share one visual system."* |
| **T2** | **§2, line 32** — *"(the app today is single-screen and has no router)"* | **Stale** | React Router landed in Plan 2 Task 8; `frontend/src/App.js:48-67` routes `/welcome`, `/auth/*`, `/profile`, `/admin`, `/classes/*`, `/join/*` today. |
| **T3** | **§2 — new bullet** | **Missing** | *"**The design system is a shared dependency.** `frontend/src/styles/tokens.css` (tokens + the one focus rule + the generated `--cat-*` block), `primitives.css` (`.btn`/`.card`/`.panel-header`) and `components/Icons.js` are consumed by both halves. `frontend/src/styles.css` is a manifest whose **import order is load-bearing**: shared primitives go in `primitives.css`, portal-screen rules go in `platform.css`, which loads after it."* |
| **T4** | **§3, the workspace-rules paragraph** | **Add the frontend half's mechanism** | The honest caveat about copy-to-clipboard stays; add that the frontend half is a change to `visibleControls()`'s returned key lists, not CSS or `disabled`. |
| **T5** | **§5, line ~99** — Playwright golden flows | **Extend** | Add design-system regressions to the promised suite: the theme attribute actually flips and the product starts dark (the IDE equivalents live at `frontend/scripts/e2e-test.mjs:671, :1483`); a `prefers-reduced-motion` guard exists in shipped CSS (`e2e-test.mjs:1788-1797`); no platform rule redefines the focus ring; no literal `px` metric in `platform.css`. Note that `docs/e2e-checklist.md` (18 suites, A1–A18) covers **only** the IDE — the string "welcome" does not appear in it, and auth/classes/admin have zero coverage in either place. |

### 3.3 `docs/product-contract.md` — the load-bearing gap

The contract's **Change protocol** (lines 131-140) says *"Land the change in code only after the contract reflects it."* The **Locked decisions** table (lines 21-41) records **no** decision for the design-token layer, the light/dark pair, the adaptive header, the docked debug drawer, or the no-emoji/inline-SVG icon standard — all of which shipped. That is a live protocol violation, and it is why the classroom specs are "mostly not contradicted": they are silent, not aligned.

**Add five rows to Locked decisions:**

| Decision | Choice | Rationale |
|---|---|---|
| Design tokens | **`frontend/src/styles/tokens.css` is the single source of every metric and colour** | 4px space ramp, 9-step type scale, 3 radii, 3 durations, 3 control heights, one micro-label system. Replaced 16 ad-hoc px values across 216 declarations. No literal metric in any new rule. |
| Theme model | **`data-theme` attribute on `<html>`, dark default, light as one override block** | No `prefers-color-scheme` path exists anywhere in app CSS and none may be added. Derived role tokens declared once in the dark block, re-resolving by `var()`. |
| Component primitives | **`.btn` / `.card` / `.panel-header` in `primitives.css`** | Legacy class names are comma-appended aliases; they are migration debt, not API. New surfaces use the canonical class. |
| Icon idiom | **One module, `frontend/src/components/Icons.js`** | Feather-style 24-grid line art, `stroke="currentColor"`, `strokeWidth 2`, `size` prop. **No emoji in product UI** (standing owner rule, 2026-08-19). No second icon module. |
| Minimum viewport | **1024px** | Header collapse stages chosen so stage 2 is active *at* the floor. Nothing load-bearing may be hidden at stage 2. Coarse-pointer targets ≥32px. No support obligation below 1024px. |

**Add to Quality bar (v1.0 ship gate), lines 94-107:**
- No literal `px` metric in `platform.css` or in JSX `style={}` — lint-checked.
- Every block-palette `fill` and `secondary` clears 4.5:1 against white and no entry sits in hue 340°–15° — already enforced by `frontend/src/utils/blockly/__tests__/blockPalette.test.js:34-51`; state it in the contract.
- `paletteCssText()` output appears verbatim in `tokens.css` — `paletteCssSync.test.js:17-24`.
- Exactly one focus-ring rule ships; no component defines `:focus`.
- Every animation carries a reduced-motion guard.
- Zero emoji in product UI (Unicode scan over `frontend/src`).

**Amend the Classroom Platform amendment (line 121-129)** with one bullet: *"The classroom platform inherits the design contract above in full. Portal screens are not a separate visual product."*

### 3.4 The executed plan documents — banner, don't rewrite

`docs/superpowers/plans/2026-08-18-classroom-platform-0{1,2,3}-*.md` and `2026-08-19-classroom-platform-04-sync.md` are historical execution records; editing their tasks would falsify the record. Add a **stale-warning banner at the top of each**, naming what a reader must not follow:

- *"**Append to `frontend/src/styles.css`"** (plan 02 lines 2882, 3368; plan 03 line 2202; plan 04 lines 1798, 1880, 2217) is wrong — that file is now a 17-line manifest with load-bearing order.*
- *Plan 04 Task 10's `FEATURES` array (lines 2126-2133) specifies **emoji icons** 🧩 🪐 📈 💾 🏫 🕵️ — a direct violation of the standing no-emoji rule. Shipped code already fixed this via `frontend/src/welcome/WelcomeIcons.js`; the plan text would re-introduce it.*
- *Plan 04 Task 10's `WelcomeGate` code block and its four-case test still specify the **superseded v1 gate** (localStorage `WELCOME_SEEN_KEY` + a `projectCount` grandfather + an async `listProjects()`), contradicting its own header note and the shipped synchronous sessionStorage `WELCOME_PASSED_SESSION_KEY` gate.*
- *Plan 04 Task 10's CSS block is pre-token and dark-only (hardcoded `rgba(255,255,255,0.06)`, literal `44px` hero).*
- *Plan 01's **"CDN script tags must be preserved byte-for-byte"** is now impossible — Blockly 11.2.2 and Monaco 0.45.0 are bundled, GlowScript 3.2 is vendored at `frontend/public/vendor/glowscript/`, and `frontend/index.html` contains no CDN script tags.*
- *Plans 02/03/04's **"No @testing-library — screens are verified by the controller's browser pass"** is superseded: `frontend/src/test/renderHelpers.js` is a dependency-free component-test harness on React 18's own `act` + `createRoot`, with a `matchMedia` stub in `setupTests.js`. Portal screens can and should be component-tested.*
- *Plans 02/03's **"no edits under `frontend/src/components` except the named ones"** is no longer a usable boundary: header controls are added through `frontend/src/utils/toolbar/visibleControls.js`, which reserves the classroom slot in code.*
- *Plan 04 Task 8's sync-chip mount instruction describes a status bar that no longer exists; the chip lives in `frontend/src/components/layout/SaveState.js`.*

### 3.5 `docs/e2e-checklist.md`

Add portal suites — the entire portal surface (welcome, auth, classes, admin, join) has **zero** end-to-end coverage in either the checklist or Playwright, and the stack doc's §5 golden-flow promise is still unbuilt (Plan 2 explicitly deferred it).

---

## 4. Plan task vs quick fix

### Quick fixes — mechanical, no design decision, safe in one pass

| Item | Files | Why it's a QF |
|---|---|---|
| Delete the focus override | `styles/platform.css:44` | One line; the zero-specificity ring takes over immediately |
| Coarse-pointer block covers platform classes | `styles/responsive.css:6-23` | Add selectors to an existing block |
| Tokenise `platform.css` | `styles/platform.css` (all 305 lines) | Table-driven from C1; the four off-scale values have a stated resolution |
| `.admin-mail-body` gets `--mono` | `styles/platform.css:135-142` | One declaration |
| `ACCOUNT` → sentence case | `components/auth/AccountChip.js:16, :29` | Two strings + one CSS rule |
| `aria-current` on class tabs | `components/classes/ClassChrome.js:56-64` | Link tabs need only the attribute |
| `.admin-tab:hover` | `styles/platform.css:110-119` | One rule using `--bg-hover` |
| `role="status"` / `role="alert"` sweep | 7 sites listed at 2.9 | Attribute additions |
| Keyboard-reachable mail row | `components/admin/AdminConsole.js:170` | `tabIndex`/`role`/`onKeyDown` |
| Semantic colour on health + save messages | `AdminConsole.js:243-244`, `SettingsTab.js:78` | Token swap + split one state variable |
| `.btn--danger` on destructive actions | 2.2's six sites | Class name change |
| Inline styles → CSS | six sites at 2.16 | Mechanical |
| Table headers use `--label-*` | `styles/platform.css:124-130` | Five declarations |
| Classes-wall empty state escapes the grid | `components/classes/ClassesHome.js:96-102` | One wrapper or `grid-column: 1 / -1` |
| Section H2s stop using `.auth-title` | 2.17's six sites | Class name change |
| Sync-chip idle variant | `styles/platform.css:188-192` | One rule |

### Plan tasks — need a decision, a new shared asset, or spec approval

Proposed **Plan 5A — Platform design alignment**, ordered so each task lands on a green tree:

1. **Write §18 and the contract rows.** `docs/classroom-platform.md` (rev 3), `docs/classroom-platform-stack.md` T1–T5, `docs/product-contract.md` five Locked-decision rows + six Quality-bar lines, plan-doc banners. *Paperwork first — the Change protocol requires it before code lands.*
2. **Two ramp/tracking decisions.** Welcome section rhythm (collapse to `--space-8` vs extend the ramp with `--space-9`); hero tracking; `--tracking-code` for the join code; the `--z-*` scale (C16). Owner-facing, small, blocks task 4.
3. **Four new primitives** into `primitives.css`: `.input`, `.alert`×4, `.badge`, `.empty` (promoting `.start-empty` out of `pages.css:243-251`), plus a range-input treatment. *New shared API — design decisions in every one.*
4. **Button-size migration + coarse-pointer coverage.** `primitives.css:115-121` and 0.1's 19 call sites. *Touches every platform screen at once; must be one reviewable commit.*
5. **One page shell + one platform header** with the theme toggle and account cluster (C11). Collapses the `.admin-*`/`.classes-*` duplication and finally makes light mode reachable off the IDE.
6. **Tabs primitive with ARIA** (C13.1) — `ClassChrome.js`, `AdminConsole.js`.
7. **Icon consolidation** — fold `WelcomeIcons.js` into `Icons.js`, resolve the duplicate `BlocksIcon`, then add icons at 2.15's high-value points.
8. **Alias retirement** — remove `.admin-btn`/`.auth-submit`/`.account-chip-btn`/`.welcome-btn`/`.auth-card`/`.class-card`/`.welcome-card`/`.classes-newform` from the comma lists in `primitives.css:6-11, 69-74, 115-128, 140-145, 163-173` and delete the correction rules at `:52-66, :135`. *Last, because it is only safe once tasks 3–7 have moved the markup.*
9. **Welcome page responsive + segmented-control rework** (2.13, 2.12).
10. **Enforcement** — a token lint (no literal metric in `platform.css`, no `:focus` override, no emoji) wired into `check:*`, plus the portal e2e suites for `docs/e2e-checklist.md` and the stack doc's §5 golden flows.

### Explicitly *not* in this delta

- **Any colour change.** The colour layer is correct and fully adopted; touching it risks the AA and palette-sync tests for no gain.
- **The block palette.** Governed, tested, mirrored into `tokens.css` by generation (`tokens.css:314`, `paletteCssSync.test.js:17-24`) — the platform should *consume* `--cat-*` (C18), never edit it.
- **`--bg-toolbar` / `--bg-sidebar` / `--font-mono` / `--error`.** Deprecated at `tokens.css:185-191`; the platform correctly uses none of them. Keep it that way.
- **§5.4's implementation.** Its spec needs rewriting (S3) *before* anyone builds workspace rules; building it against the current text would wire tool-hiding into CSS instead of `visibleControls()`, and miss the overflow menu entirely. That is the single biggest downstream risk in this delta.