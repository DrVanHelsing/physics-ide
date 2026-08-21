import { describe, test, expect } from "vitest";
import { isUniformImageData } from "../image";

/** n RGBA pixels, all identical unless `spot` names one to change. */
function pixels(n, spot) {
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = 10; data[i * 4 + 1] = 10; data[i * 4 + 2] = 15; data[i * 4 + 3] = 255;
  }
  if (spot != null) data[spot * 4] = 200;
  return data;
}

describe("isUniformImageData", () => {
  test("a flat rectangle is uniform — this is the blank WebGL capture", () => {
    expect(isUniformImageData(pixels(64))).toBe(true);
  });

  test("one different pixel is enough to call it real", () => {
    expect(isUniformImageData(pixels(64, 30))).toBe(false);
  });

  test("degenerate inputs are treated as uniform (i.e. as a failure)", () => {
    expect(isUniformImageData(new Uint8ClampedArray(0))).toBe(true);
    expect(isUniformImageData(null)).toBe(true);
  });
});
