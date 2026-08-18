# Classroom Platform — Plan 1: Foundation & Restructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo into a TypeScript monorepo (`frontend/` on Vite, `backend/` on Fastify, `shared/`), with Postgres running locally in Docker, the first migration applied, and one `npm run dev` starting everything — the existing IDE fully working throughout.

**Architecture:** npm workspaces monorepo. The existing CRA React app moves wholesale into `frontend/` and migrates react-scripts → Vite + Vitest (the app itself is untouched). A new Fastify API in `backend/` (TypeScript, Drizzle ORM, Postgres 16 in Docker) exposes `/api/health` and owns a `settings` + `events` schema — the seed of the platform. `shared/` holds Zod schemas both halves import (first content: class roles and the three workspace rule sets from the spec).

**Tech Stack:** Node 20.19.2 · npm workspaces · Vite 7 + @vitejs/plugin-react · Vitest 4 + jsdom · Fastify 5 · Drizzle ORM + drizzle-kit · Postgres 16 (Docker) · Zod · tsx · concurrently

**Spec:** [docs/classroom-platform.md](../../classroom-platform.md) (functionality) and [docs/classroom-platform-stack.md](../../classroom-platform-stack.md) (stack). This plan implements stack §1 (monorepo), §2 (Vite migration), parts of §3/§4 (Fastify + Drizzle foundation), §5 (one-command local dev), plus the spec's §17.3 paperwork obligation.

## Global Constraints

