import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import ViewportControls from "../ViewportControls";
import { mountComponent, click, byTitle } from "../../test/renderHelpers";

/**
 * ViewportControls talks to the live GlowScript runtime only through
 * glowRunner's exports — mock exactly those (real export names) so the
 * "ready" poll, the verified-outcome actions and the capability guards can
 * all be driven deterministically without a real simulation running.
 */
vi.mock("../../utils/runner/glowRunner", () => ({
  getRuntimeWindow: vi.fn(),
  getRuntimeScene: vi.fn(),
  captureRuntimeCanvas: vi.fn(),
}));

import { getRuntimeWindow, getRuntimeScene, captureRuntimeCanvas } from "../../utils/runner/glowRunner";

/** Flush pending microtasks (the async onClick handlers) via a real macrotask tick. */
const flush = () => new Promise((r) => setTimeout(r, 0));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ViewportControls", () => {
  test("renders nothing while no simulation is running", () => {
    mounted = mountComponent(<ViewportControls running={false} onStatus={vi.fn()} />);
    expect(mounted.container.querySelector(".canvas-controls")).toBeNull();
  });

  test("buttons wait for the ready poll to find the scene, then enable", () => {
    vi.useFakeTimers();
    getRuntimeScene.mockReturnValue(null);
    mounted = mountComponent(<ViewportControls running={true} onStatus={vi.fn()} />);

    // Not ready yet: every non-fullscreen button is disabled and shares the
    // "waiting" title instead of its own label.
    expect(byTitle(mounted.container, "Reset camera")).toBeNull();
    expect(byTitle(mounted.container, "Waiting for the 3D engine…").disabled).toBe(true);

    // The scene appears; the next poll tick (150ms) picks it up.
    getRuntimeScene.mockReturnValue({});
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(byTitle(mounted.container, "Reset camera").disabled).toBe(false);
  });

  test("Reset with win.vec absent reports failure through onStatus — the verified-outcome path", async () => {
    vi.useFakeTimers();
    getRuntimeScene.mockReturnValue({}); // scene present from the first poll tick
    getRuntimeWindow.mockReturnValue({}); // ...but no `vec` — a partial-load race
    const onStatus = vi.fn();
    mounted = mountComponent(<ViewportControls running={true} onStatus={onStatus} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    vi.useRealTimers();

    click(byTitle(mounted.container, "Reset camera"));
    await act(async () => {
      await flush();
    });

    expect(onStatus).toHaveBeenCalledWith({
      text: "Reset camera is not available for this simulation.",
      type: "error",
    });
  });

  test("a blank snapshot capture reports failure and never opens a window", async () => {
    vi.useFakeTimers();
    getRuntimeScene.mockReturnValue({});
    getRuntimeWindow.mockReturnValue({ vec: () => {} });
    // captureRuntimeCanvas's own doc: "Returns null when nothing is running
    // or the read throws — the caller must still verify the pixels" — null
    // is glowRunner's own signal for a blank/failed capture at this boundary.
    captureRuntimeCanvas.mockResolvedValue(null);
    const onStatus = vi.fn();
    const windowOpen = vi.spyOn(window, "open").mockReturnValue(null);
    mounted = mountComponent(<ViewportControls running={true} onStatus={onStatus} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    vi.useRealTimers();

    click(byTitle(mounted.container, "Copy a snapshot to a new tab"));
    await act(async () => {
      await flush();
    });

    expect(windowOpen).not.toHaveBeenCalled();
    expect(onStatus).toHaveBeenCalledWith({
      text: "Copy a snapshot to a new tab is not available for this simulation.",
      type: "error",
    });
  });
});
