# Physics IDE — Product Contract (v1)

This document is the single source of truth for what v1 of the unified Physics + Data Science IDE is and is not. If a future change conflicts with anything here, the change requires an explicit decision recorded by updating this file — not a silent drift in the code.

The full multi-phase plan lives in [plan.md](../plan.md). This document captures the locked decisions and exclusions extracted from that plan.

---

## Product shape

A browser-based classroom IDE for physics modelling and foundational data science. Three first-class project goals, one editor surface:

- **Physics Modelling** — VPython / GlowScript simulations, the current capability.
- **Data Science** — foundational table analysis on built-in or imported datasets.
- **Hybrid** — both goals composed; simulations promote runs into datasets for analysis.

Inside each goal the student picks an editing mode: **Blocks** or **Code**. There is no beginner/advanced *mode* — the block toolbox is generated per goal from the canonical registry, and rarely-used categories collapse under an **Advanced** drawer. (A guided **Walkthrough Mode**, selectable at project creation, is a planned future phase — see the roadmap note below.)

---

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Static SPA on Vercel or Cloudflare Pages; *amended 1 Sep 2026 (Plan 9 Task 10a, change protocol):* **Firebase Hosting fronting Cloud Run is also permitted** — the app is same-origin by construction (every call a relative `/api/...` path, `credentials: "same-origin"`, `SameSite=Lax`, no CORS plugin), so the static host must be able to front the API. See the Postman amendment below. | Free tier, no cold starts, fits the "all free services" constraint. |
| Backend (v1) | **None** | All execution and persistence runs in the browser. Phase D and E gates documented below. |
| Auth (v1) | **None** | Not designed, not stubbed, not "made future-ready". Phase E feature, not infrastructure. |
| DS table ops | **Arquero** | dplyr-like, ~80 kB gz, fast at classroom scale. Validated by [docs/phase-a-eval.md](phase-a-eval.md). |
| Charts | **Observable Plot** | Declarative SVG, ~16 kB gz, covers all five foundational chart types. |
| Persistence | **localForage** (IndexedDB-backed) | Same async API everywhere; handles dataset / run blobs without quota worry. |
| Project model | **Multi-project library** | Start menu lists saved projects; manifest carries `id` used as storage key. |
| Built-in datasets | **Penguins, Weather, Planets** | Titanic intentionally excluded — death-outcome ethics. |
| Bundle export | **Both `.physide.json` and `.physide.zip`** | JSON default; ZIP offered when project has large datasets or chart PNGs. JSZip lazy-loaded. |
| Block toolbox | **Generated per goal from the registry** | One source of truth ([src/utils/blockly/toolbox.js](../src/utils/blockly/toolbox.js)); `buildToolboxXml(goal)` filters by each block's domain tag, so DS projects never show physics blocks and vice-versa. No hand-maintained duplicate toolboxes. Category and block colour come from one module, `src/utils/blockly/blockPalette.js`, and `npm run check:blocks` validates registry↔toolbox ids AND category names in both directions. |
| Toolbox complexity | **Single toolbox + "Advanced" drawer** | Beginner/Advanced *mode* removed. Power-user categories (3D Math, Raw Python, Loops, Text, Lists, Functions) collapse under one Advanced section, MakeCode-style. |
| Program anchor | **Hat blocks + disable-orphans** | Physics uses `sim_start`/`sim_end`; data analyses use a `ds_start` "Start analysis" hat. Top-level blocks outside the anchor are greyed and ignored, so "in use vs unused" is visible. |
| Goal field | **Additive** | New `goal` on the manifest; existing `projectType` (custom / code_blank / code_template / block_template) stays as origin metadata. They are orthogonal axes. |
| Runtime abstraction | **Deferred** | No interface until a concrete second runtime exists. Physics stays in `src/utils/runner/glowRunner.js`; DS calls Arquero / Plot directly from block generators. The GlowScript 3.2 runtime is vendored at `frontend/public/vendor/glowscript/` (six files, provenance and SHA-256s recorded there) so §101's offline promise holds; Blockly is a pinned-exact npm dependency, not a CDN script. |
| Type system | **Minimal** | Blockly connection checks + the new shared type tags. No coercion engine in v1. |
| Bundle import | **Full-replace** | Confirmation dialog. Partial-merge revisited in v1.x with a real workflow spec. |
| Design tokens *(added 22 Aug 2026 — see the Design-system amendment)* | **`frontend/src/styles/tokens.css` is the single source of every metric and colour** | 4px space ramp of nine rungs (extended once, 22 Aug 2026, for the welcome page's section rhythm — `--space-9: 64px`), nine-step type scale, three radii, three durations, three control heights (22 / 30 / 38px), one micro-label system plus one named exception (`--tracking-code`, the join code's display tracking). Replaced 16 ad-hoc pixel values. No literal metric in any new rule. |
| Theme model | **`data-theme` attribute on `<html>`; dark default; light is one override block** | No `prefers-color-scheme` path exists anywhere in app CSS and none may be added — a projected classroom needs light mode *chosen*, not inherited. Derived role tokens are declared once in the dark block and re-resolve under light by `var()`. |
| Component primitives | **`.btn` / `.card` / `.panel-header` in `frontend/src/styles/primitives.css`** | Legacy class names are comma-appended aliases: migration debt, not API. New surfaces use the canonical class plus modifiers. |
| Icon idiom | **One module — `frontend/src/components/Icons.js`** | Inline SVG line art on a 24 grid, `stroke="currentColor"`, `strokeWidth 2`, `size` prop. **No emoji in product UI** (standing owner rule, 19 Aug 2026). No second icon module. |
| Minimum viewport | **1024px** | Header collapse stages chosen so stage 2 is active *at* the floor, not below it; nothing load-bearing may be hidden at stage 2. Coarse-pointer targets ≥32px. No support obligation below 1024px. |

