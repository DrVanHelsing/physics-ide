import { describe, test, expect } from "vitest";
import { toCsvRows } from "../downloadCsv";

describe("toCsvRows", () => {
  test("writes a header and one row per sample", () => {
    const csv = toCsvRows([{ t: 10, name: "x", value: 1.5, delta: 0.5, min: 1, max: 2 }]);
    expect(csv).toBe('timestamp_ms,variable,value,delta,min,max\n10,"x","1.5",0.5,1,2\n');
  });

  test("null delta/min/max become empty fields, not the string null", () => {
    const csv = toCsvRows([{ t: 1, name: "v", value: "<1, 2, 3>", delta: null, min: null, max: null }]);
    expect(csv).toContain('1,"v","<1, 2, 3>",,,\n');
    expect(csv).not.toContain("null");
  });

  test("quotes inside a value are escaped, not broken", () => {
    const csv = toCsvRows([{ t: 1, name: 'he said "hi"', value: 'a"b' }]);
    expect(csv).toContain('"he said ""hi""","a""b"');
  });

  test("an empty buffer is still a valid one-line CSV", () => {
    expect(toCsvRows([])).toBe("timestamp_ms,variable,value,delta,min,max\n");
    expect(toCsvRows(null)).toBe("timestamp_ms,variable,value,delta,min,max\n");
  });
});
