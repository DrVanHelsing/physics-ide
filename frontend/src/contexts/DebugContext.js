/**
 * DebugContext
 *
 * Owns all step-debugger state:
 *   - debugMode         — whether the debug overlay is visible
 *   - breakpoints       — Set<string> of block IDs / line keys with breakpoints
 *   - executingBlockId  — the block/line currently being highlighted
 *
 * A `breakpointsRef` mirror is provided so stable closures inside glowRunner
 * hooks can read the current breakpoints without capturing stale state.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { setBreakpoints as syncBreakpointsToIframe } from "../utils/runner/glowRunner";

const DebugContext = createContext(null);

export function DebugProvider({ children }) {
  const [debugMode,        setDebugMode]        = useState(false);
  const [breakpoints,      setBreakpoints]      = useState(() => new Set());
  const [executingBlockId, setExecutingBlockId] = useState(null);
  const [breakableIds,     setBreakableIds]     = useState(() => new Set());

  /* Mirror breakpoints in a ref so glowRunner callbacks never see stale data */
  const breakpointsRef = useRef(new Set());
  useEffect(() => {
    breakpointsRef.current = breakpoints;
    syncBreakpointsToIframe(breakpoints);
  }, [breakpoints]);

  /** A breakpoint on a non-breakable block would be accepted and never fire. */
  const isBreakable = (blockId) => breakableIds.has(blockId);

  /** Toggle a breakpoint by id. A breakpoint can never be SET where it cannot
   *  fire — removing one is always allowed, so an old project's stale
   *  breakpoints can still be cleared. */
  const toggleBreakpoint = (blockId) => {
    if (!blockId) return;
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else if (breakableIds.has(blockId)) next.add(blockId);
      return next;
    });
  };

  const value = {
    debugMode,        setDebugMode,
    breakpoints,      setBreakpoints,
    executingBlockId, setExecutingBlockId,
    breakableIds,     setBreakableIds,     isBreakable,
    breakpointsRef,
    toggleBreakpoint,
  };

  return (
    <DebugContext.Provider value={value}>
      {children}
    </DebugContext.Provider>
  );
}

/** Consume the DebugContext.  Must be used inside a DebugProvider. */
export function useDebugContext() {
  const ctx = useContext(DebugContext);
  if (!ctx) {
    throw new Error("useDebugContext must be used within a DebugProvider");
  }
  return ctx;
}

export default DebugContext;
