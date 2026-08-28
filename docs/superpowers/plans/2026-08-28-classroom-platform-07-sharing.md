# Peer Sharing and the Attribution Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec §8.1/§8.3 delivered: a student hands a frozen copy of their own project to one named classmate, behind the teacher's class switch and the assignment rules, with every share written into the append-only events ledger in the same transaction and every accepted copy permanently labelled "Based on work shared by [name]" — resolved live so an erased sharer reads "Removed student".

**Architecture:** One new backend plugin (`shareRoutes`) and one migration (`0006`) carrying the `shares` delivery table plus `classes.peer_sharing` and `projects.attribution`; the ledger itself is the existing `events` table (D§3 — no ledger table). A share freezes the sharer's server head onto the share row; accept mints an ordinary project on the recipient's account with the attribution written server-side in the same transaction, then follows `startWork.js`'s documented client order — the push is the identical-re-push no-op `projects.ts` already guarantees. The manifest is never tagged; the label rides a client sidecar store (the `assignmentMeta.js` precedent) so it renders offline.

**Tech Stack:** Existing monorepo (React 18 + Vite, Fastify 5 + Drizzle + Postgres 16, zod contracts in `shared/`). Nothing new is installed.

**Spec:** `docs/superpowers/specs/2026-08-28-classroom-platform-07-sharing-design.md` (the build decisions; cite it as **D§n**) over `docs/classroom-platform.md` §8 (the product contract; cite it as **spec §n**). Where they seem to disagree, the design doc wins — it records the resolutions. The research ground is the Plan 7 research memo (session artifact, 2026-08-28); its §6a/§6b obligations are Stage 0/Stage D tasks here.

## Citation convention — read this before cutting any range

Every `file.ext:N` or `:N-M` citation in this plan was verified against the tree at `930edcf`. Line numbers drift as tasks land — **re-grep for the quoted anchor text instead of trusting a stale number**, and if a cited anchor is genuinely gone, stop and check the task's assumptions rather than guessing.

## Global Constraints

- **Backend/shared discipline:** every route body with more than one field validates via a zod schema from `@physics-ide/shared` (single-field bodies/queries may inline one zod check); every mutation writes `logEvent` **inside the same transaction**; refusal sentences are file-level consts asserted verbatim by tests. New tables join `truncateAuthTables()` in `backend/src/db/testClient.ts` in the same task that creates them.
- **Design system (spec §18, delta contract):** tokens only — the metric linter's covered properties never see a literal; the Plan 5 primitives (`.btn`, `.card`, `.input`, `.alert`, `.badge`, `.empty`, `.tabs`/`.tab`, `.range`) and `PortalHeader` + `.page` shell are the vocabulary; portal controls are 30px (`.btn`); one focus ring (tokens.css), no component writes its own; one dropdown implementation (`DropdownMenu`); one overlay implementation (`Overlay`); colour is never the only channel; **no emoji anywhere in product UI**; the 1024px floor hides nothing load-bearing.
- **Retired names stay retired:** `portalControls.test.js` forbids the Plan 5 alias list in portal markup. New portal directories are added to its `DIRS` in the task that creates them (Task 11 adds `components/sharing`). Never re-add an alias.
- **CSS placement:** all new sharing styles join **`frontend/src/styles/assignments.css`** under one commented section (Task 11) — it is already in the `styles.css` manifest between `platform.css` and `welcome.css`, and `assignmentsTokens.test.js` already lint-covers it, so no new sheet and no new conformance test are needed. Never append to `frontend/src/styles.css` itself — it is a 14-line manifest whose order is load-bearing.
- **Sync is untouched:** no change to `SCHEMA_VERSION` (stays **2**), `isManifest`, the sync engine, `SyncProvider.js`, or manifest shapes. **The manifest is never tagged** (contract D§2): attribution lives in `projects.attribution` server-side and the `shareMeta` sidecar client-side; an export bundle carries no attribution and an imported bundle is a fresh unattributed project (D§7 fiat). No task in this plan lists `SyncProvider.js` or `sync/` under Files — an accepted copy is an ordinary owned project and needs no third guard; that is the whole payoff of copy-on-share (D§2).
- **The IDE mounts once, at `/`.** No task creates a second `IDELayout` mount; the share dialog is an overlay inside the one shell.
- **Guests lose nothing:** every task leaves the signed-out IDE experience byte-identical. The Share… item, the sidecar refresh, and the label surfaces are all gated on a signed-in `me`; `refreshShareAttributions()` swallows the guest's 401 and the empty cache renders nothing.
- **No FK in the share/attribution path cascades on a project or user delete** (D§3): `shares` references users and projects by plain columns (the `events.actorId` / `groups.ownerId`+`projectId` precedent), and the event payload's denormalised ids are the permanent record. A ledger a sharer could erase by deleting the source is not §8's ledger.
- **backend and shared may change in this plan** — but only in tasks that name them, and `npm run typecheck -w backend && npm run typecheck -w shared` stays green at every commit.
- **Truth in copy:** no UI string may claim anything unbuilt. **The sharing bans move ONLY in the wrap task (Task 15), after the feature is green.** The contract amendment (Task 2) is the one document that moves first — the change protocol's "contract before code" and truth-in-copy govern different documents (memo Q9). Task 6's new editor label is worded to be true both before and after sharing ships (see the task).

## Stage ownership — the execution order

