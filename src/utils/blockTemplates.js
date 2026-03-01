/**
 * blockTemplates.js — Composable Block Templates
 *
 * Block-mode templates now use the composable block architecture:
 * small VALUE blocks (vector, colour, expression, math_number) are
 * nested inside <value> slots on larger OBJECT / MOTION / VARIABLE blocks.
 *
 * RULES:
 * 1. NO raw Python ternary expressions — use if_else_block.
 * 2. NO compound boolean conditions (a and b) — use nested if_block.
 * 3. NO raw string concatenation for telemetry — use telemetry_update_block.
 * 4. Every expression in a value slot should be a formula students can read.
 * 5. In GlowScript 3.2, make_trail MUST be in the constructor.
 */

/* ── XML helpers ─────────────────────────────────────────── */

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "&#10;");
}

/* ── Value descriptor shortcuts ──────────────────────────── */

function vec(x, y, z) {
  return {
    type: "vector_block",
    fields: { X: String(x), Y: String(y), Z: String(z) },
  };
}

function num(n) {
  return { type: "math_number", fields: { NUM: String(n) } };
}

/* Convert hex like "#ff3333" → VPython vector string "vector(1.00, 0.20, 0.20)" */
function hexToVPython(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#") || hex.length < 7)
    return "color.white";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "color.white";
  return `vector(${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`;
}

/**
 * col(hex) — Returns an expr_block containing a VPython colour vector.
 * Uses expr_block (field_input) instead of colour_block (field_colour)
 * to guarantee correct serialization across all Blockly CDN versions.
 */
function col(hex) {
  return expr(hexToVPython(hex));
}

function expr(text) {
  return { type: "expr_block", fields: { EXPR: text } };
}

function v(name) {
  return { type: "variables_get", fields: { VAR: name } };
}

function op(operator, left, right) {
  return {
    type: "math_arithmetic",
    fields: { OP: operator },
    values: { A: left, B: right },
  };
}

function add(a, b) {
  return op("ADD", a, b);
}

function sub(a, b) {
  return op("MINUS", a, b);
}

function mul(a, b) {
  return op("MULTIPLY", a, b);
}

function div(a, b) {
  return op("DIVIDE", a, b);
}

/** Trig / math function block: sin, cos, tan, radians, sqrt, abs, etc. */
function trig(fnName, argDesc) {
  return { type: "math_trig_block", fields: { OP: fnName }, values: { X: argDesc } };
}

/** Compose a vector from three value-slot inputs (variables, expressions, etc.) */
function vecC(xDesc, yDesc, zDesc) {
  return { type: "vector_compose_block", values: { X: xDesc, Y: yDesc, Z: zDesc } };
}

/** min(a, b) block */
function minOf(aDesc, bDesc) {
  return { type: "math_min_block", values: { A: aDesc, B: bDesc } };
}

/** max(a, b) block */
function maxOf(aDesc, bDesc) {
  return { type: "math_max_block", values: { A: aDesc, B: bDesc } };
}

/** a ** b — power block */
// eslint-disable-next-line no-unused-vars
function powOf(baseDesc, expDesc) {
  return { type: "math_pow_block", values: { BASE: baseDesc, EXP: expDesc } };
}

/** clamp(val, lo, hi) block */
// eslint-disable-next-line no-unused-vars
function clampOf(valDesc, loDesc, hiDesc) {
  return { type: "math_clamp_block", values: { VAL: valDesc, LO: loDesc, HI: hiDesc } };
}

/** abs(x) shortcut — uses math_trig_block with "abs" */
function absOf(xDesc) {
  return trig("abs", xDesc);
}

/* ── Physics expression helpers ─────────────────────── */
/** Object property access: ball.velocity, ball.pos, ball.radius, etc. */
function getProp(objName, propName) {
  return { type: "get_prop_block", fields: { OBJ: objName, PROP: propName } };
}
/** Vector component: .x / .y / .z */
function getComp(vecDesc, component) {
  return { type: "get_component_block", fields: { COMP: component }, values: { VEC: vecDesc } };
}
/** Magnitude: mag(vec) */
function magnitude(vecDesc) {
  return { type: "mag_block", values: { VEC: vecDesc } };
}
/** Normalise: norm(vec) */
function normOf(vecDesc) {
  return { type: "norm_block", values: { VEC: vecDesc } };
}
/** Comparison block (OP: EQ / NEQ / LT / LTE / GT / GTE) */
function cmp(operator, left, right) {
  return { type: "logic_compare", fields: { OP: operator }, values: { A: left, B: right } };
}
/** Quick-create sphere — all in one block (no value slots) */
// eslint-disable-next-line no-unused-vars
function presetSphere(varName, x, y, z, radius, colorHex) {
  return {
    type: "preset_sphere_block",
    fields: { NAME: varName, X: String(x), Y: String(y), Z: String(z), R: String(radius), COL: colorHex },
  };
}
/** Quick-create box — all in one block */
// eslint-disable-next-line no-unused-vars
function presetBox(varName, x, y, z, w, h, d, colorHex) {
  return {
    type: "preset_box_block",
    fields: { NAME: varName, X: String(x), Y: String(y), Z: String(z), W: String(w), H: String(h), D: String(d), COL: colorHex },
  };
}
/** Physics constant by key (g, G, pi, euler, c, ke, h, me, mp) */
function physicsConst(constKey) {
  return { type: "physics_const_block", fields: { CONST: constKey } };
}

