/**
 * Every simulation control now lives in the viewport's own pane header
 * rather than the app header. These tests moved here with the controls —
 * the behaviour they pin is the same behaviour, and it had to survive the
 * move intact, which is the whole reason they were relocated rather than
 * rewritten.
 *
 * Data-science projects are covered structurally rather than here: IDELayout
 * renders a bare DataPanel for that goal with no viewport pane and therefore
 * no header to mount these into (see the `isDataGoal ?` branch).
 */
import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import SimControls from "../SimControls";
import { HEADER_STAGE2_QUERY } from "../Toolbar";
import { mountComponent, click, byText, byTitle } from "../../test/renderHelpers";

let mounted = null;
const realMatchMedia = globalThis.matchMedia;

/** Make exactly the listed queries match — the same mechanism the header's
    own responsive suite uses, so these tests exercise the real code path
    rather than a test-only prop. */
function setViewport(...matching) {
  globalThis.matchMedia = (query) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

beforeEach(() => setViewport());
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  globalThis.matchMedia = realMatchMedia;
});

const base = { iteration: 0, pauseState: "running" };

function render(props = {}) {
  mounted?.unmount();
  mounted = mountComponent(<SimControls {...base} {...props} />);
  return mounted.container;
}

describe("SimControls — the Run/Stop toggle", () => {
  test("idle shows Run, fires onRun, and offers no separate Stop", () => {
    const onRun = vi.fn();
    const container = render({ onRun });
    click(byTitle(container, "Run simulation (Ctrl+Enter)"));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(byText(container, "Stop")).toBeNull();
  });

  test("running shows Stop, fires onStop, and Run is gone", () => {
    const onStop = vi.fn();
    const container = render({ running: true, onStop });
    expect(byText(container, "Run")).toBeNull();
    const stop = byText(container, "Stop");
    expect(stop.disabled).toBe(false);
    click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test("it is ONE button, not two — exactly one run/stop control at every state", () => {
    /* The old header rendered Run and Stop as separate keys, and during
       `booting` both were on screen at once. A single toggle removes that
       seam; this asserts the seam cannot come back. */
    for (const state of [{}, { running: true }, { booting: true }]) {
      const container = render(state);
      const controls = [...container.querySelectorAll("button")].filter((b) =>
        /^(Run|Stop)$/.test(b.textContent.trim()),
      );
      expect(controls).toHaveLength(1);
    }
  });

  test("booting acknowledges itself and is not clickable", () => {
    const onRun = vi.fn();
    const onStop = vi.fn();
    const container = render({ booting: true, onRun, onStop });
    const btn = byTitle(container, "Starting simulation…");
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
    click(btn);
    expect(onRun).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  test("the Stop title names both ways out", () => {
    const container = render({ running: true });
    expect(byTitle(container, "Stop simulation (Ctrl+Enter or Esc)")).not.toBeNull();
  });
});

describe("SimControls — debug group", () => {
  test("is absent until debug mode is on", () => {
    const container = render({ debugMode: false, running: true });
    expect(byText(container, "Next frame")).toBeNull();
    expect(byText(container, "Record")).toBeNull();
  });

  test("Next frame is the dominant control and fires onStepFrame", () => {
    const onStepFrame = vi.fn();
    const container = render({ debugMode: true, running: true, onStepFrame });
    const btn = byText(container, "Next frame");
    expect(btn).toBeTruthy();
    expect(btn.className).toContain("tb-btn--primary-ghost");
    // Not a second filled primary — the Run/Stop toggle owns that role.
    expect(btn.className).not.toContain("tb-btn--run");
    click(btn);
    expect(onStepFrame).toHaveBeenCalledTimes(1);
  });

  test("Next value is the secondary step and fires onStepValue", () => {
    const onStepValue = vi.fn();
    const container = render({ debugMode: true, running: true, onStepValue });
    click(byText(container, "Next value"));
    expect(onStepValue).toHaveBeenCalledTimes(1);
  });

  test("Pause flips to Resume when paused", () => {
    const onResume = vi.fn();
    const container = render({ debugMode: true, running: true, paused: true, onResume });
    expect(byText(container, "Pause")).toBeNull();
    click(byText(container, "Resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  test("step controls are disabled when nothing is running", () => {
    const container = render({ debugMode: true, running: false });
    expect(byText(container, "Next frame").disabled).toBe(true);
    expect(byText(container, "Next value").disabled).toBe(true);
  });

  test("Record toggles to Stop Rec and fires the matching handler", () => {
    const onStartRecord = vi.fn();
    const onStopRecord = vi.fn();
    let container = render({ debugMode: true, running: true, onStartRecord, onStopRecord });
    click(byText(container, "Record"));
    expect(onStartRecord).toHaveBeenCalledTimes(1);

    container = render({ debugMode: true, running: true, recording: true, onStartRecord, onStopRecord });
    const stop = byText(container, "Stop Rec");
    expect(stop.className).toContain("tb-btn--active");
    click(stop);
    expect(onStopRecord).toHaveBeenCalledTimes(1);
  });

  test("the debug group never collapses — it is what squashed the old header", () => {
    /* The group is deliberately non-collapsible: a student mid-step must not
       lose Next frame into an overflow menu. That is precisely why it could
       not stay in the adaptive app header, and why stage 2 must not start
       hiding it here either. */
    setViewport(HEADER_STAGE2_QUERY);
    const container = render({ debugMode: true, running: true });
    for (const label of ["Next frame", "Next value", "Record"]) {
      expect(byText(container, label)).toBeTruthy();
    }
  });
});

describe("SimControls — readouts", () => {
  test("the pause chip says Pausing… before the runtime acknowledges", () => {
    const container = render({ debugMode: true, running: true, pauseState: "pausing" });
    expect(container.textContent).toContain("Pausing…");
    expect(container.textContent).not.toContain("Paused ·");
  });

  test("the pause chip reports the iteration once the runtime acknowledges", () => {
    const container = render({ debugMode: true, running: true, pauseState: "paused", iteration: 42 });
    expect(container.textContent).toContain("Paused · iteration 42");
  });

  test("the pause readout survives, shortened, and keeps announcing at stage 2", () => {
    setViewport(HEADER_STAGE2_QUERY);
    const container = render({
      debugMode: true, running: true, pauseState: "paused", iteration: 42,
    });
    const chip = container.querySelector(".tb-chip--quiet");
    expect(chip).toBeTruthy();
    // Both facts the chip exists to carry survive; only the word "iteration"
    // is dropped, and the title restores it.
    expect(chip.textContent).toBe("Paused · 42");
    expect(chip.getAttribute("title")).toBe("Paused · iteration 42");
    // One text node, so what is announced is exactly what is shown.
    expect(chip.getAttribute("aria-live")).toBe("polite");
  });

  test("Pausing… is never abbreviated away at stage 2", () => {
    setViewport(HEADER_STAGE2_QUERY);
    const container = render({ debugMode: true, running: true, pauseState: "pausing" });
    expect(container.textContent).toContain("Pausing…");
  });

  test("spells out the iteration at full width", () => {
    const container = render({ debugMode: true, running: true, pauseState: "paused", iteration: 7 });
    expect(container.querySelector(".tb-chip--quiet").textContent).toBe("Paused · iteration 7");
  });

  test("the breakpoint chip appears only when breakpoints are set", () => {
    let container = render({ debugMode: true, running: true, breakpointCount: 0 });
    expect(container.textContent).not.toContain("bp");
    container = render({ debugMode: true, running: true, breakpointCount: 3 });
    expect(container.textContent).toContain("3 bp");
  });
});
