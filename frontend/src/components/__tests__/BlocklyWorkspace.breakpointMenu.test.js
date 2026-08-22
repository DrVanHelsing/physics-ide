/**
 * Task 14 fix round 1 — the breakpoint context-menu registration used to be
 * guarded with `if (!getItem(BP_ITEM_ID))`, so only the FIRST-ever mounted
 * BlocklyWorkspace instance ever registered it. Blockly's
 * ContextMenuRegistry is a module-level singleton — after IDELayout remounts
 * BlocklyWorkspace (it keys it with `ws-${workspaceReloadKey}`, bumped by the
 * "Analyse Run" flow, a real exercised path), the registered
 * preconditionFn/displayText/callback stayed frozen on the FIRST instance's
 * debugApiRef forever; the new instance's isBreakable/toggleBreakpoint/
 * breakpoints were never consulted again for the rest of the session.
 *
 * The fix unregisters in the effect's cleanup (and defensively before
 * registering) so every mount registers fresh. This test drives that
 * lifecycle directly against a fake Blockly (mocking `blocklyLib`, following
 * the same convention `WorkspaceTrash.test.js` uses for a fake workspace).
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mountComponent } from "../../test/renderHelpers";
import BlocklyWorkspace from "../BlocklyWorkspace";
import Blockly from "../../utils/blockly/blocklyLib";

/* ── Fake ContextMenuRegistry — mirrors Blockly's real throw-on-duplicate /
   throw-on-missing semantics closely enough to catch a regression either
   way (silently skipped OR thrown). `vi.mock` factories are hoisted above
   this file's own top-level code, so anything the factory closes over must
   be created through `vi.hoisted` to exist by the time the factory runs. ── */
const { registryStore, fakeRegistry, selectedRef, blocksRef } = vi.hoisted(() => {
  const registryStore = new Map();
  const blocksRef = { current: [] };
  const fakeRegistry = {
    getItem: vi.fn((id) => registryStore.get(id) || null),
    register: vi.fn((item) => {
      if (registryStore.has(item.id)) {
        throw new Error(`Item with id "${item.id}" already registered.`);
      }
      registryStore.set(item.id, item);
    }),
    unregister: vi.fn((id) => {
      if (!registryStore.has(id)) {
        throw new Error(`No item with id "${id}" registered.`);
      }
      registryStore.delete(id);
    }),
  };
  const selectedRef = { current: null };
  return { registryStore, fakeRegistry, selectedRef, blocksRef };
});

/** A block whose SVG root records which decoration classes are on it. */
function fakeBlock(id) {
  const classes = new Set();
  const svgRoot = {
    classList: {
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
      contains: (name) => classes.has(name),
    },
  };
  return { id, classes, getSvgRoot: () => svgRoot };
}

function fakeWorkspace() {
  return {
    getToolbox: () => null,
    getAllBlocks: () => blocksRef.current,
    getTopBlocks: () => [],
    getBlockById: () => null,
    setScale: vi.fn(),
    getScale: () => 0.9,
    resize: vi.fn(),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
    updateToolbox: vi.fn(),
    setTheme: vi.fn(),
    dispose: vi.fn(),
  };
}

vi.mock("../../utils/blockly/blocklyLib", () => ({
  default: {
    inject: vi.fn(() => fakeWorkspace()),
    Events: { VIEWPORT_CHANGE: "viewport_change", UI: "ui" },
    utils: { xml: { textToDom: vi.fn() } },
    Xml: { workspaceToDom: vi.fn(() => ({})), domToText: vi.fn(() => "") },
    ContextMenuRegistry: {
      registry: fakeRegistry,
      ScopeType: { BLOCK: "block" },
    },
    common: { getSelected: () => selectedRef.current },
  },
}));

vi.mock("../../utils/blockly/blocklyGenerator", () => ({
  defineCustomBlocksAndGenerator: vi.fn(),
  generatePythonFromWorkspace: vi.fn(() => ""),
  BLOCK_CATALOGUE: [],
  customConstantsRegistry: [],
}));

vi.mock("../../utils/blockly/toolbox", () => ({
  buildToolboxXml: vi.fn(() => "<xml></xml>"),
}));

vi.mock("../../utils/blockly/blocklyTheme", () => ({
  getBlocklyTheme: vi.fn(() => ({})),
  gridColourFor: vi.fn(() => "#000"),
}));

// The trashcan isn't relevant here and its real module reaches into Blockly
// classes (Blockly.DeleteArea, ComponentManager.Capability) at import time
// that this fake Blockly does not provide.
vi.mock("../WorkspaceTrash", () => ({
  default: () => null,
}));

const BP_ITEM_ID = "physide_toggle_breakpoint";

let mounted = null;

beforeEach(() => {
  registryStore.clear();
  selectedRef.current = null;
  blocksRef.current = [];
  class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
  registryStore.clear();
});

