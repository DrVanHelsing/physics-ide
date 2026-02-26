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
  { type: 'set_scalar_block', fields: { NAME: 'max_height', VALUE: '0.0' } },

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

    // Ground contact: clamp, bounce + rolling friction, and stop
    { type: 'python_raw_block', fields: { CODE: 'if ball.pos.y < ball.radius:\n  ball.pos.y = ball.radius\n  if ball.velocity.y < 0: ball.velocity.y = -0.55 * ball.velocity.y\n  ball.velocity.x = ball.velocity.x * 0.88' } },
    { type: 'python_raw_block', fields: { CODE: 'if ball.pos.y <= ball.radius + 0.01 and mag(ball.velocity) < 0.06: ball.velocity = vector(0,0,0)' } },

    // Telemetry: height above ground surface = ball.pos.y - ball.radius
    { type: 'python_raw_block', fields: { CODE: 'h_above = max(0, ball.pos.y - ball.radius); max_height = h_above if h_above > max_height else max_height' } },
    { type: 'python_raw_block', fields: { CODE: 'telemetry.text = "t = " + str(round(t,2)) + " s\\nspeed = " + str(round(mag(ball.velocity),2)) + " m/s\\nheight = " + str(round(h_above,2)) + " m\\nrange = " + str(round(ball.pos.x,2)) + " m\\npeak = " + str(round(max_height,2)) + " m"' } },

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

  /* ── Camera, caption, ambient, starfield (raw) ─────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: camera setup, caption, ambient, and starfield' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.forward = vector(-0.2, -0.3, -1)' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.caption = "Three-body gravity: Moon orbits Earth, Earth orbits Sun\\n"' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.ambient = color.gray(0.22)' } },
  { type: 'python_raw_block', fields: { CODE: 'for i in range(120): p = vector(2*random()-1, 2*random()-1, 2*random()-1); p = 34 * norm(p if mag(p) > 0 else vector(1, 0, 0)); sphere(pos=p, radius=0.05 + 0.05 * random(), color=vector(0.7 + 0.3 * random(), 0.7 + 0.3 * random(), 1), emissive=True, opacity=0.9)' } },

  /* ── Celestial bodies — raw blocks because make_trail / emissive
       must be constructor args in GlowScript 3.2 ─────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: Sun, corona, Earth, Moon (make_trail in constructor)' } },
  { type: 'python_raw_block', fields: { CODE: 'sun = sphere(pos=vector(0,0,0), radius=1.05, color=vector(1,0.87,0.35), emissive=True, shininess=1)' } },
  { type: 'python_raw_block', fields: { CODE: 'corona = sphere(pos=vector(0,0,0), radius=1.45, color=vector(1,0.7,0.25), opacity=0.15, emissive=True)' } },
  { type: 'python_raw_block', fields: { CODE: 'earth = sphere(pos=vector(8.2,0,0), radius=0.42, color=vector(0.26,0.72,1), shininess=0.55, make_trail=True, retain=3200, trail_radius=0.04, trail_color=vector(0.45,0.75,1))' } },
  { type: 'python_raw_block', fields: { CODE: 'moon = sphere(pos=vector(8.2,0.9,0), radius=0.13, color=vector(0.88,0.88,0.94), shininess=0.28, make_trail=True, retain=1200, trail_radius=0.02, trail_color=vector(0.8,0.8,0.9))' } },

  /* ── Gravitational parameters ──────────────────────────── */
  // G=10, M_sun=10.33 → v_circ = sqrt(10*10.33/8.2) ≈ 3.55 (Earth)
  // M_earth=1.0 → v_moon_rel = sqrt(10*1.0/0.9) ≈ 3.33 (Moon around Earth)
  // Hill sphere = 8.2*(1.0/(3*10.33))^(1/3) ≈ 2.6 >> 0.9 moon orbit (stable)
  { type: 'set_scalar_block', fields: { NAME: 'G', VALUE: '10' } },
  { type: 'set_scalar_block', fields: { NAME: 'M_sun', VALUE: '10.33' } },
  { type: 'set_scalar_block', fields: { NAME: 'M_earth', VALUE: '1.0' } },

  /* ── Velocities ────────────────────────────────────────── */
  { type: 'set_velocity_block', fields: { OBJ: 'earth', VX: '0', VY: '3.55', VZ: '0' } },
  // Moon: CCW orbit around Earth. offset = (0,0.9,0), relative vel = (-3.33,0,0) perpendicular → CCW
  { type: 'set_attr_expr_block', fields: { OBJ: 'moon', ATTR: 'velocity', EXPR: 'earth.velocity + vector(-3.33, 0, 0)' } },

  /* ── Time step and state ───────────────────────────────── */
  { type: 'time_step_block', fields: { DT: '0.0008' } },
  { type: 'set_scalar_block', fields: { NAME: 't', VALUE: '0' } },

  /* ── Compute initial accelerations for velocity-Verlet ── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: initial accelerations for velocity-Verlet' } },
  { type: 'python_raw_block', fields: { CODE: 'r_es = earth.pos - sun.pos; d_es = max(mag(r_es), 1.2)' } },
  { type: 'python_raw_block', fields: { CODE: 'a_earth = -G * M_sun / d_es**2 * norm(r_es)' } },
  { type: 'python_raw_block', fields: { CODE: 'r_ms = moon.pos - sun.pos; d_ms = max(mag(r_ms), 1.2)' } },
  { type: 'python_raw_block', fields: { CODE: 'r_me = moon.pos - earth.pos; d_me = max(mag(r_me), 0.22)' } },
  { type: 'python_raw_block', fields: { CODE: 'a_moon = -G * M_sun / d_ms**2 * norm(r_ms) - G * M_earth / d_me**2 * norm(r_me)' } },

  /* ── Earth velocity arrow ──────────────────────────────── */
  { type: 'arrow_block', fields: { NAME: 'earth_arrow', X: '8.2', Y: '0', Z: '0', AX: '0', AY: '0', AZ: '0', COL: '#ff734d' } },

  /* ── Telemetry label (raw) ─────────────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: create telemetry label for orbit diagnostics' } },
  { type: 'python_raw_block', fields: { CODE: 'telemetry = label(pos=vector(-12, 11, 0), text="", height=12, box=False, opacity=0, color=color.white)' } },

  /* ── Animation loop ────────────────────────────────────── */
  { type: 'forever_loop_block', body: [
    { type: 'rate_block', fields: { N: '900' } },

    // Velocity-Verlet integration (symplectic — conserves energy)
    // Half-step velocity
    { type: 'comment_block', fields: { TEXT: 'Velocity-Verlet: half-step velocity kick' } },
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_earth * dt / 2', OBJ: 'earth', ATTR: 'velocity' } },
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_moon * dt / 2', OBJ: 'moon', ATTR: 'velocity' } },

    // Full-step position drift
    { type: 'update_position_block', fields: { OBJ: 'earth', DT: 'dt' } },
    { type: 'update_position_block', fields: { OBJ: 'moon', DT: 'dt' } },

    // Recompute accelerations at new positions (raw — complex math)
    { type: 'comment_block', fields: { TEXT: 'Raw code: recompute accelerations at new positions' } },
    { type: 'python_raw_block', fields: { CODE: 'r_es = earth.pos - sun.pos; d_es = max(mag(r_es), 1.2)' } },
    { type: 'python_raw_block', fields: { CODE: 'a_earth = -G * M_sun / d_es**2 * norm(r_es)' } },
    { type: 'python_raw_block', fields: { CODE: 'r_ms = moon.pos - sun.pos; d_ms = max(mag(r_ms), 1.2)' } },
    { type: 'python_raw_block', fields: { CODE: 'r_me = moon.pos - earth.pos; d_me = max(mag(r_me), 0.22)' } },
    { type: 'python_raw_block', fields: { CODE: 'a_moon = -G * M_sun / d_ms**2 * norm(r_ms) - G * M_earth / d_me**2 * norm(r_me)' } },

    // Complete velocity update (second half-step kick)
    { type: 'comment_block', fields: { TEXT: 'Velocity-Verlet: second half-step velocity kick' } },
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_earth * dt / 2', OBJ: 'earth', ATTR: 'velocity' } },
    { type: 'add_attr_expr_block', fields: { EXPR: 'a_moon * dt / 2', OBJ: 'moon', ATTR: 'velocity' } },

    // Visual updates
    { type: 'set_attr_expr_block', fields: { OBJ: 'corona', ATTR: 'pos', EXPR: 'sun.pos' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'earth_arrow', ATTR: 'pos', EXPR: 'earth.pos' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'earth_arrow', ATTR: 'axis', EXPR: '1.2 * a_earth' } },

    // Telemetry (raw)
    { type: 'python_raw_block', fields: { CODE: 'telemetry.text = "t = " + str(round(t,2)) + " s\\nEarth speed = " + str(round(mag(earth.velocity),3)) + "\\nMoon speed = " + str(round(mag(moon.velocity),3)) + "\\nEarth orbit r = " + str(round(mag(earth.pos),3))' } },

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
  { type: 'local_light_block', fields: { X: '-2', Y: '10', Z: '8', COL: '#e6e6ff' } },
  { type: 'local_light_block', fields: { X: '8', Y: '5', Z: '-10', COL: '#667388' } },

  /* ── Camera, caption, ambient (raw) ────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: configure camera, caption, ambient' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.center = vector(-0.8, 0, 0)' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.forward = vector(-0.25, -0.12, -1)' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.caption = "Damped oscillator with energy telemetry\\n"' } },
  { type: 'python_raw_block', fields: { CODE: 'scene.ambient = color.gray(0.38)' } },

  /* ── Environment geometry ──────────────────────────────── */
  { type: 'box_block', fields: { NAME: 'floor', X: '-0.5', Y: '-1.25', Z: '0', SX: '17', SY: '0.3', SZ: '5', COL: '#3d4454' } },
  { type: 'box_block', fields: { NAME: 'rail', X: '-0.5', Y: '-0.65', Z: '0', SX: '16', SY: '0.14', SZ: '1.5', COL: '#737380' } },
  { type: 'box_block', fields: { NAME: 'wall', X: '-6', Y: '0', Z: '0', SX: '0.52', SY: '4.2', SZ: '4', COL: '#616885' } },

  /* ── Spring, mass, shadow ───────────────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: anchor, helix spring, mass block, shadow' } },
  { type: 'python_raw_block', fields: { CODE: 'anchor = vector(-5.74, 0, 0)' } },
  { type: 'python_raw_block', fields: { CODE: 'spring = helix(pos=anchor, axis=vector(4.0,0,0), radius=0.36, coils=16, thickness=0.055, color=vector(0.78,0.8,0.86))' } },
  { type: 'box_block', fields: { NAME: 'mass', X: '-1.75', Y: '0', Z: '0', SX: '1.06', SY: '1.0', SZ: '1.0', COL: '#39dcf2' } },
  { type: 'python_raw_block', fields: { CODE: 'shadow = box(pos=vector(mass.pos.x,-1.08,0), size=vector(1.0,0.01,1.0), color=vector(0.07,0.07,0.09), opacity=0.45)' } },

  /* ── Physics constants ─────────────────────────────────── */
  // k=14 N/m, m=1.2 kg, b=0.22 Ns/m → underdamped (b_crit≈8.2), ω=3.42 rad/s, T≈1.84 s
  { type: 'set_scalar_block', fields: { NAME: 'k', VALUE: '14.0' } },
  { type: 'set_scalar_block', fields: { NAME: 'm', VALUE: '1.2' } },
  { type: 'set_scalar_block', fields: { NAME: 'b', VALUE: '0.22' } },
  { type: 'set_scalar_block', fields: { NAME: 'L0', VALUE: '4.0' } },
  { type: 'set_scalar_block', fields: { NAME: 'x0', VALUE: '1.8' } },
  { type: 'set_scalar_block', fields: { NAME: 'v', VALUE: '0.0' } },
  { type: 'time_step_block', fields: { DT: '0.004' } },
  { type: 'set_scalar_block', fields: { NAME: 't', VALUE: '0.0' } },

  /* ── Set initial stretched position ────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: set initial stretched position of mass' } },
  { type: 'python_raw_block', fields: { CODE: 'mass.pos.x = wall.pos.x + 0.25 + L0 + x0' } },

  /* ── Telemetry label, phase arrow ───────────────────────── */
  { type: 'comment_block', fields: { TEXT: 'Raw code: telemetry label and phase-space arrow' } },
  { type: 'python_raw_block', fields: { CODE: 'telemetry = label(pos=vector(0.2,2.9,0), text="", height=12, box=False, opacity=0, color=color.white)' } },
  { type: 'arrow_block', fields: { NAME: 'phase_arrow', X: '4.8', Y: '-0.2', Z: '0', AX: '0', AY: '0', AZ: '0', COL: '#ff8c33' } },

  /* ── Animation loop ────────────────────────────────────── */
  { type: 'forever_loop_block', body: [
    { type: 'rate_block', fields: { N: '260' } },

    // Hooke's law + damping forces
    { type: 'comment_block', fields: { TEXT: "Raw code: Hooke's law, damping, and acceleration" } },
    { type: 'python_raw_block', fields: { CODE: 'stretch = (mass.pos.x - wall.pos.x - 0.25) - L0' } },
    { type: 'python_raw_block', fields: { CODE: 'Fspring = -k * stretch' } },
    { type: 'python_raw_block', fields: { CODE: 'Fdamp = -b * v' } },
    { type: 'python_raw_block', fields: { CODE: 'a = (Fspring + Fdamp) / m' } },

    // Euler integration
    { type: 'set_scalar_block', fields: { NAME: 'v', VALUE: 'v + a * dt' } },
    { type: 'python_raw_block', fields: { CODE: 'mass.pos.x = mass.pos.x + v * dt' } },

    // Spring visual updates
    { type: 'set_attr_expr_block', fields: { OBJ: 'spring', ATTR: 'axis', EXPR: 'vector(mass.pos.x - spring.pos.x, 0, 0)' } },
    { type: 'comment_block', fields: { TEXT: 'Raw code: color-map spring tension/compression' } },
    { type: 'python_raw_block', fields: { CODE: 'stress = min(1, abs(stretch) / 2.2)' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'spring', ATTR: 'color', EXPR: 'vector(0.55 + 0.45 * stress, 0.82 - 0.45 * stress, 0.92 - 0.5 * stress)' } },

    // Shadow and phase-space indicator
    { type: 'python_raw_block', fields: { CODE: 'shadow.pos.x = mass.pos.x' } },
    { type: 'set_attr_expr_block', fields: { OBJ: 'phase_arrow', ATTR: 'axis', EXPR: 'vector(0.35 * stretch, 0.28 * v, 0)' } },

    // Energy telemetry
    { type: 'set_scalar_block', fields: { NAME: 'KE', VALUE: '0.5 * m * v * v' } },
    { type: 'set_scalar_block', fields: { NAME: 'PE', VALUE: '0.5 * k * stretch * stretch' } },
    { type: 'python_raw_block', fields: { CODE: 'telemetry.text = "t = " + str(round(t,2)) + " s\\nstretch = " + str(round(stretch,3)) + " m\\nvelocity = " + str(round(v,3)) + " m/s\\nKE = " + str(round(KE,3)) + " J\\nPE = " + str(round(PE,3)) + " J"' } },

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
