/**
 * blocklyGenerator.js
 *
 * Defines custom VPython blocks across several categories:
 *   Scene Objects  – sphere, box, cylinder, arrow, helix
 *   Vectors        – vector
 *   Motion         – set velocity, update position, apply force, set gravity
 *   Control        – rate, forever loop, time step, if/else, break
 *   Utility        – scene setup, comment, telemetry
 *
 * All standard Blockly blocks (Logic, Loops, Math, Text, Variables, Functions)
 * are provided by the Blockly CDN — we do NOT recreate them here.
 *
 * Code generators use the Blockly v11 `Python.forBlock[...]` API.
 */

let initialized = false;

function getPythonGen(Blockly) {
  return Blockly.Python || null;
}

/* ── Colour helper ──────────────────────────────────────── */
function hexToVPythonColor(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) {
    return 'color.white';
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 'color.white';
  return `vector(${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`;
}

/* ── String escape helper ───────────────────────────────── */
function escPy(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
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
    /* ── Scene Objects ─────────────────────────────────────── */
    {
      type: "sphere_block",
      message0: "%1 = sphere  pos( %2 , %3 , %4 )  radius %5  color %6",
      args0: [
        { type: "field_input", name: "NAME", text: "ball" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "R", value: 1, min: 0 },
        { type: "field_input", name: "COL", text: "#ff0000" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a sphere. Leave name blank for no variable.",
    },
    {
      type: "box_block",
      message0: "%1 = box  pos( %2 , %3 , %4 )  color %5",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_input", name: "COL", text: "#0000ff" },
      ],
      message1: "size( %1 , %2 , %3 )",
      args1: [
        { type: "field_number", name: "SX", value: 1, min: 0 },
        { type: "field_number", name: "SY", value: 1, min: 0 },
        { type: "field_number", name: "SZ", value: 1, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a box. Leave name blank for no variable.",
    },
    {
      type: "cylinder_block",
      message0: "%1 = cylinder  pos( %2 , %3 , %4 )  radius %5  color %6",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "R", value: 0.5, min: 0 },
        { type: "field_input", name: "COL", text: "#00ff00" },
      ],
      message1: "axis( %1 , %2 , %3 )",
      args1: [
        { type: "field_number", name: "AX", value: 1 },
        { type: "field_number", name: "AY", value: 0 },
        { type: "field_number", name: "AZ", value: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a cylinder. The axis vector sets direction and length.",
    },
    {
      type: "arrow_block",
      message0: "%1 = arrow  pos( %2 , %3 , %4 )  color %5",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_input", name: "COL", text: "#ffff00" },
      ],
      message1: "axis( %1 , %2 , %3 )",
      args1: [
        { type: "field_number", name: "AX", value: 1 },
        { type: "field_number", name: "AY", value: 0 },
        { type: "field_number", name: "AZ", value: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create an arrow. Update \"axis\" each frame to animate direction and length.",
    },
    {
      type: "helix_block",
      message0: "%1 = helix  pos( %2 , %3 , %4 )  radius %5  color %6",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "R", value: 0.3, min: 0 },
        { type: "field_input", name: "COL", text: "#cccccc" },
      ],
      message1: "axis( %1 , %2 , %3 )",
      args1: [
        { type: "field_number", name: "AX", value: 1 },
        { type: "field_number", name: "AY", value: 0 },
        { type: "field_number", name: "AZ", value: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a helix/spring. Update \"axis\" each frame to stretch it.",
    },

    /* ── Vectors ───────────────────────────────────────────── */
    {
      type: "vector_block",
      message0: "vector( %1 , %2 , %3 )",
      args0: [
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
      ],
      output: "Vector",
      colour: 180,
      tooltip: "Create a VPython vector",
    },

    /* ── Motion / Physics ──────────────────────────────────── */
    {
      type: "set_velocity_block",
      message0: "%1 .velocity = vector( %2 , %3 , %4 )",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_number", name: "VX", value: 0 },
        { type: "field_number", name: "VY", value: 0 },
        { type: "field_number", name: "VZ", value: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Set the starting velocity of an object.",
    },
    {
      type: "update_position_block",
      message0: "%1 .pos += .velocity × %2",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_input", name: "DT", text: "dt" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Move object by its velocity × dt each step (Euler integration).",
    },
    {
      type: "apply_force_block",
      message0: "%1 .velocity += vector( %2 , %3 , %4 ) × %5",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_number", name: "FX", value: 0 },
        { type: "field_number", name: "FY", value: -9.81 },
        { type: "field_number", name: "FZ", value: 0 },
        { type: "field_input", name: "DT", text: "dt" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Apply a constant acceleration vector to an object's velocity. Enter acceleration (m/s²), not force.",
    },
    {
      type: "set_gravity_block",
      message0: "gravity g = %1 m/s² (↓ Y)",
      args0: [
        { type: "field_number", name: "G", value: 9.81, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Define gravity as a downward vector: g = vector(0, -value, 0)",
    },

    /* ── Control ───────────────────────────────────────────── */
    {
      type: "rate_block",
      message0: "rate( %1 )",
      args0: [{ type: "field_number", name: "N", value: 100, min: 1 }],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Control animation speed (iterations per second)",
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
      tooltip: "Infinite loop (while True)",
    },
    {
      type: "time_step_block",
      message0: "time step dt = %1",
      args0: [
        { type: "field_number", name: "DT", value: 0.01, min: 0.0001, precision: 0.0001 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Define the simulation time step",
    },

    /* ── Utility ───────────────────────────────────────────── */
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
      tooltip: "Configure the 3D scene title and background",
    },
    {
      type: "comment_block",
      message0: "comment: %1",
      args0: [{ type: "field_input", name: "TEXT", text: "describe your model" }],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: "Generate a Python comment",
    },
    {
      type: "local_light_block",
      message0: "local light pos( %1 , %2 , %3 ) color %4",
      args0: [
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 5 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_input", name: "COL", text: "#ffffff" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Create a VPython local light",
    },
    {
      type: "label_block",
      message0: "label %1 at ( %2 , %3 , %4 )",
      args0: [
        { type: "field_input", name: "TEXT", text: "telemetry" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Create a VPython label",
    },
    {
      type: "scene_range_block",
      message0: "scene.range = %1",
      args0: [{ type: "field_number", name: "R", value: 10 }],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set scene range",
    },
    {
      type: "set_scalar_block",
      message0: "%1 = %2",
      args0: [
        { type: "field_input", name: "NAME", text: "dt" },
        { type: "field_input", name: "VALUE", text: "0.01" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Set a variable to a number or expression.",
    },
    {
      type: "set_vector_expr_block",
      message0: "%1 = vector( %2 )",
      args0: [
        { type: "field_input", name: "NAME", text: "g" },
        { type: "field_input", name: "VALUE", text: "0, -9.8, 0" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Set a variable to a 3D vector.",
    },
    {
      type: "set_attr_expr_block",
      message0: "%1 . %2 = %3",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_input", name: "ATTR", text: "radius" },
        { type: "field_input", name: "EXPR", text: "1.0" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Set a property of an object. Example: ball.pos = vector(0,1,0)",
    },
    {
      type: "add_attr_expr_block",
      message0: "%1 . %2 += %3",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_input", name: "ATTR", text: "velocity" },
        { type: "field_input", name: "EXPR", text: "a * dt" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Add a value to an object's property. Example: ball.velocity += acceleration * dt",
    },
    {
      type: "python_raw_block",
      message0: "code: %1",
      args0: [{ type: "field_input", name: "CODE", text: "# custom python" }],
      previousStatement: null,
      nextStatement: null,
      colour: 10,
      tooltip: "Insert any Python statement directly. Use when no specific block exists.",
    },
    {
      type: "python_raw_expr_block",
      message0: "expr: %1",
      args0: [{ type: "field_input", name: "EXPR", text: "mag(v)" }],
      output: null,
      colour: 10,
      tooltip: "Insert a Python expression that outputs a value.",
    },

    /* ── Scene property blocks ─────────────────────────────── */
    {
      type: "scene_forward_block",
      message0: "scene.forward = vector( %1 , %2 , %3 )",
      args0: [
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: -1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set the scene viewing direction",
    },
    {
      type: "scene_center_block",
      message0: "scene.center = vector( %1 , %2 , %3 )",
      args0: [
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set the scene center point",
    },
    {
      type: "scene_caption_block",
      message0: "scene.caption = %1",
      args0: [{ type: "field_input", name: "TEXT", text: "Physics simulation\\n" }],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set the scene caption text",
    },
    {
      type: "scene_ambient_block",
      message0: "scene.ambient = color.gray( %1 )",
      args0: [{ type: "field_number", name: "GRAY", value: 0.3, min: 0, max: 1, precision: 0.01 }],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Set ambient light level (0 = dark, 1 = bright)",
    },

    /* ── Control flow ──────────────────────────────────────── */
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
      args1: [
        { type: "input_statement", name: "BODY" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Repeat: run the blocks inside for each value of the loop variable.",
    },
    {
      type: "if_block",
      message0: "if %1",
      args0: [
        { type: "field_input", name: "COND", text: "True" },
      ],
      message1: "do %1",
      args1: [
        { type: "input_statement", name: "BODY" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Run the blocks inside only if the condition is true.",
    },

    /* ── Extended object constructors ──────────────────────── */
    {
      type: "sphere_trail_block",
      message0: "%1 = sphere  pos( %2 , %3 , %4 )  radius %5  color %6",
      args0: [
        { type: "field_input", name: "NAME", text: "ball" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "R", value: 0.5, min: 0 },
        { type: "field_input", name: "COL", text: "#ff0000" },
      ],
      message1: "trail  radius %1  color %2  keep %3 pts",
      args1: [
        { type: "field_number", name: "TRAIL_R", value: 0.03, min: 0 },
        { type: "field_input", name: "TRAIL_COL", text: "#ffff00" },
        { type: "field_number", name: "RETAIN", value: 200, min: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a sphere that leaves a visible trail. Trail settings must be in the constructor.",
    },
    {
      type: "sphere_emissive_block",
      message0: "%1 = glowing sphere  pos( %2 , %3 , %4 )  radius %5  color %6",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "R", value: 0.5, min: 0 },
        { type: "field_input", name: "COL", text: "#ffffff" },
      ],
      message1: "opacity %1",
      args1: [
        { type: "field_number", name: "OPACITY", value: 1.0, min: 0, max: 1, precision: 0.01 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a self-glowing sphere (emissive=True). Use for stars, lights, particles.",
    },
    {
      type: "helix_full_block",
      message0: "%1 = helix  pos %2  radius %3  coils %4  color %5",
      args0: [
        { type: "field_input", name: "NAME", text: "spring" },
        { type: "field_input", name: "POS", text: "vector(0,0,0)" },
        { type: "field_number", name: "R", value: 0.3, min: 0 },
        { type: "field_number", name: "COILS", value: 10, min: 1 },
        { type: "field_input", name: "COL", text: "#cccccc" },
      ],
      message1: "axis %1  thickness %2",
      args1: [
        { type: "field_input", name: "AXIS", text: "vector(1,0,0)" },
        { type: "field_number", name: "THICK", value: 0.05, min: 0, precision: 0.001 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a spring/helix with specific coil count and thickness.",
    },
    {
      type: "box_opacity_block",
      message0: "%1 = box  pos( %2 , %3 , %4 )  color %5  opacity %6",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_input", name: "X", text: "0" },
        { type: "field_input", name: "Y", text: "0" },
        { type: "field_input", name: "Z", text: "0" },
        { type: "field_input", name: "COL", text: "#333333" },
        { type: "field_number", name: "OPACITY", value: 0.5, min: 0, max: 1, precision: 0.01 },
      ],
      message1: "size( %1 , %2 , %3 )",
      args1: [
        { type: "field_number", name: "SX", value: 1, min: 0 },
        { type: "field_number", name: "SY", value: 1, min: 0 },
        { type: "field_number", name: "SZ", value: 1, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a semi-transparent box. Opacity 0 = invisible, 1 = solid.",
    },
    {
      type: "label_full_block",
      message0: "%1 = label  pos( %2 , %3 , %4 )  text %5  height %6",
      args0: [
        { type: "field_input", name: "NAME", text: "telemetry" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 5 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_input", name: "TEXT", text: "" },
        { type: "field_number", name: "HEIGHT", value: 12, min: 6 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Create a VPython label (white text, no box, transparent background)",
    },

    /* ── Execute statement ─────────────────────────────────── */
    {
      type: "exec_block",
      message0: "run: %1",
      args0: [{ type: "field_input", name: "EXPR", text: "sphere()" }],
      previousStatement: null,
      nextStatement: null,
      colour: 10,
      tooltip: "Run any Python expression as a statement. Useful for creating anonymous objects.",
    },

    /* ── If / Else block ───────────────────────────────────── */
    {
      type: "if_else_block",
      message0: "if %1",
      args0: [
        { type: "field_input", name: "COND", text: "True" },
      ],
      message1: "do %1",
      args1: [
        { type: "input_statement", name: "BODY_IF" },
      ],
      message2: "else %1",
      args2: [
        { type: "input_statement", name: "BODY_ELSE" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "If/else: run \"do\" blocks if condition is true, otherwise run \"else\" blocks.",
    },

    /* ── Break loop block ──────────────────────────────────── */
    {
      type: "break_loop_block",
      message0: "break loop",
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: "Exit the current loop immediately",
    },

    /* ── Telemetry (measurement display) block ─────────────── */
    {
      type: "telemetry_update_block",
      message0: "update %1 display",
      args0: [
        { type: "field_input", name: "LABEL", text: "telemetry" },
      ],
      message1: "%1  =  round( %2 , %3 dp )  %4",
      args1: [
        { type: "field_input", name: "M1", text: "t" },
        { type: "field_input", name: "V1", text: "t" },
        { type: "field_number", name: "D1", value: 2 },
        { type: "field_input", name: "U1", text: "s" },
      ],
      message2: "%1  =  round( %2 , %3 dp )  %4",
      args2: [
        { type: "field_input", name: "M2", text: "speed" },
        { type: "field_input", name: "V2", text: "speed" },
        { type: "field_number", name: "D2", value: 2 },
        { type: "field_input", name: "U2", text: "m/s" },
      ],
      message3: "%1  =  round( %2 , %3 dp )  %4",
      args3: [
        { type: "field_input", name: "M3", text: "height" },
        { type: "field_input", name: "V3", text: "height" },
        { type: "field_number", name: "D3", value: 2 },
        { type: "field_input", name: "U3", text: "m" },
      ],
      message4: "%1  =  round( %2 , %3 dp )  %4",
      args4: [
        { type: "field_input", name: "M4", text: "" },
        { type: "field_input", name: "V4", text: "" },
        { type: "field_number", name: "D4", value: 2 },
        { type: "field_input", name: "U4", text: "" },
      ],
      message5: "%1  =  round( %2 , %3 dp )  %4",
      args5: [
        { type: "field_input", name: "M5", text: "" },
        { type: "field_input", name: "V5", text: "" },
        { type: "field_number", name: "D5", value: 2 },
        { type: "field_input", name: "U5", text: "" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 330,
      tooltip: "Show live measurements on a label. Up to 5 lines — leave \"metric name\" blank to skip a row.",
    },

    /* ── Cylinder with expression positions (for loops) ────── */
    {
      type: "cylinder_expr_block",
      message0: "%1 = cylinder  pos( %2 , %3 , %4 )  radius %5  color %6",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_input", name: "X", text: "0" },
        { type: "field_input", name: "Y", text: "0" },
        { type: "field_input", name: "Z", text: "0" },
        { type: "field_input", name: "R", text: "0.5" },
        { type: "field_input", name: "COL", text: "#00ff00" },
      ],
      message1: "axis( %1 , %2 , %3 )",
      args1: [
        { type: "field_input", name: "AX", text: "0" },
        { type: "field_input", name: "AY", text: "0" },
        { type: "field_input", name: "AZ", text: "0" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a cylinder. Fields accept expressions and variables (useful inside loops).",
    },

    /* ── Sphere with expression positions (for loops) ──────── */
    {
      type: "sphere_expr_block",
      message0: "%1 = sphere  pos( %2 , %3 , %4 )  radius %5  color %6",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_input", name: "X", text: "0" },
        { type: "field_input", name: "Y", text: "0" },
        { type: "field_input", name: "Z", text: "0" },
        { type: "field_input", name: "R", text: "0.5" },
        { type: "field_input", name: "COL", text: "#ffffff" },
      ],
      message1: "options %1",
      args1: [
        { type: "field_input", name: "EXTRA", text: "" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a sphere. Fields accept expressions. Use \"options\" for extra args like emissive=True.",
    },
  ]);

  /* ──────────────────────────────────────────────────────────
     CODE GENERATORS  (Python.forBlock)
     ────────────────────────────────────────────────────────── */

  // Scene Objects
  gen["sphere_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const r = block.getFieldValue("R");
    const col = hexToVPythonColor(block.getFieldValue("COL"));
    const expr = `sphere(pos=vector(${x}, ${y}, ${z}), radius=${r}, color=${col})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["box_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const sx = block.getFieldValue("SX"), sy = block.getFieldValue("SY"), sz = block.getFieldValue("SZ");
    const col = hexToVPythonColor(block.getFieldValue("COL"));
    const expr = `box(pos=vector(${x}, ${y}, ${z}), size=vector(${sx}, ${sy}, ${sz}), color=${col})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["cylinder_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const ax = block.getFieldValue("AX"), ay = block.getFieldValue("AY"), az = block.getFieldValue("AZ");
    const r = block.getFieldValue("R");
    const col = hexToVPythonColor(block.getFieldValue("COL"));
    const expr = `cylinder(pos=vector(${x}, ${y}, ${z}), axis=vector(${ax}, ${ay}, ${az}), radius=${r}, color=${col})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["arrow_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const ax = block.getFieldValue("AX"), ay = block.getFieldValue("AY"), az = block.getFieldValue("AZ");
    const col = hexToVPythonColor(block.getFieldValue("COL"));
    const expr = `arrow(pos=vector(${x}, ${y}, ${z}), axis=vector(${ax}, ${ay}, ${az}), color=${col})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["helix_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const ax = block.getFieldValue("AX"), ay = block.getFieldValue("AY"), az = block.getFieldValue("AZ");
    const r = block.getFieldValue("R");
    const col = hexToVPythonColor(block.getFieldValue("COL"));
    const expr = `helix(pos=vector(${x}, ${y}, ${z}), axis=vector(${ax}, ${ay}, ${az}), radius=${r}, color=${col})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  // Vectors
  gen["vector_block"] = function (block) {
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    return [`vector(${x}, ${y}, ${z})`, Python.ORDER_ATOMIC];
  };

  // Motion / Physics
  gen["set_velocity_block"] = function (block) {
    const obj = block.getFieldValue("OBJ");
    const vx = block.getFieldValue("VX"), vy = block.getFieldValue("VY"), vz = block.getFieldValue("VZ");
    return `${obj}.velocity = vector(${vx}, ${vy}, ${vz})\n`;
  };

  gen["update_position_block"] = function (block) {
    const obj = block.getFieldValue("OBJ");
    const dt = block.getFieldValue("DT");
    return `${obj}.pos = ${obj}.pos + ${obj}.velocity * ${dt}\n`;
  };

  gen["apply_force_block"] = function (block) {
    const obj = block.getFieldValue("OBJ");
    const fx = block.getFieldValue("FX"), fy = block.getFieldValue("FY"), fz = block.getFieldValue("FZ");
    const dt = block.getFieldValue("DT");
    return `${obj}.velocity = ${obj}.velocity + vector(${fx}, ${fy}, ${fz}) * ${dt}\n`;
  };

  gen["set_gravity_block"] = function (block) {
    const g = block.getFieldValue("G");
    return `g = vector(0, -${g}, 0)\n`;
  };

  // Control
  gen["rate_block"] = function (block) {
    const n = block.getFieldValue("N");
    return `rate(${n})\n`;
  };

  gen["forever_loop_block"] = function (block) {
    const body = Python.statementToCode(block, "BODY") || "  pass\n";
    return `while True:\n${body}`;
  };

  gen["time_step_block"] = function (block) {
    const dt = block.getFieldValue("DT");
    return `dt = ${dt}\n`;
  };

  // Utility
  gen["scene_setup_block"] = function (block) {
    const title = escPy(block.getFieldValue("TITLE") || "");
    const bg = hexToVPythonColor(block.getFieldValue("BG"));
    return `scene.title = "${title}"\nscene.background = ${bg}\n`;
  };

  gen["comment_block"] = function (block) {
    const text = block.getFieldValue("TEXT") || "";
    return `# ${text}\n`;
  };

  gen["local_light_block"] = function (block) {
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const col = hexToVPythonColor(block.getFieldValue("COL"));
    return `local_light(pos=vector(${x}, ${y}, ${z}), color=${col})\n`;
  };

  gen["label_block"] = function (block) {
    const text = escPy(block.getFieldValue("TEXT") || "");
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    return `label(text="${text}", pos=vector(${x}, ${y}, ${z}), box=False, opacity=0, color=color.white)\n`;
  };

  gen["scene_range_block"] = function (block) {
    const r = block.getFieldValue("R");
    return `scene.range = ${r}\n`;
  };

  gen["set_scalar_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "var").trim();
    const value = (block.getFieldValue("VALUE") || "0").trim();
    return `${name} = ${value}\n`;
  };

  gen["set_vector_expr_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "v").trim();
    const value = (block.getFieldValue("VALUE") || "0,0,0").trim();
    return `${name} = vector(${value})\n`;
  };

  gen["set_attr_expr_block"] = function (block) {
    const obj = (block.getFieldValue("OBJ") || "obj").trim();
    const attr = (block.getFieldValue("ATTR") || "value").trim();
    const expr = (block.getFieldValue("EXPR") || "0").trim();
    return `${obj}.${attr} = ${expr}\n`;
  };

  gen["add_attr_expr_block"] = function (block) {
    const obj  = (block.getFieldValue("OBJ")  || "ball").trim();
    const attr = (block.getFieldValue("ATTR") || "velocity").trim();
    const expr = (block.getFieldValue("EXPR") || "0").trim();
    return `${obj}.${attr} += ${expr}\n`;
  };

  gen["python_raw_block"] = function (block) {
    const code = block.getFieldValue("CODE") || "";
    return `${code}\n`;
  };

  gen["python_raw_expr_block"] = function (block) {
    const expr = (block.getFieldValue("EXPR") || "0").trim();
    return [expr, Python.ORDER_ATOMIC];
  };

  // Scene property blocks
  gen["scene_forward_block"] = function (block) {
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    return `scene.forward = vector(${x}, ${y}, ${z})\n`;
  };

  gen["scene_center_block"] = function (block) {
    const x = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    return `scene.center = vector(${x}, ${y}, ${z})\n`;
  };

  gen["scene_caption_block"] = function (block) {
    const text = escPy(block.getFieldValue("TEXT") || "");
    return `scene.caption = "${text}"\n`;
  };

  gen["scene_ambient_block"] = function (block) {
    const gray = block.getFieldValue("GRAY");
    return `scene.ambient = color.gray(${gray})\n`;
  };

  // Control flow
  gen["for_range_block"] = function (block) {
    const v = (block.getFieldValue("VAR") || "i").trim();
    const start = block.getFieldValue("START");
    const stop  = block.getFieldValue("STOP");
    const step  = block.getFieldValue("STEP");
    const body  = Python.statementToCode(block, "BODY") || "  pass\n";
    return `for ${v} in range(${start}, ${stop}, ${step}):\n${body}`;
  };

  gen["if_block"] = function (block) {
    const cond = (block.getFieldValue("COND") || "True").trim();
    const body = Python.statementToCode(block, "BODY") || "  pass\n";
    return `if ${cond}:\n${body}`;
  };

  // Extended object constructors
  gen["sphere_trail_block"] = function (block) {
    const name     = (block.getFieldValue("NAME") || "").trim();
    const x        = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const r        = block.getFieldValue("R");
    const col      = hexToVPythonColor(block.getFieldValue("COL"));
    const trailR   = block.getFieldValue("TRAIL_R");
    const trailCol = hexToVPythonColor(block.getFieldValue("TRAIL_COL"));
    const retain   = block.getFieldValue("RETAIN");
    const expr = `sphere(pos=vector(${x}, ${y}, ${z}), radius=${r}, color=${col}, make_trail=True, trail_radius=${trailR}, trail_color=${trailCol}, retain=${retain}, shininess=0.6)`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["sphere_emissive_block"] = function (block) {
    const name   = (block.getFieldValue("NAME") || "").trim();
    const x      = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const r      = block.getFieldValue("R");
    const colRaw = block.getFieldValue("COL");
    const col    = (colRaw && colRaw.startsWith('#')) ? hexToVPythonColor(colRaw) : (colRaw || 'color.white');
    const opacity = block.getFieldValue("OPACITY");
    const expr = `sphere(pos=vector(${x}, ${y}, ${z}), radius=${r}, color=${col}, emissive=True, opacity=${opacity}, shininess=0.8)`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["helix_full_block"] = function (block) {
    const name  = (block.getFieldValue("NAME") || "").trim();
    const pos   = block.getFieldValue("POS") || "vector(0,0,0)";
    const axis  = block.getFieldValue("AXIS") || "vector(1,0,0)";
    const r     = block.getFieldValue("R");
    const coils = block.getFieldValue("COILS");
    const thick = block.getFieldValue("THICK");
    const col   = hexToVPythonColor(block.getFieldValue("COL"));
    const expr  = `helix(pos=${pos}, axis=${axis}, radius=${r}, coils=${coils}, thickness=${thick}, color=${col})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["box_opacity_block"] = function (block) {
    const name    = (block.getFieldValue("NAME") || "").trim();
    const x       = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const sx      = block.getFieldValue("SX"), sy = block.getFieldValue("SY"), sz = block.getFieldValue("SZ");
    const col     = hexToVPythonColor(block.getFieldValue("COL"));
    const opacity = block.getFieldValue("OPACITY");
    const expr    = `box(pos=vector(${x}, ${y}, ${z}), size=vector(${sx}, ${sy}, ${sz}), color=${col}, opacity=${opacity})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["label_full_block"] = function (block) {
    const name   = (block.getFieldValue("NAME") || "").trim();
    const x      = block.getFieldValue("X"), y = block.getFieldValue("Y"), z = block.getFieldValue("Z");
    const text   = escPy(block.getFieldValue("TEXT") || "");
    const height = block.getFieldValue("HEIGHT");
    const expr   = `label(pos=vector(${x}, ${y}, ${z}), text="${text}", height=${height}, box=False, opacity=0, color=color.white)`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["exec_block"] = function (block) {
    const expr = (block.getFieldValue("EXPR") || "").trim();
    return `${expr}\n`;
  };

  // New blocks
  gen["if_else_block"] = function (block) {
    const cond = (block.getFieldValue("COND") || "True").trim();
    const bodyIf = Python.statementToCode(block, "BODY_IF") || "  pass\n";
    const bodyElse = Python.statementToCode(block, "BODY_ELSE") || "  pass\n";
    return `if ${cond}:\n${bodyIf}else:\n${bodyElse}`;
  };

  gen["break_loop_block"] = function () {
    return "break\n";
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
        const unitPart = u ? ` + " ${u}"` : '';
        lines.push(`"${m} = " + str(round(${v}, ${d}))${unitPart}`);
      }
    }
    if (lines.length === 0) {
      return `${label}.text = ""\n`;
    }
    const joined = lines.join(' + "\\n" + ');
    return `${label}.text = ${joined}\n`;
  };

  gen["cylinder_expr_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const x = (block.getFieldValue("X") || "0").trim();
    const y = (block.getFieldValue("Y") || "0").trim();
    const z = (block.getFieldValue("Z") || "0").trim();
    const ax = (block.getFieldValue("AX") || "0").trim();
    const ay = (block.getFieldValue("AY") || "0").trim();
    const az = (block.getFieldValue("AZ") || "0").trim();
    const r = (block.getFieldValue("R") || "0.5").trim();
    const colRaw = (block.getFieldValue("COL") || "").trim();
    const col = colRaw.startsWith('#') ? hexToVPythonColor(colRaw) : (colRaw || 'color.white');
    const expr = `cylinder(pos=vector(${x}, ${y}, ${z}), axis=vector(${ax}, ${ay}, ${az}), radius=${r}, color=${col})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
  };

  gen["sphere_expr_block"] = function (block) {
    const name = (block.getFieldValue("NAME") || "").trim();
    const x = (block.getFieldValue("X") || "0").trim();
    const y = (block.getFieldValue("Y") || "0").trim();
    const z = (block.getFieldValue("Z") || "0").trim();
    const r = (block.getFieldValue("R") || "0.5").trim();
    const colRaw = (block.getFieldValue("COL") || "").trim();
    const col = colRaw.startsWith('#') ? hexToVPythonColor(colRaw) : (colRaw || 'color.white');
    const extra = (block.getFieldValue("EXTRA") || "").trim();
    const extraPart = extra ? `, ${extra}` : '';
    const expr = `sphere(pos=vector(${x}, ${y}, ${z}), radius=${r}, color=${col}${extraPart})`;
    return name ? `${name} = ${expr}\n` : `${expr}\n`;
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