function valueBlockXml(valueDesc) {
  if (!valueDesc || !valueDesc.type) return "";

  let content = "";

  if (valueDesc.fields) {
    for (const [name, value] of Object.entries(valueDesc.fields)) {
      content += `<field name="${name}">${esc(String(value))}</field>`;
    }
  }

  if (valueDesc.values) {
    for (const [name, child] of Object.entries(valueDesc.values)) {
      content += `<value name="${name}">${valueBlockXml(child)}</value>`;
    }
  }

  return `<block type="${valueDesc.type}">${content}</block>`;
}

/* ── Recursive XML builder ───────────────────────────────── */

/**
 * Build nested Blockly XML from a flat array of block descriptors.
 *
 * Each descriptor:
 *   {
 *     type: string,
 *     fields?: Record<string, string>,
 *     values?: Record<string, { type: string, fields?: Record<string,string> }>,
 *     body?: descriptor[],
 *     elseBody?: descriptor[],
 *   }
 *
 * `values` generates <value name="…"><block type="…"><field …/></block></value>
 */
function buildChain(blocks, isFirst) {
  if (!blocks || blocks.length === 0) return "";
  const block = blocks[0];
  const rest = blocks.slice(1);

  const posAttr = isFirst ? ' x="24" y="20"' : "";
  let content = "";

  // Field values
  if (block.fields) {
    for (const [name, value] of Object.entries(block.fields)) {
      content += `<field name="${name}">${esc(String(value))}</field>`;
    }
  }

  // Value inputs — composable blocks plugged into input_value slots
  if (block.values) {
    for (const [name, valueDesc] of Object.entries(block.values)) {
      content += `<value name="${name}">`;
      content += valueBlockXml(valueDesc);
      content += `</value>`;
    }
  }

  // Statement inputs: BODY, BODY_IF, BODY_ELSE
  if (block.body) {
    const stmtName =
      block.type === "if_else_block"
        ? "BODY_IF"
        : block.type === "sim_start_block"
        ? "SETUP"
        : "BODY";
    content += `<statement name="${stmtName}">${buildChain(block.body, false)}</statement>`;
  }

  if (block.elseBody) {
    content += `<statement name="BODY_ELSE">${buildChain(block.elseBody, false)}</statement>`;
  }

  if (rest.length > 0) {
    content += `<next>${buildChain(rest, false)}</next>`;
  }

  return `<block type="${block.type}"${posAttr}>${content}</block>`;
}

function buildTemplate(blocks) {
  return `<xml xmlns="https://developers.google.com/blockly/xml">${buildChain(blocks, true)}</xml>`;
}

function normalizeSimulationFlow(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return blocks;
  const simStart = blocks.find((b) => b?.type === "sim_start_block");
  const simEnd = [...blocks].reverse().find((b) => b?.type === "sim_end_block");
  if (!simStart || !simEnd) return blocks;

  const innerBlocks = blocks.filter(
    (b) => b && b.type !== "sim_start_block" && b.type !== "sim_end_block"
  );

  return [
    {
      type: "sim_start_block",
      fields: { TITLE: simStart.fields?.TITLE || "My Simulation" },
      body: innerBlocks,
    },
    {
      type: "sim_end_block",
      fields: { MSG: simEnd.fields?.MSG || "Simulation complete." },
    },
  ];
}

