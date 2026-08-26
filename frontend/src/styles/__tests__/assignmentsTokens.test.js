import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { metricViolations } from "./metricLint";

const CSS = readFileSync(resolve(__dirname, "../assignments.css"), "utf8");

describe("assignments.css conforms to the design contract", () => {
  test("D1 — no literal metric on any covered property", () => {
    expect(metricViolations(CSS)).toEqual([]);
  });

  test("D8 — the portal defines no focus style of its own", () => {
    expect(CSS).not.toMatch(/:focus\b/);
  });

  test("D7/D10 — no hardcoded colour and no emoji", () => {
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Anything outside the BMP, plus the emoji-presentation ranges.
    expect(CSS).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  test("D9 — the portal never reads the OS colour preference", () => {
    expect(CSS).not.toContain("prefers-color-scheme");
  });
});