- Node `>=20.19.2` (installed: v20.19.2 — exactly Vite 7's floor; do not raise floors beyond it).
- Dev machine is **Windows 11 + PowerShell**; every command below must run in PowerShell. Docker Desktop 29 is installed.
- Ports: frontend dev **3000**, API **4000**, Postgres **5433** (host) — 5433 avoids clashing with any local Postgres on 5432.
- `backend/` and `shared/` are **TypeScript strict**; `frontend/` stays JavaScript (no mass-rename of `.js` files — Vite is configured to parse JSX in `.js`).
- No new runtime dependencies beyond those named in this plan. Explicitly banned (stack §7): Redis, queues, websockets, NestJS, Prisma, GraphQL.
- The IDE must remain fully working after every task — Blockly toolbox renders, a physics template runs in the 3D viewport, DS templates render charts. CDN script tags in the HTML shell (Blockly 11, Monaco 0.45 loader, Inter font) must be preserved **byte-for-byte**.
- All work happens on branch `feature/classroom-platform`. Every task ends in a commit.
- ESLint setup is deliberately deferred to Plan 8 (CRA's bundled linting dies with react-scripts; do not add a lint stack now).
- The committed `build/` folder is legacy (Vercel builds from source per DEPLOY.md) and is removed in Task 3.

---

### Task 1: Paperwork — amend the product contract, commit the approved specs

The contract's change protocol (docs/product-contract.md §Change protocol) requires the contract to reflect a deviation **before code lands**. The approved spec + stack docs and this plan are also still uncommitted.

**Files:**
- Modify: `docs/product-contract.md`
- Commit (already written): `docs/classroom-platform.md`, `docs/classroom-platform-stack.md`, `docs/azure-cost-estimate.md`, `docs/Physics-IDE-Azure-Cost-Estimate.docx`, `docs/superpowers/plans/2026-08-18-classroom-platform-01-foundation.md`

- [ ] **Step 1: Add the decision record to the contract**

In `docs/product-contract.md`, immediately **above** the `## Change protocol` heading, insert:

```markdown
## Amendment — Classroom Platform (18 August 2026)

The Phase D and Phase E deferral gates have been satisfied by an explicit product decision. The owner approved a full classroom platform — accounts, teacher/learner/TA roles, classrooms, assignments, submissions, marking, and a light audit trail — specified in [docs/classroom-platform.md](classroom-platform.md) (functionality, approved 18 Aug 2026) and [docs/classroom-platform-stack.md](classroom-platform-stack.md) (stack, approved 18 Aug 2026).

Effective for the `feature/classroom-platform` branch onward:

- The exclusion-list bullets covering servers/databases, accounts/login/roles, cross-device sync/cloud save/rosters/dashboards are **lifted**. All other exclusions stand.
- Phase D/E's Supabase choice is **superseded**: the stack is a Fastify + PostgreSQL backend, self-hosted auth, Google Cloud (`africa-south1`) at deployment, hard cap **200 accounts**.
- The browser-first core is unchanged: simulation and DS execution never move server-side; guest mode remains.
```

- [ ] **Step 2: Mark the lifted exclusion bullets**

In the same file's `## Exclusion list`, change these three bullets (leave the rest untouched):

```markdown
- ~~Servers, databases, queues, background workers, Python services.~~ *(lifted 2026-08-18 — see Amendment; queues/workers/Python services remain excluded)*
- ~~Accounts, login, sessions, identity, roles, user_id columns.~~ *(lifted 2026-08-18 — see Amendment)*
- ~~Cross-device sync, cloud save, classroom rosters, teacher dashboards.~~ *(lifted 2026-08-18 — see Amendment)*
```

- [ ] **Step 3: Commit the paperwork**

```powershell
git add docs/product-contract.md docs/classroom-platform.md docs/classroom-platform-stack.md docs/azure-cost-estimate.md docs/Physics-IDE-Azure-Cost-Estimate.docx docs/superpowers/plans/2026-08-18-classroom-platform-01-foundation.md
git commit -m "docs: amend product contract and land approved classroom-platform spec, stack briefing, and plan 1"
```

---

### Task 2: Monorepo root — move the app into `frontend/`

**Files:**
- Create: root `package.json` (new workspaces manifest), root `.gitignore` (extend)
- Move: `src/`, `public/`, `scripts/`, `e2e/`, `tools/`, `build/`, `vercel.json`, `md2pdf.config.json`, `package.json` → `frontend/`
- Delete: root `package-lock.json` (regenerated at root by workspaces install)

**Interfaces:**
- Produces: workspace names `@physics-ide/frontend` (this task), `@physics-ide/shared` (Task 5), `@physics-ide/backend` (Task 6); root scripts `npm run check:blocks`, `npm run test`.

- [ ] **Step 1: Move the app**

```powershell
mkdir frontend
git mv src frontend/src
git mv public frontend/public
git mv scripts frontend/scripts
git mv e2e frontend/e2e
git mv tools frontend/tools
git mv build frontend/build
git mv vercel.json frontend/vercel.json
git mv md2pdf.config.json frontend/md2pdf.config.json
git mv package.json frontend/package.json
git rm package-lock.json
```

- [ ] **Step 2: Edit `frontend/package.json`** — rename, drop `eject`:

Change only these fields (leave `dependencies`, `jest`, `browserslist`, `eslintConfig` untouched for now — they die in Tasks 3–4):

```json
"name": "@physics-ide/frontend",
"scripts": {
  "start": "react-scripts start",
  "build": "react-scripts build",
  "test": "react-scripts test",
  "check:blocks": "node scripts/check-block-registry.mjs"
}
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "physics-ide",
  "version": "2.0.0",
  "private": true,
  "engines": { "node": ">=20.19.2" },
  "workspaces": ["frontend", "shared", "backend"],
  "scripts": {
    "check:blocks": "npm run check:blocks -w frontend",
    "test": "npm run test -ws --if-present"
  }
}
```

- [ ] **Step 4: Extend root `.gitignore`** — append:

```
frontend/dist/
backend/dist/
backend/.env
```

- [ ] **Step 5: Install and verify the moved app still works**

```powershell
npm install
npm run check:blocks
$env:CI="true"; npm run test -w frontend; Remove-Item Env:CI
```

Expected: install succeeds; check:blocks prints its pass output (script runs with CWD `frontend/`, so its relative `src/...` paths still resolve); all 6 Jest suites pass.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "chore: restructure into npm-workspaces monorepo; app moves to frontend/"
```

---

### Task 3: Migrate `frontend/` from CRA to Vite

**Files:**
- Create: `frontend/index.html` (from `frontend/public/index.html`), `frontend/vite.config.mjs`
- Modify: `frontend/package.json`
- Delete: `frontend/public/` (its only file was index.html), `frontend/build/` (legacy committed bundle)

**Interfaces:**
- Produces: `npm run start -w frontend` (Vite dev, port 3000, proxies `/api` → `http://localhost:4000`); `npm run build -w frontend` (outputs `frontend/dist/`).

- [ ] **Step 1: Install Vite**

```powershell
npm install -D -w frontend vite@^7 @vitejs/plugin-react@^5
```

- [ ] **Step 2: Move the HTML shell to Vite's location**

```powershell
git mv frontend/public/index.html frontend/index.html
```

Then edit `frontend/index.html`: keep every existing line byte-for-byte (the `data-theme="dark"` attribute, Inter font links, the four Blockly CDN scripts, the Monaco loader script, the `__GS_DIAG` inline script, the `.glow-host` style) and add **one line** before `</body>`:

```html
    <script type="module" src="/src/index.js"></script>
  </body>
```

Then remove the now-empty folder:

```powershell
git rm -r frontend/public
```

(If git reports nothing left to remove, the folder is already gone — fine.)

- [ ] **Step 3: Create `frontend/vite.config.mjs`**

The app's components are `.js` files containing JSX; the `esbuild`/`optimizeDeps` blocks below make Vite parse them without any renaming.

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: { loader: { ".js": "jsx" } },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://127.0.0.1:4000",
    },
  },
  build: { outDir: "dist" },
});
```

- [ ] **Step 4: Switch the scripts in `frontend/package.json`**

```json
"scripts": {
  "start": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "react-scripts test",
  "check:blocks": "node scripts/check-block-registry.mjs"
}
```

- [ ] **Step 5: Remove the legacy committed bundle**

```powershell
git rm -r frontend/build
```

- [ ] **Step 6: Verify dev and build**

```powershell
npm run build -w frontend
```

Expected: Vite build completes, `frontend/dist/` produced (untracked). Then:

```powershell
npm run start -w frontend
```

Open http://localhost:3000 and check by hand: Start Menu renders → create a Physics project from the Projectile template → block toolbox renders → press Run → the 3D viewport animates → Stop works. Open a Data Science template → table + chart render in the Data panel. Close the dev server (Ctrl+C).

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m "feat(frontend): migrate CRA to Vite 7; remove legacy committed build/"
```

