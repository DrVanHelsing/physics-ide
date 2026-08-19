import React, { useEffect, useRef, useState } from "react";

const DAMPING = 0.82;
const COLORS = ["#7dd3fc", "#f9a8d4", "#fcd34d", "#86efac", "#c4b5fd"];

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

/** A tiny canvas physics toy: drag the slider, click to drop balls. */
export default function GravityPlayground() {
  const canvasRef = useRef(null);
  const ballsRef = useRef([makeBall(80, 40), makeBall(180, 60), makeBall(260, 30)]);
  const gravityRef = useRef(9.8);
  const [gravity, setGravity] = useState(9.8);
  gravityRef.current = gravity;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let last = performance.now();

    const frame = (t) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      for (const b of ballsRef.current) {
        b.vy += gravityRef.current * 60 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y + b.r > h) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * DAMPING; }
        if (b.x + b.r > w) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * DAMPING; }
        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * DAMPING; }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const drop = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    if (ballsRef.current.length >= 40) ballsRef.current.shift();
    ballsRef.current.push(makeBall(e.clientX - rect.left, e.clientY - rect.top));
  };

  return (
    <div className="welcome-playground">
      <canvas ref={canvasRef} className="welcome-playground__canvas" onPointerDown={drop} />
      <div className="welcome-playground__controls">
        <label htmlFor="welcome-gravity">Gravity: {gravity.toFixed(1)} m/s²</label>
        <input
          id="welcome-gravity"
          type="range"
          min="0"
          max="30"
          step="0.1"
          value={gravity}
          onChange={(e) => setGravity(Number(e.target.value))}
        />
        <span className="welcome-playground__hint">Click anywhere in the box to drop a ball.</span>
      </div>
    </div>
  );
}
