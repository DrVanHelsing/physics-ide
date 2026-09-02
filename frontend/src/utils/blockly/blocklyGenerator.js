/**
 * blocklyGenerator.js — Composable VPython Block System
 *
 * Scratch-inspired design: small VALUE blocks (vector, colour, expression)
 * snap into INPUT SLOTS on larger OBJECT / MOTION / VARIABLE blocks.
 *
 * Categories:
 *   Values    – vector, colour picker, expression  (output connectors)
 *   Objects   – sphere, box, cylinder, arrow, helix, label, local light
 *   Motion    – velocity, position update, acceleration, gravity
 *   State     – set var, set property, increment property, telemetry display
 *   Control   – forever loop, for range, if, if-else, rate, time step, comment
 *   Advanced  – raw Python code/expression
 *
 * Label voice (one rule, Tranche 3):
 *   message0 is NATURAL LANGUAGE — "length of %1", not "mag( %1 )". The
 *   Python form belongs on the first line of the tooltip, where a student
 *   who wants to read the generated code can find it. Twelve blocks were
 *   converted; a new block that names a Python function on its face is a
 *   review comment.
 */

import Blockly from './blocklyLib';
import { traceRegistry, clearTraceRegistry } from './traceRegistry';
import { BLOCK_CATALOGUE as REGISTRY_BLOCK_CATALOGUE } from './blockRegistry';

// Re-export the canonical search index built from the block registry
// (Phase B.6). Consumers (BlocklyWorkspace search bar, etc.) keep their
// import sites unchanged.
export const BLOCK_CATALOGUE = REGISTRY_BLOCK_CATALOGUE;

let initialized = false;

/* ── Custom constants registry (shared: push here to add to dropdown) ── */
export const customConstantsRegistry = [];

/* ── Trace registry re-exported for consumers that import from this module ── */
export { traceRegistry, clearTraceRegistry };

function getPythonGen(Blockly) {
  return Blockly.Python || null;
}

/* ── Colour helpers ─────────────────────────────────────── */
function namedColorToVPython(mode) {
  const map = {
    RED:     "color.red",
    ORANGE:  "color.orange",
    YELLOW:  "color.yellow",
    GREEN:   "color.green",
    BLUE:    "color.blue",
    CYAN:    "color.cyan",
    MAGENTA: "color.magenta",
    PURPLE:  "vector(0.58, 0.1, 0.82)",
    WHITE:   "color.white",
    BLACK:   "vector(0.05, 0.05, 0.05)",
    GRAY:    "color.gray(0.5)",
    BROWN:   "vector(0.5, 0.25, 0.1)",
  };
  return map[mode] || null;
}

function hexToVPythonColor(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#") || hex.length < 7)
    return "color.white";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "color.white";
  return `vector(${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`;
}

