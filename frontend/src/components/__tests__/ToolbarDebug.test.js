/**
 * Task 17 — debug is a mode of the shell. Its controls are .tb-btn buttons at
 * the end of the header's view zone, not a second button vocabulary on a
 * separate screen, and the Trace toggle Plan 2 deliberately left unwired
 * finally has a handler.
 */
import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import Toolbar from "../Toolbar";
import { mountComponent, click, byText } from "../../test/renderHelpers";
import { useMe } from "../../auth/useAuth";

/* HeaderAccount calls useMe() (TanStack Query) and useNavigate() (router);
   neither has a provider in a bare component mount. Toolbar itself calls
   useMe() too, for visibleControls()'s role axis. Same two lines, same
   reasons, as Toolbar.test.js and ToolbarResponsive.test.js. */
vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));
vi.mock("../../auth/useAuth", () => ({ useMe: vi.fn() }));

let mounted = null;
beforeEach(() => {
  useMe.mockReturnValue({ data: null, isLoading: false });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const base = { goal: "physics", mode: "blocks", isDark: true, iteration: 0, pauseState: "running" };

function render(props = {}) {
  mounted?.unmount();
  mounted = mountComponent(<Toolbar {...base} {...props} />);
  return mounted.container;
}

describe("Toolbar debug group", () => {
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
    // Not a second filled primary — Run owns that role.
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

  test("the pause chip says Pausing… before the runtime acknowledges", () => {
    const container = render({ debugMode: true, running: true, pauseState: "pausing" });
    expect(container.textContent).toContain("Pausing…");
    expect(container.textContent).not.toContain("Paused ·");
  });

  test("the pause chip reports the iteration once the runtime acknowledges", () => {
    const container = render({ debugMode: true, running: true, pauseState: "paused", iteration: 42 });
    expect(container.textContent).toContain("Paused · iteration 42");
  });

  test("the breakpoint chip appears only when breakpoints are set", () => {
    let container = render({ debugMode: true, running: true, breakpointCount: 0 });
    expect(container.textContent).not.toContain("bp");
    container = render({ debugMode: true, running: true, breakpointCount: 3 });
    expect(container.textContent).toContain("3 bp");
  });

  test("the Trace toggle is wired and reflects traceVisible", () => {
    /* Plan 2 Task 9 Step 3 kept this control unwired specifically for Task 17
       to supply the handler. If this test fails, the chain reopened. */
    const onToggleTrace = vi.fn();
    const container = render({ running: true, onToggleTrace, traceVisible: true });
    const btn = byText(container, "Trace");
    expect(btn).toBeTruthy();
    expect(btn.className).toContain("tb-btn--active");
    click(btn);
    expect(onToggleTrace).toHaveBeenCalledTimes(1);
  });

  test("the Debug button is a toggle — it reads Exit Debug while debugging", () => {
    const onDebugMode = vi.fn();
    let container = render({ running: true, onDebugMode });
    expect(byText(container, "Debug")).toBeTruthy();

    container = render({ running: true, debugMode: true, onDebugMode });
    expect(byText(container, "Debug")).toBeNull();
    const exit = byText(container, "Exit Debug");
    expect(exit.className).toContain("tb-btn--active");
    click(exit);
    expect(onDebugMode).toHaveBeenCalledTimes(1);
  });

  test("stopping the run cannot strand a student inside debug mode", () => {
    /* visibleControls hides trace/debug while idle. If that were the whole
       rule, pressing Stop while debugging would take Exit Debug away with it
       and leave no way out of the mode. */
    const container = render({ running: false, debugMode: true, onDebugMode: vi.fn() });
    expect(byText(container, "Exit Debug")).toBeTruthy();
  });

  test("a self-opened drawer keeps its toggle after the run ends", () => {
    const container = render({ running: false, traceVisible: true, onToggleTrace: vi.fn() });
    expect(byText(container, "Trace")).toBeTruthy();
  });
});
