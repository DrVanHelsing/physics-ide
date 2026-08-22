/**
 * useDebugHotkeys — Space / F10 / Shift+F10 while debug mode is on.
 *
 * The old handler (DebugMode.js's bare window listener) unconditionally exited
 * debug on Escape — so with the "Save run as dataset" dialog or Help open on
 * top, Escape tore down the whole debug session and discarded the recording
 * context. Escape is NOT bound here at all: closing an overlay is the
 * overlay's job, and leaving debug mode is a toolbar click.
 *
 * Composes alongside the global useHotkeys rather than inside it — these keys
 * are debug-scoped and must not exist when debug mode is off.
 */
import { useEffect } from "react";
import { useDebugContext } from "../contexts/DebugContext";
import { useSimulationContext } from "../contexts/SimulationContext";
import { useDebug } from "./useDebug";

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function useDebugHotkeys() {
  const { debugMode } = useDebugContext();
  const { running, paused } = useSimulationContext();
  const { handlePause, handleResume, handleStep, handleStepFrame } = useDebug();

  useEffect(() => {
    if (!debugMode) return undefined;
    const handler = (e) => {
      const el = e.target;
      if (TYPING.has(el?.tagName) || el?.isContentEditable) return;
      if (el?.closest?.(".monaco-editor, .blocklyDiv")) return;
      /* Both keys are gated on `running`, exactly like the toolbar buttons
         they mirror: stepping a dead runtime reaches no checkpoint, so the
         ack-timeout fallback would fire a second later and accuse a
         simulation that was never started of having no traced values. */
      if (!running) return;
      if (e.code === "Space") {
        e.preventDefault();
        (paused ? handleResume : handlePause)();
      } else if (e.code === "F10") {
        e.preventDefault();
        (e.shiftKey ? handleStep : handleStepFrame)();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [debugMode, running, paused, handlePause, handleResume, handleStep, handleStepFrame]);
}
