import { describe, test, expect } from "vitest";
import {
  BLOCK_PALETTE, CATEGORY_NAMES, getCategoryColour, styleNameFor,
  categoryStyleNameFor, cssVarFor, brightFor, paletteCssText,
  blockStylesFromPalette, categoryStylesFromPalette,
  relativeLuminance, contrastRatio, hueOf,
} from "../blockPalette";

const AA = 4.5;

describe("colour helpers", () => {
  test("relativeLuminance matches WCAG reference points", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });
  test("contrastRatio matches known pairs", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 2);
    expect(contrastRatio("#0973D1", "#FFFFFF")).toBeGreaterThanOrEqual(4.75);
  });
  test("hueOf reads hue angles", () => {
    expect(hueOf("#FF0000")).toBeCloseTo(0, 1);
    expect(hueOf("#00FF00")).toBeCloseTo(120, 1);
  });
});

describe("BLOCK_PALETTE v2", () => {
  test("26 categories, unique fills, unique slugs", () => {
    expect(CATEGORY_NAMES).toHaveLength(26);
    expect(new Set(CATEGORY_NAMES.map((n) => BLOCK_PALETTE[n].fill)).size).toBe(26);
    expect(new Set(CATEGORY_NAMES.map((n) => BLOCK_PALETTE[n].slug)).size).toBe(26);
  });
  test("every fill and secondary clears AA under white", () => {
    for (const n of CATEGORY_NAMES) {
      const { fill, secondary, on } = BLOCK_PALETTE[n];
      expect(on).toBe("#FFFFFF");
      expect(contrastRatio(fill, on), `${n} fill`).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(secondary, on), `${n} secondary`).toBeGreaterThanOrEqual(AA);
    }
  });
  test("no colour anywhere sits in the reserved red band (340°–15°)", () => {
    for (const n of CATEGORY_NAMES) {
      const e = BLOCK_PALETTE[n];
      for (const key of ["fill", "secondary", "tertiary", "bright"]) {
        const h = hueOf(e[key]);
        const inBand = h >= 340 || h <= 15;
        expect(inBand, `${n}.${key} hue ${h}`).toBe(false);
      }
    }
  });
  test("brights are decorative only — never in any blockStyle", () => {
    const styles = blockStylesFromPalette();
    const brights = new Set(CATEGORY_NAMES.map((n) => brightFor(n)));
    for (const s of Object.values(styles)) {
      for (const v of Object.values(s)) expect(brights.has(v), v).toBe(false);
    }
  });
  test("derived artefacts are complete and consistent", () => {
    const styles = blockStylesFromPalette();
    const cats = categoryStylesFromPalette();
    const css = paletteCssText();
    for (const n of CATEGORY_NAMES) {
      expect(styles[styleNameFor(n)].colourPrimary).toBe(BLOCK_PALETTE[n].fill);
      expect(cats[categoryStyleNameFor(n)].colour).toBe(BLOCK_PALETTE[n].fill);
      expect(css).toContain(`${cssVarFor(n)}: ${BLOCK_PALETTE[n].fill};`);
      expect(css).toContain(`${cssVarFor(n)}-bright: ${brightFor(n)};`);
      expect(getCategoryColour(n)).toBe(BLOCK_PALETTE[n].fill);
    }
  });
});
