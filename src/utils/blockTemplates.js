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
 * Objects that need trails must use sphere_trail_block, which always sets
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
  { type: 'scene_forward_block', fields: { X: '-0.35', Y: '-0.2', Z: '-1' } },
  { type: 'scene_center_block', fields: { X: '11', Y: '3.5', Z: '0' } },
  { type: 'scene_caption_block', fields: { TEXT: 'Projectile motion with drag and telemetry\n' } },
  { type: 'scene_ambient_block', fields: { GRAY: '0.35' } },

  /* ── Second light + ground geometry ────────────────────── */
  { type: 'local_light_block', fields: { X: '26', Y: '12', Z: '-12', COL: '#737f99' } },
  { type: 'box_block', fields: { NAME: 'ground', X: '11', Y: '-0.55', Z: '0', SX: '34', SY: '1.1', SZ: '10', COL: '#337346' } },
  { type: 'box_block', fields: { NAME: 'track', X: '1.6', Y: '0.2', Z: '0', SX: '3.2', SY: '0.12', SZ: '0.9', COL: '#6b6b7a' } },
  { type: 'cylinder_block', fields: { NAME: 'origin_marker', X: '0', Y: '-0.5', Z: '0', AX: '0', AY: '0.45', AZ: '0', R: '0.06', COL: '#ffcc40' } },

  /* ── Distance ticks ────────────────────────────────────── */
  { type: 'for_range_block', fields: { VAR: 'i', START: '0', STOP: '31', STEP: '5' }, body: [
    { type: 'exec_block', fields: { EXPR: 'cylinder(pos=vector(i, -0.02, -0.18), axis=vector(0, 0.04, 0), radius=0.018, color=color.white)' } },
  ]},

  /* ── Axis arrows ───────────────────────────────────────── */
  { type: 'arrow_block', fields: { NAME: 'x_axis_hint', X: '0', Y: '0', Z: '0', AX: '2.4', AY: '0', AZ: '0', COL: '#ff3333' } },
  { type: 'arrow_block', fields: { NAME: 'y_axis_hint', X: '0', Y: '0', Z: '0', AX: '0', AY: '2.2', AZ: '0', COL: '#33dd66' } },

  /* ── Ball with trail (make_trail must be in constructor) ── */
  { type: 'sphere_trail_block', fields: { NAME: 'ball', X: '0', Y: '0.35', Z: '0', R: '0.28', COL: '#f25940', TRAIL_R: '0.035', TRAIL_COL: '#ffe040', RETAIN: '260', SHINE: '0.85' } },

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
  { type: 'set_attr_expr_block', fields: { OBJ: 'ball', ATTR: 'velocity', EXPR: 'vector(v0 * cos(angle), v0 * sin(angle), 0)' } },

  /* ── Time step and state ───────────────────────────────── */
  { type: 'time_step_block', fields: { DT: '0.004' } },
  { type: 'set_scalar_block', fields: { NAME: 't', VALUE: '0' } },
  { type: 'set_scalar_block', fields: { NAME: 'max_height', VALUE: '0.0' } },

  /* ── Telemetry label ────────────────────────────────────── */
  { type: 'label_full_block', fields: { NAME: 'telemetry', X: '8.5', Y: '9.2', Z: '0', TEXT: '', HEIGHT: '12' } },

  /* ── Animation loop ────────────────────────────────────── */
  { type: 'forever_loop_block', body: [
    { type: 'rate_block', fields: { N: '240' } },

    // Speed, drag, and acceleration
    { type: 'set_scalar_block', fields: { NAME: 'speed', VALUE: 'mag(ball.velocity)' } },
    { type: 'set_scalar_block', fields: { NAME: 'drag', VALUE: '-drag_k * speed * ball.velocity if speed > 0 else vector(0, 0, 0)' } },
    { type: 'set_scalar_block', fields: { NAME: 'acceleration', VALUE: 'g + drag / m' } },

    // Velocity and position update
    { type: 'add_attr_expr_block', fields: { EXPR: 'acceleration * dt', OBJ: 'ball', ATTR: 'velocity' } },
    { type: 'update_position_block', fields: { OBJ: 'ball', DT: 'dt' } },

    // Velocity arrow follows ball
    { type: 'set_attr_expr_block', fields: { OBJ: 'v_arrow', ATTR: 'pos', EXPR: 'ball.pos' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'v_arrow', ATTR: 'axis', EXPR: 'ball.velocity * 0.16' } },

    // Ground collision: clamp and bounce
    { type: 'if_block', fields: { COND: 'ball.pos.y < ball.radius' }, body: [
      { type: 'set_attr_expr_block', fields: { OBJ: 'ball', ATTR: 'pos.y', EXPR: 'ball.radius' } },
      { type: 'if_block', fields: { COND: 'ball.velocity.y < 0' }, body: [
        { type: 'set_attr_expr_block', fields: { OBJ: 'ball', ATTR: 'velocity.y', EXPR: '-0.55 * ball.velocity.y' } },
      ]},
      { type: 'set_attr_expr_block', fields: { OBJ: 'ball', ATTR: 'velocity.x', EXPR: 'ball.velocity.x * 0.88' } },
    ]},

    // Stop when at rest
    { type: 'if_block', fields: { COND: 'ball.pos.y <= ball.radius + 0.01 and mag(ball.velocity) < 0.06' }, body: [
      { type: 'set_attr_expr_block', fields: { OBJ: 'ball', ATTR: 'velocity', EXPR: 'vector(0, 0, 0)' } },
    ]},

    // Telemetry
    { type: 'set_scalar_block', fields: { NAME: 'h_above', VALUE: 'max(0, ball.pos.y - ball.radius)' } },
    { type: 'set_scalar_block', fields: { NAME: 'max_height', VALUE: 'h_above if h_above > max_height else max_height' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'telemetry', ATTR: 'text', EXPR: '"t = " + str(round(t,2)) + " s\\nspeed = " + str(round(mag(ball.velocity),2)) + " m/s\\nheight = " + str(round(h_above,2)) + " m\\nrange = " + str(round(ball.pos.x,2)) + " m\\npeak = " + str(round(max_height,2)) + " m"' } },

    // Advance time
    { type: 'set_scalar_block', fields: { NAME: 't', VALUE: 't + dt' } },
  ]},
];

