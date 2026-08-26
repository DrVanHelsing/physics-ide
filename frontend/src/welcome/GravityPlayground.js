import React, { useRef, useState, useEffect } from "react";
import { BLOCK_PALETTE } from "../utils/blockly/blockPalette";

/* ── Physics constants & defaults ─────────────────────────────────────────
   PX_PER_METER fixes the canvas's pixel-to-metre scale: a slider reading in
   real SI units (m/s²) has to become a pixel acceleration somehow, and 60
   was already the (undocumented) factor the original fixed-gravity build
   used — `GRAVITY * 60 * dt`. Naming it turns that magic number into an
   honest unit conversion instead of a fudge factor, and it is what makes
   the drop-time unit test below (t = sqrt(2h/g)) come out right when h is
   read back in metres.

   DEFAULT_GRAVITY/RADIUS/RESTITUTION are exactly the values the old fixed
   build hard-coded (GRAVITY, the ball radius's "7", DAMPING) — so with
   gravity left untouched, or after Reset, the canvas behaves byte-for-byte
   like it did before this file had any controls at all. */
export const PX_PER_METER = 60;
export const DEFAULT_GRAVITY = 9.8; // m/s^2 — Earth's, and the slider's default
export const DEFAULT_RADIUS = 7; // px — the old makeBall's base ("7 + Math.random() * 7")
export const DEFAULT_RESTITUTION = 0.82; // coefficient of restitution e — was the fixed DAMPING const
export const GRAVITY_RANGE = [1, 25];
/* Size and bounciness are no longer sliders (v4 — see the header comment
   below for why), but stepBall itself still varies both, so the physics
   test suite keeps exercising it across these bounds: RADIUS_RANGE checks
   that a bigger effective radius really does change the floor-contact
   height, RESTITUTION_RANGE that `e` really does scale a bounce, for any e
   a future control could plausibly expose. Kept as the documented sensible
   bounds for values stepBall's `settings.radius`/`settings.restitution`
   accept, not because a control reads them today. */
export const RADIUS_RANGE = [4, 16];
export const RESTITUTION_RANGE = [0.3, 1];
/* Per-ball size variety — the old makeBall's "+ Math.random() * 7" tail,
   applied at draw/step time (not baked in at creation) rather than as a
   literal in makeBall, so it composes cleanly with effectiveRadius below. */
const RADIUS_JITTER = 7;

/* No mass slider. In vacuum free-fall, acceleration is mass-independent
   (F=ma, F=mg ⇒ a=g) — that a heavy ball and a light one land together is
   the product's own physics-honesty brand, stated outright elsewhere in
   this codebase. This engine also has no ball-to-ball interactions (no
   momentum transfer, no restitution between two balls — only ball-vs-wall),
   so a mass slider would have nothing real left to drive: it would either
   silently do nothing (a control that lies) or fake a collision response
   this engine does not model (a control that lies differently). */

/* v4: size and bounciness are no longer sliders either — fixed at their
   defaults, below. A size slider that live-resized balls already on screen
   was flagged in review as its own kind of dishonesty (a ball's momentum
   and flight path were computed for its old radius; snapping it to a new
   one mid-flight is a magic trick, not a physical event), and simplifying
   to "one slider, three presets, a toggle, a reset" is also just a
   quieter cluster. Gravity is the one continuously-adjustable, honestly-
   modelled quantity that's actually interesting to change on this canvas. */

/* Earth/Moon/Jupiter surface gravity, in m/s² — Moon is 1.62, Jupiter's
   24.79; both round to the tenth shown on the chip (1.6 / 24.8), and the
   VALUE this sets is that same rounded number, not the fuller constant —
   so the chip's label and the slider's own aria-valuetext never disagree
   with each other by a fraction the chip doesn't show. */
export const GRAVITY_PRESETS = [
  { label: "Moon", value: 1.6 },
  { label: "Earth", value: 9.8 },
  { label: "Jupiter", value: 24.8 },
];

/* Trail history length — "last ~40 positions" (fix-round brief). Capped per
   ball so MAX_BALLS × TRAIL_LENGTH stays a small, bounded amount of canvas
   work regardless of how long the cluster has been sitting with trails on. */
const TRAIL_LENGTH = 40;

