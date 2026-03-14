import React, { useCallback, useEffect, useRef, useState } from "react";
import BlocklyWorkspace from "./components/BlocklyWorkspace";
import { ReadOnlyBlockly } from "./components/BlocklyWorkspace";
import CodeEditor from "./components/CodeEditor";
import GlowCanvas from "./components/GlowCanvas";
import Toolbar from "./components/Toolbar";
import ModeToggle from "./components/ModeToggle";
import StartMenu from "./components/StartMenu";
import HelpPage from "./components/HelpPage";
import VariableDialog from "./components/VariableDialog";
import { BlocksIcon, CodeIcon, GlobeIcon } from "./components/Icons";
import { useTheme } from "./ThemeContext";
import { generatePythonFromWorkspace } from "./utils/blocklyGenerator";
import { exportBlocks, exportPython } from "./utils/exportUtils";
import * as dialogService from "./utils/dialogService";
import { exportBlocksPdf, exportCodePdf } from "./utils/pdfExport";
import { runPython, stopPython, pausePython, resumePython, stepPython, setBreakpoints as syncBreakpointsToIframe } from "./utils/glowRunner";
import DebugMode from "./components/DebugMode";
import { loadState, saveState } from "./utils/storage";
import { EXAMPLES } from "./utils/precodedExamples";
import { BLOCK_TEMPLATES } from "./utils/blockTemplates";
import html2canvas from "html2canvas";

const DEFAULT_CODE = "# Build your model in blocks, or write VPython here.\n";

