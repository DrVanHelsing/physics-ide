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
 *          └─ Main IDE shell
 *               ├─ Toolbar   (grows a debug control group in debug mode)
 *               ├─ .main-layout
 *               │    ├─ BriefPane     (assignment work only — handle when collapsed)
 *               │    ├─ .editor-pane  (BlocklyWorkspace | CodeEditor)
 *               │    ├─ .pane-divider
 *               │    └─ .canvas-pane  (GlowCanvas > DebugDrawer)
 *               └─ .status-bar
 *
 * Debug is a MODE of this shell, not a screen beside it. It used to early-
 * return an entirely separate tree — its own titlebar, toolbar, split pane
 * and, critically, no status bar, so the one mode whose purpose is finding
 * faults was the one mode that could not show them.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Blockly from "../../utils/blockly/blocklyLib";

import BlocklyWorkspace, { ReadOnlyBlockly, appendToSetup } from "../BlocklyWorkspace";
import BlocklyEmptyState from "../BlocklyEmptyState";
import WorkspaceZoom from "../WorkspaceZoom";
import CodeEditor   from "../CodeEditor";
import GlowCanvas   from "../GlowCanvas";
import Toolbar      from "../Toolbar";
import ModeToggle   from "../ModeToggle";
import StartMenu    from "../StartMenu";
import HelpPage     from "../HelpPage";
import VariableDialog from "../VariableDialog";
import DebugDrawer  from "../DebugDrawer";
import ChartOverlay from "../ChartOverlay";
import DataPanel    from "../DataPanel";
import TracePromoteDialog from "../TracePromoteDialog";
import SaveState    from "./SaveState";
import RulesChip    from "./RulesChip";
import BatonChip    from "./BatonChip";
import AttributionChip from "./AttributionChip";
import RunErrorBanner from "./RunErrorBanner";
import BriefPane    from "../assignments/BriefPane";
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
import { startGroupSaves } from "../../utils/assignments/groupSync";
import { SPLIT_MIN, SPLIT_MAX } from "../../constants";

import { useTheme }              from "../../contexts/ThemeContext";
import { useSimulationContext }  from "../../contexts/SimulationContext";
import { useTraceContext }       from "../../contexts/TraceContext";
import { AssignmentProvider, useAssignmentContext } from "../../contexts/AssignmentContext";

import { useSimulation }  from "../../hooks/useSimulation";
import { useDebug }       from "../../hooks/useDebug";
import { useTrace }       from "../../hooks/useTrace";
import { useExport }      from "../../hooks/useExport";
import { useSplitPane }   from "../../hooks/useSplitPane";
import { useProject }     from "../../hooks/useProject";
import { usePendingTemplateSeed } from "../../hooks/usePendingTemplateSeed";
import SimControls       from "../SimControls";
import { useHotkeys }     from "../../hooks/useHotkeys";
import { useDebugHotkeys } from "../../hooks/useDebugHotkeys";
import { useRunErrorBanner } from "../../hooks/useRunErrorBanner";

/**
 * WorkspaceRulesEnforcer — Task 12 (fix round: review Ruling R3, "content
 * visibility beats mode enforcement").
 *
 * AssignmentProvider mounts as a CHILD of IDELayout's own return value
 * (below), so IDELayout's function body runs before that provider exists in
 * the tree and cannot call useAssignmentContext() itself — a top-level call
 * there would always see the context's default (null), regardless of what
 * the provider it renders resolves to. This tiny component is mounted
 * INSIDE the provider instead (see the render below) and does the two
 * things that genuinely need `rules` inside IDELayout's own logic:
 *
 *   - corrects `mode` when the assignment restricts editors to one surface.
 *     An EFFECT that corrects the existing mode state through the existing
 *     handleModeChange, not a fork of the mode state itself — Toolbar's
 *     primary zone already empties (no modeToggle) whenever this applies, so
 *     this is what handles the case where a project was already in the
 *     disallowed mode before the assignment's rules resolved.
 *   - reports the resolved rules back up via `onRules` so IDELayout can
 *     thread advancedBlocks into BlocklyWorkspace's own `hideAdvanced` prop,
 *     which is where the toolbox actually gets built (utils/blockly/toolbox.js).
 *
 * `lockedMode` (IDELayout's existing `projectType === "code_blank" ?
 * "blocks" : null`, the same value ModeToggle already disables its Blocks
 * button with) is threaded in as a guard: a code_blank project's blocks
 * canvas starts and stays genuinely empty — blocks↔python sync is one-way
 * (blocks generate python; python typed directly is never parsed back into
 * blocks) — so forcing "blocks" mode here would hide the student's code
 * behind an empty canvas with no way back. When that applies, the effect
 * deliberately does NOT force the mode; RulesChip still names the rule, so
 * the restriction stays visible even though it isn't mechanically enforced
 * for this one project shape — a hidden-content workspace would be the
 * greater dishonesty. The symmetric case (forcing "code" on a blocks-first
 * project) needs no guard: every blocks-based project keeps `pythonCode`
 * regenerated from the workspace on every change (handleWorkspaceChange),
 * so switching it to text mode always shows real, in-sync code.
 *
 * Renders nothing.
 */
