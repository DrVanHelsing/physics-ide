# Classroom Platform — Plan 3: Classes & Rosters

> **Stale-instruction warning — added 25 August 2026 (Plan 5 wrap-up).** This plan is an executed historical record; its task bodies are unedited. A reader must NOT follow these instructions against today's tree:
> - *"Append to `frontend/src/styles.css`"* (line 2207) is wrong — that file is now a 17-line import manifest with load-bearing order. Shared primitives go in `primitives.css`, portal rules in `platform.css`, welcome rules in `welcome.css`.
> - *"No @testing-library — screens are verified by the controller's browser pass"* is superseded — `frontend/src/test/renderHelpers.js` is a dependency-free component-test harness and portal screens are component-tested.
> - *"No edits under `frontend/src/components` except the named ones"* is no longer a usable boundary — header controls are added through `utils/toolbar/visibleControls.js`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teachers create classes and students join them — by class code, join link, QR, or email invite — with co-teachers and TAs on the roster, approval/paused joining, archiving, the People and Settings tabs, and the admin classes list: the membership spine every later plan (assignments, submissions, marking) builds on.

**Architecture:** Three new tables (`classes`, `class_members`, `invites`) behind Plan 2's auth: every route sits inside a registered plugin under `requireUser` plus a new `requireConfirmed` gate (spec §3.1: unconfirmed accounts cannot join), with class-scoped authorisation resolved from `class_members` rows (`requireClassTeacher` / staff checks), never from the account's `isTeacher` flag alone. Class codes use a lookalike-free alphabet shared with the frontend for input normalisation. Invites reuse the Plan 2 token pattern (SHA-256 hash stored, raw token only in the email link) and the Mailer (spec §9 rows 4–5). The frontend adds a `/classes` area and join screens as sibling routes to the untouched IDE, following the AdminConsole's inline TanStack Query pattern and the existing CSS tokens.

**Tech Stack:** existing (Fastify 5, Drizzle, Postgres 16 :5433, Zod, React Router 7, TanStack Query 5, Vitest 4) · NEW: `qrcode@^1.5.4` (frontend — client-side QR rendering, spec §3.3.4)

**Spec:** [docs/classroom-platform.md](../../classroom-platform.md) §2 (people/TA), §3.3 (four ways in), §4 (classrooms), §9 (invite emails), §14 (screens), §15.5/§15.11 (assumptions) and [docs/classroom-platform-stack.md](../../classroom-platform-stack.md) §4 (tables: `classes`, `class_members`, `invites`).

## Global Constraints