Stages land in order; a stage opens only when the previous one's gate (its last task's full-suite run) is green. Tasks inside a stage are sequential. Implementers are strictly serialized per tree (Plan 6's standing lesson).

| Stage                   | Tasks  | Theme                                                                                                     |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| 0 — debt + spine       | 1–4   | helper homes +`requireClassStaff`, the contract amendment, sharing contracts, migration 0006            |
| A — the switches       | 5–6   | `classes.peer_sharing` end to end; the individual-work flag made real                                   |
| B — the share (server) | 7–10  | the D§5 gate + POST; incoming/roster/revoke/lapse; accept + the cap; attribution read + erasure + chains |
| C — the client         | 11–13 | Share… in the File menu; Shared with you + the accept flow; the label surfaces                           |
| D — wrap               | 14–16 | the authority matrix; honesty copy + spec clarification; golden-flow e2e + checklist                      |

## Deferred — deliberately NOT here, do not flag as missing

Everything in design §12, verbatim in intent:

- **Class-wide galleries or publish-to-class** — a share is a named-peer hand-off (D§1); widening later is one additive case, narrowing a gallery back is not honestly possible on an append-only ledger.
- **Share messages, comments, or any feed** — a share carries a project and a name, nothing else (§13 + the contract's "Collaboration … comments" exclusion).
- **Outward sharing of group projects** — refused server-side on the row's identity (D§5.4); the refusal ships, the feature does not.
- **Live or read-only references** — the copy is frozen (D§2); a live view is the excluded feature.
- **A `share` workspace-rule key** — sharing assignment work rides `exportAndCopy` (D§5.3); a seventh rule is a recorded future additive change, not built now.
- **The notification bell and any share email** — spec §9's table is closed and has no share row; discovery is pull-based (D§10). When the bell lands in Plan 8, share events join it — that is Plan 8's carry-forward, recorded here, not built.
- **A ledger-viewing screen** — the record exists in `events`; a surface for it is future work (and the reason migration 0006 does NOT add events indexes — nothing reads the ledger at 200-user scale yet).
- **Admin data requests, rubric marking, real email delivery, BlobStore, the GCP port, websockets** — all still excluded; their copy bans stay (memo §3.2).
- **Any change to sync mechanics or `SCHEMA_VERSION`**; **raising `MAX_PROJECTS_PER_USER`** — the cap refusal with its own sentence is the design's honest answer to share-heavy classes (D§4).

---

## Stage 0 — debt + spine

### Task 1: Helper homes — `pgErrorCode`, `toEpoch`, `visibleToStudent`, `isStaffRole`, `requireClassStaff`

The memo §6a obligation, done FIRST so Plan 7's routes are written against shared helpers instead of adding copies 5, 4 and 3. Pure refactor: behaviour changes only where recorded below (one sentence unification).

**Files:**

- Create: `backend/src/lib/util.ts`
- Modify: `backend/src/classes/guards.ts` (add `isStaffRole`, `requireClassStaff`)
- Modify: `backend/src/routes/projects.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/members.ts`, `backend/src/routes/assignments.ts`, `backend/src/routes/guides.ts`, `backend/src/routes/groups.ts` (delete private copies, import the shared ones)
- Modify: `backend/src/routes/assignments.test.ts` (one expectation string)

**Interfaces:**

- Consumes: `computeAssignmentPhase` (`@physics-ide/shared`), `assignments` (`../db/schema.js`), `getMembership`/`ClassAuthError` (`classes/guards.ts:26-49`).
- Produces (every later backend task imports these): `pgErrorCode(err)`, `toEpoch(d)`, `visibleToStudent(a)` from `backend/src/lib/util.ts`; `isStaffRole(role)`, `requireClassStaff(db, classId, userId)` from `backend/src/classes/guards.ts`; `guideVisibleToStudent` stays private to `guides.ts` (D§14.10 — two predicates, never merged).

- [ ] **Step 1: Create `backend/src/lib/util.ts`:**

```ts
import { computeAssignmentPhase } from "@physics-ide/shared";
import { assignments } from "../db/schema.js";

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause.
 *  One home for what was four byte-identical private copies (Plan 7 Stage 0:
 *  projects.ts, auth.ts, members.ts, assignments.ts). */
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

/** Dates cross the wire as epoch ms; timestamptz lives only inside Postgres. */
export function toEpoch(d: Date | null): number | null {
  return d ? d.getTime() : null;
}

/** Students see an assignment only once it has left draft (spec §5.1).
 *  A draft 404s rather than 403s — its existence is the teacher's business.
 *  Lives HERE, not exported from assignments.ts, because groups.ts needs it
 *  too and assignments.ts already imports from groups.ts (assignments.ts:37)
 *  — exporting it the other way would close an ESM cycle. The guides
 *  predicate of the same name is a DIFFERENT test over a different row and
 *  is renamed guideVisibleToStudent, never merged (design D§14.10). */
export function visibleToStudent(a: typeof assignments.$inferSelect): boolean {
  return computeAssignmentPhase(a, new Date()) !== "draft";
}
```

- [ ] **Step 2: Extend `backend/src/classes/guards.ts`** (append after `requireClassTeacher`, guards.ts:39-49):

```ts
/** Teacher or TA — the two staff hats (spec §2.1). Was three private copies
 *  (assignments.ts, groups.ts, guides.ts). */
export function isStaffRole(role: string): boolean {
  return role === "teacher" || role === "ta";
}

const STAFF_ONLY = "Teachers and assistants only.";

/** Active teacher-or-TA membership in THIS class — requireClassTeacher's
 *  exact shape, one rung looser. One predicate, one sentence, where eight
 *  hand-inlined copies used to live in assignments.ts. */
export async function requireClassStaff(
  db: Db,
  classId: string,
  userId: string,
): Promise<typeof classMembers.$inferSelect> {
  const m = await getMembership(db, classId, userId);
  if (!m || m.status !== "active" || !isStaffRole(m.role)) {
    throw new ClassAuthError(403, STAFF_ONLY);
  }
  return m;
}
```

- [ ] **Step 3: Delete every private copy and import the shared ones.** The exact site list, verified at `930edcf`:

| File               | Delete                                                                                                                     | Add import                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `projects.ts`    | `pgErrorCode` + its comment (`:103-108`)                                                                               | `import { pgErrorCode } from "../lib/util.js";` (call site `:213` unchanged)                                                                                                                                   |
| `auth.ts`        | `pgErrorCode` (`:333`)                                                                                                 | same (call site`:93`)                                                                                                                                                                                            |
| `members.ts`     | `pgErrorCode` (`:202`)                                                                                                 | same (call site`:46`)                                                                                                                                                                                            |
| `assignments.ts` | `pgErrorCode` (`:2397`), `toEpoch` (`:73-75`), `visibleToStudent` (`:101-103`), `isStaffRole` (`:105-107`) | `import { pgErrorCode, toEpoch, visibleToStudent } from "../lib/util.js";` + add `isStaffRole, requireClassStaff, ClassAuthError` to the existing `../classes/guards.js` import                              |
| `guides.ts`      | `toEpoch` (`:19-21`), `isStaffRole` (`:23-25`)                                                                     | `import { toEpoch } from "../lib/util.js";` + `isStaffRole` from `../classes/guards.js`; **rename** its own `visibleToStudent` (`:39`) → `guideVisibleToStudent` (call sites `:86`, `:100`) |
| `groups.ts`      | `isStaffRole` (`:56-58`), `visibleToStudent` (`:62-64`)                                                            | `isStaffRole` from `../classes/guards.js`, `visibleToStudent` from `../lib/util.js`                                                                                                                        |

- [ ] **Step 4: Collapse the eight inlined staff checks in `assignments.ts`** (sites `:1534, :1718, :1771, :1827, :1872, :1925, :2026, :2332` — each is `if (!m || m.status !== "active" || !isStaffRole(m.role))`). Replace the `getMembership` + `if` pair at each reply-site with:

```ts
try {
  await requireClassStaff(app.db, a.classId, req.user!.id);
} catch (err) {
  if (await sendClassAuthError(reply, err)) return;
  throw err;
}
```

Where the replaced block's `m` is read below the check (grep the following lines before deleting each site), keep the return value: `let m; try { m = await requireClassStaff(...); } catch ...`. Site `:2026` lives inside `markableGroup`, which hands refusals back as objects instead of replying — its shape is:

```ts
try {
  await requireClassStaff(app.db, a.classId, userId);
} catch (err) {
  if (err instanceof ClassAuthError) return { ok: false, code: err.status, error: err.message };
  throw err;
}
```

Then delete the now-unused consts `STAFF_ONLY_FOR_CLASS` (`assignments.ts:59`) and the function-scoped `STAFF_ONLY` (`assignments.ts:1383`), and trim the comment above `:1383` that explains the old wording.

**Recorded behaviour change (deliberate, the only one):** the two sites that replied `"Teachers and TAs only for this class."` (`:1718`, `:1771`) now reply `"Teachers and assistants only."` — one guard, one sentence, and the survivor is the wording six of the eight sites plus `members.ts`'s roster route already use. Update the single test that asserts the old string: `assignments.test.ts:2310` → `expect(res.json().error).toBe("Teachers and assistants only.");`.

- [ ] **Step 5: Run to pass** — `npm run test -w backend` green (the existing suites are the net for this refactor), `npm run typecheck -w backend` clean.
- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "refactor(backend): one home each for pgErrorCode, toEpoch, isStaffRole, visibleToStudent; requireClassStaff replaces eight inlined checks"
```

---

### Task 2: The product-contract amendment — contract before code

The change protocol ("Land the change in code only after the contract reflects it") makes this the first sharing-touching task; the public COPY stays banned until Task 15 (memo Q9 — different documents, both rules kept).

**Files:**

- Modify: `docs/product-contract.md`

**Interfaces:**

- Consumes: the design doc's decisions D§1–D§10.
- Produces: the amendment block later tasks cite; line 162 no longer lists peer sharing as excluded.

- [ ] **Step 1: Edit the not-lifted line.** At `docs/product-contract.md:162`, in "**What this amendment does not lift.**", delete exactly the phrase `peer sharing and the §8.3 attribution ledger, ` — every other exclusion in that sentence stands unchanged. Do NOT touch line 164 ("Copy is bound by this too." / the still-owed README/DEPLOY sentences) — Task 15 clears that debt and updates that sentence then.
- [ ] **Step 2: Append the amendment block** directly after the existing 28 August 2026 assignments amendment's final paragraph (grep `What this amendment does not lift` and insert after that paragraph's section):

```markdown
**Peer sharing amendment (28 August 2026).** Peer sharing and the §8.3 attribution ledger are lifted from the exclusions above, exactly as decided in `docs/superpowers/specs/2026-08-28-classroom-platform-07-sharing-design.md`. Locked rows:

- **A share is a named-peer hand-off of a frozen copy, with permanent credit** (D§1) — one sharer, one recipient, both active members of one class; no gallery, no feed, no message body, no live view.
- **The copy freezes from the sharer's server head at share time** (D§2) and is minted on accept as an ordinary project the recipient owns, under a fresh client-minted id, counting against their 100-project cap.
- **The ledger is the `events` table** (D§3): `project.shared` / `project.share_accepted` / `project.share_revoked` / `project.share_lapsed`, written inside the same transaction, payloads carrying the ancestor spec's five fields denormalised. The `shares` table is delivery state, not the ledger. **No FK in the share/attribution path cascades on a project or user delete.**
- **Attribution lives outside the manifest** (D§3/D§7): `projects.attribution` `{ sharerId, shareId }` server-side, a sidecar store client-side; the sharer's name is resolved at read time, so §11 erasure has one place to act and an erased sharer renders "Removed student". The manifest is never tagged; `SCHEMA_VERSION` stays 2; an exported bundle carries no attribution and an imported bundle is a fresh unattributed project.
- **The gate** (D§5): class `peer_sharing` on (off by default) AND sharer owns the source AND both parties active members AND — for assignment work — the individual-work flag off AND `exportAndCopy` on AND the source is not a group project (enforced on the row's identity). No new `share` workspace-rule key.
- **No new screens** (D§6): the send affordance is part of the IDE workspace screen (File menu); the receive section is part of the Class page screen. §14's inventory gains no rows.
- **Revocation revokes delivery, never the copy, never the ledger** (D§8); turning the class switch off lapses pending shares and stops new ones; accepted copies and their labels stand.
- **The label names the immediate sharer; the ledger records the chain** (D§9).
- **No notification of any kind** (D§10): §9's email table is closed and the bell is Plan 8's; discovery is pull-based on the class page.
```

- [ ] **Step 3: Commit**

```bash
git add docs/product-contract.md
git commit -m "docs(contract): Plan 7 amendment — peer sharing lifted from the exclusions, the sharing decisions locked"
```

---

### Task 3: Shared contracts — `shared/src/sharing.ts`

**Files:**

- Create: `shared/src/sharing.ts`
- Create: `shared/src/sharing.test.ts`
- Modify: `shared/src/index.ts` (add one export line)

**Interfaces:**

- Consumes: nothing but zod.
- Produces (later tasks import from `@physics-ide/shared`): `SHARE_STATUSES`, `ShareStatus`, `SHARE_PROJECT_ID_REGEX`, `CreateShareInputSchema`, `AcceptShareInputSchema`, `AttributionSchema`.

- [ ] **Step 1: Write the failing test** — `shared/src/sharing.test.ts`, the colocated vitest style of `sharing`'s siblings (relative `./x.js` imports):

```ts
import { describe, test, expect } from "vitest";
import {
  SHARE_STATUSES,
  CreateShareInputSchema,
  AcceptShareInputSchema,
  AttributionSchema,
} from "./sharing.js";

describe("share contracts", () => {
  test("the delivery lifecycle is the invites vocabulary plus lapsed", () => {
    expect(SHARE_STATUSES).toEqual(["pending", "accepted", "revoked", "lapsed"]);
  });

  test("a share names a class, a recipient and a p- project — nothing else", () => {
    const ok = CreateShareInputSchema.safeParse({
      classId: "6f3f8a30-0000-4000-8000-000000000001",
      recipientId: "6f3f8a30-0000-4000-8000-000000000002",
      projectId: "p-abc-123",
    });
    expect(ok.success).toBe(true);
    // No message field ever parses through (design D§1 — a share carries a
    // project and a name; zod strips unknown keys by default, proving the
    // wire shape cannot quietly grow a note to a classmate).
    expect(Object.keys(ok.data ?? {})).toEqual(["classId", "recipientId", "projectId"]);
    const badId = CreateShareInputSchema.safeParse({
      classId: "6f3f8a30-0000-4000-8000-000000000001",
      recipientId: "6f3f8a30-0000-4000-8000-000000000002",
      projectId: "x-1",
    });
    expect(badId.success).toBe(false);
  });

  test("accept carries only the fresh client-minted id", () => {
    expect(AcceptShareInputSchema.safeParse({ projectId: "p-fresh-1" }).success).toBe(true);
    expect(AcceptShareInputSchema.safeParse({ projectId: "not-a-project" }).success).toBe(false);
  });

  test("attribution is ids only — the name is never stored (design D§3)", () => {
    const parsed = AttributionSchema.parse({
      sharerId: "6f3f8a30-0000-4000-8000-000000000003",
      shareId: "6f3f8a30-0000-4000-8000-000000000004",
      sharerName: "smuggled",
    });
    expect(parsed).toEqual({
      sharerId: "6f3f8a30-0000-4000-8000-000000000003",
      shareId: "6f3f8a30-0000-4000-8000-000000000004",
    });
  });
});
```

- [ ] **Step 2: Run it to fail** — `npm run test -w shared` → FAIL (module not found).
- [ ] **Step 3: Write `shared/src/sharing.ts`:**

```ts
import { z } from "zod";

/** Delivery lifecycle (design D§4) — the invites table's vocabulary plus
 *  "lapsed": pending shares lapse when the class switch goes off (D§8). */
export const SHARE_STATUSES = ["pending", "accepted", "revoked", "lapsed"] as const;
export type ShareStatus = (typeof SHARE_STATUSES)[number];

/** The client-minted project id shape — the same pattern
 *  backend/src/routes/projects.ts pins privately (PROJECT_ID_REGEX,
 *  projects.ts:13). Two literals by design: shared/ cannot import from
 *  backend/, and exporting the backend's would touch sync-adjacent code for
 *  no behaviour change. If one ever changes, both must. */
export const SHARE_PROJECT_ID_REGEX = /^p-[A-Za-z0-9-]{3,60}$/;

/** POST /api/shares — a share carries a project and a name, nothing else
 *  (design D§1). No message field, ever. */
export const CreateShareInputSchema = z.object({
  classId: z.string().uuid(),
  recipientId: z.string().uuid(),
  projectId: z.string().regex(SHARE_PROJECT_ID_REGEX),
});

/** POST /api/shares/:id/accept — the FRESH id the recipient's copy will
 *  live under, minted client-side like every project id, never the
 *  source's own (design D§2). */
export const AcceptShareInputSchema = z.object({
  projectId: z.string().regex(SHARE_PROJECT_ID_REGEX),
});

/** What sits in projects.attribution — ids only. The sharer's NAME is
 *  resolved at read time so §11 erasure has exactly one place to act
 *  (design D§3). zod's default strip is load-bearing here: a name can
 *  never be smuggled into storage through this schema. */
export const AttributionSchema = z.object({
  sharerId: z.string().uuid(),
  shareId: z.string().uuid(),
});
```

- [ ] **Step 4: Export it.** In `shared/src/index.ts` append `export * from "./sharing.js";` (the file is five `export *` lines; this becomes the sixth).
- [ ] **Step 5: Run to pass** — `npm run test -w shared` green, `npm run typecheck -w shared` clean.
- [ ] **Step 6: Commit**

```bash
git add shared/src
git commit -m "feat(shared): sharing contracts — statuses, share inputs, the ids-only attribution shape"
```

---

### Task 4: Migration 0006 — `shares`, `classes.peer_sharing`, `projects.attribution`

ONE migration carries all three (design §11 Stage 0). The `shares` table is **delivery state, not the ledger** — the ledger stays in `events` (D§3).

**Files:**

- Modify: `backend/src/db/schema.ts` (append `shares` after `guides`, which currently ends the file at `:341-358`; add one column each to `classes` (`:69-80`) and `projects` (`:118-136`))
- Modify: `backend/src/db/testClient.ts` (`truncateAuthTables` — the hard-coded list at `:12` MUST gain `"shares"`)
- Generated: `backend/drizzle/0006_<drizzle-names-it>.sql` (run `npm run db:generate -w backend`; drizzle mints the filename — do not hand-name it)

**Interfaces:**

- Consumes: the house idiom — text pseudo-enums documented in comments, `timestamptz`, jsonb; the **no-FK-by-design** precedent (`events.actorId` at `schema.ts:13`, `groups.ownerId`/`projectId` at `:301-302`).
- Produces: `shares` (exact columns below — the contract every later backend task builds on), `classes.peerSharing`, `projects.attribution`.

- [ ] **Step 1: Add the two columns.** In `classes`, after `joinMode` (`schema.ts:74`):

```ts
  /** Spec §8.3's class-level switch — peer sharing on or off for the whole
   *  class, OFF by default. Flipping it off lapses pending shares (D§8). */
  peerSharing: boolean("peer_sharing").notNull().default(false),
```

In `projects`, after `clientUpdatedAt` (`schema.ts:130`):

```ts
    /** Plan 7 (spec §8.1): { sharerId, shareId } — set at share-accept,
     *  null for every other project. IDS ONLY: the sharer's name is
     *  resolved at read time so §11 erasure has one place to act. Never
     *  copied into the manifest (contract D§2 — the manifest is never
     *  tagged) and deliberately NOT an FK: an erased sharer must not
     *  delete or block on the recipient's copy. */
    attribution: jsonb("attribution"),
```

- [ ] **Step 2: Append the `shares` table after `guides`:**

```ts
/** Plan 7 (spec §8.1/§8.3, design D§4): DELIVERY state for peer shares —
 *  pending until the recipient accepts ("Add to my projects").
 *  THE LEDGER IS NOT THIS TABLE: every share action writes its own
 *  `events` row in the same transaction, and the event payload's
 *  denormalised ids are the permanent record (D§3). No user or project
 *  column here carries an FK — erasing a person or deleting the source
 *  project must neither delete nor block on delivery rows (the posture
 *  events.actorId and groups.ownerId/projectId already take).
 *  status: "pending" | "accepted" | "revoked" | "lapsed". */
export const shares = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sharerId: uuid("sharer_id").notNull(),
    recipientId: uuid("recipient_id").notNull(),
    /** Owner and sharer are the ancestor spec's SEPARATE fields (§17.1);
     *  in Plan 7 they are always equal (you share your own project) and
     *  both are recorded so a re-share chain stays legible in the ledger. */
    sourceOwnerId: uuid("source_owner_id").notNull(),
    sourceProjectId: text("source_project_id").notNull(),
    /** Frozen at share time from the sharer's SERVER head (design D§2) —
     *  accept still works if the source is later deleted or rewritten.
     *  Always ≤ MAX_MANIFEST_BYTES because it was a stored head. */
    frozenManifest: jsonb("frozen_manifest").notNull(),
    /** The ancestor spec's "version identifier" (spec §17.1). */
    sourceClientUpdatedAt: bigint("source_client_updated_at", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    /** Set at accept — the recipient's fresh copy id (D§4). */
    copyProjectId: text("copy_project_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("shares_recipient_status_idx").on(t.recipientId, t.status),
    index("shares_class_status_idx").on(t.classId, t.status),
  ],
);
```

(The imports line at `schema.ts:1` already carries everything used here.)

- [ ] **Step 3: Generate and apply** — `npm run db:generate -w backend` (yields `backend/drizzle/0006_<name>.sql` — inspect it: three statements' worth of DDL, `CREATE TABLE "shares"`, two `ALTER TABLE ... ADD COLUMN`), then `npm run db:migrate -w backend` and `npm run db:migrate:test -w backend`.
- [ ] **Step 4: Extend `truncateAuthTables`** — in `backend/src/db/testClient.ts:12`, add `"shares", ` at the head of the TRUNCATE list (before `"guides"`).
- [ ] **Step 5: Run to pass** — `npm run test -w backend` green (existing suites exercise the migrated DB), `npm run typecheck -w backend` clean.
- [ ] **Step 6: Commit**

```bash
git add backend/src backend/drizzle
git commit -m "feat(db): migration 0006 — shares delivery table, classes.peer_sharing, projects.attribution"
```

---

## Stage A — the switches

### Task 5: The class switch — `peer_sharing` end to end

**Files:**

- Modify: `shared/src/classes.ts` (`UpdateClassSettingsInputSchema`, `:30-34`)
- Modify: `backend/src/routes/classes.ts` (`toClassSummary` `:19-29`, the PATCH patch-builder `:116-119`)
- Modify: `backend/src/routes/classes.test.ts` (extend)
- Modify: `frontend/src/components/classes/SettingsTab.js` (new section between Joining rules and Archive)
- Create: `frontend/src/components/classes/__tests__/settingsTab.test.js`

**Interfaces:**

- Consumes: `classes.peerSharing` (Task 4); the SettingsTab section idiom (`section-title` + `.auth-doors` radios firing `patch.mutate`, `SettingsTab.js:70-87`); `PATCH /api/classes/:id` already validates via the shared schema and logs `class.updated` in-tx (`classes.ts:112-125`).
- Produces: `peerSharing` on the wire — in `UpdateClassSettingsInputSchema`, in every class summary (`GET /api/classes`, `GET /api/classes/:id`), and in the Settings UI. Task 7's gate and Task 11's dialog both read this exact key name.

- [ ] **Step 1: Backend failing tests** — extend `classes.test.ts` following its own PATCH cases:

```ts
test("the sharing switch: off by default, teacher flips it, the event records it", async () => {
  const before = await app.inject({ method: "GET", url: `/api/classes/${classId}`, cookies: { pide_session: teacherCookie } });
  expect(before.json().class.peerSharing).toBe(false);

  const res = await app.inject({
    method: "PATCH",
    url: `/api/classes/${classId}`,
    cookies: { pide_session: teacherCookie },
    payload: { peerSharing: true },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().class.peerSharing).toBe(true);

  const evts = await testDb.select().from(events).where(eq(events.type, "class.updated"));
  const payload = evts.at(-1)!.payload as { patch: Record<string, unknown> };
  expect(payload.patch).toEqual({ peerSharing: true });
});
```

(Reuse the file's existing fixture names; a student-PATCH refusal is already covered by the existing suite and needs no new case.)

- [ ] **Step 2: Implement.** `shared/src/classes.ts` — add to `UpdateClassSettingsInputSchema` after `joinMode` (`:33`):

```ts
  peerSharing: z.boolean().optional(),
```

`classes.ts` — `toClassSummary` gains `peerSharing: row.peerSharing,` (after `archived`); the PATCH patch-builder gains, after the `joinMode` line (`:119`):

```ts
    if (parsed.data.peerSharing !== undefined) patch.peerSharing = parsed.data.peerSharing;
```

Run backend suite green, typecheck both workspaces.

- [ ] **Step 3: Frontend failing test** — `frontend/src/components/classes/__tests__/settingsTab.test.js`, the `assignmentsTab.test.js` mock idiom (mocked ClassChrome render-prop shell, mocked react-query, mocked router):

```js
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import SettingsTab from "../SettingsTab";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useMutation } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "c1" }) }));

