/**
 * blocklyGenerator.js — Composable VPython Block System
 *
 * Scratch-inspired design: small VALUE blocks (vector, colour, expression)
 * snap into INPUT SLOTS on larger OBJECT / MOTION / VARIABLE blocks.
 *
 * Categories:
 *   Values   – vector, colour picker, expression  (output connectors)
 *   Objects  – sphere, box, cylinder, arrow, helix, label  (input slots)
 *   Motion   – velocity, position update, acceleration  (input slots)
 *   Variables – set var, set property, increment property (input slots)
 *   Control  – loops, conditionals, rate, time step
 *   Scene    – setup, range, camera, lighting
 *   Advanced – raw Python, exec
 */

let initialized = false;

function getPythonGen(Blockly) {
  return Blockly.Python || null;
}

/* ── Colour helper ──────────────────────────────────────── */
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
      message0: "colour %1",
      args0: [{ type: "field_colour", name: "COL", colour: "#ff0000" }],
      output: null,
      colour: 20,
      tooltip: "Pick a colour. Snaps into any colour slot.",
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

    /* ══════════════════════════════════════════════════════
       OBJECT BLOCKS — input_value slots for composability
       ══════════════════════════════════════════════════════ */

    /* ── Sphere ─────────────────────────────────────────── */
    {
      type: "sphere_block",
      message0: "%1 = sphere  pos %2  radius %3  colour %4",
      args0: [
        { type: "field_input", name: "NAME", text: "ball" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a sphere. Snap in vector, number, colour blocks.",
    },

    /* ── Sphere + trail ────────────────────────────────── */
    {
      type: "sphere_trail_block",
      message0: "%1 = sphere + trail  pos %2  radius %3  colour %4",
      args0: [
        { type: "field_input", name: "NAME", text: "ball" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      message1: "trail radius %1  trail colour %2  keep %3 pts",
      args1: [
        { type: "input_value", name: "TRAIL_R" },
        { type: "input_value", name: "TRAIL_COL" },
        { type: "input_value", name: "RETAIN" },
      ],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip:
        "Sphere that leaves a trail. Trail must be set at creation time.",
    },

    /* ── Glowing sphere ────────────────────────────────── */
    {
      type: "sphere_emissive_block",
      message0: "%1 = glowing sphere  pos %2  radius %3  colour %4",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      message1: "opacity %1",
      args1: [{ type: "input_value", name: "OPACITY" }],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Self-lit sphere (emissive). Great for suns, lights, particles.",
    },

    /* ── Box ────────────────────────────────────────────── */
    {
      type: "box_block",
      message0: "%1 = box  pos %2  size %3  colour %4",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "SIZE" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a box. Snap in vectors for position and size.",
    },

    /* ── Box + opacity ──────────────────────────────────── */
    {
      type: "box_opacity_block",
      message0: "%1 = box  pos %2  size %3  colour %4",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "SIZE" },
        { type: "input_value", name: "COL" },
      ],
      message1: "opacity %1",
      args1: [{ type: "input_value", name: "OPACITY" }],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Semi-transparent box. Opacity 0 = invisible, 1 = solid.",
    },

    /* ── Cylinder ───────────────────────────────────────── */
    {
      type: "cylinder_block",
      message0: "%1 = cylinder  pos %2  axis %3",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "AXIS" },
      ],
      message1: "radius %1  colour %2",
      args1: [
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a cylinder. Axis sets direction and length.",
    },

    /* ── Arrow ──────────────────────────────────────────── */
    {
      type: "arrow_block",
      message0: "%1 = arrow  pos %2  axis %3  colour %4",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "AXIS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create an arrow. Update axis to animate direction/length.",
    },

    /* ── Helix (basic) ─────────────────────────────────── */
    {
      type: "helix_block",
      message0: "%1 = helix  pos %2  axis %3",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "AXIS" },
      ],
      message1: "radius %1  colour %2",
      args1: [
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a helix/spring. Update axis to stretch it.",
    },

    /* ── Helix (full) ──────────────────────────────────── */
    {
      type: "helix_full_block",
      message0: "%1 = helix  pos %2  axis %3",
      args0: [
        { type: "field_input", name: "NAME", text: "spring" },
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "AXIS" },
      ],
      message1: "radius %1  coils %2  thickness %3  colour %4",
      args1: [
        { type: "input_value", name: "RADIUS" },
        { type: "input_value", name: "COILS" },
        { type: "input_value", name: "THICK" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: false,
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
      colour: 330,
      tooltip: "Create a floating text label in the 3D scene.",
    },

    /* ── Label (full) ──────────────────────────────────── */
    {
      type: "label_full_block",
      message0: "%1 = label  pos %2",
      args0: [
        { type: "field_input", name: "NAME", text: "telemetry" },
        { type: "input_value", name: "POS" },
      ],
      message1: "text %1  height %2",
      args1: [
        { type: "field_input", name: "TEXT", text: "" },
        { type: "input_value", name: "HEIGHT" },
      ],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Named label with custom height. Use for telemetry displays.",
    },

    /* ── Local light ───────────────────────────────────── */
    {
      type: "local_light_block",
      message0: "local light  pos %1  colour %2",
      args0: [
        { type: "input_value", name: "POS" },
        { type: "input_value", name: "COL" },
      ],
      inputsInline: false,
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Add a point light source to the scene.",
    },

    /* ══════════════════════════════════════════════════════
       MOTION / PHYSICS BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "set_velocity_block",
      message0: "%1 .velocity = %2",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
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
        { type: "field_input", name: "OBJ", text: "ball" },
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
        { type: "field_input", name: "OBJ", text: "ball" },
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
        { type: "field_input", name: "NAME", text: "x" },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Set a variable. Snap in a number, vector, or expression.",
    },
    {
      type: "set_attr_expr_block",
      message0: "%1 . %2 = %3",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_input", name: "ATTR", text: "pos" },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Set an object's property. E.g. ball.pos = vector(0,1,0)",
    },
    {
      type: "add_attr_expr_block",
      message0: "%1 . %2 += %3",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_input", name: "ATTR", text: "velocity" },
        { type: "input_value", name: "VALUE" },
      ],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 45,
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
        { type: "field_input", name: "VAR", text: "i" },
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
      args0: [{ type: "field_input", name: "COND", text: "True" }],
      message1: "do %1",
      args1: [{ type: "input_statement", name: "BODY" }],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Run blocks inside only if condition is true.",
    },
    {
      type: "if_else_block",
      message0: "if %1",
      args0: [{ type: "field_input", name: "COND", text: "True" }],
      message1: "do %1",
      args1: [{ type: "input_statement", name: "BODY_IF" }],
      message2: "else %1",
      args2: [{ type: "input_statement", name: "BODY_ELSE" }],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "If/else: run do-blocks if true, else-blocks if false.",
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
       SCENE / UTILITY BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "scene_setup_block",
      message0: "scene title %1  background %2",
      args0: [
        { type: "field_input", name: "TITLE", text: "Physics Simulation" },
        { type: "field_input", name: "BG", text: "#000000" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set the scene title and background colour.",
    },
    {
      type: "scene_range_block",
      message0: "scene.range = %1",
      args0: [{ type: "field_number", name: "R", value: 10 }],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set how much of the scene is visible.",
    },
    {
      type: "scene_forward_block",
      message0: "scene.forward = %1",
      args0: [{ type: "input_value", name: "VEC" }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set the camera viewing direction.",
    },
    {
      type: "scene_center_block",
      message0: "scene.center = %1",
      args0: [{ type: "input_value", name: "VEC" }],
      inputsInline: true,
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set the scene center point.",
    },
    {
      type: "scene_caption_block",
      message0: "scene.caption = %1",
      args0: [
        { type: "field_input", name: "TEXT", text: "Physics simulation\\n" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set the scene caption text.",
    },
    {
      type: "scene_ambient_block",
      message0: "scene.ambient = %1",
      args0: [
        {
          type: "field_number",
          name: "GRAY",
          value: 0.3,
          min: 0,
          max: 1,
          precision: 0.01,
        },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set ambient light level (0 = dark, 1 = bright).",
    },
    {
      type: "comment_block",
      message0: "\ud83d\udcac %1",
      args0: [
        { type: "field_input", name: "TEXT", text: "describe your model" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: "Add a comment to your code.",
    },

    /* ── Telemetry ─────────────────────────────────────── */
    {
      type: "telemetry_update_block",
      message0: "update %1 display",
      args0: [{ type: "field_input", name: "LABEL", text: "telemetry" }],
      message1: "%1 = round( %2 , %3 dp ) %4",
      args1: [
        { type: "field_input", name: "M1", text: "t" },
        { type: "field_input", name: "V1", text: "t" },
        { type: "field_number", name: "D1", value: 2 },
        { type: "field_input", name: "U1", text: "s" },
      ],
      message2: "%1 = round( %2 , %3 dp ) %4",
      args2: [
        { type: "field_input", name: "M2", text: "" },
        { type: "field_input", name: "V2", text: "" },
        { type: "field_number", name: "D2", value: 2 },
        { type: "field_input", name: "U2", text: "" },
      ],
      message3: "%1 = round( %2 , %3 dp ) %4",
      args3: [
        { type: "field_input", name: "M3", text: "" },
        { type: "field_input", name: "V3", text: "" },
        { type: "field_number", name: "D3", value: 2 },
        { type: "field_input", name: "U3", text: "" },
      ],
      message4: "%1 = round( %2 , %3 dp ) %4",
      args4: [
        { type: "field_input", name: "M4", text: "" },
        { type: "field_input", name: "V4", text: "" },
        { type: "field_number", name: "D4", value: 2 },
        { type: "field_input", name: "U4", text: "" },
      ],
      message5: "%1 = round( %2 , %3 dp ) %4",
      args5: [
        { type: "field_input", name: "M5", text: "" },
        { type: "field_input", name: "V5", text: "" },
        { type: "field_number", name: "D5", value: 2 },
        { type: "field_input", name: "U5", text: "" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip:
        "Show live measurements. Up to 5 lines \u2014 leave name blank to skip.",
    },

    /* ══════════════════════════════════════════════════════
       ADVANCED / RAW BLOCKS
       ══════════════════════════════════════════════════════ */
    {
      type: "exec_block",
      message0: "run: %1",
      args0: [{ type: "field_input", name: "EXPR", text: "sphere()" }],
      previousStatement: null,
      nextStatement: null,
      colour: 10,
      tooltip: "Run any Python statement directly.",
    },
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
      args0: [{ type: "field_input", name: "EXPR", text: "mag(v)" }],
      output: null,
      colour: 10,
      tooltip: "Python expression that outputs a value.",
    },
  ]);

  /* ──────────────────────────────────────────────────────────
     CODE GENERATORS  (Python.forBlock)
     ────────────────────────────────────────────────────────── */

  // Helper: get value code from composable block plugged into a slot
  const val = (block, name, fallback) =>
    Python.valueToCode(block, name, Python.ORDER_NONE) || fallback;

  /* ── Value blocks ─────────────────────────────────────── */
  gen["vector_block"] = function (block) {
    const x = block.getFieldValue("X");
    const y = block.getFieldValue("Y");
    const z = block.getFieldValue("Z");
    return [`vector(${x}, ${y}, ${z})`, Python.ORDER_FUNCTION_CALL];
  };

  gen["colour_block"] = function (block) {
    return [hexToVPythonColor(block.getFieldValue("COL")), Python.ORDER_ATOMIC];
  };

  gen["expr_block"] = function (block) {
    const expr = (block.getFieldValue("EXPR") || "0").trim();
    return [expr, Python.ORDER_ATOMIC];
  };

  /* ── Object blocks ────────────────────────────────────── */
  gen["sphere_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const pos = val(block, "POS", "vector(0,0,0)");
    const r = val(block, "RADIUS", "1");
    const col = val(block, "COL", "color.red");
    const e = `sphere(pos=${pos}, radius=${r}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["sphere_trail_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
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
    const name = (block.getFieldValue("NAME") || "").trim();
    const pos = val(block, "POS", "vector(0,0,0)");
    const r = val(block, "RADIUS", "0.5");
    const col = val(block, "COL", "color.white");
    const op = val(block, "OPACITY", "1");
    const e = `sphere(pos=${pos}, radius=${r}, color=${col}, emissive=True, opacity=${op})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["box_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const pos = val(block, "POS", "vector(0,0,0)");
    const sz = val(block, "SIZE", "vector(1,1,1)");
    const col = val(block, "COL", "color.blue");
    const e = `box(pos=${pos}, size=${sz}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["box_opacity_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const pos = val(block, "POS", "vector(0,0,0)");
    const sz = val(block, "SIZE", "vector(1,1,1)");
    const col = val(block, "COL", "color.white");
    const op = val(block, "OPACITY", "0.5");
    const e = `box(pos=${pos}, size=${sz}, color=${col}, opacity=${op})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["cylinder_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const pos = val(block, "POS", "vector(0,0,0)");
    const ax = val(block, "AXIS", "vector(1,0,0)");
    const r = val(block, "RADIUS", "0.5");
    const col = val(block, "COL", "color.green");
    const e = `cylinder(pos=${pos}, axis=${ax}, radius=${r}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["arrow_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const pos = val(block, "POS", "vector(0,0,0)");
    const ax = val(block, "AXIS", "vector(1,0,0)");
    const col = val(block, "COL", "color.yellow");
    const e = `arrow(pos=${pos}, axis=${ax}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["helix_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const pos = val(block, "POS", "vector(0,0,0)");
    const ax = val(block, "AXIS", "vector(1,0,0)");
    const r = val(block, "RADIUS", "0.3");
    const col = val(block, "COL", "color.white");
    const e = `helix(pos=${pos}, axis=${ax}, radius=${r}, color=${col})`;
    return name ? `${name} = ${e}\n` : `${e}\n`;
  };

  gen["helix_full_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
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
    const name = (block.getFieldValue("NAME") || "").trim();
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
    const obj = block.getFieldValue("OBJ");
    const v = val(block, "VEL", "vector(0,0,0)");
    return `${obj}.velocity = ${v}\n`;
  };

  gen["update_position_block"] = function (block) {
    const obj = block.getFieldValue("OBJ");
    const dt = val(block, "DT", "dt");
    return `${obj}.pos = ${obj}.pos + ${obj}.velocity * ${dt}\n`;
  };

  gen["apply_force_block"] = function (block) {
    const obj = block.getFieldValue("OBJ");
    const a = val(block, "ACCEL", "vector(0,-9.81,0)");
    const dt = val(block, "DT", "dt");
    return `${obj}.velocity = ${obj}.velocity + ${a} * ${dt}\n`;
  };

  gen["set_gravity_block"] = function (block) {
    return `g = vector(0, -${block.getFieldValue("G")}, 0)\n`;
  };

  /* ── Variable / assignment blocks ─────────────────────── */
  gen["set_scalar_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "x").trim();
    const v = val(block, "VALUE", "0");
    return `${name} = ${v}\n`;
  };

  gen["set_attr_expr_block"] = function (block) {
    const obj = (block.getFieldValue("OBJ") || "obj").trim();
    const attr = (block.getFieldValue("ATTR") || "pos").trim();
    const v = val(block, "VALUE", "0");
    return `${obj}.${attr} = ${v}\n`;
  };

  gen["add_attr_expr_block"] = function (block) {
    const obj = (block.getFieldValue("OBJ") || "ball").trim();
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
    const v = (block.getFieldValue("VAR") || "i").trim();
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
    const cond = (block.getFieldValue("COND") || "True").trim();
    const body = Python.statementToCode(block, "BODY") || "  pass\n";
    return `if ${cond}:\n${body}`;
  };

  gen["if_else_block"] = function (block) {
    const cond = (block.getFieldValue("COND") || "True").trim();
    const bIf = Python.statementToCode(block, "BODY_IF") || "  pass\n";
    const bElse = Python.statementToCode(block, "BODY_ELSE") || "  pass\n";
    return `if ${cond}:\n${bIf}else:\n${bElse}`;
  };

  gen["break_loop_block"] = function () {
    return "break\n";
  };

  /* ── Scene blocks ─────────────────────────────────────── */
  gen["scene_setup_block"] = function (block) {
    const title = escPy(block.getFieldValue("TITLE") || "");
    const bg = hexToVPythonColor(block.getFieldValue("BG"));
    return `scene.title = "${title}"\nscene.background = ${bg}\n`;
  };

  gen["scene_range_block"] = function (block) {
    return `scene.range = ${block.getFieldValue("R")}\n`;
  };

  gen["scene_forward_block"] = function (block) {
    return `scene.forward = ${val(block, "VEC", "vector(0,0,-1)")}\n`;
  };

  gen["scene_center_block"] = function (block) {
    return `scene.center = ${val(block, "VEC", "vector(0,0,0)")}\n`;
  };

  gen["scene_caption_block"] = function (block) {
    return `scene.caption = "${escPy(block.getFieldValue("TEXT") || "")}"\n`;
  };

  gen["scene_ambient_block"] = function (block) {
    return `scene.ambient = color.gray(${block.getFieldValue("GRAY")})\n`;
  };

  gen["comment_block"] = function (block) {
    return `# ${block.getFieldValue("TEXT") || ""}\n`;
  };

  gen["telemetry_update_block"] = function (block) {
    const label = (block.getFieldValue("LABEL") || "telemetry").trim();
    const lines = [];
    for (let i = 1; i <= 5; i++) {
      const m = (block.getFieldValue("M" + i) || "").trim();
      const v = (block.getFieldValue("V" + i) || "").trim();
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
  gen["exec_block"] = function (block) {
    return `${(block.getFieldValue("EXPR") || "").trim()}\n`;
  };

  gen["python_raw_block"] = function (block) {
    return `${block.getFieldValue("CODE") || ""}\n`;
  };

  gen["python_raw_expr_block"] = function (block) {
    return [(block.getFieldValue("EXPR") || "0").trim(), Python.ORDER_ATOMIC];
  };

  initialized = true;
}

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
