import React, { useRef } from "react";
import {
  PlayIcon,
  StopIcon,
  DownloadIcon,
  UploadIcon,
  TrashIcon,
  RefreshIcon,
  SunIcon,
  MoonIcon,
  AtomIcon,
  HelpIcon,
  FileCodeIcon,
  FileBlocksIcon,
  FilePdfIcon,
  ImageIcon,
  CopyIcon,
  ZoomInIcon,
  ZoomOutIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  TableIcon,
  BugIcon,
  SaveIcon,
  MenuIcon,
} from "./Icons";
import { MOD_LABEL } from "../utils/hotkeys";
import DropdownMenu from "./common/DropdownMenu";
import ProjectTitle from "./layout/ProjectTitle";
import HeaderAccount from "./auth/HeaderAccount";

/* ── Zoom slider component ───────────────────────────────── */
function ZoomSlider({ value, onChange, min = 35, max = 200 }) {
  const pct = Math.round(value);
  return (
    <div className="tb-zoom" title={`Zoom: ${pct}%`}>
      <button
        type="button"
        className="tb-btn tb-btn--icon"
        onClick={() => onChange(Math.max(min, value - 10))}
        title="Zoom out"
      >
        <ZoomOutIcon size={13} />
      </button>
      <input
        type="range"
        className="tb-zoom-slider"
        min={min}
        max={max}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <button
        type="button"
        className="tb-btn tb-btn--icon"
        onClick={() => onChange(Math.min(max, value + 10))}
        title="Zoom in"
      >
        <ZoomInIcon size={13} />
      </button>
      <span className="tb-zoom-label">{pct}%</span>
    </div>
  );
}