const { classHolder } = vi.hoisted(() => ({
  classHolder: { data: { id: "c1", name: "9B", subjectLabel: null, joinMode: "open", archived: false, peerSharing: false } },
}));
vi.mock("../ClassChrome", () => ({
  default: ({ children }) => children(classHolder.data, { id: "u1" }),
}));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
  classHolder.data = { ...classHolder.data, peerSharing: false };
});

describe("SettingsTab — sharing rules (spec §8.3, design D§5.1)", () => {
  test("the section renders both doors, Off selected by default, and On fires the patch", () => {
    const mutate = vi.fn();
    useMutation.mockReturnValue({ mutate, isPending: false });
    mounted = mountComponent(<SettingsTab />);
    const container = mounted.container;

    expect(byText(container, "Sharing rules", "h2")).not.toBeNull();
    const doors = [...container.querySelectorAll('input[name="peerSharing"]')];
    expect(doors).toHaveLength(2);
    expect(doors[0].checked).toBe(true); // Off is the default (spec §8.3)

    click(doors[1]);
    expect(mutate).toHaveBeenCalledWith({ peerSharing: true });
  });
});
```

Run to fail (no "Sharing rules" heading yet).

- [ ] **Step 4: Implement the section** — in `SettingsBody`, between the Joining rules block and the `msg`/`error` alerts (`SettingsTab.js:87-88`):

```jsx
      <h2 className="section-title">Sharing rules</h2>
      <div className="auth-doors" style={{ maxWidth: 520 }}>
        {[
          [false, "Off — classmates can't share work with each other"],
          [true, "On — classmates can share copies of their work; every share is recorded"],
        ].map(([value, label]) => (
          <label
            key={String(value)}
            className={classData.peerSharing === value ? "auth-door auth-door--on" : "auth-door"}
          >
            <input
              type="radio"
              name="peerSharing"
              checked={classData.peerSharing === value}
              onChange={() => patch.mutate({ peerSharing: value })}
            />
            {label}
          </label>
        ))}
      </div>
```

("every share is recorded" is spec §8.1's own promise, at the point of use — the switch's copy is part of the honesty layer, not marketing.)

- [ ] **Step 5: All suites green; commit**

```bash
git add shared/src backend/src frontend/src
git commit -m "feat: the class sharing switch — peer_sharing end to end, off by default, recorded in class.updated"
```

---

### Task 6: The individual-work flag made real — the stamp, the true label, the flag threaded to the IDE

The flag exists (`assignments.individual_work`, validated cross-field) but is inert, and the editor label was softened to "Each student's submission is marked individually" (`AssignmentEditorPage.js:313`) to stay honest while sharing did not exist (memo §3.1 F). This task ships the student-visible stamp (spec §5.1) and threads the flag into the IDE's cached assignment context so Task 11 can hide the Share control synchronously. The server-side override itself lands with the gate (Task 7).

**Files:**

- Modify: `frontend/src/components/assignments/AssignmentPage.js` (the stamp, in the header at `:273-279`)
- Modify: `frontend/src/components/assignments/AssignmentEditorPage.js` (`:313`, the label)
- Modify: `frontend/src/utils/storage/assignmentMeta.js` (record gains `individualWork`)
- Modify: `frontend/src/utils/assignments/startWork.js` (`cacheContext`, `:192-203`)
- Modify: `frontend/src/contexts/AssignmentContext.js` (the refresh block's `meta`, `:77-84`)
- Modify: `frontend/src/components/assignments/__tests__/assignmentPage.test.js`, `assignmentEditor.test.js`, `frontend/src/utils/assignments/__tests__/startWork.test.js`, `frontend/src/contexts/__tests__/AssignmentContext.test.js` (extend each)

**Interfaces:**

- Consumes: `toAssignmentSummary` already returns `individualWork` (`assignments.ts:89`) — no backend change.
- Produces: `individualWork: boolean` on the cached assignment-meta record and on `useAssignmentContext()`'s value — the exact key Task 11's Toolbar gate reads as `assignment?.individualWork`.

- [ ] **Step 1: Failing tests.**
  - `assignmentPage.test.js`: with `individualWork: true` in the mocked assignment, `byText(container, "individual work", "span")` is non-null and carries `badge` classes; with `false` it is absent.
  - `assignmentEditor.test.js`: the checkbox label reads exactly `Individual work — students see the stamp, and this work can't be shared with classmates`.
  - `startWork.test.js`: extend the existing cacheContext assertion — the meta written by a start now includes `individualWork: true` when the assignment carries it.
  - `AssignmentContext.test.js`: the refreshed meta includes `individualWork` from the server payload.
- [ ] **Step 2: Implement.**
  - `AssignmentPage.js`, in `.assignment-page-header` directly after the phase badge (`:279`):

```jsx
        {assignment.individualWork ? (
          <span className="badge badge--accent">individual work</span>
        ) : null}
```

- `AssignmentEditorPage.js:313`: replace the label text with `Individual work — students see the stamp, and this work can't be shared with classmates`. **Why this wording is honest at THIS commit:** sharing does not exist anywhere yet, so "can't be shared" is simply true today; after Task 7 it is enforced server-side and stays true. The old label ("marked individually") described a behaviour the flag never had — spec §5.1's meaning is the stamp plus the sharing override.
- `assignmentMeta.js`: `setAssignmentMeta` writes `individualWork: meta.individualWork ?? false,` (after `groupId`); extend the header comment's record shape to `{ assignmentId, classId, title, dueAt, rules, groupId, individualWork }` and note: *"`individualWork` (Plan 7) is read OFFLINE by the Toolbar's Share gate — like the rules, enforcement errs toward enforcement when the cache is stale."*
- `startWork.js` `cacheContext`: add `individualWork: assignment.individualWork ?? false,`.
- `AssignmentContext.js` refresh block: add `individualWork: fresh.assignment.individualWork ?? false,` to `meta`.

- [ ] **Step 3: Suites green; commit**

```bash
git add frontend/src
git commit -m "feat: the individual-work flag made real — the student stamp, the true label, the flag threaded to the IDE"
```

---

## Stage B — the share (server)

### Task 7: The gate and POST /api/shares — frozen from the server head, ledgered in the same transaction

**Files:**

- Create: `backend/src/routes/shares.ts`
- Create: `backend/src/routes/shares.test.ts`
- Modify: `backend/src/app.ts` (import + `app.register(shareRoutes);` after `guideRoutes`, `app.ts:52`)

**Interfaces:**

- Consumes: `CreateShareInputSchema`, `WorkspaceRulesSchema` (`@physics-ide/shared`); `getMembership`, `ClassAuthError`, `sendClassAuthError` (`../classes/guards.js`); `requireConfirmed` (`../auth/guards.js`); `logEvent` (`../db/events.js`); tables `classes`, `projects`, `groups`, `assignmentWork`, `assignments`, `shares`, `users`; `pgErrorCode` (Task 1).
- Produces: the sentence consts below (Tasks 8–11 and 14 assert them verbatim); `requireShareable` (private — the ONE gate function, D§5); `POST /api/shares` → `201 { share: { id, classId, recipientId, status } }`; event `project.shared` with the D§3 payload including `sourceAttribution` (the D§9 chain).

- [ ] **Step 1: Write the failing suite** — `shares.test.ts`, the `groups.test.ts` idiom (`buildApp({ db: testDb })`, `makeUser`/`signin` helpers with the per-IP counter, `eventsOfType`, `beforeAll` truncate). The fixture world: one teacher, two students (alpha the sharer, bravo the recipient), one outsider; a class with `peerSharing` flipped on via PATCH; alpha owns a pushed project `p-share-src` (insert the `projects` row directly with a minimal valid manifest — `{ schemaVersion: 2, id: "p-share-src", title: "Pendulum", goal: "physics", projectType: "custom", createdAt: 1000, updatedAt: 5000 }` — and `clientUpdatedAt: 5000`). The matrix, one test per refusal, sentences asserted verbatim:

| Case                     | Arrange                                                                                                                                                                                                                       | Expect                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| switch off               | PATCH`peerSharing:false` first                                                                                                                                                                                              | 403`"Peer sharing is off for this class."`                                                                                                                                                                                                                                                                          |
| sharer not a member      | outsider posts                                                                                                                                                                                                                | 403`"Not a member of this class."`                                                                                                                                                                                                                                                                                  |
| recipient inactive       | bravo's membership row set`status:"waiting"` directly                                                                                                                                                                       | 400`"They're not an active member of this class."`                                                                                                                                                                                                                                                                  |
| self                     | recipient = alpha                                                                                                                                                                                                             | 400`"You can't share a project with yourself."`                                                                                                                                                                                                                                                                     |
| not the sharer's project | projectId owned by bravo                                                                                                                                                                                                      | 404`"No such project."`                                                                                                                                                                                                                                                                                             |
| tombstoned project       | set`deletedAt` on the row                                                                                                                                                                                                   | 404`"No such project."`                                                                                                                                                                                                                                                                                             |
| group project            | insert an`assignments` row (`submissionMode:"group"`, any status) + a `groups` row with `ownerId: alpha.id, projectId: "p-share-src"`                                                                                 | 403`"A group's shared project belongs to the whole group — it can't be shared out."`                                                                                                                                                                                                                               |
| individual work          | insert an`assignments` row (`individualWork:true`, `rules` = `BUILT_IN_RULE_SETS.open_practice`) + an `assignment_work` row keyed `(assignmentId, userId: alpha.id, ownerId: alpha.id, projectId: "p-share-src")` | 403`"This assignment is individual work — it can't be shared."`                                                                                                                                                                                                                                                    |
| export off               | same but`individualWork:false`, `rules` = `BUILT_IN_RULE_SETS.locked_assessment`                                                                                                                                        | 403`"This assignment's rules don't allow copies to leave the workspace."`                                                                                                                                                                                                                                           |
| archived class           | archive via`POST /api/classes/:id/archive`                                                                                                                                                                                  | 400`"That class is archived."`                                                                                                                                                                                                                                                                                      |
| duplicate pending        | share once, share again                                                                                                                                                                                                       | 409`"Already shared with them — it's waiting on their class page."`                                                                                                                                                                                                                                                |
| happy path               | clean world                                                                                                                                                                                                                   | 201; a`shares` row `status:"pending"` whose `frozenManifest` equals the head manifest and `sourceClientUpdatedAt` is `5000`; one `project.shared` event whose payload carries `{ shareId, classId, recipientId, sourceOwnerId, sourceProjectId, sourceClientUpdatedAt: 5000, sourceAttribution: null }` |

