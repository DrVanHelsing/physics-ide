import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DownloadIcon,
  UploadIcon,
  TrashIcon,
  RefreshIcon,
  AtomIcon,
  HelpIcon,
  FileCodeIcon,
  FileBlocksIcon,
  FilePdfIcon,
  ImageIcon,
  CopyIcon,
  ShareIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  TableIcon,
  BugIcon,
  SaveIcon,
  MenuIcon,
  MoreHorizontalIcon,
  HistoryIcon,
} from "./Icons";
import { MOD_LABEL } from "../utils/hotkeys";
import DropdownMenu from "./common/DropdownMenu";
import ProjectTitle from "./layout/ProjectTitle";
import ThemeToggleButton from "./layout/ThemeToggleButton";
import NotificationBell from "./layout/NotificationBell";
import HeaderAccount from "./auth/HeaderAccount";
import ShareDialog from "./sharing/ShareDialog";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useMe } from "../auth/useAuth";
import { useAssignmentContext } from "../contexts/AssignmentContext";
import { visibleControls } from "../utils/toolbar/visibleControls";

/* Thresholds chosen against the 1024px floor so stage 2 is active *at* the
   floor, not below it. Exported so the tests, this component and the CSS
   in styles.css all agree on one number. */
export const HEADER_STAGE1_QUERY = "(max-width: 1280px)";
export const HEADER_STAGE2_QUERY = "(max-width: 1120px)";

