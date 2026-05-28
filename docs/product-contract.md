# Physics IDE — Product Contract (v1)

This document is the single source of truth for what v1 of the unified Physics + Data Science IDE is and is not. If a future change conflicts with anything here, the change requires an explicit decision recorded by updating this file — not a silent drift in the code.

The full multi-phase plan lives in [plan.md](../plan.md). This document captures the locked decisions and exclusions extracted from that plan.

---

## Product shape

A browser-based classroom IDE for physics modelling and foundational data science. Three first-class project goals, one editor surface:

- **Physics Modelling** — VPython / GlowScript simulations, the current capability.
- **Data Science** — foundational table analysis on built-in or imported datasets.
- **Hybrid** — both goals composed; simulations promote runs into datasets for analysis.

Inside each goal the student picks an editing mode: **Blocks** or **Code**. Beginner mode is a cross-cutting toggle, not a fork.

---

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Hosting | Static SPA on Vercel or Cloudflare Pages | Free tier, no cold starts, fits the "all free services" constraint. |
| Backend (v1) | **None** | All execution and persistence runs in the browser. Phase D and E gates documented below. |
| Auth (v1) | **None** | Not designed, not stubbed, not "made future-ready". Phase E feature, not infrastructure. |
| DS table ops | **Arquero** | dplyr-like, ~80 kB gz, fast at classroom scale. Validated by [docs/phase-a-eval.md](phase-a-eval.md). |
| Charts | **Observable Plot** | Declarative SVG, ~16 kB gz, covers all five foundational chart types. |
| Persistence | **localForage** (IndexedDB-backed) | Same async API everywhere; handles dataset / run blobs without quota worry. |
| Project model | **Multi-project library** | Start menu lists saved projects; manifest carries `id` used as storage key. |
| Built-in datasets | **Penguins, Weather, Planets** | Titanic intentionally excluded — death-outcome ethics. |
| Bundle export | **Both `.physide.json` and `.physide.zip`** | JSON default; ZIP offered when project has large datasets or chart PNGs. JSZip lazy-loaded. |
| Beginner mode (DS) | **No block hiding** | Affects guidance prompts only; blocks remain discoverable by category and search. |
| Beginner mode (Physics) | Toolbox subset (existing behavior unchanged) | The existing palette filter stays. |
| Goal field | **Additive** | New `goal` on the manifest; existing `projectType` (custom / code_blank / code_template / block_template) stays as origin metadata. They are orthogonal axes. |
| Runtime abstraction | **Deferred** | No interface until a concrete second runtime exists. Physics stays in `src/utils/runner/glowRunner.js`; DS calls Arquero / Plot directly from block generators. |
| Type system | **Minimal** | Blockly connection checks + the new shared type tags. No coercion engine in v1. |
| Bundle import | **Full-replace** | Confirmation dialog. Partial-merge revisited in v1.x with a real workflow spec. |

---

## Exclusion list

The following are explicitly out of scope for v1 and require a written decision to bring back in:

- Servers, databases, queues, background workers, Python services.
- Accounts, login, sessions, identity, roles, user_id columns.
- Cross-device sync, cloud save, classroom rosters, teacher dashboards.
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

## Quality bar (v1.0 ship gate)

- Zero duplicated blocks. Enforced by `npm run check:blocks` in CI.
- All 59 foundational DS blocks (per [docs/foundational_ds_blocks.md](foundational_ds_blocks.md)) implemented with at least one passing unit test each.
- Trace-to-dataset → analysis → chart works end-to-end across both hybrid templates.
- Bundle round-trip works for both JSON and ZIP formats across the four manual flows.
- v1 → v2 manifest migration succeeds on a legacy save (`physics-lab-state-v1` localStorage key).
- App deploys to Vercel / Cloudflare Pages and runs fully offline after first load.
- Cold start under 3 s on the free tier.
- Trace render smooth at 5 k rows.
- Arquero ops on 10 k rows under 200 ms (Phase A measured 1.3–4.9 ms — actuals stay well inside this).
- Plot render of a 10 k-point chart under 500 ms.
- Project switch (save current + load new) under 200 ms.
- No HTTP requests to non-CDN origins after first load. Smoke-tested in CI.

---

## Stack notes (for future maintainers)

- **CRA is in maintenance mode.** Not a Phase A–C blocker. A future Vite migration is on the v1.x follow-up list; do not start it during the DS block migration.
- **localForage uses IndexedDB.** Quota is ample but browsers can evict on storage pressure. Surface usage in the start menu before quota fills; prompt to export.
- **Built-in datasets ship inline with the build**, not fetched at runtime. Code-split per goal so physics-only projects don't pay for the DS bundle on first load.
- **JSZip lands lazily** via `import()` and only loads when the user picks ZIP export.
- **Generated Python is hidden by default** and revealed on demand. The reveal emits clean, commented pandas-style code for DS blocks and VPython for physics blocks.

---

## Change protocol

Anyone who needs to deviate from this contract must:

1. Open the decision explicitly in this file or in the relevant phase section of [plan.md](../plan.md).
2. State the reason and the trigger (what changed that makes the previous decision no longer right).
3. Update the corresponding gate / target / exclusion entry.
4. Land the change in code only after the contract reflects it.

Silent deviation defeats the purpose of having a contract. Free-tier compatibility and the "no backend, no auth in v1" stance are the load-bearing constraints; bend them at your peril.
