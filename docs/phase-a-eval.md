# Phase A Evaluation — Trace → Dataset → Chart Spike

This document records the measured outcomes of the Phase A vertical-slice spike and the keep/swap decision on the library choices.

## What shipped in Phase A

A minimum trace → dataset → chart loop:
- `src/utils/dataset/dataset.js` — `fromTraceBuffer`, `filterRows`, `meanOfColumn`, `transform`, basic profiling.
- `src/utils/charts/plotRender.js` — line + scatter via Observable Plot.
- `src/components/ChartOverlay.js` — modal-style overlay (column pickers, type toggle, title, SVG + PNG export).
- `src/hooks/useDataset.js` — localForage-backed `saveDataset` / `useDataset(id)`.
- `src/components/TraceTable.js` — new "Chart" action next to the existing Rec.CSV button; opens the overlay with the current recording buffer.
- `src/components/DebugMode.js` — threads `onSaveAsDataset` through to `TraceTable`.
- `src/components/layout/IDELayout.js` — owns the chart-overlay state; renders `ChartOverlay` alongside StartMenu, DebugMode, and the main shell so it surfaces from any screen.
- `src/styles.css` — overlay styles (~3 kB raw, +335 B gz).
- `scripts/phase-a-perf.mjs` — Node smoke test for `fromTraceBuffer` + Arquero ops.

## Bundle delta (production build, gzip)

| File | Baseline (kB) | After Phase A (kB) | Δ (kB) |
|---|---:|---:|---:|
| `static/js/main.*.js` | 248.59 | 397.22 | **+148.63** |
| `static/css/main.*.css` | 10.82 | 11.16 | **+0.34** |
| `static/js/239.*.chunk.js` | 46.35 | 46.35 | 0 |
| `static/js/455.*.chunk.js` | 42.90 | 42.90 | 0 |
| `static/js/977.*.chunk.js` | 8.69 | 8.69 | 0 |
| **Total JS** | **346.53** | **495.16** | **+148.63** |

Drivers of the delta: `arquero` + `@observablehq/plot` + `localforage` + the new dataset / chart / overlay modules. All landed in `main` (no code splitting yet — Phase B will split by goal).

**Phase A gate target was +200 kB gz combined. We are at +148.63 kB gz — within budget, with ~25% headroom for the few small additions Phase B needs (manifest, project store, registry helpers).**

## Runtime perf (Node, `scripts/phase-a-perf.mjs`)

Synthetic long-format trace, pivoted to wide (one row per timestamp, four variable columns: `x, y, vx, vy`). Numbers below are single-shot warm runs on a recent Windows 11 dev box; treat as ballpark, not benchmark.

| Scale | `fromTraceBuffer` pivot | Arquero filter | Arquero groupby + mean | Arquero sort | Plain JS mean |
|---|---:|---:|---:|---:|---:|
| 4 k long rows (1 k × 4) | 1.6 ms | 4.5 ms | 4.8 ms | 0.5 ms | 0.2 ms |
| 10 k long rows (2.5 k × 4) | 3.5 ms | 0.8 ms | 3.5 ms | 0.4 ms | 0.1 ms |
| 40 k long rows (10 k × 4) | **21.3 ms** | 1.3 ms | 4.9 ms | 0.2 ms | 0.5 ms |

**Phase A gate target was Arquero ops on 10 k rows under 200 ms. We are at 1.3–4.9 ms — well within budget.** `fromTraceBuffer` is the slow path because of the per-timestamp forward-fill bookkeeping; even so, 21.3 ms for a 10 k-row pivot is fine for classroom use.

Notes:
- First-call Arquero ops include table-construction overhead. The 4.5 ms `filter` at the 4 k scale is mostly that overhead; subsequent ops on the same table drop to ~1 ms.
- Plain JS beats Arquero on simple single-column means (no surprise — Arquero is paying for type-safe column logic). For foundational DS we still want the Arquero API ergonomics; the perf margin is irrelevant at classroom scale.

## Plot render perf

Not measured headlessly (Plot needs a DOM). Validated manually in the browser — a 2.5 k-point line chart renders instantly to the eye on the dev box. A targeted browser benchmark for 10 k-point line / scatter is on the Phase B follow-up list.

## Gate A — pass / fail summary

| Gate | Target | Measured | Status |
|---|---|---|---|
| Demo loop works end-to-end | Projectile run → save as dataset → chart | Browser-validated (manual) | ✅ |
| Bundle delta | ≤ +200 kB gz | +148.63 kB gz | ✅ |
| Arquero ops on 10 k rows | < 200 ms | 1.3–4.9 ms | ✅ |
| Plot render 10 k points | < 500 ms | Browser-validated (manual); targeted bench deferred to Phase B | 🟡 keep an eye on it |

**Decision: keep Arquero + Observable Plot + localForage as the Phase A library set. Proceed to Phase B.**

## Manual test procedure (browser)

This is the demo path Phase A delivers. It currently lives behind Debug Mode; Phase B will surface a trace panel in the main shell so the path shortens.

1. `npm start`, open the IDE.
2. Start menu → Block Templates → **Projectile**.
3. Toolbar → **Debug** to enter Debug Mode.
4. Debug Mode → **Run** the simulation.
5. In the Trace panel (right) → click **Record**. Let the sim run for a few seconds (capture ~30–60 timestamps of `x`, `y`, `vx`, `vy`).
6. Click **REC** again to stop.
7. Click the new **Chart** button next to Rec.CSV.
8. The Chart Overlay should open with the recorded dataset and a line chart of `vx` vs `t` (the default encoding — change X/Y in the controls to explore).
9. Try switching the chart type to **Scatter**.
10. Click **SVG** or **PNG** to download.

If any step fails to render the chart, capture: console errors, the recording buffer length (shown in the Trace badge), and the IDE branch (`git rev-parse HEAD`) for the eval log.

## What this validates for Phase B

- The `Dataset` shape works end-to-end as the unified contract between blocks and charts.
- localForage is the right tier for project / dataset persistence (no quota or API friction at this scale).
- Observable Plot integrates cleanly with React (mount via ref, replace on spec change).
- Arquero is the right table library for foundational DS — the API is ergonomic and the perf is irrelevant for classroom data sizes.
- The "promote a recording to a chart" UX pattern is the right pedagogical seam — the trace panel becomes the entry to data analysis without leaving the IDE.

## Known gaps to address in Phase B

- The chart entry point currently lives inside Debug Mode. Phase B should surface a trace/data panel in the main shell so the workflow is one click, not two.
- Bundle is monolithic — code-split DS modules per goal so physics-only projects don't pay for them on first load.
- `fromTraceBuffer` does an `O(n × v)` find on first call for type inference. Move to a single pass when this lands in Phase C with the full DS block set.
- 35 packages came in with the install; many are inherited dev deps from Plot. Audit before v1.0 ship.
