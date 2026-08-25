# Classroom Platform — Plan 2: Accounts, Email & Admin

> **Stale-instruction warning — added 25 August 2026 (Plan 5 wrap-up).** This plan is an executed historical record; its task bodies are unedited. A reader must NOT follow these instructions against today's tree:
> - *"Append to `frontend/src/styles.css`"* (lines 2887, 3373) is wrong — that file is now a 17-line import manifest with load-bearing order. Shared primitives go in `primitives.css`, portal rules in `platform.css`, welcome rules in `welcome.css`.
> - *"No @testing-library — screens are verified by the controller's browser pass"* is superseded — `frontend/src/test/renderHelpers.js` is a dependency-free component-test harness and portal screens are component-tested.
> - *"No edits under `frontend/src/components` except the named ones"* is no longer a usable boundary — header controls are added through `utils/toolbar/visibleControls.js`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real accounts end-to-end on the local stack: signup (student/teacher doors) with email confirmation and the 200-cap, argon2id passwords, DB-backed sessions in httpOnly cookies, password reset, the Mailer interface whose dev driver feeds a pretend inbox, and the admin corner (people, cap, email log, health) — with the guest IDE experience byte-for-byte untouched.

**Architecture:** Backend grows an auth module on the Plan-1 Fastify skeleton: `buildApp` takes its database as a parameter (tests inject the test DB), routes validate bodies with Zod schemas that live in `shared/` and are imported by both halves, every credential artifact (session, confirm, reset) is a 256-bit random token stored only as a SHA-256 hash, and every account action writes an `events` row in the same transaction. Frontend gains React Router 7 + TanStack Query 5 around the existing provider shell: the IDE stays the `/` route exactly as it is; auth/profile/admin screens are new sibling routes styled with the existing CSS-variable theme.

**Tech Stack:** argon2 (argon2id) · @fastify/cookie 11 · @fastify/rate-limit 11 · react-router-dom 7 · @tanstack/react-query 5 · existing: Fastify 5, Drizzle, Postgres 16 (Docker :5433), Zod, Vite 7, Vitest 4

**Spec:** [docs/classroom-platform.md](../../classroom-platform.md) §2–3, §9–11, §14–15 (functionality) and [docs/classroom-platform-stack.md](../../classroom-platform-stack.md) §3 (auth/mailer/roles), §4 (tables: `users`, `sessions`, `email_tokens`, `emails`) — this plan implements them. Spec §17.3's copy obligation (in-app Help still says "no accounts") is settled in Task 9.

## Global Constraints

- **Signup cap:** enforced *inside the signup transaction* against `settings.account_cap` (seeded 200). Refusal message verbatim, both halves: `This site is at capacity — ask your teacher or the site owner.`
- **Passwords:** argon2id only, minimum length **10**. No other hash, no complexity rules.
- **Sessions:** server-side rows; cookie `pide_session` is httpOnly, sameSite=lax, path=/, secure only in production; TTL **30 days**. Raw tokens are never stored — SHA-256 hashes only (sessions and email tokens alike).
- **Token lifetimes:** confirm **48 h**, reset **60 min**, both single-use.
- **Rate limits (per IP):** signin **10/min**, signup **10/min**, forgot-password **5/min**. Route-scoped, not global.
- **Email:** only via the `Mailer` interface. The ONLY driver in this plan writes rows to the `emails` table (the pretend inbox / spec §9). No SMTP, no provider SDK, nothing that touches the network.
- **Audit:** account actions write `events` rows (`account.signup`, `account.confirmed`, `auth.signin`, `account.password_reset`, `account.deactivated`, `account.reactivated`, `settings.cap_changed`) in the same transaction as the action where a transaction exists.
- **Admin account comes from the seed** (spec §15.9), never from signup. Signup can only create `role='user'`.
- **The IDE core is untouched.** No edits under `frontend/src/components` except the named ones (StartMenu insertion, HelpPage copy), none under `frontend/src/utils` except the new `api/` folder, no changes to contexts/hooks the IDE uses. Guest behaviour at `/` must be identical.
- **Frontend stays JavaScript**; `backend/` and `shared/` stay TypeScript strict; NodeNext means every relative import in backend/shared carries a `.js` extension.
- **No new dependencies beyond those named in this plan.** Banned (stack §7): Redis, queues, websockets, NestJS, Prisma, GraphQL. No @testing-library — frontend tests stay at the pure-module level; screens are verified by the controller's browser pass.
- Ports 3000/4000/5433; Node floor `>=20.19.2`; Windows 11 + PowerShell; every task ends in a commit on `feature/classroom-platform`.
- Backend test files use the shared test-DB helper (Task 4 creates it) and the backend Vitest config sets `fileParallelism: false` — multiple files share one Postgres test database.

