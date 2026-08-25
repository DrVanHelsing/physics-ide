# Classroom Platform — Plan 4: Cloud Projects & Sync

> **Stale-instruction warning — added 25 August 2026 (Plan 5 wrap-up).** This plan is an executed historical record; its task bodies are unedited. A reader must NOT follow these instructions against today's tree:
> - *"Append to `frontend/src/styles.css`"* (lines 1805, 1887, 2224) is wrong — that file is now a 17-line import manifest with load-bearing order. Shared primitives go in `primitives.css`, portal rules in `platform.css`, welcome rules in `welcome.css`.
> - *"No @testing-library — screens are verified by the controller's browser pass"* is superseded — `frontend/src/test/renderHelpers.js` is a dependency-free component-test harness and portal screens are component-tested.
> - Task 10's `FEATURES` array (lines 2133–2140) specifies **emoji icons** — a direct violation of the standing no-emoji rule (spec §18 D10). Shipped code never carried them.
> - Task 10's `WelcomeGate` code block and its four-case test specify the **superseded v1 gate**, contradicting this file's own header note and the shipped synchronous sessionStorage gate.
> - Task 10's CSS block is pre-token and dark-only; the shipped welcome styles live tokenised in `welcome.css`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spec §6.3 delivered: work saves to the student's computer first and syncs quietly to their account whenever the connection allows — a truthful status chip, most-recent-edit-wins with the losing version kept in history, projects following the student between machines, and §3.2's guest-project import offer at first sign-in. The guest IDE keeps working exactly as today with zero network dependence.

**Architecture:** The server gains `projects` (one row per project, owner-scoped, the manifest as jsonb, the CLIENT's `updatedAt` as the most-recent-wins comparison key) and `project_versions` (append-only history: every overwritten head and every conflict loser is retained — the §8.1 growth-history foundation). The frontend gains a `sync/` layer that never touches manifest shapes (sync metadata lives in a separate localForage store, so `SCHEMA_VERSION` stays 2): a debounced editor→manifest autosave (closing today's gap where edits only reached the legacy blob), a push-after-save queue, and a reconcile pass on sign-in/online/focus that pulls newer remotes with timestamp preservation. Conflict losers are never destroyed — the server archives them; the client trusts the server's verdict.

**Tech Stack:** existing only (Fastify 5, Drizzle, Postgres 16 :5433, Zod, React 18, TanStack Query 5, localForage, Vitest 4). **No new dependencies.**

**Spec:** [docs/classroom-platform.md](../../classroom-platform.md) §3.2 (guests becoming members), §6.3 (saving — the part that must never fail), §8.1 (growth history), §15.2 (most-recent-wins), §15.7 (storage allowance) and [docs/classroom-platform-stack.md](../../classroom-platform-stack.md) §4.

## Global Constraints

- **Local-first is inviolable.** Every existing local save path keeps working unchanged when signed out or offline; sync failures NEVER block, delay, or error a local save. The guest experience does not touch the network.
- **Manifest schema untouched.** `SCHEMA_VERSION` stays 2; no new manifest fields. Sync metadata lives in a NEW localForage store (`sync-meta:{projectId}` → `{ownerId, remoteUpdatedAt, lastPushedAt}`), keyed alongside but never inside manifests.
- **Most-recent-edit-wins by the manifest's `updatedAt`** (client epoch ms), exactly spec §15.2. The server compares incoming `manifest.updatedAt` against the stored head's; the loser — whichever it is — is written to `project_versions`, never discarded. Ties (equal ms) count as "newer" (idempotent re-push).
- **Timestamps:** `saveProject` gains an opts parameter `{preserveTimestamp: true}` used ONLY by sync-pulled writes, so a remote manifest keeps its own `updatedAt` locally. Default behaviour (stamp now) is unchanged for every existing caller.
- **Sync requires a signed-in session only** (`requireUser`, not `requireConfirmed`) — an unconfirmed student must not lose work; spec §3.1 restricts joining/submitting, not personal saves.
- **Ownership:** every `/api/projects*` route is owner-scoped by the session user; another user's project id returns 404 `No such project.` (no existence oracle). Project ids are client-minted (`p-…` strings ≤ 64 chars, validated shape) — the (ownerId, id) pair is unique; two users can hold the same id without collision (id is the PRIMARY KEY only together with owner).
- **Caps (spec §15.7 "generous for real use, fatal for abuse"):** ≤ **100 projects per account** (`You've reached the 100-project limit — delete something first.`), manifest jsonb ≤ **400 KB serialized** (`This project is too large to sync. Export it as a file instead.`), history pruned to the **most recent 20 versions per project**. All checked server-side; the client surfaces the server sentence verbatim.
- **Deletes are tombstones** (`deletedAt`) so other devices converge; tombstoned heads keep their versions until a later data-requests plan. Reconcile treats a remote tombstone as authoritative: the local copy and its sync-meta are removed (the tombstone row retains the last head in `project_versions` first — nothing is ever silently destroyed).
- **Events:** `project.deleted` and `project.restored` only (owner-actor). Routine sync pushes are NOT events (audit noise; history lives in `project_versions`, which carries `savedBy`).
- **The status chip** (spec §6.3 verbatim copy): signed-in it shows `Saved on this computer · Synced` / `Saved on this computer · Waiting for connection` / `Saved on this computer · Sync error`; signed-out it shows nothing (guest UI unchanged).
- **Fresh-device ordering:** when a signed-in reconcile runs, the legacy-v1 "Recovered project" bootstrap must NOT race it — resurrection only happens when the local list is empty AND the account's cloud list is empty (or the user is signed out).
- **Frontend stays JavaScript; frontend tests stay pure-module** (established ruling — sync engine and stores are written as injectable pure modules precisely so they're testable without component rendering; screens verified by the controller's browser pass). Backend/shared TS strict, NodeNext `.js` extensions.
- Banned tech stands (no websockets — sync is pull/push over plain HTTP). Ports 3000/4000/5433; every task commits on `feature/classroom-platform`; backend tests use testClient helpers, `fileParallelism: false` stands.
- Plan-3 backlog folded in where it touches these files: none of these routes needs the archived-check helper (no classes involved); the invite upgrade-only guard is NOT this plan's scope.

**Deferred (spec'd or noted, deliberately NOT here — do not flag as missing):** run-trace externalization/pruning inside manifests (the 400 KB cap is the guard; a storage plan can offload `runs[].trace` later); project sharing/attribution ledger (spec §8.3 — lands with sharing); the student Home screen's "due soon"/"recent feedback" (assignments plan); admin storage-usage panel (§10 — needs aggregate queries; later); data export/erasure (§10/§11); retiring the legacy 2-second localStorage autosave (kept as the crash-safety net; revisit when the debounced manifest autosave has soaked); teacher starter-project pinning (assignments plan); **the student-facing history/restore screen** (§6.3's "look back through and restore" — the API lands here in Task 3; the screen lands with the timeline UI in the assignments plan, next to §7.2's teacher timeline, so history gets ONE consistent viewer).

---

### Task 1: Backend — projects & project_versions tables

**Files:**
- Modify: `backend/src/db/schema.ts`, `backend/src/db/testClient.ts`
- Create: `backend/src/db/schema.projects.test.ts`
- Generated: `backend/drizzle/0003_*.sql` + meta

**Interfaces:**
- Produces: tables `projects` (composite pk `(owner_id, id)`), `projectVersions`; `truncateAuthTables()` also wipes both.
- Column contract: `projects.id` text (client-minted `p-…`); `manifest` jsonb NOT NULL; `clientUpdatedAt` bigint (epoch ms) NOT NULL; `deletedAt` timestamptz nullable; `projectVersions` references the head by (ownerId, projectId) with cascade, carries `manifest`, `clientUpdatedAt`, `savedBy`, `reason` text (`"overwrite" | "conflict-loser" | "restore"`), `createdAt`.

- [ ] **Step 1: Extend the schema**

Append to `backend/src/db/schema.ts` (add `bigint`, `primaryKey`, `index` to the drizzle-orm/pg-core import as needed — `unique` is already there):

```ts
/** Cloud copies of local-first projects (spec §6.3). id is CLIENT-minted; pk is (owner, id). */
export const projects = pgTable(
  "projects",
  {
    id: text("id").notNull(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    goal: text("goal").notNull(),
    projectType: text("project_type").notNull(),
    manifest: jsonb("manifest").notNull(),
    /** The manifest's own updatedAt (epoch ms) — the most-recent-wins key (spec §15.2). */
    clientUpdatedAt: bigint("client_updated_at", { mode: "number" }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.id] })],
);

/** Append-only history: overwritten heads, conflict losers, restore snapshots (spec §6.3/§8.1). */
export const projectVersions = pgTable(
  "project_versions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    projectId: text("project_id").notNull(),
    manifest: jsonb("manifest").notNull(),
    clientUpdatedAt: bigint("client_updated_at", { mode: "number" }).notNull(),
    savedBy: uuid("saved_by").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("project_versions_owner_project_idx").on(t.ownerId, t.projectId),
    foreignKey({
      columns: [t.ownerId, t.projectId],
      foreignColumns: [projects.ownerId, projects.id],
    }).onDelete("cascade"),
  ],
);
```

(`foreignKey` also joins the pg-core import.)

Update `truncateAuthTables()` in `backend/src/db/testClient.ts`: prepend `"project_versions", "projects", ` to the TRUNCATE list (before `"invites"`).

- [ ] **Step 2: Generate and apply to BOTH databases**

```powershell
npm run db:generate -w backend
npm run db:migrate -w backend
npm run db:migrate:test -w backend
```

Expected: `backend/drizzle/0003_*.sql` creating both tables with the composite pk and composite FK; both migrates exit 0.

- [ ] **Step 3: Round-trip test**

Create `backend/src/db/schema.projects.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { testDb, testPool, truncateAuthTables } from "./testClient.js";
import { users, projects, projectVersions } from "./schema.js";

let ownerA: string;
let ownerB: string;

beforeAll(async () => {
  await truncateAuthTables();
  const [a] = await testDb
    .insert(users)
    .values({ name: "A", email: "pa@example.com", passwordHash: "x", consentAt: new Date() })
    .returning();
  const [b] = await testDb
    .insert(users)
    .values({ name: "B", email: "pb@example.com", passwordHash: "x", consentAt: new Date() })
    .returning();
  ownerA = a.id;
  ownerB = b.id;
});

afterAll(async () => {
  await testPool.end();
});

describe("projects schema", () => {
  test("same client id may exist under two owners (composite pk)", async () => {
    const base = {
      id: "p-shared-id",
      title: "T",
      goal: "physics",
      projectType: "custom",
      manifest: { schemaVersion: 2 },
      clientUpdatedAt: 1000,
    };
    await testDb.insert(projects).values({ ...base, ownerId: ownerA });
    await testDb.insert(projects).values({ ...base, ownerId: ownerB });
    const rows = await testDb.select().from(projects).where(eq(projects.id, "p-shared-id"));
    expect(rows).toHaveLength(2);
  });

  test("duplicate (owner, id) violates the pk", async () => {
    await expect(
      testDb.insert(projects).values({
        id: "p-shared-id",
        ownerId: ownerA,
        title: "Dup",
        goal: "physics",
        projectType: "custom",
        manifest: {},
        clientUpdatedAt: 1,
      }),
    ).rejects.toSatisfy(
      (e: { code?: string; cause?: { code?: string } }) =>
        e.code === "23505" || e.cause?.code === "23505",
    );
  });

  test("deleting a head cascades its versions", async () => {
    await testDb.insert(projectVersions).values({
      ownerId: ownerA,
      projectId: "p-shared-id",
      manifest: { schemaVersion: 2 },
      clientUpdatedAt: 999,
      savedBy: ownerA,
      reason: "overwrite",
    });
    await testDb
      .delete(projects)
      .where(and(eq(projects.ownerId, ownerA), eq(projects.id, "p-shared-id")));
    const left = await testDb
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.ownerId, ownerA), eq(projectVersions.projectId, "p-shared-id")));
    expect(left).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: green (87 existing + 3 new), silent.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/db backend/drizzle
git commit -m "feat(backend): projects and project_versions tables (migration 0003)"
```

---

### Task 2: Backend — sync API (list/get/put/delete) with most-recent-wins

**Files:**
- Create: `backend/src/routes/projects.ts`, `backend/src/routes/projects.test.ts`
- Modify: `backend/src/app.ts` (register)

**Interfaces:**
- Consumes: Task 1 tables; `requireUser`; `logEvent`.
- Produces: `GET /api/projects` → `{projects: [{id, title, goal, projectType, clientUpdatedAt, deleted}]}` (tombstones included with `deleted: true`, no manifest); `GET /api/projects/:id` → `{project: {id, clientUpdatedAt, manifest}}` (404 for tombstoned/missing/foreign); `PUT /api/projects/:id` body `{manifest}` → `{outcome: "saved"} | {outcome: "kept-remote", project: {id, clientUpdatedAt, manifest}}`; `DELETE /api/projects/:id` → `{ok: true}` (idempotent). Constants `MAX_PROJECTS_PER_USER = 100`, `MAX_MANIFEST_BYTES = 400 * 1024`, `MAX_VERSIONS_PER_PROJECT = 20` exported for Task 3 and tests.
- Error sentences verbatim: `No such project.` / `You've reached the 100-project limit — delete something first.` / `This project is too large to sync. Export it as a file instead.` / `That doesn't look like a valid project.`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/routes/projects.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users, projects, projectVersions } from "../db/schema.js";

