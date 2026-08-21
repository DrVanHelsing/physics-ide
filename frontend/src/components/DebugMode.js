/**
 * DebugMode.js
 *
 * Full-screen debug overlay with:
 *  ┌─────────────────────────── Debug Toolbar ────────────────────────────┐
 *  │ [Exit] [Run] [Stop] [Pause] [Step] [Resume] [Record]                 │
 *  └─────────────────────────────────────────────────────────────────────-┘
 *  ┌──────────────┬─────────────────────────┬──────────────────────────────┐
 *  │  Read-only   │   3-D Viewport          │   Trace Table                │
 *  │  Blockly     │   (GlowScript iframe)   │   (Tier 1+2+3 + recording)   │
 *  │  (breakpts)  │                         │                              │
 *  └──────────────┴─────────────────────────┴──────────────────────────────┘
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { ReadOnlyBlockly } from "./BlocklyWorkspace";
import CodeEditor from "./CodeEditor";
import TraceTable from "./TraceTable";
import GlowCanvas from "./GlowCanvas";
import {
  ArrowLeftIcon,
  DownloadIcon,
  PlayIcon,
  StopIcon,
  PauseIcon,
  StepForwardIcon,
  RecordIcon,
  BugIcon,
} from "./Icons";

/* ─── Breakpoint legend pill ─────────────────────────────── */
function BpBadge({ count }) {
  if (!count) return null;
  return (
    <span className="dm-bp-badge" title={`${count} breakpoint${count !== 1 ? "s" : ""} set`}>
      {count} bp
    </span>
  );
}

