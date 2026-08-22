import { describe, test, expect } from "vitest";
import { describeRunError } from "../describeRunError";

describe("describeRunError", () => {
  test("unwraps the triple prefix glowRunner builds", () => {
    const d = describeRunError(
      new Error("Execution error: Runtime error: NameError: name 'balll' is not defined"),
    );
    expect(d.title).not.toMatch(/Execution error|Runtime error/);
    expect(d.title).toBe("There's no variable called “balll”.");
    expect(d.raw).toContain("Execution error:");
  });

  test("strips the source preview compileSource appends", () => {
    const d = describeRunError(
      new Error("Compile error: Unexpected token at line 7 | src: sphere ( pos = vector 0 0 0 )"),
    );
    expect(d.detail).not.toContain("| src:");
    expect(d.line).toBe(7);
  });

  test("strips the compiled-JS preview the no-canvas path appends", () => {
    const d = describeRunError(
      new Error(
        "Execution error: GlowScript executed but no canvas was rendered. __main__: function. Preview: var x = 1; var y",
      ),
    );
    expect(d.detail).not.toContain("Preview:");
    expect(d.title).toBe("The simulation ran but drew nothing.");
  });

  test("maps a missing-object error to plain English", () => {
    const d = describeRunError(new Error("Runtime error: TypeError: ball is undefined"));
    expect(d.title).toBe("Something used “ball” before it was created.");
  });

  test("maps an indentation error", () => {
    const d = describeRunError(new Error("Compile error: IndentationError: expected an indented block (line 12)"));
    expect(d.title).toBe("A line is indented wrongly.");
    expect(d.line).toBe(12);
  });

  test("maps a divide-by-zero", () => {
    const d = describeRunError(new Error("Runtime error: ZeroDivisionError: division by zero"));
    expect(d.title).toBe("Something was divided by zero.");
  });

  test("maps the engine-not-loaded failures to one offline sentence", () => {
    for (const msg of [
      "Failed to load script: /vendor/glowscript/glow.3.2.min.js",
      "GlowScript compiler did not load (RScompiler). Diagnostics: {}",
      "GlowScript runtime dependency missing: jQuery UI resizable() not loaded. Diagnostics: {}",
    ]) {
      const d = describeRunError(new Error(msg));
      expect(d.title, msg).toBe("The 3D engine could not start.");
      expect(d.detail, msg).toMatch(/reload the page/i);
    }
  });

  test("an empty program says so", () => {
    const d = describeRunError(new Error("Compile error: VPython source is empty."));
    expect(d.title).toBe("There's nothing to run yet.");
  });

  test("an unrecognised message survives intact, minus the wrappers", () => {
    const d = describeRunError(new Error("Execution error: Runtime error: something entirely new"));
    expect(d.title).toBe("The simulation stopped with an error.");
    expect(d.detail).toBe("something entirely new");
    expect(d.line).toBeNull();
  });

  test("accepts a bare string and a null without throwing", () => {
    expect(describeRunError("Runtime error: ZeroDivisionError: division by zero").title).toBe(
      "Something was divided by zero.",
    );
    const d = describeRunError(null);
    expect(d.title).toBe("The simulation stopped with an error.");
    expect(d.detail).toBe("");
  });

  test("is pure — the same input always gives the same output", () => {
    const e = new Error("Runtime error: ZeroDivisionError: division by zero");
    expect(describeRunError(e)).toEqual(describeRunError(e));
  });
});
