---
stylesheet: docs/vscode-theme.css
pdf_options:
  format: A4
  printBackground: true
  margin:
    top: 12mm
    right: 12mm
    bottom: 12mm
    left: 12mm
---

# Physics IDE — User Guide

> **Version:** 1.0 · **Date:** June 2026  
> **Audience:** Students, Educators, and Developers

---

## Table of Contents

1. [What is Physics IDE?](#1-what-is-physics-ide)
2. [Getting Started](#2-getting-started)
3. [The Start Menu](#3-the-start-menu)
4. [The Toolbar](#4-the-toolbar)
5. [Block Editor](#5-block-editor)
6. [Data Science Analysis](#6-data-science-analysis)
7. [Code Editor](#7-code-editor)
8. [3D Simulation Viewport](#8-3d-simulation-viewport)
9. [Data Panel](#9-data-panel)
10. [Debug Mode](#10-debug-mode)
11. [Live Trace Table](#11-live-trace-table)
12. [Exporting and Importing Work](#12-exporting-and-importing-work)
13. [Themes and Display](#13-themes-and-display)
14. [Keyboard Shortcuts](#14-keyboard-shortcuts)
15. [Physics Block Reference](#15-physics-block-reference)
16. [Data Science Block Reference](#16-data-science-block-reference)
17. [VPython Quick Reference](#17-vpython-quick-reference)
18. [Building Your First Physics Simulation](#18-building-your-first-physics-simulation)
19. [For Educators](#19-for-educators)

---

<div class="page-break"></div>

## 1. What is Physics IDE?

**Physics IDE** is a browser-based environment for physics simulation and foundational data science. It lets you build, run, and debug physically accurate 3D simulations, analyse real datasets, and connect simulation results to data analysis — all in the browser with no installation, no accounts, and no server required.

### Three project goals

| Goal | What it does | Output panel |
|---|---|---|
| **Physics Modelling** | Build 3D physics simulations with VPython/GlowScript | 3D Viewport |
| **Data Science** | Analyse datasets with drag-and-drop blocks | Data panel (tables, charts, values) |
| **Hybrid** | Simulate and analyse in the same project; promote runs to datasets | 3D Viewport + Data panel |

### Two editing modes — every goal

Within any goal, use the **Blocks / Code** toggle to switch between:

| Mode | Best for |
|---|---|
| **Block Editor** | Visual learners; beginners; exploring concepts without writing code |
| **Code Editor** | Python learners; parameter tweaking; advanced customisation |

Both modes drive the same simulation and analysis engines. In Blocks mode the Code tab shows a live read-only mirror of the generated VPython code — ideal for students learning to connect visual programming to text.

---

## 2. Getting Started

### Step 1 — Open the IDE

Open Physics IDE in a modern browser (Chrome, Firefox, Edge, or Safari 16+). No login is required. You will see the **Start Menu**.

### Step 2 — Choose a goal and create a project

Click one of the three goal cards. A wizard will open where you:
1. Enter a project title (optional — a default is provided).
2. Choose **Blank** for an empty workspace or **Template** to start from a pre-built example.
3. Select your preferred editor (**Blocks** or **Code**).
4. Click **Create project**.

### Step 3 — Run or analyse

- **Physics project**: click **Run** (or press `Ctrl+Enter`). The 3D Viewport starts the simulation.
- **Data Science project**: the analysis runs automatically. The Data panel populates as you build your analysis — no Run press needed.

### Step 4 — Experiment

Change values, add blocks, or edit code. Physics IDE **auto-saves** every change to the browser's local storage. Your projects are listed on the Start Menu and persist across sessions.

---

## 3. The Start Menu

The Start Menu appears when Physics IDE opens and when you click the **Menu** button in the toolbar.

### Project list

Previously saved projects appear at the top. Each row shows the project title, goal badge, and last-modified time. Click a row to open the project. Click the delete button on the right to remove it.

### Create New

Three goal cards are displayed:

| Card | Description |
|---|---|
| **Physics Modelling** | VPython 3D simulations. Start blank or choose from four templates: Projectile Motion, Spring-Mass Oscillator, Sun/Earth/Moon orbit, or Simple Pendulum. |
| **Data Science** | Block-based data analysis. Start blank (with a pre-seeded analysis hat) or choose from seven templates: Penguins exploratory analysis, Weather city comparison, Planets Kepler's third law, Pendulum period investigation, Free fall measure-g, Repeated-measurement uncertainty, or Hooke's law regression. |
| **Hybrid** | Physics and data science combined. The 3D Viewport and Data panel are both active. Choose a **Hybrid topic** (Pendulum, Projectile, or Spring) that couples a simulation with its matching analysis; simulation runs can be promoted to datasets and analysed in the same project. |

### Creation wizard

After clicking a goal card, the wizard collects:
- **Project title** — free text; defaults to "Untitled [goal] project".
- **Start path** — Blank or Template. Template mode shows a list of pre-built examples for the selected goal. For **Hybrid** projects, this list is a set of **topic cards** (Pendulum, Projectile, Spring); selecting a topic loads the matching simulation and remembers its paired analysis.
- **Hybrid entry** (Hybrid only) — Model-first or Data-first. Picking a topic auto-sets this: Model-first opens the simulation ready to run; Data-first opens straight into the analysis. After you save a run, the chart offers an **"Analyse this run →"** button that loads the paired analysis with the run label already filled in.
- **Editor default** — Blocks or Code.

---

## 4. The Toolbar

The toolbar runs across the top of the screen.

### Navigation

| Button | Action |
|---|---|
| **Menu** | Return to the Start Menu |
| **Help** | Open the in-app documentation (this guide) |

### Editor mode (tabs)

| Tab | Action |
|---|---|
| **Blocks** | Show the Blockly block editor |
| **Code** | Show the Monaco code editor (read-only mirror in Blocks projects) |

### Simulation controls

| Button | Shortcut | Action |
|---|---|---|
| **Run** | `Ctrl+Enter` | Compile and run the physics simulation |
| **Stop** | — | Stop the running simulation |
| **Reset** | — | Stop and reset the workspace to its last saved state |
| **Clear** | — | Remove all blocks from the workspace (with confirmation) |

### Other controls

| Button | Action |
|---|---|
| **Debug** | Enter Debug Mode (physics projects) |
| **File** | One dropdown for both import (`.physide.json` project bundle, `.py`/`.xml` block workspace) and the seven export options — see [Section 12](#12-exporting-and-importing-work) |
| **Theme** | Toggle dark / light theme |
| **Viewport** | Show or hide the 3D Viewport panel |

Block canvas zoom is not a toolbar button — it is the on-canvas +/−/fit cluster docked bottom-right of the Block Editor pane (see [Section 5](#5-block-editor)).

---

## 5. Block Editor

The Block Editor uses **Google Blockly v11**. Blocks are organised in a toolbox on the left; the canvas is on the right.

### Using the toolbox

1. Click a category name to open its flyout panel.
2. Drag a block from the flyout onto the canvas.
3. Snap blocks together — compatible connectors glow when close.
4. Click field values (numbers, text, dropdowns, colours) inside a block to edit them.

### Goal-filtered toolbox

The toolbox categories shown depend on the project goal:

| Goal | Toolbox categories |
|---|---|
| Physics Modelling | Values, Objects, Motion, State, Control, Logic, Math, Variables + Advanced drawer |
| Data Science | Data Science, Control, Logic, Math, Variables + Advanced drawer |
| Hybrid | All categories from both Physics and Data Science |

The **Advanced drawer** at the bottom of the toolbox collapses the power-user categories — 3D Math, Raw Python, Loops, Text, Lists, and Functions. Click it to expand or collapse.

### Block search

A search bar sits above the block canvas. Type any block name, category, or keyword. Matching blocks appear in a dropdown — click a result to jump to that category in the toolbox.

### Code mirror

Switch to the **Code** tab to see the VPython code generated from your block stack. The code updates live as you build. In a Blocks project this view is read-only — it is intended for learning, not editing.

### Key interactions

| Action | How |
|---|---|
| Duplicate block | Right-click → Duplicate |
| Delete block | Right-click → Delete, or select + Delete key |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| Select all | `Ctrl+A` |
| Zoom canvas | Scroll wheel, or the +/−/fit cluster docked bottom-right of the canvas (35%–200%, persists across sessions) |

---

## 6. Data Science Analysis

Data Science and Hybrid projects auto-execute the analysis every time the block workspace changes. The Data panel updates immediately — no Run press is needed.

### Analysis structure

Every analysis begins with a `ds_start_block` hat (pre-seeded in blank DS projects). All other DS blocks chain inside its body. Blocks outside the hat are greyed and ignored.

### Workflow pattern

A typical analysis follows five steps, each represented by a group of blocks:

1. **Load** — bring in a dataset (`ds_load_builtin_block` for built-in datasets, or `ds_load_csv_block` for your own CSV).
2. **Explore** — show tables, count rows, list columns (`ds_show_table_block`, `ds_count_rows_block`, `ds_all_stats_block`).
3. **Analyse** — compute statistics, filter, sort, group, and run regressions or uncertainty (`ds_calc_mean_block`, `ds_filter_eq_block`, `ds_group_mean_block`, `ds_linear_regression_block`, `ds_multiply_columns_block`, `ds_print_uncertainty_block`).
4. **Visualise** — chart your findings (`ds_chart_bar_block`, `ds_chart_scatter_block`, `ds_chart_scatter_fit_block`, `ds_chart_histogram_block`, `ds_chart_box_block`, `ds_chart_line_block`).
5. **Communicate** — write notes, print results, state conclusions (`ds_write_note_block`, `ds_print_result_block`, `ds_state_conclusion_block`).

### Built-in datasets

| Dataset | Rows | Key columns |
|---|---|---|
| Penguins | 30 | species, island, bill_length_mm, flipper_length_mm, body_mass_g, sex |
| Weather | 28 | date, city, temp_high_c, temp_low_c, precip_mm, condition |
| Planets | 9 | name, type, period_days, distance_au, mass_earth, moons |
| Pendulum | 56 | study, length_m, mass_kg, amplitude_deg, trial, time_10swings_s, period_s |
| Spring | 8 | mass_g, force_N, extension_m |
| Free fall | 12 | time_s, velocity_y_ms, distance_m |

The Pendulum, Spring, and Free fall sets are realistic first-year lab measurements. The Pendulum set is a two-study lab (a *length* study and a *mass* study, each with repeated timed trials) and deliberately ships **no pre-computed T²** — students compute period² themselves to discover that T² ∝ length and that mass has no effect on the period.

---

## 7. Code Editor

The Code Editor uses **Monaco Editor** — the same engine as Visual Studio Code.

### Features

- Python syntax highlighting, bracket matching, and line numbers.
- Find in file: `Ctrl+F`. Toggle comment: `Ctrl+/`. Move line: `Alt+Up/Down`.
- In physics projects the editor is editable in Code and Blank projects; read-only in Blocks projects.

### VPython script structure

Every physics script must begin with the GlowScript header:

```python
GlowScript 3.2 VPython

scene.title = "My Simulation"
scene.background = vector(0.05, 0.07, 0.14)
scene.range = 12

ball = sphere(pos=vector(0, 5, 0), radius=0.5, color=color.red, make_trail=True)
ball.velocity = vector(3, 0, 0)
g  = vector(0, -9.81, 0)
dt = 0.005

while True:
    rate(200)
    ball.velocity += g * dt
    ball.pos      += ball.velocity * dt
    if ball.pos.y < ball.radius:
        ball.pos.y       = ball.radius
        ball.velocity.y *= -0.7
```

---

## 8. 3D Simulation Viewport

The right panel is the **3D Simulation Viewport** — a sandboxed iframe running GlowScript/VPython 3.2 via WebGL.

### Camera controls

| Action | Result |
|---|---|
| Left-click + drag | Orbit the camera around the scene |
| Right-click + drag | Pan the camera |
| Scroll wheel | Zoom in / out |

### Viewport visibility

Click **Viewport** in the toolbar to hide the 3D panel and give the editor more space. Click again to restore it.

---

## 9. Data Panel

The Data panel appears on the right side in Data Science and Hybrid projects. It renders the output of the DS analysis automatically after every workspace change.

### Output types

| Output | Rendered by |
|---|---|
| Data table (scrollable, max 12 visible rows) | `ds_show_table_block`, `ds_show_first_n_block`, filter/sort blocks |
| Numeric value card | `ds_calc_mean_block`, `ds_count_rows_block`, `ds_print_result_block`, etc. |
| Bar / line / scatter / histogram / box chart | `ds_chart_*_block` |
| All-stats grid | `ds_all_stats_block` |
| Text note | `ds_write_note_block` |
| Conclusion callout | `ds_state_conclusion_block` |
| Python code block | `ds_show_python_block` |

### Runner errors

If a DS block throws a runtime error (for example, referencing a column that does not exist), the status bar at the bottom shows the error message and the Data panel shows an error callout.

---

## 10. Debug Mode

Debug Mode is a full-screen overlay for step-through inspection of a running physics simulation.

### Entering Debug Mode

Click **Debug** in the toolbar. The simulation pauses and the overlay opens.

### Three-panel layout

| Panel | Contents |
|---|---|
| Left — Blocks / Code | Read-only view of the block workspace (or code editor for Code projects). Click any block to set a breakpoint. |
| Centre — 3D Viewport | Live GlowScript viewport; camera remains interactive while paused. |
| Right — Trace Table | Live variable trace with sparklines, delta, min, max, search, and pin support. |

### Controls

| Control | Shortcut | Action |
|---|---|---|
| Pause | `Space` | Pause at the current frame |
| Resume | `Space` | Continue running |
| Step | `F10` | Advance one simulation step |
| Exit Debug | `Esc` | Close Debug Mode and return to the editor |

### Breakpoints

Click any block in the left panel to toggle a breakpoint (red dot indicator). When execution reaches that block, the simulation pauses synchronously and the block is highlighted in yellow.

### Trace recording and CSV export

1. Click **Record** to begin capturing trace data.
2. Run or step through the simulation.
3. Click **Stop Rec** to end recording.
4. Click **CSV** to download the recorded data (variable, value, delta, min, max, timestamp columns).

---

## 11. Live Trace Table

The Trace Table monitors tracked variables in real time during a running simulation. Open it via the **Trace** toggle in the toolbar.

### Trace table columns

| Column | Description |
|---|---|
| Variable | Name of the tracked variable |
| Value | Current value (updates every simulation step) |
| Delta | Change since the last update |
| Min | Minimum value captured this run |
| Max | Maximum value captured this run |
| Sparkline | Mini graph of the last 60 data points |

### Tracing variables

In block projects, add a `telemetry_update_block` from the State category to emit trace data each loop iteration. Tracked variables appear in the trace table automatically.

---

## 12. Exporting and Importing Work

### File menu

Click **File** in the toolbar (a dropdown, not a separate Export/Open pair — the two were unified into one menu in Plan 2) to access both import and export options:

| Option | Output | Best for |
|---|---|---|
| Import blocks or Python (.py, .xml) | Replaces the current block workspace with an uploaded `.py` or `.xml` file | Restoring a previously exported program |
| Open project bundle (.physide.json) | Restores the complete project — goal, title, block workspace, and code | Loading a saved project bundle |
| Export as Python (.py) | `.py` file — current VPython code | Running locally; submitting code |
| Export Blocks (.xml) | `.xml` file — Blockly workspace | Sharing block programs; backup |
| Code as PDF | PDF — syntax-highlighted code | Assessment submission |
| Blocks as PDF | PDF — block canvas screenshot | Showing block structure |
| Screenshot Viewport (.png) | PNG — current 3D viewport frame | Reports; presentations |
| Copy Code to Clipboard | Clipboard — VPython source | Pasting into an LMS or external editor |
| Export Project Bundle (.physide.json) | JSON — complete project manifest | Portable save; moving between browsers or machines |

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Export as Python (.py) |
| `Ctrl+C` | Copy code to clipboard |

### Importing

Both import options live in the same **File** menu described above — there is no separate Open button:
- A `.physide.json` project bundle — restores the complete project including goal, title, block workspace, and code.
- A `.xml` Blockly workspace file (or a `.py` Python file) — replaces the current block workspace.

---

## 13. Themes and Display

Click the **theme icon** (sun / moon) in the toolbar to switch between dark and light themes. The preference persists in the browser across sessions.

- **Dark theme** (default) — VS Code-inspired deep navy with blue accents.
- **Light theme** — clean white background suitable for printed materials and bright environments.

The block canvas and the GlowScript viewport both adapt to the active theme.

---

## 14. Keyboard Shortcuts

| Context | Shortcut | Action |
|---|---|---|
| Global | `Ctrl+Enter` | Run simulation |
| Global | `Ctrl+S` | Export as Python (.py) |
| Global | `Ctrl+C` | Copy code to clipboard |
| Block canvas | `Ctrl+Z` | Undo |
| Block canvas | `Ctrl+Y` | Redo |
| Block canvas | `Delete` | Delete selected block |
| Block canvas | `Ctrl+A` | Select all blocks |
| Code editor | `Ctrl+/` | Toggle comment |
| Code editor | `Alt+Up/Down` | Move line up / down |
| Code editor | `Ctrl+F` | Find in file |
| 3D Viewport | Left drag | Orbit camera |
| 3D Viewport | Right drag | Pan camera |
| 3D Viewport | Scroll wheel | Zoom in / out |
| Debug Mode | `Space` | Pause / Resume |
| Debug Mode | `F10` | Step one simulation event |
| Debug Mode | `Esc` | Exit Debug Mode |
| Help | `Esc` | Close help |

---

## 15. Physics Block Reference

### Simulation Structure

| Block | Description |
|---|---|
| `sim_start_block` | Hat block — marks the start of a simulation; set the scene title; place all setup blocks inside its body |
| `sim_end_block` | Placed after the main loop; emits a completion message |
| `time_step_block` | Defines `dt` (seconds per step); typical: 0.001–0.01 |
| `forever_loop_block` | Main animation loop (`while True:`); always starts with `rate_block` |
| `rate_block` | Throttles to N iterations per second; prevents browser freeze |
| `for_range_block` | Loop over a numeric range (`for i in range(start, stop, step):`) |
| `if_block` / `if_else_block` | Conditional execution |
| `break_loop_block` | Exit the current loop |
| `comment_block` | Non-executing annotation |

### Objects

| Block | Object | Notes |
|---|---|---|
| `preset_sphere_block` | `sphere()` | All parameters inline; for beginners |
| `preset_box_block` | `box()` | All parameters inline; use for floors, walls |
| `sphere_block` | `sphere()` | Composable value slots for pos, radius, colour |
| `sphere_trail_block` | `sphere()` with `make_trail=True` | Trail radius, trail colour, retain point count |
| `box_block` | `box()` | Composable pos, size, colour |
| `cylinder_block` | `cylinder()` | pos, axis (direction + length), radius |
| `arrow_block` | `arrow()` | pos, axis; update axis each frame for animated vectors |
| `helix_block` | `helix()` | pos, axis, radius; update axis to animate spring |
| `label_block` | `label()` | pos, text; update `.text` each frame for HUD |
| `local_light_block` | `local_light()` | Point light source |
| `scene_camera_block` | `scene.*` | Set scene.range, scene.center, scene.background, etc. |

### Values (snap into any slot)

| Block | Output |
|---|---|
| `vector_block` | `vector(x, y, z)` with inline number fields |
| `vector_compose_block` | `vector(X, Y, Z)` with composable value slots |
| `colour_block` | Visual colour picker → `vector(r, g, b)` |
| `expr_block` | Any Python expression (free-text field) |
| `physics_const_block` | Named constant: g, G, c, h, pi, e, ke, me, mp |
| `var_read_block` | Read a Blockly variable by name |
| `get_prop_block` | Read an object property: `obj.attr` |
| `get_component_block` | Get x, y, or z component of a vector |
| `mag_block` | `mag(vec)` — magnitude (scalar) |
| `norm_block` | `norm(vec)` — unit vector |

### Motion

| Block | Code generated |
|---|---|
| `set_velocity_block` | `obj.velocity = vector(...)` |
| `update_position_block` | `obj.pos = obj.pos + obj.velocity * dt` |
| `apply_force_block` | `obj.velocity = obj.velocity + force_vec * dt` |
| `set_gravity_block` | `g = vector(0, -9.81, 0)` |
| `rotate_object_block` | `obj.rotate(angle=radians(a), axis=vec)` |

### State

| Block | Code generated |
|---|---|
| `define_const_block` | `NAME = value` |
| `set_scalar_block` | `variable = expression` |
| `set_attr_expr_block` | `obj.attr = expression` |
| `add_attr_expr_block` | `obj.attr += expression` |
| `telemetry_update_block` | `label.text = "name: " + str(round(val, dp)) + " unit"` |

### Logic

| Block | Output |
|---|---|
| `compare_block` | `A op B` — operators: `<`, `>`, `<=`, `>=`, `==`, `!=` |
| `logic_and_or_block` | `A and/or B` |
| `logic_not_block` | `not V` |

> Use these custom logic blocks rather than the standard Blockly logic blocks. The standard blocks generate Python 2 comparisons that produce incorrect results in GlowScript.

### 3D Math

| Block | Output |
|---|---|
| `cross_product_block` | `cross(A, B)` — vector perpendicular to both inputs |
| `dot_product_block` | `dot(A, B)` — scalar |
| `math_trig_block` | sin, cos, tan, asin, acos, atan, radians, degrees, sqrt, abs |
| `math_pow_block` | `base ** exp` |
| `math_min_block` / `math_max_block` | `min(a, b)` / `max(a, b)` |
| `math_clamp_block` | `max(lo, min(hi, val))` |

---

## 16. Data Science Block Reference

### Load

| Block | Action |
|---|---|
| `ds_load_builtin_block` | Load a built-in dataset (planets, penguins, weather, pendulum, spring, freefall) into a variable |
| `ds_load_csv_block` | Open a file picker; load and type-infer a CSV file |
| `ds_load_trace_block` | Load a promoted simulation trace as a dataset (Hybrid only) |

### Explore

| Block | Output |
|---|---|
| `ds_show_table_block` | Scrollable table (up to 12 rows visible) |
| `ds_show_first_n_block` | Table of the first N rows |
| `ds_show_last_n_block` | Table of the last N rows |
| `ds_show_column_block` | Table of a single column |
| `ds_count_rows_block` | Numeric value: total row count |
| `ds_count_cols_block` | Numeric value: column count |
| `ds_list_cols_block` | List of column names |
| `ds_count_unique_block` | Numeric: unique value count in a column |
| `ds_all_stats_block` | Grid: count, mean, median, min, max, range, sum, spread |

### Statistics

| Block | Computes |
|---|---|
| `ds_calc_mean_block` | Arithmetic mean |
| `ds_calc_median_block` | Median |
| `ds_calc_mode_block` | Most frequent value |
| `ds_calc_min_block` / `ds_calc_max_block` | Minimum / maximum |
| `ds_calc_range_block` | max − min |
| `ds_calc_sum_block` | Sum of all non-missing values |
| `ds_calc_count_block` | Count of non-missing values |
| `ds_calc_stddev_block` | Sample standard deviation (n − 1) |

### Filter and Sort

| Block | Action |
|---|---|
| `ds_filter_eq_block` | Keep rows where column equals a value |
| `ds_filter_gt_block` | Keep rows where column exceeds a threshold |
| `ds_filter_lt_block` | Keep rows where column is below a threshold |
| `ds_filter_and_block` | Two-condition AND filter |
| `ds_filter_or_block` | Two-condition OR filter |
| `ds_sort_asc_block` | Sort ascending by a column |
| `ds_sort_desc_block` | Sort descending by a column |
| `ds_remove_missing_block` | Drop rows where a column is null or empty |
| `ds_find_missing_block` | Keep only rows where a column is null or empty |

### Group and Compare

| Block | Output |
|---|---|
| `ds_group_count_block` | Table: row count per unique group value |
| `ds_group_mean_block` | Table: mean of value column per group; result column is named `mean_<valueCol>` |

### Analyse (regression and uncertainty)

| Block | Output |
|---|---|
| `ds_linear_regression_block` | Fit `y = m·x + c`; regression card with slope, intercept, and R² (the slope is usually the physical quantity: g, k, −γ) |
| `ds_multiply_columns_block` | New column = product of two columns (e.g. `T² = period × period`) |
| `ds_add_column_transform_block` | New column from a transform of another (square, sqrt, ln, t², …) |
| `ds_print_uncertainty_block` | Column mean ± standard error card |
| `ds_calc_relative_uncertainty_block` | Relative uncertainty (standard error ÷ mean) as a % |

### Charts

| Block | Chart type |
|---|---|
| `ds_chart_bar_block` | Bar chart — x: categorical, y: numeric |
| `ds_chart_line_block` | Line chart — x col, y col |
| `ds_chart_scatter_block` | Scatter plot — x col, y col |
| `ds_chart_scatter_fit_block` | Scatter plot with regression line — x col, y col, fit variable |
| `ds_chart_histogram_block` | Histogram — single numeric column |
| `ds_chart_box_block` | Box plot — value col, optional group col |

### Communicate

| Block | Output |
|---|---|
| `ds_write_note_block` | Free-text note card |
| `ds_print_result_block` | Named value display card |
| `ds_compare_results_block` | Side-by-side named value comparison |
| `ds_state_conclusion_block` | Styled conclusion callout |
| `ds_export_table_block` | Download dataset as CSV |
| `ds_show_python_block` | Reveal generated Python/pandas code |

---

## 17. VPython Quick Reference

### Creating objects

```python
# Sphere with motion trail
ball = sphere(pos=vector(0, 5, 0), radius=0.5, color=color.red,
              make_trail=True, trail_radius=0.05, retain=300)

# Box / floor
floor = box(pos=vector(0, -0.5, 0), size=vector(20, 1, 8), color=color.green)

# Cylinder (used as a rod)
rod = cylinder(pos=vector(0, 0, 0), axis=vector(0, 5, 0), radius=0.15, color=color.white)

# Arrow (update axis each frame to show velocity)
v_arrow = arrow(pos=ball.pos, axis=ball.velocity * 0.2, shaftwidth=0.12)

# Helix (spring — update axis to animate stretch)
spring = helix(pos=vector(-4, 0, 0), axis=vector(8, 0, 0), radius=0.4, coils=14)

# On-screen label
hud = label(pos=vector(0, 9, 0), text="", height=13, box=False, opacity=0, color=color.white)
```

> `make_trail=True` and `emissive=True` must be set in the constructor call. Setting them after creation causes a runtime error in GlowScript 3.2.

### Euler integration (Newton's second law)

```python
# Pattern: update velocity, then position, each time step
F_net = mass * g - drag_coeff * ball.velocity
ball.velocity += (F_net / mass) * dt
ball.pos      += ball.velocity * dt
```

### Vectors and maths

```python
v = vector(1, 2, 3)     # create vector
mag(v)                  # magnitude (scalar)
norm(v)                 # unit vector
dot(v1, v2)             # dot product (scalar)
cross(v1, v2)           # cross product (vector)

sin(x); cos(x); tan(x)        # trig (radians)
asin(x); acos(x); atan(x)     # inverse trig
radians(deg)                  # convert degrees → radians
sqrt(x); abs(x); pi; e        # common maths
```

### Scene configuration

```python
scene.title      = "Title string"
scene.background = vector(r, g, b)   # 0–1 range
scene.range      = 10                # camera half-width
scene.center     = vector(x, y, z)   # look-at point
scene.ambient    = color.gray(0.3)   # ambient light level
```

---

## 18. Building Your First Physics Simulation

### Goal: a ball dropped from height that bounces on a floor

#### Step 1 — Create a Physics Modelling project

From the Start Menu, click **Physics Modelling** and then **Create project** (leave the start path as Blank and editor as Blocks).

#### Step 2 — Add a Simulation Start block

From the **Control** toolbox category, drag a `sim_start_block` onto the canvas. Enter `"Bouncing Ball"` as the title.

#### Step 3 — Create the floor

From **Objects**, drag a `preset_box_block` inside the sim_start body. Set:
- NAME: `floor`
- Position Y: `-1`
- Width: `20`, Height: `1`, Depth: `8`
- Colour: green.

#### Step 4 — Create the ball

From **Objects**, drag a `preset_sphere_block`. Set:
- NAME: `ball`
- Position Y: `8`
- Radius: `0.5`
- Colour: red.

#### Step 5 — Set time step and gravity

From **Control**, drag a `time_step_block`. Leave `dt = 0.01`.  
From **Motion**, drag a `set_gravity_block`. It defaults to `vector(0, -9.81, 0)`.

#### Step 6 — Add the main loop

From **Control**, drag a `forever_loop_block`. Inside it:

1. `rate_block` — set to `200`.
2. `update_position_block` — set object to `ball`, time step `dt`.

#### Step 7 — Add bounce logic

From **Control**, drag an `if_block` inside the loop (after the position update). For the condition, drag a `compare_block` from **Logic**: set left side to `ball.pos.y` (use `get_component_block` inside `get_prop_block`), operator `<`, right side to the radius value `0.5`.

Inside the if-body:
1. `set_attr_expr_block` — `ball.pos.y = 0.5`
2. `add_attr_expr_block` — `ball.velocity.y *= -0.7`

#### Step 8 — Run

Click **Run**. The ball falls, bounces, and comes to rest. Switch to the **Code** tab to see the VPython generated from your block stack.

**Experiments:**
- Change the bounce coefficient from `0.7` to `1.0` (elastic) or `0.3` (heavy damping).
- Add an initial horizontal velocity with `set_velocity_block`.
- Use `set_gravity_block` with a weaker gravity (e.g. `vector(0, -1.62, 0)` for lunar gravity).

---

## 19. For Educators

### Classroom use

Physics IDE is designed for use in:
- **Introductory physics labs** — students verify equations by running and modifying simulations.
- **Data literacy courses** — students explore real datasets using DS blocks without writing any code.
- **Computational physics courses** — scaffold from visual blocks to writing VPython.
- **Hybrid assignments** — students run a simulation, save the trace, and analyse the data.

### Suggested lesson progression — Physics

| Week | Activity | Goal |
|---|---|---|
| 1–2 | Open Projectile Motion template; run it; identify each block; change angle and speed | Explore blocks |
| 3–4 | Build the bouncing ball simulation from scratch in Blocks mode | Build from blocks |
| 5–6 | Switch to Code view; modify drag coefficient; compare ranges analytically | Blocks → code transition |
| 7–8 | Blank Code project; write a spring or pendulum from scratch | Full code authoring |

### Suggested lesson progression — Data Science

| Week | Activity | Goal |
|---|---|---|
| 1 | Open Penguins template; identify each block; ask: which species is heaviest? | Explore DS blocks |
| 2 | Open Weather template; modify the filter; chart temperature trends | Filter and chart |
| 3 | Blank DS project; load Planets; sort by distance; scatter chart; state conclusion | Full DS workflow |
| 4 | Open "Pendulum: what controls the period?"; compute T², regress T² vs length; check mass independence | Linearisation and regression |
| 5 | Open "Uncertainty: repeated measurements"; report period mean ± standard error; discuss precision | Measurement uncertainty |
| 6 | Create a Hybrid project; pick the **Projectile: measure g** topic; run, save a run cropped before the bounce; click "Analyse this run →"; regress vy vs t and compare the slope to g | Simulation → coupled analysis |

### Setting up a template assignment

1. Build or open a simulation with specific parameters intentionally left incomplete.
2. Click **Export Project Bundle (.physide.json)** to download the bundle.
3. Distribute the `.physide.json` to students.
4. Students click **Open...** in the toolbar to load the workspace.

### Assessing student work

Students can submit:
- **Export as Python (.py)** — VPython source code.
- **Blocks as PDF** — block structure screenshot.
- **Code as PDF** — syntax-highlighted source.
- **CSV** (from Debug Mode → Record → CSV) — recorded variable data over time.
- **Export Project Bundle (.physide.json)** — the complete project, reloadable for inspection.

### Deploying to students

Physics IDE is a static React application with no backend, no accounts, and no data uploaded. The production build can be served from Vercel, Cloudflare Pages, Netlify, GitHub Pages, or any school web server. Students access it via URL — no installation or sign-in required.

Students can continue working offline after the first load. The GlowScript runtime is cached by the browser.

See `DEPLOY.md` in the project root for full deployment instructions and CI smoke-test steps.

### iKamva (Sakai) integration

Physics IDE can be embedded in an iKamva course site using the **Web Content** tool. Add the Physics IDE URL as a new Web Content item — students see the IDE inside iKamva without leaving the LMS. See the **Technical Architecture** document for full configuration details including POPIA compliance notes.

---

*Physics IDE User Guide — Version 1.0 — June 2026*