---

### Task 4: Migrate tests from Jest (react-scripts) to Vitest

The 6 suites are pure-logic tests using no `jest.*` APIs and no testing-library — only config moves.

**Files:**
- Modify: `frontend/vite.config.mjs`, `frontend/package.json`

**Interfaces:**
- Produces: `npm run test -w frontend` = `vitest run` (also reached by root `npm run test`).

- [ ] **Step 1: Install Vitest + jsdom**

```powershell
npm install -D -w frontend vitest@^4 jsdom@^25
```

- [ ] **Step 2: Add the `test` block to `frontend/vite.config.mjs`** — final file content:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: { loader: { ".js": "jsx" } },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://127.0.0.1:4000",
    },
  },
  build: { outDir: "dist" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.js",
    include: ["src/**/*.test.js"],
  },
});
```

(`globals: true` supplies the `describe/test/expect` globals CRA used to inject; `setupTests.js` keeps its TextDecoder/TextEncoder polyfill, harmless under Node 20.)

- [ ] **Step 3: Run the suites under Vitest before removing Jest**

```powershell
npx -w frontend vitest run
```

Expected: 6 test files, all pass. If a suite fails on an import CRA used to shim, fix the test file (not the source) and note it in the commit message.

- [ ] **Step 4: Cut react-scripts out of `frontend/package.json`**

- `"test": "vitest run"` in scripts.
- Remove `react-scripts` from `dependencies`; move `vercel` from `dependencies` to `devDependencies`.
- Delete the entire `jest`, `browserslist`, and `eslintConfig` blocks.

```powershell
npm install
```

(regenerates the root lockfile without react-scripts)

- [ ] **Step 5: Verify from the root**

```powershell
npm run test
npm run check:blocks
npm run build -w frontend
```

Expected: Vitest 6/6 suites pass; check:blocks passes; build passes.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat(frontend): replace react-scripts/Jest with Vitest; drop CRA config blocks"
```

---

### Task 5: `shared/` package — roles and workspace rule sets

First real domain content, used by both halves from Plan 2 onward: the class roles and the three built-in workspace rule sets from spec §5.4.

**Files:**
- Create: `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts`, `shared/src/roles.ts`, `shared/src/workspaceRules.ts`, `shared/src/workspaceRules.test.ts`

