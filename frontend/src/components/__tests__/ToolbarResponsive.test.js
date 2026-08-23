import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import Toolbar, { HEADER_STAGE1_QUERY, HEADER_STAGE2_QUERY } from "../Toolbar";
import { mountComponent, click, byText } from "../../test/renderHelpers";
import { useMe } from "../../auth/useAuth";

vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));
// Toolbar reads useMe() directly (Task 10) — no QueryClientProvider is
// mounted in this bare-harness suite, so stub it (same fix as Toolbar.test.js).
vi.mock("../../auth/useAuth", () => ({ useMe: vi.fn() }));

let mounted = null;
const realMatchMedia = globalThis.matchMedia;

/** Make exactly the listed queries match. */
function setViewport(...matching) {
  globalThis.matchMedia = (query) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

beforeEach(() => {
  setViewport();
  useMe.mockReturnValue({ data: null, isLoading: false });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  globalThis.matchMedia = realMatchMedia;
});

function render(props = {}) {
  mounted = mountComponent(
    <Toolbar goal="physics" mode="blocks" running={false} isDark
             onToggleViewport={vi.fn()} onDebugMode={vi.fn()}
             onReset={vi.fn()} onClearWorkspace={vi.fn()} onHelp={vi.fn()} {...props} />,
  );
  return mounted;
}

describe("header collapse — wide (no query matches)", () => {
  test("everything is inline, the zoom slider stays gone, and there is no overflow menu", () => {
    // `debug` is a reserved slot hidden while idle (visibleControls, Task
    // 10) — run:true puts a sim live so it (and Trace, once Plan 4 wires it)
    // has something to render and be found by this collapse assertion.
    const { container } = render({ running: true });
    expect(container.querySelector(".tb-zoom")).toBeNull();
    expect(byText(container, "Debug")).not.toBeNull();
    expect(container.querySelector(".tb-btn--overflow")).toBeNull();
    expect(container.querySelector(".app-header--stage1")).toBeNull();
  });

  test("debug is hidden while idle — nothing to debug yet", () => {
    const { container } = render();
    expect(byText(container, "Debug")).toBeNull();
  });
});

describe("header collapse — stage 1 (<= 1280px)", () => {
  test("the zoom slider stays gone and the header is marked compact", () => {
    setViewport(HEADER_STAGE1_QUERY);
    const { container } = render({ running: true });
    expect(container.querySelector(".tb-zoom")).toBeNull();
    expect(container.querySelector(".app-header--stage1")).not.toBeNull();
    // Controls are still directly clickable — only their labels are CSS-hidden.
    expect(byText(container, "Debug")).not.toBeNull();
    expect(container.querySelector(".tb-btn--overflow")).toBeNull();
  });
});

describe("header collapse — stage 2 (<= 1120px)", () => {
  test("secondary controls move into the overflow menu and stay reachable", () => {
    setViewport(HEADER_STAGE1_QUERY, HEADER_STAGE2_QUERY);
    const onDebugMode = vi.fn();
    const { container } = render({ onDebugMode, running: true });

    expect(byText(container, "Debug")).toBeNull();
    const trigger = container.querySelector(".tb-btn--overflow");
    expect(trigger).not.toBeNull();
    // Icon-only trigger — no visible text to fall back on, so it needs its own name.
    expect(trigger.getAttribute("aria-label")).toBe("More actions");
    click(trigger);

    const menu = container.querySelector(".tb-dropdown-menu");
    for (const label of ["Debug", "Hide 3D viewport", "Back to Blocks", "Clear", "Help"]) {
      expect(menu.textContent).toContain(label);
    }
    click([...menu.querySelectorAll(".tb-dropdown-item")].find((b) => b.textContent.includes("Debug")));
    expect(onDebugMode).toHaveBeenCalledTimes(1);
  });

  test("Save, File and the project title never collapse", () => {
    setViewport(HEADER_STAGE1_QUERY, HEADER_STAGE2_QUERY);
    const { container } = render({ onSave: vi.fn(), projectTitle: "Orbits" });
    // Run/Stop and the pause readout are no longer the header's to collapse —
    // they moved to the viewport pane header (SimControls.test.js).
    expect(byText(container, "Save")).not.toBeNull();
    expect(byText(container, "File")).not.toBeNull();
    expect(container.querySelector(".project-title")).not.toBeNull();
  });

});
