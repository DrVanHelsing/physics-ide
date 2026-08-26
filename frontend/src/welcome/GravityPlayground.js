import React, { useEffect, useRef, useState } from "react";
import { BLOCK_PALETTE } from "../utils/blockly/blockPalette";

const DAMPING = 0.82;
/* The landing page's particles are the product's own category colours —
   Objects blue, Values violet, Motion amber, Data teal, Charts green — not a
   sixth palette. */
const COLORS = [
  BLOCK_PALETTE.Objects.fill,
  BLOCK_PALETTE.Values.fill,
  BLOCK_PALETTE.Motion.fill,
  BLOCK_PALETTE["Data Science"].fill,
  BLOCK_PALETTE.Charts.fill,
];
/** One frame's worth of motion, used for the single-step renders while paused. */
const STEP_DT = 1 / 60;

/* §11's playful touch (fun-redesign brief §2, §11 entry, and #4 in its
   prioritized cut-line): three one-click gravity presets, calling the same
   setGravity() the slider already calls — no new mechanism, just three more
   ways into the one that exists. Values are real: Moon and Jupiter surface
   gravity in m/s², Earth matching the component's own default (9.8). */
const PRESETS = [
  { label: "Moon", value: 1.6 },
  { label: "Earth", value: 9.8 },
  { label: "Jupiter", value: 24.8 },
];

function makeBall(x, y) {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 220,
    vy: -80 - Math.random() * 120,
    r: 7 + Math.random() * 7,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    return false;
  }
}

/** A tiny canvas physics toy: drag the slider, click to drop balls. */
export default function GravityPlayground() {
  const canvasRef = useRef(null);
  const ballsRef = useRef([makeBall(80, 40), makeBall(180, 60), makeBall(260, 30)]);
  const gravityRef = useRef(9.8);
  const [gravity, setGravity] = useState(9.8);
  gravityRef.current = gravity;
  /* "Reduce motion" means no continuous animation: the box renders one static
     frame and only moves when the visitor asks it to (slider, click, Play). */
  const [running, setRunning] = useState(() => !prefersReducedMotion());
  /* Renders one frame, advancing the simulation by `dt` seconds (0 = redraw
     only). Kept in a ref so the paused-mode handlers below can call it. */
  const renderRef = useRef(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.("2d");
    if (!ctx) return undefined;

    const render = (dt) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      for (const b of ballsRef.current) {
        if (dt > 0) {
          b.vy += gravityRef.current * 60 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y + b.r > h) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * DAMPING; }
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
      render(0); // a single static frame — no rAF loop at all
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
    return () => cancelAnimationFrame(raf);
  }, [running]);

  /* Paused, but still interactive: changing gravity steps one frame so the
     effect of the slider is visible without starting a loop. */
  useEffect(() => {
    if (!running) renderRef.current(STEP_DT);
  }, [gravity, running]);

  const drop = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (ballsRef.current.length >= 40) ballsRef.current.shift();
    ballsRef.current.push(makeBall(e.clientX - rect.left, e.clientY - rect.top));
    if (!running) renderRef.current(STEP_DT);
  };

  return (
    <div className="welcome-playground">
      <canvas
        ref={canvasRef}
        className="welcome-playground__canvas"
        onPointerDown={drop}
        role="img"
        aria-label="A box of coloured balls falling and bouncing under the gravity you set."
      />
      {/* A sibling of .welcome-playground__controls, not nested inside it —
          gravityPlayground.test.js's "is the shared .btn/.btn--sm primitive"
          check does `.welcome-playground__controls button` (the FIRST button
          in that container) and expects the Play/Pause button; nesting the
          presets there first would break that lock. */}
      <div className="welcome-playground__presets" role="group" aria-label="Gravity presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="badge badge--accent welcome-playground__preset"
            aria-pressed={gravity === p.value}
            onClick={() => setGravity(p.value)}
          >
            {p.label} ({p.value})
          </button>
        ))}
      </div>
      <div className="welcome-playground__controls">
        <button
          className="btn btn--sm"
          type="button"
          aria-pressed={running}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? "Pause" : "Play"}
        </button>
        <label htmlFor="welcome-gravity">Gravity</label>
        <span className="welcome-playground__value">{gravity.toFixed(1)} m/s²</span>
        <input
          id="welcome-gravity"
          className="range"
          type="range"
          min="0"
          max="30"
          step="0.1"
          value={gravity}
          onChange={(e) => setGravity(Number(e.target.value))}
          aria-valuetext={`${gravity.toFixed(1)} metres per second squared`}
        />
        {/* Honest, not invented: the click-to-drop gesture has no keyboard
            equivalent and is decorative. The slider above is the one
            control that matters and it is fully keyboard-operable. */}
        <span className="welcome-playground__hint">
          Click anywhere in the box to drop a ball — a decorative touch with no keyboard
          equivalent. The gravity slider above is the control that matters.
        </span>
      </div>
    </div>
  );
}
