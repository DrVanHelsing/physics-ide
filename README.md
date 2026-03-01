# Physics IDE

Physics IDE is a dual-editor VPython environment with:

- **Blockly-based physics modeling** (visual blocks)
- **Code-based VPython editing** (GlowScript 3.2 VPython)
- **Live 3D viewport** in an isolated runtime iframe
- **Template workflows** for fast starts

It is designed for teaching and experimentation: beginners can build simulations with blocks, and advanced users can inspect/edit VPython directly.

---

## Table of Contents

1. [What’s New](#whats-new)
2. [Install & Run](#install--run)
3. [How the IDE Works](#how-the-ide-works)
4. [Project Types and Modes](#project-types-and-modes)
5. [Templates](#templates)
6. [Custom Blocks Reference](#custom-blocks-reference)
7. [Using the Raw Python Block Safely](#using-the-raw-python-block-safely)
8. [Animation Logic Patterns](#animation-logic-patterns)
9. [Viewport Text Readability (Dark/Light)](#viewport-text-readability-darklight)
10. [3D Viewport Camera Controls](#3d-viewport-camera-controls)
11. [Export Features](#export-features)
12. [Troubleshooting](#troubleshooting)
13. [Code Structure](#code-structure)

---

## What's New

### Composable logic & variable blocks

Four new fully composable blocks eliminate the need for `expr_block` in boolean conditions:

- `var_read_block` — reads a Blockly variable by name; snaps into any value slot
- `compare_block` — `A < B`, `A > B`, `A == B`, etc.; outputs a **Boolean** value
- `logic_and_or_block` — `A and/or B`; outputs a **Boolean** value
- `logic_not_block` — `not V`; outputs a **Boolean** value

These replace the standard Blockly `logic_compare`, `logic_operation`, `logic_negate` blocks which generate wrong Python for VPython (they use Python correctly, but these custom versions are category-consistent and composable).

### VPython-correct math block (`math_trig_block`)

A single block covers all scalar math functions that VPython/GlowScript exposes at the global scope:

`sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `radians`, `degrees`, `sqrt`, `abs`

**Important:** `abs` is absolute value `|x|`. Standard Blockly `math_single` (`abs`) generates `math.fabs()` which is **wrong for VPython** — `math_trig_block` generates `abs(x)` correctly.

### New math utility blocks

- `math_min_block` — `min(a, b)` — in: **3D Math**
- `math_max_block` — `max(a, b)` — in: **3D Math**
- `math_pow_block` — `a ** b` — in: **3D Math**
- `math_clamp_block` — `max(lo, min(hi, val))` — in: **3D Math**

### Vector compose block (`vector_compose_block`)

Composable `vector(X, Y, Z)` with three value slots (replaces the inline `vector_block` where sub-expressions are needed).

Located in: **3D Math** (removed from Values to avoid duplication with `vector_block`).

### Toolbox reorganisation

- **`rotate_object_block`** moved from 3D Math → **Motion** (it mutates an object, not a pure math op)
- **`scene_camera_block`** moved from 3D Math → **Objects** (it configures the scene/camera)
- **`mag_block`** and **`norm_block`** now also appear in **3D Math** (alongside Values)
- Removed duplicate standard Blockly blocks that generate wrong VPython code:
  - `logic_compare`, `logic_operation`, `logic_negate` (replaced by custom logic blocks)
  - `math_single`, `math_trig`, `math_constrain` (replaced by `math_trig_block` / `math_clamp_block`)

### Mode toggle for templates

Template projects let you **toggle** between both representations using the Blocks / Code buttons:

- **Blocks templates** — Blocks = editable; Code = read-only generated code
- **Code templates** — Code = editable; Blocks = read-only block reference

### Composable Scratch-style blocks

All object, motion, and variable blocks use **input_value slots** (puzzle-piece connectors) instead of inline text fields. Shadow blocks provide sensible defaults in every slot.

### Native Blockly variable workflow

Custom Physics blocks use native Blockly variable fields (`field_variable`) for object names, loop variables, and state labels — rename once, all references update automatically.

### Block templates fully rebuilt

- `blocks_projectile` — animated projectile with drag model and telemetry
- `blocks_spring` — damped spring-mass oscillator with KE/PE telemetry
- `blocks_orbits` — animated orbital system with softened gravity and telemetry
- `blocks_pendulum` — nonlinear pendulum, symplectic Euler, full energy telemetry

All four use `python_raw_block` only where needed; all physics logic uses semantic custom blocks. The pendulum Blocks template uses zero raw blocks.

---

## Install & Run

### Requirements

- Node.js 18+ recommended
- npm 9+

### Commands

```bash
npm install
npm start
```

Production build:

```bash
npm run build
```

---

## How the IDE Works

### Runtime model

Each simulation run is executed inside a **fresh iframe** (`src/utils/glowRunner.js`).

Why this matters:

- Prevents old globals from contaminating new runs
- Makes stop/reset deterministic
- Isolates compiler/runtime state per execution

### Compile pipeline

- Input code is normalized and prefixed with `GlowScript 3.2 VPython` if missing
- GlowScript compiler (`RScompiler`) is loaded in the iframe
- Compiled JS is executed and `__main__()` is invoked

---

## Project Types and Modes

## 1) Blank Project (`custom`)

- Default mode: Blocks
- Toggle options: **Blocks** and **Code View Only**
- Code view is generated from blocks and read-only

## 2) Code Template (`code_template`)

- Opens in code mode
- Blocks mode is shown but locked (greyed out)

## 3) Block Template (`block_template`)

- Opens in blocks mode
- Code mode is shown but locked (greyed out)

---

## Templates

## Code Templates (`src/utils/precodedExamples.js`)

- `projectile` — drag + telemetry + lighting
- `spring` — damped oscillator + energy telemetry
- `orbits` — star/planet/moon gravity + telemetry
- `pendulum` — nonlinear damped pendulum with KE/PE/E_total telemetry

## Block Templates (`src/utils/blockTemplates.js`)

- `blocks_projectile` — animated projectile with drag model and telemetry
- `blocks_spring` — damped spring-mass oscillator with KE/PE telemetry
- `blocks_orbits` — animated orbital system with softened gravity and telemetry
- `blocks_pendulum` — nonlinear pendulum with symplectic Euler integration and energy telemetry

### Template design rules

- Prefer custom blocks where possible
- Use raw Python blocks only for logic not yet represented by custom blocks
- Add comment blocks before raw sections to explain intent

---

### 4 · Simple Pendulum (new)

**Physics:** Full nonlinear ODE — no small-angle approximation.

| Parameter | Value | Description |
|---|---|---|
| `L` | 2.0 m | Pendulum length (pivot to bob centre) |
| `m` | 1.0 kg | Bob mass |
| `b` | 0.10 Ns/rad | Linear damping coefficient |
| `θ₀` | 30° = π/6 rad | Initial angle from vertical |
| `ω₀` | 0 rad/s | Initial angular velocity (released from rest) |
| `dt` | 0.005 s | Integration time step |

**Governing equations:**

```
α = −(g/L)·sin(θ) − b·ω       # angular acceleration (nonlinear damped ODE)

# Symplectic (semi-implicit) Euler integration:
ω(t+dt) = ω(t) + α·dt          # update angular velocity first
θ(t+dt) = θ(t) + ω(t+dt)·dt    # then angle (uses updated ω)

# Bob Cartesian coordinates:
bob_x = L·sin(θ)
bob_y = −L·cos(θ)

# Mechanical energy:
KE      = ½ m L² ω²
PE      = m g L (1 − cos θ)     # zero at bottom of swing
E_total = KE + PE               # slowly decays with damping
```

**Period (small-angle, undamped):** T = 2π√(L/g) ≈ 2.84 s for L = 2.0 m

**Why symplectic Euler?**  
Standard Euler (update θ before ω) introduces energy gain — the bob drifts outward over time even with b=0. Symplectic Euler (ω updated first) preserves the Hamiltonian structure, keeping E_total stable across thousands of oscillations.

**Key features of the simulation:**

- Rod cylinder `axis` and bob sphere `pos` are recomputed from θ every frame
- 200-point golden trail traces the arc of oscillation  
- Live telemetry: t, θ (rad), ω (rad/s), KE, PE, E_total

**Blocks template note:** `blocks_pendulum` uses zero `python_raw_block` blocks. The angular acceleration formula is built entirely from `math_trig_block` (sin, cos, radians), `math_pow_block`, `vector_compose_block`, and nested `math_arithmetic` blocks.

---

## Custom Blocks Reference

Defined in `src/utils/blocklyGenerator.js`, exposed via toolbox in `src/components/BlocklyWorkspace.js`.

### Toolbox categories

| Category | Contents |
|---|---|
| **Values** | `vector_block`, `colour_block`, `var_read_block`, `expr_block`, `physics_const_block`, `define_const_block`, `get_prop_block`, `get_component_block`, `mag_block`, `norm_block` |
| **Objects** | Sphere, box, cylinder, arrow, helix, label, local light constructors; `scene_camera_block` |
| **Motion** | Velocity / position / acceleration / gravity updates; `rotate_object_block` |
| **State** | Assignment, attribute update, telemetry display blocks |
| **Control** | Loops, conditionals, `rate`, `time_step`, `break_loop_block`, `comment_block` |
| **Advanced** | Raw Python code / expression blocks |
| **Logic** | `compare_block`, `logic_and_or_block`, `logic_not_block`, `logic_boolean`, `logic_null`, `logic_ternary` |
| **Loops** | Standard Blockly `controls_repeat_ext`, `controls_for`, etc. |
| **Math** | `math_number`, `math_arithmetic`, `math_constant`, `math_number_property`, `math_round`, `math_on_list`, `math_modulo`, `math_random_int`, `math_random_float` |
| **3D Math** | `vector_compose_block`, `cross_product_block`, `dot_product_block`, `mag_block`, `norm_block`, `math_min_block`, `math_max_block`, `math_clamp_block`, `math_pow_block`, `math_trig_block` |
| **Text / Lists / Variables / Functions** | Standard Blockly categories |

---

### Value blocks (snap into any □ slot)

| Block | Output | Notes |
|---|---|---|
| `vector_block` | `vector(x,y,z)` | Inline x/y/z fields |
| `vector_compose_block` | `vector(X,Y,Z)` | Three composable value slots — snap in math blocks |
| `colour_block` | `vector(r,g,b)` | Visual colour picker |
| `expr_block` | _any Python expression_ | Freeform fallback |
| `physics_const_block` | constant value | `g`, `G`, `c`, `h`, `pi` |
| `var_read_block` | variable value | Reads a Blockly variable by name |
| `get_prop_block` | `obj.attr` | e.g. `ball.pos` |
| `get_component_block` | `vec.x / .y / .z` | Scalar component |
| `mag_block` | `mag(vec)` | Magnitude |
| `norm_block` | `norm(vec)` | Unit vector |

---

### Logic / comparison blocks (output: Boolean)

| Block | Output | Notes |
|---|---|---|
| `compare_block` | `A op B` | Operators: `<`, `>`, `<=`, `>=`, `==`, `!=` |
| `logic_and_or_block` | `A and/or B` | Dropdown: `and` / `or` |
| `logic_not_block` | `not V` | Flips boolean |
| `logic_boolean` | `True` / `False` | Standard Blockly |

> Standard `logic_compare`, `logic_operation`, `logic_negate` are **hidden** — they generate Python correctly but are duplicated by the custom blocks above, which are composable and category-consistent. Use the custom blocks.

---

### 3D Math blocks

| Block | Output |
|---|---|
| `cross_product_block` | `cross(A, B)` |
| `dot_product_block` | `dot(A, B)` |
| `math_min_block` | `min(a, b)` |
| `math_max_block` | `max(a, b)` |
| `math_pow_block` | `base ** exp` |
| `math_clamp_block` | `max(lo, min(hi, val))` |
| `math_trig_block` | `sin/cos/tan/asin/acos/atan/radians/degrees/sqrt/abs` |

**`math_trig_block` function list:**

| Function | Description | Angle convention |
|---|---|---|
| `sin`, `cos`, `tan` | Trig | **radians** |
| `asin`, `acos`, `atan` | Inverse trig | returns radians |
| `radians(deg)` | Degrees → radians | — |
| `degrees(rad)` | Radians → degrees | — |
| `sqrt(x)` | Square root | — |
| `abs(x)` | Absolute value `\|x\|` | — |

> All these functions are **VPython global scope** — do **not** use `math.sin()`, `math.fabs()`, etc. Those don't exist inside GlowScript. The standard Blockly `math_trig` and `math_single` blocks are hidden from the toolbox because they generate `math.sin()` / `math.fabs()` which will fail.

---

### Object blocks

All constructors are single-line (`inputsInline: true`) with value slots:

| Block | Statement |
|---|---|
| `sphere_block` | `name = sphere(pos=□, radius=□, color=□)` |
| `sphere_trail_block` | sphere with `make_trail`, `trail_radius`, `retain` |
| `box_block` | `name = box(pos=□, size=□, color=□)` |
| `cylinder_block` | `name = cylinder(pos=□, axis=□, radius=□, color=□)` |
| `arrow_block` | `name = arrow(pos=□, axis=□, color=□)` |
| `helix_block` | `name = helix(pos=□, axis=□, radius=□, color=□)` |
| `label_block` | `name = label(pos=□, text=…)` |
| `label_full_block` | label with `height`, `font` |
| `local_light_block` | `local_light(pos=□, color=□)` |
| `scene_camera_block` | `scene.ATTR = □` — camera/scene setup |

> Preset variants (`preset_sphere_block`, `preset_box_block`) use inline fields for quick creation. Additional variants (`sphere_emissive_block`, `box_opacity_block`, `helix_full_block`) are available for template use.

---

### Motion blocks

| Block | Statement |
|---|---|
| `set_velocity_block` | `obj.velocity = □` |
| `update_position_block` | `obj.pos += obj.velocity * □` |
| `apply_force_block` | `obj.velocity += □ * □` |
| `set_gravity_block` | `g = vector(0, −9.81, 0)` |
| `rotate_object_block` | `obj.rotate(angle=□, axis=□)` |

---

### Control blocks

| Block | Statement |
|---|---|
| `time_step_block` | `dt = 0.01` |
| `rate_block` | `rate(N)` |
| `forever_loop_block` | `while True:` |
| `for_range_block` | `for i in range(…):` |
| `if_block` | `if □:` — boolean slot |
| `if_else_block` | `if □: … else:` |
| `break_loop_block` | `break` |
| `comment_block` | `# comment` |

---

### State blocks

| Block | Statement |
|---|---|
| `define_const_block` | `NAME = □` |
| `set_colour_var_block` | `obj.color = □` |
| `set_scalar_block` | `obj.attr = □` |
| `set_attr_expr_block` | `obj.attr = □` — expr slot |
| `add_attr_expr_block` | `obj.attr += □` |
| `telemetry_update_block` | `label.text = "…: " + str(□)` |

---

### Advanced / utility blocks

| Block | Output |
|---|---|
| `python_raw_block` | Single raw Python statement |
| `python_raw_expr_block` | Inline raw Python expression |
| `comment_block` | `# text` |

---

> **Scene setup tip:** Use `python_raw_block` for scene/camera config not yet in the custom blocks:
> ```python
> scene.title = "My Simulation"
> scene.background = vector(0.05, 0.05, 0.1)
> scene.range = 10
> ```

---

## Using the Raw Python Block Safely

`python_raw_block` inserts exactly one Python statement line (or compact one-liner).

Use it for:

- Compact formulas difficult to represent as blocks
- Conditionals or inline expressions where block equivalents are missing
- Temporary advanced logic while prototyping

Avoid using it for:

- Large multi-line programs in one raw block
- Entire simulation loop bodies (unless absolutely necessary)

### Good raw-block examples

```python
speed = mag(ball.velocity)
```

```python
a_planet = -G * M_star / d_ps**2 * norm(r_ps)
```

### Better block-first replacement example

Instead of raw:

```python
ball.velocity = ball.velocity + acceleration * dt
```

Use:

- `add_attr_expr_block`
  - expr = `acceleration * dt`
  - obj = `ball`
  - attr = `velocity`

---

## Animation Logic Patterns

Use this pattern for stable, visible animation:

1. Define `dt`
2. Use `forever_loop_block`
3. Start each loop with `rate(...)`
4. Compute forces/accelerations
5. Update velocity
6. Update positions
7. Update visuals/telemetry
8. Increment time variable

### Minimal loop snippet (concept)

```python
while True:
  rate(240)
  acceleration = g
  ball.velocity = ball.velocity + acceleration * dt
  ball.pos = ball.pos + ball.velocity * dt
  t = t + dt
```

---

## Viewport Text Readability (Dark/Light)

The runtime iframe now applies theme-aware text color:

- Dark theme: light viewport text
- Light theme: dark viewport text

This affects scene title/caption text generated by GlowScript HTML in the iframe.

Implementation is in `src/utils/glowRunner.js`.

## 3D Viewport Camera Controls

The 3D viewport always has interactive camera controls:

- Left drag: orbit/rotate camera
- Right drag: pan camera
- Scroll wheel: zoom in/out

GlowScript enables orbit, zoom, and pan by default. To configure scene title, background, or range, use `python_raw_block` at the top of your program:

```python
scene.title = "My Simulation"
scene.background = vector(0.05, 0.05, 0.1)
scene.range = 10
```

---

## Export Features

Toolbar supports:

- Export `.py`
- Export blocks `.xml`
- Export Blocks PDF
- Export Code PDF

PDF features include:

- Block workspace snapshot
- Syntax-highlighted code PDF

---

## Troubleshooting

## 1) Block template looks static

- Ensure loop contains `rate(...)`
- Ensure velocity and position update blocks are connected inside loop body
- Check any raw gravity/drag statements are still connected in sequence

## 2) Orbit freezes/stalls

- Use softened distances (`max(mag(r), minRadius)`) to avoid singularities
- Avoid immediate collision breaks unless intended

## 3) Caption/title text unreadable

- Confirm app theme is set correctly
- Re-run simulation (iframe theme styles are re-applied at run time)
- Ensure `scene.title` is set via `python_raw_block` at the top of the program

## 4) Stop button does nothing

- Stop clears runtime iframe; if a simulation appears persistent, press Run once then Stop again to force re-init and teardown

---

## Code Structure

- `src/App.js` — app orchestration, mode + run state, template selection
- `src/components/StartMenu.js` — template cards/filtering
- `src/components/ModeToggle.js` — mode switching and lock states
- `src/components/Toolbar.js` — run/stop/export/reset/theme controls
- `src/components/BlocklyWorkspace.js` — Blockly inject/toolbox/workspace events
- `src/components/GlowCanvas.js` — viewport host element
- `src/utils/blocklyGenerator.js` — block definitions + Python generators
- `src/utils/blockTemplates.js` — block template XML
- `src/utils/precodedExamples.js` — code template strings
- `src/utils/glowRunner.js` — iframe runtime load/compile/execute/stop

---

## Future ideas

- Custom block for gravitational acceleration between two named bodies
- Validation warnings when raw blocks contain multiple semicolon statements
- Template self-check command that validates generated code for loop/update presence
- Import `.xml` button on Start Menu for restoring saved block workspaces