/* One frame's worth of motion, used for the single click-to-drop render
   while paused (RM), and for redrawing immediately after a slider/preset/
   Reset/trails change while paused so the change is visible without
   waiting for a click. */
const STEP_DT = 1 / 60;
/* Keep ball count low so the canvas reads as clean, not chaotic (redesign
   brief §"the hero's interactive animation"). Balls already on screen are
   never removed by time — only a click past the cap recycles the oldest. */
const MAX_BALLS = 24;
/* Repulsion radius/strength for the cursor-proximity effect — subtle, not a
   shove: a ball right under the cursor gets a gentle nudge, one that fades
   to nothing by REPEL_RADIUS px away. */
const REPEL_RADIUS = 110;
const REPEL_STRENGTH = 340;

/* The hero's full-bleed canvas draws its balls in the product's own
   block-category colours — --cat-* (tokens.css) IS this palette:
   BLOCK_PALETTE's fills are the same hex values those custom properties
   declare (blockPalette.test.js pins that identity end to end), so
   importing the module both satisfies "the --cat-* vars ARE your colours"
   and keeps one canonical source instead of a second, drifting copy.
   Objects, Values, Motion, Data Science and Charts — unchanged from the
   retired standalone playground this canvas was promoted from. */
const COLORS = [
  BLOCK_PALETTE.Objects.fill,
  BLOCK_PALETTE.Values.fill,
  BLOCK_PALETTE.Motion.fill,
  BLOCK_PALETTE["Data Science"].fill,
  BLOCK_PALETTE.Charts.fill,
];

const DEFAULT_SETTINGS = {
  gravity: DEFAULT_GRAVITY,
  radius: DEFAULT_RADIUS,
  restitution: DEFAULT_RESTITUTION,
};

function makeBall(x, y, colors) {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 220,
    vy: -80 - Math.random() * 120,
    rJitter: Math.random() * RADIUS_JITTER,
    color: colors[Math.floor(Math.random() * colors.length)],
    trail: [], // fading position history — only populated while the Trails toggle is on
  };
}

function initialBalls() {
  return [makeBall(80, 60, COLORS), makeBall(220, 100, COLORS), makeBall(360, 50, COLORS)];
}

/** A ball's drawn/collision radius: the (fixed) base radius plus this
 *  ball's own variety offset, clamped so a ball can never zero out or
 *  invert. Exported so the physics test can check contact height the same
 *  way the renderer does. */
export function effectiveRadius(ball, settings) {
  return Math.max(1, settings.radius + ball.rJitter);
}

/**
 * The pure physics step: one ball, one frame, no canvas. v += g·dt (g first
 * converted from m/s² to px/s² via PX_PER_METER, exactly as the old fixed
 * build did with its literal "* 60"); an optional cursor repel nudge, same
 * as before; then position integrates from the updated velocity
 * (semi-implicit/symplectic Euler — unconditionally stable for this kind of
 * constant-acceleration integration, which is why the old build used it
 * too). A wall/floor contact clamps position to the surface and reflects
 * the offending velocity component by `restitution` (e): e=1 is a
 * perfectly elastic bounce (all speed kept), e=0 is dead-stop (all speed
 * lost) — exactly what "coefficient of restitution" means.
 *
 * dt<=0 is a no-op (returns `ball` unchanged) — this is what lets a paused
 * (RM) canvas redraw at a new setting without advancing the simulation a
 * single tick.
 *
 * Pure and side-effect-free: same inputs, same output, every time — which
 * is what makes it unit-testable without a canvas or a rAF loop. Trail
 * history is deliberately NOT this function's concern (see maybeTrail
 * below) — it is a rendering record of where stepBall already decided the
 * ball went, not a physics quantity.
 */
export function stepBall(ball, dt, settings, bounds, mouse) {
  if (dt <= 0) return ball;
  let { x, y, vx, vy } = ball;
  vy += settings.gravity * PX_PER_METER * dt;
  if (mouse?.active) {
    const dx = x - mouse.x;
    const dy = y - mouse.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < REPEL_RADIUS) {
      const push = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
      vx += (dx / dist) * push * dt;
      vy += (dy / dist) * push * dt;
    }
  }
  x += vx * dt;
  y += vy * dt;
  const r = effectiveRadius(ball, settings);
  const e = settings.restitution;
  const { width, height } = bounds;
  if (y + r > height) { y = height - r; vy = -Math.abs(vy) * e; }
  if (y - r < 0) { y = r; vy = Math.abs(vy) * e; }
  if (x + r > width) { x = width - r; vx = -Math.abs(vx) * e; }
  if (x - r < 0) { x = r; vx = Math.abs(vx) * e; }
  return { ...ball, x, y, vx, vy };
}

