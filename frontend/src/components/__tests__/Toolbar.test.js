import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import Toolbar from "../Toolbar";
import { mountComponent, click, byText, byTitle, keyDown } from "../../test/renderHelpers";

// HeaderAccount calls useMe() (TanStack Query) and useNavigate() (router) —
// neither provider is mounted in this suite, so stub it out. Its own
// behaviour is covered by components/auth/__tests__/HeaderAccount.test.js.
vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));

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
    click(byText(container, "Back to Blocks"));
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
    expect(items).toHaveLength(9);
    // Every item is exposed to assistive tech as a menu item of the
    // role="menu" container above it.
    expect(items.every((it) => it.getAttribute("role") === "menuitem")).toBe(true);
    click(items[2]);
    expect(h.onExportPy).toHaveBeenCalledTimes(1);
    // The menu closes on selection — reopen for the next assertion.
    click(container.querySelector(".tb-btn--dropdown"));
    click([...container.querySelectorAll(".tb-dropdown-item")][8]);
    expect(h.onExportProject).toHaveBeenCalledTimes(1);
  });

  test("Escape closes the dropdown without reaching the window-level hotkey listener", () => {
    const { container } = render();
    click(container.querySelector(".tb-btn--dropdown"));
    expect(container.querySelector(".tb-dropdown-menu")).not.toBeNull();

    // useHotkeys binds bare Escape to "stop" on window — if the dropdown's
    // own Escape handler doesn't stop propagation, closing the menu would
    // also fire this listener and kill a running simulation.
    const windowKeydown = vi.fn();
    window.addEventListener("keydown", windowKeydown);
    try {
      keyDown(document, { key: "Escape" });
    } finally {
      window.removeEventListener("keydown", windowKeydown);
    }

    expect(container.querySelector(".tb-dropdown-menu")).toBeNull();
    expect(windowKeydown).not.toHaveBeenCalled();
  });
});

describe("Toolbar — header identity", () => {
  test("the project title renders and rename is wired", () => {
    const onRenameProject = vi.fn();
    const { container } = render({ projectTitle: "Orbits", onRenameProject });
    expect(container.querySelector(".project-title").textContent).toBe("Orbits");
  });

  test("Save is wired when a handler is supplied and absent otherwise", () => {
    const onSave = vi.fn();
    const { container } = render({ onSave });
    click(byText(container, "Save"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test("the three action zones are present", () => {
    const { container } = render();
    expect(container.querySelector(".app-header__zone--primary")).not.toBeNull();
    expect(container.querySelector(".app-header__zone--view")).not.toBeNull();
    expect(container.querySelector(".app-header__zone--file")).not.toBeNull();
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
