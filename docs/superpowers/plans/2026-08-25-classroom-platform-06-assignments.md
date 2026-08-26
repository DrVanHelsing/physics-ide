# Classroom Platform — Plan 6: Assignments and Everything Downstream

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec §5–§7 delivered on the Plan 5 design system: teachers author and publish assignments with rich instructions, starter projects and per-assignment workspace rules; students start work in a private copy inside the one IDE with the brief beside them and the rules honestly enforced; submissions freeze fingerprinted snapshots and email receipts; teachers and TAs mark in an inbox-driven marking room with drafts-then-release; a gradebook exports CSV; pairs and groups share one project through a polled baton; and the welcome page finally stops saying "not yet built" about any of it.

**Architecture:** One new backend plugin (`assignmentRoutes`) and one migration (`0004`) carrying eight tables; the student↔assignment link is the server-side `assignment_work` table — **the manifest is never tagged** and `SCHEMA_VERSION` stays 2. The IDE mounts once, at `/`; assignment work enters it through the active-project key plus a per-project cache in the existing `sync-meta` store, which also carries the rules offline. Workspace rules ride a pure extension of `visibleControls()` plus one `WorkspaceRulesContext` for the surfaces the header matrix does not govern. Lifecycle is computed from timestamps at read time; the only scheduler is one daily-tick endpoint for due-tomorrow email.

**Tech Stack:** Existing monorepo (React 18 + Vite, Fastify 5 + Drizzle + Postgres 16, zod contracts in `shared/`). New: TipTap (`@tiptap/react`, `@tiptap/starter-kit`) + KaTeX (`katex`) — lazy-loaded on teacher screens only.

**Spec:** `docs/superpowers/specs/2026-08-25-classroom-platform-06-assignments-design.md` (the build decisions; cite it as **D§n**) over `docs/classroom-platform.md` §5–§7 (the product contract; cite it as **spec §n**). Where they seem to disagree, the design doc wins — it records the resolutions.

## Citation convention — read this before cutting any range

Every `file.ext:N` or `:N-M` citation in this plan was verified against the tree at `7f0520d`. Line numbers drift as tasks land — **re-grep for the quoted anchor text instead of trusting a stale number**, and if a cited anchor is genuinely gone, stop and check the task's assumptions rather than guessing.

## Global Constraints

- **Backend/shared discipline:** every route validates its body with a zod schema from `@physics-ide/shared`; every mutation writes `logEvent` **inside the same transaction**; every credential-adjacent string is CRLF-stripped before it reaches an email subject. New tables join `truncateAuthTables()` in `backend/src/db/testClient.ts` in the same task that creates them.
- **Design system (spec §18, delta contract):** tokens only — the metric linter's covered properties never see a literal; the Plan 5 primitives (`.btn`, `.card`, `.input`, `.alert`, `.badge`, `.empty`, `.tabs`/`.tab`, `.range`) and `PortalHeader` + `.page` shell are the vocabulary; portal controls are 30px (`.btn`), destructive actions are `btn--danger` (outlined, never filled); one focus ring (tokens.css), no component writes its own; one dropdown implementation (`DropdownMenu`); colour is never the only channel; no emoji anywhere in product UI; the 1024px floor hides nothing load-bearing.
- **Retired names stay retired:** `portalControls.test.js` forbids the Plan 5 alias list in portal markup. New portal directories are added to its `DIRS` in the task that creates them. Never re-add an alias.
- **CSS placement:** shared primitives → `primitives.css`; portal screens → `platform.css`; assignment-specific portal + IDE-brief styles → **new `frontend/src/styles/assignments.css`** (Task 5 creates it, adds it to the `styles.css` manifest between `platform.css` and `welcome.css`, and writes its metric-lint conformance test). Never append to `styles.css` itself — it is a 17-line manifest whose order is load-bearing.
- **Sync is untouched:** no change to `SCHEMA_VERSION`, `isManifest`, the sync engine, or manifest shapes. The assignment linkage lives server-side + in the `sync-meta` store (D§2).
- **The IDE mounts once, at `/`** (D§3). No task creates a second `IDELayout` mount.
- **Guests lose nothing:** every task leaves the signed-out IDE experience byte-identical. Assignment surfaces live behind sign-in.
- **backend and shared may change in this plan** (unlike Plan 5) — but only in Tasks that name them, and `npm run typecheck -w backend && npm run typecheck -w shared` stays green at every commit.
- **Truth in copy:** no UI string may claim anything unbuilt. The welcome page's §12 honesty copy changes only in the wrap task, after the features it names exist.

## Stage ownership — the execution order

Stages land in order; a stage opens only when the previous one's gate (its last task's full-suite run) is green. Tasks inside a stage are sequential unless marked `[parallel-ok]`.

| Stage | Tasks | Theme |
|---|---|---|
| 0 — spine | 1–4 | shared contracts, migration 0004, core routes, rule-set routes |
| A — teacher authoring | 5–9 | Assignments tab, editor (TipTap/KaTeX), rules picker, starter pinning, guides |
| B — student experience | 10–15 | assignment page, Start work, IDE context + brief pane + rules, submit, due-soon strip |
| C — marking | 16–20 | inbox, marking room, marks + release, gradebook, History viewer |
| D — pairs/groups | 21–23 | groups + baton, group submit, group marking |
| E — wrap | 24–26 | daily tick + emails, honesty copy, golden-flow e2e + gates + docs |

## Deferred — deliberately NOT here, do not flag as missing

- **The notification bell and per-user notification preferences** (D§9) — their own later plan. Publish visibility = Assignments tab + due-soon strip; the plan records that there is no publish email by spec design.
- **Peer sharing and the §8.3 attribution ledger**; **admin data requests**; **rubric marking**; **real email delivery** (all five new emails go through the existing `Mailer` interface — only the driver changes at the cloud step); **BlobStore** (instruction images are capped data-URIs, D§7); **the GCP port**; **websockets/live co-editing** (the baton is a polled lease by design).
- **Raising `MAX_VERSIONS_PER_PROJECT`** — the History viewer renders what exists; longer growth history is a recorded knob for the cloud plan (D§6).
- **Generalising `useSplitPane`** — the brief pane is a fixed-width collapsible column, not a third split (D§5).

---
## Stage 0 — the spine

### Task 1: Shared contracts — `shared/src/assignments.ts`

**Files:**
- Create: `shared/src/assignments.ts`
- Create: `shared/src/assignments.test.ts`
- Modify: `shared/src/index.ts` (add one export line)

**Interfaces:**
- Consumes: `WorkspaceRulesSchema`, `BUILT_IN_RULE_SETS` from `./workspaceRules.js` (already shipped, currently consumer-less).
- Produces (later tasks import all of these from `@physics-ide/shared`): `SUBMISSION_MODES`, `ASSIGNMENT_PROJECT_TYPES`, `InstructionsDocSchema`, `EMPTY_INSTRUCTIONS_DOC`, `CreateAssignmentInputSchema`, `UpdateAssignmentInputSchema`, `SaveRuleSetInputSchema`, `MarkDraftInputSchema`, `GuideInputSchema`, `computeAssignmentPhase(a, now)` returning `"draft" | "scheduled" | "open" | "late_window" | "closed" | "marks_released"`, and the caps `MAX_INSTRUCTIONS_BYTES` / `MAX_INSTRUCTIONS_IMAGE_BYTES`.

- [ ] **Step 1: Verify the product's project-type strings.** The assignment's project type must be the IDE's own goal vocabulary, not an invention. Run:

```powershell
Select-String -Path "frontend/src/constants/index.js","frontend/src/components/StartMenu.js" -Pattern "goal" -CaseSensitive | Select-Object -First 20
```

Record the exact goal strings the product uses (expected shape: physics / data-science / hybrid — but **use what the grep shows verbatim**). They become `ASSIGNMENT_PROJECT_TYPES`.

- [ ] **Step 2: Write the failing test** — `shared/src/assignments.test.ts`, following the colocated style of `workspaceRules.test.ts` (plain vitest, relative `./x.js` imports):

```ts
import { describe, test, expect } from "vitest";
import { BUILT_IN_RULE_SETS } from "./workspaceRules.js";
import {
  CreateAssignmentInputSchema,
  InstructionsDocSchema,
  EMPTY_INSTRUCTIONS_DOC,
  computeAssignmentPhase,
  MAX_INSTRUCTIONS_IMAGE_BYTES,
} from "./assignments.js";

describe("CreateAssignmentInputSchema", () => {
  test("title is the only required field; defaults land", () => {
    const parsed = CreateAssignmentInputSchema.parse({ title: "Projectile lab" });
    expect(parsed.submissionMode).toBe("individual");
    expect(parsed.rules).toEqual(BUILT_IN_RULE_SETS.standard_classwork);
    expect(parsed.points).toBeNull();
    expect(parsed.instructions).toEqual(EMPTY_INSTRUCTIONS_DOC);
  });

  test("due date must follow open date; late window must follow due", () => {
    const base = { title: "t", opensAt: 2000, dueAt: 1000 };
    expect(CreateAssignmentInputSchema.safeParse(base).success).toBe(false);
    const late = { title: "t", dueAt: 2000, lateUntil: 1500 };
    expect(CreateAssignmentInputSchema.safeParse(late).success).toBe(false);
  });
});

describe("InstructionsDocSchema", () => {
  test("accepts a doc with text and a small data-URI image", () => {
    const png = "data:image/png;base64," + "A".repeat(100);
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Read this." }] },
        { type: "image", attrs: { src: png, alt: "setup" } },
      ],
    };
    expect(InstructionsDocSchema.safeParse(doc).success).toBe(true);
  });

  test("rejects an image over the per-image cap and any non-data image src", () => {
    const big = "data:image/png;base64," + "A".repeat(MAX_INSTRUCTIONS_IMAGE_BYTES * 2);
    const overCap = { type: "doc", content: [{ type: "image", attrs: { src: big } }] };
    expect(InstructionsDocSchema.safeParse(overCap).success).toBe(false);
    const remote = { type: "doc", content: [{ type: "image", attrs: { src: "https://x.test/a.png" } }] };
    expect(InstructionsDocSchema.safeParse(remote).success).toBe(false);
  });
});

describe("computeAssignmentPhase", () => {
  const t = (n: number) => new Date(n);
  const base = { status: "published", opensAt: t(100), dueAt: t(200), lateUntil: t(300), closedAt: null as Date | null };
  test("walks the life: scheduled -> open -> late_window -> closed", () => {
    expect(computeAssignmentPhase(base, t(50))).toBe("scheduled");
    expect(computeAssignmentPhase(base, t(150))).toBe("open");
    expect(computeAssignmentPhase(base, t(250))).toBe("late_window");
    expect(computeAssignmentPhase(base, t(350))).toBe("closed");
  });
  test("draft and marks_released are stored states and win outright", () => {
    expect(computeAssignmentPhase({ ...base, status: "draft" }, t(150))).toBe("draft");
    expect(computeAssignmentPhase({ ...base, status: "marks_released" }, t(150))).toBe("marks_released");
  });
  test("a manual close wins over open dates; no dueAt means open until closed", () => {
    expect(computeAssignmentPhase({ ...base, closedAt: t(120) }, t(150))).toBe("closed");
    expect(computeAssignmentPhase({ ...base, dueAt: null, lateUntil: null }, t(9999))).toBe("open");
  });
});
```

- [ ] **Step 3: Run it to fail** — `npm run test -w shared` → FAIL (module not found).

- [ ] **Step 4: Write `shared/src/assignments.ts`.** House style: zod schemas + exported consts, spec citations in doc comments:

```ts
import { z } from "zod";
import { WorkspaceRulesSchema, BUILT_IN_RULE_SETS } from "./workspaceRules.js";

/** Spec §5.5 — who hands work in. */
export const SUBMISSION_MODES = ["individual", "pair", "group"] as const;
export type SubmissionMode = (typeof SUBMISSION_MODES)[number];

/** The IDE's own goal vocabulary — Step 1's grep result, verbatim. */
export const ASSIGNMENT_PROJECT_TYPES = [/* from Step 1 */] as const;

/** D§7 — instruction images are capped inline data-URIs; no blob store. */
export const MAX_INSTRUCTIONS_IMAGE_BYTES = 200 * 1024;
export const MAX_INSTRUCTIONS_BYTES = 1024 * 1024;

export const EMPTY_INSTRUCTIONS_DOC = { type: "doc", content: [] as unknown[] };

/**
 * A TipTap/ProseMirror document, validated structurally (type + content
 * tree), size-capped as serialized JSON, with every image node required
 * to be an in-cap data URI (D§7). We do NOT enumerate every node type —
 * the renderer ignores unknown nodes — we bound size and image sources.
 */
export const InstructionsDocSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.unknown()).default([]) })
  .passthrough()
  .superRefine((doc, ctx) => {
    const raw = JSON.stringify(doc);
    if (raw.length > MAX_INSTRUCTIONS_BYTES) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Instructions are too large — trim images." });
      return;
    }
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const n = node as { type?: string; attrs?: { src?: string }; content?: unknown[] };
      if (n.type === "image") {
        const src = n.attrs?.src ?? "";
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(src)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Images must be embedded, not linked." });
        } else if (src.length > MAX_INSTRUCTIONS_IMAGE_BYTES * 1.4) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "That image is too large (200 KB max)." });
        }
      }
      for (const child of n.content ?? []) walk(child);
    };
    for (const child of doc.content) walk(child);
  });

const epochMs = z.number().int().positive();

export const CreateAssignmentInputSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    instructions: InstructionsDocSchema.default(EMPTY_INSTRUCTIONS_DOC),
    projectType: z.enum(ASSIGNMENT_PROJECT_TYPES).default(ASSIGNMENT_PROJECT_TYPES[0]),
    points: z.number().int().min(0).max(1000).nullable().default(null),
    submissionMode: z.enum(SUBMISSION_MODES).default("individual"),
    individualWork: z.boolean().default(false),
    opensAt: epochMs.nullable().default(null),
    dueAt: epochMs.nullable().default(null),
    lateUntil: epochMs.nullable().default(null),
    rules: WorkspaceRulesSchema.default(BUILT_IN_RULE_SETS.standard_classwork),
  })
  .superRefine((a, ctx) => {
    if (a.opensAt != null && a.dueAt != null && a.dueAt <= a.opensAt)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The due date must come after the open date." });
    if (a.lateUntil != null && (a.dueAt == null || a.lateUntil <= a.dueAt))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "The late window must extend past the due date." });
    if (a.individualWork && a.submissionMode !== "individual")
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Individual work applies to individually-submitted assignments." });
  });

export const UpdateAssignmentInputSchema = CreateAssignmentInputSchema.innerType()
  .partial()
  .superRefine(() => {/* cross-field checks re-run in the route against the merged row */});

export const SaveRuleSetInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  rules: WorkspaceRulesSchema,
});

export const MarkDraftInputSchema = z.object({
  points: z.number().int().min(0).max(1000).nullable().default(null),
  comment: z.string().max(5000).default(""),
  privateNote: z.string().max(5000).default(""),
});

export const GuideInputSchema = z.object({
  title: z.string().trim().min(1).max(140),
  body: InstructionsDocSchema,
});

/** Spec §5.1's life, computed from timestamps (D§6): stored states are
 * draft / published / marks_released; everything between derives. */
export function computeAssignmentPhase(
  a: {
    status: string;
    opensAt: Date | null;
    dueAt: Date | null;
    lateUntil: Date | null;
    closedAt: Date | null;
  },
  now: Date,
): "draft" | "scheduled" | "open" | "late_window" | "closed" | "marks_released" {
  if (a.status === "draft") return "draft";
  if (a.status === "marks_released") return "marks_released";
  if (a.closedAt && a.closedAt <= now) return "closed";
  if (a.opensAt && now < a.opensAt) return "scheduled";
  if (a.dueAt && now >= a.dueAt) {
    if (a.lateUntil && now < a.lateUntil) return "late_window";
    return "closed";
  }
  return "open";
}
```

Note for the implementer: `UpdateAssignmentInputSchema` deliberately re-runs no cross-field refinement — a partial patch cannot see the row it patches. Task 3's PATCH route merges patch onto the row and re-checks the three date rules there, replying 400 with the same messages.

- [ ] **Step 5: Export it.** In `shared/src/index.ts` append `export * from "./assignments.js";` (the file is four `export *` lines; this becomes the fifth).

- [ ] **Step 6: Run to pass** — `npm run test -w shared` green, `npm run typecheck -w shared` clean.

- [ ] **Step 7: Commit**

```bash
git add shared/src
git commit -m "feat(shared): assignment contracts — input schemas, capped instructions doc, computed lifecycle"
```

---

### Task 2: Migration 0004 — the eight tables

**Files:**
- Modify: `backend/src/db/schema.ts` (append after `projectVersions`, which currently ends the file at `:158`)
- Modify: `backend/src/db/testClient.ts` (`truncateAuthTables` — the table list is hard-coded and MUST gain every new table)
- Generated: `backend/drizzle/0004_<drizzle-names-it>.sql` (run `npm run db:generate`; drizzle mints the filename — do not hand-name it)

**Interfaces:**
- Consumes: existing `users`, `classes`, `projects` tables for FKs; the house idiom — text pseudo-enums documented in comments, `timestamptz`, jsonb, composite FKs like `projectVersions`'s.
- Produces: `assignments`, `assignmentWork`, `submissions`, `marks`, `groups`, `groupMembers`, `ruleSets`, `guides` — exact column names below are the contract every later backend task builds on.

- [ ] **Step 1: Append the tables to `backend/src/db/schema.ts`** (the imports line already carries everything needed: `pgTable, text, jsonb, bigserial, uuid, timestamp, boolean, unique, bigint, primaryKey, index, foreignKey`):

```ts
/** One assignment = instructions + optional starter + settings (spec §5.1).
 *  status: "draft" | "published" | "marks_released" — everything between
 *  (scheduled/open/late_window/closed) is COMPUTED from the timestamps
 *  by computeAssignmentPhase (shared), never stored (design D§6). */
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    /** TipTap JSON, validated by InstructionsDocSchema (images are capped data-URIs). */
    instructions: jsonb("instructions").notNull(),
    projectType: text("project_type").notNull(),
    /** null points = complete / not-complete marking (spec §5.1). */
    points: bigint("points", { mode: "number" }),
    submissionMode: text("submission_mode").notNull().default("individual"),
    individualWork: boolean("individual_work").notNull().default(false),
    /** Workspace rules jsonb (WorkspaceRulesSchema) — frozen per assignment (spec §5.4). */
    rules: jsonb("rules").notNull(),
    /** A frozen COPY of the teacher's starter manifest — never an FK to a live project (D§6). */
    starterManifest: jsonb("starter_manifest"),
    status: text("status").notNull().default("draft"),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    lateUntil: timestamp("late_until", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    marksReleasedAt: timestamp("marks_released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assignments_class_idx").on(t.classId)],
);

/** The student(or group)↔assignment↔project link (design D§2) — the server
 *  is the authority; the manifest is never tagged. */
export const assignmentWork = pgTable(
  "assignment_work",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    /** Exactly one of userId / groupId is set (individual vs pair/group). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id"),
    ownerId: uuid("owner_id").notNull(),
    projectId: text("project_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("assignment_work_assignment_user_uq").on(t.assignmentId, t.userId),
    unique("assignment_work_assignment_group_uq").on(t.assignmentId, t.groupId),
    index("assignment_work_project_idx").on(t.ownerId, t.projectId),
    foreignKey({
      columns: [t.ownerId, t.projectId],
      foreignColumns: [projects.ownerId, projects.id],
    }).onDelete("cascade"),
  ],
);

/** Frozen, fingerprinted snapshots (spec §6.4). One row per attempt;
 *  resubmission replaces the head (isCurrent) and keeps the history. */
export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    /** Individual: the student. Pair/group: null, groupId set instead. */
    submitterId: uuid("submitter_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id"),
    /** Who pressed Submit (a group member; equals submitterId when individual). */
    submittedBy: uuid("submitted_by").notNull(),
    /** User ids credited on the receipt — every member for groups (spec §5.5). */
    creditedIds: jsonb("credited_ids").notNull(),
    manifest: jsonb("manifest").notNull(),
    /** sha256 of the stable-stringified manifest — the dispute authority (D§11.6). */
    fingerprint: text("fingerprint").notNull(),
    late: boolean("late").notNull().default(false),
    isCurrent: boolean("is_current").notNull().default(true),
    attempt: bigint("attempt", { mode: "number" }).notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("submissions_assignment_idx").on(t.assignmentId),
    index("submissions_assignment_submitter_idx").on(t.assignmentId, t.submitterId),
  ],
);

/** One mark per (assignment, student) — spec §7.3. status: "draft" | "released".
 *  TA drafts await teacher release BY CONSTRUCTION: release is teacher-only. */
export const marks = pgTable(
  "marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    points: bigint("points", { mode: "number" }),
    comment: text("comment").notNull().default(""),
    privateNote: text("private_note").notNull().default(""),
    status: text("status").notNull().default("draft"),
    returned: boolean("returned").notNull().default(false),
    markedBy: uuid("marked_by").notNull(),
    /** The submission the draft was written against — a newer attempt flags
     *  the draft stale instead of silently deleting it (design D§11.3). */
    basedOnSubmissionId: uuid("based_on_submission_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("marks_assignment_student_uq").on(t.assignmentId, t.studentId)],
);

/** Pair/group composition per assignment plus the editing baton — a polled
 *  lease (holder + expiry), no live connections (stack §sync, spec §5.5). */
export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** The shared group project (owned by the founding member's account). */
    ownerId: uuid("owner_id"),
    projectId: text("project_id"),
    batonHolderId: uuid("baton_holder_id"),
    batonExpiresAt: timestamp("baton_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("groups_assignment_idx").on(t.assignmentId)],
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("group_members_group_user_uq").on(t.groupId, t.userId)],
);

/** A teacher's saved custom rule combinations (spec §5.4 "Custom…"). */
export const ruleSets = pgTable(
  "rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rules: jsonb("rules").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("rule_sets_owner_name_uq").on(t.ownerId, t.name)],
);

/** Standalone guide pages — same rich format as instructions (spec §4). */
export const guides = pgTable(
  "guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    body: jsonb("body").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("guides_class_idx").on(t.classId)],
);
```

- [ ] **Step 2: Extend `truncateAuthTables`.** In `backend/src/db/testClient.ts`, the TRUNCATE list gains the eight new tables (children before parents, in front of the existing list):

```ts
'TRUNCATE TABLE "guides", "rule_sets", "marks", "submissions", "group_members", "groups", "assignment_work", "assignments", "project_versions", "projects", "invites", "class_members", "classes", "sessions", "email_tokens", "emails", "events", "users" CASCADE',
```

- [ ] **Step 3: Generate and apply.** `npm run db:generate -w backend` (drizzle mints `0004_<name>.sql` + snapshot — commit whatever it names), then `npm run db:migrate -w backend` and `npm run db:migrate:test -w backend` (needs the Docker DB up: `npm run db:up`).

- [ ] **Step 4: Prove it.** `npm run typecheck -w backend` clean; `npm run test -w backend` green (existing suites must not notice).

- [ ] **Step 5: Commit**

```bash
git add backend/src/db backend/drizzle
git commit -m "feat(backend): migration 0004 — assignments, assignment_work, submissions, marks, groups, rule_sets, guides"
```

---

### Task 3: Core assignment routes — CRUD, lifecycle, role-shaped reads

**Files:**
- Create: `backend/src/routes/assignments.ts`
- Create: `backend/src/routes/assignments.test.ts`
- Modify: `backend/src/app.ts` (import + one `app.register(assignmentRoutes);` line after `projectRoutes`)

**Interfaces:**
- Consumes: Task 1's schemas + `computeAssignmentPhase`; Task 2's tables; `requireConfirmed` (`auth/guards.ts`), `requireClassTeacher`/`getMembership`/`sendClassAuthError` (`classes/guards.ts`), `logEvent` (`db/events.ts`).
- Produces: `assignmentRoutes(app)`; `toAssignmentSummary(row, phase, extras)` returning `{ id, classId, title, projectType, points, submissionMode, individualWork, phase, opensAt, dueAt, lateUntil, hasStarter }` (epoch-ms numbers or null for dates — the frontend never parses timestamptz strings); routes:
  - `POST /api/classes/:id/assignments` → 201 `{ assignment }` (teacher; creates a draft)
  - `GET  /api/classes/:id/assignments` → `{ assignments: [...] }` — teachers/TAs get every assignment + `submittedCount`; students get published-only (phase ≠ draft), no rules, no counts
  - `GET  /api/assignments/:id` → `{ assignment }` with `instructions` and (teacher/TA) `rules`; students get it only when phase ≠ draft, plus `myWork: { started, projectId } | null`
  - `PATCH /api/assignments/:id` (teacher) — merged-row date rules re-checked; audited
  - `POST /api/assignments/:id/publish`, `POST /api/assignments/:id/close` (teacher; stamp `publishedAt`/`closedAt`)
  - `DELETE /api/assignments/:id` (teacher; **drafts only** — a published assignment closes, it never disappears)

