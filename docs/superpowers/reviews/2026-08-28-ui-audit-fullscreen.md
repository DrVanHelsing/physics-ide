# Portal UI audit — full-screen pass

**Date** 2026-08-28 · **Branch** feature/classroom-platform · **Viewports** 1920×1080 (primary), 1366×768, 1024×768 (stated floor)

## 1. Method

A throwaway Puppeteer sweep (scratchpad, not committed) reusing `frontend/scripts/portal-e2e.mjs` idioms — two browser contexts, native-setter input, `clickByText`, the `.page-header__bar .tb-btn--theme` toggle — signed in as the seeded admin, built a class + published assignment + guide through the API, drove a student through signup → confirm → join → Start work → Submit through the UI, then captured **75 screenshots** across every portal surface in **both themes** at 1920, with 1366/1024 spot-checks on the width-hungry screens. Each capture also recorded, from inside the page: `.page-body` geometry vs viewport, document scroll width, every `<table>` and its wrapper's scroll/client widths, and every anchor/button that navigates to a parent path or reads as "back". Screenshots and `ui-audit-metrics.json` are in the session scratchpad (`.../scratchpad/shots/`). F3 was verified from the vendored Blockly 11.2.2 source rather than by dispatching wheel events. Zero JS console errors across the whole run.

---

## 2. The three user findings — verified and bounded

### F1 — portal content pinned upper-left at full screen · **CONFIRMED, worse than described**

`frontend/src/styles/platform.css:169-173`:

```css
.page-body {
  display: flex; flex-direction: column; gap: var(--space-4);
  max-width: 1000px;
  padding: var(--space-5) var(--space-6);
}
```

No `margin-inline: auto`. The box starts at `x=0` and ends at `x=1000` on every screen that uses it.

| Viewport | `.page-body` | left gutter | **dead space right** | share of viewport wasted |
|---|---|---|---|---|
| 1920×1080 | 0 → 1000 | 0 | **920 px** | **47.9 %** |
| 1366×768 | 0 → 1000 | 0 | 366 px | 26.8 % |
| 1024×768 | 0 → 1000 | 0 | 24 px | 2.3 % |

Identical in both themes (measured on all 30 dark/light pairs). **Affected: every portal screen except the marking room.**

- Teacher: `/classes` (incl. the New-class form state), `/classes/:id`, `/guides`, `/gradebook`, `/people`, `/settings`, `/assignments/new`, `/assignments/:aid`, `/assignments/:aid/edit`, `/assignments/:aid/inbox`, `/guides/new`, `/guides/:gid`, `/admin` × 4 tabs.
- Student: `/classes`, `/classes/:id`, `/assignments/:aid`, `/guides`.
- **Not affected:** the marking room, which already opts out via `.marking-room__body { max-width: none }` (`assignments.css:325-327`) — the fix precedent already exists in the codebase. `/profile`, `/join`, `/join/invite` and `/auth/*` use `AuthLayout`'s centred `.auth-panel` instead and are correctly centred.

The waste is not merely cosmetic; it deforms real screens:

- **Gradebook** (`t-class-gradebook-*-1920.png`) — the one screen that grows a column per assignment is capped at 952 px of content with 920 px empty beside it. At eight assignments the columns crush while half the screen sits unused.
- **Class Settings** (`t-class-settings-dark-1920.png`) — the three joining-rule options wrap to 3, 3 and 2 lines inside 167 px boxes with 920 px of free space to their right.
- **Admin People** (`t-admin-people-*-1920.png`) — Name/Email/Kind/Status/Actions squeezed into 952 px; the Actions column collides with Status.

Contrast: the public `/welcome` page (`pub-welcome-dark-1920.png`) is a full-bleed hero with a live simulation. One click later the signed-in product collapses to a left-pinned half-width column. That contrast is the finding.

### F2 — no back affordance on drill-down pages · **CONFIRMED**

There is **no back-link component, CSS class or shared affordance anywhere in `frontend/src`** — `back-link|breadcrumb|page-header__back|goBack|navigate(-1)` returns zero matches. Every "back" is an ad-hoc inline `<Link className="btn">`, and most exist only inside error branches that never render on the happy path.

