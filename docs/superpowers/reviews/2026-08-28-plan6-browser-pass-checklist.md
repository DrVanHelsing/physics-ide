# Plan 6 — Human browser-pass checklist (28 August 2026)

> The one pass automation cannot replace. **Both themes, every item.**
> Automated context: shared/backend/frontend suites green, IDE e2e 164/164,
> and the new portal golden flow (`node frontend/scripts/portal-e2e.mjs`,
> **39/41 — 38/41 when the intermittent one bites**) covering teacher
> authoring → student submit → marking → release → gradebook → feedback. The
> red checks are the three defects recorded at the end of this file, not
> harness noise. This checklist is the human judgment on top: does it *read*
> right, does it *feel* right — and it starts with the one flow no automated
> test covers end to end.

## 0. Groups and the baton — TWO BROWSERS, do this one first

**Why first:** every other item here has at least partial automated backup.
This one has none. `portal-e2e.mjs` drives a single student through an
individual assignment; the group routes, the editing baton and the
save-then-submit ordering between two people are proven only by unit tests
with mocked transports. A baton that hands over the wrong workspace, or a
submit that snapshots the save before the last one, is invisible to every
test in the repo.

1. **Set up.** Teacher: one assignment with **Submission = Pair** (or Group),
   published. Two student accounts, both in the class, in two different
   browsers (or one browser + one private window — not two tabs of the same
   profile; they must not share storage).
2. **Group formation.** Student A creates a group; Student B sees it appear
   and joins. The roster row names both, the count reads 2/2, and B's Join
   button is gone. A full group refuses a third joiner with the server's own
   sentence.
3. **Start work.** A starts; B opens the same assignment and presses
   Start work — B must land in **A's** project, not a new empty one.
4. **Baton takeover.** A holds the baton (their workspace is editable, B's is
   read-only and says so). B takes the baton. Confirm: A's workspace goes
   read-only *before* B's goes editable, and **the workspace B receives is the
   one A last saved** — make a distinctive edit as A (a named block, an odd
   number in a field) and confirm B sees exactly it.
5. **The baton/submit interaction.** With B now holding the baton: B makes an
   edit, and **immediately** presses Submit (do not pause). The fingerprinted
   snapshot must be the save B just made, not the state before it. Verify in
   the marking room that the submitted blocks include B's last edit.
6. **Credit.** The assignment reads as submitted for **both** members, naming
   who it was credited to and the attempt number, on both browsers.
7. **One mark, released per member.** Teacher marks the group once, sets a
   per-member adjustment on one member, releases. Each student sees their own
   total (group points ± their adjustment), one comment, no private note.

## The rest

8. **`/classes` → New class → an assignment, top to bottom.** Read the editor
   as a teacher would: every field label, the Goal/Submission selects, the
   "marked individually" checkbox greying out for pair/group.
9. **Instructions editor.** Type a paragraph, a heading, a list. Insert an
   image **over 200 KB** — the refusal must read "That image is too large
   (200 KB max)." Paste a non-video URL into Video — "That isn't a YouTube or
   Vimeo link this editor can embed." Insert some LaTeX and confirm it renders.
10. **Rules picker.** Step through Open practice / Standard classwork /
    Locked assessment; open Custom…, flip a switch, save the set under a name,
    confirm it appears as its own radio and can be deleted.
11. **Publish consequence line.** With no Opens date: "Students in this class
    will see it immediately." Set an Opens date, **don't save**, and confirm
    the line still describes what Publish will actually do plus the
    "Save your changes first" note; save, and confirm the line now names the
    date.
12. **The student's assignment page at exactly 1024px.** Nothing load-bearing
    hidden; the brief pane in the IDE collapses to its labelled handle at that
    width and one click brings it back.
13. **The rules chip.** Inside the work, read it aloud: it must name what is
    switched off in the teacher's own vocabulary, and it must never vanish as
    the status bar narrows (it may ellipsise; the full sentence stays on the
    tooltip).