**Deferred to later plans (spec'd, deliberately NOT in this one — do not flag as missing):** guest-project import at signup (spec §3.2 — needs cloud projects/sync); the admin console's Classes list and Data requests (spec §10 — need classes/projects to exist); the privacy page (spec §11 — lands with the student-facing portal screens); notification switches on the profile (spec §14 — land with notifications); Playwright golden-flow tests (stack §5 — the flows only exist end-to-end once classes/assignments do); the production `Mailer` driver (cloud step).

---

### Task 1: Shared auth contracts

The Zod schemas both halves validate with, plus the two account-level constants the spec fixes verbatim.

**Files:**
- Create: `shared/src/auth.ts`
- Create: `shared/src/auth.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Consumes: `ACCOUNT_ROLES` from `shared/src/roles.ts` (Plan 1).
- Produces (later tasks rely on these exact names): `PASSWORD_MIN_LENGTH: number`, `ACCOUNT_CAP_MESSAGE: string`, `SignupInputSchema`, `SigninInputSchema`, `ConfirmInputSchema`, `ForgotInputSchema`, `ResetInputSchema`, `ChangePasswordInputSchema`, `UpdateMeInputSchema`, `AuthUserSchema`, types `SignupInput`, `SigninInput`, `AuthUser`.

- [ ] **Step 1: Write the failing test**

Create `shared/src/auth.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import {
  SignupInputSchema,
  SigninInputSchema,
  ResetInputSchema,
  AuthUserSchema,
  PASSWORD_MIN_LENGTH,
  ACCOUNT_CAP_MESSAGE,
} from "./auth.js";

describe("auth schemas", () => {
  const goodSignup = {
    name: "Thabo M",
    email: "  Thabo@Example.COM ",
    password: "correct-horse-battery",
    wantsTeacher: false,
    consent: true,
  };

  test("valid signup parses, email is trimmed and lowercased", () => {
    const parsed = SignupInputSchema.parse(goodSignup);
    expect(parsed.email).toBe("thabo@example.com");
    expect(parsed.name).toBe("Thabo M");
  });

  test("consent must be literally true", () => {
    expect(SignupInputSchema.safeParse({ ...goodSignup, consent: false }).success).toBe(false);
  });

  test(`password shorter than ${PASSWORD_MIN_LENGTH} is rejected`, () => {
    expect(
      SignupInputSchema.safeParse({ ...goodSignup, password: "short" }).success,
    ).toBe(false);
  });

  test("signin requires a well-formed email and any non-empty password", () => {
    expect(SigninInputSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(SigninInputSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(SigninInputSchema.safeParse({ email: "A@B.co", password: "pw" }).success).toBe(true);
  });

  test("reset enforces the same password floor", () => {
    expect(ResetInputSchema.safeParse({ token: "t".repeat(40), password: "short" }).success).toBe(false);
    expect(
      ResetInputSchema.safeParse({ token: "t".repeat(40), password: "long-enough-pass" }).success,
    ).toBe(true);
  });

  test("AuthUser shape", () => {
    const u = {
      id: "6f5e4d3c-2b1a-4c9d-8e7f-0a1b2c3d4e5f",
      name: "A",
      email: "a@b.co",
      role: "user",
      isTeacher: true,
      emailConfirmed: false,
    };
    expect(AuthUserSchema.parse(u)).toEqual(u);
  });

  test("cap message is the spec's exact sentence", () => {
    expect(ACCOUNT_CAP_MESSAGE).toBe(
      "This site is at capacity — ask your teacher or the site owner.",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
npm run test -w shared
```

Expected: FAIL — cannot resolve `./auth.js`.

- [ ] **Step 3: Implement**

Create `shared/src/auth.ts`:

```ts
import { z } from "zod";
import { ACCOUNT_ROLES } from "./roles.js";

/** Spec §3.1 — minimum password length. */
export const PASSWORD_MIN_LENGTH = 10;

/** Spec §3.1 — verbatim refusal shown to signup number cap+1. */
export const ACCOUNT_CAP_MESSAGE =
  "This site is at capacity — ask your teacher or the site owner.";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(PASSWORD_MIN_LENGTH).max(200);
const token = z.string().min(20).max(200);

export const SignupInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password,
  wantsTeacher: z.boolean(),
  /** Spec §11 — signup includes a consent step; it must be affirmative. */
  consent: z.literal(true),
});
export type SignupInput = z.infer<typeof SignupInputSchema>;

export const SigninInputSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});
export type SigninInput = z.infer<typeof SigninInputSchema>;

export const ConfirmInputSchema = z.object({ token });
export const ForgotInputSchema = z.object({ email });
export const ResetInputSchema = z.object({ token, password });
export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: password,
});
export const UpdateMeInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ACCOUNT_ROLES),
  isTeacher: z.boolean(),
  emailConfirmed: z.boolean(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;
```

Modify `shared/src/index.ts` to:

```ts
export * from "./roles.js";
export * from "./workspaceRules.js";
export * from "./auth.js";
```

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w shared
npm run typecheck -w shared
```

Expected: all shared tests pass (5 existing + 7 new), typecheck silent.

- [ ] **Step 5: Commit**

```powershell
git add shared/src/auth.ts shared/src/auth.test.ts shared/src/index.ts
git commit -m "feat(shared): auth input schemas, AuthUser shape, cap message and password floor"
```

---

### Task 2: Database — users, sessions, email_tokens, emails

Migration 0001. Pure schema task: tables land, both databases migrate, a round-trip test proves the shape.

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/src/db/schema.users.test.ts`
- Generated: `backend/drizzle/0001_*.sql` + meta (via drizzle-kit)

**Interfaces:**
- Produces (exact names later tasks import from `./db/schema.js`): tables `users`, `sessions`, `emailTokens`, `emails`; existing `settings`, `events` unchanged.
- Column contract used everywhere: `users.email` unique; `users.role` is `"user" | "admin"` as text; `users.isTeacher` boolean; `users.active` boolean default true; `sessions.tokenHash` unique; `emailTokens.type` is `"confirm" | "reset"` as text.

- [ ] **Step 1: Extend the schema**

Append to `backend/src/db/schema.ts` (keep the existing `settings` and `events` definitions exactly as they are; add `boolean` to the existing `drizzle-orm/pg-core` import):

```ts
/** Accounts (spec §2, §3.1). role: "user" | "admin"; teachers are users with isTeacher. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  isTeacher: boolean("is_teacher").notNull().default(false),
  emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Server-side sessions (stack §3). Cookie carries the raw token; we store its SHA-256. */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Single-use expiring tokens for email confirm / password reset (stack §3). */
export const emailTokens = pgTable("email_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every email the system "sends" — the dev pretend inbox and the future email log (spec §9). */
export const emails = pgTable("emails", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  toEmail: text("to_email").notNull(),
  toUserId: uuid("to_user_id"),
  template: text("template").notNull(),
  subject: text("subject").notNull(),
  bodyText: text("body_text").notNull(),
  status: text("status").notNull().default("dev"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Generate and apply the migration to BOTH databases**

```powershell
npm run db:generate -w backend
npm run db:migrate -w backend
npm run db:migrate:test -w backend
```

Expected: one new `backend/drizzle/0001_*.sql` creating the four tables; both migrates exit 0.

- [ ] **Step 3: Write the round-trip test**

Create `backend/src/db/schema.users.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
import { users, sessions } from "./schema.js";

const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
const pool = new pg.Pool({ connectionString: TEST_URL });
const db = drizzle(pool, { schema });

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE "sessions", "email_tokens", "emails", "users" CASCADE');
});

afterAll(async () => {
  await pool.end();
});

describe("users + sessions schema", () => {
  test("inserts a user with defaults and reads it back", async () => {
    const [u] = await db
      .insert(users)
      .values({
        name: "Test Person",
        email: "person@example.com",
        passwordHash: "x",
        consentAt: new Date(),
      })
      .returning();
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.role).toBe("user");
    expect(u.isTeacher).toBe(false);
    expect(u.active).toBe(true);
    expect(u.emailConfirmedAt).toBeNull();
  });

  test("duplicate email violates the unique constraint", async () => {
    // drizzle 0.44 may wrap driver errors (DrizzleQueryError with the pg error on .cause)
    await expect(
      db.insert(users).values({
        name: "Dup",
        email: "person@example.com",
        passwordHash: "x",
        consentAt: new Date(),
      }),
    ).rejects.toSatisfy(
      (e: { code?: string; cause?: { code?: string } }) =>
        e.code === "23505" || e.cause?.code === "23505",
    );
  });

  test("deleting a user cascades to their sessions", async () => {
    const [u] = await db
      .insert(users)
      .values({ name: "S", email: "s@example.com", passwordHash: "x", consentAt: new Date() })
      .returning();
    await db.insert(sessions).values({
      tokenHash: "hash-1",
      userId: u.id,
      expiresAt: new Date(Date.now() + 1000 * 60),
    });
    await db.delete(users).where(eq(users.id, u.id));
    const left = await db.select().from(sessions).where(eq(sessions.userId, u.id));
    expect(left).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: all backend tests pass (4 existing + 3 new), typecheck silent.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/db/schema.ts backend/src/db/schema.users.test.ts backend/drizzle
git commit -m "feat(backend): users, sessions, email_tokens, emails tables (migration 0001)"
```

---

### Task 3: The Mailer — interface, dev driver, templates

Stack §3: email goes through a `Mailer` interface; the dev driver writes rows into `emails`, powering the pretend inbox. Three templates exist in this plan (spec §9 rows 1–3).

**Files:**
- Create: `backend/src/email/mailer.ts`
- Create: `backend/src/email/templates.ts`
- Create: `backend/src/email/mailer.test.ts`

**Interfaces:**
- Consumes: `emails` table (Task 2).
- Produces: `interface Mailer { send(msg: MailMessage): Promise<void> }`, `type MailMessage = { to: string; toUserId?: string | null; template: string; subject: string; text: string }`, `createDevMailer(db)`; template builders `confirmEmail({name, confirmUrl})`, `resetEmail({name, resetUrl})`, `teacherSignupAlert({name, email, time, consoleUrl})` each returning `{ subject: string; text: string }`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/email/mailer.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.js";
import { emails } from "../db/schema.js";
import { createDevMailer } from "./mailer.js";
import { confirmEmail, resetEmail, teacherSignupAlert } from "./templates.js";

const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
const pool = new pg.Pool({ connectionString: TEST_URL });
const db = drizzle(pool, { schema });

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE "emails"');
});

afterAll(async () => {
  await pool.end();
});

describe("dev mailer", () => {
  test("send() writes a row into the emails table", async () => {
    const mailer = createDevMailer(db);
    await mailer.send({
      to: "kid@example.com",
      template: "confirm",
      subject: "Confirm your address — Physics IDE",
      text: "hello",
    });
    const rows = await db.select().from(emails);
    expect(rows).toHaveLength(1);
    expect(rows[0].toEmail).toBe("kid@example.com");
    expect(rows[0].template).toBe("confirm");
    expect(rows[0].status).toBe("dev");
  });
});

describe("templates", () => {
  test("confirm email contains the link and names the 48h expiry", () => {
    const m = confirmEmail({ name: "Za", confirmUrl: "http://x/auth/confirm?token=abc" });
    expect(m.subject).toBe("Confirm your address — Physics IDE");
    expect(m.text).toContain("http://x/auth/confirm?token=abc");
    expect(m.text).toContain("48 hours");
  });

  test("reset email contains the link and names the 60 minute expiry", () => {
    const m = resetEmail({ name: "Za", resetUrl: "http://x/auth/reset?token=abc" });
    expect(m.subject).toBe("Reset your password — Physics IDE");
    expect(m.text).toContain("http://x/auth/reset?token=abc");
    expect(m.text).toContain("60 minutes");
  });

  test("teacher alert carries name, email, time and console link (spec §3.1)", () => {
    const m = teacherSignupAlert({
      name: "New Teacher",
      email: "t@example.com",
      time: "2026-08-18 18:00",
      consoleUrl: "http://x/admin",
    });
    expect(m.subject).toBe("A new teacher signed up — Physics IDE");
    for (const needle of ["New Teacher", "t@example.com", "2026-08-18 18:00", "http://x/admin"]) {
      expect(m.text).toContain(needle);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — cannot resolve `./mailer.js` / `./templates.js`.

- [ ] **Step 3: Implement**

Create `backend/src/email/mailer.ts`:

```ts
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.js";
import { emails } from "../db/schema.js";

type Db = NodePgDatabase<typeof schema>;

export type MailMessage = {
  to: string;
  toUserId?: string | null;
  template: string;
  subject: string;
  text: string;
};

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

/** Dev driver: every message becomes a row — the pretend inbox (spec §9). */
export function createDevMailer(db: Db): Mailer {
  return {
    async send(msg) {
      await db.insert(emails).values({
        toEmail: msg.to,
        toUserId: msg.toUserId ?? null,
        template: msg.template,
        subject: msg.subject,
        bodyText: msg.text,
        status: "dev",
      });
    },
  };
}
```

Create `backend/src/email/templates.ts`:

```ts
/** All templates return plain text — spec §9: short, plain, about one thing. */

export function confirmEmail(p: { name: string; confirmUrl: string }) {
  return {
    subject: "Confirm your address — Physics IDE",
    text: `Hi ${p.name},

Welcome to Physics IDE. Please confirm your email address by opening this link:

${p.confirmUrl}

The link expires in 48 hours. If you didn't sign up, you can ignore this email.`,
  };
}

export function resetEmail(p: { name: string; resetUrl: string }) {
  return {
    subject: "Reset your password — Physics IDE",
    text: `Hi ${p.name},

Someone asked to reset the password for this account. If that was you, open this link:

${p.resetUrl}

The link expires in 60 minutes and works once. If you didn't ask, ignore this email — nothing changes.`,
  };
}

export function teacherSignupAlert(p: {
  name: string;
  email: string;
  time: string;
  consoleUrl: string;
}) {
  return {
    subject: "A new teacher signed up — Physics IDE",
    text: `A new teacher account was just created.

Name:  ${p.name}
Email: ${p.email}
Time:  ${p.time}

Review it in the admin console: ${p.consoleUrl}`,
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: all pass, typecheck silent.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/email
git commit -m "feat(backend): Mailer interface, dev driver writing the pretend inbox, first three templates"
```

---

### Task 4: buildApp takes dependencies; signup + confirm land

The structural task: `buildApp({ db, mailer? })`, cookie + rate-limit plugins registered, shared test helpers created, and the first two auth endpoints with the cap enforced in-transaction.

**Files:**
- Modify: `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/app.test.ts`, `backend/src/config.ts`
- Create: `backend/src/db/types.ts`, `backend/src/db/testClient.ts`, `backend/src/db/events.ts`, `backend/src/auth/tokens.ts`, `backend/src/routes/auth.ts`, `backend/vitest.config.ts`
- Create: `backend/src/routes/auth.signup.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas, Task 2 tables, Task 3 mailer/templates.
- Produces: `buildApp(deps: { db: Db; mailer?: Mailer }): FastifyInstance` (Tasks 5–7 add routes inside it); `Db` type from `src/db/types.ts`; `testDb`/`testPool`/`TEST_URL` from `src/db/testClient.ts`; `logEvent(dbOrTx, type, actorId, payload)`; `newToken(): {token, hash}` and `hashToken(token)`; `toAuthUser(row)`; endpoints `POST /api/auth/signup`, `POST /api/auth/confirm`; `config.appBaseUrl`.
- Error contract used by every later route: failures return `{ "error": "<human sentence>" }` with a fitting status code.

- [ ] **Step 1: Install the backend dependencies**

```powershell
npm install -w backend argon2@^0.45.0 @fastify/cookie@^11.0.0 @fastify/rate-limit@^11.0.0
```

- [ ] **Step 2: Small shared pieces**

Create `backend/src/db/types.ts`:

```ts
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;
```

Create `backend/src/db/testClient.ts`:

```ts
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

export const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
export const testPool = new pg.Pool({ connectionString: TEST_URL });
export const testDb = drizzle(testPool, { schema });

/** Wipe every auth-domain table between test files. */
export async function truncateAuthTables(): Promise<void> {
  await testPool.query(
    'TRUNCATE TABLE "sessions", "email_tokens", "emails", "events", "users" CASCADE',
  );
}
```

Create `backend/src/db/events.ts`:

```ts
import type { Db } from "./types.js";
import { events } from "./schema.js";

/** Accepts the Db or a transaction — both expose the same .insert() surface. */
type DbLike = Pick<Db, "insert">;

export async function logEvent(
  db: DbLike,
  type: string,
  actorId: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(events).values({ type, actorId, payload });
}
```

Create `backend/src/auth/tokens.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 256-bit random token; only its hash is ever stored. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
```

Create `backend/vitest.config.ts` (the test files share one Postgres database — they must not run concurrently):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
```

- [ ] **Step 3: Extend config**

In `backend/src/config.ts`, add to `EnvSchema`:

```ts
  APP_BASE_URL: z.string().url().default("http://127.0.0.1:3000"),
```

and to the exported `config` object:

```ts
  appBaseUrl: env.APP_BASE_URL,
```

- [ ] **Step 4: Rebuild app.ts around dependencies**

Replace `backend/src/app.ts` with:

```ts
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { Db } from "./db/types.js";
import { createDevMailer, type Mailer } from "./email/mailer.js";
import { authRoutes } from "./routes/auth.js";

export interface AppDeps {
  db: Db;
  mailer?: Mailer;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    mailer: Mailer;
  }
}

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.decorate("db", deps.db);
  app.decorate("mailer", deps.mailer ?? createDevMailer(deps.db));

  app.register(cookie);
  app.register(rateLimit, { global: false });

  app.get("/api/health", async () => ({ ok: true, service: "physics-ide-api" }));

  app.register(authRoutes);

  return app;
}
```

Update `backend/src/server.ts`:

```ts
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./db/client.js";

const app = buildApp({ db });

app.listen({ port: config.port, host: "127.0.0.1" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

Update `backend/src/app.test.ts` — the health test now builds with the test DB:

```ts
import { describe, test, expect, afterAll } from "vitest";
import { buildApp } from "./app.js";
import { testDb, testPool } from "./db/testClient.js";

afterAll(async () => {
  await testPool.end();
});

describe("GET /api/health", () => {
  test("returns ok with the service name", async () => {
    const app = buildApp({ db: testDb });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "physics-ide-api" });
    await app.close();
  });
});
```

- [ ] **Step 5: Write the failing signup/confirm tests**

Create `backend/src/routes/auth.signup.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, emails, emailTokens, events } from "../db/schema.js";
import { hashToken } from "../auth/tokens.js";
import { ACCOUNT_CAP_MESSAGE } from "@physics-ide/shared";

const app = buildApp({ db: testDb });

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

function signupBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Learner One",
    email: "learner1@example.com",
    password: "a-long-password",
    wantsTeacher: false,
    consent: true,
    ...overrides,
  };
}

describe("POST /api/auth/signup", () => {
  test("creates a user, a confirm token, a confirm email, and a signup event", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/signup", payload: signupBody() });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true });

    const [u] = await testDb.select().from(users).where(eq(users.email, "learner1@example.com"));
    expect(u).toBeDefined();
    expect(u.role).toBe("user");
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
    expect(u.emailConfirmedAt).toBeNull();

    const toks = await testDb.select().from(emailTokens).where(eq(emailTokens.userId, u.id));
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe("confirm");

    const mails = await testDb.select().from(emails).where(eq(emails.toEmail, u.email));
    expect(mails).toHaveLength(1);
    expect(mails[0].template).toBe("confirm");
    expect(mails[0].bodyText).toContain("/auth/confirm?token=");

    const evts = await testDb.select().from(events).where(eq(events.type, "account.signup"));
    expect(evts.length).toBeGreaterThanOrEqual(1);
  });

  test("rejects a duplicate email with 409", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/signup", payload: signupBody() });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("An account with this email already exists.");
  });

  test("rejects invalid input with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: signupBody({ password: "short", email: "x@y.co" }),
    });
    expect(res.statusCode).toBe(400);
    expect(typeof res.json().error).toBe("string");
  });

  test("a teacher signup also alerts every admin (spec §3.1)", async () => {
    await testDb.insert(users).values({
      name: "Site Admin",
      email: "admin@example.com",
      passwordHash: "x",
      role: "admin",
      emailConfirmedAt: new Date(),
      consentAt: new Date(),
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: signupBody({ email: "teacher1@example.com", wantsTeacher: true }),
    });
    expect(res.statusCode).toBe(201);
    const alerts = await testDb.select().from(emails).where(eq(emails.template, "teacher-alert"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].toEmail).toBe("admin@example.com");
    expect(alerts[0].bodyText).toContain("teacher1@example.com");
  });

  test("signup number cap+1 is refused with the spec's exact sentence", async () => {
    const [{ n }] = (await testPool.query('SELECT count(*)::int AS n FROM "users"')).rows as [
      { n: number },
    ];
    await setSetting(testDb, "account_cap", n);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: signupBody({ email: "overflow@example.com" }),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe(ACCOUNT_CAP_MESSAGE);
    await setSetting(testDb, "account_cap", 200);
  });
});

describe("POST /api/auth/confirm", () => {
  test("a valid token confirms the account and is single-use", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: signupBody({ email: "confirmme@example.com" }),
    });
    const [u] = await testDb.select().from(users).where(eq(users.email, "confirmme@example.com"));
    const [mail] = await testDb.select().from(emails).where(eq(emails.toEmail, u.email));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const res1 = await app.inject({ method: "POST", url: "/api/auth/confirm", payload: { token } });
    expect(res1.statusCode).toBe(200);
    const [after] = await testDb.select().from(users).where(eq(users.id, u.id));
    expect(after.emailConfirmedAt).not.toBeNull();

    const res2 = await app.inject({ method: "POST", url: "/api/auth/confirm", payload: { token } });
    expect(res2.statusCode).toBe(400);
  });

  test("an unknown token is refused", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/confirm",
      payload: { token: hashToken("nonsense").slice(0, 43) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("That link is invalid or has expired.");
  });
});
```

- [ ] **Step 6: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — `../routes/auth.js` does not exist.

- [ ] **Step 7: Implement the routes**

Create `backend/src/routes/auth.ts`:

```ts
import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { eq, sql, and, isNull, gt } from "drizzle-orm";
import {
  SignupInputSchema,
  ConfirmInputSchema,
  ACCOUNT_CAP_MESSAGE,
  type AuthUser,
} from "@physics-ide/shared";
import { users, emailTokens, settings } from "../db/schema.js";
import { logEvent } from "../db/events.js";
import { newToken, hashToken } from "../auth/tokens.js";
import { confirmEmail, teacherSignupAlert } from "../email/templates.js";
import { config } from "../config.js";

export const CONFIRM_TTL_MS = 48 * 60 * 60 * 1000;

export function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as AuthUser["role"],
    isTeacher: row.isTeacher,
    emailConfirmed: row.emailConfirmedAt !== null,
  };
}

export function authRoutes(app: FastifyInstance): void {
  app.post(
    "/api/auth/signup",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = SignupInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
      }
      const input = parsed.data;
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      const confirm = newToken();

      let userId: string;
      try {
        userId = await app.db.transaction(async (tx) => {
          // Serialise cap checks: two simultaneous signups must not both pass at cap-1.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(42)`);
          const capRows = await tx.select().from(settings).where(eq(settings.key, "account_cap"));
          const cap = typeof capRows[0]?.value === "number" ? (capRows[0].value as number) : 200;
          const [{ count }] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(users);
          if (count >= cap) throw new CapReached();

          const [u] = await tx
            .insert(users)
            .values({
              name: input.name,
              email: input.email,
              passwordHash,
              isTeacher: input.wantsTeacher,
              consentAt: new Date(),
            })
            .returning();
          await tx.insert(emailTokens).values({
            userId: u.id,
            type: "confirm",
            tokenHash: confirm.hash,
            expiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
          });
          await logEvent(tx, "account.signup", u.id, {
            email: u.email,
            wantsTeacher: input.wantsTeacher,
          });
          return u.id;
        });
      } catch (err) {
        if (err instanceof CapReached) {
          return reply.code(403).send({ error: ACCOUNT_CAP_MESSAGE });
        }
        if (pgErrorCode(err) === "23505") {
          return reply.code(409).send({ error: "An account with this email already exists." });
        }
        throw err;
      }

      const confirmUrl = `${config.appBaseUrl}/auth/confirm?token=${confirm.token}`;
      const mail = confirmEmail({ name: input.name, confirmUrl });
      await app.mailer.send({
        to: input.email,
        toUserId: userId,
        template: "confirm",
        ...mail,
      });

      if (input.wantsTeacher) {
        const admins = await app.db.select().from(users).where(eq(users.role, "admin"));
        const alert = teacherSignupAlert({
          name: input.name,
          email: input.email,
          time: new Date().toISOString(),
          consoleUrl: `${config.appBaseUrl}/admin`,
        });
        for (const admin of admins) {
          await app.mailer.send({
            to: admin.email,
            toUserId: admin.id,
            template: "teacher-alert",
            ...alert,
          });
        }
      }

      return reply.code(201).send({ ok: true });
    },
  );

  app.post("/api/auth/confirm", async (req, reply) => {
    const parsed = ConfirmInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "That link is invalid or has expired." });
    }
    const tokenHash = hashToken(parsed.data.token);
    const now = new Date();
    const updated = await app.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(emailTokens)
        .where(
          and(
            eq(emailTokens.tokenHash, tokenHash),
            eq(emailTokens.type, "confirm"),
            isNull(emailTokens.usedAt),
            gt(emailTokens.expiresAt, now),
          ),
        );
      const tok = rows[0];
      if (!tok) return false;
      await tx.update(emailTokens).set({ usedAt: now }).where(eq(emailTokens.id, tok.id));
      await tx
        .update(users)
        .set({ emailConfirmedAt: now })
        .where(eq(users.id, tok.userId));
      await logEvent(tx, "account.confirmed", tok.userId, {});
      return true;
    });
    if (!updated) {
      return reply.code(400).send({ error: "That link is invalid or has expired." });
    }
    return { ok: true };
  });
}

