# Physics IDE — End-to-End Test Checklist

> Companion to `scripts/e2e-test.mjs` and `scripts/ux-audit.mjs`.
> Run automated tests first, then use this checklist to record results and
> manually verify items that automation cannot fully cover.
>
> **Last run:** _fill in_  
> **Build:** _fill in (git hash)_  
> **Tester:** _fill in_

---

## How to run

```bash
npm run dev                        # Start dev server on :3000
node scripts/e2e-test.mjs          # Automated E2E (Part A + B2 + B)
node scripts/ux-audit.mjs          # UX audit → docs/ux-audit.md
```

Automated results: `frontend/e2e/results.json`
Screenshots: `frontend/e2e/*.png` — **untracked build artifacts** (`.gitignore:23` ignores `e2e/`
at any depth). They are documentation you regenerate, not fixtures you commit; a UI change does not
"invalidate" anything in git. Note that `scripts/e2e-test.mjs` resolves its output to
`frontend/e2e/`, while older runs left artifacts at the repository root `e2e/`.
UX report: `frontend/docs/ux-audit.md`

---

## Part A — UI / Workflow Suites

### A1 · App Bootstrap
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 1 | Page title contains "Physics IDE" | ✅ | | |
| 2 | Start menu overlay renders | ✅ | | |
| 3 | All 3 goal cards visible (Physics, DS, Hybrid) | ✅ | | |
| 4 | Sidebar version string `v1.0 • VPython 3.2` | ✅ | | |
| 5 | Documentation + Open File quick actions | ✅ | | |
| 6 | Zero JS errors on load | ✅ | | |

### A2 · Physics Blank Project (Blocks)
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 7 | Creates successfully | ✅ | | |
| 8 | Toolbox: Values, Objects, Motion, State | ✅ | | |
| 9 | Toolbox: Control, Logic, Math, Variables | ✅ | | |
| 10 | Toolbox: Advanced drawer present | ✅ | | |
| 11 | No "Data Science" category | ✅ | | |
| 12 | Blockly workspace SVG renders | ✅ | | |
| 13 | Workspace is empty (blank project) | ✅ | | |

### A3 · Physics Blank Project (Code)
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 14 | Creates in code mode | ✅ | | |
| 15 | Monaco editor renders | ✅ | | |
| 16 | Toolbar shows code mode indicator | ✅ | | |

### A4 · Physics Templates (all 4)
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 17 | Projectile Motion: loads, workspace non-empty | ✅ | | |
| 18 | Spring Oscillator: loads, workspace non-empty | ✅ | | |
| 19 | Orbital Mechanics: loads, workspace non-empty | ✅ | | |
| 20 | Simple Pendulum: loads, workspace non-empty | ✅ | | |
| 21 | All templates: toolbox remains physics-only | ✅ | | |

### A5 · Physics Run / Stop
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 22 | Run button click → running state indicated | ✅ | | |
| 23 | 3D Viewport activates (GlowScript frame loads) | ✅ | | |
| 24 | Stop button clears running state | ✅ | | |
| 25 | No console errors during run | ✅ | | |
| 26 | [Manual] 3D objects visible in viewport | ☑ | | |
| 27 | [Manual] Animation is smooth (no freeze) | ☑ | | |

### A6 · Block Search
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 28 | Search "sphere" → results include sphere blocks | ✅ | | |
| 29 | Search "velocity" → results include velocity blocks | ✅ | | |
| 30 | Search non-existent → empty state shown | ✅ | | |
| 31 | Search "chart" → DS chart blocks found | ✅ | | |
| 32 | Search "mean" → DS stats blocks found | ✅ | | |
| 33 | [Manual] Search clear (X) button works | ☑ | | |
| 34 | [Manual] Click result scrolls toolbox to category | ☑ | | |

### A7 · Advanced Drawer
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 35 | Advanced label visible in toolbox | ✅ | | |
| 36 | Click Advanced → 3D Math nested | ✅ | | |
| 37 | Click Advanced → Raw Python nested | ✅ | | |
| 38 | Click Advanced → Loops nested | ✅ | | |
| 39 | [Manual] Collapse Advanced → nested cats hide | ☑ | | |

