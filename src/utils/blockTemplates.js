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

function col(hex) {
  return { type: "colour_block", fields: { COL: hex } };
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
    const stmtName = block.type === "if_else_block" ? "BODY_IF" : "BODY";
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

/* ═══════════════════════════════════════════════════════════
   PROJECTILE TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const PROJECTILE_BLOCKS = [
  /* ── Scene ─────────────────────────────────────────────── */
  {
    type: "scene_setup_block",
    fields: { TITLE: "Projectile Motion", BG: "#0d1629" },
  },
  { type: "scene_range_block", fields: { R: "18" } },
  { type: "set_scalar_block", fields: { NAME: "c_light_a" }, values: { VALUE: col("#e6e6d9") } },
  {
    type: "local_light_block",
    values: { POS: vec(-8, 18, 10), COL: v("c_light_a") },
  },
  {
    type: "scene_forward_block",
    values: { VEC: vec(-0.35, -0.2, -1) },
  },
  {
    type: "scene_center_block",
    values: { VEC: vec(11, 3.5, 0) },
  },
  {
    type: "scene_caption_block",
    fields: { TEXT: "Projectile motion with drag and telemetry\\n" },
  },
  { type: "scene_ambient_block", fields: { GRAY: "0.35" } },

  /* ── Colour constants (template-specific) ─────────────── */
  { type: "set_scalar_block", fields: { NAME: "c_ground" }, values: { VALUE: col("#337346") } },
  { type: "set_scalar_block", fields: { NAME: "c_track" }, values: { VALUE: col("#6b6b7a") } },
  { type: "set_scalar_block", fields: { NAME: "c_marker" }, values: { VALUE: col("#ffcc40") } },
  { type: "set_scalar_block", fields: { NAME: "c_axis_x" }, values: { VALUE: col("#ff3333") } },
  { type: "set_scalar_block", fields: { NAME: "c_axis_y" }, values: { VALUE: col("#33dd66") } },
  { type: "set_scalar_block", fields: { NAME: "c_ball" }, values: { VALUE: col("#f25940") } },
  { type: "set_scalar_block", fields: { NAME: "c_trail" }, values: { VALUE: col("#ffe040") } },
  { type: "set_scalar_block", fields: { NAME: "c_velocity" }, values: { VALUE: col("#59e6ff") } },
  { type: "set_scalar_block", fields: { NAME: "c_tick" }, values: { VALUE: col("#f2f2f2") } },
  { type: "set_scalar_block", fields: { NAME: "c_light_b" }, values: { VALUE: col("#737f99") } },

  /* ── Second light + ground geometry ────────────────────── */
  {
    type: "local_light_block",
    values: { POS: vec(26, 12, -12), COL: v("c_light_b") },
  },
  {
    type: "box_block",
    fields: { NAME: "ground" },
    values: {
      POS: vec(11, -0.55, 0),
      SIZE: vec(34, 1.1, 10),
      COL: v("c_ground"),
    },
  },
  {
    type: "box_block",
    fields: { NAME: "track" },
    values: {
      POS: vec(1.6, 0.2, 0),
      SIZE: vec(3.2, 0.12, 0.9),
      COL: v("c_track"),
    },
  },
  {
    type: "cylinder_block",
    fields: { NAME: "origin_marker" },
    values: {
      POS: vec(0, -0.5, 0),
      AXIS: vec(0, 0.45, 0),
      RADIUS: num(0.06),
      COL: v("c_marker"),
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
          POS: expr("vector(i, -0.02, -0.18)"),
          AXIS: vec(0, 0.04, 0),
          RADIUS: num(0.018),
          COL: v("c_tick"),
        },
      },
    ],
  },

  /* ── Axis arrows ───────────────────────────────────────── */
  {
    type: "arrow_block",
    fields: { NAME: "x_axis_hint" },
    values: { POS: vec(0, 0, 0), AXIS: vec(2.4, 0, 0), COL: v("c_axis_x") },
  },
  {
    type: "arrow_block",
    fields: { NAME: "y_axis_hint" },
    values: { POS: vec(0, 0, 0), AXIS: vec(0, 2.2, 0), COL: v("c_axis_y") },
  },

  /* ── Ball with trail ───────────────────────────────────── */
  {
    type: "sphere_trail_block",
    fields: { NAME: "ball" },
    values: {
      POS: vec(0, 0.35, 0),
      RADIUS: num(0.28),
      COL: v("c_ball"),
      TRAIL_R: num(0.035),
      TRAIL_COL: v("c_trail"),
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
      COL: v("c_velocity"),
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
    values: { VALUE: expr("pi * ball.radius**2") },
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
    values: { VALUE: expr("radians(52)") },
  },

  /* ── Initial velocity ──────────────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Set initial velocity from speed and angle" },
  },
  {
    type: "set_attr_expr_block",
    fields: { OBJ: "ball", ATTR: "velocity" },
    values: { VALUE: expr("vector(v0 * cos(angle), v0 * sin(angle), 0)") },
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
        values: { VALUE: expr("mag(ball.velocity)") },
      },

      // Drag force
      {
        type: "comment_block",
        fields: { TEXT: "Calculate drag force (opposes motion)" },
      },
      {
        type: "if_else_block",
        fields: { COND: "speed > 0" },
        body: [
          {
            type: "set_scalar_block",
            fields: { NAME: "drag" },
            values: { VALUE: mul(mul(num(-1), mul(v("drag_k"), v("speed"))), expr("ball.velocity")) },
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
        values: { VALUE: expr("ball.pos") },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "v_arrow", ATTR: "axis" },
        values: { VALUE: mul(expr("ball.velocity"), num(0.16)) },
      },

      // Ground collision: clamp and bounce
      {
        type: "comment_block",
        fields: { TEXT: "Ground collision: bounce the ball" },
      },
      {
        type: "if_block",
        fields: { COND: "ball.pos.y < ball.radius" },
        body: [
          {
            type: "set_attr_expr_block",
            fields: { OBJ: "ball", ATTR: "pos.y" },
            values: { VALUE: expr("ball.radius") },
          },
          {
            type: "if_block",
            fields: { COND: "ball.velocity.y < 0" },
            body: [
              {
                type: "set_attr_expr_block",
                fields: { OBJ: "ball", ATTR: "velocity.y" },
                values: { VALUE: mul(num(-0.55), expr("ball.velocity.y")) },
              },
            ],
          },
          {
            type: "set_attr_expr_block",
            fields: { OBJ: "ball", ATTR: "velocity.x" },
            values: { VALUE: mul(expr("ball.velocity.x"), num(0.88)) },
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
        fields: { COND: "ball.pos.y <= ball.radius + 0.01" },
        body: [
          {
            type: "if_block",
            fields: { COND: "mag(ball.velocity) < 0.06" },
            body: [
              {
                type: "set_attr_expr_block",
                fields: { OBJ: "ball", ATTR: "velocity" },
                values: { VALUE: expr("vector(0, 0, 0)") },
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
        values: { VALUE: sub(expr("ball.pos.y"), expr("ball.radius")) },
      },
      {
        type: "if_block",
        fields: { COND: "h_above < 0" },
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
        fields: { COND: "h_above > max_height" },
        body: [
          {
            type: "set_scalar_block",
            fields: { NAME: "max_height" },
            values: { VALUE: v("h_above") },
          },
        ],
      },

      // Telemetry
      {
        type: "telemetry_update_block",
        fields: {
          LABEL: "telemetry",
          M1: "t",
          V1: "t",
          D1: 2,
          U1: "s",
          M2: "speed",
          V2: "mag(ball.velocity)",
          D2: 2,
          U2: "m/s",
          M3: "height",
          V3: "h_above",
          D3: 2,
          U3: "m",
          M4: "range",
          V4: "ball.pos.x",
          D4: 2,
          U4: "m",
          M5: "peak",
          V5: "max_height",
          D5: 2,
          U5: "m",
        },
      },

      // Advance time
      {
        type: "set_scalar_block",
        fields: { NAME: "t" },
        values: { VALUE: add(v("t"), v("dt")) },
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   ORBIT TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const ORBIT_BLOCKS = [
  /* ── Scene ─────────────────────────────────────────────── */
  {
    type: "scene_setup_block",
    fields: { TITLE: "Sun, Earth & Moon", BG: "#050917" },
  },
  { type: "scene_range_block", fields: { R: "14" } },
  {
    type: "local_light_block",
    values: { POS: vec(0, 0, 0), COL: col("#fff7d9") },
  },
  {
    type: "scene_forward_block",
    values: { VEC: vec(-0.2, -0.3, -1) },
  },
  {
    type: "scene_caption_block",
    fields: {
      TEXT: "Three-body gravity: Moon orbits Earth, Earth orbits Sun\\n",
    },
  },
  { type: "scene_ambient_block", fields: { GRAY: "0.22" } },

  /* ── Colour constants (template-specific) ─────────────── */
  { type: "set_scalar_block", fields: { NAME: "c_sun" }, values: { VALUE: col("#ffde59") } },
  { type: "set_scalar_block", fields: { NAME: "c_corona" }, values: { VALUE: col("#ffb340") } },
  { type: "set_scalar_block", fields: { NAME: "c_earth" }, values: { VALUE: col("#42b8ff") } },
  { type: "set_scalar_block", fields: { NAME: "c_earth_trail" }, values: { VALUE: col("#73bfff") } },
  { type: "set_scalar_block", fields: { NAME: "c_moon" }, values: { VALUE: col("#e0e0f0") } },
  { type: "set_scalar_block", fields: { NAME: "c_moon_trail" }, values: { VALUE: col("#cccce6") } },
  { type: "set_scalar_block", fields: { NAME: "c_earth_arrow" }, values: { VALUE: col("#ff734d") } },

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
        values: { VALUE: expr("vector(rx, ry, rz)") },
      },
      {
        type: "if_block",
        fields: { COND: "mag(p) == 0" },
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
        values: { VALUE: mul(num(34), expr("norm(p)")) },
      },
      {
        type: "sphere_emissive_block",
        fields: { NAME: "" },
        values: {
          POS: expr("vector(p.x, p.y, p.z)"),
          RADIUS: add(num(0.05), mul(num(0.05), expr("random()"))),
          COL: expr(
            "vector(0.7 + 0.3*random(), 0.7 + 0.3*random(), 1)"
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
    values: { VALUE: add(expr("earth.velocity"), vec(-3.33, 0, 0)) },
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
    values: { VALUE: sub(expr("earth.pos"), expr("sun.pos")) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "d_es" },
    values: { VALUE: expr("max(mag(r_es), 1.2)") },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "a_earth" },
    values: { VALUE: mul(div(mul(num(-1), mul(v("G"), v("M_sun"))), expr("d_es**2")), expr("norm(r_es)")) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "r_ms" },
    values: { VALUE: sub(expr("moon.pos"), expr("sun.pos")) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "d_ms" },
    values: { VALUE: expr("max(mag(r_ms), 1.2)") },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "r_me" },
    values: { VALUE: sub(expr("moon.pos"), expr("earth.pos")) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "d_me" },
    values: { VALUE: expr("max(mag(r_me), 0.22)") },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "a_moon" },
    values: {
      VALUE: sub(
        mul(div(mul(num(-1), mul(v("G"), v("M_sun"))), expr("d_ms**2")), expr("norm(r_ms)")),
        mul(div(mul(v("G"), v("M_earth")), expr("d_me**2")), expr("norm(r_me)"))
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
        values: { VALUE: sub(expr("earth.pos"), expr("sun.pos")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "d_es" },
        values: { VALUE: expr("max(mag(r_es), 1.2)") },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "a_earth" },
        values: { VALUE: mul(div(mul(num(-1), mul(v("G"), v("M_sun"))), expr("d_es**2")), expr("norm(r_es)")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "r_ms" },
        values: { VALUE: sub(expr("moon.pos"), expr("sun.pos")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "d_ms" },
        values: { VALUE: expr("max(mag(r_ms), 1.2)") },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "r_me" },
        values: { VALUE: sub(expr("moon.pos"), expr("earth.pos")) },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "d_me" },
        values: { VALUE: expr("max(mag(r_me), 0.22)") },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "a_moon" },
        values: {
          VALUE: sub(
            mul(div(mul(num(-1), mul(v("G"), v("M_sun"))), expr("d_ms**2")), expr("norm(r_ms)")),
            mul(div(mul(v("G"), v("M_earth")), expr("d_me**2")), expr("norm(r_me)"))
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
        values: { VALUE: expr("sun.pos") },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "earth_arrow", ATTR: "pos" },
        values: { VALUE: expr("earth.pos") },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "earth_arrow", ATTR: "axis" },
        values: { VALUE: mul(num(1.2), v("a_earth")) },
      },

      // Telemetry
      {
        type: "telemetry_update_block",
        fields: {
          LABEL: "telemetry",
          M1: "t",
          V1: "t",
          D1: 2,
          U1: "s",
          M2: "Earth speed",
          V2: "mag(earth.velocity)",
          D2: 3,
          U2: "",
          M3: "Moon speed",
          V3: "mag(moon.velocity)",
          D3: 3,
          U3: "",
          M4: "Earth orbit r",
          V4: "mag(earth.pos)",
          D4: 3,
          U4: "",
          M5: "",
          V5: "",
          D5: 2,
          U5: "",
        },
      },

      // Advance time
      {
        type: "set_scalar_block",
        fields: { NAME: "t" },
        values: { VALUE: add(v("t"), v("dt")) },
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   SPRING-MASS TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const SPRING_BLOCKS = [
  /* ── Scene ─────────────────────────────────────────────── */
  {
    type: "scene_setup_block",
    fields: { TITLE: "Spring-Mass Oscillator", BG: "#0f1224" },
  },
  { type: "scene_range_block", fields: { R: "8.5" } },
  { type: "set_scalar_block", fields: { NAME: "c_light_left" }, values: { VALUE: col("#e6e6ff") } },
  { type: "set_scalar_block", fields: { NAME: "c_light_right" }, values: { VALUE: col("#667388") } },
  {
    type: "local_light_block",
    values: { POS: vec(-2, 10, 8), COL: v("c_light_left") },
  },
  {
    type: "local_light_block",
    values: { POS: vec(8, 5, -10), COL: v("c_light_right") },
  },
  {
    type: "scene_center_block",
    values: { VEC: vec(-0.8, 0, 0) },
  },
  {
    type: "scene_forward_block",
    values: { VEC: vec(-0.25, -0.12, -1) },
  },
  {
    type: "scene_caption_block",
    fields: { TEXT: "Damped oscillator with energy telemetry\\n" },
  },
  { type: "scene_ambient_block", fields: { GRAY: "0.38" } },

  /* ── Colour constants (template-specific) ─────────────── */
  { type: "set_scalar_block", fields: { NAME: "c_floor" }, values: { VALUE: col("#3d4454") } },
  { type: "set_scalar_block", fields: { NAME: "c_rail" }, values: { VALUE: col("#737380") } },
  { type: "set_scalar_block", fields: { NAME: "c_wall" }, values: { VALUE: col("#616885") } },
  { type: "set_scalar_block", fields: { NAME: "c_spring" }, values: { VALUE: col("#c7ccdb") } },
  { type: "set_scalar_block", fields: { NAME: "c_mass" }, values: { VALUE: col("#39dcf2") } },
  { type: "set_scalar_block", fields: { NAME: "c_shadow" }, values: { VALUE: col("#121217") } },
  { type: "set_scalar_block", fields: { NAME: "c_phase_arrow" }, values: { VALUE: col("#ff8c33") } },

  /* ── Environment geometry ──────────────────────────────── */
  {
    type: "box_block",
    fields: { NAME: "floor" },
    values: {
      POS: vec(-0.5, -1.25, 0),
      SIZE: vec(17, 0.3, 5),
      COL: v("c_floor"),
    },
  },
  {
    type: "box_block",
    fields: { NAME: "rail" },
    values: {
      POS: vec(-0.5, -0.65, 0),
      SIZE: vec(16, 0.14, 1.5),
      COL: v("c_rail"),
    },
  },
  {
    type: "box_block",
    fields: { NAME: "wall" },
    values: {
      POS: vec(-6, 0, 0),
      SIZE: vec(0.52, 4.2, 4),
      COL: v("c_wall"),
    },
  },

  /* ── Spring, mass, shadow ───────────────────────────────── */
  {
    type: "comment_block",
    fields: { TEXT: "Spring: k=14 N/m, m=1.2 kg, damping b=0.22" },
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
      COL: v("c_spring"),
    },
  },
  {
    type: "box_block",
    fields: { NAME: "mass" },
    values: {
      POS: vec(-1.75, 0, 0),
      SIZE: vec(1.06, 1.0, 1.0),
      COL: v("c_mass"),
    },
  },
  {
    type: "box_opacity_block",
    fields: { NAME: "shadow" },
    values: {
      POS: expr("vector(mass.pos.x, -1.08, 0)"),
      SIZE: vec(1.0, 0.01, 1.0),
      COL: v("c_shadow"),
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
    values: { VALUE: num(0.22) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "L0" },
    values: { VALUE: num(4.0) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "x0" },
    values: { VALUE: num(1.8) },
  },
  {
    type: "set_scalar_block",
    fields: { NAME: "v" },
    values: { VALUE: num(0.0) },
  },
  { type: "time_step_block", fields: { DT: "0.004" } },
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
    values: { VALUE: add(add(add(expr("wall.pos.x"), num(0.25)), v("L0")), v("x0")) },
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
      COL: v("c_phase_arrow"),
    },
  },

  /* ── Animation loop ────────────────────────────────────── */
  {
    type: "forever_loop_block",
    body: [
      { type: "rate_block", fields: { N: "260" } },

      // Hooke's law
      {
        type: "comment_block",
        fields: { TEXT: "Hooke's law: F = -k * stretch" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "stretch" },
        values: { VALUE: sub(sub(sub(expr("mass.pos.x"), expr("wall.pos.x")), num(0.25)), v("L0")) },
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
        values: { VALUE: add(expr("mass.pos.x"), mul(v("v"), v("dt"))) },
      },

      // Spring visual updates
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "spring", ATTR: "axis" },
        values: {
          VALUE: expr("vector(mass.pos.x - spring.pos.x, 0, 0)"),
        },
      },
      {
        type: "comment_block",
        fields: { TEXT: "Color the spring based on tension" },
      },
      {
        type: "set_scalar_block",
        fields: { NAME: "stress" },
        values: { VALUE: expr("min(1, abs(stretch) / 2.2)") },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "spring", ATTR: "color" },
        values: {
          VALUE: expr(
            "vector(0.55 + 0.45*stress, 0.82 - 0.45*stress, 0.92 - 0.5*stress)"
          ),
        },
      },

      // Shadow and phase-space
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "shadow", ATTR: "pos.x" },
        values: { VALUE: expr("mass.pos.x") },
      },
      {
        type: "set_attr_expr_block",
        fields: { OBJ: "phase_arrow", ATTR: "axis" },
        values: {
          VALUE: expr("vector(0.35 * stretch, 0.28 * v, 0)"),
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

      // Telemetry
      {
        type: "telemetry_update_block",
        fields: {
          LABEL: "telemetry",
          M1: "t",
          V1: "t",
          D1: 2,
          U1: "s",
          M2: "stretch",
          V2: "stretch",
          D2: 3,
          U2: "m",
          M3: "velocity",
          V3: "v",
          D3: 3,
          U3: "m/s",
          M4: "KE",
          V4: "KE",
          D4: 3,
          U4: "J",
          M5: "PE",
          V5: "PE",
          D5: 3,
          U5: "J",
        },
      },

      // Advance time
      {
        type: "set_scalar_block",
        fields: { NAME: "t" },
        values: { VALUE: add(v("t"), v("dt")) },
      },
    ],
  },
];

/* ── Export ───────────────────────────────────────────── */

export const BLOCK_TEMPLATES = [
  {
    id: "blocks_projectile",
    title: "Projectile (Blocks Template)",
    subtitle: "Detailed ballistic launch with telemetry",
    description:
      "Animated projectile template with lighting, launch setup, drag model, velocity arrow, and live telemetry.",
    xml: buildTemplate(PROJECTILE_BLOCKS),
  },
  {
    id: "blocks_spring",
    title: "Spring-Mass (Blocks Template)",
    subtitle: "Damped harmonic oscillator with energy telemetry",
    description:
      "Animated spring-mass oscillator with Hooke\u2019s law, linear damping, color-mapped tension, phase-space arrow, and live KE/PE telemetry.",
    xml: buildTemplate(SPRING_BLOCKS),
  },
  {
    id: "blocks_orbits",
    title: "Sun, Earth & Moon (Blocks Template)",
    subtitle: "Three-body gravitational orbit system",
    description:
      "Moon orbits Earth while Earth orbits Sun. Velocity-Verlet integration for long-term stability, with starfield, trails, and telemetry.",
    xml: buildTemplate(ORBIT_BLOCKS),
  },
];
