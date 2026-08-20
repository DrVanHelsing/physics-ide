import { describe, test, expect } from "vitest";
import { clampSplit, clampZoom } from "../layoutPrefs";
import { SPLIT_DEFAULT, SPLIT_MIN, SPLIT_MAX, ZOOM_DEFAULT, ZOOM_MIN, ZOOM_MAX } from "../../constants";

describe("persisted layout values are defended on read", () => {
  test("clampSplit keeps sane values and repairs the rest", () => {
    expect(clampSplit(42)).toBe(42);
    expect(clampSplit(SPLIT_MIN - 10)).toBe(SPLIT_MIN);
    expect(clampSplit(SPLIT_MAX + 10)).toBe(SPLIT_MAX);
    for (const junk of [null, undefined, NaN, "wide", {}, Infinity]) {
      expect(clampSplit(junk)).toBe(SPLIT_DEFAULT);
    }
  });

  test("clampZoom keeps sane values and repairs the rest", () => {
    expect(clampZoom(120)).toBe(120);
    expect(clampZoom(ZOOM_MIN - 5)).toBe(ZOOM_MIN);
    expect(clampZoom(ZOOM_MAX + 5)).toBe(ZOOM_MAX);
    expect(clampZoom("90%")).toBe(ZOOM_DEFAULT);
  });
});
