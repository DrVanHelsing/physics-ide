import React, { useEffect, useRef, useState } from "react";
import { applyRuntimeTheme, resizeRuntimeCanvas, getSceneMeta, getRuntimeScene } from "../utils/runner/glowRunner";
import { useTheme } from "../contexts/ThemeContext";
import ViewportControls from "./ViewportControls";

function GlowCanvas({ running, onStatus }) {
  const viewportRef = useRef(null);
  const { isDark } = useTheme();
  const [sceneMeta, setSceneMeta] = useState({ title: "", caption: "" });
  const [hintVisible, setHintVisible] = useState(true);

  /* Keep the drawing buffer matched to the box, at the display's pixel ratio.
     Debounced ~100ms so a divider drag is one reallocation, not sixty. */
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver !== "function") return undefined;
    let timer = null;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        resizeRuntimeCanvas(box.width, box.height);
      }, 100);
    });
    ro.observe(el);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  /* Theme the LIVE frame — no reload, so a mid-run toggle keeps the run. */
  useEffect(() => {
    if (!running) return;
    applyRuntimeTheme(isDark);
  }, [isDark, running]);

  /* precodedExamples.js authors explanatory scene.title / scene.caption text
     that the runtime's overflow:hidden pushes out of view. Read it back and
     render it in React chrome instead of losing it.
     A fixed short delay is not enough: the runtime loads six CDN scripts
     before the scene object exists at all (confirmed live — several seconds,
     not milliseconds), so this polls the same way ViewportControls waits for
     the engine, and reads the meta once the scene actually exists. */
  useEffect(() => {
    if (!running) { setSceneMeta({ title: "", caption: "" }); return undefined; }
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      if (getRuntimeScene()) { setSceneMeta(getSceneMeta()); clearInterval(id); }
      else if (tries > 60) clearInterval(id);   // ~9s, then give up quietly
    }, 150);
    return () => clearInterval(id);
  }, [running]);

  /* The drag/wheel/pan hint sits permanently over the viewport otherwise.
     Hide it after the first pointer interaction or 6 seconds. */
  useEffect(() => {
    if (!running) { setHintVisible(true); return undefined; }
    const el = viewportRef.current;
    const hide = () => setHintVisible(false);
    const id = setTimeout(hide, 6000);
    el?.addEventListener("pointerdown", hide, { once: true });
    return () => {
      clearTimeout(id);
      el?.removeEventListener("pointerdown", hide);
    };
  }, [running]);

  return (
    <div className="canvas-wrap">
      {/* ── 3D viewport ── */}
      <div className="canvas-viewport" ref={viewportRef}>
        {!running && (
          <div className="canvas-idle">
            <div className="canvas-idle-inner">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="canvas-idle-atom"
              >
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <ellipse cx="12" cy="12" rx="10" ry="4" />
                <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
                <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
              </svg>
              <p className="canvas-idle-label">3D Viewport</p>
              <p className="canvas-idle-hint">
                Press <strong>Run</strong> to start the simulation
              </p>
            </div>
          </div>
        )}
        <div
          id="glowscript-host"
          className="glow-host"
          style={running ? undefined : { display: "none" }}
        />
        <ViewportControls running={running} hostRef={viewportRef} onStatus={onStatus} />
        {running && hintVisible && (
          <div className="canvas-controls-hint" aria-hidden="true">
            Drag: rotate · Wheel: zoom · Right-drag: pan
          </div>
        )}
      </div>
      {(sceneMeta.title || sceneMeta.caption) && (
        <div className="canvas-caption">
          {sceneMeta.title && <strong>{sceneMeta.title}</strong>}
          {sceneMeta.caption && <span>{sceneMeta.caption}</span>}
        </div>
      )}
    </div>
  );
}

export default GlowCanvas;
