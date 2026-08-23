/**
 * Task 15 fix round 2 — release-blocking regression, caught by the wrap-up's
 * offline smoke test (see task-19-report.md's "CRITICAL FINDING").
 *
 * `injectFrameBoundaries` rewrites every rate() call-statement in compiled
 * GlowScript JS to run frame-boundary bookkeeping ahead of it (see Task 15's
 * "Next frame" stepping). The original version (commit d80a5158) inserted a
 * semicolon-separated statement sequence directly before the `rate(` token
 * assuming every call sat in a bare statement — but RapydScript actually
 * compiles an awaited `rate()` call as a PARENTHESIZED expression-statement,
 * `(await rate(240));`, and a statement sequence is not a legal expression
 * inside those parens. Every real VPython template (Projectile, Spring, ...)
 * threw `SyntaxError: Unexpected token ';'` at `frameWindow.eval()` as a
 * result — this broke Run for the general case, confirmed in a real browser
 * (Task 19's `node --check` root-cause capture).
 *
 * The fixture below is reconstructed verbatim from Task 19's captured
 * evidence: its "before" shape is recovered by stripping the OLD code's own
 * known injected prefix from the POST-injection string the report captured
 * (`__compiled-full.js:249`), which leaves exactly `(await rate(240));` —
 * confirmed against the vendored RapydScript compiler's documented
 * expression-statement convention (award-parenthesizing an awaited
 * expression-statement) rather than assumed.
 */
import { describe, test, expect } from "vitest";
import {
  injectFrameBoundaries,
  labelColourToHex,
  nextLabelColour,
  VIEWPORT_THEME,
} from "../glowRunner";

const BOOKKEEPING =
  "window.__physide_iter=(window.__physide_iter||0)+1;" +
  "if(window.__physide_frame_steps>0){window.__physide_frame_steps--;" +
  "if(window.__physide_frame_steps===0){window.__physide_paused=true;window.__physide_steps=0;}}";

/** The OLD (buggy) transform, verbatim from commit d80a5158 — kept here only
 *  so the RED case can be demonstrated against the same fixture the FIXED
 *  code is proven against, without reintroducing the bug into glowRunner.js
 *  itself. */
function oldBuggyInject(source) {
  return source.replace(/\b(await\s+)?rate\s*\(/g, BOOKKEEPING + "$&");
}

/** `new Function` throws SyntaxError synchronously on invalid JS without
 *  ever executing it — the same check Task 19 ran via `node --check`. */
function parses(code) {
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
    return true;
  } catch (e) {
    return e;
  }
}

// The REAL compiled shape RapydScript emits for an awaited rate() call
// inside a VPython animation loop — the exact fixture from Task 19's report,
// reconstructed by removing the known injected bookkeeping prefix from the
// captured failing string, wrapped in a realistic surrounding loop so a
// syntax check exercises the same statement position a real compile would.
const REAL_FIXTURE = `
async function __main__(){
  var ball=sphere();
  while(true){
    (await rate(240));
    ball.pos=ball.pos.add(vec(1,0,0));
  }
}
`;

