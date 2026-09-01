# Plan 9 — the human browser pass

The things a script cannot vouch for: words read in place, colours seen in both themes,
mail read as a recipient would. Everything here is already covered by unit or e2e checks
at the mechanical level — this pass is eyes. Format follows the Plan 8 file.

Run against a local dev stack (`npm run db:up`, `npm run dev`, seeded admin).

## The pretend inbox

- [ ] `/admin` → Emails: the Status column reads as a **word and a token** in BOTH themes —
  `dev` badge legible on light and dark, never colour-only.
- [ ] Enter on a focused row expands the body; Escape/Enter close it again; focus stays
  where a keyboard user expects.
- [ ] Any due-tomorrow / marks-released / submission-receipt mail in the inbox carries the
  **`/profile` footer line** — the switchable five templates all show it; the confirm /
  reset / invite mails do NOT.
- [ ] A marks-released mail carries **no score and no comment** — it says marks are ready
  and points at the portal, nothing more (fiat 12).

## Health

- [ ] `/admin` → Health: the storage line renders with real numbers and honest units.

## Doors

- [ ] The forgot-password door gives **one answer** whether or not the address exists —
  same copy, same timing to the eye.

## Retention

- [ ] `/admin` → People → retention control: the round-trip — change the years, the
  confirm names the count that **qualifies** and says deletion drains in daily batches
  (not "right now"); `RETENTION_SENTENCE` above it agrees ("by the daily sweep"); cancel
  changes nothing; save logs and sticks.

## Erasure honours

- [ ] Drive a marks release in a class containing an **erased** member: no bounce row
  appears, no `emails` row for the erased person survives, everyone else's mail is
  unaffected.

## The hybrid analyse round-trip (the data-loss hotfix, human half)

- [ ] In a hybrid project: record a run → Analyse this run → the confirm says the
  workspace is **replaced** and where the blocks go; cancel leaves everything untouched.
- [ ] Confirm → analysis template loads; the header's slot now reads **Back to
  Simulation** (both themes, and inside the overflow menu at 1120px).
- [ ] Back to Simulation → the confirm says the analysis blocks are discarded → the
  original simulation blocks return, byte-identical to the eye.
- [ ] Reload between analyse and return: the project reopens in the analysis view and
  Back to Simulation still restores.
- [ ] Escape over the chart + confirm stack closes ONLY the top dialog.

## Provisioning

- [ ] The provisioning session's own smoke list lives in `docs/DEPLOY-GCP.md` (the reduced
  list, and the reason the golden flow must never run against production) — referenced
  here, not duplicated.

## Gates (Task 13's battery — spelled runnable, run 2026-09-02 overnight)

```
npm run lint
npm run test
npm run typecheck -w backend
npm run typecheck -w shared
npm run build -w frontend
npm run check:blocks
node frontend/scripts/e2e-test.mjs
node frontend/scripts/portal-e2e.mjs
node frontend/scripts/ux-audit.mjs
```

Results are recorded in the Plan 9 ledger beside the Task 13 entry.