/* ═══════════════════════════════════════════════════════════
   PROJECTILE TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const PROJECTILE_BLOCKS = [
  /* ── Scene setup ────────────────────────────────────────── */
  { type: "sim_start_block", fields: { TITLE: "Projectile Motion" } },
  { type: "python_raw_block", fields: { CODE: 'scene.background = vector(0.051, 0.086, 0.161)' } },
  { type: "python_raw_block", fields: { CODE: 'scene.range = 18' } },

  /* ── Colour constants (template-specific) ─────────────── */
  { type: "set_scalar_block", fields: { NAME: "c_ground" },    values: { VALUE: vec(0.20, 0.45, 0.27) } },
  { type: "set_scalar_block", fields: { NAME: "c_track" },     values: { VALUE: vec(0.42, 0.42, 0.48) } },
  { type: "set_scalar_block", fields: { NAME: "c_marker" },    values: { VALUE: vec(1.00, 0.80, 0.25) } },
  { type: "set_scalar_block", fields: { NAME: "c_axis_x" },    values: { VALUE: vec(1.00, 0.20, 0.20) } },
  { type: "set_scalar_block", fields: { NAME: "c_axis_y" },    values: { VALUE: vec(0.20, 0.87, 0.40) } },
  { type: "set_scalar_block", fields: { NAME: "c_ball" },      values: { VALUE: vec(0.95, 0.35, 0.25) } },
  { type: "set_scalar_block", fields: { NAME: "c_trail" },     values: { VALUE: vec(1.00, 0.88, 0.25) } },
  { type: "set_scalar_block", fields: { NAME: "c_velocity" },  values: { VALUE: vec(0.35, 0.90, 1.00) } },
  { type: "set_scalar_block", fields: { NAME: "c_tick" },      values: { VALUE: vec(0.95, 0.95, 0.95) } },

  /* ── Ground geometry ─────────────────────────────────────── */
  {
    type: "box_block",
    fields: { NAME: "ground" },
    values: {
      POS: vec(11, -0.55, 0),
      SIZE: vec(34, 1.1, 10),
      COL: col("#337346"),
    },
  },
  {
    type: "box_block",
    fields: { NAME: "track" },
    values: {
      POS: vec(1.6, 0.2, 0),
      SIZE: vec(3.2, 0.12, 0.9),
      COL: col("#6b6b7a"),
    },
  },
  {
    type: "cylinder_block",
    fields: { NAME: "origin_marker" },
    values: {
      POS: vec(0, -0.5, 0),
      AXIS: vec(0, 0.45, 0),
      RADIUS: num(0.06),
      COL: col("#ffcc40"),
    },
  },

  /* ── Distance ticks (expression blocks for loop variable) ── */
  {
    type: "for_range_block",
    fields: { VAR: "i", START: "0", STOP: "31", STEP: "5" },
    body: [
      {
        type: "cylinder_block",
        fields: { NAME: "" },
        values: {
          POS: vecC(v("i"), num(-0.02), num(-0.18)),
          AXIS: vec(0, 0.04, 0),
          RADIUS: num(0.018),
          COL: col("#f2f2f2"),
        },
      },
    ],
  },

  /* ── Axis arrows ───────────────────────────────────────── */
  {
    type: "arrow_block",
    fields: { NAME: "x_axis_hint" },
    values: { POS: vec(0, 0, 0), AXIS: vec(2.4, 0, 0), COL: col("#ff3333") },
  },
  {
    type: "arrow_block",
    fields: { NAME: "y_axis_hint" },
    values: { POS: vec(0, 0, 0), AXIS: vec(0, 2.2, 0), COL: col("#33dd66") },
  },

  /* ── Ball with trail ───────────────────────────────────── */
  {
    type: "sphere_trail_block",
    fields: { NAME: "ball" },
    values: {
      POS: vec(0, 0.35, 0),
      RADIUS: num(0.28),
      COL: col("#f25940"),
      TRAIL_R: num(0.035),
      TRAIL_COL: col("#ffe040"),
      RETAIN: num(260),
    },
  },

  /* ── Velocity arrow ────────────────────────────────────── */
  {
    type: "arrow_block",
    fields: { NAME: "v_arrow" },
    values: {
      POS: vec(0, 0.35, 0),
      AXIS: vec(0, 0, 0),
      COL: col("#59e6ff"),
    },
  },

  /* ── Physics constants ─────────────────────────────────── */
  {
    type: "set_scalar_block",
    fields: { NAME: "g" },
    values: { VALUE: vec(0, -9.81, 0) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "rho" },
    values: { VALUE: num(1.225) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "Cd" },
    values: { VALUE: num(0.47) },
  },
  {
    type: "comment_block",
    fields: { TEXT: "A = cross-sectional area of the ball" },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "A" },
    values: { VALUE: mul(physicsConst("pi"), mul(getProp("ball","radius"), getProp("ball","radius"))) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "m" },
    values: { VALUE: num(0.34) },
  },
  {
    type: "comment_block",
    fields: { TEXT: "drag_k = drag coefficient factor" },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "drag_k" },
    values: { VALUE: mul(mul(mul(num(0.5), v("rho")), v("Cd")), v("A")) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "v0" },
    values: { VALUE: num(17.5) },
  },
  {
    type: "comment_block",
    fields: { TEXT: "Convert 52 degrees to radians" },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "angle" },
    values: { VALUE: trig("radians", num(52)) },
  },

  /* ── Initial velocity ──────────────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Set initial velocity from speed and angle" },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "vx0" },
    values: { VALUE: mul(v("v0"), trig("cos", v("angle"))) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "vy0" },
    values: { VALUE: mul(v("v0"), trig("sin", v("angle"))) },
  },
  {
    type: "set_attr_expr_block",
    fields: { OBJ: "ball", ATTR: "velocity" },
    values: { VALUE: vecC(v("vx0"), v("vy0"), num(0)) },
  },

  /* ── Time step and state ───────────────────────────────── */
  { type: "time_step_block", fields: { DT: "0.004" } },
  {
    type: "set_scalar_block",
    fields: { NAME: "t" },
    values: { VALUE: num(0) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "max_height" },
    values: { VALUE: num(0.0) },
  },

  /* ── Telemetry label ───────────────────────────────────── */
  {
    type: "label_full_block",
    fields: { NAME: "telemetry", TEXT: "" },
    values: { POS: vec(8.5, 9.2, 0), HEIGHT: num(12) },
  },

  /* ── Animation loop ────────────────────────────────────── */
  {
    type: "forever_loop_block",
    body: [
      { type: "rate_block", fields: { N: "240" } },

      // Speed
      {
        type: "comment_block",
        fields: { TEXT: "Calculate speed (magnitude of velocity)" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "speed" },
        values: { VALUE: magnitude(getProp("ball","velocity")) },
      },

      // Drag force
      {
        type: "comment_block",
        fields: { TEXT: "Calculate drag force (opposes motion)" },
      },
      {
        type: "if_else_block",
        values: { COND: cmp("GT", v("speed"), num(0)) },
        body: [
          {
            type: "set_scalar_block",
            fields: { NAME: "drag" },
            values: { VALUE: mul(mul(num(-1), mul(v("drag_k"), v("speed"))), getProp("ball","velocity")) },
          },
        ],
        elseBody: [
          {
            type: "set_scalar_block",
            fields: { NAME: "drag" },
            values: { VALUE: vec(0, 0, 0) },
          },
        ],
      },

      // Acceleration
      {
        type: "comment_block",
        fields: { TEXT: "Acceleration = gravity + drag / mass" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "acceleration" },
        values: { VALUE: add(v("g"), div(v("drag"), v("m"))) },
      },

      // Velocity and position update
      {
        type: "add_attr_expr_block",
        fields: { OBJ: "ball", ATTR: "velocity" },
        values: { VALUE: mul(v("acceleration"), v("dt")) },
      },
      {
        type: "update_position_block",
        fields: { OBJ: "ball" },
        values: { DT: v("dt") },
      },

      // Velocity arrow follows ball
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "v_arrow", ATTR: "pos" },
        values: { VALUE: getProp("ball","pos") },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "v_arrow", ATTR: "axis" },
        values: { VALUE: mul(getProp("ball","velocity"), num(0.16)) },
      },

      // Ground collision: clamp and bounce
      {
        type: "comment_block",
        fields: { TEXT: "Ground collision: bounce the ball" },
      },
      {
        type: "if_block",
        values: { COND: cmp("LT", getComp(getProp("ball","pos"),"y"), getProp("ball","radius")) },
        body: [
          {
            type: "set_attr_expr_block",
            fields: { OBJ: "ball", ATTR: "pos.y" },
            values: { VALUE: getProp("ball","radius") },
          },
          {
            type: "if_block",
            values: { COND: cmp("LT", getComp(getProp("ball","velocity"),"y"), num(0)) },
            body: [
              {
                type: "set_attr_expr_block",
                fields: { OBJ: "ball", ATTR: "velocity.y" },
                values: { VALUE: mul(num(-0.55), getComp(getProp("ball","velocity"),"y")) },
              },
            ],
          },
          {
            type: "set_attr_expr_block",
            fields: { OBJ: "ball", ATTR: "velocity.x" },
            values: { VALUE: mul(getComp(getProp("ball","velocity"),"x"), num(0.88)) },
          },
        ],
      },

      // Stop when at rest
      {
        type: "comment_block",
        fields: { TEXT: "Stop when ball is nearly at rest on ground" },
      },
      {
        type: "if_block",
        values: { COND: cmp("LTE", getComp(getProp("ball","pos"),"y"), add(getProp("ball","radius"), num(0.01))) },
        body: [
          {
            type: "if_block",
            values: { COND: cmp("LT", magnitude(getProp("ball","velocity")), num(0.06)) },
            body: [
              {
                type: "set_attr_expr_block",
                fields: { OBJ: "ball", ATTR: "velocity" },
                values: { VALUE: vec(0, 0, 0) },
              },
              { type: "break_loop_block" },
            ],
          },
        ],
      },

      // Track maximum height
      {
        type: "set_scalar_block",
        fields: { NAME: "h_above" },
        values: { VALUE: sub(getComp(getProp("ball","pos"),"y"), getProp("ball","radius")) },
      },
      {
        type: "if_block",
        values: { COND: cmp("LT", v("h_above"), num(0)) },
        body: [
          {
            type: "set_scalar_block",
            fields: { NAME: "h_above" },
            values: { VALUE: num(0) },
          },
        ],
      },
      {
        type: "comment_block",
        fields: { TEXT: "Update max height if current is higher" },
      },
      {
        type: "if_block",
        values: { COND: cmp("GT", v("h_above"), v("max_height")) },
        body: [
          {
            type: "set_scalar_block",
            fields: { NAME: "max_height" },
            values: { VALUE: v("h_above") },
          },
        ],
      },

      // Telemetry — 1 block per metric, stacked
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "t", D: 2, U: "s" },
        values: { V: v("t") },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "speed", D: 2, U: "m/s" },
        values: { V: magnitude(getProp("ball","velocity")) },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "height", D: 2, U: "m" },
        values: { V: v("h_above") },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "range", D: 2, U: "m" },
        values: { V: getComp(getProp("ball","pos"),"x") },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "peak", D: 2, U: "m" },
        values: { V: v("max_height") },
      },

      // Advance time
      {
        type: "set_scalar_block",
        fields: { NAME: "t" },
        values: { VALUE: add(v("t"), v("dt")) },
      },
    ],
  },

  /* ── Simulation end ─────────────────────────────────────── */
  { type: "sim_end_block", fields: { MSG: "Projectile simulation complete." } },
];

