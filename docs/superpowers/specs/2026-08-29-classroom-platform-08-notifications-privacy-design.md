# Plan 8 design — the bell, the preferences, and the data requests

**Spec authority:** `docs/classroom-platform.md` §9 (emails and notifications), §10 (the admin
corner), §11 (privacy and data care), constrained by §8 (the honesty layer), §12/§15
(leanness), §13 (exclusions), §14 (the closed screen inventory), §18 (the design contract).
Research ground: the Plan 8 research memo (session artifact, 2026-08-29, seven sections +
gap-fill rulings). Format and precedent: the Plan 6 and Plan 7 design docs beside this one.

**Provenance note (recorded honestly):** these decisions were made by the controller under
the user's standing continuous-execution order, grounded in the spec's own text and the
research memo — not in a brainstorming dialogue. Where the spec is silent (the bell's
storage, the erasure mechanism, the privacy page's existence as a route), the ruling is
recorded with its reasons and its cost, and each one is reversible in the direction chosen.

**The corrected frame (memo C1):** all nine of §9's email rows already ship — templates,
call sites, the pretend inbox, the teacher reminder button, the due-tomorrow tick. Plan 8
does NOT build the email table. It builds exactly three things the contract still excludes —
**the in-app bell, per-user notification preferences, and admin data requests** — plus the
privacy page the spec cites three times but never inventoried, the Plan 7 revoke
affordance, and the ESLint stack Plan 1 deferred here. Real email delivery stays excluded
(the postman is Plan 9's).

**Pre-plan reconciliation:** the post-Plan-7 hardening batches (A: unique pending-share
backstop + uuid param guards + allow-list staff gates; B: second-device attribution
refresh; C: ux-audit contrast/sizing fails) landed between Plan 7 and this design. The
memo's debt-register items 2.4, 2.5, 2.7 and 7.2 are therefore RESOLVED and are not Plan 8
scope; this doc's citations that touch those files describe the post-batch tree.

---

## 1. What the bell IS — and where it lives

**Decision.** The bell is a **dropdown, not a screen**: `DropdownMenu` — the product's one
dropdown implementation (`frontend/src/components/common/DropdownMenu.js`), exactly as §9's
own sentence demands ("it is not a new popover"). It mounts in the two places
`<HeaderAccount />` already renders — `PortalHeader.js` (all seven portal screens) and
`Toolbar.js` (the IDE at `/`) — immediately before HeaderAccount, icon-only trigger
(`BellIcon`, already in `Icons.js:157`), `triggerAriaLabel` required, `chevron={false}`,
`align="right"`. It renders `null` when `useMe()` has no user — a guard of its OWN
(HeaderAccount deliberately shows a signed-out "Guest" menu; the bell must not copy that —
a guest has nothing to be notified of). The unread count is a `.badge` — the
HeaderAccount "unconfirmed" pattern, never a new class. One sanctioned API addition:
`DropdownMenu` gains an optional `onOpenChange(open)` callback (one effect beside its
existing open state) — the bell's mark-all-on-open needs it because `DropdownMenu` clones
role/close-on-select onto its DIRECT children, so the bell's rows must BE direct children
(no wrapper panel component), leaving no mount point for an open-effect inside.

**No `/notifications` route exists or is added.** §14:402 ("Notifications panel — the
bell") already inventories the dropdown; §14 gains no row for it. Not mounted in
`AuthLayout` (fiat: `/auth/*` is pre-session; `/profile` is the preferences destination,
not a bell surface).

## 2. The delivery table — because the ledger records who acted, never who should be told

**Decision.** The bell is backed by a new **`notifications` delivery table beside the
`events` ledger** — the exact split `shares` already established ("the shares table is
delivery state, not the ledger", contract + `schema.ts:370-378`). The memo's addressee
audit is decisive: of the 13 bell-relevant event types, three (`assignment.published`,
`assignment.marks_released`, `assignment.reminded`) store **no recoverable recipient set at
all**, and two more drift — read-time fan-out over `events` is not implementable, and an
audience column on the ledger would invert the recorded posture. So:

```
notifications(
  id bigserial PK,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  event_id bigint NOT NULL REFERENCES events(id),
  type text NOT NULL,               -- denormalised so the bell renders without joining events
  payload jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
)
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, id DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_user_idx        ON notifications (user_id, id DESC);
```

- **Fan-out happens at write time, in the same transaction as `logEvent`**, in the route
  that already holds the recipient ids (the release route holds `releasable`, the remind
  route holds `recipients`, the publish route selects the roster once). A small helper
  (`notify(tx, userIds, eventId, type, payload)`) sits beside `logEvent`; it never replaces
  it — every notification's event still exists, and `event_id` points at it.
- **`events` gains no index and no column — ever, under this plan.** The bell reads
  `notifications`, so Plan 7's "no events indexes; nothing reads the ledger" deferral is
  RESOLVED, not revisited: the premise survives because the bell never reads the ledger.
  (`tick.ts`'s once-a-day scan stays exactly as it is.)
- `logEvent` gains a return of the inserted event id (`.returning({ id })`) so `notify` can
  reference it; every existing call site is unaffected (the return was `void`).

**The minting map — 12 minting types** (recipients resolved at write; the memo's 13
candidates minus the two silent share types, plus `invite.accepted`, which the memo's
addressee table considered and this design includes — see the row's reason):

| Event                                                  | Recipients                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assignment.published`                               | the class's active**students** (the §9 "quiet" event)                                                                                                                                                                                                               |
| `assignment.marks_released`                          | the released-to students (`releasable` at release time)                                                                                                                                                                                                                  |
| `assignment.mark_returned` / `group_mark_returned` | the student / the group's members at return time                                                                                                                                                                                                                           |
| `assignment.due_reminder_sent`                       | the reminded student (tick; actor stays`null`)                                                                                                                                                                                                                           |
| `assignment.reminded`                                | the missing students computed at press time                                                                                                                                                                                                                                |
| `assignment.submitted`                               | the credited students (the submission receipt; group = every member)                                                                                                                                                                                                       |
| `class.joined` / `class.join_requested`            | the class's active**teachers** (the §9 "quiet" event; approval-mode requests are the teacher's queue)                                                                                                                                                               |
| `invite.accepted`                                    | the class's active**teachers** — an invited member lands active WITHOUT passing the join route (`invites.ts`'s accept transaction), so the "a student joined your class" quiet event needs this twelfth site; the renderer gives it the `class.joined` sentence |
| `project.shared`                                     | the recipient                                                                                                                                                                                                                                                              |
| `project.share_accepted`                             | the sharer                                                                                                                                                                                                                                                                 |

**Deliberately silent (fiat): `project.share_revoked` and `project.share_lapsed` mint
nothing.** Revocation removes delivery; a notification announcing the withdrawal would
re-deliver attention to it. The ledger keeps every row; the pending entry simply leaves the
recipient's class page. Also silent: the teacher-signup admin alert (an email row with no
event — the admin's Emails tab is its surface) and the password-reset flow (no event
exists; essential email, not a bell matter). Neither gains a `logEvent` call in Plan 8 —
recorded as ledger-completeness nits for a later sweep, not built now.

## 3. The read model

**Decision.**

- `GET /api/notifications` (`requireConfirmed`) → `{ notifications: [{id, type, text, href, createdAt, readAt}], unreadCount }`, `?limit=` default 30 cap 100, newest first.
  **The server builds the sentence** (`text`) per type in ONE renderer — names resolved
  live at read (`users`/`assignments`/`classes` joins) with the `?? "Removed student"`
  fallback, the shares idiom — so §11 erasure keeps exactly one place to act and the client
  renders strings, never id-joins. The renderer tolerates deleted referents (an assignment
  or class deleted after the row was minted renders a generic sentence, never a 500 and
  never a dropped list). `href` is the in-app destination (the assignment page,
  the class page) per type. `unreadCount` comes from the partial index.
- `POST /api/notifications/read` (`requireConfirmed`) — `{ ids?: number[] }`, omitted ids
  = mark all read. The bell marks-all on open (the dropdown IS the read gesture); per-item
  granularity exists in the route for free but the UI ships mark-all only.
- **Cadence: react-query `refetchInterval`, 60s** (`BELL_POLL_MS = 60 * 1000`, a named
  const beside BatonChip's `BATON_POLL_MS` precedent). This is the tree's FIRST
  `refetchInterval` use, deliberately: the bell has none of BatonChip's poll-driven side
  effects, it mounts inside the app-wide `QueryClientProvider`, mark-as-read wants
  `useMutation` + `invalidateQueries`, and `refetchOnWindowFocus` gives the
  back-to-the-tab refresh free. Recorded so the next polled read has a precedent to cite.
- The dropdown's empty state is `.empty` ("Nothing yet — marks, reminders and shares will
  land here."). Colour is never the only channel; unread rows carry a glyph + weight, not
  a tint alone.

## 4. Preferences — five switches, gating EMAIL only, enforced in one seam

**Decision.**

- Storage: **`notification_prefs(user_id uuid FK cascade, key text, enabled boolean, PRIMARY KEY (user_id, key))`** — a row-per-pref table, NOT a jsonb column on `users`
  (the erasure scrub rewrites that row; prefs cascade-clean on their own). **An absent row
  means the default (on)** — adding a key never needs a backfill.
- The keys are §9's five switchable rows, named **verbatim as the email template strings**:
  `submission-receipt`, `marks-released`, `work-returned`, `due-tomorrow`, `due-reminder`.
  The four "Always" rows (`confirm`, `reset`, `teacher-alert`, `class-invite`) are ungated
  by construction.
- **Enforcement is a Mailer decorator, not thirteen call-site edits**: `app.ts:34` becomes
  `app.decorate("mailer", deps.mailer ?? withPreferences(deps.db, createDevMailer(deps.db)))`.
  The wrapper sends unconditionally when `toUserId` is null (the two invite sends — §9
  "Always", possibly no account yet) or when the template is not switchable; otherwise it
  looks up the pref. **The gate fails open for essential mail.** `tick.ts`'s due-tomorrow
  send — the one row the spec itself marks "student can switch off" — becomes gated
  without touching `tick.ts`.
- **The bell is NOT gated by these keys (fiat):** §9's switches turn off "the notification
  that leaves the building"; every bell-eligible event reaches the bell. A parallel
  bell-mute vocabulary would be a second key set for one idea with no spec default to
  anchor it — if bell-level muting is ever wanted, that is a spec question, not a silent
  build decision.
- UI: a "Notifications" section on `/profile` (§14:401's "notification switches") — five
  checkboxes, written through **`PATCH /api/auth/me`** (already a self-scoped
  authority-matrix skip; zero new mutating routes for prefs).

## 5. Erasure — in-place scrub, one transaction, one name

**Decision.** `POST /api/admin/users/:id/erase` (`requireAdmin`) performs an **in-place PII
scrub — never `DELETE FROM users`**. Three reasons, each sufficient: a hard delete on any
teacher who ever created a class/assignment/guide/invite raises a bare FK violation (four
`no action` FKs, no cleanup path); the cascade FKs on `submissions.submitterId` and
`marks.studentId` would delete the very history §11 says survives; and `active=false`
already locks every door (`session.ts`, signin, reset) with zero new checks.

The post-erasure row, exactly: `id/consentAt/createdAt` unchanged; `name = "Removed student"` (the SAME literal as the exported `REMOVED_STUDENT` const — scrubbed value and
read-time fallback agree on every surface, one string, promoted to one shared home);
`email = erased+<id>@erased.invalid` (NOT NULL + UNIQUE by construction, RFC 2606
undeliverable); `passwordHash = ""`; `role = "user"`; `isTeacher = false`;
`emailConfirmedAt = NULL`; `active = false`; **`erasedAt = now()` — a new nullable column,
the only way to tell erased from deactivated**.

In the same transaction: `destroyAllUserSessions`; **explicit** `DELETE FROM email_tokens`
(the cascade never fires under scrub — a live reset token must not outlive the erasure);
delete their `notifications` and `notification_prefs` rows (delivery state, not history);
**KEEP their `class_members` and `group_members` rows** — the marking inbox and the
gradebook build their rosters from membership (`inboxEntriesFor`, the gradebook route),
so deleting the rows would make the erased student's submissions and marks invisible,
violating §11's "the class's marks history stays intact" at the view level. The rows stay;
every roster renders the scrubbed name "Removed student" through the surviving `users`
row. The one consequence to close: PERSON-FACING pickers must not offer an erased person —
the share-recipient roster (`GET /api/shares/roster/:classId`) gains an
`isNull(users.erasedAt)` condition; record-facing rosters (gradebook, marking inbox)
deliberately keep them;
delete pending `shares` rows addressed TO them (a recipient who can never accept must not
hold deliveries open);
**delete their owned projects except group-linked ones** (a `groups.projectId` row marks a
project as the group's shared workspace — erasing one member must not destroy the group's
work; everything else of theirs is content the right-to-leave removes, and project_versions
follow by composite cascade); delete their **pending** outgoing `shares` rows and scrub the
`frozenManifest` of their resolved ones to `{}` (delivery state; the accepted copies are
the recipients' own projects and stand untouched, D§8's promise); `logEvent("account.erased", admin, { subject })`. Submissions, marks, memberships' historical effect, and the events
ledger are untouched — every `users.name` join in the tree now renders "Removed student"
through the surviving row, which is §11:348 implemented literally.

**Teachers take the same path (fiat):** scrub is uniform; `active=false` freezes their
classes exactly as §10's deactivation promises, and `createdBy` renders "Removed student".
§11 defines erasure only for students; one mechanism for everyone beats a second wording.

The admin People tab gains a **third status** (`erased`) rendered from `erasedAt`, with all
four row actions suppressed on an erased row — today's UI would offer "Reactivate" on a
scrubbed shell. The confirm dialog is the product's one `Overlay` with
`dismissOnBackdrop={false}` (the one earned deviation), **type-the-email-to-confirm** (the
reversible neighbour Deactivate is one button away; email is the UNIQUE column), Cancel
first, `btn--danger` outlined "Erase permanently" second, and the consequence sentence
exported as a const in the `HANDOFF_SENTENCE` idiom:
`"This cannot be undone. Their account and personal details go; their submissions and marks stay in the class record under \"Removed student\"."`

## 6. Export — a JSON body, a client-side file, nothing new under the contract

**Decision.** `GET /api/admin/users/:id/export` (`requireAdmin`) returns an **ordinary JSON
body**; the admin console turns it into a download with the existing Blob + `a.download`
idiom (the gradebook CSV precedent). No `Content-Disposition`, no zip, no streaming — the
contract's "no server export endpoint and no file infrastructure" clause stays intact.
Filename `physide-export-<userId>.json` (ids, not names — names collide and need
sanitising). GET is deliberate: it adds no authority-matrix row.

Contents: the user row (post-`toAuthUser` + `createdAt`/`consentAt`); class memberships;
**projects with full manifests** (their work — §11's "readable file of everything
theirs"); `projectVersions` **metadata only** (2,000 full manifests is not "readable";
recorded as a stated size decision); assignment work, submissions, marks received,
groups/memberships, rule sets, shares (both sides), authored classes/assignments/guides;
their `emails` rows; and **`events WHERE actorId = :id` ONLY** — the export hands a person
their own audit trail and nobody else's. Rows *about* them are overwhelmingly records of a
teacher's actions (every `timeline_viewed`); handing those over would disclose staff
activity wholesale. The export document says this in its own header text, and the privacy
page owes it a sentence (D§7). Marks they *gave* appear as ids/counts through the events
ledger, never as other students' feedback content (fiat — that content belongs to the
marked student's record).

**Admin-only; no self-service** (§10 puts Data requests in the console; §14:434 already
inventories it there). One line to reverse later; recorded.

The **Data requests** tab is the admin console's fifth tab — the existing array-driven
ARIA tablist gains one entry (the pattern is already complete and tested; nothing to
build there), a search box (the People-tab idiom), Export and Erase… actions per result,
and the first `.empty` in `components/admin/`.

## 7. The privacy page — the one new screen

**Decision.** **`/privacy` becomes a real public route** (the welcome-side `WelcomeSubpage`
idiom, linked from the welcome footer and About), carrying: §11's six plain statements
verbatim; §10's honest sentence that an admin can technically see anything; §8.2's
what-we-never-collect list; and the export-scope sentence ("The copy you get contains the
actions you took. It does not contain other people's — including a teacher's record of
opening your timeline, which is theirs to be accountable for, not yours to hold.").
`PrivacyIcon` already exists. The spec cites "the system's own privacy page" three times;
§14 never inventoried it — **this is the ONE new §14 row Plan 8 adds**, via the spec's
dated-note protocol, and the contract amendment must say exactly that ("one new §14 row
(`/privacy`); the bell, the switches and the data-requests tab are already inventoried").

`/about` gains **one appended sentence** in the surveillance-record paragraph (the Plan 7
move, not a rewrite): *"Every person that record is about can ask for all of it: a
complete copy of everything the system holds about them, or its removal — after which
their work in a class record stays, under the name Removed student, and the person does
not."* — with two new positive locks pinning "a complete copy of everything the system
holds about them, or its removal" and "Removed student". All four existing positive locks
and the underclaim ban survive untouched.

## 8. The revoke affordance — Plan 7's carry-forward, closed

**Decision.** The class page (the Assignments tab, beside "Shared with you") gains a
**"Waiting on them"** section: the caller's own outgoing **pending** shares in this class
(recipient name, project title, sent-at), each with a **Revoke** button driving the
existing `POST /api/shares/:id/revoke`; it renders **nothing when empty**. A **teacher**
sees every pending share in the class (sharer → recipient) in the same section — D§8 gave
teachers revoke authority; this gives them the surface. Backed by one new non-mutating
read, `GET /api/shares/roster`-style: **`GET /api/shares/outgoing?classId=`** (active
member; own rows — or all pending rows for the class teacher; names resolved live with the
`REMOVED_STUDENT` fallback). Revocation stays silent in the bell (D§2). The share dialog's
consequence line already told the sharer the pending window exists; this section is where
that promise becomes operable. No new mutating route; no new screen.

## 9. The honesty pass — a contract duty, on a schedule, because nothing breaks to remind you

**Decision.** The copy bans on the bell and data requests are **negative** locks — shipping
the features leaves every suite green while the contract's "nothing shipped may still be
described as absent" clause is breached. So the pass is scheduled as its own task, wrap
stage, same-commit discipline where meta-tests bind:

- `welcomePage.test.js`: delete the `"the notification bell"` and `"admin data requests"`
  NON_CLAIMS groups AND their `sentences` meta-test entries (one commit — the Plan 7 trap).
  The `"real email delivery"` group **stays**, verbatim.
- `welcomeSubpages.test.js`: remove `/notification bell/i`, `/\bbell\b/i`,
  `/data request/i` from `EXCLUDED`; **add the `/privacy` page component to the swept
  pages array** so the three surviving bans (`/rubric/i`, `/real email/i`,
  `/email delivery/i`) police it too; update the three page docblocks naming the bell.
- The About sentence + locks (D§7). The contract amendment (lifting exactly three
  exclusions + the §14 row) lands FIRST, contract-before-code, as its own opening task.

## 10. ESLint — the Plan 1 deferral, discharged bounded

**Decision.** One task: `eslint` 9 flat config at the repo root (`eslint.config.js`),
`eslint-plugin-react-hooks` (the dep already sits inert in frontend) + `eslint-plugin-react`
recommended rules over `frontend/src`, plain `@eslint/js` recommended over `backend/src` +
`shared/src` via `typescript-eslint`, one `npm run lint` script per workspace + root.
Violations are fixed where mechanical and waived with a commented disable where judgment-
laden — the task is bounded by config + script + autofix + targeted disables, never a
rewrite. **Not build-gating in Plan 8** (recorded; §18 forward-reference 7 is *partly*
addressed — the build-wired gate remains open, deliberately, until the violation count is
seen). The stale CRA rationale in Plan 1's note is superseded by this section.

## 11. Shape — the stages

| Stage                          | Delivers                                                                                                                                                                                                                                                    | Depends on                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 0 — contract + spine          | contract amendment (lifts bell/prefs/data-requests, names the one §14 row) + spec §14 dated note; migration 0008 (`notifications`, `notification_prefs`, `users.erasedAt`) + truncate-list + the runbook; `logEvent` returns the event id; ESLint | —                                                          |
| A — the bell (server)         | `notify()` fan-out at the 12 minting sites (same-tx); GET /api/notifications (the one renderer, names live) + POST /api/notifications/read; matrix row (60 = 51 + 9; Stage C's erase route takes it to 61 = 52 + 9)                                       | 0                                                           |
| B — the bell (client) + prefs | `NotificationBell` (DropdownMenu, badge, mark-all-on-open, BELL_POLL_MS) at the two mounts; the Mailer decorator + `notification_prefs` + the Profile switches                                                                                          | A                                                           |
| C — data requests + revoke    | erase (scrub tx + People third state + Overlay confirm); export (JSON + client download); the Data requests tab; "Waiting on them" + GET /api/shares/outgoing                                                                                               | 0 (parallel-safe with A/B server-side, serialized per tree) |
| D — privacy + wrap            | `/privacy` + About sentence/locks; the honesty pass; golden-flow e2e extension (bell + prefs + erase reflected); browser-pass checklist; full gates                                                                                                       | A–C                                                        |

Roughly 15–17 tasks. Implementers strictly serialized per tree (the standing lesson).

## 12. Deliberately NOT in Plan 8

Real email delivery (the postman is Plan 9's; every ban on claiming it stays); retention
automation (§11's 3-year proposal needs cron/cloud — Plan 9-adjacent, and the number
itself is still marked "proposal" in the spec); bell-level mute keys (D§4 fiat — a spec
question); self-service data requests from `/profile`; a notifications history screen or
`/notifications` route; bell rows for `share_revoked`/`share_lapsed`/teacher-signup;
`logEvent` calls for password-reset/teacher-signup (ledger nits, recorded); events-table
indexes (resolved by D§2, not deferred); rubric marking; websockets/push (the bell polls);
GCP/BlobStore; any change to sync mechanics or `SCHEMA_VERSION` (stays 2); the Plan 10
workstreams (mobile audit + gate screen; runner-injected visual defaults + template art
pass — user-ordered, post-Plan-9, no new blocks).

## 13. Design-system and test obligations

Tokens only (`--mono`, never the deprecated `--font-mono`); new portal CSS joins
`platform.css` **before** its trailing `@media (max-width:1024px)` block (the conformance
test asserts the media block stays last); `.badge`/`.empty`/`.alert`/`.tabs` primitives,
no new aliases (`portalControls` sweeps `components/admin`); `BellIcon`/`PrivacyIcon`/
`TrashIcon`/`DownloadIcon` from `Icons.js`, no new glyphs, no emoji anywhere; the one
focus ring; colour never the only channel; every refusal sentence a file-level const
asserted verbatim; every mutation's event inside its transaction; new tables join
`truncateAuthTables` (before `"users"`) in the migration task; the authority matrix gains
its two rows and its re-derived arithmetic in the same task that adds the routes; zod
schemas from `@physics-ide/shared` for every multi-field body.

## 14. Open points resolved by fiat (recorded so the plan can cite them)

1. **Delivery beside the ledger, never inside it** — `notifications` mirrors `shares`;
   `events` stays append-only, unindexed, audience-free (D§2).
2. **Fan-out at write time** — three event types have unrecoverable audiences; the routes
   hold the ids (D§2).
3. **Revoked and lapsed shares are silent in the bell** (D§2).
4. **The five switches gate email only; the bell is never pref-gated** (D§4).
5. **Erasure is an in-place scrub with `erasedAt`; teachers take the same path** (D§5).
6. **One erased-name string for everyone** — the scrub writes the same literal the
   read-time fallback resolves to (D§5).
7. **Group-linked projects survive their owner's erasure** (D§5).
8. **The export is admin-only, JSON, client-side download, actorId-scoped events,
   version metadata only** (D§6).
9. **`/privacy` is the one new §14 row** (D§7).
10. **The bell polls via react-query `refetchInterval` — the tree's first, on purpose**
    (D§3).
11. **Prefs ride `PATCH /api/auth/me`; export rides GET — the matrix gains exactly two
    rows** (D§4/D§6, memo §8.2).
12. **ESLint ships non-gating** (D§10).
