import { describe, test, expect } from "vitest";
import { VIEWPORT_THEME, viewportStyleText, GLOWSCRIPT_VERSION } from "../glowRunner";

describe("viewport theme", () => {
  test("both themes are complete and distinct", () => {
    for (const key of ["dark", "light"]) {
      expect(VIEWPORT_THEME[key]).toMatchObject({
        bg: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        text: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        link: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      });
    }
    expect(VIEWPORT_THEME.dark.bg).not.toBe(VIEWPORT_THEME.light.bg);
  });

  test("the style text carries the theme into every surface the scene paints", () => {
    const css = viewportStyleText(VIEWPORT_THEME.light);
    for (const part of ["html, body", "#glowscript-root", "#glowscript canvas"]) {
      expect(css).toContain(part);
    }
    // The background appears on body, the root, the host and the canvas.
    expect(css.split(VIEWPORT_THEME.light.bg).length - 1).toBeGreaterThanOrEqual(4);
    expect(css).toContain(VIEWPORT_THEME.light.link);
  });

  test("the pinned engine version is the one the URLs interpolate", () => {
    expect(GLOWSCRIPT_VERSION).toBe("3.2");
  });
});
