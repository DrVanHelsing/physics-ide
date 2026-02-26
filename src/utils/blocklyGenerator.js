/**
 * blocklyGenerator.js
 *
 * Defines ~15 custom VPython blocks across four categories:
 *   Scene Objects  – sphere, box, cylinder, arrow, helix
 *   Vectors        – vector
 *   Motion         – set velocity, update position, apply force, set gravity
 *   Control        – rate, forever loop, time step
 *   Utility        – scene setup, comment
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
      tooltip: "Create a VPython sphere (leave name blank for anonymous)",
    },
    {
      type: "box_block",
      message0: "%1 = box  pos( %2 , %3 , %4 )  size( %5 , %6 , %7 )  color %8",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "SX", value: 1, min: 0 },
        { type: "field_number", name: "SY", value: 1, min: 0 },
        { type: "field_number", name: "SZ", value: 1, min: 0 },
        { type: "field_input", name: "COL", text: "#0000ff" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a VPython box (leave name blank for anonymous)",
    },
    {
      type: "cylinder_block",
      message0: "%1 = cylinder  pos( %2 , %3 , %4 )  axis( %5 , %6 , %7 )  radius %8  color %9",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "AX", value: 1 },
        { type: "field_number", name: "AY", value: 0 },
        { type: "field_number", name: "AZ", value: 0 },
        { type: "field_number", name: "R", value: 0.5, min: 0 },
        { type: "field_input", name: "COL", text: "#00ff00" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a VPython cylinder (leave name blank for anonymous)",
    },
    {
      type: "arrow_block",
      message0: "%1 = arrow  pos( %2 , %3 , %4 )  axis( %5 , %6 , %7 )  color %8",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "AX", value: 1 },
        { type: "field_number", name: "AY", value: 0 },
        { type: "field_number", name: "AZ", value: 0 },
        { type: "field_input", name: "COL", text: "#ffff00" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a VPython arrow (leave name blank for anonymous)",
    },
    {
      type: "helix_block",
      message0: "%1 = helix  pos( %2 , %3 , %4 )  axis( %5 , %6 , %7 )  radius %8  color %9",
      args0: [
        { type: "field_input", name: "NAME", text: "" },
        { type: "field_number", name: "X", value: 0 },
        { type: "field_number", name: "Y", value: 0 },
        { type: "field_number", name: "Z", value: 0 },
        { type: "field_number", name: "AX", value: 1 },
        { type: "field_number", name: "AY", value: 0 },
        { type: "field_number", name: "AZ", value: 0 },
        { type: "field_number", name: "R", value: 0.3, min: 0 },
        { type: "field_input", name: "COL", text: "#cccccc" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 210,
      tooltip: "Create a VPython helix (leave name blank for anonymous)",
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
      message0: "set %1 .velocity = vector( %2 , %3 , %4 )",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_number", name: "VX", value: 0 },
        { type: "field_number", name: "VY", value: 0 },
        { type: "field_number", name: "VZ", value: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Set an object's velocity vector",
    },
    {
      type: "update_position_block",
      message0: "update %1 position by velocity * %2",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_input", name: "DT", text: "dt" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Euler update: pos = pos + velocity * dt",
    },
    {
      type: "apply_force_block",
      message0: "apply force  %1 .velocity += vector( %2 , %3 , %4 ) * %5",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_number", name: "FX", value: 0 },
        { type: "field_number", name: "FY", value: -9.8 },
        { type: "field_number", name: "FZ", value: 0 },
        { type: "field_input", name: "DT", text: "dt" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Apply a force: velocity += (F/m) * dt  (set F/m directly)",
    },
    {
      type: "set_gravity_block",
      message0: "gravity constant g = %1",
      args0: [
        { type: "field_number", name: "G", value: 9.8, min: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Define the gravitational acceleration constant",
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
      message0: "scene  title %1  background %2",
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
      message0: "set %1 = %2",
      args0: [
        { type: "field_input", name: "NAME", text: "dt" },
        { type: "field_input", name: "VALUE", text: "0.01" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Assign scalar expression",
    },
    {
      type: "set_vector_expr_block",
      message0: "set %1 = vector expr %2",
      args0: [
        { type: "field_input", name: "NAME", text: "g" },
        { type: "field_input", name: "VALUE", text: "0, -9.8, 0" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "Assign vector expression (x,y,z)",
    },
    {
      type: "set_attr_expr_block",
      message0: "set %1 . %2 = %3",
      args0: [
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_input", name: "ATTR", text: "radius" },
        { type: "field_input", name: "EXPR", text: "1.0" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "One-line assignment: object.attribute = expression",
    },
    {
      type: "add_attr_expr_block",
      message0: "add %1 to %2 . %3",
      args0: [
        { type: "field_input", name: "EXPR", text: "a * dt" },
        { type: "field_input", name: "OBJ", text: "ball" },
        { type: "field_input", name: "ATTR", text: "velocity" },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 45,
      tooltip: "One-line increment: object.attribute += expression",
    },
    {
      type: "python_raw_block",
      message0: "raw python %1",
      args0: [{ type: "field_input", name: "CODE", text: "# custom python" }],
      previousStatement: null,
      nextStatement: null,
      colour: 10,
      tooltip: "Insert raw Python code as-is",
    },
    {
      type: "python_raw_expr_block",
      message0: "raw python expr %1",
      args0: [{ type: "field_input", name: "EXPR", text: "mag(v)" }],
      output: null,
      colour: 10,
      tooltip: "Insert raw Python expression",
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
    return `g = ${g}\n`;
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
    const title = block.getFieldValue("TITLE") || "";
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
    const text = block.getFieldValue("TEXT") || "";
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
    const expr = (block.getFieldValue("EXPR") || "0").trim();
    const obj = (block.getFieldValue("OBJ") || "obj").trim();
    const attr = (block.getFieldValue("ATTR") || "value").trim();
    return `${obj}.${attr} = ${obj}.${attr} + ${expr}\n`;
  };

  gen["python_raw_block"] = function (block) {
    const code = block.getFieldValue("CODE") || "";
    return `${code}\n`;
  };

  gen["python_raw_expr_block"] = function (block) {
    const expr = (block.getFieldValue("EXPR") || "0").trim();
    return [expr, Python.ORDER_ATOMIC];
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