**Interfaces:**
- Produces (Plan 2+ relies on these exact names):
  - `CLASS_ROLES = ["student", "ta", "teacher"] as const`, type `ClassRole`
  - `ACCOUNT_ROLES = ["user", "admin"] as const`, type `AccountRole`
  - `WorkspaceRulesSchema` (Zod), type `WorkspaceRules` with keys: `editors: "blocks" | "code" | "both"`, and booleans `debug`, `importFiles`, `exportAndCopy`, `advancedBlocks`, `templates`
  - `BUILT_IN_RULE_SETS: Record<"open_practice" | "standard_classwork" | "locked_assessment", WorkspaceRules>`

- [ ] **Step 1: Create `shared/package.json`**

```json
{
  "name": "@physics-ide/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^4.0.0"
  }
}
```

(`main` points at raw TS source — Vite, tsx, and Vitest all transpile workspace TS imports natively; no build step for `shared/`.)

- [ ] **Step 2: Create `shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `shared/src/roles.ts`**

```ts
export const CLASS_ROLES = ["student", "ta", "teacher"] as const;
export type ClassRole = (typeof CLASS_ROLES)[number];

export const ACCOUNT_ROLES = ["user", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
```

- [ ] **Step 4: Write the failing test — `shared/src/workspaceRules.test.ts`**

```ts
import { describe, test, expect } from "vitest";
import { WorkspaceRulesSchema, BUILT_IN_RULE_SETS } from "./workspaceRules";

describe("built-in workspace rule sets", () => {
  test("all three built-in sets validate against the schema", () => {
    for (const set of Object.values(BUILT_IN_RULE_SETS)) {
      expect(() => WorkspaceRulesSchema.parse(set)).not.toThrow();
    }
  });

  test("open_practice switches everything on", () => {
    expect(BUILT_IN_RULE_SETS.open_practice).toEqual({
      editors: "both",
      debug: true,
      importFiles: true,
      exportAndCopy: true,
      advancedBlocks: true,
      templates: true,
    });
  });

  test("standard_classwork (the default) has import, export and templates off", () => {
    const s = BUILT_IN_RULE_SETS.standard_classwork;
    expect(s.importFiles).toBe(false);
    expect(s.exportAndCopy).toBe(false);
    expect(s.templates).toBe(false);
    expect(s.debug).toBe(true);
    expect(s.advancedBlocks).toBe(true);
    expect(s.editors).toBe("both");
  });

  test("locked_assessment switches every tool off", () => {
    expect(BUILT_IN_RULE_SETS.locked_assessment).toEqual({
      editors: "both",
      debug: false,
      importFiles: false,
      exportAndCopy: false,
      advancedBlocks: false,
      templates: false,
    });
  });

  test("schema rejects an unknown editors value", () => {
    expect(() =>
      WorkspaceRulesSchema.parse({ ...BUILT_IN_RULE_SETS.open_practice, editors: "voice" })
    ).toThrow();
  });
});
```

- [ ] **Step 5: Run it to make sure it fails**

```powershell
npm install
npm run test -w shared
```

Expected: FAIL — cannot resolve `./workspaceRules`.

- [ ] **Step 6: Create `shared/src/workspaceRules.ts`**

```ts
import { z } from "zod";

/** Which tools an assignment's workspace offers — spec §5.4. */
export const WorkspaceRulesSchema = z.object({
  editors: z.enum(["blocks", "code", "both"]),
  debug: z.boolean(),
  importFiles: z.boolean(),
  exportAndCopy: z.boolean(),
  advancedBlocks: z.boolean(),
  templates: z.boolean(),
});

export type WorkspaceRules = z.infer<typeof WorkspaceRulesSchema>;

export const BUILT_IN_RULE_SETS: Record<
  "open_practice" | "standard_classwork" | "locked_assessment",
  WorkspaceRules
> = {
  open_practice: {
    editors: "both",
    debug: true,
    importFiles: true,
    exportAndCopy: true,
    advancedBlocks: true,
    templates: true,
  },
  standard_classwork: {
    editors: "both",
    debug: true,
    importFiles: false,
    exportAndCopy: false,
    advancedBlocks: true,
    templates: false,
  },
  locked_assessment: {
    editors: "both",
    debug: false,
    importFiles: false,
    exportAndCopy: false,
    advancedBlocks: false,
    templates: false,
  },
};
```

- [ ] **Step 7: Create `shared/src/index.ts`**

```ts
export * from "./roles";
export * from "./workspaceRules";
```

- [ ] **Step 8: Run tests and typecheck — expect green**

```powershell
npm run test -w shared
npm run typecheck -w shared
```

Expected: 5 tests pass; tsc silent.

- [ ] **Step 9: Commit**

```powershell
git add shared package.json package-lock.json
git commit -m "feat(shared): add shared package with class roles and workspace rule sets"
```

---

### Task 6: `backend/` — Fastify skeleton with typed config and health route

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/.env.example`, `backend/src/config.ts`, `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/app.test.ts`

**Interfaces:**
- Produces: `buildApp(): FastifyInstance` (all routes register inside it — every future API test uses `buildApp` + `app.inject`); `config` object `{ port: number; databaseUrl: string; nodeEnv: "development" | "test" | "production" }`; `GET /api/health` → `200 {"ok":true,"service":"physics-ide-api"}`.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "@physics-ide/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@physics-ide/shared": "*",
    "dotenv": "^16.4.0",
    "drizzle-orm": "^0.44.0",
    "fastify": "^5.0.0",
    "pg": "^8.13.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^20.17.0",
    "@types/pg": "^8.11.0",
    "drizzle-kit": "^0.31.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create `backend/.env.example`**

```
PORT=4000
DATABASE_URL=postgres://postgres:physics@localhost:5433/physics_ide
```

Copy it to the real (gitignored) env file:

```powershell
Copy-Item backend/.env.example backend/.env
```

- [ ] **Step 4: Write the failing test — `backend/src/app.test.ts`**

```ts
import { describe, test, expect } from "vitest";
import { buildApp } from "./app.js";

describe("GET /api/health", () => {
  test("returns ok with the service name", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "physics-ide-api" });
    await app.close();
  });
});
```

- [ ] **Step 5: Install and run the test to verify it fails**

```powershell
npm install
npm run test -w backend
```

Expected: FAIL — cannot resolve `./app`.

- [ ] **Step 6: Create `backend/src/config.ts`**

```ts
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgres://postgres:physics@localhost:5433/physics_ide"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const env = EnvSchema.parse(process.env);

export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  nodeEnv: env.NODE_ENV,
} as const;
```

- [ ] **Step 7: Create `backend/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });

  app.get("/api/health", async () => ({ ok: true, service: "physics-ide-api" }));

  return app;
}
```

- [ ] **Step 8: Create `backend/src/server.ts`**

```ts
import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = buildApp();

app.listen({ port: config.port, host: "127.0.0.1" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

(`.js` extensions on relative imports are required by NodeNext module resolution even for TS files.)

- [ ] **Step 9: Run test to verify it passes, then typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: 1 test passes; tsc silent.

- [ ] **Step 10: Smoke the real server**

```powershell
npm run dev -w backend
```

In a second terminal: `curl.exe http://localhost:4000/api/health` → `{"ok":true,"service":"physics-ide-api"}`. Stop the server (Ctrl+C).

- [ ] **Step 11: Commit**

```powershell
git add backend package.json package-lock.json
git commit -m "feat(backend): Fastify skeleton with zod-validated config and /api/health"
```

---

### Task 7: Postgres in Docker, Drizzle schema, first migration, seed

**Files:**
- Create: `docker-compose.yml` (root), `backend/db/init.sql`, `backend/drizzle.config.ts`, `backend/src/db/schema.ts`, `backend/src/db/client.ts`, `backend/src/db/settings.ts`, `backend/src/db/settings.test.ts`, `backend/src/seed.ts`
- Generated: `backend/drizzle/` migration folder (committed)

**Interfaces:**
- Consumes: `config` from Task 6.
- Produces (Plan 2+ relies on these exact names):
  - `db` (Drizzle instance) and `pool` from `backend/src/db/client.ts`
  - Tables `settings` (`key text pk`, `value jsonb`), `events` (`id bigserial pk`, `type text`, `actorId uuid | null`, `payload jsonb`, `createdAt timestamptz`)
  - `getSetting(db, key): Promise<unknown | undefined>` and `setSetting(db, key, value): Promise<void>` from `backend/src/db/settings.ts`
  - Seeded setting: key `account_cap`, value `200`
  - npm scripts: root `db:up` / `db:down`; backend `db:generate` / `db:migrate` / `seed`

- [ ] **Step 1: Create root `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: physics
      POSTGRES_DB: physics_ide
    ports:
      - "5433:5432"
    volumes:
      - dbdata:/var/lib/postgresql/data
      - ./backend/db/init.sql:/docker-entrypoint-initdb.d/init.sql
volumes:
  dbdata:
```

- [ ] **Step 2: Create `backend/db/init.sql`** (runs once on first container start; creates the test database)

```sql
CREATE DATABASE physics_ide_test;
```

- [ ] **Step 3: Add DB scripts**

Root `package.json`, add to `scripts`:

```json
"db:up": "docker compose up -d db",
"db:down": "docker compose down"
```

`backend/package.json`, add to `scripts`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:migrate:test": "cross-env DATABASE_URL=postgres://postgres:physics@localhost:5433/physics_ide_test drizzle-kit migrate",
"seed": "tsx src/seed.ts"
```

Install the one helper that makes the test-migrate script Windows-safe:

```powershell
npm install -D -w backend cross-env@^7
```

- [ ] **Step 4: Start the database**

```powershell
npm run db:up
docker compose ps
```

Expected: `db` service `running`. (First start pulls the image and runs init.sql.)

- [ ] **Step 5: Create `backend/src/db/schema.ts`**

```ts
import { pgTable, text, jsonb, bigserial, uuid, timestamp } from "drizzle-orm/pg-core";

/** Admin-adjustable switches — first row: account_cap = 200 (spec §3.1). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

/** Append-only audit trail (spec §8). Never updated, never deleted. */
export const events = pgTable("events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  type: text("type").notNull(),
  actorId: uuid("actor_id"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 6: Create `backend/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:physics@localhost:5433/physics_ide",
  },
});
```

- [ ] **Step 7: Generate and apply the first migration (dev + test databases)**

```powershell
npm run db:generate -w backend
npm run db:migrate -w backend
npm run db:migrate:test -w backend
```

Expected: a SQL file appears under `backend/drizzle/` creating both tables; both migrate runs succeed.

- [ ] **Step 8: Create `backend/src/db/client.ts`**

```ts
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
export const db = drizzle(pool, { schema });
```

- [ ] **Step 9: Write the failing settings test — `backend/src/db/settings.test.ts`**

Vitest picks up `DATABASE_URL` from the environment; the test targets the test database.

```ts
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { getSetting, setSetting } from "./settings.js";

const TEST_URL = "postgres://postgres:physics@localhost:5433/physics_ide_test";
const pool = new pg.Pool({ connectionString: TEST_URL });
const db = drizzle(pool, { schema });

beforeAll(async () => {
  await pool.query('TRUNCATE TABLE "settings"');
});

afterAll(async () => {
  await pool.end();
});

describe("settings store", () => {
  test("getSetting returns undefined for a missing key", async () => {
    expect(await getSetting(db, "missing_key")).toBeUndefined();
  });

  test("setSetting writes and getSetting reads back", async () => {
    await setSetting(db, "account_cap", 200);
    expect(await getSetting(db, "account_cap")).toBe(200);
  });

  test("setSetting overwrites an existing key (upsert)", async () => {
    await setSetting(db, "account_cap", 150);
    expect(await getSetting(db, "account_cap")).toBe(150);
  });
});
```

- [ ] **Step 10: Run it to make sure it fails**

```powershell
npm run test -w backend
```

Expected: FAIL — cannot resolve `./settings`. (The health test from Task 6 still passes.)

- [ ] **Step 11: Create `backend/src/db/settings.ts`**

```ts
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { settings } from "./schema.js";

type Db = NodePgDatabase<typeof schema>;

export async function getSetting(db: Db, key: string): Promise<unknown | undefined> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  return rows[0]?.value;
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}
```

- [ ] **Step 12: Run tests to verify green, then typecheck**

```powershell
npm run test -w backend
npm run typecheck -w backend
```

Expected: 4 tests pass (1 health + 3 settings); tsc silent.

- [ ] **Step 13: Create `backend/src/seed.ts`**

```ts
import { db, pool } from "./db/client.js";
import { setSetting, getSetting } from "./db/settings.js";

const existing = await getSetting(db, "account_cap");
if (existing === undefined) {
  await setSetting(db, "account_cap", 200);
  console.log("Seeded account_cap = 200");
} else {
  console.log(`account_cap already set to ${existing} — leaving as is`);
}
await pool.end();
```

- [ ] **Step 14: Run the seed against the dev database**

```powershell
npm run seed -w backend
```

Expected: `Seeded account_cap = 200`. Run it again: `account_cap already set to 200 — leaving as is`.

- [ ] **Step 15: Commit**

```powershell
git add docker-compose.yml backend package.json package-lock.json
git commit -m "feat(backend): Postgres via docker compose, Drizzle schema + first migration, settings store, seed"
```

---

### Task 8: One-command dev, root wiring, docs

**Files:**
- Modify: root `package.json`, `README.md`, `DEPLOY.md`

**Interfaces:**
- Produces: `npm run dev` (API on 4000 + frontend on 3000 with `/api` proxy), `npm run db:up`, `npm run test`, `npm run check:blocks` — the four commands every later plan's steps assume.

- [ ] **Step 1: Install concurrently and wire the root `dev` script**

```powershell
npm install -D concurrently@^9
```

Root `package.json` scripts become:

```json
"scripts": {
  "dev": "concurrently -n api,web -c blue,green \"npm run dev -w backend\" \"npm run start -w frontend\"",
  "db:up": "docker compose up -d db",
  "db:down": "docker compose down",
  "check:blocks": "npm run check:blocks -w frontend",
  "test": "npm run test -ws --if-present"
}
```

- [ ] **Step 2: Full-stack smoke test**

```powershell
npm run db:up
npm run dev
```

In a second terminal:

```powershell
curl.exe http://localhost:3000/api/health
```

Expected: `{"ok":true,"service":"physics-ide-api"}` — served by Vite's proxy through to Fastify, proving the halves are wired. Also open http://localhost:3000 and confirm the IDE still loads and runs a template. Stop dev (Ctrl+C).

- [ ] **Step 3: Update `README.md`** — replace the current "Install and Run" code blocks (section 2) with:

````markdown
**Requirements:** Node.js 20.19+, npm 10+, Docker Desktop (for the local database).

```bash
npm install
npm run db:up      # start Postgres (Docker)
npm run dev        # API on :4000 + app on :3000
```

```bash
npm run test           # all workspace test suites (Vitest)
npm run check:blocks   # verify block registry has no duplicates
npm run build -w frontend   # production build → frontend/dist/
```

The repo is an npm-workspaces monorepo: `frontend/` (the React IDE, Vite), `backend/` (Fastify API), `shared/` (schemas used by both). The classroom platform is being built per [docs/classroom-platform.md](docs/classroom-platform.md).
````

- [ ] **Step 4: Update `DEPLOY.md`** — add at the top, under the title:

```markdown
> **Restructure note (Aug 2026):** the static app now lives in `frontend/` (build output `frontend/dist/`, no longer a committed `build/` folder). Point Vercel/Cloudflare's root directory at `frontend/` with build command `npm run build` and output `dist`. Backend deployment arrives with the GCP plan (see docs/classroom-platform-stack.md §6).
```

- [ ] **Step 5: Final verification sweep**

```powershell
npm run test
npm run check:blocks
npm run build -w frontend
npm run typecheck -w backend
npm run typecheck -w shared
```

Expected: everything green — 6 frontend suites, 5 shared tests, 4 backend tests, clean build, silent typechecks.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat: one-command dev (concurrently), root scripts, README/DEPLOY updated for monorepo"
```

---

## Completion criteria (what Plan 2 may assume)

- `npm run db:up && npm run dev` gives a working IDE on :3000 (unchanged behaviour) and an API on :4000, proxied.
- Vitest everywhere; `npm run test` runs all three workspaces green.
- `settings`/`events` tables exist in dev and test databases; `account_cap=200` seeded; `getSetting`/`setSetting` available.
- `@physics-ide/shared` exports `CLASS_ROLES`, `ACCOUNT_ROLES`, `WorkspaceRulesSchema`, `BUILT_IN_RULE_SETS`.
- Product contract amended; all platform docs committed on `feature/classroom-platform`.
