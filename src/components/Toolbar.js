import React from "react";
import {
  PlayIcon,
  StopIcon,
  DownloadIcon,
  PackageIcon,
  RefreshIcon,
  SunIcon,
  MoonIcon,
  AtomIcon,
  HomeIcon,
  FileTextIcon,
  HelpIcon,
} from "./Icons";

function Toolbar({
  onRun,
  onStop,
  onExportPy,
  onExportBlocks,
  onExportBlocksPdf,
  onExportCodePdf,
  onReset,
  onToggleTheme,
  onHome,
  onHelp,
  isDark,
  running,
  children,
}) {
  return (
    <header className="toolbar">
      <div className="toolbar-logo">
        <AtomIcon size={18} />
        <span className="toolbar-logo-text">
          Physics<span>IDE</span>
        </span>
      </div>

      <div className="tb-separator" />

      <button
        type="button"
        className="tb-btn tb-btn--home"
        onClick={onHome}
        title="Back to Start Menu"
      >
        <HomeIcon size={14} /> Menu
      </button>

      <button
        type="button"
        className="tb-btn tb-btn--help"
        onClick={onHelp}
        title="Open Help & Documentation"
      >
        <HelpIcon size={14} /> Help
      </button>

      <div className="tb-separator" />

      <button type="button" className="tb-btn tb-btn--run" onClick={onRun}>
        <PlayIcon size={14} /> Run
      </button>
      <button
        type="button"
        className={`tb-btn tb-btn--stop${running ? "" : " tb-btn--disabled"}`}
        onClick={running ? onStop : undefined}
        disabled={!running}
        title={running ? "Stop simulation" : "No simulation running"}
      >
        <StopIcon size={14} /> Stop
      </button>

      <div className="tb-separator" />

      <button type="button" className="tb-btn" onClick={onExportPy}>
        <DownloadIcon size={14} /> .py
      </button>
      <button type="button" className="tb-btn" onClick={onExportBlocks}>
        <PackageIcon size={14} /> .xml
      </button>
      <button type="button" className="tb-btn tb-btn--pdf" onClick={onExportBlocksPdf}>
        <FileTextIcon size={14} /> Blocks PDF
      </button>
      <button type="button" className="tb-btn tb-btn--pdf" onClick={onExportCodePdf}>
        <FileTextIcon size={14} /> Code PDF
      </button>
      <button
        type="button"
        className="tb-btn tb-btn--danger"
        onClick={onReset}
      >
        <RefreshIcon size={14} /> Reset
      </button>

      <div className="toolbar-spacer" />
      {children}

      <button
        type="button"
        className="tb-btn tb-btn--theme"
        onClick={onToggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <SunIcon size={14} /> : <MoonIcon size={14} />}
      </button>
    </header>
  );
}

export default Toolbar;
