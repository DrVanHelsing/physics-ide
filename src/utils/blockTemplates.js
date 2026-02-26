/**
 * blockTemplates.js
 *
 * Block-mode templates for the Physics IDE.
 * Uses a programmatic builder to generate clean Blockly XML from
 * flat block descriptor arrays, eliminating manual XML nesting errors.
 *
 * IMPORTANT: In GlowScript 3.2, `make_trail` MUST be passed as a
 * constructor argument to sphere()/box()/arrow()/etc.  Setting it
 * post-creation (e.g. ball.make_trail = True) causes a runtime error:
 *   "Cannot read properties of undefined (reading 'start')"
 * Objects that need trails are therefore created via python_raw_block
 * with all trail params in the constructor call.
 */

/* ── XML builder helpers ─────────────────────────────────── */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Recursively build nested Blockly XML from a flat array of block
 * descriptors.  Each descriptor:
 *   { type: string, fields?: Record<string,string>, body?: descriptor[] }
 * `body` is used for statement inputs (e.g. forever_loop_block BODY).
 */
function buildChain(blocks, isFirst) {
  if (!blocks || blocks.length === 0) return '';
  const block = blocks[0];
  const rest = blocks.slice(1);

  const posAttr = isFirst ? ' x="24" y="20"' : '';
  let content = '';

  if (block.fields) {
    for (const [name, value] of Object.entries(block.fields)) {
      content += `<field name="${name}">${esc(String(value))}</field>`;
    }
  }

  if (block.body) {
    content += `<statement name="BODY">${buildChain(block.body, false)}</statement>`;
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
  { type: 'scene_setup_block', fields: { TITLE: 'Projectile Motion', BG: '#0d1629' } },
  { type: 'scene_range_block', fields: { R: '18' } },
  { type: 'local_light_block', fields: { X: '-8', Y: '18', Z: '10', COL: '#e6e6d9' } },

  /* ── Camera & caption (raw) ────────────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: configure camera and scene caption' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.forward = vector(-0.35, -0.2, -1)' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.center = vector(11, 3.5, 0)' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.caption = "Projectile motion with drag and telemetry\\n"' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.ambient = color.gray(0.35)' } },

  /* ── Second light + ground geometry ────────────────────── */
  { type: 'local_light_block', fields: { X: '26', Y: '12', Z: '-12', COL: '#737f99' } },
  { type: 'box_block', fields: { NAME: 'ground', X: '11', Y: '-0.55', Z: '0', SX: '34', SY: '1.1', SZ: '10', COL: '#337346' } },
  { type: 'box_block', fields: { NAME: 'track', X: '1.6', Y: '0.2', Z: '0', SX: '3.2', SY: '0.12', SZ: '0.9', COL: '#6b6b7a' } },
  { type: 'cylinder_block', fields: { NAME: 'origin_marker', X: '0', Y: '-0.5', Z: '0', AX: '0', AY: '0.45', AZ: '0', R: '0.06', COL: '#ffcc40' } },

  /* ── Distance ticks (raw) ──────────────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: distance ticks along the ground' } },
  { type: 'python_raw_block', fields: { CODE: 'for i in range(0, 31, 5): cylinder(pos=vector(i, -0.02, -0.18), axis=vector(0, 0.04, 0), radius=0.018, color=color.white)' } },

  /* ── Axis arrows ───────────────────────────────────────── */
  { type: 'arrow_block', fields: { NAME: 'x_axis_hint', X: '0', Y: '0', Z: '0', AX: '2.4', AY: '0', AZ: '0', COL: '#ff3333' } },
  { type: 'arrow_block', fields: { NAME: 'y_axis_hint', X: '0', Y: '0', Z: '0', AX: '0', AY: '2.2', AZ: '0', COL: '#33dd66' } },

  /* ── Ball — raw block because make_trail must be in constructor ── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: create ball with trail (make_trail must be in constructor)' } },
  { type: 'python_raw_block', fields: { CODE: 'ball = sphere(pos=vector(0, 0.35, 0), radius=0.28, color=vector(0.95, 0.35, 0.25), make_trail=True, trail_radius=0.035, trail_color=vector(1, 0.88, 0.25), retain=260, shininess=0.85)' } },

  /* ── Velocity arrow ────────────────────────────────────── */
  { type: 'arrow_block', fields: { NAME: 'v_arrow', X: '0', Y: '0.35', Z: '0', AX: '0', AY: '0', AZ: '0', COL: '#59e6ff' } },

  /* ── Physics constants ─────────────────────────────────── */
  { type: 'set_vector_expr_block', fields: { NAME: 'g', VALUE: '0, -9.81, 0' } },
  { type: 'set_scalar_block', fields: { NAME: 'rho', VALUE: '1.225' } },
  { type: 'set_scalar_block', fields: { NAME: 'Cd', VALUE: '0.47' } },
  { type: 'set_scalar_block', fields: { NAME: 'A', VALUE: 'pi * ball.radius**2' } },
  { type: 'set_scalar_block', fields: { NAME: 'm', VALUE: '0.34' } },
  { type: 'set_scalar_block', fields: { NAME: 'drag_k', VALUE: '0.5 * rho * Cd * A' } },
  { type: 'set_scalar_block', fields: { NAME: 'v0', VALUE: '17.5' } },
  { type: 'set_scalar_block', fields: { NAME: 'angle', VALUE: 'radians(52)' } },

  /* ── Initial velocity ──────────────────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'One-line block: initial launch velocity from speed and angle' } },
  { type: 'set_attr_expr_block', fields: { OBJ: 'ball', ATTR: 'velocity', EXPR: 'vector(v0 * cos(angle), v0 * sin(angle), 0)' } },

  /* ── Time step and state ───────────────────────────────── */
  { type: 'time_step_block', fields: { DT: '0.004' } },
  { type: 'set_scalar_block', fields: { NAME: 't', VALUE: '0' } },
  { type: 'set_scalar_block', fields: { NAME: 'max_height', VALUE: 'ball.pos.y' } },

  /* ── Telemetry label (raw) ─────────────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: create telemetry label object' } },
  { type: 'python_raw_block', fields: { CODE: 'telemetry = label(pos=vector(8.5, 9.2, 0), text="", height=12, box=False, opacity=0, color=color.white)' } },

  /* ── Animation loop ────────────────────────────────────── */
  { type: 'forever_loop_block', body: [
    { type: 'rate_block', fields: { N: '240' } },

    // Drag model (raw — complex expression)
    { type: 'comment_block', fields: { TEXT: 'Raw code: drag force and acceleration model' } },
    { type: 'python_raw_block', fields: { CODE: 'speed = mag(ball.velocity)' } },
    { type: 'python_raw_block', fields: { CODE: 'drag = -drag_k * speed * ball.velocity if speed > 0 else vector(0, 0, 0)' } },
    { type: 'python_raw_block', fields: { CODE: 'acceleration = g + drag / m' } },

    // Velocity and position update
    { type: 'add_attr_expr_block', fields: { EXPR: 'acceleration * dt', OBJ: 'ball', ATTR: 'velocity' } },
    { type: 'update_position_block', fields: { OBJ: 'ball', DT: 'dt' } },

    // Velocity arrow follows ball
    { type: 'set_attr_expr_block', fields: { OBJ: 'v_arrow', ATTR: 'pos', EXPR: 'ball.pos' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'v_arrow', ATTR: 'axis', EXPR: 'ball.velocity * 0.16' } },

    // Telemetry and bounce (raw)
    { type: 'python_raw_block', fields: { CODE: 'max_height = ball.pos.y if ball.pos.y > max_height else max_height' } },
    { type: 'python_raw_block', fields: { CODE: 'telemetry.text = "t = " + str(round(t,2)) + " s\\nspeed = " + str(round(mag(ball.velocity),2)) + " m/s\\nheight = " + str(round(ball.pos.y,2)) + " m\\nrange = " + str(round(ball.pos.x,2)) + " m\\npeak height = " + str(round(max_height,2)) + " m"' } },
    { type: 'python_raw_block', fields: { CODE: 'if ball.pos.y < ball.radius and ball.velocity.y < 0: ball.velocity.y = -0.55 * ball.velocity.y' } },

    // Advance time
    { type: 'set_scalar_block', fields: { NAME: 't', VALUE: 't + dt' } },
  ]},
];

/* ═══════════════════════════════════════════════════════════
   ORBIT TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const ORBIT_BLOCKS = [
  /* ── Scene ─────────────────────────────────────────────── */
  { type: 'scene_setup_block', fields: { TITLE: 'Planetary Orbit', BG: '#050917' } },
  { type: 'scene_range_block', fields: { R: '12' } },
  { type: 'local_light_block', fields: { X: '0', Y: '0', Z: '0', COL: '#fff7d9' } },

  /* ── Camera, caption, ambient, starfield (raw) ─────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: camera setup, caption, ambient, and starfield' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.forward = vector(-0.2, -0.08, -1)' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.caption = "Two-body + moon gravity system\\n"' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.ambient = color.gray(0.22)' } },
  { type: 'python_raw_block', fields: { CODE: 'for i in range(120): p = vector(2*random()-1, 2*random()-1, 2*random()-1); p = 34 * norm(p if mag(p) > 0 else vector(1, 0, 0)); sphere(pos=p, radius=0.05 + 0.05 * random(), color=vector(0.7 + 0.3 * random(), 0.7 + 0.3 * random(), 1), emissive=True, opacity=0.9)' } },

  /* ── Celestial bodies — raw blocks because make_trail / emissive
       must be constructor args in GlowScript 3.2 ─────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: star, corona, planet, moon (make_trail in constructor)' } },
  { type: 'python_raw_block', fields: { CODE: 'star = sphere(pos=vector(0,0,0), radius=1.05, color=vector(1,0.87,0.35), emissive=True, shininess=1)' } },
  { type: 'python_raw_block', fields: { CODE: 'corona = sphere(pos=vector(0,0,0), radius=1.45, color=vector(1,0.7,0.25), opacity=0.15, emissive=True)' } },
  { type: 'python_raw_block', fields: { CODE: 'planet = sphere(pos=vector(8.2,0,0), radius=0.42, color=vector(0.26,0.72,1), shininess=0.55, make_trail=True, retain=3200, trail_radius=0.04, trail_color=vector(0.45,0.75,1))' } },
  { type: 'python_raw_block', fields: { CODE: 'moon = sphere(pos=vector(9.15,0,0), radius=0.13, color=vector(0.88,0.88,0.94), shininess=0.28, make_trail=True, retain=1200, trail_radius=0.02, trail_color=vector(0.8,0.8,0.9))' } },

  /* ── Velocities ────────────────────────────────────────── */
  { type: 'set_velocity_block', fields: { OBJ: 'planet', VX: '0', VY: '3.55', VZ: '0' } },
  { type: 'set_attr_expr_block', fields: { OBJ: 'moon', ATTR: 'velocity', EXPR: 'planet.velocity + vector(0, 1.3, 0)' } },

  /* ── Gravitational parameters ──────────────────────────── */
  { type: 'set_scalar_block', fields: { NAME: 'G', VALUE: '24.5' } },
  { type: 'set_scalar_block', fields: { NAME: 'M_star', VALUE: '24.0' } },
  { type: 'set_scalar_block', fields: { NAME: 'M_planet', VALUE: '0.16' } },

  /* ── Time step and state ───────────────────────────────── */
  { type: 'time_step_block', fields: { DT: '0.0016' } },
  { type: 'set_scalar_block', fields: { NAME: 't', VALUE: '0' } },

  /* ── Planet velocity arrow ─────────────────────────────── */
  { type: 'arrow_block', fields: { NAME: 'planet_arrow', X: '8.2', Y: '0', Z: '0', AX: '0', AY: '0', AZ: '0', COL: '#ff734d' } },

  /* ── Telemetry label (raw) ─────────────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: create telemetry label for orbit diagnostics' } },
  { type: 'python_raw_block', fields: { CODE: 'telemetry = label(pos=vector(-10.8, 9.5, 0), text="", height=12, box=False, opacity=0, color=color.white)' } },

  /* ── Animation loop ────────────────────────────────────── */
  { type: 'forever_loop_block', body: [
    { type: 'rate_block', fields: { N: '900' } },

    // Gravitational computations with softening (raw — complex math)
    { type: 'comment_block', fields: { TEXT: 'Raw code: gravitational accelerations with softening' } },
    { type: 'python_raw_block', fields: { CODE: 'r_ps = planet.pos - star.pos; d_ps = max(mag(r_ps), 1.2)' } },
    { type: 'python_raw_block', fields: { CODE: 'a_planet = -G * M_star / d_ps**2 * norm(r_ps)' } },
    { type: 'python_raw_block', fields: { CODE: 'r_ms = moon.pos - star.pos; d_ms = max(mag(r_ms), 1.2)' } },
    { type: 'python_raw_block', fields: { CODE: 'r_mp = moon.pos - planet.pos; d_mp = max(mag(r_mp), 0.22)' } },
    { type: 'python_raw_block', fields: { CODE: 'a_moon_star = -G * M_star / d_ms**2 * norm(r_ms)' } },
    { type: 'set_scalar_block', fields: { NAME: 'a_moon_planet', VALUE: '-G * M_planet / d_mp**2 * norm(r_mp)' } },
    { type: 'set_scalar_block', fields: { NAME: 'a_moon', VALUE: 'a_moon_star + a_moon_planet' } },

    // Velocity & position updates
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_planet * dt', OBJ: 'planet', ATTR: 'velocity' } },
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_moon * dt', OBJ: 'moon', ATTR: 'velocity' } },
    { type: 'update_position_block', fields: { OBJ: 'planet', DT: 'dt' } },
    { type: 'update_position_block', fields: { OBJ: 'moon', DT: 'dt' } },

    // Visual updates
    { type: 'set_attr_expr_block', fields: { OBJ: 'corona', ATTR: 'pos', EXPR: 'star.pos' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'planet_arrow', ATTR: 'pos', EXPR: 'planet.pos' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'planet_arrow', ATTR: 'axis', EXPR: '1.2 * a_planet' } },

    // Telemetry (raw)
    { type: 'python_raw_block', fields: { CODE: 'telemetry.text = "t = " + str(round(t,2)) + " s\\nplanet speed = " + str(round(mag(planet.velocity),3)) + "\\nmoon speed = " + str(round(mag(moon.velocity),3)) + "\\nplanet radius = " + str(round(mag(planet.pos),3))' } },

    // Advance time
    { type: 'set_scalar_block', fields: { NAME: 't', VALUE: 't + dt' } },
  ]},
];

/* ── Export ───────────────────────────────────────────────── */

export const BLOCK_TEMPLATES = [
  {
    id: 'blocks_projectile',
    title: 'Projectile (Blocks Template)',
    subtitle: 'Detailed ballistic launch with telemetry',
    description:
      'Animated projectile template with lighting, launch setup, drag model, velocity arrow, and live telemetry.',
    xml: buildTemplate(PROJECTILE_BLOCKS),
  },
  {
    id: 'blocks_orbits',
    title: 'Orbit (Blocks Template)',
    subtitle: 'Detailed star-planet-moon gravity system',
    description:
      'Animated orbit template with starfield, trails, two-body + moon gravity, and real-time telemetry.',
    xml: buildTemplate(ORBIT_BLOCKS),
  },
];