/* ═══════════════════════════════════════════════════════════
   ORBIT TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const ORBIT_BLOCKS = [
  /* ── Scene setup ────────────────────────────────────────── */
  { type: "sim_start_block", fields: { TITLE: "Sun, Earth \u0026 Moon" } },
  { type: "python_raw_block", fields: { CODE: 'scene.background = vector(0.020, 0.035, 0.090)' } },
  { type: "python_raw_block", fields: { CODE: 'scene.range = 14' } },
  {
    type: "local_light_block",
    values: { POS: vec(0, 0, 0), COL: col("#fff7d9") },
  },
  /* ── Colour constants (template-specific) ─────────────── */
  { type: "set_scalar_block", fields: { NAME: "c_sun" },         values: { VALUE: vec(1.00, 0.87, 0.35) } },
  { type: "set_scalar_block", fields: { NAME: "c_corona" },      values: { VALUE: vec(1.00, 0.70, 0.25) } },
  { type: "set_scalar_block", fields: { NAME: "c_earth" },       values: { VALUE: vec(0.26, 0.72, 1.00) } },
  { type: "set_scalar_block", fields: { NAME: "c_earth_trail" }, values: { VALUE: vec(0.45, 0.75, 1.00) } },
  { type: "set_scalar_block", fields: { NAME: "c_moon" },        values: { VALUE: vec(0.88, 0.88, 0.94) } },
  { type: "set_scalar_block", fields: { NAME: "c_moon_trail" },  values: { VALUE: vec(0.80, 0.80, 0.90) } },
  { type: "set_scalar_block", fields: { NAME: "c_earth_arrow" }, values: { VALUE: vec(1.00, 0.45, 0.30) } },

  /* ── Starfield ─────────────────────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Create random background stars" },
  },
  {
    type: "for_range_block",
    fields: { VAR: "_", START: "0", STOP: "120", STEP: "1" },
    body: [
      {
        type: "comment_block",
        fields: { TEXT: "Random direction for star placement" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "rx" },
        values: { VALUE: sub(mul(num(2), expr("random()")), num(1)) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "ry" },
        values: { VALUE: sub(mul(num(2), expr("random()")), num(1)) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "rz" },
        values: { VALUE: sub(mul(num(2), expr("random()")), num(1)) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "p" },
        values: { VALUE: vecC(v("rx"), v("ry"), v("rz")) },
      },
      {
        type: "if_block",
        values: { COND: cmp("EQ", magnitude(v("p")), num(0)) },
        body: [
          {
            type: "set_scalar_block",
            fields: { NAME: "p" },
            values: { VALUE: vec(1, 0, 0) },
          },
        ],
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "p" },
        values: { VALUE: mul(num(34), normOf(v("p"))) },
      },
      {
        type: "sphere_emissive_block",
        fields: { NAME: "" },
        values: {
          POS: v("p"),
          RADIUS: add(num(0.05), mul(num(0.05), expr("random()"))),
          COL: vecC(
            add(num(0.7), mul(num(0.3), expr("random()"))),
            add(num(0.7), mul(num(0.3), expr("random()"))),
            num(1)
          ),
          OPACITY: num(0.9),
        },
      },
    ],
  },

  /* ── Celestial bodies ───────────────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Create Sun, Earth, and Moon" },
  },
  {
    type: "sphere_emissive_block",
    fields: { NAME: "sun" },
    values: {
      POS: vec(0, 0, 0),
      RADIUS: num(1.05),
      COL: v("c_sun"),
      OPACITY: num(1),
    },
  },
  {
    type: "sphere_emissive_block",
    fields: { NAME: "corona" },
    values: {
      POS: vec(0, 0, 0),
      RADIUS: num(1.45),
      COL: v("c_corona"),
      OPACITY: num(0.15),
    },
  },
  {
    type: "sphere_trail_block",
    fields: { NAME: "earth" },
    values: {
      POS: vec(8.2, 0, 0),
      RADIUS: num(0.42),
      COL: v("c_earth"),
      TRAIL_R: num(0.04),
      TRAIL_COL: v("c_earth_trail"),
      RETAIN: num(3200),
    },
  },
  {
    type: "sphere_trail_block",
    fields: { NAME: "moon" },
    values: {
      POS: vec(8.2, 0.9, 0),
      RADIUS: num(0.13),
      COL: v("c_moon"),
      TRAIL_R: num(0.02),
      TRAIL_COL: v("c_moon_trail"),
      RETAIN: num(1200),
    },
  },

  /* ── Gravitational parameters ──────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Gravitational constants (scaled for simulation)" },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "G" },
    values: { VALUE: num(10) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "M_sun" },
    values: { VALUE: num(10.33) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "M_earth" },
    values: { VALUE: num(1.0) },
  },

  /* ── Velocities ────────────────────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Set orbital velocities" },
  },
  {
    type: "set_velocity_block",
    fields: { OBJ: "earth" },
    values: { VEL: vec(0, 3.55, 0) },
  },
  {
    type: "set_attr_expr_block",
    fields: { OBJ: "moon", ATTR: "velocity" },
    values: { VALUE: add(getProp("earth","velocity"), vec(-3.33, 0, 0)) },
  },

  /* ── Time step ──────────────────────────────────────────── */
  { type: "time_step_block", fields: { DT: "0.0008" } },
  {
    type: "set_scalar_block",
    fields: { NAME: "t" },
    values: { VALUE: num(0) },
  },

  /* ── Initial accelerations for velocity-Verlet ─────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Compute initial accelerations" },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "r_es" },
    values: { VALUE: sub(getProp("earth","pos"), getProp("sun","pos")) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "d_es" },
    values: { VALUE: maxOf(magnitude(v("r_es")), num(1.2)) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "a_earth" },
    values: { VALUE: mul(div(mul(num(-1), mul(v("G"), v("M_sun"))), mul(v("d_es"), v("d_es"))), normOf(v("r_es"))) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "r_ms" },
    values: { VALUE: sub(getProp("moon","pos"), getProp("sun","pos")) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "d_ms" },
    values: { VALUE: maxOf(magnitude(v("r_ms")), num(1.2)) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "r_me" },
    values: { VALUE: sub(getProp("moon","pos"), getProp("earth","pos")) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "d_me" },
    values: { VALUE: maxOf(magnitude(v("r_me")), num(0.22)) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "a_moon" },
    values: {
      VALUE: sub(
        mul(div(mul(num(-1), mul(v("G"), v("M_sun"))), mul(v("d_ms"), v("d_ms"))), normOf(v("r_ms"))),
        mul(div(mul(v("G"), v("M_earth")), mul(v("d_me"), v("d_me"))), normOf(v("r_me")))
      ),
    },
  },

  /* ── Earth velocity arrow + telemetry ─────────────────── */
  {
    type: "arrow_block",
    fields: { NAME: "earth_arrow" },
    values: {
      POS: vec(8.2, 0, 0),
      AXIS: vec(0, 0, 0),
      COL: v("c_earth_arrow"),
    },
  },
  {
    type: "label_full_block",
    fields: { NAME: "telemetry", TEXT: "" },
    values: { POS: vec(-12, 11, 0), HEIGHT: num(12) },
  },

  /* ── Animation loop ────────────────────────────────────── */
  {
    type: "forever_loop_block",
    body: [
      { type: "rate_block", fields: { N: "900" } },

      // Velocity-Verlet: half-step kick
      {
        type: "comment_block",
        fields: { TEXT: "Velocity-Verlet: half-step velocity" },
      },
      {
        type: "add_attr_expr_block",
        fields: { OBJ: "earth", ATTR: "velocity" },
        values: { VALUE: div(mul(v("a_earth"), v("dt")), num(2)) },
      },
      {
        type: "add_attr_expr_block",
        fields: { OBJ: "moon", ATTR: "velocity" },
        values: { VALUE: div(mul(v("a_moon"), v("dt")), num(2)) },
      },

      // Full-step position drift
      {
        type: "comment_block",
        fields: { TEXT: "Full-step position update" },
      },
      {
        type: "update_position_block",
        fields: { OBJ: "earth" },
        values: { DT: v("dt") },
      },
      {
        type: "update_position_block",
        fields: { OBJ: "moon" },
        values: { DT: v("dt") },
      },

      // Recompute accelerations
      {
        type: "comment_block",
        fields: { TEXT: "Recompute gravitational accelerations" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "r_es" },
        values: { VALUE: sub(getProp("earth","pos"), getProp("sun","pos")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "d_es" },
        values: { VALUE: maxOf(magnitude(v("r_es")), num(1.2)) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "a_earth" },
        values: { VALUE: mul(div(mul(num(-1), mul(v("G"), v("M_sun"))), mul(v("d_es"), v("d_es"))), normOf(v("r_es"))) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "r_ms" },
        values: { VALUE: sub(getProp("moon","pos"), getProp("sun","pos")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "d_ms" },
        values: { VALUE: maxOf(magnitude(v("r_ms")), num(1.2)) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "r_me" },
        values: { VALUE: sub(getProp("moon","pos"), getProp("earth","pos")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "d_me" },
        values: { VALUE: maxOf(magnitude(v("r_me")), num(0.22)) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "a_moon" },
        values: {
          VALUE: sub(
            mul(div(mul(num(-1), mul(v("G"), v("M_sun"))), mul(v("d_ms"), v("d_ms"))), normOf(v("r_ms"))),
            mul(div(mul(v("G"), v("M_earth")), mul(v("d_me"), v("d_me"))), normOf(v("r_me")))
          ),
        },
      },

      // Second half-step kick
      {
        type: "comment_block",
        fields: { TEXT: "Complete velocity update" },
      },
      {
        type: "add_attr_expr_block",
        fields: { OBJ: "earth", ATTR: "velocity" },
        values: { VALUE: div(mul(v("a_earth"), v("dt")), num(2)) },
      },
      {
        type: "add_attr_expr_block",
        fields: { OBJ: "moon", ATTR: "velocity" },
        values: { VALUE: div(mul(v("a_moon"), v("dt")), num(2)) },
      },

      // Visual updates
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "corona", ATTR: "pos" },
        values: { VALUE: getProp("sun","pos") },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "earth_arrow", ATTR: "pos" },
        values: { VALUE: getProp("earth","pos") },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "earth_arrow", ATTR: "axis" },
        values: { VALUE: mul(num(1.2), v("a_earth")) },
      },

      // Telemetry — 1 block per metric, stacked
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "t", D: 2, U: "s" },
        values: { V: v("t") },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "Earth speed", D: 3, U: "" },
        values: { V: magnitude(getProp("earth","velocity")) },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "Moon speed", D: 3, U: "" },
        values: { V: magnitude(getProp("moon","velocity")) },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "Earth orbit r", D: 3, U: "" },
        values: { V: magnitude(getProp("earth","pos")) },
      },

      // Advance time
      {
        type: "set_scalar_block",
        fields: { NAME: "t" },
        values: { VALUE: add(v("t"), v("dt")) },
      },
    ],
  },

  /* ── Simulation end ─────────────────────────────────────── */
  { type: "sim_end_block", fields: { MSG: "Orbit simulation complete." } },
];