/** Append a ball's current position to its trail (capped at TRAIL_LENGTH,
 *  oldest dropped first) when trails are on; otherwise return the ball
 *  with its trail cleared, so switching Trails off and back on never
 *  resumes a stale, disconnected tail. A rendering-history concern layered
 *  on top of stepBall, not folded into it — see stepBall's own comment. */
function maybeTrail(ball, trailsOn) {
  if (!trailsOn) return ball.trail?.length ? { ...ball, trail: [] } : ball;
  const trail = ball.trail ? [...ball.trail, { x: ball.x, y: ball.y }] : [{ x: ball.x, y: ball.y }];
  if (trail.length > TRAIL_LENGTH) trail.shift();
  return { ...ball, trail };
}

/** "#rgb"/"#rrggbb" → "rgba(r, g, b, alpha)" — the block-palette colours
 *  (COLORS, above) are always one of these two forms, so no other input
 *  shape needs handling. */
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}

/**
 * GravityPlayground — v2: promoted from a boxed "try it" section artifact
 * (retired; the hero absorbed its job, redesign brief §"below the nav")
 * into the hero's own full-bleed, ambient canvas. A visitor sees it moving
 * before reading a word; clicking anywhere drops a ball; the cursor gently
 * pushes nearby balls aside. Keyboard operability is deliberately not
 * claimed for the click gesture: the RM/keyboard table this component
 * follows (see welcome.css's hero block) calls it decorative, and the
 * title and aria-label attributes communicate that to assistive tech.
 *
 * v3 added a quiet control cluster (bottom-right, low-opacity until
 * hover/keyboard-focus) with three real .range sliders — gravity, ball
 * size, bounciness — plus a Reset.
 *
 * v4 (fix round, after review) simplifies that cluster to one honestly-
 * modelled continuous control: **Gravity** stays a real .range with a
 * visible label and an aria-valuetext carrying units. Size and bounciness
 * are fixed at their defaults instead of sliders — live-resizing a ball
 * already mid-flight was flagged as its own kind of dishonesty (see the
 * "v4" comment above the constants). In their place: three gravity
 * **presets** (Moon/Earth/Jupiter, real values, real units, a pressed
 * state that only reflects an actual click — not numeric coincidence, so
 * Reset can honestly show none of them selected even though it lands
 * gravity back on Earth's own number), and a **Trails** toggle that has
 * nothing to do with the physics at all, just a fading record of where
 * each ball has already been. All are real keyboard-operable buttons with
 * aria-pressed, same idiom the old Play/Pause button used.
 */
