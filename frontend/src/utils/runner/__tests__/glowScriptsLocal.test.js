import { describe, test, expect } from "vitest";
import { GLOWSCRIPT_SCRIPTS, GLOWSCRIPT_VERSION } from "../glowRunner";

describe("vendored GlowScript", () => {
  test("every runtime script is same-origin", () => {
    const urls = Object.values(GLOWSCRIPT_SCRIPTS);
    expect(urls).toHaveLength(6);
    for (const u of urls) {
      expect(u, u).toMatch(/^\/vendor\/glowscript\//);
      expect(u, u).not.toMatch(/^https?:/);
    }
  });
  test("the versioned names still interpolate the exported version", () => {
    expect(GLOWSCRIPT_SCRIPTS.glow).toBe(`/vendor/glowscript/glow.${GLOWSCRIPT_VERSION}.min.js`);
  });
});
