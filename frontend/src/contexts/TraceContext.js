/**
 * TraceContext
 *
 * Owns live-telemetry state for the Trace Table:
 *   - traceData     — Map<name, TraceEntry> updated on every postMessage batch
 *   - recording     — whether the record buffer is actively capturing rows
 *   - iteration     — the runtime's rate()-call counter (__physide_iter),
 *                      mirrored from __phtr / __phpause messages
 *   - recordBufferRef — mutable buffer of timestamped rows (not React state
 *                       to avoid re-renders on every data point)
 *   - recordingRef  — mirror of `recording` for stable closure access
 *
 * The trace-message listener (postMessage → window.__physide_trace_cb) lives
 * in `useTrace` so it can access both TraceContext AND DebugContext together.
 */
import React, {
  createContext,
  useContext,
  useRef,
  useState,
} from "react";
import { TRACE_HISTORY_SIZE } from "../constants";

const TraceContext = createContext(null);

export function TraceProvider({ children }) {
  const [traceData, setTraceData] = useState(() => new Map());
  const [recording, setRecording] = useState(false);
  /** rate()-call counter mirrored from the runtime's __physide_iter — the
   *  "frame N" readout for both __phtr and __phpause messages. */
  const [iteration, setIteration] = useState(0);

  const recordBufferRef = useRef([]);
  const recordingRef    = useRef(false);

  /* Keep recordingRef in sync with state (for stable closures in trace cb) */
  recordingRef.current = recording;

  /**
   * Merge a batch of trace entries (name → {v, b}) into the traceData Map.
   * Each entry accumulates: value, blockId, delta, min, max, rolling history.
   */
  const updateTrace = (batch) => {
    setTraceData((prev) => {
      const next = new Map(prev);
      for (const [name, { v, b }] of Object.entries(batch)) {
        const existing = prev.get(name);
        const prevVal  = existing?.value;
        const numV     = parseFloat(v);
        const numPrev  = parseFloat(prevVal);
        const isNum    = !isNaN(numV);

        const delta =
          isNum && existing && !isNaN(numPrev)
            ? parseFloat((numV - numPrev).toFixed(6))
            : null;

        const prevMin = existing?.min;
        const prevMax = existing?.max;
        const newMin  = isNum
          ? prevMin == null ? numV : Math.min(prevMin, numV)
          : null;
        const newMax  = isNum
          ? prevMax == null ? numV : Math.max(prevMax, numV)
          : null;

        const prevHistory = existing?.history || [];
        const history = isNum
          ? [...prevHistory.slice(-(TRACE_HISTORY_SIZE - 1)), v]
          : prevHistory;

        next.set(name, {
          value:    v,
          blockId:  b,
          count:    (existing?.count || 0) + 1,
          flashKey: (existing?.flashKey || 0) + 1,
          delta,
          min:     newMin,
          max:     newMax,
          history,
        });
      }
      return next;
    });
  };

  const clearTrace = () => setTraceData(new Map());

  const value = {
    traceData, setTraceData,
    recording, setRecording,
    iteration, setIteration,
    recordBufferRef,
    recordingRef,
    updateTrace,
    clearTrace,
  };

  return (
    <TraceContext.Provider value={value}>
      {children}
    </TraceContext.Provider>
  );
}

/** Consume the TraceContext.  Must be used inside a TraceProvider. */
export function useTraceContext() {
  const ctx = useContext(TraceContext);
  if (!ctx) {
    throw new Error("useTraceContext must be used within a TraceProvider");
  }
  return ctx;
}

export default TraceContext;