class CapReached extends Error {}

/** drizzle 0.44 may wrap driver errors; the pg code then lives on .cause. */
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}
```

- [ ] **Step 8: Run tests, typecheck, and the smoke check**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: all backend tests pass (previous + 7 new), typecheck silent. The full `npm run test` at root must also stay green (frontend + shared untouched).

- [ ] **Step 9: Commit**

```powershell
git add backend/src backend/vitest.config.ts backend/package.json package-lock.json
git commit -m "feat(backend): DI buildApp, signup with in-transaction cap + teacher alert, email confirmation"
```

---

### Task 5: Sessions — sign in, sign out, me

**Files:**
- Create: `backend/src/auth/session.ts`, `backend/src/auth/guards.ts`, `backend/src/routes/auth.session.test.ts`
- Modify: `backend/src/routes/auth.ts` (add routes)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `SESSION_COOKIE = "pide_session"`, `SESSION_TTL_MS`, `createSession(db, userId): Promise<{token, expiresAt}>`, `getUserBySessionToken(db, token)`, `destroySessionByToken(db, token)`, `destroyAllUserSessions(db, userId)`; guards `requireUser`, `requireAdmin` (Fastify preHandlers attaching `request.user`); endpoints `POST /api/auth/signin`, `POST /api/auth/signout`, `GET /api/auth/me`, `PATCH /api/auth/me`.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/routes/auth.session.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users } from "../db/schema.js";

const app = buildApp({ db: testDb });

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await testDb.insert(users).values({
    name: "Session Person",
    email: "sess@example.com",
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  await testDb.insert(users).values({
    name: "Frozen",
    email: "frozen@example.com",
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    active: false,
    consentAt: new Date(),
  });
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

function cookieOf(res: { cookies: Array<{ name: string; value: string }> }): string | undefined {
  return res.cookies.find((c) => c.name === "pide_session")?.value;
}

describe("signin / me / signout", () => {
  test("wrong password → generic 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "sess@example.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid email or password.");
  });

  test("unknown email → the same generic 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "nobody@example.com", password: "whatever-pw" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Invalid email or password.");
  });

  test("deactivated account → 403 with the honest message", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "frozen@example.com", password: "a-long-password" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("This account has been deactivated.");
  });

  test("good credentials set an httpOnly cookie and /me works; signout kills it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "sess@example.com", password: "a-long-password" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ email: "sess@example.com", emailConfirmed: true });
    const raw = res.headers["set-cookie"];
    expect(String(raw)).toContain("HttpOnly");
    const token = cookieOf(res);
    expect(token).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token! },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.name).toBe("Session Person");

    const rename = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      cookies: { pide_session: token! },
      payload: { name: "Renamed Person" },
    });
    expect(rename.statusCode).toBe(200);
    expect(rename.json().user.name).toBe("Renamed Person");

    const out = await app.inject({
      method: "POST",
      url: "/api/auth/signout",
      cookies: { pide_session: token! },
    });
    expect(out.statusCode).toBe(200);

    const meAfter = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token! },
    });
    expect(meAfter.statusCode).toBe(401);
  });

  test("/me without a cookie → 401", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("Not signed in.");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — signin route does not exist (404s).

- [ ] **Step 3: Implement sessions and guards**

Create `backend/src/auth/session.ts`:

```ts
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/types.js";
import { sessions, users } from "../db/schema.js";
import { newToken, hashToken } from "./tokens.js";

