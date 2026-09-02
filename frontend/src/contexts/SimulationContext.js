/**
 * SimulationContext
 *
 * Owns the core IDE state:
 *   - editor mode, Python source, workspace XML, project type
 *   - running / paused flags, status bar message
 *   - UI preferences (zoom, split, viewport visibility, beginner mode)
 *   - showStart / showHelp routing flags
 *   - workspaceRef — a stable ref to the live Blockly workspace instance
 *
 * All mutation handlers (run, stop, export, import, …) live in the custom
 * hooks (useSimulation, useExport, etc.) which consume this context.
 */
import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_PYTHON_CODE, ZOOM_DEFAULT, SPLIT_DEFAULT } from "../constants";
import useLocalStorage from "../hooks/useLocalStorage";
import { clampSplit, clampZoom } from "../utils/layoutPrefs";
import {
  LAYOUT_SPLIT_KEY, LAYOUT_VIEWPORT_HIDDEN_KEY, LAYOUT_ZOOM_KEY,
} from "../constants";

const SimulationContext = createContext(null);

export function SimulationProvider({ children }) {
  /* ── Routing ─────────────────────────────────────────── */
  const [showStart, setShowStart] = useState(true);
  const [showHelp,  setShowHelp]  = useState(false);

  /* ── Editor state ────────────────────────────────────── */
  const [mode,         setMode]         = useState("blocks");
  const [projectType,  setProjectType]  = useState("custom");
  const [pythonCode,   setPythonCode]   = useState(DEFAULT_PYTHON_CODE);
  const [workspaceXml, setWorkspaceXml] = useState("");

  /* ── Simulation flags ────────────────────────────────── */
  const [running, setRunning] = useState(false);
  const [paused,  setPaused]  = useState(false);
  const [status,  setStatus]  = useState({ text: "Ready", type: "" });
  /* True from the moment Run is pressed until the runtime has loaded and
     compiled. `running` flips immediately (the UI must disable Run), so
     without this there is no state that means "asked, not yet drawing". */
  const [booting, setBooting] = useState(false);

  /* ── UI preferences (persisted — hooks/useLocalStorage) ── */
  const [storedZoom,   setBlocklyZoom]    = useLocalStorage(LAYOUT_ZOOM_KEY, ZOOM_DEFAULT);
  const [storedSplit,  setSplitPct]       = useLocalStorage(LAYOUT_SPLIT_KEY, SPLIT_DEFAULT);
  const [viewportHidden, setViewportHidden] = useLocalStorage(LAYOUT_VIEWPORT_HIDDEN_KEY, false);
  const blocklyZoom = clampZoom(storedZoom);
  const splitPct    = clampSplit(storedSplit);

  /* ── Live Blockly workspace reference ────────────────── */
  const workspaceRef = useRef(null);

  /* Bumped by every teardown path (Stop, Reset, Home, debug enter/exit — see
     useSimulation's endRun) so a stale in-flight run's settle can tell it no
     longer owns the screen. Lives here, not inside useSimulation, so useDebug
     — which reaches simulation state straight from this context rather than
     through that hook — shares the exact same counter instead of bumping a
     separate one. */
  const runGenerationRef = useRef(0);

  /* The v1-era localStorage autosave/restore that used to live here is
     GONE (guest-entry root cause, 2026-09-02): it wrote the working state
     to the legacy `physics-lab-state-v1` key every 2 s — even while the
     start menu was up — and ProjectContext's bootstrap then "migrated"
     that self-made blob into a phantom "Recovered project" that skipped
     the menu on the next visit. The manifest layer owns persistence;
     the legacy key is now read once at bootstrap (true v1 users) and
     deleted on adoption. */

  /* Every consumer reads this object identity on every render (React context
     has no selector mechanism), so a fresh literal here would invalidate every
     consumer on every SimulationProvider re-render regardless of which state
     actually changed. Memoised on every state value the object carries — the
     refs (workspaceRef, runGenerationRef) are stable across the provider's
     lifetime and stay out of the dep list; the useState/useLocalStorage
     setters are stable too, but are omitted from the deps (kept to exactly
     the state values) for clarity — the object literal below still returns
     them, unaffected either way. */
  const value = useMemo(
    () => ({
      /* routing */
      showStart, setShowStart,
      showHelp,  setShowHelp,
      /* editor */
      mode,         setMode,
      projectType,  setProjectType,
      pythonCode,   setPythonCode,
      workspaceXml, setWorkspaceXml,
      /* simulation */
      running, setRunning,
      booting, setBooting,
      paused,  setPaused,
      status,  setStatus,
      /* UI prefs */
      blocklyZoom,    setBlocklyZoom,
      splitPct,       setSplitPct,
      viewportHidden, setViewportHidden,
      /* stable workspace ref */
      workspaceRef,
      /* shared run-teardown generation counter (see useSimulation's endRun) */
      runGenerationRef,
    }),
    [
      showStart, showHelp,
      mode, projectType, pythonCode, workspaceXml,
      running, booting, paused, status,
      blocklyZoom, splitPct, viewportHidden,
    ],
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

/** Consume the SimulationContext.  Must be used inside a SimulationProvider. */
export function useSimulationContext() {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useSimulationContext must be used within a SimulationProvider");
  }
  return ctx;
}

export default SimulationContext;
