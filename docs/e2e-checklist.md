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

## Not yet covered — the portal (recorded 2026-08-25, Plan 5 wrap-up; widened 2026-08-28, Plan 6; extended 2026-08-28, Plan 7; extended again 2026-08-29, Plan 8)

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

**Second repayment — the sharing golden flow, landed with Plan 7's final task
(Task 16, 2026-08-28).** The same run now carries peer sharing end to end, in
a **third** browser context: the teacher flips Sharing rules On in Class
Settings (the door asserted Off first, so the flip is what is being read) → a
second student B signs up, confirms through the pretend inbox and joins by
code → student A is refused `Share…` inside their standard-classwork
assignment work (a share is a copy-out; refused means **absent**, not greyed
out) → A makes an ordinary project of their own through the start menu's
wizard and waits for it to reach the server → File → `Share…` lists the one
class with sharing on, its roster minus the sharer, and the consequence line
verbatim → Share confirms by name → the section stays absent on A's own class
page → B's class page offers it, named by sharer and title → Add to my
projects lands B in the IDE with the copy open and the status-bar chip reading
`Based on work shared by <A>` → the start menu's library row carries the same
sentence → and the section is gone from B's class page again. Screenshots
`portal-10-share-dialog`, `portal-11-attribution-chip`,
`portal-12-library-label`.

**Third repayment — notifications and data care, landed with Plan 8's final
task (Task 15, 2026-08-29).** A **fourth** browser context joins, and the run
now carries the bell, the preference switches, the revoke and the admin data
requests end to end:

- **The bell.** The run first reads student A's existing notifications through
  the bell itself (opening it *is* the mark-all gesture) so the badge starts at
  zero, then the teacher publishes a **second** assignment. A's badge comes back
  reading exactly `1`, the dropdown's newest row is
  `New assignment in <class>: “<title>”` **character for character** — the
  renderer's own sentence, curly quotes included — and after the open that marks
  it read the badge stays gone across a **reload**, so the mark is the server's,
  not the tab's. Screenshots `portal-13-bell-unread`, `portal-14-bell-open`.
- **The switches.** `/profile` lists the five `.pref-row` checkboxes in
  `SWITCHABLE_EMAIL_KEYS` order (index 3 is `Due-tomorrow reminders`, asserted by
  its label). A switches that one off, saves, reloads: it is still off and the
  other four are still on — one switch moved, not five.
- **Waiting on them, and Revoke.** The sharing segment ends with the share
  *accepted*, and an accepted share is not pending, so the run mints a fresh one
  (the same project offered a second time — the dup guard is scoped to pending
  rows). A's class page then grows `Waiting on them` naming the project and
  `to <B>`; B's page is offering the same row at the same moment; A presses
  **Revoke** and it leaves **both** pages — A's section renders nothing rather
  than an empty heading, and B's offer is gone. Screenshot
  `portal-15-waiting-on-them`.