- **Authorisation is membership-based.** Teacher-only class actions check a `class_members` row with `role='teacher'` for THAT class — the account-level `isTeacher` flag only gates class *creation*. Admin accounts get NO implicit class powers (spec §10: visibility, not management; the admin classes list is read-only).
- **Joining requires a confirmed email** (spec §3.1). `requireConfirmed` returns 403 `Confirm your email address first.` Class creation requires confirmed + (`isTeacher` or `role='admin'`), else 403 `Only teacher accounts can create classes.`
- **Class codes:** alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I, L, O, 0, 1 — spec: "letters and digits chosen so none look alike"), format `XXX-XXX` (spec example `KQ4-7PM`). Codes are unique; regeneration invalidates the old code immediately.
- **Invite tokens:** 256-bit random, SHA-256 hash stored only (Plan 2's `newToken()`/`hashToken()`), raw token only in the emailed link. Invites do not expire (pending until accepted or revoked — spec has no invite TTL). **Token possession suffices to accept** — an invitee may sign up with a different address than the one invited (spec §3.3.1 walks them through signup; the plan records who accepted).
- **Invited members bypass approval mode** (the teacher asked for them) and land `active`. Code/link/QR joiners respect `joinMode`: `open` → active, `approval` → `waiting` until the teacher approves, `paused` → refused with `Joining this class is paused.`
- **A class must always keep at least one teacher** — removal that would strip the last teacher is refused: `A class must keep at least one teacher.`
- **Archived classes** are read-only shells: joining refused (`That class is archived.`), settings/roster mutations refused except unarchive; they render on a collapsed shelf (spec §4).
- **Audit:** every mutation writes an `events` row in the same transaction where one exists: `class.created`, `class.updated`, `class.code_regenerated`, `class.archived`, `class.unarchived`, `class.joined`, `class.join_requested`, `class.join_approved`, `class.join_denied`, `member.removed`, `invite.sent`, `invite.revoked`, `invite.accepted`.
- **Email only via the Mailer** (dev driver → pretend inbox). New templates carry spec §9's subjects: `You're invited to [class] — Physics IDE` (students and co-teachers) and `You're invited to assist [class] — Physics IDE` (TAs).
- **Error contract:** failures return `{ "error": "<human sentence>" }` with a fitting status; sentences quoted in this plan are verbatim.
- **The IDE core is untouched.** Frontend changes are new files under `src/components/classes/`, new routes in App.js, one link added to AccountChip, one CSS append, and the admin console gaining a Classes tab. Guest behaviour at `/` identical.
- **Frontend stays JavaScript; frontend test coverage stays at the pure-module level** (Plan 2 ruling — no @testing-library; screens are verified by the controller's browser pass). Shared/backend TypeScript strict, NodeNext `.js` import extensions.
- **No new dependencies beyond `qrcode`** (frontend). Banned (stack §7): Redis, queues, websockets, NestJS, Prisma, GraphQL.
- Ports 3000/4000/5433; Node floor `>=20.19.2`; Windows 11 + PowerShell; every task ends in a commit on `feature/classroom-platform`; backend test files use `testClient.ts` helpers and `fileParallelism: false` stands.

**Deferred to later plans (spec'd, deliberately NOT here — do not flag as missing):** assignments/guides and every class tab beyond People/Settings (Assignments and Gradebook render as labelled stubs); sharing controls (spec §8.3 — Settings shows joining rules only for now); removing-a-student-keeps-their-work mechanics (no work tables yet); cloud project sync and guest-project import; per-class notification emails beyond the two invite templates; admin data requests.

---

### Task 1: Shared class contracts

**Files:**
- Create: `shared/src/classes.ts`
- Create: `shared/src/classes.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Consumes: `CLASS_ROLES`, `ClassRole` from `shared/src/roles.ts` (Plan 1).
- Produces (exact names): `CLASS_CODE_ALPHABET`, `CLASS_CODE_REGEX`, `normalizeClassCode`, `JOIN_MODES`, `JoinMode`, `MEMBER_STATUSES`, `CreateClassInputSchema`, `UpdateClassSettingsInputSchema`, `JoinByCodeInputSchema`, `InviteInputSchema`, `AcceptInviteInputSchema`.

- [ ] **Step 1: Write the failing test**

Create `shared/src/classes.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import {
  CLASS_CODE_ALPHABET,
  CLASS_CODE_REGEX,
  normalizeClassCode,
  JOIN_MODES,
  CreateClassInputSchema,
  UpdateClassSettingsInputSchema,
  JoinByCodeInputSchema,
  InviteInputSchema,
} from "./classes.js";

describe("class codes", () => {
  test("alphabet has no lookalike characters", () => {
    for (const bad of ["I", "L", "O", "0", "1"]) {
      expect(CLASS_CODE_ALPHABET).not.toContain(bad);
    }
    expect(CLASS_CODE_ALPHABET).toHaveLength(31);
  });

  test("normalizeClassCode uppercases, strips spaces, inserts the dash", () => {
    expect(normalizeClassCode(" kq4 7pm ")).toBe("KQ4-7PM");
    expect(normalizeClassCode("kq4-7pm")).toBe("KQ4-7PM");
    expect(normalizeClassCode("KQ47PM")).toBe("KQ4-7PM");
  });

  test("regex accepts a normalized code and rejects malformed ones", () => {
    expect(CLASS_CODE_REGEX.test("KQ4-7PM")).toBe(true);
    expect(CLASS_CODE_REGEX.test("KQ4-7P")).toBe(false);
    expect(CLASS_CODE_REGEX.test("KO4-7PM")).toBe(false); // O is not in the alphabet
  });

  test("JoinByCodeInputSchema normalizes then validates", () => {
    expect(JoinByCodeInputSchema.parse({ code: "kq4 7pm" }).code).toBe("KQ4-7PM");
    expect(JoinByCodeInputSchema.safeParse({ code: "nope" }).success).toBe(false);
  });
});

describe("class schemas", () => {
  test("create requires a 1-100 char name; subject label optional", () => {
    expect(CreateClassInputSchema.parse({ name: " Grade 11 " }).name).toBe("Grade 11");
    expect(CreateClassInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(
      CreateClassInputSchema.parse({ name: "A", subjectLabel: "Physical Sciences" }).subjectLabel,
    ).toBe("Physical Sciences");
  });

  test("settings update accepts partial fields and only known join modes", () => {
    expect(UpdateClassSettingsInputSchema.parse({ joinMode: "approval" }).joinMode).toBe("approval");
    expect(UpdateClassSettingsInputSchema.safeParse({ joinMode: "locked" }).success).toBe(false);
    expect(UpdateClassSettingsInputSchema.parse({}).name).toBeUndefined();
  });

  test("invites: 1-50 emails, role must be a class role", () => {
    const ok = InviteInputSchema.parse({ emails: [" A@b.co "], role: "student" });
    expect(ok.emails).toEqual(["a@b.co"]);
    expect(InviteInputSchema.safeParse({ emails: [], role: "student" }).success).toBe(false);
    expect(InviteInputSchema.safeParse({ emails: ["a@b.co"], role: "admin" }).success).toBe(false);
    expect(JOIN_MODES).toEqual(["open", "approval", "paused"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm run test -w shared
```

Expected: FAIL — cannot resolve `./classes.js`.

- [ ] **Step 3: Implement**

Create `shared/src/classes.ts`:

```ts
import { z } from "zod";
import { CLASS_ROLES } from "./roles.js";

/** Spec §3.3.2 — letters and digits chosen so none look alike (no I, L, O, 0, 1). */
export const CLASS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const CLASS_CODE_REGEX = new RegExp(
  `^[${CLASS_CODE_ALPHABET}]{3}-[${CLASS_CODE_ALPHABET}]{3}$`,
);

/** Uppercase, strip spaces/dashes, re-insert the canonical dash. */
export function normalizeClassCode(raw: string): string {
  const bare = raw.toUpperCase().replace(/[\s-]/g, "");
  return bare.length === 6 ? `${bare.slice(0, 3)}-${bare.slice(3)}` : bare;
}

export const JOIN_MODES = ["open", "approval", "paused"] as const;
export type JoinMode = (typeof JOIN_MODES)[number];

export const MEMBER_STATUSES = ["active", "waiting"] as const;

const email = z.string().trim().toLowerCase().email().max(254);
const token = z.string().min(20).max(200);

export const CreateClassInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  subjectLabel: z.string().trim().min(1).max(60).optional(),
});

export const UpdateClassSettingsInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  subjectLabel: z.string().trim().max(60).nullable().optional(),
  joinMode: z.enum(JOIN_MODES).optional(),
});

export const JoinByCodeInputSchema = z.object({
  code: z
    .string()
    .transform(normalizeClassCode)
    .refine((c) => CLASS_CODE_REGEX.test(c), { message: "That code doesn't look right." }),
});

export const InviteInputSchema = z.object({
  emails: z.array(email).min(1).max(50),
  role: z.enum(CLASS_ROLES),
});

export const AcceptInviteInputSchema = z.object({ token });
```

Modify `shared/src/index.ts` to add:

```ts
export * from "./classes.js";
```

(final content: the four export lines for roles, workspaceRules, auth, classes.)

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w shared
npm run typecheck -w shared
```

Expected: all shared tests pass (12 existing + 7 new), typecheck silent.

- [ ] **Step 5: Commit**

```powershell
git add shared/src/classes.ts shared/src/classes.test.ts shared/src/index.ts
git commit -m "feat(shared): class code alphabet/normalizer, join modes, class and invite schemas"
```

---

### Task 2: Database — classes, class_members, invites

**Files:**
- Modify: `backend/src/db/schema.ts`, `backend/src/db/testClient.ts`
- Create: `backend/src/db/schema.classes.test.ts`
- Generated: `backend/drizzle/0002_*.sql` + meta (via drizzle-kit)

**Interfaces:**
- Produces: tables `classes`, `classMembers`, `invites` from `./db/schema.js`; `truncateAuthTables()` now also wipes the three new tables.
- Column contract: `classes.joinCode` unique; `classMembers` unique on (classId, userId); `invites.tokenHash` unique; cascades from members/invites to their class and user.

- [ ] **Step 1: Extend the schema**

Append to `backend/src/db/schema.ts` (keep everything existing; `unique` needs adding to the drizzle-orm/pg-core import):

```ts
/** Classrooms (spec §4). joinMode: "open" | "approval" | "paused". */
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subjectLabel: text("subject_label"),
  joinCode: text("join_code").notNull().unique(),
  joinMode: text("join_mode").notNull().default("open"),
  archived: boolean("archived").notNull().default(false),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Who is in a class, wearing which hat (spec §2). status: "active" | "waiting". */
export const classMembers = pgTable(
  "class_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("class_members_class_user_uq").on(t.classId, t.userId)],
);

/** Pending email invites (spec §3.3.1). status: "pending" | "accepted" | "revoked". */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status").notNull().default("pending"),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  acceptedBy: uuid("accepted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Update `truncateAuthTables()` in `backend/src/db/testClient.ts` to:

```ts
export async function truncateAuthTables(): Promise<void> {
  await testPool.query(
    'TRUNCATE TABLE "invites", "class_members", "classes", "sessions", "email_tokens", "emails", "events", "users" CASCADE',
  );
}
```

- [ ] **Step 2: Generate and apply the migration to BOTH databases**

```powershell
npm run db:generate -w backend
npm run db:migrate -w backend
npm run db:migrate:test -w backend
```

Expected: one new `backend/drizzle/0002_*.sql` creating the three tables; both migrates exit 0.

- [ ] **Step 3: Round-trip test**

Create `backend/src/db/schema.classes.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { testDb, testPool, truncateAuthTables } from "./testClient.js";
import { users, classes, classMembers } from "./schema.js";

let teacherId: string;
let classId: string;

beforeAll(async () => {
  await truncateAuthTables();
  const [t] = await testDb
    .insert(users)
    .values({ name: "T", email: "t@example.com", passwordHash: "x", consentAt: new Date() })
    .returning();
  teacherId = t.id;
});

afterAll(async () => {
  await testPool.end();
});

describe("classes schema", () => {
  test("inserts a class with defaults", async () => {
    const [c] = await testDb
      .insert(classes)
      .values({ name: "Gr 11", joinCode: "AAA-AAA", createdBy: teacherId })
      .returning();
    classId = c.id;
    expect(c.joinMode).toBe("open");
    expect(c.archived).toBe(false);
    expect(c.subjectLabel).toBeNull();
  });

  test("join codes are unique", async () => {
    await expect(
      testDb.insert(classes).values({ name: "Dup", joinCode: "AAA-AAA", createdBy: teacherId }),
    ).rejects.toSatisfy(
      (e: { code?: string; cause?: { code?: string } }) =>
        e.code === "23505" || e.cause?.code === "23505",
    );
  });

  test("one membership row per (class, user); delete class cascades members", async () => {
    await testDb.insert(classMembers).values({ classId, userId: teacherId, role: "teacher" });
    await expect(
      testDb.insert(classMembers).values({ classId, userId: teacherId, role: "student" }),
    ).rejects.toSatisfy(
      (e: { code?: string; cause?: { code?: string } }) =>
        e.code === "23505" || e.cause?.code === "23505",
    );
    await testDb.delete(classes).where(eq(classes.id, classId));
    const left = await testDb.select().from(classMembers).where(eq(classMembers.classId, classId));
    expect(left).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: all pass (44 existing + 3 new), typecheck silent.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/db backend/drizzle
git commit -m "feat(backend): classes, class_members, invites tables (migration 0002)"
```

---

### Task 3: Class codes, class guards, and the classes routes

**Files:**
- Create: `backend/src/classes/codes.ts`, `backend/src/classes/guards.ts`, `backend/src/routes/classes.ts`, `backend/src/routes/classes.test.ts`
- Modify: `backend/src/app.ts` (register), `backend/src/auth/guards.ts` (add `requireConfirmed`)

**Interfaces:**
- Consumes: Tasks 1–2, Plan 2's guards/events/testClient.
- Produces: `generateClassCode(db)`; `requireConfirmed` (auth guard); `getMembership(db, classId, userId)`, `requireClassTeacher(db, classId, userId)` returning the membership row or throwing `ClassAuthError(status, message)`; routes `POST /api/classes`, `GET /api/classes`, `GET /api/classes/:id`, `PATCH /api/classes/:id`, `POST /api/classes/:id/regenerate-code`, `POST /api/classes/:id/archive`, `POST /api/classes/:id/unarchive`. All later class routes follow this file's authorisation shape.

- [ ] **Step 1: Guards and code generator**

Add to `backend/src/auth/guards.ts` (after `requireAdmin`):

```ts
/** Spec §3.1 — unconfirmed accounts can look around but not join or create classes. */
export async function requireConfirmed(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (!req.user!.emailConfirmedAt) {
    await reply.code(403).send({ error: "Confirm your email address first." });
  }
}
```

Create `backend/src/classes/codes.ts`:

```ts
import { randomInt } from "node:crypto";
import { CLASS_CODE_ALPHABET } from "@physics-ide/shared";
import type { Db } from "../db/types.js";
import { classes } from "../db/schema.js";
import { eq } from "drizzle-orm";

function randomCode(): string {
  const pick = () => CLASS_CODE_ALPHABET[randomInt(CLASS_CODE_ALPHABET.length)];
  return `${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}`;
}

/** Random code, retried on the (astronomically unlikely) collision. */
export async function generateClassCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const clash = await db.select({ id: classes.id }).from(classes).where(eq(classes.joinCode, code));
    if (clash.length === 0) return code;
  }
  throw new Error("Could not generate a unique class code after 5 attempts.");
}
```

Create `backend/src/classes/guards.ts`:

```ts
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/types.js";
import { classMembers } from "../db/schema.js";

export class ClassAuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Route helper: replies and returns true when err is a ClassAuthError. */
export async function sendClassAuthError(
  reply: { code: (s: number) => { send: (b: object) => Promise<unknown> } },
  err: unknown,
): Promise<boolean> {
  if (err instanceof ClassAuthError) {
    await reply.code(err.status).send({ error: err.message });
    return true;
  }
  return false;
}

export async function getMembership(
  db: Db,
  classId: string,
  userId: string,
): Promise<typeof classMembers.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(classMembers)
    .where(and(eq(classMembers.classId, classId), eq(classMembers.userId, userId)));
  return rows[0];
}

/** Active teacher membership in THIS class — the isTeacher account flag is not enough. */
export async function requireClassTeacher(
  db: Db,
  classId: string,
  userId: string,
): Promise<typeof classMembers.$inferSelect> {
  const m = await getMembership(db, classId, userId);
  if (!m || m.status !== "active" || m.role !== "teacher") {
    throw new ClassAuthError(403, "Teachers only for this class.");
  }
  return m;
}
```

- [ ] **Step 2: Write the failing route tests**

Create `backend/src/routes/classes.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classes, classMembers, events } from "../db/schema.js";
import { CLASS_CODE_REGEX } from "@physics-ide/shared";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let studentCookie: string;
let unconfirmedCookie: string;
let classId: string;

async function makeUser(email: string, opts: Record<string, unknown> = {}) {
  const [u] = await testDb
    .insert(users)
    .values({
      name: email.split("@")[0],
      email,
      passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
      ...opts,
    })
    .returning();
  return u;
}

async function signin(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("teach@example.com", { isTeacher: true });
  await makeUser("kid@example.com");
  await makeUser("newbie@example.com", { emailConfirmedAt: null });
  teacherCookie = await signin("teach@example.com");
  studentCookie = await signin("kid@example.com");
  unconfirmedCookie = await signin("newbie@example.com");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/classes", () => {
  test("teacher creates a class: code minted, creator is an active teacher member, event logged", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
      payload: { name: "Grade 11 Physical Sciences", subjectLabel: "2027" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    classId = body.class.id;
    expect(CLASS_CODE_REGEX.test(body.class.joinCode)).toBe(true);
    expect(body.class.joinMode).toBe("open");

    const members = await testDb.select().from(classMembers).where(eq(classMembers.classId, classId));
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("teacher");
    expect(members[0].status).toBe("active");

    const evts = await testDb.select().from(events).where(eq(events.type, "class.created"));
    expect(evts.length).toBeGreaterThanOrEqual(1);
  });

  test("a non-teacher account is refused", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: studentCookie },
      payload: { name: "Nope" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Only teacher accounts can create classes.");
  });

  test("an unconfirmed account is refused first", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: unconfirmedCookie },
      payload: { name: "Nope" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Confirm your email address first.");
  });
});

describe("GET /api/classes and /api/classes/:id", () => {
  test("lists my classes with my role; teacher detail includes the join code", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/classes",
      cookies: { pide_session: teacherCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().classes).toHaveLength(1);
    expect(list.json().classes[0].myRole).toBe("teacher");

    const detail = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().class.joinCode).toBeDefined();
  });

  test("a non-member gets 404 (no existence oracle) and no join code leaks to students", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: studentCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such class.");
  });
});

