/**
 * precodedExamples.js
 *
 * Three fully-fledged physics problems pre-coded in VPython,
 * ready to run in the GlowScript engine.
 */

export const EXAMPLES = [
  {
    id: "projectile",
    title: "Projectile Motion",
    subtitle: "Ball launched at an angle under gravity",
    description:
    "A high-detail ballistic launch scene with launch rail, velocity vector, atmospheric drag, and live telemetry showing speed, height, and range.",
    code: `GlowScript 3.2 VPython
scene.title = "Projectile Motion"
scene.background = vector(0.05, 0.08, 0.16)
scene.range = 18
scene.forward = vector(-0.35, -0.2, -1)
scene.center = vector(11, 3.5, 0)
scene.caption = "Projectile motion with drag and telemetry\\n"
scene.ambient = color.gray(0.35)

# Lighting
local_light(pos=vector(-8, 18, 10), color=vector(0.9, 0.9, 0.85))
local_light(pos=vector(26, 12, -12), color=vector(0.45, 0.5, 0.6))

# Ground and launch setup
ground = box(pos=vector(11, -0.55, 0), size=vector(34, 1.1, 10), color=vector(0.2, 0.45, 0.25), shininess=0.05)
track = box(pos=vector(1.6, 0.2, 0), size=vector(3.2, 0.12, 0.9), color=vector(0.42, 0.42, 0.48), shininess=0.25)
origin_marker = cylinder(pos=vector(0, -0.5, 0), axis=vector(0, 0.45, 0), radius=0.06, color=vector(1, 0.8, 0.2), emissive=True)

# Distance ticks on ground for visual scale
for i in range(0, 31, 5):
  cylinder(pos=vector(i, -0.02, -0.18), axis=vector(0, 0.04, 0), radius=0.018, color=color.white)

# Axis hints
arrow(pos=vector(0, 0, 0), axis=vector(2.4, 0, 0), shaftwidth=0.06, color=color.red)
arrow(pos=vector(0, 0, 0), axis=vector(0, 2.2, 0), shaftwidth=0.06, color=color.green)

# Projectile
ball = sphere(
  pos=vector(0, 0.35, 0),
  radius=0.28,
  color=vector(0.95, 0.35, 0.25),
  make_trail=True,
  trail_radius=0.035,
  trail_color=vector(1, 0.88, 0.25),
  retain=260,
  shininess=0.85,
)

# Velocity vector visual
v_arrow = arrow(pos=ball.pos, axis=vector(0, 0, 0), shaftwidth=0.08, color=vector(0.35, 0.9, 1))

# Physics parameters
g = vector(0, -9.81, 0)
rho = 1.225
Cd = 0.47
A = pi * ball.radius**2
m = 0.34
drag_k = 0.5 * rho * Cd * A

v0 = 17.5
angle = radians(52)
ball.velocity = vector(v0 * cos(angle), v0 * sin(angle), 0)

dt = 0.004
t = 0
max_height = ball.pos.y

telemetry = label(
  pos=vector(8.5, 9.2, 0),
  text="",
  height=12,
  box=False,
  opacity=0,
  color=color.white,
)

while ball.pos.y >= ball.radius:
  rate(240)

  speed = mag(ball.velocity)
  drag = vector(0, 0, 0)
  if speed > 0:
    drag = -drag_k * speed * ball.velocity

  acceleration = g + drag / m
  ball.velocity = ball.velocity + acceleration * dt
  ball.pos = ball.pos + ball.velocity * dt

  v_arrow.pos = ball.pos
  v_arrow.axis = ball.velocity * 0.16

  if ball.pos.y > max_height:
    max_height = ball.pos.y

  telemetry.text = "t = " + str(round(t,2)) + " s\\nspeed = " + str(round(mag(ball.velocity),2)) + " m/s\\nheight = " + str(round(ball.pos.y,2)) + " m\\nrange = " + str(round(ball.pos.x,2)) + " m"

  t = t + dt

telemetry.text = telemetry.text + "\\npeak height = " + str(round(max_height,2)) + " m"
`,
  },
  {
    id: "spring",
    title: "Spring-Mass Oscillator",
    subtitle: "Hooke's law with damping",
    description:
    "A detailed damped oscillator with rail geometry, color-mapped spring tension, and live kinetic/potential energy telemetry.",
    code: `GlowScript 3.2 VPython
scene.title = "Spring-Mass Oscillator"
scene.background = vector(0.06, 0.07, 0.14)
scene.range = 8.5
scene.center = vector(-0.8, 0, 0)
scene.forward = vector(-0.25, -0.12, -1)
scene.caption = "Damped oscillator with energy telemetry\\n"
scene.ambient = color.gray(0.38)

local_light(pos=vector(-2, 10, 8), color=vector(0.9, 0.9, 1))
local_light(pos=vector(8, 5, -10), color=vector(0.4, 0.45, 0.55))

# Environment
floor = box(pos=vector(-0.5, -1.25, 0), size=vector(17, 0.3, 5), color=vector(0.24, 0.27, 0.33), shininess=0.08)
rail = box(pos=vector(-0.5, -0.65, 0), size=vector(16, 0.14, 1.5), color=vector(0.45, 0.45, 0.5), shininess=0.22)
wall = box(pos=vector(-6, 0, 0), size=vector(0.52, 4.2, 4), color=vector(0.38, 0.42, 0.52), shininess=0.12)

# Spring and mass block
anchor = vector(-5.74, 0, 0)
spring = helix(
  pos=anchor,
  axis=vector(4.0, 0, 0),
  radius=0.36,
  coils=16,
  thickness=0.055,
  color=vector(0.78, 0.8, 0.86),
)

mass = box(
  pos=vector(-1.75, 0, 0),
  size=vector(1.06, 1.0, 1.0),
  color=vector(0.22, 0.86, 0.95),
  shininess=0.75,
)

shadow = box(
  pos=vector(mass.pos.x, -1.08, 0),
  size=vector(1.0, 0.01, 1.0),
  color=vector(0.07, 0.07, 0.09),
  opacity=0.45,
)

# Physics parameters
k = 14.0
m = 1.2
b = 0.22
L0 = 4.0
x0 = 1.8
v = 0.0
dt = 0.004
t = 0.0

mass.pos.x = wall.pos.x + 0.25 + L0 + x0

telemetry = label(
  pos=vector(0.2, 2.9, 0),
  text="",
  height=12,
  box=False,
  opacity=0,
  color=color.white,
)

phase_arrow = arrow(pos=vector(4.8, -0.2, 0), axis=vector(0, 0, 0), shaftwidth=0.08, color=vector(1, 0.55, 0.2))

while True:
  rate(260)

  stretch = (mass.pos.x - wall.pos.x - 0.25) - L0
  Fspring = -k * stretch
  Fdamp = -b * v
  a = (Fspring + Fdamp) / m

  v = v + a * dt
  mass.pos.x = mass.pos.x + v * dt
  spring.axis = vector(mass.pos.x - 0.5 - spring.pos.x, 0, 0)

  # Spring color encodes tension/compression magnitude
  stress = min(1, abs(stretch) / 2.2)
  spring.color = vector(0.55 + 0.45 * stress, 0.82 - 0.45 * stress, 0.92 - 0.5 * stress)

  # Shadow and phase indicator
  shadow.pos.x = mass.pos.x
  phase_arrow.axis = vector(0.35 * stretch, 0.28 * v, 0)

  KE = 0.5 * m * v * v
  PE = 0.5 * k * stretch * stretch
  telemetry.text = "t = " + str(round(t,2)) + " s\\nstretch = " + str(round(stretch,3)) + " m\\nvelocity = " + str(round(v,3)) + " m/s\\nKE = " + str(round(KE,3)) + " J\\nPE = " + str(round(PE,3)) + " J"

  t = t + dt
`,
  },
  {
    id: "orbits",
    title: "Planetary Orbit",
    subtitle: "Gravitational two-body simulation",
    description:
    "A cinematic orbital scene with starfield, glowing sun, planet + moon dynamics, and orbital telemetry under Newtonian gravity.",
    code: `GlowScript 3.2 VPython
scene.title = "Planetary Orbit"
scene.background = vector(0.02, 0.03, 0.09)
scene.range = 12
scene.forward = vector(-0.2, -0.08, -1)
scene.caption = "Two-body + moon gravity system\\n"
scene.ambient = color.gray(0.22)

# Background stars
for i in range(120):
  x = 2 * random() - 1
  y = 2 * random() - 1
  z = 2 * random() - 1
  p = vector(x, y, z)
  if mag(p) == 0:
    p = vector(1, 0, 0)
  p = 34 * norm(p)
  sphere(pos=p, radius=0.05 + 0.05 * random(), color=vector(0.7 + 0.3 * random(), 0.7 + 0.3 * random(), 1), emissive=True, opacity=0.9)

# Star
star = sphere(pos=vector(0, 0, 0), radius=1.05, color=vector(1, 0.87, 0.35), emissive=True, shininess=1)
corona = sphere(pos=star.pos, radius=1.45, color=vector(1, 0.7, 0.25), opacity=0.15, emissive=True)
local_light(pos=vector(0, 0, 0), color=vector(1, 0.97, 0.85))

# Planet and moon
planet = sphere(
  pos=vector(8.2, 0, 0),
  radius=0.42,
  color=vector(0.26, 0.72, 1),
  shininess=0.55,
  make_trail=True,
  retain=3200,
  trail_radius=0.04,
  trail_color=vector(0.45, 0.75, 1),
)
moon = sphere(
  pos=planet.pos + vector(0.95, 0, 0),
  radius=0.13,
  color=vector(0.88, 0.88, 0.94),
  shininess=0.28,
  make_trail=True,
  retain=1200,
  trail_radius=0.02,
  trail_color=vector(0.8, 0.8, 0.9),
)

planet.velocity = vector(0, 3.55, 0)
moon.velocity = planet.velocity + vector(0, 1.3, 0)

# Gravitational parameters
G = 24.5
M_star = 24.0
M_planet = 0.16

dt = 0.0016
t = 0

planet_arrow = arrow(pos=planet.pos, axis=vector(0, 0, 0), shaftwidth=0.08, color=vector(1, 0.45, 0.3))
telemetry = label(pos=vector(-10.8, 9.5, 0), text="", height=12, box=False, opacity=0, color=color.white)

while True:
  rate(900)

  # Planet around star
  r_ps = planet.pos - star.pos
  d_ps = max(mag(r_ps), 1.2)
  a_planet = -G * M_star / d_ps**2 * norm(r_ps)

  # Moon experiences gravity from star and planet
  r_ms = moon.pos - star.pos
  d_ms = max(mag(r_ms), 1.2)
  r_mp = moon.pos - planet.pos
  d_mp = max(mag(r_mp), 0.22)

  a_moon_star = -G * M_star / d_ms**2 * norm(r_ms)
  a_moon_planet = -G * M_planet / d_mp**2 * norm(r_mp)
  a_moon = a_moon_star + a_moon_planet

  planet.velocity = planet.velocity + a_planet * dt
  moon.velocity = moon.velocity + a_moon * dt

  planet.pos = planet.pos + planet.velocity * dt
  moon.pos = moon.pos + moon.velocity * dt

  corona.pos = star.pos
  planet_arrow.pos = planet.pos
  planet_arrow.axis = 1.2 * a_planet

  telemetry.text = "t = " + str(round(t,2)) + " s\\nplanet speed = " + str(round(mag(planet.velocity),3)) + "\\nmoon speed = " + str(round(mag(moon.velocity),3)) + "\\nplanet radius = " + str(round(mag(planet.pos),3))

  t = t + dt
`,
  },
];
