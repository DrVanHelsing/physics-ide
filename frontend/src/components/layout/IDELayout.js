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
import React, { useCallback, useRef, useState } from "react";
import Blockly from "../../utils/blockly/blocklyLib";

import BlocklyWorkspace, { ReadOnlyBlockly } from "../BlocklyWorkspace";
import BlocklyEmptyState from "../BlocklyEmptyState";
import WorkspaceZoom from "../WorkspaceZoom";
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
import TracePromoteDialog from "../TracePromoteDialog";
import SaveState    from "./SaveState";
import RunErrorBanner from "./RunErrorBanner";
import { BlocksIcon, CodeIcon, GlobeIcon } from "../Icons";

import * as dialogService from "../../utils/export/dialogService";

import { fromTraceBuffer, toCsvText, serializeDescriptor } from "../../utils/dataset/dataset";
import { saveDataset } from "../../hooks/useDataset";
import { registerDataset } from "../../utils/dataset/datasetRegistry";
import { generateDsJsFromWorkspace } from "../../utils/blockly/dsGenerator";
import { DS_TEMPLATES } from "../../utils/blockTemplates";
import { runDsCode, clearCsvCache } from "../../utils/runner/dsRunner";
import { GLOWSCRIPT_VERSION } from "../../utils/runner/glowRunner";
import { renderDsChartToElement } from "../../utils/charts/chartSpec";
import { migrate } from "../../utils/manifest/migrate";
import { SPLIT_MIN, SPLIT_MAX } from "../../constants";

import { useTheme }              from "../../contexts/ThemeContext";
import { useSimulationContext }  from "../../contexts/SimulationContext";
import { useTraceContext }       from "../../contexts/TraceContext";

import { useSimulation }  from "../../hooks/useSimulation";
import { useDebug }       from "../../hooks/useDebug";
import { useTrace }       from "../../hooks/useTrace";
import { useExport }      from "../../hooks/useExport";
import { useSplitPane }   from "../../hooks/useSplitPane";
import { useProject }     from "../../hooks/useProject";
import { useHotkeys }     from "../../hooks/useHotkeys";
import { useRunErrorBanner } from "../../hooks/useRunErrorBanner";

