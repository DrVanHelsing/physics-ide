import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  defineCustomBlocksAndGenerator,
  generatePythonFromWorkspace,
  BLOCK_CATALOGUE,
  customConstantsRegistry,
} from "../utils/blockly/blocklyGenerator";
import { SearchIcon, XIcon } from "./Icons";
import * as dialogService from "../utils/export/dialogService";
import { buildToolboxXml } from "../utils/blockly/toolbox";

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

  return (
    <div className="block-search">
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
      {open && query && (
        <div className="block-search-dropdown">
          {results.length > 0
            ? results.map(item => (
                <button
                  key={item.type + item.category}
                  className="block-search-item"
                  onMouseDown={() => { openCategory(item.category); setQuery(""); setOpen(false); }}
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
/* ── Dark / Light Blockly themes ─────────────────────────── */
function buildBlocklyTheme(Blockly, isDark) {
  if (isDark) {
    return Blockly.Theme.defineTheme("physics-dark", {
      name: "physics-dark",
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: "#1a1b2e",
        toolboxBackgroundColour: "#141521",
        toolboxForegroundColour: "#c8cad8",
        flyoutBackgroundColour: "#1a1b2e",
        flyoutForegroundColour: "#c8cad8",
        flyoutOpacity: 0.96,
        scrollbarColour: "#3b3d56",
        scrollbarOpacity: 0.55,
        insertionMarkerColour: "#7aa2f7",
        insertionMarkerOpacity: 0.4,
        cursorColour: "#f5e0dc",
      },
      fontStyle: {
        family: "'Inter', 'Segoe UI', system-ui, sans-serif",
        weight: "500",
        size: 11,
      },
    });
  }

  return Blockly.Theme.defineTheme("physics-light", {
    name: "physics-light",
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: "#f5f5f8",
      toolboxBackgroundColour: "#eaecf0",
      toolboxForegroundColour: "#333",
      flyoutBackgroundColour: "#f5f5f8",
      flyoutForegroundColour: "#333",
      flyoutOpacity: 0.96,
      scrollbarColour: "#c0c2cc",
      scrollbarOpacity: 0.55,
      insertionMarkerColour: "#3b82f6",
      insertionMarkerOpacity: 0.4,
      cursorColour: "#333",
    },
    fontStyle: {
      family: "'Inter', 'Segoe UI', system-ui, sans-serif",
      weight: "500",
      size: 11,
    },
  });
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

  const getSetupTail = () => {
    let node = simStart.getInputTargetBlock("SETUP");
    if (!node) return null;
    while (node.getNextBlock()) node = node.getNextBlock();
    return node;
  };

  const appendToSetup = (block) => {
    if (!block || block === simStart || block === simEnd) return;
    if (!block.previousConnection) return;

    if (block.previousConnection.isConnected()) {
      block.previousConnection.disconnect();
    }

    const setupHead = simStart.getInputTargetBlock("SETUP");
    if (!setupHead) {
      setupConnection.connect(block.previousConnection);
      changed = true;
      return;
    }

    const tail = getSetupTail();
    if (tail && tail.nextConnection && !tail.nextConnection.isConnected()) {
      tail.nextConnection.connect(block.previousConnection);
      changed = true;
    }
  };

  // Move any blocks currently chained after Simulation Start (except Sim End) into SETUP.
  let chained = simStart.getNextBlock();
  while (chained && chained !== simEnd) {
    const next = chained.getNextBlock();
    appendToSetup(chained);
    chained = next;
  }

  // Move any other top-level statement blocks into SETUP.
  const topBlocks = workspace.getTopBlocks(true);
  for (const top of topBlocks) {
    if (top === simStart || top === simEnd) continue;
    appendToSetup(top);
  }

  // Simulation End must be the final top-level block after Simulation Start.
  if (simEnd && simEnd.previousConnection && simStart.nextConnection) {
    const endNext = simEnd.getNextBlock();
    if (endNext) appendToSetup(endNext);

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

/* ── Disable orphaned blocks (data-science goal) ───────────────
   MakeCode pattern: a data analysis is anchored by a ds_start_block
   "hat". Any top-level block NOT rooted in that hat is disabled
   (rendered grey, generates no code) so "in use vs unused" is visible.
   No-op until at least one hat exists, so legacy DS projects that have
   no hat yet are left fully enabled. Idempotent (guards on isEnabled)
   so it can run inside the change listener without an event storm. */
function disableOrphanedBlocks(workspace, goal) {
  if (!workspace || goal !== "datascience") return false;

  const tops = workspace.getTopBlocks(false);
  const hasHat = tops.some((b) => b.type === "ds_start_block");
  if (!hasHat) return false;

  let changed = false;
  for (const top of tops) {
    const enable = top.type === "ds_start_block";
    for (const b of top.getDescendants(false)) {
      if (b.isShadow()) continue;
      if (b.isEnabled() !== enable) {
        b.setEnabled(enable);
        changed = true;
      }
    }
  }
  return changed;
}

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

function BlocklyWorkspace({ initialXml, onWorkspaceReady, onWorkspaceChange, isDark, goal = "physics" }) {
  const hostRef = useRef(null);
  const workspaceRef = useRef(null);
  const [loadError, setLoadError] = useState("");

  const onReadyRef = useRef(onWorkspaceReady);
  const onChangeRef = useRef(onWorkspaceChange);
  const initialXmlRef = useRef(initialXml);
  const goalRef = useRef(goal);
  onReadyRef.current = onWorkspaceReady;
  onChangeRef.current = onWorkspaceChange;
  goalRef.current = goal;

  /* ── One-time workspace setup ──────────────────────────── */
  useEffect(() => {
    const Blockly = window.Blockly;
    if (!Blockly) {
      setLoadError("Blockly failed to load. Check your network / CDN access.");
      return undefined;
    }

    defineCustomBlocksAndGenerator(Blockly);

    const theme = buildBlocklyTheme(Blockly, true);

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

    const workspace = Blockly.inject(hostRef.current, {
      toolbox: buildToolboxXml(goalRef.current),
      theme,
      comments: true,
      trashcan: true,
      scrollbars: true,
      sounds: false,
      grid: { spacing: 25, length: 3, colour: "#2a2c40", snap: true },
      zoom: {
        controls: false,
        wheel: true,
        startScale: 0.9,
        maxScale: 2,
        minScale: 0.35,
        scaleSpeed: 1.1,
      },
      renderer: "zelos",
    });

    workspaceRef.current = workspace;
    onReadyRef.current(workspace);

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
        if (
          event.type === Blockly.Events.UI ||
          event.type === Blockly.Events.VIEWPORT_CHANGE ||
          event.type === "block_drag"
        ) {
          return;
        }

        if (!normalizing && !workspace.isDragging()) {
          normalizing = true;
          try {
            normalizeSimulationStructure(workspace);
            disableOrphanedBlocks(workspace, goalRef.current);
          } finally {
            normalizing = false;
          }
        }

        const dom = Blockly.Xml.workspaceToDom(workspace);
        const xmlText = Blockly.Xml.domToText(dom);
        const code = generatePythonFromWorkspace(workspace);
        onChangeRef.current(xmlText, code);
      } catch (err) {
        console.warn("Workspace change listener error:", err);
      }
    };
    workspace.addChangeListener(listener);

    normalizeSimulationStructure(workspace);
    disableOrphanedBlocks(workspace, goalRef.current);

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
      disableOrphanedBlocks(ws, goal);
    } catch (e) {
      console.warn("BlocklyWorkspace: could not rebuild toolbox for goal", goal, e);
    }
  }, [goal]);

  /* ── React to theme changes ────────────────────────────── */
  useEffect(() => {
    const ws = workspaceRef.current;
    const Blockly = window.Blockly;
    if (!ws || !Blockly) return;
    const theme = buildBlocklyTheme(Blockly, isDark);
    ws.setTheme(theme);

    // Update grid colour
    const gridColour = isDark ? "#2a2c40" : "#ddd";
    const svgGrid = ws.getParentSvg()?.querySelector(".blocklyGridPattern line");
    if (svgGrid) svgGrid.setAttribute("stroke", gridColour);
  }, [isDark]);

  if (loadError) {
    return <div className="fallback-panel">{loadError}</div>;
  }

  return (
    <div className="blockly-workspace-wrapper">
      <BlockSearch workspaceRef={workspaceRef} />
      <div ref={hostRef} className="blockly-host" />
    </div>
  );
}

/* ── Read-only Blockly (for showing block reference alongside code) ── */
function ReadOnlyBlockly({ xml, isDark, breakpoints, onBlockClick, executingBlockId }) {
  const hostRef = useRef(null);
  const wsRef = useRef(null);
  const onBlockClickRef = useRef(onBlockClick);
  const bpDotsRef = useRef(new Map());  // blockId → SVG group element
  useEffect(() => { onBlockClickRef.current = onBlockClick; }, [onBlockClick]);

  useEffect(() => {
    const Blockly = window.Blockly;
    if (!Blockly || !hostRef.current) return undefined;
    const dots = bpDotsRef.current;

    defineCustomBlocksAndGenerator(Blockly);
    const theme = buildBlocklyTheme(Blockly, isDark);

    const ws = Blockly.inject(hostRef.current, {
      readOnly: true,
      theme,
      scrollbars: true,
      renderer: "zelos",
      sounds: false,
      grid: { spacing: 25, length: 3, colour: isDark ? "#2a2c40" : "#ddd", snap: false },
      zoom: { controls: false, wheel: true, startScale: 0.65, maxScale: 2, minScale: 0.15, scaleSpeed: 1.1 },
    });
    wsRef.current = ws;

    if (xml) {
      try {
        const dom = Blockly.utils.xml.textToDom(xml);
        Blockly.Xml.domToWorkspace(dom, ws);
      } catch (e) {
        console.warn("ReadOnlyBlockly: could not load XML", e);
      }
    }

    /* Blockly readOnly mode suppresses workspace change-events for clicks,
       so we use a native DOM click handler on the SVG and walk up the
       element tree to find the block's data-id attribute. */
    const svg = ws.getParentSvg();
    const domClickHandler = (e) => {
      let el = e.target;
      while (el && el !== svg) {
        const blockId = el.getAttribute && el.getAttribute('data-id');
        if (blockId) {
          onBlockClickRef.current?.(blockId);
          return;
        }
        el = el.parentElement;
      }
    };
    if (svg) svg.addEventListener('click', domClickHandler);

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
      if (svg) svg.removeEventListener('click', domClickHandler);
      resizeObserver.disconnect();
      dots.clear();
      ws.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml]);

  useEffect(() => {
    const ws = wsRef.current;
    const Blockly = window.Blockly;
    if (!ws || !Blockly) return;
    const theme = buildBlocklyTheme(Blockly, isDark);
    ws.setTheme(theme);
  }, [isDark]);

  // ── Breakpoint red dots ──
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const svg = ws.getParentSvg();
    if (!svg) return;
    const bpSet = breakpoints || new Set();
    const dots = bpDotsRef.current;

    // Remove highlight from blocks no longer breakpointed
    for (const [bid, svgGroup] of dots) {
      if (!bpSet.has(bid)) {
        svgGroup.classList.remove('dm-bp-block');
        dots.delete(bid);
      }
    }

    // Add highlight to new breakpoints
    for (const bid of bpSet) {
      if (dots.has(bid)) continue;
      const block = ws.getBlockById(bid);
      if (!block) continue;
      const svgGroup = block.getSvgRoot();
      if (!svgGroup) continue;

      svgGroup.classList.add('dm-bp-block');
      dots.set(bid, svgGroup);
    }
  }, [breakpoints]);

  // ── Execution highlight (yellow glow on running block) ──
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const allBlocks = ws.getAllBlocks(false);
    for (const block of allBlocks) {
      const svgGroup = block.getSvgRoot();
      if (!svgGroup) continue;
      if (block.id === executingBlockId) {
        svgGroup.classList.add('dm-block-executing');
      } else {
        svgGroup.classList.remove('dm-block-executing');
      }
    }
  }, [executingBlockId]);

  return <div ref={hostRef} className="blockly-host blockly-readonly" style={{ cursor: onBlockClick ? 'pointer' : undefined }} />;
}

export default BlocklyWorkspace;
export { ReadOnlyBlockly };

