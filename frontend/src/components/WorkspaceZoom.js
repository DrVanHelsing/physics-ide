import React from "react";
import { ZoomInIcon, ZoomOutIcon, ScanIcon } from "./Icons";
import { ZOOM_MIN, ZOOM_MAX } from "../constants";

const ZOOM_STEP = 10;

const clamp = (pct) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pct));

/**
 * WorkspaceZoom — the on-canvas +/−/fit/percent cluster docked bottom-right
 * of the blocks pane. Replaces the old header zoom slider (Toolbar.js);
 * `onZoomChange` is `sim.handleZoomChange`, which pushes the new scale into
 * the live workspace and persists it via SimulationContext.
 */
function WorkspaceZoom({ zoom, onZoomChange, workspaceRef }) {
  const handleZoomIn = () => onZoomChange(clamp(zoom + ZOOM_STEP));
  const handleZoomOut = () => onZoomChange(clamp(zoom - ZOOM_STEP));

  const handleFit = () => {
    const ws = workspaceRef.current;
    if (!ws) return;
    ws.zoomToFit();
    onZoomChange(Math.round(ws.getScale() * 100));
  };

  return (
    <div className="workspace-zoom">
      <button
        type="button"
        className="workspace-zoom__btn"
        title="Zoom in"
        aria-label="Zoom in"
        onClick={handleZoomIn}
      >
        <ZoomInIcon size={14} />
      </button>
      <button
        type="button"
        className="workspace-zoom__btn"
        title="Zoom out"
        aria-label="Zoom out"
        onClick={handleZoomOut}
      >
        <ZoomOutIcon size={14} />
      </button>
      <button
        type="button"
        className="workspace-zoom__btn"
        title="Fit blocks to view"
        aria-label="Fit blocks to view"
        onClick={handleFit}
      >
        <ScanIcon size={14} />
      </button>
      <span className="workspace-zoom__pct">{zoom}%</span>
    </div>
  );
}

export default WorkspaceZoom;
