# Classroom Platform — Plan 6 design: Assignments and everything downstream

**Date:** 25 August 2026 · **Status:** approved (controller, this date) · **Builds on:** spec §5–§7 (`docs/classroom-platform.md`), the 2026-08-22 design-alignment delta, `docs/classroom-platform-stack.md`, Plans 1–5 as shipped.

This document does **not** restate spec §5–§7 — the spec is the contract for
*what* assignments are. It records the **build decisions** the spec and stack
briefing left open, with reasons, so the implementation plan can cite one
authority. Plan 5's deferred list named this plan: *"Assignments and
everything downstream of them (submissions, marking, feedback, gradebook, the
instructions/guide editor, per-assignment workspace rules, pairs and groups).
That is the next plan."* (plan 05 §Deferred, line 91.)

## 1. Shape — one plan, five staged lanes plus a spine

Execution is subagent-driven with stage gates; each stage lands green before
the next opens (A and B may overlap once Stage 0's contracts are stable).

| Stage | Delivers | Depends on |
|---|---|---|
| **0 — spine** (serial) | `shared/src/assignments.ts` zod contracts; migration `0004` (all new tables at once — one migration, not five); core `assignmentRoutes` plugin skeleton with guards; test-net extensions (`truncateAuthTables` table list, `portalControls` DIRS, conformance coverage for any new stylesheet file) | Plan 5 close |
| **A — teacher authoring** | Assignment editor (TipTap + KaTeX, lazy-loaded), settings/dates/points, workspace-rules picker (three presets + savable custom sets), starter pinning, Draft→Published lifecycle, Assignments tab replaces the stub, guide pages | 0 |
| **B — student experience** | Assignment page (renderer, Start/Continue), IDE assignment context + brief pane + rules enforcement + rules chip, submit + receipt + late labels, Home due-soon strip | 0, A (needs one publishable assignment) |
| **C — marking** | Inbox (filters, progress bar, reminder), marking room (read-only script + test copy in the full IDE), mark/comment/private-note/Return, TA drafts → teacher release, gradebook + client CSV export, the ONE history viewer (student History + teacher timeline) | B |
| **D — pairs/groups** | Group formation, baton lease (poll, holder + expiry), any-member submit crediting all, group mark with per-member adjustment | B |
| **E — wrap** | Honesty copy (welcome §12 card, `AssignmentsStub` removal, HelpPage stale deployment copy), spec §18/contract amendments for decisions taken here, assignment golden-flow e2e, full gates, browser-pass checklist | C, D |

## 2. Assignment context — server-authoritative, manifest untouched

**Decision.** The link between a student's working project and an assignment
is a server table, `assignment_work` (`assignment_id`, `user_id` *or*
`group_id`, `owner_id` + `project_id`, `started_at`), created when the
student presses **Start work** (which clones the pinned starter manifest —
or a blank of the assignment's project type — into an ordinary private
project). The client caches `{assignmentId, classId, rules, dueAt, title}`
per project id in the existing `sync-meta` localForage store.

**The manifest is never tagged.** `SCHEMA_VERSION` stays 2, the sync engine
is untouched, export bundles cannot leak assignment ids, and the tag cannot
be forged into or out of existence client-side — the server knows the
mapping regardless, which is what the spec's anticheat stance requires.

Consequences the plan must implement:
- IDE boot checks the loaded project id against the cache, so a
  `LAST_PROJECT_KEY` restore re-mounts the assignment chrome (brief pane,
  rules, chip) — the alternative (assignment project reopening as a free
  project) silently un-enforces rules.
- Opening the assignment page while online refreshes the cached rules —
  this *is* the spec's "students get new rules next time they open the
  work". Offline lessons run from the cache.
- A second device learns the linkage by opening the assignment (server
  returns the existing `assignment_work` row instead of cloning again).

## 3. Entering the workspace — the IDE stays at `/`

No second IDE mount, ever. `/classes/:classId/assignments/:aid` is the
instructions page; **Start work / Continue** writes the active-project key
and the assignment cache, then navigates to `/`. WelcomeGate is untouched
(signed-in users already bypass it). `ClassChrome` keeps its render-prop
shell; assignment routes join the existing flat Routes block in `App.js`.

## 4. Workspace rules — one context, several consumers, honest limits

- `visibleControls(state)` gains an optional `rules` field in its state
  argument and stays a **pure function** — its existing invariant suite
  extends, never changes. Removing a key removes it from the header *and*
  the 1120px overflow, because both render from the same list.
- A new `WorkspaceRulesContext` (fed from the assignment cache) is read by
  the surfaces the header matrix does not govern, each named in the plan:
  the File menu's import/export/copy **items** (they live inside the single
  `fileMenu` key), **both** screenshot paths (File menu `.png` download and
  the viewport camera cluster — spec §5.4 names this exact trap), Monaco
  copy-to-clipboard, template browsing, and the debug entry in SimControls.
