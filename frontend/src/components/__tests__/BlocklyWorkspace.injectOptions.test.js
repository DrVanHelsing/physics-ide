/**
 * F3 (2026-08-28 UI audit) — a plain wheel gesture ZOOMED the canvas instead
 * of scrolling it, on both the editable workspace and the read-only viewer.
 *
 * Both inject calls passed `scrollbars: true` + `zoom: { wheel: true }` and no
 * `move` key. Blockly 11.2.2's core/options.ts:238 reads
 *
 *   if (!moveOptions.scrollbars || move['wheel'] === undefined)
 *     moveOptions.wheel = typeof moveOptions.scrollbars === 'object';
 *
 * — a BOOLEAN `scrollbars` makes that `false`, so `move.wheel` resolved to
 * false, and core/workspace_svg.ts:1555's `(e.ctrlKey || !canWheelMove)`
 * predicate became unconditionally true: every wheel event zoomed and the
 * scroll branch was dead code.
 *
 * Stating `move` explicitly is the whole fix, so the options object each
 * inject call is handed is exactly what this file asserts — at both call
 * sites, because the read-only viewer (the marking room's submission view)
 * had the same defect.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mountComponent } from "../../test/renderHelpers";
import BlocklyWorkspace, { ReadOnlyBlockly } from "../BlocklyWorkspace";
import Blockly from "../../utils/blockly/blocklyLib";

function fakeWorkspace() {
  return {
    getToolbox: () => null,
    getAllBlocks: () => [],
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
    inject: vi.fn(),
    Events: { VIEWPORT_CHANGE: "viewport_change", UI: "ui" },
    utils: { xml: { textToDom: vi.fn() } },
    Xml: { workspaceToDom: vi.fn(() => ({})), domToText: vi.fn(() => "") },
    ContextMenuRegistry: {
      registry: { getItem: vi.fn(() => null), register: vi.fn(), unregister: vi.fn() },
      ScopeType: { BLOCK: "block" },
    },
    common: { getSelected: () => null },
  },
}));

vi.mock("../../utils/blockly/blocklyGenerator", () => ({
  defineCustomBlocksAndGenerator: vi.fn(),
  generatePythonFromWorkspace: vi.fn(() => ""),
  BLOCK_CATALOGUE: [],
  customConstantsRegistry: [],
}));
vi.mock("../../utils/blockly/toolbox", () => ({ buildToolboxXml: vi.fn(() => "<xml></xml>") }));
vi.mock("../../utils/blockly/blocklyTheme", () => ({
  getBlocklyTheme: vi.fn(() => ({})),
  gridColourFor: vi.fn(() => "#000"),
}));
vi.mock("../WorkspaceTrash", () => ({ default: () => null }));

let mounted = null;

beforeEach(() => {
  Blockly.inject.mockImplementation(() => fakeWorkspace());
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
});

/** The one assertion both call sites share: plain wheel scrolls, and it can
 *  only do so while scrollbars stay truthy (options.ts discards move.wheel
 *  otherwise), with Ctrl+wheel still reaching the zoom branch. */
function expectWheelScrolls(options) {
  expect(options.move).toEqual({ scrollbars: true, drag: true, wheel: true });
  expect(options.zoom.wheel).toBe(true);
  // pinch is deliberately NOT stated — options.ts defaults it to
  // (zoom.wheel || zoom.controls), i.e. true, and it is touch-only.
  expect(options.zoom).not.toHaveProperty("pinch");
}

describe("Blockly inject options — the wheel scrolls, Ctrl+wheel zooms", () => {
  test("the editable workspace states move explicitly", () => {
    mounted = mountComponent(<BlocklyWorkspace onWorkspaceReady={() => {}} />);
    expect(Blockly.inject).toHaveBeenCalledTimes(1);
    const options = Blockly.inject.mock.calls[0][1];
    expectWheelScrolls(options);
    // Untouched neighbours — the fix adds a key, it does not restyle the canvas.
    expect(options.scrollbars).toBe(true);
    expect(options.zoom.startScale).toBe(0.9);
    expect(options.renderer).toBe("zelos");
  });

  test("the read-only viewer states move explicitly too", () => {
    mounted = mountComponent(<ReadOnlyBlockly isDark />);
    expect(Blockly.inject).toHaveBeenCalledTimes(1);
    const options = Blockly.inject.mock.calls[0][1];
    expectWheelScrolls(options);
    expect(options.readOnly).toBe(true);
    expect(options.scrollbars).toBe(true);
    expect(options.zoom.startScale).toBe(0.65);
  });
});
