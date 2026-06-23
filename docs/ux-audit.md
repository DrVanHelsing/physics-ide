# Physics IDE — UX Audit Report

> Generated: 2026-05-31T15:22:33.910Z
> Reference: Microsoft MakeCode (makecode.microbit.org)

## Summary

| Status | Count |
|--------|-------|
| ✅ Pass | 19 |
| ❌ Fail | 9 |
| ⚠️ Warn | 20 |
| ℹ️ Info | 24 |
| **Total** | **72** |

---

## C.1 Contrast

| Status | Element | Detail |
|--------|---------|--------|
| ❌ FAIL | **Goal card title** | 1.23:1 (FAIL) — 14px 600w |
| ❌ FAIL | **Goal card description** | 2.71:1 (FAIL) — 12px 400w |
| ❌ FAIL | **Section label ("Create New")** | 3.08:1 (FAIL) — 11px 600w |
| ✅ PASS | **Sidebar action button** | 9.54:1 (AAA) — 13px 400w |
| ✅ PASS | **Toolbar button label** | 4.72:1 (AA) — 12px 400w |
| ❌ FAIL | **Zoom label** | 2.37:1 (FAIL) — 10px 400w |
| ✅ PASS | **Toolbox category label** | 9.54:1 (AAA) — 12px 400w |
| ℹ️ INFO | **DS value number** | element not found |
| ℹ️ INFO | **DS value label** | element not found |
| ✅ PASS | **DS table header** | 10.38:1 (AAA) — 11px 600w |
| ✅ PASS | **DS table cell** | 11.21:1 (AAA) — 11px 400w |

## C.2 Typography

| Status | Element | Detail |
|--------|---------|--------|
| ⚠️ WARN | **Toolbox category label** | 12.0px (min 13px, MakeCode uses 14px) |
| ✅ PASS | **Toolbar button label** | 12.0px (min 12px, min 12px) |
| ℹ️ INFO | **DS value number** | element not found |
| ℹ️ INFO | **DS table cell** | element not found |
| ℹ️ INFO | **Goal card title** | element not found |
| ℹ️ INFO | **Wizard radio label** | element not found |
| ℹ️ INFO | **Block label font-size** | could not measure SVG text |

## C.3 Toolbox

| Status | Element | Detail |
|--------|---------|--------|
| ⚠️ WARN | **Category: Values** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Objects** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Motion** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: State** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Control** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Logic** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Math** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Variables** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Advanced** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: 3D Math** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Raw Python** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Loops** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Text** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Lists** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Category: Functions** | no icon — MakeCode has icons per category |
| ⚠️ WARN | **Advanced drawer expand indicator** | no visible expand arrow — discoverability concern |
| ✅ PASS | **Block search bar visibility** | visible and sized adequately |
| ℹ️ INFO | **Category ordering** | [Values → Objects → Motion → State → Control → Logic → Math → Variables → Advanced → 3D Math → Raw Python → Loops → Text → Lists → Functions] |
| ℹ️ INFO | **Block search placement** | Currently below toolbar in block editor (MakeCode places search at top of toolbox panel) |

## C.4 Sizing

| Status | Element | Detail |
|--------|---------|--------|
| ❌ FAIL | **Run button** | 55×21px (min 24px, rec 44px) |
| ❌ FAIL | **Stop button** | 59×21px (min 24px, rec 44px) |
| ❌ FAIL | **Menu/Help button** | 66×22px (min 24px, rec 44px) |
| ❌ FAIL | **Theme toggle** | 26×22px (min 24px, rec 44px) |
| ❌ FAIL | **Export dropdown** | 84×21px (min 24px, rec 44px) |
| ✅ PASS | **Goal card (start menu)** | 352×130px (min 24px, rec 44px) |
| ⚠️ WARN | **Project delete button** | 36×52px (min 24px, rec 44px) |
| ℹ️ INFO | **Create project button** | element not found |

## C.5 Consistency