export function WorkspaceRulesEnforcer({ mode, onModeChange, onRules, lockedMode }) {
  const assignment = useAssignmentContext();
  const rules = assignment?.rules ?? null;

  useEffect(() => {
    if (!rules) return;
    if (rules.editors === "blocks") {
      if (lockedMode === "blocks") return; // code_blank: no blocks representation to force into
      if (mode !== "blocks") onModeChange("blocks");
    } else if (rules.editors === "code" && mode !== "text") {
      onModeChange("text");
    }
  }, [rules, mode, onModeChange, lockedMode]);

  useEffect(() => {
    onRules(rules);
  }, [rules, onRules]);

  return null;
}

/**
 * groupReadOnly — Task 22, spec §5.5: "while one member has it open for
 * editing, the others see it read-only".
 *
 * BatonChip reports `{ groupId, held }` upward (IDELayout's body cannot read
 * useAssignmentContext() itself — same constraint WorkspaceRulesEnforcer
 * documents above), and this turns it into the EXISTING `isReadOnlyView`
 * flag. One mechanism, no new editor states.
 *
 * `held` is tri-state, and anything that is not a CONFIRMED `true` locks.
 * null — the baton has not been read yet: the first poll is still in
 * flight, or no poll has ever succeeded (offline, or 403 after being
 * removed from the group). An unknown baton is not a held one, and treating
 * it as one is not a small mistake: no save listener is registered unless
 * the baton is confirmed held, so every edit made under an unknown baton
 * stays local — and once the local copy is newer than the head,
 * pullGroupProject's newer-local guard means the group's work can never
 * arrive again. Silent, permanent divergence, in exchange for not flashing
 * read-only editors for one round trip. The chip says "Checking who's
 * editing…" while that lasts.
 */
