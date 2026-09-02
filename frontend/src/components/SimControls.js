import React from "react";
import {
  PlayIcon,
  StopIcon,
  PauseIcon,
  StepForwardIcon,
} from "./Icons";
import { MOD_LABEL } from "../utils/hotkeys";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { HEADER_STAGE2_QUERY } from "./Toolbar";

/**
 * Every simulation control, in the viewport's own header.
 *
 * They used to live in the app header beside Menu / Save / mode / Help. That
 * bar is adaptive, and the debug group is deliberately non-collapsible (a
 * student mid-step must not lose Next frame into an overflow menu), so
 * turning debug or trace on pushed six more controls into a row that was
 * already full and squashed the lot — most visibly crowding Stop against
 * whatever sat beside it.
 *
 * Moving them here fixes the crowding by putting them somewhere with room,
 * and is the better home on its own merits: these controls act on the
 * simulation, and this is the simulation's pane. The app header keeps what
 * acts on the *project* — menu, save, editor mode, help, account.
 *
 * Run and Stop are ONE button, not two. `visibleControls()` already made them
 * mutually exclusive by run state, but during `booting` both appeared; a
 * single toggle removes that seam entirely and gives the keyboard the same
 * shape (Ctrl/Cmd+Enter toggles rather than only starting — see
 * utils/hotkeys.js).
 */
function SimControls({
  running = false,
  booting = false,
  onRun,
  onStop,
  debugMode = false,
  paused = false,
  pauseState = "running",
  iteration = 0,
  breakpointCount = 0,
  onPause,
  onResume,
  onStepFrame,
  onStepValue,
}) {
  /* Stage 2 is active AT the declared 1024px floor. The readout SHORTENS
     there rather than hiding, so the narrowest supported viewport still gets
     both the visible proof that a pause took and the announcement. Read from
     the same query the header uses, so the two never disagree. */
  const stage2 = useMediaQuery(HEADER_STAGE2_QUERY);
  const runState = booting ? "booting" : running ? "running" : "idle";

  /* The readout stays ONE text node so what is announced is exactly what is
     shown, and only ever drops the word "iteration" — the title restores it. */
  const pauseLabel =
    pauseState === "paused"
      ? { full: `Paused · iteration ${iteration}`, short: `Paused · ${iteration}` }
      : pauseState === "pausing"
        ? { full: "Pausing…", short: "Pausing…" }
        : { full: `iteration ${iteration}`, short: `${iteration}` };

  const toggle = running ? onStop : onRun;
  const toggleTitle = booting
    ? "Starting simulation…"
    : running
      ? `Stop simulation (${MOD_LABEL}+Enter or Esc)`
      : `Run simulation (${MOD_LABEL}+Enter)`;

  return (
    <div className="sim-controls">
      <button
        type="button"
        className={`tb-btn ${running ? "tb-btn--stop" : "tb-btn--run"}${
          runState === "booting" ? " tb-btn--disabled" : ""
        }`}
        onClick={runState === "booting" ? undefined : toggle}
        disabled={runState === "booting"}
        title={toggleTitle}
      >
        {running ? <StopIcon size={13} /> : <PlayIcon size={13} />}
        <span className="tb-btn-label">{running ? "Stop" : "Run"}</span>
      </button>

      {/* ── Debug controls (only while debug mode is on) ──
         Deliberately NOT collapsible, for the same reason as before the
         move: a student mid-step cannot lose Next frame into an overflow. */}
      {debugMode && (
        <>
          <span className="sim-controls__sep" />
          <button
            type="button"
            className="tb-btn"
            onClick={paused ? onResume : onPause}
            disabled={!running}
            title={paused ? "Resume (Space)" : "Pause (Space)"}
          >
            {paused ? <PlayIcon size={13} /> : <PauseIcon size={13} />}
            <span className="tb-btn-label">{paused ? "Resume" : "Pause"}</span>
          </button>
          <button
            type="button"
            className="tb-btn tb-btn--primary-ghost"
            onClick={onStepFrame}
            disabled={!running}
            title="Advance one animation frame (F10)"
          >
            <StepForwardIcon size={13} />
            <span className="tb-btn-label">Next frame</span>
          </button>
          <button
            type="button"
            className="tb-btn tb-btn--subtle"
            onClick={onStepValue}
            disabled={!running}
            title="Advance to the next reported value (Shift+F10)"
          >
            <span className="tb-btn-label">Next value</span>
          </button>
          {/* Record lives in the trace panel ONLY (Plan 10 Stage C, audit
              win 1): this strip used to render a second Record wired to the
              same handlers with different labels and enabled rules —
              recording is a trace-panel action, and the panel is always
              open in debug mode. */}
          {breakpointCount > 0 && (
            <span
              className="tb-chip"
              title={`${breakpointCount} breakpoint${breakpointCount === 1 ? "" : "s"} set`}
            >
              {breakpointCount} bp
            </span>
          )}
          <span className="tb-chip tb-chip--quiet" aria-live="polite" title={pauseLabel.full}>
            {stage2 ? pauseLabel.short : pauseLabel.full}
          </span>
        </>
      )}
    </div>
  );
}

export default SimControls;