### A8 · DS Blank Project
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 40 | Creates successfully | ✅ | | |
| 41 | Toolbox: Control, Logic, Math, Variables, Data Science, Advanced | ✅ | | |
| 42 | No Values / Objects / Motion / State categories | ✅ | | |
| 43 | ds_start hat "Start analysis" pre-seeded | ✅ | | |
| 44 | Penguins data table renders in right panel | ✅ | | |
| 45 | DATA panel header visible | ✅ | | |
| 46 | [Manual] Table scrollable with correct columns | ☑ | | |

### A9 · DS Templates
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 47 | Penguins stats template: workspace non-empty | ✅ | | |
| 48 | Weather filter template: workspace non-empty | ✅ | | |
| 49 | Planets chart template: workspace non-empty | ✅ | | |
| 50 | [Manual] Templates produce expected output on load | ☑ | | |

### A10 · Hybrid Blank Project
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 51 | Creates successfully | ✅ | | |
| 52 | Toolbox: Values, Objects, Motion + Data Science | ✅ | | |
| 53 | ds_start hat present | ✅ | | |
| 54 | 3D Viewport pane visible | ✅ | | |
| 55 | Data panel visible | ✅ | | |
| 56 | [Manual] Model-first / Data-first entry option in wizard | ☑ | | |

### A11 · Toolbar Buttons
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 57 | Menu button → start menu | ✅ | | |
| 58 | Help button → help overlay | ✅ | | |
| 59 | Theme toggle changes theme | ✅ | | |
| 60 | Zoom + increases zoom | ✅ | | |
| 61 | Viewport toggle hides/shows canvas | ✅ | | |
| 62 | [Manual] Zoom slider drag updates label | ☑ | | |
| 63 | [Manual] Zoom − decreases zoom | ☑ | | |
| 64 | [Manual] Help overlay content is correct/readable | ☑ | | |
| 65 | [Manual] Theme toggle persists after refresh | ☑ | | |

### A12 · Export Dropdown
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 66 | Dropdown opens | ✅ | | |
| 67 | All expected menu items present | ✅ | | |
| 68 | Export as Python: no crash | ✅ | | |
| 69 | [Manual] Export Python → downloads .py file | ☑ | | |
| 70 | [Manual] Export Blocks → downloads .xml file | ☑ | | |
| 71 | [Manual] Export Project Bundle → downloads .physide.json | ☑ | | |
| 72 | [Manual] Copy Code to Clipboard → clipboard contains Python | ☑ | | |
| 73 | [Manual] Code as PDF → PDF downloads | ☑ | | |
| 74 | [Manual] Blocks as PDF → PDF downloads | ☑ | | |

### A13 · Multi-Project Management
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 75 | 3 projects created, all appear in list | ✅ | | |
| 76 | Open project → IDE loads correct project | ✅ | | |
| 77 | Delete project → removed from list | ✅ | | |
| 78 | [Manual] Correct goal icons in project list | ☑ | | |
| 79 | [Manual] Last modified time shown correctly | ☑ | | |
| 80 | [Manual] Open project restores previous state | ☑ | | |

### A14 · Mode Toggle
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 81 | Blocks default: Blockly visible | ✅ | | |
| 82 | Code tab: Monaco appears | ✅ | | |
| 83 | [Manual] Code generated from blocks is correct Python | ☑ | | |
| 84 | [Manual] Edit code in Code mode → persists | ☑ | | |

### A15 · Reset & Clear Workspace
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 85 | Clear → workspace minimised | ✅ | | |
| 86 | Reset → returns to blocks mode | ✅ | | |
| 87 | [Manual] Confirm dialog shown before clear | ☑ | | |

### A16 · Error State
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 88 | Invalid Python → error state shown in status bar | ✅ | | |
| 89 | [Manual] Error message is readable and informative | ☑ | | |
| 90 | [Manual] Error cleared after fixing and re-running | ☑ | | |

### A17 · Debug Mode
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 91 | Debug overlay appears | ✅ | | |
| 92 | Exit debug → overlay dismissed | ✅ | | |
| 93 | [Manual] Read-only Blockly in left panel | ☑ | | |
| 94 | [Manual] Click block to set breakpoint | ☑ | | |
| 95 | [Manual] Step through execution | ☑ | | |
| 96 | [Manual] Pause / Resume works | ☑ | | |
| 97 | [Manual] Trace table shows live values | ☑ | | |
| 98 | [Manual] Record and save trace as dataset | ☑ | | |