14. **Submit and the late label.** Submit before the due date, then move the
    due date into the past (late window) and submit again: the warning
    sentence appears before the button, and the second attempt carries a
    permanent late label in the inbox and the gradebook.
15. **Marking — stale-draft refusal.** Mark attempt 1 as a draft, have the
    student submit attempt 2, then try to Release: the room must say the draft
    was written against the earlier attempt and refuse until it is re-saved.
16. **Return reopens.** Return for changes with a comment. The student sees the
    comment, can resubmit **even if the assignment has closed**, and the
    teacher's next release ends the return episode (never "released ·
    returned").
17. **Release emails in the pretend inbox.** `/admin` → Emails: a release
    writes one mail per student; a Remind writes one per missing student and
    the confirm dialog's headcount matches what actually gets sent.
18. **Gradebook CSV in a real spreadsheet app.** Export, open in
    Excel/Numbers/Sheets: the em dash and the ✓ survive (UTF-8 BOM), a student
    whose name contains a comma stays in one column, and late/draft read as
    plain-text suffixes.
19. **History restore round-trip.** `/history/:projectId` for a project with
    several checkpoints: restore an older one, confirm the workspace really
    changes, and confirm the restore itself becomes a new checkpoint rather
    than erasing what was there.
20. **Theme persistence across the seam.** Toggle the theme from the marking
    room, reload, open the IDE — both sides agree, and the read-only
    submission viewer repaints with the marker's choice.
21. **The IDE itself.** Start menu, a physics run, a data-science project,
    debug mode. **Plan 6 changed nothing there** except the brief pane, the
    rules chip and the baton chip, all of which render nothing outside
    assignment work — confirm a plain guest project is byte-identical.

## Known findings, recorded at hand-over (not fixed by Task 26)

The golden flow reproduced three defects. They are the product's, not the
script's, and Task 26 did not touch product code:

1. **Start work is refused intermittently with "Could not reach the server —
   check your connection and try again."** Two callers push the same
   brand-new project concurrently (`startWork.js`'s own
   `engine.pushProject`, and `SyncProvider`'s `onProjectSaved` →
   `adoptLocalProject`), 1–2 ms apart. `PUT /api/projects/:id` takes a
   `SELECT … FOR UPDATE` on a row that does not exist yet — which locks
   nothing — so both take the create branch and one dies on
   `projects_owner_id_id_pk`, returning 500. The engine reads that as
   `error`, and `assertPushSucceeded` refuses with a connectivity sentence
   that is not what happened. Pressing Start work again succeeds. **This is
   the intermittent one — roughly half of runs** (2 of 4 at hand-over), and
   it is the whole difference between a 38/41 and a 39/41 result. Press Start
   work a few times by hand; if it never refuses, you have been lucky, not
   fixed.
2. **Start work lands on the start menu, not in the work — every run.**
   `startWork.js`
   stamps `LAST_PROJECT_KEY` and calls `navigate("/")` — a client-side
   transition — while `ProjectContext` reads that key only in its
   once-per-app-load bootstrap. In a single-page session the student arrives
   at the IDE with no project open and their assignment sitting under
   "Continue". A full reload opens it. `MarkingRoom`'s "Open a test copy"
   is the same shape and presumably the same bug — worth checking by hand.
3. **Three rule-less classes — the sweep's two fail every run** — markup
   carrying a class no stylesheet
   defines: `.brief-pane__footer` (`BriefPane.js`, the Submit footer),
   `.rich-text-editor` (`RichTextEditor.js`, the instructions editor
   wrapper), and `.btn--small` (`HistoryTimeline.js:107` — the retired
   spelling of `.btn--sm`, so the Restore button never gets its small size).
   The first two are caught by the golden flow's sweep; the third is on
   `/history/:projectId`, which the flow does not visit — check it by eye at
   item 19.
