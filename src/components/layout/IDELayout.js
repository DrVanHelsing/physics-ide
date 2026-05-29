/**
 * IDELayout
 *
 * The single top-level render component for the Physics IDE.
 * It is responsible only for composing hooks and rendering JSX.
 * All business logic lives in the custom hooks it invokes.
 *
 * Hierarchy:
 *   App (providers + ErrorBoundary)
 *     └─ IDELayout
 *          ├─ StartMenu  (conditional)
 *          ├─ DebugMode  (conditional)
 *          └─ Main IDE shell
 *               ├─ Toolbar
 *               ├─ .main-layout
 *               │    ├─ .editor-pane  (BlocklyWorkspace | CodeEditor)
 *               │    ├─ .pane-divider
 *               │    └─ .canvas-pane  (GlowCanvas)
 *               └─ .status-bar
 */
import React, { useCallback, useState } from "react";

import BlocklyWorkspace, { ReadOnlyBlockly } from "../BlocklyWorkspace";
import CodeEditor   from "../CodeEditor";
import GlowCanvas   from "../GlowCanvas";
import Toolbar      from "../Toolbar";
import ModeToggle   from "../ModeToggle";
import StartMenu    from "../StartMenu";
import HelpPage     from "../HelpPage";
import VariableDialog from "../VariableDialog";
import DebugMode    from "../DebugMode";
import ChartOverlay from "../ChartOverlay";
import DataPanel    from "../DataPanel";
import { BlocksIcon, CodeIcon, GlobeIcon } from "../Icons";

import { fromTraceBuffer, toCsvText } from "../../utils/dataset/dataset";
import { saveDataset } from "../../hooks/useDataset";
import { generateDsJsFromWorkspace } from "../../utils/blockly/dsGenerator";
import { runDsCode, clearCsvCache } from "../../utils/runner/dsRunner";
import { renderDsChartToElement } from "../../utils/charts/chartSpec";

import { useTheme }              from "../../contexts/ThemeContext";
import { useSimulationContext }  from "../../contexts/SimulationContext";
import { useTraceContext }       from "../../contexts/TraceContext";

import { useSimulation }  from "../../hooks/useSimulation";
import { useDebug }       from "../../hooks/useDebug";
import { useTrace }       from "../../hooks/useTrace";
import { useExport }      from "../../hooks/useExport";
import { useSplitPane }   from "../../hooks/useSplitPane";
import { useProject }     from "../../hooks/useProject";