export const SESSION_COOKIE = "pide_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(
  db: Db,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: hash, userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserBySessionToken(
  db: Db,
  token: string,
): Promise<typeof users.$inferSelect | null> {
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  const row = rows[0];
  if (!row || !row.user.active) return null;
  return row.user;
}

export async function destroySessionByToken(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function destroyAllUserSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
```

Create `backend/src/auth/guards.ts`:

```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import type { users } from "../db/schema.js";
import { getUserBySessionToken, SESSION_COOKIE } from "./session.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: typeof users.$inferSelect;
  }
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[SESSION_COOKIE];
  const user = token ? await getUserBySessionToken(req.server.db, token) : null;
  if (!user) {
    await reply.code(401).send({ error: "Not signed in." });
    return;
  }
  req.user = user;
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireUser(req, reply);
  if (reply.sent) return;
  if (req.user!.role !== "admin") {
    await reply.code(403).send({ error: "Admin only." });
  }
}
```

Add to `backend/src/routes/auth.ts` — imports:

```ts
import { SigninInputSchema, UpdateMeInputSchema } from "@physics-ide/shared";
import {
  createSession,
  destroySessionByToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "../auth/session.js";
import { requireUser } from "../auth/guards.js";
```

and inside `authRoutes(app)`, after the confirm route:

```ts
  app.post(
    "/api/auth/signin",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = SigninInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(401).send({ error: "Invalid email or password." });
      }
      const rows = await app.db.select().from(users).where(eq(users.email, parsed.data.email));
      const user = rows[0];
      const ok = user ? await argon2.verify(user.passwordHash, parsed.data.password) : false;
      if (!user || !ok) {
        return reply.code(401).send({ error: "Invalid email or password." });
      }
      if (!user.active) {
        return reply.code(403).send({ error: "This account has been deactivated." });
      }
      const session = await createSession(app.db, user.id);
      await logEvent(app.db, "auth.signin", user.id, {});
      reply.setCookie(SESSION_COOKIE, session.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: config.nodeEnv === "production",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return { user: toAuthUser(user) };
    },
  );

  app.post("/api/auth/signout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await destroySessionByToken(app.db, token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireUser }, async (req) => {
    return { user: toAuthUser(req.user!) };
  });

  app.patch("/api/auth/me", { preHandler: requireUser }, async (req, reply) => {
    const parsed = UpdateMeInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const [updated] = await app.db
      .update(users)
      .set({ name: parsed.data.name })
      .where(eq(users.id, req.user!.id))
      .returning();
    return { user: toAuthUser(updated) };
  });
```

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: all pass, silent typecheck.

- [ ] **Step 5: Commit**

```powershell
git add backend/src
git commit -m "feat(backend): DB sessions with httpOnly cookie, signin/signout/me, auth guards"
```

---

### Task 6: Passwords — forgot, reset, change

**Files:**
- Create: `backend/src/routes/auth.password.test.ts`
- Modify: `backend/src/routes/auth.ts`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `POST /api/auth/forgot`, `POST /api/auth/reset`, `POST /api/auth/change-password`; `RESET_TTL_MS`.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/routes/auth.password.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq, and } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, emails, sessions } from "../db/schema.js";

const app = buildApp({ db: testDb });

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await testDb.insert(users).values({
    name: "Reset Person",
    email: "reset@example.com",
    passwordHash: await argon2.hash("old-password-1", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

async function signin(password: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email: "reset@example.com", password },
  });
}

describe("forgot / reset", () => {
  test("forgot always answers ok, and mails a reset link when the account exists", async () => {
    const unknown = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "ghost@example.com" },
    });
    expect(unknown.statusCode).toBe(200);
    expect(unknown.json()).toEqual({ ok: true });
    const ghostMail = await testDb.select().from(emails).where(eq(emails.toEmail, "ghost@example.com"));
    expect(ghostMail).toHaveLength(0);

    const known = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "reset@example.com" },
    });
    expect(known.statusCode).toBe(200);
    const mails = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "reset@example.com"), eq(emails.template, "reset")));
    expect(mails).toHaveLength(1);
    expect(mails[0].bodyText).toContain("/auth/reset?token=");
  });

  test("reset changes the password, is single-use, and kills every session", async () => {
    const live = await signin("old-password-1");
    expect(live.statusCode).toBe(200);

    const [mail] = await testDb
      .select()
      .from(emails)
      .where(and(eq(emails.toEmail, "reset@example.com"), eq(emails.template, "reset")));
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.bodyText)![1];

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token, password: "new-password-1" },
    });
    expect(res.statusCode).toBe(200);

    const [u] = await testDb.select().from(users).where(eq(users.email, "reset@example.com"));
    const liveSessions = await testDb.select().from(sessions).where(eq(sessions.userId, u.id));
    expect(liveSessions).toHaveLength(0);

    expect((await signin("old-password-1")).statusCode).toBe(401);
    expect((await signin("new-password-1")).statusCode).toBe(200);

    const again = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token, password: "sneaky-password" },
    });
    expect(again.statusCode).toBe(400);
  });
});

describe("change password (signed in)", () => {
  test("requires the current password and keeps only the current session", async () => {
    const s1 = await signin("new-password-1");
    const s2 = await signin("new-password-1");
    const token1 = s1.cookies.find((c) => c.name === "pide_session")!.value;
    const token2 = s2.cookies.find((c) => c.name === "pide_session")!.value;

    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { pide_session: token1 },
      payload: { currentPassword: "wrong-guess", newPassword: "brand-new-pw-1" },
    });
    expect(bad.statusCode).toBe(400);

    const good = await app.inject({
      method: "POST",
      url: "/api/auth/change-password",
      cookies: { pide_session: token1 },
      payload: { currentPassword: "new-password-1", newPassword: "brand-new-pw-1" },
    });
    expect(good.statusCode).toBe(200);

    const me1 = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token1 },
    });
    expect(me1.statusCode).toBe(200);
    const me2 = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { pide_session: token2 },
    });
    expect(me2.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — forgot/reset/change-password 404.

- [ ] **Step 3: Implement**

Add to `backend/src/routes/auth.ts` — imports (`ForgotInputSchema`, `ResetInputSchema`, `ChangePasswordInputSchema` from `@physics-ide/shared`; `resetEmail` from `../email/templates.js`; `destroyAllUserSessions`, `hashToken` are already imported or come from `../auth/session.js`/`../auth/tokens.js`; `ne` from `drizzle-orm`), constant:

```ts
export const RESET_TTL_MS = 60 * 60 * 1000;
```

and inside `authRoutes(app)`:

```ts
  app.post(
    "/api/auth/forgot",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const parsed = ForgotInputSchema.safeParse(req.body);
      if (!parsed.success) return { ok: true };
      const rows = await app.db.select().from(users).where(eq(users.email, parsed.data.email));
      const user = rows[0];
      if (user && user.active) {
        const reset = newToken();
        await app.db.insert(emailTokens).values({
          userId: user.id,
          type: "reset",
          tokenHash: reset.hash,
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        });
        const mail = resetEmail({
          name: user.name,
          resetUrl: `${config.appBaseUrl}/auth/reset?token=${reset.token}`,
        });
        await app.mailer.send({ to: user.email, toUserId: user.id, template: "reset", ...mail });
      }
      return reply.code(200).send({ ok: true });
    },
  );

  app.post("/api/auth/reset", async (req, reply) => {
    const parsed = ResetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "That link is invalid or has expired." });
    }
    const tokenHash = hashToken(parsed.data.token);
    const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
    const now = new Date();
    const done = await app.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(emailTokens)
        .where(
          and(
            eq(emailTokens.tokenHash, tokenHash),
            eq(emailTokens.type, "reset"),
            isNull(emailTokens.usedAt),
            gt(emailTokens.expiresAt, now),
          ),
        );
      const tok = rows[0];
      if (!tok) return false;
      await tx.update(emailTokens).set({ usedAt: now }).where(eq(emailTokens.id, tok.id));
      // Any other outstanding reset links die with this one.
      await tx
        .update(emailTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(emailTokens.userId, tok.userId),
            eq(emailTokens.type, "reset"),
            isNull(emailTokens.usedAt),
          ),
        );
      await tx.update(users).set({ passwordHash }).where(eq(users.id, tok.userId));
      await tx.delete(sessions).where(eq(sessions.userId, tok.userId));
      await logEvent(tx, "account.password_reset", tok.userId, {});
      return true;
    });
    if (!done) return reply.code(400).send({ error: "That link is invalid or has expired." });
    return { ok: true };
  });

  app.post("/api/auth/change-password", { preHandler: requireUser }, async (req, reply) => {
    const parsed = ChangePasswordInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const ok = await argon2.verify(req.user!.passwordHash, parsed.data.currentPassword);
    if (!ok) {
      return reply.code(400).send({ error: "Your current password is incorrect." });
    }
    const passwordHash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
    const currentTokenHash = hashToken(req.cookies[SESSION_COOKIE]!);
    await app.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, req.user!.id));
      await tx
        .delete(sessions)
        .where(and(eq(sessions.userId, req.user!.id), ne(sessions.tokenHash, currentTokenHash)));
      await logEvent(tx, "account.password_reset", req.user!.id, { via: "change-password" });
    });
    return { ok: true };
  });
