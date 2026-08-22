/**
 * useTrace
 *
 * Sets up the live-trace pipeline:
 *   1. Registers `window.__physide_trace_cb` so synchronous callers can
 *      post batched trace data into the React state.
 *   2. Attaches a `message` event listener to the main window that collects
 *      `__phtr` postMessages from the GlowScript iframe and debounces them
 *      into 50 ms batches before forwarding to the callback.
 *
 * Returns stable handlers for the TraceTable's recording controls.
 */
import { useCallback, useEffect, useRef } from "react";
import { pausePython } from "../utils/runner/glowRunner";
import { useTraceContext } from "../contexts/TraceContext";
import { useDebugContext }  from "../contexts/DebugContext";
import { useSimulationContext } from "../contexts/SimulationContext";
import { TRACE_DEBOUNCE_MS, HIGHLIGHT_DURATION_MS } from "../constants";

export function useTrace() {
  const {
    updateTrace,
    clearTrace,
    recording,
    setRecording,
    setIteration,
    recordBufferRef,
    recordingRef,
  } = useTraceContext();

  const { breakpointsRef, setPauseState, pauseStateRef, pauseAckTimerRef, setExecutingBlockId } =
    useDebugContext();
  const { workspaceRef, setPaused }             = useSimulationContext();

  const highlightTimerRef = useRef(null);

  /* ── Wire up the trace callback + postMessage listener ── */
  useEffect(() => {
    window.__physide_trace_cb = (batch) => {
      /* Recording — append timestamped rows to the buffer */
      if (recordingRef.current) {
        const t = Date.now();
        for (const [name, { v }] of Object.entries(batch)) {
          recordBufferRef.current.push({
            t, name, value: v, delta: null, min: null, max: null,
          });
        }
      }

      /* Auto-pause when a traced block ID matches a breakpoint */
      if (breakpointsRef.current.size > 0) {
        for (const { b } of Object.values(batch)) {
          if (b && breakpointsRef.current.has(b)) {
            pausePython();
            setPaused(true);
            break;
          }
        }
      }

      /* Merge new data into the trace Map */
      updateTrace(batch);

      /* Highlight the last traced block in the Blockly workspace */
      const entries = Object.entries(batch);
      if (entries.length > 0) {
        const lastBlockId = entries[entries.length - 1][1].b;
        setExecutingBlockId(lastBlockId);
        if (workspaceRef.current) {
          try { workspaceRef.current.highlightBlock(lastBlockId); } catch (_) {}
        }
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => {
          /* Do NOT clear while paused: trace events stop arriving when the
             runtime stops, so the highlight would vanish a quarter-second
             after the pause and leave the student stopped at nowhere. */
          if (pauseStateRef.current !== "running") return;
          setExecutingBlockId(null);
          try { workspaceRef.current?.highlightBlock(null); } catch (_) {}
        }, HIGHLIGHT_DURATION_MS);
      }
    };

    /* Debounced postMessage handler */
    let traceBatch = {};
    let traceTimer = null;
    const handleMessage = (event) => {
      if (event.data?.type === "__phpause") {
        if (event.data.paused) {
          setPauseState("paused");
          setPaused(true);
          if (pauseAckTimerRef.current) clearTimeout(pauseAckTimerRef.current);
        } else {
          setPauseState("running");
          setPaused(false);
        }
        if (typeof event.data.i === "number") setIteration(event.data.i);
        return;
      }
      if (event.data?.type === "__phtr") {
        if (typeof event.data.i === "number") setIteration(event.data.i);
        traceBatch[event.data.n] = { v: event.data.v, b: event.data.b || "", s: event.data.s || "loop" };
        if (!traceTimer) {
          traceTimer = setTimeout(() => {
            if (typeof window.__physide_trace_cb === "function") {
              window.__physide_trace_cb(traceBatch);
            }
            traceBatch = {};
            traceTimer = null;
          }, TRACE_DEBOUNCE_MS);
        }
      }
    };
    window.addEventListener("message", handleMessage);

    return () => {
      window.__physide_trace_cb = null;
      window.removeEventListener("message", handleMessage);
      if (traceTimer) clearTimeout(traceTimer);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // All referenced values come from stable refs or context setters.

  /* ── Recording controls ─────────────────────────────── */
  const handleStartRecord = useCallback(() => {
    recordBufferRef.current = [];
    recordingRef.current    = true;
    setRecording(true);
  }, [recordBufferRef, recordingRef, setRecording]);

  const handleStopRecord = useCallback(() => {
    recordingRef.current = false;
    setRecording(false);
  }, [recordingRef, setRecording]);

  return {
    recording,
    handleStartRecord,
    handleStopRecord,
    handleClearTrace: clearTrace,
    recordBuffer: recordBufferRef.current,
  };
}