`PortalHeader` emits exactly one structural link — the `PhysicsIDE` wordmark (`home`, default `"/"`). It reads as a logo, not an up-control, and `"/"` is **the IDE, not the class list**.

Stranded on the happy path, in severity order:

| Screen | Route | What exists |
|---|---|---|
| **Profile & settings** | `/profile` | **Nothing.** `AuthLayout` puts only a theme toggle in the header — no wordmark link, no account menu, no footer link. There is no in-app way back. (`t-profile-dark-1920.png`) |
| **Marking room** | `/classes/:id/assignments/:aid/marking/:studentId` | **Zero `<Link>` in the whole file.** The only escape is the wordmark, silently retargeted to the assignment page via `home={/classes/${id}/assignments/${aid}}` — the one deep `home` in the app. No route back to the inbox you arrived from. (`t-marking-room-dark-1920.png`) |
| **Admin console** | `/admin` (all 4 tabs) | Wordmark → `/` (the IDE). No path back to `/classes`. |
| **Guide (read)** | `/classes/:id/guides/:gid` | No tab row (bypasses `ClassChrome`), no back link. Edit / Publish / Delete only. (`t-guide-read-dark-1920.png`) |
| **Assignment page** | `/classes/:id/assignments/:aid` | Only the `ClassChrome` tab row — and the *current* tab (Assignments, `aria-current="page"`) is the thing that goes *up*. Nothing says so. |
| Guides / Gradebook / People / Settings tabs | `/classes/:id/*` | Tab row only; no link back to `/classes`. |
| `/classes` | — | Wordmark ejects to the IDE, not a portal destination. |

Assignment editor and Guide editor have a `Cancel` — but at the *bottom* of a long form. **`InboxPage` is the only screen that gets it right**: a persistent `Back to assignment` link above the fold (`InboxPage.js:201`) — though it is styled `auth-text auth-text--dim`, so it reads as a caption. The only portal-wide up-navigation is a `My classes` item buried two interactions deep in the account dropdown (`HeaderAccount.js:34`).

### F3 — Blockly wheel zooms instead of scrolls · **CONFIRMED, with the exact fix**