```

(`sessions` needs importing from `../db/schema.js` in auth.ts if not already.)

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: green, silent.

- [ ] **Step 5: Commit**

```powershell
git add backend/src
git commit -m "feat(backend): password forgot/reset (single-use, session-killing) and signed-in change"
```

---

### Task 7: The admin corner — API + the seeded admin account

Spec §10 (People, the cap, health, email log) and §15.9 (admin created at installation).

**Files:**
- Create: `backend/src/routes/admin.ts`, `backend/src/routes/admin.test.ts`
- Modify: `backend/src/app.ts` (register), `backend/src/seed.ts` (admin account), root `package.json` (root `seed` convenience script)

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces (all under `requireAdmin`): `GET /api/admin/users?q=`, `POST /api/admin/users/:id/deactivate`, `POST /api/admin/users/:id/reactivate`, `POST /api/admin/users/:id/resend-confirmation`, `POST /api/admin/users/:id/send-reset`, `GET /api/admin/cap`, `PUT /api/admin/cap`, `GET /api/admin/emails?limit=`, `GET /api/admin/health`. Admin user list rows are `AuthUser & { active: boolean; createdAt: string }`. Seed env: `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` (dev defaults `admin@physics-ide.local` / `Site Admin` / `admin-dev-password`).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/routes/admin.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { getSetting, setSetting } from "../db/settings.js";
import { users, emails, sessions } from "../db/schema.js";

const app = buildApp({ db: testDb });
let adminCookie: string;
let studentId: string;

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  const hash = await argon2.hash("admin-password-1", { type: argon2.argon2id });
  await testDb.insert(users).values({
    name: "Root",
    email: "root@example.com",
    passwordHash: hash,
    role: "admin",
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  const [student] = await testDb
    .insert(users)
    .values({
      name: "Kid",
      email: "kid@example.com",
      passwordHash: await argon2.hash("kid-password-1", { type: argon2.argon2id }),
      consentAt: new Date(),
    })
    .returning();
  studentId = student.id;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email: "root@example.com", password: "admin-password-1" },
  });
  adminCookie = res.cookies.find((c) => c.name === "pide_session")!.value;
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("admin guard", () => {
  test("a non-admin is refused with 403", async () => {
    const kid = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "kid@example.com", password: "kid-password-1" },
    });
    const kidCookie = kid.cookies.find((c) => c.name === "pide_session")!.value;
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      cookies: { pide_session: kidCookie },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("people", () => {
  test("lists and searches users", async () => {
    const all = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      cookies: { pide_session: adminCookie },
    });
    expect(all.statusCode).toBe(200);
    expect(all.json().users.length).toBeGreaterThanOrEqual(2);

    const search = await app.inject({
      method: "GET",
      url: "/api/admin/users?q=kid",
      cookies: { pide_session: adminCookie },
    });
    expect(search.json().users).toHaveLength(1);
    expect(search.json().users[0].email).toBe("kid@example.com");
  });

  test("deactivate kills sessions and blocks signin; reactivate restores", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${studentId}/deactivate`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const liveSessions = await testDb
      .select()
      .from(sessions)
      .where(eq(sessions.userId, studentId));
    expect(liveSessions).toHaveLength(0);

    const blocked = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "kid@example.com", password: "kid-password-1" },
    });
    expect(blocked.statusCode).toBe(403);

    await app.inject({
      method: "POST",
      url: `/api/admin/users/${studentId}/reactivate`,
      cookies: { pide_session: adminCookie },
    });
    const back = await app.inject({
      method: "POST",
      url: "/api/auth/signin",
      payload: { email: "kid@example.com", password: "kid-password-1" },
    });
    expect(back.statusCode).toBe(200);
  });

  test("an admin cannot deactivate their own account", async () => {
    const [admin] = await testDb.select().from(users).where(eq(users.email, "root@example.com"));
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${admin.id}/deactivate`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("You cannot deactivate your own account.");
  });

  test("resend-confirmation mails a fresh confirm link (only to unconfirmed accounts)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${studentId}/resend-confirmation`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const mails = await testDb.select().from(emails).where(eq(emails.toEmail, "kid@example.com"));
    expect(mails.some((m) => m.template === "confirm")).toBe(true);
  });

  test("send-reset mails a reset link", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${studentId}/send-reset`,
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const mails = await testDb.select().from(emails).where(eq(emails.toEmail, "kid@example.com"));
    expect(mails.some((m) => m.template === "reset")).toBe(true);
  });
});

describe("cap, emails, health", () => {
  test("GET/PUT cap", async () => {
    const before = await app.inject({
      method: "GET",
      url: "/api/admin/cap",
      cookies: { pide_session: adminCookie },
    });
    expect(before.json()).toMatchObject({ cap: 200 });
    expect(typeof before.json().count).toBe("number");

    const put = await app.inject({
      method: "PUT",
      url: "/api/admin/cap",
      cookies: { pide_session: adminCookie },
      payload: { cap: 150 },
    });
    expect(put.statusCode).toBe(200);
    expect(await getSetting(testDb, "account_cap")).toBe(150);
    await setSetting(testDb, "account_cap", 200);
  });

  test("email log returns newest first", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/emails?limit=5",
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().emails;
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.length).toBeLessThanOrEqual(5);
    expect(new Date(list[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(list[list.length - 1].createdAt).getTime(),
    );
  });

  test("health reports counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/health",
      cookies: { pide_session: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, db: "ok" });
    expect(typeof res.json().users).toBe("number");
    expect(typeof res.json().cap).toBe("number");
    expect(typeof res.json().emailsLogged).toBe("number");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — admin routes 404.

- [ ] **Step 3: Implement the routes**

Create `backend/src/routes/admin.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { users, emails, emailTokens } from "../db/schema.js";
import { getSetting, setSetting } from "../db/settings.js";
import { requireAdmin } from "../auth/guards.js";
import { destroyAllUserSessions } from "../auth/session.js";
import { logEvent } from "../db/events.js";
import { newToken } from "../auth/tokens.js";
import { confirmEmail, resetEmail } from "../email/templates.js";
import { config } from "../config.js";
import { toAuthUser, CONFIRM_TTL_MS, RESET_TTL_MS } from "./auth.js";

const CapSchema = z.object({ cap: z.number().int().min(1).max(10000) });

export function adminRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/admin/users", async (req) => {
    const q = (req.query as { q?: string }).q?.trim();
    const base = app.db.select().from(users);
    const rows = q
      ? await base.where(or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`)))
      : await base;
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      users: rows.slice(0, 200).map((u) => ({
        ...toAuthUser(u),
        active: u.active,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/admin/users/:id/deactivate", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user!.id) {
      return reply.code(400).send({ error: "You cannot deactivate your own account." });
    }
    const [u] = await app.db.update(users).set({ active: false }).where(eq(users.id, id)).returning();
    if (!u) return reply.code(404).send({ error: "No such account." });
    await destroyAllUserSessions(app.db, id);
    await logEvent(app.db, "account.deactivated", req.user!.id, { subject: id });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/reactivate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [u] = await app.db.update(users).set({ active: true }).where(eq(users.id, id)).returning();
    if (!u) return reply.code(404).send({ error: "No such account." });
    await logEvent(app.db, "account.reactivated", req.user!.id, { subject: id });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/resend-confirmation", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(users).where(eq(users.id, id));
    const u = rows[0];
    if (!u) return reply.code(404).send({ error: "No such account." });
    if (u.emailConfirmedAt) {
      return reply.code(400).send({ error: "That account is already confirmed." });
    }
    const t = newToken();
    await app.db.insert(emailTokens).values({
      userId: u.id,
      type: "confirm",
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() + CONFIRM_TTL_MS),
    });
    const mail = confirmEmail({
      name: u.name,
      confirmUrl: `${config.appBaseUrl}/auth/confirm?token=${t.token}`,
    });
    await app.mailer.send({ to: u.email, toUserId: u.id, template: "confirm", ...mail });
    return { ok: true };
  });

  app.post("/api/admin/users/:id/send-reset", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db.select().from(users).where(eq(users.id, id));
    const u = rows[0];
    if (!u) return reply.code(404).send({ error: "No such account." });
    const t = newToken();
    await app.db.insert(emailTokens).values({
      userId: u.id,
      type: "reset",
      tokenHash: t.hash,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });
    const mail = resetEmail({
      name: u.name,
      resetUrl: `${config.appBaseUrl}/auth/reset?token=${t.token}`,
    });
    await app.mailer.send({ to: u.email, toUserId: u.id, template: "reset", ...mail });
    return { ok: true };
  });

  app.get("/api/admin/cap", async () => {
    const cap = (await getSetting(app.db, "account_cap")) ?? 200;
    const [{ count }] = await app.db.select({ count: sql<number>`count(*)::int` }).from(users);
    return { cap, count };
  });

  app.put("/api/admin/cap", async (req, reply) => {
    const parsed = CapSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "cap must be a whole number ≥ 1." });
    await setSetting(app.db, "account_cap", parsed.data.cap);
    await logEvent(app.db, "settings.cap_changed", req.user!.id, { cap: parsed.data.cap });
    return { ok: true, cap: parsed.data.cap };
  });

  app.get("/api/admin/emails", async (req) => {
    const limitRaw = Number((req.query as { limit?: string }).limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 100;
    const rows = await app.db.select().from(emails).orderBy(desc(emails.id)).limit(limit);
    return {
      emails: rows.map((e) => ({
        id: e.id,
        toEmail: e.toEmail,
        template: e.template,
        subject: e.subject,
        bodyText: e.bodyText,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });

  app.get("/api/admin/health", async () => {
    const [{ count: userCount }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [{ count: emailCount }] = await app.db
      .select({ count: sql<number>`count(*)::int` })
      .from(emails);
    const cap = (await getSetting(app.db, "account_cap")) ?? 200;
    return { ok: true, db: "ok", users: userCount, cap, emailsLogged: emailCount };
  });
}
```

Register it in `backend/src/app.ts` (import `adminRoutes` from `./routes/admin.js`, then after `app.register(authRoutes);` add `app.register(adminRoutes);`). NOTE: `adminRoutes` adds a scoped `preHandler` hook — registering it as its own plugin keeps the hook away from public routes.

- [ ] **Step 4: Extend the seed with the installation admin (spec §15.9)**

Replace `backend/src/seed.ts` with:

```ts
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db, pool } from "./db/client.js";
import { setSetting, getSetting } from "./db/settings.js";
import { users } from "./db/schema.js";

const existing = await getSetting(db, "account_cap");
if (existing === undefined) {
  await setSetting(db, "account_cap", 200);
  console.log("Seeded account_cap = 200");
} else {
  console.log(`account_cap already set to ${existing} — leaving as is`);
}

const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@physics-ide.local").toLowerCase();
const adminName = process.env.ADMIN_NAME ?? "Site Admin";
const adminPassword = process.env.ADMIN_PASSWORD ?? "admin-dev-password";

const found = await db.select().from(users).where(eq(users.email, adminEmail));
if (found.length === 0) {
  await db.insert(users).values({
    name: adminName,
    email: adminEmail,
    passwordHash: await argon2.hash(adminPassword, { type: argon2.argon2id }),
    role: "admin",
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  console.log(`Seeded admin account ${adminEmail}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log("WARNING: dev default admin password in use — set ADMIN_PASSWORD before any deploy.");
  }
} else {
  console.log(`Admin account ${adminEmail} already exists — leaving as is`);
}