describe("settings, code regeneration, archive", () => {
  test("teacher updates settings; students cannot", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval", name: "Renamed" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().class.joinMode).toBe("approval");
    expect(res.json().class.name).toBe("Renamed");

    const deny = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: studentCookie },
      payload: { name: "Hax" },
    });
    expect(deny.statusCode).toBe(403);
  });

  test("regenerating the code changes it", async () => {
    const [before] = await testDb.select().from(classes).where(eq(classes.id, classId));
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/regenerate-code`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().joinCode).not.toBe(before.joinCode);
    expect(CLASS_CODE_REGEX.test(res.json().joinCode)).toBe(true);
  });

  test("archive blocks settings changes until unarchive", async () => {
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const blocked = await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { name: "While archived" },
    });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error).toBe("That class is archived.");

    const un = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/unarchive`,
      cookies: { pide_session: teacherCookie },
    });
    expect(un.statusCode).toBe(200);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — `../routes/classes.js` missing / routes 404.

- [ ] **Step 4: Implement the routes**

Create `backend/src/routes/classes.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  CreateClassInputSchema,
  UpdateClassSettingsInputSchema,
} from "@physics-ide/shared";
import { classes, classMembers } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { generateClassCode } from "../classes/codes.js";
import {
  getMembership,
  requireClassTeacher,
  sendClassAuthError,
} from "../classes/guards.js";
import { logEvent } from "../db/events.js";

type ClassRow = typeof classes.$inferSelect;

function toClassSummary(row: ClassRow, myRole: string | null, includeCode: boolean) {
  return {
    id: row.id,
    name: row.name,
    subjectLabel: row.subjectLabel,
    joinMode: row.joinMode,
    archived: row.archived,
    myRole,
    ...(includeCode ? { joinCode: row.joinCode } : {}),
  };
}

export function classRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/classes", async (req, reply) => {
    if (!(req.user!.isTeacher || req.user!.role === "admin")) {
      return reply.code(403).send({ error: "Only teacher accounts can create classes." });
    }
    const parsed = CreateClassInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const joinCode = await generateClassCode(app.db);
    const created = await app.db.transaction(async (tx) => {
      const [c] = await tx
        .insert(classes)
        .values({
          name: parsed.data.name,
          subjectLabel: parsed.data.subjectLabel ?? null,
          joinCode,
          createdBy: req.user!.id,
        })
        .returning();
      await tx.insert(classMembers).values({ classId: c.id, userId: req.user!.id, role: "teacher" });
      await logEvent(tx, "class.created", req.user!.id, { classId: c.id, name: c.name });
      return c;
    });
    return reply.code(201).send({ class: toClassSummary(created, "teacher", true) });
  });

  app.get("/api/classes", async (req) => {
    const memberships = await app.db
      .select()
      .from(classMembers)
      .where(eq(classMembers.userId, req.user!.id));
    if (memberships.length === 0) return { classes: [] };
    const rows = await app.db
      .select()
      .from(classes)
      .where(inArray(classes.id, memberships.map((m) => m.classId)));
    const byId = new Map(memberships.map((m) => [m.classId, m]));
    return {
      classes: rows.map((c) => {
        const m = byId.get(c.id)!;
        return {
          ...toClassSummary(c, m.role, m.role === "teacher"),
          myStatus: m.status,
        };
      }),
    };
  });

  app.get("/api/classes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const m = await getMembership(app.db, id, req.user!.id);
    if (!m) return reply.code(404).send({ error: "No such class." });
    const [c] = await app.db.select().from(classes).where(eq(classes.id, id));
    if (!c) return reply.code(404).send({ error: "No such class." });
    const [{ count }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(classMembers)
      .where(and(eq(classMembers.classId, id), eq(classMembers.status, "active")));
    return {
      class: {
        ...toClassSummary(c, m.role, m.role === "teacher"),
        myStatus: m.status,
        activeMembers: count,
      },
    };
  });

  app.patch("/api/classes/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, id));
    if (!c) return reply.code(404).send({ error: "No such class." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    const parsed = UpdateClassSettingsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const patch: Partial<typeof classes.$inferInsert> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.subjectLabel !== undefined) patch.subjectLabel = parsed.data.subjectLabel;
    if (parsed.data.joinMode !== undefined) patch.joinMode = parsed.data.joinMode;
    const updated = await app.db.transaction(async (tx) => {
      const [row] = await tx.update(classes).set(patch).where(eq(classes.id, id)).returning();
      await logEvent(tx, "class.updated", req.user!.id, { classId: id, patch });
      return row;
    });
    return { class: toClassSummary(updated, "teacher", true) };
  });

  app.post("/api/classes/:id/regenerate-code", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, id));
    if (!c) return reply.code(404).send({ error: "No such class." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    const joinCode = await generateClassCode(app.db);
    await app.db.transaction(async (tx) => {
      await tx.update(classes).set({ joinCode }).where(eq(classes.id, id));
      await logEvent(tx, "class.code_regenerated", req.user!.id, { classId: id });
    });
    return { joinCode };
  });

  for (const action of ["archive", "unarchive"] as const) {
    app.post(`/api/classes/:id/${action}`, async (req, reply) => {
      const { id } = req.params as { id: string };
      try {
        await requireClassTeacher(app.db, id, req.user!.id);
      } catch (err) {
        if (await sendClassAuthError(reply, err)) return;
        throw err;
      }
      const archived = action === "archive";
      await app.db.transaction(async (tx) => {
        await tx.update(classes).set({ archived }).where(eq(classes.id, id));
        await logEvent(tx, archived ? "class.archived" : "class.unarchived", req.user!.id, {
          classId: id,
        });
      });
      return { ok: true, archived };
    });
  }
}
```

Register in `backend/src/app.ts`: import `classRoutes` from `./routes/classes.js` and add `app.register(classRoutes);` after `app.register(adminRoutes);`. (Its scoped `requireConfirmed` hook stays inside the plugin, exactly like adminRoutes' hook — root routes untouched.)

- [ ] **Step 5: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: green (existing + 8 new), silent.

- [ ] **Step 6: Commit**

```powershell
git add backend/src
git commit -m "feat(backend): class creation/settings/codes/archive with membership-based authorisation"
```

---

### Task 4: Joining — code entry, approval queue, member removal

**Files:**
- Create: `backend/src/routes/members.ts`, `backend/src/routes/members.test.ts`
- Modify: `backend/src/app.ts` (register)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `POST /api/classes/join` (by code); `GET /api/classes/:id/members`; `POST /api/classes/:id/members/:userId/approve`; `POST /api/classes/:id/members/:userId/deny`; `DELETE /api/classes/:id/members/:userId`. Task 5 reuses the membership-insert shape for invite acceptance.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/routes/members.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classes, classMembers } from "../db/schema.js";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let kidCookie: string;
let kid2Cookie: string;
let kidId: string;
let kid2Id: string;
let teacherId: string;
let openClass: { id: string; joinCode: string };

async function makeUser(email: string, opts: Record<string, unknown> = {}) {
  const [u] = await testDb
    .insert(users)
    .values({
      name: email.split("@")[0],
      email,
      passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
      ...opts,
    })
    .returning();
  return u;
}

async function signin(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

async function createClass(cookie: string, name: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: cookie },
    payload: { name },
  });
  return res.json().class as { id: string; joinCode: string };
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  const t = await makeUser("mteach@example.com", { isTeacher: true });
  teacherId = t.id;
  const k = await makeUser("mkid@example.com");
  kidId = k.id;
  const k2 = await makeUser("mkid2@example.com");
  kid2Id = k2.id;
  teacherCookie = await signin("mteach@example.com");
  kidCookie = await signin("mkid@example.com");
  kid2Cookie = await signin("mkid2@example.com");
  openClass = await createClass(teacherCookie, "Open Class");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("POST /api/classes/join", () => {
  test("open class: joins active, sloppy code input accepted", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kidCookie },
      payload: { code: ` ${openClass.joinCode.toLowerCase().replace("-", " ")} ` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, status: "active", classId: openClass.id });
  });

  test("joining again is refused politely", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kidCookie },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("You're already in this class.");
  });

  test("unknown code → one generic message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kid2Cookie },
      payload: { code: "ZZZ-ZZZ" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No class has that code.");
  });

  test("approval mode → waiting; teacher approves → active", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kid2Cookie },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("waiting");

    const approve = await app.inject({
      method: "POST",
      url: `/api/classes/${openClass.id}/members/${kid2Id}/approve`,
      cookies: { pide_session: teacherCookie },
    });
    expect(approve.statusCode).toBe(200);
    const [row] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.userId, kid2Id)));
    expect(row.status).toBe("active");
  });

  test("paused mode refuses joiners", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "paused" },
    });
    const extra = await makeUser("mkid3@example.com");
    const cookie3 = await signin("mkid3@example.com");
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: cookie3 },
      payload: { code: openClass.joinCode },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Joining this class is paused.");
    void extra;
  });

  test("archived class refuses joiners with its own message", async () => {
    const second = await createClass(teacherCookie, "To Archive");
    await app.inject({
      method: "POST",
      url: `/api/classes/${second.id}/archive`,
      cookies: { pide_session: teacherCookie },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: kid2Cookie },
      payload: { code: second.joinCode },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That class is archived.");
  });
});