function Toolbar({
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
  booting,
  mode,
  viewportHidden,
  goal = "physics",
  projectTitle,
  onRenameProject,
  onSave,
  /* Task 20: the active project's id, so fileMenu's History item knows
     where to navigate — the only Toolbar prop History needs, since the
     route itself (HistoryPage.js) resolves everything else. */
  activeProjectId,
  /* Debug is a MODE of this shell, not a separate screen. `debugMode` stays
     because visibleControls() keys the `trace`/`debug` view-zone entries off
     it; the debug CONTROLS themselves moved to SimControls. */
  debugMode = false,
  children,
}) {
  const stage1 = useMediaQuery(HEADER_STAGE1_QUERY);
  const stage2 = useMediaQuery(HEADER_STAGE2_QUERY);
  const importInputRef = useRef(null);
  const importProjectRef = useRef(null);
  const [shareOpen, setShareOpen] = useState(false);

  /* ── Adaptive header (Plan 3, Task 10): every control's existence is
     decided in one pure place — visibleControls() — instead of scattered
     `showX &&` conditionals here. This component only supplies the axes
     and renders whatever comes back. */
  const { data: me } = useMe();
  const navigate = useNavigate();
  const role = me ? me.role : "guest";
  const isTeacher = me?.isTeacher ?? false;
  const runState = booting ? "booting" : running ? "running" : "idle";
  /* Task 12: a teacher's per-assignment rules. Null outside assignment work —
     null context or null rules is exactly today's behaviour everywhere it
     touches (visibleControls' own contract, proven in its invariant suite).
     `editors`/`debug` are key-level (visibleControls itself); import/export
     are item-level, just below — save/fileMenu themselves must always stay. */
  const assignment = useAssignmentContext();
  const rules = assignment?.rules ?? null;
  const zones = visibleControls({ mode, goal, role, isTeacher, runState, debugMode, traceVisible, rules });
  /* Compute both group flags before rendering the divider between them — a
     dangling divider (one side hidden, the other not) is the trap here. */
  const importsAllowed = !rules || rules.importFiles;
  const exportsAllowed = !rules || rules.exportAndCopy;

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

  /* ── Primary- and file-zone controls: each key renders its own JSX
     directly — today's markup, relocated verbatim, not redesigned. A
     renderer may still return null for a key the matrix says exists but
     whose handler prop was never supplied (e.g. `save` without `onSave`).
     `signIn`/`account` have no entry here — HeaderAccount (below, in its
     own always-rendered slot) owns that internals; the key only exists so
     the matrix records which wrapper state Toolbar conceptually asked for. */
  const CONTROL_RENDERERS = {
    /* `run` and `stop` used to render here. Every simulation control lives in
       the viewport pane header now — see components/SimControls.js. */
    modeToggle: () => children ?? null,
    save: () =>
      onSave ? (
        <button
          type="button"
          className="tb-btn tb-btn--secondary tb-btn--save"
          onClick={onSave}
          title={`Save this project (${MOD_LABEL}+S)`}
        >
          <SaveIcon size={13} />
          <span className="tb-btn-label">Save</span>
        </button>
      ) : null,
    fileMenu: () => (
      <>
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
          {importsAllowed && onImport ? (
            <button type="button" className="tb-dropdown-item" onClick={handleImportClick}>
              <UploadIcon size={14} />
              <span>Import blocks or Python (.py, .xml)</span>
            </button>
          ) : null}
          {importsAllowed && onImportProject ? (
            <button type="button" className="tb-dropdown-item" onClick={handleImportProjectClick}>
              <UploadIcon size={14} />
              <span>Open project bundle (.physide.json)</span>
            </button>
          ) : null}
          {/* Both group flags are computed above, before either group
             renders — a divider with one side hidden by rules (only imports,
             only exports, or both) would otherwise dangle. */}
          {importsAllowed && exportsAllowed ? <div className="tb-dropdown-divider" /> : null}
          {/* DropdownMenu clones each direct child to inject role="menuitem"
             and its close-on-select onClick (React.Children.map over its own
             `children` prop) — a Fragment grouping these four would receive
             that clone instead of the buttons inside it, so each stays its
             own top-level child rather than sharing one `exportsAllowed &&`
             wrapper. */}
          {exportsAllowed ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportPy}>
              <FileCodeIcon size={14} />
              <span>Export as Python (.py)</span>
            </button>
          ) : null}
          {exportsAllowed ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportBlocks}>
              <FileBlocksIcon size={14} />
              <span>Export Blocks (.xml)</span>
            </button>
          ) : null}
          {exportsAllowed ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportCodePdf}>
              <FilePdfIcon size={14} />
              <span>Code as PDF</span>
            </button>
          ) : null}
          {exportsAllowed ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportBlocksPdf}>
              <FilePdfIcon size={14} />
              <span>Blocks as PDF</span>
            </button>
          ) : null}
          {exportsAllowed && onExportScreenshot ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportScreenshot}>
              <ImageIcon size={14} />
              <span>Screenshot Viewport (.png)</span>
            </button>
          ) : null}
          {exportsAllowed && onCopyCode ? (
            <button type="button" className="tb-dropdown-item" onClick={onCopyCode}>
              <CopyIcon size={14} />
              <span>Copy Code to Clipboard</span>
            </button>
          ) : null}
          {exportsAllowed && onExportProject ? (
            <button type="button" className="tb-dropdown-item" onClick={onExportProject}>
              <DownloadIcon size={14} />
              <span>Export Project Bundle (.physide.json)</span>
            </button>
          ) : null}
          {/* Plan 7 Task 11: Share… — a share is a copy-out (D§5.3), so it
             rides the same exportsAllowed gate as its siblings above, plus
             three axes only assignment work supplies: signed-in, a project
             open, not group work, not individual work. Refused means ABSENT,
             not disabled (D§5.4 — no greyed-out temptations); the server
             re-refuses all five server-side regardless of what this client
             gate decided. */}
          {me && activeProjectId && exportsAllowed && !assignment?.groupId && !assignment?.individualWork ? (
            <button type="button" className="tb-dropdown-item" onClick={() => setShareOpen(true)}>
              <ShareIcon size={14} />
              <span>Share…</span>
            </button>
          ) : null}
          {/* Task 20: History & restore — signed-in users only (me from
             useMe), gated on there being a project to show history for.
             Deliberately NOT gated by exportsAllowed: restoring your own
             past work back into your own project is not an export, it's
             the same "manage my own save history" action Save already is,
             so a locked assignment's exportAndCopy:false must not hide it. */}
          {me && activeProjectId ? (
            <>
              {(importsAllowed || exportsAllowed) ? <div className="tb-dropdown-divider" /> : null}
              <button
                type="button"
                className="tb-dropdown-item"
                onClick={() => navigate(`/history/${activeProjectId}`)}
              >
                <HistoryIcon size={14} />
                <span>History &amp; restore</span>
              </button>
            </>
          ) : null}
        </DropdownMenu>
      </>
    ),
    themeToggle: () => <ThemeToggleButton isDark={isDark} onToggle={onToggleTheme} />,
  };

  /** Render a zone's key list through CONTROL_RENDERERS, in matrix order. */
  const renderZone = (keys) =>
    keys.map((key) => {
      const render = CONTROL_RENDERERS[key];
      const node = render ? render() : null;
      return node != null ? <React.Fragment key={key}>{node}</React.Fragment> : null;
    });

  /* ── View-zone controls: the same descriptor draws twice — an inline
     button above the fold, a dropdown item once the header collapses to
     stage 2 — so these stay data (label/short/icon/onClick), not JSX.
     zones.view is the sole source of which keys exist and in what order;
     a descriptor still resolves to nothing when its handler prop is
     absent (the `trace`/`debug` reserved slots Plan 4 fills later). */
  const VIEW_DESCRIPTORS = {
    viewport: onToggleViewport && {
      key: "viewport",
      label: viewportHidden ? "Show 3D viewport" : "Hide 3D viewport",
      short: viewportHidden ? "Show" : "Hide",
      icon: viewportHidden ? PanelRightOpenIcon : PanelRightCloseIcon,
      onClick: onToggleViewport,
    },
    /* Plan 1 deferred this toggle and Plan 2 Task 9 Step 3 deliberately kept
       it unwired — "Plan 4 revives .debug-drawer … and supplies exactly this
       handler". Task 17 supplies it: the drawer has two independent reasons to
       be open, and watching your numbers is not the same gesture as stepping
       through them. */
    trace: onToggleTrace && {
      key: "trace",
      label: traceVisible ? "Hide live trace table" : "Show live trace table",
      short: "Trace",
      icon: TableIcon,
      onClick: onToggleTrace,
      active: traceVisible,
    },
    debug: onDebugMode && {
      key: "debug",
      label: debugMode
        ? "Leave Debug Mode — the simulation keeps running"
        : "Open Debug Mode — step-through, breakpoints, recording",
      short: debugMode ? "Exit Debug" : "Debug",
      icon: BugIcon,
      onClick: onDebugMode,
      active: debugMode,
    },
    reset: onReset && {
      key: "reset",
      label: "Return to the block editor",
      short: "Back to Blocks",
      icon: RefreshIcon,
      onClick: onReset,
    },
    clear: onClearWorkspace && {
      key: "clear",
      label: "Clear all blocks",
      short: "Clear",
      icon: TrashIcon,
      onClick: onClearWorkspace,
      danger: true,
    },
    help: onHelp && { key: "help", label: "Help & Documentation", short: "Help", icon: HelpIcon, onClick: onHelp },
  };
  const secondaryActions = zones.view.map((key) => VIEW_DESCRIPTORS[key]).filter(Boolean);

  return (
    <>
    <header className={`app-header${stage1 ? " app-header--stage1" : ""}${stage2 ? " app-header--stage2" : ""}`}>
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
      <div className="app-header__zone app-header__zone--primary">{renderZone(zones.primary)}</div>

      {/* ── Zone 2 — view: panes, debug and the collapsible controls ── */}
      <div className="app-header__zone app-header__zone--view">
        {!stage2 &&
          secondaryActions.map((a) => (
            <button
              key={a.key}
              type="button"
              className={`tb-btn tb-btn--secondary ${a.danger ? "tb-btn--danger" : "tb-btn--subtle"}${a.active ? " tb-btn--active" : ""}`}
              onClick={a.onClick}
              title={a.label}
            >
              <a.icon size={13} />
              <span className="tb-btn-label">{a.short}</span>
            </button>
          ))}
        {stage2 && (
          <DropdownMenu
            align="right"
            title="More actions"
            triggerAriaLabel="More actions"
            triggerClassName="tb-btn tb-btn--subtle tb-btn--overflow"
            chevron={false}
            trigger={<MoreHorizontalIcon size={16} />}
          >
            {secondaryActions.map((a) => (
              <button key={a.key} type="button" className="tb-dropdown-item" onClick={a.onClick}>
                <a.icon size={14} />
                <span>{a.short}</span>
                <span className="tb-dropdown-shortcut">{a.label}</span>
              </button>
            ))}
          </DropdownMenu>
        )}

        {/* The debug group (Pause / Next frame / Next value / Record and the
           two chips) used to render here behind a bare `{debugMode && …}`.
           It was deliberately non-collapsible — a student mid-step must not
           lose Next frame into an overflow menu — so turning debug on forced
           six more controls into an already-full row and squashed the bar.
           It moved to the viewport pane header with the rest of the sim
           controls; see components/SimControls.js. */}
      </div>

      {/* ── Zone 3 — file: save, workspace, import/export ── */}
      <div className="app-header__zone app-header__zone--file">{renderZone(zones.file)}</div>

      {/* ── Account ── */}
      <div className="app-header__account">
        <NotificationBell />
        <HeaderAccount />
      </div>
    </header>
    {shareOpen && <ShareDialog projectId={activeProjectId} onClose={() => setShareOpen(false)} />}
    </>
  );
}

export default Toolbar;