/* ═══════════════════════════════════════════════════════════
   SPRING-MASS TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const SPRING_BLOCKS = [
  /* ── Scene setup ────────────────────────────────────────── */
  { type: "sim_start_block", fields: { TITLE: "Spring-Mass Oscillator" } },
  { type: "python_raw_block", fields: { CODE: 'scene.background = vector(0.059, 0.071, 0.133)' } },
  { type: "python_raw_block", fields: { CODE: 'scene.range = 8.5' } },

  /* ── Colour constants (template-specific) ─────────────── */
  { type: "set_scalar_block", fields: { NAME: "c_floor" },       values: { VALUE: vec(0.24, 0.27, 0.33) } },
  { type: "set_scalar_block", fields: { NAME: "c_rail" },        values: { VALUE: vec(0.45, 0.45, 0.50) } },
  { type: "set_scalar_block", fields: { NAME: "c_wall" },        values: { VALUE: vec(0.38, 0.41, 0.52) } },
  { type: "set_scalar_block", fields: { NAME: "c_spring" },      values: { VALUE: vec(0.78, 0.80, 0.86) } },
  { type: "set_scalar_block", fields: { NAME: "c_mass" },        values: { VALUE: vec(0.22, 0.86, 0.95) } },
  { type: "set_scalar_block", fields: { NAME: "c_shadow" },      values: { VALUE: vec(0.07, 0.07, 0.09) } },
  { type: "set_scalar_block", fields: { NAME: "c_phase_arrow" }, values: { VALUE: vec(1.00, 0.55, 0.20) } },

  /* ── Environment geometry ──────────────────────────────── */
  {
    type: "box_block",
    fields: { NAME: "floor" },
    values: {
      POS: vec(-0.5, -1.25, 0),
      SIZE: vec(17, 0.3, 5),
      COL: col("#3d4454"),
    },
  },
  {
    type: "box_block",
    fields: { NAME: "rail" },
    values: {
      POS: vec(-0.5, -0.65, 0),
      SIZE: vec(16, 0.14, 1.5),
      COL: col("#737380"),
    },
  },
  {
    type: "box_block",
    fields: { NAME: "wall" },
    values: {
      POS: vec(-6, 0, 0),
      SIZE: vec(0.52, 4.2, 4),
      COL: col("#616885"),
    },
  },

  /* ── Spring, mass, shadow ───────────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Spring: k=14 N/m, m=1.2 kg, damping b=0.08" },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "anchor" },
    values: { VALUE: vec(-5.74, 0, 0) },
  },
  {
    type: "helix_full_block",
    fields: { NAME: "spring" },
    values: {
      POS: v("anchor"),
      AXIS: vec(4.0, 0, 0),
      RADIUS: num(0.36),
      COILS: num(16),
      THICK: num(0.055),
      COL: col("#4fc3ff"),
    },
  },
  {
    type: "box_block",
    fields: { NAME: "mass" },
    values: {
      POS: vec(-1.75, 0, 0),
      SIZE: vec(1.06, 1.0, 1.0),
      COL: col("#ff8c42"),
    },
  },
  {
    type: "box_opacity_block",
    fields: { NAME: "shadow" },
    values: {
      POS: vec(getComp(getProp("mass","pos"),"x"), num(-1.08), num(0)),
      SIZE: vec(1.0, 0.01, 1.0),
      COL: col("#121217"),
      OPACITY: num(0.45),
    },
  },

  /* ── Physics constants ─────────────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Physics parameters" },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "k" },
    values: { VALUE: num(14.0) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "m" },
    values: { VALUE: num(1.2) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "b" },
    values: { VALUE: num(0.08) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "L0" },
    values: { VALUE: num(4.0) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "x0" },
    values: { VALUE: num(2.4) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "v" },
    values: { VALUE: num(0.0) },
  },
  { type: "time_step_block", fields: { DT: "0.008" } },
  {
    type: "set_scalar_block",
    fields: { NAME: "t" },
    values: { VALUE: num(0.0) },
  },

  /* ── Initial stretched position ────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Start mass at stretched position" },
  },
  {
    type: "set_attr_expr_block",
    fields: { OBJ: "mass", ATTR: "pos.x" },
    values: { VALUE: add(add(add(getComp(getProp("wall","pos"),"x"), num(0.25)), v("L0")), v("x0")) },
  },

  /* ── Telemetry label and phase-space arrow ──────────────── */
  {
    type: "label_full_block",
    fields: { NAME: "telemetry", TEXT: "" },
    values: { POS: vec(0.2, 2.9, 0), HEIGHT: num(12) },
  },
  {
    type: "arrow_block",
    fields: { NAME: "phase_arrow" },
    values: {
      POS: vec(4.8, -0.2, 0),
      AXIS: vec(0, 0, 0),
      COL: col("#ff8c33"),
    },
  },

  /* ── Animation loop ────────────────────────────────────── */
  {
    type: "forever_loop_block",
    body: [
      { type: "rate_block", fields: { N: "240" } },

      // Hooke's law
      {
        type: "comment_block",
        fields: { TEXT: "Hooke's law: F = -k * stretch" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "stretch" },
        values: { VALUE: sub(sub(sub(getComp(getProp("mass","pos"),"x"), getComp(getProp("wall","pos"),"x")), num(0.25)), v("L0")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "Fspring" },
        values: { VALUE: mul(num(-1), mul(v("k"), v("stretch"))) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "Fdamp" },
        values: { VALUE: mul(num(-1), mul(v("b"), v("v"))) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "a" },
        values: { VALUE: div(add(v("Fspring"), v("Fdamp")), v("m")) },
      },

      // Euler integration
      {
        type: "comment_block",
        fields: { TEXT: "Update velocity and position" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "v" },
        values: { VALUE: add(v("v"), mul(v("a"), v("dt"))) },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "mass", ATTR: "pos.x" },
        values: { VALUE: add(getComp(getProp("mass","pos"),"x"), mul(v("v"), v("dt"))) },
      },

      // Spring visual updates
      {
        type: "set_scalar_block",
        fields: { NAME: "dx_spring" },
        values: { VALUE: sub(getComp(getProp("mass","pos"),"x"), getComp(getProp("spring","pos"),"x")) },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "spring", ATTR: "axis" },
        values: {
          VALUE: vecC(v("dx_spring"), num(0), num(0)),
        },
      },
      {
        type: "comment_block",
        fields: { TEXT: "Color the spring based on tension" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "stress_raw" },
        values: { VALUE: div(absOf(v("stretch")), num(2.2)) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "stress" },
        values: { VALUE: minOf(num(1), v("stress_raw")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "col_r" },
        values: { VALUE: add(num(0.55), mul(num(0.45), v("stress"))) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "col_g" },
        values: { VALUE: sub(num(0.82), mul(num(0.45), v("stress"))) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "col_b" },
        values: { VALUE: sub(num(0.92), mul(num(0.50), v("stress"))) },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "spring", ATTR: "color" },
        values: {
          VALUE: vecC(v("col_r"), v("col_g"), v("col_b")),
        },
      },

      // Shadow and phase-space
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "shadow", ATTR: "pos.x" },
        values: { VALUE: getComp(getProp("mass","pos"),"x") },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "ph_x" },
        values: { VALUE: mul(num(0.35), v("stretch")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "ph_y" },
        values: { VALUE: mul(num(0.28), v("v")) },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "phase_arrow", ATTR: "axis" },
        values: {
          VALUE: vecC(v("ph_x"), v("ph_y"), num(0)),
        },
      },

      // Energy
      {
        type: "comment_block",
        fields: { TEXT: "Calculate kinetic and potential energy" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "KE" },
        values: { VALUE: mul(mul(mul(num(0.5), v("m")), v("v")), v("v")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "PE" },
        values: { VALUE: mul(mul(mul(num(0.5), v("k")), v("stretch")), v("stretch")) },
      },

      // Telemetry — 1 block per metric, stacked
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "t", D: 2, U: "s" },
        values: { V: v("t") },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "stretch", D: 3, U: "m" },
        values: { V: v("stretch") },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "velocity", D: 3, U: "m/s" },
        values: { V: v("v") },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "KE", D: 3, U: "J" },
        values: { V: v("KE") },
      },
      {
        type: "telemetry_update_block",
        fields: { LABEL: "telemetry", M: "PE", D: 3, U: "J" },
        values: { V: v("PE") },
      },

      // Advance time
      {
        type: "set_scalar_block",
        fields: { NAME: "t" },
        values: { VALUE: add(v("t"), v("dt")) },
      },
    ],
  },

  /* ── Simulation end ─────────────────────────────────────── */
  { type: "sim_end_block", fields: { MSG: "Spring-Mass simulation complete." } },
];

