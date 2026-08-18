/**
 * useSplitPane
 *
 * Provides the drag-to-resize divider logic for the two-panel layout.
 * Clamps the split between 15 % and 85 % of the container width.
 */
import { useCallback, useEffect } from "react";
import { useSimulationContext } from "../contexts/SimulationContext";

export function useSplitPane() {
  const { splitPct, setSplitPct, viewportHidden, workspaceRef } = useSimulationContext();

  /* ── Resize Blockly whenever the split or viewport visibility changes ── */
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    requestAnimationFrame(() => {
      if (typeof window.Blockly?.svgResize === "function") {
        window.Blockly.svgResize(workspace);
        return;
      }
      workspace.resize?.();
    });
  }, [splitPct, viewportHidden, workspaceRef]);

  /* ── Mouse-drag col-resize handler ────────────────────── */
  const handleDividerMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      const container = e.currentTarget.parentElement; // .main-layout flex row

      const onMouseMove = (ev) => {
        const rect = container.getBoundingClientRect();
        const pct  = Math.min(85, Math.max(15, ((ev.clientX - rect.left) / rect.width) * 100));
        setSplitPct(pct);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup",   onMouseUp);
        document.body.style.cursor     = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor     = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup",   onMouseUp);
    },
    [setSplitPct]
  );

  return { splitPct, handleDividerMouseDown };
}
