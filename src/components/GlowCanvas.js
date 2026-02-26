import React from "react";

function GlowCanvas({ running }) {
  return (
    <div className="canvas-wrap">
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
    </div>
  );
}

export default GlowCanvas;