/* ─── Debug Mode main component ─────────────────────────── */
export default function DebugMode({
  /* workspace */
  workspaceXml,
  pythonCode,
  isDark,
  projectType,
  /* simulation controls */
  running,
  booting,
  paused,
  onRun,
  onStop,
  onPause,
  onResume,
  onStep,
  /* trace */
  traceData,
  onHighlightBlock,
  onClearTrace,
  /* recording */
  recording,
  onStartRecord,
  onStopRecord,
  recordBuffer,
  onSaveAsDataset,
  /* breakpoints */
  breakpoints,        // Set<blockId>
  onToggleBreakpoint, // (blockId) => void
  /* execution highlight */
  executingBlockId,   // string | null
  /* exit */
  onExitDebug,
}) {
  /* ── Resizable panels — percentage-of-container (same approach as main pane divider) ── */
  const [leftPct,  setLeftPct]  = useState(22); // % of dm-body width
  const [rightPct, setRightPct] = useState(28); // % of dm-body width
  const containerRef = useRef(null);

  /* ── Left resize handle drag ── */
  const startLeftResize = useCallback((e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const onMove = (ev) => {
      const rect = container.getBoundingClientRect();
      const pct = Math.min(40, Math.max(12, ((ev.clientX - rect.left) / rect.width) * 100));
      setLeftPct(pct);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, []);

  /* ── Right resize handle drag ── */
  const startRightResize = useCallback((e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const onMove = (ev) => {
      const rect = container.getBoundingClientRect();
      const pct = Math.min(50, Math.max(18, ((rect.right - ev.clientX) / rect.width) * 100));
      setRightPct(pct);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
      try { handle.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, []);

  /* ── Highlight block when a variable row is clicked ── */
  const handleHighlight = useCallback((blockId) => {
    if (!blockId) return;
    onHighlightBlock?.(blockId);
  }, [onHighlightBlock]);

  /* ── Block click → toggle breakpoint ── */
  const handleBlockClick = useCallback((blockId) => {
    onToggleBreakpoint?.(blockId);
  }, [onToggleBreakpoint]);

  const isCodeOnly = projectType === "code_blank" || projectType === "code_template";

  /* For code projects, derive Set<number> of breakpointed line numbers from
     the shared breakpoints Set which stores "line_N" style IDs.            */
  const codeBreakpointLines = isCodeOnly
    ? new Set(
        [...(breakpoints || [])].flatMap((id) => {
          const m = String(id).match(/^line_(\d+)$/);
          return m ? [parseInt(m[1], 10)] : [];
        })
      )
    : new Set();

  /* Derive current executing line number for code projects */
  const executingLine = (() => {
    if (!isCodeOnly || !executingBlockId) return null;
    const m = String(executingBlockId).match(/^line_(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  })();

  /* Toggle breakpoint by line number (code projects) */
  const handleCodeLineBreakpoint = useCallback((lineNum) => {
    onToggleBreakpoint?.(`line_${lineNum}`);
  }, [onToggleBreakpoint]);

  /* Count all breakpoints (block IDs and line_N alike) */
  const bpCount = breakpoints ? breakpoints.size : 0;

  /* ── Keyboard shortcut: Space = pause/resume, F10 = step, Esc = exit ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space" && running) {
        e.preventDefault();
        paused ? onResume?.() : onPause?.();
      }
      if (e.code === "F10") {
        e.preventDefault();
        onStep?.();
      }
      if (e.code === "Escape") {
        onExitDebug?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [running, paused, onPause, onResume, onStep, onExitDebug]);

  return (
    <div className="dm-overlay">
      {/* ── Top bar ── */}
      <div className="dm-topbar">
        <button className="dm-exit-btn" onClick={onExitDebug} title="Exit Debug Mode (Esc)">
          <ArrowLeftIcon size={13} />
          <span>Exit Debug</span>
        </button>

        <div className="dm-topbar-sep" />

        <div className="dm-topbar-group">
          <button
            className={`dm-ctrl-btn dm-ctrl-btn--run${running ? " dm-ctrl-btn--active" : ""}`}
            onClick={running ? onStop : onRun}
            title={running ? "Stop simulation" : "Run simulation"}
            disabled={!pythonCode}
          >
            {running ? <StopIcon size={13} /> : <PlayIcon size={13} />}
            <span>{running ? "Stop" : "Run"}</span>
          </button>
        </div>

        <div className="dm-topbar-sep" />

        <div className="dm-topbar-group" title="Step-through controls (requires running simulation)">
          <button
            className={`dm-ctrl-btn${paused ? " dm-ctrl-btn--active" : ""}`}
            onClick={onPause}
            disabled={!running || paused}
            title="Pause simulation (Space)"
          >
            <PauseIcon size={12} />
            <span>Pause</span>
          </button>
          <button
            className="dm-ctrl-btn"
            onClick={onResume}
            disabled={!running || !paused}
            title="Resume simulation (Space)"
          >
            <PlayIcon size={12} />
            <span>Resume</span>
          </button>
          <button
            className="dm-ctrl-btn dm-ctrl-btn--step"
            onClick={onStep}
            disabled={!running}
            title="Step forward one trace event (F10)"
          >
            <StepForwardIcon size={12} />
            <span>Step</span>
          </button>
        </div>

        <div className="dm-topbar-sep" />

        <div className="dm-topbar-group">
          {recording ? (
            <button
              className="dm-ctrl-btn dm-ctrl-btn--rec-active"
              onClick={onStopRecord}
              title="Stop recording"
            >
              <span className="dm-rec-dot" />
              <span>Stop Rec</span>
            </button>
          ) : (
            <button
              className="dm-ctrl-btn"
              onClick={onStartRecord}
              title="Start recording all trace data to CSV"
            >
              <RecordIcon size={11} />
              <span>Record</span>
            </button>
          )}
          <button
            className="dm-ctrl-btn"
            onClick={() => {
              if (!recordBuffer || recordBuffer.length === 0) return;
              const header = "timestamp_ms,variable,value,delta,min,max\n";
              const rows = recordBuffer.map(
                (r) => `${r.t},"${r.name}","${r.value}",${r.delta ?? ""},${r.min ?? ""},${r.max ?? ""}`
              );
              const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href = url;
              a.download = "recording_" + Date.now() + ".csv";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
            title={`Export recording CSV (${recordBuffer ? recordBuffer.length : 0} rows)`}
            disabled={!recordBuffer || recordBuffer.length === 0}
          >
            <DownloadIcon size={11} />
            <span>CSV</span>
          </button>
          {recording && recordBuffer && (
            <span className="dm-rec-count">{recordBuffer.length} rows</span>
          )}
        </div>

        <div className="dm-topbar-hint">
          <BugIcon size={12} />
          <span>Debug Mode</span>
          <BpBadge count={bpCount} />
        </div>
      </div>

      {/* ── Three-column body ── */}
      <div className="dm-body" ref={containerRef}>

        {/* Left panel: Blockly (block projects) or read-only code (code-only projects) */}
        <div className="dm-panel dm-panel--blocks" style={{ flex: `0 0 ${leftPct}%`, maxWidth: `${leftPct}%` }}>
          <div className="dm-panel-header">
            <span className="dm-panel-title">{isCodeOnly ? "Code" : "Blocks"}</span>
            {bpCount > 0 && <BpBadge count={bpCount} />}
            {isCodeOnly
              ? <span className="dm-panel-hint">Click line number to toggle breakpoint</span>
              : <span className="dm-panel-hint">Click block to toggle breakpoint</span>}
          </div>
          {isCodeOnly ? (
            <div className="dm-code-wrap">
              <CodeEditor
                value={pythonCode || ""}
                onChange={() => {}}
                isDark={isDark}
                readOnly={true}
                breakpointLines={codeBreakpointLines}
                onToggleLineBreakpoint={handleCodeLineBreakpoint}
                executingLine={executingLine}
              />
            </div>
          ) : (
            <div className="dm-blockly-wrap">
              <ReadOnlyBlockly
                xml={workspaceXml}
                isDark={isDark}
                breakpoints={breakpoints}
                onBlockClick={handleBlockClick}
                executingBlockId={executingBlockId}
              />
            </div>
          )}
        </div>

        {/* Left resize handle */}
        <div
          className="dm-resize-handle dm-resize-handle--left"
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={startLeftResize}
          title="Drag to resize Blocks panel"
        />

        {/* Center: 3D viewport */}
        <div className="dm-panel dm-panel--viewport">
          <div className="dm-panel-header">
            <span className="dm-panel-title">3D Viewport</span>
            {paused && running && <span className="dm-paused-badge">PAUSED</span>}
          </div>
          <GlowCanvas running={running} booting={booting} />
        </div>

        {/* Right resize handle */}
        <div
          className="dm-resize-handle dm-resize-handle--right"
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={startRightResize}
          title="Drag to resize Trace panel"
        />

        {/* Right: trace table */}
        <div className="dm-panel dm-panel--trace" style={{ flex: `0 0 ${rightPct}%`, maxWidth: `${rightPct}%` }}>
          <TraceTable
            data={traceData}
            onHighlight={handleHighlight}
            onClear={onClearTrace}
            recording={recording}
            onStartRecord={onStartRecord}
            onStopRecord={onStopRecord}
            recordBuffer={recordBuffer}
            onSaveAsDataset={onSaveAsDataset}
          />
        </div>
      </div>
    </div>
  );
}
