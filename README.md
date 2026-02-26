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

### Mode toggle for templates

Template projects now let you **toggle** between both representations using the
Blocks / Code buttons in the toolbar:

- **Blocks templates** - Blocks = editable Block Editor; Code = read-only generated code
- **Code templates** - Code = editable Code Editor; Blocks = read-only block reference

Both buttons are always clickable - the secondary view is simply read-only.

### Composable Scratch-style blocks

All object, motion, and variable blocks now use **input_value slots** (puzzle-piece connectors)
instead of inline text fields. Small **value blocks** snap into these slots:

- `vector_block` — `vector(x, y, z)` value
- `colour_block` — visual colour picker → `vector(r, g, b)`
- `expr_block` — any freeform Python expression

Additional semantic blocks:
- `if_else_block` — if / else with separate block sockets
- `break_loop_block` — emits `break`
- `telemetry_update_block` — formatted label update

Shadow blocks provide sensible defaults in every slot.

### Native Blockly variable workflow

Custom Physics blocks now use native Blockly variable fields (`field_variable`) for
object names, loop variables, and state labels.

- Rename variables once and all references update automatically
- Use `Variables -> get` blocks inside value sockets (`dt`, `anchor`, `h_above`, etc.)
- Use Physics `set_scalar_block` for equation-style assignment and Blockly `variables_set`
  for generic assignment patterns

### String-escaping fix (`escPy` helper)

All block generators that emit user-supplied strings now escape backslashes, quotes, and newlines
to prevent "End of line while scanning string literal" runtime errors.

### Block templates fully rebuilt

- `blocks_projectile` - uses `break_loop_block` for stop condition, `if_else_block` for bounce logic
- `blocks_spring` (**new**) - complete spring-mass oscillator in pure blocks
- `blocks_orbits` - uses `sphere_emissive_block` / `expr_block` for dynamic objects

All three templates are 100% semantic blocks - no `python_raw_block` anywhere.

### Previous updates

- `set_attr_expr_block` / `add_attr_expr_block` - one-line attribute set/increment
- Template animation reliability improvements
- Orbit code-template softened gravity (prevents singularity freezes)
- Viewport text readability fix (theme-aware iframe text colour)
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

## Block Templates (`src/utils/blockTemplates.js`)

- `blocks_projectile` — animated projectile with drag model and telemetry
- `blocks_spring` — damped spring-mass oscillator with KE/PE telemetry
- `blocks_orbits` — animated orbital system with softened gravity and telemetry

### Template design rules

- Prefer custom blocks where possible
- Use raw Python blocks only for logic not yet represented by custom blocks
- Add comment blocks before raw sections to explain intent

---

## Custom Blocks Reference

Defined in `src/utils/blocklyGenerator.js` and exposed via toolbox in `src/components/BlocklyWorkspace.js`.

Toolbox structure:

- `Values` — composable value outputs (`vector_block`, `colour_block`, `expr_block`)
- `Objects` — constructor-style object blocks
- `Motion` — velocity/position/acceleration updates
- `State` — assignment and attribute update blocks
- `Control`, `Scene`, `Advanced`
- Standard Blockly `Variables` category (native variables/get/set)

## Scene/Object Blocks

- `scene_setup_block`
- `scene_range_block`
- `scene_forward_block`
- `scene_center_block`
- `scene_caption_block`
- `scene_ambient_block`
- `local_light_block`
- `sphere_block`
- `sphere_trail_block`
- `sphere_emissive_block`
- `box_block`
- `box_opacity_block`
- `cylinder_block`
- `arrow_block`
- `helix_block`
- `helix_full_block`
- `label_block`
- `label_full_block`

## Motion/Control Blocks

- `set_velocity_block`
- `update_position_block`
- `apply_force_block`
- `set_gravity_block`
- `time_step_block`
- `rate_block`
- `forever_loop_block`
- `for_range_block`
- `if_block`
- `if_else_block` (**new** — if/else with two block sockets)
- `break_loop_block` (**new** — emits `break`)

## Value Blocks (snap-in)

- `vector_block` — `vector(x, y, z)`
- `colour_block` — colour picker → `vector(r, g, b)`
- `expr_block` — freeform Python expression

## State Blocks

- `set_scalar_block`
- `set_attr_expr_block`
- `add_attr_expr_block`

## Utility/Expression Blocks

- `comment_block`
- `telemetry_update_block` (**new** — formatted label text update)
- `python_raw_block`
- `python_raw_expr_block`

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

The viewport is fully interactive:

- Left drag: orbit/rotate camera
- Right drag: pan camera
- Scroll wheel: zoom in/out

Scene setup blocks also explicitly enable interactive camera controls in generated code:

```python
scene.userspin = True
scene.userzoom = True
scene.userpan = True
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
