import React, { useEffect, useMemo, useRef, useState } from "react";
import Blockly from "../utils/blockly/blocklyLib";
import {
  defineCustomBlocksAndGenerator,
  generatePythonFromWorkspace,
  BLOCK_CATALOGUE,
  customConstantsRegistry,
} from "../utils/blockly/blocklyGenerator";
import { SearchIcon, XIcon, MaximizeIcon } from "./Icons";
import WorkspaceTrash from "./WorkspaceTrash";
import * as dialogService from "../utils/export/dialogService";
import { buildToolboxXml } from "../utils/blockly/toolbox";
import { getBlocklyTheme, gridColourFor } from "../utils/blockly/blocklyTheme";
import { BLOCK_PALETTE } from "../utils/blockly/blockPalette";
import { ANCHOR_TYPES, planOrphanState, applyOrphanState, readTopBlocks } from "../utils/blockly/orphans";

/* ── Block search bar component ────────────────────────── */
function BlockSearch({ workspaceRef }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const seen = new Set();
    return BLOCK_CATALOGUE.filter(item => {
      if (seen.has(item.type + item.category)) return false;
      const match =
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.some(k => k.includes(q));
      if (match) seen.add(item.type + item.category);
      return match;
    }).slice(0, 12);
  }, [query]);

  function openCategory(catName) {
    try {
      const ws = workspaceRef.current;
      if (!ws) return;
      const toolbox = ws.getToolbox();
      if (!toolbox) return;
      const clean = catName.trim();
      if (toolbox.selectCategoryByName) {
        toolbox.selectCategoryByName(catName) ||
          toolbox.selectCategoryByName(clean);
        return;
      }
      const items = toolbox.getToolboxItems ? toolbox.getToolboxItems() : [];
      const match = items.find(
        i => i.getName && (i.getName() === catName || i.getName() === clean)
      );
      if (match) {
        if (toolbox.selectItem_) toolbox.selectItem_(match, true);
        else if (match.setSelected) match.setSelected(true);
      }
    } catch (e) { /* ignore toolbox API differences */ }
  }

  /**
   * Create the matched block at the centre of the current view and select it.
   * Falls back to opening its category — the old behaviour — when the block
   * cannot be constructed (a registry entry with no generator definition, or a
   * stock Blockly block that needs flyout context).
   */
  function insertBlock(item) {
    const ws = workspaceRef.current;
    if (!ws) return false;
    try {
      const dom = Blockly.utils.xml.textToDom(
        `<xml xmlns="https://developers.google.com/blockly/xml"><block type="${item.type}"></block></xml>`,
      );
      const ids = Blockly.Xml.domToWorkspace(dom, ws);
      const block = ids && ids.length ? ws.getBlockById(ids[ids.length - 1]) : null;
      if (!block) return false;

      /* An insert is the student asking for the block to be in their program.
         The automatic adoption loop that used to do this is gone (Task 10), so
         attach explicitly — and only here, never on a drag-aside. */
      const attached = appendToSetup(ws, block);
      if (!attached) {
        const metrics = ws.getMetricsManager?.().getViewMetrics(true);
        if (metrics) {
          const xy = block.getRelativeToSurfaceXY();
          block.moveBy(
            metrics.left + metrics.width / 2 - xy.x - 40,
            metrics.top + metrics.height / 2 - xy.y - 20,
          );
        }
      }
      block.select();
      return true;
    } catch (e) {
      return false;
    }
  }

  return (
    <div className="block-search block-search--with-fit">
      <div className="block-search-bar">
        <SearchIcon size={12} />
        <input
          type="text"
          className="block-search-input"
          placeholder="Search blocks..."
          value={query}
          spellCheck={false}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
        />
        {query && (
          <button className="block-search-clear" onClick={() => setQuery("")} tabIndex={-1}><XIcon size={10} /></button>
        )}
      </div>
      <button
        type="button"
        className="block-search-fit"
        title="Fit all blocks on screen"
        aria-label="Fit all blocks on screen"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const ws = workspaceRef.current;
          if (!ws) return;
          try {
            ws.zoomToFit();
            ws.scrollCenter();
          } catch (e) {
            console.warn("Could not fit blocks to view:", e);
          }
        }}
      >
        <MaximizeIcon size={12} />
      </button>
      {open && query && (
        <div className="block-search-dropdown">
          {results.length > 0
            ? results.map(item => (
                <button
                  key={item.type + item.category}
                  className="block-search-item"
                  onMouseDown={() => {
                    if (!insertBlock(item)) openCategory(item.category);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="block-search-item-label">{item.label}</span>
                  <span className="block-search-item-cat">{item.category}</span>
                </button>
              ))
            : <div className="block-search-empty">No blocks match "{query}"</div>
          }
        </div>
      )}
    </div>
  );
}
/**
 * Attach `block` to the end of sim_start's SETUP statement input.
 *
 * Exported since Tranche 3 because explicit insertion — a block-search result,
 * an empty-state starter chip — has to attach itself now that the automatic
 * top-block adoption loop is gone (Task 10, product-contract.md:36). Returns
 * false when there is no sim_start to attach to (a data-science or
 * not-yet-anchored canvas), so callers can leave the block where it landed.
 */
