import React, { useEffect, useRef } from "react";
import { applyRuntimeTheme, resizeRuntimeCanvas } from "../utils/runner/glowRunner";
import { useTheme } from "../contexts/ThemeContext";

function GlowCanvas({ running }) {
  const viewportRef = useRef(null);
  const { isDark } = useTheme();

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
        {running && (
          <div className="canvas-controls-hint" aria-hidden="true">
            Drag: rotate · Wheel: zoom · Right-drag: pan
          </div>
        )}
      </div>
    </div>
  );
}

export default GlowCanvas;
