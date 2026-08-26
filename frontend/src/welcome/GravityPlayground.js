import React, { useEffect, useRef } from "react";
import { BLOCK_PALETTE } from "../utils/blockly/blockPalette";

const DAMPING = 0.82;
const GRAVITY = 9.8; // m/s^2 — fixed; v2's hero canvas carries no slider (see header comment).
/* One frame's worth of motion, used for the single click-to-drop render while paused (RM). */
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

function makeBall(x, y, colors) {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 220,
    vy: -80 - Math.random() * 120,
    r: 7 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
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
 * pushes nearby balls aside. No slider, no play/pause, no presets — those
 * were the old boxed widget's controls, and this is decoration behind a
 * title, not a control panel. Keyboard operability is deliberately not
 * claimed for the click gesture: the RM/keyboard table this component
 * follows (see welcome.css's hero block) calls it decorative, and the
 * title attribute + the visually-hidden note below the canvas say so
 * out loud rather than leaving a screen-reader user to guess.
 */
export default function GravityPlayground() {
  const canvasRef = useRef(null);
  const ballsRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const runningRef = useRef(!prefersReducedMotion());
  const renderRef = useRef(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return undefined;

    if (!ballsRef.current) {
      ballsRef.current = [makeBall(80, 60, COLORS), makeBall(220, 100, COLORS), makeBall(360, 50, COLORS)];
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
      const mouse = mouseRef.current;
      for (const b of ballsRef.current) {
        if (dt > 0) {
          b.vy += GRAVITY * 60 * dt;
          // Subtle cursor repulsion (redesign brief: "cursor movement gives
          // subtle parallax/repulsion") — only while actually running, so
          // reduced motion never gains ambient movement from a passive
          // mouse move; a click still single-steps a frame regardless.
          if (mouse.active) {
            const dx = b.x - mouse.x;
            const dy = b.y - mouse.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < REPEL_RADIUS) {
              const push = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
              b.vx += (dx / dist) * push * dt;
              b.vy += (dy / dist) * push * dt;
            }
          }
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y + b.r > h) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * DAMPING; }
          if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * DAMPING; }
          if (b.x + b.r > w) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * DAMPING; }
          if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * DAMPING; }
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
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

  return (
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
  );
}