export function appendToSetup(workspace, block) {
  if (!workspace || !block) return false;

  const allBlocks = workspace.getAllBlocks(false);
  const startBlocks = allBlocks.filter((b) => b.type === "sim_start_block");
  if (startBlocks.length === 0) return false;

  const byYThenX = (a, b) => {
    const pa = a.getRelativeToSurfaceXY();
    const pb = b.getRelativeToSurfaceXY();
    if (pa.y !== pb.y) return pa.y - pb.y;
    return pa.x - pb.x;
  };

  const simStart = [...startBlocks].sort(byYThenX)[0];
  const setupConnection = simStart.getInput("SETUP")?.connection || null;
  if (!setupConnection) return false;

  const endBlocks = allBlocks.filter((b) => b.type === "sim_end_block");
  const simEnd = endBlocks.length > 0 ? [...endBlocks].sort(byYThenX)[0] : null;

  if (block === simStart || block === simEnd) return false;
  if (!block.previousConnection) return false;

  if (block.previousConnection.isConnected()) {
    block.previousConnection.disconnect();
  }

  const setupHead = simStart.getInputTargetBlock("SETUP");
  if (!setupHead) {
    setupConnection.connect(block.previousConnection);
    return true;
  }

  let tail = setupHead;
  while (tail.getNextBlock()) tail = tail.getNextBlock();
  if (tail.nextConnection && !tail.nextConnection.isConnected()) {
    tail.nextConnection.connect(block.previousConnection);
    return true;
  }
  return false;
}

function normalizeSimulationStructure(workspace) {
  if (!workspace) return false;

  const allBlocks = workspace.getAllBlocks(false);
  const startBlocks = allBlocks.filter((b) => b.type === "sim_start_block");
  if (startBlocks.length === 0) return false;

  const byYThenX = (a, b) => {
    const pa = a.getRelativeToSurfaceXY();
    const pb = b.getRelativeToSurfaceXY();
    if (pa.y !== pb.y) return pa.y - pb.y;
    return pa.x - pb.x;
  };

  const simStart = [...startBlocks].sort(byYThenX)[0];
  const setupConnection = simStart.getInput("SETUP")?.connection || null;
  if (!setupConnection) return false;

  const endBlocks = allBlocks.filter((b) => b.type === "sim_end_block");
  const simEnd = endBlocks.length > 0 ? [...endBlocks].sort(byYThenX)[0] : null;

  let changed = false;

  // Move any blocks currently chained after Simulation Start (except Sim End) into SETUP.
  // This is a student's explicit gesture — dropping a block directly under the
  // hat — not the automatic top-block adoption Task 10 removed.
  let chained = simStart.getNextBlock();
  while (chained && chained !== simEnd) {
    const next = chained.getNextBlock();
    if (appendToSetup(workspace, chained)) changed = true;
    chained = next;
  }

  // Simulation End must be the final top-level block after Simulation Start.
  if (simEnd && simEnd.previousConnection && simStart.nextConnection) {
    const endNext = simEnd.getNextBlock();
    if (endNext && appendToSetup(workspace, endNext)) changed = true;

    if (simStart.getNextBlock() !== simEnd) {
      if (simEnd.previousConnection.isConnected()) {
        simEnd.previousConnection.disconnect();
        changed = true;
      }

      if (simStart.nextConnection.isConnected()) {
        simStart.nextConnection.disconnect();
        changed = true;
      }

      simStart.nextConnection.connect(simEnd.previousConnection);
      changed = true;
    }
  }

  return changed;
}

