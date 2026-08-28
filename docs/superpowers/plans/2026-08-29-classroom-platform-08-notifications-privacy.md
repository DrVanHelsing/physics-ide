# The Bell, the Preferences, and the Data Requests — Plan 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec §9/§10/§11 delivered: the in-app notification bell over a new delivery table beside the ledger, per-user email switches enforced in one mailer seam, admin data requests (export as a readable file, erasure as an in-place scrub that keeps the class record intact), the privacy page the spec cites three times, the Plan 7 revoke affordance, and the ESLint stack Plan 1 deferred here.

**Architecture:** One new backend plugin (`notificationRoutes`) + one helper (`notify` — fan-out at write time, same transaction as `logEvent`, because the ledger records who acted and never who should be told); one migration (0008: `notifications`, `notification_prefs`, `users.erased_at`); a mailer decorator (`withPreferences`) so thirteen send sites gain the §9 switches with zero route edits; erasure as a PII scrub that never deletes the `users` row (hard delete cascades away the history §11 keeps, and bare-FK-fails on any teacher); export as a plain JSON body downloaded client-side (the gradebook-CSV contract idiom). The bell is a `DropdownMenu` reuse mounted beside `HeaderAccount` — no new screen; `/privacy` is the ONE new §14 row.

**Tech Stack:** Existing monorepo (React 18 + Vite, Fastify 5 + Drizzle + Postgres 16, zod contracts in `shared/`). New dev-deps in the ESLint task only.

**Spec:** `docs/superpowers/specs/2026-08-29-classroom-platform-08-notifications-privacy-design.md` (the build decisions; cite as **D§n**) over `docs/classroom-platform.md` §9/§10/§11 (the product contract; cite as **spec §n**). Where they seem to disagree, the design doc wins — it records the resolutions. Research ground: the Plan 8 research memo (session artifact, 2026-08-29).

## Citation convention — read this before cutting any range

Line numbers below were verified against the tree at the post-hardening commits (`8bdb0c7`/`d3ac91a` era); the hardening batches moved `shares.ts` and `AttributionChip.js`, so **re-grep for the quoted anchor text instead of trusting a stale number** — and if a cited anchor is genuinely gone, stop and check the task's assumptions rather than guessing.

## Global Constraints

- **The corrected frame is binding (D-frame):** all nine §9 email rows already ship. No task builds or edits an email template except where a task names one. The contract amendment lifts EXACTLY three exclusions — the bell, per-user notification preferences, admin data requests — and real email delivery STAYS excluded: no task, test, or copy may claim mail leaves the building.
- **The ledger is untouchable:** `events` gains no index and no column (D§2). The BELL never reads it — `tick.ts`'s once-a-day dedupe scan and Task 10's export (`actorId = :id`, an admin-triggered one-off) are the only readers, both deliberate and both fine unindexed at 200 users. `logEvent`'s one permitted change is Task 2's `.returning({ id })`.
- **Every mutation's event is written inside the same transaction; every `notify()` fan-out rides that same transaction.** Refusal sentences are file-level consts asserted verbatim by tests. Every route body with more than one field validates via a zod schema from `@physics-ide/shared`.
- **Backend/shared/frontend discipline:** `npm run typecheck -w backend && npm run typecheck -w shared` green at every commit; new tables join `truncateAuthTables()` (before `"users"`) in the migration task; the authority matrix's arithmetic and per-file tally are re-derived in the SAME task that adds each mutating route (Task 4: 60 = 51 + 9; Task 9: 61 = 52 + 9).
- **Design system (spec §18):** tokens only — `--mono`, never the deprecated `--font-mono`; new portal CSS joins `frontend/src/styles/platform.css` **before** its trailing `@media (max-width: 1024px)` block — a HOUSE RULE the conformance suite does not mechanically enforce (its media-block-last test compares against two named selectors only), so the implementer and the reviewer check placement by eye; `.badge`/`.empty`/`.alert`/`.tabs` primitives, no new aliases (`portalControls.test.js` sweeps `components/admin`); icons from `Icons.js` only (`BellIcon:157`, `PrivacyIcon`, `TrashIcon`, `DownloadIcon` exist — no new glyphs); **no emoji anywhere**; one focus ring; colour never the only channel; destructive actions use the outlined `btn--danger`, never filled red.
- **The IDE mounts once at `/`;** the bell is a dropdown inside the two existing headers — no `/notifications` route, no third header, no new mount for guests (the bell renders `null` signed-out; every task leaves the guest IDE byte-identical).
- **Erasure never issues `DELETE FROM users`** (D§5). One erased-name string for everyone: the scrub writes the same literal the read-time fallback resolves to.
- **Truth in copy:** the ban moves (bell, data requests) happen ONLY in the wrap task (Task 14), after the features are green; the contract amendment (Task 1) moves first — contract before code. The real-email bans are DO-NOT-TOUCH in every task.
- **Postgres runbook (memo §6):** the container is `physicside-db-1`; after any `schema.ts` edit run `npm run db:generate -w backend` (drizzle names the file — never hand-name or hand-edit), then `npm run db:migrate` FROM THE ROOT (migrates dev AND test DBs). Tests do not migrate themselves.

## Stage ownership — the execution order

Stages land in order; a stage opens only when the previous one's gate (its last task's full-suite run) is green. Tasks inside a stage are sequential; implementers strictly serialized per tree.

| Stage | Tasks | Theme |
|---|---|---|
| 0 — contract + spine | 1–3 | the amendment + §14 note; migration 0008 + `logEvent` id + runbook; ESLint |
| A — the bell (server) | 4–5 | the notifications plugin (routes + renderer + matrix row); the 11-site fan-out (gate) |
| B — the bell (client) + prefs | 6–8 | `NotificationBell` at both mounts; the mailer decorator; the Profile switches |
| C — data requests + revoke | 9–12 | erase (scrub + matrix row); export; the Data requests tab + People third state; Waiting on them |
| D — privacy + wrap | 13–15 | `/privacy` + About locks; the honesty pass; golden-flow e2e + checklist + gates |

## Deferred — deliberately NOT here, do not flag as missing

Everything in design §12, verbatim in intent: real email delivery (Plan 9 — the postman, not the table); retention automation (§11's 3-year figure is still a proposal, and the machinery is cron/cloud); bell-level mute keys (the five switches gate EMAIL only, D§4); self-service data requests from `/profile`; a notifications history screen or `/notifications` route; bell rows for `project.share_revoked` / `project.share_lapsed` / the teacher-signup alert (D§2 fiat — silent); `logEvent` calls for password-reset / teacher-signup (ledger nits, recorded); events-table indexes (RESOLVED by D§2, not deferred — the bell never reads the ledger); rubric marking; websockets or push (the bell polls); GCP/BlobStore; `SCHEMA_VERSION` (stays 2); both Plan 10 workstreams (mobile audit + gate; runner visual defaults + template art pass — user-ordered, post-Plan-9).

---
## Stage 0 — contract + spine

### Task 1: The contract amendment and the §14 dated note — contract before code

**Files:**
- Modify: `docs/product-contract.md` (the exclusion sentence + a new amendment block)
- Modify: `docs/classroom-platform.md` (one §14 row + one dated note)

**Interfaces:**
- Consumes: the design doc's D§1–D§10.
- Produces: the amendment block later tasks cite; the exclusion sentence no longer lists the bell, preferences, or data requests; §14 inventories `/privacy`.

- [ ] **Step 1: Edit the exclusion sentence.** Grep `docs/product-contract.md` for `Design §9's exclusions stand` (~line 162). Delete exactly the phrase `the notification bell and per-user notification preferences, admin data requests, ` from that sentence — `rubric marking`, `real email delivery (mail goes to the pretend inbox — the admin console's Emails tab)`, `the GCP port, BlobStore, and websockets / live co-editing` all stand unchanged.

- [ ] **Step 2: Append the amendment block** directly after the peer-sharing amendment's final bullet (grep `No notification of any kind` and insert after that block's section), verbatim:

```markdown
**Notifications and data-care amendment (29 August 2026).** The notification bell, per-user notification preferences, and admin data requests are lifted from the exclusions above, exactly as decided in `docs/superpowers/specs/2026-08-29-classroom-platform-08-notifications-privacy-design.md`. Locked rows:

- **The bell is a dropdown, not a screen** (D§1): the product's one `DropdownMenu`, mounted beside the account menu in the two existing headers; it renders nothing for a guest. No `/notifications` route exists.
- **Delivery lives beside the ledger, never inside it** (D§2): a `notifications` table fanned out per recipient at write time, in the same transaction as the event. `events` stays append-only, unindexed, audience-free — the bell never reads the ledger, so Plan 7's no-events-indexes deferral is resolved, not revisited.
- **Revoked and lapsed shares are silent in the bell** (D§2); the ledger keeps every row.
- **The five §9 switches gate email only** (D§4), enforced in one mailer decorator; essential mail (confirm, reset, teacher alert, invites) is ungated by construction; the bell is never preference-gated.
- **Erasure is an in-place scrub** (D§5): the `users` row survives with `name = "Removed student"`, a sentinel email, `active = false` and `erased_at` set; sessions, tokens, memberships, deliveries and owned non-group projects go; submissions, marks and the events ledger stay — §11's "the class's marks history stays intact" implemented literally. Teachers take the same path.
- **Export is admin-only, a plain JSON body, downloaded client-side** (D§6) — the gradebook-CSV idiom; no server file infrastructure. Its `events` section carries `actorId = the person` rows ONLY: a person receives their own audit trail and nobody else's.
- **`/privacy` is the ONE new §14 row** (D§7); the bell, the switches and the data-requests tab were already inventoried at §14's Notifications panel, Profile & settings, and Admin console rows.
- **Real email delivery remains excluded** — nothing here connects a postman.
- **This amendment supersedes one row of the peer-sharing amendment:** its "No notification of any kind (D§10)" clause described Plan 7's shipped state; from this amendment on, `project.shared` and `project.share_accepted` mint bell rows, while revocation and lapse stay silent (the sharing design's pull-based discovery survives for those two).
```

