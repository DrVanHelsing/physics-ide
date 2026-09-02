import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BLOCK_PALETTE, CATEGORY_NAMES, getCategoryColour, styleNameFor,
  categoryStyleNameFor, cssVarFor, brightFor, paletteCssText,
  blockStylesFromPalette, categoryStylesFromPalette, STOCK_STYLE_ALIASES,
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
  test("27 categories, unique fills, unique slugs", () => {
    expect(CATEGORY_NAMES).toHaveLength(27);
    expect(new Set(CATEGORY_NAMES.map((n) => BLOCK_PALETTE[n].fill)).size).toBe(27);
    expect(new Set(CATEGORY_NAMES.map((n) => BLOCK_PALETTE[n].slug)).size).toBe(27);
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

/* ── Task 8: `--cat-*` consumers ─────────────────────────────
   CategoryTag (HelpPage.js) and GravityPlayground's landing-page COLORS
   are plain, unexported values/components — like Tag, Note and Kbd beside
   CategoryTag, they aren't part of any module's public surface, so these
   pin the *source text* of each consumer against the palette, the same
   fs-read approach paletteCssSync.test.js uses one directory over to pin
   tokens.css against paletteCssText(). */
describe("Task 8 consumers", () => {
  const helpPageSrc = readFileSync(
    resolve(__dirname, "../../../components/HelpPage.js"), "utf8",
  );
  const gravitySrc = readFileSync(
    resolve(__dirname, "../../../welcome/GravityPlayground.js"), "utf8",
  );

  test("CategoryTag resolves its background from the palette's --cat-* var, for a known category", () => {
    // CategoryTag's own construction: background: `var(${cssVarFor(category)})`.
    // Pin the mechanism for a known category (Values) end to end: the var
    // name it would compute, that tokens.css actually declares that var
    // with the palette's fill, and that the call site converted by this
    // task asks for exactly that category.
    const category = "Values";
    expect(cssVarFor(category)).toBe("--cat-values");
    expect(paletteCssText()).toContain(`--cat-values: ${BLOCK_PALETTE[category].fill};`);
    expect(helpPageSrc).toContain('background: `var(${cssVarFor(category)})`');
    expect(helpPageSrc).toContain('<CategoryTag category="Values" />');
  });

  test("GravityPlayground's landing-page COLORS derive from BLOCK_PALETTE fills, not a hardcoded hex palette", () => {
    for (const ref of [
      "BLOCK_PALETTE.Objects.fill",
      "BLOCK_PALETTE.Values.fill",
      "BLOCK_PALETTE.Motion.fill",
      'BLOCK_PALETTE["Data Science"].fill',
      "BLOCK_PALETTE.Charts.fill",
    ]) {
      expect(gravitySrc).toContain(ref);
    }
    // the old pastel Tailwind-300 hues this task removed must not come back
    for (const hex of ["7dd3fc", "f9a8d4", "fcd34d", "86efac", "c4b5fd"]) {
      expect(gravitySrc).not.toContain(hex);
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   Stock Blockly blocks must adopt OUR palette, not Blockly's.

   These tests deliberately re-derive the style names from Blockly
   itself rather than restating the alias map, so they keep their
   value across a Blockly upgrade: if a future version renames a
   style or introduces a new one, the first test fails with the
   real name rather than silently passing.
   ───────────────────────────────────────────────────────────── */
describe("stock Blockly block styles adopt the palette", () => {
  /** Style names the shipped stock blocks actually reference. */
  async function stockStyleNames() {
    const ns = await import("blockly/core");
    await import("blockly/blocks");
    const B = ns.default ?? ns;
    const found = new Set();
    for (const [type, def] of Object.entries(B.Blocks)) {
      if (!def || typeof def.init !== "function") continue;
      let style = null;
      const probe = new Proxy(
        {
          type,
          workspace: {},
          jsonInit(json) { if (json && json.style) style = json.style; },
          setStyle(s) { style = s; },
        },
        {
          // Any builder method the block calls that we have not stubbed
          // returns the probe itself, so chained init() bodies run to
          // completion instead of throwing halfway and losing the style.
          get: (t, k) => (k in t ? t[k] : () => probe),
        },
      );
      try { def.init.call(probe); } catch { /* block needs more of Blockly than we stub; skip */ }
      if (style) found.add(style);
    }
    return found;
  }

  test("every style name stock blocks use is defined by our theme", async () => {
    const styles = blockStylesFromPalette();
    const stock = await stockStyleNames();
    // Guard the guard: if the probe stopped finding anything, this test
    // would pass vacuously.
    expect(stock.size).toBeGreaterThanOrEqual(6);
    const missing = [...stock].filter((name) => !styles[name]);
    expect(missing).toEqual([]);
  });

  test("the aliases resolve to their category's real palette colour", () => {
    const styles = blockStylesFromPalette();
    for (const [blocklyName, category] of Object.entries(STOCK_STYLE_ALIASES)) {
      expect(BLOCK_PALETTE[category], `${category} must exist in the palette`).toBeTruthy();
      expect(styles[blocklyName].colourPrimary).toBe(BLOCK_PALETTE[category].fill);
    }
    // The four that matter, spelled out — Lists/Loops/Functions are what
    // made the whole Advanced drawer look mis-coloured.
    expect(styles.list_blocks.colourPrimary).toBe(BLOCK_PALETTE.Lists.fill);
    expect(styles.loop_blocks.colourPrimary).toBe(BLOCK_PALETTE.Loops.fill);
    expect(styles.procedure_blocks.colourPrimary).toBe(BLOCK_PALETTE.Functions.fill);
    expect(styles.variable_blocks.colourPrimary).toBe(BLOCK_PALETTE.Variables.fill);
  });

  test("an alias never silently shadows a name the slugs already produce", () => {
    for (const name of Object.keys(STOCK_STYLE_ALIASES)) {
      expect(CATEGORY_NAMES.map(styleNameFor)).not.toContain(name);
    }
  });
});
