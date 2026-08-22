import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* __dirname + resolve() rather than import.meta.url — see the note in
   utils/blockly/__tests__/paletteCssSync.test.js for why the URL form trips
   Vite's compile-time asset rewrite under Vitest's jsdom environment. */
const CSS = readFileSync(resolve(__dirname, "../tokens.css"), "utf8");

/** The declaration value for a token at bare :root, whitespace-collapsed. */
function tokenValue(name) {
  const m = CSS.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

describe("token ramp extensions (Plan 5, 2026-08-22)", () => {
  test("the spacing ramp gains exactly one rung at 64px", () => {
    expect(tokenValue("--space-8")).toBe("48px");
    expect(tokenValue("--space-9")).toBe("64px");
    // One rung, not a habit: nothing above it.
    expect(tokenValue("--space-10")).toBeNull();
  });

  test("the join code's tracking is a named token, not a magic number", () => {
    expect(tokenValue("--tracking-code")).toBe("0.08em");
    expect(tokenValue("--label-tracking")).toBe("0.02em");
  });

  test("the z-index scale exists and is ordered", () => {
    const z = ["--z-header", "--z-dropdown", "--z-overlay", "--z-dialog", "--z-toast"]
      .map((n) => Number(tokenValue(n)));
    expect(z).toEqual([50, 100, 900, 1000, 1100]);
  });
});
