/**
 * useDebug
 *
 * Provides debug-mode entry/exit and breakpoint management.
 * Consumes DebugContext + SimulationContext.
 */
import { useCallback } from "react";
import { pausePython, resumePython, stepPython } from "../utils/runner/glowRunner";
import { endRun } from "./useSimulation";
import { useDebugContext }       from "../contexts/DebugContext";
import { useSimulationContext }  from "../contexts/SimulationContext";
import { useTraceContext }       from "../contexts/TraceContext";

export function useDebug() {
  const {
    debugMode, setDebugMode,
    breakpoints,
    toggleBreakpoint,
    executingBlockId,
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

  const handlePause = useCallback(() => {
    pausePython();
    setPaused(true);
  }, [setPaused]);

  const handleResume = useCallback(() => {
    resumePython();
    setPaused(false);
  }, [setPaused]);

  const handleStep = useCallback(() => {
    setPaused(true);
    stepPython();
  }, [setPaused]);

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
  };
}