const app = buildApp({ db: testDb });
let cookieA: string;
let cookieB: string;

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    id: "p-sync-1",
    title: "Sync Me",
    goal: "physics",
    projectType: "custom",
    preferredEditor: "blocks",
    beginnerEnabled: false,
    createdAt: 1000,
    updatedAt: 2000,
    workspace: { xml: "<xml/>" },
    source: { python: "print(1)" },
    datasets: [],
    runs: [],
    chartSpecs: [],
    notes: [],
    checkpointState: {},
    ...overrides,
  };
}

async function makeUser(email: string) {
  await testDb.insert(users).values({
    name: email.split("@")[0],
    email,
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
}

async function signin(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email, password: "a-long-password" },
  });
  return res.cookies.find((c) => c.name === "pide_session")!.value;
}

async function put(cookie: string, id: string, m: Record<string, unknown>) {
  return app.inject({
    method: "PUT",
    url: `/api/projects/${id}`,
    cookies: { pide_session: cookie },
    payload: { manifest: m },
  });
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await makeUser("synca@example.com");
  await makeUser("syncb@example.com");
  cookieA = await signin("synca@example.com");
  cookieB = await signin("syncb@example.com");
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("PUT /api/projects/:id", () => {
  test("first push creates the head; list and get see it", async () => {
    const res = await put(cookieA, "p-sync-1", manifest());
    expect(res.statusCode).toBe(200);
    expect(res.json().outcome).toBe("saved");

    const list = await app.inject({
      method: "GET",
      url: "/api/projects",
      cookies: { pide_session: cookieA },
    });
    expect(list.json().projects).toHaveLength(1);
    expect(list.json().projects[0]).toMatchObject({
      id: "p-sync-1",
      clientUpdatedAt: 2000,
      deleted: false,
    });

    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(got.json().project.manifest.title).toBe("Sync Me");
  });

  test("newer push wins and archives the old head as a version", async () => {
    const res = await put(cookieA, "p-sync-1", manifest({ updatedAt: 3000, title: "Newer" }));
    expect(res.json().outcome).toBe("saved");
    const versions = await testDb
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, "p-sync-1"));
    expect(versions).toHaveLength(1);
    expect(versions[0].reason).toBe("overwrite");
    expect(versions[0].clientUpdatedAt).toBe(2000);
  });

  test("older push loses: head untouched, loser archived, remote returned", async () => {
    const res = await put(cookieA, "p-sync-1", manifest({ updatedAt: 2500, title: "Stale" }));
    expect(res.statusCode).toBe(200);
    expect(res.json().outcome).toBe("kept-remote");
    expect(res.json().project.manifest.title).toBe("Newer");
    expect(res.json().project.clientUpdatedAt).toBe(3000);

    const losers = await testDb
      .select()
      .from(projectVersions)
      .where(
        and(eq(projectVersions.projectId, "p-sync-1"), eq(projectVersions.reason, "conflict-loser")),
      );
    expect(losers).toHaveLength(1);
    expect(losers[0].clientUpdatedAt).toBe(2500);
  });

  test("equal timestamp re-push is idempotent-saved (no version spam)", async () => {
    const before = (
      await testDb.select().from(projectVersions).where(eq(projectVersions.projectId, "p-sync-1"))
    ).length;
    const res = await put(cookieA, "p-sync-1", manifest({ updatedAt: 3000, title: "Newer" }));
    expect(res.json().outcome).toBe("saved");
    const after = (
      await testDb.select().from(projectVersions).where(eq(projectVersions.projectId, "p-sync-1"))
    ).length;
    expect(after).toBe(before);
  });

  test("manifest id must match the URL id; malformed manifests refused", async () => {
    const bad = await put(cookieA, "p-other", manifest());
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe("That doesn't look like a valid project.");
    const junk = await put(cookieA, "p-junk", { manifest: "nope" } as never);
    expect(junk.statusCode).toBe(400);
  });

  test("oversized manifests are refused with the exact sentence", async () => {
    const res = await put(
      cookieA,
      "p-big",
      manifest({ id: "p-big", workspace: { xml: "x".repeat(400 * 1024) } }),
    );
    expect(res.statusCode).toBe(413);
    expect(res.json().error).toBe("This project is too large to sync. Export it as a file instead.");
  });

  test("owner isolation: B cannot read or overwrite A's project", async () => {
    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieB },
    });
    expect(got.statusCode).toBe(404);
    expect(got.json().error).toBe("No such project.");
    // B pushing the same id creates B's OWN head, untouched A's
    const res = await put(cookieB, "p-sync-1", manifest({ title: "B's copy" }));
    expect(res.json().outcome).toBe("saved");
    const rows = await testDb.select().from(projects).where(eq(projects.id, "p-sync-1"));
    expect(rows).toHaveLength(2);
  });
});

