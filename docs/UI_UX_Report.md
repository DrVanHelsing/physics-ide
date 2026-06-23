# Physics IDE — UI/UX Audit Report

**Scope:** Full UI/UX visual and interaction audit
**Method:** Live app walkthrough (localhost:3000) + codebase analysis
**Coverage:** Physics workflow, Data Science workflow, Hybrid workflow, Debug mode, Export, Help, Start Menu, Theme toggle, Goal-filtered toolbox, DataPanel

---

## Table of Contents

1. [Design System Overview](#1-design-system-overview)
2. [Start Menu](#2-start-menu)
3. [Toolbar](#3-toolbar)
4. [Code Editor](#4-code-editor)
5. [Block Editor & Goal-Filtered Toolbox](#5-block-editor--goal-filtered-toolbox)
6. [3D Viewport (Physics & Hybrid)](#6-3d-viewport-physics--hybrid)
7. [DataPanel (Data Science & Hybrid)](#7-datapanel-data-science--hybrid)
8. [Debug Mode](#8-debug-mode)
9. [Export System](#9-export-system)
10. [Help & Documentation](#10-help--documentation)
11. [Theme System (Light/Dark)](#11-theme-system-lightdark)
12. [Cross-Mode Navigation](#12-cross-mode-navigation)
13. [Accessibility & Responsiveness](#13-accessibility--responsiveness)
14. [Issue Summary](#14-issue-summary)
15. [Recommendations Summary](#15-recommendations-summary)

---

## 1. Design System Overview

### Visual Language

Physics IDE uses a **VS Code Dark+ inspired design system** as its primary aesthetic. The execution is polished and consistent throughout.

| Token | Value | Notes |
|-------|-------|-------|
| `--accent` | `#007acc` (VS Code blue) | Buttons, underlines, status bar |
| `--toolbar-h` | `38px` | Compact but functional |
| `--titlebar-h` | `30px` | Thin centred title strip |
| `--statusbar-h` | `22px` | Bottom VS Code–style bar |
| `--radius` | `4px` | Subtle, consistent corners |
| UI Font | Inter | Clean, modern sans-serif |
| Code Font | JetBrains Mono | Appropriate monospace choice |
| Dark default | `:root` | Dark is the primary intended theme |
| Light variant | `[data-theme="light"]` | Applied via toggle |

### Layering & Surface Model

The app uses a VS Code-inspired surface layering approach — dark backgrounds with semi-transparent panel overlays and subtle border lines. This works very well in dark mode. Light mode uses the same token system with inverted values, producing a clean light interface that mirrors the VS Code Light+ aesthetic.

### Component Architecture

```
ThemeProvider
  └── SimulationProvider
        └── ProjectProvider
              └── DebugProvider
                    └── TraceProvider
                          └── ErrorBoundary
                                └── IDELayout
                                      ├── StartMenu (conditional)
                                      ├── DebugMode (conditional)
                                      └── Main Shell
                                            ├── TitleBar
                                            ├── Toolbar
                                            ├── .main-layout
                                            │     ├── .editor-pane (Monaco / Blockly)
                                            │     ├── .pane-divider (draggable)
                                            │     └── .canvas-pane
                                            │           ├── Physics: GlowCanvas
                                            │           ├── DS: DataPanel
                                            │           └── Hybrid: GlowCanvas + DataPanel
                                            └── StatusBar
```

**Verdict:** The architecture is clean, well-separated, and appropriate for the feature set. Context layering maps logically to UI surface areas.

---

## 2. Start Menu

### What Works Well

- **Project list** with per-project goal badges (Physics / Data Science / Hybrid) and rename/delete controls gives returning users immediate access to their work.
- **New Project Wizard** with goal selection, template picker, and project name field creates a structured creation flow that makes the goal concept explicit from the start.
- **Template cards** have unique accent colours, clear badges, title, and description. Cards are scannable.
- **Goal-card grid** at the top of the wizard makes the three goals visually distinct.
- **Dark mode start menu** has strong card contrast.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| S-01 | Medium | The **New Blank Project** option requires going through the wizard — there is no single-click shortcut for an empty canvas. First-time users may not immediately find it. |
| S-02 | Low | No keyboard navigation between template cards — mouse-only interaction. |
| S-03 | Low | No "recently modified" sort order for the project list — projects appear in creation order. |

---

## 3. Toolbar

The toolbar is a single 38px horizontal strip containing 13–15 interactive elements depending on goal and mode.

### Button Inventory (left → right)

| Group | Buttons | Always Visible? |
|-------|---------|----------------|
| Navigation | Logo/Home, Menu, Help | Yes |
| Simulation | Run ▶, Stop ■, Reset ↺ | Yes |
| Blocks-only | Clear 🗑, Zoom controls | Blocks mode only |
| View | Blocks tab, Code tab | Yes |
| Panels | Viewport, Debug | Physics/Hybrid only |
| Transfer | Import, Export ▼ | Yes |
| Theme | ☀/🌙 | Yes |

### What Works Well

- **Context-sensitive rendering** of Clear and Zoom controls (blocks mode only) reduces noise in code-only workflows.
- **Run and Stop** are colour-coded (green / red) — universally recognisable.
- **Active-state underline** on Blocks/Code tabs gives clear visual feedback.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| T-01 | High | **No visual grouping between button clusters.** 15 buttons in a flat row with only whitespace separation is cognitively dense. Thin vertical separators between logical groups would improve scannability. |
| T-02 | High | **No Undo / Redo buttons.** Users are forced to rely on undiscoverable keyboard shortcuts (Ctrl+Z / Ctrl+Y). Particularly problematic for block-editing where mis-drops are common. |
| T-03 | Medium | **Export dropdown chevron has low visual affordance.** Users may single-click expecting a direct action and be surprised by the dropdown. |
| T-04 | Medium | **Zoom controls are unlabelled** — the slider and `−`/`+` icons give no indication they control Blockly canvas zoom without hovering for a tooltip. |
| T-05 | Low | **No keyboard shortcut labels visible on buttons.** Run has `(Ctrl+Enter)` in a tooltip, but not all shortcuts are discoverable. |

---

## 4. Code Editor

### Editor Experience

- **Monaco editor** provides a VS Code–grade editing experience with full syntax highlighting.
- **VPython syntax** is highlighted correctly.
- **Line numbers** are visible and functional.
- The editor occupies the left ~50% of the layout at rest; the divider is draggable.

### What Works Well

- Monaco provides the correct mental model for users familiar with VS Code.
- The split-pane layout (code left, output right) is intuitive for simulate-while-editing.
- Status bar updates from "Ready" → "Simulation started".

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| C-01 | Medium | **No IntelliSense / autocomplete** for VPython functions. Users must know `cylinder()`, `arrow()`, `sphere()` etc. by memory. |
| C-02 | Low | **No visible cursor position** in the status bar (e.g. "Ln 22, Col 8"). Monaco supports this; it is absent here. |
| C-03 | Low | **Pane divider has no double-click to reset** — once moved, users have no quick way to return to the default 50/50 split. |

---

## 5. Block Editor & Goal-Filtered Toolbox

### Goal-Filtered Toolbox

Each project goal produces a different toolbox:

| Goal | Toolbox contents |
|------|-----------------|
| Physics | 60+ blocks: Objects, Motion, Forces, Constants, Control, Logic, Math, 3D Math, Variables, Functions |
| Data Science | 48 blocks: Load, Filter, Group By, Statistics, Visualise, Conclude, Variables |
| Hybrid | All blocks from both goals |

This filtering is a core UX feature — it keeps the toolbox focused and removes irrelevant blocks for the current task. The goal is set at project creation and cannot be changed mid-project.

### Block Search

A search bar above the toolbox allows searching across all blocks by name, category, or keyword. Results show a category badge and navigate to the relevant toolbox section on click.

### What Works Well

- Category colour accents provide instant visual organisation.
- The `Simulation Start` block acts as a named programme header.
- Block search significantly improves discoverability for new users.
- DS blocks use a consistent verb-noun naming convention (e.g. "Load Dataset", "Filter Rows", "Group By", "Plot Scatter").
- Disabling orphaned DS blocks (blocks not connected to a DS Start hat) gives immediate visual feedback about which blocks are active.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| B-01 | High | **No canvas minimap or "fit to view" button.** For large programmes, users lose spatial orientation. |
| B-02 | Medium | **Long block parameters extend off-screen** with no horizontal scroll indicator visible. |
| B-03 | Low | **No "fit to screen" / home button** to re-centre the canvas after panning far from origin. |
| B-04 | Low | **No block count indicator** in the status bar or toolbar. |

---

## 6. 3D Viewport (Physics & Hybrid)

### Rendering

GlowScript 3.2 VPython renders inside an isolated `<iframe>`. The dark background creates a deep navy space that makes geometries and overlays pop visually.

### What Works Well

- Camera controls are clearly communicated bottom-right ("Drag: rotate · Wheel: zoom · Right-drag: pan").
- The viewport title appears top-left.
- Hiding the viewport via the toolbar button expands the editing pane to full width.
- The idle state placeholder ("Press Run to start the simulation") is clear.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| V-01 | Medium | **No fullscreen option for the 3D viewport.** Users who want to demonstrate a running simulation must use the browser's native fullscreen (F11), which hides the toolbar. |
| V-02 | Medium | **No simulation elapsed time indicator** in the toolbar or status bar during a run. |
| V-03 | Low | **No camera reset button** — after rotating/panning far from the default view, users must stop/restart to recover the default camera angle. |

---

## 7. DataPanel (Data Science & Hybrid)

### Layout

The DataPanel occupies the right pane for DS projects and the lower 45% of the right pane in Hybrid mode. It renders the output of each DS block in sequence: tables, statistics, charts, comparisons, and conclusions.

### What Works Well

- **Table output** with header row and up to 12 preview rows gives immediate data confirmation after a Load Dataset block.
- **Statistics blocks** render as a compact key-value grid showing mean, median, std dev, etc.
- **Chart output** renders Observable Plot SVGs inline — scatter, bar, box, histogram all supported.
- **Conclusion block** renders as a highlighted banner with an icon, giving a clear summary statement.
- **"Show Python" toggle** on each DS block output lets users inspect the generated code for any result.
- **CSV export** of trace data from the TraceTable and the "Promote to Dataset" flow (TracePromoteDialog) bridge physics simulation data into the DS pipeline.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| DP-01 | High | **Table rows hidden and scroll non-functional.** The `.ds-table-wrapper` uses `max-height: calc(100% - 80px)` which resolves incorrectly in flex contexts, causing the table body to be invisible and the scroll container to have zero effective height. |
| DP-02 | Medium | **DataPanel body overflow conflict.** Both `.data-panel-body` and `.ds-table-wrapper` have `overflow-y: auto`, creating a nested scroll context where neither container scrolls reliably. |
| DP-03 | Low | **No expand-to-fullscreen for DataPanel** in Hybrid mode — when the panel is 45% tall, large tables are cramped. |
| DP-04 | Low | **No row count shown** when TABLE_ROW_LIMIT truncation is active. Users see "4 more rows…" but not the total row count. |

---

## 8. Debug Mode

### Layout

Debug mode is a **full-screen 3-panel layout** replacing the standard editor:

```
┌────────────────────────────────────────────────────────────┐
│  [Exit Debug] [▶ Run] [⏸ Pause] [▶ Resume] [→ Step]  ...  │
├─────────────────┬──────────────────────┬───────────────────┤
│  Code / Blocks  │    3D Viewport        │  Variables Panel  │
│  (breakpoints)  │                       │  NAME | VALUE | ↗ │
│                 │  (sim running)        │  accel | 1.23 | ▓ │
│                 │                       │  speed | 12.1 | ▓ │
│                 │                       │  [Record][CSV]    │
└─────────────────┴──────────────────────┴───────────────────┘
```

### What Works Well

- **Sparkline trends** in the Variables panel are a standout feature — visualising variable history as tiny inline charts gives physics students immediate intuition about oscillation, exponential decay, etc.
- **Filter input** in the variables panel allows focusing on specific variables in large programmes.
- **Breakpoint affordance** — clicking a block or line number toggles a red breakpoint highlight.
- **Record / CSV / Snap / Clear** controls enable data export for physics lab write-ups.
- **Step-through** execution with Pause/Resume/Step gives students controlled simulation exploration.
- **Promote to Dataset** button opens TracePromoteDialog to bridge trace data into DS analysis.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| D-01 | High | **No keyboard shortcut to enter Debug Mode.** Given that debug mode is a core educational feature, `F5` or `Ctrl+Shift+D` would be appropriate. |
| D-02 | Medium | **Code panel is very narrow by default** (~22% of the screen). For users with long programmes, this forces heavy horizontal scrolling. The panel is resizable but users may not discover this. |
| D-03 | Medium | **Variable values can be truncated** with no expand affordance. Users cannot inspect full vector objects. |
| D-04 | Low | **No breakpoint list / summary panel.** When breakpoints are set across multiple lines, there is no central view of all active breakpoints. |

---

## 9. Export System

### Available Exports

The Export dropdown provides 7 options:

| Option | Format |
|--------|--------|
| Export as Python (.py) | Source code |
| Export Blocks (.xml) | Blockly workspace XML |
| Export Project (.physide.json) | Full project bundle (code + workspace + goal + metadata) |
| Code as PDF | Formatted PDF |
| Blocks as PDF | Blockly canvas PDF |
| Screenshot Viewport (.png) | 3D viewport image |
| Copy Code to Clipboard | Plain text |

Import accepts `.physide.json` project bundles and `.xml` Blockly workspace files.

### What Works Well

- The `.physide.json` project bundle is a complete, self-contained export format — it includes the goal, block XML, code, datasets, and metadata.
- Keyboard shortcuts for most-used actions (Ctrl+S, Ctrl+C) are listed inline in the menu.
- Visual separators divide the menu into logical groups.
- PDF export for blocks is a particularly thoughtful classroom feature.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| E-01 | High | **"Export Blocks (.xml)" is silently unavailable in code-only projects.** No disabled state or tooltip explaining why. |
| E-02 | Low | **No confirmation or progress indicator on export.** When exporting as PDF, there is no spinner or toast notification confirming success/failure. |
| E-03 | Low | **Import is a separate toolbar button** while Export is a dropdown. These related actions are split across the toolbar — a unified File menu would be more consistent. |

---

## 10. Help & Documentation

### Structure

The Help modal opens as a full-screen overlay with:
- **Left sidebar navigation**: 19 sections covering all three goals, all features, and educator content
- **Search bar** at top of sidebar with live result highlighting
- **Main content area** with architecture cards, block reference tables, equation boxes, lesson progressions, and keyboard shortcut tables

### What Works Well

- 19-section structured navigation covers the full app surface including the Data Science pipeline and Hybrid goal.
- Block reference tables document all 48 DS blocks and all major physics blocks.
- The Educators section includes lesson progressions for all three goals (Physics, Data Science, Hybrid).
- The backdrop blur visually de-emphasises the app behind the modal.
- `Escape` closes the modal.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| H-01 | Medium | **No visible keyboard shortcut to open Help** — `F1` is not advertised on the Help button. |
| H-02 | Low | **Help modal has no "Back to Editor" CTA** at the bottom of the content area for users who scroll to the end. |

---

## 11. Theme System (Light/Dark)

### Implementation

Theme is toggled via the ☀/🌙 button (rightmost toolbar item). The selected theme persists via `localStorage`. Dark mode is the `:root` default; light mode applies the `[data-theme="light"]` attribute on `<html>`.

Both modes share the same CSS custom property names; the light theme provides overrides for every token. All component styles use CSS variables — there are no hardcoded dark-only colours remaining in the stylesheet after the June 2026 audit.

### Dark Mode (Primary)

Dark mode is the more polished experience:
- Viewport background matches the overall dark theme.
- Monaco editor in VS Code Dark+ palette looks correct and professional.
- Blockly workspace uses `#1e1e1e` background and `#252526` toolbox matching the VS Code palette.
- Toolbar contrast ratios are excellent.

### Light Mode

Light mode is a clean inversion of the dark theme:
- `--bg-base: #ffffff`, `--bg-surface: #f3f3f3` — matches VS Code Light+.
- Blockly workspace uses `#ffffff` background and `#f3f3f3` toolbox.
- DataPanel, ChartOverlay, TracePromoteDialog, DebugMode, and StartMenu all respect the light theme tokens.
- All previously dark-only hardcoded fallbacks (`#16161d`, `#0e0e14`, `rgba(255,255,255,…)`) have been replaced with semantic CSS variables.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| TH-01 | Low | **No system theme detection** — the app always defaults to dark regardless of the user's OS `prefers-color-scheme`. |
| TH-02 | Low | **Theme toggle icon has no accessible label.** An `aria-label` like "Switch to light mode" is needed for screen readers. |

---

## 12. Cross-Mode Navigation

Physics IDE has a 2×2 cross-mode matrix:

| Project Type | Blocks View | Code View |
|---|---|---|
| Code Project | `BLOCK REFERENCE (READ ONLY)` | Editable |
| Blocks Project | Editable | `GENERATED CODE (READ ONLY)` |

### Read-Only Views

When a user opens the "wrong" view for a project type, they see a read-only panel with a clearly labelled pane header. The generated code view shows the actual VPython produced by the block programme.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| N-01 | High | **Read-only pane header labels are small and muted.** "GENERATED CODE (READ ONLY)" appears in uppercase small text. Users who accidentally click the wrong view tab may not understand why they cannot edit. |
| N-02 | Medium | **No "Switch to [mode] to edit" affordance** — in read-only views, there is no in-panel button or tooltip directing the user to switch mode. |

---

## 13. Accessibility & Responsiveness

### Accessibility

| Area | Observation |
|------|-------------|
| Contrast | Dark mode text contrast is excellent. Light mode tokens normalised to VS Code Light+ values. |
| Focus indicators | May be missing custom focus rings for keyboard navigation — untested with screen reader. |
| ARIA labels | Theme toggle icon and several icon-only buttons lack `aria-label` attributes. |
| Keyboard navigation | Toolbar buttons are tab-accessible. Blockly drag interactions are mouse-only. |
| Screen reader | Status bar updates (e.g., "Simulation started") may not be announced via `aria-live` regions. |

### Responsiveness

The app is designed for desktop viewport sizes (1280px+). At narrower widths:

| Issue | Impact |
|-------|--------|
| Toolbar overflow | 15 buttons in 38px bar clip at widths below ~1000px |
| Split-pane layout | Min-width constraints conflict at tablet sizes |
| Debug mode 3-panel | Three columns are unworkable at mobile sizes |
| DataPanel in Hybrid | 45% height allocation is cramped on smaller screens |

The app is intentionally desktop-targeted. A responsive mobile layout is out of scope for v1.

---

## 14. Issue Summary

### By Severity

#### High (5)

| ID | Component | Issue |
|----|-----------|-------|
| T-01 | Toolbar | No visual grouping / separators between button clusters |
| T-02 | Toolbar | No Undo / Redo buttons |
| B-01 | Block Editor | No canvas minimap or "fit to view" button |
| D-01 | Debug Mode | No keyboard shortcut to enter debug mode |
| E-01 | Export | "Export Blocks" silently unavailable for code-only projects |
| DP-01 | DataPanel | Table rows hidden and scroll non-functional due to `max-height` miscomputation |
| N-01 | Cross-Mode | Read-only pane labels too small and easy to miss |

#### Medium (9)

| ID | Component | Issue |
|----|-----------|-------|
| T-03 | Toolbar | Export dropdown has low dropdown affordance |
| T-04 | Toolbar | Zoom controls unlabelled |
| C-01 | Code Editor | No VPython IntelliSense / autocomplete |
| B-02 | Block Editor | Wide blocks extend off-screen with no scroll indicator |
| DP-02 | DataPanel | Nested overflow-y scroll contexts conflict |
| D-02 | Debug Mode | Code panel very narrow by default (~22%) |
| D-03 | Debug Mode | Variable values truncated with no expand affordance |
| V-01 | 3D Viewport | No fullscreen option for viewport |
| N-02 | Cross-Mode | No in-panel "Switch to [mode] to edit" affordance |

#### Low (11)

Various minor issues across all components — see individual sections above.

---

## 15. Recommendations Summary

### Priority 1 — Fix Critical/High Issues

1. **Fix DataPanel table scroll** (`DP-01`, `DP-02`) — remove the `max-height: calc(100% - 80px)` from `.ds-table-wrapper` and resolve the nested overflow context so all table rows are visible and the panel scrolls correctly.

2. **Add Undo/Redo toolbar buttons** (`T-02`) — `↩ Undo` and `↪ Redo` with Ctrl+Z/Ctrl+Y shortcuts. Essential for block editing.

3. **Add a canvas minimap or Fit-to-View button** (`B-01`) — even a simple "⊞ Fit" button on the Blockly toolbar would help users re-orient on large programmes.

4. **Group toolbar buttons visually** (`T-01`) — add thin separators between logical groups.

5. **Make "Export Blocks" disabled (not invisible) in code projects** (`E-01`) — grey it out with a tooltip explaining why.

6. **Increase prominence of read-only mode indicators** (`N-01`) — use a banner bar across the editor pane rather than a small pane header label.

### Priority 2 — Improve Usability

7. **Add F5 / Ctrl+D shortcut for Debug Mode** (`D-01`).

8. **Add "Switch to Blocks to edit" affordance** (`N-02`) in the generated code / block reference read-only views.

9. **Widen debug mode code panel default** (`D-02`) — 30–35% would be more workable.

10. **Add viewport fullscreen button** (`V-01`).

11. **Add VPython snippet completions** (`C-01`) — even a simple JSON-based snippet list would improve code-editor ergonomics.

### Priority 3 — Polish

12. Add `aria-label` attributes to all icon-only buttons.
13. Add `prefers-color-scheme` detection for initial theme.
14. Add "scroll to fit" / camera reset button to the 3D viewport (`V-03`).
15. Add toast notifications for export success/failure (`E-02`).
16. Add a DataPanel expand button for Hybrid mode (`DP-03`).
17. Add total row count alongside the TABLE_ROW_LIMIT truncation notice (`DP-04`).

---

*Report updated June 2026 — reflects current three-goal architecture (Physics, Data Science, Hybrid), goal-filtered toolbox, DataPanel output, multi-project management, and `.physide.json` export format.*
