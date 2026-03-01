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
 */

let initialized = false;

/* ── Custom constants registry (shared: push here to add to dropdown) ── */
export const customConstantsRegistry = [];

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
      message0: "vector( %1 , %2 , %3 )",
      args0: [
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
      ],
      output: null,
      colour: 230,
      tooltip: "A 3D vector. Snap into pos, axis, size, velocity, or colour slots.",
    },
    {
      type: "colour_block",
      message0: "colour %1 %2",
      args0: [
        {
          type: "field_dropdown",
          name: "MODE",
          options: [
            ["\uD83C\uDFA8 custom",  "CUSTOM"],
            ["\uD83D\uDD34 red",     "RED"],
            ["\uD83D\uDFE0 orange",  "ORANGE"],
            ["\uD83D\uDFE1 yellow",  "YELLOW"],
            ["\uD83D\uDFE2 green",   "GREEN"],
            ["\uD83D\uDD35 blue",    "BLUE"],
            ["\uD83D\uDFE3 purple",  "PURPLE"],
            ["\u26AA white",         "WHITE"],
            ["\u26AB black",         "BLACK"],
            ["\uD83D\uDD18 gray",    "GRAY"],
            ["\uD83D\uDFE4 brown",   "BROWN"],
            ["cyan",                 "CYAN"],
            ["magenta",              "MAGENTA"],
          ],
        },
        { type: "field_colour", name: "CUSTOM", colour: "#ff0000" },
      ],
      output: null,
      colour: 230,
      tooltip: "Pick a named colour or click the swatch for a fully custom colour.",
    },
    {
      type: "set_colour_var_block",
      message0: "%1 = \uD83C\uDFA8 %2",
      args0: [
        { type: "field_variable", name: "NAME", variable: "c_colour" },
        { type: "field_colour",   name: "COL",  colour: "#ffffff" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 30,
      tooltip: "Set a colour variable. Click the swatch to choose any colour.",
    },
    {
      type: "expr_block",
      message0: "( %1 )",
      args0: [{ type: "field_input", name: "EXPR", text: "0" }],
      output: null,
      colour: 230,
      tooltip:
        "Type any expression. Snaps into number, vector, or colour slots.",
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
      output: null,
      colour: 230,
      tooltip: "Read a property of an object variable: ball.velocity, ball.pos, ball.radius, etc.",
    },
    {
      type: "get_component_block",
      message0: "%1 . %2",
      args0: [
        { type: "input_value", name: "VEC" },
        {
          type: "field_dropdown",
          name: "COMP",
          options: [["x", "x"], ["y", "y"], ["z", "z"]],
        },
      ],
      inputsInline: true,
      output: null,
      colour: 230,
      tooltip: "Get the x, y, or z component of a vector. Chain with an object property block: ball.pos → .y gives ball.pos.y.",
    },
    {
      type: "mag_block",
      message0: "mag( %1 )",
      args0: [{ type: "input_value", name: "VEC" }],
      inputsInline: true,
      output: null,
      colour: 230,
      tooltip: "Magnitude (scalar length) of a vector. E.g. snap in an object property block like ball.velocity to get speed.",
    },
    {
      type: "norm_block",
      message0: "norm( %1 )",
      args0: [{ type: "input_value", name: "VEC" }],
      inputsInline: true,
      output: null,
      colour: 230,
      tooltip: "Unit vector in the direction of the input. Snap in an object property block like ball.pos to get its direction.",
    },

    /* ══════════════════════════════════════════════════════
       OBJECT BLOCKS — input_value slots for composability
       ══════════════════════════════════════════════════════ */

    /* ── Sphere ─────────────────────────────────────────── */
    {
      type: "sphere_block",
      message0: "%1 = sphere  pos %2  radius %3  colour %4",
      args0: [
        { type: "field_variable", name: "NAME", variable: "ball" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a sphere. Snap in a vector for pos, number for radius, colour block.",
    },

    /* ── Sphere + trail ────────────────────────────────── */
    {
      type: "sphere_trail_block",
      message0: "%1 = sphere+trail  pos %2  radius %3  colour %4  trail_r %5  trail_col %6  keep %7",
      args0: [
        { type: "field_variable", name: "NAME", variable: "ball" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
        { type: "input_value", name: "TRAIL_R" },
        { type: "input_value", name: "TRAIL_COL" },
        { type: "input_value", name: "RETAIN" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Sphere that leaves a trail. Trail options must be set at creation time.",
    },

    /* ── Glowing / emissive sphere ─────────────────────── */
    {
      type: "sphere_emissive_block",
      message0: "%1 = glowing sphere  pos %2  radius %3  colour %4  opacity %5",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
        { type: "input_value", name: "OPACITY" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Self-lit sphere (emissive). Great for suns, stars, and glowing particles.",
    },

    /* ── Box ────────────────────────────────────────────── */
    {
      type: "box_block",
      message0: "%1 = box  pos %2  size %3  colour %4",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "SIZE" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a box. Snap in vectors for position and size.",
    },

    /* ── Box + opacity ──────────────────────────────────── */
    {
      type: "box_opacity_block",
      message0: "%1 = box  pos %2  size %3  colour %4  opacity %5",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "SIZE" },
        { type: "input_value", name: "COL" },
        { type: "input_value", name: "OPACITY" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Semi-transparent box. Opacity: 0 = invisible, 1 = solid.",
    },

    /* ── Cylinder ───────────────────────────────────────── */
    {
      type: "cylinder_block",
      message0: "%1 = cylinder  pos %2  axis %3  radius %4  colour %5",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "AXIS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a cylinder. Axis vector sets direction and length.",
    },

    /* ── Arrow ──────────────────────────────────────────── */
    {
      type: "arrow_block",
      message0: "%1 = arrow  pos %2  axis %3  colour %4",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "AXIS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create an arrow. Update axis to animate direction and length.",
    },

    /* ── Helix (basic) ─────────────────────────────────── */
    {
      type: "helix_block",
      message0: "%1 = helix  pos %2  axis %3  radius %4  colour %5",
      args0: [
        { type: "field_variable", name: "NAME", variable: "obj" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "AXIS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a helix / spring. Update axis to stretch or compress it.",
    },

    /* ── Helix (full) ──────────────────────────────────── */
    {
      type: "helix_full_block",
      message0: "%1 = helix  pos %2  axis %3  radius %4  coils %5  thickness %6  colour %7",
      args0: [
        { type: "field_variable", name: "NAME", variable: "spring" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "AXIS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COILS" },
        { type: "input_value", name: "THICK" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Helix with specific coil count and thickness.",
    },

    /* ── Label (simple) ────────────────────────────────── */
    {
      type: "label_block",
      message0: "label %1  at %2",
      args0: [
        { type: "field_input", name: "TEXT", text: "hello" },
        { type: "input_value", name: "POS" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a floating text label in the 3D scene.",
    },

    /* ── Label (full) ──────────────────────────────────── */
    {
      type: "label_full_block",
      message0: "%1 = label  pos %2  text %3  height %4",
      args0: [
        { type: "field_variable", name: "NAME", variable: "telemetry" },
        { type: "input_value", name: "POS" },
        { type: "field_input", name: "TEXT", text: "" },
        { type: "input_value", name: "HEIGHT" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Named label. Use for live telemetry displays.",
    },

    /* ── Local light ───────────────────────────────────── */
    {
      type: "local_light_block",
      message0: "local light  pos %1  colour %2",
      args0: [
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
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
        { type: "input_value", name: "VEL" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 45,
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
      colour: 45,
      tooltip: "Move object by velocity \u00d7 dt (Euler step).",
    },
    {
      type: "apply_force_block",
      message0: "%1 .velocity += %2 \u00d7 %3",
      args0: [
        { type: "field_variable", name: "OBJ", variable: "ball" },
        { type: "input_value", name: "ACCEL" },
        { type: "input_value", name: "DT" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Add acceleration \u00d7 dt to object's velocity.",
    },
    {
      type: "set_gravity_block",
      message0: "gravity  g = %1 m/s\u00b2 (\u2193 Y)",
      args0: [{ type: "field_number", name: "G", value: 9.81, min: 0 }],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
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
      colour: 30,
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
      colour: 30,
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
      colour: 30,
      tooltip: "Add to an object's property. E.g. ball.velocity += a*dt",
    },

    /* ══════════════════════════════════════════════════════
       CONTROL BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "rate_block",
      message0: "rate( %1 )",
      args0: [{ type: "field_number", name: "N", value: 100, min: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Set animation speed (frames per second).",
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
      colour: 260,
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
      colour: 260,
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
      colour: 260,
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
      colour: 260,
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
      colour: 260,
      tooltip: "If/else: run the first set if true, otherwise run the second set. Snap a comparison block into the slot.",
    },
    {
      type: "break_loop_block",
      message0: "break loop",
      previousStatement: null,
      nextStatement: null,
      colour: 260,
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
      colour: 260,
      tooltip: "Add a comment to your code.",
    },

    /* ── Telemetry ─────────────────────────────────────── */
    {
      type: "telemetry_update_block",
      message0: "update %1 display",
      args0: [{ type: "field_variable", name: "LABEL", variable: "telemetry" }],
      message1: "%1 = round( %2 , %3 dp ) %4",
      args1: [
        { type: "field_input",  name: "M1", text: "t" },
        { type: "input_value",  name: "V1" },
        { type: "field_number", name: "D1", value: 2 },
        { type: "field_input",  name: "U1", text: "s" },
      ],
      message2: "%1 = round( %2 , %3 dp ) %4",
      args2: [
        { type: "field_input",  name: "M2", text: "" },
        { type: "input_value",  name: "V2" },
        { type: "field_number", name: "D2", value: 2 },
        { type: "field_input",  name: "U2", text: "" },
      ],
      message3: "%1 = round( %2 , %3 dp ) %4",
      args3: [
        { type: "field_input",  name: "M3", text: "" },
        { type: "input_value",  name: "V3" },
        { type: "field_number", name: "D3", value: 2 },
        { type: "field_input",  name: "U3", text: "" },
      ],
      message4: "%1 = round( %2 , %3 dp ) %4",
      args4: [
        { type: "field_input",  name: "M4", text: "" },
        { type: "input_value",  name: "V4" },
        { type: "field_number", name: "D4", value: 2 },
        { type: "field_input",  name: "U4", text: "" },
      ],
      message5: "%1 = round( %2 , %3 dp ) %4",
      args5: [
        { type: "field_input",  name: "M5", text: "" },
        { type: "input_value",  name: "V5" },
        { type: "field_number", name: "D5", value: 2 },
        { type: "field_input",  name: "U5", text: "" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 30,
      tooltip:
        "Show live measurements. Snap a value block (e.g. object property, mag, expr) into each row. Up to 5 lines \u2014 leave name blank to skip.",
    },

    /* ══════════════════════════════════════════════════════
       ADVANCED / RAW BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "python_raw_block",
      message0: "code: %1",
      args0: [{ type: "field_input", name: "CODE", text: "# custom" }],
      previousStatement: null,
      nextStatement: null,
      colour: 10,
      tooltip: "Insert any Python statement.",
    },
    {
      type: "python_raw_expr_block",
      message0: "expr: %1",
      args0: [{ type: "field_input", name: "EXPR", text: "0" }],
      output: null,
      colour: 10,
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
      colour: 210,
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
      colour: 210,
      tooltip:
        "Quick-create a box: variable name, position, width \u00d7 height \u00d7 depth, colour — all in one block.",
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
      colour: 230,
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
      colour: 120,
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
      colour: 0,
      tooltip: "Marks the end of a simulation. Prints a completion message.",
    },
  ]);

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
      this.setColour(230);
      this.setTooltip(
        "Standard physics constant. g=9.81, G=6.674e-11, pi, e=2.718, c=3e8, k_e=8.988e9, h=6.626e-34, m_e=9.109e-31, m_p=1.673e-27."
      );
    },
  };

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
    const customHex = block.getFieldValue("CUSTOM") || block.getFieldValue("COL") || "#ffffff";
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

  /* ── Object blocks ────────────────────────────────────── */
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
    return `${obj}.pos = ${obj}.pos + ${obj}.velocity * ${dt}\n`;
  };

  gen["apply_force_block"] = function (block) {
    const obj = varName(block, "OBJ", "ball");
    const a = val(block, "ACCEL", "vector(0,-9.81,0)");
    const dt = val(block, "DT", "dt");
    return `${obj}.velocity = ${obj}.velocity + ${a} * ${dt}\n`;
  };

  gen["set_gravity_block"] = function (block) {
    return `g = vector(0, -${block.getFieldValue("G")}, 0)\n`;
  };

  /* ── Variable / assignment blocks ─────────────────────── */
  gen["set_scalar_block"] = function (block) {
    const name = varName(block, "NAME", "x");
    const v = val(block, "VALUE", "0");
    return `${name} = ${v}\n`;
  };

  gen["set_attr_expr_block"] = function (block) {
    const obj = varName(block, "OBJ", "obj");
    const attr = (block.getFieldValue("ATTR") || "pos").trim();
    const v = val(block, "VALUE", "0");
    return `${obj}.${attr} = ${v}\n`;
  };

  gen["add_attr_expr_block"] = function (block) {
    const obj = varName(block, "OBJ", "ball");
    const attr = (block.getFieldValue("ATTR") || "velocity").trim();
    const v = val(block, "VALUE", "0");
    return `${obj}.${attr} += ${v}\n`;
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
    return `dt = ${block.getFieldValue("DT")}\n`;
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
    const lines = [];
    for (let i = 1; i <= 5; i++) {
      const m = (block.getFieldValue("M" + i) || "").trim();
      const v = val(block, "V" + i, "").trim();
      const d = block.getFieldValue("D" + i);
      const u = (block.getFieldValue("U" + i) || "").trim();
      if (m && v) {
        const uPart = u ? ` + " ${u}"` : "";
        lines.push(`"${m} = " + str(round(${v}, ${d}))${uPart}`);
      }
    }
    if (lines.length === 0) return `${label}.text = ""\n`;
    return `${label}.text = ${lines.join(' + "\\n" + ')}\n`;
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

  gen["define_const_block"] = function (block) {
    const name = varName(block, "NAME", "CONST");
    const v = val(block, "VALUE", "0");
    return `${name} = ${v}\n`;
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

  /* ── Physics constant: handle __NEW__ custom constant ── */
  // Intercept the dropdown change to create custom constants via popup
  // This is done by registering a validator on the field after workspace init
  // (See BlocklyWorkspace.js for the validator registration)

  initialized = true;
}

/* ── Block catalogue — used by the search bar ───────────── */
export const BLOCK_CATALOGUE = [
  // Starter
  { type: "preset_sphere_block",   label: "Quick Sphere / Ball",           category: "\uD83D\uDE80 Starter", keywords: ["sphere","ball","create","quick","object"] },
  { type: "preset_box_block",      label: "Quick Box / Wall / Floor",      category: "\uD83D\uDE80 Starter", keywords: ["box","wall","floor","create","quick","object"] },
  { type: "physics_const_block",   label: "Physics Constant  (g, G, \u03c0\u2026)", category: "\uD83D\uDE80 Starter", keywords: ["constant","g","gravity","pi","G","c","h"] },
  { type: "time_step_block",       label: "Time step  dt",                 category: "\uD83D\uDE80 Starter", keywords: ["dt","time","step","timestep"] },
  { type: "set_gravity_block",     label: "Gravity  (g = 9.81)",           category: "\uD83D\uDE80 Starter", keywords: ["gravity","g","9.81","downward"] },
  { type: "forever_loop_block",    label: "Forever loop",                  category: "\uD83D\uDE80 Starter", keywords: ["loop","forever","while","simulation","main"] },
  { type: "rate_block",            label: "Rate  (animation fps)",         category: "\uD83D\uDE80 Starter", keywords: ["rate","fps","speed","animation"] },
  { type: "update_position_block", label: "Update position  pos += v\u00d7dt", category: "\uD83D\uDE80 Starter", keywords: ["position","pos","move","update","euler"] },
  { type: "apply_force_block",     label: "Apply force  v += a\u00d7dt",   category: "\uD83D\uDE80 Starter", keywords: ["force","velocity","acceleration","apply","gravity"] },
  { type: "if_block",              label: "If  condition",                 category: "\uD83D\uDE80 Starter", keywords: ["if","when","condition","check"] },
  { type: "if_else_block",         label: "If / Else",                     category: "\uD83D\uDE80 Starter", keywords: ["if","else","condition","branch","otherwise"] },
  // Values
  { type: "define_const_block",    label: "Define constant  (const NAME = \u2026)",  category: "Values", keywords: ["constant","define","const","mass","spring","charge","named","reuse"] },
  { type: "physics_const_block",   label: "Physics Constant  (g, G, \u03c0\u2026)", category: "Values", keywords: ["constant","g","G","pi","c","h","m_e","m_p"] },
  { type: "vector_block",          label: "Vector  (x, y, z)",             category: "Values", keywords: ["vector","vec","position","velocity","axis"] },
  { type: "colour_block",          label: "Colour",                        category: "Values", keywords: ["colour","color","red","blue","green","hue"] },
  { type: "expr_block",            label: "Expression  (any Python)",      category: "Values", keywords: ["expression","expr","formula","code","custom"] },
  { type: "get_prop_block",        label: "Object property  (ball.pos)",   category: "Values", keywords: ["property","prop","dot","ball","pos","velocity","radius"] },
  { type: "get_component_block",   label: "Vector component  .x .y .z",   category: "Values", keywords: ["component","x","y","z","scalar"] },
  { type: "mag_block",             label: "Magnitude  mag(vec)",           category: "Values", keywords: ["magnitude","mag","speed","length","scalar"] },
  { type: "norm_block",            label: "Unit vector  norm(vec)",        category: "Values", keywords: ["normalise","norm","unit","direction","hat"] },
  // Objects
  { type: "preset_sphere_block",   label: "Quick Sphere (preset)",         category: "Objects", keywords: ["sphere","preset","quick","ball","create"] },
  { type: "preset_box_block",      label: "Quick Box (preset)",            category: "Objects", keywords: ["box","preset","quick","wall","floor","create"] },
  { type: "sphere_block",          label: "Sphere",                        category: "Objects", keywords: ["sphere","ball","circle","round"] },
  { type: "sphere_trail_block",    label: "Sphere + trail",                category: "Objects", keywords: ["sphere","trail","track","path","particle"] },
  { type: "sphere_emissive_block", label: "Glowing sphere",                category: "Objects", keywords: ["sphere","glow","emissive","star","sun","light"] },
  { type: "box_block",             label: "Box",                           category: "Objects", keywords: ["box","cube","wall","floor","ground","rect"] },
  { type: "box_opacity_block",     label: "Box (transparent)",             category: "Objects", keywords: ["box","opacity","transparent","glass","semi"] },
  { type: "cylinder_block",        label: "Cylinder",                      category: "Objects", keywords: ["cylinder","rod","pipe","tube","circle"] },
  { type: "arrow_block",           label: "Arrow",                         category: "Objects", keywords: ["arrow","vector","force","direction","axis"] },
  { type: "helix_block",           label: "Helix / Spring",                category: "Objects", keywords: ["helix","spring","coil","spiral"] },
  { type: "helix_full_block",      label: "Helix detailed",                category: "Objects", keywords: ["helix","spring","coils","thickness","detailed"] },
  { type: "label_block",           label: "Text label",                    category: "Objects", keywords: ["label","text","display","print","show"] },
  { type: "label_full_block",      label: "Live display label",            category: "Objects", keywords: ["label","telemetry","live","display","hud"] },
  { type: "local_light_block",     label: "Point light source",            category: "Objects", keywords: ["light","lamp","glow","local","point"] },
  // Motion
  { type: "set_velocity_block",    label: "Set velocity",                  category: "Motion", keywords: ["velocity","speed","v","motion","initial","set"] },
  { type: "update_position_block", label: "Update position",               category: "Motion", keywords: ["position","pos","update","move","euler","step"] },
  { type: "apply_force_block",     label: "Apply force / acceleration",    category: "Motion", keywords: ["force","acceleration","gravity","apply","net"] },
  { type: "set_gravity_block",     label: "Gravity constant",              category: "Motion", keywords: ["gravity","g","9.81","vector","down"] },
  // State
  { type: "define_const_block",    label: "Define constant",               category: "State", keywords: ["constant","define","const","named","global"] },
  { type: "set_scalar_block",      label: "Set variable  (x = \u2026)",   category: "State", keywords: ["variable","set","assign","scalar","number"] },
  { type: "set_attr_expr_block",   label: "Set object attribute",          category: "State", keywords: ["set","attribute","property","object","dot"] },
  { type: "add_attr_expr_block",   label: "Add to attribute  (+=)",        category: "State", keywords: ["add","increment","plus","attribute","update"] },
  { type: "telemetry_update_block",label: "Live display update",           category: "State", keywords: ["telemetry","display","live","update","show","hud"] },
  // Control
  { type: "time_step_block",       label: "Time step  dt",                 category: "Control", keywords: ["dt","time","step","timestep"] },
  { type: "rate_block",            label: "Rate  (fps)",                   category: "Control", keywords: ["rate","fps","animation","framerate"] },
  { type: "forever_loop_block",    label: "Forever loop",                  category: "Control", keywords: ["loop","forever","while","main","simulation"] },
  { type: "for_range_block",       label: "For loop  (range)",             category: "Control", keywords: ["for","loop","range","repeat","iterate","i"] },
  { type: "if_block",              label: "If  condition",                 category: "Control", keywords: ["if","condition","when","check"] },
  { type: "if_else_block",         label: "If / Else",                     category: "Control", keywords: ["if","else","condition","branch"] },
  { type: "break_loop_block",      label: "Break loop",                    category: "Control", keywords: ["break","stop","exit","end","quit"] },
  { type: "comment_block",         label: "Comment / Note",                category: "Control", keywords: ["comment","note","describe","explain","text"] },
  // Advanced
  { type: "python_raw_block",      label: "Raw Python code",               category: "Advanced", keywords: ["python","code","raw","custom","advanced","statement"] },
  { type: "python_raw_expr_block", label: "Raw Python expression",         category: "Advanced", keywords: ["python","expression","raw","custom","advanced","value"] },
  // Standard Blockly (commonly searched)
  { type: "logic_compare",         label: "Compare  (< > == \u2260)",      category: "Logic", keywords: ["compare","less","greater","equal","condition","lt","gt"] },
  { type: "logic_operation",       label: "AND / OR",                      category: "Logic", keywords: ["and","or","logic","boolean","both"] },
  { type: "logic_negate",          label: "NOT",                           category: "Logic", keywords: ["not","negate","invert","false","true"] },
  { type: "logic_boolean",         label: "True / False",                  category: "Logic", keywords: ["true","false","boolean"] },
  { type: "math_number",           label: "Number",                        category: "Math", keywords: ["number","value","digit","constant","scalar"] },
  { type: "math_arithmetic",       label: "Maths  (+ \u2212 \u00d7 \u00f7)", category: "Math", keywords: ["add","subtract","multiply","divide","arithmetic","math"] },
  { type: "math_single",           label: "Math function  (sqrt, abs\u2026)", category: "Math", keywords: ["sqrt","abs","square","root","power","log","math"] },
  { type: "math_trig",             label: "Trig  (sin, cos, tan)",         category: "Math", keywords: ["sin","cos","tan","trig","angle","radians","degrees"] },
  { type: "math_constant",         label: "Math constant  (\u03c0, e, \u221a2)", category: "Math", keywords: ["pi","e","constant","phi","golden"] },
  // Simulation structure
  { type: "sim_start_block",       label: "Simulation Start",              category: "\uD83D\uDE80 Starter", keywords: ["start","begin","simulation","setup","init"] },
  { type: "sim_end_block",         label: "Simulation End",                category: "\uD83D\uDE80 Starter", keywords: ["end","stop","finish","simulation","complete"] },
];

/* ================================================================
   generatePythonFromWorkspace
   ================================================================ */
export function generatePythonFromWorkspace(workspace) {
  const Blockly = window.Blockly;
  if (!workspace || !Blockly) return "# Blockly not available\n";

  const Python = getPythonGen(Blockly);
  if (!Python) return "# Python generator not loaded\n";

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