- [ ] **Step 3: The §14 row + dated note.** In `docs/classroom-platform.md`'s §14 "Everyone" table (grep `Notifications panel`), add a row after Profile & settings: `| Privacy page | §11's plain statements, §8.2's never-collected list, the honest admin-visibility sentence, and what an export contains — public, no sign-in |`. Then add a dated note after the 28 August note (grep `**28 August 2026**`): `**29 August 2026** — Plan 8 (notifications + data care, sections 9–11): §14 gains one row — the privacy page the spec already cited three times (§8.2, §10, §11). The bell, the notification switches and the data-requests tab shipped inside screens §14 already inventoried. Decisions recorded in product-contract.md's notifications-and-data-care amendment.`

- [ ] **Step 4: Commit**

```bash
git add docs/product-contract.md docs/classroom-platform.md
git commit -m "docs(contract): Plan 8 amendment - bell, preferences and data requests lifted; /privacy is the one new screen row"
```

---

### Task 2: Migration 0008 — `notifications`, `notification_prefs`, `users.erased_at`; `logEvent` returns its id

**Files:**
- Modify: `backend/src/db/schema.ts` (two tables appended after `shares`; one column on `users`)
- Modify: `backend/src/db/events.ts` (`logEvent` returns the inserted id)
- Modify: `backend/src/db/testClient.ts` (truncate list gains both tables before `"users"`)
- Generated: `backend/drizzle/0008_<drizzle-names-it>.sql`

**Interfaces:**
- Consumes: the house idiom (text pseudo-enums in comments, timestamptz, jsonb; `bigserial` per `events`).
- Produces: `notifications` and `notificationPrefs` tables (exact columns below — every later backend task builds on them); `users.erasedAt`; `logEvent(...): Promise<number>` (the event id).

- [ ] **Step 1: Append the two tables after `shares`** in `backend/src/db/schema.ts`:

```ts
/** Plan 8 (spec §9, design D§2): DELIVERY for the in-app bell — one row per
 *  recipient, fanned out AT WRITE TIME in the same transaction as the event,
 *  because the events ledger records who ACTED and never who should be told
 *  (three bell-relevant event types store no recoverable audience at all).
 *  THE LEDGER IS NOT THIS TABLE: `events` stays append-only, unindexed and
 *  audience-free — the bell reads here, never there. user_id cascades on a
 *  real user delete; under the D§5 erasure scrub the rows are deleted
 *  explicitly (delivery state, not history). */
export const notifications = pgTable(
  "notifications",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: bigint("event_id", { mode: "number" })
      .notNull()
      .references(() => events.id),
    /** Denormalised so the bell renders without joining events. */
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.id.desc()),
    index("notifications_user_unread_idx")
      .on(t.userId, t.id.desc())
      .where(sql`"read_at" IS NULL`),
  ],
);

/** Plan 8 (spec §9, design D§4): the five email switches. Keys are the email
 *  TEMPLATE strings verbatim (submission-receipt, marks-released,
 *  work-returned, due-tomorrow, due-reminder) — an absent row means the
 *  default, ON, so adding a key never needs a backfill. These gate EMAIL
 *  only; the bell is never preference-gated (D§4). */
export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    enabled: boolean("enabled").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
```

(`bigint` and `primaryKey` join the drizzle imports at `schema.ts:1` if not present; `sql`, `bigserial`, `index` are already there.)

- [ ] **Step 2: The `erasedAt` column.** In `users`, after `consentAt`:

```ts
  /** Plan 8 (spec §11, design D§5): set by the admin erase route's in-place
   *  scrub — the ONLY way to tell an erased row from a deactivated one.
   *  Erasure never deletes this row: hard delete would cascade away the
   *  submissions and marks §11 keeps, and bare-FK-fail on any teacher. */
  erasedAt: timestamp("erased_at", { withTimezone: true }),
```

- [ ] **Step 3: `logEvent` returns its id.** In `backend/src/db/events.ts`, change the body to `const [row] = await db.insert(events).values({ type, actorId, payload }).returning({ id: events.id }); return row.id;` and the return type to `Promise<number>`. Every existing call site ignored the `void` return — nothing else changes; add one comment line: `Returns the event id so notify() (Plan 8) can reference the ledger row it fans out for.`

- [ ] **Step 4: Generate and apply** — `npm run db:generate -w backend` (inspect: two CREATE TABLE, two FKs — notifications→users cascade, notifications→events no action — three CREATE INDEX incl. the partial, one ALTER TABLE users ADD COLUMN), then `npm run db:migrate` from the ROOT (both DBs).

- [ ] **Step 5: Truncate list.** In `backend/src/db/testClient.ts`, add `"notifications", "notification_prefs", ` to the TRUNCATE list before `"shares"` (both must precede `"users"`; `settings` stays absent — do not "fix" it).

- [ ] **Step 6: Run to pass** — `npm run test -w backend` green (existing suites over the migrated DB), `npm run typecheck -w backend` clean.

- [ ] **Step 7: Commit**

```bash
git add backend/src backend/drizzle
git commit -m "feat(db): migration 0008 - notifications delivery, the five switches, users.erased_at; logEvent returns its id"
```

---

### Task 3: ESLint — the Plan 1 deferral, discharged bounded (D§10)

**Files:**
- Create: `eslint.config.js` (repo root, flat config)
- Modify: root `package.json` (devDeps + `lint` script), `frontend/package.json`, `backend/package.json`, `shared/package.json` (per-workspace `lint` scripts)
- Modify: source files ONLY where a violation is fixed or waived with a commented disable

**Interfaces:**
- Consumes: `eslint-plugin-react-hooks` (already an inert frontend devDep).
- Produces: `npm run lint` (root — runs all three workspaces) exiting 0. NOT wired into the build or test gate (recorded: spec §18 forward-reference 7 stays open for the build-wired half, deliberately, until the violation count has been seen across a few plans).

- [ ] **Step 1: Install** — root devDeps: `eslint@^9`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react@^7`, `globals`; keep frontend's existing `eslint-plugin-react-hooks`.
- [ ] **Step 2: `eslint.config.js`** — flat config, three blocks: `@eslint/js` recommended + `typescript-eslint` recommended over `backend/src/**/*.ts` and `shared/src/**/*.ts` (parserOptions project-less — no type-aware rules in this pass); `@eslint/js` recommended + react + react-hooks recommended over `frontend/src/**/*.js` (jsx enabled, `globals.browser`, react version detect); a global `ignores` for `node_modules`, `dist`, `backend/drizzle`, `frontend/public/vendor`, `frontend/e2e`, `**/*.test.*`, `**/__tests__/**` (tests are policed by vitest conventions, not lint, in this pass — recorded).
- [ ] **Step 3: Scripts** — each workspace: `"lint": "eslint src"` (backend/shared: `"lint": "eslint src --ext .ts"` is unnecessary under flat config — plain `eslint src`); root: `"lint": "npm run lint -w shared && npm run lint -w backend && npm run lint -w frontend"`.
- [ ] **Step 4: Drive to zero** — run root lint; fix mechanical violations (unused vars → prefix `_` or remove; `no-undef` via globals config); for judgment-laden hits add a same-line `// eslint-disable-next-line <rule> -- <one-clause reason>`. If a rule fires >20 times for house-style reasons (e.g. `react/prop-types` in a PropTypes-free codebase), turn the RULE off in the config with a one-line comment instead of 20 disables. The task is bounded by config + script + autofix + targeted disables — never a rewrite, never a behavior change.
- [ ] **Step 5: Full suites still green** — `npm run test -w shared && npm run test -w backend && npm run test -w frontend` (lint fixes must not change behavior), typechecks clean.
- [ ] **Step 6: Commit**

```bash
git add eslint.config.js package.json package-lock.json frontend/package.json backend/package.json shared/package.json backend/src frontend/src shared/src
git commit -m "chore(lint): eslint 9 flat config across the three workspaces - the Plan 1 deferral discharged, non-gating by design"
```

---
## Stage A — the bell (server)

### Task 4: The notifications plugin — `notify`, the two routes, the one renderer, the matrix row

**Files:**
- Create: `backend/src/notifications/notify.ts`
- Create: `backend/src/routes/notifications.ts`
- Create: `backend/src/routes/notifications.test.ts`
- Modify: `backend/src/app.ts` (import + `app.register(notificationRoutes);` after `shareRoutes`)
- Modify: `backend/src/routes/authority.matrix.test.ts` (one row; arithmetic 59→60; per-file tally gains `notifications.ts 1`; header comment re-derived)

**Interfaces:**
- Consumes: `logEvent` returning the event id (Task 2); tables `notifications`, `users`, `assignments`, `classes` (Task 2 + existing); `requireConfirmed`.
- Produces (Task 5 and the client consume these exactly): `notify(db, userIds: string[], eventId: number, type: string, payload?: Record<string, unknown>): Promise<void>`; `GET /api/notifications?limit=` → `{ notifications: [{id, type, text, href, createdAt, readAt}], unreadCount }`; `POST /api/notifications/read` `{ ids?: number[] }` → `{ ok: true }`.

- [ ] **Step 1: Write `backend/src/notifications/notify.ts`:**