(Direct table inserts for the assignment/group fixtures are deliberate — driving the full teacher flow for each refusal would triple the file for no additional truth. The assignment rows need only the NOT-NULL columns: `classId`, `createdBy`, `title`, `instructions: { type: "doc", content: [] }`, `projectType: "physics"`, `rules`, plus the case's own fields.)

- [ ] **Step 2: Run to fail** — `npm run test -w backend` → FAIL (404s: the route does not exist).
- [ ] **Step 3: Write `backend/src/routes/shares.ts`** — consts, gate, POST:

```ts
import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { CreateShareInputSchema, AcceptShareInputSchema, WorkspaceRulesSchema } from "@physics-ide/shared";
import {
  assignments,
  assignmentWork,
  classes,
  groups,
  projects,
  shares,
  users,
} from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { ClassAuthError, getMembership, sendClassAuthError } from "../classes/guards.js";
import { logEvent } from "../db/events.js";
import { pgErrorCode } from "../lib/util.js";
import type { Db } from "../db/types.js";
import { isAtCap, ManifestSchema } from "./projects.js";

type ShareRow = typeof shares.$inferSelect;

/* Every refusal is a named sentence, asserted verbatim by shares.test.ts
 * and the authority matrix — the assignments.ts idiom. */
const SHARING_OFF = "Peer sharing is off for this class.";
const NOT_A_MEMBER = "Not a member of this class.";
const RECIPIENT_NOT_ACTIVE = "They're not an active member of this class.";
const SELF_SHARE = "You can't share a project with yourself.";
const NO_SUCH_CLASS = "No such class.";
const CLASS_ARCHIVED = "That class is archived.";
const NO_SUCH_PROJECT = "No such project.";
const GROUP_PROJECT = "A group's shared project belongs to the whole group — it can't be shared out.";
const INDIVIDUAL_WORK = "This assignment is individual work — it can't be shared.";
const EXPORT_OFF = "This assignment's rules don't allow copies to leave the workspace.";
const ALREADY_PENDING = "Already shared with them — it's waiting on their class page.";
const NO_SUCH_SHARE = "No such share.";
const SHARE_RESOLVED = "That share has already been dealt with.";
const REVOKE_FORBIDDEN = "Only the sharer or the class teacher can revoke a share.";
/** D§14.8: the recipient must never see the generic own-limit sentence on
 *  someone else's action — the cap refusal at accept has its own words. */
const SHARE_CAP = "You're at the 100-project limit — the copy needs a free slot. Delete something first, then add it.";
const COPY_ID_TAKEN = "That project id is already in use — try again.";
/** §11's own word for an erased person, everywhere a sharer's name resolves. */
export const REMOVED_STUDENT = "Removed student";

/** The D§5 gate — ONE function, one place, every refusal a named sentence,
 *  everything failing closed. Thrown as ClassAuthError so the routes keep
 *  the groups.ts try/sendClassAuthError idiom. */
async function requireShareable(
  db: Db,
  sharerId: string,
  input: { classId: string; recipientId: string; projectId: string },
): Promise<{ sourceHead: typeof projects.$inferSelect }> {
  const classRows = await db.select().from(classes).where(eq(classes.id, input.classId));
  const c = classRows[0];
  if (!c) throw new ClassAuthError(404, NO_SUCH_CLASS);
  if (c.archived) throw new ClassAuthError(400, CLASS_ARCHIVED);
  const sharer = await getMembership(db, input.classId, sharerId);
  if (!sharer || sharer.status !== "active") throw new ClassAuthError(403, NOT_A_MEMBER);
  // D§5.1 — the class switch, off by default.
  if (!c.peerSharing) throw new ClassAuthError(403, SHARING_OFF);
  if (input.recipientId === sharerId) throw new ClassAuthError(400, SELF_SHARE);
  // D§5.2 — any role may share and receive, but both must be active members.
  const recipient = await getMembership(db, input.classId, input.recipientId);
  if (!recipient || recipient.status !== "active") {
    throw new ClassAuthError(400, RECIPIENT_NOT_ACTIVE);
  }
  const headRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, sharerId), eq(projects.id, input.projectId)));
  const sourceHead = headRows[0];
  if (!sourceHead || sourceHead.deletedAt) throw new ClassAuthError(404, NO_SUCH_PROJECT);
  // D§5.4 — enforced on the ROW's identity, never the actor: a group
  // member's pulled local copy must not launder the group's work out.
  const groupRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(eq(groups.ownerId, sharerId), eq(groups.projectId, input.projectId)))
    .limit(1);
  if (groupRows.length > 0) throw new ClassAuthError(403, GROUP_PROJECT);
  // D§5.3 — assignment work: the individual-work override (spec §5.1's
  // real meaning, restored), then the export rule — a share is a copy-out
  // and §5.4 carved out submit, not share.
  const workRows = await db
    .select({ assignment: assignments })
    .from(assignmentWork)
    .innerJoin(assignments, eq(assignments.id, assignmentWork.assignmentId))
    .where(and(eq(assignmentWork.ownerId, sharerId), eq(assignmentWork.projectId, input.projectId)));
  for (const { assignment } of workRows) {
    if (assignment.individualWork) throw new ClassAuthError(403, INDIVIDUAL_WORK);
    const rules = WorkspaceRulesSchema.safeParse(assignment.rules);
    // Unreadable rules fail CLOSED — a lockdown that cannot be read is a lockdown.
    if (!rules.success || !rules.data.exportAndCopy) throw new ClassAuthError(403, EXPORT_OFF);
  }
  return { sourceHead };
}

export function shareRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/shares", async (req, reply) => {
    const parsed = CreateShareInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    let sourceHead: typeof projects.$inferSelect;
    try {
      ({ sourceHead } = await requireShareable(app.db, req.user!.id, parsed.data));
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    // One pending hand-off per (source, recipient) — fan-out is one share
    // per recipient (D§1), and a second identical pending row would only
    // let the recipient mint two copies from one gesture.
    const dup = await app.db
      .select({ id: shares.id })
      .from(shares)
      .where(
        and(
          eq(shares.sourceOwnerId, req.user!.id),
          eq(shares.sourceProjectId, parsed.data.projectId),
          eq(shares.recipientId, parsed.data.recipientId),
          eq(shares.status, "pending"),
        ),
      )
      .limit(1);
    if (dup.length > 0) return reply.code(409).send({ error: ALREADY_PENDING });

    const created = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(shares)
        .values({
          classId: parsed.data.classId,
          sharerId: req.user!.id,
          recipientId: parsed.data.recipientId,
          sourceOwnerId: req.user!.id,
          sourceProjectId: parsed.data.projectId,
          frozenManifest: sourceHead.manifest,
          sourceClientUpdatedAt: sourceHead.clientUpdatedAt,
        })
        .returning();
      // D§3: the ledger row, same transaction — a share cannot happen
      // without its event. D§9: the label will name the immediate sharer;
      // the LEDGER records the chain, so the source's own attribution (if
      // this is a re-share of an accepted copy) rides the payload.
      await logEvent(tx, "project.shared", req.user!.id, {
        shareId: row.id,
        classId: parsed.data.classId,
        recipientId: parsed.data.recipientId,
        sourceOwnerId: req.user!.id,
        sourceProjectId: parsed.data.projectId,
        sourceClientUpdatedAt: sourceHead.clientUpdatedAt,
        sourceAttribution: sourceHead.attribution ?? null,
      });
      return row;
    });
    return reply.code(201).send({
      share: {
        id: created.id,
        classId: created.classId,
        recipientId: created.recipientId,
        status: created.status,
      },
    });
  });
}
```

(The consts `AcceptShareInputSchema`, `z`, `desc`, `users`, `isAtCap`, `ManifestSchema`, `pgErrorCode`, `NO_SUCH_SHARE`, `SHARE_RESOLVED`, `REVOKE_FORBIDDEN`, `SHARE_CAP`, `COPY_ID_TAKEN`, `REMOVED_STUDENT` are consumed by Tasks 8–10, which extend THIS file — declaring them now keeps the sentence block complete in one commit; if the linter objects to unused imports before Task 8 lands, keep the imports minimal here and add them in Task 8/9 instead — the consts stay.) `isAtCap` is not yet exported — Task 9 exports it; until then omit it from the import line.

- [ ] **Step 4: Register the plugin** — `backend/src/app.ts`: `import { shareRoutes } from "./routes/shares.js";` (after `tickRoutes`, `:14`) and `app.register(shareRoutes);` after `app.register(guideRoutes);` (`:52`).
- [ ] **Step 5: Run to pass** — the matrix green, typecheck clean.
- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(backend): the share gate and POST /api/shares - frozen from the server head, ledgered in the same transaction"
```

---

### Task 8: Delivery reads and lifecycle — incoming, the names-only roster, revoke, and the switch-off lapse

**Files:**

- Modify: `backend/src/routes/shares.ts` (three routes)
- Modify: `backend/src/routes/classes.ts` (the PATCH transaction gains the lapse)
- Modify: `backend/src/routes/shares.test.ts`, `backend/src/routes/classes.test.ts`

**Interfaces:**

- Consumes: Task 7's consts and world; `users` for name resolution.
- Produces:
  - `GET /api/shares/incoming?classId=` (active member): `{ shares: [{ id, classId, title, sharerName, createdAt }] }` — pending rows addressed to the caller, newest first; `title` from the frozen manifest; `sharerName` resolved live, `REMOVED_STUDENT` when the user row is gone. Task 12's section renders exactly this shape.
  - `GET /api/shares/roster/:classId` (active member, switch on): `{ members: [{ userId, name, role }] }` — active members minus the caller, name-ordered. **Names only** — no email, no status: the `groupShape` precedent (`groups.ts:103-110`), the narrowest §11 cut. Note (recorded): design D§6 says the picker uses "data the class read already returns", but at `930edcf` no student-readable roster exists — `GET /api/classes/:id/members` is staff-only (`members.ts:57`) — so this minimal read supplies it; see Self-review 4.
  - `POST /api/shares/:id/revoke` (the sharer or the class teacher; pending only): flips to `revoked` + `resolvedAt`, logs `project.share_revoked` in-tx. Refusals: 404 `NO_SUCH_SHARE`, 403 `REVOKE_FORBIDDEN`, 409 `SHARE_RESOLVED`.
  - The lapse (D§8): flipping `peerSharing` off lapses that class's pending shares in the same `class.updated` transaction, one `project.share_lapsed` event each; accepted copies stand.

- [ ] **Step 1: Failing tests.** `shares.test.ts`: incoming lists the pending share with `sharerName` = alpha's name and the frozen title; a revoked/lapsed/accepted share disappears from it; roster returns bravo+teacher for alpha (never alpha, never an email key — assert `Object.keys(members[0])` is exactly `["userId", "name", "role"]`); roster refuses 403 `SHARING_OFF` when the switch is off; revoke by alpha works and logs; revoke by bravo (the recipient) and by the TA → 403 `REVOKE_FORBIDDEN`; revoke twice → 409 `SHARE_RESOLVED`. `classes.test.ts`: with one pending and one accepted share seeded, PATCH `peerSharing:false` lapses the pending (status + `resolvedAt` set, one `project.share_lapsed` event naming it) and leaves the accepted row untouched.
- [ ] **Step 2: Implement the three routes** in `shares.ts`:

```ts
  app.get("/api/shares/incoming", async (req, reply) => {
    const classId = z.string().uuid().safeParse((req.query as { classId?: string }).classId);
    if (!classId.success) return reply.code(400).send({ error: "Invalid input." });
    const m = await getMembership(app.db, classId.data, req.user!.id);
    if (!m || m.status !== "active") return reply.code(403).send({ error: NOT_A_MEMBER });
    const rows = await app.db
      .select({ share: shares, sharerName: users.name })
      .from(shares)
      .leftJoin(users, eq(users.id, shares.sharerId))
      .where(
        and(
          eq(shares.classId, classId.data),
          eq(shares.recipientId, req.user!.id),
          eq(shares.status, "pending"),
        ),
      )
      .orderBy(desc(shares.createdAt));
    return {
      shares: rows.map(({ share, sharerName }) => ({
        id: share.id,
        classId: share.classId,
        title: (share.frozenManifest as { title?: string }).title ?? "Untitled project",
        // §11 erasure: the name resolves at read time, or to the same word
        // the spec uses for erased submissions.
        sharerName: sharerName ?? REMOVED_STUDENT,
        createdAt: share.createdAt.getTime(),
      })),
    };
  });

  app.get("/api/shares/roster/:classId", async (req, reply) => {
    const { classId } = req.params as { classId: string };
    const classRows = await app.db.select().from(classes).where(eq(classes.id, classId));
    const c = classRows[0];
    if (!c) return reply.code(404).send({ error: NO_SUCH_CLASS });
    const m = await getMembership(app.db, classId, req.user!.id);
    if (!m || m.status !== "active") return reply.code(403).send({ error: NOT_A_MEMBER });
    // The picker obeys the same switch as the share itself — no roster
    // browsing through a feature the teacher has off (D§5 fails closed).
    if (!c.peerSharing) return reply.code(403).send({ error: SHARING_OFF });
    const rows = await app.db
      .select({ userId: classMembers.userId, name: users.name, role: classMembers.role })
      .from(classMembers)
      .innerJoin(users, eq(classMembers.userId, users.id))
      .where(and(eq(classMembers.classId, classId), eq(classMembers.status, "active")))
      .orderBy(users.name);
    return { members: rows.filter((r) => r.userId !== req.user!.id) };
  });

  app.post("/api/shares/:id/revoke", async (req, reply) => {
    const { id } = req.params as { id: string };
    const outcome = await app.db.transaction(async (tx) => {
      const rows = await tx.select().from(shares).where(eq(shares.id, id)).for("update");
      const share = rows[0];
      if (!share) return { kind: "missing" as const };
      const m = await getMembership(tx, share.classId, req.user!.id);
      const active = !!m && m.status === "active";
      const maySee = active && (share.sharerId === req.user!.id || share.recipientId === req.user!.id || m!.role === "teacher");
      if (!maySee) return { kind: "missing" as const }; // existence is not their business
      const mayRevoke = active && (share.sharerId === req.user!.id || m!.role === "teacher");
      if (!mayRevoke) return { kind: "forbidden" as const };
      if (share.status !== "pending") return { kind: "resolved" as const };
      await tx
        .update(shares)
        .set({ status: "revoked", resolvedAt: new Date() })
        .where(eq(shares.id, id));
      await logEvent(tx, "project.share_revoked", req.user!.id, {
        shareId: id,
        classId: share.classId,
        sharerId: share.sharerId,
        recipientId: share.recipientId,
      });
      return { kind: "revoked" as const };
    });
    if (outcome.kind === "missing") return reply.code(404).send({ error: NO_SUCH_SHARE });
    if (outcome.kind === "forbidden") return reply.code(403).send({ error: REVOKE_FORBIDDEN });
    if (outcome.kind === "resolved") return reply.code(409).send({ error: SHARE_RESOLVED });
    return { ok: true };
  });
```

(`classMembers` joins the schema import line. The revoke's "maySee" line makes a stranger's probe indistinguishable from a missing share — the draft-404 posture.)

- [ ] **Step 3: The lapse** — in `classes.ts`'s PATCH transaction (`:121-125`), after the `update` and before the `class.updated` log:

```ts
      // D§8: the switch is a live control — new shares stop, PENDING
      // hand-offs lapse. Accepted copies are the recipient's own projects
      // and stand; the ledger keeps every row it ever wrote.
      if (patch.peerSharing === false && c.peerSharing === true) {
        const pending = await tx
          .select()
          .from(shares)
          .where(and(eq(shares.classId, id), eq(shares.status, "pending")))
          .for("update");
        for (const s of pending) {
          await tx
            .update(shares)
            .set({ status: "lapsed", resolvedAt: new Date() })
            .where(eq(shares.id, s.id));
          await logEvent(tx, "project.share_lapsed", req.user!.id, {
            shareId: s.id,
            classId: id,
            sharerId: s.sharerId,
            recipientId: s.recipientId,
          });
        }
      }
```

(`shares` and `and` join `classes.ts`'s imports.)

- [ ] **Step 4: Green; commit**

```bash
git add backend/src
git commit -m "feat(backend): share delivery - incoming list, the names-only roster, revoke, and the switch-off lapse"
```

---

### Task 9: Accept — the copy minted with its attribution, the cap refused with its own sentence

**Files:**

- Modify: `backend/src/routes/projects.ts` (export `isAtCap` — add `export` at `:94` plus one comment line: `Exported for the share-accept route (Plan 7): an accepted copy is a created project and pays the same cap, refused with the share's OWN sentence.`)
- Modify: `backend/src/routes/shares.ts` (the accept route)
- Modify: `backend/src/routes/shares.test.ts`

**Interfaces:**

- Consumes: `AcceptShareInputSchema` (Task 3); `isAtCap`, `ManifestSchema` (`./projects.js`); `pgErrorCode` (Task 1).
- Produces: `POST /api/shares/:id/accept` → `{ manifest, attribution: { sharerId, shareId, sharerName } }` where `manifest` is the frozen manifest with `id` rewritten to the body's fresh mint — **byte-identical to what the server stored**, which is what makes the client's later push the identical-re-push no-op (`projects.ts:238-244`). Event `project.share_accepted` with `copyProjectId`. Task 12's `acceptShare` consumes this reply shape verbatim.

- [ ] **Step 1: Failing tests** (`shares.test.ts`):

  - Happy path: bravo accepts with `{ projectId: "p-copy-1" }` → 200; a `projects` row `(bravo, "p-copy-1")` exists with `manifest.id === "p-copy-1"`, `clientUpdatedAt === 5000`, and `attribution` `{ sharerId: alpha.id, shareId }`; the share row is `accepted` with `copyProjectId: "p-copy-1"`; one `project.share_accepted` event carries `copyProjectId`; the reply's `attribution.sharerName` is alpha's name.
  - The copy survives the source's death: alpha tombstones `p-share-src` first (direct `deletedAt` update); accept still succeeds from the frozen manifest (D§4).
  - The cap: insert 100 live projects for bravo directly, accept → 403 exactly `"You're at the 100-project limit — the copy needs a free slot. Delete something first, then add it."` and the share stays `pending` (they can delete something and come back).
  - Double accept → 409 `SHARE_RESOLVED`; accepting a revoked share → 409; a stranger (or the sharer) accepting → 404 `NO_SUCH_SHARE`; a recipient whose membership went `waiting` → 403 `NOT_A_MEMBER`; a body reusing the SOURCE's id (`p-share-src`) is legal input but collides only if bravo owns that id — assert the fresh-id path, and assert `COPY_ID_TAKEN` by pre-inserting a bravo project named `p-copy-9` and accepting with that id → 409.
- [ ] **Step 2: Implement** in `shares.ts`:

```ts
  app.post("/api/shares/:id/accept", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = AcceptShareInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const result = await app.db.transaction(async (tx) => {
      const rows = await tx.select().from(shares).where(eq(shares.id, id)).for("update");
      const share = rows[0];
      // A share that is not yours to accept does not exist for you.
      if (!share || share.recipientId !== req.user!.id) return { kind: "missing" as const };
      const m = await getMembership(tx, share.classId, req.user!.id);
      if (!m || m.status !== "active") return { kind: "not-member" as const };
      if (share.status !== "pending") return { kind: "resolved" as const };
      // D§14.8 — their cap, their slot, their OWN sentence. isAtCap locks
      // the recipient's user row, serializing against their own pushes.
      if (await isAtCap(tx, req.user!.id)) return { kind: "cap" as const };
      // D§2: an ordinary project under a FRESH id — never the source's.
      // The manifest the row stores is EXACTLY the manifest the reply
      // carries; the client saves it verbatim (preserveTimestamp) and its
      // later push lands in projects.ts's identical-re-push no-op branch.
      const checked = ManifestSchema.safeParse({
        ...(share.frozenManifest as Record<string, unknown>),
        id: parsed.data.projectId,
      });
      if (!checked.success) return { kind: "invalid" as const };
      try {
        await tx.transaction(async (sp) => {
          await sp.insert(projects).values({
            id: checked.data.id,
            ownerId: req.user!.id,
            title: checked.data.title,
            goal: checked.data.goal,
            projectType: checked.data.projectType,
            manifest: checked.data,
            clientUpdatedAt: checked.data.updatedAt,
            // D§3: ids only — the name is resolved at read time, so §11
            // erasure has one place to act.
            attribution: { sharerId: share.sharerId, shareId: share.id },
          });
        });
      } catch (err) {
        if (pgErrorCode(err) === "23505") return { kind: "taken" as const };
        throw err;
      }
      await tx
        .update(shares)
        .set({ status: "accepted", resolvedAt: new Date(), copyProjectId: checked.data.id })
        .where(eq(shares.id, share.id));
      await logEvent(tx, "project.share_accepted", req.user!.id, {
        shareId: share.id,
        classId: share.classId,
        sharerId: share.sharerId,
        sourceOwnerId: share.sourceOwnerId,
        sourceProjectId: share.sourceProjectId,
        sourceClientUpdatedAt: share.sourceClientUpdatedAt,
        copyProjectId: checked.data.id,
      });
      return { kind: "accepted" as const, share, manifest: checked.data };
    });

    if (result.kind === "missing") return reply.code(404).send({ error: NO_SUCH_SHARE });
    if (result.kind === "not-member") return reply.code(403).send({ error: NOT_A_MEMBER });
    if (result.kind === "resolved") return reply.code(409).send({ error: SHARE_RESOLVED });
    if (result.kind === "cap") return reply.code(403).send({ error: SHARE_CAP });
    if (result.kind === "invalid") return reply.code(400).send({ error: "That doesn't look like a valid project." });
    if (result.kind === "taken") return reply.code(409).send({ error: COPY_ID_TAKEN });

    const sharerRows = await app.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, result.share.sharerId));
    return {
      manifest: result.manifest,
      attribution: {
        sharerId: result.share.sharerId,
        shareId: result.share.id,
        sharerName: sharerRows[0]?.name ?? REMOVED_STUDENT,
      },
    };
  });
```

- [ ] **Step 3: Green; commit**

```bash
git add backend/src
git commit -m "feat(backend): accept mints the copy - attribution written at accept, the cap refused with its own sentence"
```

---

### Task 10: The attribution read — names resolved live, erasure-safe, chains ledgered

**Files:**

- Modify: `backend/src/routes/shares.ts` (one route)
- Modify: `backend/src/routes/shares.test.ts`

**Interfaces:**

- Consumes: `projects.attribution` rows (Task 9); `inArray`, `isNotNull`, `isNull` from `drizzle-orm` (join the import).
- Produces: `GET /api/shares/attributions` → `{ attributions: { [projectId]: { sharerId, shareId, sharerName } } }` for every live attributed project the CALLER owns. This is the client's online name-refresh feed (Task 13's `refreshShareAttributions`) — and the second-device path by which a copy accepted elsewhere gains its local label.