### A18 · Trace Table Toggle
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 99 | Toggle shows trace panel | ✅ | | |
| 100 | [Manual] Trace table updates during run | ☑ | | |

---

## Part B2 — DS Block Correctness

### B2.1 · Dataset Loading
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 101 | Penguins rowCount correct | ✅ | | |
| 102 | Penguins colCount correct | ✅ | | |
| 103 | Planets rowCount correct | ✅ | | |
| 104 | Weather rowCount ≥ 1 | ✅ | | |

### B2.2 · Explore Blocks
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 105 | show_table: table renders with correct cols | ✅ | | |
| 106 | show_first_n(5): exactly 5 rows | ✅ | | |
| 107 | count_rows: correct count | ✅ | | |
| 108 | count_unique species = 3 | ✅ | | |
| 109 | list_cols: output renders | ✅ | | |
| 110 | [Manual] show_last_n: correct last rows | ☑ | | |
| 111 | [Manual] show_column: single column table | ☑ | | |
| 112 | [Manual] show_one_cell: correct value | ☑ | | |
| 113 | [Manual] identify_type number column = "number" | ☑ | | |
| 114 | [Manual] identify_type text column = "text" | ☑ | | |
| 115 | [Manual] find_missing: returns rows with null sex | ☑ | | |
| 116 | [Manual] all_stats: shows count, mean, min, max, median, stddev | ☑ | | |

### B2.3 · Statistics Blocks (Penguins ground truth)
| # | Check | Auto | Expected | Result | Notes |
|---|-------|------|----------|--------|-------|
| 117 | mean bill_length_mm | ✅ | computed | | |
| 118 | mean body_mass_g | ✅ | computed | | |
| 119 | median bill_length_mm | ✅ | computed | | |
| 120 | median body_mass_g | ✅ | computed | | |
| 121 | mode species | ✅ | Adelie/Gentoo | | |
| 122 | min bill_length_mm | ✅ | computed | | |
| 123 | max bill_length_mm | ✅ | computed | | |
| 124 | range bill_length_mm | ✅ | computed | | |
| 125 | sum body_mass_g | ✅ | computed | | |
| 126 | count non-missing bill | ✅ | computed | | |
| 127 | stddev body_mass_g | ✅ | computed | | |
| 128 | [Manual] compare_columns: side-by-side stats | ☑ | | | |

### B2.4 · Filter & Sort
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 129 | filter_eq species=Adelie | ✅ | | |
| 130 | filter_eq species=Chinstrap | ✅ | | |
| 131 | filter_gt bill>45 | ✅ | | |
| 132 | filter_lt mass<3500 | ✅ | | |
| 133 | sort_asc bill: first row has min | ✅ | | |
| 134 | sort_desc bill: first row has max | ✅ | | |
| 135 | remove_missing sex: correct row count | ✅ | | |
| 136 | [Manual] filter_and: AND condition works | ☑ | | |
| 137 | [Manual] filter_or: OR condition works | ☑ | | |

### B2.5 · Group & Compare
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 138 | group_count species: 3 rows | ✅ | | |
| 139 | group_mean body_mass by species: 3 rows | ✅ | | |
| 140 | [Manual] group_count values sum to rowCount | ☑ | | |
| 141 | [Manual] group_mean: Gentoo highest, Adelie lowest | ☑ | | |

### B2.6 · Charts
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 142 | chart_bar: SVG renders with elements | ✅ | | |
| 143 | chart_scatter: SVG renders | ✅ | | |
| 144 | chart_line: SVG renders | ✅ | | |
| 145 | chart_histogram: SVG renders | ✅ | | |
| 146 | [Manual] chart_box: SVG renders | ☑ | | |
| 147 | [Manual] Bar chart: correct number of bars (3 species) | ☑ | | |
| 148 | [Manual] Scatter: positive correlation visible | ☑ | | |
| 149 | [Manual] Histogram: bell-curve shape | ☑ | | |