export default function GravityPlayground() {
  const canvasRef = useRef(null);
  const ballsRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const runningRef = useRef(!prefersReducedMotion());
  const renderRef = useRef(() => {});
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const trailsRef = useRef(false);
  const [gravity, setGravityState] = useState(DEFAULT_GRAVITY);
  /* null = no preset reflects the current gravity — the honest default,
     including right after Reset even though gravity there equals Earth's
     own value (see the component doc comment above). */
  const [activePreset, setActivePreset] = useState(null);
  const [trailsOn, setTrailsOn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return undefined;

    if (!ballsRef.current) {
      ballsRef.current = initialBalls();
    }
    const running = runningRef.current;

    const render = (dt) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      const currentSettings = settingsRef.current;
      const trailsNow = trailsRef.current;
      const mouse = mouseRef.current;
      const bounds = { width: w, height: h };
      const balls = ballsRef.current;
      for (let i = 0; i < balls.length; i++) {
        let b = dt > 0 ? stepBall(balls[i], dt, currentSettings, bounds, mouse) : balls[i];
        if (dt > 0) b = maybeTrail(b, trailsNow);
        balls[i] = b;
        const r = effectiveRadius(b, currentSettings);
        if (trailsNow && b.trail?.length) {
          const n = b.trail.length;
          for (let ti = 0; ti < n; ti++) {
            const alpha = 0.05 + (ti / Math.max(1, n - 1)) * 0.3; // fades in toward the ball, never louder than a whisper
            ctx.beginPath();
            ctx.arc(b.trail[ti].x, b.trail[ti].y, Math.max(1, r * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(b.color, alpha);
            ctx.fill();
          }
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
    };
    renderRef.current = render;

    if (!running) {
      render(0); // a single static frame — no rAF loop, no mouse tracking
      return undefined;
    }
    let raf = 0;
    let last = performance.now();
    const frame = (t) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      render(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => {}; // canvas re-sizes itself every frame via clientWidth/Height
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const pointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const drop = (e) => {
    const { x, y } = pointerPos(e);
    const balls = ballsRef.current || (ballsRef.current = []);
    if (balls.length >= MAX_BALLS) balls.shift();
    balls.push(makeBall(x, y, COLORS));
    if (!runningRef.current) renderRef.current(STEP_DT);
  };

  const move = (e) => {
    if (!runningRef.current) return; // no ambient effect while paused (RM)
    const { x, y } = pointerPos(e);
    mouseRef.current = { x, y, active: true };
  };

  const leave = () => {
    mouseRef.current.active = false;
  };

  /* The slider and the three presets both funnel gravity changes through
     here: update the ref the render loop actually reads (so a running rAF
     loop picks the new value up on its very next frame, no effect
     re-subscription needed), mirror it into state so the slider and its
     readout re-render, track which preset (if any) this change came from,
     and — the RM/paused case — redraw once immediately so the change is
     visible without waiting for a click to single-step a frame. */
  const applyGravity = (value, presetLabel) => {
    settingsRef.current = { ...settingsRef.current, gravity: value };
    setGravityState(value);
    setActivePreset(presetLabel);
    if (!runningRef.current) renderRef.current(0);
  };

  const toggleTrails = () => {
    const next = !trailsRef.current;
    trailsRef.current = next;
    setTrailsOn(next);
    if (!next && ballsRef.current) {
      // Clear history now, not lazily in the render loop, so flipping
      // Trails back on later starts a fresh tail instead of resuming one
      // with a gap in it.
      ballsRef.current = ballsRef.current.map((b) => (b.trail?.length ? { ...b, trail: [] } : b));
    }
    if (!runningRef.current) renderRef.current(0);
  };

  const reset = () => {
    settingsRef.current = DEFAULT_SETTINGS;
    setGravityState(DEFAULT_GRAVITY);
    setActivePreset(null);
    trailsRef.current = false;
    setTrailsOn(false);
    ballsRef.current = initialBalls();
    if (!runningRef.current) renderRef.current(0);
  };

  return (
    <>
      <div className="welcome-hero__canvas-wrap">
        <canvas
          ref={canvasRef}
          className="welcome-hero__canvas"
          onPointerDown={drop}
          onPointerMove={move}
          onPointerLeave={leave}
          role="img"
          title="Click or tap anywhere to drop a ball — decorative, no keyboard equivalent"
          aria-label="A canvas of coloured balls falling and bouncing under gravity, behind the page title. Decorative: clicking anywhere drops another ball, but this has no keyboard equivalent and nothing here is required reading."
        />
      </div>
      <div className="welcome-hero__controls" role="group" aria-label="Adjust the canvas physics">
        <div className="welcome-hero__control">
          <label htmlFor="hero-gravity">Gravity</label>
          <span className="welcome-hero__control-value">{gravity.toFixed(1)} m/s²</span>
          <input
            id="hero-gravity"
            className="range"
            type="range"
            min={GRAVITY_RANGE[0]}
            max={GRAVITY_RANGE[1]}
            step="0.1"
            value={gravity}
            onChange={(e) => applyGravity(Number(e.target.value), null)}
            aria-valuetext={`${gravity.toFixed(1)} metres per second squared`}
          />
        </div>
        <div className="welcome-hero__presets" role="group" aria-label="Gravity presets">
          {GRAVITY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="btn btn--sm"
              aria-pressed={activePreset === p.label}
              onClick={() => applyGravity(p.value, p.label)}
            >
              {p.label} {p.value}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn--sm welcome-hero__trails"
          aria-pressed={trailsOn}
          onClick={toggleTrails}
        >
          Trails
        </button>
        <button className="btn btn--sm welcome-hero__reset" type="button" onClick={reset}>
          Reset
        </button>
      </div>
    </>
  );
}
