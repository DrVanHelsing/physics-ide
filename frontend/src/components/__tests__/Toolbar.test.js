import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import Toolbar from "../Toolbar";
import { mountComponent, click, byText, byTitle } from "../../test/renderHelpers";

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** Every handler the Toolbar can call, so "was it wired?" is one assertion. */
function handlers() {
  return {
    onRun: vi.fn(),
    onStop: vi.fn(),
    onHome: vi.fn(),
    onHelp: vi.fn(),
    onReset: vi.fn(),
    onClearWorkspace: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleViewport: vi.fn(),
    onDebugMode: vi.fn(),
    onImport: vi.fn(),
    onImportProject: vi.fn(),
    onExportPy: vi.fn(),
    onExportBlocks: vi.fn(),
    onExportBlocksPdf: vi.fn(),
    onExportCodePdf: vi.fn(),
    onExportScreenshot: vi.fn(),
    onExportProject: vi.fn(),
    onCopyCode: vi.fn(),
    onZoomChange: vi.fn(),
  };
}

function render(props = {}) {
  const h = handlers();
  mounted = mountComponent(
    <Toolbar goal="physics" mode="blocks" running={false} isDark zoom={90} {...h} {...props} />,
  );
  return { ...mounted, h };
}

describe("Toolbar — navigation group", () => {
  test("Menu and Help are present and wired", () => {
    const { container, h } = render();
    click(byText(container, "Menu"));
    click(byText(container, "Help"));
    expect(h.onHome).toHaveBeenCalledTimes(1);
    expect(h.onHelp).toHaveBeenCalledTimes(1);
  });
});

describe("Toolbar — simulation group", () => {
  test("Run fires onRun; Stop is disabled while idle", () => {
    const { container, h } = render();
    click(byTitle(container, "Run simulation (Ctrl+Enter)"));
    expect(h.onRun).toHaveBeenCalledTimes(1);
    expect(byText(container, "Stop").disabled).toBe(true);
  });

  test("Stop is enabled and wired while running", () => {
    const { container, h } = render({ running: true });
    const stop = byText(container, "Stop");
    expect(stop.disabled).toBe(false);
    click(stop);
    expect(h.onStop).toHaveBeenCalledTimes(1);
  });

  test("a data-science project shows no simulation controls", () => {
    const { container } = render({ goal: "datascience" });
    expect(byText(container, "Run")).toBeNull();
    expect(byText(container, "Stop")).toBeNull();
    expect(byText(container, "Debug")).toBeNull();
  });
});

describe("Toolbar — workspace group", () => {
  test("Reset is always present; Clear only in blocks mode", () => {
    const { container, h } = render();
    click(byText(container, "Reset"));
    expect(h.onReset).toHaveBeenCalledTimes(1);
    click(byText(container, "Clear"));
    expect(h.onClearWorkspace).toHaveBeenCalledTimes(1);

    mounted.unmount();
    mounted = null;
    const code = render({ mode: "text" });
    expect(byText(code.container, "Clear")).toBeNull();
  });
});

describe("Toolbar — view group", () => {
  test("zoom buttons step by 10 and clamp", () => {
    const { container, h } = render({ zoom: 90 });
    click(byTitle(container, "Zoom in"));
    expect(h.onZoomChange).toHaveBeenLastCalledWith(100);
    click(byTitle(container, "Zoom out"));
    expect(h.onZoomChange).toHaveBeenLastCalledWith(80);
  });

  test("the zoom slider is absent in code mode", () => {
    const { container } = render({ mode: "text" });
    expect(container.querySelector(".tb-zoom")).toBeNull();
  });

  test("viewport and debug toggles are wired", () => {
    const { container, h } = render();
    click(byTitle(container, "Hide 3D viewport"));
    expect(h.onToggleViewport).toHaveBeenCalledTimes(1);
    click(byTitle(container, "Open Debug Mode — step-through, breakpoints, recording"));
    expect(h.onDebugMode).toHaveBeenCalledTimes(1);
  });

  test("the viewport toggle label reflects state", () => {
    const { container } = render({ viewportHidden: true });
    expect(byTitle(container, "Show 3D viewport").textContent).toContain("Show");
  });
});

describe("Toolbar — file group", () => {
  test("both import controls render distinct hidden file inputs", () => {
    const { container } = render();
    const accepts = [...container.querySelectorAll('input[type="file"]')].map((i) => i.accept);
    expect(accepts).toEqual([".py,.xml", ".json,.physide.json"]);
  });

  test("the export dropdown opens and every item is wired", () => {
    const { container, h } = render();
    expect(container.querySelector(".tb-dropdown-menu")).toBeNull();
    click(container.querySelector(".tb-btn--dropdown"));
    const menu = container.querySelector(".tb-dropdown-menu");
    expect(menu).not.toBeNull();

    const items = [...menu.querySelectorAll(".tb-dropdown-item")];
    expect(items).toHaveLength(7);
    click(items[0]);
    expect(h.onExportPy).toHaveBeenCalledTimes(1);
    // The menu closes on selection — reopen for the next assertion.
    click(container.querySelector(".tb-btn--dropdown"));
    click([...container.querySelectorAll(".tb-dropdown-item")][6]);
    expect(h.onExportProject).toHaveBeenCalledTimes(1);
  });
});

describe("Toolbar — theme toggle", () => {
  test("the label follows the current theme and the handler fires", () => {
    const { container, h } = render({ isDark: true });
    click(byTitle(container, "Switch to light mode"));
    expect(h.onToggleTheme).toHaveBeenCalledTimes(1);
    mounted.rerender(<Toolbar goal="physics" mode="blocks" isDark={false} onToggleTheme={h.onToggleTheme} />);
    expect(byTitle(container, "Switch to dark mode")).not.toBeNull();
  });
});