describe("injectFrameBoundaries — Task 15 fix round 2 regression", () => {
  test("RED: the old naive prepend-before-rate( transform breaks on the REAL compiled shape", () => {
    const broken = oldBuggyInject(REAL_FIXTURE);
    const result = parses(broken);
    expect(result).toBeInstanceOf(SyntaxError);
    // Same failure Task 19 captured via `node --check`: the injected
    // semicolon lands inside `(await rate(240))`'s parens.
    expect(result.message).toMatch(/Unexpected token ';'/);
  });

  test("GREEN: the fixed transform parses cleanly on the exact same fixture", () => {
    const fixed = injectFrameBoundaries(REAL_FIXTURE, BOOKKEEPING);
    expect(parses(fixed)).toBe(true);
    // The bookkeeping and the original statement both survive, wrapped in a
    // block — the original `(await rate(240));` is preserved byte-for-byte.
    expect(fixed).toContain("(await rate(240));");
    expect(fixed).toContain("window.__physide_iter=(window.__physide_iter||0)+1;");
  });

  test("handles a plain (non-parenthesized) `await rate(...);` statement", () => {
    const source = "async function f(){ while(true){ await rate(60); x=1; } }";
    const fixed = injectFrameBoundaries(source, BOOKKEEPING);
    expect(parses(fixed)).toBe(true);
    expect(fixed).toContain("await rate(60);");
  });

  test("handles a bare (non-awaited) `rate(...);` statement", () => {
    const source = "function f(){ while(true){ rate(60); x=1; } }";
    const fixed = injectFrameBoundaries(source, BOOKKEEPING);
    expect(parses(fixed)).toBe(true);
    expect(fixed).toContain("rate(60);");
  });

  test("handles rate() calls with a non-trivial argument expression (nested parens)", () => {
    const source = "async function f(){ while(true){ (await rate(1/(2*dt))); x=1; } }";
    const fixed = injectFrameBoundaries(source, BOOKKEEPING);
    expect(parses(fixed)).toBe(true);
    expect(fixed).toContain("(await rate(1/(2*dt)));");
  });

  test("rewrites every rate() call in a file with more than one", () => {
    const source = [
      "async function f(){",
      "  while(true){ (await rate(240)); a=1; }",
      "  while(true){ (await rate(60)); b=2; }",
      "}",
    ].join("\n");
    const fixed = injectFrameBoundaries(source, BOOKKEEPING);
    expect(parses(fixed)).toBe(true);
    expect(fixed.match(/__physide_iter=/g)).toHaveLength(2);
  });

  test("defensive: a rate() call embedded in an unrelated expression is left completely untouched", () => {
    // Not a real GlowScript shape, but the algorithm must fail closed rather
    // than guess when a call isn't its own statement.
    const source = "var y = 1 + rate(5);";
    expect(injectFrameBoundaries(source, BOOKKEEPING)).toBe(source);
  });

  test("defensive: rate( with unbalanced parens is left untouched rather than corrupting the file", () => {
    const source = "var weird = rate(240;"; // malformed on purpose
    expect(injectFrameBoundaries(source, BOOKKEEPING)).toBe(source);
  });
});

/* ─────────────────────────────────────────────────────────────
   Telemetry label colours.

   A telemetry label is drawn inside the 3D scene, so no stylesheet
   reaches it; the generator emits a literal `color=color.white`,
   which is invisible on light mode's #f2f4f8 background. The runtime
   repaints it — but only when it is still wearing a colour we own.
   ───────────────────────────────────────────────────────────── */
describe("telemetry label retheming", () => {
  test("labelColourToHex converts GlowScript's 0..1 vec to hex", () => {
    expect(labelColourToHex({ x: 1, y: 1, z: 1 })).toBe("#ffffff");
    expect(labelColourToHex({ x: 0, y: 0, z: 0 })).toBe("#000000");
    // clamps rather than producing junk
    expect(labelColourToHex({ x: 1.4, y: -0.2, z: 0.5 })).toBe("#ff0080");
    expect(labelColourToHex(null)).toBeNull();
    expect(labelColourToHex({})).toBeNull();
  });

  test("the generator's white default is repainted for the active theme", () => {
    expect(nextLabelColour("#ffffff", false)).toBe(VIEWPORT_THEME.light.text);
    expect(nextLabelColour("#ffffff", true)).toBe(VIEWPORT_THEME.dark.text);
  });

  test("a colour we previously assigned is repainted again on the next flip", () => {
    // light -> dark -> light must not strand a label in the wrong theme
    expect(nextLabelColour(VIEWPORT_THEME.light.text, true)).toBe(VIEWPORT_THEME.dark.text);
    expect(nextLabelColour(VIEWPORT_THEME.dark.text, false)).toBe(VIEWPORT_THEME.light.text);
  });

  test("a colour the STUDENT chose is never touched", () => {
    // This is the whole safety property: only defaults and our own values
    // are repaintable. A deliberate colour survives both themes.
    for (const chosen of ["#ff0000", "#00ff00", "#123456", "#cd3131"]) {
      expect(nextLabelColour(chosen, true)).toBeNull();
      expect(nextLabelColour(chosen, false)).toBeNull();
    }
  });

  test("case-insensitive, and null input is left alone", () => {
    expect(nextLabelColour("#FFFFFF", false)).toBe(VIEWPORT_THEME.light.text);
    expect(nextLabelColour(VIEWPORT_THEME.dark.text.toUpperCase(), false)).toBe(VIEWPORT_THEME.light.text);
    expect(nextLabelColour(null, false)).toBeNull();
  });
});