- [ ] **Step 1: Write the failing tests** — `backend/src/routes/assignments.test.ts`, copying the harness shape of `classes.test.ts` verbatim (one `buildApp({ db: testDb })`, `makeUser`/`signin` helpers, cookies via `pide_session`). Cover, at minimum, in this order:

```ts
// 1. teacher creates a draft in their class -> 201, status draft, event "assignment.created"
// 2. a student in the class cannot create (403 from requireClassTeacher)
// 3. student list omits drafts; teacher list includes them
// 4. GET by id: student gets 404 for a draft (existence not admitted), teacher gets it
// 5. publish stamps publishedAt; student list now shows it with phase "open"
// 6. PATCH moving dueAt before opensAt -> 400 "The due date must come after the open date."
// 7. close stamps closedAt; phase reads "closed"
// 8. DELETE on a published assignment -> 400; on a draft -> 204 and the row is gone
// 9. non-member of the class -> 403 on every route above
```

Write each as a real test (the file will run ~180 lines); assert `events` rows for create/publish/close like `classes.test.ts` asserts `class.updated`.

- [ ] **Step 2: Run to fail** — `npm run test -w backend -- assignments` → FAIL (no route file).

- [ ] **Step 3: Write `backend/src/routes/assignments.ts`.** Follow `classes.ts`'s idiom exactly: plugin function, `app.addHook("preHandler", requireConfirmed)`, per-route `requireClassTeacher` in try/catch with `sendClassAuthError`, zod `safeParse` → 400 with `issues[0]?.message`, mutations in `app.db.transaction` with `logEvent` inside, friendly-sentence error bodies, hand-shaped success bodies. The two non-obvious pieces:

```ts
function toEpoch(d: Date | null): number | null {
  return d ? d.getTime() : null;
}

export function toAssignmentSummary(
  a: typeof assignments.$inferSelect,
  extras: Record<string, unknown> = {},
) {
  const phase = computeAssignmentPhase(a, new Date());
  return {
    id: a.id,
    classId: a.classId,
    title: a.title,
    projectType: a.projectType,
    points: a.points,
    submissionMode: a.submissionMode,
    individualWork: a.individualWork,
    phase,
    opensAt: toEpoch(a.opensAt),
    dueAt: toEpoch(a.dueAt),
    lateUntil: toEpoch(a.lateUntil),
    hasStarter: a.starterManifest != null,
    ...extras,
  };
}
```

and the student-visibility rule used by both GETs:

```ts
/** Students see an assignment only once it has left draft (spec §5.1).
 *  A draft 404s rather than 403s — its existence is the teacher's business. */
function visibleToStudent(a: typeof assignments.$inferSelect): boolean {
  return computeAssignmentPhase(a, new Date()) !== "draft";
}
```

Membership shaping for the list/get: `getMembership()` gives `role` — `teacher`/`ta` see rules + drafts + counts; `student` (active only) sees the visible subset. The PATCH route merges patch onto the row, re-runs the three date rules from Task 1's refinement (same messages, 400), then updates + `logEvent(tx, "assignment.updated", ...)`.

- [ ] **Step 4: Register the plugin.** In `backend/src/app.ts`: import `assignmentRoutes` and add `app.register(assignmentRoutes);` after `app.register(projectRoutes);`.

- [ ] **Step 5: Run to pass** — `npm run test -w backend -- assignments` green, then the whole backend suite, then `npm run typecheck -w backend`.

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "feat(backend): assignment CRUD and lifecycle — role-shaped reads, computed phases, audited transitions"
```

---

### Task 4: Rule-set routes and starter pinning

**Files:**
- Modify: `backend/src/routes/assignments.ts` (three rule-set routes + two starter routes)
- Modify: `backend/src/routes/assignments.test.ts`

**Interfaces:**
- Consumes: `SaveRuleSetInputSchema` (Task 1), `ruleSets` + `assignments.starterManifest` (Task 2), `projects` table.
- Produces:
  - `GET /api/rule-sets` → `{ ruleSets: [{ id, name, rules }] }` (owner-scoped; teacher accounts only — `req.user!.isTeacher || req.user!.role === "admin"`, else 403 "Teachers only.")
  - `POST /api/rule-sets` → 201 (upserts by `(owner, name)` — saving the same name again overwrites, that is the spec's "save their combination under their own name")
  - `DELETE /api/rule-sets/:id` → 204 (own rows only)
  - `POST /api/assignments/:id/starter` body `{ projectId }` → copies the **teacher's own** project's manifest (`projects` where `ownerId = req.user!.id and id = projectId and deletedAt is null`) into `assignments.starterManifest` — a frozen copy, 404 "No such project." if absent; 400 if the assignment already has submissions (the starter is a starting point, not a mid-flight swap)
  - `DELETE /api/assignments/:id/starter` → clears it (same guard)

- [ ] **Step 1: Extend the failing tests** — new describes in `assignments.test.ts`:

```ts
// rule sets: student account -> 403; teacher saves "Gr11 practicals" -> 201;
// saving the same name overwrites (list still length 1, rules updated);
// another teacher's list does not contain it; delete -> 204 and gone.
// starter: teacher pins own project -> assignment hasStarter true;
// pinning someone else's projectId -> 404; pinning after a submission exists -> 400.
```

(The "after a submission exists" case lands in Task 12's suite when submissions exist; write it here with a directly-inserted `submissions` row via `testDb.insert` — the table exists since Task 2.)

- [ ] **Step 2: Run to fail**, then implement the five routes in the same plugin, same idioms (`logEvent`: `"ruleset.saved"`, `"ruleset.deleted"`, `"assignment.starter_pinned"`, `"assignment.starter_cleared"`).

- [ ] **Step 3: Run to pass** — backend suite green, typecheck clean.

- [ ] **Step 4: Stage 0 gate** — from the repo root: `npm run test -w shared && npm run test -w backend && npm run typecheck -w backend && npm run typecheck -w shared && npm run test -w frontend` all green (frontend must not have noticed Stage 0 at all).

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(backend): saved rule sets and starter pinning — frozen manifest copies, owner-scoped"
```

---
## Stage A — teacher authoring

### Task 5: The Assignments tab becomes real — list, empty states, `assignments.css`

**Files:**
- Create: `frontend/src/components/assignments/AssignmentsTab.js`
- Create: `frontend/src/components/assignments/__tests__/assignmentsTab.test.js`
- Create: `frontend/src/styles/assignments.css` + `frontend/src/styles/__tests__/assignmentsTokens.test.js`
- Modify: `frontend/src/styles.css` (one `@import "./styles/assignments.css";` line **between** `platform.css` and `welcome.css`)
- Modify: `frontend/src/App.js` (route `/classes/:id` element: `AssignmentsStub` → `AssignmentsTab`; remove the stub import)
- Modify: `frontend/src/components/classes/ClassChrome.js` (delete the `AssignmentsStub` export — its honest sentence has done its job)
- Modify: `frontend/src/components/classes/__tests__/portalControls.test.js` (`DIRS` gains `"components/assignments"`)

