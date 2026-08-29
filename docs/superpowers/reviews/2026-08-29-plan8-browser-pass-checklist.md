# Plan 8 — Human browser-pass checklist (29 August 2026)

> The one pass automation cannot replace. **Both themes, every item.**
> Automated context: shared/backend/frontend suites green, IDE e2e green, and
> the portal golden flow (`node frontend/scripts/portal-e2e.mjs`, **75/75**)
> now covering the bell, the five preference switches, `Waiting on them` with
> its Revoke, and the admin console's Data requests tab end to end — export,
> the type-to-confirm erase, the third People state, and the door that closes
> behind an erased address. This checklist is the human judgment on top: does
> it *read* right, does it *feel* right — and it leans hardest on the two
> things the script has no way to judge, **where a notification takes you**
> and **whether a page of prose is readable at the width it is read at**.

## Before you start

```
npm run db:up && npm run db:migrate && npm run seed   # Postgres, schema, seeded admin
npm run dev                                           # backend :4000 + frontend :3000
```

Sign-in: the seeded admin's credentials are in `backend/scripts/seed` (or
create a fresh teacher — signup is open). You need: **one admin** (the seeded
one — Data requests is admin-only), **one teacher**, **two student accounts**,
and **one throwaway student you are willing to destroy**. That wants **two
separate browser profiles at least** (a normal window plus a private window);
two tabs of one profile do not work — they share storage. Do every item in
**both themes**; the theme toggle is in the header, and it is now in the portal
header too, right beside the bell.

**How to record:** fill in the Results sheet at the bottom as you go — one row
per item, a column per theme, and a Notes cell for anything that felt wrong
even if it technically worked ("reads oddly", "slow", "had to look for it" are
all findings). Anything broken also gets a row in the Findings table beneath it.

**Two notes carried forward from the Plan 7 checklist, both now changed.**

- **The erased sharer is now REACHABLE.** Plan 7's checklist said there was no
  UI path to it and told you not to try. That is no longer true: item 17 below
  drives the real erase from the admin console, and every surface that names a
  sharer must resolve to `Removed student` afterwards — the recipient's
  attribution chip, the start menu's library row, and the class ledger. Do
  reproduce it in the browser now; it is the whole point of items 17–19.
  *(This supersedes the "Two things not to go hunting for" bullet in
  `2026-08-28-plan7-browser-pass-checklist.md`; leave that file's own text as
  the record of what was true then.)*
- **Revoking a share has a button.** Plan 7's item 15 drove
  `POST /api/shares/:id/revoke` from the devtools console because nothing in
  the UI called it. It now has two surfaces — the sharer's `Waiting on them`
  list and the teacher's widened view of the same section — and items 12–14
  read them. The console workaround is retired.

## 0. The bell at both headers — do these first

**Why first:** the script reads the bell at the **portal** header only, on
`/classes`, in dark mode. Everything below is a surface it never sees.

1. **The bell exists at both headers, and matches its neighbours.** Sign in as
   a student with at least one unread notification. On `/classes` the bell sits
   between the theme toggle and the account control; in the **IDE** (`/`) it
   sits in the same right cluster, left of the account menu. In both places, and
   in **both themes**, judge the three controls side by side: they must read as
   one cluster, evenly spaced, none obviously fatter than the next. *(This is
   the one the sweep caught — see "What the golden flow found" below. The fix
   makes the bell and the toggle the same **width** (28px); the bell stays 2px
   **taller** because its icon is 16px to the toggle's 14px, both centred in a
   44px bar. If that 2px reads as wrong to your eye, say so — dropping the bell
   icon to 14 is a one-word change and this checklist is where that call gets
   made.)*
2. **The badge is legible and does not collide.** With 1 unread, then with 3,
   then with **more than 9** (publish four assignments into a class the student
   is in, or release four marks), read the badge each time. At 10+ it must read
   `9+`, never `10`. It must not overlap the account control beside it, must not
   be clipped by the header's top edge, and must be readable in light mode —
   the accent tint on a light surface is the risky one.
3. **The empty state.** A brand-new student with nothing yet: open the bell. It
   must say *"Nothing yet — marks, reminders and shares will land here."* — one
   row, not a blank box, and it must not be clickable.
4. **Mark-all is opening it, and it is honest.** With unread rows, open the
   bell: the badge clears **while you watch**, and the unread rows keep their
   dot only until the list refreshes. Close it, **reload the page**: the badge
   must still be gone. Then open it again — the rows are all there, none has
   vanished. Reading is not deleting.

