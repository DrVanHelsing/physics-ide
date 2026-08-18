/**
 * useDebug
 *
 * Provides debug-mode entry/exit and breakpoint management.
 * Consumes DebugContext + SimulationContext.
 */
import { useCallback } from "react";
import { stopPython, pausePython, resumePython, stepPython } from "../utils/runner/glowRunner";
import { useDebugContext }       from "../contexts/DebugContext";
import { useSimulationContext }  from "../contexts/SimulationContext";
import { useTraceContext }       from "../contexts/TraceContext";
import { GLOWSCRIPT_HOST_ID }   from "../constants";

export function useDebug() {
  const {
    debugMode, setDebugMode,
    breakpoints,
    toggleBreakpoint,
    executingBlockId,
  } = useDebugContext();

  const { setRunning, setPaused, setStatus } = useSimulationContext();
  const { setRecording, recordingRef }       = useTraceContext();

  const handleEnterDebug = useCallback(() => {
    stopPython(GLOWSCRIPT_HOST_ID);
    setRunning(false);
    setPaused(false);
    setDebugMode(true);
    setStatus({ text: "Debug Mode", type: "" });
  }, [setRunning, setPaused, setDebugMode, setStatus]);

  const handleExitDebug = useCallback(() => {
      stopPython(GLOWSCRIPT_HOST_ID);
      setRunning(false);
      setPaused(false);
      setRecording(false);
      recordingRef.current = false;
      setDebugMode(false);
      setStatus({ text: "Ready", type: "" });
    },
    [setRunning, setPaused, setRecording, recordingRef, setDebugMode, setStatus]
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
