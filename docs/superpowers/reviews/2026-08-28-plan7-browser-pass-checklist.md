# Plan 7 — Human browser-pass checklist (28 August 2026)

> The one pass automation cannot replace. **Both themes, every item.**
> Automated context: shared/backend/frontend suites green, IDE e2e green, and
> the portal golden flow (`node frontend/scripts/portal-e2e.mjs`, **57/57**)
> now covering the sharing loop end to end — the teacher's switch, the File →
> `Share…` dialog with its roster and its consequence line, the share, the
> accept, and **both** label surfaces (the status-bar chip and the start
> menu's library row). This checklist is the human judgment on top: does it
> *read* right, does it *feel* right — and it starts with the states the
> script cannot reach, because a happy path proving green says nothing about
> what a refusal looks like.

## Before you start

```
npm run db:up && npm run db:migrate && npm run seed   # Postgres, schema, seeded admin
npm run dev                                           # backend :4000 + frontend :3000
```

Sign-in: the seeded admin's credentials are in `backend/scripts/seed` (or
create a fresh teacher — signup is open). You need: one teacher account, **two
student accounts**, and **two separate browser profiles** (a normal window plus
a private window works; two tabs of one profile do not — they share storage).
Do every item in **both themes**; the theme toggle is in the header.

**How to record:** fill in the Results sheet at the bottom as you go — one row
per item, a column per theme, and a Notes cell for anything that felt wrong
even if it technically worked ("reads oddly", "slow", "had to look for the
button" are all findings). Anything broken also gets a row in the Findings
table beneath it.

**Two things not to go hunting for.**

- **The erased sharer.** When a sharer's account is deleted, every read of
  their name resolves to `Removed student` (spec §11). That is asserted by the
  backend suite (`shares.test.ts` deletes a real user row and proves the
  recipient's copy, the label and the ledger row all survive it). There is
  **no UI path** to it until admin data requests ship — do not try to
  reproduce it in the browser.
- **Revoking a share** has a route (`POST /api/shares/:id/revoke`) but no
  button yet. Item 5 drives it from the devtools console on purpose; the
  half worth your eyes is what B's page does afterwards, not the call.
  *(Annotated 29 Aug 2026: the button is Plan 8's Task 12 — the sharer's
  "Waiting on them" list with revoke, plus the teacher's class view. Until
  that ships, the item 15 console workaround stands as written.)*

## 0. The dialog's empty and refusal states — do these first

**Why first:** the script drives the happy path only. Every sentence below is
the one a student actually reads when something is *not* fine, and none of
them is exercised by any browser test.

1. **No sharing classes.** Sign in as a student who is in **no** class with
   sharing on (or turn the switch off in the one class they are in). Open a
   project of their own → File → `Share…`. The dialog must say, and say only:
   *"None of your classes has peer sharing switched on."* No roster, no Share
   button waiting to be pressed, no empty box.
2. **Empty roster.** Teacher: a class with sharing **On** and exactly one
   student in it. That student opens `Share…`: *"Nobody else is in this class
   yet."* (The sharer is never in their own picker — confirm their own name is
   absent in the two-student case too.)
3. **A server refusal, rendered.** Set up a pending share, then have the
   teacher **remove the recipient from the class** before pressing Share a
   second time from a second project. The dialog must show the server's own
   sentence in its `alert--danger` — *"They're not an active member of this
   class."* — and stay open with the choice still made, not close silently or
   show a generic failure. (Second refusal worth one press: share the **same**
   project to the **same** person twice — *"Already shared with them — it's
   waiting on their class page."*)

## 1. The Settings doors

4. **Sharing rules, read as a teacher.** Class → Settings. The two doors read
   *"Off — classmates can't share work with each other"* and *"On — classmates
   can share copies of their work; every share is recorded"*. Off is the
   default on a new class. Flip On, **reload**, and confirm the door is still
   On (it is saved, not just painted). Flip Off and back. In both themes the
   selected door must be legible as selected without relying on colour alone.

## 2. Where `Share…` must not appear

Each of these is an **absence** test: the item is gone from the File menu, not
greyed out (D§5.4 — no greyed-out temptations). Open the File menu and read it
top to bottom each time.

5. **A guest.** Sign out entirely. Open any project. No `Share…`.
6. **Locked assessment.** Teacher: an assignment with the **Locked assessment**
   rules, published. Student starts work, opens File: no `Share…` (the rules
   chip in the status bar says export & copy is off — the two must agree).
   Standard classwork behaves the same way; the golden flow asserts that one.
7. **Group work.** A pair/group assignment. Any member, inside the group's
   shared project: no `Share…`. (The server refuses it too, on the row's
   identity rather than the actor's — but the point here is that nobody is
   offered it.)
8. **Individual work.** An assignment with "marked individually" ticked: no
   `Share…` inside that work, even if its rules allow export.
9. **And where it must appear.** The same student's own ordinary project, made
   from the start menu: `Share…` is there, below the export group.

## 3. The share, the accept, and the two labels

10. **The dialog, read slowly.** With two or more sharing classes on the
    account, the Class select appears and choosing one loads that class's
    roster (and clears the person already picked). The consequence line is
    always visible, above the buttons, and reads *"Once they add it, it's
    theirs — you can't take it back."* Share is disabled until a person is
    chosen.
11. **The confirmation.** After Share: *"Shared with <name>. It will wait on
    their class page until they add it."* Escape closes the dialog and focus
    returns to the File button.
12. **What B sees.** B's class page grows a **Shared with you** section above
    the assignments, naming the title and *from <A>*. Nothing appears for A.
    Add to my projects lands B **in the IDE with the copy open** — not on the
    start menu, not on an empty project.
13. **The two label surfaces.** Status bar: `Based on work shared by <A>` — it
    sits after the rules and baton chips and is bounded to 32ch like its
    `.rules-chip` sibling, so a long name **ellipsizes** and the full sentence
    lives on the tooltip. **Judge that width by eye with a realistic name**
    (e.g. a full first and last name): if the sentence truncates so early that
    the name is unreadable at a glance, that is a finding worth a row. Start
    menu: the same sentence under the project's row in Continue, in full.
    *(Annotated 29 Aug 2026 — Batch B, `d3ac91a`: a copy accepted on one
    device now resolves its label on a **second** device the moment the copy
    is opened there — the chip backfills the sidecar from
    `GET /api/shares/attributions` when it holds no record — with no Start
    Menu visit needed first. Since you already have two profiles open, spend
    one extra look: open the copy in the profile that did NOT press accept
    and confirm the chip reads right straight from the IDE.)*
14. **The copy is the recipient's own project.** Rename it, edit it, delete
    something — it behaves like any project of theirs. The label stays. The
    *sharer's* copy is untouched by any of it.

## 4. The switch as a live control

15. **Revoke a pending share.** A shares with B; **before** B adds it, revoke
    it from A's devtools console:
    ```js
    // the share id: read it from B's page — or from A's POST /api/shares reply
    await fetch(`/api/shares/${id}/revoke`, { method: 'POST' })
    ```
    Reload B's class page: the section is **gone** (it renders nothing when
    empty — it must not leave an empty heading behind).
16. **Flip the switch off with a share pending.** A shares with B; B does not
    add it. Teacher turns Sharing rules **Off**. B reloads: the offer has
    lapsed and the section is gone. Now confirm the other half: a copy B had
    **already accepted** still opens, and **still carries its label** on both
    surfaces. Turning sharing off takes back the offer, never the work.

## 5. Offline, and the narrow floor

17. **Offline keeps both labels.** *Full offline reload is not testable against
    the dev server — there is no service worker, so a reload with the network
    off gets you the browser's offline page, not the app.* Do this instead:
    load the app while online with the accepted copy open, then set devtools →
    Network → **Offline**, and **navigate within the app** (start menu → open
    the copy → back to the start menu). Both label surfaces must persist —
    they render from the local sidecar, not from the network. Come back online
    and confirm the name is still right (it re-resolves).
18. **The 1024px floor.** Narrow the window to exactly 1024px and open
    `Share…` with a class of a dozen students. Nothing load-bearing is hidden:
    the **roster** scrolls inside the dialog (its own scrollbar), the page
    behind it does not, and the consequence line and both buttons stay
    visible without scrolling to find them. The File menu itself must still be
    present at that width.
19. **The IDE is otherwise untouched.** Start menu, a physics run, a
    data-science project, debug mode. **Plan 7 changed nothing there** except
    one File-menu item and one status-bar chip, both of which render nothing
    for a project with no share behind it — confirm a plain guest project is
    byte-identical.

## What the golden flow found at hand-over — FIXED

Recorded as found, then annotated with the fix, the way Plan 6's file records
its three. A harness earns its keep by what it catches.

1. **`.attribution-chip` carried no stylesheet rule — the sweep's first run.**
   The status-bar credit had `.attribution-chip__text` styled but the pill
   itself unbounded, so unlike `.rules-chip` and `.baton-chip` beside it the
   chip would grow with the sharer's name and push the run status out of a
   26px strip. **FIXED** (`styles/assignments.css`): bounded to 32ch like its
   sibling, the text ellipsizing, the full sentence on the `title` attribute.
   Item 13 is the human half of that evidence — read the truncation with a
   realistic name and say whether 32ch is enough.

Everything else in the sharing flow passed on its first run: the switch, the
roster, the consequence line, the confirmation, both label surfaces, the
section appearing for B and for nobody else, and zero console errors across
three browser contexts.

---

## Results sheet

One row per item. Mark each theme cell **OK**, **ISSUE** (and add a Findings row),
or **SKIP** (say why in Notes). The Notes cell is yours — impressions count as
data here, not just defects.

| # | Item (short name) | Light | Dark | Notes |
|---|---|---|---|---|
| 1 | Dialog: no sharing classes | | | |
| 2 | Dialog: empty roster (and self absent) | | | |
| 3 | Dialog: a server refusal, rendered | | | |
| 4 | Settings doors read + persist across reload | | | |
| 5 | `Share…` absent for a guest | | | |
| 6 | `Share…` absent under locked assessment | | | |
| 7 | `Share…` absent on a group project | | | |
| 8 | `Share…` absent on individual work | | | |
| 9 | `Share…` present on the student's own project | | | |
| 10 | Dialog read-through (class select, consequence line) | | | |
| 11 | Confirmation sentence + focus return | | | |
| 12 | B's section → Add to my projects → lands in the IDE | | | |
| 13 | Both labels; chip truncation with a real name | | | |
| 14 | The copy behaves as B's own project | | | |
| 15 | Revoke a pending share (console) → gone for B | | | |
| 16 | Switch off with a pending share; accepted copy survives | | | |
| 17 | Offline navigation keeps both labels | | | |
| 18 | 1024px: the roster scrolls, the page does not | | | |
| 19 | Guest IDE byte-identical | | | |

**Overall verdict:** _(fill in: pass / pass with findings / fail — date, name)_

## Findings

For anything marked ISSUE. Severity: **blocker** (a student or teacher cannot
proceed), **wrong** (behaves incorrectly but recoverable), **rough** (works but
reads or feels wrong).

| # | Item | Severity | What happened (what you did, what you saw, what you expected) |
|---|---|---|---|
| | | | |

_Add rows as needed. Hand the filled file back (or just say "browser pass done —
read the checklist") and the findings become the next fix list._
