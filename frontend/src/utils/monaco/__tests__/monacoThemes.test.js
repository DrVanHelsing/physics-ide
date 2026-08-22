import { describe, test, expect } from "vitest";
import { MONACO_THEMES, physicsThemeName, VPYTHON_BUILTINS } from "../monacoThemes";
import { contrastRatio } from "../../blockly/blockPalette";

describe("physics Monaco themes", () => {
  test("names resolve", () => {
    expect(physicsThemeName(true)).toBe("physics-dark");
    expect(physicsThemeName(false)).toBe("physics-light");
  });
  test("every token colour clears AA on its editor background", () => {
    for (const name of ["physics-dark", "physics-light"]) {
      const t = MONACO_THEMES[name];
      const bg = t.colors["editor.background"];
      for (const rule of t.rules) {
        if (!rule.foreground) continue;
        expect(contrastRatio(`#${rule.foreground}`, bg), `${name}:${rule.token}`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  test("the VPython vocabulary is tokenized", () => {
    for (const b of ["sphere", "vector", "rate", "box", "arrow"]) {
      expect(VPYTHON_BUILTINS).toContain(b);
    }
  });
});
