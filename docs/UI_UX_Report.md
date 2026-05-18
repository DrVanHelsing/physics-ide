# Physics IDE — UI/UX Audit Report

**Scope:** Full UI/UX visual and interaction audit  
**Method:** Live app walkthrough (localhost:3000) + codebase analysis  
**Screenshots:** 14 captured across all major views  
**Coverage:** Code workflow, Block workflow, Debug mode, Export, Help, Start Menu, Theme toggle, Beginner/Advanced mode, Viewport hidden state  

---

## Table of Contents

1. [Design System Overview](#1-design-system-overview)
2. [Start Menu](#2-start-menu)
3. [Toolbar](#3-toolbar)
4. [Code Editor (Code Projects)](#4-code-editor-code-projects)
5. [Block Editor](#5-block-editor)
6. [3D Viewport](#6-3d-viewport)
7. [Debug Mode](#7-debug-mode)
8. [Export System](#8-export-system)
9. [Help & Documentation](#9-help--documentation)
10. [Theme System (Light/Dark)](#10-theme-system-lightdark)
11. [Cross-Mode Navigation](#11-cross-mode-navigation)
12. [Beginner/Advanced Mode](#12-beginneradvanced-mode)
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

The app uses a glassmorphic surface layering approach — dark backgrounds with semi-transparent panel overlays and subtle border lines. This works very well in dark mode and maintains the VS Code aesthetic throughout. Light mode is implemented but less refined (see §10).

### Component Architecture

```
ThemeProvider
  └── SimulationProvider
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
                                      │     └── .canvas-pane (GlowScript iframe)
                                      └── StatusBar
```

**Verdict:** The architecture is clean, well-separated, and appropriate for the feature set. Context layering maps logically to UI surface areas.

---

## 2. Start Menu

### Screenshots: `01_start_menu.png`, `10_start_menu_dark.png`

### What Works Well

- **Template cards** are well designed — each has a unique accent colour (`ACCENT_COLORS` map), a clear badge (`CODE` or `BLOCKS`), title, and short description. Cards are instantly scannable.
- **Filter tabs** (All / Code Examples / Block Templates) provide useful filtering and are clearly active-state styled.
- **Sidebar Quick Actions** (New Code File, New Block Project, Documentation, Open File…) are immediately accessible without scrolling.
- **Version badge** "v1.0 • VPython 3.2" in the sidebar gives users confidence about the environment.
- **Dark mode start menu** is visually stronger than light mode — better contrast on the template cards.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| S-01 | Medium | The `New Blank Project` section is below the template grid and requires scrolling down to find. First-time users may not discover it. |
| S-02 | Low | Sidebar Quick Actions are styled as plain text links — low visual affordance. Users expect icon+label list items for quick actions. |
| S-03 | Low | In light mode, the sidebar and main content area have insufficient colour contrast separation — the sidebar boundary is hard to identify. |
| S-04 | Low | No keyboard navigation between template cards — mouse-only interaction. |
| S-05 | Low | There is no "recently opened" section. Returning users must re-browse templates. |

---

## 3. Toolbar

### Screenshots: `02_code_editor_light.png`, `03_code_editor_dark.png`, `11_blocks_editor_springmass.png`, `14_beginner_mode_viewport_hidden.png`

The toolbar is a single 38px horizontal strip containing **13–15 interactive elements** depending on mode.

### Button Inventory (left → right)

| Group | Buttons | Always Visible? |
|-------|---------|----------------|
| Navigation | Logo/Home, Menu, Help | Yes |
| Simulation | Run ▶, Stop ■, Reset ↺ | Yes |
| Blocks-only | Clear 🗑, [Zoom controls] | Blocks mode only |
| View | Blocks tab, Code tab | Yes |
| Zoom | 🔍− · ● slider · 🔍+ · 98% | Blocks mode only |
| Panels | Viewport, Debug | Yes |
| Mode | Advanced / Beginner | Yes |
| Transfer | Import, Export ▼ | Yes |
| Theme | ☀/🌙 | Yes |

### What Works Well

- **Context-sensitive rendering** of Clear and Zoom controls (blocks mode only) is correct and reduces noise in code-only workflows.
- **Run and Stop** are colour-coded (green / red) — universally recognisable.
- **Active-state underline** on the Blocks/Code tabs gives clear visual feedback of current view.
- **Beginner mode** correctly changes the toolbar button label from "Advanced" to "Beginner" with a highlighted pill style — visible state feedback.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| T-01 | High | **No visual grouping between button clusters.** 15 buttons in a flat row with only whitespace separation is cognitively dense. A thin vertical separator `│` or a 6–8px gap between logical groups (Navigation / Simulation / View / Panels / Utilities) would dramatically improve scannability. |
| T-02 | High | **No Undo / Redo buttons.** These are fundamental editing operations. Users are forced to rely on undiscoverable keyboard shortcuts (Ctrl+Z / Ctrl+Y). Particularly problematic for new users and for block-editing where mis-drops are common. |
| T-03 | Medium | **Reset button tooltip reads "Reset to blocks mode"** — this is confusing for code-project users who have no blocks. "Reset to blocks mode" on a Projectile Motion code project implies the user will lose their work. A project-aware reset tooltip/behaviour is needed. |
| T-04 | Medium | **Zoom controls are unlabelled** — a tiny circle slider with `–` and `+` magnifier icons and a percentage number gives no indication it controls Blockly canvas zoom. Tooltip on hover resolves this, but the interaction model is unintuitive compared to a standard `−  100%  +` row. |
| T-05 | Medium | **Export dropdown chevron `▼` is very small** — the Export button is wider (it contains the word "Export") but the dropdown affordance is a subtle down-arrow appended after the icon. Users may not recognise this as a multi-option dropdown. |
| T-06 | Low | **No keyboard shortcut labels visible on buttons.** Run has `(Ctrl+Enter)` shown in tooltip, but not all shortcuts are discoverable from tooltips alone. A chord hint below each icon (like VS Code's Command Palette) would help power users. |
| T-07 | Low | **Advanced / Beginner label ambiguity.** When in Advanced mode the button says "Advanced", implying "click to switch to Beginner." When in Beginner mode it says "Beginner". The label describes *current state* but reads as the *action target*. VS Code solves this with "Switch to Beginner Mode" tooltip — Physics IDE does have a tooltip, but the button text itself is confusing. |

---

## 4. Code Editor (Code Projects)

### Screenshots: `02_code_editor_light.png`, `03_code_editor_dark.png`, `04_code_running.png`

### Editor Experience

- **Monaco editor** provides a professional VS Code–grade editing experience with full syntax highlighting.
- **VPython syntax** is highlighted correctly (blue keywords, teal strings, gold numbers, white identifiers).
- **Line numbers** are visible and functional.
- The editor occupies the left ~50% of the layout at rest; the divider is draggable.

### Running State

In `04_code_running.png`:
- The 3D viewport activates on the right panel with the simulation rendering live.
- A **telemetry overlay** inside the viewport shows `t=`, `height=`, etc. values in white text.
- The simulation title ("Projectile Motion") appears at the top of the viewport.
- Camera control hint appears bottom-right: "Drag: rotate · Wheel: zoom · Right-drag: pan".

### What Works Well

- Monaco provides the correct mental model for users familiar with VS Code.
- The split-pane layout (code left, 3D right) is intuitive for simulate-while-editing.
- The draggable divider allows users to focus on either panel.
- Status bar updates from "Ready" → "Simulation started" with a teal flash.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| C-01 | Medium | **No IntelliSense / autocomplete** for VPython functions. Users must know `cylinder()`, `arrow()`, `sphere()` etc. by memory. A VPython-aware language server or even a simple snippet completion list would significantly lower the learning curve. |
| C-02 | Low | **No visible character count or cursor position** in the status bar (e.g. "Ln 22, Col 8"). Monaco supports this; it is absent here. |
| C-03 | Low | **No visible save state indicator.** Users cannot tell if their work is saved to localStorage or if there is unsaved work. |
| C-04 | Low | **Pane divider has no double-click to reset** — once moved, users have no quick way to return to the default 50/50 split. |

---

## 5. Block Editor

### Screenshots: `11_blocks_editor_springmass.png`, `12_blocks_running.png`, `14_beginner_mode_viewport_hidden.png`

### Toolbox & Category System

**Advanced mode** (full) toolbox has **14–15 categories**: Starter, Values, Objects, Motion, State, Control, Advanced, Logic, Loops, Math, 3D Math, Text, Lists, Variables, Functions.  
**Beginner mode** toolbox reduces to **~9 categories**: Starter, Values, Objects, Motion, Control, Logic, Math, 3D Math, Variables.

Each category has a distinct colour accent on its left border (colour-coded tabs). This is an excellent visual organisation technique.

### Block Canvas

- The `Simulation Start` block acts as a named tab/header — clean entry point.
- Blocks snap together satisfyingly. Vector input blocks show `vector( x , y , z )` with three inline numeric input fields.
- Blocks are colour-coded by category (teal = Objects, blue = Variables, brown = Values, etc.).
- The canvas has a **Search bar** at the top of the toolbox (`Search blocks...`) — excellent discoverability aid.

### Viewport Hidden State

In `14_beginner_mode_viewport_hidden.png`, hiding the viewport expands the block canvas to full width, maximising editing space. This is excellent UX for screens where the 3D preview is not needed during block assembly.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| B-01 | High | **No block canvas minimap / overview.** For large programs (the Spring-Mass template spans far below the initial viewport), users lose spatial orientation. A minimap or "fit to view" button is standard in block-based IDEs (Scratch, MIT App Inventor). |
| B-02 | Medium | **The `Simulation Start` block occupies only a tab label.** The tab "Spring-Mass Oscillator" gives the program a name but does not visually group child blocks — the relationship between the start block and nested blocks below it is not immediately obvious to new users. |
| B-03 | Medium | **Long block parameters truncate off-screen.** The `floor = box pos vector(-0.5, -1.25, 0) size vector(17, 0.3, 5) colour (...)` block in screenshot 14 extends beyond the visible canvas width and disappears. No horizontal scroll indicator is visible. |
| B-04 | Low | **No "fit to screen" / home button** — to re-centre the canvas after panning far from origin. |
| B-05 | Low | **No block count or complexity indicator.** Advanced users might benefit from a block count shown in the status bar or toolbar to gauge program size. |
| B-06 | Low | **Toolbox has no collapse / expand** — all 14 categories are always expanded in advanced mode, causing significant vertical scroll in the toolbox sidebar. |

---

## 6. 3D Viewport

### Screenshots: `04_code_running.png`, `12_blocks_running.png`, `06_debug_mode.png`

### Rendering

GlowScript 3.2 VPython renders inside an isolated `<iframe>`. The dark background (`scene.background = vector(0.059, 0.071, 0.133)`) creates a deep navy space that makes geometries and overlays pop visually.

Simulations observed:
- **Projectile Motion**: Orange sphere arc, ground plane, live `height=` and `range=` overlays.
- **Spring-Mass Oscillator**: Helix spring attached to wall, orange block mass, rail and floor geometry, `stretch=`, `velocity=`, `KE=`, `PE=` overlays.

### Telemetry Overlay

The in-viewport white text overlay for key variables (e.g. `t = 111.83 s`, `stretch = 0.018 m`) is elegant — it avoids requiring the user to look away to a separate panel while the simulation runs. Font size and placement are appropriate.

### What Works Well

- Camera controls are clearly communicated bottom-right ("Drag: rotate · Wheel: zoom · Right-drag: pan").
- The viewport title (e.g. "Spring-Mass Oscillator") appears top-left of the viewport panel.
- Hiding the viewport via the Viewport toolbar button is smooth and expands the editing pane to full width.
- The "Press Run to start the simulation" placeholder state is clear.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| V-01 | Medium | **No fullscreen option for the 3D viewport.** Users who want to demonstrate a running simulation must use the browser's native fullscreen (F11), which hides the toolbar. A native fullscreen icon on the viewport panel would improve presentation use cases. |
| V-02 | Medium | **No simulation elapsed time indicator in the toolbar or status bar** during a run. The status bar says "Simulation started" but provides no elapsed wall-clock time or a way to know if a simulation has hung. The viewport overlay shows VPython simulation `t=` (physics time), not wall time. |
| V-03 | Low | **Camera reset button** — after rotating/panning far from the default view, there is no button to return to the default camera angle. Users must reload or stop/restart. |
| V-04 | Low | **Viewport scroll conflict** — browser page scroll and viewport orbit share the scroll wheel. This can cause accidental page scroll when attempting to zoom inside the viewport. |

---

## 7. Debug Mode

### Screenshots: `06_debug_mode.png`, `07_debug_running.png`

### Layout

Debug mode is a **full-screen 3-panel layout** replacing the standard editor:

```
┌────────────────────────────────────────────────────────────┐
│  [Exit Debug] [▶ Run] [⏸ Pause] [▶ Resume] [→ Step]  ...  │
│  DEBUG MODE badge                                           │
├─────────────────┬──────────────────────┬───────────────────┤
│  Code / Blocks  │    3D Viewport        │  Variables Panel  │
│  (breakpoints)  │                       │  NAME | VALUE | ↗ │
│                 │                       │  [Filter input]   │
│  Line 1         │  (sim running)        │  accel | 1.23 | ▓ │
│  Line 2         │                       │  drag  | 0.04 | ▓ │
│  ...            │                       │  speed | 12.1 | ▓ │
│                 │                       │  [Record][CSV]    │
└─────────────────┴──────────────────────┴───────────────────┘
```

### What Works Well

- **Sparkline trends** in the Variables panel (`TREND` column) are a **standout feature** — visualising variable history as tiny inline charts gives physics students immediate intuition about oscillation, exponential decay, etc.
- **Filter input** at the top of the variables panel allows focusing on specific variables in large programs.
- **Breakpoint affordance** — clicking a line number in the code panel toggles a breakpoint badge (`●`). The hint "Click line number to toggle breakpoint" is visible.
- **Record / CSV / Snap / Clear** controls in the variables panel enable data export for physics lab write-ups — a thoughtful domain-specific feature.
- **Step-through** execution with Pause/Resume/Step buttons gives students controlled simulation exploration.
- The debug toolbar badge "Debug Mode" in teal is a clear mode indicator that prevents users from being confused about their current context.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| D-01 | High | **No keyboard shortcut to enter Debug Mode.** The debug entry button is in the far-right toolbar cluster. Given that debug mode is a core educational feature, `F5` or `Ctrl+Shift+D` would be appropriate. |
| D-02 | Medium | **The code panel is very narrow by default** (~22% of the screen) — for users with long programs, this forces heavy horizontal scrolling in the code panel. The panel is resizable but users may not discover this. |
| D-03 | Medium | **Variable values can be truncated** (e.g. `< -7.82405e-4,...`) with no expand affordance — clicking a value does not expand it. Users cannot inspect full vector objects. |
| D-04 | Medium | **No breakpoint list / breakpoint summary panel.** When breakpoints are set across multiple lines, there is no central view of all active breakpoints. Users must scroll the code panel to find them. |
| D-05 | Low | **Debug mode entry triggers silently.** The transition from the normal IDE to debug mode (full-screen 3-panel) is abrupt — no fade transition or confirmation prompt. |
| D-06 | Low | **Exit Debug button position** — placing "Exit Debug" as the first item in the toolbar (left edge) is unusual. VS Code places stop/exit in a more central or right-accessible position. Users who don't notice the debug toolbar may be confused about how to return to normal editing. |

---

## 8. Export System

### Screenshot: `08_export_dropdown.png`

### Available Exports

The Export dropdown provides 6 options:

| Option | Shortcut | Format |
|--------|----------|--------|
| Export as Python (.py) | Ctrl+S | Source code |
| Export Blocks (.xml) | — | Blockly XML |
| Code as PDF | — | Formatted PDF |
| Blocks as PDF | — | Blockly canvas PDF |
| Screenshot Viewport (.png) | — | 3D viewport image |
| Copy Code to Clipboard | Ctrl+C | Plain text |

### What Works Well

- The option set is comprehensive — covers all meaningful export scenarios for a physics classroom (code for submission, blocks for sharing, viewport screenshots for reports, PDF for printing).
- Keyboard shortcuts for most-used actions (Ctrl+S and Ctrl+C) are listed inline in the menu items.
- Visual separators divide the menu into logical groups (file exports / clipboard).
- The PDF export for blocks is a particularly thoughtful classroom feature.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| E-01 | High | **"Export Blocks (.xml)" is silently unavailable in code-only projects.** No disabled state or tooltip explaining why. Users in a code project clicking this option may receive no feedback or a silent no-op. |
| E-02 | Medium | **Dropdown affordance is subtle.** The Export button has a `▼` chevron but the visual weight of the chevron is low compared to the button label. First-time users may single-click expecting a direct action and be surprised by the dropdown. |
| E-03 | Low | **No import from the dropdown.** Import is a separate toolbar button while Export is a dropdown. These related actions are split across the toolbar — grouping them (e.g. File menu) would be more consistent. |
| E-04 | Low | **No confirmation or progress indicator on export.** When exporting Code as PDF, there is no spinner or toast notification confirming success/failure. |

---

## 9. Help & Documentation

### Screenshot: `09_help_page.png`

### Structure

The Help modal (`Physics IDE — Complete Guide`) opens as a full-screen overlay with:
- **Left sidebar navigation**: 13 sections (Getting Started, Block Editor, Code Editor, 3D Viewport, Debug Mode, Export, Keyboard Shortcuts, Physics Examples, Troubleshooting, etc.)
- **Search bar** at top of sidebar
- **Main content area** with architecture cards (Block Editor / Code Editor / 3D Viewport) and a comparison table
- Backdrop blur effect behind the modal

### What Works Well

- The 13-section structured navigation covers the full app surface.
- Architecture cards with icons and descriptions give an instant visual overview of the three core components.
- The comparison table (Blocks vs Code) directly addresses the most common user question ("Which mode should I use?").
- The search bar inside help suggests in-doc searching is supported.
- The backdrop blur visually de-emphasises the app behind the modal — good focus direction.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| H-01 | Medium | **No visible keyboard shortcut to open or close Help** — pressing `F1` (the VS Code standard) is untested and not advertised. `Escape` to close is standard modal behaviour but not communicated. |
| H-02 | Medium | **Search bar inside Help** — it is unclear from the UI whether the search is functional or decorative (no placeholder text result, no loading state observed). |
| H-03 | Low | **Help modal has no internal anchor navigation** — clicking a sidebar item likely scrolls to a section, but long sections have no in-page heading links. |
| H-04 | Low | **Modal closes only via the X button** — there is no "Done" or "Back to Editor" CTA at the bottom of the content area for users who scroll to the end. |

---

## 10. Theme System (Light/Dark)

### Screenshots: `01_start_menu.png` (light), `03_code_editor_dark.png` (dark), `10_start_menu_dark.png`

### Implementation

Theme is toggled via the `☀/🌙` button (rightmost toolbar item). The selected theme persists via `localStorage`. Dark mode is the `:root` default; light mode applies the `[data-theme="light"]` attribute.

### Dark Mode (Primary)

Dark mode is the more polished experience throughout the app:
- Viewport background matches the overall dark theme (no visual jarring).
- Monaco editor in VS Code Dark+ palette looks correct and professional.
- Blockly blocks are highly readable against the dark canvas.
- Toolbar contrast ratios are excellent.
- All glass surfaces, borders, and overlay texts are well tuned.

### Light Mode

Light mode is functional but visibly less refined:
- The toolbar maintains its dark appearance in light mode — this could be intentional (VS Code–style) but creates a dual-tone interface where the title bar and editor are light while the toolbar remains dark.
- The Start Menu sidebar and main content area have insufficient contrast separation in light mode.
- Blockly canvas in light mode uses a white background — the block colours remain the same, which works.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| TH-01 | Medium | **Toolbar does not respond to theme toggle** — remains dark in light mode. This may be a design decision (VS Code does this) but should be documented. In educational settings, students may expect the full interface to go light. |
| TH-02 | Low | **Theme toggle icon uses ☀/🌙 but has no accessible label.** Screen readers cannot determine the current state or the action from the icon alone. An `aria-label` like "Switch to light mode" is needed. |
| TH-03 | Low | **No system theme detection** — the app always defaults to dark regardless of the user's OS preference (`prefers-color-scheme`). |

---

## 11. Cross-Mode Navigation

### Screenshots: `05_blocks_code_template_readonly.png`, `13_code_preview_blocks_project.png`

Physics IDE has a 2×2 cross-mode matrix:

| Project Type | Blocks View | Code View |
|---|---|---|
| Code Project | `BLOCK REFERENCE (READ ONLY)` | ✅ Editable |
| Blocks Project | ✅ Editable | `GENERATED CODE (READ ONLY)` |

### Read-Only Views

When a user opens the "wrong" view for a project type, they see a read-only panel.

**Code project in Blocks view** (`05_blocks_code_template_readonly.png`): Shows a `BLOCK REFERENCE (READ ONLY)` pane header. The block display shows a reference representation of the code. This is useful but the label is easy to miss.

**Blocks project in Code view** (`13_code_preview_blocks_project.png`): Shows a `GENERATED CODE (READ ONLY)` pane header with Monaco displaying the generated VPython code.

### Critical Bug Found

**In screenshot 13**, the generated code for the Spring-Mass Oscillator blocks project displays only `= None` assignments for all variables:

```python
c_floor = None
c_rail = None
c_wall = None
c_spring = None
c_mass = None
...
floor = None
rail = None
...
```

This renders the code preview **functionally useless** — the user cannot see the actual generated VPython code that produced the running simulation. This is the most significant functional issue found in the audit.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| N-01 | **Critical** | **Generated code view shows `= None` for all variables** — the blocks-to-code code preview does not display the full generated VPython program. This breaks the educational "see what your blocks produce" use case. |
| N-02 | High | **Read-only pane header labels are small and muted** — "GENERATED CODE (READ ONLY)" and "BLOCK REFERENCE (READ ONLY)" appear in the pane-header bar in uppercase small text. Users who accidentally click the wrong view tab may not understand why they cannot edit, especially if they miss the label. |
| N-03 | Medium | **No "Switch to [mode] to edit" affordance** — in read-only views, there is no in-panel button or tooltip saying "Switch to Blocks to edit this." A ghost banner `"This is read-only. → Switch to Blocks to edit"` would resolve user confusion. |
| N-04 | Low | **Reset button behaviour across modes** — "Reset to blocks mode" tooltip on the Reset button appears for all project types, implying code-project users can "reset to blocks" when that is not applicable. |

---

## 12. Beginner/Advanced Mode

### Screenshots: `11_blocks_editor_springmass.png` (Advanced), `14_beginner_mode_viewport_hidden.png` (Beginner)

### Toolbox Comparison

| Mode | Category Count | Removed Categories |
|------|---------------|-------------------|
| Advanced | ~15 | — |
| Beginner | ~9 | State, Advanced, Loops, Text, Lists, Functions |

The Beginner toolbox simplification is well chosen — removing the more advanced programming constructs (loops, lists, functions) leaves the physics-centric blocks (Starter, Objects, Motion, Math, Variables) which is appropriate for introductory physics students.

### What Works Well

- The toolbar button gives instant visual feedback of the current mode (highlighted "Beginner" pill vs plain "Advanced" text).
- The status bar does not change for mode switch — no confusion with simulation state.
- The simplification of categories is educationally appropriate.

### Issues Found

| ID | Severity | Issue |
|----|----------|-------|
| M-01 | Medium | **Beginner mode does not affect the Code editor** — a beginner who switches to Code view still sees the full Monaco editor with no simplification. If the intent is to scaffold new learners, the code view should also be simplified or gated. |
| M-02 | Low | **No persistence of Beginner/Advanced preference** — toggling to Beginner and then opening a new project resets to Advanced. Teachers who configure Beginner mode for students may find this disruptive. |
| M-03 | Low | **Button label ambiguity** (see also T-07) — "Advanced" reads as "currently in Advanced mode" and "Beginner" reads as "currently in Beginner mode", but contextually the button is always describing the current state not the target action. |

---

## 13. Accessibility & Responsiveness

### Accessibility

No formal WCAG audit was performed, but the following observations were made:

| Area | Observation |
|------|-------------|
| Contrast | Dark mode text contrast is generally excellent. Light mode has some low-contrast areas. |
| Focus indicators | Not observed clearly — may be missing custom focus rings for keyboard navigation. |
| ARIA labels | Theme toggle icon (☀/🌙) has no text label. Several icon-only buttons may lack `aria-label`. |
| Keyboard navigation | No visible keyboard navigation between toolbar buttons observed. Tab order untested. |
| Screen reader | Status bar updates (e.g., "Simulation started") may not be announced via ARIA live regions. |

### Responsiveness

The app appears designed for desktop viewport sizes (1280px+). At narrower widths:

| Issue | Impact |
|-------|--------|
| Toolbar overflow | 15 buttons in 38px bar likely wrap or clip at < 1000px width |
| Split-pane layout | Min-width constraints may conflict at tablet sizes |
| Blockly toolbox sidebar | Fixed-width sidebar at small viewports eats into canvas space |
| Debug mode 3-panel | Three columns would be unworkable at mobile sizes |

The app is **not mobile-friendly** and appears to be intentionally desktop-targeted, which is appropriate for a physics IDE. However, the toolbar overflow at mid-range screen widths (1024px laptops) is a likely real-world concern.

---

## 14. Issue Summary

### By Severity

#### Critical (1)

| ID | Component | Issue |
|----|-----------|-------|
| N-01 | Cross-Mode | Generated code view shows `= None` for all variables in blocks projects — code preview is non-functional |

#### High (6)

| ID | Component | Issue |
|----|-----------|-------|
| T-01 | Toolbar | No visual grouping / separators between button clusters |
| T-02 | Toolbar | No Undo / Redo buttons |
| B-01 | Block Editor | No canvas minimap or "fit to view" button |
| D-01 | Debug Mode | No keyboard shortcut to enter debug mode |
| E-01 | Export | "Export Blocks" silently unavailable for code-only projects |
| N-02 | Cross-Mode | Read-only pane labels are too small and easy to miss |

#### Medium (15)

| ID | Component | Issue |
|----|-----------|-------|
| T-03 | Toolbar | Reset button tooltip says "Reset to blocks mode" for all project types |
| T-04 | Toolbar | Zoom controls unlabelled and unintuitive |
| T-05 | Toolbar | Export dropdown chevron has low visual affordance |
| T-07 | Toolbar | Advanced/Beginner label ambiguity (state vs action) |
| C-01 | Code Editor | No VPython IntelliSense / autocomplete |
| B-02 | Block Editor | Simulation Start block doesn't visually group child blocks |
| B-03 | Block Editor | Wide blocks extend off-screen with no scroll indicator |
| D-02 | Debug Mode | Code panel is very narrow by default (~22%) |
| D-03 | Debug Mode | Variable values truncated with no expand affordance |
| D-04 | Debug Mode | No breakpoint list / summary panel |
| V-01 | 3D Viewport | No fullscreen option for viewport |
| V-02 | 3D Viewport | No elapsed wall-clock time indicator during simulation |
| N-03 | Cross-Mode | No in-panel "Switch to [mode] to edit" affordance |
| H-01 | Help | No keyboard shortcut to open/close Help |
| TH-01 | Theme | Toolbar does not respond to light mode toggle |

#### Low (18)

Various minor issues across all components — see individual sections above.

---

## 15. Recommendations Summary

### Priority 1 — Fix Critical/High Issues

1. **Fix the generated code view** (`N-01`) — the blocks-to-code preview should display the actual generated VPython program, not `= None` stubs. This is the most impactful fix for educational value.

2. **Add Undo/Redo toolbar buttons** (`T-02`) — `↩ Undo` and `↪ Redo` with Ctrl+Z/Ctrl+Y shortcuts displayed. Essential for block editing.

3. **Add a canvas minimap or Fit-to-View button** (`B-01`) — even a simple "⊞ Fit" button on the Blockly toolbar would help users re-orient on large programs.

4. **Group toolbar buttons visually** (`T-01`) — add thin `│` separators between groups: `[Logo | Menu | Help] │ [Run | Stop | Reset | Clear] │ [Blocks | Code] │ [Zoom] │ [Viewport | Debug] │ [Beginner] │ [Import | Export] │ [Theme]`

5. **Make "Export Blocks" disabled (not invisible) in code projects** (`E-01`) — grey it out with a tooltip explaining why.

6. **Increase prominence of read-only mode indicators** (`N-02`) — use a banner/notice bar across the editor pane rather than a small pane header label.

### Priority 2 — Improve Usability

7. **Add F5 / Ctrl+D shortcut for Debug Mode** (`D-01`)

8. **Add "Switch to Blocks to edit" affordance** (`N-03`) in the generated code / block reference read-only views.

9. **Widen debug mode code panel default** (`D-02`) — 30–35% would be more workable.

10. **Add simulation elapsed time** (`V-02`) to the status bar or toolbar (wall-clock time).

11. **Fix reset button tooltip** (`T-03`) to be project-type aware.

12. **Add VPython snippet completions** (`C-01`) — even a simple JSON-based snippet list would significantly improve code-editor ergonomics.

### Priority 3 — Polish

13. Light mode refinement — align toolbar theme with the rest of the interface.
14. Add `aria-label` attributes to all icon-only buttons.
15. Add `prefers-color-scheme` detection for initial theme.
16. Persist Beginner/Advanced mode preference to localStorage.
17. Add "scroll to fit" / camera reset button to the 3D viewport.
18. Add a `New Blank Project` quick-access button above the template grid (not just below).
19. Add toast notifications for export success/failure.
20. Add `Escape` key handler to close the Help modal (standard behavior).

---

## Appendix: Screenshot Index

| Screenshot | Description | Key Finding |
|-----------|-------------|-------------|
| `01_start_menu.png` | Start menu, light mode | Template card design, Quick Actions sidebar |
| `01_start_menu_full.png` | Start menu full page, light mode | Template grid + Blank Project at bottom requires scroll |
| `02_code_editor_light.png` | Code editor, light mode, Projectile Motion | Light mode less polished than dark |
| `03_code_editor_dark.png` | Code editor, dark mode | VS Code–inspired aesthetic at its best |
| `04_code_running.png` | Code running, 3D viewport active, dark | Telemetry overlay, projectile arc |
| `05_blocks_code_template_readonly.png` | Blocks view of code template (READ ONLY) | Block reference view functioning |
| `06_debug_mode.png` | Debug mode, idle | 3-panel layout, breakpoint hint visible |
| `07_debug_running.png` | Debug mode, simulation running | Sparkline trends, live variable panel |
| `08_export_dropdown.png` | Export dropdown open | All 6 options visible with shortcuts |
| `09_help_page.png` | Help modal, Overview section | 13-section nav, architecture cards |
| `10_start_menu_dark.png` | Start menu, dark mode | Stronger card contrast vs light |
| `11_blocks_editor_springmass.png` | Block editor, Spring-Mass, Advanced, idle | Full 14-category toolbox visible |
| `12_blocks_running.png` | Spring-Mass simulation running | Spring geometry + KE/PE telemetry overlay |
| `13_code_preview_blocks_project.png` | Code preview of blocks project | **Critical bug: all `= None` declarations** |
| `14_beginner_mode_viewport_hidden.png` | Beginner mode, viewport hidden | Simplified 9-category toolbox, full-width canvas |

---

*Report generated via live app walkthrough + codebase analysis. All observations are from localhost:3000 (React dev server) running the built source in `src/`.*