## 1. Where each notification takes you

**Why this matters:** the script asserts the *words* of one row. It never
presses one. A notification whose sentence is right and whose link is wrong is
worse than no notification.

Press each row and check the page you land on is the page the sentence
promised. You need a teacher and two students to mint the set.

5. **`New assignment in <class>: "<title>"`** → the student's assignment page
   for that assignment, inside that class. Not the class wall, not the IDE.
6. **`Marks released: "<title>"`** → the same assignment page, showing the
   score and the comment.
7. **`Work returned for changes: "<title>"`** → the same assignment page, in
   its returned state.
8. **`<name> shared "<title>" with you`** → the class page carrying the
   **Shared with you** section, with that offer in it.
9. **`<name> joined <class>`** (read as the teacher) → that class's page.
10. **`Submission received: "<title>"`** (and its `(attempt 2)` variant after a
    second submit) → the assignment page.
11. **A row whose subject is gone.** Have the teacher **delete** an assignment
    a student already has a notification for, then open that student's bell.
    The row must still render — a generic sentence for its type, never a blank
    row, never a crash — and pressing it must land somewhere real (the class,
    or `/classes`), never on a 404 or the IDE.

## 2. Waiting on them, from both sides

12. **The sharer's view.** Student A shares a project with B and does **not**
    wait for B to accept. A's class page grows **Waiting on them** below
    *Shared with you*: the project title, `to <B>`, and a Revoke button. With
    **nothing** pending it must render *nothing at all* — no heading, no empty
    card. Check both states.
13. **The teacher's view of the same section.** As the class **teacher**, open
    the same class page. The section is there too, widened: every pending share
    in the class, read as `<sharer> to <recipient>`. Confirm a teacher sees a
    share they had no part in, and that a **student** sees only their own
    outgoing ones (open A's and B's pages side by side with two pending shares
    in flight, one from each).
14. **Revoke, and what B sees.** Press Revoke as the sharer. A's row goes. Now
    **reload B's class page**: the offer is gone and the *Shared with you*
    section renders nothing rather than an empty heading. Then have the
    **teacher** revoke a different pending share and confirm the same on both
    students' pages. Nothing about a revoke should appear in anyone's bell —
    revocation is deliberately silent (D§2); confirm no row lands.

## 3. The five switches, and the mail they actually stop

