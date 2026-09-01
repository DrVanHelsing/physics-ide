# Classroom Platform — Stack & Implementation Briefing

**What this document is.** The engineering companion to the approved [classroom-platform.md](classroom-platform.md): what the frontend and backend will be built with, how the repository will be laid out, how everything runs on your machine with zero cloud, and how it ports to Google Cloud at the end. It names technologies and explains each choice in one breath. It is **not the build plan** — that comes after you approve this. Two decisions are embedded for your nod, marked ⚖️.

Guiding rules inherited from the spec: at most 200 users, nothing wasteful, physics never runs on a server, everything works locally first.

---

## 1. The shape at a glance

One repository, reorganised into a clean root (this is the restructure you asked for):

```
Physics IDE/
  frontend/     The React app people see — the IDE plus every portal screen
  backend/      The API — accounts, classes, assignments, submissions, marking, audit
  shared/       Small package used by BOTH halves: data shapes, validation rules,
                role definitions, the three built-in workspace rule sets
  docs/         All documentation (unchanged location)
  infra/        Added only at the cloud step: container + deployment config
```

- **One language everywhere: TypeScript.** The frontend is already JavaScript/React; giving the backend the same language means one toolchain, one test runner, and shared code instead of duplicated rules. The `shared/` package is the concrete maintainability win: the API and the app validate against the *same* definitions, so they cannot drift apart.
- **npm workspaces** tie the three packages together — `npm install` once at the root, and `npm run dev` starts everything.

---

## 2. The frontend half

- **React 18 stays.** The IDE core — Blockly workspace, Monaco editor, GlowScript iframe runner, Arquero + Observable Plot data panel, the debug tools — moved into `frontend/` and was then **modernized in place** (20–21 August 2026): a design-token layer, three shared primitives, an adaptive zoned header, an on-canvas zoom cluster, an idle-atom boot state, a 26-category Blockly palette with `physics-light` / `physics-dark` Zelos themes, matching Monaco themes, and a docked debug drawer. The simulation **engine** is unchanged — GlowScript, Arquero, Observable Plot, all still browser-side. But the IDE is no longer a black box the portal merely wraps: the two halves share one visual system, governed by [classroom-platform.md](classroom-platform.md) §18.
- **Build tool: Vite** — *the ⚖️ decision in §8, resolved: the migration is done.* CRA is gone; `frontend/package.json` runs `vite` / `vite build` / `vite preview` with `@vitejs/plugin-react`, and the tests run on **Vitest**. Dev startup dropped from ~20 s to ~1 s as expected.
- **React Router** for the ~24 portal screens. Shipped: `frontend/src/App.js` routes `/`, `/welcome`, `/auth/*`, `/profile`, `/admin`, `/classes/*` and `/join/*` today, with the whole tree inside one provider stack (`ThemeProvider` included, so every route resolves both themes).
- **The design system is a shared dependency, not an IDE detail.** `frontend/src/styles/tokens.css` (every metric, both theme blocks, the single focus rule, and the generated `--cat-*` block), `frontend/src/styles/primitives.css` (`.btn` / `.card` / `.panel-header`) and `frontend/src/components/Icons.js` are consumed by both halves. `frontend/src/styles.css` is a 17-line import manifest whose **order is load-bearing**: shared primitives belong in `primitives.css`; portal-screen rules belong in `platform.css`, which is imported after it. Appending new rules to `styles.css` itself is wrong.
- **TanStack Query** manages talking to the API (caching, retries, loading states) — the standard companion to React for this, and it keeps us far away from heavyweight state frameworks.
- **The sync engine** builds on what exists: projects keep saving to **localForage** (the browser-side store already in the app) exactly as today — that is the offline half, already proven. A small sync layer pushes each save to the API whenever online and pulls on open. The existing `.physide.json` manifest format becomes the sync and submission payload — the prior-art sweep confirmed it's already the de-facto submission format, so nothing new is invented.
- **Instructions editor: TipTap** (the standard React rich-text editor, built on ProseMirror) with extensions for headings, lists, images, callouts, and YouTube/Vimeo embeds. **KaTeX** renders equations. Content is stored as structured JSON, shown to students through a read-only renderer — teachers author, students view, same component.
- **QR codes** are generated in the browser by a tiny library — no service involved.

---

## 3. The backend half

