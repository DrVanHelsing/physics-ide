/**
 * blockHelpUrl.test.js — Regression proof for Plan 4 / Task 11.
 *
 * Right-click → Help was dead on every custom block: zero `helpUrl`
 * declarations existed anywhere in the repo despite HelpPage.js carrying a
 * full block reference the whole time. defineCustomBlocksAndGenerator now
 * derives a `helpUrl` for every registry-owned block, mechanically, from its
 * id — `#/help?block=<id>` — in a loop that runs after every block
 * registration (the JSON-defined blocks AND the manually-registered
 * `physics_const_block`), so it cannot drift as blocks are added or
 * renamed.
 *
 * This suite instantiates REAL block instances (`workspace.newBlock(type)`)
 * rather than inspecting `Blockly.Blocks[type]` directly, because that is
 * what actually matters: Blockly's Block constructor does
 * `Object.assign(this, Blockly.Blocks[type])` *before* calling `init()`, so
 * setting `helpUrl` on the shared definition object only survives onto an
 * instance if `init()` doesn't overwrite it. For JSON-defined blocks whose
 * spec carries its own `helpUrl` (every stock block this product uses —
 * logic_boolean, math_number, math_arithmetic, math_constant — resolved
 * from a `%{BKY_..._HELPURL}` message reference), `jsonInit()` calls
 * `setHelpUrl()` again on the instance and wins, which is exactly the
 * "never clobber an upstream URL" contract. An assertion against the
 * shared definition object would not catch a regression in that contract;
 * an assertion against a constructed instance's `.helpUrl` — read the same
 * way `Block.prototype.showHelp()` reads it — does.
 *
 * The registry (blockRegistry.js) has 120 entries; 4 are stock, so exactly
 * 116 get a derived `#/help?block=` URL. That is asserted here by deriving
 * "custom" as "registry entry minus the stock set", not hard-coded from the
 * brief, so this test fails loudly if a future block addition changes
 * either number.
 */
import Blockly from "../blocklyLib";
import { defineCustomBlocksAndGenerator } from "../blocklyGenerator";
import { getAllBlockEntries } from "../blockRegistry";

// The only four registry entries backed by Blockly's own stock block
// definitions (see blockRegistry.test.js's "the five phantom stock entries
// are gone" — these four are the ones that remain real, registered blocks).
const STOCK_IDS = new Set(["logic_boolean", "math_number", "math_arithmetic", "math_constant"]);

describe("block helpUrl derivation (Task 11)", () => {
  let ws;

  beforeAll(() => {
    defineCustomBlocksAndGenerator(Blockly);
  });

  beforeEach(() => {
    ws = new Blockly.Workspace();
  });

  afterEach(() => {
    ws.dispose();
  });

  test("the registry is 120 entries, 4 stock + 116 custom", () => {
    const entries = getAllBlockEntries();
    expect(entries).toHaveLength(120);
    const custom = entries.filter((e) => !STOCK_IDS.has(e.id));
    expect(custom).toHaveLength(116);
  });

  test("every custom registry block's real instance gets a #/help?block=<id> helpUrl", () => {
    const entries = getAllBlockEntries();
    const custom = entries.filter((e) => !STOCK_IDS.has(e.id));
    expect(custom.length).toBeGreaterThan(0);
    for (const entry of custom) {
      const block = ws.newBlock(entry.id);
      expect(block.helpUrl, `${entry.id}.helpUrl`).toBe(`#/help?block=${entry.id}`);
    }
  });

  test("the manually-registered physics_const_block also gets its helpUrl (loop runs after all registration)", () => {
    const block = ws.newBlock("physics_const_block");
    expect(block.helpUrl).toBe("#/help?block=physics_const_block");
  });

  test("stock blocks keep their own upstream helpUrl on a real instance, untouched", () => {
    for (const id of STOCK_IDS) {
      const block = ws.newBlock(id);
      expect(typeof block.helpUrl, `${id}.helpUrl`).toBe("string");
      expect(block.helpUrl.length, `${id}.helpUrl`).toBeGreaterThan(0);
      expect(block.helpUrl.startsWith("#/help?block=")).toBe(false);
    }
  });

  test("every derived helpUrl anchor round-trips back to its registry id", () => {
    const entries = getAllBlockEntries();
    const custom = entries.filter((e) => !STOCK_IDS.has(e.id));
    for (const entry of custom) {
      const block = ws.newBlock(entry.id);
      const m = /^#\/help\?block=([A-Za-z0-9_]+)$/.exec(block.helpUrl);
      expect(m, `${entry.id}.helpUrl must match the deep-link pattern`).not.toBeNull();
      expect(m[1]).toBe(entry.id);
    }
  });
});