### B2.7 · Communicate
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 150 | write_note: no crash | ✅ | | |
| 151 | print_result: value appears | ✅ | | |
| 152 | show_python: Python code block renders | ✅ | | |
| 153 | [Manual] write_note text visible in panel | ☑ | | |
| 154 | [Manual] compare_results: side-by-side values | ☑ | | |
| 155 | [Manual] state_conclusion: styled block renders | ☑ | | |
| 156 | [Manual] ds_export_table: CSV downloads | ☑ | | |

### B2.8 · Planets Correctness
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 157 | rowCount correct | ✅ | | |
| 158 | min distance_au correct | ✅ | | |
| 159 | sort_asc: Mercury first | ✅ | | |
| 160 | scatter chart renders | ✅ | | |
| 161 | [Manual] max period_days correct | ☑ | | |

### B2.9 · Weather Correctness
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 162 | rowCount correct | ✅ | | |
| 163 | max temp_high_c correct | ✅ | | |
| 164 | Line chart renders | ✅ | | |
| 165 | [Manual] min temp_low_c correct | ☑ | | |
| 166 | [Manual] filter Cape Town: correct subset | ☑ | | |

### B2.10 · Chained Workflow
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 167 | Pipeline: 5-row table after chain | ✅ | | |
| 168 | Pipeline: mean Adelie bill correct | ✅ | | |

### B2.11 · Error Handling
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 169 | Invalid column: no crash | ✅ | | |
| 170 | Chart on empty dataset: no crash | ✅ | | |
| 171 | [Manual] Error message visible in panel | ☑ | | |
| 172 | [Manual] DS CSV import: table renders with 5 rows | ☑ | | |

### B2.12 · CSV Import (Manual)
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 173 | [Manual] Load custom CSV via ds_load_csv_block | ☑ | | |
| 174 | [Manual] Column types inferred correctly | ☑ | | |
| 175 | [Manual] Table renders with correct dimensions | ☑ | | |

### B2.13 · Trace → Dataset Bridge (Hybrid)
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 176 | [Manual] Run simulation with telemetry | ☑ | | |
| 177 | [Manual] Save trace via TracePromoteDialog | ☑ | | |
| 178 | [Manual] Load trace as dataset | ☑ | | |
| 179 | [Manual] ds_count_rows > 50 | ☑ | | |
| 180 | [Manual] ds_calc_min y ≥ 0 | ☑ | | |
| 181 | [Manual] Scatter (t vs y) shows parabolic shape | ☑ | | |

---

## Part B — Physics Simulation Correctness

### B.1 · Projectile Motion
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 182 | Template runs without error | ✅ | | |
| 183 | Telemetry y > 0 at peak | ✅ | | |
| 184 | Final y < peak y (ball lands) | ✅ | | |
| 185 | [Manual] Peak height plausible for 45° launch | ☑ | | |
| 186 | [Manual] Trajectory arc visually correct | ☑ | | |

### B.2 · Spring Oscillator
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 187 | Template runs, trace captured | ✅ | | |
| 188 | Velocity oscillates (sign changes) | ✅ | | |
| 189 | [Manual] Period ≈ 2π√(m/k) within ±10% | ☑ | | |
| 190 | [Manual] Energy conservation (no drift) | ☑ | | |

### B.3 · Orbits & Pendulum
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 191 | Orbital Mechanics: runs without error | ✅ | | |
| 192 | Pendulum: runs without error | ✅ | | |
| 193 | [Manual] Orbits: stable circular path visible | ☑ | | |
| 194 | [Manual] Pendulum: correct oscillation frequency | ☑ | | |

---

## Part C — UX Quality Audit

> Run `node scripts/ux-audit.mjs` and review `frontend/docs/ux-audit.md` for details.

### C.1 · Colour Contrast (WCAG AA)
| # | Element | Auto | Result | Contrast Ratio | Notes |
|---|---------|------|--------|---------------|-------|
| 195 | Goal card title | ✅ | | | |
| 196 | Goal card description | ✅ | | | |
| 197 | Toolbar button label | ✅ | | | |
| 198 | Toolbox category label | ✅ | | | |
| 199 | DS value number | ✅ | | | |
| 200 | DS table cell | ✅ | | | |
| 201 | [Manual] Status bar text in light mode | ☑ | | | |
| 202 | [Manual] Status bar text in dark mode | ☑ | | | |