/* ── String escape helper ───────────────────────────────── */
function escPy(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/* ================================================================
   defineCustomBlocksAndGenerator
   ================================================================ */
export function defineCustomBlocksAndGenerator(Blockly) {
  if (initialized) return;

  const Python = getPythonGen(Blockly);
  if (!Python) {
    console.error("Blockly Python generator not found.");
    return;
  }

  const gen = Python.forBlock || Python;

  /* ──────────────────────────────────────────────────────────
     BLOCK DEFINITIONS
     ────────────────────────────────────────────────────────── */
  Blockly.defineBlocksWithJsonArray([
    /* ══════════════════════════════════════════════════════
       VALUE BLOCKS — snap into input slots on other blocks
       ══════════════════════════════════════════════════════ */
    {
      type: "vector_block",
      message0: "vector x %1  y %2  z %3",
      args0: [
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
      ],
      output: "Vector",
      style: "values_blocks",
      tooltip: "vector(x, y, z) — A 3D vector. Snap into pos, axis, size, velocity, or colour slots.",
    },
    {
      type: "colour_block",
      message0: "colour %1 %2",
      args0: [
        {
          type: "field_dropdown",
          name: "MODE",
          options: [
            ["custom",               "CUSTOM"],
            ["red",                  "RED"],
            ["orange",               "ORANGE"],
            ["yellow",               "YELLOW"],
            ["green",                "GREEN"],
            ["blue",                 "BLUE"],
            ["purple",               "PURPLE"],
            ["white",                "WHITE"],
            ["black",                "BLACK"],
            ["gray",                 "GRAY"],
            ["brown",                "BROWN"],
            ["cyan",                 "CYAN"],
            ["magenta",              "MAGENTA"],
          ],
        },
        { type: "field_colour", name: "CUSTOM", colour: "#ff0000" },
      ],
      output: null,
      style: "values_blocks",
      tooltip: "Pick a named colour or click the swatch for a fully custom colour.",
    },
    {
      type: "set_colour_var_block",
      message0: "%1 = colour %2",
      args0: [
        { type: "field_variable", name: "NAME", variable: "c_colour" },
        { type: "field_colour",   name: "COL",  colour: "#ffffff" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "state_blocks",
      tooltip: "Set a colour variable. Click the swatch to choose any colour.",
    },
    {
      type: "expr_block",
      message0: "expression %1",
      args0: [{ type: "field_input", name: "EXPR", text: "0" }],
      output: null,
      style: "values_blocks",
      tooltip:
        "Any Python expression. Type any expression. Snaps into number, vector, or colour slots.",
    },

    /* ── Physics expression blocks ─────────────────────── */
    {
      type: "get_prop_block",
      message0: "%1 . %2",
      args0: [
        { type: "field_variable", name: "OBJ", variable: "ball" },
        {
          type: "field_dropdown",
          name: "PROP",
          options: [
            ["pos",        "pos"],
            ["velocity",   "velocity"],
            ["radius",     "radius"],
            ["color",      "color"],
            ["axis",       "axis"],
            ["size",       "size"],
            ["visible",    "visible"],
            ["opacity",    "opacity"],
            ["mass",       "mass"],
            ["momentum",   "momentum"],
            ["trail_color", "trail_color"],
          ],
        },
      ],
      inputsInline: true,
      /* Deliberately untyped: the PROP dropdown spans vectors (pos, velocity,
         axis, color), numbers (radius, opacity, mass) and booleans (visible),
         so a fixed output would break more than it catches. The consuming
         slots below accept ["Vector","Number"], which is where the real
         guard lives. */
      output: null,
      style: "values_blocks",
      tooltip: "Read a property of an object variable: ball.velocity, ball.pos, ball.radius, etc.",
    },
    {
      type: "get_component_block",
      message0: "%1 . %2",
      args0: [
        { type: "input_value", name: "VEC", check: ["Vector", "Number"] },
        {
          type: "field_dropdown",
          name: "COMP",
          options: [["x", "x"], ["y", "y"], ["z", "z"]],
        },
      ],
      inputsInline: true,
      output: null,
      style: "values_blocks",
      tooltip: "Get the x, y, or z component of a vector. Chain with an object property block: ball.pos → .y gives ball.pos.y.",
    },
    {
      type: "mag_block",
      message0: "length of %1",
      args0: [{ type: "input_value", name: "VEC", check: ["Vector", "Number"] }],
      inputsInline: true,
      output: "Number",
      style: "values_blocks",
      tooltip: "mag(v) — Magnitude (scalar length) of a vector. E.g. snap in an object property block like ball.velocity to get speed.",
    },
    {
      type: "norm_block",
      message0: "direction of %1",
      args0: [{ type: "input_value", name: "VEC", check: ["Vector", "Number"] }],
      inputsInline: true,
      output: "Vector",
      style: "values_blocks",
      tooltip: "norm(v) — Unit vector in the direction of the input. Snap in an object property block like ball.pos to get its direction.",
    },

    /* ── Variable read — snap any named variable into a slot ── */
    {
      type: "var_read_block",
      message0: "var %1",
      args0: [{ type: "field_variable", name: "VAR", variable: "x" }],
      output: null,
      style: "values_blocks",
      tooltip: "Read a named variable. Snaps into any value slot — eliminates manual expr typing.",
    },

    /* ── Compare / Logic — condition producers ─────────────── */
    {
      type: "compare_block",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "A" },
        { type: "field_dropdown", name: "OP", options: [
          ["<",  "LT"],
          ["≤",  "LTE"],
          [">",  "GT"],
          ["≥",  "GTE"],
          ["=",  "EQ"],
          ["≠",  "NEQ"],
        ]},
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: "Boolean",
      style: "logic_blocks",
      tooltip: "Compare two values: <, ≤, >, ≥, =, ≠. Snap into the condition slot of an if block.",
    },
    {
      type: "logic_and_or_block",
      message0: "%1 %2 %3",
      args0: [
        { type: "input_value", name: "A", check: "Boolean" },
        { type: "field_dropdown", name: "OP", options: [
          ["and", "AND"],
          ["or",  "OR"],
        ]},
        { type: "input_value", name: "B", check: "Boolean" },
      ],
      inputsInline: true,
      output: "Boolean",
      style: "logic_blocks",
      tooltip: "Combine two conditions with 'and' (both must be true) or 'or' (either must be true).",
    },
    {
      type: "logic_not_block",
      message0: "not %1",
      args0: [{ type: "input_value", name: "VAL", check: "Boolean" }],
      inputsInline: true,
      output: "Boolean",
      style: "logic_blocks",
      tooltip: "Flip a condition: not true → false, not false → true.",
    },

    /* ════════════════════════════════════════════════════════
       OBJECT BLOCKS — input_value slots for composability
       ══════════════════════════════════════════════════════ */

    /* ── Sphere ─────────────────────────────────────────── */
    {
      type: "sphere_block",
      message0: "%1 = sphere  pos %2  radius %3  colour %4",
      args0: [
        { type: "field_variable", name: "NAME", variable: "ball" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Create a sphere. Snap in a vector for pos, number for radius, colour block.",
    },

    /* ── Sphere + trail ────────────────────────────────── */
    {
      type: "sphere_trail_block",
      message0: "%1 = sphere+trail  pos %2  radius %3  colour %4  trail_r %5  trail_col %6  keep %7",
      args0: [
        { type: "field_variable", name: "NAME", variable: "ball" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
        { type: "input_value", name: "TRAIL_R" },
        { type: "input_value", name: "TRAIL_COL" },
        { type: "input_value", name: "RETAIN" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Sphere that leaves a trail. Trail options must be set at creation time.",
    },

    /* ── Glowing / emissive sphere ─────────────────────── */
    {
      type: "sphere_emissive_block",
      message0: "%1 = glowing sphere  pos %2  radius %3  colour %4  opacity %5",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
        { type: "input_value", name: "OPACITY" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Self-lit sphere (emissive). Great for suns, stars, and glowing particles.",
    },

    /* ── Box ────────────────────────────────────────────── */
    {
      type: "box_block",
      message0: "%1 = box  pos %2  size %3  colour %4",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "SIZE", check: ["Vector", "Number"] },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Create a box. Snap in vectors for position and size.",
    },

    /* ── Box + opacity ──────────────────────────────────── */
    {
      type: "box_opacity_block",
      message0: "%1 = box  pos %2  size %3  colour %4  opacity %5",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "SIZE", check: ["Vector", "Number"] },
        { type: "input_value", name: "COL" },
        { type: "input_value", name: "OPACITY" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Semi-transparent box. Opacity: 0 = invisible, 1 = solid.",
    },

    /* ── Cylinder ───────────────────────────────────────── */
    {
      type: "cylinder_block",
      message0: "%1 = cylinder  pos %2  axis %3  radius %4  colour %5",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "AXIS", check: ["Vector", "Number"] },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Create a cylinder. Axis vector sets direction and length.",
    },

    /* ── Arrow ──────────────────────────────────────────── */
    {
      type: "arrow_block",
      message0: "%1 = arrow  pos %2  axis %3  colour %4",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "AXIS", check: ["Vector", "Number"] },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Create an arrow. Update axis to animate direction and length.",
    },

    /* ── Helix (basic) ─────────────────────────────────── */
    {
      type: "helix_block",
      message0: "%1 = helix  pos %2  axis %3  radius %4  colour %5",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "AXIS", check: ["Vector", "Number"] },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Create a helix / spring. Update axis to stretch or compress it.",
    },

    /* ── Helix (full) ──────────────────────────────────── */
    {
      type: "helix_full_block",
      message0: "%1 = helix  pos %2  axis %3  radius %4  coils %5  thickness %6  colour %7",
      args0: [
        { type: "field_variable", name: "NAME", variable: "spring" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "AXIS", check: ["Vector", "Number"] },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COILS" },
        { type: "input_value", name: "THICK" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Helix with specific coil count and thickness.",
    },

    /* ── Label (simple) ────────────────────────────────── */
    {
      type: "label_block",
      message0: "label %1  at %2",
      args0: [
        { type: "field_input", name: "TEXT", text: "hello" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Create a floating text label in the 3D scene.",
    },

    /* ── Label (full) ──────────────────────────────────── */
    {
      type: "label_full_block",
      message0: "%1 = label  pos %2  text %3  height %4",
      args0: [
        { type: "field_variable", name: "NAME", variable: "telemetry" },
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "field_input", name: "TEXT", text: "" },
        { type: "input_value", name: "HEIGHT" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Named label. Use for live telemetry displays.",
    },

    /* ── Local light ───────────────────────────────────── */
    {
      type: "local_light_block",
      message0: "local light  pos %1  colour %2",
      args0: [
        { type: "input_value", name: "POS", check: ["Vector", "Number"] },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Add a point light source to the scene.",
    },

    /* ══════════════════════════════════════════════════════
       MOTION / PHYSICS BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "set_velocity_block",
      message0: "%1 .velocity = %2",
      args0: [
        { type: "field_variable", name: "OBJ", variable: "ball" },
        { type: "input_value", name: "VEL", check: ["Vector", "Number"] },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "motion_blocks",
      tooltip: "Set an object's velocity vector.",
    },
    {
      type: "update_position_block",
      message0: "%1 .pos += .velocity \u00d7 %2",
      args0: [
        { type: "field_variable", name: "OBJ", variable: "ball" },
        { type: "input_value", name: "DT" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "motion_blocks",
      tooltip: "Move object by velocity \u00d7 dt (Euler step).",
    },
    {
      type: "apply_force_block",
      message0: "%1 .velocity += %2 \u00d7 %3",
      args0: [
        { type: "field_variable", name: "OBJ", variable: "ball" },
        { type: "input_value", name: "ACCEL", check: ["Vector", "Number"] },
        { type: "input_value", name: "DT" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "motion_blocks",
      tooltip: "Add acceleration \u00d7 dt to object's velocity.",
    },
    {
      type: "set_gravity_block",
      message0: "gravity  g = %1 m/s\u00b2 (\u2193 Y)",
      args0: [{ type: "field_number", name: "G", value: 9.81, min: 0 }],
      previousStatement: null,
      nextStatement: null,
      style: "motion_blocks",
      tooltip: "Define gravity as g = vector(0, -value, 0).",
    },

    /* ══════════════════════════════════════════════════════
       VARIABLE / ASSIGNMENT BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "set_scalar_block",
      message0: "%1 = %2",
      args0: [
        { type: "field_variable", name: "NAME", variable: "x" },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "state_blocks",
      tooltip: "Set a variable. Snap in a number, vector, expression, or physics constant.",
    },
    {
      type: "set_attr_expr_block",
      message0: "%1 . %2 = %3",
      args0: [
        { type: "field_variable", name: "OBJ", variable: "ball" },
        {
          type: "field_dropdown",
          name: "ATTR",
          options: [
            ["pos",        "pos"],
            ["pos.x",      "pos.x"],
            ["pos.y",      "pos.y"],
            ["pos.z",      "pos.z"],
            ["velocity",   "velocity"],
            ["velocity.x", "velocity.x"],
            ["velocity.y", "velocity.y"],
            ["velocity.z", "velocity.z"],
            ["color",      "color"],
            ["radius",     "radius"],
            ["axis",       "axis"],
            ["size",       "size"],
            ["visible",    "visible"],
            ["opacity",    "opacity"],
            ["mass",       "mass"],
            ["text",       "text"],
          ],
        },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "state_blocks",
      tooltip: "Set an object's property. E.g. ball.pos = vector(0,1,0)",
    },
    {
      type: "add_attr_expr_block",
      message0: "%1 . %2 += %3",
      args0: [
        { type: "field_variable", name: "OBJ", variable: "ball" },
        {
          type: "field_dropdown",
          name: "ATTR",
          options: [
            ["velocity",   "velocity"],
            ["velocity.x", "velocity.x"],
            ["velocity.y", "velocity.y"],
            ["velocity.z", "velocity.z"],
            ["pos",        "pos"],
            ["pos.x",      "pos.x"],
            ["pos.y",      "pos.y"],
            ["pos.z",      "pos.z"],
            ["axis",       "axis"],
            ["size",       "size"],
            ["mass",       "mass"],
          ],
        },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "state_blocks",
      tooltip: "Add to an object's property. E.g. ball.velocity += a*dt",
    },

    /* ══════════════════════════════════════════════════════
       CONTROL BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "rate_block",
      message0: "run at %1 steps per second",
      args0: [{ type: "field_number", name: "N", value: 100, min: 1 }],
      previousStatement: null,
      nextStatement: null,
      style: "control_blocks",
      tooltip: "rate(n) — Set animation speed (frames per second).",
    },
    {
      type: "forever_loop_block",
      message0: "forever %1 do %2",
      args0: [
        { type: "input_dummy" },
        { type: "input_statement", name: "BODY" },
      ],
      previousStatement: null,
      nextStatement: null,
      style: "control_blocks",
      tooltip: "Repeat the blocks inside forever (while True).",
    },
    {
      type: "for_range_block",
      message0: "for %1 from %2 to %3 step %4",
      args0: [
        { type: "field_variable", name: "VAR", variable: "i" },
        { type: "field_number", name: "START", value: 0 },
        { type: "field_number", name: "STOP", value: 10 },
        { type: "field_number", name: "STEP", value: 1 },
      ],
      message1: "do %1",
      args1: [{ type: "input_statement", name: "BODY" }],
      previousStatement: null,
      nextStatement: null,
      style: "control_blocks",
      tooltip: "Repeat for each value of the loop variable.",
    },
    {
      type: "time_step_block",
      message0: "time step  dt = %1",
      args0: [
        {
          type: "field_number",
          name: "DT",
          value: 0.01,
          min: 0.0001,
          precision: 0.0001,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      style: "control_blocks",
      tooltip: "Set the simulation time step.",
    },
    {
      type: "if_block",
      message0: "if %1",
      args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
      message1: "do %1",
      args1: [{ type: "input_statement", name: "BODY" }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "control_blocks",
      tooltip: "Run the blocks inside only if the condition is true. Snap a comparison block into the slot.",
    },
    {
      type: "if_else_block",
      message0: "if %1",
      args0: [{ type: "input_value", name: "COND", check: "Boolean" }],
      message1: "do %1",
      args1: [{ type: "input_statement", name: "BODY_IF" }],
      message2: "else %1",
      args2: [{ type: "input_statement", name: "BODY_ELSE" }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "control_blocks",
      tooltip: "If/else: run the first set if true, otherwise run the second set. Snap a comparison block into the slot.",
    },
    {
      type: "break_loop_block",
      message0: "break loop",
      previousStatement: null,
      nextStatement: null,
      style: "control_blocks",
      tooltip: "Exit the current loop immediately.",
    },

    /* ══════════════════════════════════════════════════════
       UTILITY BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "comment_block",
      message0: "# %1",
      args0: [
        { type: "field_input", name: "TEXT", text: "describe your model" },
      ],
      previousStatement: null,
      nextStatement: null,
      style: "control_blocks",
      tooltip: "Add a comment to your code.",
    },

    /* ── Telemetry ─────────────────────────────────────── */
    {
      type: "telemetry_update_block",
      message0: "update %1  %2 = round( %3 , %4 dp ) %5",
      args0: [
        { type: "field_variable", name: "LABEL", variable: "telemetry" },
        { type: "field_input",    name: "M",     text: "label" },
        { type: "input_value",    name: "V" },
        { type: "field_number",   name: "D",     value: 2, min: 0, max: 10, precision: 1 },
        { type: "field_input",    name: "U",     text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "state_blocks",
      tooltip: "Show one live measurement on a label. Stack multiple blocks to show more readings. Snap a value block into the round() slot.",
    },

    /* ══════════════════════════════════════════════════════
       ADVANCED / RAW BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "python_raw_block",
      message0: "run Python %1",
      args0: [{ type: "field_input", name: "CODE", text: "# custom" }],
      previousStatement: null,
      nextStatement: null,
      style: "raw_python_blocks",
      tooltip: "Raw Python statement. Insert any Python statement.",
    },
    {
      type: "python_raw_expr_block",
      message0: "expr: %1",
      args0: [{ type: "field_input", name: "EXPR", text: "0" }],
      output: null,
      style: "raw_python_blocks",
      tooltip: "Python expression that outputs a value. Use this only when no structured block covers your needs.",
    },

    /* ══════════════════════════════════════════════════════
       PHYSICS CONSTANTS + PRESET QUICK-CREATE BLOCKS
       ══════════════════════════════════════════════════════ */

    /* ── physics_const_block: defined manually below (dynamic dropdown) ── */

    /* ── Quick-create: sphere (all fields inline) ─────── */
    {
      type: "preset_sphere_block",
      message0: "sphere  %1  at (\u00a0%2 , %3 , %4\u00a0)  radius %5  colour %6",
      args0: [
        { type: "field_variable", name: "NAME", variable: "ball" },
        { type: "field_number",   name: "X",    value: 0 },
        { type: "field_number",   name: "Y",    value: 0 },
        { type: "field_number",   name: "Z",    value: 0 },
        { type: "field_number",   name: "R",    value: 1, min: 0.001, precision: 0.001 },
        { type: "field_colour",   name: "COL",  colour: "#ff4444" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip:
        "Quick-create a sphere: variable name, position (x,y,z), radius, and colour — all in one block.",
    },

    /* ── Quick-create: box (all fields inline) ────────── */
    {
      type: "preset_box_block",
      message0: "box  %1  at (\u00a0%2 , %3 , %4\u00a0)  size %5 \u00d7 %6 \u00d7 %7  colour %8",
      args0: [
        { type: "field_variable", name: "NAME", variable: "wall" },
        { type: "field_number",   name: "X",    value: 0 },
        { type: "field_number",   name: "Y",    value: 0 },
        { type: "field_number",   name: "Z",    value: 0 },
        { type: "field_number",   name: "W",    value: 4 },
        { type: "field_number",   name: "H",    value: 1 },
        { type: "field_number",   name: "D",    value: 4 },
        { type: "field_colour",   name: "COL",  colour: "#4488ff" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip:
        "Quick-create a box: variable name, position, width \u00d7 height \u00d7 depth, colour — all in one block.",
    },

    /* ══════════════════════════════════════════════════════
       GRAPHS — live plotting during a run (Plan 10 R1).
       The vendored GlowScript runtime already ships graph/gcurve/gdots;
       these three blocks are the whole surface. The display is a
       statement-with-body container (sim_start's strip-dedent idiom —
       VPython graph calls need no indentation of their own); the series
       is a preset_* flat quick-create; plot() references the series by
       field_variable, the house idiom for named references.
       ══════════════════════════════════════════════════════ */
    {
      type: "graph_display_block",
      message0: "graph display  %1  x label %2  y label %3  %4",
      args0: [
        { type: "field_input", name: "TITLE",  text: "My Graph" },
        { type: "field_input", name: "XLABEL", text: "t (s)" },
        { type: "field_input", name: "YLABEL", text: "value" },
        { type: "input_dummy" },
      ],
      message1: "%1",
      args1: [{ type: "input_statement", name: "SERIES" }],
      previousStatement: null,
      nextStatement: null,
      style: "graphs_blocks",
      tooltip:
        "Create a live graph panel under the 3D scene. Put series blocks inside, then plot points on them during the run.",
    },
    {
      type: "graph_series_block",
      message0: "series  %1  drawn as %2  colour %3",
      args0: [
        { type: "field_variable", name: "NAME", variable: "data" },
        {
          type: "field_dropdown",
          name: "MODE",
          options: [
            ["a line", "gcurve"],
            ["dots", "gdots"],
          ],
        },
        { type: "field_colour", name: "COL", colour: "#0973d1" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "graphs_blocks",
      tooltip:
        "Add a named series to the graph display above it — a line or dots, in your colour. Plot points on it by name.",
    },
    {
      type: "graph_plot_block",
      message0: "plot ( %1 , %2 ) on %3",
      args0: [
        { type: "input_value", name: "X", check: ["Number"] },
        { type: "input_value", name: "Y", check: ["Number"] },
        { type: "field_variable", name: "SERIES", variable: "data" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "graphs_blocks",
      tooltip:
        "Add one point (x, y) to a series — put this inside your simulation loop to draw live while it runs.",
    },

    /* ── Define constant ─────────────────────────────────── */
    {
      type: "define_const_block",
      message0: "const  %1  =  %2",
      args0: [
        { type: "field_variable", name: "NAME", variable: "MASS" },
        { type: "input_value",    name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "values_blocks",
      tooltip: "Define a named constant once. Snap in a physics constant, number, or expression. The name appears in the Variables category so you can reuse it anywhere without retyping.",
    },

    /* ══════════════════════════════════════════════════════
       SIMULATION START / END BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "sim_start_block",
      message0: "Simulation Start  %1  %2",
      args0: [
        { type: "field_input", name: "TITLE", text: "My Simulation" },
        { type: "input_dummy" },
      ],
      message1: "%1",
      args1: [{ type: "input_statement", name: "SETUP" }],
      nextStatement: null,
      style: "control_blocks",
      tooltip: "Marks the beginning of a simulation. Place all setup blocks (scene, objects, constants) inside.",
      hat: "cap",
    },
    {
      type: "sim_end_block",
      message0: "Simulation End  %1",
      args0: [
        { type: "field_input", name: "MSG", text: "Simulation complete" },
      ],
      previousStatement: null,
      style: "control_blocks",
      tooltip: "Marks the end of a simulation. Prints a completion message.",
    },

    /* ══════════════════════════════════════════════════════
       DATA-SCIENCE ANALYSIS-START HAT
       Anchors a data analysis. Blocks placed inside BODY are
       "in use"; blocks left outside it are greyed/ignored.
       ══════════════════════════════════════════════════════ */
    {
      type: "ds_start_block",
      message0: "Start analysis  %1  %2",
      args0: [
        { type: "field_input", name: "TITLE", text: "My Analysis" },
        { type: "input_dummy" },
      ],
      message1: "%1",
      args1: [{ type: "input_statement", name: "BODY" }],
      style: "load_data_blocks",
      tooltip:
        "Marks the start of a data analysis. Put your load / explore / chart blocks inside. Blocks left outside are greyed out and ignored.",
      hat: "cap",
    },

    /* ══ 3D Math blocks ═══════════════════════════════════════════════ */
    {
      type: "cross_product_block",
      message0: "cross product of %1 and %2",
      args0: [
        { type: "input_value", name: "A", check: ["Vector", "Number"] },
        { type: "input_value", name: "B", check: ["Vector", "Number"] },
      ],
      inputsInline: true,
      output: "Vector",
      style: "3d_math_blocks",
      tooltip: "cross(a, b) — Cross product of two 3D vectors. Returns a vector perpendicular to both (right-hand rule).",
    },
    {
      type: "dot_product_block",
      message0: "dot product of %1 and %2",
      args0: [
        { type: "input_value", name: "A", check: ["Vector", "Number"] },
        { type: "input_value", name: "B", check: ["Vector", "Number"] },
      ],
      inputsInline: true,
      output: "Number",
      style: "3d_math_blocks",
      tooltip: "dot(a, b) — Dot product of two vectors. Returns a scalar (used for work, projection, angle).",
    },
    {
      type: "math_trig_block",
      message0: "%1 ( %2 )",
      args0: [
        { type: "field_dropdown", name: "OP", options: [
          ["sin",     "sin"],
          ["cos",     "cos"],
          ["tan",     "tan"],
          ["asin",    "asin"],
          ["acos",    "acos"],
          ["atan",    "atan"],
          ["radians", "radians"],
          ["degrees", "degrees"],
          ["sqrt",    "sqrt"],
          ["abs",     "abs"],
        ]},
        { type: "input_value", name: "X" },
      ],
      inputsInline: true,
      output: null,
      style: "3d_math_blocks",
      tooltip: "Maths functions: sin/cos/tan/asin/acos/atan expect radians — use radians() to convert from degrees. abs = absolute value |x|. sqrt = square root. All generate VPython-compatible code.",
    },
    /* ── Vector compose — input slots for variable-based vectors ── */
    {
      type: "vector_compose_block",
      message0: "build vector x %1  y %2  z %3",
      args0: [
        { type: "input_value", name: "X" },
        { type: "input_value", name: "Y" },
        { type: "input_value", name: "Z" },
      ],
      inputsInline: true,
      output: "Vector",
      style: "3d_math_blocks",
      tooltip: "vector(x, y, z) — Build a vector from three expressions. Snap variables, numbers, or math blocks into x, y, z.",
    },
    /* ── Min / Max / Pow — common physics math ─────────────── */
    {
      type: "math_min_block",
      message0: "smaller of %1 and %2",
      args0: [
        { type: "input_value", name: "A" },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      style: "3d_math_blocks",
      tooltip: "min(a, b) — Returns the smaller of two values. Useful for clamping.",
    },
    {
      type: "math_max_block",
      message0: "larger of %1 and %2",
      args0: [
        { type: "input_value", name: "A" },
        { type: "input_value", name: "B" },
      ],
      inputsInline: true,
      output: null,
      style: "3d_math_blocks",
      tooltip: "max(a, b) — Returns the larger of two values. Useful for floor clamping and safe divisors.",
    },
    {
      type: "math_pow_block",
      message0: "%1 ** %2",
      args0: [
        { type: "input_value", name: "BASE" },
        { type: "input_value", name: "EXP" },
      ],
      inputsInline: true,
      output: null,
      style: "3d_math_blocks",
      tooltip: "Raise BASE to the power EXP. E.g. r**2 for inverse-square laws.",
    },
    {
      type: "math_clamp_block",
      message0: "keep %1 between %2 and %3",
      args0: [
        { type: "input_value", name: "VAL" },
        { type: "input_value", name: "LO" },
        { type: "input_value", name: "HI" },
      ],
      inputsInline: true,
      output: null,
      style: "3d_math_blocks",
      tooltip: "clamp(value, lo, hi) — Clamp a value between low and high bounds: max(lo, min(val, hi)).",
    },
    {
      type: "rotate_object_block",
      message0: "rotate %1 by %2 \u00b0 around axis %3",
      args0: [
        { type: "field_variable", name: "OBJ", variable: "ball" },
        { type: "input_value", name: "ANGLE" },
        { type: "input_value", name: "AXIS" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "motion_blocks",
      tooltip: "Rotate an object by an angle in degrees around an axis vector (right-hand rule).",
    },
    {
      type: "scene_camera_block",
      message0: "scene.%1 = %2",
      args0: [
        { type: "field_dropdown", name: "PROP", options: [
          ["center",  "center"],
          ["forward", "forward"],
          ["up",      "up"],
          ["range",   "range"],
          ["width",   "width"],
          ["height",  "height"],
          ["background", "background"],
        ]},
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "objects_blocks",
      tooltip: "Set a scene / camera property: center/forward/up control the camera, range controls zoom.",
    },

    /* ══════════════════════════════════════════════════════
       DATA SCIENCE BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "ds_load_builtin_block",
      message0: "%1 = load dataset %2",
      args0: [
        { type: "field_variable", name: "VAR", variable: "df" },
        {
          type: "field_dropdown",
          name: "ID",
          options: [
            ["Planets",  "planets"],
            ["Penguins", "penguins"],
            ["Weather",  "weather"],
            ["Pendulum", "pendulum"],
            ["Spring",   "spring"],
            ["Free fall", "freefall"],
          ],
        },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "load_data_blocks",
      tooltip: "Load a built-in dataset (planets, penguins, weather, pendulum, spring, free fall) into a variable.",
    },
    {
      type: "ds_load_trace_block",
      message0: "%1 = trace dataset %2",
      args0: [
        { type: "field_variable", name: "VAR", variable: "df" },
        { type: "field_input", name: "DATASET_NAME", text: "Run @ ..." },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "load_data_blocks",
      tooltip: "Load a promoted simulation run by its label (copy the label from the Saved Traces panel).",
    },
    {
      type: "ds_load_csv_block",
      message0: "%1 = load CSV file",
      args0: [
        { type: "field_variable", name: "VAR", variable: "df" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "load_data_blocks",
      tooltip: "Open a CSV file from your computer and load it as a dataset.",
    },
    {
      type: "ds_show_table_block",
      message0: "show table %1",
      args0: [
        { type: "field_variable", name: "VAR", variable: "df" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Display the dataset as a scrollable table in the Data panel.",
    },
    {
      type: "ds_calc_mean_block",
      message0: "%1 = mean( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "value" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Calculate the mean of a numeric column and store it in a variable.",
    },
    {
      type: "ds_calc_median_block",
      message0: "%1 = median( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "value" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Calculate the median (middle value) of a numeric column.",
    },
    {
      type: "ds_calc_min_block",
      message0: "%1 = min( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "value" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Find the minimum value in a numeric column.",
    },
    {
      type: "ds_calc_max_block",
      message0: "%1 = max( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "value" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Find the maximum value in a numeric column.",
    },
    {
      type: "ds_calc_sum_block",
      message0: "%1 = sum( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "value" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Calculate the sum (total) of a numeric column.",
    },
    {
      type: "ds_calc_stddev_block",
      message0: "%1 = spread( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "value" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Calculate how spread out the values are in a column (standard deviation).",
    },
    {
      type: "ds_show_first_n_block",
      message0: "show first %1 rows of %2",
      args0: [
        { type: "field_dropdown", name: "N",
          options: [["5","5"],["10","10"],["20","20"],["50","50"]] },
        { type: "field_variable", name: "VAR", variable: "df" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Display the first N rows of a dataset as a table.",
    },
    {
      type: "ds_count_rows_block",
      message0: "%1 = count rows of %2",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Count the total number of rows in a dataset.",
    },
    {
      type: "ds_count_unique_block",
      message0: "%1 = unique values in %2 . %3",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "species" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Count the number of distinct values in a column.",
    },
    /* ── Category 2: Exploring Data (remaining) ── */
    {
      type: "ds_show_last_n_block",
      message0: "show last %1 rows of %2",
      args0: [
        { type: "field_dropdown", name: "N",
          options: [["5","5"],["10","10"],["20","20"],["50","50"]] },
        { type: "field_variable", name: "VAR", variable: "df" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Display the last N rows of a dataset as a table.",
    },
    {
      type: "ds_count_cols_block",
      message0: "%1 = count columns of %2",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Count the number of columns (variables) in a dataset.",
    },
    {
      type: "ds_list_cols_block",
      message0: "%1 = column names of %2",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Get the names of all columns in a dataset as a list.",
    },
    {
      type: "ds_show_column_block",
      message0: "show column %1 . %2",
      args0: [
        { type: "field_variable", name: "VAR", variable: "df" },
        { type: "field_input",    name: "COL", text: "species" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Display all values in a single column.",
    },
    /* ── Category 3: Describing Data (remaining) ── */
    {
      type: "ds_calc_mode_block",
      message0: "%1 = most common( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "species" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Find the most frequently occurring value in a column.",
    },
    {
      type: "ds_calc_range_block",
      message0: "%1 = range( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "value" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Calculate the range (max minus min) of a numeric column.",
    },
    {
      type: "ds_calc_count_block",
      message0: "%1 = count non-missing( %2 . %3 )",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "result" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "value" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Count the number of non-missing values in a column.",
    },
    /* ── Category 4: Asking Questions (Filter / Sort / Group) ── */
    {
      type: "ds_filter_eq_block",
      message0: "%1 = %2 where %3 = %4",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "filtered" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "species" },
        { type: "field_input",    name: "VALUE",  text: "Adelie" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Keep only rows where a column equals a specific value.",
    },
    {
      type: "ds_filter_gt_block",
      message0: "%1 = %2 where %3 > %4",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "filtered" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "mass" },
        { type: "field_input",    name: "VALUE",  text: "3500" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Keep only rows where a column is greater than a value.",
    },
    {
      type: "ds_filter_lt_block",
      message0: "%1 = %2 where %3 < %4",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "filtered" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "mass" },
        { type: "field_input",    name: "VALUE",  text: "3500" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Keep only rows where a column is less than a value.",
    },
    {
      type: "ds_sort_asc_block",
      message0: "%1 = sort %2 by %3 (smallest first)",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "sorted" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "mass" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Sort the dataset by a column from smallest to largest.",
    },
    {
      type: "ds_sort_desc_block",
      message0: "%1 = sort %2 by %3 (largest first)",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "sorted" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "mass" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Sort the dataset by a column from largest to smallest.",
    },
    {
      type: "ds_remove_missing_block",
      message0: "%1 = %2 with missing %3 removed",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "cleaned" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "mass" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Remove rows that have a missing value in a specific column.",
    },
    {
      type: "ds_group_count_block",
      message0: "%1 = count rows per %3 in %2",
      args0: [
        { type: "field_variable", name: "RESULT",  variable: "grouped" },
        { type: "field_variable", name: "VAR",     variable: "df" },
        { type: "field_input",    name: "COL",     text: "species" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "group_compare_blocks",
      tooltip: "Count how many rows belong to each group in a categorical column.",
    },
    {
      type: "ds_group_mean_block",
      message0: "%1 = mean of %3 per %4 in %2",
      args0: [
        { type: "field_variable", name: "RESULT",    variable: "grouped" },
        { type: "field_variable", name: "VAR",       variable: "df" },
        { type: "field_input",    name: "VALUE_COL", text: "mass" },
        { type: "field_input",    name: "GROUP_COL", text: "species" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "group_compare_blocks",
      tooltip: "Calculate the mean of a numeric column for each group in a categorical column.",
    },
    /* ── Category 5: Seeing Data (Charts) ── */
    {
      type: "ds_chart_bar_block",
      message0: "bar chart  %1  x: %2  y: %3  title: %4",
      args0: [
        { type: "field_variable", name: "VAR",   variable: "df" },
        { type: "field_input",    name: "X_COL", text: "species" },
        { type: "field_input",    name: "Y_COL", text: "count" },
        { type: "field_input",    name: "TITLE", text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "charts_blocks",
      tooltip: "Draw a bar chart. Best for comparing values across categories.",
    },
    {
      type: "ds_chart_line_block",
      message0: "line chart  %1  x: %2  y: %3  title: %4",
      args0: [
        { type: "field_variable", name: "VAR",   variable: "df" },
        { type: "field_input",    name: "X_COL", text: "date" },
        { type: "field_input",    name: "Y_COL", text: "temperature" },
        { type: "field_input",    name: "TITLE", text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "charts_blocks",
      tooltip: "Draw a line chart. Best for showing change over an ordered variable (e.g. time).",
    },
    {
      type: "ds_chart_scatter_block",
      message0: "scatter plot  %1  x: %2  y: %3  title: %4",
      args0: [
        { type: "field_variable", name: "VAR",   variable: "df" },
        { type: "field_input",    name: "X_COL", text: "bill_length_mm" },
        { type: "field_input",    name: "Y_COL", text: "body_mass_g" },
        { type: "field_input",    name: "TITLE", text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "charts_blocks",
      tooltip: "Draw a scatter plot. Best for exploring the relationship between two numeric columns.",
    },
    {
      type: "ds_chart_histogram_block",
      message0: "histogram  %1  column: %2  title: %3",
      args0: [
        { type: "field_variable", name: "VAR",   variable: "df" },
        { type: "field_input",    name: "COL",   text: "body_mass_g" },
        { type: "field_input",    name: "TITLE", text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "charts_blocks",
      tooltip: "Draw a histogram showing the distribution of values in a numeric column.",
    },
    {
      type: "ds_chart_box_block",
      message0: "box plot  %1  value: %2  group: %3  title: %4",
      args0: [
        { type: "field_variable", name: "VAR",       variable: "df" },
        { type: "field_input",    name: "VALUE_COL", text: "body_mass_g" },
        { type: "field_input",    name: "GROUP_COL", text: "species" },
        { type: "field_input",    name: "TITLE",     text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "charts_blocks",
      tooltip: "Draw a box plot showing spread and median. Leave group empty for a single box.",
    },
    /* ── Category 6: Communicating Findings ── */
    {
      type: "ds_write_note_block",
      message0: "note: %1",
      args0: [
        { type: "field_input", name: "TEXT", text: "Add your observation here..." },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "communicate_blocks",
      tooltip: "Add a plain-text annotation to the output.",
    },
    {
      type: "ds_print_result_block",
      message0: "print %1 as %2",
      args0: [
        { type: "field_variable", name: "VAR",   variable: "result" },
        { type: "field_input",    name: "LABEL", text: "my result" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "communicate_blocks",
      tooltip: "Display a computed value with a custom label.",
    },
    {
      type: "ds_compare_results_block",
      message0: "compare %1 as %2  vs  %3 as %4",
      args0: [
        { type: "field_variable", name: "VAR_A",   variable: "result1" },
        { type: "field_input",    name: "LABEL_A", text: "Group A" },
        { type: "field_variable", name: "VAR_B",   variable: "result2" },
        { type: "field_input",    name: "LABEL_B", text: "Group B" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "communicate_blocks",
      tooltip: "Display two computed values side-by-side for comparison.",
    },
    {
      type: "ds_state_conclusion_block",
      message0: "conclusion: %1",
      args0: [
        { type: "field_input", name: "TEXT", text: "The data shows that " },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "communicate_blocks",
      tooltip: "State a conclusion based on your findings.",
    },
    {
      type: "ds_export_table_block",
      message0: "export %1 as CSV",
      args0: [
        { type: "field_variable", name: "VAR", variable: "df" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "communicate_blocks",
      tooltip: "Download the dataset as a CSV file.",
    },
    {
      type: "ds_show_python_block",
      message0: "show generated Python",
      args0: [],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "communicate_blocks",
      tooltip: "Reveal the Python code generated by the blocks above.",
    },
    /* ── D.5: Missing spec blocks ── */
    {
      type: "ds_find_missing_block",
      message0: "%1 = rows where %2 . %3 is missing",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "missing" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "col" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Find rows where a column has missing (empty) values.",
    },
    {
      type: "ds_show_one_cell_block",
      message0: "%1 = %2 row %3 column %4",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "cell" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_number",   name: "ROW",    value: 0, min: 0 },
        { type: "field_input",    name: "COL",    text: "col" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Read one value from a specific row and column.",
    },
    {
      type: "ds_all_stats_block",
      message0: "all stats for %1 . %2",
      args0: [
        { type: "field_variable", name: "VAR", variable: "df" },
        { type: "field_input",    name: "COL", text: "col" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Show mean, median, min, max, range, sum and spread for a column.",
    },
    {
      type: "ds_compare_columns_block",
      message0: "compare %1 . %2 vs %3",
      args0: [
        { type: "field_variable", name: "VAR",   variable: "df" },
        { type: "field_input",    name: "COL_A", text: "col1" },
        { type: "field_input",    name: "COL_B", text: "col2" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Compare all descriptive statistics for two columns side by side.",
    },
    {
      type: "ds_save_chart_block",
      message0: "save %1 chart of %2 x %3 y %4",
      args0: [
        { type: "field_dropdown", name: "CHART_TYPE",
          options: [["bar","bar"],["line","line"],["scatter","scatter"],["histogram","histogram"]] },
        { type: "field_variable", name: "VAR",   variable: "df" },
        { type: "field_input",    name: "X_COL", text: "x" },
        { type: "field_input",    name: "Y_COL", text: "y" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "charts_blocks",
      tooltip: "Save the chart as a PNG image file.",
    },
    /* ── Phase E: Compound filters + identify-type ── */
    {
      type: "ds_filter_and_block",
      message0: "%1 = %2 where %3 = %4 AND %5 = %6",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "filtered" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL_A",  text: "species" },
        { type: "field_input",    name: "VAL_A",  text: "Adelie" },
        { type: "field_input",    name: "COL_B",  text: "island" },
        { type: "field_input",    name: "VAL_B",  text: "Biscoe" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Filter rows where both conditions are true (AND logic).",
    },
    {
      type: "ds_filter_or_block",
      message0: "%1 = %2 where %3 = %4 OR %5 = %6",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "filtered" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL_A",  text: "species" },
        { type: "field_input",    name: "VAL_A",  text: "Adelie" },
        { type: "field_input",    name: "COL_B",  text: "species" },
        { type: "field_input",    name: "VAL_B",  text: "Chinstrap" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "filter_sort_blocks",
      tooltip: "Filter rows where at least one condition is true (OR logic).",
    },
    {
      type: "ds_identify_type_block",
      message0: "%1 = type of %2 . %3",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "type" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "species" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "explore_blocks",
      tooltip: "Find out the data type of a column (number, text, boolean).",
    },

    /* ── Transform columns ── */
    {
      type: "ds_add_column_transform_block",
      message0: "%1 = %2 with new column %3 = %4( %5 )",
      args0: [
        { type: "field_variable", name: "RESULT",    variable: "df2" },
        { type: "field_variable", name: "VAR",       variable: "df" },
        { type: "field_input",    name: "NEW_COL",   text: "log_L" },
        { type: "field_dropdown", name: "TRANSFORM",
          options: [["ln","ln"],["log10","log10"],["√","sqrt"],["x²","square"],["1/x","reciprocal"]] },
        { type: "field_input",    name: "SOURCE_COL", text: "col" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "transforming_data_blocks",
      tooltip: "Add a new column by applying a maths transform (ln, log10, √, x², 1/x) to an existing column.",
    },
    {
      type: "ds_multiply_columns_block",
      message0: "%1 = %2 with new column %3 = %4 × %5",
      args0: [
        { type: "field_variable", name: "RESULT",  variable: "df2" },
        { type: "field_variable", name: "VAR",     variable: "df" },
        { type: "field_input",    name: "NEW_COL", text: "product" },
        { type: "field_input",    name: "COL_A",   text: "col1" },
        { type: "field_input",    name: "COL_B",   text: "col2" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "transforming_data_blocks",
      tooltip: "Add a new column containing the element-wise product of two existing columns (e.g. T² = period_s × period_s).",
    },

    /* ── Uncertainty ── */
    {
      type: "ds_calc_std_error_block",
      message0: "%1 = std error of %2 . %3",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "se" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "col" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "uncertainty_blocks",
      tooltip: "Standard error of the mean: σ / √n. Represents uncertainty in the mean from repeated measurements.",
    },
    {
      type: "ds_print_uncertainty_block",
      message0: "print %1 ± %2  label %3",
      args0: [
        { type: "field_variable", name: "MEAN_VAR", variable: "mean_val" },
        { type: "field_variable", name: "SE_VAR",   variable: "se" },
        { type: "field_input",    name: "LABEL",    text: "measurement" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "uncertainty_blocks",
      tooltip: "Display a measurement result as X.XXX ± Y.YY with relative uncertainty %.",
    },
    {
      type: "ds_calc_relative_uncertainty_block",
      message0: "%1 = relative uncertainty of %2 ± %3  (%)",
      args0: [
        { type: "field_variable", name: "RESULT",   variable: "rel_unc" },
        { type: "field_variable", name: "MEAN_VAR", variable: "mean_val" },
        { type: "field_variable", name: "SE_VAR",   variable: "se" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "uncertainty_blocks",
      tooltip: "Calculate relative uncertainty: (uncertainty / value) × 100 %.",
    },

    /* ── Relationships ── */
    {
      type: "ds_linear_regression_block",
      message0: "%1 = linear fit of %2  x= %3  y= %4",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "fit" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "X_COL",  text: "x" },
        { type: "field_input",    name: "Y_COL",  text: "y" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "analyzing_relationships_blocks",
      tooltip: "Fit a straight line y = mx + b (OLS). Stores slope, intercept, R², and n.",
    },
    {
      type: "ds_chart_scatter_fit_block",
      message0: "scatter+fit chart  %1  x= %2  y= %3  fit= %4  title %5",
      args0: [
        { type: "field_variable", name: "VAR",     variable: "df" },
        { type: "field_input",    name: "X_COL",   text: "x" },
        { type: "field_input",    name: "Y_COL",   text: "y" },
        { type: "field_variable", name: "FIT_VAR", variable: "fit" },
        { type: "field_input",    name: "TITLE",   text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "analyzing_relationships_blocks",
      tooltip: "Scatter plot with linear regression line overlay. Use the linear fit block first to compute the fit.",
    },
    {
      type: "ds_correlation_block",
      message0: "%1 = correlation of %2  %3  vs  %4",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "r" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL_A",  text: "col1" },
        { type: "field_input",    name: "COL_B",  text: "col2" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "analyzing_relationships_blocks",
      tooltip: "Pearson correlation coefficient r (range −1 to +1). Close to ±1 = strong linear relationship.",
    },

    /* ── Additional stats ── */
    {
      type: "ds_calc_percentile_block",
      message0: "%1 = %2 . %3  percentile %4",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "p_val" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "col" },
        { type: "field_number",   name: "P",      value: 25, min: 0, max: 100 },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Calculate the p-th percentile of a column using linear interpolation.",
    },
    {
      type: "ds_calc_iqr_block",
      message0: "%1 = IQR of %2 . %3",
      args0: [
        { type: "field_variable", name: "RESULT", variable: "iqr_val" },
        { type: "field_variable", name: "VAR",    variable: "df" },
        { type: "field_input",    name: "COL",    text: "col" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      style: "statistics_blocks",
      tooltip: "Interquartile range: Q3 − Q1 (75th percentile minus 25th percentile).",
    },
  ]);

  /* ──────────────────────────────────────────────────────────
     WIDEN BUILT-IN math_arithmetic — VPython's +, -, *, / genuinely
     operate on scalars AND vectors (vector±vector, scalar×vector,
     vector/scalar all overload cleanly at runtime), but Blockly's
     stock math_arithmetic block hardcodes check:"Number" on its A/B
     inputs and output:"Number" — that describes a generic calculator,
     not this product's arithmetic domain. Once the vector-producing
     blocks above carry real output:"Vector" typing (Task 9), that
     Number-only check silently rejects a legitimate `scalar * norm(vec)`
     or `vector + vector` connection: domToWorkspace() doesn't throw on
     a rejected connection, it just drops the child block off the tree,
     and the generator's valueToCode() falls back to a default of "0"
     for the vanished input. That is exactly what broke the "Sun, Earth
     & Moon" orbit template during Task 9 salvage — every gravitational
     acceleration term and the moon's velocity offset silently became
     `* 0` / `+ 0`, i.e. zero gravity, with no error anywhere. Widening
     the built-in block's checks to ["Number","Vector"] (controller
     ruling, Task 9 salvage) restores those connections without
     reverting the new producer typings or touching template XML.
     ────────────────────────────────────────────────────────── */
  const builtinArithmeticInit = Blockly.Blocks["math_arithmetic"].init;
  Blockly.Blocks["math_arithmetic"].init = function () {
    builtinArithmeticInit.call(this);
    /* Optional chaining, not a bare access: these input names belong to
       Blockly's own block definition, not ours. If a future Blockly renames
       or restructures them, a throw in here kills `init` for EVERY arithmetic
       block on the workspace; degrading to "no widening" instead costs only
       the vector connections this widening restored. */
    this.getInput("A")?.connection?.setCheck(["Number", "Vector"]);
    this.getInput("B")?.connection?.setCheck(["Number", "Vector"]);
    this.outputConnection?.setCheck(["Number", "Vector"]);
  };

  /* ── physics_const_block — dynamic dropdown with custom constants ── */
  Blockly.Blocks["physics_const_block"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("")
        .appendField(
          new Blockly.FieldDropdown(function () {
            const base = [
              ["+ Create new\u2026",                             "__NEW__"],
              ["g = 9.81 m/s\u00b2",                          "g"],
              ["G = 6.674\u00d710\u207b\u00b9\u00b9",         "G"],
              ["\u03c0  (pi)",                                 "pi"],
              ["e  (Euler\u2019s)",                            "euler"],
              ["c = 3\u00d710\u2078 m/s",                      "c"],
              ["k\u2091  Coulomb",                             "ke"],
              ["h  Planck",                                    "h"],
              ["m\u2091  electron",                            "me"],
              ["m\u209a  proton",                              "mp"],
            ];
            customConstantsRegistry.forEach(function (c) {
              base.push([c.name + " = " + c.value, c.name]);
            });
            return base;
          }),
          "CONST"
        );
      this.setOutput(true, null);
      this.setStyle("values_blocks");
      this.setTooltip(
        "Standard physics constant. g=9.81, G=6.674e-11, pi, e=2.718, c=3e8, k_e=8.988e9, h=6.626e-34, m_e=9.109e-31, m_p=1.673e-27."
      );
    },
  };

  /* Right-click → Help, on every block we own. Derived from the block id so
     it cannot drift: there were zero helpUrl declarations before Tranche 3,
     while HelpPage.js has carried a full block reference the whole time.
     Stock Blockly blocks keep their own upstream help URLs. Runs after every
     block registration above (JSON-defined and the manually-registered
     physics_const_block) so Blockly.Blocks[entry.type] is always populated
     by the time this loop reads it. */
  for (const entry of REGISTRY_BLOCK_CATALOGUE) {
    const def = Blockly.Blocks[entry.type];
    if (!def) continue;              // stock block, or not yet registered
    if (def.helpUrl) continue;       // never clobber an upstream URL
    def.helpUrl = `#/help?block=${entry.type}`;
  }

  /* ──────────────────────────────────────────────────────────
     CODE GENERATORS  (Python.forBlock)
     ────────────────────────────────────────────────────────── */

  // Helper: get value code from composable block plugged into a slot
  const val = (block, name, fallback) =>
    Python.valueToCode(block, name, Python.ORDER_NONE) || fallback;

  // Helper: resolve a Blockly variable field to its current name
  const varName = (block, field, fallback) => {
    const id = block.getFieldValue(field);
    if (!id) return fallback;
    const model = block.workspace ? block.workspace.getVariableById(id) : null;
    const resolved = model ? model.name : id;
    return (resolved || fallback).trim();
  };

  // Live-trace: emit a Python assignment to a well-known variable (_phtr_NAME).
  // After RapydScript compiles, glowRunner.js injects parent.postMessage() calls
  // alongside these assignments so trace data reaches the React trace table.
  const tr = (name, expr, blockId) => {
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
    traceRegistry.push({ safeName, displayName: name, blockId: blockId || '' });
    return `_phtr_${safeName} = str(${expr})\n`;
  };

  /* ── Value blocks ─────────────────────────────────────── */
  gen["vector_block"] = function (block) {
    const x = block.getFieldValue("X");
    const y = block.getFieldValue("Y");
    const z = block.getFieldValue("Z");
    return [`vector(${x}, ${y}, ${z})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["colour_block"] = function (block) {
    const mode = block.getFieldValue("MODE") || "CUSTOM";
    if (mode !== "CUSTOM") {
      const named = namedColorToVPython(mode);
      if (named) return [named, Python.ORDER_ATOMIC];
    }
    const customHex = block.getFieldValue("CUSTOM") || block.getFieldValue("COL") || "#ff0000";
    return [hexToVPythonColor(customHex), Python.ORDER_ATOMIC];
  };

  gen["set_colour_var_block"] = function (block) {
    const name = varName(block, "NAME", "c_colour");
    const hex  = block.getFieldValue("COL") || "#ffffff";
    return `${name} = ${hexToVPythonColor(hex)}\n`;
  };

  gen["expr_block"] = function (block) {
    const expr = (block.getFieldValue("EXPR") || "0").trim();
    return [expr, Python.ORDER_ATOMIC];
  };

  gen["get_prop_block"] = function (block) {
    const obj  = varName(block, "OBJ", "ball");
    const prop = (block.getFieldValue("PROP") || "velocity").trim();
    return [`${obj}.${prop}`, Python.ORDER_ATOMIC];
  };

  gen["get_component_block"] = function (block) {
    const vec  = val(block, "VEC", "v");
    const comp = (block.getFieldValue("COMP") || "y");
    return [`${vec}.${comp}`, Python.ORDER_ATOMIC];
  };

  gen["mag_block"] = function (block) {
    return [`mag(${val(block, "VEC", "v")})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["norm_block"] = function (block) {
    return [`norm(${val(block, "VEC", "v")})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["var_read_block"] = function (block) {
    return [varName(block, "VAR", "x"), Python.ORDER_ATOMIC];
  };

  gen["compare_block"] = function (block) {
    const a  = val(block, "A", "0");
    const b  = val(block, "B", "0");
    const opMap = { LT: "<", LTE: "<=", GT: ">", GTE: ">=", EQ: "==", NEQ: "!=" };
    const op = opMap[block.getFieldValue("OP") || "LT"] || "<";
    return [`${a} ${op} ${b}`, Python.ORDER_RELATIONAL];
  };

  gen["logic_and_or_block"] = function (block) {
    const a  = val(block, "A", "True");
    const b  = val(block, "B", "True");
    const op = block.getFieldValue("OP") === "OR" ? "or" : "and";
    return [`${a} ${op} ${b}`, Python.ORDER_LOGICAL_OR || Python.ORDER_NONE];
  };

  gen["logic_not_block"] = function (block) {
    const v = val(block, "VAL", "True");
    return [`not ${v}`, Python.ORDER_LOGICAL_NOT || Python.ORDER_NONE];
  };

  /* ── Object blocks ────────────────────────────────────────────── */
  gen["sphere_block"] = function (block) {
    const name = varName(block, "NAME", "ball");
    const pos = val(block, "POS", "vector(0,0,0)");
    const r = val(block, "RADIUS", "1");
    const col = val(block, "COL", "color.red");
    const e = `sphere(pos=${pos}, radius=${r}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["sphere_trail_block"] = function (block) {
    const name = varName(block, "NAME", "ball");
    const pos = val(block, "POS", "vector(0,0,0)");
    const r = val(block, "RADIUS", "0.5");
    const col = val(block, "COL", "color.red");
    const tr = val(block, "TRAIL_R", "0.03");
    const tc = val(block, "TRAIL_COL", "color.yellow");
    const ret = val(block, "RETAIN", "200");
    const e = `sphere(pos=${pos}, radius=${r}, color=${col}, make_trail=True, trail_radius=${tr}, trail_color=${tc}, retain=${ret})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["sphere_emissive_block"] = function (block) {
    const name = varName(block, "NAME", "obj");
    const pos = val(block, "POS", "vector(0,0,0)");
    const r = val(block, "RADIUS", "0.5");
    const col = val(block, "COL", "color.white");
    const op = val(block, "OPACITY", "1");
    const e = `sphere(pos=${pos}, radius=${r}, color=${col}, emissive=True, opacity=${op})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["box_block"] = function (block) {
    const name = varName(block, "NAME", "obj");
    const pos = val(block, "POS", "vector(0,0,0)");
    const sz = val(block, "SIZE", "vector(1,1,1)");
    const col = val(block, "COL", "color.blue");
    const e = `box(pos=${pos}, size=${sz}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["box_opacity_block"] = function (block) {
    const name = varName(block, "NAME", "obj");
    const pos = val(block, "POS", "vector(0,0,0)");
    const sz = val(block, "SIZE", "vector(1,1,1)");
    const col = val(block, "COL", "color.white");
    const op = val(block, "OPACITY", "0.5");
    const e = `box(pos=${pos}, size=${sz}, color=${col}, opacity=${op})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["cylinder_block"] = function (block) {
    const name = varName(block, "NAME", "obj");
    const pos = val(block, "POS", "vector(0,0,0)");
    const ax = val(block, "AXIS", "vector(1,0,0)");
    const r = val(block, "RADIUS", "0.5");
    const col = val(block, "COL", "color.green");
    const e = `cylinder(pos=${pos}, axis=${ax}, radius=${r}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["arrow_block"] = function (block) {
    const name = varName(block, "NAME", "obj");
    const pos = val(block, "POS", "vector(0,0,0)");
    const ax = val(block, "AXIS", "vector(1,0,0)");
    const col = val(block, "COL", "color.yellow");
    const e = `arrow(pos=${pos}, axis=${ax}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["helix_block"] = function (block) {
    const name = varName(block, "NAME", "obj");
    const pos = val(block, "POS", "vector(0,0,0)");
    const ax = val(block, "AXIS", "vector(1,0,0)");
    const r = val(block, "RADIUS", "0.3");
    const col = val(block, "COL", "color.white");
    const e = `helix(pos=${pos}, axis=${ax}, radius=${r}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["helix_full_block"] = function (block) {
    const name = varName(block, "NAME", "spring");
    const pos = val(block, "POS", "vector(0,0,0)");
    const ax = val(block, "AXIS", "vector(1,0,0)");
    const r = val(block, "RADIUS", "0.3");
    const coils = val(block, "COILS", "10");
    const thick = val(block, "THICK", "0.05");
    const col = val(block, "COL", "color.white");
    const e = `helix(pos=${pos}, axis=${ax}, radius=${r}, coils=${coils}, thickness=${thick}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["label_block"] = function (block) {
    const text = escPy(block.getFieldValue("TEXT") || "");
    const pos = val(block, "POS", "vector(0,0,0)");
    return `label(text="${text}", pos=${pos}, box=False, opacity=0, color=color.white)\n`;
  };

  gen["label_full_block"] = function (block) {
    const name = varName(block, "NAME", "telemetry");
    const pos = val(block, "POS", "vector(0,5,0)");
    const text = escPy(block.getFieldValue("TEXT") || "");
    const h = val(block, "HEIGHT", "12");
    const e = `label(pos=${pos}, text="${text}", height=${h}, box=False, opacity=0, color=color.white)`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["local_light_block"] = function (block) {
    const pos = val(block, "POS", "vector(0,5,0)");
    const col = val(block, "COL", "color.white");
    return `local_light(pos=${pos}, color=${col})\n`;
  };

  /* ── Motion blocks ────────────────────────────────────── */
  gen["set_velocity_block"] = function (block) {
    const obj = varName(block, "OBJ", "ball");
    const v = val(block, "VEL", "vector(0,0,0)");
    return `${obj}.velocity = ${v}\n`;
  };

  gen["update_position_block"] = function (block) {
    const obj = varName(block, "OBJ", "ball");
    const dt = val(block, "DT", "dt");
    return `${obj}.pos = ${obj}.pos + ${obj}.velocity * ${dt}\n` + tr(`${obj}.pos`, `${obj}.pos`, block.id);
  };

  gen["apply_force_block"] = function (block) {
    const obj = varName(block, "OBJ", "ball");
    const a = val(block, "ACCEL", "vector(0,-9.81,0)");
    const dt = val(block, "DT", "dt");
    return `${obj}.velocity = ${obj}.velocity + ${a} * ${dt}\n` + tr(`${obj}.velocity`, `${obj}.velocity`, block.id);
  };

  gen["set_gravity_block"] = function (block) {
    return `g = vector(0, -${block.getFieldValue("G")}, 0)\n`;
  };

  /* ── Variable / assignment blocks ─────────────────────── */
  gen["set_scalar_block"] = function (block) {
    const name = varName(block, "NAME", "x");
    const v = val(block, "VALUE", "0");
    return `${name} = ${v}\n` + tr(name, name, block.id);
  };

  gen["set_attr_expr_block"] = function (block) {
    const obj = varName(block, "OBJ", "obj");
    const attr = (block.getFieldValue("ATTR") || "pos").trim();
    const v = val(block, "VALUE", "0");
    return `${obj}.${attr} = ${v}\n` + tr(`${obj}.${attr}`, `${obj}.${attr}`, block.id);
  };

  gen["add_attr_expr_block"] = function (block) {
    const obj = varName(block, "OBJ", "ball");
    const attr = (block.getFieldValue("ATTR") || "velocity").trim();
    const v = val(block, "VALUE", "0");
    return `${obj}.${attr} += ${v}\n` + tr(`${obj}.${attr}`, `${obj}.${attr}`, block.id);
  };

  /* ── Control blocks ───────────────────────────────────── */
  gen["rate_block"] = function (block) {
    return `rate(${block.getFieldValue("N")})\n`;
  };

  gen["forever_loop_block"] = function (block) {
    const body = Python.statementToCode(block, "BODY") || "  pass\n";
    return `while True:\n${body}`;
  };

  gen["for_range_block"] = function (block) {
    const v = varName(block, "VAR", "i");
    const start = block.getFieldValue("START");
    const stop = block.getFieldValue("STOP");
    const step = block.getFieldValue("STEP");
    const body = Python.statementToCode(block, "BODY") || "  pass\n";
    return `for ${v} in range(${start}, ${stop}, ${step}):\n${body}`;
  };

  gen["time_step_block"] = function (block) {
    const dt = block.getFieldValue("DT");
    return `dt = ${dt}\n` + tr("dt", "dt", block.id);
  };

  gen["if_block"] = function (block) {
    const cond = val(block, "COND", "True");
    const body = Python.statementToCode(block, "BODY") || "  pass\n";
    return `if ${cond}:\n${body}`;
  };

  gen["if_else_block"] = function (block) {
    const cond = val(block, "COND", "True");
    const bIf = Python.statementToCode(block, "BODY_IF") || "  pass\n";
    const bElse = Python.statementToCode(block, "BODY_ELSE") || "  pass\n";
    return `if ${cond}:\n${bIf}else:\n${bElse}`;
  };

  gen["break_loop_block"] = function () {
    return "break\n";
  };

  /* ── Utility blocks ───────────────────────────────────── */
  gen["comment_block"] = function (block) {
    return `# ${block.getFieldValue("TEXT") || ""}\n`;
  };

  gen["telemetry_update_block"] = function (block) {
    const label = varName(block, "LABEL", "telemetry");
    const m = (block.getFieldValue("M") || "").trim();
    const v = val(block, "V", "").trim();
    const d = block.getFieldValue("D") ?? 2;
    const u = (block.getFieldValue("U") || "").trim();
    if (!m || !v) return "";
    const uPart = u ? ` + " ${u}"` : "";
    const line = `"${m} = " + str(round(${v}, ${d}))${uPart}`;
    // First block in a telemetry chain sets the text; subsequent blocks append.
    const prev = block.getPreviousBlock();
    if (prev && prev.type === "telemetry_update_block" &&
        varName(prev, "LABEL", "telemetry") === label) {
      return `${label}.text = ${label}.text + "\\n" + ${line}\n`;
    }
    return `${label}.text = ${line}\n`;
  };

  /* ── Advanced blocks ──────────────────────────────────── */

  gen["python_raw_block"] = function (block) {
    return `${block.getFieldValue("CODE") || ""}\n`;
  };

  gen["python_raw_expr_block"] = function (block) {
    return [(block.getFieldValue("EXPR") || "0").trim(), Python.ORDER_ATOMIC];
  };

  /* ── Physics constants + preset blocks ───────────────── */
  gen["physics_const_block"] = function (block) {
    const c = block.getFieldValue("CONST") || "g";
    if (c === "__NEW__") {
      // Will be handled by the validator; fallback to 0
      return ["0", Python.ORDER_ATOMIC];
    }
    const map = {
      g:     "9.81",
      G:     "6.674e-11",
      pi:    "pi",
      euler: "2.71828",
      c:     "3e8",
      ke:    "8.988e9",
      h:     "6.626e-34",
      me:    "9.109e-31",
      mp:    "1.673e-27",
    };
    // If not in map, it's a custom constant — emit its name directly
    return [map[c] || c, Python.ORDER_ATOMIC];
  };

  gen["preset_sphere_block"] = function (block) {
    const name = varName(block, "NAME", "ball");
    const x   = block.getFieldValue("X");
    const y   = block.getFieldValue("Y");
    const z   = block.getFieldValue("Z");
    const r   = block.getFieldValue("R");
    const hex = block.getFieldValue("COL") || "#ff4444";
    const col = hexToVPythonColor(hex);
    const e = `sphere(pos=vector(${x}, ${y}, ${z}), radius=${r}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["preset_box_block"] = function (block) {
    const name = varName(block, "NAME", "wall");
    const x   = block.getFieldValue("X");
    const y   = block.getFieldValue("Y");
    const z   = block.getFieldValue("Z");
    const w   = block.getFieldValue("W");
    const h   = block.getFieldValue("H");
    const d   = block.getFieldValue("D");
    const hex = block.getFieldValue("COL") || "#4488ff";
    const col = hexToVPythonColor(hex);
    const e = `box(pos=vector(${x}, ${y}, ${z}), size=vector(${w}, ${h}, ${d}), color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  /* ── Graphs (Plan 10 R1) ─────────────────────────────── */
  gen["graph_display_block"] = function (block) {
    const title = escPy(block.getFieldValue("TITLE") || "My Graph");
    const xl = escPy(block.getFieldValue("XLABEL") || "");
    const yl = escPy(block.getFieldValue("YLABEL") || "");
    const raw = Python.statementToCode(block, "SERIES") || "";
    // statementToCode adds one indent level; strip it — series creations are
    // top-level code (sim_start_block's own idiom, same reason).
    const indent = Python.INDENT || "  ";
    const re = new RegExp("^" + indent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gm");
    const series = raw.replace(re, "");
    return `graph(title="${title}", xtitle="${xl}", ytitle="${yl}", fast=False)\n${series}`;
  };

  gen["graph_series_block"] = function (block) {
    const name = varName(block, "NAME", "data");
    const mode = block.getFieldValue("MODE") === "gdots" ? "gdots" : "gcurve";
    const hex = block.getFieldValue("COL") || "#0973d1";
    const col = hexToVPythonColor(hex);
    // label= puts the series name in the graph's own legend; GlowScript
    // binds the series to the most recently created graph — which is the
    // display block this sits inside.
    return `${name} = ${mode}(color=${col}, label="${escPy(name)}")\n`;
  };

  gen["graph_plot_block"] = function (block) {
    const series = varName(block, "SERIES", "data");
    const x = val(block, "X", "0");
    const y = val(block, "Y", "0");
    return `${series}.plot(${x}, ${y})\n`;
  };

  gen["define_const_block"] = function (block) {
    const name = varName(block, "NAME", "CONST");
    const v = val(block, "VALUE", "0");
    return `${name} = ${v}\n` + tr(name, name, block.id);
  };

  /* ── Simulation start / end blocks ────────────────────── */
  gen["sim_start_block"] = function (block) {
    const title = escPy(block.getFieldValue("TITLE") || "My Simulation");
    const raw = Python.statementToCode(block, "SETUP") || "";
    // statementToCode adds one indent level; strip it — setup is top-level code
    const indent = Python.INDENT || "  ";
    const re = new RegExp("^" + indent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gm");
    const setup = raw.replace(re, "");
    return `# === Simulation Start: ${title} ===\nscene.title = "${title}"\n${setup}`;
  };

  gen["sim_end_block"] = function (block) {
    const msg = escPy(block.getFieldValue("MSG") || "Simulation complete");
    return `# === Simulation End ===\nprint("${msg}")\n`;
  };

  gen["ds_start_block"] = function (block) {
    const title = escPy(block.getFieldValue("TITLE") || "My Analysis");
    const raw = Python.statementToCode(block, "BODY") || "";
    const indent = Python.INDENT || "  ";
    const re = new RegExp("^" + indent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gm");
    const body = raw.replace(re, "");
    return `# === Analysis: ${title} ===\n${body}`;
  };

  /* ── Physics constant: handle __NEW__ custom constant ── */
  // Intercept the dropdown change to create custom constants via popup
  // This is done by registering a validator on the field after workspace init
  // (See BlocklyWorkspace.js for the validator registration)

  /* ── 3D Math generators ──────────────────────────────────────── */
  gen["cross_product_block"] = function (block) {
    const a = val(block, "A", "vector(0,0,0)");
    const b = val(block, "B", "vector(0,0,0)");
    return [`cross(${a}, ${b})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["dot_product_block"] = function (block) {
    const a = val(block, "A", "vector(0,0,0)");
    const b = val(block, "B", "vector(0,0,0)");
    return [`dot(${a}, ${b})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["math_trig_block"] = function (block) {
    const op = block.getFieldValue("OP") || "sin";
    const x = val(block, "X", "0");
    return [`${op}(${x})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["vector_compose_block"] = function (block) {
    const x = val(block, "X", "0");
    const y = val(block, "Y", "0");
    const z = val(block, "Z", "0");
    return [`vector(${x}, ${y}, ${z})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["math_min_block"] = function (block) {
    const a = val(block, "A", "0");
    const b = val(block, "B", "0");
    return [`min(${a}, ${b})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["math_max_block"] = function (block) {
    const a = val(block, "A", "0");
    const b = val(block, "B", "0");
    return [`max(${a}, ${b})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["math_pow_block"] = function (block) {
    const base = val(block, "BASE", "0");
    const exp = val(block, "EXP", "2");
    return [`${base}**${exp}`, Python.ORDER_EXPONENTIATION || Python.ORDER_NONE];
  };

  gen["math_clamp_block"] = function (block) {
    const v = val(block, "VAL", "0");
    const lo = val(block, "LO", "0");
    const hi = val(block, "HI", "1");
    return [`max(${lo}, min(${v}, ${hi}))`, Python.ORDER_FUNCTION_CALL];
  };

  gen["rotate_object_block"] = function (block) {
    const obj = varName(block, "OBJ", "ball");
    const angle = val(block, "ANGLE", "0");
    const axis = val(block, "AXIS", "vector(0,1,0)");
    return `${obj}.rotate(angle=radians(${angle}), axis=${axis})\n`;
  };

  gen["scene_camera_block"] = function (block) {
    const prop = block.getFieldValue("PROP") || "center";
    const v = val(block, "VALUE", "vector(0,0,0)");
    return `scene.${prop} = ${v}\n`;
  };

  /* ── Data Science blocks (Python is reveal-only — execution is JS) ── */
  gen["ds_load_builtin_block"] = function (block) {
    const name = varName(block, "VAR", "df");
    const id = block.getFieldValue("ID") || "planets";
    return `${name} = load_dataset("${id}")\n`;
  };

  gen["ds_load_trace_block"] = function (block) {
    const name = varName(block, "VAR", "df");
    const label = (block.getFieldValue("DATASET_NAME") || "").trim();
    return `${name} = load_saved_dataset("${label}")\n`;
  };

  gen["ds_load_csv_block"] = function (block) {
    const name = varName(block, "VAR", "df");
    return `${name} = load_csv("your_file.csv")\n`;
  };

  gen["ds_show_table_block"] = function (block) {
    const name = varName(block, "VAR", "df");
    return `show_table(${name})\n`;
  };

  gen["ds_calc_mean_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = mean(${dsVar}, "${col}")\n`;
  };

  gen["ds_calc_median_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = median(${dsVar}, "${col}")\n`;
  };

  gen["ds_calc_min_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = min(${dsVar}, "${col}")\n`;
  };

  gen["ds_calc_max_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = max(${dsVar}, "${col}")\n`;
  };

  gen["ds_calc_sum_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = sum(${dsVar}, "${col}")\n`;
  };

  gen["ds_calc_stddev_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = spread(${dsVar}, "${col}")\n`;
  };

  gen["ds_show_first_n_block"] = function (block) {
    const dsVar = varName(block, "VAR", "df");
    const n = block.getFieldValue("N") || "5";
    return `show_first(${dsVar}, ${n})\n`;
  };

  gen["ds_count_rows_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    return `${result} = row_count(${dsVar})\n`;
  };

  gen["ds_count_unique_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = unique_count(${dsVar}, "${col}")\n`;
  };

  gen["ds_show_last_n_block"] = function (block) {
    const dsVar = varName(block, "VAR", "df");
    const n = block.getFieldValue("N") || "5";
    return `show_last(${dsVar}, ${n})\n`;
  };

  gen["ds_count_cols_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    return `${result} = column_count(${dsVar})\n`;
  };

  gen["ds_list_cols_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    return `${result} = column_names(${dsVar})\n`;
  };

  gen["ds_show_column_block"] = function (block) {
    const dsVar = varName(block, "VAR", "df");
    const col   = (block.getFieldValue("COL") || "value").trim();
    return `show_column(${dsVar}, "${col}")\n`;
  };

  gen["ds_calc_mode_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = most_common(${dsVar}, "${col}")\n`;
  };

  gen["ds_calc_range_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = range(${dsVar}, "${col}")\n`;
  };

  gen["ds_calc_count_block"] = function (block) {
    const result = varName(block, "RESULT", "result");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "value").trim();
    return `${result} = count_non_missing(${dsVar}, "${col}")\n`;
  };

  gen["ds_filter_eq_block"] = function (block) {
    const result = varName(block, "RESULT", "filtered");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    const val    = (block.getFieldValue("VALUE") || "").trim();
    return `${result} = filter(${dsVar}, ${col} == "${val}")\n`;
  };

  gen["ds_filter_gt_block"] = function (block) {
    const result = varName(block, "RESULT", "filtered");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    const val    = (block.getFieldValue("VALUE") || "0").trim();
    return `${result} = filter(${dsVar}, ${col} > ${val})\n`;
  };

  gen["ds_filter_lt_block"] = function (block) {
    const result = varName(block, "RESULT", "filtered");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    const val    = (block.getFieldValue("VALUE") || "0").trim();
    return `${result} = filter(${dsVar}, ${col} < ${val})\n`;
  };

  gen["ds_sort_asc_block"] = function (block) {
    const result = varName(block, "RESULT", "sorted");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `${result} = sort(${dsVar}, "${col}", ascending=True)\n`;
  };

  gen["ds_sort_desc_block"] = function (block) {
    const result = varName(block, "RESULT", "sorted");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `${result} = sort(${dsVar}, "${col}", ascending=False)\n`;
  };

  gen["ds_remove_missing_block"] = function (block) {
    const result = varName(block, "RESULT", "cleaned");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `${result} = drop_missing(${dsVar}, "${col}")\n`;
  };

  gen["ds_group_count_block"] = function (block) {
    const result = varName(block, "RESULT", "grouped");
    const dsVar  = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `${result} = count_per_group(${dsVar}, "${col}")\n`;
  };

  gen["ds_group_mean_block"] = function (block) {
    const result    = varName(block, "RESULT", "grouped");
    const dsVar     = varName(block, "VAR", "df");
    const valueCol  = (block.getFieldValue("VALUE_COL") || "value").trim();
    const groupCol  = (block.getFieldValue("GROUP_COL") || "group").trim();
    return `${result} = mean_per_group(${dsVar}, "${valueCol}", by="${groupCol}")\n`;
  };

  gen["ds_chart_bar_block"] = function (block) {
    const dsVar = varName(block, "VAR", "df");
    const xCol  = (block.getFieldValue("X_COL") || "x").trim();
    const yCol  = (block.getFieldValue("Y_COL") || "y").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `bar_chart(${dsVar}, x="${xCol}", y="${yCol}"${title ? `, title="${title}"` : ""})\n`;
  };

  gen["ds_chart_line_block"] = function (block) {
    const dsVar = varName(block, "VAR", "df");
    const xCol  = (block.getFieldValue("X_COL") || "x").trim();
    const yCol  = (block.getFieldValue("Y_COL") || "y").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `line_chart(${dsVar}, x="${xCol}", y="${yCol}"${title ? `, title="${title}"` : ""})\n`;
  };

  gen["ds_chart_scatter_block"] = function (block) {
    const dsVar = varName(block, "VAR", "df");
    const xCol  = (block.getFieldValue("X_COL") || "x").trim();
    const yCol  = (block.getFieldValue("Y_COL") || "y").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `scatter_plot(${dsVar}, x="${xCol}", y="${yCol}"${title ? `, title="${title}"` : ""})\n`;
  };

  gen["ds_chart_histogram_block"] = function (block) {
    const dsVar = varName(block, "VAR", "df");
    const col   = (block.getFieldValue("COL") || "value").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `histogram(${dsVar}, column="${col}"${title ? `, title="${title}"` : ""})\n`;
  };

  gen["ds_chart_box_block"] = function (block) {
    const dsVar    = varName(block, "VAR", "df");
    const valueCol = (block.getFieldValue("VALUE_COL") || "value").trim();
    const groupCol = (block.getFieldValue("GROUP_COL") || "").trim();
    const title    = (block.getFieldValue("TITLE") || "").trim();
    return `box_plot(${dsVar}, value="${valueCol}"${groupCol ? `, group="${groupCol}"` : ""}${title ? `, title="${title}"` : ""})\n`;
  };

  gen["ds_write_note_block"] = function (block) {
    const text = (block.getFieldValue("TEXT") || "").trim();
    return `# Note: ${text}\nprint(${JSON.stringify(text)})\n`;
  };

  gen["ds_print_result_block"] = function (block) {
    const name  = varName(block, "VAR", "result");
    const label = (block.getFieldValue("LABEL") || name).trim();
    return `print(f"${label}: {${name}}")\n`;
  };

  gen["ds_compare_results_block"] = function (block) {
    const nameA  = varName(block, "VAR_A", "result1");
    const labelA = (block.getFieldValue("LABEL_A") || nameA).trim();
    const nameB  = varName(block, "VAR_B", "result2");
    const labelB = (block.getFieldValue("LABEL_B") || nameB).trim();
    return `print(f"${labelA}: {${nameA}}  vs  ${labelB}: {${nameB}}")\n`;
  };

  gen["ds_state_conclusion_block"] = function (block) {
    const text = (block.getFieldValue("TEXT") || "").trim();
    return `# Conclusion\nprint(${JSON.stringify(text)})\n`;
  };

  gen["ds_export_table_block"] = function (block) {
    const name = varName(block, "VAR", "df");
    return `${name}.to_csv("export.csv", index=False)\n`;
  };

  gen["ds_show_python_block"] = function (_block) {
    return `# (Python shown in output panel)\n`;
  };

  gen["ds_find_missing_block"] = function (block) {
    const result = varName(block, "RESULT", "missing");
    const name   = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `${result} = ${name}[${name}["${col}"].isnull()]\n`;
  };

  gen["ds_show_one_cell_block"] = function (block) {
    const result = varName(block, "RESULT", "cell");
    const name   = varName(block, "VAR", "df");
    const row    = block.getFieldValue("ROW") || "0";
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `${result} = ${name}.iloc[${row}]["${col}"]\n`;
  };

  gen["ds_all_stats_block"] = function (block) {
    const name = varName(block, "VAR", "df");
    const col  = (block.getFieldValue("COL") || "col").trim();
    return `print(${name}["${col}"].describe())\n`;
  };

  gen["ds_compare_columns_block"] = function (block) {
    const name = varName(block, "VAR", "df");
    const colA = (block.getFieldValue("COL_A") || "col1").trim();
    const colB = (block.getFieldValue("COL_B") || "col2").trim();
    return `print(${name}[["${colA}", "${colB}"]].describe())\n`;
  };

  gen["ds_save_chart_block"] = function (block) {
    const name      = varName(block, "VAR", "df");
    const chartType = (block.getFieldValue("CHART_TYPE") || "bar").trim();
    const xCol      = (block.getFieldValue("X_COL") || "x").trim();
    const yCol      = (block.getFieldValue("Y_COL") || "y").trim();
    return `${name}.plot(kind="${chartType}", x="${xCol}", y="${yCol}").get_figure().savefig("chart.png")\n`;
  };

  gen["ds_filter_and_block"] = function (block) {
    const result = varName(block, "RESULT", "filtered");
    const name   = varName(block, "VAR", "df");
    const colA   = (block.getFieldValue("COL_A") || "col").trim();
    const valA   = (block.getFieldValue("VAL_A") || "").trim();
    const colB   = (block.getFieldValue("COL_B") || "col").trim();
    const valB   = (block.getFieldValue("VAL_B") || "").trim();
    return `${result} = ${name}[(${name}["${colA}"] == "${valA}") & (${name}["${colB}"] == "${valB}")]\n`;
  };

  gen["ds_filter_or_block"] = function (block) {
    const result = varName(block, "RESULT", "filtered");
    const name   = varName(block, "VAR", "df");
    const colA   = (block.getFieldValue("COL_A") || "col").trim();
    const valA   = (block.getFieldValue("VAL_A") || "").trim();
    const colB   = (block.getFieldValue("COL_B") || "col").trim();
    const valB   = (block.getFieldValue("VAL_B") || "").trim();
    return `${result} = ${name}[(${name}["${colA}"] == "${valA}") | (${name}["${colB}"] == "${valB}")]\n`;
  };

  gen["ds_identify_type_block"] = function (block) {
    const result = varName(block, "RESULT", "type");
    const name   = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `${result} = str(${name}["${col}"].dtype)\n`;
  };

  /* ── New physics-stats blocks ── */
  gen["ds_add_column_transform_block"] = function (block) {
    const result    = varName(block, "RESULT", "df2");
    const name      = varName(block, "VAR", "df");
    const newCol    = (block.getFieldValue("NEW_COL") || "new_col").trim();
    const transform = block.getFieldValue("TRANSFORM") || "ln";
    const srcCol    = (block.getFieldValue("SOURCE_COL") || "col").trim();
    const pyFn = { ln: "np.log", log10: "np.log10", sqrt: "np.sqrt", square: "np.square", reciprocal: "lambda x: 1/x" };
    const fn = pyFn[transform] || "np.log";
    return `${result} = ${name}.copy()\n${result}["${newCol}"] = (${fn})(${name}["${srcCol}"])\n`;
  };

  gen["ds_multiply_columns_block"] = function (block) {
    const result = varName(block, "RESULT", "df2");
    const name   = varName(block, "VAR", "df");
    const newCol = (block.getFieldValue("NEW_COL") || "product").trim();
    const colA   = (block.getFieldValue("COL_A") || "col1").trim();
    const colB   = (block.getFieldValue("COL_B") || "col2").trim();
    return `${result} = ${name}.copy()\n${result}["${newCol}"] = ${name}["${colA}"] * ${name}["${colB}"]\n`;
  };

  gen["ds_calc_std_error_block"] = function (block) {
    const result = varName(block, "RESULT", "se");
    const name   = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `from scipy import stats\n${result} = stats.sem(${name}["${col}"].dropna())\n`;
  };

  gen["ds_print_uncertainty_block"] = function (block) {
    const mean  = varName(block, "MEAN_VAR", "mean_val");
    const se    = varName(block, "SE_VAR", "se");
    const label = (block.getFieldValue("LABEL") || "measurement").trim();
    return `print(f"${label}: {${mean}:.4g} ± {${se}:.3g}  ({abs(${se}/${mean})*100:.1f}% relative)")\n`;
  };

  gen["ds_calc_relative_uncertainty_block"] = function (block) {
    const result = varName(block, "RESULT", "rel_unc");
    const mean   = varName(block, "MEAN_VAR", "mean_val");
    const se     = varName(block, "SE_VAR", "se");
    return `${result} = abs(${se} / ${mean}) * 100 if ${mean} != 0 else None\n`;
  };

  gen["ds_linear_regression_block"] = function (block) {
    const result = varName(block, "RESULT", "fit");
    const name   = varName(block, "VAR", "df");
    const xCol   = (block.getFieldValue("X_COL") || "x").trim();
    const yCol   = (block.getFieldValue("Y_COL") || "y").trim();
    return `from scipy import stats as _stats\n_res = _stats.linregress(${name}["${xCol}"].dropna(), ${name}["${yCol}"].dropna())\n${result} = {"slope": _res.slope, "intercept": _res.intercept, "rSquared": _res.rvalue**2, "n": len(${name})}\n`;
  };

  gen["ds_chart_scatter_fit_block"] = function (block) {
    const name  = varName(block, "VAR", "df");
    const xCol  = (block.getFieldValue("X_COL") || "x").trim();
    const yCol  = (block.getFieldValue("Y_COL") || "y").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `scatter_plot(${name}, x="${xCol}", y="${yCol}"${title ? `, title="${title}"` : ""})\n`;
  };

  gen["ds_correlation_block"] = function (block) {
    const result = varName(block, "RESULT", "r");
    const name   = varName(block, "VAR", "df");
    const colA   = (block.getFieldValue("COL_A") || "col1").trim();
    const colB   = (block.getFieldValue("COL_B") || "col2").trim();
    return `${result} = ${name}["${colA}"].corr(${name}["${colB}"])\n`;
  };

  gen["ds_calc_percentile_block"] = function (block) {
    const result = varName(block, "RESULT", "p_val");
    const name   = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    const p      = parseFloat(block.getFieldValue("P") || "25");
    return `${result} = ${name}["${col}"].quantile(${p / 100})\n`;
  };

  gen["ds_calc_iqr_block"] = function (block) {
    const result = varName(block, "RESULT", "iqr_val");
    const name   = varName(block, "VAR", "df");
    const col    = (block.getFieldValue("COL") || "col").trim();
    return `from scipy.stats import iqr as _iqr\n${result} = _iqr(${name}["${col}"].dropna())\n`;
  };

  initialized = true;
}


/* ================================================================
   generatePythonFromWorkspace
   ================================================================ */
export function generatePythonFromWorkspace(workspace) {
  if (!workspace) return "# Blockly not available\n";

  const Python = getPythonGen(Blockly);
  if (!Python) return "# Python generator not loaded\n";

  // Clear previous trace registry before generating new code
  clearTraceRegistry();

  try {
    const code = Python.workspaceToCode(workspace);
    return code && code.trim().length > 0
      ? code
      : "# Drag blocks here to build your VPython model\n";
  } catch (err) {
    console.error("Code generation error:", err);
    return "# Code generation error -- see console\n";
  }
}