/* ── Export ───────────────────────────────────────────── */

export const BLOCK_TEMPLATES = [
  {
    id: "blocks_projectile",
    title: "Projectile (Blocks Template)",
    subtitle: "Detailed ballistic launch with telemetry",
    description:
      "Animated projectile template with lighting, launch setup, drag model, velocity arrow, and live telemetry.",
    xml: buildTemplate(normalizeSimulationFlow(PROJECTILE_BLOCKS)),
  },
  {
    id: "blocks_spring",
    title: "Spring-Mass (Blocks Template)",
    subtitle: "Damped harmonic oscillator with energy telemetry",
    description:
      "Animated spring-mass oscillator with Hooke\u2019s law, linear damping, color-mapped tension, phase-space arrow, and live KE/PE telemetry.",
    xml: buildTemplate(normalizeSimulationFlow(SPRING_BLOCKS)),
  },
  {
    id: "blocks_orbits",
    title: "Sun, Earth & Moon (Blocks Template)",
    subtitle: "Three-body gravitational orbit system",
    description:
      "Moon orbits Earth while Earth orbits Sun. Velocity-Verlet integration for long-term stability, with starfield, trails, and telemetry.",
    xml: buildTemplate(normalizeSimulationFlow(ORBIT_BLOCKS)),
  },
];