await pool.end();
```

Add to the ROOT `package.json` scripts (after `"db:migrate"`):

```json
    "seed": "npm run seed -w backend",
```

- [ ] **Step 5: Run tests, typecheck, seed smoke**

```powershell
npm run test -w backend
npm run typecheck -w backend
npm run seed
```

Expected: tests green, typecheck silent, seed prints the two idempotent lines (creates the admin on first run).

- [ ] **Step 6: Commit**

```powershell
git add backend/src package.json
git commit -m "feat(backend): admin API (people, cap, email log, health) and seeded installation admin"
```

---

### Task 8: Frontend foundation — router, query, auth screens

The IDE keeps `/`. New sibling routes carry the auth flows. No IDE file changes except App.js (provider shell) and one insertion in StartMenu.

**Files:**
- Modify: `frontend/package.json` (deps), `frontend/src/App.js`, `frontend/src/components/StartMenu.js`, `frontend/src/styles.css` (append one section), `frontend/vite.config.mjs` (scoped TS transform for the shared workspace — see Step 1b; plan amendment 2026-08-18: the original plan missed that the JSX-in-`.js` `esbuild.include` narrowing stops Vite from stripping TypeScript out of `@physics-ide/shared`'s raw `.ts` source, in dev and build alike)
- Create: `frontend/src/utils/api/client.js`, `frontend/src/auth/useAuth.js`, `frontend/src/components/auth/AuthLayout.js`, `frontend/src/components/auth/SignUpPage.js`, `frontend/src/components/auth/SignInPage.js`, `frontend/src/components/auth/CheckEmailPage.js`, `frontend/src/components/auth/ConfirmPage.js`, `frontend/src/components/auth/ForgotPage.js`, `frontend/src/components/auth/ResetPage.js`, `frontend/src/components/auth/AccountChip.js`
- Test: `frontend/src/utils/api/__tests__/client.test.js`

**Interfaces:**
- Consumes: shared schemas (Task 1), backend endpoints (Tasks 4–6).
- Produces: `api(path, {method, body})` throwing `ApiError(message, status)`; hooks `useMe()`, `useSignin()`, `useSignup()`, `useSignout()`; routes `/auth/signup`, `/auth/signin`, `/auth/check-email`, `/auth/confirm`, `/auth/forgot`, `/auth/reset`; Task 9 reuses `AuthLayout`, `api`, `useMe`.

- [ ] **Step 1: Install the frontend dependencies**

```powershell
npm install -w frontend react-router-dom@^7.0.0 @tanstack/react-query@^5.0.0
```

Then add the workspace dependency by editing `frontend/package.json` dependencies to include:

```json
    "@physics-ide/shared": "*",
```

and run `npm install` once at the root so the workspace link materialises.

- [ ] **Step 1b: Teach Vite to strip TypeScript from the shared workspace (plan amendment)**

The existing `esbuild.include: /src\/.*\.js$/` (the CRA-era JSX-in-`.js` shim) narrows Vite's esbuild transform so raw `.ts` from `@physics-ide/shared` is never type-stripped — `as const`/`export type` reach the browser as a SyntaxError and kill the whole module graph. Fix by adding a scoped pre-plugin in `frontend/vite.config.mjs`. Change the first two lines and the `plugins` array to:

```js
import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    {
      // The esbuild.include below narrows Vite's transform to src/*.js (the
      // CRA-era JSX-in-.js shim), which also stops Vite from stripping
      // TypeScript out of the raw-TS @physics-ide/shared workspace source —
      // in dev and build alike. This scoped pre-plugin restores TS handling
      // for exactly that package and nothing else.
      name: "shared-workspace-ts",
      enforce: "pre",
      async transform(code, id) {
        if (/[\\/]shared[\\/]src[\\/][^?]*\.ts$/.test(id)) {
          return transformWithEsbuild(code, id, { loader: "ts" });
        }
      },
    },
    react(),
  ],