/* ═══════════════════════════════════════════════════════════
   ORBIT TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const ORBIT_BLOCKS = [
  /* ── Scene ─────────────────────────────────────────────── */
  { type: 'scene_setup_block', fields: { TITLE: 'Sun, Earth & Moon', BG: '#050917' } },
  { type: 'scene_range_block', fields: { R: '14' } },
  { type: 'local_light_block', fields: { X: '0', Y: '0', Z: '0', COL: '#fff7d9' } },
  { type: 'scene_forward_block', fields: { X: '-0.2', Y: '-0.3', Z: '-1' } },
  { type: 'scene_caption_block', fields: { TEXT: 'Three-body gravity: Moon orbits Earth, Earth orbits Sun\n' } },
  { type: 'scene_ambient_block', fields: { GRAY: '0.22' } },

  /* ── Starfield ──────────────────────────────────────────── */
  { type: 'for_range_block', fields: { VAR: '_', START: '0', STOP: '120', STEP: '1' }, body: [
    { type: 'set_scalar_block', fields: { NAME: 'p', VALUE: 'vector(2*random()-1, 2*random()-1, 2*random()-1)' } },
    { type: 'set_scalar_block', fields: { NAME: 'p', VALUE: '34 * norm(p if mag(p) > 0 else vector(1, 0, 0))' } },
    { type: 'exec_block', fields: { EXPR: 'sphere(pos=vector(p.x, p.y, p.z), radius=0.05 + 0.05 * random(), color=vector(0.7 + 0.3 * random(), 0.7 + 0.3 * random(), 1), emissive=True, opacity=0.9)' } },
  ]},

  /* ── Celestial bodies ───────────────────────────────────── */
  // G=10, M_sun=10.33 → v_circ = sqrt(10*10.33/8.2) ≈ 3.55 (Earth)
  // M_earth=1.0 → v_moon_rel = sqrt(10*1.0/0.9) ≈ 3.33; Hill sphere ≈ 2.6 >> 0.9 (stable)
  { type: 'sphere_emissive_block', fields: { NAME: 'sun',    X: '0',   Y: '0',   Z: '0', R: '1.05', COL: '#ffde59', OPACITY: '1',    SHINE: '1'    } },
  { type: 'sphere_emissive_block', fields: { NAME: 'corona', X: '0',   Y: '0',   Z: '0', R: '1.45', COL: '#ffb340', OPACITY: '0.15', SHINE: '0'    } },
  { type: 'sphere_trail_block',    fields: { NAME: 'earth',  X: '8.2', Y: '0',   Z: '0', R: '0.42', COL: '#42b8ff', TRAIL_R: '0.04', TRAIL_COL: '#73bfff', RETAIN: '3200', SHINE: '0.55' } },
  { type: 'sphere_trail_block',    fields: { NAME: 'moon',   X: '8.2', Y: '0.9', Z: '0', R: '0.13', COL: '#e0e0f0', TRAIL_R: '0.02', TRAIL_COL: '#cccce6', RETAIN: '1200', SHINE: '0.28' } },

  /* ── Gravitational parameters ──────────────────────────── */
  { type: 'set_scalar_block', fields: { NAME: 'G',       VALUE: '10'    } },
  { type: 'set_scalar_block', fields: { NAME: 'M_sun',   VALUE: '10.33' } },
  { type: 'set_scalar_block', fields: { NAME: 'M_earth', VALUE: '1.0'   } },

  /* ── Velocities ────────────────────────────────────────── */
  { type: 'set_velocity_block',    fields: { OBJ: 'earth', VX: '0', VY: '3.55', VZ: '0' } },
  { type: 'set_attr_expr_block',   fields: { OBJ: 'moon', ATTR: 'velocity', EXPR: 'earth.velocity + vector(-3.33, 0, 0)' } },

  /* ── Time step ──────────────────────────────────────────── */
  { type: 'time_step_block', fields: { DT: '0.0008' } },
  { type: 'set_scalar_block', fields: { NAME: 't', VALUE: '0' } },

  /* ── Initial accelerations for velocity-Verlet ─────────── */
  { type: 'set_scalar_block', fields: { NAME: 'r_es',   VALUE: 'earth.pos - sun.pos' } },
  { type: 'set_scalar_block', fields: { NAME: 'd_es',   VALUE: 'max(mag(r_es), 1.2)' } },
  { type: 'set_scalar_block', fields: { NAME: 'a_earth', VALUE: '-G * M_sun / d_es**2 * norm(r_es)' } },
  { type: 'set_scalar_block', fields: { NAME: 'r_ms',   VALUE: 'moon.pos - sun.pos' } },
  { type: 'set_scalar_block', fields: { NAME: 'd_ms',   VALUE: 'max(mag(r_ms), 1.2)' } },
  { type: 'set_scalar_block', fields: { NAME: 'r_me',   VALUE: 'moon.pos - earth.pos' } },
  { type: 'set_scalar_block', fields: { NAME: 'd_me',   VALUE: 'max(mag(r_me), 0.22)' } },
  { type: 'set_scalar_block', fields: { NAME: 'a_moon', VALUE: '-G * M_sun / d_ms**2 * norm(r_ms) - G * M_earth / d_me**2 * norm(r_me)' } },

  /* ── Earth velocity arrow + telemetry ─────────────────── */
  { type: 'arrow_block',      fields: { NAME: 'earth_arrow', X: '8.2', Y: '0', Z: '0', AX: '0', AY: '0', AZ: '0', COL: '#ff734d' } },
  { type: 'label_full_block', fields: { NAME: 'telemetry', X: '-12', Y: '11', Z: '0', TEXT: '', HEIGHT: '12' } },

  /* ── Animation loop ────────────────────────────────────── */
  { type: 'forever_loop_block', body: [
    { type: 'rate_block', fields: { N: '900' } },

    // Velocity-Verlet: half-step kick
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_earth * dt / 2', OBJ: 'earth', ATTR: 'velocity' } },
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_moon * dt / 2',  OBJ: 'moon',  ATTR: 'velocity' } },

    // Full-step position drift
    { type: 'update_position_block', fields: { OBJ: 'earth', DT: 'dt' } },
    { type: 'update_position_block', fields: { OBJ: 'moon',  DT: 'dt' } },

    // Recompute accelerations at new positions
    { type: 'set_scalar_block', fields: { NAME: 'r_es',    VALUE: 'earth.pos - sun.pos' } },
    { type: 'set_scalar_block', fields: { NAME: 'd_es',    VALUE: 'max(mag(r_es), 1.2)' } },
    { type: 'set_scalar_block', fields: { NAME: 'a_earth', VALUE: '-G * M_sun / d_es**2 * norm(r_es)' } },
    { type: 'set_scalar_block', fields: { NAME: 'r_ms',    VALUE: 'moon.pos - sun.pos' } },
    { type: 'set_scalar_block', fields: { NAME: 'd_ms',    VALUE: 'max(mag(r_ms), 1.2)' } },
    { type: 'set_scalar_block', fields: { NAME: 'r_me',    VALUE: 'moon.pos - earth.pos' } },
    { type: 'set_scalar_block', fields: { NAME: 'd_me',    VALUE: 'max(mag(r_me), 0.22)' } },
    { type: 'set_scalar_block', fields: { NAME: 'a_moon',  VALUE: '-G * M_sun / d_ms**2 * norm(r_ms) - G * M_earth / d_me**2 * norm(r_me)' } },

    // Velocity-Verlet: second half-step kick
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_earth * dt / 2', OBJ: 'earth', ATTR: 'velocity' } },
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_moon * dt / 2',  OBJ: 'moon',  ATTR: 'velocity' } },

    // Visual updates
    { type: 'set_attr_expr_block', fields: { OBJ: 'corona',      ATTR: 'pos',  EXPR: 'sun.pos'    } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'earth_arrow', ATTR: 'pos',  EXPR: 'earth.pos'  } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'earth_arrow', ATTR: 'axis', EXPR: '1.2 * a_earth' } },

    // Telemetry
    { type: 'set_attr_expr_block', fields: { OBJ: 'telemetry', ATTR: 'text', EXPR: '"t = " + str(round(t,2)) + " s\\nEarth speed = " + str(round(mag(earth.velocity),3)) + "\\nMoon speed = " + str(round(mag(moon.velocity),3)) + "\\nEarth orbit r = " + str(round(mag(earth.pos),3))' } },

    // Advance time
    { type: 'set_scalar_block', fields: { NAME: 't', VALUE: 't + dt' } },
  ]},
];