export function groupReadOnly(baton) {
  return !!baton?.groupId && baton.held !== true;
}

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

  const { traceData, recordBufferRef, iteration } = useTraceContext();

  /* ── Hooks ───────────────────────────────────────────── */
  const sim = useSimulation();
  const dbg = useDebug();
  const trc = useTrace();
  const exp = useExport();
  const proj = useProject();
  /* The welcome page's worked-project tiles (welcome/pendingTemplate.js):
     picks up a pending template id, if any, and seeds a project from it
     through the wizard's own creation path. No-ops when nothing is
     pending. */
  usePendingTemplateSeed(proj);
  const { splitPct, handleDividerPointerDown, handleDividerKeyDown } = useSplitPane();
  /* Space / F10 / Shift+F10, alive only while debug mode is on. */
  useDebugHotkeys();

  /* The trace drawer has two independent reasons to be open: the student is
     debugging, or the student just wants to watch their numbers while they
     work. Plan 2 built the toggle (Task 9's secondaryActions 'trace' entry)
     and deliberately left it unwired for this task to supply the handler. */
  const [traceVisible, setTraceVisible] = useState(false);
  const handleToggleTrace = useCallback(() => setTraceVisible((v) => !v), []);
  const traceOpen = dbg.debugMode || traceVisible;

  /* Task 12: the active assignment's workspace rules, mirrored down from
     WorkspaceRulesEnforcer (rendered below, inside AssignmentProvider) since
     IDELayout's own body cannot read useAssignmentContext() directly — see
     that component's doc comment. Null outside assignment work. */
  const [assignmentRules, setAssignmentRules] = useState(null);
  const hideAdvanced = assignmentRules ? !assignmentRules.advancedBlocks : false;

  /* Task 22: the group baton, mirrored down from BatonChip (rendered in the
     status bar, inside AssignmentProvider) for the same reason the rules
     are. Two things hang off it — the read-only lock below, and the group
     save listener: while the baton is HERE, every local save of this project
     goes into the group's shared row through the group routes (never the
     personal sync engine, which does not own it). Registering the listener
     is itself the permission, so a save can't slip out between polls. */
  const [baton, setBaton] = useState(null);
  const isGroupReadOnly = groupReadOnly(baton);
  const batonGroupId = baton?.groupId ?? null;
  const batonHeld = baton?.held ?? null;
  useEffect(() => {
    if (!batonGroupId || batonHeld !== true || !proj.activeProjectId) return undefined;
    return startGroupSaves(batonGroupId, proj.activeProjectId);
  }, [batonGroupId, batonHeld, proj.activeProjectId]);

  /* Click a variable name in the trace table → light up its block. The ref is
     the SHARED one (SimulationContext), filled by handleWorkspaceReady and —
     since Step 4a — emptied when the workspace is disposed. A null ref must
     read as "no workspace", not as a swallowed exception. */
  const handleHighlightBlock = useCallback((id) => {
    const ws = workspaceRef.current;
    if (!ws) return;
    try { ws.highlightBlock(id); } catch { /* disposed mid-frame */ }
  }, [workspaceRef]);

  /* ── Simple UI handlers (defined here to avoid extra hook) */
  const handleHelp = useCallback(() => setShowHelp(true), [setShowHelp]);

  /* Blockly opens helpUrl by navigating; intercept the hash instead of
     letting it change the route. */
  const [helpBlockId, setHelpBlockId] = useState(null);
  useEffect(() => {
    const onHash = () => {
      const m = /^#\/help\?block=([A-Za-z0-9_]+)$/.exec(window.location.hash);
      if (!m) return;
      setHelpBlockId(m[1]);
      setShowHelp(true);
      // Restore the URL so Help is closable and the route is untouched.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, [setShowHelp]);

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
      const block = ids && ids.length ? ws.getBlockById(ids[ids.length - 1]) : null;
      /* Explicit attach: Tranche 3 removed the adoption loop this used to
         rely on (Task 10). A starter chip is a request to add the block to
         the program, so it goes into SETUP — a block dragged aside does not.
         appendToSetup no-ops on a value block (no previousConnection), like
         the Gravity chip's physics_const_block, so recentre on the visible
         view the same way BlockSearch's insertBlock does (BlocklyWorkspace.js)
         when it was left exactly where domToWorkspace dropped it: (0,0),
         behind the 180px toolbox rail. */
      const attached = block ? appendToSetup(ws, block) : false;
      if (!attached) {
        const metrics = block ? ws.getMetricsManager?.().getViewMetrics(true) : null;
        if (block && metrics) {
          const xy = block.getRelativeToSurfaceXY();
          block.moveBy(
            metrics.left + metrics.width / 2 - xy.x - 40,
            metrics.top + metrics.height / 2 - xy.y - 20,
          );
        }
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
     Help, the trace-promote dialog and the chart overlay. Debug mode is NOT
     one of them any more — it is a mode of this shell, so Run/Stop/Save keep
     working while debugging, and useDebugHotkeys adds Space/F10 beside these
     without colliding with any of them. */
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
    enabled: !showStart && !showHelp && !showTraceDialog && !chartDataset,
    /* One key, one behaviour, matching the single Run/Stop button in the
       viewport header. Previously this was `onRun: sim.handleRun`, so
       Ctrl+Enter during a run called handleRun on a live session and looked
       broken. Booting is deliberately a no-op rather than a stop: the button
       is disabled in that window too, and cancelling a start the student has
       not seen begin is not what the key is for. */
    onRunToggle: sim.booting
      ? undefined
      : sim.running
        ? sim.handleStop
        : sim.handleRun,
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

  /* One drawer, handed to whichever viewport branch is on screen as
     GlowCanvas's child — it docks LATERAL to .canvas-column, never under it. */
  const debugDrawer = traceOpen ? (
    <DebugDrawer
      traceData={traceData}
      onHighlight={handleHighlightBlock}
      onClearTrace={trc.handleClearTrace}
      recording={trc.recording}
      onStartRecord={trc.handleStartRecord}
      onStopRecord={trc.handleStopRecord}
      recordBuffer={recordBufferRef.current}
      onSaveAsDataset={handleSaveAsDataset}
    />
  ) : null;

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
    (projectType === "code_template"  && mode === "blocks") ||
    isGroupReadOnly;   // group work: another member holds the baton (§5.5)

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
        {showHelp && (
          <HelpPage
            focusBlockId={helpBlockId}
            onClose={() => { setShowHelp(false); setHelpBlockId(null); }}
          />
        )}
        {chartDataset && <ChartOverlay dataset={chartDataset} onClose={handleCloseChart} />}
      </>
    );
  }

  /* ── Main IDE shell ──────────────────────────────────── */
  /* Every simulation control, rendered into the viewport's own header. It
     left the app header because the debug group is deliberately
     non-collapsible, so turning debug on forced six more controls into an
     already-full row and squashed the bar. */
  const simControls = (
    <SimControls
      running={running}
      booting={sim.booting}
      onRun={sim.handleRun}
      onStop={sim.handleStop}
      debugMode={dbg.debugMode}
      paused={paused}
      pauseState={dbg.pauseState}
      iteration={iteration}
      recording={trc.recording}
      breakpointCount={dbg.breakpoints.size}
      onPause={dbg.handlePause}
      onResume={dbg.handleResume}
      onStepFrame={dbg.handleStepFrame}
      onStepValue={dbg.handleStep}
      onStartRecord={trc.handleStartRecord}
      onStopRecord={trc.handleStopRecord}
    />
  );

  return (
    <AssignmentProvider projectId={proj.activeProjectId}>
    <div className="app-shell">
      <WorkspaceRulesEnforcer mode={mode} onModeChange={sim.handleModeChange} onRules={setAssignmentRules} lockedMode={lockedMode} />
      <VariableDialog />
      {showHelp && (
        <HelpPage
          focusBlockId={helpBlockId}
          onClose={() => { setShowHelp(false); setHelpBlockId(null); }}
        />
      )}

      <Toolbar
        goal={goal}
        projectTitle={proj.activeManifest?.title || ""}
        onRenameProject={proj.renameProject}
        onSave={handleSaveProject}
        activeProjectId={proj.activeProjectId}
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
        /* ── Debug group — one toolbar, one button vocabulary ── */
        debugMode={dbg.debugMode}
        onDebugMode={dbg.debugMode ? dbg.handleExitDebug : dbg.handleEnterDebug}
        traceVisible={traceVisible}
        onToggleTrace={handleToggleTrace}
        paused={paused}
        pauseState={dbg.pauseState}
        iteration={iteration}
        recording={trc.recording}
        breakpointCount={dbg.breakpoints.size}
        onPause={dbg.handlePause}
        onResume={dbg.handleResume}
        onStepFrame={dbg.handleStepFrame}
        onStepValue={dbg.handleStep}
        onStartRecord={trc.handleStartRecord}
        onStopRecord={trc.handleStopRecord}
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
        {/* ── Brief pane — assignment work only; renders nothing otherwise ── */}
        <BriefPane />

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
                {/* "Block Reference" names the template case specifically; a
                    group member locked out by the baton is looking at the
                    group's own blocks, so it says so instead. */}
                {isGroupReadOnly
                  ? "Blocks (Read Only)"
                  : isReadOnlyView
                  ? "Block Reference (Read Only)"
                  : "Block Editor"}
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
                    /* Task 12: advancedBlocks:false hides the Advanced drawer
                       (display-time filter — utils/blockly/toolbox.js). */
                    hideAdvanced={hideAdvanced}
                    /* Breakpoints live on the EDITABLE workspace now — the
                       read-only mirror DebugMode used to show is gone, so
                       right-click / Alt+click and the dashed "can pause here"
                       outlines belong to the blocks the student is editing. */
                    debugMode={dbg.debugMode}
                    breakpoints={dbg.breakpoints}
                    breakableIds={dbg.breakableIds}
                    isBreakable={dbg.isBreakable}
                    toggleBreakpoint={dbg.toggleBreakpoint}
                    executingBlockId={dbg.executingBlockId}
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
                  : isGroupReadOnly
                  ? "Code (Read Only)"   /* not necessarily GENERATED code — see the blocks pane */
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
                <span className="pane-header__title">
                  <GlobeIcon size={14} /> 3D Viewport
                </span>
                {simControls}
              </div>
              <GlowCanvas running={running} booting={sim.booting} onStatus={setStatus}>
                {debugDrawer}
              </GlowCanvas>
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
              <span className="pane-header__title">
                <GlobeIcon size={14} /> 3D Viewport
              </span>
              {simControls}
            </div>
            <GlowCanvas running={running} booting={sim.booting} onStatus={setStatus}>
              {debugDrawer}
            </GlowCanvas>
          </section>
        )}
      </div>

      {/* ── Status bar — quiet: project · save state · run status ── */}
      <div className="status-bar">
        <span className="status-bar__project" title={proj.activeManifest?.title || ""}>
          {proj.activeManifest?.title || "No project open"}
        </span>
        <SaveState updatedAt={proj.activeManifest?.updatedAt} />
        <RulesChip />
        <BatonChip onBaton={setBaton} />
        <AttributionChip projectId={proj.activeProjectId} />
        <span className="status-bar__spacer" />
        <span
          className={running ? "console-bar console-bar--running" : statusClass}
          title={status.detail ? `${status.text} — ${status.detail}` : status.text}
        >
          {running && <span className="status-dot" />}
          {status.text}
          {/* describeRunError's second sentence, quiet so the title stays the
             thing you read first in a 26px strip. */}
          {status.detail && <span className="console-bar__detail">{status.detail}</span>}
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
    </AssignmentProvider>
  );
}