---

## Exclusion list

The following are explicitly out of scope for v1 and require a written decision to bring back in:

- ~~Servers, databases, queues, background workers, Python services.~~ *(lifted 2026-08-18 — see Amendment; queues/workers/Python services remain excluded)*
- ~~Accounts, login, sessions, identity, roles, user_id columns.~~ *(lifted 2026-08-18 — see Amendment)*
- ~~Cross-device sync, cloud save, classroom rosters, teacher dashboards.~~ *(lifted 2026-08-18 — see Amendment)*
- Collaboration, real-time multi-user editing, comments.
- Machine learning, train / test splits, model fitting, prediction.
- Joining or merging across multiple tables.
- Advanced statistics — hypothesis tests, correlation coefficients (visual correlation via scatter is in scope; r-values are not).
- Feature engineering, encoding, normalisation, derived-column DSLs.
- Regular expressions and ad-hoc string parsing blocks.
- Pie charts and heatmaps (foundational doc principle: misleading or beyond foundational scope).
- A second runtime engine or a runtime strategy interface.
- A block-level type coercion engine.

---

## Deferral gates

Phase D and E are not part of v1. They start only when the conditions below are met, documented somewhere a future maintainer will find.

### Phase D — Cloud save

Start only when at least one of the following is true and written down:

- Multiple users have explicitly asked for cross-device save.
- A classroom workflow has emerged that needs shareable project links.
- Bundle export / import has been shown insufficient in practice.

If green-lit: Supabase free tier, anonymous UUIDs, manifest JSON in one `projects` table, datasets in storage. **No auth in Phase D.** Local save remains the default; cloud is opt-in per project.

### Phase E — Auth and multi-user

Start only when a feature spec requires identity. Likely triggers (none committed):

- Teacher dashboards.
- Classroom rosters.
- Collaboration / comments.
- Cross-device same-user sync.

If green-lit: Supabase auth (method picked by actual user demand), one `users` table linking auth ids to existing anonymous project keys so anonymous work isn't lost on sign-in.

