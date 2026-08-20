import React, { useState, useRef, useEffect } from "react";
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
  HomeIcon,
  HelpIcon,
  FileCodeIcon,
  FileBlocksIcon,
  FilePdfIcon,
  ImageIcon,
  CopyIcon,
  ChevronDownIcon,
  ZoomInIcon,
  ZoomOutIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  TableIcon,
  BugIcon,
} from "./Icons";

/* ── Dropdown menu component ─────────────────────────────── */
function DropdownMenu({ trigger, children, align = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="tb-dropdown" ref={ref}>
      <button
        type="button"
        className="tb-btn tb-btn--dropdown"
        onClick={() => setOpen((o) => !o)}
        title="Export options"
      >
        {trigger}
        <ChevronDownIcon size={10} />
      </button>
      {open && (
        <div className={`tb-dropdown-menu ${align === "right" ? "tb-dropdown-menu--right" : ""}`}>
          {React.Children.map(children, (child) =>
            child
              ? React.cloneElement(child, {
                  onClick: (...args) => {
                    setOpen(false);
                    child.props.onClick?.(...args);
                  },
                })
              : null
          )}
        </div>
      )}
    </div>
  );
}

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
    <header className="toolbar">
      {/* ── Brand ── */}
      <div className="toolbar-logo">
        <AtomIcon size={18} />
        <span className="toolbar-logo-text">
          Physics<span>IDE</span>
        </span>
      </div>

      <div className="tb-separator" />

      {/* ── Navigation ── */}
      <button type="button" className="tb-btn tb-btn--nav" onClick={onHome} title="Back to Start Menu">
        <HomeIcon size={14} />
        <span className="tb-btn-label">Menu</span>
      </button>
      <button type="button" className="tb-btn tb-btn--nav" onClick={onHelp} title="Help & Documentation">
        <HelpIcon size={14} />
        <span className="tb-btn-label">Help</span>
      </button>

      {showSimActions && (
        <>
          <div className="tb-separator" />

          {/* ── Simulation controls (physics / hybrid) ── */}
          <div className="tb-group tb-group--sim">
            <button type="button" className="tb-btn tb-btn--run" onClick={onRun} title="Run simulation (Ctrl+Enter)">
              <PlayIcon size={13} />
              <span className="tb-btn-label">Run</span>
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
          </div>
        </>
      )}

      <div className="tb-separator" />

      {/* ── Workspace actions ── */}
      <button type="button" className="tb-btn tb-btn--subtle" onClick={onReset} title="Reset to blocks mode">
        <RefreshIcon size={13} />
        <span className="tb-btn-label">Reset</span>
      </button>
      {mode === "blocks" && onClearWorkspace && (
        <button type="button" className="tb-btn tb-btn--danger" onClick={onClearWorkspace} title="Clear all blocks">
          <TrashIcon size={13} />
          <span className="tb-btn-label">Clear</span>
        </button>
      )}

      <div className="tb-separator" />

      {/* ── Mode toggle (injected by parent) ── */}
      {children}

      {/* ── Spacer ── */}
      <div className="toolbar-spacer" />

      {/* ── Zoom slider ── */}
      {mode === "blocks" && zoom != null && onZoomChange && (
        <>
          <ZoomSlider value={zoom} onChange={onZoomChange} />
          <div className="tb-separator" />
        </>
      )}

      {/* ── Viewport toggle (physics / hybrid) ── */}
      {showSimActions && onToggleViewport && (
        <button
          type="button"
          className="tb-btn tb-btn--subtle"
          onClick={onToggleViewport}
          title={viewportHidden ? "Show 3D viewport" : "Hide 3D viewport"}
        >
          {viewportHidden ? <PanelRightOpenIcon size={13} /> : <PanelRightCloseIcon size={13} />}
          <span className="tb-btn-label">{viewportHidden ? "Show" : "Hide"}</span>
        </button>
      )}

      {/* ── Live trace table toggle (physics / hybrid) ── */}
      {showSimActions && onToggleTrace && (
        <button
          type="button"
          className={`tb-btn tb-btn--subtle${traceVisible ? " tb-btn--active" : ""}`}
          onClick={onToggleTrace}
          title={traceVisible ? "Hide live trace table" : "Show live trace table"}
        >
          <TableIcon size={13} />
          <span className="tb-btn-label">Trace</span>
        </button>
      )}

      {/* ── Debug Mode button (physics / hybrid) ── */}
      {showSimActions && onDebugMode && (
        <button
          type="button"
          className="tb-btn tb-btn--subtle"
          onClick={onDebugMode}
          title="Open Debug Mode — step-through, breakpoints, recording"
        >
          <BugIcon size={13} />
          <span className="tb-btn-label">Debug</span>
        </button>
      )}

      <div className="tb-separator" />

      {/* ── Import button ── */}
      {onImport && (
        <>
          <input
            ref={importInputRef}
            type="file"
            accept=".py,.xml"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="tb-btn tb-btn--subtle"
            onClick={handleImportClick}
            title="Import a .py or .xml file from a previous session"
          >
            <UploadIcon size={13} />
            <span className="tb-btn-label">Import</span>
          </button>
        </>
      )}

      {/* ── Import Project (.physide.json) ── */}
      {onImportProject && (
        <>
          <input
            ref={importProjectRef}
            type="file"
            accept=".json,.physide.json"
            style={{ display: "none" }}
            onChange={handleImportProjectChange}
          />
          <button
            type="button"
            className="tb-btn tb-btn--subtle"
            onClick={handleImportProjectClick}
            title="Import a .physide.json project bundle"
          >
            <UploadIcon size={13} />
            <span className="tb-btn-label">Open…</span>
          </button>
        </>
      )}

      {/* ── Export dropdown ── */}
      <DropdownMenu
        trigger={
          <>
            <DownloadIcon size={13} />
            <span className="tb-btn-label">Export</span>
          </>
        }
        align="right"
      >
        <button type="button" className="tb-dropdown-item" onClick={onExportPy}>
          <FileCodeIcon size={14} />
          <span>Export as Python (.py)</span>
          <span className="tb-dropdown-shortcut">Ctrl+S</span>
        </button>
        <button type="button" className="tb-dropdown-item" onClick={onExportBlocks}>
          <FileBlocksIcon size={14} />
          <span>Export Blocks (.xml)</span>
        </button>
        <div className="tb-dropdown-divider" />
        <button type="button" className="tb-dropdown-item" onClick={onExportCodePdf}>
          <FilePdfIcon size={14} />
          <span>Code as PDF</span>
        </button>
        <button type="button" className="tb-dropdown-item" onClick={onExportBlocksPdf}>
          <FilePdfIcon size={14} />
          <span>Blocks as PDF</span>
        </button>
        {onExportScreenshot && (
          <>
            <div className="tb-dropdown-divider" />
            <button type="button" className="tb-dropdown-item" onClick={onExportScreenshot}>
              <ImageIcon size={14} />
              <span>Screenshot Viewport (.png)</span>
            </button>
          </>
        )}
        {onCopyCode && (
          <>
            <div className="tb-dropdown-divider" />
            <button type="button" className="tb-dropdown-item" onClick={onCopyCode}>
              <CopyIcon size={14} />
              <span>Copy Code to Clipboard</span>
              <span className="tb-dropdown-shortcut">Ctrl+C</span>
            </button>
          </>
        )}
        {onExportProject && (
          <>
            <div className="tb-dropdown-divider" />
            <button type="button" className="tb-dropdown-item" onClick={onExportProject}>
              <DownloadIcon size={14} />
              <span>Export Project Bundle (.physide.json)</span>
            </button>
          </>
        )}
      </DropdownMenu>

      <div className="tb-separator" />

      {/* ── Theme toggle ── */}
      <button
        type="button"
        className="tb-btn tb-btn--icon tb-btn--theme"
        onClick={onToggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
      </button>
    </header>
  );
}

export default Toolbar;
