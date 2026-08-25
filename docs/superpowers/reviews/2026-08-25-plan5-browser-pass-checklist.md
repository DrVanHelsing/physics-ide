# Plan 5 — Human browser-pass checklist (25 August 2026)

> The one pass automation cannot replace. **Both themes, every item.**
> Automated context: 594 unit/component tests green, e2e 164/164, the
> Task 13 portal sweep (33/33 — every portal route, both themes, no
> rule-less class anywhere) ran at b6de690. This checklist is the human
> judgment on top: does it *read* right, does it *feel* right.

1. **`/welcome`** — read top to bottom on a laptop. Every CTA lands where it
   says (and none bounces back to `/welcome`). Theme toggle top-right works.
   Skip link appears on first Tab.
2. **`/welcome` at 390px** — three doors reachable without scrolling, numbers
   strip 2×3, "the IDE needs a laptop" line prominent, no horizontal scroll.
3. **`/welcome` with OS "reduce motion" on** — orbit keeps its shape but stops
   spinning, sections are simply present rather than never appearing, the
   playground renders a static frame and still drops a ball on click.
4. **`/auth/signup`** — click a field with the mouse: **no ring**. Tab into
   it: 2px offset ring. Submit button is 38px, full width.
5. **`/classes` with no classes** — the empty state spans the wall, not one
   220px column.
6. **A class → People** — Deny, Remove and Revoke are outlined red, never
   filled. Copy join link announces "Copied!". The QR reads as a bordered
   card in dark mode, not a hole.
7. **A class → Settings** — save success is green and announces; force a
   failure (rename to an invalid value) and confirm it is red and announces
   as an alert.
8. **`/admin`** — arrow-key across the tab bar; Tab into the Emails table and
   open a mail row with Enter *and* with Space; the mail body renders in
   JetBrains Mono; the Health tab shows a word, a glyph and a colour.
9. **Theme persistence** — toggle the theme from `/classes`, `/admin` and
   `/auth/signin`; reload; confirm it persisted and the IDE agrees.
10. **Any portal screen at exactly 1024px** — nothing load-bearing hidden.
11. **Touch** — on a touch device or with touch emulation, every portal
    button is comfortably hittable.
12. **The IDE itself** — start menu, a physics run, a data-science project,
    debug mode. **Plan 5 changed nothing there** except the theme-toggle
    button's new `aria-label`.

## Known findings outside Plan 5 scope (recorded, not fixed)

`ux-audit.mjs` reaches the IDE again now that its welcome-gate selector is
fixed, and reports five IDE-core failures that predate this plan and sit
outside its lanes: start-wizard goal-card title (contrast reads 1.23:1 —
likely measured against the wrong background, verify by eye), goal-card
description (2.71:1), the "Create New" section label (3.08:1), the
on-canvas zoom label (2.83:1), and the viewport Run button height
(66×23px). If they look as bad as the numbers claim, they belong to an
IDE follow-up, not to the classroom lanes.
