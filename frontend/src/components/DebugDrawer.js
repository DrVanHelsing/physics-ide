/**
 * DebugDrawer — the trace table, docked beside the live viewport.
 *
 * Debug used to be a separate world: IDELayout early-returned a whole other
 * tree (its own titlebar, toolbar, split pane and — critically — no status
 * bar, so the one mode meant for finding faults was the one mode that could
 * not show them). It is now a mode of the shell. The .debug-drawer rules this
 * renders into have existed in the stylesheet since before Tranche 3 and had
 * no consumer at all.
 *
 * The signature is deliberately only what TraceTable consumes: the watch
 * expressions and their add/remove handlers live in TraceContext, which
 * TraceTable reads directly, so threading them through here would be dead
 * props. The iteration readout is the toolbar's `.tb-chip--quiet`, beside the
 * step controls that change it.
 */
import React, { useCallback, useRef, useState } from "react";
import TraceTable from "./TraceTable";

const MIN_PX = 200;
const MAX_PX = 500;
const NUDGE_PX = 16;

const clamp = (px) => Math.min(MAX_PX, Math.max(MIN_PX, px));

export default function DebugDrawer({
  traceData,
  onHighlight,
  onClearTrace,
  recording,
  onStartRecord,
  onStopRecord,
  recordBuffer,
  onSaveAsDataset,
}) {
  const [width, setWidth] = useState(320);
  const drawerRef = useRef(null);

  /* Dragging LEFT widens the drawer, so the delta is (startX - clientX).
     Listeners go on window, not the handle: a fast drag outruns a 4px strip
     and the pointer leaves it long before the gesture ends. */
  const startResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = drawerRef.current?.getBoundingClientRect().width ?? 320;
    const onMove = (ev) => setWidth(clamp(startW + (startX - ev.clientX)));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  /* Keyboard parity with the pointer gesture: ← widens, → narrows. */
  const nudge = useCallback((e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setWidth((w) => clamp(w + (e.key === "ArrowLeft" ? NUDGE_PX : -NUDGE_PX)));
  }, []);

  return (
    <>
      <div
        className="debug-drawer-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the trace panel"
        aria-valuenow={Math.round(width)}
        aria-valuemin={MIN_PX}
        aria-valuemax={MAX_PX}
        tabIndex={0}
        onPointerDown={startResize}
        onKeyDown={nudge}
      />
      <aside className="debug-drawer" ref={drawerRef} style={{ width }}>
        <TraceTable
          data={traceData}
          onHighlight={onHighlight}
          onClear={onClearTrace}
          recording={recording}
          onStartRecord={onStartRecord}
          onStopRecord={onStopRecord}
          recordBuffer={recordBuffer}
          onSaveAsDataset={onSaveAsDataset}
        />
      </aside>
    </>
  );
}