---

### Future — Guided Walkthrough Mode (feature, not infrastructure)

A step-by-step guided mode for beginners, **selectable at project creation** per goal (Physics / Data Science / Hybrid). It walks a learner through the intended block flow rather than hiding blocks — this replaces the removed beginner *toggle*. The retained [src/components/BeginnerGuide.js](../src/components/BeginnerGuide.js) component (goal-aware tips) is the seed. Browser-only UI, no backend and no auth, so it carries **no deferral gate** and can land any time after v1. Tracked as **Phase W** in [plan.md](../plan.md).

## Quality bar (v1.0 ship gate)

- Zero duplicated blocks. Enforced by `npm run check:blocks` in CI.
- All 59 foundational DS blocks (per [docs/foundational_ds_blocks.md](foundational_ds_blocks.md)) implemented with at least one passing unit test each.
- Trace-to-dataset → analysis → chart works end-to-end across both hybrid templates.
- Bundle round-trip works for both JSON and ZIP formats across the four manual flows.
- v1 → v2 manifest migration succeeds on a legacy save (`physics-lab-state-v1` localStorage key).
- App deploys to Vercel / Cloudflare Pages and runs fully offline after first load — Blockly (`blockly@11.2.2`), the GlowScript 3.2 runtime, and Monaco (`monaco-editor@0.45.0`) are all bundled or vendored at build time, same-origin, with no CDN dependency for any of the three (Plan 3, the MakeCode overhaul). **Qualification (verified by the Plan 3 Task 15 offline smoke test):** this holds for whatever the browser has already fetched into cache — there is no service worker. Content-hashed assets (the JS/CSS bundle, the Monaco chunk) get long-lived immutable caching from the build and are unaffected. The vendored GlowScript files under `frontend/public/vendor/glowscript/` are unhashed, so a *repeat* simulation Run after going offline needs the hosting layer to serve `/vendor/**` cacheably rather than `no-cache` (a `vite preview` default, not yet verified against the real deploy target) — tracked in `DEPLOY.md`'s pre-GCP checklist.
- Cold start under 3 s on the free tier.
- Trace render smooth at 5 k rows.
- Arquero ops on 10 k rows under 200 ms (Phase A measured 1.3–4.9 ms — actuals stay well inside this).
- Plot render of a 10 k-point chart under 500 ms.
- Project switch (save current + load new) under 200 ms.
- **Design-system gates** (added 22 Aug 2026, alongside the Locked-decision rows above):
  - No literal `px` metric in `frontend/src/styles/platform.css` or in any JSX `style={}` — lint-checked. *(Not yet enforced; the tokenisation pass and its lint are outstanding work — see [classroom-platform.md](classroom-platform.md) §18's forward references.)*
  - Every block-palette `fill` and `secondary` clears 4.5:1 against white, and no palette entry sits in the reserved red band (hue 340°–15°). Already enforced by `frontend/src/utils/blockly/__tests__/blockPalette.test.js`; stated here so it is a contract term, not only a test.
  - `paletteCssText()` output appears verbatim in `tokens.css`. Enforced by `frontend/src/utils/blockly/__tests__/paletteCssSync.test.js`.
  - Exactly one focus-ring rule ships; no component defines its own `:focus`.
  - Every animation carries a `prefers-reduced-motion` guard.
  - Zero emoji in product UI (Unicode scan over `frontend/src`).
- No HTTP requests to any third-party origin after first load, with one tracked exception: the Google Fonts `@import` in `styles.css` (documented deferral) — the historical "Monaco stays on a CDN" carve-out behind the old "non-CDN origins" wording is gone now that Monaco is bundled alongside Blockly and the vendored GlowScript runtime. Self-hosting Inter / JetBrains Mono is a tracked, deliberate deferral (see Plan 3's spec), not an oversight. Smoke-tested in CI.

---

## Stack notes (for future maintainers)

- **CRA is in maintenance mode.** Not a Phase A–C blocker. A future Vite migration is on the v1.x follow-up list; do not start it during the DS block migration.
- **localForage uses IndexedDB.** Quota is ample but browsers can evict on storage pressure. Surface usage in the start menu before quota fills; prompt to export.
- **Built-in datasets ship inline with the build**, not fetched at runtime. Code-split per goal so physics-only projects don't pay for the DS bundle on first load.
- **JSZip lands lazily** via `import()` and only loads when the user picks ZIP export.
- **Generated Python is hidden by default** and revealed on demand. The reveal emits clean, commented pandas-style code for DS blocks and VPython for physics blocks.

---

## Amendment — Classroom Platform (18 August 2026)

The Phase D and Phase E deferral gates have been satisfied by an explicit product decision. The owner approved a full classroom platform — accounts, teacher/learner/TA roles, classrooms, assignments, submissions, marking, and a light audit trail — specified in [docs/classroom-platform.md](classroom-platform.md) (functionality, approved 18 Aug 2026) and [docs/classroom-platform-stack.md](classroom-platform-stack.md) (stack, approved 18 Aug 2026).

Effective for the `feature/classroom-platform` branch onward:

- The exclusion-list bullets covering servers/databases, accounts/login/roles, cross-device sync/cloud save/rosters/dashboards are **lifted**. All other exclusions stand.
- Phase D/E's Supabase choice is **superseded**: the stack is a Fastify + PostgreSQL backend, self-hosted auth, Google Cloud (`africa-south1`) at deployment, hard cap **200 accounts**.
- The browser-first core is unchanged: simulation and DS execution never move server-side; guest mode remains.
- **The classroom platform inherits the design system below in full.** Portal screens are not a separate visual product; [classroom-platform.md](classroom-platform.md) §18 is their binding design contract.

## Amendment — Design system (22 August 2026)

**Trigger.** The IDE was modernized in place on 20–21 August 2026 — a design-token layer, three shared primitives, an adaptive zoned header, a light/dark theme pair, a docked debug drawer, the 26-category Blockly palette and matching editor themes — and this contract recorded none of it. That is a Change-protocol violation of the "contract first, code second" rule, remedied here retroactively: the five **Locked decisions** rows and the **Design-system gates** in the Quality bar above are the record.

**Consequence for future work.** Metrics, themes, primitives, icons and the minimum viewport are now locked decisions like any other. Changing a ramp, adding a token, or introducing a new visual pattern follows the Change protocol below — written here first, then built. Reaching for a literal pixel value because no rung fits is the signal to open the decision, not to skip it.

**The two decisions §18 left open are now closed** (22 Aug 2026), recorded in [classroom-platform.md](classroom-platform.md) §18's "Decisions taken": the welcome page's off-ramp section rhythm is resolved by extending the spacing ramp once (`--space-9: 64px`), and of the portal's extra letter-spacing values, only the join code's survives, as the named token `--tracking-code`. Both are reflected in the Design tokens row above.

## Amendment — Assignments and everything downstream (28 August 2026)

**Trigger.** The classroom platform's assignments build landed on `feature/classroom-platform`: assignments and guide pages, per-assignment workspace rules, student submissions with receipts, the marking room, mark release and return, the class gradebook with client-side CSV export, the History screen, pairs and groups with an editing baton, and one daily tick that sends due-tomorrow reminders. Its build decisions are specified in [docs/superpowers/specs/2026-08-25-classroom-platform-06-assignments-design.md](superpowers/specs/2026-08-25-classroom-platform-06-assignments-design.md) (approved 25 Aug 2026). The five recorded below are the ones that **constrain future work** rather than merely describe this build; they are locked decisions from this date, and changing one follows the Change protocol below.

- **The assignment link is a server row, never a manifest tag** (design §2). `assignment_work` maps a student's project to an assignment server-side. `SCHEMA_VERSION` stays **2**, the sync engine is untouched, and an export bundle cannot carry an assignment id. Consequence for future work: no feature may tag the manifest to mark work as classroom work — the tag would then be forgeable into or out of existence client-side, which the spec's §8 anticheat stance forbids. The server knows the mapping regardless, which is the whole point.
- **The workspace-rules chip lives in the status bar, beside `SyncChip`** (design §4 — a deviation from spec §5.4's "header view zone", recorded rather than silent). The view zone collapses entirely at 1120px and the design delta's S4 forbids the chip ever disappearing; the status strip is the one strip that never collapses at any width. It shortens; it never vanishes. New per-assignment state readouts go there, not into a collapsing zone. Related and equally binding: `visibleControls(state)` stays a **pure function** whose invariant suite extends but never changes, and the tool rules it does not govern are read from `WorkspaceRulesContext` by the named surfaces — File-menu items, **both** screenshot paths, Monaco copy, template browsing, the debug entry. Tool rules are honestly documented as client-side; where a rule has a server counterpart the backend refuses independently.
- **Assignment lifecycle is computed, and the vocabulary is fixed** (design §6). Published → Due → Closed derive from timestamps at read time; only Draft and Marks-released are stored transitions, plus manual overrides. Nothing may add a scheduled state machine — the single daily-tick endpoint exists solely to send due-tomorrow email. The screen is **History** and an entry is a **checkpoint**; one viewer component serves both the student's restore screen and the teacher's timeline. `MAX_VERSIONS_PER_PROJECT` stays **20**, and a longer growth history is recorded as a knob for the cloud plan, not promised.
- **Instruction images are inline data-URIs, capped** (design §7): **≤200KB per image, ≤1MB per document**, enforced in the shared zod schema and stated to the teacher at the point of use. No BlobStore until the cloud plan. Raising either cap is a contract change, not a config tweak. The TipTap + KaTeX editor bundle lazy-loads on teacher screens only; the IDE and student bundles are untouched.
- **Six open points closed by fiat** (design §11), load-bearing in this order: "missing" means a roster member with **no current submission after the due date**; a returned submission reopens that student's work regardless of Closed, until marks release; a new submission **flags** a draft mark as written against a previous attempt and never silently deletes it; late labels are computed against the dates in force at submit time and are **never retroactively re-stamped** when a teacher moves a date; the gradebook CSV is generated **client-side** from the grid query, with no server export endpoint and no file infrastructure; and the submission **fingerprint** shown on the receipt and in the marking room is the dispute authority — hashed once on the server over the one canonical stringifier (`stableStringify`, exported from `projects.ts`; a second canonical form would mean two fingerprints for one manifest) and rendered by both surfaces from that single value.

**What this amendment does not lift.** Design §9's exclusions stand: rubric marking, BlobStore, and websockets / live co-editing. The exclusion-list bullets above that were lifted on 18 August 2026 stay lifted; every other v1 exclusion stands unchanged.

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

**Postman, port and retention amendment (29 August 2026).** Real email delivery and the GCP port are lifted from the exclusions above, and retention ships as adjustable machinery, exactly as decided in `docs/superpowers/specs/2026-08-29-classroom-platform-09-postman-retention-design.md`. Locked rows:

- **Mail selection is explicit config, never `NODE_ENV` magic** (D§3): `MAIL_DRIVER` (`dev` | `brevo`, default `dev`) picks the driver behind the existing one-seam `Mailer` interface. The dev pretend inbox stays byte-identical for dev/test — full bodies, clickable tokens, status `dev`. In production `MAIL_DRIVER` **must** be `brevo`, or boot fails.
- **A send never throws, is never retried, and carries one ten-second deadline** (D§4): a rejection is caught, logged once, and recorded on the row instead of failing the request; the admin's once-a-week glance at the Emails tab is the recovery path, not a queue.
- **Erasure closes both directions** (D§5): future sends to the scrub's sentinel address are suppressed at the seam before any driver sees them, and the erase transaction gains a delete of the person's own `emails` rows, so a real address and a real body no longer survive an erasure.
- **Bounce ingestion is one secret-gated webhook** (D§6): `POST /api/mail/events`, throttled and refused without the shared secret (403, the tick's own posture), updates the matching `emails` row to `bounced` / `delivered`. The admin console's Emails tab gains a status column and Health gains "storage used" — closing both promises §10 already made.
- **Retention ships as adjustable machinery, not a locked number** (D§7): the daily tick sweeps archived classes past a settings-controlled period, defaulting to the spec's own 3-year proposal — the proposal becomes the shipped, admin-adjustable default, a proposal made operable rather than a number frozen in the contract. A sweep deletes the class and its class-scoped records — notifications, members, invites, assignments, submissions, marks, groups, guides, shares — and writes one ledger event. It does **not** touch students' own project libraries, including a group project that outlives its swept class in its founder's library.
- **The transborder mail transfer is accepted, and minimised** (D§10 fiat 12): a real send crosses South Africa's border to reach the mail provider, conditioned on `/privacy` gaining a sub-processor sentence naming the provider before the first real send to anyone but the maintainer, and on `marksReleased` dropping the score and the teacher's comment from the mail body — both stay fully visible on the marking screen, the bell and the data export, never in transit.
- **The GCP port ships as artifacts and a runbook, not a live deployment** (D§8): `infra/Dockerfile`, `infra/.dockerignore`, and the numbered `docs/DEPLOY-GCP.md` covering Cloud SQL, Secret Manager, Cloud Scheduler → `/api/tick`, and the one-instance pin. ~~The existing Vercel static path is unchanged~~ *(superseded 1 Sep 2026, Task 10a: the app is same-origin by construction, so the static host must front the API — `frontend/firebase.json` ships with a `rewrites` rule sending `/api/**` to the Cloud Run service `physics-ide-api` in `africa-south1`; `vercel.json` stays in the repo as the currently-live deployment, and whether to retire it is a user decision surfaced at Stage E)*; everything short of hands-on provisioning is built and verified locally.
- **This amendment supersedes the notifications amendment's "Real email delivery remains excluded" row:** from this amendment on, a configured production driver carries real mail, and the pretend inbox remains the dev/test driver.
- **No BlobStore until a feature exceeds the §7 data-URI caps** (≤200KB per image, ≤1MB per document) (D§2) — re-pinning the clause above now that this plan is the cloud plan its old trigger named: instruction images stay capped inline data-URIs, submissions stay frozen manifests in `jsonb`, and nothing in the product asks for a bucket at 200 users. `classroom-platform-stack.md`'s Cloud Storage line is deliberately not executed by this runbook.

**The boundary.** Real mail flows only after the user-gated provisioning session (Task 14a); until then every environment's mail stays in the pretend inbox, and the product's copy keeps saying so.

**Copy is bound by this too.** On 28 August 2026 the four public pages (`/welcome`, `/about`, `/teachers`, `/contact`) and the in-app Help page were audited in both directions — nothing shipped may still be described as absent, and nothing excluded may be described as present. Two mechanisms keep it that way rather than a memory: `welcomePage.test.js`'s non-claims list greps the front page's copy, and `welcomeSubpages.test.js`'s launch-truth scope guard sweeps all four rendered public pages for every §9 exclusion. §17.3's remaining cleanups — the "no accounts, no backend" sentences in [README.md](../README.md) and [DEPLOY.md](../DEPLOY.md) — were cleared by Plan 7's honesty pass (28 August 2026).

## Change protocol

Anyone who needs to deviate from this contract must:

1. Open the decision explicitly in this file or in the relevant phase section of [plan.md](../plan.md).
2. State the reason and the trigger (what changed that makes the previous decision no longer right).
3. Update the corresponding gate / target / exclusion entry.
4. Land the change in code only after the contract reflects it.

Silent deviation defeats the purpose of having a contract. Free-tier compatibility and the "no backend, no auth in v1" stance are the load-bearing constraints; bend them at your peril.