/* ── Orphan handling, one behaviour for every goal ─────────────
   docs/product-contract.md:36: top-level blocks outside the anchor hat are
   greyed and ignored, so "in use vs unused" is visible. No goal check — a
   physics canvas and a data canvas behave identically, and neither adopts. */
function greyOrphanedBlocks(workspace) {
  if (!workspace) return false;
  return applyOrphanState(workspace, planOrphanState(readTopBlocks(workspace), ANCHOR_TYPES));
}

/* Scaffold, not content — a freshly seeded project must still read as "empty"
   even though its frame is already on the canvas (factory.js's
   PHYSICS_STARTER_XML / DS_STARTER_XML). Keep this set in sync with those
   two constants. */
const FRAME_BLOCK_TYPES = new Set(["sim_start_block", "sim_end_block", "ds_start_block"]);

function countContentBlocks(workspace) {
  return workspace.getAllBlocks(false).filter((b) => !FRAME_BLOCK_TYPES.has(b.type)).length;
}

/** Stable empty Set — the safe default for the debug props below until
 *  IDELayout threads the real ones through. */
const EMPTY_BREAKPOINTS = new Set();

function resizeBlocklyWorkspace(Blockly, workspace) {
  if (!workspace) return;
  if (typeof Blockly?.svgResize === "function") {
    Blockly.svgResize(workspace);
    return;
  }
  if (typeof workspace.resize === "function") {
    workspace.resize();
  }
}

/* ── MakeCode rail: stamp each toolbox row's category colour ─────
   Blockly paints .blocklyTreeSelected from the category style
   automatically, but the row's own div needs --cat / --cat-bright
   custom properties for the CSS in workspace.css (dot colour, hover,
   selected fill) to read. Runs after every inject and after every
   updateToolbox (goal switch rebuilds the toolbox items). */
function decorateToolboxRows(workspace) {
  const toolbox = workspace?.getToolbox?.();
  if (!toolbox) return;
  for (const item of toolbox.getToolboxItems()) {
    const entry = BLOCK_PALETTE[item.getName?.()];
    const div = item.getDiv?.();
    if (!entry || !div) continue;
    div.style.setProperty("--cat", `var(--cat-${entry.slug})`);
    div.style.setProperty("--cat-bright", `var(--cat-${entry.slug}-bright)`);
  }
}

