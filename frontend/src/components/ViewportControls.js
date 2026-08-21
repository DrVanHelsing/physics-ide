import React, { useEffect, useState } from "react";
import { CrosshairIcon, ScanIcon, FullscreenIcon, CameraIcon } from "./Icons";
import { getRuntimeWindow, getRuntimeScene, captureRuntimeCanvas } from "../utils/runner/glowRunner";

/**
 * Overlay camera cluster. Before this, recovering a camera that had been spun
 * off the object required Stop → Run, which restarts the simulation and loses
 * the run.
 *
 * Every action is capability-checked against the live GlowScript scene: if the
 * runtime is not there or does not expose what an action needs, the button is
 * disabled with a plain-English title rather than failing silently.
 *
 * Verified live in DevTools against a running simulation: compiled GlowScript
 * 3.2 VPython does not expose the user's `scene` variable as a window global,
 * so getRuntimeScene() (glowRunner.js) resolves it via
 * window.__context.canvas_selected instead. forward/up/autoscale read/write
 * and window.vec all behaved as expected once resolved that way.
 */
function withScene(fn) {
  const win = getRuntimeWindow();
  const scene = getRuntimeScene();
  if (!win || !scene) return false;
  try {
    fn(scene, win);
    return true;
  } catch (err) {
    console.warn("Viewport control failed:", err);
    return false;
  }
}

export default function ViewportControls({ running, hostRef, onStatus }) {
  const [ready, setReady] = useState(false);

  /* The scene appears a moment after `running` flips — poll briefly rather
     than reaching into the runtime's load sequence. */
  useEffect(() => {
    if (!running) { setReady(false); return undefined; }
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (getRuntimeScene()) { setReady(true); clearInterval(id); }
      else if (tries > 40) clearInterval(id);   // ~6s, then give up quietly
    }, 150);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return null;

  const disabledTitle = ready ? null : "Waiting for the 3D engine…";

  const actions = [
    {
      key: "reset",
      icon: CrosshairIcon,
      label: "Reset camera",
      run: () =>
        withScene((scene, win) => {
          if (typeof win.vec === "function") {
            scene.forward = win.vec(0, 0, -1);
            scene.up = win.vec(0, 1, 0);
          }
        }),
    },
    {
      key: "fit",
      icon: ScanIcon,
      label: "Fit scene to view",
      run: () => withScene((scene) => { scene.autoscale = true; }),
    },
    {
      key: "fullscreen",
      icon: FullscreenIcon,
      label: "Fullscreen viewport",
      run: () => {
        const el = hostRef?.current;
        if (!el) return false;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else el.requestFullscreen?.();
        return true;
      },
    },
    {
      key: "shot",
      icon: CameraIcon,
      label: "Copy a snapshot to a new tab",
      run: async () => {
        const url = await captureRuntimeCanvas();
        if (!url) return false;
        const w = window.open();
        if (w) w.document.write(`<img src="${url}" alt="Simulation snapshot" style="max-width:100%">`);
        return Boolean(w);
      },
    },
  ];

  return (
    <div className="canvas-controls" role="group" aria-label="Viewport camera controls">
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          className="canvas-control"
          disabled={!ready && a.key !== "fullscreen"}
          title={(!ready && a.key !== "fullscreen" && disabledTitle) || a.label}
          aria-label={a.label}
          onClick={async () => {
            const ok = await a.run();
            if (!ok) onStatus?.({ text: `${a.label} is not available for this simulation.`, type: "error" });
          }}
        >
          <a.icon size={14} />
        </button>
      ))}
    </div>
  );
}
