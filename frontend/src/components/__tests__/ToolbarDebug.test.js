/**
 * Debug is a MODE of the shell, not a separate screen with its own button
 * vocabulary. What remains here are the header's two debug-related TOGGLES —
 * Trace and Debug/Exit Debug — which still live in the view zone. The debug
 * CONTROLS they reveal (Pause / Next frame / Next value / Record and the two
 * chips) moved to the viewport pane header; see SimControls.test.js.
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
// Plan 8 Task 6: the bell calls useQuery() unconditionally too, and no
// QueryClientProvider is mounted here — same fix, same reason.
vi.mock("../layout/NotificationBell", () => ({ default: () => null }));
vi.mock("../../auth/useAuth", () => ({ useMe: vi.fn() }));
// Task 20: Toolbar now calls useNavigate() directly too (the fileMenu's
// History item) — same reason, same fix as the two mocks above.
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

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