### C.2 · Typography
| # | Element | Auto | Result | Size | Notes |
|---|---------|------|--------|------|-------|
| 203 | Block label font-size | ✅ | | | MakeCode: 14-16px |
| 204 | Toolbox category label | ✅ | | | |
| 205 | Toolbar button label | ✅ | | | |
| 206 | DS table cell | ✅ | | | |
| 207 | Goal card title | ✅ | | | |

### C.3 · Toolbox UX
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 208 | Each category has colour indicator | ✅ | | |
| 209 | Category icons (vs MakeCode) | ✅ | | MakeCode has icons per category |
| 210 | Advanced drawer has expand indicator | ✅ | | |
| 211 | Block search bar prominent | ✅ | | |
| 212 | [Manual] Category ordering: simpler first | ☑ | | |
| 213 | [Manual] Category labels clear to a student | ☑ | | "State" vs "Variables & Properties"? |
| 214 | [Manual] Consistent colour spacing (no adjacent same-hue) | ☑ | | |

### C.4 · Button Sizing (WCAG 2.5.5)
| # | Element | Auto | Result | Size | Notes |
|---|---------|------|--------|------|-------|
| 215 | Run button | ✅ | | | Min 24×24px, rec 44×44px |
| 216 | Stop button | ✅ | | | |
| 217 | Theme toggle | ✅ | | | |
| 218 | Goal card | ✅ | | | |
| 219 | Project delete button | ✅ | | | |
| 220 | Create project button | ✅ | | | |

### C.5 · Visual Consistency
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 221 | Run button visually distinct (green) | ✅ | | |
| 222 | Active mode tab has clear distinction | ✅ | | |
| 223 | Toolbar separator spacing consistent | ✅ | | |
| 224 | [Manual] Error state: red border on input | ☑ | | |
| 225 | [Manual] Spacing/padding consistent across sections | ☑ | | |
| 226 | [Manual] Dark/light mode both look polished | ☑ | | |

### C.6 · Feedback & Loading
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 227 | Run → running indicator < 500ms | ✅ | | |
| 228 | DS auto-execution after workspace change | ✅ | | |
| 229 | Status bar present | ✅ | | |
| 230 | [Manual] Loading indicator while Blockly loads | ☑ | | |
| 231 | [Manual] DS panel updates smoothly (no flicker) | ☑ | | |
| 232 | [Manual] Template load is fast (< 2s) | ☑ | | |

### C.7 · Accessibility
| # | Check | Auto | Result | Notes |
|---|-------|------|--------|-------|
| 233 | Run/Stop buttons have accessible label | ✅ | | |
| 234 | Theme toggle has accessible label | ✅ | | |
| 235 | Delete project button has aria-label | ✅ | | |
| 236 | Help overlay has role="dialog" | ✅ | | |
| 237 | Keyboard Tab navigates start menu | ✅ | | |
| 238 | [Manual] Screen reader announces goal cards | ☑ | | |
| 239 | [Manual] Focus visible on all interactive elements | ☑ | | |
| 240 | [Manual] Wizard radio options keyboard navigable | ☑ | | |

---

## Summary Table

| Suite | Automated | Manual | Total |
|-------|-----------|--------|-------|
| A: UI Workflows | 27 | 16 | 43 |
| B2: DS Correctness | 60 | 20 | 80 |
| B: Physics Correctness | 8 | 6 | 14 |
| C: UX Audit | 32 | 14 | 46 |
| **Total** | **127** | **56** | **183** |

### Overall Result

| Status | Count |
|--------|-------|
| ✅ Pass | _fill in_ |
| ❌ Fail | _fill in_ |
| ⚠️ Partial / WARN | _fill in_ |
| ☑ Manual pending | 56 |

---

## Known Issues / Findings

> Fill in during test run

| # | Severity | Issue | Component |
|---|----------|-------|-----------|
| 1 | | | |

---

## UX Improvement Recommendations

> Fill in after running `node scripts/ux-audit.mjs`

See `frontend/docs/ux-audit.md` for full findings.