- [ ] **Step 1: Failing tests:**

  - Bravo's map carries `p-copy-1` with alpha's live name.
  - **Erasure** (§11): delete alpha's `users` row directly (`testDb.delete(users).where(eq(users.id, alpha.id))` — alpha's OWN projects cascade away, the recipient's copy and the `shares` row survive because neither carries a user FK; assert both survivals) → the map now reads `sharerName: "Removed student"`, and a fresh pending share's `incoming` row does too.
  - **The chain** (D§9): bravo (with class sharing on) shares `p-copy-1` onward to charlie → the new `project.shared` event's `sourceAttribution` equals `{ sharerId: alpha.id, shareId: <first share id> }`; charlie accepts → charlie's attribution names BRAVO (`sharerId: bravo.id`) — one person on the label, the whole provenance in the record.
- [ ] **Step 2: Implement:**

```ts
  app.get("/api/shares/attributions", async (req) => {
    const rows = await app.db
      .select({ id: projects.id, attribution: projects.attribution })
      .from(projects)
      .where(
        and(
          eq(projects.ownerId, req.user!.id),
          isNotNull(projects.attribution),
          isNull(projects.deletedAt),
        ),
      );
    const sharerIds = [...new Set(rows.map((r) => (r.attribution as { sharerId: string }).sharerId))];
    const named = sharerIds.length
      ? await app.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, sharerIds))
      : [];
    const nameById = new Map(named.map((u) => [u.id, u.name]));
    const attributions: Record<string, { sharerId: string; shareId: string; sharerName: string }> = {};
    for (const r of rows) {
      const a = r.attribution as { sharerId: string; shareId: string };
      attributions[r.id] = {
        sharerId: a.sharerId,
        shareId: a.shareId,
        // §11: resolved at read time — an erased sharer is the same
        // "Removed student" the spec uses for erased submissions.
        sharerName: nameById.get(a.sharerId) ?? REMOVED_STUDENT,
      };
    }
    return { attributions };
  });
```

- [ ] **Step 3: Green — Stage B gate:** `npm run test -w backend && npm run typecheck -w backend && npm run typecheck -w shared`.
- [ ] **Step 4: Commit**

```bash
git add backend/src
git commit -m "feat(backend): the attribution read - names resolved live, erased sharers read Removed student, chains ledgered"
```

---

## Stage C — the client

**The one architectural note for this stage (read before Task 11):** an accepted copy is an ORDINARY project the recipient owns. No task here touches `SyncProvider.js`, the sync engine, or manifest shapes — the copy adopts, pushes, reconciles and counts against the cap exactly like any project the recipient made. The only new client state is the `share-meta` sidecar (the `assignmentMeta.js` precedent, `assignmentMeta.js:1-27`): `{ shareId, sharerId, sharerName }` per accepted copy, where `sharerName` is a **cache for offline rendering** — the server never denormalises the name (D§3), and `refreshShareAttributions()` re-resolves it whenever the client is online.

### Task 11: Share… in the File menu — the overlay picker, gated beside its export siblings

**Files:**

