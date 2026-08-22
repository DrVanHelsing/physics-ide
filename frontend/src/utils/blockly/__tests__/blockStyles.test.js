import { describe, test, expect } from "vitest";
import Blockly from "../blocklyLib";
import { defineCustomBlocksAndGenerator } from "../blocklyGenerator";
import { getAllBlockEntries } from "../blockRegistry";
import { styleNameFor, STYLE_CATEGORY_ALIASES } from "../blockPalette";

describe("block styles", () => {
  test("every registered custom block uses its category's style, no hue integers remain", () => {
    defineCustomBlocksAndGenerator(Blockly);

    for (const entry of getAllBlockEntries()) {
      if (!Blockly.Blocks[entry.id]) continue; // registry entries without a JSON definition are Plan 4's problem
      const category = STYLE_CATEGORY_ALIASES[entry.category] ?? entry.category;
      // Instantiate headlessly and read the resolved style name.
      const ws = new Blockly.Workspace();
      try {
        const block = ws.newBlock(entry.id);
        const styleName = block.getStyleName?.() ?? block.styleName_;
        expect(styleName, entry.id).toBe(styleNameFor(category));
        expect(block.hue_, `${entry.id} still has a hue`).toBeFalsy();
      } finally {
        ws.dispose();
      }
    }
  });
});
