/**
 * The Graphs category (Plan 10 R1) — codegen contract, byte-for-byte.
 *
 * Three blocks, one promise: a graph display container emits a top-level
 * `graph(...)` with its series creations dedented beneath it (the
 * sim_start_block strip-dedent idiom — VPython graph calls need no
 * indentation of their own); a series is `NAME = gcurve|gdots(color=...,
 * label="NAME")` binding to the most recently created graph; a plot is
 * `SERIES.plot(x, y)`. The vendored GlowScript runtime already ships all
 * three constructors — these blocks are the entire surface.
 *
 * Built from XML through the real generator (workspaceToCode), the same
 * path a live workspace takes.
 */
import Blockly from "../blocklyLib";
import { defineCustomBlocksAndGenerator } from "../blocklyGenerator";

const XMLNS = 'xmlns="https://developers.google.com/blockly/xml"';

function codeFor(xmlBody) {
  const ws = new Blockly.Workspace();
  try {
    const dom = Blockly.utils.xml.textToDom(`<xml ${XMLNS}>${xmlBody}</xml>`);
    Blockly.Xml.domToWorkspace(dom, ws);
    return Blockly.Python.workspaceToCode(ws);
  } finally {
    ws.dispose();
  }
}

describe("the Graphs blocks generate the GlowScript they promise", () => {
  beforeAll(() => {
    defineCustomBlocksAndGenerator(Blockly);
  });

  test("graph_display_block: a top-level graph(...) with its series dedented beneath it", () => {
    const code = codeFor(`
      <block type="graph_display_block">
        <field name="TITLE">Motion</field>
        <field name="XLABEL">t (s)</field>
        <field name="YLABEL">x (m)</field>
        <statement name="SERIES">
          <block type="graph_series_block">
            <field name="NAME">xs</field>
            <field name="MODE">gcurve</field>
          </block>
        </statement>
      </block>`);
    expect(code).toContain('graph(title="Motion", xtitle="t (s)", ytitle="x (m)", fast=False)\n');
    // Dedented: the series line starts at column 0, directly plottable.
    // (The colour is the block's default — FieldColour rejects values
    // outside its picker palette when set via XML, so the conversion is
    // asserted against the default here and in the dots test below.)
    expect(code).toMatch(/^xs = gcurve\(color=vector\(0\.04, 0\.45, 0\.82\), label="xs"\)$/m);
  });

  test("graph_series_block: dots mode and the colour conversion", () => {
    const code = codeFor(`
      <block type="graph_series_block">
        <field name="NAME">vs</field>
        <field name="MODE">gdots</field>
        <field name="COL">#0973d1</field>
      </block>`);
    expect(code).toContain('vs = gdots(color=vector(0.04, 0.45, 0.82), label="vs")');
  });

  test("graph_plot_block: SERIES.plot(x, y) from its value inputs", () => {
    const code = codeFor(`
      <block type="graph_plot_block">
        <field name="SERIES">xs</field>
        <value name="X"><block type="expr_block"><field name="EXPR">t</field></block></value>
        <value name="Y"><block type="expr_block"><field name="EXPR">ball.pos.x</field></block></value>
      </block>`);
    expect(code).toContain("xs.plot(t, ball.pos.x)");
  });

  test("an empty plot falls back to (0, 0) rather than emitting broken Python", () => {
    const code = codeFor(`
      <block type="graph_plot_block">
        <field name="SERIES">data</field>
      </block>`);
    expect(code).toContain("data.plot(0, 0)");
  });
});