| Status | Element | Detail |
|--------|---------|--------|
| ℹ️ INFO | **Run button colour** | rgba(0, 0, 0, 0) |
| ℹ️ INFO | **Stop button colour** | rgba(0, 0, 0, 0) |
| ✅ PASS | **Mode toggle active state** | active class present, bg: rgba(0, 0, 0, 0) |
| ℹ️ INFO | **Toolbar separators** | 7 separator(s) |
| ⚠️ WARN | **Undo/Redo visibility** | not in main toolbar (in Blockly's own toolbar — MakeCode has top-level undo) |

## C.6 Feedback

| Status | Element | Detail |
|--------|---------|--------|
| ✅ PASS | **DS auto-execution feedback (table visible)** | data panel present after project load |
| ✅ PASS | **Status bar present** | ReadyMode: Blocks \| VPython 3.2 |
| ✅ PASS | **Run → running indicator timing** | indicator shown within 381ms |

## C.7 A11y

| Status | Element | Detail |
|--------|---------|--------|
| ✅ PASS | **Run button accessible label** | aria-label:"null" title:"Run simulation (Ctrl+Enter)" text:"Run" |
| ✅ PASS | **Stop button accessible label** | aria-label:"null" title:"No simulation running" text:"Stop" |
| ✅ PASS | **Theme toggle accessible label** | aria-label:"null" title:"Switch to light mode" text:"" |
| ✅ PASS | **Export dropdown accessible label** | aria-label:"null" title:"Export options" text:"Export" |
| ⚠️ WARN | **Create project wizard modal** | role="null" aria-modal="null" |
| ✅ PASS | **Project delete button aria-label** | aria-label:"Delete project" |
| ✅ PASS | **Help overlay modal attributes** | role="dialog" aria-modal="true" |
| ✅ PASS | **Keyboard Tab navigation (start menu)** | Focus lands on: <BUTTON> "Documentation" |

## C.8 MakeCode

| Status | Element | Detail |
|--------|---------|--------|
| ℹ️ INFO | **Block label size** | Physics IDE: ?px \| MakeCode: 14-16px \| OK |
| ℹ️ INFO | **Category icons** | Physics IDE: Colour borders only \| MakeCode: Icon + colour per category \| Add icons for visual scanning |
| ℹ️ INFO | **Run button size** | Physics IDE: 55×21px \| MakeCode: ≥60px high |
| ℹ️ INFO | **Toolbar height** | Physics IDE: 38px \| MakeCode: ~48px |
| ℹ️ INFO | **Block search placement** | Physics IDE: in editor pane below toolbar \| MakeCode: Top of toolbox panel \| Consider moving to toolbox top |
| ℹ️ INFO | **Undo/Redo in toolbar** | Physics IDE: Blockly built-in (small) \| MakeCode: Top-level prominent buttons \| Consider promoting |
| ℹ️ INFO | **Error feedback** | Physics IDE: Status bar (bottom) \| MakeCode: Inline simulator panel \| Status bar requires scroll |
| ℹ️ INFO | **Template previews** | Physics IDE: Text descriptions \| MakeCode: Screenshots + descriptions \| Add visual previews |
| ℹ️ INFO | **Live output feedback** | Physics IDE: DS panel + 3D viewport \| MakeCode: Simulator panel (always visible) \| OK — multi-panel |
| ℹ️ INFO | **Keyboard shortcuts** | Physics IDE: Ctrl+Enter, Ctrl+S \| MakeCode: Ctrl+Z, Space=Run, etc. \| Document in Help |
| ℹ️ INFO | **Category count (physics)** | Physics IDE: 15 \| MakeCode: ~8-10 |

## C.8 MakeCode Comparison Matrix

| Feature | Physics IDE | MakeCode | Gap / Opportunity |
|---------|-------------|----------|-------------------|
| Block label size | ?px | 14-16px | OK |
| Category icons | Colour borders only | Icon + colour per category | Add icons for visual scanning |
| Run button size | 55×21px | ≥60px high | — |
| Toolbar height | 38px | ~48px | — |
| Block search placement | in editor pane below toolbar | Top of toolbox panel | Consider moving to toolbox top |
| Undo/Redo in toolbar | Blockly built-in (small) | Top-level prominent buttons | Consider promoting |
| Error feedback | Status bar (bottom) | Inline simulator panel | Status bar requires scroll |
| Template previews | Text descriptions | Screenshots + descriptions | Add visual previews |
| Live output feedback | DS panel + 3D viewport | Simulator panel (always visible) | OK — multi-panel |
| Keyboard shortcuts | Ctrl+Enter, Ctrl+S | Ctrl+Z, Space=Run, etc. | Document in Help |
| Category count (physics) | 15 | ~8-10 | — |

## Recommendations (Priority Order)

### Critical (Fix)

1. **Goal card title**: 1.23:1 (FAIL) — 14px 600w
2. **Goal card description**: 2.71:1 (FAIL) — 12px 400w
3. **Section label ("Create New")**: 3.08:1 (FAIL) — 11px 600w
4. **Zoom label**: 2.37:1 (FAIL) — 10px 400w
5. **Run button**: 55×21px (min 24px, rec 44px)
6. **Stop button**: 59×21px (min 24px, rec 44px)
7. **Menu/Help button**: 66×22px (min 24px, rec 44px)
8. **Theme toggle**: 26×22px (min 24px, rec 44px)
9. **Export dropdown**: 84×21px (min 24px, rec 44px)

### Improvements (Consider)

1. **Toolbox category label**: 12.0px (min 13px, MakeCode uses 14px)
2. **Category: Values**: no icon — MakeCode has icons per category
3. **Category: Objects**: no icon — MakeCode has icons per category
4. **Category: Motion**: no icon — MakeCode has icons per category
5. **Category: State**: no icon — MakeCode has icons per category
6. **Category: Control**: no icon — MakeCode has icons per category
7. **Category: Logic**: no icon — MakeCode has icons per category
8. **Category: Math**: no icon — MakeCode has icons per category
9. **Category: Variables**: no icon — MakeCode has icons per category
10. **Category: Advanced**: no icon — MakeCode has icons per category
11. **Category: 3D Math**: no icon — MakeCode has icons per category
12. **Category: Raw Python**: no icon — MakeCode has icons per category
13. **Category: Loops**: no icon — MakeCode has icons per category
14. **Category: Text**: no icon — MakeCode has icons per category
15. **Category: Lists**: no icon — MakeCode has icons per category
16. **Category: Functions**: no icon — MakeCode has icons per category
17. **Advanced drawer expand indicator**: no visible expand arrow — discoverability concern
18. **Project delete button**: 36×52px (min 24px, rec 44px)
19. **Undo/Redo visibility**: not in main toolbar (in Blockly's own toolbar — MakeCode has top-level undo)
20. **Create project wizard modal**: role="null" aria-modal="null"

## Screenshots

- `e2e/ux-start-menu.png`
- `e2e/ux-ide-physics.png`
- `e2e/ux-ide-ds.png`
- `e2e/ux-toolbox-physics.png`
- `e2e/ux-ds-live-feedback.png`