- **The server enforces what a server can enforce** — lifecycle, submission
  windows, group membership — and the plan states plainly that tool rules
  are client-side honesty (there is no server request behind "export as
  PNG" to refuse). Where a rule *does* have a server counterpart the
  backend refuses independently.
- **Rules chip placement (recorded deviation):** spec §5.4 puts the
  switched-off note in the header's view zone; the delta's S4 forbids it
  ever disappearing; the header's view zone collapses entirely at 1120px.
  Resolution: the chip renders in the **status bar beside `SyncChip`** —
  the one strip that never collapses at any width. `.tb-chip` shape,
  `aria-live` per S4, shortens but never vanishes.

## 5. The brief pane

A new left-hand `.brief-pane` column in `.main-layout`: fixed default width,
collapsible to a header toggle, **not** entangled with the existing
one-`--split` divider (generalising `useSplitPane` is out of scope). It
wears the standard pane header with the 2px `--cat-communicate` strip
resolved **by name** through the palette module (§18 D15). "Popped out" =
the existing modal `Overlay` with the glass tokens — the product's one
overlay idiom; no `window.open`. At the 1024px floor it collapses to the
toggle and remains reachable — it may never silently vanish.

## 6. Data model

New tables (all in `src/db/schema.ts`, one migration `0004`, text
pseudo-enums, timestamptz, jsonb, following the projects idiom):

- `assignments` — class-scoped; title (only required field), instructions
  jsonb, open/due/close+late-window timestamps, points (nullable = 
  complete/not-complete), submission mode (individual/pair/group),
  individual-work flag, workspace rules jsonb, starter manifest jsonb
  (a frozen **copy**, never an FK to a live project), status.
- `assignment_work` — the §2 link table.
- `submissions` — one row per attempt: manifest jsonb snapshot (frozen,
  fingerprint hash, ≤400KB like projects), `is_current` head, late flag,
  submitted_by, credited member ids for groups. Resubmission replaces the
  head; history is retained. Teachers read snapshots, never live projects.
- `marks` — per (assignment, student): points, comment, private note,
  `draft`/`released`, marker id, returned-for-changes flag. TA drafts await
  teacher release **by construction** (release is the teacher-only
  transition). A group mark is written per member on release, with optional
  per-member adjustment.
- `groups` / `group_members` — per-assignment composition plus the baton
  lease (`holder_id`, `expires_at`) polled while the assignment is open —
  no websockets (stack §sync).
- `rule_sets` — a teacher's saved custom rule combinations (account-scoped).
- `guides` — class-scoped published pages sharing the instructions format.

**Lifecycle is computed, not scheduled.** Published→Due→Closed derive from
timestamps at read time; only Draft and Marks-released are stored
transitions (plus manual overrides). The stack doc's **one daily-tick
endpoint** exists solely to send due-tomorrow emails — an interval timer
calls it in dev; Cloud Scheduler will call it in production.

**History retention.** `MAX_VERSIONS_PER_PROJECT` stays 20. The timeline
renders submissions + whatever versions exist; a longer §8.1 growth history
is recorded as a knob for the cloud plan, not silently promised.

**Naming.** The screen is **History**; an entry is a **checkpoint** (the
spec's word). One viewer component serves the student restore screen and
the teacher timeline (§7.2) — the Plan 4 deferral note requires they be
the same viewer.

**Teacher cross-user reads** — the first in the product — go through the
`assignment_work` link under `requireClassTeacher`(-or-TA where the spec
allows), and are audited via `logEvent` like every other account action.

## 7. Instructions editor — bounded, no new infrastructure

TipTap + KaTeX (stack §editor decision), structured JSON stored in
`assignments.instructions` / `guides.body`; one shared **read-only
renderer** used by the student assignment page, guides, and the brief pane.
Video = YouTube/Vimeo URL embed. **Images = inline data-URIs, capped**
(≤200KB per image, ≤1MB per document, enforced in the shared zod schema) —
no BlobStore until the cloud plan, and the teacher editor says so at the
point of use. The editor bundle lazy-loads on teacher screens only; the IDE
and student bundles are untouched.

## 8. Email

Five new templates through the existing `Mailer` interface (dev driver →
pretend inbox; only the driver changes at the cloud step): submission
receipt (every group member), marks released, returned-for-changes,
due-tomorrow (via the daily tick), and the teacher's one-click reminder.
No publish email — the spec makes publish bell-only, and the bell is not in
this plan (§9), so publish visibility = the Assignments tab + due-soon
strip, recorded honestly.

## 9. Deliberately NOT in Plan 6

The notification bell and per-user notification preferences (their own
later plan), peer sharing and the §8.3 attribution ledger, admin data
requests, rubric marking, real email delivery, the GCP port, BlobStore,
websockets/live co-editing, and any change to sync mechanics or
`SCHEMA_VERSION`.

## 10. Design-system and test obligations

Every new screen: tokens only, the Plan 5 primitives, `PortalHeader` +
`.page` shell, 30px portal controls, outlined danger, one focus ring, one
dropdown implementation, colour-never-alone, 1024px floor. New portal
directories join `portalControls.test.js` DIRS; any new stylesheet gets a
metric-lint conformance test like `platformTokens`; `visibleControls`
invariants extend; new tables join `truncateAuthTables`. Stage E ships the
assignment golden-flow e2e (teacher authors → student submits → teacher
marks → student sees feedback), which begins repaying spec §18's item 6.

## 11. Open points resolved by fiat (recorded so the plan can cite them)

1. **"Missing"** = roster member with no current submission after due.
2. Resubmission during the late window carries the late label; a returned
   submission reopens work for that student regardless of Closed (the
   teacher's Return is the authority) until marks release.
3. Draft-mark vs resubmit race: a new submission flags the draft mark as
   "written against a previous attempt" — it never silently deletes.
4. Reopen/extension: a teacher may move dates while Published; moves are
   audited; late labels are computed against the dates in force at submit
   time and never retroactively re-stamped.
5. Gradebook CSV is generated client-side from the grid query (no server
   export endpoint, no file infra).
6. Submission "dispute authority" (delta S7): the fingerprint shown on the
   receipt and in the marking room is the authority; both render it.
