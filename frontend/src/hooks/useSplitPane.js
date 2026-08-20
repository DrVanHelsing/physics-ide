/**
 * useSplitPane
 *
 * Provides the drag-to-resize divider logic for the two-panel layout.
 * Clamps the split between 15 % and 85 % of the container width.
 */
import { useCallback, useEffect } from "react";
import { useSimulationContext } from "../contexts/SimulationContext";
import { SPLIT_MIN, SPLIT_MAX, SPLIT_DEFAULT } from "../constants";

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

  /* ── Pointer-drag resize ──────────────────────────────────
     Pointer Events (not mouse events) so a stylus or finger can resize the
     panes on a tablet; setPointerCapture keeps the drag alive when the
     pointer leaves the 5px handle. */
  const handleDividerPointerDown = useCallback(
    (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      const container = handle.parentElement; // .main-layout flex row
      try { handle.setPointerCapture(e.pointerId); } catch { /* not capturable */ }

      const onMove = (ev) => {
        const rect = container.getBoundingClientRect();
        setSplitPct(
          Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ((ev.clientX - rect.left) / rect.width) * 100)),
        );
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [setSplitPct],
  );

  /* Keyboard resize — the divider is a real focusable separator. */
  const handleDividerKeyDown = useCallback(
    (e) => {
      const step = e.shiftKey ? 10 : 2;
      if (e.key === "ArrowLeft")  { e.preventDefault(); setSplitPct((p) => Math.max(SPLIT_MIN, p - step)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setSplitPct((p) => Math.min(SPLIT_MAX, p + step)); }
      if (e.key === "Home")       { e.preventDefault(); setSplitPct(SPLIT_DEFAULT); }
    },
    [setSplitPct],
  );

  return { splitPct, handleDividerPointerDown, handleDividerKeyDown };
}
