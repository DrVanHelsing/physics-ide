/**
 * Task 13 — useRuntimeReady replaces two copy-pasted "wait for the GlowScript
 * scene" polls (GlowCanvas ~9s/60 tries, ViewportControls ~6s/40 tries) with
 * one implementation. Covers: disabled polls nothing; a probe that reports
 * not-ready twice then ready flips `ready` on the third tick and fires
 * `onReady` with the scene; unmounting clears the interval so a stale tick
 * can never fire into an unmounted tree.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { useRuntimeReady } from "../useRuntimeReady";

vi.mock("../../utils/runner/glowRunner", () => ({
  getRuntimeScene: vi.fn(),
}));

import { getRuntimeScene } from "../../utils/runner/glowRunner";

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function Harness({ enabled, tries, intervalMs, onReady }) {
  const ready = useRuntimeReady({ enabled, tries, intervalMs, onReady });
  return <p className="ready">{String(ready)}</p>;
}

describe("useRuntimeReady", () => {
  test("enabled: false stays not-ready and starts no timer", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    getRuntimeScene.mockReturnValue(null);
    mounted = mountComponent(<Harness enabled={false} />);

    expect(mounted.container.querySelector(".ready").textContent).toBe("false");
    expect(setIntervalSpy).not.toHaveBeenCalled();

    // Advancing time confirms nothing was scheduled — still false.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mounted.container.querySelector(".ready").textContent).toBe("false");
  });

  test("enabled: true — a probe returning null twice then a scene flips ready on the third tick and fires onReady", () => {
    vi.useFakeTimers();
    getRuntimeScene
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(null)
      .mockReturnValue({ id: "scene" });
    const onReady = vi.fn();
    mounted = mountComponent(<Harness enabled={true} intervalMs={150} onReady={onReady} />);

    expect(mounted.container.querySelector(".ready").textContent).toBe("false");

    act(() => {
      vi.advanceTimersByTime(150); // tick 1: null
    });
    expect(mounted.container.querySelector(".ready").textContent).toBe("false");
    expect(onReady).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150); // tick 2: null
    });
    expect(mounted.container.querySelector(".ready").textContent).toBe("false");
    expect(onReady).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(150); // tick 3: scene found
    });
    expect(mounted.container.querySelector(".ready").textContent).toBe("true");
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith({ id: "scene" });
  });

  test("gives up quietly once `tries` is exhausted without ever finding a scene", () => {
    vi.useFakeTimers();
    getRuntimeScene.mockReturnValue(null);
    const onReady = vi.fn();
    mounted = mountComponent(
      <Harness enabled={true} tries={3} intervalMs={100} onReady={onReady} />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mounted.container.querySelector(".ready").textContent).toBe("false");
    expect(onReady).not.toHaveBeenCalled();
  });

  test("unmount clears the interval — a stale tick cannot fire after teardown", () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    getRuntimeScene.mockReturnValue(null);
    mounted = mountComponent(<Harness enabled={true} intervalMs={150} />);

    const callsBeforeUnmount = clearIntervalSpy.mock.calls.length;
    mounted.unmount();
    mounted = null;

    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
  });
});
