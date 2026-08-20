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
  useRef,
  useState,
  useEffect,
} from "react";
import { loadState, saveState } from "../utils/storage";
import { AUTOSAVE_INTERVAL_MS, DEFAULT_PYTHON_CODE, ZOOM_DEFAULT, SPLIT_DEFAULT } from "../constants";
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

  /* ── UI preferences (persisted — hooks/useLocalStorage) ── */
  const [storedZoom,   setBlocklyZoom]    = useLocalStorage(LAYOUT_ZOOM_KEY, ZOOM_DEFAULT);
  const [storedSplit,  setSplitPct]       = useLocalStorage(LAYOUT_SPLIT_KEY, SPLIT_DEFAULT);
  const [viewportHidden, setViewportHidden] = useLocalStorage(LAYOUT_VIEWPORT_HIDDEN_KEY, false);
  const blocklyZoom = clampZoom(storedZoom);
  const splitPct    = clampSplit(storedSplit);

  /* ── Live Blockly workspace reference ────────────────── */
  const workspaceRef = useRef(null);

  /* ── Auto-save (every 2 s) ───────────────────────────── */
  const stateRef = useRef({ mode, pythonCode, workspaceXml });
  stateRef.current = { mode, pythonCode, workspaceXml };
  useEffect(() => {
    const id = window.setInterval(() => saveState(stateRef.current), AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Restore persisted state on first mount ──────────── */
  useEffect(() => {
    const saved = loadState();
    if (!saved) return;
    if (saved.mode === "blocks" || saved.mode === "text") setMode(saved.mode);
    if (typeof saved.pythonCode === "string" && saved.pythonCode.length > 0) {
      setPythonCode(saved.pythonCode);
    }
    if (typeof saved.workspaceXml === "string") {
      setWorkspaceXml(saved.workspaceXml);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
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
    paused,  setPaused,
    status,  setStatus,
    /* UI prefs */
    blocklyZoom,    setBlocklyZoom,
    splitPct,       setSplitPct,
    viewportHidden, setViewportHidden,
    /* stable workspace ref */
    workspaceRef,
  };

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
