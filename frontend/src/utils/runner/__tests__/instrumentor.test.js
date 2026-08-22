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