function Toolbar({
  onRun,
  onStop,
  onExportPy,
  onExportBlocks,
  onExportBlocksPdf,
  onExportCodePdf,
  onExportScreenshot,
  onCopyCode,
  onImport,
  onExportProject,
  onImportProject,
  onReset,
  onClearWorkspace,
  onToggleTheme,
  onHome,
  onHelp,
  onToggleViewport,
  traceVisible,
  onToggleTrace,
  onDebugMode,
  isDark,
  running,
  mode,
  zoom,
  onZoomChange,
  viewportHidden,
  goal = "physics",
  projectTitle,
  onRenameProject,
  onSave,
  children,
}) {
  /* ── Capability flags driven by the project goal (Phase B.8).
     The toolbar only renders actions that make sense for the active goal.
     Physics and Hybrid show simulation controls; pure Data Science does
     not. Phase C will populate DS-specific actions in this same slot. */
  const showSimActions = goal === "physics" || goal === "hybrid";
  const importInputRef = useRef(null);
  const importProjectRef = useRef(null);

  const handleImportClick = () => {
    if (importInputRef.current) {
      importInputRef.current.value = "";
      importInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && onImport) onImport(file);
  };

  const handleImportProjectClick = () => {
    if (importProjectRef.current) {
      importProjectRef.current.value = "";
      importProjectRef.current.click();
    }
  };

  const handleImportProjectChange = (e) => {
    const file = e.target.files[0];
    if (file && onImportProject) onImportProject(file);
  };
  return (
    <header className="app-header">
      {/* ── Identity: menu · brand · project ── */}
      <div className="app-header__identity">
        <button type="button" className="tb-btn tb-btn--nav" onClick={onHome} title="Back to Start Menu">
          <MenuIcon size={14} />
          <span className="tb-btn-label">Menu</span>
        </button>
        <span className="toolbar-logo" aria-hidden="true">
          <AtomIcon size={16} />
          <span className="toolbar-logo-text">Physics<span>IDE</span></span>
        </span>
        <span className="app-header__sep" />
        <ProjectTitle title={projectTitle} onRename={onRenameProject} />
      </div>

      {/* ── Zone 1 — primary: run/stop and the editor mode ── */}
      <div className="app-header__zone app-header__zone--primary">
        {showSimActions && (
          <>
            <button type="button" className="tb-btn tb-btn--run" onClick={onRun} title="Run simulation (Ctrl+Enter)">
              <PlayIcon size={13} />
              <span className="tb-btn-label">Run</span>
              <kbd className="tb-kbd">{MOD_LABEL}+Enter</kbd>
            </button>
            <button
              type="button"
              className={`tb-btn tb-btn--stop${running ? "" : " tb-btn--disabled"}`}
              onClick={running ? onStop : undefined}
              disabled={!running}
              title={running ? "Stop simulation" : "No simulation running"}
            >
              <StopIcon size={13} />
              <span className="tb-btn-label">Stop</span>
            </button>
          </>
        )}
        {children}
      </div>

      {/* ── Zone 2 — view: zoom, panes, debug ── */}
      <div className="app-header__zone app-header__zone--view">
        {mode === "blocks" && zoom != null && onZoomChange && (
          <ZoomSlider value={zoom} onChange={onZoomChange} />
        )}
        {showSimActions && onToggleViewport && (
          <button
            type="button"
            className="tb-btn tb-btn--subtle tb-btn--secondary"
            onClick={onToggleViewport}
            title={viewportHidden ? "Show 3D viewport" : "Hide 3D viewport"}
          >
            {viewportHidden ? <PanelRightOpenIcon size={13} /> : <PanelRightCloseIcon size={13} />}
            <span className="tb-btn-label">{viewportHidden ? "Show" : "Hide"}</span>
          </button>
        )}
        {showSimActions && onToggleTrace && (
          <button
            type="button"
            className={`tb-btn tb-btn--subtle tb-btn--secondary${traceVisible ? " tb-btn--active" : ""}`}
            onClick={onToggleTrace}
            title={traceVisible ? "Hide live trace table" : "Show live trace table"}
          >
            <TableIcon size={13} />
            <span className="tb-btn-label">Trace</span>
          </button>
        )}
        {showSimActions && onDebugMode && (
          <button
            type="button"
            className="tb-btn tb-btn--subtle tb-btn--secondary"
            onClick={onDebugMode}
            title="Open Debug Mode — step-through, breakpoints, recording"
          >
            <BugIcon size={13} />
            <span className="tb-btn-label">Debug</span>
          </button>
        )}
      </div>

      {/* ── Zone 3 — file: save, workspace, import/export ── */}
      <div className="app-header__zone app-header__zone--file">
        {onSave && (
          <button type="button" className="tb-btn tb-btn--secondary" onClick={onSave} title={`Save this project (${MOD_LABEL}+S)`}>
            <SaveIcon size={13} />
            <span className="tb-btn-label">Save</span>
          </button>
        )}
        <button type="button" className="tb-btn tb-btn--subtle tb-btn--secondary" onClick={onReset} title="Return to the block editor">
          <RefreshIcon size={13} />
          <span className="tb-btn-label">Back to Blocks</span>
        </button>
        {mode === "blocks" && onClearWorkspace && (
          <button type="button" className="tb-btn tb-btn--danger tb-btn--secondary" onClick={onClearWorkspace} title="Clear all blocks">
            <TrashIcon size={13} />
            <span className="tb-btn-label">Clear</span>
          </button>
        )}

        <input ref={importInputRef} type="file" accept=".py,.xml" style={{ display: "none" }} onChange={handleFileChange} />
        <input ref={importProjectRef} type="file" accept=".json,.physide.json" style={{ display: "none" }} onChange={handleImportProjectChange} />

        <DropdownMenu
          align="right"
          title="File — import and export"
          trigger={
            <>
              <DownloadIcon size={13} />
              <span className="tb-btn-label">File</span>
            </>
          }
        >
          {onImport ? (
            <button type="button" className="tb-dropdown-item" onClick={handleImportClick}>
              <UploadIcon size={14} />
              <span>Import blocks or Python (.py, .xml)</span>
            </button>
          ) : null}
          {onImportProject ? (
            <button type="button" className="tb-dropdown-item" onClick={handleImportProjectClick}>
              <UploadIcon size={14} />
              <span>Open project bundle (.physide.json)</span>
            </button>
          ) : null}
          <div className="tb-dropdown-divider" />
          <button type="button" className="tb-dropdown-item" onClick={onExportPy}>
            <FileCodeIcon size={14} />
            <span>Export as Python (.py)</span>
          </button>
          <button type="button" className="tb-dropdown-item" onClick={onExportBlocks}>
            <FileBlocksIcon size={14} />
            <span>Export Blocks (.xml)</span>
          </button>
          <button type="button" className="tb-dropdown-item" onClick={onExportCodePdf}>
            <FilePdfIcon size={14} />
            <span>Code as PDF</span>
          </button>
          <button type="button" className="tb-dropdown-item" onClick={onExportBlocksPdf}>
            <FilePdfIcon size={14} />
            <span>Blocks as PDF</span>
          </button>
          {onExportScreenshot ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportScreenshot}>
              <ImageIcon size={14} />
              <span>Screenshot Viewport (.png)</span>
            </button>
          ) : null}
          {onCopyCode ? (
            <button type="button" className="tb-dropdown-item" onClick={onCopyCode}>
              <CopyIcon size={14} />
              <span>Copy Code to Clipboard</span>
            </button>
          ) : null}
          {onExportProject ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportProject}>
              <DownloadIcon size={14} />
              <span>Export Project Bundle (.physide.json)</span>
            </button>
          ) : null}
        </DropdownMenu>

        <button type="button" className="tb-btn tb-btn--icon tb-btn--theme" onClick={onToggleTheme}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
          {isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
        </button>
        <button type="button" className="tb-btn tb-btn--nav tb-btn--secondary" onClick={onHelp} title="Help & Documentation">
          <HelpIcon size={14} />
          <span className="tb-btn-label">Help</span>
        </button>
      </div>

      {/* ── Account ── */}
      <div className="app-header__account">
        <HeaderAccount />
      </div>
    </header>
  );
}

export default Toolbar;