- **Data requests.** A throwaway student signs up, confirms through the pretend
  inbox and signs in — a real door, so closing it means something. The admin
  console's fifth tab rests on `Search for a person to export or erase their
  data.` rather than listing everyone; the search finds the one person asked
  for; `Export` answers **200** with `note` first and the person's own `user`
  block (the fetch behind the button is what is asserted — the download itself
  is a browser save); the erase dialog keeps `Erase permanently` **disabled** on
  an empty box and on the wrong email and unlocks only on the exact one; after
  the erase the People tab shows the third status — `erased`, under
  `Removed student`, with **no action left to offer**; and the throwaway's old
  address no longer opens the door (`Invalid email or password.` — the scrub
  rewrote the email, so it is the unknown-email door, not the deactivated one).
  Screenshot `portal-16-data-requests`.

75 checks; screenshots land in `frontend/e2e/portal-*.png` and the machine-
readable result (including the per-screen sweeps) in
`frontend/e2e/portal-results.json`. The run mints its own class, assignments,
student accounts and throwaway each time, so it is safe to re-run against a dev
database that is never reset.

**A clean run is 75/75** (57/57 before Plan 8 extended it, 41/41 before Plan 7).
That is the baseline; anything less is a regression to read by its named
failures, never a count to be talked down.

It was not always. The flow found three genuine product defects at hand-over —
recorded here because what a harness catches is worth keeping, and because a
later run must not "fix" any of them by weakening the check:

- **Check 20** failed every run: Start work landed on the start menu instead of
  in the work — `LAST_PROJECT_KEY` is only read at app boot, but `navigate("/")`
  is a client-side transition. Fixed by `utils/projectOpenRequest.js`, the
  announcement half of that hand-off.
- **Check 40** failed every run: `.brief-pane__footer` and `.rich-text-editor`
  carried no CSS rule. Both now have one (`styles/assignments.css`).
- **Check 19** failed **intermittently — roughly half the runs** (2 of 4 at
  hand-over): Start work was refused with "Could not reach the server" when two
  callers pushed the same brand-new project concurrently and
  `PUT /api/projects/:id` took its non-race-safe create branch. The route now
  catches the unique violation, re-reads the winner's head and falls through to
  the ordinary update path. Because it was the intermittent one, treat a
  **single** green run as weak evidence: re-run it a few times.

All three were closed in the final fix wave (2026-08-28) and the run has been
41/41 across three consecutive runs since. Details of what was found, including
a third rule-less class the flow does not reach (`.btn--small` in
`HistoryTimeline.js`, also fixed), are in
`docs/superpowers/reviews/2026-08-28-plan6-browser-pass-checklist.md`.

Plan 7's extension found one more of exactly the same shape on its first run:
**`.attribution-chip`** carried no stylesheet rule — the status-bar credit had
its `__text` styled but the pill itself unbounded, so a long sharer name would
push the run status out of a 26px strip. Fixed in `styles/assignments.css`
(bounded like its `.rules-chip` sibling, the text ellipsizing, the full
sentence on the tooltip). Nothing else the sharing flow touched was rule-less,
and the console-error audit stayed at zero across the new third context.

Plan 8's extension found the third of that exact shape, and this one the sweep
caught on the **existing** screens before a single new check ran:
**`.bell-trigger`** carried no stylesheet rule. The bell's trigger is icon-only
like the theme toggle standing right beside it, but with no rule of its own it
fell back to `.tb-btn`'s label padding and drew **34×26** next to the toggle's
**28×24** — two adjacent icon-only buttons in the same right cluster, visibly
different boxes, at both headers. **Fixed** by composing `.tb-btn--icon` onto
the trigger at the call site (`NotificationBell.js`), the same utility
`ThemeToggleButton` uses, so the icon padding keeps exactly **one** owner
(`chrome.css`); `platform.css` carries the block name as the *scope* of the
rule that only means anything inside it
(`.bell-trigger .bell-trigger__inner`) rather than restating a literal the
utility already owns. Both triggers now measure **28px wide**; the bell stays
2px taller because its icon is 16px to the toggle's 14px.

Measuring that fix at **both** headers turned up a second, separate defect the
sweep cannot see, because it is a collision rather than an absence: Plan 8 put
the bell into `.app-header__account`, a zone that had held **one** control and
therefore had no internal spacing. Its two children sat flush (bell trigger
right edge `1322.1`, account button left edge `1322.1`) and the bell's unread
badge — which overhangs its trigger by 2px — landed **2px inside the account
button's box**. **Fixed** in `styles/chrome.css`: the zone spaces its controls
the way every other zone does. The badge-to-account gap is now `+6px` at both
headers, identical.

Nothing the four new screens touched was rule-less, and the console-error audit
stayed at zero across the new fourth context.

**Still uncovered after that lands**, and the reason spec §18's
forward-reference item 6 stays open:

- The invite landing (`/join/invite`) — no browser coverage.
- Two-browser group work with the editing baton — no browser coverage.
- The gradebook CSV opened in a real spreadsheet — needs a human and a
  spreadsheet app.
- The History restore round-trip — no browser coverage.
- The stack briefing's §5 design regressions — no browser coverage.
- **Sharing golden flow — covered (portal-e2e).** Share → accept →
  attribution runs end to end, both label surfaces asserted. What the script
  does *not* reach, and the Plan 7 human checklist carries instead: the
  dialog's three empty/refusal states, `Share…`'s absence for a guest and on
  group/individual work, flipping the switch back off with a share pending,
  offline behaviour, and the 1024px floor.
- **Bell + preferences + data requests + revoke — covered (portal-e2e).**
  `/admin` and `/profile` both leave the never-covered list above: the flow
  drives them. What the script does *not* reach, and the Plan 8 human
  checklist carries instead: the bell read at the **IDE** header as well as the
  portal one and in both themes, each notification's link landing on the right
  page, a switched-off email genuinely **absent** from the admin Emails tab
  while the bell row still arrives, the teacher's widened `Waiting on them`,
  and `/privacy` read at 1024px and at phone width.

Those are handed to a human browser pass — the Plan 8 checklist
(`2026-08-29-plan8-browser-pass-checklist.md`) joins the Plan 7
(`2026-08-28-plan7-browser-pass-checklist.md`), Plan 6, Plan 5
(`2026-08-25-plan5-browser-pass-checklist.md`) and Plan 4
(`2026-08-22-plan4-browser-pass-checklist.md`) files under
`docs/superpowers/reviews/` — until a script takes them over.

---

_Generated by Physics IDE E2E test suite • `scripts/e2e-test.mjs` + `scripts/ux-audit.mjs`_