describe("BlocklyWorkspace — breakpoint context-menu registration lifecycle", () => {
  test("mount registers the item", () => {
    mounted = mountComponent(<BlocklyWorkspace onWorkspaceReady={() => {}} />);
    expect(fakeRegistry.register).toHaveBeenCalledTimes(1);
    expect(fakeRegistry.register.mock.calls[0][0].id).toBe(BP_ITEM_ID);
    expect(fakeRegistry.getItem(BP_ITEM_ID)).not.toBeNull();
  });

  test("unmount unregisters the item", () => {
    mounted = mountComponent(<BlocklyWorkspace onWorkspaceReady={() => {}} />);
    mounted.unmount();
    mounted = null;
    expect(fakeRegistry.unregister).toHaveBeenCalledWith(BP_ITEM_ID);
    expect(fakeRegistry.getItem(BP_ITEM_ID)).toBeNull();
  });

  test("a remount re-registers — the item is not left frozen on the first mount forever", () => {
    // First mount (e.g. IDELayout's first render of BlocklyWorkspace).
    const isBreakableA = () => true;
    const toggleA = vi.fn();
    const first = mountComponent(
      <BlocklyWorkspace
        onWorkspaceReady={() => {}}
        isBreakable={isBreakableA}
        toggleBreakpoint={toggleA}
        breakpoints={new Set()}
      />
    );
    expect(fakeRegistry.register).toHaveBeenCalledTimes(1);
    const itemA = fakeRegistry.register.mock.calls[0][0];
    expect(itemA.preconditionFn({ block: { id: "blk-1" } })).toBe("enabled");

    // Simulates IDELayout's `key={`ws-${workspaceReloadKey}`}` remount (the
    // "Analyse Run" flow): the old instance unmounts, a new one mounts with
    // its own debug API.
    first.unmount();

    const isBreakableB = () => false;
    const toggleB = vi.fn();
    const second = mountComponent(
      <BlocklyWorkspace
        onWorkspaceReady={() => {}}
        isBreakable={isBreakableB}
        toggleBreakpoint={toggleB}
        breakpoints={new Set()}
      />
    );

    // Without the fix, this second registration never happens (the old
    // `if (!getItem(...))` guard treats the stale first-mount registration
    // as "already there") — register would still show only 1 call total,
    // failing this assertion.
    expect(fakeRegistry.register).toHaveBeenCalledTimes(2);
    const itemB = fakeRegistry.register.mock.calls[1][0];

    // The fresh registration consults instance B's debug API, not A's.
    expect(itemB.preconditionFn({ block: { id: "blk-1" } })).toBe("disabled");
    itemB.callback({ block: { id: "blk-1" } });
    expect(toggleB).toHaveBeenCalledWith("blk-1");
    expect(toggleA).not.toHaveBeenCalled();

    mounted = second;
  });

  /**
   * Final-review finding I3 — `bp-block` was the one debug decoration that was
   * not debug-gated, while its siblings `bp-available` and `block-executing`
   * both were. Breakpoints are armed only in debug mode and the set survives
   * leaving it, so a student outside debug mode saw solid red breakpoint
   * outlines, pressed Run, and nothing paused: a marker that cannot fire.
   */
  test("a set breakpoint outlines its block only while debug mode is on", () => {
    const blk = fakeBlock("blk-1");
    blocksRef.current = [blk];
    const shared = {
      onWorkspaceReady: () => {},
      breakpoints: new Set(["blk-1"]),
      isBreakable: () => true,
    };

    const inDebug = mountComponent(<BlocklyWorkspace {...shared} debugMode />);
    expect(blk.classes.has("bp-block")).toBe(true);
    inDebug.unmount();

    // Leaving debug keeps the breakpoint SET — it just stops advertising it.
    mounted = mountComponent(<BlocklyWorkspace {...shared} debugMode={false} />);
    expect(blk.classes.has("bp-block")).toBe(false);
    expect(blk.classes.has("bp-available")).toBe(false);
  });

  test("double-register (e.g. StrictMode-style double mount) does not throw", () => {
    // Defensive: register() is guarded with an unregister-if-present check
    // rather than assuming the registry is always clean.
    const first = mountComponent(<BlocklyWorkspace onWorkspaceReady={() => {}} />);
    expect(() => {
      first.unmount();
    }).not.toThrow();

    expect(() => {
      mounted = mountComponent(<BlocklyWorkspace onWorkspaceReady={() => {}} />);
    }).not.toThrow();
  });
});

/**
 * Task 17 Step 4a — the SHARED workspace ref goes stale.
 *
 * BlocklyWorkspace's own workspaceRef was already nulled on dispose. The one
 * that leaked is SimulationContext's: handleWorkspaceReady fills it via the
 * onWorkspaceReady prop and nothing ever emptied it, so after a goal change
 * or a project switch IDELayout's onHighlight — the trace table's
 * click-a-variable-to-find-the-block gesture — called highlightBlock on a
 * DISPOSED workspace and silently did nothing, every time.
 */