```

Everything below `plugins` stays byte-identical.

- [ ] **Step 2: Write the failing api-client test**

Create `frontend/src/utils/api/__tests__/client.test.js`:

```js
import { describe, test, expect, vi, afterEach } from "vitest";
import { api, ApiError } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status, json) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api()", () => {
  test("GET returns parsed JSON and sends same-origin credentials", async () => {
    const fn = stubFetch(200, { user: { name: "A" } });
    const out = await api("/api/auth/me");
    expect(out).toEqual({ user: { name: "A" } });
    const [url, opts] = fn.mock.calls[0];
    expect(url).toBe("/api/auth/me");
    expect(opts.credentials).toBe("same-origin");
    expect(opts.method).toBe("GET");
  });

  test("POST serialises the body and sets the JSON header", async () => {
    const fn = stubFetch(201, { ok: true });
    await api("/api/auth/signup", { method: "POST", body: { a: 1 } });
    const [, opts] = fn.mock.calls[0];
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
  });

  test("a non-2xx response throws ApiError carrying the server's message and status", async () => {
    stubFetch(403, { error: "This site is at capacity — ask your teacher or the site owner." });
    const err = await api("/api/auth/signup", { method: "POST", body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("This site is at capacity — ask your teacher or the site owner.");
  });

  test("a non-JSON failure still throws a readable ApiError", async () => {
    const fn = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    }));
    vi.stubGlobal("fetch", fn);
    const err = await api("/api/health").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe("Something went wrong (HTTP 500).");
  });
});
```

- [ ] **Step 3: Run to verify failure**

```powershell
npm run test -w frontend
```

Expected: FAIL — `../client` unresolved.

- [ ] **Step 4: Implement the client**

Create `frontend/src/utils/api/client.js`:

```js
/**
 * Minimal JSON API client. Cookies ride along (same-origin);
 * every non-2xx becomes an ApiError carrying the server's message.
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      data && typeof data.error === "string"
        ? data.error
        : `Something went wrong (HTTP ${res.status}).`;
    throw new ApiError(message, res.status);
  }
  return data;
}
```

- [ ] **Step 5: Auth hooks**

Create `frontend/src/auth/useAuth.js`:

```js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../utils/api/client";

export const ME_KEY = ["auth", "me"];

/** null = signed out; object = the AuthUser. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const data = await api("/api/auth/me");
        return data.user;
      } catch (err) {
        if (err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useSignin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api("/api/auth/signin", { method: "POST", body }),
    onSuccess: (data) => qc.setQueryData(ME_KEY, data.user),
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (body) => api("/api/auth/signup", { method: "POST", body }),
  });
}

export function useSignout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/auth/signout", { method: "POST", body: {} }),
    onSuccess: () => qc.setQueryData(ME_KEY, null),
  });
}
```

- [ ] **Step 6: The screens**

Create `frontend/src/components/auth/AuthLayout.js`:

```js
import React from "react";
import { Link } from "react-router-dom";

/** Centered card used by every auth/profile screen. */
export default function AuthLayout({ title, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <h1 className="auth-title">{title}</h1>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
```

Create `frontend/src/components/auth/SignUpPage.js`:

```js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SignupInputSchema } from "@physics-ide/shared";
import AuthLayout from "./AuthLayout";
import { useSignup } from "../../auth/useAuth";

export default function SignUpPage() {
  const navigate = useNavigate();
  const signup = useSignup();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    wantsTeacher: false,
    consent: false,
  });
  const [error, setError] = useState(null);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const parsed = SignupInputSchema.safeParse(form);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue.path[0] === "consent"
          ? "Please tick the consent box to continue."
          : issue.path[0] === "password"
            ? "Passwords need at least 10 characters."
            : "Please check your name and email address.",
      );
      return;
    }
    try {
      await signup.mutateAsync(parsed.data);
      navigate("/auth/check-email");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      footer={
        <>
          Already have an account? <Link to="/auth/signin">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="auth-doors" role="radiogroup" aria-label="Account type">
          <label className={form.wantsTeacher ? "auth-door" : "auth-door auth-door--on"}>
            <input
              type="radio"
              name="door"
              checked={!form.wantsTeacher}
              onChange={() => setForm((f) => ({ ...f, wantsTeacher: false }))}
            />
            I'm a student
          </label>
          <label className={form.wantsTeacher ? "auth-door auth-door--on" : "auth-door"}>
            <input
              type="radio"
              name="door"
              checked={form.wantsTeacher}
              onChange={() => setForm((f) => ({ ...f, wantsTeacher: true }))}
            />
            I'm a teacher
          </label>
        </div>
        <label className="auth-label">
          Name
          <input className="auth-input" value={form.name} onChange={set("name")} autoComplete="name" />
        </label>
        <label className="auth-label">
          Email
          <input
            className="auth-input"
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
          />
        </label>
        <label className="auth-label">
          Password
          <input
            className="auth-input"
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
        </label>
        <label className="auth-consent">
          <input type="checkbox" checked={form.consent} onChange={set("consent")} />
          <span>
            I agree that my name, email address and school work are stored so this site can run.
          </span>
        </label>
        {error ? <div className="auth-error">{error}</div> : null}
        <button className="auth-submit" type="submit" disabled={signup.isPending}>
          {signup.isPending ? "Creating…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
```

Create `frontend/src/components/auth/SignInPage.js`:

```js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { useSignin } from "../../auth/useAuth";

export default function SignInPage() {
  const navigate = useNavigate();
  const signin = useSignin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await signin.mutateAsync({ email: email.trim().toLowerCase(), password });
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      footer={
        <>
          New here? <Link to="/auth/signup">Create an account</Link> ·{" "}
          <Link to="/auth/forgot">Forgot password?</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-label">
          Email
          <input
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="auth-label">
          Password
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="auth-error">{error}</div> : null}
        <button className="auth-submit" type="submit" disabled={signin.isPending}>
          {signin.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
```

Create `frontend/src/components/auth/CheckEmailPage.js`:

```js
import React from "react";
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";

export default function CheckEmailPage() {
  return (
    <AuthLayout title="Check your email" footer={<Link to="/auth/signin">Go to sign in</Link>}>
      <p className="auth-text">
        We sent you a confirmation link. Open it to prove the address is yours — until then you can
        look around, but you can't join a class or submit work.
      </p>
      <p className="auth-text auth-text--dim">
        While the site runs locally, "sent" emails appear in the admin console's pretend inbox.
      </p>
    </AuthLayout>
  );
}
```

Create `frontend/src/components/auth/ConfirmPage.js`:

```js
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";

export default function ConfirmPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState("working"); // working | done | failed
  const [message, setMessage] = useState("");
  const token = params.get("token") || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api("/api/auth/confirm", { method: "POST", body: { token } });
        if (!cancelled) setState("done");
      } catch (err) {
        if (!cancelled) {
          setState("failed");
          setMessage(err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthLayout title="Confirming your address" footer={<Link to="/auth/signin">Sign in</Link>}>
      {state === "working" ? <p className="auth-text">One moment…</p> : null}
      {state === "done" ? (
        <p className="auth-text">Your email address is confirmed. You can sign in now.</p>
      ) : null}
      {state === "failed" ? <div className="auth-error">{message}</div> : null}
    </AuthLayout>
  );
}
```

Create `frontend/src/components/auth/ForgotPage.js`:

```js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/auth/forgot", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout title="Reset your password" footer={<Link to="/auth/signin">Back to sign in</Link>}>
      {sent ? (
        <p className="auth-text">
          If that address has an account, a reset link is on its way. The link works once and
          expires in 60 minutes.
        </p>
      ) : (
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          {error ? <div className="auth-error">{error}</div> : null}
          <button className="auth-submit" type="submit">
            Email me a reset link
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
```

Create `frontend/src/components/auth/ResetPage.js`:

```js
import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PASSWORD_MIN_LENGTH } from "@physics-ide/shared";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";

export default function ResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const token = params.get("token") || "";

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Passwords need at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    try {
      await api("/api/auth/reset", { method: "POST", body: { token, password } });
      navigate("/auth/signin");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout title="Choose a new password" footer={<Link to="/auth/signin">Back to sign in</Link>}>
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-label">
          New password
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error ? <div className="auth-error">{error}</div> : null}
        <button className="auth-submit" type="submit">
          Set password
        </button>
      </form>
    </AuthLayout>
  );
}
```

Create `frontend/src/components/auth/AccountChip.js`:

```js
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMe, useSignout } from "../../auth/useAuth";

/** Small account block for the StartMenu sidebar. Guests see the doors; members see themselves. */
export default function AccountChip() {
  const { data: me, isLoading } = useMe();
  const signout = useSignout();
  const navigate = useNavigate();

  if (isLoading) return null;

  if (!me) {
    return (
      <div className="account-chip">
        <div className="account-chip-head">ACCOUNT</div>
        <Link className="account-chip-btn" to="/auth/signin">
          Sign in
        </Link>
        <Link className="account-chip-btn account-chip-btn--primary" to="/auth/signup">
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="account-chip">
      <div className="account-chip-head">ACCOUNT</div>
      <div className="account-chip-name" title={me.email}>
        {me.name}
        {!me.emailConfirmed ? <span className="account-chip-badge">unconfirmed</span> : null}
      </div>
      <Link className="account-chip-btn" to="/profile">
        Profile
      </Link>
      {me.role === "admin" ? (
        <Link className="account-chip-btn" to="/admin">
          Admin console
        </Link>
      ) : null}
      <button
        className="account-chip-btn"
        type="button"
        onClick={async () => {
          await signout.mutateAsync();
          navigate("/");
        }}
      >
        Sign out
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Wire the router into App.js**

Replace `frontend/src/App.js` with:

```js
/**
 * App.js — provider shell + router
 *
 * The IDE stays exactly what it was at "/" (IDELayout inside the original
 * provider stack). Auth, profile and admin screens are sibling routes.
 */
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider }      from "./contexts/ThemeContext";
import { SimulationProvider } from "./contexts/SimulationContext";
import { ProjectProvider }    from "./contexts/ProjectContext";
import { DebugProvider }      from "./contexts/DebugContext";
import { TraceProvider }      from "./contexts/TraceContext";
import ErrorBoundary          from "./components/common/ErrorBoundary";
import IDELayout              from "./components/layout/IDELayout";
import SignUpPage             from "./components/auth/SignUpPage";
import SignInPage             from "./components/auth/SignInPage";
import CheckEmailPage         from "./components/auth/CheckEmailPage";
import ConfirmPage            from "./components/auth/ConfirmPage";
import ForgotPage             from "./components/auth/ForgotPage";
import ResetPage              from "./components/auth/ResetPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <SimulationProvider>
            <ProjectProvider>
              <DebugProvider>
                <TraceProvider>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<IDELayout />} />
                      <Route path="/auth/signup" element={<SignUpPage />} />
                      <Route path="/auth/signin" element={<SignInPage />} />
                      <Route path="/auth/check-email" element={<CheckEmailPage />} />
                      <Route path="/auth/confirm" element={<ConfirmPage />} />
                      <Route path="/auth/forgot" element={<ForgotPage />} />
                      <Route path="/auth/reset" element={<ResetPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </ErrorBoundary>
                </TraceProvider>
              </DebugProvider>
            </ProjectProvider>
          </SimulationProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

(Task 9 adds the `/profile` and `/admin` routes to this same Routes block.)

- [ ] **Step 8: Insert the AccountChip into the StartMenu sidebar**

In `frontend/src/components/StartMenu.js`: add `import AccountChip from "./auth/AccountChip";` with the other imports, then render `<AccountChip />` inside the sidebar `<nav>` block, immediately AFTER the existing "Open File…" button element. Read the file first and keep the insertion to those two lines — nothing else in StartMenu changes.

- [ ] **Step 9: Append the auth styles**

Append to the END of `frontend/src/styles.css`:

```css
/* ============================================================
   AUTH & ACCOUNT SCREENS (Plan 2)
   ============================================================ */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  padding: 24px;
}
.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 28px;
}
.auth-brand {
  font-weight: 700;
  color: var(--text-bright);
  text-decoration: none;
  letter-spacing: 0.02em;
}
.auth-brand span { color: var(--accent); }
.auth-title {
  margin: 14px 0 18px;
  font-size: 20px;
  color: var(--text-bright);
}
.auth-form { display: flex; flex-direction: column; gap: 12px; }
.auth-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-dim);
}
.auth-input {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-bright);
  padding: 8px 10px;
  font-size: 14px;
}
.auth-input:focus { outline: 1px solid var(--border-focus); }
.auth-doors { display: flex; gap: 8px; }
.auth-door {
  flex: 1;
  display: flex;
  gap: 6px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px 10px;
  cursor: pointer;
  color: var(--text);
  font-size: 13px;
}
.auth-door--on { border-color: var(--accent); background: var(--accent-dim); }
.auth-consent {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  font-size: 12px;
  color: var(--text-dim);
}
.auth-error {
  color: var(--red);
  font-size: 13px;
  border: 1px solid var(--red);
  border-radius: 4px;
  padding: 8px 10px;
}
.auth-submit {
  background: var(--accent);
  border: none;
  border-radius: 4px;
  color: #fff;
  padding: 10px;
  font-size: 14px;
  cursor: pointer;
}
.auth-submit:disabled { opacity: 0.6; cursor: default; }
.auth-footer { margin-top: 16px; font-size: 12px; color: var(--text-dim); }
.auth-footer a { color: var(--accent-bright); }
.auth-text { color: var(--text); font-size: 14px; line-height: 1.5; }
.auth-text--dim { color: var(--text-muted); font-size: 12px; }

.account-chip {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.account-chip-head {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.account-chip-name { color: var(--text-bright); font-size: 13px; }
.account-chip-badge {
  margin-left: 6px;
  font-size: 10px;
  color: var(--yellow);
  border: 1px solid var(--yellow);
  border-radius: 3px;
  padding: 0 4px;
}
.account-chip-btn {
  display: block;
  text-align: left;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
}
.account-chip-btn:hover { background: var(--bg-card-hover); }
.account-chip-btn--primary { border-color: var(--accent); color: var(--accent-bright); }
```

- [ ] **Step 10: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: frontend tests pass (existing 90 + 4 new), build clean. Then a quick manual smoke with the dev stack (`npm run dev` if not already running): `/` shows the IDE exactly as before with the ACCOUNT block in the start-menu sidebar; `/auth/signup` renders the form.

- [ ] **Step 11: Commit**

```powershell
git add frontend package.json package-lock.json
git commit -m "feat(frontend): router + query foundation, auth screens, account chip in start menu"
```

---

### Task 9: Frontend — profile, admin console, honest Help copy

**Files:**
- Create: `frontend/src/components/auth/ProfilePage.js`, `frontend/src/components/admin/AdminConsole.js`
- Modify: `frontend/src/App.js` (two routes), `frontend/src/components/HelpPage.js` (copy), `frontend/src/styles.css` (append admin styles)

**Interfaces:**
- Consumes: Task 7 admin endpoints, Task 8 `api`/`useMe`/`AuthLayout`.
- Produces: routes `/profile` and `/admin`.

- [ ] **Step 1: ProfilePage**

Create `frontend/src/components/auth/ProfilePage.js`:

```js
import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";
import { useMe, ME_KEY } from "../../auth/useAuth";

export default function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState(null); // null until user edits
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;

  async function saveName(e) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const data = await api("/api/auth/me", { method: "PATCH", body: { name } });
      qc.setQueryData(ME_KEY, data.user);
      setMsg("Name updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await api("/api/auth/change-password", { method: "POST", body: pw });
      setPw({ currentPassword: "", newPassword: "" });
      setMsg("Password changed. Other devices were signed out.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout title="Profile & settings">
      <p className="auth-text">
        {me.email} · {me.role === "admin" ? "site admin" : me.isTeacher ? "teacher" : "student"}
        {!me.emailConfirmed ? " · email not yet confirmed" : ""}
      </p>
      <form className="auth-form" onSubmit={saveName}>
        <label className="auth-label">
          Name
          <input
            className="auth-input"
            value={name ?? me.name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="auth-submit" type="submit" disabled={name === null || name === me.name}>
          Save name
        </button>
      </form>
      <form className="auth-form" style={{ marginTop: 18 }} onSubmit={changePassword}>
        <label className="auth-label">
          Current password
          <input
            className="auth-input"
            type="password"
            value={pw.currentPassword}
            onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
            autoComplete="current-password"
          />
        </label>
        <label className="auth-label">
          New password
          <input
            className="auth-input"
            type="password"
            value={pw.newPassword}
            onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
            autoComplete="new-password"
          />
        </label>
        <button className="auth-submit" type="submit">
          Change password
        </button>
      </form>
      {msg ? <p className="auth-text" style={{ marginTop: 12 }}>{msg}</p> : null}
      {error ? <div className="auth-error" style={{ marginTop: 12 }}>{error}</div> : null}
    </AuthLayout>
  );
}
```

- [ ] **Step 2: AdminConsole**

Create `frontend/src/components/admin/AdminConsole.js`:

```js
import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

const TABS = ["People", "Emails", "Health"];

export default function AdminConsole() {
  const { data: me, isLoading } = useMe();
  const [tab, setTab] = useState("People");

  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (me.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <Link to="/" className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <h1>Admin console</h1>
        <nav className="admin-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={t === tab ? "admin-tab admin-tab--on" : "admin-tab"}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>
      {tab === "People" ? <PeopleTab /> : null}
      {tab === "Emails" ? <EmailsTab /> : null}
      {tab === "Health" ? <HealthTab /> : null}
    </div>
  );
}

function PeopleTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [capInput, setCapInput] = useState(null);
  const usersQuery = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => api(`/api/admin/users?q=${encodeURIComponent(q)}`),
  });
  const capQuery = useQuery({
    queryKey: ["admin", "cap"],
    queryFn: () => api("/api/admin/cap"),
  });
  const act = useMutation({
    mutationFn: ({ id, action }) => api(`/api/admin/users/${id}/${action}`, { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const saveCap = useMutation({
    mutationFn: (cap) => api("/api/admin/cap", { method: "PUT", body: { cap } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "cap"] }),
  });

  return (
    <div className="admin-body">
      {capQuery.data ? (
        <div className="admin-cap">
          <strong>
            {capQuery.data.count} / {capQuery.data.cap}
          </strong>{" "}
          accounts used.
          <input
            className="auth-input admin-cap-input"
            type="number"
            min="1"
            value={capInput ?? capQuery.data.cap}
            onChange={(e) => setCapInput(Number(e.target.value))}
          />
          <button
            className="admin-btn"
            type="button"
            disabled={capInput === null || capInput === capQuery.data.cap}
            onClick={() => saveCap.mutate(capInput)}
          >
            Save cap
          </button>
        </div>
      ) : null}
      <input
        className="auth-input"
        placeholder="Search by name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {act.error ? <div className="auth-error">{act.error.message}</div> : null}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Kind</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(usersQuery.data?.users ?? []).map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role === "admin" ? "admin" : u.isTeacher ? "teacher" : "student"}</td>
              <td>
                {u.active ? "active" : "deactivated"}
                {!u.emailConfirmed ? " · unconfirmed" : ""}
              </td>
              <td className="admin-actions">
                {u.active ? (
                  <button className="admin-btn" type="button" onClick={() => act.mutate({ id: u.id, action: "deactivate" })}>
                    Deactivate
                  </button>
                ) : (
                  <button className="admin-btn" type="button" onClick={() => act.mutate({ id: u.id, action: "reactivate" })}>
                    Reactivate
                  </button>
                )}
                {!u.emailConfirmed ? (
                  <button className="admin-btn" type="button" onClick={() => act.mutate({ id: u.id, action: "resend-confirmation" })}>
                    Resend confirmation
                  </button>
                ) : null}
                <button className="admin-btn" type="button" onClick={() => act.mutate({ id: u.id, action: "send-reset" })}>
                  Send reset
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailsTab() {
  const [openId, setOpenId] = useState(null);
  const emailsQuery = useQuery({
    queryKey: ["admin", "emails"],
    queryFn: () => api("/api/admin/emails?limit=200"),
  });
  return (
    <div className="admin-body">
      <p className="auth-text auth-text--dim">
        The pretend inbox: every email the system would have sent, exactly as it would look.
      </p>
      <table className="admin-table">
        <thead>
          <tr>
            <th>When</th>
            <th>To</th>
            <th>Subject</th>
          </tr>
        </thead>
        <tbody>
          {(emailsQuery.data?.emails ?? []).map((m) => (
            <React.Fragment key={m.id}>
              <tr className="admin-mail-row" onClick={() => setOpenId(openId === m.id ? null : m.id)}>
                <td>{new Date(m.createdAt).toLocaleString()}</td>
                <td>{m.toEmail}</td>
                <td>{m.subject}</td>
              </tr>
              {openId === m.id ? (
                <tr>
                  <td colSpan="3">
                    <pre className="admin-mail-body">{m.bodyText}</pre>
                  </td>
                </tr>
              ) : null}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthTab() {
  const healthQuery = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => api("/api/admin/health"),
  });
  const h = healthQuery.data;
  return (
    <div className="admin-body">
      {h ? (
        <ul className="admin-health">
          <li>API: {h.ok ? "running" : "trouble"}</li>
          <li>Database: {h.db}</li>
          <li>
            Accounts: {h.users} of {h.cap}
          </li>
          <li>Emails logged: {h.emailsLogged}</li>
        </ul>
      ) : (
        <p className="auth-text">Loading…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Routes**

In `frontend/src/App.js`, import `ProfilePage` from `./components/auth/ProfilePage` and `AdminConsole` from `./components/admin/AdminConsole`, and add inside the Routes block (before the catch-all):

```js
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/admin" element={<AdminConsole />} />
```

- [ ] **Step 4: Admin styles**

Append to `frontend/src/styles.css`:

```css
/* ---- Admin console (Plan 2) ---- */
.admin-page { min-height: 100vh; background: var(--bg-base); color: var(--text); }
.admin-header {
  padding: 18px 24px 0;
  border-bottom: 1px solid var(--border);
  background: var(--bg-surface);
}
.admin-header h1 { font-size: 18px; color: var(--text-bright); margin: 10px 0 12px; }
.admin-tabs { display: flex; gap: 4px; }
.admin-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-dim);
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}
.admin-tab--on { color: var(--text-bright); border-bottom-color: var(--accent); }
.admin-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; max-width: 1000px; }
.admin-cap { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.admin-cap-input { width: 90px; }
.admin-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
.admin-btn:hover { background: var(--bg-card-hover); }
.admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-table th {
  text-align: left;
  color: var(--text-muted);
  font-weight: 500;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}
.admin-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
.admin-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.admin-mail-row { cursor: pointer; }
.admin-mail-row:hover td { background: var(--bg-hover); }
.admin-mail-body {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px;
  white-space: pre-wrap;
  font-size: 12px;
}
.admin-health { list-style: none; padding: 0; font-size: 14px; display: flex; flex-direction: column; gap: 6px; }
```

- [ ] **Step 5: Make the Help page honest (spec §17.3)**

In `frontend/src/components/HelpPage.js` around line 350, the Overview paragraph ends with "all running entirely in the browser with no installation, no accounts, and no backend." Change that clause to:

```
all running entirely in the browser with no installation required.
```

And in the `Note` block just below (the one beginning "All simulations and analyses execute locally in your browser"), replace the final sentence `No data is uploaded to any server.` with:

```
Simulations and analyses never run on a server. If you create an account, your projects can also sync to it — guests stay entirely local.
```

Nothing else in HelpPage changes.

- [ ] **Step 6: Verify**

```powershell
npm run test -w frontend
npm run build -w frontend
```

Expected: tests pass, build clean.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src
git commit -m "feat(frontend): profile screen, admin console (people/cap, pretend inbox, health), honest Help copy"
```

---

### Task 10: Wrap-up — docs and the full sweep

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: the documented account flow every later plan's instructions assume: `npm run seed` creates the admin; the pretend inbox is the email surface.

- [ ] **Step 1: Update README**

In `README.md` section 2 (the quickstart), after the `npm run db:migrate` line inside the first code block, add:

```
npm run seed       # seed settings + the admin account (admin@physics-ide.local)
```

And after that code block, add this paragraph:

```markdown
Accounts are live in local dev: sign up from the start menu (student or teacher), and manage
people, the 200-account cap, and the pretend email inbox from the admin console (sign in as the
seeded admin — dev default password `admin-dev-password`, override with `ADMIN_EMAIL` /
`ADMIN_NAME` / `ADMIN_PASSWORD` env vars before running the seed). No real email is sent in
local dev; every message lands in the admin console's Emails tab.
```

- [ ] **Step 2: The full verification sweep**

```powershell
npm run test
npm run check:blocks
npm run build -w frontend
npm run typecheck -w backend
npm run typecheck -w shared
```

Expected: every workspace green (existing suites plus all of this plan's new tests), block registry OK, build clean, both typechecks silent. Note the exact totals in the report.

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: account flow in quickstart (seeded admin, pretend inbox)"
```

---

## Completion criteria (what Plan 3 may assume)

- `POST /api/auth/signup|confirm|signin|signout|forgot|reset|change-password`, `GET/PATCH /api/auth/me` all live, validated by the shared Zod schemas, cap enforced in-transaction with the spec's verbatim refusal.
- `requireUser` / `requireAdmin` guards exist and attach `request.user`; sessions are DB rows behind the `pide_session` httpOnly cookie.
- The `Mailer` interface with its dev driver is the only email path; every message is a row in `emails`, visible in the admin console's Emails tab.
- `users`, `sessions`, `email_tokens`, `emails` tables exist in dev and test databases (migration 0001); the seed idempotently creates `account_cap` and the admin account.
- Frontend routes: `/` (the untouched IDE), `/auth/*`, `/profile`, `/admin`; `api()` client and `useMe()` are the app's way of talking to the backend.
- Guest experience is unchanged; the Help page no longer claims "no accounts, no backend".
