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
10. [Export Features](#export-features)
11. [Troubleshooting](#troubleshooting)
12. [Code Structure](#code-structure)

---

## What’s New

### New one-line custom blocks (for cleaner block templates)

- `set_attr_expr_block` → `set object.attribute = expression`
- `add_attr_expr_block` → `add expression to object.attribute`

These blocks remove a lot of raw-code boilerplate and make templates more editable in pure blocks.

### Block templates are rebuilt for animation reliability

- `blocks_projectile`
- `blocks_orbits`

Both templates now contain clean loop chains and animate correctly.

### Blank project “Code View Only” behavior

In **Blank Project**:

- Switching to **Code View Only** shows a full single code pane
- It is **read-only generated code**
- It does **not split/consume space** from the block editor area

### Orbit code-template freeze fix

The `orbits` code template uses softened gravitational distances to prevent singularities/division spikes that can stall or destabilize animation.

### Viewport text readability fix

GlowScript iframe text color now adapts to theme so captions/title text are readable in both dark and light modes.

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
- `sphere_expr_block` (**new** — expression-based pos, trail, emissive)
- `box_block`
- `box_opacity_block`
- `cylinder_block`
- `cylinder_expr_block` (**new** — expression-based pos/axis/radius)
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

## Utility/Expression Blocks

- `comment_block`
- `set_scalar_block`
- `set_vector_expr_block`
- `set_attr_expr_block`
- `add_attr_expr_block`
- `telemetry_update_block` (**new** — formatted label text update)
- `python_raw_block`
- `python_raw_expr_block`
- `exec_block`

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