/* ═══════════════════════════════════════════════════════════
   SPRING-MASS TEMPLATE
   ═══════════════════════════════════════════════════════════ */

const SPRING_BLOCKS = [
  /* ── Scene ─────────────────────────────────────────────── */
  { type: 'scene_setup_block', fields: { TITLE: 'Spring-Mass Oscillator', BG: '#0f1224' } },
  { type: 'scene_range_block', fields: { R: '8.5' } },
  { type: 'local_light_block', fields: { X: '-2', Y: '10', Z: '8',  COL: '#e6e6ff' } },
  { type: 'local_light_block', fields: { X: '8',  Y: '5',  Z: '-10', COL: '#667388' } },
  { type: 'scene_center_block',  fields: { X: '-0.8', Y: '0',    Z: '0'  } },
  { type: 'scene_forward_block', fields: { X: '-0.25', Y: '-0.12', Z: '-1' } },
  { type: 'scene_caption_block', fields: { TEXT: 'Damped oscillator with energy telemetry\n' } },
  { type: 'scene_ambient_block', fields: { GRAY: '0.38' } },

  /* ── Environment geometry ──────────────────────────────── */
  { type: 'box_block', fields: { NAME: 'floor', X: '-0.5', Y: '-1.25', Z: '0', SX: '17',   SY: '0.3',  SZ: '5',   COL: '#3d4454' } },
  { type: 'box_block', fields: { NAME: 'rail',  X: '-0.5', Y: '-0.65', Z: '0', SX: '16',   SY: '0.14', SZ: '1.5', COL: '#737380' } },
  { type: 'box_block', fields: { NAME: 'wall',  X: '-6',   Y: '0',     Z: '0', SX: '0.52', SY: '4.2',  SZ: '4',   COL: '#616885' } },

  /* ── Spring, mass, shadow ───────────────────────────────── */
  // k=14 N/m, m=1.2 kg, b=0.22 Ns/m → underdamped (b_crit≈8.2), ω=3.42 rad/s, T≈1.84 s
  { type: 'set_vector_expr_block', fields: { NAME: 'anchor', VALUE: '-5.74, 0, 0' } },
  { type: 'helix_full_block', fields: { NAME: 'spring', POS: 'anchor', AXIS: 'vector(4.0, 0, 0)', R: '0.36', COILS: '16', THICK: '0.055', COL: '#c7ccdb' } },
  { type: 'box_block',         fields: { NAME: 'mass',   X: '-1.75', Y: '0',     Z: '0', SX: '1.06', SY: '1.0', SZ: '1.0', COL: '#39dcf2' } },
  { type: 'box_opacity_block', fields: { NAME: 'shadow', X: 'mass.pos.x', Y: '-1.08', Z: '0', SX: '1.0', SY: '0.01', SZ: '1.0', COL: '#121217', OPACITY: '0.45' } },

  /* ── Physics constants ─────────────────────────────────── */
  { type: 'set_scalar_block', fields: { NAME: 'k',  VALUE: '14.0' } },
  { type: 'set_scalar_block', fields: { NAME: 'm',  VALUE: '1.2'  } },
  { type: 'set_scalar_block', fields: { NAME: 'b',  VALUE: '0.22' } },
  { type: 'set_scalar_block', fields: { NAME: 'L0', VALUE: '4.0'  } },
  { type: 'set_scalar_block', fields: { NAME: 'x0', VALUE: '1.8'  } },
  { type: 'set_scalar_block', fields: { NAME: 'v',  VALUE: '0.0'  } },
  { type: 'time_step_block',  fields: { DT: '0.004' } },
  { type: 'set_scalar_block', fields: { NAME: 't',  VALUE: '0.0'  } },

  /* ── Initial stretched position ────────────────────────── */
  { type: 'set_attr_expr_block', fields: { OBJ: 'mass', ATTR: 'pos.x', EXPR: 'wall.pos.x + 0.25 + L0 + x0' } },

  /* ── Telemetry label and phase-space arrow ──────────────── */
  { type: 'label_full_block', fields: { NAME: 'telemetry',  X: '0.2', Y: '2.9',  Z: '0', TEXT: '', HEIGHT: '12' } },
  { type: 'arrow_block',      fields: { NAME: 'phase_arrow', X: '4.8', Y: '-0.2', Z: '0', AX: '0', AY: '0', AZ: '0', COL: '#ff8c33' } },

  /* ── Animation loop ────────────────────────────────────── */
  { type: 'forever_loop_block', body: [
    { type: 'rate_block', fields: { N: '260' } },

    // Hooke's law, damping, and acceleration
    { type: 'set_scalar_block', fields: { NAME: 'stretch', VALUE: '(mass.pos.x - wall.pos.x - 0.25) - L0' } },
    { type: 'set_scalar_block', fields: { NAME: 'Fspring', VALUE: '-k * stretch' } },
    { type: 'set_scalar_block', fields: { NAME: 'Fdamp',   VALUE: '-b * v' } },
    { type: 'set_scalar_block', fields: { NAME: 'a',       VALUE: '(Fspring + Fdamp) / m' } },

    // Euler integration
    { type: 'set_scalar_block',    fields: { NAME: 'v', VALUE: 'v + a * dt' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'mass', ATTR: 'pos.x', EXPR: 'mass.pos.x + v * dt' } },

    // Spring visual updates
    { type: 'set_attr_expr_block', fields: { OBJ: 'spring', ATTR: 'axis',  EXPR: 'vector(mass.pos.x - spring.pos.x, 0, 0)' } },
    { type: 'set_scalar_block',    fields: { NAME: 'stress', VALUE: 'min(1, abs(stretch) / 2.2)' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'spring', ATTR: 'color', EXPR: 'vector(0.55 + 0.45 * stress, 0.82 - 0.45 * stress, 0.92 - 0.5 * stress)' } },

    // Shadow and phase-space indicator
    { type: 'set_attr_expr_block', fields: { OBJ: 'shadow',      ATTR: 'pos.x', EXPR: 'mass.pos.x' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'phase_arrow', ATTR: 'axis',  EXPR: 'vector(0.35 * stretch, 0.28 * v, 0)' } },

    // Energy telemetry
    { type: 'set_scalar_block',    fields: { NAME: 'KE', VALUE: '0.5 * m * v * v' } },
    { type: 'set_scalar_block',    fields: { NAME: 'PE', VALUE: '0.5 * k * stretch * stretch' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'telemetry', ATTR: 'text', EXPR: '"t = " + str(round(t,2)) + " s\\nstretch = " + str(round(stretch,3)) + " m\\nvelocity = " + str(round(v,3)) + " m/s\\nKE = " + str(round(KE,3)) + " J\\nPE = " + str(round(PE,3)) + " J"' } },

    // Advance time
    { type: 'set_scalar_block', fields: { NAME: 't', VALUE: 't + dt' } },
  ]},
];

/* ── Export ───────────────────────────────────────────── */

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
    id: 'blocks_spring',
    title: 'Spring-Mass (Blocks Template)',
    subtitle: 'Damped harmonic oscillator with energy telemetry',
    description:
      'Animated spring-mass oscillator with Hooke\u2019s law, linear damping, color-mapped tension, phase-space arrow, and live KE/PE telemetry.',
    xml: buildTemplate(SPRING_BLOCKS),
  },
  {
    id: 'blocks_orbits',
    title: 'Sun, Earth & Moon (Blocks Template)',
    subtitle: 'Three-body gravitational orbit system',
    description:
      'Moon orbits Earth while Earth orbits Sun. Velocity-Verlet integration for long-term stability, with starfield, trails, and telemetry.',
    xml: buildTemplate(ORBIT_BLOCKS),
  },
];
