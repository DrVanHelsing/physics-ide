import { describe, test, expect } from "vitest";
import Blockly from "../blocklyLib";
import { defineCustomBlocksAndGenerator } from "../blocklyGenerator";
import { getAllBlockEntries } from "../blockRegistry";
import { styleNameFor } from "../blockPalette";

describe("block styles", () => {
  test("every registered custom block uses its category's style, no hue integers remain", () => {
    defineCustomBlocksAndGenerator(Blockly);

    for (const entry of getAllBlockEntries()) {
      if (!Blockly.Blocks[entry.id]) continue; // registry entries without a JSON definition are Plan 4's problem
      /* Registry category → palette category, directly. Plan 3 needed an alias
         map here for the two categories with no palette entry (Starter, Scene);
         Plan 4 Task 4's re-categorisation removed both, and with them the map. */
      // Instantiate headlessly and read the resolved style name.
      const ws = new Blockly.Workspace();
      try {
        const block = ws.newBlock(entry.id);
        const styleName = block.getStyleName?.() ?? block.styleName_;
        expect(styleName, entry.id).toBe(styleNameFor(entry.category));
        expect(block.hue_, `${entry.id} still has a hue`).toBeFalsy();
      } finally {
        ws.dispose();
      }
    }
  });
});