- **Node.js + TypeScript + Fastify.** Fastify is a mature, fast, small API framework with first-class input validation and a plugin system (rate limiting, file uploads, cookies) — comfortable for one maintainer, and it containerises perfectly for Cloud Run later. *Deliberately not NestJS:* the project's original abandoned plan (NestJS + Postgres + Redis + BullMQ + FastAPI) is remembered in the docs as over-built, and that lesson is kept: this backend is **one process, no queues, no Redis, no background workers, no websockets, no microservices.**
- **Plain REST + JSON API** under `/api/*`. Every request body is validated at the door with **Zod** schemas that live in `shared/` — the same schemas the frontend uses, so the contract is enforced twice from one definition.
- **Authentication is built in, not bought:** passwords hashed with **argon2id** (the current best practice), sessions stored server-side in the database, delivered as httpOnly secure cookies. Email verification and password-reset are single-use expiring tokens. Sign-in endpoints are rate-limited. At 200 users this is small, fully under our control, identical locally and in the cloud, and keeps all identity data in one place (good for POPIA). Google sign-in can be added later without redesign.
- **Roles are middleware:** every route declares who may call it (student / TA / teacher / admin, scoped to the class), and the 200-account cap is enforced inside the signup transaction — the spec's promises, verbatim, in code.
- **The audit trail is an append-only `events` table**, written in the same database transaction as the action it records — a share, a submission, a mark release cannot happen without its event, and events are never updated or deleted.
- **Workspace rules** live as JSON on each assignment (plus teachers' saved custom sets in their account). The frontend removes switched-off tools from the workspace; the backend refuses the corresponding requests (imports rejected, export endpoints deny). **The frontend half is a data change, not a JSX change:** the header is rendered from the pure `visibleControls({ mode, goal, role, isTeacher, runState, debugMode, traceVisible })` in `frontend/src/utils/toolbar/visibleControls.js`, and a switched-off tool is removed from the key list that function returns for the assignment — never CSS-hidden, never `disabled` in place. The same rule must be handled by the header's stage-2 overflow menu, so narrowing the window cannot resurrect a forbidden control. See spec §5.4 and §18. One honest note: copy-to-clipboard is a browser feature — we remove the buttons and code paths, but no web app can stop a student photographing a screen; the spec's framing ("shaping the workspace") is the truthful one.
- **Files** (instruction images, attachments, submission snapshots) go through a small `BlobStore` interface: on your machine it writes to a local folder; on GCP the same interface writes to Cloud Storage. Size caps enforced server-side.
- **Email** goes through a matching `Mailer` interface: the dev driver writes every message into the database, powering the **pretend inbox** screen from the spec; the production driver (a provider like Brevo or Mailgun — chosen at the cloud step) is a drop-in swap. Templates are written once.
- **Scheduled things** (the due-tomorrow reminder) are a single "daily tick" endpoint. Locally it fires automatically; on GCP, Cloud Scheduler (free) calls it once a day. No always-on clock process anywhere.

---

## 4. The database

⚖️ **PostgreSQL, with the Drizzle ORM.** This is the one real fork, so both options honestly:

| | **PostgreSQL** (recommended) | Firestore |
|---|---|---|
| Fit for the data | Excellent — rosters, marks, group members, audit events are classic relational data with joins everywhere | Awkward — document store; gradebooks and "who hasn't submitted" queries get contorted |
| Prior art | Recommended twice independently in the repo's own docs | None |
| Locally | Runs in Docker with one command; identical to production | Emulator exists but is a second system to babysit |
| Cost on GCP | The **one always-on cost**: smallest Cloud SQL instance ≈ **$10–15/mo (~R200–300)** | Effectively **R0** at 200 users |
| Lock-in | None — standard Postgres runs anywhere | Google-only |

My recommendation: **PostgreSQL.** The monthly cost is within the budget you've already seen and accepted, and the data model fits like a glove; fighting a document store to save R250/mo is a bad trade for a marks system. (If R0 ever becomes mandatory, the Drizzle layer keeps the blast radius contained — but I would not design for that now.)

**Drizzle** (rather than Prisma) because it is lightweight, TypeScript-first, adds no heavy engine to the small Cloud Run container, and its migration tool gives us versioned, reviewable schema changes.

The schema, one line per table so you can see the whole thing:

| Table | Holds |
|---|---|
| `users` | Accounts: name, email, hashed password, role flags, active/deactivated |
| `sessions` | Who is signed in where |
| `email_tokens` | One-time verify/reset tokens |
| `settings` | The account cap and other admin-adjustable switches |
| `classes` | Classrooms, join codes, joining/sharing rules, archived flag |
| `class_members` | Who is in which class, as what (student / TA / teacher) |
| `invites` | Pending email invites and their status |
| `assignments` | Details, dates, points, submission mode, workspace rules JSON, lifecycle state |
| `rule_sets` | Teachers' saved custom workspace rule sets |
| `groups` / `group_members` | Pair/group composition per assignment, plus the editing baton (lease) |
| `projects` | Each person's/group's cloud-saved projects (the manifest JSON) |
| `checkpoints` | The version history: snapshot, timestamp, **author** — feeds timelines and the baton |
| `submissions` | Frozen snapshots with content fingerprint, late flag, attempt number |
| `marks` | Mark + feedback + private note, draft/released, who wrote it (TA drafts live here) |
| `guides` | Standalone rich pages per class |
| `events` | The append-only audit trail |
| `emails` | Every email sent (and the dev pretend inbox) |
| `files` | Metadata for stored images/attachments |

---

## 5. Building and testing with zero cloud

- **One command:** `npm run dev` starts the API, the frontend, and (via Docker) the local Postgres. A seed script creates your admin account, a demo teacher, a demo class with students, and a sample assignment — so every work session starts in a clickable world.
- **The pretend inbox** is a real screen from day one; every email flow (confirm, invite, receipt, release) is testable end-to-end on your machine.
- **Tests:** Vitest on both halves (the existing frontend tests migrate); API tests hit Fastify directly without a running server; **Playwright** drives the five golden flows in a real browser — sign up → create class → invite/join → assign (with rules) → submit → mark → release.
- **Design-system regressions belong in that same suite** (spec §18 is the contract they enforce): the `data-theme` attribute actually flips and the product starts dark; a `prefers-reduced-motion` guard exists in shipped CSS; no portal rule redefines the focus ring; no literal `px` metric survives in `platform.css`. The IDE equivalents already exist in `frontend/scripts/e2e-test.mjs` and are the pattern to copy. **Open gap:** `docs/e2e-checklist.md` covers only the IDE — welcome, auth, classes, admin and join have zero end-to-end coverage in either the checklist or Playwright. Closing it is a build-plan task, not a spec change.
- **Sync mechanics, concretely:** each project carries a revision number. The client pushes snapshots (they're small — kilobytes of JSON); if the server sees the push is based on an older revision, newest-wins and the losing version is stored as a checkpoint — the spec's rule, mechanised. The group **baton** is a lease field on the group project (holder + expiry); others poll it cheaply when the assignment is open. No live connections anywhere — that's a deliberate resource choice.

---

## 6. The Google Cloud port (the last step)

The mapping is one-to-one because the interfaces above were designed for it:

| Piece | GCP home | Expected cost at 200 users |
|---|---|---|
| Frontend (static files) | Firebase Hosting | ~R0 |
| Backend API (container) | **Cloud Run**, scale-to-zero | ~R0–50/mo (school-hours traffic, sleeps otherwise) |
| Database | **Cloud SQL Postgres**, smallest tier | ~R200–300/mo — the one always-on line |
| Files | Cloud Storage bucket | ~R10–30/mo |
| Daily reminder tick | Cloud Scheduler | R0 (free tier) |
| Secrets (DB password, cookie key) | Secret Manager | ~R0 |
| Email | Provider chosen then (e.g., Brevo free tier ≈ 300 emails/day) | R0 at this scale |

- **Region: `africa-south1` (Johannesburg)** — Google's South African region, keeping student data in-country, which strengthens the POPIA story from spec §11. *(Amended, Plan 9 Task 11 / D§10 fiat 12: mail — and only mail — leaves the region. Outbound email is delivered by Brevo, whose infrastructure is not in-country; recipient addresses and message content transit it. Everything else stays in `africa-south1`.)*
- **Total expectation: roughly R250–400/month**, dominated by the database — in line with everything you've budgeted before.
- Lessons carried over from the Azure costing exercise: keep log ingestion minimal from day one (it's the classic silent bill), never attach networking extras that break scale-to-zero, and scale down between terms.
- The backend gets its Dockerfile only at this step (`infra/`); local development stays plain Node — no Docker-except-Postgres on your machine.

---

## 7. What is deliberately absent

No Redis, no message queues, no background workers, no websockets, no Kubernetes, no microservices, no GraphQL, no server-side code execution of student work — ever. Each of these is the standard way small projects become expensive, fragile ones. Everything in the spec is achievable with one API process, one database, and static files.

---

## 8. The two nods I need, then the plan

1. ⚖️ **PostgreSQL over Firestore** (§4) — accepts ~R250/mo as the system's one standing cost.
2. ⚖️ **CRA → Vite migration** during the restructure (§2).

Approve this briefing (with or without overriding those two), and the next deliverable is the **implementation plan**: the ordered, testable build stages from empty `backend/` folder to you clicking through the full classroom flow on your machine.

**Both nods were given, and both have shipped** (recorded here so this section is not read as an open question): `backend/` runs Fastify + Drizzle against PostgreSQL with argon2id auth, and `frontend/` builds with Vite and tests with Vitest. Add a design-system row to the same ledger — see [product-contract.md](product-contract.md)'s Locked decisions and spec §18.
