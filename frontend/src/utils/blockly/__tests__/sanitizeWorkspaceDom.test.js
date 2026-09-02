/**
 * The unknown-block safeguard (Plan 10 Task 4): a saved workspace that
 * references a since-deleted block type loads WITHOUT crashing — the dead
 * node is dropped (with its chain), everything else survives, and the
 * caller learns what was skipped. Proven against the real registered
 * blocks and the real domToWorkspace.
 */
import Blockly from "../blocklyLib";
import { defineCustomBlocksAndGenerator } from "../blocklyGenerator";
import { sanitizeWorkspaceDom } from "../sanitizeWorkspaceDom";

const XMLNS = 'xmlns="https://developers.google.com/blockly/xml"';

describe("sanitizeWorkspaceDom — retirement's one safeguard", () => {
  beforeAll(() => {
    defineCustomBlocksAndGenerator(Blockly);
  });

  test("an unknown top-level block is dropped; the known one loads; the type is reported", () => {
    const dom = Blockly.utils.xml.textToDom(`<xml ${XMLNS}>
      <block type="retired_ghost_block" x="10" y="10"></block>
      <block type="rate_block" x="10" y="120"><field name="N">60</field></block>
    </xml>`);
    const { dropped } = sanitizeWorkspaceDom(Blockly, dom);
    expect(dropped).toEqual(["retired_ghost_block"]);

    const ws = new Blockly.Workspace();
    try {
      Blockly.Xml.domToWorkspace(dom, ws); // would throw un-sanitized
      expect(ws.getBlocksByType("rate_block")).toHaveLength(1);
    } finally {
      ws.dispose();
    }
  });

  test("an unknown block MID-CHAIN takes its tail with it — no invented reconnection", () => {
    const dom = Blockly.utils.xml.textToDom(`<xml ${XMLNS}>
      <block type="rate_block"><field name="N">60</field>
        <next><block type="retired_ghost_block">
          <next><block type="rate_block"><field name="N">30</field></block></next>
        </block></next>
      </block>
    </xml>`);
    const { dropped } = sanitizeWorkspaceDom(Blockly, dom);
    expect(dropped).toEqual(["retired_ghost_block"]);
    const ws = new Blockly.Workspace();
    try {
      Blockly.Xml.domToWorkspace(dom, ws);
      expect(ws.getBlocksByType("rate_block")).toHaveLength(1); // the head only
    } finally {
      ws.dispose();
    }
  });

  test("a fully-known workspace passes through untouched", () => {
    const dom = Blockly.utils.xml.textToDom(`<xml ${XMLNS}>
      <block type="graph_series_block"><field name="NAME">ys</field><field name="MODE">gdots</field></block>
    </xml>`);
    const { dropped } = sanitizeWorkspaceDom(Blockly, dom);
    expect(dropped).toEqual([]);
    const ws = new Blockly.Workspace();
    try {
      Blockly.Xml.domToWorkspace(dom, ws);
      expect(ws.getAllBlocks(false)).toHaveLength(1);
    } finally {
      ws.dispose();
    }
  });
});
