import React, { useCallback, useEffect, useRef, useState } from "react";
import BlocklyWorkspace from "./components/BlocklyWorkspace";
import CodeEditor from "./components/CodeEditor";
import GlowCanvas from "./components/GlowCanvas";
import Toolbar from "./components/Toolbar";
import ModeToggle from "./components/ModeToggle";
import StartMenu from "./components/StartMenu";
import HelpPage from "./components/HelpPage";
import { BlocksIcon, CodeIcon, GlobeIcon } from "./components/Icons";
import { useTheme } from "./ThemeContext";
import { generatePythonFromWorkspace } from "./utils/blocklyGenerator";
import { exportBlocks, exportPython } from "./utils/exportUtils";
import { exportBlocksPdf, exportCodePdf } from "./utils/pdfExport";
import { runPython, stopPython } from "./utils/glowRunner";
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

  const handleHelp = useCallback(() => setShowHelp(true), []);

  const findBlockTemplateByCodeId = useCallback((codeId) => {
    const idToBlockTemplate = {
      projectile: "blocks_projectile",
      spring:     "blocks_spring",
      orbits:     "blocks_orbits",
    };
    const blockId = idToBlockTemplate[codeId];
    return BLOCK_TEMPLATES.find((tpl) => tpl.id === blockId) || null;
  }, []);

  const findCodeTemplateByBlockId = useCallback((blockId) => {
    const blockToCodeId = {
      blocks_projectile: "projectile",
      blocks_spring:     "spring",
      blocks_orbits:     "orbits",
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
    try {
      stopPython("glowscript-host");
      await runPython(code, "glowscript-host");
      setStatus({ text: "Simulation started", type: "success" });
    } catch (err) {
      console.error(err);
      setRunning(false);
      setStatus({ text: err.message || "Runtime error", type: "error" });
    }
  }, [mode, pythonCode, syncFromBlocks]);

  const handleStop = useCallback(() => {
    stopPython("glowscript-host");
    setRunning(false);
    setStatus({ text: "Simulation stopped", type: "" });
  }, []);

  const handleExportPy = useCallback(() => {
    exportPython(mode, pythonCode, workspaceRef.current);
    setStatus({ text: "Exported .py file", type: "success" });
  }, [mode, pythonCode]);

  const handleExportBlocks = useCallback(() => {
    exportBlocks(workspaceRef.current);
    setStatus({ text: "Exported blocks XML", type: "success" });
  }, []);

  const handleExportBlocksPdf = useCallback(async () => {
    setStatus({ text: "Generating blocks PDF...", type: "" });
    try {
      await exportBlocksPdf(workspaceRef.current);
      setStatus({ text: "Blocks PDF saved", type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: err.message || "PDF export failed", type: "error" });
    }
  }, []);

  const handleExportCodePdf = useCallback(async () => {
    const code = mode === "text" ? pythonCode : syncFromBlocks();
    setStatus({ text: "Generating code PDF...", type: "" });
    try {
      await exportCodePdf(code);
      setStatus({ text: "Code PDF saved", type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: err.message || "PDF export failed", type: "error" });
    }
  }, [mode, pythonCode, syncFromBlocks]);

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
  const handleClearWorkspace = useCallback(() => {
    if (!workspaceRef.current) return;
    if (!window.confirm("Clear all blocks from the workspace?")) return;
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

  /* ── Export screenshot of 3D viewport ──────────────────── */
  const handleExportScreenshot = useCallback(async () => {
    const host = document.getElementById("glowscript-host");
    if (!host) { setStatus({ text: "No viewport to capture", type: "error" }); return; }
    setStatus({ text: "Capturing screenshot...", type: "" });
    try {
      const canvas = await html2canvas(host, { backgroundColor: "#0a0a0f", useCORS: true });
      const link = document.createElement("a");
      link.download = "viewport.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      setStatus({ text: "Screenshot saved", type: "success" });
    } catch (err) {
      console.error(err);
      setStatus({ text: "Screenshot failed", type: "error" });
    }
  }, []);

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
        <StartMenu onSelect={handleStartSelect} onHelp={handleHelp} />
        {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
      </>
    );
  }

  /* ── Main IDE render ───────────────────────────────────── */
  const isCustom = projectType === "custom";
  // Determine which mode to lock (grey out) based on project type
  const lockedMode = projectType === "code_template" ? "blocks"
    : projectType === "block_template" ? "text"
    : projectType === "code_blank"     ? "blocks"
    : null;

  return (
    <div className="app-shell">
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
      >
        <ModeToggle
          mode={mode}
          onChange={handleModeChange}
          lockedMode={lockedMode}
          codeLabel={isCustom ? "Code View Only" : "Code"}
        />
      </Toolbar>

      <div className="main-layout">
        <section className="editor-pane">
          {/* ── Blocks mode ── */}
          {mode === "blocks" ? (
            <>
              <div className="pane-header pane-header--blocks">
                <BlocksIcon size={14} /> Block Editor
              </div>
              <BlocklyWorkspace
                initialXml={workspaceXml}
                onWorkspaceReady={handleWorkspaceReady}
                onWorkspaceChange={handleWorkspaceChange}
                isDark={isDark}
              />
            </>
          ) : (
            <>
              <div className="pane-header pane-header--code">
                <CodeIcon size={14} /> {isCustom ? "Code View Only" : projectType === "code_blank" ? "Code Editor" : "Code Editor"}
              </div>
              <CodeEditor
                value={pythonCode}
                isDark={isDark}
                readOnly={isCustom}
                onChange={
                  isCustom
                    ? () => {}
                    : (v) => {
                        setPythonCode(v);
                      }
                }
              />
            </>
          )}
        </section>
        <section className="canvas-pane">
          <div className="pane-header pane-header--viewport">
            <GlobeIcon size={14} /> 3D Viewport
          </div>
          <GlowCanvas running={running} />
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
