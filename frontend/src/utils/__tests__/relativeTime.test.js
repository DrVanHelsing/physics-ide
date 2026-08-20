import { describe, test, expect } from "vitest";
import { relativeTime } from "../relativeTime";

const NOW = 1_700_000_000_000;

describe("relativeTime", () => {
  test("names the recent past in words a student reads at a glance", () => {
    expect(relativeTime(NOW, NOW)).toBe("just now");
    expect(relativeTime(NOW - 30_000, NOW)).toBe("just now");
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe("5 min ago");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3 h ago");
  });

  test("falls back to a date beyond a day, and to empty for no timestamp", () => {
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toBe(new Date(NOW - 3 * 86_400_000).toLocaleDateString());
    expect(relativeTime(0, NOW)).toBe("");
    expect(relativeTime(null, NOW)).toBe("");
    expect(relativeTime(undefined, NOW)).toBe("");
  });
});