export default function IDELayout() {
  /* ── Theme ───────────────────────────────────────────── */
  const { isDark, toggle: toggleTheme } = useTheme();

  /* ── Contexts (read-only state not yet covered by hooks) */
  const {
    showStart, setShowStart,
    showHelp,  setShowHelp,
    status,
    paused,
    workspaceRef,
    setPythonCode,
  } = useSimulationContext();

  const { traceData, recordBufferRef } = useTraceContext();

  /* ── Hooks ───────────────────────────────────────────── */
  const sim = useSimulation();
  const dbg = useDebug();
  const trc = useTrace();
  const exp = useExport();
  const proj = useProject();
  const { splitPct, handleDividerMouseDown } = useSplitPane();

  /* ── Simple UI handlers (defined here to avoid extra hook) */
  const handleHelp = useCallback(() => setShowHelp(true), [setShowHelp]);

  /* ── DS panel outputs ────────────────────────────────────── */
  const [dsOutputs, setDsOutputs] = useState([]);
  const [dsError,   setDsError]   = useState(null);

  const goal = proj.activeManifest?.goal || "physics";
  const isDataGoal = goal === "datascience";

  const handleWorkspaceChange = useCallback(
    (xml, code) => {
      sim.handleWorkspaceChange(xml, code);
      if (isDataGoal && workspaceRef.current) {
        const jsCode = generateDsJsFromWorkspace(workspaceRef.current);
        runDsCode(jsCode).then(({ outputs, error }) => {
          setDsError(error || null);
          const displayOutputs = [];
          for (const o of outputs) {
            if (o.type === "download" && o.format === "csv" && o.dataset) {
              const csv = toCsvText(o.dataset);
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${o.dataset.id || "dataset"}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            } else if (o.type === "show_python") {
              displayOutputs.push({ type: "python", code });
            } else if (o.type === "save_chart" && o.dataset) {
              const svgEl = renderDsChartToElement(o, 600);
              if (svgEl && svgEl.tagName === "svg") {
                const blob = new Blob(
                  [new XMLSerializer().serializeToString(svgEl)],
                  { type: "image/svg+xml" }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `chart-${o.chartType || "chart"}.svg`;
                a.click();
                URL.revokeObjectURL(url);
              }
            } else {
              displayOutputs.push(o);
            }
          }
          setDsOutputs(displayOutputs);
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, isDataGoal, workspaceRef]
  );

  /* ── Chart overlay (Phase A: trace -> dataset -> chart spike) ── */
  const [chartDataset, setChartDataset] = useState(null);
  const handleSaveAsDataset = useCallback(async (recordBuffer) => {
    if (!recordBuffer || recordBuffer.length === 0) return;
    const dataset = fromTraceBuffer(recordBuffer, {
      name: `Run @ ${new Date().toLocaleTimeString()}`,
    });
    try {
      await saveDataset(dataset);
    } catch (err) {
      console.warn("Could not persist dataset to localForage:", err);
    }
    setChartDataset(dataset);
  }, []);
  const handleCloseChart = useCallback(() => setChartDataset(null), []);

  /* ── Derived presentation values ─────────────────────── */
  const statusClass =
    status.type === "error"   ? "console-bar console-bar--error"   :
    status.type === "success" ? "console-bar console-bar--success" :
                                 "console-bar";

  const { mode, pythonCode, workspaceXml, projectType, running,
          blocklyZoom, viewportHidden, beginnerMode } = sim;

  const isCustom       = projectType === "custom";
  const lockedMode     = projectType === "code_blank" ? "blocks" : null;
  const isReadOnlyView =
    (projectType === "block_template" && mode === "text") ||
    (projectType === "code_template"  && mode === "blocks");

  /* ── Start menu ──────────────────────────────────────── */
  if (showStart) {
    return (
      <>
        <StartMenu
          projectList={proj.projectList}
          onOpenProject={(id) => { proj.selectProject(id); }}
          onDeleteProject={(id) => { proj.removeProject(id); }}
          onCreate={(spec) => { proj.createNew(spec); }}
          onImport={(file) => { sim.handleImport(file); setShowStart(false); }}
          onHelp={handleHelp}
        />
        {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}
        {chartDataset && <ChartOverlay dataset={chartDataset} onClose={handleCloseChart} />}
      </>
    );
  }

  /* ── Debug mode ──────────────────────────────────────── */
  if (dbg.debugMode) {
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
          onRun={sim.handleRun}
          onStop={sim.handleStop}
          onPause={dbg.handlePause}
          onResume={dbg.handleResume}
          onStep={dbg.handleStep}
          traceData={traceData}
          onHighlightBlock={(id) => {
            try { workspaceRef.current?.highlightBlock(id); } catch (_) {}
          }}
          onClearTrace={trc.handleClearTrace}
          recording={trc.recording}
          onStartRecord={trc.handleStartRecord}
          onStopRecord={trc.handleStopRecord}
          recordBuffer={recordBufferRef.current}
          onSaveAsDataset={handleSaveAsDataset}
          projectType={projectType}
          breakpoints={dbg.breakpoints}
          onToggleBreakpoint={dbg.toggleBreakpoint}
          executingBlockId={dbg.executingBlockId}
          onExitDebug={dbg.handleExitDebug}
        />
        {chartDataset && <ChartOverlay dataset={chartDataset} onClose={handleCloseChart} />}
      </>
    );
  }

  /* ── Main IDE shell ──────────────────────────────────── */
  return (
    <div className="app-shell">
      <VariableDialog />
      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}

      {/* VS Code-style title bar */}
      <div className="titlebar">
        <span className="titlebar-text">
          <strong>Physics IDE</strong> —{" "}
          {mode === "blocks" ? "Block Editor" : "Code Editor"}
        </span>
      </div>

      <Toolbar
        goal={goal}
        onRun={sim.handleRun}
        onStop={sim.handleStop}
        onExportPy={exp.handleExportPy}
        onExportBlocks={exp.handleExportBlocks}
        onExportBlocksPdf={exp.handleExportBlocksPdf}
        onExportCodePdf={exp.handleExportCodePdf}
        onExportScreenshot={exp.handleExportScreenshot}
        onCopyCode={exp.handleCopyCode}
        onImport={sim.handleImport}
        onReset={sim.handleResetToBlocks}
        onClearWorkspace={sim.handleClearWorkspace}
        onToggleTheme={toggleTheme}
        onHome={sim.handleHome}
        onHelp={handleHelp}
        isDark={isDark}
        running={running}
        mode={mode}
        zoom={blocklyZoom}
        onZoomChange={sim.handleZoomChange}
        viewportHidden={viewportHidden}
        onToggleViewport={sim.handleToggleViewport}
        beginnerMode={beginnerMode}
        onToggleBeginnerMode={sim.handleToggleBeginnerMode}
        onDebugMode={dbg.handleEnterDebug}
      >
        <ModeToggle
          mode={mode}
          onChange={sim.handleModeChange}
          lockedMode={lockedMode}
          codeLabel={isCustom ? "Code View Only" : "Code"}
        />
      </Toolbar>

      <div className="main-layout">
        {/* ── Editor pane ── */}
        <section
          className="editor-pane"
          style={
            viewportHidden
              ? { flex: "1 1 auto", maxWidth: "100%", borderRight: "none" }
              : { flex: `0 0 ${splitPct}%`, maxWidth: `${splitPct}%` }
          }
        >
          {mode === "blocks" ? (
            <>
              <div
                className={`pane-header pane-header--blocks${
                  isReadOnlyView ? " pane-header--code-preview" : ""
                }`}
              >
                <BlocksIcon size={14} />{" "}
                {isReadOnlyView ? "Block Reference (Read Only)" : "Block Editor"}
              </div>
              {isReadOnlyView ? (
                <ReadOnlyBlockly xml={workspaceXml} isDark={isDark} />
              ) : (
                <BlocklyWorkspace
                  initialXml={workspaceXml}
                  onWorkspaceReady={sim.handleWorkspaceReady}
                  onWorkspaceChange={handleWorkspaceChange}
                  isDark={isDark}
                  beginnerMode={beginnerMode}
                />
              )}
            </>
          ) : (
            <>
              <div
                className={`pane-header pane-header--code${
                  isReadOnlyView ? " pane-header--code-preview" : ""
                }`}
              >
                <CodeIcon size={14} />{" "}
                {isCustom
                  ? "Code View Only"
                  : isReadOnlyView
                  ? "Generated Code (Read Only)"
                  : "Code Editor"}
              </div>
              <CodeEditor
                value={pythonCode}
                isDark={isDark}
                readOnly={isCustom || isReadOnlyView}
                onChange={
                  isCustom || isReadOnlyView
                    ? () => {}
                    : (v) => setPythonCode(v)
                }
              />
            </>
          )}
        </section>

        {!viewportHidden && (
          <div className="pane-divider" onMouseDown={handleDividerMouseDown} />
        )}

        {/* ── Right pane: 3D viewport (physics / hybrid) or data panel (DS) ── */}
        {isDataGoal ? (
          <section
            className="canvas-pane"
            style={viewportHidden ? { display: "none" } : { flex: "1 1 0", minWidth: 0 }}
          >
            <DataPanel
              goal={goal}
              datasetCount={proj.activeManifest?.datasets?.length || 0}
              dsOutputs={dsOutputs}
              dsError={dsError}
              onClearCsvCache={clearCsvCache}
            />
          </section>
        ) : (
          <section
            className="canvas-pane"
            style={viewportHidden ? { display: "none" } : { flex: "1 1 0", minWidth: 0 }}
          >
            <div className="pane-header pane-header--viewport">
              <GlobeIcon size={14} /> 3D Viewport
            </div>
            <GlowCanvas running={running} />
          </section>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="status-bar">
        <span className={running ? "console-bar console-bar--running" : statusClass}>
          {running && <span className="status-dot" />}
          {status.text}
        </span>
        <span>
          Mode: {mode === "blocks" ? "Blocks" : isCustom ? "Code View Only" : "Code"} | VPython 3.2
        </span>
      </div>

      {chartDataset && <ChartOverlay dataset={chartDataset} onClose={handleCloseChart} />}
    </div>
  );
}