---

## Not yet covered — the portal (recorded 2026-08-25, Plan 5 wrap-up; widened 2026-08-28, Plan 6)

Five surfaces were recorded here at Plan 5's wrap with **zero e2e coverage**:
`/welcome`, the auth screens (`/auth/*`, `/profile`), `/classes` (wall, class
tabs), `/join` (+ invite landing), and `/admin`.

**Plan 6 widened the gap before it began closing it.** Everything the
assignments build shipped arrived with no browser coverage either: the
assignment editor and guide pages, the student assignment page, the in-IDE
brief pane and workspace-rules chip, the submissions inbox and the marking
room, the gradebook and its CSV export, the History screen, and group
formation with the editing baton. Recording that honestly is the point of this
section — the list of what is covered must not quietly stop growing while the
product does.

What holds today without a browser: `npm run test -w frontend` covers all of
the above at the component level, and the conformance suites (`platformTokens`,
`welcomeTokens`, `primitivesTokens`, `assignmentsTokens`, `tokenRamp`,
`portalControls`, `iconsIdiom`) hold the design-system rules.

**First repayment — landed with Plan 6's final task (Task 26).**
`frontend/scripts/portal-e2e.mjs` drives one browser run of the golden flow, a
teacher and a student in two separate browser contexts: teacher signs in →
creates a class → authors and publishes an assignment → student signs up,
confirms via the pretend inbox, joins by code, opens the assignment, starts
work (brief pane and rules chip present), edits and submits with a fingerprint
→ teacher's inbox shows 1 of 1, the marking room renders the snapshot, a mark
is saved and released → the gradebook shows it → the student sees the feedback.
Alongside the flow it sweeps every screen it lands on for `.welcome-btn` ghosts
and rule-less classes (classes on live elements that no stylesheet rule
defines), and audits the whole run for console errors.

To run it:

```bash
npm run db:up && npm run db:migrate && npm run seed   # Postgres, schema, seeded admin
npm run dev                                           # backend :4000 + frontend :3000
node frontend/scripts/portal-e2e.mjs
```

41 checks; screenshots land in `frontend/e2e/portal-*.png` and the machine-
readable result (including the per-screen sweeps) in
`frontend/e2e/portal-results.json`. The run mints its own class, assignment and
student account each time, so it is safe to re-run against a dev database that
is never reset.

**A clean run is 39/41 — two checks are RED at hand-over**, on genuine product
defects the flow found rather than on the harness. Recorded here so a later run
is read correctly and not "fixed" by weakening the checks:

- **Check 20, every run.** Start work lands on the start menu instead of in the
  work — `LAST_PROJECT_KEY` is only read at app boot, but `navigate("/")` is a
  client-side transition.
- **Check 40, every run.** `.brief-pane__footer` and `.rich-text-editor` carry
  no CSS rule.

A **third** defect sits behind check 19 and is **intermittent — it failed
roughly half the runs** (2 of 4 at hand-over): Start work is refused with
"Could not reach the server" when two callers push the same brand-new project
concurrently and `PUT /api/projects/:id` takes its non-race-safe create branch.
So **38/41 is an equally expected result**, and a run that reports 39/41 has
not fixed anything — it simply won the race. Until all three are fixed, treat
38 or 39 of 41 as the baseline and read the named failures, not the count.

Details, plus a third rule-less class the flow does not reach (`.btn--small` in
`HistoryTimeline.js`), are in
`docs/superpowers/reviews/2026-08-28-plan6-browser-pass-checklist.md`.

**Still uncovered after that lands**, and the reason spec §18's
forward-reference item 6 stays open: `/admin`, the invite landing, `/profile`,
two-browser group work with the editing baton, the gradebook CSV opened in a
real spreadsheet, the History restore round-trip, and the stack briefing's §5
design regressions. Those are handed to a human browser pass — the Plan 6
checklist joins `2026-08-22-plan4-browser-pass-checklist.md` and
`2026-08-25-plan5-browser-pass-checklist.md` under
`docs/superpowers/reviews/` — until a script takes them over.

---

_Generated by Physics IDE E2E test suite • `scripts/e2e-test.mjs` + `scripts/ux-audit.mjs`_
