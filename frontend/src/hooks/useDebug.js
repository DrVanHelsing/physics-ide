/**
 * useDebug
 *
 * Provides debug-mode entry/exit and breakpoint management.
 * Consumes DebugContext + SimulationContext.
 */
import { useCallback } from "react";
import { pausePython, resumePython, stepPython, stepFrame } from "../utils/runner/glowRunner";
import { endRun } from "./useSimulation";
import { useDebugContext }       from "../contexts/DebugContext";
import { useSimulationContext }  from "../contexts/SimulationContext";
import { useTraceContext }       from "../contexts/TraceContext";
import { PAUSE_ACK_TIMEOUT_MS }  from "../constants";

export function useDebug() {
  const {
    debugMode, setDebugMode,
    breakpoints,
    toggleBreakpoint,
    executingBlockId,
    setPauseState,
    pauseAckTimerRef,
  } = useDebugContext();

  const { setRunning, setBooting, setPaused, setStatus, runGenerationRef } = useSimulationContext();
  const { setRecording, recordingRef }       = useTraceContext();

  /* Entering/exiting debug mode is a run teardown like Stop/Reset/Home — it
     must go through the same endRun so it bumps the shared generation
     counter and clears `booting` too (T16 guard; see useSimulation.js). */
  const handleEnterDebug = useCallback(() => {
    endRun({ runGenerationRef, setRunning, setBooting, setStatus }, { text: "Debug Mode", type: "" });
    setPaused(false);
    setDebugMode(true);
  }, [runGenerationRef, setRunning, setBooting, setStatus, setPaused, setDebugMode]);

  const handleExitDebug = useCallback(() => {
      endRun({ runGenerationRef, setRunning, setBooting, setStatus }, { text: "Ready", type: "" });
      setPaused(false);
      setRecording(false);
      recordingRef.current = false;
      setDebugMode(false);
    },
    [runGenerationRef, setRunning, setBooting, setStatus, setPaused, setRecording, recordingRef, setDebugMode]
  );

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

  return {
    debugMode,
    breakpoints,
    executingBlockId,
    toggleBreakpoint,
    handleEnterDebug,
    handleExitDebug,
    handlePause,
    handleResume,
    handleStep,
    handleStepFrame,
  };
}