function BlocklyWorkspace({
  initialXml, onWorkspaceReady, onWorkspaceChange, onBlockCountChange, onScaleChange,
  isDark, goal = "physics", initialZoom,
  /* Debug-mode props (optional). Threaded from IDELayout in a later task —
     until then these defaults keep the context-menu breakpoint entry safely
     inert: nothing reads as breakable and toggling is a no-op. */
  isBreakable = () => false,
  toggleBreakpoint = () => {},
  breakpoints = EMPTY_BREAKPOINTS,
}) {
  const hostRef = useRef(null);
  const workspaceRef = useRef(null);
  const [loadError, setLoadError] = useState("");

  const onReadyRef = useRef(onWorkspaceReady);
  const onChangeRef = useRef(onWorkspaceChange);
  const initialXmlRef = useRef(initialXml);
  const initialZoomRef = useRef(initialZoom);
  const goalRef = useRef(goal);
  const isDarkRef = useRef(isDark);
  onReadyRef.current = onWorkspaceReady;
  onChangeRef.current = onWorkspaceChange;
  goalRef.current = goal;
  isDarkRef.current = isDark;
  const onCountRef = useRef(onBlockCountChange);
  onCountRef.current = onBlockCountChange;
  const onScaleRef = useRef(onScaleChange);
  onScaleRef.current = onScaleChange;
  const lastScaleRef = useRef(null);

  /* debugApiRef mirrors the debug props into a stable ref so the mount
     effect's context-menu registration (registered once, deps []) never
     closes over stale isBreakable/toggleBreakpoint/breakpoints. */
  const debugApiRef = useRef({ isBreakable, toggleBreakpoint, breakpoints });
  debugApiRef.current = { isBreakable, toggleBreakpoint, breakpoints };

  /* ── One-time workspace setup ──────────────────────────── */
  useEffect(() => {
    defineCustomBlocksAndGenerator(Blockly);

    const theme = getBlocklyTheme(isDarkRef.current);

    // Blockly v11 uses a callback-based dialog API. Route through our
    // dialogService so the custom VariableDialog component handles these.
    if (Blockly.dialog) {
      if (Blockly.dialog.setPrompt) {
        Blockly.dialog.setPrompt((msg, defaultVal, callback) => {
          dialogService.prompt(msg, defaultVal).then(callback);
        });
      }
      if (Blockly.dialog.setAlert) {
        Blockly.dialog.setAlert((msg, callback) => {
          dialogService.alert(msg).then(() => { if (callback) callback(); });
        });
      }
      if (Blockly.dialog.setConfirm) {
        Blockly.dialog.setConfirm((msg, callback) => {
          dialogService.confirm(msg).then(callback);
        });
      }
    }

    let workspace;
    try {
      workspace = Blockly.inject(hostRef.current, {
        toolbox: buildToolboxXml(goalRef.current),
        theme,
        comments: true,
        trashcan: false,
        scrollbars: true,
        sounds: false,
        grid: { spacing: 25, length: 3, colour: gridColourFor(isDarkRef.current), snap: true },
        zoom: {
          controls: false,
          wheel: true,
          startScale: 0.9,
          maxScale: 2,
          minScale: 0.35,
          scaleSpeed: 1.1,
        },
        renderer: "zelos",
        media: "/blockly-media/",
      });
    } catch (err) {
      console.warn("Blockly inject failed:", err);
      setLoadError("Blockly failed to initialize.");
      return undefined;
    }

    workspaceRef.current = workspace;
    onReadyRef.current(workspace);
    decorateToolboxRows(workspace);

    /* Right-click → breakpoint. A click-anywhere toggle would fight dragging
       in the editable workspace, and the old one accepted breakpoints on
       blocks that can never pause. This entry is DISABLED with a reason on
       those, which is the whole point: the debugger stops lying. */
    const BP_ITEM_ID = "physide_toggle_breakpoint";
    if (!Blockly.ContextMenuRegistry.registry.getItem(BP_ITEM_ID)) {
      Blockly.ContextMenuRegistry.registry.register({
        id: BP_ITEM_ID,
        scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
        weight: 20,
        preconditionFn: (scope) =>
          debugApiRef.current.isBreakable(scope.block.id) ? "enabled" : "disabled",
        displayText: (scope) => {
          const api = debugApiRef.current;
          if (!api.isBreakable(scope.block.id)) {
            return "Can't pause here — this block doesn't report a value";
          }
          return api.breakpoints.has(scope.block.id) ? "Remove breakpoint" : "Set breakpoint";
        },
        callback: (scope) => debugApiRef.current.toggleBreakpoint(scope.block.id),
      });
    }

    /* Alt+click — the fast path for students who find right-click slow. */
    const altClickHandler = (e) => {
      if (!e.altKey) return;
      const block = Blockly.common.getSelected();
      if (!block) return;
      e.preventDefault();
      debugApiRef.current.toggleBreakpoint(block.id);
    };
    hostRef.current.addEventListener("click", altClickHandler);

    // The inject options above always start at a fixed 90% (startScale: 0.9);
    // push the localStorage-restored zoom (SimulationContext's blocklyZoom,
    // fed in as initialZoom) into the freshly-injected workspace so it
    // actually reaches the canvas. The wheel-sync VIEWPORT_CHANGE listener
    // below keeps the on-canvas readout honest from here on.
    workspace.setScale((initialZoomRef.current ?? 90) / 100);

    // Restore saved XML
    const xml = initialXmlRef.current;
    if (xml) {
      try {
        const dom = Blockly.utils.xml.textToDom(xml);
        Blockly.Xml.domToWorkspace(dom, workspace);
      } catch (err) {
        console.warn("Could not restore Blockly XML:", err);
      }
    }

    // Emit changes
    let normalizing = false;
    const listener = (event) => {
      try {
        if (event.type === Blockly.Events.VIEWPORT_CHANGE) {
          /* Wheel zoom is a real zoom — report it so the toolbar readout
             stops claiming a fixed 90%. Rounded, and compared before
             emitting, so setScale → VIEWPORT_CHANGE → setScale cannot loop. */
          const pct = Math.round(workspace.getScale() * 100);
          if (pct !== lastScaleRef.current) {
            lastScaleRef.current = pct;
            onScaleRef.current?.(pct);
          }
          return;
        }
        if (event.type === Blockly.Events.UI || event.type === "block_drag") {
          return;
        }

        if (!normalizing && !workspace.isDragging()) {
          normalizing = true;
          try {
            normalizeSimulationStructure(workspace);
            greyOrphanedBlocks(workspace);
          } finally {
            normalizing = false;
          }
        }

        const dom = Blockly.Xml.workspaceToDom(workspace);
        const xmlText = Blockly.Xml.domToText(dom);
        const code = generatePythonFromWorkspace(workspace);
        onChangeRef.current(xmlText, code);
        onCountRef.current?.(countContentBlocks(workspace));
      } catch (err) {
        console.warn("Workspace change listener error:", err);
      }
    };
    workspace.addChangeListener(listener);

    normalizeSimulationStructure(workspace);
    greyOrphanedBlocks(workspace);
    onCountRef.current?.(countContentBlocks(workspace));

    /* ── Custom constant popup: intercept __NEW__ on physics_const_block ── */
    const constListener = (event) => {
      if (
        !event.blockId ||
        event.type !== Blockly.Events.BLOCK_CHANGE ||
        event.element !== "field" ||
        event.name !== "CONST" ||
        event.newValue !== "__NEW__"
      ) return;

      const block = workspace.getBlockById(event.blockId);
      if (!block || block.type !== "physics_const_block") return;

      // Revert dropdown immediately so it doesn't sit on __NEW__
      const prevVal = event.oldValue || "g";
      block.getField("CONST").setValue(prevVal);

      // Prompt for name, then value
      dialogService.prompt("Name for your new constant:", "MY_CONST").then((rawName) => {
        if (!rawName) return; // cancelled
        const name = rawName.trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
        if (!name) return;

        dialogService.prompt("Value for " + name + ":", "1.0").then((rawVal) => {
          if (rawVal === null || rawVal === undefined) return; // cancelled
          const value = rawVal.trim() || "0";

          // If not already registered, add it
          if (!customConstantsRegistry.some((c) => c.name === name)) {
            customConstantsRegistry.push({ name, value });
          }

          // Set this block to the new constant
          block.getField("CONST").setValue(name);
        });
      });
    };
    workspace.addChangeListener(constListener);

    /* ── Keep Blockly SVG sized to its container at all times ─────────
       ResizeObserver fires whenever the host element's layout box
       changes (drag-resize, window resize, viewport toggle, etc.)
       and tells Blockly to re-measure and redraw itself.           */
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        resizeBlocklyWorkspace(Blockly, workspace);
      });
    });
    resizeObserver.observe(hostRef.current);

    requestAnimationFrame(() => {
      resizeBlocklyWorkspace(Blockly, workspace);
    });

    return () => {
      hostRef.current?.removeEventListener("click", altClickHandler);
      resizeObserver.disconnect();
      workspace.removeChangeListener(listener);
      workspace.removeChangeListener(constListener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, []);

  /* ── Rebuild the toolbox when the project goal changes ─── */
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    try {
      ws.updateToolbox(buildToolboxXml(goal));
      decorateToolboxRows(ws);
      greyOrphanedBlocks(ws);
    } catch (e) {
      console.warn("BlocklyWorkspace: could not rebuild toolbox for goal", goal, e);
    }
  }, [goal]);

  /* ── React to theme changes ────────────────────────────── */
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const theme = getBlocklyTheme(isDark);
    ws.setTheme(theme);
  }, [isDark]);

  if (loadError) {
    return <div className="fallback-panel">{loadError}</div>;
  }

  return (
    <div className="blockly-workspace-wrapper">
      <BlockSearch workspaceRef={workspaceRef} />
      <div ref={hostRef} className="blockly-host" />
      <WorkspaceTrash workspaceRef={workspaceRef} />
    </div>
  );
}