function App() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const workspaceRef = useRef(null);
  const [showStart, setShowStart] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [mode, setMode] = useState("blocks");
  const [projectType, setProjectType] = useState("custom");
  const [pythonCode, setPythonCode] = useState(DEFAULT_CODE);
  const [workspaceXml, setWorkspaceXml] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState({ text: "Ready", type: "" });
  const [blocklyZoom, setBlocklyZoom] = useState(90); // percentage (startScale 0.9 = 90%)
  const [splitPct, setSplitPct] = useState(50);           // editor panel width %
  const [viewportHidden, setViewportHidden] = useState(false); // hide 3D viewport panel
  const [beginnerMode, setBeginnerMode] = useState(false);  // simplified toolbox
  const [traceData, setTraceData] = useState(() => new Map()); // Map<name,{value,blockId,count,flashKey}>
  const [debugMode, setDebugMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [breakpoints, setBreakpoints] = useState(() => new Set());
  const [executingBlockId, setExecutingBlockId] = useState(null);
  const recordBufferRef = useRef([]);
  const recordingRef   = useRef(false);
  const breakpointsRef = useRef(new Set());
  const highlightTimerRef = useRef(null);

  // Keep refs in sync with state for use inside stable closures
  useEffect(() => {
    breakpointsRef.current = breakpoints;
    syncBreakpointsToIframe(breakpoints);
  }, [breakpoints]);

  const handleHelp = useCallback(() => setShowHelp(true), []);

  /* ── Trace callback — registered on window so glowRunner iframe can call it ── */
  useEffect(() => {
    window.__physide_trace_cb = (batch) => {
      // When recording, buffer the timestamped rows
      if (recordingRef.current) {
        const t = Date.now();
        for (const [name, { v }] of Object.entries(batch)) {
          recordBufferRef.current.push({ t, name, value: v, delta: null, min: null, max: null });
        }
      }

      // Check breakpoints — auto-pause when a traced block ID matches
      if (breakpointsRef.current.size > 0) {
        for (const { b } of Object.values(batch)) {
          if (b && breakpointsRef.current.has(b)) {
            pausePython();
            setPaused(true);
            break;
          }
        }
      }

      setTraceData((prev) => {
        const next = new Map(prev);
        for (const [name, { v, b }] of Object.entries(batch)) {
          const existing = prev.get(name);
          const prevVal  = existing?.value;
          const numV     = parseFloat(v);
          const numPrev  = parseFloat(prevVal);
          const isNum    = !isNaN(numV);

          // Delta: difference from previous numeric value
          const delta = (isNum && existing && !isNaN(numPrev))
            ? parseFloat((numV - numPrev).toFixed(6))
            : null;

          // Min / max tracking
          const prevMin = existing?.min;
          const prevMax = existing?.max;
          const newMin  = isNum ? (prevMin === null || prevMin === undefined ? numV : Math.min(prevMin, numV)) : null;
          const newMax  = isNum ? (prevMax === null || prevMax === undefined ? numV : Math.max(prevMax, numV)) : null;

          // Rolling history (last 60 values, numeric only)
          const prevHistory = existing?.history || [];
          const history = isNum
            ? [...prevHistory.slice(-59), v]
            : prevHistory;

          next.set(name, {
            value:    v,
            blockId:  b,
            count:    (existing?.count || 0) + 1,
            flashKey: (existing?.flashKey || 0) + 1,
            delta,
            min:      newMin,
            max:      newMax,
            history,
          });
        }
        return next;
      });
      // Highlight the last traced block in the Blockly workspace
      const entries = Object.entries(batch);
      if (entries.length > 0) {
        const lastBlockId = entries[entries.length - 1][1].b;
        setExecutingBlockId(lastBlockId);
        if (workspaceRef.current) {
          try { workspaceRef.current.highlightBlock(lastBlockId); } catch (_) {}
        }
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => {
          setExecutingBlockId(null);
          try { workspaceRef.current?.highlightBlock(null); } catch (_) {}
        }, 250);
      }
    };

    /* ── Listen for postMessage trace data from the GlowScript iframe ── */
    let traceBatch = {};
    let traceTimer = null;
    const handleTraceMessage = (event) => {
      if (event.data && event.data.type === '__phtr') {
        traceBatch[event.data.n] = { v: event.data.v, b: event.data.b || '' };
        if (!traceTimer) {
          traceTimer = setTimeout(() => {
            if (typeof window.__physide_trace_cb === 'function') {
              window.__physide_trace_cb(traceBatch);
            }
            traceBatch = {};
            traceTimer = null;
          }, 50);
        }
      }
    };
    window.addEventListener('message', handleTraceMessage);

    return () => {
      window.__physide_trace_cb = null;
      window.removeEventListener('message', handleTraceMessage);
      if (traceTimer) clearTimeout(traceTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setTraceData and workspaceRef are both stable

  const findBlockTemplateByCodeId = useCallback((codeId) => {
    const idToBlockTemplate = {
      projectile: "blocks_projectile",
      spring:     "blocks_spring",
      orbits:     "blocks_orbits",
      pendulum:   "blocks_pendulum",
    };
    const blockId = idToBlockTemplate[codeId];
    return BLOCK_TEMPLATES.find((tpl) => tpl.id === blockId) || null;
  }, []);

  const findCodeTemplateByBlockId = useCallback((blockId) => {
    const blockToCodeId = {
      blocks_projectile: "projectile",
      blocks_spring:     "spring",
      blocks_orbits:     "orbits",
      blocks_pendulum:   "pendulum",
    };
    const codeId = blockToCodeId[blockId];
    return EXAMPLES.find((tpl) => tpl.id === codeId) || null;
  }, []);

  /* ── Restore persisted state on first mount ────────────── */
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
  }, []);

  /* ── Auto-save every 2 s ───────────────────────────────── */
  const stateRef = useRef({ mode, pythonCode, workspaceXml });
  stateRef.current = { mode, pythonCode, workspaceXml };

  useEffect(() => {
    const id = window.setInterval(() => saveState(stateRef.current), 2000);
    return () => window.clearInterval(id);
  }, []);

  /* ── Generate Python from the current Blockly workspace ── */
  const syncFromBlocks = useCallback(() => {
    if (!workspaceRef.current) return pythonCode;
    if (workspaceRef.current.getAllBlocks(false).length === 0) {
      return pythonCode;
    }
    const generated = generatePythonFromWorkspace(workspaceRef.current);
    const code = generated || DEFAULT_CODE;
    setPythonCode(code);
    return code;
  }, [pythonCode]);

  /* ── Toolbar handlers ──────────────────────────────────── */
  const handleRun = useCallback(async () => {
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    setStatus({ text: "Running...", type: "" });
    setRunning(true);
    setPaused(false);
    setTraceData(new Map()); // Clear trace from previous run
    try {
      stopPython("glowscript-host");
      await runPython(code, "glowscript-host");
      /* Sync any pre-set breakpoints to the newly created iframe (the iframe
         resets __physide_breakpoints to an empty Set on each run).          */
      syncBreakpointsToIframe(breakpointsRef.current);
      setStatus({ text: debugMode ? "Debug simulation started" : "Simulation started", type: "success" });
    } catch (err) {
      console.error(err);
      setRunning(false);
      setStatus({ text: err.message || "Runtime error", type: "error" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pythonCode, syncFromBlocks, debugMode]);

  const handleStop = useCallback(() => {
    stopPython("glowscript-host");
    setRunning(false);
    setExecutingBlockId(null);
    setStatus({ text: "Simulation stopped", type: "" });
  }, []);

  /* ── Resolve export filename: from sim_start_block, code comment, or prompt ── */
  const getExportName = useCallback(async () => {
    // 1. Try sim_start_block TITLE in the live workspace
    if (workspaceRef.current) {
      try {
        const blocks = workspaceRef.current.getAllBlocks(false);
        const startBlock = blocks.find((b) => b.type === "sim_start_block");
        if (startBlock) {
          const title = startBlock.getFieldValue("TITLE");
          if (title && title.trim() && title.trim() !== "My Simulation") {
            // eslint-disable-next-line no-control-regex
            return title.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, "_");
          }
        }
      } catch (_) {}
    }
    // 2. Try parsing from pythonCode comment
    const codeMatch = pythonCode.match(/# === Simulation Start:\s*(.+?)\s*===/);
    if (codeMatch && codeMatch[1] && codeMatch[1] !== "My Simulation") {
      // eslint-disable-next-line no-control-regex
      return codeMatch[1].trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, "_");
    }
    // 3. Prompt the user
    return dialogService.promptFileName("Name this file:", "simulation");
  }, [pythonCode]);

  const handleExportPy = useCallback(async () => {
    const name = await getExportName();
    if (!name) return;
    exportPython(mode, pythonCode, workspaceRef.current, name);
    setStatus({ text: `Exported ${name}.py`, type: "success" });
  }, [mode, pythonCode, getExportName]);

  const handleExportBlocks = useCallback(async () => {
    const name = await getExportName();
    if (!name) return;
    exportBlocks(workspaceRef.current, name);
    setStatus({ text: `Exported ${name}.xml`, type: "success" });
  }, [getExportName]);

  const handleExportBlocksPdf = useCallback(async () => {
    const name = await getExportName();
    if (!name) return;
    setStatus({ text: "Generating blocks PDF...", type: "" });
    try {
      await exportBlocksPdf(workspaceRef.current, name);
      setStatus({ text: `Blocks PDF saved as ${name}.pdf`, type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: err.message || "PDF export failed", type: "error" });
    }
  }, [getExportName]);

  const handleExportCodePdf = useCallback(async () => {
    const name = await getExportName();
    if (!name) return;
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    setStatus({ text: "Generating code PDF...", type: "" });
    try {
      await exportCodePdf(code, name);
      setStatus({ text: `Code PDF saved as ${name}.pdf`, type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: err.message || "PDF export failed", type: "error" });
    }
  }, [mode, pythonCode, syncFromBlocks, getExportName]);

  const handleResetToBlocks = useCallback(() => {
    stopPython("glowscript-host");
    setRunning(false);
    setMode("blocks");
    if (workspaceRef.current) {
      const code = generatePythonFromWorkspace(workspaceRef.current);
      setPythonCode(code || DEFAULT_CODE);
    }
    setStatus({ text: "Reset to blocks mode", type: "" });
  }, []);

  /* ── Clear workspace (trash all blocks) ────────────────── */
  const handleClearWorkspace = useCallback(async () => {
    if (!workspaceRef.current) return;
    const ok = await dialogService.confirm("Clear all blocks from the workspace? This cannot be undone.");
    if (!ok) return;
    workspaceRef.current.clear();
    setPythonCode(DEFAULT_CODE);
    setStatus({ text: "Workspace cleared", type: "" });
  }, []);

  /* ── Copy code to clipboard ────────────────────────────── */
  const handleCopyCode = useCallback(() => {
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    navigator.clipboard.writeText(code).then(() => {
      setStatus({ text: "Code copied to clipboard", type: "success" });
    }).catch(() => {
      setStatus({ text: "Failed to copy", type: "error" });
    });
  }, [mode, pythonCode, syncFromBlocks]);

  /* ── Import .py or .xml file ─────────────────────────── */
  const handleImport = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (file.name.endsWith(".xml")) {
        stopPython("glowscript-host");
        setRunning(false);
        setProjectType("custom");
        // If the Blockly workspace is already live, load directly into it
        if (workspaceRef.current && window.Blockly) {
          try {
            workspaceRef.current.clear();
            const dom = window.Blockly.utils.xml.textToDom(content);
            window.Blockly.Xml.domToWorkspace(dom, workspaceRef.current);
            const newCode = generatePythonFromWorkspace(workspaceRef.current);
            setPythonCode(newCode || DEFAULT_CODE);
          } catch (err) {
            console.warn("Direct XML load failed, falling back to remount:", err);
          }
        }
        // Always update state so workspace remounts correctly if in text mode
        setWorkspaceXml(content);
        setMode("blocks");
        setStatus({ text: `Imported blocks from ${file.name}`, type: "success" });
      } else if (file.name.endsWith(".py")) {
        stopPython("glowscript-host");
        setRunning(false);
        setPythonCode(content);
        setMode("text");
        setProjectType("code_blank");
        setStatus({ text: `Imported Python from ${file.name}`, type: "success" });
      } else {
        setStatus({ text: "Unsupported file type. Use .py or .xml", type: "error" });
      }
    };
    reader.onerror = () => {
      setStatus({ text: "Failed to read file", type: "error" });
    };
    reader.readAsText(file);
  }, []);

  /* ── Export screenshot of 3D viewport ──────────────────── */
  const handleExportScreenshot = useCallback(async () => {
    const host = document.getElementById("glowscript-host");
    if (!host) { setStatus({ text: "No viewport to capture", type: "error" }); return; }
    const name = await getExportName();
    if (!name) return;
    setStatus({ text: "Capturing screenshot...", type: "" });
    try {
      const canvas = await html2canvas(host, { backgroundColor: "#0a0a0f", useCORS: true });
      const link = document.createElement("a");
      link.download = `${name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setStatus({ text: `Screenshot saved as ${name}.png`, type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: "Screenshot failed", type: "error" });
    }
  }, [getExportName]);

  /* ── Zoom handler for Blockly workspace ────────────────── */
  const handleZoomChange = useCallback((pct) => {
    setBlocklyZoom(pct);
    const ws = workspaceRef.current;
    if (ws) {
      const scale = pct / 100;
      ws.setScale(scale);
      ws.resize();
    }
  }, []);

  /* ── Resize Blockly canvas when split or viewport visibility changes ── */
  // ResizeObserver inside BlocklyWorkspace is the primary resize mechanism.
  // This effect acts as a fallback for any layout change not caught by the
  // observer (e.g. initial render, toolbox switch). We intentionally do NOT
  // cancel the rAF in the cleanup — cancelling it on every rapid re-render
  // would prevent resize() from ever firing during a drag.
  useEffect(() => {
    requestAnimationFrame(() => workspaceRef.current?.resize());
  }, [splitPct, viewportHidden]);

  /* ── Viewport pane resize & show\/hide ────────────────────────── */
  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    const container = e.currentTarget.parentElement; // .main-layout
    const onMouseMove = (ev) => {
      const rect = container.getBoundingClientRect();
      const pct  = Math.min(85, Math.max(15, ((ev.clientX - rect.left) / rect.width) * 100));
      setSplitPct(pct);
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",  onMouseUp);
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup",  onMouseUp);
  }, []);

  const handleToggleViewport = useCallback(() => {
    setViewportHidden((h) => !h);
  }, []);

  const handleToggleBeginnerMode = useCallback(() => {
    setBeginnerMode((b) => !b);
  }, []);

  const handleClearTrace = useCallback(() => setTraceData(new Map()), []);

  /* ── Debug Mode handlers ──────────────────────────────────── */
  const handleEnterDebug = useCallback(() => {
    stopPython("glowscript-host");
    setRunning(false);
    setPaused(false);
    setDebugMode(true);
    setStatus({ text: 'Debug Mode', type: '' });
  }, []);

  const handleExitDebug = useCallback(() => {
    stopPython("glowscript-host");
    setRunning(false);
    setPaused(false);
    setRecording(false);
    recordingRef.current = false;
    setDebugMode(false);
    setStatus({ text: 'Ready', type: '' });
  }, []);

  const handlePause = useCallback(() => {
    pausePython();
    setPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    resumePython();
    setPaused(false);
  }, []);

  const handleStep = useCallback(() => {
    setPaused(true);
    stepPython();
  }, []);

  /* ── Recording handlers ─────────────────────────────────────── */
  const handleStartRecord = useCallback(() => {
    recordBufferRef.current = [];
    recordingRef.current = true;
    setRecording(true);
    setStatus({ text: 'Recording…', type: '' });
  }, []);

  const handleStopRecord = useCallback(() => {
    recordingRef.current = false;
    setRecording(false);
    setStatus({ text: `Recording stopped — ${recordBufferRef.current.length} rows`, type: 'success' });
  }, []);

  /* ── Breakpoint handlers ────────────────────────────────────── */
  const handleToggleBreakpoint = useCallback((blockId) => {
    if (!blockId) return;
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);
  /* ── Mode toggle ───────────────────────────────────────── */
  const handleModeChange = useCallback(
    (nextMode) => {
      if (nextMode === mode) return;

      if (mode === "blocks" && nextMode === "text") {
        if (workspaceRef.current && workspaceRef.current.getAllBlocks(false).length > 0) {
          syncFromBlocks();
        }
        setMode("text");
        setStatus({ text: projectType === "custom" ? "Switched to Code View Only" : "Switched to Code editor", type: "" });
        return;
      }

      // text -> blocks (keep both states; no discard prompt)
      setMode("blocks");
      setStatus({ text: "Switched to Blocks editor", type: "" });
    },
    [mode, projectType, syncFromBlocks]
  );

  /* ── Blockly callbacks (stable refs inside component) ──── */
  const handleWorkspaceReady = useCallback((ws) => {
    workspaceRef.current = ws;
  }, []);

  const handleWorkspaceChange = useCallback(
    (xml, code) => {
      setWorkspaceXml(xml);
      // Only overwrite pythonCode from blocks if the workspace actually has blocks.
      // This prevents wiping template code when switching to an empty block workspace.
      if (mode === "blocks" && code && code.trim().length > 0) {
        setPythonCode(code);
      }
    },
    [mode]
  );

  /* ── Start menu selection ──────────────────────────────── */
  const handleStartSelect = useCallback(
    (selection) => {
      if (!selection || selection.type === "blank" || selection.type === "blocks_blank") {
        setProjectType("custom");
        setMode("blocks");
        setPythonCode(DEFAULT_CODE);
        setWorkspaceXml("");
      } else if (selection.type === "code_blank") {
        setProjectType("code_blank");
        setMode("text");
        setPythonCode(DEFAULT_CODE);
        setWorkspaceXml("");
      } else if (selection.type === "code") {
        setProjectType("code_template");
        setPythonCode(selection.code || DEFAULT_CODE);
        const blockTemplate = findBlockTemplateByCodeId(selection.id);
        setWorkspaceXml(blockTemplate ? blockTemplate.xml : "");
        setMode("text");
      } else if (selection.type === "blocks") {
        setProjectType("block_template");
        setWorkspaceXml(selection.xml || "");
        const codeTemplate = findCodeTemplateByBlockId(selection.id);
        // Always reset pythonCode so old code doesn't persist when switching templates
        setPythonCode(codeTemplate?.code || DEFAULT_CODE);
        setMode("blocks");
      }
      setShowStart(false);
    },
    [findBlockTemplateByCodeId, findCodeTemplateByBlockId]
  );

  /* ── Return to start menu ──────────────────────────────── */
  const handleHome = useCallback(() => {
    setShowStart(true);
    setRunning(false);
    stopPython("glowscript-host");
    setStatus({ text: "Ready", type: "" });
  }, []);

  /* ── Status CSS class ──────────────────────────────────── */
  const statusClass =
    status.type === "error"
      ? "console-bar console-bar--error"
      : status.type === "success"
      ? "console-bar console-bar--success"
      : "console-bar";

  /* ── IF start menu is visible ──────────────────────────── */
  if (showStart) {
    return (
      <>
        <StartMenu onSelect={handleStartSelect} onHelp={handleHelp} onImport={(file) => { handleImport(file); setShowStart(false); }} />
        {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
      </>
    );
  }

  /* ── IF debug mode ─────────────────────────────────────── */
  if (debugMode) {
    return (
      <>
        <VariableDialog />
        {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
        <DebugMode
          workspaceXml={workspaceXml}
          pythonCode={pythonCode}
          isDark={isDark}
          running={running}
          paused={paused}
          onRun={handleRun}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          onStep={handleStep}
          traceData={traceData}
          onHighlightBlock={(id) => {
            try { workspaceRef.current?.highlightBlock(id); } catch (_) {}
          }}
          onClearTrace={handleClearTrace}
          recording={recording}
          onStartRecord={handleStartRecord}
          onStopRecord={handleStopRecord}
          recordBuffer={recordBufferRef.current}
          projectType={projectType}
          breakpoints={breakpoints}
          onToggleBreakpoint={handleToggleBreakpoint}
          executingBlockId={executingBlockId}
          onExitDebug={handleExitDebug}
        />
      </>
    );
  }

  /* ── Main IDE render ───────────────────────────────────── */
  const isCustom = projectType === "custom";
  // Determine which mode to lock (grey out) based on project type
  const lockedMode = projectType === "code_blank" ? "blocks" : null;

  // Is the current view read-only? (secondary mode on a template)
  const isReadOnlyView =
    (projectType === "block_template" && mode === "text") ||
    (projectType === "code_template"  && mode === "blocks");

  return (
    <div className="app-shell">
      <VariableDialog />
      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
      {/* VS Code title bar */}
      <div className="titlebar">
        <span className="titlebar-text"><strong>Physics IDE</strong> — {mode === "blocks" ? "Block Editor" : "Code Editor"}</span>
      </div>
      <Toolbar
        onRun={handleRun}
        onStop={handleStop}
        onExportPy={handleExportPy}
        onExportBlocks={handleExportBlocks}
        onExportBlocksPdf={handleExportBlocksPdf}
        onExportCodePdf={handleExportCodePdf}
        onExportScreenshot={handleExportScreenshot}
        onCopyCode={handleCopyCode}
        onImport={handleImport}
        onReset={handleResetToBlocks}
        onClearWorkspace={handleClearWorkspace}
        onToggleTheme={toggleTheme}
        onHome={handleHome}
        onHelp={handleHelp}
        isDark={isDark}
        running={running}
        mode={mode}
        zoom={blocklyZoom}
        onZoomChange={handleZoomChange}
        viewportHidden={viewportHidden}
        onToggleViewport={handleToggleViewport}
        beginnerMode={beginnerMode}
        onToggleBeginnerMode={handleToggleBeginnerMode}
        onDebugMode={handleEnterDebug}
      >
        <ModeToggle
          mode={mode}
          onChange={handleModeChange}
          lockedMode={lockedMode}
          codeLabel={isCustom ? "Code View Only" : "Code"}
        />
      </Toolbar>

      <div className="main-layout">
        <section
          className="editor-pane"
          style={
            viewportHidden
              ? { flex: "1 1 auto", maxWidth: "100%", borderRight: "none" }
              : { flex: `0 0 ${splitPct}%`, maxWidth: `${splitPct}%` }
          }
        >
          {/* ── Blocks mode ── */}
          {mode === "blocks" ? (
            <>
              <div className={`pane-header pane-header--blocks${isReadOnlyView ? " pane-header--code-preview" : ""}`}>
                <BlocksIcon size={14} /> {isReadOnlyView ? "Block Reference (Read Only)" : "Block Editor"}
              </div>
              {isReadOnlyView ? (
                <ReadOnlyBlockly xml={workspaceXml} isDark={isDark} />
              ) : (
                <BlocklyWorkspace
                  initialXml={workspaceXml}
                  onWorkspaceReady={handleWorkspaceReady}
                  onWorkspaceChange={handleWorkspaceChange}
                  isDark={isDark}
                  beginnerMode={beginnerMode}
                />
              )}
            </>
          ) : (
            <>
              <div className={`pane-header pane-header--code${isReadOnlyView ? " pane-header--code-preview" : ""}`}>
                <CodeIcon size={14} /> {isCustom ? "Code View Only" : isReadOnlyView ? "Generated Code (Read Only)" : "Code Editor"}
              </div>
              <CodeEditor
                value={pythonCode}
                isDark={isDark}
                readOnly={isCustom || isReadOnlyView}
                onChange={
                  (isCustom || isReadOnlyView)
                    ? () => {}
                    : (v) => {
                        setPythonCode(v);
                      }
                }
              />
            </>
          )}
        </section>
        {!viewportHidden && (
          <div className="pane-divider" onMouseDown={handleDividerMouseDown} />
        )}
        <section
          className="canvas-pane"
          style={viewportHidden ? { display: "none" } : { flex: "1 1 0", minWidth: 0 }}
        >
          <div className="pane-header pane-header--viewport">
            <GlobeIcon size={14} /> 3D Viewport
          </div>
          <GlowCanvas
            running={running}
          />
        </section>
      </div>

      <div className="status-bar">
        <span className={running ? "console-bar console-bar--running" : statusClass}>
          {running && <span className="status-dot" />}
          {status.text}
        </span>
        <span>
          Mode: {mode === "blocks" ? "Blocks" : isCustom ? "Code View Only" : "Code"} | VPython 3.2
        </span>
      </div>
    </div>
  );
}

export default App;