Verified against the vendored **Blockly 11.2.2** source (recovered from `node_modules/blockly/blockly_compressed.js.map`'s `sourcesContent`, cross-checked against the minified bundle, and confirmed by running the real parser).

`BlocklyWorkspace.js:394-412` (editable) and `:704-713` (read-only viewer) both pass `scrollbars: true` + `zoom: { wheel: true }` and **no `move` key**. `core/options.ts:238-240`:

```ts
if (!moveOptions.scrollbars || move['wheel'] === undefined) {
  moveOptions.wheel = typeof moveOptions.scrollbars === 'object';   // ← false for a boolean
} else { moveOptions.wheel = !!move['wheel']; }
```

`scrollbars: true` is a *boolean*, so `typeof … === 'object'` is false → **`move.wheel = false`**. Then `core/workspace_svg.ts:1555`:

```ts
if (canWheelZoom && (e.ctrlKey || commandKey || !canWheelMove)) { /* zoom */ } else { /* scroll */ }
```

With `canWheelMove === false`, `!canWheelMove` makes the predicate unconditionally true: **every wheel event zooms and the scroll branch is dead code.** Ctrl+wheel is identical to plain wheel.

**Fix** — state `move` explicitly in both inject calls:

```js
move: { scrollbars: true, drag: true, wheel: true },
zoom: { controls: false, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.35, scaleSpeed: 1.1 },
```

Verified resolution: `move = {scrollbars:true, wheel:true, drag:true}`, `zoom.wheel = true`, `zoom.pinch = true`. Result: plain wheel pans both axes (native `deltaX`, with a shift+wheel fallback when `deltaX` is 0), Ctrl+wheel (Cmd on Mac) zooms, canvas-drag still pans. **Do not pass `pinch` explicitly** — `options.ts:296-300` defaults it to `zoomOptions.wheel || zoomOptions.controls`, so it is already `true`, and it is touch-only (`gesture.ts:385`), unaffected by the wheel handler. Note also: `move.wheel` is silently discarded unless scrollbars are truthy, so `scrollbars`/`move.scrollbars` must stay.

---

## 3. New findings

### Blocker

**N1 — a student who opens `/classes/:id/gradebook` gets the teacher's screen.**
`s-marks-dark-1920.png`, `s-marks-light-1920.png` · student · both themes · 1920
`GradebookTab.js` has **no role gate**. It renders the staff shell — an `Export CSV` button and a bare `Student` table header — with no error, no refusal, no redirect. The backend correctly 403s (`assignments.ts:1605-1607`, "Teachers and assistants only."), but React Query's retries keep `isLoading` true, so even the `q.error` alert never paints. The component's own docstring asserts *"Students never reach this route at all (backend staff gate)"* — that is false; only the *tab row* hides it. `InboxPage` already implements the correct non-staff gate.
**Fix:** give `GradebookTab` the gate `InboxPage` has — refuse in the UI with the class-scoped role message, no staff controls rendered.

**N2 — `/profile` is a navigational dead end.**
`t-profile-dark-1920.png`, `s-profile-dark-1920.png` · both roles · both themes · 1920
`AuthLayout` renders a lone theme-toggle sun icon floating at the top-right of an otherwise empty 1920×1080 header, and a 420 px card centred in the void. No wordmark link, no account control, no footer link. A user who reaches Profile & settings from the account menu cannot get back without the browser's back button.
**Fix:** `AuthLayout` should accept and render the account control and a back link; `ProfilePage` passes one to `/classes`.

### Wrong

**N3 — the assignment editor's Instructions field has no visible input surface.**
`t-assignment-editor-new-dark-1920.png`, `t-assignment-editor-edit-light-1920.png` · both themes · all viewports
Every other field in the form is a bordered, filled input. The single most important field — the brief students read — renders as a row of toolbar chips followed by bare page background. In light mode it is starker still: white bordered boxes everywhere, and the instructions area is unpainted page. Empty, there is nothing to click; filled, the text reads as static copy.
**Fix:** give `.rich-text-editor .ProseMirror` the `.input` border / background / `min-height` treatment.

**N4 — danger red is spent on non-destructive actions, at scale.**
`t-marking-room-dark-1920.png`, `t-assignment-editor-edit-light-1920.png`, `t-class-settings-dark-1920.png`, `t-admin-people-dark-1920.png`, `t-class-people-dark-1920.png` · both themes · 1920
`Return for changes` (a normal pedagogical act) is red. `Close now` (reversible scheduling) is red. `Archive this class (read-only for everyone)` is a **952 px full-width red bar** — the loudest element on Settings, danger-by-area. Admin People shows a column of **11 red `Deactivate` buttons**, one per row, including the acting admin's own row; class People shows red `Remove` on every roster row including the teacher's own. Red stops carrying information.
**Fix:** reserve `--danger` for the confirm step, not the entry point; demote `Return for changes`, `Close now`, `Archive`; and never render a destructive control on the acting user's own row.

**N5 — `.admin-table-wrap` is applied to only 4 of 8 `.admin-table` instances.**
`t-inbox-dark-1024.png`, `t-class-people-dark-1920.png` · both themes · worst at 1024
Wrapped: `AdminConsole.js:152/212/267`, `GradebookTab.js:70`. **Unwrapped: `InboxPage.js:276`, `PeopleTab.js:73`, `:107`, `:179`.** Measured, the unwrapped tables' scroll parent is `.page-body` itself (`wrapW=1000, scrollW=1000, clientW=1000`) — they cannot scroll, so a wide roster overflows the page. `GradebookTab`'s docstring states the invariant explicitly: *"the page itself must never gain a horizontal scrollbar."*
**Fix:** wrap the four stragglers.

**N6 — dates are raw `toLocaleString()` output.**
`t-home-dark-1920.png` ("due 9/4/2026"), `t-inbox-dark-1920.png` ("8/28/2026, 5:31:41 PM"), `s-assignment-dark-1920.png` ("due 9/4/2026, 5:31:15 PM") · both themes · all viewports
Month/day order is ambiguous — for a UK physics classroom, `9/4/2026` reads as 9 April to the teacher and means 4 September to the code — and second-precision on a due date is noise.
**Fix:** one shared formatter (`Due Fri 4 Sep, 17:31`) used by the Home strip, the assignment row, the assignment page and the inbox.

**N7 — the student's assignment page offers two identical primary buttons.**
`s-assignment-dark-1920.png` · both themes · 1920
`Continue` and `Submit` are the same blue, the same size, side by side. The irreversible one (consumes an attempt) has no distinct weight and no confirmation cue.
**Fix:** one primary. `Submit` primary, `Continue` secondary.

**N8 — `Release all` is the loudest control on an unmarked inbox.**
`t-inbox-dark-1920.png` · both themes · 1920
The bulk action that publishes marks to every student is the only primary-styled button on the screen and is enabled before anything has been marked, while the safe per-student path is a plain table link. `Remind` sits beside it looking disabled.
**Fix:** demote `Release all` to secondary until at least one mark exists.

### Rough

**N9 — the assignment editor is a 918 px single-column stack.** (`t-assignment-editor-new-dark-1920.png`) `Points` — a three-digit number — spans the full column, as do three stacked datetime inputs. Ten fields become 1000 px of scroll at 1920. Wants a 2–3 column grid once F1 gives it the room.

**N10 — Class Settings has a ragged right edge.** (`t-class-settings-dark-1920.png`) Three different content widths stacked left-aligned: a 420 px name card, a 952 px radio row, a 952 px archive bar. Pick one measure.

**N11 — the People tab's QR code is an unframed white square.** (`t-class-people-dark-1920.png`) 145 px of pure white in dark mode, top-aligned but bottom-misaligned with the join-code box beside it, captionless, and with nothing beneath it while the code box carries two buttons. Frame it to match the join-code box.

**N12 — the marking room prints a 64-character SHA beside the student's name.** (`t-marking-room-dark-1920.png`) `0c370316df2bf2ea733b2c023ca3d636a84054e7e84f7ec3c2fbe57414e48f50` in the header of the most human screen in the product. The 8-char prefix is what anyone ever compares.

**N13 — the marking room's viewer is mostly empty, and History is below the fold.** (`t-marking-room-dark-1920.png`) A ~1500×740 blocks pane holds a 250×100 block stack; the marking panel ends at y≈680 and History starts at y≈1000, off-screen at 1080. Consider zoom-to-fit on load and a two-column body.

**N14 — non-links are underlined.** (`t-class-assignments-dark-1920.png`, `t-home-dark-1920.png`) On the assignment row and the Due-soon strip, `due 9/4/2026` carries the same dim underline as `1 submitted`, so a date reads as a link.

**N15 — the primary call to action is the quietest control on empty screens.** (`t-class-assignments-dark-1920.png`, `t-home-dark-1920.png`) `New assignment` and `New class` are secondary grey on otherwise-empty pages.

---

## 4. What's genuinely good

Calibration matters, so: this is a well-built portal with one structural mistake, not a rough one.

- **Theme parity is excellent.** All 30 dark/light pairs are consistent. No unstyled leaks, no hardcoded colours bleeding through, no contrast failures spotted, and the toggle reaches every portal route (the Plan 5 D9 work holds up).
- **Zero JS console errors** across 75 screen captures and a full teacher+student golden flow.
- **Zero horizontal overflow** at 1920, 1366 *and* 1024. The 1024 floor genuinely works — the `max-width: 1024px` media query drops the padding and the layout holds.
- **The welcome page is good work** — full-bleed hero, live simulation in the background, sticky nav bar. It proves full-width is within reach.
- **Gradebook semantics are careful.** `cellInfo` handles the points-null / marked-but-unscored / draft / late matrix correctly and is *shared* with the CSV export so the two surfaces cannot disagree; the CSV quotes every field unconditionally and carries a BOM for Excel.
- **The inbox is the one screen that gets navigation right**, and its filter row (All / Submitted / Late / Missing / Marked) plus `1 of 1 submitted` progress line is exactly the right summary.
- **The People tab's join flow is well thought through**: big monospace code, QR, copy-link, regenerate, and the line "Joining is open — change it in Settings" pointing at the control that governs it.
- **Focus rings are present and visible** on the admin tabs and inputs.
- Copy is plain and human throughout ("No starter pinned — students begin from a blank project", "the grid fills in once your roster does").

---

## 5. Recommended fix wave

Smallest coherent set that resolves F1–F3 plus the blockers and wrongs. Ordered — the shell changes first, because everything else sits inside them.

| # | File | Change | Covering test |
|---|---|---|---|
| 1 | `frontend/src/styles/platform.css:169-173` | Add `margin-inline: auto` and raise the cap to a token (`--page-max: 1200px`). Keep `.marking-room__body { max-width: none }`. Add `.page-body--wide { max-width: 1600px }` and apply it to gradebook, inbox, admin People/Classes/Emails. | Extend the portal-e2e sweep with a per-screen assertion `abs(rect.left - (vw - rect.right)) <= 2` at 1920. |
| 2 | `frontend/src/components/layout/PortalHeader.js` (+ `MarkingRoom.js`, `AssignmentPage.js`, `GuidePage.js`, `AdminConsole.js`, `ClassesHome.js`) | Add a `back={{ to, label }}` prop rendering a real `.page-header__back` link in the bar. Wire: marking room → inbox, assignment page → class, guide read → guides, admin → `/classes`. Give `ClassesHome` an explicit "Open the IDE" control so the wordmark stops being the only exit. | A render test per route asserting a visible link whose `href` is the parent path. Plus an e2e sweep assertion: every portal screen has ≥1 anchor to a parent path. |
| 3 | `frontend/src/components/auth/AuthLayout.js`, `ProfilePage.js` | Render the account control and an optional back link; `ProfilePage` passes `/classes`. | `ProfilePage` renders a link to `/classes`; sweep assertion covers it too. |
| 4 | `frontend/src/components/assignments/GradebookTab.js` | Add the staff gate `InboxPage` already uses — refuse in the UI, render no staff controls. Correct the docstring. | Render as an active student member: assert no `Export CSV`, no `.admin-table`, and the role message. |
| 5 | `frontend/src/components/BlocklyWorkspace.js:394`, `:704` | Add `move: { scrollbars: true, drag: true, wheel: true }`; leave `zoom.wheel: true`; do not set `pinch`. | Assert the object passed to the mocked `Blockly.inject` has `move.wheel === true && move.scrollbars === true && zoom.wheel === true` — `BlocklyWorkspace.breakpointMenu.test.js` already mocks `inject`. |
| 6 | `frontend/src/styles/` (rich-text editor rules) | Give `.rich-text-editor .ProseMirror` the `.input` border, background and `min-height`. | Sweep assertion: the editor host's computed `border-style` is not `none` and its background differs from `--bg-base`. |
| 7 | `MarkingRoom.js`, `AssignmentEditorPage.js`, `SettingsTab.js`, `AdminConsole.js`, `PeopleTab.js` | Demote `Return for changes`, `Close now`, `Archive this class` off `--danger`; shrink `Archive` from full-width; suppress `Deactivate`/`Remove` on the acting user's own row. | Assert `.btn--danger` count ≤ 1 per screen, and that the row whose email matches the session user renders no destructive control. |
| 8 | `InboxPage.js:276`, `PeopleTab.js:73/107/179` | Wrap each `.admin-table` in `.admin-table-wrap`. | DOM assertion across the sweep: every `.admin-table` has an `.admin-table-wrap` ancestor. |
| 9 | new `frontend/src/utils/formatDate.js` + Home strip, assignment row, assignment page, inbox | One formatter — `Fri 4 Sep, 17:31`, no seconds, unambiguous month. | Unit test on the formatter; e2e assertion that no rendered text matches `/\d{1,2}\/\d{1,2}\/\d{4}/`. |
| 10 | `AssignmentPage.js` | `Submit` primary, `Continue` secondary. | Assert exactly one `.btn--primary` inside `.assignments-actions`. |

N9–N15 are follow-on polish; fix 1 unlocks most of them and they should be re-judged against the widened shell rather than fixed blind.
