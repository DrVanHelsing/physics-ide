import React, { useState, useRef, useEffect } from "react";
import {
  PlayIcon,
  StopIcon,
  DownloadIcon,
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
  onReset,
  onClearWorkspace,
  onToggleTheme,
  onHome,
  onHelp,
  isDark,
  running,
  mode,
  zoom,
  onZoomChange,
  children,
}) {
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

      <div className="tb-separator" />

      {/* ── Simulation controls ── */}
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