```ts
import { notifications } from "../db/schema.js";
import type { DbLike } from "../db/events.js";

/** Fan-out AT WRITE TIME, in the same transaction as the event (design D§2):
 *  the ledger records who acted and never who should be told — three
 *  bell-relevant event types store no recoverable audience at all, so the
 *  route that holds the recipient ids writes the delivery rows itself.
 *  `payload` is the RENDERER'S input, built at the call site — it need not
 *  equal the event payload (e.g. class.joined adds joinerId). Ids only,
 *  plus content titles; never a person's name (resolved at read, §11). */
export async function notify(
  db: DbLike,
  userIds: string[],
  eventId: number,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  if (userIds.length === 0) return;
  await db.insert(notifications).values(
    userIds.map((userId) => ({ userId, eventId, type, payload })),
  );
}
```

(If `DbLike` is not exported from `events.ts`, export it there in this step — it is the existing internal type `logEvent` already accepts.)

- [ ] **Step 2: Write the failing suite** — `notifications.test.ts`, the `groups.test.ts` idiom (`buildApp({ db: testDb })`, `makeUser`/`signin`, `beforeAll` truncate). Fixtures: one class, a teacher, two students (alpha, bravo). Cases:
  - Anonymous GET → 401; unconfirmed → 403 (the guard).
  - Empty state: `{ notifications: [], unreadCount: 0 }`.
  - Seed via the real helpers inside a transaction: `const eid = await logEvent(tx, "assignment.published", teacher.id, { assignmentId }); await notify(tx, [alpha.id], eid, "assignment.published", { assignmentId, classId });` (a real `assignments` row backs `assignmentId`). Alpha's GET returns one row whose `text` is exactly `` `New assignment in ${className}: “${title}”` ``, whose `href` is `/classes/${classId}/assignments/${assignmentId}` (the app's ONLY assignment route shape — App.js nests assignments under the class; there is no `/assignments/:id` route), `readAt: null`, `unreadCount: 1`. Bravo's GET stays empty (addressing is per-row).
  - A `project.shared` row (payload `{ shareId, classId, sharerId, title: "Pendulum" }`) renders `` `${sharerName} shared “Pendulum” with you` `` — then delete the sharer's users row directly and assert the SAME GET now renders `Removed student shared “Pendulum” with you` (the live-resolution property).
  - A row whose `assignmentId` no longer resolves (delete the assignment row directly) renders the generic fallback text for its type — never a 500, never a dropped row.
  - Ordering: two rows, newest first (index compare). `?limit=1` returns one row but `unreadCount` still counts both unread.
  - `POST /api/notifications/read` with no body marks ALL of the caller's unread read (`unreadCount: 0`, `readAt` set); with `{ ids: [firstId] }` marks only that one. Another user's rows are untouched (scope by `userId` — seed one for bravo and assert it survives alpha's mark-all).

- [ ] **Step 3: Run to fail** — route absent, 404s.

- [ ] **Step 4: Write `backend/src/routes/notifications.ts`:**

```ts
import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { assignments, classes, notifications, users } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { REMOVED_STUDENT } from "./shares.js";

type NotificationRow = typeof notifications.$inferSelect;

/** One renderer, one place (design D§3): the server builds the sentence so
 *  names resolve live (an erased person reads "Removed student" everywhere,
 *  §11's one place to act) and the client renders strings, never id-joins.
 *  Deleted referents render the generic sentence for the type — never a
 *  500, never a dropped row. */
const FALLBACK_TEXT: Record<string, string> = {
  "assignment.published": "A new assignment was published",
  "assignment.marks_released": "Marks were released",
  "assignment.mark_returned": "Work was returned for changes",
  "assignment.group_mark_returned": "Work was returned for changes",
  "assignment.due_reminder_sent": "An assignment is due tomorrow",
  "assignment.reminded": "A reminder from your teacher",
  "assignment.submitted": "A submission was received",
  "class.joined": "Someone joined your class",
  "class.join_requested": "Someone asked to join your class",
  "invite.accepted": "Someone joined your class",
  "project.shared": "A project was shared with you",
  "project.share_accepted": "Your shared project was added",
};

async function renderAll(db: FastifyInstance["db"], rows: NotificationRow[]) {
  const p = (r: NotificationRow) => r.payload as Record<string, string | number | undefined>;
  const assignmentIds = [...new Set(rows.map((r) => p(r).assignmentId).filter(Boolean))] as string[];
  const classIds = [...new Set(rows.map((r) => p(r).classId).filter(Boolean))] as string[];
  const personIds = [
    ...new Set(rows.flatMap((r) => [p(r).sharerId, p(r).recipientId, p(r).joinerId]).filter(Boolean)),
  ] as string[];
  const [aRows, cRows, uRows] = await Promise.all([
    assignmentIds.length
      ? db.select({ id: assignments.id, title: assignments.title }).from(assignments).where(inArray(assignments.id, assignmentIds))
      : [],
    classIds.length
      ? db.select({ id: classes.id, name: classes.name }).from(classes).where(inArray(classes.id, classIds))
      : [],
    personIds.length
      ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, personIds))
      : [],
  ]);
  const aTitle = new Map(aRows.map((r) => [r.id, r.title]));
  const cName = new Map(cRows.map((r) => [r.id, r.name]));
  const uName = new Map(uRows.map((r) => [r.id, r.name]));
  const person = (id: unknown) => (id ? uName.get(id as string) ?? REMOVED_STUDENT : REMOVED_STUDENT);

  return rows.map((r) => {
    const d = p(r);
    const title = d.assignmentId ? aTitle.get(d.assignmentId as string) : undefined;
    const cls = d.classId ? cName.get(d.classId as string) : undefined;
    let text: string | undefined;
    switch (r.type) {
      case "assignment.published":
        if (title && cls) text = `New assignment in ${cls}: “${title}”`;
        break;
      case "assignment.marks_released":
        if (title) text = `Marks released: “${title}”`;
        break;
      case "assignment.mark_returned":
      case "assignment.group_mark_returned":
        if (title) text = `Work returned for changes: “${title}”`;
        break;
      case "assignment.due_reminder_sent":
        if (title) text = `Due tomorrow: “${title}”`;
        break;
      case "assignment.reminded":
        if (title) text = `Reminder from your teacher: “${title}”`;
        break;
      case "assignment.submitted":
        if (title) {
          const attempt = typeof d.attempt === "number" && d.attempt > 1 ? ` (attempt ${d.attempt})` : "";
          text = `Submission received: “${title}”${attempt}`;
        }
        break;
      case "class.joined":
      case "invite.accepted":
        if (cls) text = `${person(d.joinerId)} joined ${cls}`;
        break;
      case "class.join_requested":
        if (cls) text = `${person(d.joinerId)} asked to join ${cls}`;
        break;
      case "project.shared":
        text = `${person(d.sharerId)} shared “${d.title ?? "a project"}” with you`;
        break;
      case "project.share_accepted":
        text = `${person(d.recipientId)} added “${d.title ?? "a project"}” to their projects`;
        break;
    }
    /* href: exactly two shapes, matching App.js's route table — assignments
       are NESTED UNDER THE CLASS (/classes/:id/assignments/:aid; there is
       no /assignments/:id route, and the catch-all would bounce to the
       IDE). Every assignment payload in the Task 5 site table carries both
       ids for exactly this reason. */
    const href =
      d.assignmentId && d.classId
        ? `/classes/${d.classId}/assignments/${d.assignmentId}`
        : d.classId
          ? `/classes/${d.classId}`
          : "/classes";
    return {
      id: r.id,
      type: r.type,
      text: text ?? FALLBACK_TEXT[r.type] ?? "Something happened",
      href,
      createdAt: r.createdAt.getTime(),
      readAt: r.readAt ? r.readAt.getTime() : null,
    };
  });
}

export function notificationRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.get("/api/notifications", async (req) => {
    const limit = Math.min(Number((req.query as { limit?: string }).limit) || 30, 100);
    const rows = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.id))
      .orderBy(desc(notifications.id))
      .limit(limit);
    const [{ n: unreadCount }] = await app.db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, req.user!.id), isNull(notifications.readAt)));
    return { notifications: await renderAll(app.db, rows), unreadCount };
  });

  app.post("/api/notifications/read", async (req) => {
    const parsed = z.object({ ids: z.array(z.number().int()).optional() }).safeParse(req.body ?? {});
    const ids = parsed.success ? parsed.data.ids : undefined;
    await app.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        ids && ids.length
          ? and(eq(notifications.userId, req.user!.id), inArray(notifications.id, ids))
          : and(eq(notifications.userId, req.user!.id), isNull(notifications.readAt)),
      );
    return { ok: true };
  });
}
```

- [ ] **Step 5: Register + matrix.** `app.ts`: `import { notificationRoutes } from "./routes/notifications.js";` + register after `shareRoutes`. `authority.matrix.test.ts`: one new row — `name: "POST /api/notifications/read"`, `expect: { anon: ANON, unconfirmed: UNCONFIRMED }` (the blessed self-scoped single-shape; the file's own comment allows it) — arithmetic 59→60 (51 rows + 9 skips), per-file tally gains `notifications.ts 1`, header comment re-derived.

- [ ] **Step 6: Run to pass** — new suite + matrix + full backend green, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add backend/src
git commit -m "feat(backend): the notifications plugin - fan-out helper, the list and read routes, one renderer with live names"
```

---

### Task 5: The 12-type fan-out — every minting route writes its deliveries in the same transaction

**Files:**
- Modify: `backend/src/routes/assignments.ts` (6 sites), `backend/src/routes/members.ts` (1 dual-type site), `backend/src/routes/invites.ts` (1 site), `backend/src/routes/shares.ts` (2 sites), `backend/src/routes/tick.ts` (1 site)
- Modify: their test files (`assignments.test.ts`, `members.test.ts`, `invites.test.ts`, `shares.test.ts`, and the tick suite — extend each)

**Interfaces:**
- Consumes: `notify` (Task 4); `logEvent` returning the event id (Task 2).
- Produces: the minting map below — the bell's entire content. D§2's fiat stands: `project.share_revoked`, `project.share_lapsed` and the teacher-signup alert mint NOTHING — do not add them.

**The site table.** At each site the existing `logEvent(tx, ...)` call becomes `const eid = await logEvent(tx, ...)` followed by ONE `notify(tx, recipients, eid, type, payload)` in the SAME transaction. Recipients come from data the route already holds — grep the anchor text, never trust line numbers:

| # | Site (grep anchor) | Type | Recipients (already in scope or one select) | Notification payload |
|---|---|---|---|---|
| 1 | `assignments.ts` `"assignment.published"` | same | active students of the class — one select in the publish transaction: `classMembers WHERE classId AND status='active' AND role='student'` | `{ assignmentId, classId: a.classId }` |
| 2 | `assignments.ts` `"assignment.marks_released"` | same | the release route's own `releasable.map((r) => r.studentId)` | `{ assignmentId, classId: a.classId }` |
| 3 | `assignments.ts` `"assignment.mark_returned"` | same | `[studentId]` | `{ assignmentId, classId: a.classId }` |
| 4 | `assignments.ts` `"assignment.group_mark_returned"` | same | the group's member ids (the route already loads them for its email fan-out) | `{ assignmentId, classId: a.classId }` |
| 5 | `assignments.ts` `"assignment.reminded"` | same | the `recipients` list the route computed (missing students) | `{ assignmentId, classId: a.classId }` |
| 6 | `assignments.ts` `"assignment.submitted"` | same | the credited ids (the submission's `creditedIds` — every member for group work) | `{ assignmentId, classId: a.classId, attempt }` |
| 7 | `tick.ts` `DUE_REMINDER_SENT` | `assignment.due_reminder_sent` | `[student.id]` (the tick's per-student loop; actor stays `null`) | `{ assignmentId: a.id, classId: a.classId }` (the classId comes from the ASSIGNMENT row `a` — the roster helper returns only id/name/email) |
| 8 | `members.ts` the `class.joined` / `class.join_requested` ternary | same two | the class's active TEACHERS: `classMembers WHERE classId AND role='teacher' AND status='active'` | `{ classId, joinerId: req.user!.id }` |
| 9 | `invites.ts` `"invite.accepted"` | same | the class's active TEACHERS (same select as site 8 — an invited member lands ACTIVE without passing the join route, so this is the quiet joined event's second door) | `{ classId, joinerId: <the accepting user's id, in scope in the accept transaction> }` |
| 10 | `shares.ts` `"project.shared"` | same | `[parsed.data.recipientId]` | `{ shareId: created.id, classId: parsed.data.classId, sharerId: req.user!.id, title: (sourceHead.manifest as { title?: string }).title ?? "Untitled project" }` (`created` is the route's post-savepoint alias — the savepoint-scoped `row` binding is not safely readable at the logEvent site) |
| 11 | `shares.ts` `"project.share_accepted"` | same | `[share.sharerId]` | `{ shareId: share.id, classId: share.classId, recipientId: req.user!.id, title: (checked.data as { title?: string }).title ?? "Untitled project" }` |

(Site 8 is one call site with a ternary type — pass the same ternary to `notify`. Where a site's transaction variable is `sp`/`tx`, pass that — `notify` accepts any `DbLike`. Twelve types across eleven edits: site 8 carries two.)

- [ ] **Step 1: Failing tests first, one per site**, in each route's existing suite: drive the route the normal way (the suites already own fixtures for publish/release/return/remind/submit/join/invite-accept/share/accept), then assert the exact `notifications` rows — recipient set, `type`, payload keys, and `eventId` pointing at the matching `events` row. Negative assertions where the map excludes someone: the publish fan-out does NOT include the teacher or a waiting member; the joined fan-out does NOT include the joiner or a fellow student; **revoke and switch-off-lapse mint ZERO rows** (drive both, assert the `notifications` count unchanged — pinning the D§2 fiat in the suite that owns those routes).
- [ ] **Step 2: Implement all eleven edits.** Every site already logs inside a transaction — including `tick.ts`, whose `logEvent` sits inside the advisory-locked transaction that makes single-send provable (its own comment says so). Add `notify(tx, …)` immediately beside each existing `logEvent(tx, …)` and change NO transaction boundary anywhere, least of all tick's.
- [ ] **Step 3: Stage A gate** — `npm run test -w backend && npm run typecheck -w backend && npm run typecheck -w shared` all green.
- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat(backend): the 11-type fan-out - every minting route writes its deliveries beside its ledger row"
```

---
## Stage B — the bell (client) + the preferences

### Task 6: `NotificationBell` — the dropdown at both mounts, mark-all on open, the poll

**Files:**
- Create: `frontend/src/components/layout/NotificationBell.js`
- Create: `frontend/src/components/layout/__tests__/notificationBell.test.js`
- Modify: `frontend/src/components/layout/PortalHeader.js` (mount before `<HeaderAccount />`), `frontend/src/components/layout/__tests__/PortalHeader.test.js` (the right-cluster order expectation widens)
- Modify: `frontend/src/components/Toolbar.js` (mount before `<HeaderAccount />` inside `.app-header__account`)
- Modify: `frontend/src/components/common/DropdownMenu.js` (gains the optional `onOpenChange(open)` callback — see Step 2)
- Modify: the three suites that mount Toolbar without a QueryClientProvider (grep `vi.mock` of HeaderAccount across `frontend/src/components/__tests__` — `Toolbar.test.js` and its siblings): each gains the one-line house stub `vi.mock("../layout/NotificationBell", () => ({ default: () => null }));` beside the HeaderAccount mock they already carry (the bell calls `useQuery` unconditionally)
- Modify: `frontend/src/styles/platform.css` (a small `.bell-*` block, inserted BEFORE the trailing `@media (max-width: 1024px)` block)

**Interfaces:**
- Consumes: `GET /api/notifications` + `POST /api/notifications/read` (Task 4); `DropdownMenu` (`trigger, children, align, title, triggerAriaLabel, triggerClassName, chevron`); `BellIcon` (`Icons.js:157`); `useMe`.
- Produces: `<NotificationBell />` (no props) and `export const BELL_POLL_MS = 60 * 1000;` — the tree's FIRST `refetchInterval` use, deliberate (D§3), named beside BatonChip's `BATON_POLL_MS` precedent.

- [ ] **Step 1: Failing tests** — `notificationBell.test.js`, the mocked react-query idiom (`vi.mock("@tanstack/react-query")`, mocked `useMe`, mocked `react-router-dom` `useNavigate`): guest (`useMe` → `{ data: null }`) renders `null` (assert `container.firstChild` null, and the query is DISABLED — `enabled: false` reaches `useQuery`); signed-in with `unreadCount: 3` renders the trigger with a `.badge` reading `3` and `triggerAriaLabel` `Notifications, 3 unread`; `unreadCount: 0` renders no badge and the label `Notifications`; opening the menu (drive the real DropdownMenu trigger click — do not mock it; it is a plain component) renders both rows' `text` strings and fires the read mutation exactly ONCE via `onOpenChange(true)` (a re-open with zero unread fires nothing); clicking a row calls `navigate` with the row's `href` AND closes the menu (the cloned close-on-select — asserting it proves the rows are direct children); empty list renders the disabled row carrying `Nothing yet — marks, reminders and shares will land here.` (exported const `BELL_EMPTY`). One more: `DropdownMenu` with no `onOpenChange` prop behaves exactly as before (add this case to the dropdown's own test file if it has one — grep — else cover it here).

- [ ] **Step 2: Implement.** `DropdownMenu` clones `role="menuitem"` + close-on-select onto its DIRECT children (`React.Children.map` + `cloneElement` — its docblock says so). Two consequences that shape the bell: the row buttons must BE direct children (a wrapper panel component would swallow the injected role/close behaviour), and mark-all-on-open therefore needs a hook on the menu's own state — add an optional `onOpenChange(open)` prop to `DropdownMenu` (one `useEffect` beside its existing `open` state, called with the new value; an API addition to the one implementation, not a new popover; no existing caller passes it). The component:

```jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DropdownMenu from "../common/DropdownMenu";
import { BellIcon } from "../Icons";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

/** The bell (spec §9, design D§1/D§3): a DropdownMenu reuse, never a new
 *  popover; polls on react-query's refetchInterval — the tree's first,
 *  deliberately (BatonChip's raw interval exists for its side-effectful
 *  poll; the bell has none, and mark-as-read wants invalidateQueries). */
export const BELL_POLL_MS = 60 * 1000;
export const BELL_EMPTY = "Nothing yet — marks, reminders and shares will land here.";
export const NOTIFICATIONS_KEY = ["notifications"];

export default function NotificationBell() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => api("/api/notifications"),
    refetchInterval: BELL_POLL_MS,
    enabled: !!me,
  });
  const markAll = useMutation({
    mutationFn: () => api("/api/notifications/read", { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
  });
  if (!me) return null;
  const unread = q.data?.unreadCount ?? 0;
  const rows = q.data?.notifications ?? [];
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <DropdownMenu
      align="right"
      chevron={false}
      triggerAriaLabel={label}
      triggerClassName="tb-btn bell-trigger"
      onOpenChange={(open) => {
        if (open && unread > 0 && !markAll.isPending) markAll.mutate();
      }}
      trigger={
        <span className="bell-trigger__inner">
          <BellIcon size={16} />
          {unread > 0 ? <span className="badge badge--accent bell-badge">{unread > 9 ? "9+" : unread}</span> : null}
        </span>
      }
    >
      {rows.length === 0 ? (
        <button type="button" className="tb-dropdown-item bell-empty" disabled>
          {BELL_EMPTY}
        </button>
      ) : (
        rows.map((n) => (
          <button
            key={n.id}
            type="button"
            className={n.readAt ? "tb-dropdown-item bell-item" : "tb-dropdown-item bell-item bell-item--unread"}
            onClick={() => navigate(n.href)}
          >
            <span className="bell-item__text">{n.text}</span>
            {n.readAt ? null : <span className="bell-item__dot" aria-hidden="true" />}
          </button>
        ))
      )}
    </DropdownMenu>
  );
}
```

(The rows are DIRECT children, so each button receives the cloned `role="menuitem"` and close-on-select for free — the same contract every existing menu item gets. The `useEffect` import in the component's import block is not needed — import only what the final code uses.)

(Colour is never the only channel: unread rows carry the dot glyph AND the `--unread` weight class, not a tint alone.)

- [ ] **Step 3: The two mounts.** `PortalHeader.js`: `<NotificationBell />` between `<ThemeToggleButton .../>` and `<HeaderAccount />`; widen `PortalHeader.test.js`'s right-cluster order assertion to ThemeToggle → NotificationBell → HeaderAccount. `Toolbar.js`: same sibling insertion inside `.app-header__account` before `<HeaderAccount />` (grep `app-header__account`). The IDE mounts inside the app Router — `useNavigate` is available at both sites; verify once with the existing HeaderAccount usage beside it.

- [ ] **Step 4: CSS** — in `platform.css`, BEFORE the trailing `@media (max-width: 1024px)` block:

```css
/* ── Plan 8 — the bell (design D§1/D§3) ─────────────────────────────── */
.bell-trigger__inner { position: relative; display: inline-flex; align-items: center; }
.bell-badge { position: absolute; top: calc(-1 * var(--space-2)); right: calc(-1 * var(--space-2)); font-size: var(--fs-xs); }
.bell-item { display: flex; align-items: center; gap: var(--space-2); max-width: 44ch; white-space: normal; text-align: left; }
.bell-item--unread .bell-item__text { font-weight: var(--fw-medium); }
.bell-item__dot { inline-size: 6px; block-size: 6px; border-radius: 50%; background: var(--accent); flex: none; }
.bell-empty { margin: var(--space-2); }
```

(The 6px dot: `metricLint`'s covered properties — if `inline-size`/`block-size` literals trip `platformTokens`, use `var(--space-2)` sized dot instead; check the covered-property list before committing.)

- [ ] **Step 5: Full frontend suite green; commit**

```bash
git add frontend/src
git commit -m "feat(frontend): the bell - DropdownMenu reuse at both headers, mark-all on open, a 60s poll"
```

---

### Task 7: The mailer decorator — the five §9 switches enforced in one seam

**Files:**
- Create: `shared/src/notifications.ts` + `shared/src/notifications.test.ts`; Modify: `shared/src/index.ts` (one export line)
- Create: `backend/src/email/withPreferences.ts`
- Create: `backend/src/email/withPreferences.test.ts`
- Modify: `backend/src/app.ts` (the one decorate line)

**Interfaces:**
- Consumes: `notificationPrefs` (Task 2); the `Mailer` interface + `createDevMailer` (`backend/src/email/mailer.ts`); the decorate site (`app.ts` — grep `app.decorate("mailer"`).
- Produces: `SWITCHABLE_EMAIL_KEYS` (shared — Task 8's UI and this decorator use the SAME array): `["submission-receipt", "marks-released", "work-returned", "due-tomorrow", "due-reminder"] as const`; `NotificationPrefsPatchSchema` (zod record over those keys → boolean); `withPreferences(db, inner): Mailer`.

- [ ] **Step 1: `shared/src/notifications.ts`** (TDD — colocated test first, the `sharing.ts` sibling idiom: the keys array is exactly the five template strings; the schema strips unknown keys and rejects non-boolean values):

```ts
import { z } from "zod";

/** Spec §9's five switchable rows, keyed AS THE EMAIL TEMPLATE STRINGS
 *  verbatim (design D§4) — the mailer decorator does a Set-membership test
 *  with no mapping table to rot. The four "Always" rows (confirm, reset,
 *  teacher-alert, class-invite) are ungated by construction. These gate
 *  EMAIL only; the bell is never preference-gated. */
export const SWITCHABLE_EMAIL_KEYS = [
  "submission-receipt",
  "marks-released",
  "work-returned",
  "due-tomorrow",
  "due-reminder",
] as const;
export type SwitchableEmailKey = (typeof SWITCHABLE_EMAIL_KEYS)[number];

/** PATCH /api/auth/me's notificationPrefs shape — partial by design, and a
 *  z.object (NOT z.record: a zod record VALIDATES unknown keys against the
 *  enum and rejects them; an object with default-strip silently drops them,
 *  which is the wire behaviour every other schema here has). */
export const NotificationPrefsPatchSchema = z
  .object(Object.fromEntries(SWITCHABLE_EMAIL_KEYS.map((k) => [k, z.boolean()])) as Record<SwitchableEmailKey, z.ZodBoolean>)
  .partial();
```

Export from `index.ts`; `npm run test -w shared` + typecheck green.

- [ ] **Step 2: The decorator** (failing backend test first — see Step 3):

```ts
import { and, eq, inArray } from "drizzle-orm";
import { SWITCHABLE_EMAIL_KEYS } from "@physics-ide/shared";
import { notificationPrefs } from "../db/schema.js";
import type { Db } from "../db/types.js";
import type { Mailer } from "./mailer.js";

const SWITCHABLE = new Set<string>(SWITCHABLE_EMAIL_KEYS);

/** The §9 switches, enforced at the ONE seam every send passes through
 *  (design D§4): thirteen call sites gain the gate with zero route edits,
 *  and tick.ts's due-tomorrow — the one send the spec itself marks
 *  switchable — becomes gated without touching tick.ts. Fails OPEN for
 *  essential mail: no toUserId (the two invite sends — the recipient may
 *  have no account) or a non-switchable template sends unconditionally.
 *  An absent pref row means the default, ON. */
export function withPreferences(db: Db, inner: Mailer): Mailer {
  return {
    async send(msg) {
      if (msg.toUserId == null || !SWITCHABLE.has(msg.template)) return inner.send(msg);
      const rows = await db
        .select({ enabled: notificationPrefs.enabled })
        .from(notificationPrefs)
        .where(and(eq(notificationPrefs.userId, msg.toUserId), eq(notificationPrefs.key, msg.template)));
      if (rows[0]?.enabled === false) return; // switched off — the email never leaves
      return inner.send(msg);
    },
  };
}
```

(Match `Mailer`'s real `send` signature when writing — grep `interface Mailer` in `mailer.ts`; if `send` returns a value, pass it through; the `inArray` import is unused — drop it.)

- [ ] **Step 3: Tests** — `withPreferences.test.ts` against `testDb` and a recording fake inner mailer (`{ send: vi.fn() }`): switchable template + pref row `enabled:false` → inner NOT called; pref absent → called; pref `enabled:true` → called; non-switchable template (`confirm`) + a false row for that key smuggled in → STILL called (fail-open pinned); `toUserId: null` → called. Plus ONE integration case in the tick suite (grep the tick test file): a student with a `due-tomorrow: false` row gets NO `emails` row from the tick, while the `events` row AND the `notifications` row still land (the bell is not gated — D§4 pinned end to end).

- [ ] **Step 4: The seam.** `app.ts`: `app.decorate("mailer", deps.mailer ?? withPreferences(deps.db, createDevMailer(deps.db)));` — note the test-injected `deps.mailer` stays UNwrapped (suites that inject a fake mailer keep seeing every send; the tick integration case above uses the real dev mailer path instead).

- [ ] **Step 5: Full backend + shared suites green; commit**

```bash
git add shared/src backend/src
git commit -m "feat(backend): the five email switches enforced in the one mailer seam - fail-open for essential mail"
```

---

### Task 8: The Profile switches — five checkboxes riding PATCH /api/auth/me

**Files:**
- Modify: `shared/` — the me-patch schema (grep `UpdateMe` / the schema `PATCH /api/auth/me` validates with; add `notificationPrefs: NotificationPrefsPatchSchema.optional()`)
- Modify: `backend/src/routes/auth.ts` (PATCH upserts pref rows; GET `/api/auth/me` gains `notificationPrefs` resolved)
- Modify: `backend/src/routes/auth.test.ts` (extend)
- Modify: `frontend/src/components/auth/ProfilePage.js` + its test (grep the profile test file)

**Interfaces:**
- Consumes: `NotificationPrefsPatchSchema`, `SWITCHABLE_EMAIL_KEYS` (Task 7); `notificationPrefs` table (Task 2).
- Produces: `GET /api/auth/me` AND `PATCH /api/auth/me`'s response both carry `user.notificationPrefs: { [key]: boolean }` (all five keys, absent rows resolved to `true`, ONE shared resolver — the profile page writes the PATCH response into the ME cache, so a prefs-less PATCH reply would wipe the field from the cache); `PATCH /api/auth/me` accepting `{ notificationPrefs: { <key>: boolean, ... } }` (partial — only sent keys upsert). **The current me-patch schema requires `name` and the route sets it unconditionally** (`UpdateMeInputSchema` in `shared/src/auth.ts`; the `.set({ name })` in the route) — this task makes `name` optional and guards the `.set` on `parsed.data.name !== undefined`, or a prefs-only PATCH is unreachable. No new route; no matrix change (the route is a named skip).

- [ ] **Step 1: Backend failing tests** — PATCH `{ notificationPrefs: { "due-tomorrow": false } }` WITHOUT a `name` field → 200 and the name is UNCHANGED (the schema/route fix pinned); the table holds one row; the PATCH response's `user.notificationPrefs` carries `due-tomorrow: false`; GET me returns all five keys with `due-tomorrow: false` and the other four `true`; PATCH the same key `true` → the row updates (upsert, not duplicate — assert one row); an unknown key (`"nonsense": false`) is STRIPPED by the schema (200, no row); a non-boolean value → 400; a name-only PATCH still works exactly as before.
- [ ] **Step 2: Implement.** Schema: `name` becomes `.optional()`, `notificationPrefs: NotificationPrefsPatchSchema.optional()` joins it. Route: guard the existing `.set({ name })` on `parsed.data.name !== undefined`; when prefs are present, for each entry `insert ... onConflictDoUpdate({ target: [notificationPrefs.userId, notificationPrefs.key], set: { enabled } })`; both wrapped in one transaction if the route has none — follow its current shape. ONE resolver used by GET me AND the PATCH reply: `const resolvePrefs = async (userId) => Object.fromEntries(SWITCHABLE_EMAIL_KEYS.map((k) => [k, rowsByKey.get(k) ?? true]));` (select once, map over the keys).
- [ ] **Step 3: The UI.** In `ProfilePage.js`, a third section after the password form, the page's own hand-rolled `api()` + local-state pattern (no react-query mutations on this page):

```jsx
// PREF_LABELS keys the shared array — SWITCHABLE_EMAIL_KEYS stays the ONE
// source of the key set (decorator, auth route, this UI); only the labels
// live here.
const PREF_LABELS = {
  "submission-receipt": "Submission receipts",
  "marks-released": "Marks released",
  "work-returned": "Work returned for changes",
  "due-tomorrow": "Due-tomorrow reminders",
  "due-reminder": "Reminders from your teacher",
};

<h2 className="section-title">Notifications</h2>
<form className="auth-form" onSubmit={savePrefs}>
  {SWITCHABLE_EMAIL_KEYS.map((key) => [key, PREF_LABELS[key]]).map(([key, label]) => (
    <label key={key} className="pref-row">
      <input
        type="checkbox"
        checked={prefs[key]}
        onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
      />
      {label}
    </label>
  ))}
  <p className="auth-hint">These switch the emails off. The bell in the header always shows everything.</p>
  <button className="btn" type="submit" disabled={savingPrefs}>Save notification settings</button>
</form>
```

`prefs` seeds from `me.notificationPrefs`; `savePrefs` PATCHes `{ notificationPrefs: prefs }` and writes the fresh user (whose reply now carries the resolved prefs — Step 2) into the ME_KEY cache the way `saveName` does. The hint sentence is the D§4 honesty line at the point of use — assert it verbatim in the test. `.pref-row` AND `.auth-hint` (a class that does not exist yet — `color: var(--text-dim); font-size: var(--fs-sm);`) join `platform.css`'s Plan 8 section (tokens only, before the trailing media block).
- [ ] **Step 4: Frontend failing test → green** — the five labelled checkboxes render seeded from `me.notificationPrefs`; toggling one and submitting PATCHes the full map; the hint renders verbatim.
- [ ] **Step 5: Stage B gate** — all three workspace suites + both typechecks green. Then the browser check (controller-visible): sign in, see the bell at both headers, toggle a switch on /profile, reload, it held.
- [ ] **Step 6: Commit**

```bash
git add shared/src backend/src frontend/src
git commit -m "feat: the profile switches - five checkboxes riding PATCH /api/auth/me, emails gated, the bell always on"
```

---
## Stage C — data requests + revoke

### Task 9: Erase — the scrub transaction, the matrix row, one name for everyone

**Files:**
- Modify: `backend/src/lib/util.ts` (gains `export const ERASED_NAME = "Removed student";`)
- Modify: `backend/src/routes/shares.ts` (`REMOVED_STUDENT` becomes `export const REMOVED_STUDENT = ERASED_NAME;` — the one-string rule, D§5)
- Modify: `backend/src/routes/admin.ts` (the erase route; `GET /api/admin/users` gains `erased`)
- Modify: `backend/src/routes/shares.ts` (the roster picker's `isNull(users.erasedAt)` condition) + `backend/src/routes/shares.test.ts` (the picker-exclusion case)
- Modify: `backend/src/routes/admin.test.ts` (extend)
- Modify: `backend/src/routes/authority.matrix.test.ts` (one row; arithmetic 60→61; `admin.ts 5 → 6`)

**Interfaces:**
- Consumes: `users.erasedAt` (Task 2); `destroyAllUserSessions` (`auth/session.ts`); `logEvent`; tables per the sweep below.
- Produces: `POST /api/admin/users/:id/erase` with body `{ confirm: <the account's current email> }`; consts asserted verbatim: `ALREADY_ERASED = "They have already been erased."`, `SELF_ERASE = "You can't erase your own account."`, `CONFIRM_MISMATCH = "The confirmation doesn't match this account's email."`; `GET /api/admin/users` rows gain `erased: boolean`.

- [ ] **Step 1: Failing tests** — the full sweep, one world per case where needed:
  - Refusals: non-admin seats (the matrix covers them); unknown id → 404 `"No such account."` (grep admin.ts's existing sentence and reuse it); self-erase → 400 `SELF_ERASE`; wrong/missing `confirm` → 400 `CONFIRM_MISMATCH`; erasing twice → 409 `ALREADY_ERASED`.
  - The scrub, asserted field by field on a student who owns: a personal project, a group-linked project (a `groups` row referencing it), a pending outgoing share, an accepted outgoing share, a pending incoming share, a submission, a mark, a class membership, a group membership, a session, an email token, a notification, a pref row. After the erase: `users` row EXISTS with `name = "Removed student"`, `email = erased+<id>@erased.invalid`, `passwordHash = ""`, `role = "user"`, `isTeacher = false`, `emailConfirmedAt = null`, `active = false`, `erasedAt` set, `consentAt`/`createdAt` unchanged; sessions/email_tokens/notifications/prefs rows GONE; **class_members and group_members rows KEPT** (D§5: the marking inbox and gradebook build their rosters from membership — assert the gradebook route still returns the erased student's row, now named "Removed student", with their mark intact: §11's "marks history stays intact" pinned at the VIEW level); the personal project GONE (and its versions), the group-linked project SURVIVES; the pending outgoing share row GONE, the accepted one's `frozenManifest` is `{}` with the row intact, the pending incoming share GONE; the submission and mark rows SURVIVE; the `events` rows survive; one `account.erased` event `{ subject }` in the same transaction. And the picker exclusion: `GET /api/shares/roster/:classId` no longer lists the erased member (the `isNull(users.erasedAt)` condition this task adds to that route's join), while the gradebook still does — one test asserting both sides of the D§5 picker/record split.
  - Live-name resolution end to end: before erasing, mint an accepted share FROM the student to a classmate; after the erase, `GET /api/shares/attributions` (the classmate) reads `sharerName: "Removed student"` via the SCRUB path (the D§5 complement of Plan 7's hard-delete test, which stays).
  - The teacher path: a teacher who created the class → erase succeeds (no FK error), the `classes` row survives with `createdBy` intact, and signin with the old credentials → 403 (the deactivated-door sentence — grep auth.ts's).
  - `GET /api/admin/users` now carries `erased: true` for the row.
- [ ] **Step 2: Implement** — one transaction, the D§5 order: load + guard (404/self/confirm/already) → scrub update → `destroyAllUserSessions(tx-compatible or after)` → the deletes (email_tokens, notifications, notification_prefs — memberships are KEPT, see D§5; projects `WHERE ownerId = id AND id NOT IN (select projectId from groups where projectId is not null)`; shares pending outgoing DELETE, resolved outgoing `SET frozenManifest = '{}'`, pending incoming DELETE) → `logEvent(tx, "account.erased", req.user!.id, { subject: id })`. `ERASED_NAME` from `lib/util.js`; body validated inline (`z.object({ confirm: z.string() })`). Plus the picker exclusion: add `isNull(users.erasedAt)` to `GET /api/shares/roster/:classId`'s member join in `shares.ts` (this task's one edit outside admin.ts — record-facing rosters like the gradebook deliberately keep erased members; person-facing pickers must not offer them).
- [ ] **Step 3: Matrix** — row `POST /api/admin/users/:id/erase` with `expect: ADMIN_ONLY_SEATS`; arithmetic 60→61 (52 + 9); tally `admin.ts 5 → 6`; header comment re-derived.
- [ ] **Step 4: Full backend suite green, typecheck clean; commit**

```bash
git add backend/src
git commit -m "feat(backend): erase is an in-place scrub - the class record survives, the person does not, one name everywhere"
```

---

### Task 10: Export — everything theirs, a plain JSON body, their own audit trail only

**Files:**
- Modify: `backend/src/routes/admin.ts` (one GET route)
- Modify: `backend/src/routes/admin.test.ts` (extend)

**Interfaces:**
- Consumes: every table from the design's D§6 content list.
- Produces: `GET /api/admin/users/:id/export` (`requireAdmin`; GET — deliberately no matrix row) → a JSON document:

```
{ note, user, classMemberships, projects, projectVersions, assignmentWork,
  submissions, marksReceived, groups, groupMemberships, ruleSets,
  sharesSent, sharesReceived, authoredClasses, authoredAssignments,
  authoredGuides, sentInvites, emails, events }
```

- [ ] **Step 1: Failing tests** — seed a student with one row in each bucket (reuse the Task 9 world-building helpers where the file has them). Assert: every key above present; `projects[i].manifest` is the FULL manifest; `projectVersions` rows carry `id/label/createdAt` and NO manifest key (metadata only — D§6's bounded-size fiat); `events` contains a row the student performed and NOT a row a teacher performed about them (seed an `assignment.timeline_viewed` by the teacher with the student in the payload, assert absent — the actorId-only privacy ruling, pinned); `emails` are the rows addressed to them; `note` is exactly `This export contains your account, your work, and the actions you took. It does not contain other people's actions — including a teacher's record of viewing your work.`; unknown id → 404; non-admin → 403 (one inline case; GETs have no matrix seat).
- [ ] **Step 2: Implement** — ~16 straightforward selects (the design's table); no `Content-Disposition`, no streaming, no file machinery (the contract's clause). Malformed `:id` → the same 404 as unknown (the Batch A posture).
- [ ] **Step 3: Green; commit**

```bash
git add backend/src
git commit -m "feat(backend): the export - everything theirs in one readable JSON body, their own audit trail and nobody else's"
```

---

### Task 11: The Data requests tab, the erase dialog, the People third state

**Files:**
- Create: `frontend/src/components/admin/DataRequestsTab.js`
- Create: `frontend/src/components/admin/__tests__/dataRequests.test.js`
- Modify: `frontend/src/components/admin/AdminConsole.js` (`TABS` gains `"Data requests"`; the panel branch; People-tab third state + suppressed actions)
- Modify: `frontend/src/components/admin/__tests__/adminTabs.test.js` (five tabs; People erased state)
- Modify: `frontend/src/styles/platform.css` (the `.erase-dialog` block, before the media block)

**Interfaces:**
- Consumes: `GET /api/admin/users` (+`erased`), `GET /api/admin/users/:id/export`, `POST /api/admin/users/:id/erase` (Tasks 9–10); `Overlay` (`components/common/Overlay.js` — `onClose, label, panelClassName, dismissOnBackdrop`); the admin search idiom (grep `admin-search-box` in `AdminConsole.js`); `PrivacyIcon`, `DownloadIcon`, `TrashIcon`.
- Produces: the fifth tab; `export const ERASE_SENTENCE = 'This cannot be undone. Their account and personal details go; their submissions and marks stay in the class record under "Removed student".';` asserted verbatim.

- [ ] **Step 1: Failing tests.**
  - `adminTabs.test.js`: `TABS` renders five tabs with the full ARIA pattern intact (the existing assertions extend to the fifth); the People tab with an `erased: true` row renders the status word `erased` and NONE of the four action buttons (Deactivate/Reactivate/Resend confirmation/Send reset).
  - `dataRequests.test.js` (mocked react-query): resting state renders `.empty` with `Search for a person to export or erase their data.`; a search result row shows name/email with Export and `Erase…` buttons; Export fetches the export route and hands the browser a download named `physide-export-<id>.json` (mock the api + assert the anchor-download idiom was driven — the GradebookTab test shows the house pattern for asserting Blob downloads; follow it); `Erase…` opens the Overlay with `ERASE_SENTENCE` verbatim, `dismissOnBackdrop` false, Cancel first, and `Erase permanently` DISABLED until the typed value equals the row's email exactly; a match enables it and clicking fires the erase mutation with `{ confirm: email }`; a mutation error renders in `.alert--danger`; an `erased` result row offers Export but NOT Erase.
- [ ] **Step 2: Implement** — the tab mirrors the People tab's search + row structure; the dialog is the ShareDialog shape (`Overlay` + `__title` + body + actions), `btn--danger` OUTLINED for both trigger and confirm (spec §10's own rule); the export click does `const data = await api(...); const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); ...a.download = \`physide-export-${id}.json\`` (the GradebookTab idiom verbatim). CSS: `.erase-dialog` (flex column, `gap: var(--space-4)`), `.erase-dialog__actions` (flex end, gap), a `.status-erased` treatment that is a WORD plus the muted token — never colour alone.
- [ ] **Step 3: Suites green; commit**

```bash
git add frontend/src
git commit -m "feat(admin): the data requests tab - export as a file, erase behind the typed email, a third people state"
```

---

### Task 12: Waiting on them — the sharer's pending list, the teacher's class view, the revoke button

**Files:**
- Modify: `backend/src/routes/shares.ts` (one GET) + `backend/src/routes/shares.test.ts`
- Create: `frontend/src/components/sharing/WaitingOnThem.js` + `frontend/src/components/sharing/__tests__/waitingOnThem.test.js`
- Modify: `frontend/src/components/assignments/AssignmentsTab.js` (mount after `<SharedWithYou classId={id} />`)
- Modify: `frontend/src/styles/assignments.css` (two rules in the existing Plan 7 sharing section)

**Interfaces:**
- Consumes: `POST /api/shares/:id/revoke` (exists since Plan 7 — no new mutating route); `getMembership`, `REMOVED_STUDENT`, the shares consts.
- Produces: `GET /api/shares/outgoing?classId=` (active member) → `{ shares: [{ id, title, recipientName, sharerName, createdAt }] }` — the caller's own PENDING shares in the class; for the class's TEACHER role, every pending share in the class (D§8 gave teachers revoke authority; this is their surface). Names resolved live, `?? REMOVED_STUDENT`. `<WaitingOnThem classId />` — renders NOTHING when empty.

- [ ] **Step 1: Backend failing tests** — alpha (sharer) sees exactly their own pending rows with `recipientName`; bravo (an uninvolved student) gets an empty list even though alpha's share is pending (own-rows scoping); the teacher sees ALL pending rows with both names; revoked/accepted/lapsed rows never appear; a non-member → 403 `NOT_A_MEMBER`; malformed classId → 404 `NO_SUCH_CLASS` (the Batch A posture). Implement with the `incoming` route's shape (leftJoin users twice — sharer and recipient aliases; grep drizzle's `alias` import if needed, or two separate lookups the `renderAll` way).
- [ ] **Step 2: Frontend failing tests** — mocked queries: empty → `container.firstChild` null; two rows render title + `to <recipientName>` + a Revoke button each; teacher rows render `<sharerName> to <recipientName>`; clicking Revoke fires the (mocked) revoke mutation and invalidates the outgoing query; an error renders in `.alert--danger`. Implement mirroring `SharedWithYou.js` (heading `Waiting on them`, `.card` rows, `.btn` Revoke). Mount directly after SharedWithYou. CSS: `.waiting-row__to { color: var(--text-dim); font-size: var(--fs-sm); margin-inline-end: auto; }` plus a section margin rule, in the Plan 7 sharing section of `assignments.css`.
- [ ] **Step 3: Stage C gate** — all suites + typechecks green; the controller's browser pass: share, watch it appear under Waiting on them, revoke it, watch it leave both sections.
- [ ] **Step 4: Commit**

```bash
git add backend/src frontend/src
git commit -m "feat: waiting on them - the sharer's pending list and the teacher's class view, revoke made operable"
```

---
## Stage D — privacy + wrap

### Task 13: `/privacy` — the one new screen, and the About paragraph grows its leg

**Files:**
- Create: `frontend/src/welcome/PrivacyPage.js`
- Modify: `frontend/src/App.js` (one route beside `/about`), `frontend/src/welcome/WelcomeHeader.js` or the footer component (one link — grep how About/Contact link and mirror it), `frontend/src/welcome/AboutPage.js` (one appended sentence + one link)
- Modify: `frontend/src/welcome/__tests__/welcomeSubpages.test.js` (PrivacyPage joins the swept `pages` array; a new positive-locks describe; two new About locks)

**Interfaces:**
- Consumes: the `WelcomeSubpage` wrapper (grep `WelcomeSubpage` — the About/Contact/Teachers idiom), `PrivacyIcon`.
- Produces: the `/privacy` route (the ONE new §14 row — Task 1 already amended the inventory); the pinned sentences below.

- [ ] **Step 1: Failing tests** — extend `welcomeSubpages.test.js`:
  - A new describe `"/privacy — §11's plain statements, pinned"` rendering `PrivacyPage` and asserting verbatim: `expect(text).toContain("name, email, scrambled password, class memberships, projects and their history, submissions, marks and feedback, the share ledger, and sign-in timestamps");` · `expect(text).toContain("no location, no contacts, no browsing habits, no advertising identifiers, no photos, no birthdates");` · `expect(text).toContain("an admin can technically see anything");` · `expect(text).toContain("a complete copy of everything the system holds about them, or its removal");` · `expect(text).toContain("Removed student");` · `expect(text).toContain("It does not contain other people's");`
  - `PrivacyPage` joins the swept `pages` array — the three surviving bans (`/rubric/i`, `/real email/i`, `/email delivery/i`) police it from birth. **Word the page to clear them**: say "a complete copy … or its removal", never the literal phrase "data request" (that ban lifts only in Task 14); never claim mail is delivered.
  - Two new About locks in the existing surveillance-record test: `expect(text).toContain("a complete copy of everything the system holds about them, or its removal");` and `expect(text).toContain("Removed student");` — all four existing positive locks and the underclaim ban stay untouched.
- [ ] **Step 2: Implement the page** — the WelcomeSubpage idiom, `PrivacyIcon`, sections mirroring §11's six statements in the spec's own plain voice (What we store / What we never collect / Who sees what / The right to leave — including the erasure consequence sentence and the export-scope sentence from D§7 verbatim: `The copy you get contains the actions you took. It does not contain other people's — including a teacher's record of opening your timeline, which is theirs to be accountable for, not yours to hold.` / For school-aged users / How long things are kept — the 3-year figure stated AS the current proposal, honestly). Add the About sentence (grep `append-only record`; append after the Plan 7 sentence): `Every person that record is about can ask for all of it: a complete copy of everything the system holds about them, or its removal — after which their work in a class record stays, under the name Removed student, and the person does not.` Link `/privacy` from the welcome nav/footer beside About and from the About privacy section.
- [ ] **Step 3: Suites green; commit**

```bash
git add frontend/src
git commit -m "feat(welcome): the privacy page - section 11 in one screen of text, the About record grows its data-care leg"
```

---

### Task 14: The honesty pass — the bell and data-request bans move, real email stays banned

**Files:**
- Modify: `frontend/src/welcome/__tests__/welcomePage.test.js` (two NON_CLAIMS groups + their meta-test `sentences` entries — ONE commit)
- Modify: `frontend/src/welcome/__tests__/welcomeSubpages.test.js` (three EXCLUDED regexes out)
- Modify: `frontend/src/welcome/AboutPage.js`, `frontend/src/welcome/TeachersPage.js`, `frontend/src/welcome/WelcomePage.js` (docblock/comment exclusion lists drop the bell + data requests)

**The trap (the Plan 7 lesson, verbatim in shape):** the NON_CLAIMS ban list is asserted by a meta-test in the same file — the group deletions and their `sentences` entries move together in ONE commit or the suite is red between commits.

- [ ] **A.** `welcomePage.test.js`: delete the whole `"the notification bell"` group (all three patterns) and the whole `"admin data requests"` group (all three patterns) from `NON_CLAIMS`; delete both entries from the meta-test's `sentences` map and re-scope its comment to what remains (real email delivery + the capabilities group + the History naming fiat). The `"real email delivery"` group is DO-NOT-TOUCH.
- [ ] **B.** `welcomeSubpages.test.js`: remove `/notification bell/i`, `/\bbell\b/i`, `/data request/i` from `EXCLUDED`; reword the guard test's title and block comment to the survivors (`rubric marking, real email delivery`). The three surviving regexes keep policing all five swept pages (Privacy included, from Task 13).
- [ ] **C.** The three page docblocks: the remaining-absences lists become `rubric marking, real email delivery` (drop the bell and data requests; peer sharing already left in Plan 7's pass).
- [ ] **D.** Verify (do NOT re-edit): Task 1's contract exclusion sentence already dropped the three lifted items — grep and confirm.
- [ ] **Run the full frontend suite in the SAME commit; commit**

```bash
git add frontend/src
git commit -m "docs+copy: the bell and data requests ship and the copy says so - bans moved with their meta-test, real email stays banned"
```

---

### Task 15: The golden flow, the checklist, and the plan's gate

**Files:**
- Modify: `frontend/scripts/portal-e2e.mjs` (extend — the house `check()`/`screenshot()` idiom)
- Modify: `docs/e2e-checklist.md` (the portal gap list), `docs/classroom-platform.md` §18 forward-reference 6 (append one sentence)
- Create: `docs/superpowers/reviews/2026-08-29-plan8-browser-pass-checklist.md`

**The flow the script gains (after the existing sharing segment):**
1. Teacher publishes a second assignment → student's bell badge shows unread (`.bell-badge`), the dropdown lists `New assignment in …` verbatim, mark-all clears the badge. Screenshots `13-bell-unread`, `14-bell-open`.
2. Student flips `Due-tomorrow reminders` off on `/profile`, reloads, the checkbox held (the pref persisted).
3. Student A's class page shows `Waiting on them` for their pending share; Revoke removes it from BOTH sections (A's outgoing, B's incoming). Screenshot `15-waiting-on-them`.
4. Admin: Data requests tab → search the THROWAWAY student (sign one up in the script for this) → Export returns 200 with the `note` and `user` keys (assert via in-page fetch — the download itself is a browser save, assert the fetch) → Erase with the typed email → People shows `erased` → that student's signin now fails with the deactivated sentence. Screenshot `16-data-requests`.
5. Zero console errors throughout (the harness's audit idiom); every pre-existing check stays green.

- [ ] **Step 1: Extend the script** (~10 checks; selectors from this plan: `.bell-trigger`, `.bell-badge`, `.bell-item`, `.pref-row`, `.waiting-row` or the section heading, the Data-requests tab, `.erase-dialog`).
- [ ] **Step 2: Docs.** `docs/e2e-checklist.md`: the portal gap list gains "bell + preferences + data requests + revoke — covered (portal-e2e)", and the never-covered list is EDITED, not appended to — `/admin` AND `/profile` leave it (the flow drives both), and the "revoking a pending share" clause leaves the not-reached list; the surviving gaps (invite landing, group baton, gradebook CSV in a spreadsheet, History restore, §5 regressions) stay honest. Spec §18 forward-reference 6: EDIT its still-uncovered sentence to the surviving gaps and append `Plan 8 (2026-08-29) extended it with the bell, the preference switches, the revoke flow and the admin data requests.`
- [ ] **Step 3: The human checklist** — `2026-08-29-plan8-browser-pass-checklist.md`, the Plan 7 file's format: the bell at both headers (portal + IDE) in both themes; badge counts and mark-all; each notification's link lands on the right page; the five switches round-trip; a switched-off email genuinely absent from the admin Emails tab while the bell row still arrives; Waiting on them for sharer and teacher; the erase dialog's type-to-confirm (wrong email keeps it disabled), the third People state; `/privacy` at 1024px and on a phone-width window (readable — it is a reading page); the offline caveat note; the erased-sharer surfaces now REACHABLE via the real erase flow (unlike Plan 7's checklist — update that note).
- [ ] **Step 4: Full gates from the repo root, every one green:**

```bash
npm run lint
npm run test -w shared && npm run test -w backend && npm run test -w frontend
npm run typecheck -w backend && npm run typecheck -w shared
npm run build -w frontend
npm run check:blocks
node frontend/scripts/e2e-test.mjs
node frontend/scripts/portal-e2e.mjs
node frontend/scripts/ux-audit.mjs
```

- [ ] **Step 5: Final commit**

```bash
git add frontend docs
git commit -m "test+docs: Plan 8 wrap - the bell, the switches and the data requests run end to end, the ledgers updated"
```

---

## Self-review — seams found while writing this plan, recorded

1. **`logEvent`'s return-type change (Task 2) is the plan's one shared-spine edit** — every later task assumes `Promise<number>`. It lands in Stage 0 precisely so no fan-out task can race it; existing call sites ignore the return and are untouched.
2. **The renderer's `href` templates are asserted before they are consumed.** Task 4 pins `/assignments/:id` and `/classes/:id` in tests; Task 6's client navigates them. If App.js's route table disagrees, Task 4's implementer fixes the renderer THERE (and the test), never the client — one source of truth.
3. **Sites 8 and 9 are the SAME quiet event through two doors** — the join route and invite acceptance both land an active member, and only the first fires `class.joined`; the invite door notifies through its own `invite.accepted` type, rendered with the joined sentence. The teacher-only audience (not TAs) is the design's reading of "a student joined YOUR class"; a widening to `isStaffRole` is one line if review argues for it, but the plan ships the design's row.
4. **Task 5 touches four route files the hardening batches also touched** — every anchor is quoted text, not a line number; the citation convention header governs.
5. **`withPreferences` deliberately does NOT wrap a test-injected `deps.mailer`** (Task 7 Step 4): suites that inject a recording fake assert sends today and must keep seeing them; the gate's own tests use the real dev-mailer path. Wrapping both would silently break existing email assertions — the seam wraps only the default.
6. **The erase sweep and the export list are the SAME table read twice** (D§5/D§6) — Task 9's world-builder is written to be reused by Task 10's test (one seeded student with a row in every bucket). Build it as a helper in `admin.test.ts`, not copy-paste.
7. **Task 11's download assertion follows the GradebookTab test** — the house already asserts Blob downloads once; mirror it rather than inventing a jsdom anchor-click harness.
8. **Task 13 lands while `/data request/i` is still banned** — the privacy page is worded to clear the ban ("a complete copy … or its removal"), and joins the sweep the moment it exists. Task 14 then lifts the three bans. The order is load-bearing; do not swap.
9. **The matrix arithmetic moves twice** (Task 4: 60 = 51 + 9; Task 9: 61 = 52 + 9) — each bump re-derives the header comment in the same commit, the file's own rule.
10. **`notifications.userId` cascades on user delete while erasure deletes rows explicitly** — both are correct: the cascade covers a true hard delete (the Plan 7 test's direct-delete path), the explicit delete covers the scrub (no delete fires). Task 9's sweep asserts the explicit path.
11. **Type consistency checked:** `notify`'s signature (Task 4 Step 1) matches every Task 5 call; `SWITCHABLE_EMAIL_KEYS` (Task 7) is imported by the decorator, the auth route, and the Profile UI (which maps over it through `PREF_LABELS` — the array stays the one source of the key set); `ERASED_NAME`/`REMOVED_STUDENT` resolve to one literal (Task 9); the export keys (Task 10) match D§6's table; the renderer's `href` shape (Task 4) matches App.js's nested assignment route, asserted in Task 4's own tests before Task 6 consumes it.
12. **Spec coverage walked:** §9 bell ✓ (T4–6), quiet events ✓ (map rows 1/8), switches ✓ (T7–8), pretend-inbox untouched ✓; §10 data requests ✓ (T9–11), the console's other panels untouched ✓; §11 store/never-collect/who-sees ✓ (T13), right-to-leave ✓ (T9–10), minors ✓ (unchanged signup consent, restated on /privacy), retention = proposal, stated honestly, automation deferred ✓; §14 one row ✓ (T1/T13); D§8 revoke ✓ (T12); D§10 ESLint ✓ (T3).

---

**Execution note (subagent-driven):** stages are the review gates. Dispatch tasks in order within a stage; run the stage gate before opening the next; the Stage B browser check (the bell at both headers) and Stage C's revoke round-trip are controller-visible checkpoints worth screenshots. Total: 15 tasks, 5 stages.
