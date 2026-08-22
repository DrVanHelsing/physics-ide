/**
 * useDebug
 *
 * Debug-mode entry/exit, the pause/step controls, and breakpoint state.
 * Consumes DebugContext + SimulationContext + TraceContext.
 *
 * Entering and leaving are NOT run teardowns (they were, until Task 17 —
 * see handleEnterDebug). Debug is a mode of the shell: entering pauses,
 * leaving resumes, and the workspace, viewport and status bar stay put.
 */
import { useCallback } from "react";
import { pausePython, resumePython, stepPython, stepFrame } from "../utils/runner/glowRunner";
import { useDebugContext }       from "../contexts/DebugContext";
import { useSimulationContext }  from "../contexts/SimulationContext";
import { useTraceContext }       from "../contexts/TraceContext";
import { PAUSE_ACK_TIMEOUT_MS }  from "../constants";

export function useDebug() {
  const {
    debugMode, setDebugMode,
    breakpoints,
    breakableIds,
    isBreakable,
    toggleBreakpoint,
    executingBlockId,
    pauseState,
    setPauseState,
    pauseAckTimerRef,
  } = useDebugContext();

  const { running, setPaused, setStatus, runGenerationRef } = useSimulationContext();
  const { setRecording, recordingRef }       = useTraceContext();

  /** Arms the shared ack-timeout fallback, capturing the CURRENT run
   *  generation. Without this, a stale timer from a session the student has
   *  already left (exit debug, Stop, a fresh Run — anything that bumps
   *  `runGenerationRef`, see SimulationContext) would fire ~1s later and
   *  call resumePython()/overwrite status against whatever now owns the
   *  screen, not the session that armed it. Shared by handlePause and
   *  handleStepFrame — both can leave a program stuck "pausing" forever
   *  when it has no traced values, since neither ever reaches a runtime
   *  checkpoint to post the __phpause ack. */
  const armPauseAckTimeout = useCallback(() => {
    const armedGeneration = runGenerationRef.current;
    if (pauseAckTimerRef.current) clearTimeout(pauseAckTimerRef.current);
    pauseAckTimerRef.current = setTimeout(() => {
      if (runGenerationRef.current !== armedGeneration) return; // stale — session moved on
      /* No checkpoint was reached. Tell the student why instead of showing a
         PAUSED badge over a simulation that never stopped. */
      resumePython();
      setPauseState("running");
      setPaused(false);
      setStatus({
        text: "Can't pause this simulation — it has no traced values.",
        detail:
          "Pausing happens where a block reports a value. Add a “set”, “update position” or “time step” block inside your loop, then try again.",
        type: "error",
      });
    }, PAUSE_ACK_TIMEOUT_MS);
  }, [runGenerationRef, pauseAckTimerRef, setPauseState, setPaused, setStatus]);

  const handlePause = useCallback(() => {
    pausePython();
    setPauseState("pausing");
    armPauseAckTimeout();
  }, [setPauseState, armPauseAckTimeout]);

  const handleResume = useCallback(() => {
    resumePython();
    if (pauseAckTimerRef.current) clearTimeout(pauseAckTimerRef.current);
    setPauseState("running");
    setPaused(false);
  }, [setPauseState, setPaused, pauseAckTimerRef]);

  const handleStep = useCallback(() => {
    setPaused(true);
    stepPython();
  }, [setPaused]);

  /** The dominant control: one full animation frame. Gets the same honest
   *  ack-timeout fallback as handlePause — a program with no traced values
   *  never posts a __phpause ack here either, and without the fallback
   *  "Next frame" would leave pauseState stuck at "pausing" forever. */
  const handleStepFrame = useCallback(() => {
    setPauseState("pausing");
    stepFrame();
    armPauseAckTimeout();
  }, [setPauseState, armPauseAckTimeout]);

  /* ── Entering and leaving debug mode ───────────────────────────────────
     Neither is a run teardown any more. Debug used to call endRun on the way
     in AND on the way out — stopping the simulation both times — while
     HelpPage promised "the simulation pauses immediately". A student who
     clicked Debug mid-run landed on a blank black rectangle and had to find
     Run again inside a toolbar they had never seen. Debug is a mode of this
     shell now, so entering it pauses and leaving it resumes. */
  const handleEnterDebug = useCallback(() => {
    if (running) {
      /* handlePause, not a bare pausePython: it posts "pausing" and arms the
         honest ack fallback, so a program with no traced values says why it
         cannot pause instead of sitting on "pausing…" forever. */
      handlePause();
    } else {
      /* Nothing to pause. Start from a clean slate rather than inheriting a
         stale "pausing"/"paused" left by a session that has already ended. */
      if (pauseAckTimerRef.current) clearTimeout(pauseAckTimerRef.current);
      setPauseState("running");
      setPaused(false);
    }
    setDebugMode(true);
    setStatus({ text: "Debug mode — breakpoints armed on the next Run", type: "" });
  }, [running, handlePause, pauseAckTimerRef, setPauseState, setPaused, setDebugMode, setStatus]);

  const handleExitDebug = useCallback(() => {
    resumePython();
    /* Load-bearing, not hygiene: exit no longer bumps runGenerationRef (it is
       not a teardown), so a pause-ack timer armed moments ago would still
       match the live generation and fire its "no traced values" error over a
       simulation this call just resumed. */
    if (pauseAckTimerRef.current) clearTimeout(pauseAckTimerRef.current);
    setPauseState("running");
    setPaused(false);
    setRecording(false);
    recordingRef.current = false;
    setDebugMode(false);
    setStatus({ text: running ? "Simulation running" : "Ready", type: "" });
    /* It must NOT touch traceVisible (IDELayout): if the student opened the
       trace drawer themselves, leaving debug mode takes the debug CONTROLS
       away and leaves their panel where they put it. */
  }, [running, pauseAckTimerRef, setPauseState, setPaused, setRecording, recordingRef, setDebugMode, setStatus]);

  return {
    debugMode,
    breakpoints,
    breakableIds,
    isBreakable,
    executingBlockId,
    pauseState,
    toggleBreakpoint,
    handleEnterDebug,
    handleExitDebug,
    handlePause,
    handleResume,
    handleStep,
    handleStepFrame,
  };
}
