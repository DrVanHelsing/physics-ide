/**
 * useSimulation
 *
 * Composes the core simulation action-handlers (run, stop, import, mode
 * change, workspace callbacks, start-menu selection, etc.) from the three
 * contexts.  All handlers are memoised with useCallback.
 */
import { useCallback, useEffect, useRef } from "react";
import Blockly from "../utils/blockly/blocklyLib";
import {
  runPython,
  stopPython,
  setRuntimeErrorSink,
} from "../utils/runner/glowRunner";
import { describeRunError } from "../utils/runner/describeRunError";
import { generatePythonFromWorkspace } from "../utils/blockly/blocklyGenerator";
import { breakableIds as breakableIdsFromRegistry } from "../utils/blockly/traceRegistry";
import { useSimulationContext } from "../contexts/SimulationContext";
import { useDebugContext }      from "../contexts/DebugContext";
import { useTraceContext }      from "../contexts/TraceContext";
import { EXAMPLES }            from "../utils/precodedExamples";
import { BLOCK_TEMPLATES }     from "../utils/blockTemplates";
import { DEFAULT_PYTHON_CODE, GLOWSCRIPT_HOST_ID } from "../constants";

/**
 * Ends a run through every teardown path this IDE has — Stop, Reset to
 * blocks, Home, and (via useDebug, which reaches simulation state straight
 * from SimulationContext rather than through this hook) debug enter/exit.
 * Bumps the shared `runGenerationRef` (see SimulationContext) so a stale
 * in-flight handleRun's settle can no longer write into this session, stops
 * the runtime, and clears running/booting/paused together — the T16
 * generation guard is worthless if even one teardown path forgets a piece.
 *
 * `pauseState` is part of that reset. The runtime only posts a
 * `__phpause {paused:false}` when an already-paused checkpoint is RELEASED,
 * so nothing re-syncs it when the run simply ends: Stop while paused used to
 * leave "paused" latched, the toolbar's aria-live chip reading
 * "Paused · iteration N" over a dead simulation — and, worse, useTrace
 * refuses to clear the execution highlight while pauseStateRef is anything
 * but "running", so the yellow glow stuck too.
 *
 * A plain exported function, not a hook, so every call site shares this ONE
 * implementation instead of each reimplementing the same six lines.
 *
 * @param {{ runGenerationRef: {current:number}, setRunning: Function, setBooting: Function, setPaused: Function, setPauseState: Function, setStatus: Function }} ctx
 * @param {{ text: string, type: string }} [statusOverride] optional status to post in the same tick
 */