describe("roster", () => {
  test("teacher sees members; students may not read the roster", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${openClass.id}/members`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const roster = res.json().members as Array<{ email: string; role: string; status: string }>;
    expect(roster.length).toBeGreaterThanOrEqual(3);
    expect(roster.some((m) => m.role === "teacher")).toBe(true);

    const deny = await app.inject({
      method: "GET",
      url: `/api/classes/${openClass.id}/members`,
      cookies: { pide_session: kidCookie },
    });
    expect(deny.statusCode).toBe(403);
  });

  test("deny removes a waiting member entirely", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${openClass.id}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval" },
    });
    await app.inject({
      method: "POST",
      url: "/api/classes/join",
      cookies: { pide_session: (await signin("mkid3@example.com")) },
      payload: { code: openClass.joinCode },
    });
    const [waiting] = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.status, "waiting")));
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${openClass.id}/members/${waiting.userId}/deny`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const left = await testDb
      .select()
      .from(classMembers)
      .where(and(eq(classMembers.classId, openClass.id), eq(classMembers.userId, waiting.userId)));
    expect(left).toHaveLength(0);
  });

  test("removing a student works; removing the last teacher is refused", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/classes/${openClass.id}/members/${kidId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);

    const last = await app.inject({
      method: "DELETE",
      url: `/api/classes/${openClass.id}/members/${teacherId}`,
      cookies: { pide_session: teacherCookie },
    });
    expect(last.statusCode).toBe(400);
    expect(last.json().error).toBe("A class must keep at least one teacher.");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — join/members routes 404.

- [ ] **Step 3: Implement**

Create `backend/src/routes/members.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { JoinByCodeInputSchema } from "@physics-ide/shared";
import { classes, classMembers, users } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { getMembership, requireClassTeacher, sendClassAuthError } from "../classes/guards.js";
import { logEvent } from "../db/events.js";

export function memberRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/classes/join", async (req, reply) => {
    const parsed = JoinByCodeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "That code doesn't look right." });
    }
    const rows = await app.db.select().from(classes).where(eq(classes.joinCode, parsed.data.code));
    const c = rows[0];
    if (!c) return reply.code(404).send({ error: "No class has that code." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    if (c.joinMode === "paused") {
      return reply.code(403).send({ error: "Joining this class is paused." });
    }
    const existing = await getMembership(app.db, c.id, req.user!.id);
    if (existing) return reply.code(409).send({ error: "You're already in this class." });

    const status = c.joinMode === "approval" ? "waiting" : "active";
    await app.db.transaction(async (tx) => {
      await tx.insert(classMembers).values({
        classId: c.id,
        userId: req.user!.id,
        role: "student",
        status,
      });
      await logEvent(
        tx,
        status === "active" ? "class.joined" : "class.join_requested",
        req.user!.id,
        { classId: c.id },
      );
    });
    return { ok: true, classId: c.id, className: c.name, status };
  });

  app.get("/api/classes/:id/members", async (req, reply) => {
    const { id } = req.params as { id: string };
    const me = await getMembership(app.db, id, req.user!.id);
    if (!me || me.status !== "active" || me.role === "student") {
      return reply.code(403).send({ error: "Teachers and assistants only." });
    }
    const rows = await app.db
      .select({ member: classMembers, user: users })
      .from(classMembers)
      .innerJoin(users, eq(classMembers.userId, users.id))
      .where(eq(classMembers.classId, id));
    return {
      members: rows.map((r) => ({
        userId: r.user.id,
        name: r.user.name,
        email: r.user.email,
        role: r.member.role,
        status: r.member.status,
        joinedAt: r.member.createdAt.toISOString(),
      })),
    };
  });

  for (const action of ["approve", "deny"] as const) {
    app.post(`/api/classes/:id/members/:userId/${action}`, async (req, reply) => {
      const { id, userId } = req.params as { id: string; userId: string };
      try {
        await requireClassTeacher(app.db, id, req.user!.id);
      } catch (err) {
        if (await sendClassAuthError(reply, err)) return;
        throw err;
      }
      const target = await getMembership(app.db, id, userId);
      if (!target || target.status !== "waiting") {
        return reply.code(404).send({ error: "No waiting member to act on." });
      }
      await app.db.transaction(async (tx) => {
        if (action === "approve") {
          await tx
            .update(classMembers)
            .set({ status: "active" })
            .where(and(eq(classMembers.classId, id), eq(classMembers.userId, userId)));
        } else {
          await tx
            .delete(classMembers)
            .where(and(eq(classMembers.classId, id), eq(classMembers.userId, userId)));
        }
        await logEvent(
          tx,
          action === "approve" ? "class.join_approved" : "class.join_denied",
          req.user!.id,
          { classId: id, subject: userId },
        );
      });
      return { ok: true };
    });
  }

  app.delete("/api/classes/:id/members/:userId", async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const target = await getMembership(app.db, id, userId);
    if (!target) return reply.code(404).send({ error: "Not a member of this class." });
    if (target.role === "teacher") {
      const teachers = await app.db
        .select()
        .from(classMembers)
        .where(
          and(
            eq(classMembers.classId, id),
            eq(classMembers.role, "teacher"),
            eq(classMembers.status, "active"),
          ),
        );
      if (teachers.length <= 1) {
        return reply.code(400).send({ error: "A class must keep at least one teacher." });
      }
    }
    await app.db.transaction(async (tx) => {
      await tx
        .delete(classMembers)
        .where(and(eq(classMembers.classId, id), eq(classMembers.userId, userId)));
      await logEvent(tx, "member.removed", req.user!.id, { classId: id, subject: userId });
    });
    return { ok: true };
  });
}
```

Register in `backend/src/app.ts`: import `memberRoutes` from `./routes/members.js`, add `app.register(memberRoutes);` after `classRoutes`.

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: green, silent.

- [ ] **Step 5: Commit**

```powershell
git add backend/src
git commit -m "feat(backend): join-by-code with approval/paused/archived handling, roster, approve/deny/remove"
```

---

### Task 5: Email invites — send, revoke, accept

**Files:**
- Create: `backend/src/routes/invites.ts`, `backend/src/routes/invites.test.ts`
- Modify: `backend/src/email/templates.ts` (add `classInvite`), `backend/src/app.ts` (register)

**Interfaces:**
- Consumes: Tasks 1–4, Plan 2's `newToken`/`hashToken`/Mailer.
- Produces: `POST /api/classes/:id/invites` (batch), `GET /api/classes/:id/invites`, `POST /api/invites/:id/revoke`, `POST /api/invites/:id/resend` (rotates the token — the old link dies), `POST /api/invites/accept`; template `classInvite({className, inviterName, joinUrl, role})`.

- [ ] **Step 1: Template**

Add to `backend/src/email/templates.ts`:

```ts
export function classInvite(p: {
  className: string;
  inviterName: string;
  joinUrl: string;
  role: "student" | "ta" | "teacher";
}) {
  const subject =
    p.role === "ta"
      ? `You're invited to assist ${p.className} — Physics IDE`
      : `You're invited to ${p.className} — Physics IDE`;
  const roleLine =
    p.role === "student"
      ? `${p.inviterName} has invited you to join their class.`
      : p.role === "ta"
        ? `${p.inviterName} has invited you to be a teaching assistant.`
        : `${p.inviterName} has invited you to co-teach their class.`;
  return {
    subject,
    text: `Hi,

${roleLine}

Class: ${p.className}

Join here: ${p.joinUrl}

If you don't have an account yet, the link will walk you through signing up first.`,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `backend/src/routes/invites.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, classMembers, invites, emails } from "../db/schema.js";

const app = buildApp({ db: testDb });
let teacherCookie: string;
let inviteeCookie: string;
let outsiderCookie: string;
let classId: string;

async function makeUser(email: string, opts: Record<string, unknown> = {}) {
  const [u] = await testDb
    .insert(users)
    .values({
      name: email.split("@")[0],
      email,
      passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
      ...opts,
    })
    .returning();
  return u;
}

async function signin(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("iteach@example.com", { isTeacher: true });
  await makeUser("invitee@example.com");
  await makeUser("outsider@example.com");
  teacherCookie = await signin("iteach@example.com");
  inviteeCookie = await signin("invitee@example.com");
  outsiderCookie = await signin("outsider@example.com");
  const res = await app.inject({
    method: "POST",
    url: "/api/classes",
    cookies: { pide_session: teacherCookie },
    payload: { name: "Invite Class" },
  });
  classId = res.json().class.id;
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("sending invites", () => {
  test("teacher invites a student and a TA: rows + emails with join links; TA subject differs", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["invitee@example.com"], role: "student" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sent).toEqual(["invitee@example.com"]);

    const ta = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["helper@example.com"], role: "ta" },
    });
    expect(ta.statusCode).toBe(200);

    const mails = await testDb.select().from(emails).where(eq(emails.template, "class-invite"));
    expect(mails).toHaveLength(2);
    const subjects = mails.map((m) => m.subject);
    expect(subjects).toContain("You're invited to Invite Class — Physics IDE");
    expect(subjects).toContain("You're invited to assist Invite Class — Physics IDE");
    for (const m of mails) expect(m.bodyText).toContain("/join/invite?token=");
  });

  test("non-teacher may not invite", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: outsiderCookie },
      payload: { emails: ["x@example.com"], role: "student" },
    });
    expect(res.statusCode).toBe(403);
  });

  test("inviting an existing active member reports it as skipped", async () => {
    await testDb.insert(classMembers).values({
      classId,
      userId: (await testDb.select().from(users).where(eq(users.email, "outsider@example.com")))[0]
        .id,
      role: "student",
    });
    const res = await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["outsider@example.com"], role: "student" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().skipped).toEqual(["outsider@example.com"]);
    expect(res.json().sent).toEqual([]);
  });
});

describe("accepting and revoking", () => {
  test("accepting a pending invite adds an ACTIVE membership even in approval mode", async () => {
    await app.inject({
      method: "PATCH",
      url: `/api/classes/${classId}`,
      cookies: { pide_session: teacherCookie },
      payload: { joinMode: "approval" },
    });
    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, "invitee@example.com")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];
    const res = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, classId, status: "active" });

    const again = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token },
    });
    expect(again.statusCode).toBe(400);
    expect(again.json().error).toBe("That invite link is no longer valid.");
  });

  test("revoked invites cannot be accepted", async () => {
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["revokeme@example.com"], role: "student" },
    });
    const [inv] = await testDb
      .select()
      .from(invites)
      .where(and(eq(invites.classId, classId), eq(invites.email, "revokeme@example.com")));
    const rev = await app.inject({
      method: "POST",
      url: `/api/invites/${inv.id}/revoke`,
      cookies: { pide_session: teacherCookie },
    });
    expect(rev.statusCode).toBe(200);

    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.template, "class-invite"), eq(emails.toEmail, "revokeme@example.com")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];
    const res = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token },
    });
    expect(res.statusCode).toBe(400);
  });

  test("resend rotates the link: a second email goes out, the old link dies, the new one works", async () => {
    await app.inject({
      method: "POST",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
      payload: { emails: ["resendme@example.com"], role: "student" },
    });
    const [inv] = await testDb
      .select()
      .from(invites)
      .where(and(eq(invites.classId, classId), eq(invites.email, "resendme@example.com")));
    const mailsBefore = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toEmail, "resendme@example.com"));
    const oldToken = /token=([A-Za-z0-9_-]+)/.exec(mailsBefore[0].bodyText)![1];

    const res = await app.inject({
      method: "POST",
      url: `/api/invites/${inv.id}/resend`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);

    const mailsAfter = await testDb
      .select()
      .from(emails)
      .where(eq(emails.toEmail, "resendme@example.com"));
    expect(mailsAfter).toHaveLength(2);
    const freshToken = /token=([A-Za-z0-9_-]+)/.exec(mailsAfter[1].bodyText)![1];

    const oldRes = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token: oldToken },
    });
    expect(oldRes.statusCode).toBe(400);
    const newRes = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      cookies: { pide_session: inviteeCookie },
      payload: { token: freshToken },
    });
    expect(newRes.statusCode).toBe(200);
  });

  test("teacher lists pending invites", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/classes/${classId}/invites`,
      cookies: { pide_session: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().invites as Array<{ email: string; status: string }>;
    expect(list.every((i) => i.status === "pending")).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — invite routes 404.

- [ ] **Step 4: Implement**

Create `backend/src/routes/invites.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { InviteInputSchema, AcceptInviteInputSchema } from "@physics-ide/shared";
import { classes, classMembers, invites, users } from "../db/schema.js";
import { requireConfirmed } from "../auth/guards.js";
import { getMembership, requireClassTeacher, sendClassAuthError } from "../classes/guards.js";
import { newToken, hashToken } from "../auth/tokens.js";
import { classInvite } from "../email/templates.js";
import { logEvent } from "../db/events.js";
import { config } from "../config.js";

export function inviteRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireConfirmed);

  app.post("/api/classes/:id/invites", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, id));
    if (!c) return reply.code(404).send({ error: "No such class." });
    if (c.archived) return reply.code(400).send({ error: "That class is archived." });
    const parsed = InviteInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    // Emails already holding an ACTIVE membership are skipped, not errored (spec: invite tools are forgiving).
    const existingUsers = await app.db
      .select({ user: users, member: classMembers })
      .from(users)
      .innerJoin(
        classMembers,
        and(eq(classMembers.userId, users.id), eq(classMembers.classId, id)),
      )
      .where(inArray(users.email, parsed.data.emails));
    const memberEmails = new Set(existingUsers.map((r) => r.user.email));

    const sent: string[] = [];
    const skipped: string[] = [];
    for (const email of parsed.data.emails) {
      if (memberEmails.has(email)) {
        skipped.push(email);
        continue;
      }
      const t = newToken();
      await app.db.transaction(async (tx) => {
        await tx.insert(invites).values({
          classId: id,
          email,
          role: parsed.data.role,
          tokenHash: t.hash,
          invitedBy: req.user!.id,
        });
        await logEvent(tx, "invite.sent", req.user!.id, { classId: id, email, role: parsed.data.role });
      });
      const mail = classInvite({
        className: c.name,
        inviterName: req.user!.name,
        joinUrl: `${config.appBaseUrl}/join/invite?token=${t.token}`,
        role: parsed.data.role,
      });
      await app.mailer.send({ to: email, template: "class-invite", ...mail });
      sent.push(email);
    }
    return { sent, skipped };
  });

  app.get("/api/classes/:id/invites", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await requireClassTeacher(app.db, id, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    const rows = await app.db
      .select()
      .from(invites)
      .where(and(eq(invites.classId, id), eq(invites.status, "pending")));
    return {
      invites: rows.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/invites/:id/revoke", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(invites).where(eq(invites.id, id));
    const inv = rows[0];
    if (!inv) return reply.code(404).send({ error: "No such invite." });
    try {
      await requireClassTeacher(app.db, inv.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (inv.status !== "pending") {
      return reply.code(400).send({ error: "That invite is not pending." });
    }
    await app.db.transaction(async (tx) => {
      await tx.update(invites).set({ status: "revoked" }).where(eq(invites.id, id));
      await logEvent(tx, "invite.revoked", req.user!.id, { classId: inv.classId, email: inv.email });
    });
    return { ok: true };
  });

  app.post("/api/invites/:id/resend", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(invites).where(eq(invites.id, id));
    const inv = rows[0];
    if (!inv) return reply.code(404).send({ error: "No such invite." });
    try {
      await requireClassTeacher(app.db, inv.classId, req.user!.id);
    } catch (err) {
      if (await sendClassAuthError(reply, err)) return;
      throw err;
    }
    if (inv.status !== "pending") {
      return reply.code(400).send({ error: "That invite is not pending." });
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, inv.classId));
    if (!c) return reply.code(404).send({ error: "No such class." });
    const t = newToken();
    await app.db.transaction(async (tx) => {
      // Rotate the token: the previously emailed link stops working.
      await tx.update(invites).set({ tokenHash: t.hash }).where(eq(invites.id, id));
      await logEvent(tx, "invite.sent", req.user!.id, {
        classId: inv.classId,
        email: inv.email,
        resend: true,
      });
    });
    const mail = classInvite({
      className: c.name,
      inviterName: req.user!.name,
      joinUrl: `${config.appBaseUrl}/join/invite?token=${t.token}`,
      role: inv.role as "student" | "ta" | "teacher",
    });
    await app.mailer.send({ to: inv.email, template: "class-invite", ...mail });
    return { ok: true };
  });

  app.post("/api/invites/accept", async (req, reply) => {
    const parsed = AcceptInviteInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "That invite link is no longer valid." });
    }
    const tokenHash = hashToken(parsed.data.token);
    const result = await app.db.transaction(async (tx) => {
      // Atomic claim, Plan 2 pattern: only a pending invite flips to accepted.
      const claimed = await tx
        .update(invites)
        .set({ status: "accepted", acceptedBy: req.user!.id })
        .where(and(eq(invites.tokenHash, tokenHash), eq(invites.status, "pending")))
        .returning();
      const inv = claimed[0];
      if (!inv) return null;
      const existing = await tx
        .select()
        .from(classMembers)
        .where(and(eq(classMembers.classId, inv.classId), eq(classMembers.userId, req.user!.id)));
      if (existing.length === 0) {
        // Invited members land active regardless of joinMode — the teacher asked for them.
        await tx.insert(classMembers).values({
          classId: inv.classId,
          userId: req.user!.id,
          role: inv.role,
          status: "active",
        });
      } else if (existing[0].status === "waiting") {
        await tx
          .update(classMembers)
          .set({ status: "active", role: inv.role })
          .where(eq(classMembers.id, existing[0].id));
      }
      await logEvent(tx, "invite.accepted", req.user!.id, {
        classId: inv.classId,
        invitedEmail: inv.email,
        role: inv.role,
      });
      return inv;
    });
    if (!result) {
      return reply.code(400).send({ error: "That invite link is no longer valid." });
    }
    const [c] = await app.db.select().from(classes).where(eq(classes.id, result.classId));
    return { ok: true, classId: result.classId, className: c?.name ?? "", status: "active" };
  });
}
```

Register in `backend/src/app.ts`: import `inviteRoutes` from `./routes/invites.js`, `app.register(inviteRoutes);` after `memberRoutes`.

- [ ] **Step 5: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: green, silent.

- [ ] **Step 6: Commit**

```powershell
git add backend/src
git commit -m "feat(backend): email invites for students/co-teachers/TAs with atomic accept and revoke"
```

---

### Task 6: Admin classes list

**Files:**
- Modify: `backend/src/routes/admin.ts`, `backend/src/routes/admin.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces: `GET /api/admin/classes` → `{ classes: [{id, name, subjectLabel, archived, joinMode, activeMembers, teachers: string[]}] }` (read-only; spec §10 "visibility, not management").

- [ ] **Step 1: Write the failing test**

Append to `backend/src/routes/admin.test.ts` (inside the file's existing structure, after the health describe — reuse the file's `adminCookie`; note this file's beforeAll truncates, so create the class inside the new test):

```ts
describe("classes list", () => {
  test("admin sees every class with size and teacher names; read-only", async () => {
    const [t] = await testDb
      .insert(users)
      .values({
        name: "List Teacher",
        email: "listteach@example.com",
        passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
        isTeacher: true,
        emailConfirmedAt: new Date(),
        consentAt: new Date(),
      })
      .returning();
    const signinRes = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "listteach@example.com", password: "a-long-password" },
    });
    const tCookie = signinRes.cookies.find((c) => c.name === "pide_session")!.value;
    await app.inject({
      method: "POST",
      url: "/api/classes",
      cookies: { pide_session: tCookie },
      payload: { name: "Admin Visible Class" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/classes",
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().classes as Array<{
      name: string;
      activeMembers: number;
      teachers: string[];
    }>;
    const row = list.find((c) => c.name === "Admin Visible Class");
    expect(row).toBeDefined();
    expect(row!.activeMembers).toBe(1);
    expect(row!.teachers).toContain("List Teacher");
    void t;
  });
});
```

(Add `classMembers`-free imports as needed: the test file already imports `users`, `argon2`, `testDb`, `app` — extend imports only if the file lacks one.)

- [ ] **Step 2: Run to verify failure, then implement**

```powershell
npm run test -w backend
```

Expected: FAIL — `/api/admin/classes` 404. Then add to `backend/src/routes/admin.ts` (inside `adminRoutes`, after the emails route; extend imports with `classes`, `classMembers` from `../db/schema.js`):

```ts
  app.get("/api/admin/classes", async () => {
    const rows = await app.db.select().from(classes);
    const members = await app.db
      .select({ member: classMembers, user: users })
      .from(classMembers)
      .innerJoin(users, eq(classMembers.userId, users.id));
    return {
      classes: rows.map((c) => {
        const mine = members.filter((m) => m.member.classId === c.id);
        return {
          id: c.id,
          name: c.name,
          subjectLabel: c.subjectLabel,
          archived: c.archived,
          joinMode: c.joinMode,
          activeMembers: mine.filter((m) => m.member.status === "active").length,
          teachers: mine
            .filter((m) => m.member.role === "teacher" && m.member.status === "active")
            .map((m) => m.user.name),
        };
      }),
    };
  });
```

- [ ] **Step 3: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: green, silent.

- [ ] **Step 4: Commit**

```powershell
git add backend/src
git commit -m "feat(backend): read-only admin classes list"
```

---

### Task 7: Frontend foundation — classes area, hooks, home screens

**Files:**
- Modify: `frontend/package.json` (dep `qrcode`), `frontend/src/App.js` (routes), `frontend/src/components/auth/AccountChip.js` (link), `frontend/src/styles.css` (append)
- Create: `frontend/src/components/classes/ClassesHome.js`, `frontend/src/components/classes/ClassChrome.js`
- Test: `frontend/src/utils/__tests__/classCode.test.js`

**Interfaces:**
- Consumes: shared `normalizeClassCode`/`CLASS_CODE_REGEX`, `api()` client, `useMe()`.
- Produces: routes `/classes`, `/classes/:id/*`; `ClassChrome` (header + tab nav wrapper Tasks 8–9 fill); the `classes-*` CSS vocabulary.

- [ ] **Step 1: Install the dependency**

```powershell
npm install -w frontend qrcode@^1.5.4
```

- [ ] **Step 2: Pure-module test (shared re-export smoke on the JS side)**

Create `frontend/src/utils/__tests__/classCode.test.js`:

```js
import { describe, test, expect } from "vitest";
import { normalizeClassCode, CLASS_CODE_REGEX } from "@physics-ide/shared";

describe("class code helpers reach the frontend", () => {
  test("normalize + regex round-trip", () => {
    const code = normalizeClassCode(" kq4 7pm ");
    expect(code).toBe("KQ4-7PM");
    expect(CLASS_CODE_REGEX.test(code)).toBe(true);
  });
});
```

Run `npm run test -w frontend` — must pass immediately (the Vite TS-strip plugin from Plan 2 handles the shared import; if it fails, STOP and report, do not patch config).

- [ ] **Step 3: ClassesHome**

Create `frontend/src/components/classes/ClassesHome.js`:

```js
import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

export default function ClassesHome() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  return (
    <div className="classes-page">
      <header className="classes-header">
        <Link to="/" className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <h1>My classes</h1>
      </header>
      <ClassWall me={me} />
    </div>
  );
}

function ClassWall({ me }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [error, setError] = useState(null);
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => api("/api/classes") });
  const create = useMutation({
    mutationFn: (body) => api("/api/classes", { method: "POST", body }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      navigate(`/classes/${data.class.id}`);
    },
    onError: (err) => setError(err.message),
  });

  const all = classesQuery.data?.classes ?? [];
  const active = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);
  const canCreate = me.isTeacher || me.role === "admin";

  return (
    <div className="classes-body">
      <div className="classes-actions">
        {canCreate ? (
          <button className="admin-btn" type="button" onClick={() => setCreating((v) => !v)}>
            New class
          </button>
        ) : null}
        <Link className="admin-btn" to="/join">
          Join a class
        </Link>
      </div>
      {creating ? (
        <form
          className="auth-form classes-newform"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate({ name, ...(subjectLabel.trim() ? { subjectLabel } : {}) });
          }}
        >
          <label className="auth-label">
            Class name
            <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="auth-label">
            Subject / year (optional)
            <input
              className="auth-input"
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
            />
          </label>
          {error ? <div className="auth-error">{error}</div> : null}
          <button className="auth-submit" type="submit" disabled={!name.trim() || create.isPending}>
            Create class
          </button>
        </form>
      ) : null}
      <div className="classes-wall">
        {active.map((c) => (
          <Link key={c.id} to={`/classes/${c.id}`} className="class-card">
            <div className="class-card-name">{c.name}</div>
            {c.subjectLabel ? <div className="class-card-label">{c.subjectLabel}</div> : null}
            <div className="class-card-meta">
              {c.myRole === "teacher" ? "teacher" : c.myRole === "ta" ? "assistant" : "student"}
              {c.myStatus === "waiting" ? " · waiting for approval" : ""}
            </div>
          </Link>
        ))}
        {active.length === 0 && !classesQuery.isLoading ? (
          <p className="auth-text auth-text--dim">
            {canCreate
              ? "No classes yet — create your first one."
              : "No classes yet — join one with a code from your teacher."}
          </p>
        ) : null}
      </div>
      {archived.length > 0 ? (
        <details className="classes-archived">
          <summary>Archived ({archived.length})</summary>
          {archived.map((c) => (
            <Link key={c.id} to={`/classes/${c.id}`} className="class-card class-card--archived">
              <div className="class-card-name">{c.name}</div>
            </Link>
          ))}
        </details>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: ClassChrome (the class page shell Tasks 8–9 fill)**

Create `frontend/src/components/classes/ClassChrome.js`:

```js
import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

/**
 * Shell for /classes/:id — header, tab nav, and the class query.
 * Children render via the `children(classData, me)` function prop.
 */
export default function ClassChrome({ tab, children }) {
  const { id } = useParams();
  const { data: me, isLoading } = useMe();
  const classQuery = useQuery({
    queryKey: ["class", id],
    queryFn: () => api(`/api/classes/${id}`),
    enabled: !!me,
    retry: false,
  });

  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (classQuery.error) {
    return (
      <div className="classes-page">
        <div className="classes-body">
          <div className="auth-error">{classQuery.error.message}</div>
          <Link className="admin-btn" to="/classes">
            Back to my classes
          </Link>
        </div>
      </div>
    );
  }
  if (!classQuery.data) return null;
  const c = classQuery.data.class;
  const isTeacher = c.myRole === "teacher";
  const isStaff = isTeacher || c.myRole === "ta";
  const tabs = [
    { key: "assignments", label: "Assignments", to: `/classes/${c.id}`, show: true },
    { key: "people", label: "People", to: `/classes/${c.id}/people`, show: isStaff },
    { key: "settings", label: "Settings", to: `/classes/${c.id}/settings`, show: isTeacher },
  ].filter((t) => t.show);

  return (
    <div className="classes-page">
      <header className="classes-header">
        <Link to="/classes" className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <h1>
          {c.name}
          {c.archived ? <span className="class-archived-badge">archived</span> : null}
        </h1>
        <nav className="admin-tabs">
          {tabs.map((t) => (
            <Link
              key={t.key}
              to={t.to}
              className={t.key === tab ? "admin-tab admin-tab--on" : "admin-tab"}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      {children(c, me)}
    </div>
  );
}

export function AssignmentsStub() {
  return (
    <ClassChrome tab="assignments">
      {() => (
        <div className="classes-body">
          <p className="auth-text auth-text--dim">
            Assignments arrive in a later update. For now this class holds its roster and settings.
          </p>
        </div>
      )}
    </ClassChrome>
  );
}
```

- [ ] **Step 5: Routes, chip link, styles**

In `frontend/src/App.js`: import `ClassesHome` from `./components/classes/ClassesHome` and `{ AssignmentsStub }` from `./components/classes/ClassChrome`; add inside the Routes block (before the catch-all):

```js
                      <Route path="/classes" element={<ClassesHome />} />
                      <Route path="/classes/:id" element={<AssignmentsStub />} />
```

(Tasks 8–9 add `/classes/:id/people`, `/classes/:id/settings`, and the join routes.)

In `frontend/src/components/auth/AccountChip.js`: in the signed-in branch, immediately BEFORE the Profile link, add:

```js
      <Link className="account-chip-btn" to="/classes">
        My classes
      </Link>
```

Append to `frontend/src/styles.css`:

```css
/* ---- Classes (Plan 3) ---- */
.classes-page { min-height: 100vh; background: var(--bg-base); color: var(--text); }
.classes-header {
  padding: 18px 24px 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}
.classes-header h1 { font-size: 18px; color: var(--text-bright); margin: 10px 0 12px; }
.classes-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; max-width: 1000px; }
.classes-actions { display: flex; gap: 8px; }
.classes-newform { max-width: 420px; border: 1px solid var(--border); border-radius: 6px; padding: 14px; }
.classes-wall { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.class-card {
  display: block;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px;
  color: var(--text);
  text-decoration: none;
}
.class-card:hover { background: var(--bg-card-hover); }
.class-card-name { color: var(--text-bright); font-size: 15px; }
.class-card-label { color: var(--text-dim); font-size: 12px; margin-top: 2px; }
.class-card-meta { color: var(--text-muted); font-size: 11px; margin-top: 8px; }
.class-card--archived { opacity: 0.7; }
.classes-archived summary { cursor: pointer; color: var(--text-dim); font-size: 13px; margin: 6px 0; }
.class-archived-badge {
  margin-left: 8px;
  font-size: 10px;
  color: var(--yellow);
  border: 1px solid var(--yellow);
  border-radius: 3px;
  padding: 0 4px;
  vertical-align: middle;
}
.join-panel { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.join-code-big {
  font-family: Consolas, monospace;
  font-size: 28px;
  letter-spacing: 0.08em;
  color: var(--text-bright);
  border: 1px dashed var(--border-hl);
  border-radius: 6px;
  padding: 10px 16px;
}
.join-qr { background: #fff; padding: 8px; border-radius: 6px; }
.roster-badge {
  font-size: 10px;
  border: 1px solid var(--border-hl);
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 6px;
  color: var(--text-dim);
}
```

- [ ] **Step 6: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: tests pass (existing + 1 new), build clean.

- [ ] **Step 7: Commit**

```powershell
git add frontend package.json package-lock.json
git commit -m "feat(frontend): classes area — wall, new-class form, class shell with tab nav, chip link"
```

---

### Task 8: Frontend — People tab (roster, invites, join panel with QR)

**Files:**
- Create: `frontend/src/components/classes/PeopleTab.js`
- Modify: `frontend/src/App.js` (route)

**Interfaces:**
- Consumes: Task 4/5 endpoints, `ClassChrome`, `qrcode`.
- Produces: route `/classes/:id/people`.

- [ ] **Step 1: Implement**

Create `frontend/src/components/classes/PeopleTab.js`:

```js
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { api } from "../../utils/api/client";
import ClassChrome from "./ClassChrome";

export default function PeopleTab() {
  return <ClassChrome tab="people">{(c) => <PeopleBody classData={c} />}</ClassChrome>;
}

function PeopleBody({ classData }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const isTeacher = classData.myRole === "teacher";
  const membersQuery = useQuery({
    queryKey: ["class", id, "members"],
    queryFn: () => api(`/api/classes/${id}/members`),
  });
  const invitesQuery = useQuery({
    queryKey: ["class", id, "invites"],
    queryFn: () => api(`/api/classes/${id}/invites`),
    enabled: isTeacher,
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["class", id] });
  };
  const act = useMutation({
    mutationFn: ({ path, method = "POST" }) => api(path, { method, body: {} }),
    onSuccess: refresh,
  });
  const invite = useMutation({
    mutationFn: (body) => api(`/api/classes/${id}/invites`, { method: "POST", body }),
    onSuccess: refresh,
  });

  const [emailsRaw, setEmailsRaw] = useState("");
  const [role, setRole] = useState("student");
  const [inviteNote, setInviteNote] = useState(null);

  const members = membersQuery.data?.members ?? [];
  const waiting = members.filter((m) => m.status === "waiting");

  function sendInvites(e) {
    e.preventDefault();
    setInviteNote(null);
    const emails = emailsRaw
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    invite.mutate(
      { emails, role },
      {
        onSuccess: (data) => {
          setEmailsRaw("");
          setInviteNote(
            `Sent ${data.sent.length} invite${data.sent.length === 1 ? "" : "s"}` +
              (data.skipped.length ? ` · already members: ${data.skipped.join(", ")}` : ""),
          );
        },
        onError: (err) => setInviteNote(err.message),
      },
    );
  }

  return (
    <div className="classes-body">
      {isTeacher ? <JoinPanel classData={classData} onChanged={refresh} /> : null}
      {isTeacher && waiting.length > 0 ? (
        <div>
          <h2 className="auth-title">Waiting to join</h2>
          <table className="admin-table">
            <tbody>
              {waiting.map((m) => (
                <tr key={m.userId}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td className="admin-actions">
                    <button
                      className="admin-btn"
                      type="button"
                      onClick={() =>
                        act.mutate({ path: `/api/classes/${id}/members/${m.userId}/approve` })
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="admin-btn"
                      type="button"
                      onClick={() =>
                        act.mutate({ path: `/api/classes/${id}/members/${m.userId}/deny` })
                      }
                    >
                      Deny
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <h2 className="auth-title">Roster</h2>
      {act.error ? <div className="auth-error">{act.error.message}</div> : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            {isTeacher ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {members
            .filter((m) => m.status === "active")
            .map((m) => (
              <tr key={m.userId}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>
                  {m.role === "ta" ? "assistant" : m.role}
                </td>
                {isTeacher ? (
                  <td className="admin-actions">
                    <button
                      className="admin-btn"
                      type="button"
                      onClick={() =>
                        act.mutate({
                          path: `/api/classes/${id}/members/${m.userId}`,
                          method: "DELETE",
                        })
                      }
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
        </tbody>
      </table>
      {isTeacher ? (
        <>
          <h2 className="auth-title">Invite by email</h2>
          <form className="auth-form classes-newform" onSubmit={sendInvites}>
            <label className="auth-label">
              Email addresses (comma, space, or line separated)
              <textarea
                className="auth-input"
                rows="3"
                value={emailsRaw}
                onChange={(e) => setEmailsRaw(e.target.value)}
              />
            </label>
            <label className="auth-label">
              Invite as
              <select className="auth-input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="ta">Teaching assistant</option>
                <option value="teacher">Co-teacher</option>
              </select>
            </label>
            {inviteNote ? <p className="auth-text auth-text--dim">{inviteNote}</p> : null}
            <button className="auth-submit" type="submit" disabled={!emailsRaw.trim() || invite.isPending}>
              Send invites
            </button>
          </form>
          {(invitesQuery.data?.invites ?? []).length > 0 ? (
            <>
              <h2 className="auth-title">Pending invites</h2>
              <table className="admin-table">
                <tbody>
                  {invitesQuery.data.invites.map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{i.role === "ta" ? "assistant" : i.role}</td>
                      <td className="admin-actions">
                        <button
                          className="admin-btn"
                          type="button"
                          onClick={() => act.mutate({ path: `/api/invites/${i.id}/resend` })}
                        >
                          Resend
                        </button>
                        <button
                          className="admin-btn"
                          type="button"
                          onClick={() => act.mutate({ path: `/api/invites/${i.id}/revoke` })}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function JoinPanel({ classData, onChanged }) {
  const { id } = useParams();
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const joinUrl = `${window.location.origin}/join/${classData.joinCode}`;
  const regen = useMutation({
    mutationFn: () => api(`/api/classes/${id}/regenerate-code`, { method: "POST", body: {} }),
    onSuccess: onChanged,
  });

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, joinUrl, { width: 148, margin: 1 }, () => {});
    }
  }, [joinUrl]);

  return (
    <div>
      <h2 className="auth-title">Joining</h2>
      <div className="join-panel">
        <div>
          <div className="join-code-big">{classData.joinCode}</div>
          <div className="classes-actions" style={{ marginTop: 8 }}>
            <button
              className="admin-btn"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(joinUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied!" : "Copy join link"}
            </button>
            <button
              className="admin-btn"
              type="button"
              onClick={() => regen.mutate()}
              disabled={regen.isPending}
            >
              Regenerate code
            </button>
          </div>
          <p className="auth-text auth-text--dim" style={{ marginTop: 6 }}>
            Joining is {classData.joinMode === "open" ? "open" : classData.joinMode === "approval" ? "by approval" : "paused"} — change it in Settings.
          </p>
        </div>
        <canvas ref={canvasRef} className="join-qr" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route**

In `frontend/src/App.js`: import `PeopleTab` from `./components/classes/PeopleTab`; add after the `/classes/:id` route:

```js
                      <Route path="/classes/:id/people" element={<PeopleTab />} />
```

- [ ] **Step 3: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: green, clean build (qrcode bundles without config changes).

- [ ] **Step 4: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): People tab — roster, approval queue, invites, join code/link/QR panel"
```

---

### Task 9: Frontend — Settings tab, join screens, admin classes tab

**Files:**
- Create: `frontend/src/components/classes/SettingsTab.js`, `frontend/src/components/classes/JoinClassPage.js`, `frontend/src/components/classes/InviteLandingPage.js`
- Modify: `frontend/src/App.js` (routes), `frontend/src/components/admin/AdminConsole.js` (Classes tab), `frontend/src/components/auth/SignInPage.js` (stashed-invite redirect, Step 3b)

**Interfaces:**
- Consumes: Tasks 3–6 endpoints, `ClassChrome`.
- Produces: routes `/classes/:id/settings`, `/join`, `/join/:code`, `/join/invite`; admin console tab "Classes". Invite tokens survive the signup detour via `sessionStorage` key `pide_pending_invite`.

- [ ] **Step 1: SettingsTab**

Create `frontend/src/components/classes/SettingsTab.js`:

```js
import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import ClassChrome from "./ClassChrome";

export default function SettingsTab() {
  return <ClassChrome tab="settings">{(c) => <SettingsBody classData={c} />}</ClassChrome>;
}

function SettingsBody({ classData }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const [name, setName] = useState(classData.name);
  const [subjectLabel, setSubjectLabel] = useState(classData.subjectLabel ?? "");
  const [msg, setMsg] = useState(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["class", id] });
  const patch = useMutation({
    mutationFn: (body) => api(`/api/classes/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      refresh();
      setMsg("Saved.");
    },
    onError: (err) => setMsg(err.message),
  });
  const archive = useMutation({
    mutationFn: (action) => api(`/api/classes/${id}/${action}`, { method: "POST", body: {} }),
    onSuccess: refresh,
  });

  return (
    <div className="classes-body">
      <form
        className="auth-form classes-newform"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          patch.mutate({
            name,
            subjectLabel: subjectLabel.trim() === "" ? null : subjectLabel,
          });
        }}
      >
        <label className="auth-label">
          Class name
          <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="auth-label">
          Subject / year
          <input
            className="auth-input"
            value={subjectLabel}
            onChange={(e) => setSubjectLabel(e.target.value)}
          />
        </label>
        <button className="auth-submit" type="submit" disabled={patch.isPending}>
          Save
        </button>
      </form>
      <h2 className="auth-title">Joining rules</h2>
      <div className="auth-doors" style={{ maxWidth: 520 }}>
        {[
          ["open", "Open — anyone with the code joins instantly"],
          ["approval", "Approval — joiners wait for you"],
          ["paused", "Paused — nobody can join"],
        ].map(([mode, label]) => (
          <label key={mode} className={classData.joinMode === mode ? "auth-door auth-door--on" : "auth-door"}>
            <input
              type="radio"
              name="joinMode"
              checked={classData.joinMode === mode}
              onChange={() => patch.mutate({ joinMode: mode })}
            />
            {label}
          </label>
        ))}
      </div>
      {msg ? <p className="auth-text auth-text--dim">{msg}</p> : null}
      <h2 className="auth-title">Archive</h2>
      {classData.archived ? (
        <button className="admin-btn" type="button" onClick={() => archive.mutate("unarchive")}>
          Unarchive this class
        </button>
      ) : (
        <button className="admin-btn" type="button" onClick={() => archive.mutate("archive")}>
          Archive this class (read-only for everyone)
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Join screens**

Create `frontend/src/components/classes/JoinClassPage.js`:

```js
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { normalizeClassCode, CLASS_CODE_REGEX } from "@physics-ide/shared";
import AuthLayout from "../auth/AuthLayout";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

export default function JoinClassPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();
  const [code, setCode] = useState(codeParam ? normalizeClassCode(codeParam) : "");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const autoJoined = useRef(false); // StrictMode double-invoke guard (Plan 2 ConfirmPage pattern)

  async function join(joinCode) {
    setError(null);
    try {
      const data = await api("/api/classes/join", { method: "POST", body: { code: joinCode } });
      setResult(data);
      if (data.status === "active") {
        setTimeout(() => navigate(`/classes/${data.classId}`), 900);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // Arriving via /join/CODE while signed in: submit automatically, exactly once.
  useEffect(() => {
    if (autoJoined.current) return;
    if (!isLoading && me && codeParam && CLASS_CODE_REGEX.test(normalizeClassCode(codeParam))) {
      autoJoined.current = true;
      join(normalizeClassCode(codeParam));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (isLoading) return null;
  if (!me) {
    return (
      <AuthLayout
        title="Join a class"
        footer={
          <>
            <Link to="/auth/signin">Sign in</Link> or <Link to="/auth/signup">create an account</Link>{" "}
            first — then come back to this link.
          </>
        }
      >
        <p className="auth-text">You need an account to join a class.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Join a class" footer={<Link to="/classes">My classes</Link>}>
      {result ? (
        <p className="auth-text">
          {result.status === "active"
            ? `You're in ${result.className}! Taking you there…`
            : `Request sent — ${result.className}'s teacher will approve you.`}
        </p>
      ) : (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            join(normalizeClassCode(code));
          }}
        >
          <label className="auth-label">
            Class code
            <input
              className="auth-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="KQ4-7PM"
              autoFocus
            />
          </label>
          {error ? <div className="auth-error">{error}</div> : null}
          <button
            className="auth-submit"
            type="submit"
            disabled={!CLASS_CODE_REGEX.test(normalizeClassCode(code))}
          >
            Join
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
```

Create `frontend/src/components/classes/InviteLandingPage.js`:

```js
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../auth/AuthLayout";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

export const PENDING_INVITE_KEY = "pide_pending_invite";

/**
 * /join/invite?token=... — the emailed button lands here.
 * Signed out: stash the token and route through signup/signin; this page
 * re-reads the stash when the user returns signed in.
 */
export default function InviteLandingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();
  const [state, setState] = useState("working"); // working | done | failed
  const [message, setMessage] = useState("");
  const posted = useRef(false);
  const token = params.get("token") || sessionStorage.getItem(PENDING_INVITE_KEY) || "";

  useEffect(() => {
    if (isLoading) return;
    if (!me) {
      if (token) sessionStorage.setItem(PENDING_INVITE_KEY, token);
      return;
    }
    if (posted.current || !token) return;
    posted.current = true;
    (async () => {
      try {
        const data = await api("/api/invites/accept", { method: "POST", body: { token } });
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setState("done");
        setMessage(`You're in ${data.className}!`);
        setTimeout(() => navigate(`/classes/${data.classId}`), 900);
      } catch (err) {
        setState("failed");
        setMessage(err.message);
      }
    })();
  }, [isLoading, me, token, navigate]);

  if (isLoading) return null;
  if (!me) {
    return (
      <AuthLayout
        title="You're invited"
        footer={
          <>
            <Link to="/auth/signup">Create an account</Link> or <Link to="/auth/signin">sign in</Link>
          </>
        }
      >
        <p className="auth-text">
          Create an account (or sign in) and you'll land in the class automatically — this
          invitation waits for you.
        </p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="You're invited" footer={<Link to="/classes">My classes</Link>}>
      {state === "working" ? <p className="auth-text">One moment…</p> : null}
      {state === "done" ? <p className="auth-text">{message}</p> : null}
      {state === "failed" ? <div className="auth-error">{message}</div> : null}
    </AuthLayout>
  );
}
```

- [ ] **Step 3: Routes**

In `frontend/src/App.js`: import `SettingsTab`, `JoinClassPage`, `InviteLandingPage`; add before the catch-all:

```js
                      <Route path="/classes/:id/settings" element={<SettingsTab />} />
                      <Route path="/join" element={<JoinClassPage />} />
                      <Route path="/join/invite" element={<InviteLandingPage />} />
                      <Route path="/join/:code" element={<JoinClassPage />} />
```

(`/join/invite` MUST be declared before `/join/:code` so "invite" isn't captured as a code.)

- [ ] **Step 3b: Sign-in returns stashed invitees to their invite**

Modify `frontend/src/components/auth/SignInPage.js`: in `onSubmit`, replace `navigate("/");` with:

```js
      navigate(sessionStorage.getItem("pide_pending_invite") ? "/join/invite" : "/");
```

(The landing page clears the stash after a successful accept; a failed accept shows its error there.)

- [ ] **Step 4: Admin Classes tab**

In `frontend/src/components/admin/AdminConsole.js`: change `const TABS = ["People", "Emails", "Health"];` to `const TABS = ["People", "Classes", "Emails", "Health"];`, add `{tab === "Classes" ? <ClassesTab /> : null}` alongside the other tab conditionals, and add at the bottom of the file:

```js
function ClassesTab() {
  const classesQuery = useQuery({
    queryKey: ["admin", "classes"],
    queryFn: () => api("/api/admin/classes"),
  });
  return (
    <div className="admin-body">
      <p className="auth-text auth-text--dim">
        Every class on the site — visibility, not management.
      </p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Teachers</th>
            <th>Members</th>
            <th>Joining</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(classesQuery.data?.classes ?? []).map((c) => (
            <tr key={c.id}>
              <td>
                {c.name}
                {c.subjectLabel ? ` · ${c.subjectLabel}` : ""}
              </td>
              <td>{c.teachers.join(", ")}</td>
              <td>{c.activeMembers}</td>
              <td>{c.joinMode}</td>
              <td>{c.archived ? "archived" : "active"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: green, clean.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): class settings, join-by-code/link screens, invite landing, admin classes tab"
```

---

### Task 10: Wrap-up — docs and the full sweep

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: the documented classroom flow later plans build their instructions on.

- [ ] **Step 1: Update README**

In `README.md`, immediately after the accounts paragraph added by Plan 2 (the one beginning "Accounts are live in local dev"), add:

```markdown
Classrooms are live too: teacher accounts create classes from **My classes** (account chip →
My classes), students join by code, link, QR, or email invite, and the People tab manages the
roster (waiting-list approval, co-teachers, teaching assistants, invites). Invite emails land in
the admin console's pretend inbox like everything else.
```

- [ ] **Step 2: The full verification sweep**

```powershell
npm run test
npm run check:blocks
npm run build -w frontend
npm run typecheck -w backend
npm run typecheck -w shared
```

Expected: every workspace green (all existing suites + this plan's new tests), registry OK, build clean, typechecks silent. Record exact totals in the report.

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: classrooms in quickstart (create, join, roster, invites)"
```

---

## Completion criteria (what Plan 4 may assume)

- `classes`/`class_members`/`invites` tables exist in both DBs (migration 0002); membership is the authorisation source (`getMembership`/`requireClassTeacher`/`sendClassAuthError` in `backend/src/classes/guards.ts`), `requireConfirmed` gates all class routes.
- Endpoints live and tested: class CRUD/settings/archive/regenerate-code; join-by-code honouring open/approval/paused/archived; roster with approve/deny/remove and the last-teacher guard; batch email invites (student/ta/teacher) with atomic accept and revoke; read-only `GET /api/admin/classes`.
- Frontend routes: `/classes`, `/classes/:id` (+ `/people`, `/settings`), `/join`, `/join/:code`, `/join/invite`; the account chip links My classes; invite tokens survive the signup detour via `sessionStorage("pide_pending_invite")`.
- Every class mutation writes its named `events` row; invite emails use the two spec §9 subjects and appear in the pretend inbox.
