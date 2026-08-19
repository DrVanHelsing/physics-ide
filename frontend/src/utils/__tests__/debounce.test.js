import { describe, test, expect, vi } from "vitest";
import { debounce } from "../debounce";

describe("debounce", () => {
  test("trailing edge: one call after the wait; cancel and flush behave", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d("a");
    d("b");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith("b");

    d("c");
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);

    d("d");
    d.flush();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("d");
    vi.useRealTimers();
  });
});