- Create: `frontend/src/components/sharing/ShareDialog.js`
- Create: `frontend/src/components/sharing/__tests__/shareDialog.test.js`
- Modify: `frontend/src/components/Toolbar.js` (the item + the dialog mount)
- Modify: `frontend/src/components/__tests__/Toolbar.test.js` (the gate cases)
- Modify: `frontend/src/components/classes/__tests__/portalControls.test.js` (`DIRS` at `:12` gains `"components/sharing"` — the task that creates the directory adds it)
- Modify: `frontend/src/styles/assignments.css` (the Plan 7 section — created here, extended in Tasks 12–13)

**Interfaces:**

- Consumes: `Overlay` (`components/common/Overlay.js` — the product's one modal); `DropdownMenu` item idiom (`Toolbar.js:166-248` — each item a TOP-LEVEL child, never grouped in a Fragment, per the comment at `:183-187`); `ShareIcon` (already in `Icons.js:203`); `useAssignmentContext` (already read in Toolbar at `:97`); `exportsAllowed` (`Toolbar.js:103`); `peerSharing` on class summaries (Task 5); `GET /api/shares/roster/:classId` (Task 8); `POST /api/shares` (Task 7).
- Produces: the `Share…` item (D§6's exact name) and `<ShareDialog projectId onClose />`. Gate consts other tests assert: `HANDOFF_SENTENCE`, `NO_SHARING_CLASSES`, `EMPTY_ROSTER` (exact strings below).

**The gate, and where the item lives (D§5/D§6):** the item renders inside the File dropdown, after "Export Project Bundle" and before the History block, only when

```js
me && activeProjectId && exportsAllowed && !assignment?.groupId && !assignment?.individualWork
```

— signed-in, a project open, `exportAndCopy` not switched off (a share is a copy-out, D§5.3), not a group project, not individual work (both cached offline by Task 6; the server re-refuses all five server-side, so the client gate is §5.4's no-greyed-out-temptations, not the enforcement). When refused it is ABSENT, not disabled. **There is no overflow twin to build:** the 1120px stage-2 overflow collapses only view-zone keys (`Toolbar.js:339-370`); the File menu itself never collapses, so the item is present at every width by construction — record this, do not invent a second mount.

- [ ] **Step 1: Failing tests.**
  - `Toolbar.test.js` — extend with a `describe("the Share… item (Plan 7)")` using the file's own mocks (`useMe`, `useAssignmentContext` are already `vi.fn()`s; add `vi.mock("../sharing/ShareDialog", () => ({ default: () => React.createElement("div", { "data-testid": "share-dialog" }) }));`). Cases: signed-in + `activeProjectId` + null context → open the File menu (`click(byText(container, "File", "span").closest("button"))`), `byText(container, "Share…", "span")` present; clicking it mounts `[data-testid="share-dialog"]`. Absent when: `useMe` returns `{ data: null }`; context `{ rules: { ...open rules, exportAndCopy: false } }`; context `{ groupId: "g1" }`; context `{ individualWork: true }`. (Build the rules object from `BUILT_IN_RULE_SETS.open_practice` with `exportAndCopy` flipped — never a hand-typed rules literal.)
  - `shareDialog.test.js` — mock `@tanstack/react-query`'s `useQuery`/`useMutation` (the `assignmentsTab.test.js` idiom): one sharing-on class + a two-member roster renders the roster radios and the consequence line verbatim (`Once they add it, it's theirs — you can't take it back.`); zero sharing-on classes renders `None of your classes has peer sharing switched on.`; choosing a recipient and pressing Share calls the mutation with `{ classId, recipientId, projectId }`; a mutation error renders in `.alert--danger`.
- [ ] **Step 2: Implement `ShareDialog.js`:**

```jsx
import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Overlay from "../common/Overlay";
import { api } from "../../utils/api/client";

/* D§8, said at the point of use — nobody discovers revocation policy later. */
export const HANDOFF_SENTENCE = "Once they add it, it's theirs — you can't take it back.";
export const NO_SHARING_CLASSES = "None of your classes has peer sharing switched on.";
export const EMPTY_ROSTER = "Nobody else is in this class yet.";

/** The send surface (design D§6): the product's one overlay idiom, a
 *  class-roster picker, NO message field — a share carries a project and a
 *  name, nothing else (D§1). The server re-refuses everything this dialog
 *  cannot see (D§5 fails closed); errors land here as their own sentences. */
export default function ShareDialog({ projectId, onClose }) {
  const [classId, setClassId] = useState(null);
  const [recipientId, setRecipientId] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  const classesQ = useQuery({ queryKey: ["share", "classes"], queryFn: () => api("/api/classes") });
  const shareable = (classesQ.data?.classes ?? []).filter(
    (c) => c.peerSharing && !c.archived && c.myStatus === "active",
  );
  const chosenClass = classId ?? (shareable.length === 1 ? shareable[0].id : null);

  const rosterQ = useQuery({
    queryKey: ["share", "roster", chosenClass],
    queryFn: () => api(`/api/shares/roster/${chosenClass}`),
    enabled: !!chosenClass,
  });
  const members = rosterQ.data?.members ?? [];

  const send = useMutation({
    mutationFn: () =>
      api("/api/shares", { method: "POST", body: { classId: chosenClass, recipientId, projectId } }),
    onSuccess: () => setSentTo(members.find((m) => m.userId === recipientId)?.name ?? "them"),
  });

  return (
    <Overlay onClose={onClose} label="Share this project" panelClassName="share-dialog">
      <h2 className="share-dialog__title">Share this project</h2>
      {classesQ.isLoading ? null : shareable.length === 0 ? (
        <p className="empty">{NO_SHARING_CLASSES}</p>
      ) : sentTo ? (
        <p className="share-dialog__done" role="status">
          Shared with {sentTo}. It will wait on their class page until they add it.
        </p>
      ) : (
        <>
          {shareable.length > 1 ? (
            <label className="auth-label">
              Class
              <select
                className="input"
                value={chosenClass ?? ""}
                onChange={(e) => {
                  setClassId(e.target.value || null);
                  setRecipientId(null);
                }}
              >
                <option value="">Choose a class…</option>
                {shareable.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {chosenClass && !rosterQ.isLoading ? (
            members.length === 0 ? (
              <p className="empty">{EMPTY_ROSTER}</p>
            ) : (
              <div className="share-roster" role="radiogroup" aria-label="Share with">
                {members.map((m) => (
                  <label
                    key={m.userId}
                    className={recipientId === m.userId ? "auth-door auth-door--on" : "auth-door"}
                  >
                    <input
                      type="radio"
                      name="shareRecipient"
                      checked={recipientId === m.userId}
                      onChange={() => setRecipientId(m.userId)}
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            )
          ) : null}
          <p className="share-dialog__note">{HANDOFF_SENTENCE}</p>
          {send.error ? (
            <div className="alert alert--danger" role="alert">{send.error.message}</div>
          ) : null}
          <div className="share-dialog__actions">
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!chosenClass || !recipientId || send.isPending}
              onClick={() => send.mutate()}
            >
              Share
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
}
```

- [ ] **Step 3: The Toolbar item.** In `Toolbar.js`: `import { useState }` joins the React import; `import ShareDialog from "./sharing/ShareDialog";` and `ShareIcon` joins the Icons import; `const [shareOpen, setShareOpen] = useState(false);` beside the other component state. Inside the `fileMenu` renderer, after the Export Project Bundle item (`:224-229`) and before the History block (`:236`), as its own top-level child:

```jsx
          {me && activeProjectId && exportsAllowed && !assignment?.groupId && !assignment?.individualWork ? (
            <button type="button" className="tb-dropdown-item" onClick={() => setShareOpen(true)}>
              <ShareIcon size={14} />
              <span>Share…</span>
            </button>
          ) : null}
```

Wrap the component's return in a fragment and mount the dialog after `</header>`:

```jsx
      {shareOpen && <ShareDialog projectId={activeProjectId} onClose={() => setShareOpen(false)} />}
```

- [ ] **Step 4: `DIRS` and the stylesheet.** Add `"components/sharing"` to `portalControls.test.js:12`. Append to `frontend/src/styles/assignments.css` (tokens only — `assignmentsTokens.test.js` sweeps this sheet automatically):

```css
/* ── Plan 7 — peer sharing (design D§6/D§7) ─────────────────────────── */
.share-dialog { display: flex; flex-direction: column; gap: var(--space-4); }
.share-dialog__title { font-size: var(--fs-xl); font-weight: var(--fw-semibold); }
.share-roster { display: flex; flex-direction: column; gap: var(--space-2); max-height: 40vh; overflow-y: auto; }
.share-dialog__note { color: var(--text-dim); font-size: var(--fs-sm); }
.share-dialog__done { font-size: var(--fs-lg); }
.share-dialog__actions { display: flex; justify-content: flex-end; gap: var(--space-3); }
```

- [ ] **Step 5: Suites green (frontend + the conformance tests); commit**

```bash
git add frontend/src
git commit -m "feat(frontend): Share… in the File menu - the overlay picker, gated beside its export siblings"
```

---

### Task 12: Shared with you — the accept flow in start-work order, the sidecar carries the credit

**Files:**

- Create: `frontend/src/utils/storage/shareMeta.js`
- Create: `frontend/src/utils/sharing/acceptShare.js` + `frontend/src/utils/sharing/__tests__/acceptShare.test.js`
- Create: `frontend/src/components/sharing/SharedWithYou.js` + `frontend/src/components/sharing/__tests__/sharedWithYou.test.js`
- Modify: `frontend/src/utils/manifest/factory.js` (`function generateId` at `:46` gains `export` — the Plan 6 self-review-1 posture: export it rather than re-implement; a second id mint is a second id grammar)
- Modify: `frontend/src/components/assignments/AssignmentsTab.js` (mount the section)
- Modify: `frontend/src/styles/assignments.css` (the section's rows)

**Interfaces:**

- Consumes: `GET /api/shares/incoming` (Task 8), `POST /api/shares/:id/accept` (Task 9); `saveProject` (`utils/storage/projectStore.js` — `{ preserveTimestamp: true }`, the "a pull is not an edit" flag `groupSync.js` established); `getGlobalSyncEngine` (`utils/sync/syncEngine`), `assertPushSucceeded` (exported from `startWork.js:185`), `requestProjectOpen` (`utils/projectOpenRequest`), `LAST_PROJECT_KEY` (`constants`), `generateId` (this task's export).
- Produces: `shareMeta.js` — `getShareAttribution` / `setShareAttribution` / `deleteShareAttribution` / `listShareAttribution` / `_resetShareMetaForTests` over localforage store `share-meta`, record `{ shareId, sharerId, sharerName }`; `acceptShare(share, me)` → the new local project id; `<SharedWithYou classId />` — renders NOTHING when empty (D§6).

- [ ] **Step 1: Failing tests.**
  - `acceptShare.test.js` — mock `../../api/client`, `../../storage/projectStore`, `../../storage/shareMeta`, `../../sync/syncEngine`, `../../assignments/startWork` (for `assertPushSucceeded`), `../../projectOpenRequest`, and `../../manifest/factory` (`generateId: () => "p-fresh-1"`). Assert, with a mock-call-order array, D§4's exact order: `api(accept)` → `saveProject(manifest, { preserveTimestamp: true })` → `setShareAttribution("p-fresh-1", attribution)` → `engine.pushProject("p-fresh-1", "u-me")` → `assertPushSucceeded` → `requestProjectOpen("p-fresh-1")`. Assert the accept body is `{ projectId: "p-fresh-1" }`. Assert a rejecting `api` propagates and NOTHING after it ran (the cap sentence reaches the section untouched).
  - `sharedWithYou.test.js` — mocked `useQuery`/`useMe`/router: empty list renders `null` (assert `container.firstChild` is null); two pending rows render title, `from <name>`, and an `Add to my projects` button each; clicking it calls the (mocked) `acceptShare` with the share and navigates `"/"`; a rejection renders its message in `.alert--danger`.
- [ ] **Step 2: Implement `shareMeta.js`** — mirror `assignmentMeta.js` byte-for-byte in shape:

```js
/**
 * Share attribution sidecar — deliberately OUTSIDE manifests, mirroring
 * utils/storage/assignmentMeta.js exactly (same localforage instance, its
 * own store). One record per ACCEPTED COPY: { shareId, sharerId,
 * sharerName }. `sharerName` is a CACHE so the label renders offline
 * (design D§7) — the server never denormalises the name
 * (projects.attribution carries ids only, so §11 erasure acts in ONE
 * place) and refreshShareAttributions() re-resolves it whenever the
 * client is online. The manifest is never touched (contract D§2).
 */
import localforage from "localforage";

const metaStore = localforage.createInstance({
  name: "physics-ide",
  storeName: "share-meta",
});

const PREFIX = "share-meta:";

export async function getShareAttribution(projectId) {
  const v = await metaStore.getItem(PREFIX + projectId);
  return v || null;
}

export async function setShareAttribution(projectId, attribution) {
  await metaStore.setItem(PREFIX + projectId, {
    shareId: attribution.shareId,
    sharerId: attribution.sharerId,
    sharerName: attribution.sharerName,
  });
}

export async function deleteShareAttribution(projectId) {
  await metaStore.removeItem(PREFIX + projectId);
}

export async function listShareAttribution() {
  const out = {};
  await metaStore.iterate((value, key) => {
    if (key.startsWith(PREFIX)) out[key.slice(PREFIX.length)] = value;
  });
  return out;
}

export async function _resetShareMetaForTests() {
  await metaStore.clear();
}
```

- [ ] **Step 3: Implement `acceptShare.js`:**

```js
/**
 * Accept a share — design D§4's order, which is startWork.js's documented
 * order, and it must not be reordered:
 *
 *   1. POST accept — the SERVER mints the copy row with its attribution in
 *      one transaction and returns the manifest, id already rewritten to
 *      the fresh mint this call supplies.
 *   2. saveProject with preserveTimestamp — a pull is not an edit
 *      (groupSync.js's rule); the local library now holds the copy.
 *   3. Sidecar attribution write — BEFORE the push, so the label can never
 *      render behind the project it belongs to.
 *   4. pushProject + assertPushSucceeded — pushProject never throws
 *      (startWork.js's discovery); and because the server already holds a
 *      byte-identical head, this push is the identical-re-push no-op
 *      projects.ts guarantees — it is the CONNECTIVITY check and the sync
 *      adoption, not the creation.
 *   5. requestProjectOpen — same reason startWork announces: a client-side
 *      navigate remounts nothing.
 *
 * A refusal (the cap sentence, a lapsed share) throws out of step 1 with
 * the server's own words; nothing local has happened yet.
 */
import { api } from "../api/client";
import { generateId } from "../manifest/factory";
import { saveProject } from "../storage/projectStore";
import { setShareAttribution } from "../storage/shareMeta";
import { getGlobalSyncEngine } from "../sync/syncEngine";
import { assertPushSucceeded } from "../assignments/startWork";
import { requestProjectOpen } from "../projectOpenRequest";
import { LAST_PROJECT_KEY } from "../../constants";

export async function acceptShare(share, me) {
  const res = await api(`/api/shares/${share.id}/accept`, {
    method: "POST",
    body: { projectId: generateId() },
  });
  await saveProject(res.manifest, { preserveTimestamp: true }); // a pull is not an edit
  await setShareAttribution(res.manifest.id, res.attribution);
  try {
    localStorage.setItem(LAST_PROJECT_KEY, res.manifest.id);
  } catch {
    /* storage blocked */
  }
  const engine = await getGlobalSyncEngine();
  await engine.pushProject(res.manifest.id, me.id);
  assertPushSucceeded(engine);
  requestProjectOpen(res.manifest.id);
  return res.manifest.id;
}
```

- [ ] **Step 4: Implement `SharedWithYou.js` and mount it:**

```jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import { acceptShare } from "../../utils/sharing/acceptShare";

/** The receive surface (design D§6): a section on the class page, never a
 *  tab, rendering NOTHING when empty — a mostly-empty destination is a
 *  section, not a screen. Discovery is pull-based by design (D§10): §9's
 *  email table is closed and the bell is Plan 8's. */
export default function SharedWithYou({ classId }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const q = useQuery({
    queryKey: ["class", classId, "shares"],
    queryFn: () => api(`/api/shares/incoming?classId=${classId}`),
  });
  const pending = q.data?.shares ?? [];
  if (pending.length === 0) return null;

  const add = async (share) => {
    setError(null);
    setBusyId(share.id);
    try {
      await acceptShare(share, me);
      qc.invalidateQueries({ queryKey: ["class", classId, "shares"] });
      navigate("/");
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  };

  return (
    <section className="shared-with-you">
      <h2 className="section-title">Shared with you</h2>
      <ul className="share-list">
        {pending.map((s) => (
          <li className="card share-row" key={s.id}>
            <span className="share-row__title">{s.title}</span>
            <span className="share-row__from">from {s.sharerName}</span>
            <button className="btn" type="button" disabled={busyId === s.id} onClick={() => add(s)}>
              Add to my projects
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}
```

Mount in `AssignmentsTab.js`'s `AssignmentsBody`, first child of `.page-body` (`:35`) — students' default landing sees it before the assignment list: `import SharedWithYou from "../sharing/SharedWithYou";` then `<SharedWithYou classId={id} />`. Styles join the Plan 7 CSS section:

```css
.shared-with-you { margin-block-end: var(--space-6); }
.share-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-3); padding: 0; }
.share-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); }
.share-row__title { font-weight: var(--fw-medium); }
.share-row__from { color: var(--text-dim); font-size: var(--fs-sm); margin-inline-end: auto; }
```

- [ ] **Step 5: Suites green; commit**

```bash
git add frontend/src
git commit -m "feat(frontend): Shared with you - accept follows the start-work order, the sidecar carries the credit"
```

---

### Task 13: The label — "Based on work shared by [name]" in the library and the status bar, offline-correct

**Files:**

- Create: `frontend/src/utils/sharing/attribution.js` + `frontend/src/utils/sharing/__tests__/attribution.test.js`
- Create: `frontend/src/components/layout/AttributionChip.js`
- Create: `frontend/src/components/sharing/__tests__/attributionLabel.test.js`
- Modify: `frontend/src/components/StartMenu.js` (the map + the row; `ProjectRow` at `:496-519` gains a named export for the test)
- Modify: `frontend/src/components/layout/IDELayout.js` (chip mount after `<BatonChip onBaton={setBaton} />`, `:844`)
- Modify: `frontend/src/styles/assignments.css` (two rules)

**Interfaces:**

- Consumes: `GET /api/shares/attributions` (Task 10); `shareMeta` (Task 12); `proj.activeProjectId` (already threaded through IDELayout); the `.sync-chip` status-bar idiom (`RulesChip.js:70-74`).
- Produces: `attributionSentence(name)` — THE label builder, one place, §8.1's exact words; `refreshShareAttributions()` — the online name refresh AND the second-device sidecar backfill; `<AttributionChip projectId />`; the `.start-project-attrib` row line.

- [ ] **Step 1: Failing tests.**
  - `attribution.test.js`: `attributionSentence("Thabo M.")` is exactly `"Based on work shared by Thabo M."`; `refreshShareAttributions` writes every server entry into the sidecar and returns the merged list; with `api` rejecting (offline/guest) it swallows and returns the local list unchanged — the cache stands.
  - `attributionLabel.test.js`: `ProjectRow` with `attribution={{ sharerName: "Thabo M." }}` renders the sentence in `.start-project-attrib`; without the prop the node is absent; `AttributionChip` with a seeded sidecar entry renders the sentence in a `.sync-chip` (async — await the effect); with none it renders nothing; with `sharerName: "Removed student"` it renders `Based on work shared by Removed student` (the erased case is just a name — no special path).
- [ ] **Step 2: Implement `attribution.js`:**

```js
import { api } from "../api/client";
import { listShareAttribution, setShareAttribution } from "../storage/shareMeta";

/** §8.1's own sentence — built in ONE place, asserted verbatim by tests. */
export function attributionSentence(name) {
  return `Based on work shared by ${name}`;
}

/**
 * Refresh the sidecar's cached sharer names from the server (design D§7:
 * rendered from the sidecar offline, resolved to a live name when online —
 * an erased sharer comes back as "Removed student", and a copy accepted on
 * another device gains its local attribution here, since the sync engine
 * pulls the project but knows nothing of sharing). Signed out or offline,
 * the catch keeps the cache standing.
 */
export async function refreshShareAttributions() {
  try {
    const res = await api("/api/shares/attributions");
    for (const [projectId, attribution] of Object.entries(res.attributions)) {
      await setShareAttribution(projectId, attribution);
    }
  } catch {
    /* offline or signed out — the cache stands */
  }
  return listShareAttribution();
}
```

- [ ] **Step 3: The two surfaces.**
  - `StartMenu.js`: state `const [attributions, setAttributions] = useState({});` plus one effect keyed on `[projectList]` — set from `listShareAttribution()` first (offline-correct first paint), then from `refreshShareAttributions()`; pass `attribution={attributions[p.id]}` into `ProjectRow` (`:414-419`); in `ProjectRow`, under `.start-project-sub` (`:504-506`):

```jsx
          {attribution ? (
            <span className="start-project-attrib">{attributionSentence(attribution.sharerName)}</span>
          ) : null}
```

  Add `export { ProjectRow };` beside the default export (test seam only).

- `AttributionChip.js` — the identity surface inside the IDE, beside its chip siblings:

```jsx
import React, { useEffect, useState } from "react";
import { getShareAttribution } from "../../utils/storage/shareMeta";
import { attributionSentence } from "../../utils/sharing/attribution";

/** The copy's permanent credit (spec §8.1), wherever the copy is
 *  identified — here, the status bar, after RulesChip and BatonChip.
 *  Renders nothing for a project with no attribution; text is the channel
 *  (colour never alone), and the sidecar makes it offline-correct. */
export default function AttributionChip({ projectId }) {
  const [attribution, setAttribution] = useState(null);
  useEffect(() => {
    let dead = false;
    if (!projectId) {
      setAttribution(null);
      return undefined;
    }
    getShareAttribution(projectId).then((a) => {
      if (!dead) setAttribution(a);
    });
    return () => {
      dead = true;
    };
  }, [projectId]);
  if (!attribution) return null;
  const sentence = attributionSentence(attribution.sharerName);
  return (
    <span className="sync-chip attribution-chip" title={sentence}>
      <span className="attribution-chip__text">{sentence}</span>
    </span>
  );
}
```

  Mount in `IDELayout.js` after `<BatonChip onBaton={setBaton} />` (`:844`): `<AttributionChip projectId={proj.activeProjectId} />` (import beside `BatonChip`, `:45`). CSS:

```css
.attribution-chip__text { color: var(--text-dim); }
.start-project-attrib { display: block; color: var(--text-dim); font-size: var(--fs-xs); }
```

- [ ] **Step 4: Stage C gate** — `npm run test -w frontend && npm run build -w frontend`, then the browser: switch sharing on as the teacher; share from the File menu as student A (dialog, roster, consequence line); accept as student B from the class page; B lands in the IDE with the chip reading the label; B's StartMenu row carries it; kill the network (devtools offline) and reload — the label still renders. Guest window: no Share item, no section, no chip.
- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): the label - Based on work shared by [name] in the library and the status bar, offline-correct"
```

---

## Stage D — wrap

### Task 14: The authority matrix — every mutating route's refusals against one world

The memo §6b obligation, owed before Plan 8, sized ~50 rows now that Plan 7's routes exist. **A refusal matrix, not a happy-path suite:** refusals do not mutate, so one shared world serves every bucket; the one allowed bucket per route stays asserted in the per-file suites that already own it.

**Files:**

- Create: `backend/src/routes/authority.matrix.test.ts`

**Interfaces:**

- Consumes: every route file's exported/asserted sentence consts; `truncateAuthTables`; the `makeUser`/`signin` helper idiom (`groups.test.ts:32-59`).
- Produces: the matrix later plans extend by adding rows.

- [ ] **Step 1: The fixture world**, built once in `beforeAll` after `truncateAuthTables()`: one class (peerSharing on) with teacher, TA, two students (one in a group of a published group assignment, with `assignment_work`, a submission and a draft mark), a guide, an invite, a rule set, a project per student, one pending share (alpha→bravo); out-of-class actors — a teacher of a different class, an unconfirmed user, an admin, and the anonymous caller. **Eight actor buckets:** `anon` · `unconfirmed` · `studentIn` · `studentOut` · `ta` · `teacher` (of this class) · `teacherOther` · `admin`.
- [ ] **Step 2: The table + runner.** Row shape and runner (~40 lines), then one row per mutating route:

```ts
type Expect = number | { code: number; error: string };
type Row = {
  name: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: () => string;
  body?: () => unknown;
  expect: Partial<Record<Bucket, Expect>>; // omitted bucket = the allowed one, covered per-file
};

for (const row of ROWS) {
  for (const [bucket, expected] of Object.entries(row.expect)) {
    test(`${row.name} — ${bucket} is refused`, async () => {
      const res = await app.inject({
        method: row.method,
        url: row.path(),
        cookies: cookieFor(bucket as Bucket),
        payload: row.body?.() ?? {},
      });
      if (typeof expected === "number") expect(res.statusCode).toBe(expected);
      else {
        expect(res.statusCode).toBe(expected.code);
        expect(res.json().error).toBe(expected.error);
      }
    });
  }
}
```

**Enumerate the rows from the tree, not from memory:** `grep -n "app.\(post\|put\|patch\|delete\)" backend/src/routes/*.ts` — at `930edcf` that is 56 mutating routes (assignments 17, auth 8, groups 5, classes 5, admin 5, members 4, invites 4, guides 4, projects 3, tick 1) plus Plan 7's three (`POST /api/shares`, `/accept`, `/revoke`). Skip the six anonymous-by-design auth doors, the two self-scoped auth routes, and secret-guarded `/api/tick` — name each skip in a comment. Every remaining row asserts, per bucket: `anon: 401`, `unconfirmed: 403`, and the role refusals **with the exact sentence** where the route has a named const (e.g. teacher-only class routes → `{ code: 403, error: "Teachers only for this class." }`; staff routes → `{ code: 403, error: "Teachers and assistants only." }` — Task 1's unification is what makes this one string; share accept for a non-recipient → `{ code: 404, error: "No such share." }`). Where a route 404s strangers by design (the draft posture), the row says 404, not 403 — the matrix records the product's actual privacy posture.

- [ ] **Step 3: Green; commit**

```bash
git add backend/src
git commit -m "test(backend): the authority matrix - every mutating route's refusals against one world, sentences verbatim"
```

---

### Task 15: The honesty pass — the bans move, the About record grows a leg, the stale headers cleared

Truth-in-copy is a contract obligation ("Copy is bound by this too."). The feature is green as of Stage C, so the copy may now say sharing exists — and must stop banning the truth. **The trap (memo §3.1 B): the ban list is itself asserted by a meta-test — groups A and B below move together in ONE commit or the suite is red between them.** The §3.2 stays-banned list (bell, real email, data requests, rubric, lockdown/exam/cloud/etc., History naming, the About underclaim) is DO-NOT-TOUCH.

**Files:**

- Modify: `frontend/src/welcome/__tests__/welcomePage.test.js`, `frontend/src/welcome/WelcomePage.js` (comment only), `frontend/src/welcome/__tests__/welcomeSubpages.test.js`, `frontend/src/welcome/AboutPage.js`
- Modify: `frontend/src/utils/storage/projectStore.js` (`:12`), `README.md` (`:3`), `DEPLOY.md` (`:113`)
- Modify: `docs/product-contract.md` (`:164`), `docs/classroom-platform.md` (§14 rows + a dated note)

**The exact edits (memo §3.1 A–F, verified at `930edcf`):**

- [ ] **A.** `welcomePage.test.js:168-172`: delete the whole `"peer sharing"` group from `NON_CLAIMS` (all three patterns — `/peer sharing/i`, `/share (your |their )?(work|projects?) with/i`, `/based on work shared by/i`; the third is §8.1's literal sentence, banned precisely because the product could not print it — now it can).
- [ ] **B.** Same file, the meta-test (`:206-222`): delete the `"peer sharing"` entry from its `sentences` map (`:214`), and re-scope its name and comment — `"the non-claims list still names every STILL-EXCLUDED feature, and each pattern bites"`, with the comment now citing Plan 7 §12's exclusion list (bell, real email delivery, admin data requests) instead of "every Plan 6 §9 exclusion". Three entries remain.
- [ ] **C.** `welcomeSubpages.test.js`: remove `/peer sharing/i` from `EXCLUDED` (`:367`); reword the describe (`:361`) and test (`:362`) titles to drop "peer sharing" (e.g. "…the notification bell, rubric marking, real email delivery or admin data requests"); trim the block comment above (`:340-359`) the same way.
- [ ] **D.** Same file, the About surveillance lock (`:83-96`): delete line `:92-93` (the `/who made,?\s*shared and joined/i` overclaim ban — its comment says it exists because the ledger was unshipped; the ledger has shipped, and a ban that outlives its reason forbids the truth). In `AboutPage.js`, extend the record paragraph (grep `append-only record`) with one sentence in the page's own voice: `Every share of work between classmates joins the same record — who shared what, with whom, when.` (spec §8.1's own ledger words). Replace the deleted ban with the positive lock `expect(text).toContain("who shared what, with whom, when");`. **The other half stays:** the `/that is the whole of the monitoring/i` underclaim ban (`:95`) and the three positive locks (`:86-91`) must all survive — a share event simply joins the record they describe.
- [ ] **E.** Already done in Task 2 (contract line 162) — verify it, do not re-edit.
- [ ] **F.** The corrections:
  - `WelcomePage.js:18-31` (comment only): the remaining-absences list drops "peer sharing" — it now reads "the notification bell, real email delivery, admin data requests".
  - `projectStore.js:12`: replace `No backend. No network. No auth. Per docs/product-contract.md.` with `Local-first: this store is the source of truth in the browser; for signed-in accounts the sync engine (src/sync/) mirrors it to the classroom backend. Per docs/product-contract.md.`
  - `README.md:3`: replace `with no backend, no accounts, and no installation required` with `with no installation required — and, since the classroom platform (Aug 2026), an optional accounts backend for classes, assignments and sync; the guest IDE still needs none of it`.
  - `DEPLOY.md:113`: replace `the app has no backend to authenticate to` with `the static IDE has no secrets; the classroom backend deploys separately with its own environment (see backend/)`.
  - `docs/product-contract.md:164`: rewrite the last sentence of "Copy is bound by this too." — the README/DEPLOY sentences are no longer "still owed": `§17.3's remaining cleanups — the "no accounts, no backend" sentences in README.md and DEPLOY.md — were cleared by Plan 7's honesty pass (28 August 2026).`
- [ ] **The §14 clarification (D§6):** in `docs/classroom-platform.md`, edit the two inventory rows — the IDE workspace row (`:398`) gains `, and — where a class has sharing on (section 8.3) — the Share control in the File menu` before its closing `|`; the Class page row (`:409`) becomes `| Class page | Assignments list · pending shares ("Shared with you", section 8.3) · guides · my marks in this class |`. Add a dated note after the 22 August note (`:18`), the spec's own change-log manner: `**28 August 2026** — Plan 7 (peer sharing, section 8.3): §14 clarified, no new screens — the share control is part of the IDE workspace screen (File menu), and pending shares ("Shared with you") are part of the Class page screen. The §8.1 ledger and label shipped as specified; decisions recorded in product-contract.md's peer-sharing amendment.`
- [ ] **Run everything** — the full frontend suite green in the SAME commit as the copy edits.
- [ ] **Commit**

```bash
git add frontend/src docs README.md DEPLOY.md
git commit -m "docs+copy: sharing ships and the copy says so - bans moved with their meta-test, the About record extended, stale headers cleared"
```

---

### Task 16: The golden flow end to end, and the plan's gate

**Files:**

- Modify: `frontend/scripts/portal-e2e.mjs` (extend — the house `check()`/`screenshot()` idiom, `portal-e2e.mjs:92-109`)
- Modify: `docs/e2e-checklist.md` (the gap list), `docs/classroom-platform.md` §18 forward-reference 6 (the still-uncovered list)
- Create: `docs/superpowers/reviews/2026-08-28-plan7-browser-pass-checklist.md`

**The flow the script gains (after the existing marking segment; a second student B is signed up the same way the first was):**

1. Teacher: Class → Settings → Sharing rules → On (assert the door flips).
2. Student A: IDE at `/` → File → `Share…` → the dialog lists the class → pick student B → the consequence line renders verbatim → Share → "Shared with" confirmation. Screenshot `10-share-dialog`.
3. Student B: class page shows "Shared with you" with A's name and the project title → Add to my projects → lands in the IDE → the status bar chip reads `Based on work shared by <A>`. Screenshot `11-attribution-chip`.
4. Student B: Menu → StartMenu library row carries the same sentence. Screenshot `12-library-label`.
5. Assertions along the way: the section is ABSENT for A (nothing pending); after accept it is absent for B again; zero console errors (the harness's audit idiom).

- [ ] **Step 1: Extend the script** (~8 checks, every selector from classes this plan shipped: `.share-dialog`, `.share-roster`, `.shared-with-you`, `.share-row`, `.attribution-chip`, `.start-project-attrib`).
- [ ] **Step 2: Docs.** `docs/e2e-checklist.md`: the portal section's gap list gains "sharing golden flow — covered (portal-e2e)" and keeps its remaining gaps honest. Spec §18 forward-reference 6: append `Plan 7 (2026-08-28) extended it with the sharing golden flow (share → accept → attribution).` to the *Partly repaid* sentence — the item stays open (its uncovered list still stands).
- [ ] **Step 3: The human browser-pass checklist** — `docs/superpowers/reviews/2026-08-28-plan7-browser-pass-checklist.md`, the Plan 6 file's format, both themes: the Settings doors; the dialog's three empty/refusal states (no sharing classes, empty roster, server refusal sentence rendered); Share… absent for a guest, absent under `locked_assessment` rules, absent on a group project, absent on individual work; revoke a pending share and watch it leave B's section; flip the switch off with a share pending (it lapses; an accepted copy's label survives); offline reload keeps both label surfaces; the 1024px floor hides nothing (the dialog scrolls its roster, never the page). Note in the checklist: the erased-sharer rendering ("Removed student") is asserted by the backend suite and has no UI path until admin data requests ship — do not hunt for it in the browser.
- [ ] **Step 4: Full gates from the repo root:**

```bash
npm run test -w shared && npm run test -w backend && npm run test -w frontend
npm run typecheck -w backend && npm run typecheck -w shared
npm run build -w frontend
npm run check:blocks
node frontend/scripts/e2e-test.mjs        # the IDE suite must not have noticed Plan 7
node frontend/scripts/portal-e2e.mjs      # the portal flow, now with sharing
node frontend/scripts/ux-audit.mjs
```

- [ ] **Step 5: Final commit**

```bash
git add frontend docs
git commit -m "test+docs: Plan 7 wrap - the sharing golden flow runs end to end, the gap ledger updated, the checklist handed over"
```

---

## Self-review — seams found while writing this plan, recorded

1. **`visibleToStudent`'s home moved against the memo's suggestion, deliberately.** The memo recommended exporting the assignments predicate from `assignments.ts`; but `assignments.ts:37` already imports from `groups.ts`, so `groups.ts` importing it back would close an ESM cycle. It lives in `lib/util.ts` instead (Task 1), name kept; the guides predicate is renamed `guideVisibleToStudent` and stays local — D§14.10's "two predicates, never merged" is honoured either way.
2. **`requireClassStaff` unifies two sentences into one.** Six of the eight collapsed sites (plus `members.ts`) already said "Teachers and assistants only."; the two that said "Teachers and TAs only for this class." (`assignments.ts:1718/:1771`) change wording, and exactly one test assertion moves (`assignments.test.ts:2310`). Task 14's matrix then depends on this being ONE string — do Task 1 first or the matrix needs per-row annotations.
3. **The accept flow's push is a no-op by construction, and that is load-bearing.** The server-minted row and the client's local save must hold the byte-identical manifest (server rewrites `id`, client saves the reply verbatim with `preserveTimestamp`), so `engine.pushProject` lands in `projects.ts:238-244`'s identical-re-push branch. Re-stamping `updatedAt` locally, or the server "tidying" the manifest, silently turns every accept into a conflict-archiving overwrite. The D§4 order in `acceptShare.js`'s header comment is the contract; Task 12's order test enforces it.
4. **The roster read is new because the design's premise didn't hold.** D§6 says the picker uses "data the class read already returns"; at `930edcf` no student-readable roster exists (`GET /api/classes/:id/members` is staff-only, `members.ts:57`; `GET /api/classes/:id` returns a count). Task 8 adds `GET /api/shares/roster/:classId` — names only, behind the same switch, the `groupShape` precedent — flagged to the controller rather than silently widening the members route.
5. **The `peerSharing` key threads through five files under one name** — `shared/src/classes.ts` (schema) → `classes.ts` (patch-builder AND `toClassSummary`) → `SettingsTab` (doors) → `ShareDialog` (class filter) → the gate (`c.peerSharing`). Forgetting `toClassSummary` makes the switch save but never render, and the dialog filter silently empty — Task 5's GET assertion exists for exactly that.
6. **The fileMenu gate needs the flag before the menu exists.** Task 11's item reads `assignment?.individualWork` synchronously from `useAssignmentContext()`, which only carries it because Task 6 threaded it through `cacheContext` → `assignmentMeta` → the context's refresh. Stage order is load-bearing: swap Tasks 6 and 11 and the gate silently never hides. And there is no overflow twin: only view-zone keys collapse at 1120px (`Toolbar.js:339-370`) — the File menu persists, so D§6's "present in the overflow" is satisfied by construction, not by a second mount.
7. **Sidecar naming and the name-cache compromise.** Store `share-meta`, record `{ shareId, sharerId, sharerName }`. `sharerName` in the sidecar looks like the denormalisation D§3 forbids — it is not: the SERVER stores ids only (`projects.attribution`), and the sidecar name is a display cache refreshed by `refreshShareAttributions()` whenever online, stale at worst until the next online StartMenu render. Erasure correctness is a server-read property (memo trap 2), and every server read resolves through one `?? REMOVED_STUDENT`.
8. **Erasure-name-resolution path, end to end:** `projects.attribution.sharerId` → `users` lookup at read time (Tasks 8/9/10, each `?? REMOVED_STUDENT`) → client cache → `attributionSentence`. Deleting the sharer's user row cascades their own projects and memberships but neither the recipient's copy nor the `shares` row (no user FK, Task 4's deliberate posture) — Task 10's test deletes a real user row to prove all three survivals at once.
9. **Migration 0006 is one migration and the truncate list moves with it** (Task 4). Drizzle names the file; nothing hand-names it. The `shares` table's no-FK columns will look like an oversight to a reviewer — the schema comment says why, cite it in review.
10. **The honesty meta-test trap is a same-commit constraint:** deleting `NON_CLAIMS["peer sharing"]` (A) without the `sentences` entry (B) turns `welcomePage.test.js` red between commits. Task 15 does A+B+C+D in one commit with the full suite run inside it. The §3.2 stays-banned table is listed in the task as do-not-touch; `/lockdown/i` in particular means the checklist and dialog copy never use the word "lockdown".
11. **The `project.shared` event's chain field rides the SOURCE row's attribution at share time** (`sourceHead.attribution ?? null`), which exists only because Task 9 writes attribution at accept — a re-share of a copy accepted before Task 9 shipped cannot occur (no shares exist before this plan). Order within Stage B is safe, but Task 7's happy-path test asserts `sourceAttribution: null` — the chain's non-null case is Task 10's test, against a copy Task 9 minted.
12. **Citation drift:** every excerpt and line number here was verified at `930edcf`. The header rule stands — re-grep anchors, never trust a stale number; `AssignmentEditorPage.js:313` and `members.ts:57` in particular sit in files other tasks also edit.

---

**Execution note (subagent-driven):** stages are the review gates. Dispatch tasks in order within a stage; run the stage gate before opening the next; the two-browser share/accept pass in Stage C and the golden flow in Stage D are controller-visible checkpoints worth screenshots. Total: 16 tasks, 5 stages.
