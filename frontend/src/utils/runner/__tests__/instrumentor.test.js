import { describe, test, expect } from "vitest";
import { instrumentPythonForDebug } from "../instrumentor";

const SRC = [
  "GlowScript 3.2 VPython",
  "m = 2.5",
  "g = vector(0, -9.81, 0)",
  "ball = sphere(pos=vector(0,0,0), radius=0.5)",
  "dt = 0.01",
  "while True:",
  "    rate(100)",
  "    ball.velocity = ball.velocity + g * dt",
  "    t = t + dt",
].join("\n");

describe("instrumentPythonForDebug", () => {
  test("still traces in-loop assignments, tagged loop", () => {
    const { entries } = instrumentPythonForDebug(SRC);
    const loop = entries.filter((e) => e.scope === "loop");
    expect(loop.map((e) => e.displayName)).toEqual(["t"]);
    expect(loop[0].blockId).toMatch(/^line_\d+$/);
  });

  test("top-level constants are traced ONCE, before the loop, tagged setup", () => {
    const { source, entries } = instrumentPythonForDebug(SRC);
    const setup = entries.filter((e) => e.scope === "setup").map((e) => e.displayName);
    expect(setup).toEqual(["m", "g", "dt"]);
    // The probe is emitted at top level, i.e. with no indentation.
    expect(source).toMatch(/^_phtr_m_line2 = str\(m\)$/m);
    expect(source).toMatch(/^_phtr_dt_line5 = str\(dt\)$/m);
  });

  test("object constructors are still skipped in both scopes", () => {
    const { entries } = instrumentPythonForDebug(SRC);
    expect(entries.some((e) => e.displayName === "ball")).toBe(false);
  });

  test("watch expressions are appended inside the loop, tagged watch", () => {
    const { source, entries } = instrumentPythonForDebug(SRC, { watch: ["0.5*m*mag(ball.velocity)**2"] });
    const watch = entries.filter((e) => e.scope === "watch");
    expect(watch).toHaveLength(1);
    expect(watch[0].displayName).toBe("0.5*m*mag(ball.velocity)**2");
    expect(watch[0].blockId).toBe("watch_0");
    expect(source).toContain("_phtr_watch_0 = str(0.5*m*mag(ball.velocity)**2)");
    // …and it must be indented into the loop body, not left at top level.
    expect(source).toMatch(/^ {4}_phtr_watch_0 = str\(/m);
  });

  test("a watch expression is sanitised, not executed blindly", () => {
    const { entries } = instrumentPythonForDebug(SRC, {
      watch: ["import os", "", "   ", "m", "a\nb"],
    });
    expect(entries.filter((e) => e.scope === "watch").map((e) => e.displayName)).toEqual(["m"]);
  });

  test("a semicolon cannot smuggle extra statements onto a watch expression's line", () => {
    const { entries } = instrumentPythonForDebug(SRC, {
      watch: ["1); __import__('os').system('x'); str(1", "m"],
    });
    expect(entries.filter((e) => e.scope === "watch").map((e) => e.displayName)).toEqual(["m"]);
  });

  test("a source with no while loop still yields setup entries", () => {
    const { entries } = instrumentPythonForDebug("a = 1\nb = 2\n");
    expect(entries.map((e) => [e.displayName, e.scope])).toEqual([
      ["a", "setup"],
      ["b", "setup"],
    ]);
  });

  test("is pure — same input, same output, no shared state between calls", () => {
    const a = instrumentPythonForDebug(SRC);
    const b = instrumentPythonForDebug(SRC);
    expect(a).toEqual(b);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Where the injected lines LAND — the structural half of this suite.

   Three injection bugs have shipped from this module now, and every one
   of them produced source that was fine variable-by-variable and invalid
   as Python. `new Function` can compile-check JS; nothing here can
   compile Python, so the checks below assert the two structural
   invariants that a Python parser would have enforced:

     1. indentation is consistent — every line either matches an open
        block's indent, opens a deeper one straight after a `:` header,
        or dedents to an indent some enclosing block already uses;
     2. no injected probe is stranded immediately before an `else:` /
        `elif` / `except` / `finally` at its own indent or shallower —
        the exact shape that broke a bounce counter with a watch armed.
   ═══════════════════════════════════════════════════════════════════ */

const indentOf = (line) => line.length - line.trimStart().length;

/** A block continuation clause: it may only follow a DEEPER-indented body. */
const CONTINUATION_RE = /^(?:else|elif|except|finally)\b/;

/**
 * Walk the instrumented source the way Python's tokenizer does, maintaining
 * a stack of open indent levels. (`endsWith(":")` as the "opens a block"
 * test is exact for the statement shapes these fixtures use.)
 */
function assertIndentationIsConsistent(source, label) {
  const lines = source.split("\n");
  const stack = [0];
  let expectIndent = false;

  lines.forEach((line, i) => {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) return;
    const ind  = indentOf(line);
    const top  = stack[stack.length - 1];
    const where = `${label} line ${i + 1}: ${JSON.stringify(line)}`;

    if (expectIndent) {
      expect(ind, `${where} — a ':' header must be followed by a deeper line`).toBeGreaterThan(top);
      stack.push(ind);
    } else {
      expect(ind, `${where} — unexpected indent, no ':' header opened a block`).not.toBeGreaterThan(top);
      while (stack.length > 1 && ind < stack[stack.length - 1]) stack.pop();
      expect(ind, `${where} — dedents to an indent no enclosing block uses`).toBe(stack[stack.length - 1]);
    }
    expectIndent = stripped.endsWith(":");
  });
}

/** No `_phtr_` probe may sit directly above a continuation clause it would orphan. */
function assertNoProbeStrandsAContinuation(source, label) {
  const lines = source.split("\n");
  lines.forEach((line, i) => {
    if (!/^\s*_phtr_/.test(line)) return;
    let j = i + 1;
    while (j < lines.length && (!lines[j].trim() || lines[j].trim().startsWith("#"))) j++;
    if (j >= lines.length || !CONTINUATION_RE.test(lines[j].trim())) return;
    expect(
      indentOf(line),
      `${label} line ${i + 1}: probe ${JSON.stringify(line)} strands ${JSON.stringify(lines[j])}`,
    ).toBeGreaterThan(indentOf(lines[j]));
  });
}

/** The shape that broke: the last traced assignment sits inside an `if`
 *  branch whose `else:` follows it. */
const IF_ELSE_SRC = [
  "GlowScript 3.2 VPython",
  "ball = sphere(pos=vector(0,0,0), radius=0.5)",
  "bounces = 0",
  "dt = 0.01",
  "t = 0",
  "while True:",
  "    rate(100)",
  "    t = t + dt",
  "    if t > 1:",
  "        bounces = bounces + 1",
  "    else:",
  "        print(t)",
].join("\n");

const SHAPES = {
  "plain loop": [
    "GlowScript 3.2 VPython",
    "dt = 0.01",
    "t = 0",
    "while True:",
    "    rate(100)",
    "    t = t + dt",
  ].join("\n"),

  "if/else in the loop body": IF_ELSE_SRC,

  "nested if, no else": [
    "GlowScript 3.2 VPython",
    "dt = 0.01",
    "t = 0",
    "bounces = 0",
    "while True:",
    "    rate(100)",
    "    t = t + dt",
    "    if t > 1:",
    "        if bounces < 3:",
    "            bounces = bounces + 1",
  ].join("\n"),

  "try/except in the loop body": [
    "GlowScript 3.2 VPython",
    "dt = 0.01",
    "t = 0",
    "while True:",
    "    rate(100)",
    "    t = t + dt",
    "    try:",
    "        energy = 1 / t",
    "    except:",
    "        energy = 0",
  ].join("\n"),
};

describe("instrumented output is structurally valid Python", () => {
  for (const [label, src] of Object.entries(SHAPES)) {
    test(`${label} — with a watch armed`, () => {
      const { source } = instrumentPythonForDebug(src, { watch: ["t"] });
      assertIndentationIsConsistent(source, label);
      assertNoProbeStrandsAContinuation(source, label);
    });

    test(`${label} — with no watch`, () => {
      const { source } = instrumentPythonForDebug(src);
      assertIndentationIsConsistent(source, label);
      assertNoProbeStrandsAContinuation(source, label);
    });
  }

  test("a watch probe lands AFTER the whole if/else, still inside the loop body", () => {
    /* The bug: `bodyIndent` came from the FIRST loop probe (indent 4) but the
       splice happened right after the LAST one (indent 8, inside the `if`),
       so the watch line dedented into the gap between the if-body and its
       `else:` — a SyntaxError that describeRunError blamed on the student. */
    const { source } = instrumentPythonForDebug(IF_ELSE_SRC, { watch: ["t"] });
    const lines    = source.split("\n");
    const watchIdx = lines.findIndex((l) => l.includes("_phtr_watch_0"));
    const elseIdx  = lines.findIndex((l) => l.trim().startsWith("else:"));

    expect(watchIdx).toBeGreaterThan(-1);
    expect(elseIdx).toBeGreaterThan(-1);
    expect(watchIdx, "the watch probe must clear the whole if/else").toBeGreaterThan(elseIdx);
    expect(lines[watchIdx]).toBe("    _phtr_watch_0 = str(t)");
  });

  test("a trailing blank line does not push the watch probe out of the loop", () => {
    const { source } = instrumentPythonForDebug(`${SHAPES["plain loop"]}\n\n`, { watch: ["t"] });
    assertIndentationIsConsistent(source, "trailing blank");
    expect(source).toMatch(/^ {4}_phtr_watch_0 = str\(t\)$/m);
  });
});
