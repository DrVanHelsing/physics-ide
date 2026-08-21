import { describe, test, expect } from "vitest";
import { getBlocklyTheme, gridColourFor } from "../blocklyTheme";
import { CATEGORY_NAMES, styleNameFor, categoryStyleNameFor, BLOCK_PALETTE } from "../blockPalette";

describe("getBlocklyTheme", () => {
  test("both themes carry every category's block and category styles", () => {
    for (const isDark of [true, false]) {
      const t = getBlocklyTheme(isDark);
      expect(t.name).toBe(isDark ? "physics-dark" : "physics-light");
      for (const n of CATEGORY_NAMES) {
        expect(t.blockStyles[styleNameFor(n)].colourPrimary).toBe(BLOCK_PALETTE[n].fill);
        expect(t.categoryStyles[categoryStyleNameFor(n)].colour).toBe(BLOCK_PALETTE[n].fill);
      }
      expect(t.fontStyle.size).toBe(13);
    }
  });
  test("themes are cached, not redefined per call", () => {
    expect(getBlocklyTheme(true)).toBe(getBlocklyTheme(true));
  });
  test("grid colour follows the theme", () => {
    expect(gridColourFor(true)).not.toBe(gridColourFor(false));
  });
});