**Interfaces:**
- Consumes: Task 3's `GET /api/classes/:id/assignments` (`{ assignments: [toAssignmentSummary] }` — `phase` is one of `draft|scheduled|open|late_window|closed|marks_released`; dates are epoch-ms or null); `ClassChrome`'s `children(classData, me)` render prop; the primitives (`.card`, `.badge`, `.empty`, `.btn`).
- Produces: `<AssignmentsTab />` (the `/classes/:id` route element); the list row link target `/classes/:classId/assignments/:aid` (Task 10's page) and the teacher's `New assignment` link target `/classes/:classId/assignments/new` (Task 7's page); phase badge idiom other tasks reuse: `phaseBadge(phase)` exported from `AssignmentsTab.js` returning `{ label, cls }` — `open → badge--success "open"`, `late_window → badge--warning "late window"`, `scheduled → badge--accent "scheduled"`, `closed → (plain) "closed"`, `draft → badge--warning "draft"`, `marks_released → badge--accent "marks released"` (word + colour, never colour alone).

- [ ] **Step 1: Write the failing tests** — `assignmentsTab.test.js` using `mountComponent`/`byText` and the `HeaderAccount.test.js` mocking idiom (`vi.mock` on `../../../auth/useAuth`; mock `react-router-dom` with `useParams: () => ({ id: "c1" })`, `Link` rendering an `<a>`, `Navigate` rendering null; `vi.mock("@tanstack/react-query")` exposing `useQuery: vi.fn()`). Cases:

```js
// 1. teacher view: renders each assignment title, its phase badge word, and a
//    "New assignment" link to /classes/c1/assignments/new
// 2. student view: same list payload minus drafts server-side — assert NO
//    "New assignment" link renders for myRole "student"
// 3. teacher empty state: .empty text "No assignments yet — create the first one."
// 4. student empty state: .empty text "Nothing here yet. Your teacher's assignments will appear here."
// 5. every phase maps through phaseBadge to a word + class; "closed" carries no colour class
```

Mock `ClassChrome` the way the suite mocks heavy neighbours: `vi.mock("../../classes/ClassChrome", () => ({ default: ({ children }) => children({ id: "c1", myRole: "teacher" }, { id: "u1" }) }))` — flip `myRole` per test via a mutable holder.

- [ ] **Step 2: Run to fail** — `npm run test -w frontend -- assignmentsTab` → FAIL.

- [ ] **Step 3: Write the component.** Shape (follow `ClassesHome`'s query idiom; keys extend the house convention `["class", id, "assignments"]`):

```jsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import ClassChrome from "../classes/ClassChrome";

export function phaseBadge(phase) {
  switch (phase) {
    case "open":           return { label: "open", cls: "badge badge--success" };
    case "late_window":    return { label: "late window", cls: "badge badge--warning" };
    case "scheduled":      return { label: "scheduled", cls: "badge badge--accent" };
    case "draft":          return { label: "draft", cls: "badge badge--warning" };
    case "marks_released": return { label: "marks released", cls: "badge badge--accent" };
    default:               return { label: "closed", cls: "badge" };
  }
}

export default function AssignmentsTab() {
  return (
    <ClassChrome tab="assignments">
      {(c, me) => <AssignmentsBody classData={c} me={me} />}
    </ClassChrome>
  );
}

function AssignmentsBody({ classData }) {
  const { id } = useParams();
  const isStaff = classData.myRole === "teacher" || classData.myRole === "ta";
  const q = useQuery({
    queryKey: ["class", id, "assignments"],
    queryFn: () => api(`/api/classes/${id}/assignments`),
  });
  const list = q.data?.assignments ?? [];
  return (
    <div className="page-body">
      {classData.myRole === "teacher" ? (
        <div className="assignments-actions">
          <Link className="btn" to={`/classes/${id}/assignments/new`}>New assignment</Link>
        </div>
      ) : null}
      {q.error ? <div className="alert alert--danger" role="alert">{q.error.message}</div> : null}
      {list.length === 0 && !q.isLoading ? (
        <p className="empty">
          {isStaff
            ? "No assignments yet — create the first one."
            : "Nothing here yet. Your teacher's assignments will appear here."}
        </p>
      ) : (
        <ul className="assignment-list">
          {list.map((a) => {
            const badge = phaseBadge(a.phase);
            return (
              <li key={a.id}>
                <Link className="card card--interactive assignment-row" to={`/classes/${id}/assignments/${a.id}`}>
                  <span className="assignment-row__title">{a.title}</span>
                  <span className={badge.cls}>{badge.label}</span>
                  {a.dueAt ? (
                    <span className="assignment-row__due">
                      due {new Date(a.dueAt).toLocaleDateString()}
                    </span>
                  ) : null}
                  {typeof a.submittedCount === "number" ? (
                    <span className="assignment-row__count">{a.submittedCount} submitted</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `frontend/src/styles/assignments.css`** with a header comment mirroring `welcome.css`'s placement note, and only tokenised rules (`.assignment-list` — plain list reset; `.assignment-row` — flex row, gap `var(--space-3)`, the title `--fs-lg` `--text-bright`, due/count in `--fs-sm` `--text-muted`; `.assignments-actions` — flex, gap `var(--space-2)`). Add the manifest import between `platform.css` and `welcome.css`. Write `assignmentsTokens.test.js` by copying `platformTokens.test.js`'s shape, pointed at `assignments.css` (it imports the shared `metricLint.js` helper — same covered properties, same metric-exempt escape).

- [ ] **Step 5: Wire the route.** In `App.js`: `<Route path="/classes/:id" element={<AssignmentsTab />} />`; delete the `AssignmentsStub` import and its export in `ClassChrome.js`. Add `"components/assignments"` to `portalControls.test.js` `DIRS`.

- [ ] **Step 6: Run to pass** — targeted suites, then the full frontend suite (the stub's removal must break nothing — `classTabs.test.js` mounts `ClassChrome` directly and stays green), then `npm run build -w frontend`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): the Assignments tab lists real assignments — phase badges, honest empty states, assignments.css joins the manifest"
```

---

### Task 6: The instructions format — one read-only renderer, KaTeX on demand

**Files:**
- Create: `frontend/src/components/assignments/InstructionsView.js`
- Create: `frontend/src/components/assignments/__tests__/instructionsView.test.js`
- Modify: `frontend/src/styles/assignments.css` (the `.instructions` block)
- Modify: `frontend/package.json` (dependency: `katex` — pinned exact like the house pins Blockly)

**Interfaces:**
- Consumes: the instructions JSON shape guaranteed by `InstructionsDocSchema` (Task 1): a `{type:"doc", content:[...]}` tree whose node types are `paragraph`, `heading` (attrs.level 2–4), `bulletList`/`orderedList`/`listItem`, `text` (marks: `bold`, `italic`, `code`), `image` (attrs.src data-URI, attrs.alt), `youtube` (attrs.src), `callout` (content), `math` (attrs.latex).
- Produces: `<InstructionsView doc={json} />` — pure, dependency-free rendering (NO TipTap in the student bundle); unknown node types render nothing rather than crashing. Consumed by Task 10's assignment page, Task 13's brief pane, and Task 9's guide pages.

- [ ] **Step 1: Write the failing tests** — `instructionsView.test.js` (plain `mountComponent`, no router/query mocks needed — the component is pure):

```js
// 1. renders paragraphs, headings at the right level (h3 for attrs.level 2 —
//    the page's h2 belongs to the page, instructions headings step down one),
//    bold/italic/code marks, ordered and bullet lists
// 2. renders an image node as <img> with the data-URI src and alt text,
//    loading="lazy"
// 3. renders a youtube node as an <iframe> with sandbox and the embed URL —
//    ONLY for https://www.youtube.com/embed/ or https://player.vimeo.com/
//    sources; anything else renders a plain link instead
// 4. renders a math node as its LaTeX source text inside <code class="instructions-math">
//    immediately (KaTeX upgrades it async — the test asserts the fallback)
// 5. an unknown node type renders nothing and does not throw
```

- [ ] **Step 2: Run to fail**, then write the renderer: a recursive `renderNode(node, key)` switch returning React elements; text marks fold over the text (`<strong>`, `<em>`, `<code>`); the youtube iframe carries `sandbox="allow-scripts allow-same-origin"`, `title="Embedded video"`, and an allow-list check:

```js
const EMBED_ALLOW = [/^https:\/\/www\.youtube\.com\/embed\//, /^https:\/\/player\.vimeo\.com\//];
```

For `math` nodes: render `<code className="instructions-math">{latex}</code>` synchronously; in a `useEffect`, `import("katex")` once per mount **only if** the doc contains a math node, then re-render each math node via `katex.renderToString(latex, { throwOnError: false })` into `dangerouslySetInnerHTML` — KaTeX output is generated from the latex string by the library, not raw user HTML. Import `katex/dist/katex.min.css` inside the same dynamic branch. (Install: `npm install katex -w frontend` — record the exact version the lockfile resolves in the commit body.)

- [ ] **Step 3: Style the block** in `assignments.css`: `.instructions` typography on tokens (`--fs-lg` body, `--lh-normal`, headings `--fs-xl`/`--fs-lg` + `--fw-semibold`, `--space-4` rhythm, images `max-width: 100%`, `border-radius: var(--radius-sm)`; `.instructions-math` in `--mono`). `assignmentsTokens` stays green.

- [ ] **Step 4: Run to pass** — targeted, full suite, build.

- [ ] **Step 5: Commit**

```bash
git add frontend/src frontend/package.json package-lock.json
git commit -m "feat(frontend): InstructionsView — dependency-free rich-text renderer, KaTeX loaded only when math exists"
```

---

### Task 7: The assignment editor — TipTap behind a lazy boundary

**Files:**
- Create: `frontend/src/components/assignments/AssignmentEditorPage.js` (route shell + settings form — eager)
- Create: `frontend/src/components/assignments/RichTextEditor.js` (the TipTap wrapper — loaded via `React.lazy`)
- Create: `frontend/src/components/assignments/__tests__/assignmentEditor.test.js`
- Modify: `frontend/src/App.js` (routes `/classes/:id/assignments/new` and `/classes/:id/assignments/:aid/edit` → `AssignmentEditorPage`)
- Modify: `frontend/package.json` (dependencies: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image` — pinned)

**Interfaces:**
- Consumes: Task 3's `POST /api/classes/:id/assignments`, `GET /api/assignments/:id`, `PATCH /api/assignments/:id`; Task 1's field vocabulary (`points` nullable, `submissionMode`, `individualWork`, epoch-ms dates); `.input`, `.btn`, `.alert`, `.tabs` primitives; `PortalHeader` + `.page` shell (this page is NOT inside `ClassChrome` — it is a full-screen editor with its own header carrying Save/Publish actions).
- Produces: the editor page both routes mount; `RichTextEditor({ value, onChange })` emitting TipTap JSON that always satisfies `InstructionsDocSchema`; custom TipTap nodes `youtube` (paste a URL → embed node) and `math` (insert dialog taking LaTeX text) matching Task 6's renderer vocabulary **exactly** — renderer and editor share one node-type contract, and the test locks it.

- [ ] **Step 1: Write the failing tests** — `assignmentEditor.test.js`. The TipTap editor itself is NOT mounted in jsdom (it is lazy and heavy); mock `../RichTextEditor` to a `<textarea>` stand-in emitting a minimal doc. Test the page around it:

```js
// 1. "new" mode: renders title input, project-type select (the GOALS strings),
//    points input (empty = complete/not-complete, shown as its placeholder),
//    submission-mode select, individual-work checkbox (disabled unless mode
//    is individual), open/due/late datetime-local inputs
// 2. Save creates via POST with epoch-ms dates and navigates to the class
//    assignments tab; server 400 renders alert alert--danger with the message
// 3. "edit" mode seeds fields from GET /api/assignments/:aid
// 4. the individualWork checkbox clears and disables when mode leaves individual
// 5. date inputs round-trip: a filled datetime-local becomes epoch ms in the
//    payload; an empty one posts null
```

- [ ] **Step 2: Run to fail**, then build `AssignmentEditorPage`: `useMe` gate → `ClassChrome`-style teacher check via the class query (`myRole !== "teacher"` → `alert` "Teachers only for this class."); form state in `useState`; date conversion helpers:

```js
const toLocal = (ms) => (ms ? new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const toMs = (local) => (local ? new Date(local).getTime() : null);
```

`RichTextEditor` mounts via `React.lazy(() => import("./RichTextEditor"))` inside `<Suspense fallback={<p className="empty">Loading the editor…</p>}>`.

- [ ] **Step 3: Write `RichTextEditor.js`** with `useEditor` from `@tiptap/react`: StarterKit (headings limited to levels 2–4, no horizontal rule), `@tiptap/extension-image` configured `allowBase64: true` with an upload handler that reads a picked file via `FileReader.readAsDataURL`, **rejects files over 200 KB with an inline `alert alert--warning` message** ("That image is too large (200 KB max).") — the same cap the shared schema enforces server-side; two small custom nodes:

```js
// youtube: an atom node {attrs: {src}} inserted from a prompt-validated URL —
// accept only watch/share URLs it can rewrite to https://www.youtube.com/embed/<id>
// or https://player.vimeo.com/video/<id>; anything else is refused inline.
// math: an atom node {attrs: {latex}} rendered in the editor as its LaTeX in
// <code> (same fallback presentation as InstructionsView).
```

A compact toolbar of `.btn .btn--sm` buttons (Bold, Italic, Code, H2, H3, List, Numbered, Image, Video, Math) — no icon invention: text labels are fine here, this is a teacher tool. `onChange` emits `editor.getJSON()`.

- [ ] **Step 4: Wire the routes** in `App.js` (two lines). Run everything to pass; `npm run build -w frontend` and confirm in the build output that TipTap lands in its **own chunk** (the lazy boundary working) and the main bundle did not grow by more than a few KB.

- [ ] **Step 5: Commit**

```bash
git add frontend/src frontend/package.json package-lock.json
git commit -m "feat(frontend): assignment editor — settings form eager, TipTap lazy, capped inline images, math and video nodes"
```

---

### Task 8: Rules picker, starter pinning, and the lifecycle controls

**Files:**
- Create: `frontend/src/components/assignments/RulesPicker.js`
- Create: `frontend/src/components/assignments/__tests__/rulesPicker.test.js`
- Modify: `frontend/src/components/assignments/AssignmentEditorPage.js` (mount the picker, the starter row, and Publish/Close/Delete)
- Modify: `frontend/src/components/assignments/__tests__/assignmentEditor.test.js`

**Interfaces:**
- Consumes: `BUILT_IN_RULE_SETS` + `WorkspaceRulesSchema` field names from `@physics-ide/shared` (frontend imports shared exactly as `classes.ts` consumers do); Task 4's `GET/POST/DELETE /api/rule-sets`, `POST/DELETE /api/assignments/:id/starter`; `GET /api/projects` list shape from `projects.ts` (the teacher's own projects — verify the list route's response envelope by reading `backend/src/routes/projects.ts` before writing the picker).
- Produces: `<RulesPicker value={rules} onChange={fn} />` — a radio set (Open practice / Standard classwork / Locked assessment / Custom…) + the six switches revealed under Custom + "Save as…" (name input → `POST /api/rule-sets`) + the teacher's saved sets listed as further radio options with a delete control (`btn--danger` outlined, it destroys a saved set).

- [ ] **Step 1: Failing tests** — `rulesPicker.test.js`:

```js
// 1. selecting "Standard classwork" emits BUILT_IN_RULE_SETS.standard_classwork
// 2. "Custom…" reveals six labelled switches seeded from the current value;
//    flipping exportAndCopy emits the changed object
// 3. saved sets from the query render as options; choosing one emits its rules
// 4. "Save as…" posts {name, rules} and invalidates the rule-sets query
// 5. the six switch labels are the spec's words: Editors, Debugging, Import,
//    Export & copy, Advanced blocks, Templates — and each switch is a real
//    <input type="checkbox"> (editors is a three-way select: blocks/code/both)
```

- [ ] **Step 2: Implement the picker** (query key `["rule-sets"]`), then extend `AssignmentEditorPage`:
  - the starter row: a select over the teacher's own projects (`useQuery(["projects"], () => api("/api/projects"))` — shape per the verified envelope) + Pin/Clear buttons calling Task 4's routes; show `hasStarter` state from the assignment payload.
  - lifecycle: `Publish` (`btn btn--primary`) with a one-line consequence sentence ("Students in this class will see it immediately." — or the scheduled date when `opensAt` is set); `Close now` and `Delete draft` as `btn btn--danger` (outlined); Delete only renders for drafts, matching the server rule.

- [ ] **Step 3: Run to pass** — targeted, full, build.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): rules picker with saved sets, starter pinning, publish and close controls"
```

---

### Task 9: Guide pages — the same format, published to a class

**Files:**
- Create: `backend/src/routes/guides.ts` + `backend/src/routes/guides.test.ts`
- Modify: `backend/src/app.ts` (register `guideRoutes`)
- Create: `frontend/src/components/assignments/GuidesTab.js` + `GuidePage.js` + `__tests__/guides.test.js`
- Modify: `frontend/src/components/classes/ClassChrome.js` (tabs list gains `{ key: "guides", label: "Guides", to: `/classes/${c.id}/guides`, show: true }` between Assignments and People)
- Modify: `frontend/src/components/classes/__tests__/classTabs.test.js` (the tab set changed deliberately — extend the assertion)
- Modify: `frontend/src/App.js` (routes `/classes/:id/guides`, `/classes/:id/guides/new`, `/classes/:id/guides/:gid`, `/classes/:id/guides/:gid/edit`)

**Interfaces:**
- Consumes: `GuideInputSchema` (Task 1), `guides` table (Task 2), guards, `InstructionsView` (Task 6), `RichTextEditor` (Task 7 — same lazy import).
- Produces: `GET /api/classes/:id/guides` (students: published only — `publishedAt` set; staff: all), `POST /api/classes/:id/guides` (teacher), `GET /api/guides/:gid`, `PATCH /api/guides/:gid`, `POST /api/guides/:gid/publish`, `DELETE /api/guides/:gid` (teacher; guides MAY be deleted — they carry no student work). Frontend: a Guides tab list + a read page (`InstructionsView`) + a teacher editor reusing `RichTextEditor`.

- [ ] **Step 1: Backend failing tests** (same harness): teacher creates draft guide; student list shows only published; publish stamps; student reads a published guide; non-member 403; delete works for teachers even when published.

- [ ] **Step 2: Implement `guides.ts`** (the routes are a strict subset of the assignment patterns — copy the idioms, not the file), register the plugin, backend green.

- [ ] **Step 3: Frontend failing tests**: the tab renders titles; unpublished guides show a `badge--warning "draft"` for staff; the read page renders the body through `InstructionsView`; teacher sees Edit/Publish.

- [ ] **Step 4: Implement, wire routes, extend `classTabs.test.js` deliberately** (its assertion enumerates the link tabs — Guides joins between Assignments and People for every role).

- [ ] **Step 5: Stage A gate** — full frontend + backend + shared suites, both typechecks, build. Browser check with `npm run dev`: as the seeded admin (a teacher member of "Sweep Class"), author an assignment with an image + a formula + a video, save, publish, see it listed; author and publish a guide; both themes.

- [ ] **Step 6: Commit**

```bash
git add backend/src frontend/src
git commit -m "feat: guide pages — the instructions format published standalone, Guides tab for every class"
```

---
## Stage B — the student experience

### Task 10: The assignment page and Start work — the private copy, the server link

**Files:**
- Modify: `backend/src/routes/assignments.ts` (+ `POST /api/assignments/:id/start`; the student GET grows `starterSeed` + `myWork`)
- Modify: `backend/src/routes/assignments.test.ts`
- Create: `frontend/src/components/assignments/AssignmentPage.js` + `__tests__/assignmentPage.test.js`
- Create: `frontend/src/utils/assignments/startWork.js` + `__tests__/startWork.test.js`
- Modify: `frontend/src/App.js` (route `/classes/:id/assignments/:aid` → `AssignmentPage`)

**Interfaces:**
- Consumes: `GET /api/assignments/:id` (Task 3); `createManifest` (the manifest factory `hooks/useProject.js` imports — find its export by grepping `createManifest`; spec fields `goal`, `preferredEditor`, `title`, `projectType`, `workspaceXml`, `python`) + `saveProject` (`utils/storage/projectStore.js`) + `LAST_PROJECT_KEY` — **NOT `useProject().createNew`**: that hook needs the IDE's Simulation/Project contexts, which portal pages never mount; the storage primitives are context-free and are exactly what Task 17's test copy uses; the sync engine's `pushProject(id, ownerId)` + `getGlobalSyncEngine()` (`utils/sync/syncEngine.js`); `InstructionsView` (Task 6); `phaseBadge` (Task 5).
- Produces:
  - Backend: `POST /api/assignments/:id/start` body `{ projectId }` → 201 `{ work: { projectId } }` — verifies the caller is an **active student-or-staff member** of the class, phase is `open` or `late_window`, and `projects` holds `(ownerId = caller, id = projectId, deletedAt null)`; inserts `assignment_work` (unique per (assignment, user) — a second call returns 200 with the EXISTING row and does not insert); `logEvent("assignment.started")`. Student GET gains `myWork: { projectId, startedAt } | null` and — while phase is open/late_window and the caller has no work row yet — `starterSeed: { goal, workspaceXml, python, preferredEditor } | null` derived from `starterManifest` (never the raw manifest: only the four seed fields).
  - Frontend: `startAssignmentWork({ assignment, createNew, me })` in `startWork.js` — the one function that owns the Start sequence; `AssignmentPage` with Start work / Continue.

- [ ] **Step 1: Backend failing tests** — start creates the link for a member with a pushed project (insert a `projects` row directly via `testDb`, then call start); starting twice returns the same `projectId`; a non-member 403s; starting a draft/closed assignment 400s ("This assignment is not open."); starting with a `projectId` the caller does not own 404s ("No such project."). Student GET: `starterSeed` present before start (assignment with a pinned starter), absent after; `myWork` reflects the row.

- [ ] **Step 2: Implement the route + GET extras**, run backend green.

- [ ] **Step 3: Frontend `startWork.js`** — the sequence is the design's D§2/D§3 in code; write the failing unit test first (mock `createNew`, a fake engine, `api`):

```js
import { api } from "../api/client";
import { getGlobalSyncEngine } from "../sync/syncEngine";
import { setAssignmentMeta } from "../storage/assignmentMeta"; // Task 11 creates it; this task creates the module with set/get stubs

/**
 * Start (or continue) assignment work — D§2: the server is the authority,
 * the manifest is never tagged. Returns the local projectId to open.
 * Requires the network (the assignment page is server data anyway).
 */
export async function startAssignmentWork({ assignment, me }) {
  if (assignment.myWork) {
    await cacheContext(assignment, assignment.myWork.projectId);
    return assignment.myWork.projectId;
  }
  const seed = assignment.starterSeed;
  const manifest = createManifest({
    goal: assignment.projectType,
    title: assignment.title,
    projectType: seed?.workspaceXml || seed?.python ? "block_template" : "custom",
    workspaceXml: seed?.workspaceXml ?? "",
    python: seed?.python ?? "",
    preferredEditor: seed?.preferredEditor ?? "blocks",
  });
  const saved = await saveProject(manifest);
  try { localStorage.setItem(LAST_PROJECT_KEY, saved.id); } catch { /* storage blocked */ }
  const engine = await getGlobalSyncEngine();
  await engine.pushProject(saved.id, me.id);              // the FK needs the row server-side
  await api(`/api/assignments/${assignment.id}/start`, { method: "POST", body: { projectId: saved.id } });
  await cacheContext(assignment, saved.id);
  return saved.id;
}

async function cacheContext(assignment, projectId) {
  await setAssignmentMeta(projectId, {
    assignmentId: assignment.id,
    classId: assignment.classId,
    title: assignment.title,
    dueAt: assignment.dueAt,
    rules: assignment.rules ?? null,
  });
}
```

Note: `assignment.rules` reaches students from this task on — extend the student GET shaping to include `rules` (students must know their own constraints; it is the TEACHER list view that omits rules for brevity, not the detail).

- [ ] **Step 4: `AssignmentPage`** — mounts inside `ClassChrome` (tab="assignments"); renders title + `phaseBadge` + due line + `InstructionsView doc={assignment.instructions}`; the one big button per spec §6.2: **Start work** (no `myWork`) / **Continue** (`myWork`), disabled with an honest sentence when phase is `scheduled`/`closed`; on click runs `startAssignmentWork` then `navigate("/")` — the IDE lives at `/` and will find the context (Task 11). Teacher/TA view adds Edit + the submissions link (Task 16's inbox route). Component tests mock `startWork.js` and assert the button wiring, the phase gating, and that instructions render.

- [ ] **Step 5: Wire the route; run everything; commit**

```bash
git add backend/src frontend/src
git commit -m "feat: Start work — private copy pushed, assignment_work links it, the page renders the brief"
```

---

### Task 11: The assignment context in the IDE — cache, provider, rules chip

**Files:**
- Create: `frontend/src/utils/storage/assignmentMeta.js` (finalized) + `__tests__/assignmentMeta.test.js`
- Create: `frontend/src/contexts/AssignmentContext.js` + `frontend/src/components/layout/RulesChip.js` + tests
- Modify: `frontend/src/components/layout/IDELayout.js` (provider mount + status-bar chip)

**Interfaces:**
- Consumes: `syncMeta.js`'s localforage idiom (same `name: "physics-ide"`, new `storeName: "assignment-meta"`); `useMe()`; `api()`; the status bar JSX (`IDELayout.js` — `SaveState` mount).
- Produces: `getAssignmentMeta(projectId)` / `setAssignmentMeta(projectId, meta)` / `deleteAssignmentMeta(projectId)`; `<AssignmentProvider projectId={proj.activeProjectId}>` exposing `useAssignmentContext()` → `{ assignmentId, classId, title, dueAt, rules } | null`; `<RulesChip />` — every later enforcement surface reads `useAssignmentContext()`.

- [ ] **Step 1: `assignmentMeta.js`** — mirror `syncMeta.js` exactly (prefix `"assignment-meta:"`, stored shape `{ assignmentId, classId, title, dueAt, rules }`); unit-test set/get/delete round-trip with the localforage memory driver the existing `syncMeta` tests use (read them first and copy the harness).

- [ ] **Step 2: `AssignmentContext.js`** — provider keyed on the active project id:

```jsx
const Ctx = createContext(null);
export const useAssignmentContext = () => useContext(Ctx);

export function AssignmentProvider({ projectId, children }) {
  const { data: me } = useMe();
  const [ctx, setCtx] = useState(null);
  useEffect(() => {
    let dead = false;
    if (!projectId || !me) { setCtx(null); return; }
    (async () => {
      const cached = await getAssignmentMeta(projectId);
      if (dead) return;
      setCtx(cached);                       // offline lessons run from the cache (D§2)
      if (!cached) return;
      try {                                  // "new rules next time they open the work"
        const fresh = await api(`/api/assignments/${cached.assignmentId}`);
        if (dead) return;
        const meta = { assignmentId: cached.assignmentId, classId: fresh.assignment.classId,
          title: fresh.assignment.title, dueAt: fresh.assignment.dueAt, rules: fresh.assignment.rules ?? null };
        await setAssignmentMeta(projectId, meta);
        setCtx(meta);
      } catch { /* offline or revoked — the cache stands */ }
    })();
    return () => { dead = true; };
  }, [projectId, me]);
  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>;
}
```

Guests always get `null` (assignment work is signed-in by construction — `me` gate above), so **the guest IDE cannot change behaviour**.

- [ ] **Step 3: `RulesChip`** — reads the context; renders nothing without one. With one: a `.sync-chip`-shaped status-bar chip (`role="status" aria-live="polite"`), text per spec §5.4: `Your teacher has turned off: import, export & copy` — computed from the rules object's false switches (and `editors` ≠ "both" reads `blocks only` / `code only`); with nothing off: `Assignment: <title>` so the student always knows they are inside assignment work. Title attribute carries the full sentence; the visible text may shorten (CSS ellipsis), never unmount — that is delta S4, and the placement (status bar, not the collapsing header view zone) is the recorded deviation D§4.

- [ ] **Step 4: Mount both in `IDELayout`** — wrap the layout's children (or the relevant subtree) in `<AssignmentProvider projectId={proj.activeProjectId}>`; add `<RulesChip />` to the status bar directly after `<SaveState … />`. A `LAST_PROJECT_KEY` boot restore now re-enters assignment context automatically — the provider keys on the restored project id (this is the D§2 consequence; the test asserts it by mounting the provider with a cached id).

- [ ] **Step 5: Tests green (component tests for provider + chip; full suite), commit**

```bash
git add frontend/src
git commit -m "feat(frontend): assignment context — cached per project, refreshed when opened, announced in the status bar"
```

---

### Task 12: Workspace rules enforced — the pure axis and its consumers

**Files:**
- Modify: `frontend/src/utils/toolbar/visibleControls.js` + `__tests__/visibleControls.test.js`
- Modify: `frontend/src/components/Toolbar.js` (fileMenu item gating)
- Modify: `frontend/src/components/ViewportControls.js` (snapshot gate)
- Modify: `frontend/src/components/layout/IDELayout.js` (editors lock; debug/trace props; toolbox flag)
- Modify: the toolbox builder in `frontend/src/utils/blockly/toolbox.js` (advanced-blocks flag — find the Advanced category by its name in the file, do not guess line numbers)
- Tests for each surface in their existing suites

**Interfaces:**
- Consumes: `useAssignmentContext()` (Task 11); `WorkspaceRules` field names (`editors`, `debug`, `importFiles`, `exportAndCopy`, `advancedBlocks`, `templates`).
- Produces: `visibleControls({ …, rules = null })` — same pure function, one new optional field; every rule-governed surface behaves per the table below. **The plan states plainly (D§4): these are client-side honesty switches; the OS clipboard inside Monaco and a phone photographing the screen are not in scope, and no code pretends otherwise.**

| Rule off | What changes |
|---|---|
| `editors: "blocks"` / `"code"` | `primary` zone returns `[]` (no modeToggle); IDELayout forces `mode` to the allowed editor while context exists |
| `debug: false` | `debug` key never appears in `view` (regardless of runState/debugMode axes); SimControls' debug entry hidden |
| `importFiles: false` | both Import items inside fileMenu render null |
| `exportAndCopy: false` | every Export item, Copy Code, PDF items, **and both screenshot paths** (fileMenu's Screenshot item + ViewportControls' `shot` action) render null |
| `advancedBlocks: false` | the Advanced drawer (and its children) is filtered out of the toolbox before injection |
| `templates: false` | **no in-workspace surface exists to gate today** — the chip still names it; the plan records this honestly rather than inventing a switch with nothing behind it |

- [ ] **Step 1: Extend the `visibleControls` invariant suite first** (it is the contract): existing tests all still pass with `rules` absent; new cases — `rules: null` is byte-identical to today for every goal×mode×runState combination (loop them); `editors:"blocks"` empties `primary`; `debug:false` beats both keep-alive axes (`debugMode:true`, `traceVisible:true` still yield no `debug` key); rules touch NOTHING else in the matrix (`trace`, `reset`, `clear`, `help`, the whole `file` zone are unchanged — fileMenu gating is item-level in Toolbar, not key-level, because `save`/`fileMenu` themselves stay).

- [ ] **Step 2: Implement the axis** — inside `visibleControls`, after computing `view`:

```js
if (rules) {
  if (!rules.debug) view = view.filter((k) => k !== "debug");
}
const primary = rules && rules.editors !== "both" ? [] : ["modeToggle"];
```

- [ ] **Step 3: Toolbar item gating** — `const assignment = useAssignmentContext();` `const rules = assignment?.rules ?? null;` — and thread `rules` into the `visibleControls(...)` call that computes `zones` (find it by grepping `visibleControls(` — it lives in Toolbar or IDELayout; pass the field, do not fork the call). Then in the fileMenu renderer each Import item additionally requires `!rules || rules.importFiles`; each Export/PDF/Screenshot/Copy item requires `!rules || rules.exportAndCopy`. Both hidden groups together must not leave a dangling divider — compute the two group flags first. Extend `Toolbar`'s existing suites (`ToolbarDebug`/`ToolbarResponsive` show the mocking idiom) with a rules-on case asserting the items are gone from BOTH the inline menu and the stage-2 overflow (they share `zones`, so this is one assertion each).

- [ ] **Step 4: ViewportControls** — same context read; when `rules && !rules.exportAndCopy`, drop the `shot` entry from `actions`. Test alongside its existing suite.

- [ ] **Step 5: Editors lock + toolbox filter** — IDELayout: while `assignment?.rules?.editors === "blocks"` force `mode` to `"blocks"` (and `"code"` likewise) — implement as an effect that corrects mode, not a fork of the mode state. Toolbox: thread `hideAdvanced` from the workspace props into the toolbox builder; filter the Advanced category node by its name; add a unit test next to the existing toolbox/registry tests proving the filtered toolbox drops the drawer and its children while `check:blocks` still passes (the registry is not the toolbox — the filter is display-time only).

- [ ] **Step 6: Full suite + `npm run check:blocks` green; browser sanity with a locked_assessment assignment (no File exports, no debug, no Advanced drawer, chip reads the list); commit**

```bash
git add frontend/src
git commit -m "feat(frontend): workspace rules enforced — pure visibleControls axis, item-level file menu, both screenshot paths, toolbox filter"
```

---

### Task 13: The brief pane — instructions beside the work

**Files:**
- Create: `frontend/src/components/assignments/BriefPane.js` + `__tests__/briefPane.test.js`
- Modify: `frontend/src/components/layout/IDELayout.js` (the pane + handle in `.main-layout`)
- Modify: `frontend/src/styles/assignments.css`

**Interfaces:**
- Consumes: `useAssignmentContext()`; `InstructionsView`; the pane-header primitive (`.pane-header` + a new `--brief` variant); `Overlay` (`components/common/Overlay.js` — `onClose`, `label`, `panelClassName`); the assignment detail query (instructions are NOT in the cached meta — the pane fetches `["assignment", id]` and caches last-good in state for offline).
- Produces: `<BriefPane />` and its collapsed handle; a `brief-pane` left column in `.main-layout` (D§5: fixed width, collapsible, NOT part of `--split`).

- [ ] **Step 1: Failing tests** — with no context: renders nothing at all. With context: the pane renders `.pane-header.pane-header--brief` titled by the assignment title, the instructions through `InstructionsView`, a due line, a collapse button (`aria-expanded`), and a pop-out button that mounts `Overlay` with the same `InstructionsView`. Collapsed: only the handle (a vertical tab labelled "Brief", `aria-expanded="false"`) renders.

- [ ] **Step 2: Implement.** Collapse state: `useState(() => window.matchMedia("(max-width: 1024px)").matches)` — the floor starts collapsed but reachable (spec §6.2: it may collapse to a toggle, it may never vanish). Persist the choice per session in `sessionStorage` (`"pide_brief_collapsed"`). IDELayout mounts it as the FIRST child of `.main-layout` (before `.editor-pane`); the handle renders in the same slot when collapsed.

- [ ] **Step 3: CSS in `assignments.css`:**

```css
/* D§5: a fixed-width column, deliberately outside the --split arithmetic. */
.brief-pane {
  display: flex;
  flex-direction: column;
  width: 320px; /* width is not a linted metric; the token scale has no length this size */
  min-width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-surface);
  overflow-y: auto;
}
.pane-header--brief { border-top: 2px solid var(--cat-communicate); padding-top: 0; }
.brief-pane__body { padding: var(--space-3) var(--space-4); }
.brief-handle {
  writing-mode: vertical-rl;
  padding: var(--space-3) var(--space-1);
  font-size: var(--label-fs);
  font-weight: var(--label-weight);
  letter-spacing: var(--label-tracking);
  color: var(--label-color);
  background: var(--bg-surface);
  border: none;
  border-right: 1px solid var(--border);
  border-top: 2px solid var(--cat-communicate);
  cursor: pointer;
}
```

(`--cat-communicate` is the palette token the delta's S5 names; referencing the CSS custom property directly is the same discipline `workspace.css` uses for `--cat-values`/`--cat-objects`.)

- [ ] **Step 4: Full suite; browser check both themes at 1440px and exactly 1024px (pane collapses to the handle, nothing vanishes); commit**

```bash
git add frontend/src
git commit -m "feat(frontend): the brief pane — instructions dock left of the editor, collapse to a labelled handle, pop out through the one overlay"
```

---

### Task 14: Submit — the frozen snapshot, the receipt

**Files:**
- Modify: `backend/src/routes/assignments.ts` (+ `POST /api/assignments/:id/submit`, `GET /api/assignments/:id/my-submission`)
- Modify: `backend/src/email/templates.ts` (+ `submissionReceipt`)
- Modify: `backend/src/routes/assignments.test.ts`
- Modify: `frontend/src/components/assignments/BriefPane.js` + `AssignmentPage.js` (the Submit button + submitted state)
- Create: `frontend/src/components/assignments/__tests__/submitFlow.test.js`

**Interfaces:**
- Consumes: `assignment_work` (Task 10), `submissions` (Task 2), `stableStringify` (exported from `backend/src/routes/projects.ts` — export it if it is module-private; do NOT re-implement it), node `crypto.createHash("sha256")`; the sync engine's `pushProject` client-side.
- Produces: `POST /api/assignments/:id/submit` → 201 `{ submission: { id, fingerprint, late, attempt, submittedAt } }` — reads the caller's work row, snapshots the CURRENT SERVER HEAD manifest of the linked project inside one transaction (flip `isCurrent` off on the previous attempt, `attempt + 1`), computes `late` from `dueAt` vs now (fiat D§11.4: against the dates in force at submit time), refuses when phase is not `open`/`late_window` ("The due date has passed." / "This assignment is closed."), `logEvent("assignment.submitted")`; after the tx, one `submissionReceipt` email per credited user through `app.mailer.send` (individual: the submitter). The email carries title, class, timestamp, attempt, and the **fingerprint** — the dispute authority (D§11.6).

- [ ] **Step 1: Backend failing tests** — submit before start 400s; submit snapshots the server head (insert a project, start, submit, assert `submissions.manifest` equals the project row's manifest and `fingerprint` is the sha256 hex of its stable stringify); resubmit flips `isCurrent` and increments `attempt`; submit inside the late window sets `late: true`; after `lateUntil` 400s; the receipt lands in the `emails` table addressed to the submitter.

- [ ] **Step 2: Implement** (route + template — follow `classInvite`'s `{ subject, text }` shape and its CRLF-strip of user-supplied strings in subjects).

- [ ] **Step 3: Frontend submit flow** — in `BriefPane` (footer) and `AssignmentPage` (when work exists): a `btn btn--primary` **Submit** whose click: `await engine.pushProject(projectId, me.id)` (the snapshot must be of what the student sees — push first), then the POST; on success render an `alert alert--success` with `role="status"`: "Submitted — attempt N. Fingerprint <code>abcd1234</code>." (first 8 hex chars; the email carries the whole thing); on refusal the server sentence in `alert alert--danger`. Late phase shows a warning line before the button: "The due date has passed — this submission will carry a permanent late label." `submitFlow.test.js` mocks engine + api and asserts push-happens-before-post, the success/refusal renders, and the late warning gating by phase.

- [ ] **Step 4: Everything green; commit**

```bash
git add backend/src frontend/src
git commit -m "feat: submit — server-head snapshot in one transaction, fingerprint receipts, honest late labels"
```

---

### Task 15: Due soon and recent feedback — the Home strip

**Files:**
- Modify: `backend/src/routes/assignments.ts` (+ `GET /api/assignments/upcoming`)
- Modify: `backend/src/routes/assignments.test.ts`
- Modify: `frontend/src/components/classes/ClassesHome.js` (the strip above the wall)
- Create: `frontend/src/components/classes/__tests__/homeStrip.test.js`

**Interfaces:**
- Consumes: every table so far; `phaseBadge`.
- Produces: `GET /api/assignments/upcoming` → `{ dueSoon: [{ assignmentId, classId, className, title, dueAt, submitted }], recentFeedback: [{ assignmentId, classId, title, releasedAt }] }` — dueSoon: published assignments in the caller's active classes with `dueAt` within 14 days ahead, phase open/late_window, plus whether the caller has a current submission; recentFeedback: marks rows for the caller released within the last 14 days (empty until Task 18 releases exist — the shape ships now, the test seeds a released mark row directly).
- The strip renders only when it has content — an empty Home stays exactly as it is today.

- [ ] **Step 1: Backend failing tests** (seed classes/assignments/work/submissions/marks directly), **Step 2: implement**, **Step 3: frontend strip** — two compact `.card` rows above the class wall: "Due soon" (title → link to the assignment page, class name, due date, a `badge--success submitted` when submitted) and "Recent feedback" (title → link); component test with mocked query. **Step 4: Stage B gate** — all suites, both typechecks, build, and the browser pass: sign in as a seeded student, join the class, start the assignment, see the brief pane + rules chip, submit, watch Home show it. **Step 5: commit**

```bash
git add backend/src frontend/src
git commit -m "feat: the Home strip — due soon and recent feedback, links straight into the work"
```

---
## Stage C — marking

### Task 16: The inbox — every student on one screen

**Files:**
- Modify: `backend/src/routes/assignments.ts` (+ `GET /api/assignments/:id/inbox`, `POST /api/assignments/:id/remind`)
- Modify: `backend/src/email/templates.ts` (+ `dueReminder` — the teacher's one-click nudge)
- Modify: `backend/src/routes/assignments.test.ts`
- Create: `frontend/src/components/assignments/InboxPage.js` + `__tests__/inboxPage.test.js`
- Modify: `frontend/src/App.js` (route `/classes/:id/assignments/:aid/inbox`), `AssignmentPage.js` (staff link to it)

**Interfaces:**
- Consumes: roster via `class_members` (active students only), `submissions` heads, `marks`.
- Produces: inbox rows — `{ studentId, name, state, late, submittedAt, attempt, markStatus }` where `state ∈ submitted | missing` and `markStatus ∈ none | draft | released`; **"Missing" is fiat D§11.1: an active roster student with no current submission** (before the due date the word softens to "not yet submitted" in the UI — same row state, different label while phase is `open`); `POST /remind` (teacher only) emails `dueReminder` to every missing student, replying `{ reminded: n }`; `logEvent("assignment.reminded")`. Frontend: filter tabs **All / Submitted / Late / Missing / Marked** (`.tabs` + `.tab` with `aria-current` — link-style filters), a progress line "17 of 30 submitted" + a token-styled progress bar, per-row link into Task 17's marking room.

- [ ] **Step 1: Backend failing tests** (seed a roster of three: one submitted, one late, one missing) → **Step 2: implement** (the inbox query joins members ← submissions(current) ← marks; the reminder loops missing students AFTER the tx, one `mailer.send` each). TA may read the inbox; only the teacher may remind.
- [ ] **Step 3: Frontend page** inside `ClassChrome`, staff-gated like `PeopleTab`'s idiom; filters are client-side over the one query `["assignment", aid, "inbox"]`; the reminder button confirms with its consequence sentence ("Email N students who have not submitted?") before firing.
- [ ] **Step 4: Suites green; commit**

```bash
git add backend/src frontend/src
git commit -m "feat: the submissions inbox — one screen, four filters, a progress line, one-click reminders"
```

---

### Task 17: The marking room — read-only script, test copy, Previous/Next

**Files:**
- Create: `frontend/src/components/assignments/MarkingRoom.js` + `SubmissionViewer.js` + `__tests__/markingRoom.test.js`
- Modify: `backend/src/routes/assignments.ts` (+ `GET /api/assignments/:id/submissions/:studentId` — staff read of the current snapshot + attempt history)
- Modify: `frontend/src/App.js` (route `/classes/:id/assignments/:aid/marking/:studentId`)

**Interfaces:**
- Consumes: `ReadOnlyBlockly` and `CodeEditor` (both exist — IDELayout renders them; import from their real paths, found by grepping the IDELayout imports); `createManifest` (the factory `hooks/useProject.js` uses — export path verified by grep), `saveProject` (`utils/storage/projectStore.js`), `LAST_PROJECT_KEY`.
- Produces: the marking room: header (student name, attempt, `late` badge, fingerprint in `--mono`), `SubmissionViewer` (a `.tabs` pair Blocks/Code rendering the snapshot's `workspaceXml` through `ReadOnlyBlockly` and its `python` through `CodeEditor readOnly` — per-viewer theme comes free, the delta's S7), **Open a test copy** (`btn`): builds a manifest from the snapshot via `createManifest({ goal, workspaceXml, python, title: "Test copy — <student> — <assignment>" })`, `saveProject`s it into the TEACHER's own space, stamps `LAST_PROJECT_KEY`, navigates `/` — the full IDE with debug, on a copy, never the student's work; Previous/Next walk the inbox order (the inbox query is already cached — reuse its row order).

- [ ] **Step 1: Backend snapshot read + tests** (staff only; 404 for a student with no submission), **Step 2: frontend failing tests** (viewer renders both tabs from a fixture manifest; test-copy click saves a manifest whose title carries "Test copy" and navigates; Previous/Next disabled at the ends), **Step 3: implement, everything green, commit**

```bash
git add backend/src frontend/src
git commit -m "feat(frontend): the marking room — the exam script read-only, the test copy in the full IDE"
```

---

### Task 18: Marks — drafts, release, return for changes

**Files:**
- Modify: `backend/src/routes/assignments.ts` (+ `PUT /api/assignments/:id/marks/:studentId`, `POST /api/assignments/:id/marks/release`, `POST /api/assignments/:id/marks/:studentId/return`), `backend/src/email/templates.ts` (+ `marksReleased`, `workReturned`), tests
- Modify: `frontend/src/components/assignments/MarkingRoom.js` (the marking panel), `AssignmentPage.js` (the student's released mark + feedback), `__tests__`

**Interfaces:**
- Produces:
  - `PUT …/marks/:studentId` (teacher or TA): upserts the draft `{ points, comment, privateNote }` (zod `MarkDraftInputSchema`; `points` must not exceed `assignments.points` when set — route check, "That is more than the assignment is out of."), stamps `markedBy` + `basedOnSubmissionId` = the current submission id. **Release is teacher-only by construction** — this route can never set status.
  - `POST …/marks/release` body `{ studentIds }` or `{ all: true }` (teacher): flips drafts to `released` in one tx; `{ all: true }` also sets the assignment's stored status to `marks_released`; after the tx, one `marksReleased` email per student. Fiat D§11.3 surfaces here: the panel shows "written against attempt N — a newer attempt exists" when `basedOnSubmissionId` is not the current submission, and release refuses those rows with that sentence unless re-saved.
  - `POST …/marks/:studentId/return` (teacher or TA): sets `returned`, emails `workReturned` with the comment; **the student may resubmit even when phase is closed while a returned, unreleased mark stands** (fiat D§11.2) — Task 14's submit check gains exactly that branch, with a test.
  - Student read: `GET /api/assignments/:id` gains `myMark: { points, comment, released, returned } | null` — released or returned rows only; drafts and `privateNote` NEVER leave the staff shape (a test asserts the student payload cannot contain `privateNote` even when a draft exists).
- Frontend: the marking panel beside the viewer — mark input (out-of shown; empty = complete/not-complete toggle when the assignment has no points), comment, private note (labelled "Private — teachers and TAs only"), Save draft (`btn`), Return for changes (`btn btn--danger` outlined — it sends work back), Release (teacher only, `btn btn--primary`, per-student) + Release all on the inbox; the student's assignment page renders the released mark + comment in a `.card`, and a returned state as `alert alert--warning` with the comment and an honest "You can resubmit."

- [ ] **Step 1: Backend failing tests** (TA saves a draft, cannot release; teacher releases; release-all stamps the assignment; stale-draft refusal; return reopens submit-after-close; the student-shape privacy test), **Step 2: implement routes + templates**, **Step 3: frontend panel + student view with component tests**, **Step 4: green; commit**

```bash
git add backend/src frontend/src
git commit -m "feat: marking — TA drafts by construction, teacher release, return-for-changes reopens the door"
```

---

### Task 19: The gradebook — the grid and the spreadsheet file

**Files:**
- Modify: `backend/src/routes/assignments.ts` (+ `GET /api/classes/:id/gradebook`), tests
- Create: `frontend/src/components/assignments/GradebookTab.js` + `__tests__/gradebookTab.test.js`
- Modify: `frontend/src/components/classes/ClassChrome.js` (tab `{ key: "gradebook", label: "Gradebook", show: isStaff }` after Guides), `classTabs.test.js` (deliberate extension), `frontend/src/App.js` (route `/classes/:id/gradebook`)

**Interfaces:**
- Produces: `{ students: [{ id, name }], assignments: [{ id, title, points }], cells: [{ studentId, assignmentId, points, released, late, missing }] }` (staff only; TA sees draft values marked as drafts — the grid is a preparation tool); the tab renders it as an `.admin-table`-styled grid (students down, assignments across — the table scrolls inside its own wrapper, the page never scrolls horizontally), with `badge--warning late` dots and empty cells reading "—"; **Export CSV** builds the file client-side (D§11.5):

```js
const csv = [
  ["Student", ...assignments.map((a) => `${a.title} (/${a.points ?? "✓"})`)].map(quote).join(","),
  ...students.map((s) => [s.name, ...assignments.map((a) => cellFor(s, a))].map(quote).join(",")),
].join("\r\n");
const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
// …<a download={`${className} gradebook.csv`}> click — same pattern as the IDE's exports
```

(`quote` doubles inner quotes and wraps every field — teachers' names contain commas; the BOM keeps Excel happy.)

- [ ] Steps: backend test+route → frontend test+grid+CSV (assert the CSV string for a two-student fixture, quoting included) → tabs extension → green → commit

```bash
git add backend/src frontend/src
git commit -m "feat: the gradebook — one grid, one honest CSV, no server file infrastructure"
```

---

### Task 20: One History viewer — the student's restore, the teacher's timeline

**Files:**
- Create: `frontend/src/components/assignments/HistoryTimeline.js` + `HistoryPage.js` + `__tests__/historyTimeline.test.js`
- Modify: `backend/src/routes/assignments.ts` (+ `GET /api/assignments/:id/timeline/:studentId` — the first cross-user read, D§6), tests
- Modify: `frontend/src/components/Toolbar.js` (fileMenu gains "History & restore" for signed-in users — navigates to `/history/:projectId`; NOT gated by `exportAndCopy` — restoring your own work is not an export), `frontend/src/App.js` (route `/history/:projectId`), `frontend/src/components/assignments/MarkingRoom.js` (a Timeline panel using the same component)

**Interfaces:**
- Consumes: the shipped versions API (`GET /api/projects/:id/versions` → `{ versions: [{ versionId, clientUpdatedAt, reason, savedAt }] }`, `POST /api/projects/:id/versions/:versionId/restore` — `backend/src/routes/projects.ts:277-365`); `assignment_work` for the teacher path.
- Produces: `<HistoryTimeline entries={…} onRestore={fn|null} />` — one component, two feeders (the Plan 4 deferral's requirement): entries render as a vertical list of **checkpoints** (the product word for an entry; the screen is **History** — D§6 naming) with relative time, reason in plain words (`overwrite → "saved over"`, `conflict-loser → "kept from a sync conflict"`, `restore → "restored"`), and — teacher feed only — `savedBy` attribution and submission markers interleaved by time. Student page: `/history/:projectId` (signed-in; own projects; Restore buttons calling the restore route, then `engine.reconcile` so the local copy converges before returning to the IDE). Teacher feed: the new route — guarded `requireClassTeacher`-or-TA via the assignment's class, resolves the student's work row, returns the SAME version-list shape plus `submissions` markers; `logEvent("assignment.timeline_viewed")` — a cross-user read is an account action (D§6).

- [ ] **Step 1: Backend failing tests** (teacher reads a student timeline through the work link; a student cannot read another student's; the event lands), **Step 2: route**, **Step 3: component + student page + marking-room panel with tests** (restore wiring mocked; the two feeders render through one component — the test mounts both), **Step 4: Stage C gate** — all suites, typechecks, build, browser: mark, return, release, gradebook CSV opens in a spreadsheet, History shows checkpoints in both feeders. **Step 5: commit**

```bash
git add backend/src frontend/src
git commit -m "feat: History — one viewer for the student's restore and the teacher's timeline, checkpoints in plain words"
```

---
## Stage D — pairs and groups

**The one architectural note for this stage (read before Task 21):** group work does NOT ride the personal sync engine. The shared project row lives under the FOUNDING member's account (`projects` PK is `(ownerId, id)` and `ownerId` references a user — there is no group account), and every other member reaches it exclusively through **group endpoints** guarded by membership + the baton. The personal engine keeps ignoring projects it does not own; a member's local copy of the group project is a plain local manifest whose pushes and pulls flow through the group routes via the assignment context. Attribution comes free: `project_versions.savedBy` already exists (`schema.ts:139`), and the group PUT writes the acting member into it — spec §5.5's per-member checkpoint attribution, mechanised.

### Task 21: Groups and the baton — the backend

**Files:**
- Create: `backend/src/routes/groups.ts` + `backend/src/routes/groups.test.ts`
- Modify: `backend/src/app.ts` (register `groupRoutes`)
- Modify: `backend/src/routes/assignments.ts` (start-work branches for group mode; student GET gains `myGroup`)

**Interfaces:**
- Produces (all under `requireConfirmed` + active-class-membership checks; assignment must be `pair`/`group` mode):
  - `POST /api/assignments/:id/groups` `{ name? }` → create + join (auto-name "Group N"; pairs cap membership at 2, groups at 6 — route constant `GROUP_SIZE_CAP`, refusal sentence "That group is full.")
  - `POST /api/groups/:gid/join`, `POST /api/groups/:gid/leave` (refused once the group has a submission — "This group has already submitted."), `GET /api/assignments/:id/groups` (members visible to the class's members; spec §6.2 "pick or see their group")
  - Start-work for a group: the FIRST member to start supplies `{ projectId }` exactly like Task 10 (their push, their ownership) and the route stamps `groups.ownerId/projectId` + one `assignment_work` row keyed `groupId`; later members' start returns the existing row.
  - `GET /api/groups/:gid/project` (member): `{ manifest, clientUpdatedAt, savedBy }` — the server head; `PUT /api/groups/:gid/project` (member **holding the baton**): body `{ manifest }` — updates the head, archives the previous into `project_versions` with `savedBy` = the acting member (reason `"overwrite"`), bumps `clientUpdatedAt` from the manifest; refusal without the baton: 409 "Another member holds the baton."
  - `GET /api/groups/:gid/baton` → `{ holderId, holderName, expiresAt }`; `POST /api/groups/:gid/baton/take` → takes when free/expired/own, 409 when held (holder + expiry in the reply — the UI's "Take over" is this route on an EXPIRED lease; spec's read-only + Take over). Lease TTL: 90 seconds, renewed by re-calling take (idempotent for the holder).
- `logEvent` on create/join/leave/baton-take/group-save.

- [ ] Steps: failing tests for every refusal above (two members, baton dance, expired takeover, the FK path, `savedBy` attribution assertion) → implement → green → commit

```bash
git add backend/src
git commit -m "feat(backend): groups and the baton — a polled lease, member-guarded project access, attributed checkpoints"
```

---

### Task 22: Groups in the product — pick your group, hold the baton

**Files:**
- Modify: `frontend/src/components/assignments/AssignmentPage.js` (the group panel for pair/group assignments)
- Create: `frontend/src/utils/assignments/groupSync.js` + `__tests__/groupSync.test.js`
- Create: `frontend/src/components/layout/BatonChip.js` (+ test)
- Modify: `frontend/src/utils/storage/assignmentMeta.js` (meta gains `groupId`), `frontend/src/contexts/AssignmentContext.js` (exposes it), `frontend/src/components/layout/IDELayout.js` (read-only enforcement + chip mount)

**Interfaces:**
- Produces: the assignment page's group panel (create/join/leave, member list, refusals shown as `alert alert--danger`); `groupSync.js` — `pullGroupProject(groupId)` (fetch head → `saveProject(manifest, { preserveTimestamp: true })`) and `pushGroupProject(groupId, manifest)`; a save listener registered while assignment context carries a `groupId` AND the baton is held (the `projectStore.saveProject` listener contract — same hook SyncProvider uses); `<BatonChip />` in the status bar after `RulesChip`: holder → "Editing — baton yours"; not holder → "Read-only — <name> is editing" plus a **Take over** button that appears only when the lease is expired (`btn btn--sm`); polls `GET /baton` every 20 s while the assignment context has a group (cheap by design — the stack doc's polled lease).
- Read-only enforcement while not holding: `IDELayout` already has a read-only view mechanism (`isReadOnlyView` renders `ReadOnlyBlockly` / `CodeEditor readOnly` — the excerpted JSX at `IDELayout.js:543-696` branches on it). Thread `!batonHeld` into that same flag while a `groupId` context exists — one existing mechanism, no new editor states.

- [ ] Steps: failing tests (group panel wiring; groupSync push-only-when-holding; BatonChip's three states and its poll; the read-only threading via an IDELayout-level test if one exists — otherwise a focused component test on the flag plumbing) → implement → green → browser two-account check (two browsers, one class: member B sees read-only + holder's name; A's save arrives on B's next pull; expired lease takeover works) → commit

```bash
git add frontend/src
git commit -m "feat(frontend): group work — the baton in the status bar, read-only until taken, saves attributed"
```

---

### Task 23: Group submit and the group mark

**Files:**
- Modify: `backend/src/routes/assignments.ts` (submit branches for groups; release fans out per member), tests
- Modify: `frontend/src/components/assignments/BriefPane.js`, `MarkingRoom.js`, `InboxPage.js` (group rows), tests

**Interfaces:**
- Submit (any member, spec §5.5): snapshots the GROUP project head; `creditedIds` = every member; one receipt each; the inbox shows one row per group (members named), filters unchanged; the marking room marks the group once and the panel gains per-member adjustment (a small ± points field per member, default 0) — on release, one `marks` row per member (`points = groupPoints + adjustment`), each emailed.
- "Submitted for all of them": the student assignment page shows the group submission state for every member.

- [ ] Steps: backend failing tests (any-member submit; credited receipts; release fan-out with adjustments) → implement → frontend (brief-pane submit already pushes through groupSync when grouped — verify order: group push, then submit; adjustment UI; inbox group rows) → **Stage D gate**: all suites + the two-browser group pass → commit

```bash
git add backend/src frontend/src
git commit -m "feat: group submit credits everyone; one group mark, released per member with adjustments"
```

---

## Stage E — wrap

### Task 24: The daily tick — due-tomorrow email, and nothing else scheduled

**Files:**
- Create: `backend/src/routes/tick.ts` + `backend/src/routes/tick.test.ts`
- Modify: `backend/src/app.ts` (register), `backend/src/config.ts` (`tickSecret` — default `"dev-tick"` outside production, REQUIRED in production), `backend/src/server.ts` (dev-only hourly `setInterval` calling its own endpoint), `backend/src/email/templates.ts` (+ `dueTomorrow`)

**Interfaces:**
- `POST /api/tick` header `x-tick-secret` (403 otherwise): finds published assignments with `dueAt` between 23h and 25h from now; for each active student member without a current submission, sends `dueTomorrow` unless an `events` row `assignment.due_reminder_sent` already exists for that (assignmentId, userId) — the events table is the dedupe ledger, no new table; replies `{ sent: n }`. The design's one scheduler (D§6): Cloud Scheduler calls this in production; dev gets the interval.

- [ ] Steps: failing tests (window edges, dedupe on second tick, secret refusal) → implement → green → commit

```bash
git add backend/src
git commit -m "feat(backend): one daily tick — due-tomorrow reminders, deduped through the events ledger"
```

---

### Task 25: The honesty pass — every promise the product made comes true in copy

**Files:**
- Modify: `frontend/src/welcome/WelcomePage.js` + `frontend/src/welcome/__tests__/welcomePage.test.js` (**read both as they stand first** — a parallel welcome workstream has been reshaping this page; work from the tree, not from memory)
- Modify: `frontend/src/components/HelpPage.js` (stale "no backend, no accounts" deployment copy + the educators section)
- Modify: `docs/classroom-platform.md` §18 (forward-reference ledger), `docs/product-contract.md` (amendments for D§ decisions), `docs/e2e-checklist.md`

**Interfaces / obligations:**
- The welcome §12 "Not yet built" card: assignments, submissions, marking, feedback and the gradebook are now SHIPPED — per the research direction, convert the shipped line into a dated **"Shipped <date>"** entry (the page accrues verifiable history) and keep the panel for what remains true: the notification bell, real email delivery, peer sharing, admin data requests. The banned-words list in the test moves ONLY as far as the copy needs; the numbers ledger gains any new numeral with its derivation; the non-claims that remain (bell, real email, sharing, data requests) stay banned.
- HelpPage: the deployment/educators copy tells the truth about accounts, classes, assignments; its search-index strings follow.
- Docs: §18's item 6 records the portal golden-flow suite Task 26 ships; the product contract gains one amendment block citing `2026-08-25-classroom-platform-06-assignments-design.md` decisions (D§2 server link, D§4 chip placement, D§6 computed lifecycle + naming, D§7 image caps, D§11 fiats).

- [ ] Steps: read the current welcome page + tests → make the copy true (both directions: claim the shipped, keep banning the unshipped) → HelpPage → docs → full frontend suite green → commit

```bash
git add frontend/src docs
git commit -m "docs+copy: the product stops saying not-yet-built about assignments — shipped entries dated, remaining absences still named"
```

---

### Task 26: The golden flow end-to-end, and the plan's gate

**Files:**
- Create: `frontend/scripts/portal-e2e.mjs` (Puppeteer — the house harness idiom from `scripts/e2e-test.mjs`: BASE `http://localhost:3000`, `check()` results, screenshots into `frontend/e2e/`)
- Modify: `docs/e2e-checklist.md` (the portal section stops saying "zero coverage")

**The flow the script drives (one run, both themes where it matters):**
1. Teacher (seeded admin) signs in → creates a class → authors an assignment (title, one paragraph, points, standard rules) → publishes.
2. Student: sign up via API + confirm via the pretend inbox (`/api/admin/emails` exposes the confirmation link — the harness reads it the way a human reads the admin Emails tab) → join by class code → open the assignment → Start work → the IDE shows the brief pane and the rules chip → make an edit → Submit → fingerprint appears.
3. Teacher: inbox shows 1 of 1 → marking room renders the snapshot → save a mark → release → gradebook shows it.
4. Student: Home strip shows recent feedback; the assignment page shows the mark.
5. Assertions along the way: no `.welcome-btn` ghosts, no rule-less classes on the new screens (reuse the Task 13 sweep's stylesheet-harvest helper), zero console errors (the harness's audit idiom).

- [ ] **Step 1: Write the script** (target ~20 checks; every selector from the classes this plan shipped). **Step 2: Full gates from the repo root:**

```bash
npm run test -w shared && npm run test -w backend && npm run test -w frontend
npm run typecheck -w backend && npm run typecheck -w shared
npm run build -w frontend
npm run check:blocks
node frontend/scripts/e2e-test.mjs        # the IDE suite must not have noticed Plan 6
node frontend/scripts/portal-e2e.mjs      # the new golden flow
node frontend/scripts/ux-audit.mjs
```

- [ ] **Step 3: The human browser-pass checklist** — write `docs/superpowers/reviews/<date>-plan6-browser-pass-checklist.md` in the Plan 5 file's format: both themes; the teacher authoring path (editor, image cap refusal, rules picker, publish consequence line); the student path (brief pane at 1024px, rules chip wording, submit + late label); marking (stale-draft refusal, return-reopens, release emails in the pretend inbox); groups (two browsers, baton takeover); gradebook CSV in a real spreadsheet app; History restore round-trip.
- [ ] **Step 4: Final commit**

```bash
git add frontend docs
git commit -m "test+docs: Plan 6 wrap — the portal golden flow runs end to end, the gap ledger updated, the human checklist handed over"
```

---

## Self-review — seams found while writing this plan, recorded

1. **`stableStringify` lives inside `projects.ts`** and Task 14 needs it for fingerprints — the task says export it rather than re-implement; if it is already exported, the step is a no-op. Never write a second stringifier: two canonical forms = two fingerprints for one manifest.
2. **The student detail GET grows across three tasks** (rules in Task 10, `myMark` in Task 18, `myGroup` in Task 21). Each task's tests re-assert the whole student shape so a later addition cannot silently leak a staff field; the `privateNote` privacy test in Task 18 is the guard-rail.
3. **`portalControls.test.js` DIRS** gains `components/assignments` once (Task 5); every later task in that directory inherits the alias ban with no further wiring.
4. **The `templates` rule has no enforcement surface** inside the workspace today (Task 12's table says so). If a template-browsing surface is ever added to the workspace, the rule is already stored, shown in the chip, and waiting.
5. **Start work requires the network by design** (Task 10) — the page it starts from is server data. Offline continuation, not offline starting, is the local-first promise, and the cache delivers it (Task 11).
6. **Group mode changes who owns the push** (Stage D note): the brief pane's submit must push through `groupSync` when the context carries a `groupId` and through the personal engine otherwise. Task 23 verifies the order explicitly; get it wrong and the snapshot lags one save behind.
7. **Dates cross the wire as epoch-ms numbers** (Task 3's `toEpoch`) and cross into zod as epoch-ms (`epochMs`); `timestamptz` lives only inside Postgres. No task may compare a wire date to `new Date()` without `new Date(ms)` first — the assignment-page phase line derives from the server's `phase` field, never recomputes client-side.
8. **The welcome page is a moving target** (a parallel workstream reshapes it while this plan executes). Task 25 is written against "the tree as it stands", not against remembered line numbers, and it is the ONLY Plan 6 task allowed to touch `welcome/`.
9. **Citation drift:** excerpts in this plan were verified at `7f0520d`. The rule from the header stands: re-grep anchors, never trust a stale number.

---

**Execution note (subagent-driven):** stages are the review gates. Dispatch tasks in order within a stage; run the stage gate before opening the next; the two-browser group check in Stage D and the golden flow in Stage E are controller-visible checkpoints worth screenshots. Total: 26 tasks, 6 stages.
