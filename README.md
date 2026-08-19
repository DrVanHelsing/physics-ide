# Physics IDE

Physics IDE is a browser-based, zero-install environment for physics simulation and foundational data science. It combines a visual block editor, a Monaco code editor, a live 3D WebGL viewport, and a data analysis panel — all in a single React application with no backend, no accounts, and no installation required.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Install and Run](#2-install-and-run)
3. [Project Goals](#3-project-goals)
4. [Templates](#4-templates)
5. [Block System](#5-block-system)
6. [Data Science Blocks](#6-data-science-blocks)
7. [Export and Import](#7-export-and-import)
8. [Keyboard Shortcuts](#8-keyboard-shortcuts)
9. [Troubleshooting](#9-troubleshooting)
10. [Code Structure](#10-code-structure)

---

## 1. Architecture Overview

### Runtime model

Each physics simulation runs inside a **fresh iframe** (`src/utils/runner/glowRunner.js`). The iframe loads and compiles the GlowScript 3.2 VPython runtime on every Run press; Stop destroys it. This makes start/stop deterministic and prevents globals from leaking between runs.

Data Science analyses execute via the **DS runner** (`src/utils/runner/dsRunner.js`), an async `AsyncFunction`-based sandbox that evaluates generated JavaScript against the `__ds` API (Arquero + Observable Plot). No iframe required — output is collected in an `__outputs` array and rendered in the Data panel.

### State and persistence

- React functional components with custom hooks; no Redux or external state library.
- All project data persisted to **localForage** (IndexedDB-backed) via `src/utils/storage/projectStore.js`.
- Projects are stored as a manifest object (`src/utils/manifest/schema.js`) carrying `goal`, `projectType`, block XML, and code.
- Multiple projects are listed on the Start Menu and persist across sessions.

### Toolbox generation

The block toolbox is generated at runtime by `buildToolboxXml(goal)` in `src/utils/blockly/toolbox.js`. It reads the master toolbox XML, filters every block's domain tag (physics / datascience / shared) against the current goal, and prunes empty categories. There is one source-of-truth toolbox; there are no hand-maintained per-goal copies.

### Compile pipeline (physics)

1. Code normalised and prefixed with `GlowScript 3.2 VPython` if missing.
2. GlowScript compiler (`RScompiler`) loaded into the sandbox iframe.
3. Compiled JS executed; `__main__()` invoked.
4. Stop: iframe removed.

---

## 2. Install and Run

**Requirements:** Node.js 20.19+, npm 10+, Docker Desktop (for the local database).

```bash
npm install
npm run db:up      # start Postgres (Docker)
npm run db:migrate    # create/update database tables
npm run seed       # seed settings + the admin account (admin@physics-ide.local)
npm run dev        # API on :4000 + app on :3000
```

Accounts are live in local dev: sign up from the start menu (student or teacher), and manage people, the 200-account cap, and the pretend email inbox from the admin console (sign in as the seeded admin — dev default password `admin-dev-password`, override with `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` env vars before running the seed). No real email is sent in local dev; every message lands in the admin console's Emails tab.

Classrooms are live too: teacher accounts create classes from **My classes** (account chip →
My classes), students join by code, link, QR, or email invite, and the People tab manages the
roster (waiting-list approval, co-teachers, teaching assistants, invites). Invite emails land in
the admin console's pretend inbox like everything else.

Signed-in work now syncs: projects save to your computer first (always), then quietly to your
account — the status chip in the status bar tells the truth (`Synced` / `Waiting for connection`).
Most-recent-edit-wins across machines, with the losing version kept in the project's server-side
history (last 20 versions). Guests stay fully local; at first sign-in the app offers to bring
guest projects into the account. Caps: 100 projects per account, 400 KB per project.
First-time visitors land on `/welcome` — an animated tour of the IDE with three doors: use it
as a guest, create an account, or sign in. Returning visitors go straight to the IDE.

```bash
npm run test           # all workspace test suites (Vitest)
npm run check:blocks   # verify block registry has no duplicates
npm run build -w frontend   # production build → frontend/dist/
```

The repo is an npm-workspaces monorepo: `frontend/` (the React IDE, Vite), `backend/` (Fastify API), `shared/` (schemas used by both). The classroom platform is being built per [docs/classroom-platform.md](docs/classroom-platform.md).

---

## 3. Project Goals

The Start Menu presents three **project goals**. Selecting a goal opens a creation wizard where the user sets a title, chooses a start path (Blank or Template), and selects an editor default (Blocks or Code).

### Physics Modelling

Block toolbox contains: Values, Objects, Motion, State, Control, Logic, Math, Variables, and an Advanced drawer (3D Math, Raw Python, Loops, Text, Lists, Functions). DS categories are excluded. Physics templates are available.

### Data Science

Block toolbox contains: Control, Logic, Math, Variables, Data Science, and the Advanced drawer. Physics categories (Values, Objects, Motion, State) are excluded. A `ds_start_block` hat is pre-seeded in the workspace. The **Data panel** on the right side renders tables, charts, value outputs, and conclusion blocks automatically after every workspace change. DS templates are available.

### Hybrid

Block toolbox contains every category from both Physics Modelling and Data Science. Both the 3D Viewport and the Data panel are visible. Trace data from a physics run can be promoted to a dataset and loaded into a DS analysis. **Hybrid topics** (Pendulum, Projectile, Spring) couple a simulation with its matching analysis and auto-set the model/data-first entry; after a run is saved, an **"Analyse this run →"** action loads the paired analysis with the run label filled in.

---

## 4. Templates

### Physics templates (`src/utils/precodedExamples.js` and `src/utils/blockTemplates.js`)

Each physics template ships in two flavours: a Code template (editable VPython) and a Blocks template (editable block workspace with a read-only code mirror).

| Template | Physics | Key parameters |
|---|---|---|
| Projectile Motion | Euler integration, quadratic drag (Cd=0.47), multi-bounce (e=0.55) | v0=17.5 m/s, angle=52 deg |
| Spring-Mass Oscillator | Hooke's law, linear damping (b=0.22 Ns/m) | k=14 N/m, m=1.2 kg, x0=1.8 m |
| Sun, Earth and Moon | Newtonian three-body gravity, softened distances | G=10, M_star=10.33 |
| Simple Pendulum | Full nonlinear ODE, symplectic Euler, linear damping | L=2.0 m, m=1.0 kg, b=0.10 Ns/rad |

All four Blocks templates are built entirely from semantic custom blocks. The pendulum template uses zero `python_raw_block` blocks.

### Data Science templates (`src/utils/blockTemplates.js`)

| Template | Dataset | Workflow |
|---|---|---|
| Penguins: exploratory analysis | Penguins (30 rows, 7 cols) | Load, table, count, all-stats, group-mean by species, bar + scatter + histogram charts, conclusion |
| Weather: compare two cities | Weather (28 rows, 6 cols) | Load, table, group-mean, bar + line + box charts, Cape Town filter, conclusion |
| Planets: Kepler's third law | Planets (9 rows, 7 cols) | Load, table, sort by distance, scatter distance vs period, max-period print, conclusion |
| Pendulum: what controls the period? | Pendulum (56 rows, 7 cols) | Filter length study, compute T² = period², regress T² vs length (slope 4π²/g → g); filter mass study, mean period per mass; conclusion (T² ∝ L, mass-independent) |
| Free fall: measure g | Free fall (12 rows, 3 cols) | Regress velocity vs time → slope = g ≈ 9.8 m/s²; conclusion |
| Uncertainty: repeated measurements | Pendulum (56 rows, 7 cols) | Filter one length's trials, period mean ± standard error, relative uncertainty %, conclusion |
| Linear regression: Hooke's law | Spring (8 rows, 3 cols) | Regress force vs extension → spring constant k ≈ 19.6 N/m, scatter+fit chart, conclusion |

### Hybrid topics (`HYBRID_TOPICS` in `src/utils/blockTemplates.js`)

A hybrid topic couples a simulation template with its matching analysis template, and auto-sets the model/data-first entry. Pick a topic in the wizard, run the simulation, save a run, then use **"Analyse this run →"** on the chart to load the paired analysis with the run label pre-filled. (Data-first opens straight into the analysis instead.)

| Topic | Simulation telemetry | Analysis (regression slope) |
|---|---|---|
| Pendulum: measure damping | `t`, `E_total` | ln(E) vs t → slope −γ (damping coefficient) |
| Projectile: measure g | `t`, `vy` | vy vs t → slope −g (crop to before the first bounce) |
| Spring-mass: find k | `stretch`, `Fspring` | Fspring vs stretch → slope −k (spring constant) |

---

## 5. Block System

### Toolbox categories (goal-filtered)

| Category | Goal | Contents |
|---|---|---|
| Values | Physics, Hybrid | `vector_block`, `colour_block`, `expr_block`, `var_read_block`, `physics_const_block`, `define_const_block`, `get_prop_block`, `get_component_block`, `mag_block`, `norm_block` |
| Objects | Physics, Hybrid | Sphere, box, cylinder, arrow, helix, label constructors; `scene_camera_block` |
| Motion | Physics, Hybrid | `set_velocity_block`, `update_position_block`, `apply_force_block`, `set_gravity_block`, `rotate_object_block` |
| State | Physics, Hybrid | `set_scalar_block`, `set_attr_expr_block`, `add_attr_expr_block`, `telemetry_update_block`, `define_const_block` |
| Control | All | `sim_start_block`, `sim_end_block`, `forever_loop_block`, `for_range_block`, `rate_block`, `time_step_block`, `if_block`, `if_else_block`, `break_loop_block`, `comment_block` |
| Logic | All | `compare_block`, `logic_and_or_block`, `logic_not_block`, `logic_boolean`, `logic_null`, `logic_ternary` |
| Math | All | `math_number`, `math_arithmetic`, `math_constant`, `math_number_property`, `math_round`, `math_modulo`, `math_random_int`, `math_random_float` |
| Variables | All | Native Blockly variable category (VARIABLE custom) |
| Data Science | DS, Hybrid | See Section 6 |
| Advanced > 3D Math | All | `vector_compose_block`, `cross_product_block`, `dot_product_block`, `mag_block`, `norm_block`, `math_min_block`, `math_max_block`, `math_clamp_block`, `math_pow_block`, `math_trig_block` |
| Advanced > Raw Python | All | `python_raw_block`, `python_raw_expr_block` |
| Advanced > Loops | All | Standard Blockly `controls_repeat_ext`, `controls_for`, `controls_forEach`, `controls_flow_statements` |
| Advanced > Text | All | Standard Blockly text blocks |
| Advanced > Lists | All | Standard Blockly list blocks |
| Advanced > Functions | All | Standard Blockly PROCEDURE custom category |

### Value blocks

| Block | Output |
|---|---|
| `vector_block` | `vector(x, y, z)` — inline fields |
| `vector_compose_block` | `vector(X, Y, Z)` — three value slots |
| `colour_block` | `vector(r, g, b)` — visual colour picker |
| `expr_block` | Any Python expression — free-text field |
| `physics_const_block` | Named constant (g, G, c, h, pi, e, ke, me, mp) |
| `var_read_block` | Blockly variable by name |
| `get_prop_block` | `obj.attr` |
| `get_component_block` | `vec.x / .y / .z` scalar |
| `mag_block` | `mag(vec)` |
| `norm_block` | `norm(vec)` |

### Logic blocks (output: Boolean)

| Block | Output |
|---|---|
| `compare_block` | `A op B` — operators: `<`, `>`, `<=`, `>=`, `==`, `!=` |
| `logic_and_or_block` | `A and/or B` |
| `logic_not_block` | `not V` |
| `logic_boolean` | `True` / `False` |

The standard Blockly `logic_compare`, `logic_operation`, and `logic_negate` blocks are excluded — they generate Python 2-style comparisons that produce wrong results inside GlowScript. Use the custom blocks above.

### 3D Math blocks

| Block | Output |
|---|---|
| `cross_product_block` | `cross(A, B)` |
| `dot_product_block` | `dot(A, B)` |
| `math_pow_block` | `base ** exp` |
| `math_min_block` / `math_max_block` | `min(a, b)` / `max(a, b)` |
| `math_clamp_block` | `max(lo, min(hi, val))` |
| `math_trig_block` | `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `radians`, `degrees`, `sqrt`, `abs` |

`math_trig_block` generates VPython global-scope calls (`sin(x)` not `math.sin(x)`). The standard Blockly `math_trig` and `math_single` blocks are excluded because they generate `math.sin()` / `math.fabs()` which do not exist inside GlowScript.

### Program structure

Every physics simulation must include a `sim_start_block` hat block at the top of the block stack. All setup code (object creation, constants, initial conditions) goes inside its body. The `forever_loop_block` follows, with `rate_block` as its first child and physics updates inside. `sim_end_block` follows the loop for completion messages.

Every data science analysis must start with a `ds_start_block` hat. Load blocks, transform blocks, display blocks, and communication blocks chain inside it.

---

## 6. Data Science Blocks

All DS blocks are defined in `src/utils/blockly/blocklyGenerator.js` and their JS generators in `src/utils/blockly/dsGenerator.js`. Execution is via `src/utils/runner/dsRunner.js`. The data layer is in `src/utils/dataset/dataset.js` (Arquero-backed transforms).

### Load

| Block | Action |
|---|---|
| `ds_load_builtin_block` | Load a built-in dataset: planets, penguins, weather, pendulum, spring, or freefall |
| `ds_load_csv_block` | Trigger file picker; load CSV with type inference |
| `ds_load_trace_block` | Load a saved simulation trace as a dataset |

### Explore

| Block | Output |
|---|---|
| `ds_show_table_block` | Render a scrollable table (first 12 rows visible) |
| `ds_show_first_n_block` | Table of first N rows |
| `ds_show_last_n_block` | Table of last N rows |
| `ds_show_column_block` | Table of a single column |
| `ds_count_rows_block` | Numeric value: row count |
| `ds_count_cols_block` | Numeric value: column count |
| `ds_list_cols_block` | Labelled output listing column names |
| `ds_count_unique_block` | Numeric value: unique value count in column |
| `ds_show_one_cell_block` | Scalar value at a given row and column |
| `ds_identify_type_block` | Text output: inferred type of column |

### Statistics

| Block | Output |
|---|---|
| `ds_calc_mean_block` | `mean(col)` |
| `ds_calc_median_block` | `median(col)` |
| `ds_calc_mode_block` | `mode(col)` — most frequent value |
| `ds_calc_min_block` | `min(col)` |
| `ds_calc_max_block` | `max(col)` |
| `ds_calc_range_block` | `max(col) - min(col)` |
| `ds_calc_sum_block` | `sum(col)` |
| `ds_calc_count_block` | Non-missing value count |
| `ds_calc_stddev_block` | Sample standard deviation (n-1) |
| `ds_all_stats_block` | Count, mean, median, min, max, range, sum, spread in a grid |
| `ds_compare_columns_block` | Side-by-side stats for two columns |

### Filter and Sort

| Block | Action |
|---|---|
| `ds_filter_eq_block` | Keep rows where `col == value` |
| `ds_filter_gt_block` | Keep rows where `col > value` |
| `ds_filter_lt_block` | Keep rows where `col < value` |
| `ds_sort_asc_block` | Sort ascending by column |
| `ds_sort_desc_block` | Sort descending by column |
| `ds_remove_missing_block` | Drop rows where column is null or empty |
| `ds_find_missing_block` | Keep only rows where column is null or empty |
| `ds_filter_and_block` | Two-condition AND filter |
| `ds_filter_or_block` | Two-condition OR filter |

### Group and Compare

| Block | Output |
|---|---|
| `ds_group_count_block` | Table: count of rows per group |
| `ds_group_mean_block` | Table: mean of a value column per group |

### Analyse (regression and uncertainty)

| Block | Output |
|---|---|
| `ds_linear_regression_block` | Fit `y = m·x + c`; regression card with slope, intercept, R² (the slope is the physical quantity: g, k, −γ) |
| `ds_multiply_columns_block` | New column = product of two columns (e.g. `T² = period × period`) |
| `ds_add_column_transform_block` | New column from a transform of another (square, sqrt, ln, t², …) |
| `ds_print_uncertainty_block` | Column mean ± standard error card |
| `ds_calc_relative_uncertainty_block` | Relative uncertainty (standard error ÷ mean) as a % |

### Charts (Observable Plot)

| Block | Chart type |
|---|---|
| `ds_chart_bar_block` | Bar chart — x col (categorical), y col (numeric) |
| `ds_chart_line_block` | Line chart — x col, y col |
| `ds_chart_scatter_block` | Scatter plot — x col, y col |
| `ds_chart_scatter_fit_block` | Scatter plot with regression line — x col, y col, fit variable |
| `ds_chart_histogram_block` | Histogram — numeric column |
| `ds_chart_box_block` | Box plot — value column, optional group column |
| `ds_save_chart_block` | Save chart as PNG to local project storage |

### Communicate

| Block | Output |
|---|---|
| `ds_write_note_block` | Markdown text note |
| `ds_print_result_block` | Named value display card |
| `ds_compare_results_block` | Side-by-side named value comparison |
| `ds_state_conclusion_block` | Styled conclusion callout |
| `ds_export_table_block` | Download current dataset as CSV |
| `ds_show_python_block` | Reveal generated Python code |

---

## 7. Export and Import

### Export dropdown (toolbar)

| Item | Shortcut | Output |
|---|---|---|
| Export as Python (.py) | Ctrl+S | Current VPython code as a .py file |
| Export Blocks (.xml) | — | Blockly workspace serialised as XML |
| Code as PDF | — | Formatted code as a PDF document |
| Blocks as PDF | — | Block canvas screenshot as a PDF |
| Screenshot Viewport (.png) | — | Current 3D viewport frame as PNG |
| Copy Code to Clipboard | Ctrl+C | Code copied to system clipboard |
| Export Project Bundle (.physide.json) | — | Complete project manifest as a single JSON file |

### Import

The **Open...** button in the toolbar accepts `.physide.json` project bundles. The loaded project replaces the current workspace contents after a confirmation prompt.

### Debug Mode trace export

In Debug Mode, press **Record**, run or step through the simulation, press **Stop Rec**, then click **CSV** to download a CSV file containing variable, value, delta, min, max, and timestamp columns for every captured trace event.

---

## 8. Keyboard Shortcuts

| Context | Shortcut | Action |
|---|---|---|
| Global | Ctrl+Enter | Run simulation |
| Global | Ctrl+S | Export as Python (.py) |
| Global | Ctrl+C | Copy code to clipboard |
| Block canvas | Ctrl+Z / Ctrl+Y | Undo / Redo |
| Block canvas | Delete / Backspace | Delete selected block |
| Block canvas | Ctrl+A | Select all blocks |
| Code editor | Ctrl+/ | Toggle comment |
| Code editor | Alt+Up / Alt+Down | Move line up / down |
| Code editor | Ctrl+F | Find in file |
| 3D Viewport | Left drag | Orbit camera |
| 3D Viewport | Right drag | Pan camera |
| 3D Viewport | Scroll wheel | Zoom in / out |
| Debug Mode | Space | Pause / Resume |
| Debug Mode | F10 | Step one trace event |
| Debug Mode | Esc | Exit Debug Mode |

---

## 9. Troubleshooting

### Physics simulation does not animate

- Confirm the `forever_loop_block` is connected inside the `sim_start_block` body.
- Confirm `rate_block` is the first block inside the loop.
- Confirm position update and velocity update blocks are inside the loop body.

### Orbit freezes or produces singularities

- Add a minimum-distance guard: `max(mag(r), minRadius)` before computing the gravity vector.
- Check that the planet's initial velocity is close to the circular orbit speed: `sqrt(G * M / r)`.

### Scene title or text is unreadable

- The iframe re-applies theme-aware colours on every Run. Press Stop then Run again.
- For custom `scene.title` values, set them with a `python_raw_block` at the top of the `sim_start_block` body.

### Stop button does nothing

- If the iframe appears stuck, press Run once to re-initialise the runtime, then press Stop.

### Data Science panel shows no output

- Confirm the `ds_start_block` hat is present in the workspace.
- Confirm display blocks (`ds_show_table_block`, `ds_chart_bar_block`, etc.) are inside the hat's body.
- Check the status bar at the bottom for a runner error message.

---

## 10. Code Structure

```
src/
  App.js                          Root component and context providers
  components/
    StartMenu.js                  Goal cards, project wizard, project list
    layout/IDELayout.js           Top-level IDE orchestrator (hooks, render branches)
    BlocklyWorkspace.js           Blockly inject, toolbox events, workspace serialisation
    CodeEditor.js                 Monaco editor wrapper
    GlowCanvas.js                 3D viewport iframe host
    DataPanel.js                  DS output renderer (tables, charts, values, conclusions)
    DebugMode.js                  Full-screen debug overlay
    TraceTable.js                 Live variable trace with sparklines, CSV export
    HelpPage.js                   In-app help with search and section navigation
    BeginnerGuide.js              Contextual walkthrough guide
    Icons.js                      SVG icon components
  hooks/
    useProject.js                 Project load, save, create
    useSimulation.js              Run, stop, pause, step, breakpoints
    useDebug.js                   Debug mode state
    useTrace.js                   Trace capture and aggregation
    useExport.js                  Export handlers
  utils/
    blockly/
      blocklyGenerator.js         All block definitions and VPython generators
      dsGenerator.js              DS block JS generators
      blockRegistry.js            Block metadata registry (keywords, domain, category)
      toolbox.js                  Master toolbox XML and goal-filtering logic
    runner/
      glowRunner.js               Physics iframe runtime (load, compile, run, stop, pause, step)
      dsRunner.js                 DS async function sandbox
    dataset/
      dataset.js                  Dataset shape, Arquero transforms, stat helpers, CSV parser
      datasetRegistry.js          In-memory dataset registry (saved traces)
      builtins/                   planets.json, penguins.json, weather.json, pendulum.json, spring.json, freefall.json
    charts/
      chartSpec.js                DS chart renderers (Observable Plot)
      plotRender.js               Physics chart renderer (phase-A legacy)
    manifest/
      schema.js                   Project manifest shape and defaults
      factory.js                  Manifest creation from wizard spec
    storage/
      projectStore.js             localForage project read/write/delete/list
    precodedExamples.js           Physics code template strings
    blockTemplates.js             Physics and DS block template XML
```

---

## Deployment

See [DEPLOY.md](DEPLOY.md) for Vercel and Cloudflare Pages instructions.