describe("DELETE and tombstones", () => {
  test("delete tombstones: list shows deleted, get 404s, delete is idempotent, event logged", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(res.statusCode).toBe(200);
    const list = await app.inject({
      method: "GET",
      url: "/api/projects",
      cookies: { pide_session: cookieA },
    });
    expect(list.json().projects.find((p: { id: string }) => p.id === "p-sync-1").deleted).toBe(true);
    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(got.statusCode).toBe(404);
    const again = await app.inject({
      method: "DELETE",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(again.statusCode).toBe(200);
  });

  test("pushing NEWER content to a tombstone revives it", async () => {
    const res = await put(cookieA, "p-sync-1", manifest({ updatedAt: 9000, title: "Revived" }));
    expect(res.json().outcome).toBe("saved");
    const got = await app.inject({
      method: "GET",
      url: "/api/projects/p-sync-1",
      cookies: { pide_session: cookieA },
    });
    expect(got.statusCode).toBe(200);
    expect(got.json().project.manifest.title).toBe("Revived");
  });
});

describe("the 100-project cap", () => {
  test("project 101 is refused with the exact sentence", async () => {
    const countRows = await testDb
      .select()
      .from(projects)
      .where(eq(projects.ownerId, (await testDb.select().from(users).where(eq(users.email, "syncb@example.com")))[0].id));
    const start = countRows.length;
    for (let i = start; i < 100; i++) {
      const r = await put(cookieB, `p-cap-${i}`, manifest({ id: `p-cap-${i}` }));
      expect(r.json().outcome).toBe("saved");
    }
    const over = await put(cookieB, "p-cap-overflow", manifest({ id: "p-cap-overflow" }));
    expect(over.statusCode).toBe(403);
    expect(over.json().error).toBe("You've reached the 100-project limit — delete something first.");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```powershell
npm run test -w backend
```

Expected: FAIL — project routes 404.

- [ ] **Step 3: Implement**

Create `backend/src/routes/projects.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { projects, projectVersions, users } from "../db/schema.js";
import { requireUser } from "../auth/guards.js";
import { logEvent } from "../db/events.js";

export const MAX_PROJECTS_PER_USER = 100;
export const MAX_MANIFEST_BYTES = 400 * 1024;
export const MAX_VERSIONS_PER_PROJECT = 20;

const PROJECT_ID_REGEX = /^p-[A-Za-z0-9-]{4,60}$/;

/** Just enough shape-checking to store it; the client owns full validation. */
const ManifestSchema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().regex(PROJECT_ID_REGEX),
    title: z.string().min(1).max(200),
    goal: z.string().min(1).max(40),
    projectType: z.string().min(1).max(40),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .passthrough();

async function pruneVersions(
  db: FastifyInstance["db"],
  ownerId: string,
  projectId: string,
): Promise<void> {
  await db.execute(sql`
    DELETE FROM project_versions
    WHERE owner_id = ${ownerId} AND project_id = ${projectId}
      AND id NOT IN (
        SELECT id FROM project_versions
        WHERE owner_id = ${ownerId} AND project_id = ${projectId}
        ORDER BY id DESC LIMIT ${MAX_VERSIONS_PER_PROJECT}
      )
  `);
}

export function projectRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireUser);

  app.get("/api/projects", async (req) => {
    const rows = await app.db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, req.user!.id));
    return {
      projects: rows.map((r) => ({
        id: r.id,
        title: r.title,
        goal: r.goal,
        projectType: r.projectType,
        clientUpdatedAt: r.clientUpdatedAt,
        deleted: r.deletedAt !== null,
      })),
    };
  });

  app.get("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rows = await app.db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
    const row = rows[0];
    if (!row || row.deletedAt) return reply.code(404).send({ error: "No such project." });
    return { project: { id: row.id, clientUpdatedAt: row.clientUpdatedAt, manifest: row.manifest } };
  });

  app.put("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { manifest?: unknown };
    const parsed = ManifestSchema.safeParse(body?.manifest);
    if (!parsed.success || parsed.data.id !== id || !PROJECT_ID_REGEX.test(id)) {
      return reply.code(400).send({ error: "That doesn't look like a valid project." });
    }
    const m = parsed.data;
    if (Buffer.byteLength(JSON.stringify(m), "utf8") > MAX_MANIFEST_BYTES) {
      return reply
        .code(413)
        .send({ error: "This project is too large to sync. Export it as a file instead." });
    }

    const result = await app.db.transaction(async (tx) => {
      // Updates serialize on the head row lock; creations lock the owner row
      // below so two concurrent first-pushes cannot race past the cap check.
      const existing = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)))
        .for("update");
      const head = existing[0];

      if (!head) {
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, req.user!.id))
          .for("update");
        const [{ count }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(projects)
          .where(and(eq(projects.ownerId, req.user!.id), sql`deleted_at IS NULL`));
        if (count >= MAX_PROJECTS_PER_USER) return { kind: "cap" as const };
        await tx.insert(projects).values({
          id,
          ownerId: req.user!.id,
          title: m.title,
          goal: m.goal,
          projectType: m.projectType,
          manifest: m,
          clientUpdatedAt: m.updatedAt,
        });
        return { kind: "saved" as const };
      }

      if (!head.deletedAt && m.updatedAt < head.clientUpdatedAt) {
        // Incoming is stale: archive the LOSER, keep the head (spec §15.2 + §6.3 history).
        await tx.insert(projectVersions).values({
          ownerId: req.user!.id,
          projectId: id,
          manifest: m,
          clientUpdatedAt: m.updatedAt,
          savedBy: req.user!.id,
          reason: "conflict-loser",
        });
        return { kind: "kept-remote" as const, head };
      }

      if (m.updatedAt !== head.clientUpdatedAt || head.deletedAt) {
        // Newer (or reviving a tombstone): archive the PREVIOUS head, then overwrite.
        await tx.insert(projectVersions).values({
          ownerId: req.user!.id,
          projectId: id,
          manifest: head.manifest,
          clientUpdatedAt: head.clientUpdatedAt,
          savedBy: req.user!.id,
          reason: "overwrite",
        });
      } else {
        return { kind: "saved" as const }; // equal-ms idempotent re-push: nothing to do
      }
      await tx
        .update(projects)
        .set({
          title: m.title,
          goal: m.goal,
          projectType: m.projectType,
          manifest: m,
          clientUpdatedAt: m.updatedAt,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
      return { kind: "saved" as const };
    });

    if (result.kind === "cap") {
      return reply
        .code(403)
        .send({ error: "You've reached the 100-project limit — delete something first." });
    }
    await pruneVersions(app.db, req.user!.id, id);
    if (result.kind === "kept-remote") {
      return {
        outcome: "kept-remote",
        project: {
          id,
          clientUpdatedAt: result.head.clientUpdatedAt,
          manifest: result.head.manifest,
        },
      };
    }
    return { outcome: "saved" };
  });

  app.delete("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    await app.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)))
        .for("update");
      const head = rows[0];
      if (!head || head.deletedAt) return; // idempotent
      await tx.insert(projectVersions).values({
        ownerId: req.user!.id,
        projectId: id,
        manifest: head.manifest,
        clientUpdatedAt: head.clientUpdatedAt,
        savedBy: req.user!.id,
        reason: "overwrite",
      });
      await tx
        .update(projects)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
      await logEvent(tx, "project.deleted", req.user!.id, { projectId: id });
    });
    void reply;
    return { ok: true };
  });
}
```

Register in `backend/src/app.ts`: import `projectRoutes` from `./routes/projects.js`, add `app.register(projectRoutes);` after `inviteRoutes`.

- [ ] **Step 4: Run tests and typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: green, silent. (The cap test pushes ~100 projects — expect this file to take a few extra seconds; that is acceptable.)

- [ ] **Step 5: Commit**

```powershell
git add backend/src
git commit -m "feat(backend): project sync API — most-recent-wins with archived losers, tombstones, caps"
```

---

### Task 3: Backend — version history list & restore

**Files:**
- Create: `backend/src/routes/projects.versions.test.ts`
- Modify: `backend/src/routes/projects.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces: `GET /api/projects/:id/versions` → `{versions: [{versionId, clientUpdatedAt, reason, savedAt}]}` newest-first (head NOT included); `POST /api/projects/:id/versions/:versionId/restore` → `{ok: true, clientUpdatedAt}` — writes the version's manifest as the new head with `clientUpdatedAt = Date.now()` (a restore IS a new edit; spec "restore" §6.3), archiving the current head with reason `"restore"`, event `project.restored`.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/routes/projects.versions.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { buildApp } from "../app.js";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { setSetting } from "../db/settings.js";
import { users } from "../db/schema.js";

const app = buildApp({ db: testDb });
let cookie: string;

function manifest(updatedAt: number, title: string) {
  return {
    schemaVersion: 2,
    id: "p-hist-1",
    title,
    goal: "physics",
    projectType: "custom",
    createdAt: 1,
    updatedAt,
  };
}

beforeAll(async () => {
  await truncateAuthTables();
  await setSetting(testDb, "account_cap", 200);
  await testDb.insert(users).values({
    name: "H",
    email: "hist@example.com",
    passwordHash: await argon2.hash("a-long-password", { type: argon2.argon2id }),
    emailConfirmedAt: new Date(),
    consentAt: new Date(),
  });
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/signin",
    payload: { email: "hist@example.com", password: "a-long-password" },
  });
  cookie = res.cookies.find((c) => c.name === "pide_session")!.value;
  for (const [ts, title] of [
    [1000, "v1"],
    [2000, "v2"],
    [3000, "v3"],
  ] as const) {
    await app.inject({
      method: "PUT",
      url: "/api/projects/p-hist-1",
      cookies: { pide_session: cookie },
      payload: { manifest: manifest(ts, title) },
    });
  }
});

afterAll(async () => {
  await app.close();
  await testPool.end();
});

describe("version history", () => {
  test("lists archived heads newest-first, without the live head", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/projects/p-hist-1/versions",
      cookies: { pide_session: cookie },
    });
    expect(res.statusCode).toBe(200);
    const v = res.json().versions as Array<{ clientUpdatedAt: number; reason: string }>;
    expect(v.map((x) => x.clientUpdatedAt)).toEqual([2000, 1000]);
    expect(v.every((x) => x.reason === "overwrite")).toBe(true);
  });

  test("restore makes the old content the new head with a FRESH timestamp", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/projects/p-hist-1/versions",
      cookies: { pide_session: cookie },
    });
    const v1 = list.json().versions.find((x: { clientUpdatedAt: number }) => x.clientUpdatedAt === 1000);
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/p-hist-1/versions/${v1.versionId}/restore`,
      cookies: { pide_session: cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().clientUpdatedAt).toBeGreaterThan(3000);

    const head = await app.inject({
      method: "GET",
      url: "/api/projects/p-hist-1",
      cookies: { pide_session: cookie },
    });
    expect(head.json().project.manifest.title).toBe("v1");
    expect(head.json().project.manifest.updatedAt).toBe(res.json().clientUpdatedAt);

    const after = await app.inject({
      method: "GET",
      url: "/api/projects/p-hist-1/versions",
      cookies: { pide_session: cookie },
    });
    expect(after.json().versions.some((x: { reason: string }) => x.reason === "restore")).toBe(true);
  });

  test("restoring a foreign or unknown version 404s", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/projects/p-hist-1/versions/999999/restore",
      cookies: { pide_session: cookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("No such version.");
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

Add to `backend/src/routes/projects.ts`, inside `projectRoutes` (extend the drizzle import with `desc`):

```ts
  app.get("/api/projects/:id/versions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const heads = await app.db
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
    if (!heads[0]) return reply.code(404).send({ error: "No such project." });
    const rows = await app.db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.ownerId, req.user!.id), eq(projectVersions.projectId, id)))
      .orderBy(desc(projectVersions.id));
    return {
      versions: rows.map((v) => ({
        versionId: v.id,
        clientUpdatedAt: v.clientUpdatedAt,
        reason: v.reason,
        savedAt: v.createdAt.toISOString(),
      })),
    };
  });

  app.post("/api/projects/:id/versions/:versionId/restore", async (req, reply) => {
    const { id, versionId } = req.params as { id: string; versionId: string };
    const vid = Number(versionId);
    if (!Number.isInteger(vid)) return reply.code(404).send({ error: "No such version." });
    const now = Date.now();
    const done = await app.db.transaction(async (tx) => {
      const heads = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)))
        .for("update");
      const head = heads[0];
      if (!head) return false;
      const versions = await tx
        .select()
        .from(projectVersions)
        .where(
          and(
            eq(projectVersions.id, vid),
            eq(projectVersions.ownerId, req.user!.id),
            eq(projectVersions.projectId, id),
          ),
        );
      const version = versions[0];
      if (!version) return false;
      await tx.insert(projectVersions).values({
        ownerId: req.user!.id,
        projectId: id,
        manifest: head.manifest,
        clientUpdatedAt: head.clientUpdatedAt,
        savedBy: req.user!.id,
        reason: "restore",
      });
      const restored = { ...(version.manifest as Record<string, unknown>), updatedAt: now };
      await tx
        .update(projects)
        .set({
          manifest: restored,
          clientUpdatedAt: now,
          title: (restored.title as string) ?? head.title,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.ownerId, req.user!.id), eq(projects.id, id)));
      await logEvent(tx, "project.restored", req.user!.id, { projectId: id, versionId: vid });
      return true;
    });
    if (!done) return reply.code(404).send({ error: "No such version." });
    await pruneVersions(app.db, req.user!.id, id);
    return { ok: true, clientUpdatedAt: now };
  });
```

- [ ] **Step 3: Run tests and typecheck; commit**

```powershell
npm run test -w backend
npm run typecheck -w backend
git add backend/src
git commit -m "feat(backend): project version history — list and restore with fresh-edit semantics"
```

---

### Task 4: Frontend — timestamp preservation & the sync-meta store

**Files:**
- Modify: `frontend/src/utils/storage/projectStore.js`
- Create: `frontend/src/utils/storage/syncMeta.js`, `frontend/src/utils/storage/__tests__/syncMeta.test.js`
- Test (modify): `frontend/src/utils/storage/__tests__/projectStore.test.js` (append one describe)

**Interfaces:**
- Produces: `saveProject(manifest, opts = {})` where `opts.preserveTimestamp === true` skips the `updatedAt` stamp (all existing callers unchanged — default behaviour identical); syncMeta exports `getSyncMeta(projectId)`, `setSyncMeta(projectId, {ownerId, remoteUpdatedAt, lastPushedAt})`, `deleteSyncMeta(projectId)`, `listSyncMeta()` → `{[projectId]: meta}`, backed by a localForage instance `storeName: "sync-meta"`, keys `sync-meta:{projectId}`.

- [ ] **Step 1: The one-line store change (with its test first)**

Append to `frontend/src/utils/storage/__tests__/projectStore.test.js` (follow the file's existing setup pattern — read it first):

```js
describe("saveProject timestamp preservation (sync)", () => {
  test("default stamps now; preserveTimestamp keeps the manifest's own updatedAt", async () => {
    const m = createManifest({ goal: "physics" });
    m.updatedAt = 12345;
    const stamped = await saveProject(m);
    expect(stamped.updatedAt).toBeGreaterThan(12345);

    const pulled = { ...stamped, updatedAt: 99999, title: "From cloud" };
    const preserved = await saveProject(pulled, { preserveTimestamp: true });
    expect(preserved.updatedAt).toBe(99999);
    const reloaded = await loadProject(m.id);
    expect(reloaded.updatedAt).toBe(99999);
    expect(reloaded.title).toBe("From cloud");
  });
});
```

(`createManifest` is already among the test file's imports; the file uses vitest globals — plain `describe`/`test`/`expect`, no vitest import.)

In `frontend/src/utils/storage/projectStore.js`, change `saveProject` (ONLY the stamping branch changes — validation stays exactly as-is):

```js
export async function saveProject(manifest, opts = {}) {
  if (!isManifest(manifest)) {
    throw new Error(`saveProject: ${explainManifest(manifest) || "invalid manifest"}`);
  }
  const stamped = opts.preserveTimestamp
    ? { ...manifest }
    : { ...manifest, updatedAt: Date.now() };
  await projectStore.setItem(MANIFEST_PREFIX + stamped.id, stamped);
  await upsertSummary(stamped);
  return stamped;
}
```

- [ ] **Step 2: syncMeta store (test first)**

Create `frontend/src/utils/storage/__tests__/syncMeta.test.js`:

```js
import { describe, test, expect, beforeEach } from "vitest";
import {
  getSyncMeta,
  setSyncMeta,
  deleteSyncMeta,
  listSyncMeta,
  _resetSyncMetaForTests,
} from "../syncMeta";

beforeEach(async () => {
  await _resetSyncMetaForTests();
});

describe("sync-meta store", () => {
  test("set/get/list/delete round-trip", async () => {
    expect(await getSyncMeta("p-1")).toBeNull();
    await setSyncMeta("p-1", { ownerId: "u-1", remoteUpdatedAt: 100, lastPushedAt: 200 });
    expect(await getSyncMeta("p-1")).toEqual({
      ownerId: "u-1",
      remoteUpdatedAt: 100,
      lastPushedAt: 200,
    });
    await setSyncMeta("p-2", { ownerId: "u-1", remoteUpdatedAt: 1, lastPushedAt: 1 });
    const all = await listSyncMeta();
    expect(Object.keys(all).sort()).toEqual(["p-1", "p-2"]);
    await deleteSyncMeta("p-1");
    expect(await getSyncMeta("p-1")).toBeNull();
  });
});
```

Create `frontend/src/utils/storage/syncMeta.js`:

```js
/**
 * Sync metadata — deliberately OUTSIDE manifests so SCHEMA_VERSION stays 2.
 * One record per project: { ownerId, remoteUpdatedAt, lastPushedAt }.
 */
import localforage from "localforage";

const metaStore = localforage.createInstance({
  name: "physics-ide",
  storeName: "sync-meta",
});

const PREFIX = "sync-meta:";

export async function getSyncMeta(projectId) {
  const v = await metaStore.getItem(PREFIX + projectId);
  return v || null;
}

export async function setSyncMeta(projectId, meta) {
  await metaStore.setItem(PREFIX + projectId, {
    ownerId: meta.ownerId,
    remoteUpdatedAt: meta.remoteUpdatedAt,
    lastPushedAt: meta.lastPushedAt,
  });
}

export async function deleteSyncMeta(projectId) {
  await metaStore.removeItem(PREFIX + projectId);
}

export async function listSyncMeta() {
  const out = {};
  await metaStore.iterate((value, key) => {
    if (key.startsWith(PREFIX)) out[key.slice(PREFIX.length)] = value;
  });
  return out;
}

export async function _resetSyncMetaForTests() {
  await metaStore.clear();
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git add frontend/src
git commit -m "feat(frontend): saveProject timestamp preservation; sync-meta store beside manifests"
```

---

### Task 5: Frontend — debounced editor→manifest autosave

Today NOTHING calls `saveCurrent()` from the UI; edits only reach the legacy localStorage blob. Sync would push stale manifests. This task closes that gap for everyone (guests included — it's a pure local-persistence improvement).

**Files:**
- Modify: `frontend/src/hooks/useProject.js`
- Create: `frontend/src/utils/debounce.js`, `frontend/src/utils/__tests__/debounce.test.js`

**Interfaces:**
- Produces: `debounce(fn, waitMs)` (trailing-edge, with `.cancel()` and `.flush()`); `useProject` gains an internal effect that watches the working state (the same values `captureWorkingStateInto` reads — python source, workspace XML, editor mode) and calls `saveCurrent()` **3000 ms** after the last change while a project is open. `saveCurrent` itself is unchanged. Export the constant `MANIFEST_AUTOSAVE_MS = 3000` from `frontend/src/constants/index.js`.

- [ ] **Step 1: debounce (test first)**

Create `frontend/src/utils/__tests__/debounce.test.js`:

```js
import { describe, test, expect, vi } from "vitest";
import { debounce } from "../debounce";

describe("debounce", () => {
  test("trailing edge: one call after the wait; cancel and flush behave", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d("a");
    d("b");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith("b");

    d("c");
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);

    d("d");
    d.flush();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("d");
    vi.useRealTimers();
  });
});
```

Create `frontend/src/utils/debounce.js`:

```js
/** Trailing-edge debounce with cancel() and flush(). */
export function debounce(fn, waitMs) {
  let timer = null;
  let lastArgs = null;
  const debounced = (...args) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, waitMs);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn(...lastArgs);
    }
  };
  return debounced;
}
```

- [ ] **Step 2: Wire the autosave into useProject**

Add to `frontend/src/constants/index.js`:

```js
export const MANIFEST_AUTOSAVE_MS = 3000;
```

In `frontend/src/hooks/useProject.js` (verified: the hook reads `const proj = useProjectContext()` and `const sim = useSimulationContext()`; the working state is the reactive context values `sim.pythonCode`, `sim.workspaceXml`, `sim.mode`, `sim.projectType`, exactly what `captureWorkingStateInto` consumes; `useProject()` is mounted in exactly ONE component — IDELayout — so this effect registers once). Extend the react import to `{ useCallback, useEffect, useRef }`, add `import { debounce } from "../utils/debounce";` and `import { MANIFEST_AUTOSAVE_MS } from "../constants";`, then add inside the hook, after `saveCurrent` is defined:

```js
  // Debounced editor→manifest autosave: edits reach the manifest (and thus sync)
  // without waiting for a project switch. Guests benefit too (pure local persistence).
  const saveCurrentRef = useRef(saveCurrent);
  useEffect(() => {
    saveCurrentRef.current = saveCurrent;
  });
  const debouncedSaveRef = useRef(null);
  if (!debouncedSaveRef.current) {
    debouncedSaveRef.current = debounce(() => {
      saveCurrentRef.current?.();
    }, MANIFEST_AUTOSAVE_MS);
  }
  useEffect(() => {
    if (!proj.activeProjectId || !proj.activeManifest) return;
    // Dirty check: opening a project pushes its fields INTO sim, which fires
    // this effect too. Saving then would restamp updatedAt — and with sync,
    // merely opening a stale offline copy would claim most-recent-wins
    // recency. Only schedule a save when sim actually differs from the
    // persisted manifest.
    const m = proj.activeManifest;
    const unchanged =
      (m.source?.python || "") === (sim.pythonCode || "") &&
      (m.workspace?.xml || "") === (sim.workspaceXml || "") &&
      (m.preferredEditor === "code" ? "text" : "blocks") === sim.mode &&
      (m.projectType || "custom") === (sim.projectType || "custom");
    if (unchanged) return;
    debouncedSaveRef.current();
  }, [
    proj.activeProjectId,
    proj.activeManifest,
    sim.pythonCode,
    sim.workspaceXml,
    sim.mode,
    sim.projectType,
  ]);
  useEffect(() => () => debouncedSaveRef.current.cancel(), []);
```

(The mode comparison mirrors `applyManifestToWorkingState`, which maps `preferredEditor === "code"` → sim mode `"text"`, else `"blocks"`. After a save, `persistActive` updates `proj.activeManifest`, so the effect re-runs, finds `unchanged === true`, and settles — no save loop.)

- [ ] **Step 3: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git add frontend/src
git commit -m "feat(frontend): debounced editor-to-manifest autosave (3s) — manifests stay fresh"
```

---

### Task 6: Frontend — the sync engine

**Files:**
- Create: `frontend/src/utils/sync/syncEngine.js`, `frontend/src/utils/sync/__tests__/syncEngine.test.js`

**Interfaces:**
- Consumes: `api()` client shape (injected), projectStore functions (injected), syncMeta functions (injected).
- Produces: `createSyncEngine({api, store, meta, now})` → `{pushProject(id), drainPending(), reconcile(ownerId), adoptLocalProject(id, ownerId), getStatus(), subscribe(fn), setOnline(bool), dispose()}`. Status is `{state: "idle"|"syncing"|"synced"|"offline"|"error", pendingCount}`; `subscribe` returns an unsubscribe fn and fires on every status change. A module-level singleton `getGlobalSyncEngine()` wires the real deps lazily. All dependency-injected so the test file covers it with plain fakes — no component rendering, no network.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/sync/__tests__/syncEngine.test.js`:

```js
import { describe, test, expect, vi } from "vitest";
import { createSyncEngine } from "../syncEngine";

function fakeWorld(overrides = {}) {
  const local = new Map(); // id -> manifest
  const metaMap = new Map(); // id -> meta
  const remote = new Map(); // id -> {clientUpdatedAt, manifest, deleted}
  const calls = [];
  const api = vi.fn(async (path, opts = {}) => {
    calls.push({ path, opts });
    if (overrides.apiError) throw Object.assign(new Error("boom"), { status: 500 });
    if (path === "/api/projects" && !opts.method) {
      return {
        projects: [...remote.entries()].map(([id, r]) => ({
          id,
          clientUpdatedAt: r.clientUpdatedAt,
          deleted: !!r.deleted,
          title: r.manifest?.title ?? "t",
          goal: "physics",
          projectType: "custom",
        })),
      };
    }
    const putMatch = path.match(/^\/api\/projects\/([^/]+)$/);
    if (putMatch && opts.method === "PUT") {
      const id = putMatch[1];
      const m = opts.body.manifest;
      const head = remote.get(id);
      if (head && !head.deleted && m.updatedAt < head.clientUpdatedAt) {
        return { outcome: "kept-remote", project: { id, clientUpdatedAt: head.clientUpdatedAt, manifest: head.manifest } };
      }
      remote.set(id, { clientUpdatedAt: m.updatedAt, manifest: m, deleted: false });
      return { outcome: "saved" };
    }
    if (putMatch && !opts.method) {
      const head = remote.get(putMatch[1]);
      if (!head || head.deleted) throw Object.assign(new Error("No such project."), { status: 404 });
      return { project: { id: putMatch[1], clientUpdatedAt: head.clientUpdatedAt, manifest: head.manifest } };
    }
    throw new Error(`unexpected ${opts.method ?? "GET"} ${path}`);
  });
  const store = {
    listProjects: async () => [...local.values()].map((m) => ({ id: m.id, updatedAt: m.updatedAt })),
    loadProject: async (id) => local.get(id) ?? null,
    saveProject: async (m, opts = {}) => {
      const stamped = opts.preserveTimestamp ? { ...m } : { ...m, updatedAt: 999999 };
      local.set(m.id, stamped);
      return stamped;
    },
    deleteProject: async (id) => void local.delete(id),
  };
  const meta = {
    getSyncMeta: async (id) => metaMap.get(id) ?? null,
    setSyncMeta: async (id, v) => void metaMap.set(id, v),
    deleteSyncMeta: async (id) => void metaMap.delete(id),
    listSyncMeta: async () => Object.fromEntries(metaMap),
  };
  return { api, store, meta, local, remote, metaMap, calls };
}

function m(id, updatedAt, title = "t") {
  return { schemaVersion: 2, id, title, goal: "physics", projectType: "custom", createdAt: 1, updatedAt };
}

describe("pushProject", () => {
  test("saved outcome records meta and reaches synced", async () => {
    const w = fakeWorld();
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    await eng.pushProject("p-1");
    expect(w.remote.get("p-1").clientUpdatedAt).toBe(2000);
    expect(w.metaMap.get("p-1")).toMatchObject({ remoteUpdatedAt: 2000 });
    expect(eng.getStatus().state).toBe("synced");
  });

  test("kept-remote outcome writes the remote manifest locally WITH preserved timestamp", async () => {
    const w = fakeWorld();
    w.remote.set("p-1", { clientUpdatedAt: 9000, manifest: m("p-1", 9000, "remote"), deleted: false });
    w.local.set("p-1", m("p-1", 2000, "stale-local"));
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    await eng.pushProject("p-1");
    expect(w.local.get("p-1").title).toBe("remote");
    expect(w.local.get("p-1").updatedAt).toBe(9000); // preserved, not re-stamped
    expect(w.metaMap.get("p-1")).toMatchObject({ remoteUpdatedAt: 9000 });
  });

  test("api failure → error status, local untouched, no throw", async () => {
    const w = fakeWorld({ apiError: true });
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5000 });
    await eng.pushProject("p-1");
    expect(eng.getStatus().state).toBe("error");
    expect(w.local.get("p-1").updatedAt).toBe(2000);
  });
});

describe("reconcile", () => {
  test("pulls newer remotes, pushes newer locals, deletes tombstoned, imports unknown-remote", async () => {
    const w = fakeWorld();
    // remote newer than local
    w.local.set("p-newer-remote", m("p-newer-remote", 1000, "old-local"));
    w.metaMap.set("p-newer-remote", { ownerId: "u-1", remoteUpdatedAt: 1000, lastPushedAt: 1 });
    w.remote.set("p-newer-remote", { clientUpdatedAt: 5000, manifest: m("p-newer-remote", 5000, "new-remote") });
    // local newer than remote
    w.local.set("p-newer-local", m("p-newer-local", 8000, "new-local"));
    w.metaMap.set("p-newer-local", { ownerId: "u-1", remoteUpdatedAt: 2000, lastPushedAt: 1 });
    w.remote.set("p-newer-local", { clientUpdatedAt: 2000, manifest: m("p-newer-local", 2000) });
    // tombstoned remotely, known locally
    w.local.set("p-gone", m("p-gone", 3000));
    w.metaMap.set("p-gone", { ownerId: "u-1", remoteUpdatedAt: 3000, lastPushedAt: 1 });
    w.remote.set("p-gone", { clientUpdatedAt: 3000, manifest: m("p-gone", 3000), deleted: true });
    // exists remotely only
    w.remote.set("p-cloud-only", { clientUpdatedAt: 4000, manifest: m("p-cloud-only", 4000, "cloud") });

    const eng = createSyncEngine({ ...w, now: () => 9999 });
    await eng.reconcile("u-1");

    expect(w.local.get("p-newer-remote").title).toBe("new-remote");
    expect(w.local.get("p-newer-remote").updatedAt).toBe(5000);
    expect(w.remote.get("p-newer-local").clientUpdatedAt).toBe(8000);
    expect(w.local.has("p-gone")).toBe(false);
    expect(w.metaMap.has("p-gone")).toBe(false);
    expect(w.local.get("p-cloud-only").title).toBe("cloud");
    expect(eng.getStatus().state).toBe("synced");
  });

  test("guest-only local projects (no meta) are NOT auto-pushed by reconcile", async () => {
    const w = fakeWorld();
    w.local.set("p-guest", m("p-guest", 1000));
    const eng = createSyncEngine({ ...w, now: () => 2 });
    await eng.reconcile("u-1");
    expect(w.remote.has("p-guest")).toBe(false);
  });

  test("adoptLocalProject pushes a guest project and stamps its meta", async () => {
    const w = fakeWorld();
    w.local.set("p-guest", m("p-guest", 1000));
    const eng = createSyncEngine({ ...w, now: () => 2 });
    await eng.adoptLocalProject("p-guest", "u-1");
    expect(w.remote.get("p-guest").clientUpdatedAt).toBe(1000);
    expect(w.metaMap.get("p-guest")).toMatchObject({ ownerId: "u-1" });
  });
});

describe("status & offline", () => {
  test("setOnline(false) parks pushes as pending; going online drains", async () => {
    const w = fakeWorld();
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5 });
    eng.setOnline(false);
    await eng.pushProject("p-1");
    expect(eng.getStatus()).toMatchObject({ state: "offline", pendingCount: 1 });
    expect(w.remote.has("p-1")).toBe(false);
    eng.setOnline(true);
    await eng.drainPending();
    expect(w.remote.get("p-1").clientUpdatedAt).toBe(2000);
    expect(eng.getStatus().state).toBe("synced");
  });

  test("subscribe fires on transitions and unsubscribes cleanly", async () => {
    const w = fakeWorld();
    w.local.set("p-1", m("p-1", 2000));
    const eng = createSyncEngine({ ...w, now: () => 5 });
    const seen = [];
    const un = eng.subscribe((s) => seen.push(s.state));
    await eng.pushProject("p-1");
    expect(seen).toContain("syncing");
    expect(seen[seen.length - 1]).toBe("synced");
    un();
    await eng.pushProject("p-1");
    expect(seen[seen.length - 1]).toBe("synced"); // no new entries after unsubscribe
  });
});
```

- [ ] **Step 2: Implement**

Create `frontend/src/utils/sync/syncEngine.js`:

```js
/**
 * The sync engine — spec §6.3. Local-first: it never blocks or fails a local
 * save; it quietly pushes after saves and reconciles on signin/online/focus.
 * Fully dependency-injected for pure-module testing.
 */

export function createSyncEngine({ api, store, meta, now = () => Date.now() }) {
  let status = { state: "idle", pendingCount: 0 };
  let online = true;
  const pending = new Set();
  const listeners = new Set();

  function setStatus(next) {
    status = { ...status, ...next, pendingCount: pending.size };
    for (const fn of listeners) fn(status);
  }

  async function pushOne(id) {
    const manifest = await store.loadProject(id);
    if (!manifest) return;
    const res = await api(`/api/projects/${id}`, { method: "PUT", body: { manifest } });
    if (res.outcome === "kept-remote") {
      await store.saveProject(res.project.manifest, { preserveTimestamp: true });
      await meta.setSyncMeta(id, {
        ownerId: (await meta.getSyncMeta(id))?.ownerId ?? null,
        remoteUpdatedAt: res.project.clientUpdatedAt,
        lastPushedAt: now(),
      });
    } else {
      await meta.setSyncMeta(id, {
        ownerId: (await meta.getSyncMeta(id))?.ownerId ?? null,
        remoteUpdatedAt: manifest.updatedAt,
        lastPushedAt: now(),
      });
    }
  }

  async function pushProject(id) {
    if (!online) {
      pending.add(id);
      setStatus({ state: "offline" });
      return;
    }
    setStatus({ state: "syncing" });
    try {
      await pushOne(id);
      pending.delete(id);
      setStatus({ state: "synced" });
    } catch (err) {
      pending.add(id);
      setStatus({ state: err?.status === undefined && !navigator?.onLine ? "offline" : "error" });
    }
  }

  async function drainPending() {
    const ids = [...pending];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await pushProject(id);
      if (!online) return;
    }
  }

  async function adoptLocalProject(id, ownerId) {
    await meta.setSyncMeta(id, { ownerId, remoteUpdatedAt: 0, lastPushedAt: 0 });
    await pushProject(id);
  }

  async function reconcile(ownerId) {
    if (!online) {
      setStatus({ state: "offline" });
      return;
    }
    setStatus({ state: "syncing" });
    try {
      const { projects: remoteList } = await api("/api/projects");
      const remoteById = new Map(remoteList.map((r) => [r.id, r]));
      const localList = await store.listProjects();
      const localById = new Map(localList.map((l) => [l.id, l]));
      const metaAll = await meta.listSyncMeta();

      for (const r of remoteList) {
        const local = localById.get(r.id);
        if (r.deleted) {
          if (local && metaAll[r.id]) {
            await store.deleteProject(r.id);
            await meta.deleteSyncMeta(r.id);
          }
          continue;
        }
        if (!local) {
          const { project } = await api(`/api/projects/${r.id}`);
          await store.saveProject(project.manifest, { preserveTimestamp: true });
          await meta.setSyncMeta(r.id, {
            ownerId,
            remoteUpdatedAt: project.clientUpdatedAt,
            lastPushedAt: now(),
          });
          continue;
        }
        if (r.clientUpdatedAt > local.updatedAt) {
          const { project } = await api(`/api/projects/${r.id}`);
          await store.saveProject(project.manifest, { preserveTimestamp: true });
          await meta.setSyncMeta(r.id, {
            ownerId,
            remoteUpdatedAt: project.clientUpdatedAt,
            lastPushedAt: now(),
          });
        } else if (r.clientUpdatedAt < local.updatedAt) {
          await pushOne(r.id);
        }
      }

      // Locals the server doesn't know: only push ones ALREADY adopted (meta exists).
      for (const l of localList) {
        if (!remoteById.has(l.id) && metaAll[l.id]) {
          await pushOne(l.id);
        }
      }
      setStatus({ state: "synced" });
    } catch {
      setStatus({ state: "error" });
    }
  }

  return {
    pushProject,
    drainPending,
    reconcile,
    adoptLocalProject,
    getStatus: () => status,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    setOnline: (v) => {
      online = v;
      setStatus({ state: v ? status.state : "offline" });
    },
    dispose: () => listeners.clear(),
  };
}

let globalEngine = null;

/** Lazily wires the real dependencies. Import cost only when first used. */
export async function getGlobalSyncEngine() {
  if (globalEngine) return globalEngine;
  const { api } = await import("../api/client");
  const store = await import("../storage/projectStore");
  const meta = await import("../storage/syncMeta");
  globalEngine = createSyncEngine({ api, store, meta });
  return globalEngine;
}
```

- [ ] **Step 3: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git add frontend/src
git commit -m "feat(frontend): dependency-injected sync engine — push, reconcile, offline queue"
```

---

### Task 7: Frontend — wiring: push-after-save, reconcile triggers, online/offline

**Files:**
- Create: `frontend/src/sync/SyncProvider.js`
- Modify: `frontend/src/App.js` (mount provider), `frontend/src/contexts/ProjectContext.js` (post-save hook), `frontend/src/utils/storage/projectStore.js` (save listener API)

**Interfaces:**
- Produces: `onProjectSaved(listener)` and `onProjectDeleted(listener)` in projectStore (each returns an unsubscribe fn; `saveProject` notifies AFTER a successful local write with `(stampedManifest, opts)`, `deleteProject` notifies after removal with `(id)`); ProjectContext subscribes to BOTH so the start-menu list stays fresh when sync writes/deletes bypass the context; `SyncProvider` (mounted inside the QueryClientProvider, outside the Routes) which: subscribes to `useMe()`; while signed in, awaits `engine.reconcile(me.id)`, snapshots the unadopted (guest-era) project ids into a ref, then wires `onProjectSaved` → for a project WITH sync-meta, `engine.pushProject(id)` (owner-mismatched meta is skipped); for a project with NO meta that is in the guest-era snapshot, do nothing (Task 9's §3.2 offer owns those); for a project with NO meta NOT in the snapshot (created while signed in), `engine.adoptLocalProject(id, me.id)` so new work syncs without ceremony. Reconcile re-runs on `window` `focus`/`online`; `engine.setOnline` follows `online`/`offline` events. While signed out it disconnects everything (guest saves never touch the engine). Exposes nothing visual (Task 8's chip consumes the engine directly).

- [ ] **Step 1: Store listeners (append to the projectStore test file first; add `onProjectSaved`, `onProjectDeleted` to its projectStore import)**

```js
describe("project store listeners", () => {
  test("onProjectSaved fires after successful saves with the stamped manifest; unsubscribe works", async () => {
    const seen = [];
    const un = onProjectSaved((m, opts) => seen.push([m.id, m.updatedAt, opts?.preserveTimestamp === true]));
    const m1 = createManifest({ goal: "physics" });
    const saved = await saveProject(m1);
    expect(seen).toHaveLength(1);
    expect(seen[0][0]).toBe(m1.id);
    expect(seen[0][1]).toBe(saved.updatedAt);
    un();
    await saveProject(saved);
    expect(seen).toHaveLength(1);
  });

  test("onProjectDeleted fires with the id after removal; unsubscribe works", async () => {
    const saved = await saveProject(createManifest({ goal: "physics" }));
    const seen = [];
    const un = onProjectDeleted((id) => seen.push(id));
    await deleteProject(saved.id);
    expect(seen).toEqual([saved.id]);
    un();
  });
});
```

Implement in `projectStore.js`:

```js
/* ── Change listeners (sync wiring; Plan 4) ─────────────────── */
const saveListeners = new Set();
const deleteListeners = new Set();

export function onProjectSaved(fn) {
  saveListeners.add(fn);
  return () => saveListeners.delete(fn);
}

export function onProjectDeleted(fn) {
  deleteListeners.add(fn);
  return () => deleteListeners.delete(fn);
}
```

At the END of `saveProject` (after `upsertSummary`, before `return`): `for (const fn of saveListeners) { try { fn(stamped, opts); } catch { /* listeners never break saves */ } }` — and at the END of `deleteProject`: `for (const fn of deleteListeners) { try { fn(id); } catch { /* same */ } }`.

- [ ] **Step 2: ProjectContext stays fresh (sync writes/deletes bypass the context)**

In `frontend/src/contexts/ProjectContext.js`: add `onProjectSaved, onProjectDeleted` to the existing projectStore import, and add this effect inside `ProjectProvider` (after the bootstrap effect):

```js
  /* Sync pulls save and delete straight through projectStore, bypassing this
     provider — subscribe so the start-menu list follows, and close a project
     that was tombstoned remotely while open. */
  useEffect(() => {
    const unsubSaved = onProjectSaved(() => {
      refreshList();
    });
    const unsubDeleted = onProjectDeleted((id) => {
      refreshList();
      setActiveProjectId((cur) => (cur === id ? null : cur));
      setActiveManifest((cur) => (cur && cur.id === id ? null : cur));
    });
    return () => {
      unsubSaved();
      unsubDeleted();
    };
  }, [refreshList]);
```

- [ ] **Step 3: SyncProvider**

Create `frontend/src/sync/SyncProvider.js`:

```js
import { useEffect, useRef } from "react";
import { useMe } from "../auth/useAuth";
import { listProjects, onProjectSaved } from "../utils/storage/projectStore";
import { getSyncMeta, listSyncMeta } from "../utils/storage/syncMeta";
import { getGlobalSyncEngine } from "../utils/sync/syncEngine";

/**
 * Invisible wiring: signed-in sessions get push-after-save + reconcile on
 * signin/focus/online. Signed-out sessions leave everything untouched.
 */
export default function SyncProvider({ children }) {
  const { data: me } = useMe();
  const engineRef = useRef(null);
  /* Unadopted locals present at sign-in = guest-era work. Task 9's §3.2 offer
     owns those; anything saved later without meta was created signed-in and
     is adopted automatically. */
  const guestIdsRef = useRef(new Set());

  useEffect(() => {
    if (!me) return undefined;
    let disposed = false;
    let unsubSave = () => {};
    (async () => {
      const engine = await getGlobalSyncEngine();
      if (disposed) return;
      engineRef.current = engine;
      engine.setOnline(navigator.onLine);
      await engine.reconcile(me.id);
      if (disposed) return;

      const locals = await listProjects();
      const metas = await listSyncMeta();
      guestIdsRef.current = new Set(locals.filter((l) => !metas[l.id]).map((l) => l.id));

      unsubSave = onProjectSaved(async (manifest, opts) => {
        if (opts?.preserveTimestamp) return; // sync-pulled writes never re-push
        const meta = await getSyncMeta(manifest.id);
        if (meta && meta.ownerId && meta.ownerId !== me.id) return; // another account's project
        if (meta) {
          engine.pushProject(manifest.id);
          return;
        }
        if (guestIdsRef.current.has(manifest.id)) return; // guest-era: wait for the §3.2 offer
        await engine.adoptLocalProject(manifest.id, me.id); // born signed-in: adopt now
      });
    })();

    const onFocus = () => engineRef.current?.reconcile(me.id);
    const onOnline = () => {
      engineRef.current?.setOnline(true);
      engineRef.current?.drainPending();
      engineRef.current?.reconcile(me.id);
    };
    const onOffline = () => engineRef.current?.setOnline(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      disposed = true;
      unsubSave();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [me]);

  return children;
}
```

- [ ] **Step 4: Mount it**

In `frontend/src/App.js`: import `SyncProvider` from `./sync/SyncProvider`; wrap it around the existing provider stack's CHILDREN — place it directly inside `<BrowserRouter>` (it needs the QueryClient for `useMe`): `<BrowserRouter><SyncProvider>` … existing tree … `</SyncProvider></BrowserRouter>`.

- [ ] **Step 5: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git add frontend/src
git commit -m "feat(frontend): sync wiring — push-after-save, reconcile on signin/focus/online"
```

---

### Task 8: Frontend — the sync status chip

**Files:**
- Create: `frontend/src/sync/SyncChip.js`
- Modify: `frontend/src/components/layout/IDELayout.js` (mount in the status bar), `frontend/src/styles.css` (append)

**Interfaces:**
- Produces: `<SyncChip />` — renders NOTHING for guests; for signed-in users shows the spec §6.3 sentences keyed on engine state: `Saved on this computer · Synced` (synced/idle), `· Waiting for connection` (offline), `· Sync error` (error), `· Syncing…` (syncing).

- [ ] **Step 1: Implement**

Create `frontend/src/sync/SyncChip.js`:

```js
import React, { useEffect, useState } from "react";
import { useMe } from "../auth/useAuth";
import { getGlobalSyncEngine } from "../utils/sync/syncEngine";

const LABELS = {
  idle: "Synced",
  synced: "Synced",
  syncing: "Syncing…",
  offline: "Waiting for connection",
  error: "Sync error",
};

export default function SyncChip() {
  const { data: me } = useMe();
  const [state, setState] = useState("idle");

  useEffect(() => {
    if (!me) return undefined;
    let unsub = () => {};
    let disposed = false;
    (async () => {
      const engine = await getGlobalSyncEngine();
      if (disposed) return;
      setState(engine.getStatus().state);
      unsub = engine.subscribe((s) => setState(s.state));
    })();
    return () => {
      disposed = true;
      unsub();
    };
  }, [me]);

  if (!me) return null;
  return (
    <span className={`sync-chip sync-chip--${state}`} title="Your work saves locally first and syncs to your account.">
      Saved on this computer · {LABELS[state] ?? "Synced"}
    </span>
  );
}
```

- [ ] **Step 2: Mount + style**

In `frontend/src/components/layout/IDELayout.js`: import `SyncChip` from `../../sync/SyncChip`; render `<SyncChip />` inside the status bar's right-hand cluster — read the file and place it as a sibling immediately BEFORE the `Mode: …` span in the `.status-bar`/`.console-bar` row (the exact JSX container that renders `Mode:` and `VPython`). Touch nothing else in the file.

Append to `frontend/src/styles.css`:

```css
/* ---- Sync chip (Plan 4) ---- */
.sync-chip { font-size: 11px; color: var(--text-dim); margin-right: 14px; }
.sync-chip--synced { color: var(--green); }
.sync-chip--syncing { color: var(--accent-bright); }
.sync-chip--offline { color: var(--yellow); }
.sync-chip--error { color: var(--red); }
```

- [ ] **Step 3: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git add frontend/src
git commit -m "feat(frontend): sync status chip in the status bar (spec §6.3 wording)"
```

---

### Task 9: Frontend — guest-project import at first sign-in + fresh-device ordering

**Files:**
- Create: `frontend/src/sync/GuestImportPrompt.js`
- Modify: `frontend/src/sync/SyncProvider.js` (prompt trigger + legacy backfill), `frontend/src/contexts/ProjectContext.js` (guard the legacy resurrection), `frontend/src/auth/useAuth.js` (maintain the signed-in hint), `frontend/src/constants/index.js` (hint key), `frontend/src/styles.css` (append)

**Interfaces:**
- Produces: after a signed-in reconcile completes, if UNADOPTED local projects exist (no sync-meta), `SyncProvider` surfaces spec §3.2's offer once per account: a dismissible banner-card `Bring your N guest project(s) into your new account?` with `[Bring them in] [Not now]`. "Bring them in" runs `engine.adoptLocalProject(id, me.id)` for each; "Not now" stores `localStorage["pide_guest_import_declined:{userId}"] = "1"` and never asks that account again (projects stay local, exactly as spec §3.2's decline — their ids stay in `guestIdsRef`, so ordinary saves never auto-adopt them either). `SIGNED_IN_HINT_KEY = "pide_signed_in_hint"` in constants: a synchronous localStorage hint the auth layer keeps true-to-session, read by ProjectContext's bootstrap so the legacy-v1 resurrection cannot race a signed-in first pull. The empty-cloud case still resurrects: SyncProvider backfills the legacy blob AFTER reconcile when both cloud and local are empty, and the §3.2 prompt then offers it.

- [ ] **Step 1: The signed-in hint + the bootstrap guard**

A `window` flag set from SyncProvider CANNOT work here: ProjectProvider mounts below SyncProvider, so its bootstrap effect runs first — and `useMe` resolves over the network later still. The guard must be synchronous, so it reads a localStorage hint the auth layer maintains.

Add to `frontend/src/constants/index.js`:

```js
/* localStorage key: present while the auth layer last knew the user to be
   signed in. Read synchronously by ProjectContext's bootstrap so the legacy
   v1 resurrection doesn't race a signed-in first cloud pull. */
export const SIGNED_IN_HINT_KEY = "pide_signed_in_hint";
```

In `frontend/src/auth/useAuth.js` (import `SIGNED_IN_HINT_KEY` from `../constants`), keep the hint true-to-session at every point session state is learned:

- `useMe`'s `queryFn`: after `const data = await api("/api/auth/me");`, before returning — `if (data.user) localStorage.setItem(SIGNED_IN_HINT_KEY, "1");` and in the 401 catch branch, before `return null` — `localStorage.removeItem(SIGNED_IN_HINT_KEY);`
- `useSignin`'s `onSuccess`: add `localStorage.setItem(SIGNED_IN_HINT_KEY, "1");`
- `useSignout`'s `onSuccess`: add `localStorage.removeItem(SIGNED_IN_HINT_KEY);`

In `frontend/src/contexts/ProjectContext.js`, the bootstrap effect migrates the legacy v1 blob whenever `listProjects()` is empty. Import `SIGNED_IN_HINT_KEY` from `../constants` and change ONLY the condition: `if (list.length === 0)` becomes `if (list.length === 0 && !localStorage.getItem(SIGNED_IN_HINT_KEY))`, with a one-line comment: `// signed-in first runs pull from the cloud instead (SyncProvider backfills the legacy blob if the cloud is empty too)`. The `else` chain is unchanged — an empty list with the hint set lands in `setBootstrapResult({ kind: "empty" })` via the existing `else` on `readLegacyV1()` returning-null path (i.e., skip calling `readLegacyV1()` entirely; structure the condition so the `kind: "empty"` branch still runs). The legacy blob remains untouched on disk either way — a signed-out visit still resurrects it as today. (Known, accepted staleness: if the session expired while away, the hint lingers until the next `useMe` resolution clears it, so one signed-out visit may skip resurrection; the following visit resurrects normally.)

- [ ] **Step 2: The prompt**

Create `frontend/src/sync/GuestImportPrompt.js`:

```js
import React from "react";

/** Spec §3.2 — shown by SyncProvider when unadopted guest projects exist. */
export default function GuestImportPrompt({ count, onAccept, onDecline, busy }) {
  return (
    <div className="guest-import">
      <span>
        Bring your {count} guest project{count === 1 ? "" : "s"} into your new account?
      </span>
      <button className="admin-btn admin-btn--primary" type="button" onClick={onAccept} disabled={busy}>
        {busy ? "Bringing them in…" : "Bring them in"}
      </button>
      <button className="admin-btn" type="button" onClick={onDecline} disabled={busy}>
        Not now
      </button>
    </div>
  );
}
```

Extend `frontend/src/sync/SyncProvider.js` (Task 7 wrote it with an awaited `engine.reconcile(me.id)` followed by the `guestIdsRef` snapshot, then the `onProjectSaved` subscription):

1. **Legacy backfill, BETWEEN reconcile and the snapshot** (import `readLegacyV1, migrate` from `../utils/manifest/migrate` and `saveProject` from the projectStore import already present): if `(await listProjects()).length === 0` after reconcile, run `const legacy = readLegacyV1(); if (legacy) await saveProject(migrate(legacy));`. Cloud empty + local empty + a v1 blob on disk = the signed-in resurrection case the bootstrap guard skipped. Ordering matters and is why this sits here: it runs BEFORE the snapshot (so the recovered project lands in `guestIdsRef` and gets the §3.2 offer) and BEFORE the `onProjectSaved` subscription (so this save cannot trigger auto-adoption; ProjectContext's Task 7 subscription still refreshes the visible list).
2. **The prompt trigger, after the snapshot:** add `useState` for prompt state. If `guestIdsRef.current.size > 0 && !localStorage.getItem(`pide_guest_import_declined:${me.id}`)`, set state `{count, ids}` (from the snapshot) rendered as `<GuestImportPrompt …/>` above `{children}` (the provider returns `<>{prompt}{children}</>`; the card styles itself fixed-position). `onAccept`: set `busy`; for each id `await engine.adoptLocalProject(id, me.id)` and `guestIdsRef.current.delete(id)`; clear the prompt. `onDecline`: set the localStorage decline flag, clear the prompt — ids stay in `guestIdsRef`, so those projects stay local for good.

Append to `frontend/src/styles.css`:

```css
/* ---- Guest import prompt (Plan 4) ---- */
.guest-import {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4000;
  display: flex;
  gap: 10px;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--text-bright);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}
.admin-btn--primary { border-color: var(--accent); color: var(--accent-bright); }
```

- [ ] **Step 3: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git add frontend/src
git commit -m "feat(frontend): guest-project import offer at first sign-in; legacy bootstrap yields to cloud pull"
```

---

### Task 10: Frontend — the welcome screen (user-requested 2026-08-19)

> User directive (2026-08-19, mid-execution): the first screen for a brand-new visitor must not
> be the bare IDE/login — it is an informative, animated, lightly interactive page showcasing
> the IDE (what it is, what it can do), with three doors: sign in, sign up, or use the IDE as a
> guest. Spec §14's screen list gains this screen by that directive. Copy stays honest (Plan-2
> precedent): nothing is promised that isn't shipped — assignments are described as "on the way".

**Behavioral contract:** the IDE stays at `/`. A gate wrapping `/` redirects any NOT-signed-in
visitor to `/welcome` once per browser session: the three CTA buttons stamp a sessionStorage
pass (`WELCOME_PASSED_SESSION_KEY`), so "/" renders the IDE for the rest of that session; a new
session lands on `/welcome` again. Signed-in visitors (SIGNED_IN_HINT_KEY) always skip it.
(v2 per user directive 2026-08-19 — replaced the first-visit-only gate; the localStorage
seen-flag and project-count grandfather are gone.) `/welcome` stays directly reachable forever.
**No new dependencies** — animation is CSS keyframes + one IntersectionObserver + one
requestAnimationFrame canvas; `prefers-reduced-motion` disables the decorative motion.

**Files:**
- Create: `frontend/src/welcome/WelcomeGate.js`, `frontend/src/welcome/WelcomePage.js`,
  `frontend/src/welcome/GravityPlayground.js`, `frontend/src/welcome/__tests__/welcomeGate.test.js`
- Modify: `frontend/src/App.js` (route + gate), `frontend/src/constants/index.js` (append key),
  `frontend/src/styles.css` (append)

**Interfaces:**
- Consumes: `SIGNED_IN_HINT_KEY` (Task 9), `listProjects` (projectStore).
- Produces: `WELCOME_PASSED_SESSION_KEY = "pide_welcome_passed"` in constants; pure
  `shouldShowWelcome({signedInHint, sessionPassed})` exported from WelcomeGate;
  routes `/welcome` → `<WelcomePage/>` and `/` → `<WelcomeGate><IDELayout/></WelcomeGate>`.

- [ ] **Step 1: The gate (pure logic test-first)**

Create `frontend/src/welcome/__tests__/welcomeGate.test.js`:

```js
import { describe, test, expect } from "vitest";
import { shouldShowWelcome } from "../WelcomeGate";

describe("shouldShowWelcome", () => {
  test("brand-new visitor: no flag, no hint, no projects → welcome", () => {
    expect(shouldShowWelcome({ seenFlag: false, signedInHint: false, projectCount: 0 })).toBe(true);
  });
  test("seen-flag set → IDE, regardless of the rest", () => {
    expect(shouldShowWelcome({ seenFlag: true, signedInHint: false, projectCount: 0 })).toBe(false);
  });
  test("signed-in hint → IDE (never hijack a member)", () => {
    expect(shouldShowWelcome({ seenFlag: false, signedInHint: true, projectCount: 0 })).toBe(false);
  });
  test("existing guest work → IDE (never hijack a guest with projects)", () => {
    expect(shouldShowWelcome({ seenFlag: false, signedInHint: false, projectCount: 3 })).toBe(false);
  });
});
```

Add to `frontend/src/constants/index.js`:

```js
/* localStorage key: stamped once the visitor has seen (or skipped) the welcome
   screen, so "/" never redirects them again. */
export const WELCOME_SEEN_KEY = "pide_welcome_seen";
```

Create `frontend/src/welcome/WelcomeGate.js`:

```js
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { listProjects } from "../utils/storage/projectStore";
import { SIGNED_IN_HINT_KEY, WELCOME_SEEN_KEY } from "../constants";

/** Pure decision: only brand-new visitors get the welcome screen. */
export function shouldShowWelcome({ seenFlag, signedInHint, projectCount }) {
  if (seenFlag || signedInHint) return false;
  return projectCount === 0;
}

/**
 * Wraps "/": brand-new visitors (no seen-flag, no session hint, no local
 * projects) go to /welcome; everyone else gets the IDE untouched. A guest
 * who already has projects is grandfathered — stamp the flag, show the IDE.
 */
export default function WelcomeGate({ children }) {
  const seenFlag = !!localStorage.getItem(WELCOME_SEEN_KEY);
  const signedInHint = !!localStorage.getItem(SIGNED_IN_HINT_KEY);
  // Sync fast-path: when a flag already decides it, skip the storage read.
  const [projectCount, setProjectCount] = useState(seenFlag || signedInHint ? 1 : null);

  useEffect(() => {
    if (projectCount !== null) return;
    let cancelled = false;
    listProjects()
      .then((list) => {
        if (cancelled) return;
        if (list.length > 0) localStorage.setItem(WELCOME_SEEN_KEY, "1");
        setProjectCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setProjectCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [projectCount]);

  if (projectCount === null) return null; // one IndexedDB read; avoids an IDE flash
  if (shouldShowWelcome({ seenFlag, signedInHint, projectCount })) {
    return <Navigate to="/welcome" replace />;
  }
  return children;
}
```

- [ ] **Step 2: The gravity playground (the "somewhat interactive" part)**

Create `frontend/src/welcome/GravityPlayground.js`:

```js
import React, { useEffect, useRef, useState } from "react";

const DAMPING = 0.82;
const COLORS = ["#7dd3fc", "#f9a8d4", "#fcd34d", "#86efac", "#c4b5fd"];

function makeBall(x, y) {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 220,
    vy: -80 - Math.random() * 120,
    r: 7 + Math.random() * 7,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

/** A tiny canvas physics toy: drag the slider, click to drop balls. */
export default function GravityPlayground() {
  const canvasRef = useRef(null);
  const ballsRef = useRef([makeBall(80, 40), makeBall(180, 60), makeBall(260, 30)]);
  const gravityRef = useRef(9.8);
  const [gravity, setGravity] = useState(9.8);
  gravityRef.current = gravity;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let last = performance.now();

    const frame = (t) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      for (const b of ballsRef.current) {
        b.vy += gravityRef.current * 60 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y + b.r > h) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * DAMPING; }
        if (b.x + b.r > w) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * DAMPING; }
        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * DAMPING; }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const drop = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (ballsRef.current.length >= 40) ballsRef.current.shift();
    ballsRef.current.push(makeBall(e.clientX - rect.left, e.clientY - rect.top));
  };

  return (
    <div className="welcome-playground">
      <canvas ref={canvasRef} className="welcome-playground__canvas" onPointerDown={drop} />
      <div className="welcome-playground__controls">
        <label htmlFor="welcome-gravity">Gravity: {gravity.toFixed(1)} m/s²</label>
        <input
          id="welcome-gravity"
          type="range"
          min="0"
          max="30"
          step="0.1"
          value={gravity}
          onChange={(e) => setGravity(Number(e.target.value))}
        />
        <span className="welcome-playground__hint">Click anywhere in the box to drop a ball.</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: The page**

Create `frontend/src/welcome/WelcomePage.js`:

```js
import React, { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GravityPlayground from "./GravityPlayground";
import { WELCOME_SEEN_KEY } from "../constants";

const FEATURES = [
  { icon: "🧩", title: "Blocks or Python", body: "Start with drag-and-drop blocks, flip to real Python whenever you're ready — same project, both views." },
  { icon: "🪐", title: "Live 3D simulations", body: "VPython scenes render as your code runs: orbits, springs, collisions, projectiles — watch physics happen." },
  { icon: "📈", title: "Charts & data", body: "Every run captures data you can plot, fit, and analyse — the data-science half of the lab." },
  { icon: "💾", title: "Yours, offline", body: "Everything saves to your computer first. Wi-Fi dies mid-lesson? Keep working. Sign in and projects follow you to any computer." },
  { icon: "🏫", title: "Classrooms", body: "Teachers create classes, share a join code or QR, and manage rosters. Assignments and marking are on the way." },
  { icon: "🕵️", title: "No surveillance", body: "No tracking, no paste detection, no webcam. Just an honest record of how your work grew." },
];

export default function WelcomePage() {
  const navigate = useNavigate();

  const go = useCallback(
    (path) => {
      localStorage.setItem(WELCOME_SEEN_KEY, "1");
      navigate(path);
    },
    [navigate],
  );

  useEffect(() => {
    const els = document.querySelectorAll(".welcome-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) e.target.classList.add("is-on");
      },
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="welcome">
      <header className="welcome-hero">
        <div className="welcome-orbit" aria-hidden="true">
          <div className="welcome-orbit__sun" />
          <div className="welcome-orbit__path welcome-orbit__path--a"><i /></div>
          <div className="welcome-orbit__path welcome-orbit__path--b"><i /></div>
        </div>
        <h1>Physics IDE</h1>
        <p className="welcome-tagline">
          Build, run, and understand physics — right in your browser.
        </p>
        <div className="welcome-cta">
          <button className="welcome-btn welcome-btn--primary" type="button" onClick={() => go("/")}>
            Use the IDE — no account needed
          </button>
          <button className="welcome-btn" type="button" onClick={() => go("/auth/signup")}>
            Create an account
          </button>
          <button className="welcome-btn" type="button" onClick={() => go("/auth/signin")}>
            Sign in
          </button>
        </div>
      </header>

      <section className="welcome-features">
        {FEATURES.map((f) => (
          <article key={f.title} className="welcome-card welcome-reveal">
            <span className="welcome-card__icon" aria-hidden="true">{f.icon}</span>
            <h2>{f.title}</h2>
            <p>{f.body}</p>
          </article>
        ))}
      </section>

      <section className="welcome-play welcome-reveal">
        <h2>Feel it work</h2>
        <p>This little box runs the same idea the IDE does — rules in, motion out.</p>
        <GravityPlayground />
      </section>

      <footer className="welcome-foot welcome-reveal">
        <p>
          Free for classrooms. Your work saves to your computer first; an account adds sync,
          classes, and nothing you didn't ask for.
        </p>
        <button className="welcome-btn welcome-btn--primary" type="button" onClick={() => go("/")}>
          Open the IDE
        </button>
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: Route + styles**

In `frontend/src/App.js`: import `WelcomeGate` from `./welcome/WelcomeGate` and `WelcomePage` from `./welcome/WelcomePage`; change the root route to `<Route path="/" element={<WelcomeGate><IDELayout /></WelcomeGate>} />` and add `<Route path="/welcome" element={<WelcomePage />} />` beside the other routes. Touch nothing else.

Append to `frontend/src/styles.css`:

```css
/* ---- Welcome screen (Plan 4, user-requested) ---- */
.welcome { min-height: 100vh; overflow-x: hidden; padding: 48px 20px 64px; color: var(--text-bright); }
.welcome-hero { max-width: 760px; margin: 0 auto; text-align: center; }
.welcome-hero h1 { font-size: 44px; margin: 18px 0 6px; letter-spacing: 0.5px; }
.welcome-tagline { color: var(--text-dim); font-size: 17px; margin: 0 0 26px; }

.welcome-orbit { position: relative; width: 150px; height: 150px; margin: 0 auto; }
.welcome-orbit__sun {
  position: absolute; top: 50%; left: 50%; width: 26px; height: 26px; margin: -13px;
  border-radius: 50%; background: var(--yellow);
  box-shadow: 0 0 24px 4px rgba(250, 204, 21, 0.35);
}
.welcome-orbit__path {
  position: absolute; top: 50%; left: 50%; border: 1px dashed var(--text-dim);
  border-radius: 50%; opacity: 0.6; animation: welcome-spin linear infinite;
}
.welcome-orbit__path--a { width: 90px; height: 90px; margin: -45px; animation-duration: 7s; }
.welcome-orbit__path--b { width: 146px; height: 146px; margin: -73px; animation-duration: 13s; }
.welcome-orbit__path i {
  position: absolute; top: -5px; left: 50%; width: 10px; height: 10px; margin-left: -5px;
  border-radius: 50%; background: var(--accent-bright); display: block;
}
@keyframes welcome-spin { to { transform: rotate(360deg); } }

.welcome-cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.welcome-btn {
  padding: 10px 18px; font-size: 14px; border-radius: 6px; cursor: pointer;
  background: var(--bg-surface); color: var(--text-bright);
  border: 1px solid var(--text-dim); transition: transform 0.12s ease, border-color 0.12s ease;
}
.welcome-btn:hover { transform: translateY(-1px); border-color: var(--accent-bright); }
.welcome-btn--primary { border-color: var(--accent); color: var(--accent-bright); }

.welcome-features {
  max-width: 980px; margin: 56px auto 0; display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
.welcome-card {
  background: var(--bg-surface); border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px; padding: 18px;
}
.welcome-card__icon { font-size: 26px; }
.welcome-card h2 { font-size: 16px; margin: 10px 0 6px; }
.welcome-card p { font-size: 13px; color: var(--text-dim); line-height: 1.55; margin: 0; }

.welcome-play { max-width: 760px; margin: 64px auto 0; text-align: center; }
.welcome-play h2 { font-size: 22px; margin-bottom: 4px; }
.welcome-play p { color: var(--text-dim); font-size: 14px; margin-top: 0; }
.welcome-playground { margin-top: 14px; }
.welcome-playground__canvas {
  width: 100%; height: 260px; display: block; border-radius: 8px;
  background: var(--bg-surface); border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: crosshair; touch-action: none;
}
.welcome-playground__controls {
  display: flex; gap: 12px; align-items: center; justify-content: center;
  flex-wrap: wrap; margin-top: 10px; font-size: 13px; color: var(--text-dim);
}
.welcome-playground__controls input[type="range"] { width: 200px; }
.welcome-playground__hint { font-size: 12px; opacity: 0.8; }

.welcome-foot { max-width: 640px; margin: 72px auto 0; text-align: center; }
.welcome-foot p { color: var(--text-dim); font-size: 14px; }

.welcome-reveal { opacity: 0; transform: translateY(14px); transition: opacity 0.5s ease, transform 0.5s ease; }
.welcome-reveal.is-on { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .welcome-orbit__path { animation: none; }
  .welcome-reveal { opacity: 1; transform: none; transition: none; }
  .welcome-btn { transition: none; }
}
```

- [ ] **Step 5: Verify and commit**

```powershell
npm run test -w frontend
npm run build -w frontend
git add frontend/src
git commit -m "feat(frontend): welcome screen — animated first-visit landing with guest/sign-up/sign-in doors"
```

---

### Task 11: Wrap-up — docs and the full sweep

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Immediately after the Plan 3 classrooms paragraph (the one beginning "Classrooms are live too"), add:

```markdown
Signed-in work now syncs: projects save to your computer first (always), then quietly to your
account — the status chip in the status bar tells the truth (`Synced` / `Waiting for connection`).
Most-recent-edit-wins across machines, with the losing version kept in the project's server-side
history (last 20 versions). Guests stay fully local; at first sign-in the app offers to bring
guest projects into the account. Caps: 100 projects per account, 400 KB per project.
First-time visitors land on `/welcome` — an animated tour of the IDE with three doors: use it
as a guest, create an account, or sign in. Returning visitors go straight to the IDE.
```

- [ ] **Step 2: The full verification sweep**

```powershell
npm run test
npm run check:blocks
npm run build -w frontend
npm run typecheck -w backend
npm run typecheck -w shared
```

Expected: every workspace green, registry OK, build clean, typechecks silent. Record exact totals.

- [ ] **Step 3: Commit**

```powershell
git add README.md
git commit -m "docs: project sync in quickstart (local-first, status chip, history, caps)"
```

---

## Completion criteria (what Plan 5 may assume)

- `projects` + `project_versions` tables (migration 0003, both DBs); `PUT/GET/LIST/DELETE /api/projects*` with most-recent-wins, archived losers, tombstones, 100-project/400 KB/20-version caps; version list + restore.
- `saveProject(manifest, {preserveTimestamp})`, `onProjectSaved`/`onProjectDeleted`, the `sync-meta` store, `debounce`, `MANIFEST_AUTOSAVE_MS`, `SIGNED_IN_HINT_KEY`, `WELCOME_PASSED_SESSION_KEY`, `createSyncEngine`/`getGlobalSyncEngine`, `SyncProvider`, `SyncChip`, `GuestImportPrompt`, `WelcomeGate`/`WelcomePage`/`GravityPlayground` — all at the named paths.
- `/welcome` is the first screen of each browser session for visitors who are not signed in (no `WELCOME_PASSED_SESSION_KEY` session pass, no `SIGNED_IN_HINT_KEY`); signed-in visitors and anyone who already passed through this session land in the IDE at `/` untouched.
- Manifests reach the server fresh (3 s debounced autosave); a signed-in device converges on focus/online/sign-in; guests remain fully local; the legacy blob no longer races the first cloud pull.
- Assignments (Plan 5) can reference a `projects.id` per (owner) for starter-project snapshots and submissions.
