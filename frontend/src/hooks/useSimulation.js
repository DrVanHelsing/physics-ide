/**
 * useSimulation
 *
 * Composes the core simulation action-handlers (run, stop, import, mode
 * change, workspace callbacks, start-menu selection, etc.) from the three
 * contexts.  All handlers are memoised with useCallback.
 */
import { useCallback, useRef } from "react";
import {
  runPython,
  stopPython,
  setBreakpoints as syncBreakpointsToIframe,
} from "../utils/runner/glowRunner";
import { generatePythonFromWorkspace } from "../utils/blockly/blocklyGenerator";
import { useSimulationContext } from "../contexts/SimulationContext";
import { useDebugContext }      from "../contexts/DebugContext";
import { useTraceContext }      from "../contexts/TraceContext";
import { EXAMPLES }            from "../utils/precodedExamples";
import { BLOCK_TEMPLATES }     from "../utils/blockTemplates";
import { DEFAULT_PYTHON_CODE, GLOWSCRIPT_HOST_ID } from "../constants";

export function useSimulation() {
  const sim = useSimulationContext();
  const {
    mode, setMode,
    projectType, setProjectType,
    pythonCode, setPythonCode,
    workspaceXml, setWorkspaceXml,
    running, setRunning,
    booting, setBooting,
    setPaused,
    setStatus,
    workspaceRef,
    setShowStart,
    blocklyZoom, setBlocklyZoom,
    setViewportHidden,
    viewportHidden,
  } = sim;

  const { debugMode, breakpointsRef } = useDebugContext();
  const { setTraceData } = useTraceContext();

  /* Bumped at the top of every handleRun/handleStop/handleResetToBlocks call.
     handleRun captures the value at its own start and re-checks it after
     every await: runPython's own activeRunToken guard only protects its
     internal DOM/iframe work and resolves a superseded call SILENTLY AS
     SUCCESS, so without this a slow, superseded run's `catch`/`finally`
     could still land after a newer run (or an explicit Stop) already owns
     the screen — clearing `booting`/`running` out from under it and
     reopening the exact blank-rectangle window this state exists to close. */
  const runGenerationRef = useRef(0);

  /* ── Generate Python from current Blockly workspace ──── */
  const syncFromBlocks = useCallback(() => {
    if (!workspaceRef.current) return pythonCode;
    if (workspaceRef.current.getAllBlocks(false).length === 0) return pythonCode;
    const generated = generatePythonFromWorkspace(workspaceRef.current);
    const code = generated || DEFAULT_PYTHON_CODE;
    setPythonCode(code);
    return code;
  }, [pythonCode, setPythonCode, workspaceRef]);

  /* ── Run ─────────────────────────────────────────────── */
  const handleRun = useCallback(async () => {
    const generation = ++runGenerationRef.current;
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    setStatus({ text: "Starting simulation…", type: "" });
    setRunning(true);
    setBooting(true);
    setPaused(false);
    setTraceData(new Map());
    try {
      stopPython(GLOWSCRIPT_HOST_ID);
      await runPython(code, GLOWSCRIPT_HOST_ID);
      // A newer run (or an explicit Stop/Reset) has since bumped the
      // generation — this call is stale, so its "success" must not reopen
      // state a later action already owns.
      if (generation !== runGenerationRef.current) return;
      syncBreakpointsToIframe(breakpointsRef.current);
      setStatus({
        text: debugMode ? "Debug simulation started" : "Simulation started",
        type: "success",
      });
    } catch (err) {
      console.error(err);
      if (generation !== runGenerationRef.current) return;
      setRunning(false);
      setStatus({ text: err.message || "Runtime error", type: "error" });
    } finally {
      if (generation === runGenerationRef.current) setBooting(false);
    }
  }, [mode, pythonCode, syncFromBlocks, debugMode, breakpointsRef, setRunning, setBooting, setPaused, setStatus, setTraceData]);

  /* ── Stop ────────────────────────────────────────────── */
  const handleStop = useCallback(() => {
    runGenerationRef.current += 1; // any in-flight handleRun is now stale
    stopPython(GLOWSCRIPT_HOST_ID);
    setRunning(false);
    setBooting(false);
    setStatus({ text: "Simulation stopped", type: "" });
  }, [setRunning, setBooting, setStatus]);

  /* ── Reset to blocks mode ────────────────────────────── */
  const handleResetToBlocks = useCallback(() => {
    runGenerationRef.current += 1; // any in-flight handleRun is now stale
    stopPython(GLOWSCRIPT_HOST_ID);
    setRunning(false);
    setBooting(false);
    setMode("blocks");
    if (workspaceRef.current) {
      const code = generatePythonFromWorkspace(workspaceRef.current);
      setPythonCode(code || DEFAULT_PYTHON_CODE);
    }
    setStatus({ text: "Reset to blocks mode", type: "" });
  }, [setRunning, setBooting, setMode, setPythonCode, setStatus, workspaceRef]);

  /* ── Mode toggle ─────────────────────────────────────── */
  const handleModeChange = useCallback(
    (nextMode) => {
      if (nextMode === mode) return;
      if (mode === "blocks" && nextMode === "text") {
        if (workspaceRef.current?.getAllBlocks(false).length > 0) syncFromBlocks();
        setMode("text");
        setStatus({
          text: projectType === "custom" ? "Switched to Code View Only" : "Switched to Code editor",
          type: "",
        });
        return;
      }
      setMode("blocks");
      setStatus({ text: "Switched to Blocks editor", type: "" });
    },
    [mode, projectType, syncFromBlocks, setMode, setStatus, workspaceRef]
  );

  /* ── Zoom ────────────────────────────────────────────── */
  const handleZoomChange = useCallback(
    (pct) => {
      setBlocklyZoom(pct);
      const ws = workspaceRef.current;
      if (ws) {
        ws.setScale(pct / 100);
        ws.resize();
      }
    },
    [setBlocklyZoom, workspaceRef]
  );

  /* ── Blockly workspace callbacks ─────────────────────── */
  const handleWorkspaceReady = useCallback(
    (ws) => { workspaceRef.current = ws; },
    [workspaceRef]
  );

  const handleWorkspaceChange = useCallback(
    (xml, code) => {
      setWorkspaceXml(xml);
      if (mode === "blocks" && code && code.trim().length > 0) {
        setPythonCode(code);
      }
    },
    [mode, setWorkspaceXml, setPythonCode]
  );

  /* ── Template helpers ────────────────────────────────── */
  const findBlockTemplateByCodeId = useCallback((codeId) => {
    const map = {
      projectile: "blocks_projectile",
      spring:     "blocks_spring",
      orbits:     "blocks_orbits",
      pendulum:   "blocks_pendulum",
    };
    return BLOCK_TEMPLATES.find((t) => t.id === map[codeId]) || null;
  }, []);

  const findCodeTemplateByBlockId = useCallback((blockId) => {
    const map = {
      blocks_projectile: "projectile",
      blocks_spring:     "spring",
      blocks_orbits:     "orbits",
      blocks_pendulum:   "pendulum",
    };
    return EXAMPLES.find((t) => t.id === map[blockId]) || null;
  }, []);

  /* ── Start-menu selection ────────────────────────────── */
  const handleStartSelect = useCallback(
    (selection) => {
      if (!selection || selection.type === "blank" || selection.type === "blocks_blank") {
        setProjectType("custom"); setMode("blocks");
        setPythonCode(DEFAULT_PYTHON_CODE); setWorkspaceXml("");
      } else if (selection.type === "code_blank") {
        setProjectType("code_blank"); setMode("text");
        setPythonCode(DEFAULT_PYTHON_CODE); setWorkspaceXml("");
      } else if (selection.type === "code") {
        setProjectType("code_template");
        setPythonCode(selection.code || DEFAULT_PYTHON_CODE);
        const bt = findBlockTemplateByCodeId(selection.id);
        setWorkspaceXml(bt ? bt.xml : "");
        setMode("text");
      } else if (selection.type === "blocks") {
        setProjectType("block_template");
        setWorkspaceXml(selection.xml || "");
        const ct = findCodeTemplateByBlockId(selection.id);
        setPythonCode(ct?.code || DEFAULT_PYTHON_CODE);
        setMode("blocks");
      }
      setShowStart(false);
    },
    [
      setProjectType, setMode, setPythonCode, setWorkspaceXml, setShowStart,
      findBlockTemplateByCodeId, findCodeTemplateByBlockId,
    ]
  );

  /* ── Load a template XML into the live workspace ──────────
     Used by the hybrid "Analyse this run →" loop closure: swaps the
     current blocks for the paired analysis template. Driven through
     context state; IDELayout remounts the Blockly workspace so the new
     XML loads as `initialXml`. */
  const loadWorkspaceXml = useCallback(
    (xml) => {
      stopPython(GLOWSCRIPT_HOST_ID);
      setRunning(false);
      setProjectType("block_template");
      setWorkspaceXml(xml || "");
      setMode("blocks");
    },
    [setRunning, setProjectType, setWorkspaceXml, setMode]
  );

  /* ── Home (back to start menu) ───────────────────────── */
  const handleHome = useCallback(() => {
    setShowStart(true);
    setRunning(false);
    stopPython(GLOWSCRIPT_HOST_ID);
    setStatus({ text: "Ready", type: "" });
  }, [setShowStart, setRunning, setStatus]);

  /* ── Import .py / .xml file ──────────────────────────── */
  const handleImport = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        if (file.name.endsWith(".xml")) {
          stopPython(GLOWSCRIPT_HOST_ID);
          setRunning(false);
          setProjectType("custom");
          if (workspaceRef.current && window.Blockly) {
            try {
              workspaceRef.current.clear();
              const dom = window.Blockly.utils.xml.textToDom(content);
              window.Blockly.Xml.domToWorkspace(dom, workspaceRef.current);
              const newCode = generatePythonFromWorkspace(workspaceRef.current);
              setPythonCode(newCode || DEFAULT_PYTHON_CODE);
            } catch (err) {
              console.warn("Direct XML load failed:", err);
            }
          }
          setWorkspaceXml(content);
          setMode("blocks");
          setStatus({ text: `Imported blocks from ${file.name}`, type: "success" });
        } else if (file.name.endsWith(".py")) {
          stopPython(GLOWSCRIPT_HOST_ID);
          setRunning(false);
          setPythonCode(content);
          setMode("text");
          setProjectType("code_blank");
          setStatus({ text: `Imported Python from ${file.name}`, type: "success" });
        } else {
          setStatus({ text: "Unsupported file type. Use .py or .xml", type: "error" });
        }
      };
      reader.onerror = () => setStatus({ text: "Failed to read file", type: "error" });
      reader.readAsText(file);
    },
    [
      setRunning, setProjectType, setWorkspaceXml, setMode, setPythonCode,
      setStatus, workspaceRef,
    ]
  );

  /* ── Clear all blocks ────────────────────────────────── */
  const handleClearWorkspace = useCallback(async () => {
    if (!workspaceRef.current) return;
    const { confirm } = await import("../utils/export/dialogService");
    const ok = await confirm("Clear all blocks from the workspace? This cannot be undone.");
    if (!ok) return;
    workspaceRef.current.clear();
    setPythonCode(DEFAULT_PYTHON_CODE);
    setStatus({ text: "Workspace cleared", type: "" });
  }, [workspaceRef, setPythonCode, setStatus]);

  return {
    /* state (read) */
    mode, pythonCode, workspaceXml, projectType,
    running, booting, blocklyZoom, viewportHidden,
    workspaceRef,
    /* handlers */
    handleRun,
    handleStop,
    handleResetToBlocks,
    handleModeChange,
    handleZoomChange,
    handleWorkspaceReady,
    handleWorkspaceChange,
    handleStartSelect,
    handleHome,
    handleImport,
    handleClearWorkspace,
    loadWorkspaceXml,
    syncFromBlocks,
    /* toggling UI prefs */
    handleToggleViewport:      useCallback(() => setViewportHidden((h) => !h), [setViewportHidden]),
  };
}