/* ── Read-only Blockly (for showing block reference alongside code) ── */
function ReadOnlyBlockly({
  xml, isDark, breakpoints, onBlockClick, executingBlockId,
  /* Debug-mode props (optional). Threaded from IDELayout in a later task —
     debugMode defaults false, so `.bp-available` never lights up until then
     (isBreakable is short-circuited out of the check entirely). */
  debugMode = false,
  isBreakable = () => false,
  breakableIds,
}) {
  const hostRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return undefined;

    defineCustomBlocksAndGenerator(Blockly);
    const theme = getBlocklyTheme(isDark);

    const ws = Blockly.inject(hostRef.current, {
      readOnly: true,
      theme,
      scrollbars: true,
      renderer: "zelos",
      sounds: false,
      grid: { spacing: 25, length: 3, colour: gridColourFor(isDark), snap: false },
      zoom: { controls: false, wheel: true, startScale: 0.65, maxScale: 2, minScale: 0.15, scaleSpeed: 1.1 },
      media: "/blockly-media/",
    });
    wsRef.current = ws;
    decorateToolboxRows(ws);

    if (xml) {
      try {
        const dom = Blockly.utils.xml.textToDom(xml);
        Blockly.Xml.domToWorkspace(dom, ws);
      } catch (e) {
        console.warn("ReadOnlyBlockly: could not load XML", e);
      }
    }

    /* ── Keep Blockly SVG sized to its container at all times ── */
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        resizeBlocklyWorkspace(Blockly, ws);
      });
    });
    resizeObserver.observe(hostRef.current);

    requestAnimationFrame(() => {
      resizeBlocklyWorkspace(Blockly, ws);
    });

    return () => {
      resizeObserver.disconnect();
      ws.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const theme = getBlocklyTheme(isDark);
    ws.setTheme(theme);
  }, [isDark]);

  /* Two markers, not one: a solid red outline where a breakpoint is SET, and
     a hollow dashed outline on every block that CAN hold one while debug mode
     is on. A student can now see the difference between "I didn't set it" and
     "this block can never pause". */
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const bpSet = breakpoints || new Set();
    for (const block of ws.getAllBlocks(false)) {
      const g = block.getSvgRoot();
      if (!g) continue;
      const isBp = bpSet.has(block.id);
      g.classList.toggle("bp-block", isBp);
      g.classList.toggle("bp-available", debugMode && !isBp && isBreakable(block.id));
    }
  }, [breakpoints, debugMode, isBreakable, breakableIds]);

  // ── Execution highlight (yellow glow on running block) ──
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const allBlocks = ws.getAllBlocks(false);
    for (const block of allBlocks) {
      const svgGroup = block.getSvgRoot();
      if (!svgGroup) continue;
      if (block.id === executingBlockId) {
        svgGroup.classList.add('block-executing');
      } else {
        svgGroup.classList.remove('block-executing');
      }
    }
  }, [executingBlockId]);

  return <div ref={hostRef} className="blockly-host blockly-readonly" style={{ cursor: onBlockClick ? 'pointer' : undefined }} />;
}

export default BlocklyWorkspace;
export { ReadOnlyBlockly };