describe("BlocklyWorkspace — the shared workspace ref is emptied on dispose", () => {
  test("onWorkspaceReady receives the workspace on mount and null on unmount", () => {
    const onWorkspaceReady = vi.fn();
    mounted = mountComponent(<BlocklyWorkspace onWorkspaceReady={onWorkspaceReady} />);

    expect(onWorkspaceReady).toHaveBeenCalledTimes(1);
    expect(onWorkspaceReady.mock.calls[0][0]).toBeTruthy();

    mounted.unmount();
    mounted = null;

    expect(onWorkspaceReady).toHaveBeenCalledTimes(2);
    expect(onWorkspaceReady.mock.calls[1][0]).toBeNull();
  });

  test("the null lands AFTER dispose, so nothing can reach a half-torn-down workspace", () => {
    const order = [];
    const ws = fakeWorkspace();
    ws.dispose = vi.fn(() => order.push("dispose"));
    Blockly.inject.mockReturnValueOnce(ws);

    mounted = mountComponent(
      <BlocklyWorkspace onWorkspaceReady={(w) => { if (w === null) order.push("null"); }} />,
    );
    mounted.unmount();
    mounted = null;

    expect(order).toEqual(["dispose", "null"]);
  });
});

/**
 * Task 17 — the breakpoint decorations moved off ReadOnlyBlockly (the mirror
 * DebugMode rendered) and onto the workspace the student actually edits,
 * which is why the marks never appeared where anyone was working.
 */
describe("BlocklyWorkspace — breakpoint and execution decorations", () => {
  function blockWithSvg(id) {
    const g = document.createElement("div"); // classList is all the effect uses
    return { id, getSvgRoot: () => g, _g: g };
  }

  function mountWith(blocks, props) {
    const ws = fakeWorkspace();
    ws.getAllBlocks = () => blocks;
    Blockly.inject.mockReturnValueOnce(ws);
    mounted = mountComponent(<BlocklyWorkspace onWorkspaceReady={() => {}} {...props} />);
    return ws;
  }

  test("a set breakpoint gets .bp-block; a breakable one without gets .bp-available", () => {
    const set = blockWithSvg("blk-set");
    const free = blockWithSvg("blk-free");
    const inert = blockWithSvg("blk-inert");
    mountWith([set, free, inert], {
      debugMode: true,
      breakpoints: new Set(["blk-set"]),
      isBreakable: (id) => id !== "blk-inert",
    });

    expect(set._g.classList.contains("bp-block")).toBe(true);
    expect(set._g.classList.contains("bp-available")).toBe(false);
    expect(free._g.classList.contains("bp-available")).toBe(true);
    expect(inert._g.classList.contains("bp-available")).toBe(false);
  });

  test("outside debug mode nothing is marked as available", () => {
    const free = blockWithSvg("blk-free");
    mountWith([free], { debugMode: false, breakpoints: new Set(), isBreakable: () => true });
    expect(free._g.classList.contains("bp-available")).toBe(false);
  });

  test("only the executing block carries .block-executing", () => {
    const a = blockWithSvg("a");
    const b = blockWithSvg("b");
    mountWith([a, b], { debugMode: true, executingBlockId: "b" });
    expect(a._g.classList.contains("block-executing")).toBe(false);
    expect(b._g.classList.contains("block-executing")).toBe(true);
  });

  /* Fix round 1, Finding 2 — the glow is debug-mode-only, like the
     .bp-available effect beside it and like the Help text says. useTrace sets
     executingBlockId on every trace batch, so without the guard an ORDINARY
     run strobed the loud yellow stroke ~10x/sec over Blockly's own
     highlight. */
  test("outside debug mode the glow never paints, even with a live executing block", () => {
    const a = blockWithSvg("a");
    mountWith([a], { debugMode: false, executingBlockId: "a" });
    expect(a._g.classList.contains("block-executing")).toBe(false);
  });

  test("leaving debug mode clears a glow that was already lit", () => {
    const a = blockWithSvg("a");
    const ws = fakeWorkspace();
    ws.getAllBlocks = () => [a];
    Blockly.inject.mockReturnValueOnce(ws);
    mounted = mountComponent(
      <BlocklyWorkspace onWorkspaceReady={() => {}} debugMode executingBlockId="a" />,
    );
    expect(a._g.classList.contains("block-executing")).toBe(true);

    mounted.rerender(
      <BlocklyWorkspace onWorkspaceReady={() => {}} debugMode={false} executingBlockId="a" />,
    );
    expect(a._g.classList.contains("block-executing")).toBe(false);
  });
});
