# Plan 10 — the consolidation: live graphs, one simple IDE, and the way in

**Written 2026-09-02 (overnight session). Single-document plan: design rulings inline rather
than a separate design doc — the ground truth is already banked** at
`.superpowers/sdd/plan10-graphing-research/` (read its README first: the
`templates-and-content` reader failed, so Stage B re-derives the template inventory; the
block-retirement findings predate the clean-deletion ruling and are read through it) **and
in the committed audit** `docs/superpowers/reviews/2026-09-01-ide-simplification-audit.md`
(claims 1–4 verified; the ranked top-10 wins; per-surface control inventory).

**Scope, as ordered by the user** (2026-09-01 → 2026-09-02, see memory
`overnight-orders-2026-09-02`): live Trinket-style graphing blocks (the no-new-blocks lock
is lifted); ALL hybrid templates reworked onto them; a NEW SHM pendulum hybrid template with
the three graphs of motion live; block retirement as clean deletion; the guest-entry bug;
the FULL simplification pass ("simplified as much as possible whilst still providing full
present functionality"), including the start menu "extremely streamlined"; resizable
data/3D viewports; the Help overhaul ("must contain everything", maximally readable); and —
**the literal last step of everything** — guided/interactive walkthroughs integrated into
that help surface. Mobile audit + gate and the 3D visual pass carry over from the
2026-08-28 orders.

**Execution model:** inline implementation by the main session; an independent review agent
per task (batching adjacent doc-sized tasks into one dispatch is allowed — the coverage
covenant, not the dispatch count, is the invariant). Ledger:
`.superpowers/sdd/2026-09-02-plan10-ide-consolidation/progress.md`.

**Gates for every code task:** `npm run check:blocks` (any task touching blocks),
frontend suite green, lint 0 errors, `node frontend/scripts/e2e-test.mjs` 164/164 (may grow,
never shrink). Tasks touching portal surfaces add `portal-e2e.mjs` 80/80.

---

## Design rulings

- **R1 — the Graphs category.** New `Graphs` toolbox category, `domain: "physics"` (appears
  for physics AND hybrid goals, no new domain plumbing — banked finding). Three blocks:
  a `graph_display_block` container (the `sim_start_block` hat-with-statement-body idiom,
  strip-dedent generator — VPython graph calls need no indentation); a flat
  `graph_series_block` "make ⟨series⟩ a curve/dots in ⟨colour⟩" (the `preset_*` quick-create
  idiom: `field_variable` name + `field_dropdown` curve|dots + `field_colour`), generating
  `NAME = gcurve(color=...)` / `gdots(...)`; and `graph_plot_block` "plot (x, y) on ⟨series⟩"
  (`field_variable` reference, two `input_value` Number slots with shadows), generating
  `NAME.plot(x, y)`. The vendored GlowScript runtime already ships
  `graph/gdisplay/gcurve/gdots` — this is registry + definitions + generators + toolbox
  work, ZERO runtime patching.
- **R2 — where graphs render.** GlowScript graphs anchor into the same scene container the
  runner owns. The graph area lives INSIDE the canvas pane, below the 3D scene, scrolling
  within the pane. One charting idiom per phase — LIVE graphs during a run (Graphs blocks),
  post-run ANALYSIS charts in the data panel (existing Charts blocks) — and the Help page
  says exactly that sentence, because two charting systems that look interchangeable are the
  duplication the audit warns about.
- **R3 — retirement is deletion.** Blocks the Graphs work subsumes are deleted whole:
  registry row, JSON definition, generator, toolbox entry, template usages. No deprecation
  machinery. ONE safeguard: the workspace loader must skip-and-report an unknown block type
  instead of crashing (dev-local projects may reference deleted types).
- **R4 — the entry ruling.** The welcome page's plain "Open the IDE" door ALWAYS lands on
  the start menu; the bootstrap's restored project appears there as a "Continue where you
  left off" affordance, not as an auto-open. Template tiles keep their direct-open behaviour
  (that IS choosing). The auto-open-on-restore effect keys off an explicit pending intent
  only. This reverses the "start menu is for choosing, not re-choosing" ruling — the user
  chose the menu.
- **R5 — simplification directions are the audit's, accepted as written.** The top-10
  table's "smallest-change direction" column is the ruling for each win, with ONE
  amendment: win 3 (delete `Back to Blocks`) now interacts with the data-loss hotfix, which
  gave that slot a real job ("Back to Simulation" while an analyse stash exists). The slot
  is deleted from every configuration EXCEPT `analysisReturn` — the return control keeps
  its place, the vestigial text-mode duplicate goes.
- **R6 — the hybrid 55/45 split becomes a real divider** (audit claim 4's one concrete
  gap), the `useSplitPane` idiom the editor split already uses.
- **R7 — Help is rebuilt as one complete, searchable surface**: task-first sections (build a
  simulation; run/record/debug; analyse data; graphs; hybrid round-trip; classroom; account
  & sync), a block reference generated FROM the registry (id, conceptLabel, category,
  keywords — the registry is already the single source of truth, so help can never drift
  from the palette again), and plain-language copy. Tokens only, no emoji, one focus ring.
- **R8 — walkthroughs are LAST.** Interactive guided tours (spotlight + step cards over the
  real UI) integrated into the Help surface. Not designed in detail here, deliberately:
  they tour the SIMPLIFIED product, so they are specced only after Stages 0–E are done.

---

## Stage 0 — the way in

### Task 1: The plain door lands on the menu
**Files:** `frontend/src/welcome/WelcomePage.js` (CTA), `frontend/src/hooks/useProject.js`
(the bootstrap auto-open effect), `frontend/src/components/StartMenu.js` (the Continue
affordance), tests beside each.
- [ ] Implement R4: the restore effect no longer auto-opens on `bootstrapResult.kind ===
  "existing"`; the start menu shows the restored project as the first, visually distinct
  "Continue" entry. Template tiles (pendingTemplate) unchanged. Guest and signed-in alike.
- [ ] Tests: entering with a previously-open project shows the menu with Continue; choosing
  Continue opens it; a pending template still bypasses the menu; a fresh guest sees the menu.
- [ ] Commit: `fix(ide): the front door opens on the menu - continue is a choice, not an ambush`

## Stage A — live graphs

### Task 2: The Graphs blocks
**Files:** `frontend/src/utils/blockly/blocklyGenerator.js` (definitions + generators),
`blockRegistry.js` (three rows), `toolbox.js` (the category with shadows),
`blockPalette.js`, unit tests in the generator suite's idiom.
- [ ] R1 exactly. `check:blocks` green (registry ↔ toolbox coverage is enforced).
- [ ] One passing unit test per block (the DS-block precedent): generated Python asserted
  byte-for-byte.
- [ ] Commit: `feat(blocks): the graphs category - display, series, plot, live`

### Task 3: The runner surface
**Files:** `frontend/src/utils/runner/glowRunner.js` (graph mount), `frontend/src/styles/`
(graph area), `frontend/src/components/GlowCanvas.js` if the mount needs a host element.
- [ ] R2: graphs render below the scene inside the canvas pane; a run with no graph blocks
  is pixel-identical to today; graphs clear on re-run like the scene does.
- [ ] e2e grows a check: a template with a plot block produces a graph canvas during a run.
- [ ] Commit: `feat(runner): graphs land in the viewport pane, live during the run`

### Task 4: Retirement
**Files:** named by the banked block-retirement findings READ THROUGH R3; loader safeguard
in the workspace XML load path.
- [ ] Delete subsumed blocks whole (registry, definition, generator, toolbox, template
  usages). `check:blocks` keeps the books honest.
- [ ] The loader skips unknown block types with a console warning and a status line, never
  a crash — one test proves it with a deleted type name.
- [ ] Commit: `refactor(blocks): retirement is deletion - and the loader survives the ghosts`

## Stage B — the hybrid round-trip, reworked

### Task 5: Every hybrid template on the new system
- [ ] FIRST: re-derive the template inventory (the failed reader's gap) — list every
  hybrid/sim/DS template, its XML, its pairing. Record it in the ledger.
- [ ] Rework ALL hybrid templates to use Graphs blocks where they chart live quantities;
  keep their paired analysis templates coherent with the R2 phase split.
- [ ] Commit: `feat(templates): the hybrid set graduates to live graphs`

### Task 6: The SHM pendulum
- [ ] ONE new hybrid template: an SHM problem (small-angle pendulum), the three graphs of
  motion — displacement, velocity, acceleration vs time — live via Graphs blocks, plus the
  recorded-dataset analysis pairing. Physics verified against the analytic solution in a
  unit/e2e check (the e2e harness's telemetry idiom).
- [ ] Commit: `feat(templates): the SHM pendulum - three graphs of motion, live`

## Stage C — one simple IDE

### Task 7: Keep-one controls (wins 1, 2, 6, 7)
- [ ] Record lives in the trace panel only; one fit control per pane with one icon per verb;
  one screenshot path (the on-canvas camera). Update e2e counts.
- [ ] Commit: `refactor(ide): one verb, one control - record, fit, and the camera`

### Task 8: The chrome diet (wins 3, 4, 5, 8, 10 + R5's amendment)
- [ ] Delete the reset slot except `analysisReturn`; merge Trace into Debug (or make the
  drawer closable in debug — pick in-task, ledger the ruling); delete the blocks/code
  pane-headers (badge moves into the mode toggle); fix the overflow fake-shortcut span.
- [ ] Commit: `refactor(ide): the chrome diet - fewer bands, honest buttons`

### Task 9: Safety symmetry + the split + the menu (win 9, R6, start-menu streamline)
- [ ] Project delete gets the confirm idiom; the hybrid viewport/data split gets a real
  divider (useSplitPane); the start menu is streamlined to its essentials (Continue, New,
  the template rail, Join) — every control it keeps must answer "what does this let me
  choose?".
- [ ] Commit: `refactor(ide): symmetric safety, a real divider, and a calmer menu`

## Stage D — platform polish

### Task 10: Mobile audit + the gate
- [ ] Classify every screen mobile-ok vs large-screen-only; ONE designed gate component
  (tokens, no emoji); fix breakages in the mobile-ok set. (2026-08-28 order.)
- [ ] Commit: `feat(platform): the small-screen gate - and everything else earns its phone`

### Task 11: The 3D pass
- [ ] Runner-injected default scene quality (lighting rig, per-theme ambient,
  material/background defaults — inject-when-unlit vs compose decided in-task) + the
  template art pass. Vendored bundle untouched.
- [ ] Commit: `feat(3d): every scene looks lit - defaults injected, templates dressed`

## Stage E — Help, complete

### Task 12: The Help rebuild (R7)
- [ ] Task-first sections; the registry-generated block reference; search; the R2 sentence;
  every feature the IDE ships documented — "must contain everything" is the acceptance bar,
  checked against the audit's control inventory surface-by-surface.
- [ ] Commit: `feat(help): everything, findable - the help surface rebuilt from the registry up`

## Stage F — LAST, by order

### Task 13: Walkthroughs
- [ ] Specced only now, against the finished product; interactive tours from the Help
  surface. Scope decided with the user awake if this stage is reached overnight.

## Wrap

### Task 14: Gates + audit + checklist
- [ ] Full gate battery (root lint/test, backend+shared typecheck, frontend build,
  check:blocks, e2e, portal-e2e, ux-audit script); a fresh UX pass against the audit's
  inventory (counts must go DOWN); the human browser-pass checklist file.
- [ ] Commit: `test+docs: Plan 10 wrap - fewer controls, live graphs, gates green`
