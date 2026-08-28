# Post-Plan-7 hardening — batches A, B, C (28–29 August 2026)

User-ordered resolution of every open fix from Plans 1–7 that was NOT part of Plan 8's
scope (the bell-adjacent items — revoke UI, share events joining the bell, events indexes,
ESLint — stayed with Plan 8, where the design doc now carries them). Three serialized
batches, each implemented by a fresh agent and gated by an independent review; Batch A took
one fix round, B and C passed clean (C's reviewer re-derived the compositing math and
hand-computed two contrast ratios independently; one cosmetic note — the audit's
page-background fallback assumes opacity — deferred with a comment owed if the script is
ever reused elsewhere). All work on `feature/classroom-platform`.

## Batch A — backend hardening (`0e6625c` + fix `8bdb0c7`)

- **The pending-share race backstop** — migration `0007_flat_silvermane`: a partial unique
  index on `shares (source_owner_id, source_project_id, recipient_id) WHERE status =
  'pending'`, plus a savepoint-scoped 23505 catch on `POST /api/shares` mapping the race
  loser to the same 409 sentence the friendly read-path duplicate check returns. The
  ledger event cannot fire for a lost race (the early return precedes `logEvent`, inside
  the outer transaction). Review verified the snapshot delta is exactly the one index.
  Fix round added the reviewer-specified concurrency test: two identical POSTs via
  `Promise.all` → sorted `[201, 409]`, one surviving row — six consecutive green runs.
- **uuid param guards** — `accept`/`revoke` `:id` and `roster/:classId` now refuse
  malformed ids with the SAME 404 sentence as missing ones (`"No such share."` /
  `"No such class."`), before any DB touch; previously a malformed id was a driver-level
  500. Recorded ruling: on accept, the malformed-id 404 now precedes body validation —
  deliberate (malformed ≡ missing; don't leak body-validation detail about a share that
  cannot exist).
- **Allow-list staff gates** — the class-members roster and gradebook reads flip from
  `role === "student"` deny-lists to `!isStaffRole(role)`; identical behaviour for the
  three real roles, closed fail-open for any hypothetical fourth.
- **Deferred test pins** (from Plan 7's review ledger): non-party revoke → 404; incoming
  list ordering/fallback/epoch-ms; exactly-one accepted event; unknown-class share → 404;
  the accept route's invalid-manifest branch promoted to a named const and reached by a
  corrupted-frozenManifest test. Backend 684 tests green.
- Noted, left alone: `GET /api/shares/incoming` answers a malformed `?classId` with 400
  while unknown-but-well-formed yields 403 — a pre-existing posture inconsistency, listed
  for a future param-posture sweep.

## Batch B — frontend (`d3ac91a`)

- **Second-device attribution label** — `AttributionChip` now calls
  `refreshShareAttributions()` when (and only when) the sidecar has no record for the open
  project, so a copy accepted on another device resolves its label without a Start Menu
  visit; sidecar-first paint and guest/offline behaviour unchanged; refresh provably NOT
  called when the sidecar already has the record.
- The empty-roster ShareDialog state and the shareMeta sidecar module got their own tests
  (the prefix-strip logic was previously unexercised). Frontend 1072 tests green.

## Batch C — the five UX-audit FAILs (`ee469b7`)

Forensics-first, per finding classified REAL vs MEASUREMENT ARTIFACT:

- **Artifacts (2):** the goal-card title (reported 1.23:1) and description (2.71:1) —
  the audit's contrast sampler stopped at the card's `rgba(255,255,255,0.024)` wash and
  parsed it as opaque white. The script now parses alpha and composites the full ancestor
  stack; every already-opaque check is numerically unmoved before/after (4.72, 9.54,
  10.38), evidence the change corrects measurement rather than loosening the audit. True
  composited ratios: title 12.76:1 dark / 15.96:1 light; description 5.77 / 5.93.
- **Real (3):** the "Create New" section label (`--text-muted` → `--label-color`,
  3.08 → 6.15 dark / 6.19 light); the on-canvas zoom readout (`--text-muted` →
  `--text-dim`, 2.83 → 5.65 / 5.58); the Run/Stop buttons gain
  `min-height: var(--control-h)` (23px → 30px; the viewport header is unchanged).
- Audit: 5 FAILs → 0 (exit 0; Run moved FAIL→WARN because the audit's PASS bar is the
  recommended 44px, not the 24px minimum). Frontend suite and the IDE e2e (164 checks)
  both green.

## Rulings carried out of the batches

1. TA-revoke visibility (Plan 7 pre-flight, implemented in Plan 7): staff can see a share
   exists; only sharer/teacher can revoke.
2. Accept's malformed-id 404 precedes body validation (Batch A, above).
3. `frontend/e2e/` is TRACKED (the Plan 7 wrap's gitignore claim was wrong for this tree);
   its screenshot churn remains deliberately unstaged — the user's call to commit or drop.

## Still owed (next session)

- The full cross-suite gate battery after Batch C's review verdict (shared + backend +
  frontend suites, typechecks, build, check:blocks, both e2e scripts, ux-audit) — each
  batch ran its own scope's suites; the combined battery is the belt-and-braces close.
- Plan 7 browser-pass checklist annotations: the chip's second-device note is resolved by
  Batch B; the revoke devtools workaround stands until Plan 8's Task 12.
- The Plan 8 documents (design + plan, committed alongside this record) await the user's
  review before execution.