15. **The switches round-trip.** `/profile` → Notifications. Five checkboxes:
    Submission receipts, Marks released, Work returned for changes,
    Due-tomorrow reminders, Reminders from your teacher — in that order, all on
    by default. Switch **two** off, save (the confirmation reads *"Notification
    settings saved."*), **reload**: exactly those two are off. Switch one back
    on, reload, confirm. In both themes the checked and unchecked states must be
    distinguishable without relying on colour alone.
16. **A switched-off email is genuinely absent — and the bell row still
    arrives.** This is the item that proves the switch means what the hint under
    it says (*"These switch the emails off. The bell in the header always shows
    everything."*).
    - As a student, switch **Submission receipts** off and save.
    - Submit a piece of assignment work.
    - As the admin, open **Admin → Emails** and search for that student: there
      must be **no** new receipt to them. (Do the same with the switch **on**
      first, so you have seen one arrive — an absence you never saw the presence
      of proves nothing.)
    - Back as the student, open the **bell**: `Submission received: "<title>"`
      **is** there. The email stopped; the notification did not.
    - One more, the other way: an **essential** email must be unaffected. Press
      *Forgot password?* for the same student and confirm the reset mail lands
      in the Emails tab regardless of every switch being off.

## 4. Data requests — the export and the erase

Admin console → **Data requests** (the fifth tab). Use the **throwaway**
account for everything in this section.

17. **The tab at rest, and the search.** The tab must **not** list everyone on
    arrival: it rests on *"Search for a person to export or erase their data."*
    A data request is acted on one named person at a time. Type a partial name
    and a partial email; both find them. Type nonsense: *"No one matches …"*.
18. **The export is a real file, and it reads right.** Press **Export**. A
    `physide-export-<id>.json` downloads. **Open it in a text editor** — this is
    the half no script can judge:
    - The first key is `note`, and its sentence is true of the file beneath it.
    - `user` is the right person.
    - Their work is there — projects, submissions, marks they received.
    - **Nothing about anyone else is there.** Specifically: no other student's
      name, and no teacher's `timeline_viewed` rows about them.
    - No `privateNote` anywhere, and no unreleased draft marks.
19. **The erase dialog refuses to be rushed.** Press **Erase…**.
    - The consequence sentence is there and reads as final: *"This cannot be
      undone. Their account and personal details go; their submissions and marks
      stay in the class record under 'Removed student'."*
    - `Erase permanently` is **disabled** with the box empty.
    - Type a **wrong** email → still disabled. Type the right email with a
      **trailing space** → judge what happens and note it either way.
    - Click the **backdrop**: the dialog must **not** close (a stray click must
      never discard a typed confirmation). `Escape` and `Cancel` both must.
    - Type it exactly → the button enables. Press it.
20. **The third People state.** Admin → People, search the same person (the
    email is gone, so search their id or `erased+`). The Status cell reads
    **`erased`** — a word, not a colour — the name reads `Removed student`, and
    the Actions cell is **empty**: no Deactivate, no Reactivate, no Send reset.
    Offering any of them would be a lie.
21. **The door is shut.** In the throwaway's own browser profile, sign in with
    the old email and password: refused with *"Invalid email or password."* —
    the unknown-email door, because the address genuinely no longer exists. Then
    confirm the *other* half: their class's **gradebook** still shows their
    marks, and the marking inbox still shows their submission, under
    `Removed student`. The person goes; the class record does not.
22. **The erased sharer, at last reachable.** Before erasing a *second*
    throwaway, have them **share a project** with a real student who **accepts
    it**. Now erase the sharer. In the recipient's browser: the status-bar
    attribution chip and the start menu's library row must both read *"Based on
    work shared by Removed student"* — resolved live, not a stale cached name —
    and the accepted copy must still open and still be theirs. This is the
    surface Plan 7's checklist could not reach.

## 5. `/privacy` — a page of prose, read as prose

23. **At 1024px.** Narrow the window to the stated floor and read `/privacy`
    top to bottom. Six headings — What we store, What we never collect, Who sees
    what, The right to leave, For school-aged users, How long things are kept.
    The measure must not run the full width (a 100-character line is not a
    reading page); nothing overflows sideways; the footer link that brought you
    here is still reachable.
24. **At phone width.** Resize to ~390px. **This page is the exception to the
    1024px floor** — it is a document a parent or a student may open on a phone,
    from a link, without ever touching the app. It must be *readable*: no
    horizontal scrolling, no text under the header, no clipped headings. It does
    not have to be beautiful; it has to be legible. Note honestly if it is not.
25. **The route in, from both doors.** The welcome page footer's Privacy link
    (with its icon) and the About page's data-care section both reach it, and
    the page has a way back. Confirm in both themes.
26. **It says what the product does.** Read *How long things are kept* against
    what you know: it must describe retention as the **proposal** it is, not as
    automation that exists. If it implies a deletion job runs, that is a finding.

## 6. Offline, and the parts that must not have moved

27. **Offline caveat — the same one as Plan 7, unchanged.** *Full offline
    reload is not testable against the dev server: there is no service worker,
    so a reload with the network off gets the browser's offline page, not the
    app.* Do this instead: load the app online with an accepted copy open, set
    devtools → Network → **Offline**, and **navigate within the app** (start
    menu → open the copy → back). Both attribution surfaces persist — they
    render from the local sidecar. **New for Plan 8:** the bell is a network
    read with nothing local behind it, so offline it must simply show whatever
    it last held and must **not** throw, spin forever, or paint an error into
    the header. Come back online and confirm it refreshes.
28. **The IDE is otherwise untouched.** Start menu, a physics run, a
    data-science project, debug mode. **Plan 8 changed nothing there** except
    one icon in the header's right cluster — confirm a guest project is
    byte-identical, and that a **signed-out** visitor sees **no bell at all**
    (it renders nothing without a session, in both headers).

---

## What the golden flow found at hand-over — FIXED

Recorded as found, then annotated with the fix, the way the Plan 6 and Plan 7
files record theirs. A harness earns its keep by what it catches.

1. **`.bell-trigger` carried no stylesheet rule — caught on the extension's
   first run, before a single new check had run.** The bell's trigger is
   icon-only, like the theme toggle standing right beside it, but with no rule
   of its own it fell back to `.tb-btn`'s *label* padding and drew **34×26**
   next to the toggle's **28×24** — two adjacent icon-only buttons in the same
   right cluster, visibly different boxes, at **both** headers. Exactly the
   shape of Plan 7's `.attribution-chip` finding. **FIXED** by composing
   `.tb-btn--icon` onto the trigger in `NotificationBell.js` — the same
   utility `ThemeToggleButton` uses — so the icon padding keeps exactly one
   owner in `chrome.css`; `platform.css` names the block only as the scope of
   the rule that belongs inside it. The two triggers are now the same
   **width** (28px); a 2px height difference remains because the bell's icon
   is 16px and the toggle's is 14px. **Item 1 is the human half of that
   evidence**: read the three controls side by side and say whether they now
   sit as one cluster, and whether that 2px is worth closing.

2. **The account zone had no spacing for a second control.** Measuring the fix
   above at *both* headers exposed a defect the sweep cannot see, because it is
   a collision rather than an absence: Plan 8 dropped the bell into
   `.app-header__account`, which had held **one** control and had no internal
   gap. Its two children sat flush — bell trigger right edge `1322.1`, account
   button left edge `1322.1` — and the unread badge, which overhangs its
   trigger by 2px, landed **2px inside the account button's box**. Only at the
   IDE header; the portal header's flex `gap` had always spaced them. **FIXED**
   (`styles/chrome.css`): the zone now spaces its controls like every other
   zone. Badge-to-account gap is `+6px` at both headers. **Item 1 covers this
   too** — with an unread badge showing, check it clears the account control at
   the IDE header, in both themes.

Everything else in the Plan 8 flow passed on its first run: the badge count,
the renderer's sentence character for character, mark-all surviving a reload,
the five switches round-tripping with only one moved, `Waiting on them`
appearing and its Revoke emptying both sides, the export's shape, the erase
dialog's type-to-confirm gating, the third People state, the closed door — and
zero console errors across a fourth browser context.

---

## Results sheet

One row per item. Mark each theme cell **OK**, **ISSUE** (and add a Findings row),
or **SKIP** (say why in Notes). The Notes cell is yours — impressions count as
data here, not just defects.

| # | Item (short name) | Light | Dark | Notes |
|---|---|---|---|---|
| 1 | Bell at both headers, matching its neighbours | | | |
| 2 | Badge legible at 1, 3 and `9+`; no collision | | | |
| 3 | Bell empty state, one row, not clickable | | | |
| 4 | Mark-all on open; survives reload; nothing deleted | | | |
| 5 | Link: new assignment → assignment page | | | |
| 6 | Link: marks released → assignment page | | | |
| 7 | Link: work returned → assignment page | | | |
| 8 | Link: project shared → class page, offer present | | | |
| 9 | Link: joined class → class page (teacher) | | | |
| 10 | Link: submission received (+ attempt 2) | | | |
| 11 | Deleted subject: row still renders, link still lands | | | |
| 12 | Waiting on them: sharer's view, and empty = nothing | | | |
| 13 | Waiting on them: teacher's widened view; student sees only own | | | |
| 14 | Revoke clears both sides; no bell row for it | | | |
| 15 | Five switches round-trip across a reload | | | |
| 16 | Switched-off email absent; bell row still arrives; reset unaffected | | | |
| 17 | Data requests rests on its prompt; search finds and misses | | | |
| 18 | Export file read in an editor — theirs only | | | |
| 19 | Erase dialog: disabled states, backdrop, Escape, exact match | | | |
| 20 | People: `erased`, `Removed student`, no actions | | | |
| 21 | Old email refused; gradebook and inbox still hold the work | | | |
| 22 | Erased sharer → both attribution surfaces read `Removed student` | | | |
| 23 | `/privacy` at 1024px: measure, no overflow | | | |
| 24 | `/privacy` at ~390px: legible on a phone | | | |
| 25 | `/privacy` reachable from footer and About, and back | | | |
| 26 | Retention section reads as a proposal, not automation | | | |
| 27 | Offline: labels persist; the bell degrades quietly | | | |
| 28 | IDE untouched; no bell at all for a signed-out visitor | | | |

**Overall verdict:** _(fill in: pass / pass with findings / fail — date, name)_

## Findings

For anything marked ISSUE. Severity: **blocker** (a student or teacher cannot
proceed), **wrong** (behaves incorrectly but recoverable), **rough** (works but
reads or feels wrong).

| # | Item | Severity | What happened (what you did, what you saw, what you expected) |
|---|---|---|---|
| | | | |

_Add rows as needed. Hand the filled file back (or just say "browser pass done —
read the Plan 8 checklist") and the findings become the next fix list._