export function endRun(
  { runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus },
  statusOverride,
) {
  runGenerationRef.current += 1; // any in-flight handleRun is now stale
  stopPython(GLOWSCRIPT_HOST_ID);
  setRunning(false);
  setBooting(false);
  setPaused(false);
  setPauseState("running");
  if (statusOverride) setStatus(statusOverride);
}

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
    runGenerationRef,
  } = sim;

  const { debugMode, breakpointsRef, setBreakableIds, setPauseState } = useDebugContext();
  /* `watch` is armed by the trace panel's watch box (TraceContext) and reaches
     the runtime ONLY here — handleRun is the single place that hands opts to
     runPython, and the instrumentor can only see a watch expression when the
     source is re-instrumented at run time. Hence "press Run to see it". */
  const { setTraceData, watch } = useTraceContext();

  /* The generation of the last run that actually reached "confirmed live"
     (runPython resolved and was not superseded before it could) — written
     by handleRun's success path below. The sink compares this against the
     live runGenerationRef so a stale async error (from a run since
     superseded by a newer run, or torn down by Stop/Reset/Home) can never
     stomp whatever now owns the screen; only a report for the CURRENT
     confirmed generation is allowed through. */
  const confirmedGenerationRef = useRef(0);

  /* A rejection AFTER runPython resolves used to only console.error, leaving
     the status bar claiming "Simulation started" over a dead simulation.
     Same staleness discipline as handleRun's own catch (below): drop the
     report if the generation it would apply to is no longer the live one. */
  useEffect(() => {
    setRuntimeErrorSink((err) => {
      if (confirmedGenerationRef.current !== runGenerationRef.current) return;
      const d = describeRunError(err);
      setRunning(false);
      setStatus({ text: d.title, detail: d.detail, type: "error" });
    });
    return () => setRuntimeErrorSink(null);
  }, [setRunning, setStatus, runGenerationRef]);

  /* runGenerationRef (from SimulationContext) is bumped at the top of every
     handleRun/handleStop/handleResetToBlocks/handleHome call — and, via
     endRun below, by useDebug's enter/exit too. handleRun captures the value
     at its own start and re-checks it after every await: runPython's own
     activeRunToken guard only protects its internal DOM/iframe work and
     resolves a superseded call SILENTLY AS SUCCESS, so without this a slow,
     superseded run's `catch`/`finally` could still land after a newer run
     (or an explicit Stop/Reset/Home/debug-enter) already owns the screen —
     clearing `booting`/`running` out from under it and reopening the exact
     blank-rectangle window this state exists to close. */

  /* ── Generate Python from current Blockly workspace ──── */
  const syncFromBlocks = useCallback(() => {
    if (!workspaceRef.current) return pythonCode;
    if (workspaceRef.current.getAllBlocks(false).length === 0) return pythonCode;
    const generated = generatePythonFromWorkspace(workspaceRef.current);
    setBreakableIds(breakableIdsFromRegistry());
    const code = generated || DEFAULT_PYTHON_CODE;
    setPythonCode(code);
    return code;
  }, [pythonCode, setPythonCode, setBreakableIds, workspaceRef]);

  /* ── Run ─────────────────────────────────────────────── */
  const handleRun = useCallback(async () => {
    const generation = ++runGenerationRef.current;
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    setStatus({ text: "Starting simulation…", type: "" });
    setRunning(true);
    setBooting(true);
    setPaused(false);
    /* A fresh run always starts unpaused. Nothing else re-syncs pauseState:
       the runtime posts __phpause {paused:false} only when an already-paused
       checkpoint is RELEASED, so Run after a debug pause left the toolbar's
       aria-live chip reading "Paused · iteration N" while the simulation ran
       — and kept useTrace from ever clearing the execution highlight, since
       it bails while pauseStateRef.current !== "running". */
    setPauseState("running");
    setTraceData(new Map());
    try {
      stopPython(GLOWSCRIPT_HOST_ID);
      // Seeded BEFORE eval (glowRunner's executeCompiled), not re-armed after
      // — a breakpoint aimed at the FIRST iteration is the common case when
      // debugging initial conditions, and runPython's own resolve happens
      // 120 ms after __main__() has already started the loop. Only armed in
      // debug mode: useDebug's exit clears running/paused/recording but
      // deliberately keeps breakpoints (so re-entering debug mode finds
      // them), so a plain Run outside debug mode must not freeze on them.
      await runPython(code, GLOWSCRIPT_HOST_ID, {
        breakpoints: debugMode ? breakpointsRef.current : new Set(),
        // Watches are NOT debug-gated: "watch my numbers while I work" is a
        // plain-run gesture, and an empty array costs the instrumentor nothing.
        watch,
      });
      // A newer run (or an explicit Stop/Reset) has since bumped the
      // generation — this call is stale, so its "success" must not reopen
      // state a later action already owns.
      if (generation !== runGenerationRef.current) return;
      // Arm the async-error sink for this generation now that it has
      // genuinely reached "running" — see confirmedGenerationRef above.
      confirmedGenerationRef.current = generation;
      setStatus({
        text: debugMode ? "Debug simulation started" : "Simulation started",
        type: "success",
      });
    } catch (err) {
      const d = describeRunError(err);
      console.error("[PhysicsIDE]", d.raw);
      if (generation !== runGenerationRef.current) return;
      setRunning(false);
      setStatus({
        text: d.line ? `${d.title} (line ${d.line})` : d.title,
        detail: d.detail,
        type: "error",
      });
    } finally {
      if (generation === runGenerationRef.current) setBooting(false);
    }
  }, [mode, pythonCode, syncFromBlocks, debugMode, breakpointsRef, watch, setRunning, setBooting, setPaused, setPauseState, setStatus, setTraceData]);

  /* ── Stop ────────────────────────────────────────────── */
  const handleStop = useCallback(() => {
    endRun(
      { runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus },
      { text: "Simulation stopped", type: "" },
    );
  }, [runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus]);

  /* ── Reset to blocks mode ────────────────────────────── */
  const handleResetToBlocks = useCallback(() => {
    endRun({ runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus });
    setMode("blocks");
    if (workspaceRef.current) {
      const code = generatePythonFromWorkspace(workspaceRef.current);
      setPythonCode(code || DEFAULT_PYTHON_CODE);
    }
    setStatus({ text: "Reset to blocks mode", type: "" });
  }, [runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setMode, setPythonCode, setStatus, workspaceRef]);

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
      endRun({ runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus });
      setProjectType("block_template");
      setWorkspaceXml(xml || "");
      setMode("blocks");
    },
    [runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus, setProjectType, setWorkspaceXml, setMode]
  );

  /* ── Home (back to start menu) ───────────────────────── */
  const handleHome = useCallback(() => {
    setShowStart(true);
    endRun({ runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus }, { text: "Ready", type: "" });
  }, [setShowStart, runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus]);

  /* ── Import .py / .xml file ──────────────────────────── */
  const handleImport = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        if (file.name.endsWith(".xml")) {
          endRun({ runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus });
          setProjectType("custom");
          if (workspaceRef.current) {
            try {
              workspaceRef.current.clear();
              const dom = Blockly.utils.xml.textToDom(content);
              Blockly.Xml.domToWorkspace(dom, workspaceRef.current);
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
          endRun({ runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setStatus });
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
      runGenerationRef, setRunning, setBooting, setPaused, setPauseState, setProjectType, setWorkspaceXml,
      setMode, setPythonCode, setStatus, workspaceRef,
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
