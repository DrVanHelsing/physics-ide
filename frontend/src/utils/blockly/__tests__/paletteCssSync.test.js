import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { paletteCssText } from "../blockPalette";

/* NOTE: deliberately __dirname + resolve() rather than
   fileURLToPath(new URL(..., import.meta.url)) — the latter (the brief's
   literal suggestion) trips Vite's compile-time "new URL(literal,
   import.meta.url)" asset-URL rewrite (see vite.config.mjs), which under
   Vitest's jsdom environment resolves against http://localhost:3000/
   instead of the real file, throwing "The URL must be of scheme file" on
   fileURLToPath. blockRegistry.test.js in this same directory already
   establishes the __dirname + resolve() pattern for reading a sibling
   source file from a test — mirrored here for consistency. */
const tokensCss = readFileSync(resolve(__dirname, "../../../styles/tokens.css"), "utf8");

describe("tokens.css ↔ BLOCK_PALETTE", () => {
  test("the stylesheet carries the palette verbatim", () => {
    for (const line of paletteCssText().split("\n")) {
      const decl = line.trim();
      if (decl.startsWith("--cat-")) expect(tokensCss).toContain(decl);
    }
  });
});