export default function IDELayout() {
  /* ── Theme ───────────────────────────────────────────── */
  const { isDark, toggle: toggleTheme } = useTheme();

  /* ── Contexts (read-only state not yet covered by hooks) */
  const {
    showStart, setShowStart,
    showHelp,  setShowHelp,
    status,   setStatus,
    paused,
    workspaceRef,
    setPythonCode,
    setBlocklyZoom,
  } = useSimulationContext();

  const { traceData, recordBufferRef } = useTraceContext();

  /* ── Hooks ───────────────────────────────────────────── */
  const sim = useSimulation();
  const dbg = useDebug();
  const trc = useTrace();
  const exp = useExport();
  const proj = useProject();
  const { splitPct, handleDividerPointerDown, handleDividerKeyDown } = useSplitPane();

  /* ── Simple UI handlers (defined here to avoid extra hook) */
  const handleHelp = useCallback(() => setShowHelp(true), [setShowHelp]);
  const handleGoHome = useCallback(() => {
    sim.handleHome();
    proj.closeProject();
  }, [sim, proj]);

  /* ── DS panel outputs ────────────────────────────────────── */
  const [dsOutputs, setDsOutputs] = useState([]);
  const [dsError,   setDsError]   = useState(null);

  /* ── Saved trace datasets (for DataPanel sidebar) ─────────── */
  const [savedDatasets, setSavedDatasets] = useState([]);

  /* ── Blank-canvas empty state: null = not measured yet, so the
     overlay never flashes before Blockly reports its first count. ── */
  const [blockCount, setBlockCount] = useState(null);

  /* ── Run-error banner: latches independently of `status` (a shared
     single-slot bulletin every other status write overwrites) so it
     actually persists — see useRunErrorBanner.js. Keyed on the active
     project so a latched error never follows the student into a different
     project once they leave this one. ── */
  const [bannerText, dismissBanner] = useRunErrorBanner(status, sim.running, proj.activeProjectId);

  const goal = proj.activeManifest?.goal || "physics";
  const isDataGoal   = goal === "datascience";
  const isHybridGoal = goal === "hybrid";

  const handleWorkspaceChange = useCallback(
    (xml, code) => {
      sim.handleWorkspaceChange(xml, code);
      if ((isDataGoal || isHybridGoal) && workspaceRef.current) {
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

  const handleInsertStarterBlock = useCallback((blockXml) => {
    const ws = workspaceRef.current;
    if (!ws) return;
    try {
      const dom = Blockly.utils.xml.textToDom(
        `<xml xmlns="https://developers.google.com/blockly/xml">${blockXml}</xml>`,
      );
      const ids = Blockly.Xml.domToWorkspace(dom, ws);
      /* normalizeSimulationStructure (BlocklyWorkspace.js:196-232) adopts the
         new top-level block into the sim_start SETUP slot on the next change
         event, which is exactly where a beginner wants it — but only for a
         stack block (one with a previousConnection). A value block like the
         Gravity chip's physics_const_block has none, so appendToSetup no-ops
         on it and it is left exactly where domToWorkspace dropped it: (0,0),
         behind the 180px toolbox rail. Recentre on the visible view the same
         way BlockSearch's insertBlock does (BlocklyWorkspace.js) so it is
         never an invisible block regardless of whether it ends up adopted. */
      const block = ids && ids.length ? ws.getBlockById(ids[ids.length - 1]) : null;
      const metrics = block ? ws.getMetricsManager?.().getViewMetrics(true) : null;
      if (block && metrics) {
        const xy = block.getRelativeToSurfaceXY();
        block.moveBy(
          metrics.left + metrics.width / 2 - xy.x - 40,
          metrics.top + metrics.height / 2 - xy.y - 20,
        );
      }
    } catch (err) {
      console.warn("Could not insert starter block:", err);
    }
  }, [workspaceRef]);

  /* ── Chart overlay (Phase A spike) ── */
  const [chartDataset, setChartDataset] = useState(null);
  const handleCloseChart = useCallback(() => setChartDataset(null), []);

  /* ── Hybrid loop closure: load the paired analysis template ───
     Bumping this key remounts the Blockly workspace so the analysis XML
     loads as `initialXml` (the workspace only reads initialXml on mount). */
  const [workspaceReloadKey, setWorkspaceReloadKey] = useState(0);

  const handleAnalyseRun = useCallback(
    (label) => {
      const pairing = proj.activeManifest?.hybridPairing;
      if (!pairing?.analysisId) return;
      const tpl = DS_TEMPLATES.find((t) => t.id === pairing.analysisId);
      if (!tpl?.xml) return;
      // Auto-fill the placeholder with the just-promoted run label.
      const xml = tpl.xml.split("paste-trace-label-here").join(label || "");
      if (dbg.debugMode) dbg.handleExitDebug();
      sim.loadWorkspaceXml(xml);
      setWorkspaceReloadKey((k) => k + 1);
      setChartDataset(null);
    },
    [proj, sim, dbg]
  );

  /* ── Trace promote dialog ─────────────────────────────────── */
  const [showTraceDialog, setShowTraceDialog] = useState(false);
  const pendingBufferRef = useRef(null);

  /* ── Global hotkeys ────────────────────────────────────────
     Disabled whenever another surface owns the keyboard: the start menu,
     Help, Debug Mode (its own handler lives at DebugMode.js:162-179), the
     trace-promote dialog and the chart overlay. */
  const handleSaveProject = useCallback(async () => {
    try {
      const saved = await proj.saveCurrent();
      setStatus(
        saved
          ? { text: `Saved “${saved.title}”`, type: "success" }
          : { text: "Nothing to save yet", type: "" },
      );
    } catch (err) {
      console.warn("Save failed:", err);
      setStatus({ text: "Could not save — your work is still on this computer", type: "error" });
    }
  }, [proj, setStatus]);

  useHotkeys({
    enabled: !showStart && !showHelp && !dbg.debugMode && !showTraceDialog && !chartDataset,
    onRun: sim.handleRun,
    onStop: sim.running ? sim.handleStop : undefined,
    onSave: handleSaveProject,
  });

  const handleSaveAsDataset = useCallback((recordBuffer) => {
    if (!recordBuffer || recordBuffer.length === 0) return;
    pendingBufferRef.current = recordBuffer;
    setShowTraceDialog(true);
  }, []);

  const handleTraceConfirm = useCallback(async ({ label, selectedVars, tMin, tMax }) => {
    setShowTraceDialog(false);
    const buf = pendingBufferRef.current;
    if (!buf) return;
    const sameTime = tMin === tMax;
    const filtered = buf.filter(
      (r) => selectedVars.includes(r.name) && (sameTime || (r.t >= tMin && r.t <= tMax))
    );
    const dataset = fromTraceBuffer(filtered, { name: label });
    registerDataset(dataset);
    setSavedDatasets((prev) => [...prev, dataset]);
    try {
      await saveDataset(dataset);
    } catch (err) {
      console.warn("Could not persist dataset to localForage:", err);
    }
    // Persist RunSnapshot + dataset descriptor to manifest.
    const runSnapshot = {
      id: dataset.id,
      label,
      startedAt: tMin,
      endedAt: tMax,
      trace: filtered.slice(0, 500), // keep at most 500 rows inline
    };
    const descriptor = serializeDescriptor(dataset);
    try {
      await proj.addRunAndDataset(runSnapshot, descriptor);
    } catch (err) {
      console.warn("Could not persist run to manifest:", err);
    }
    setChartDataset(dataset);
  }, [proj]);

  /* ── Bundle export / import ──────────────────────────────── */
  const handleExportProject = useCallback(() => {
    const manifest = proj.activeManifest;
    if (!manifest) return;
    const json = JSON.stringify(manifest, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (manifest.title || "project").replace(/[^a-z0-9_-]/gi, "_");
    a.download = `${safeName}.physide.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [proj]);

  const handleImportProject = useCallback(async (file) => {
    if (!file) return;
    sim.handleStop(); // every path that replaces the workspace/project ends the run first (idempotent if nothing is running)
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const manifest = migrate(raw);
      await proj.createNew({
        goal: manifest.goal,
        title: manifest.title,
        workspaceXml: manifest.workspace?.xml || "",
        python: manifest.source?.python || "",
        preferredEditor: manifest.preferredEditor,
        projectType: manifest.projectType,
      });
    } catch (err) {
      console.warn("Import failed:", err);
      await dialogService.alert(
        `Could not open that file.\n\n${err.message}\n\nCheck that it is a .physide.json project bundle exported from Physics IDE.`,
      );
    }
  }, [proj, sim]);

  /* ── Hybrid: offer "Analyse this run →" on the post-promote chart ── */
  const hybridPairing = proj.activeManifest?.hybridPairing;
  const analyseProps =
    hybridPairing?.analysisId && chartDataset
      ? { onAnalyse: () => handleAnalyseRun(chartDataset.name) }
      : {};

  /* ── Derived presentation values ─────────────────────── */
  const statusClass =
    status.type === "error"   ? "console-bar console-bar--error"   :
    status.type === "success" ? "console-bar console-bar--success" :
                                 "console-bar";

  const { mode, pythonCode, workspaceXml, projectType, running,
          blocklyZoom, viewportHidden } = sim;

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
          loaded={proj.loaded}
          onOpenProject={(id) => { sim.handleStop(); proj.selectProject(id); }}
          onDeleteProject={(id) => { proj.removeProject(id); }}
          onCreate={(spec) => { proj.createNew(spec); }}
          onImport={(file) => { proj.noteExplicitOpen(); sim.handleImport(file); setShowStart(false); }}
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
          booting={sim.booting}
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
        {chartDataset && <ChartOverlay dataset={chartDataset} onClose={handleCloseChart} {...analyseProps} />}
        {showTraceDialog && pendingBufferRef.current && (
          <TracePromoteDialog
            recordBuffer={pendingBufferRef.current}
            onConfirm={handleTraceConfirm}
            onCancel={() => setShowTraceDialog(false)}
          />
        )}
      </>
    );
  }

  /* ── Main IDE shell ──────────────────────────────────── */
  return (
    <div className="app-shell">
      <VariableDialog />
      {showHelp && <HelpPage onClose={() => setShowHelp(false)} />}

      <Toolbar
        goal={goal}
        projectTitle={proj.activeManifest?.title || ""}
        onRenameProject={proj.renameProject}
        onSave={handleSaveProject}
        onRun={sim.handleRun}
        onStop={sim.handleStop}
        onExportPy={exp.handleExportPy}
        onExportBlocks={exp.handleExportBlocks}
        onExportBlocksPdf={exp.handleExportBlocksPdf}
        onExportCodePdf={exp.handleExportCodePdf}
        onExportScreenshot={exp.handleExportScreenshot}
        onCopyCode={exp.handleCopyCode}
        onImport={sim.handleImport}
        onExportProject={handleExportProject}
        onImportProject={handleImportProject}
        onReset={sim.handleResetToBlocks}
        onClearWorkspace={sim.handleClearWorkspace}
        onToggleTheme={toggleTheme}
        onHome={handleGoHome}
        onHelp={handleHelp}
        isDark={isDark}
        running={running}
        booting={sim.booting}
        mode={mode}
        viewportHidden={viewportHidden}
        onToggleViewport={sim.handleToggleViewport}
        onDebugMode={dbg.handleEnterDebug}
      >
        <ModeToggle
          mode={mode}
          onChange={sim.handleModeChange}
          lockedMode={lockedMode}
          codeLabel={isCustom ? "Code View Only" : "Code"}
        />
      </Toolbar>

      {/* One banner for the whole shell — not one per canvas-pane variant.
         A run error must stay visible even when the student hides the pane
         it used to live inside (.canvas-pane--hidden { display: none }
         would otherwise take the banner down with it). */}
      <RunErrorBanner text={bannerText} onDismiss={dismissBanner} />

      <div className="main-layout" style={{ "--split": `${splitPct}%` }}>
        {/* ── Editor pane ── */}
        <section
          className={`editor-pane${viewportHidden ? " editor-pane--full" : ""}`}
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
                <div className="blockly-stage">
                  <BlocklyWorkspace
                    key={`ws-${workspaceReloadKey}`}
                    initialXml={workspaceXml}
                    onWorkspaceReady={sim.handleWorkspaceReady}
                    onWorkspaceChange={handleWorkspaceChange}
                    onBlockCountChange={setBlockCount}
                    onScaleChange={setBlocklyZoom}
                    isDark={isDark}
                    goal={goal}
                    initialZoom={blocklyZoom}
                  />
                  <WorkspaceZoom
                    zoom={blocklyZoom}
                    onZoomChange={sim.handleZoomChange}
                    workspaceRef={workspaceRef}
                  />
                  {/* blockCount is the non-frame count BlocklyWorkspace reports via
                     countContentBlocks (Step 3) — a freshly seeded blank physics
                     project already carries sim_start_block + sim_end_block but
                     still reads 0 here, so the overlay renders directly over them. */}
                  {blockCount === 0 && (
                    <BlocklyEmptyState
                      goal={goal}
                      onInsert={handleInsertStarterBlock}
                      checkpointState={proj.activeManifest?.checkpointState}
                    />
                  )}
                </div>
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
          <div
            className="pane-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and viewport"
            aria-valuenow={Math.round(splitPct)}
            aria-valuemin={SPLIT_MIN}
            aria-valuemax={SPLIT_MAX}
            tabIndex={0}
            onPointerDown={handleDividerPointerDown}
            onKeyDown={handleDividerKeyDown}
          />
        )}

        {/* ── Right pane: DS panel | 3D viewport | hybrid (both stacked) ── */}
        {isDataGoal ? (
          <section className={`canvas-pane${viewportHidden ? " canvas-pane--hidden" : ""}`}>
            <DataPanel
              goal={goal}
              datasetCount={proj.activeManifest?.datasets?.length || 0}
              dsOutputs={dsOutputs}
              dsError={dsError}
              onClearCsvCache={clearCsvCache}
              savedDatasets={savedDatasets}
            />
          </section>
        ) : isHybridGoal ? (
          <section
            className={`canvas-pane canvas-pane--hybrid${viewportHidden ? " canvas-pane--hidden" : ""}`}
          >
            <div className="hybrid-viewport">
              <div className="pane-header pane-header--viewport">
                <GlobeIcon size={14} /> 3D Viewport
              </div>
              <GlowCanvas running={running} booting={sim.booting} onStatus={setStatus} />
            </div>
            <div className="hybrid-datapanel">
              <DataPanel
                goal={goal}
                datasetCount={proj.activeManifest?.datasets?.length || 0}
                dsOutputs={dsOutputs}
                dsError={dsError}
                onClearCsvCache={clearCsvCache}
                savedDatasets={savedDatasets}
              />
            </div>
          </section>
        ) : (
          <section className={`canvas-pane${viewportHidden ? " canvas-pane--hidden" : ""}`}>
            <div className="pane-header pane-header--viewport">
              <GlobeIcon size={14} /> 3D Viewport
            </div>
            <GlowCanvas running={running} booting={sim.booting} onStatus={setStatus} />
          </section>
        )}
      </div>

      {/* ── Status bar — quiet: project · save state · run status ── */}
      <div className="status-bar">
        <span className="status-bar__project" title={proj.activeManifest?.title || ""}>
          {proj.activeManifest?.title || "No project open"}
        </span>
        <SaveState updatedAt={proj.activeManifest?.updatedAt} />
        <span className="status-bar__spacer" />
        <span className={running ? "console-bar console-bar--running" : statusClass}>
          {running && <span className="status-dot" />}
          {status.text}
        </span>
        <span className="status-bar__engine">VPython {GLOWSCRIPT_VERSION}</span>
      </div>

      {chartDataset && <ChartOverlay dataset={chartDataset} onClose={handleCloseChart} {...analyseProps} />}

      {showTraceDialog && pendingBufferRef.current && (
        <TracePromoteDialog
          recordBuffer={pendingBufferRef.current}
          onConfirm={handleTraceConfirm}
          onCancel={() => setShowTraceDialog(false)}
        />
      )}
    </div>
  );
}
