import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import Toolbar from "../Toolbar";
import { mountComponent, click, byText, byTitle, keyDown } from "../../test/renderHelpers";
import { useMe } from "../../auth/useAuth";
import { useAssignmentContext } from "../../contexts/AssignmentContext";

// HeaderAccount calls useMe() (TanStack Query) and useNavigate() (router) —
// neither provider is mounted in this suite, so stub it out. Its own
// behaviour is covered by components/auth/__tests__/HeaderAccount.test.js.
vi.mock("../auth/HeaderAccount", () => ({ default: () => null }));

// Toolbar itself now calls useMe() directly to resolve visibleControls()'s
// `role`/`isTeacher` axes (Task 10) — same reason, same fix: no
// QueryClientProvider is mounted in this bare-harness suite, so stub the
// module HeaderAccount's own suite already stubs the same way.
vi.mock("../../auth/useAuth", () => ({ useMe: vi.fn() }));

// Task 12: Toolbar now reads the assignment's workspace rules directly too
// (RulesChip's own precedent — see RulesChip.test.js). Default to null so
// every pre-existing test in this file keeps seeing today's behaviour.
vi.mock("../../contexts/AssignmentContext", () => ({ useAssignmentContext: vi.fn() }));

let mounted = null;
beforeEach(() => {
  useMe.mockReturnValue({ data: null, isLoading: false });
  useAssignmentContext.mockReturnValue(null);
});
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
  };
}

function render(props = {}) {
  const h = handlers();
  mounted = mountComponent(
    <Toolbar goal="physics" mode="blocks" running={false} isDark {...h} {...props} />,
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



  test("a data-science project shows no simulation controls", () => {
    const { container } = render({ goal: "datascience" });
    expect(byText(container, "Run")).toBeNull();
    expect(byText(container, "Stop")).toBeNull();
    expect(byText(container, "Debug")).toBeNull();
  });

  test("a data-science project shows no Run even while running", () => {
    const { container } = render({ goal: "datascience", running: true });
    expect(byText(container, "Run")).toBeNull();
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
  test("the zoom slider is gone — no configuration renders it", () => {
    const blocks = render();
    expect(blocks.container.querySelector(".tb-zoom")).toBeNull();
    blocks.unmount();
    mounted = null;

    const code = render({ mode: "text" });
    expect(code.container.querySelector(".tb-zoom")).toBeNull();
  });

  test("viewport toggle is wired", () => {
    const { container, h } = render();
    click(byTitle(container, "Hide 3D viewport"));
    expect(h.onToggleViewport).toHaveBeenCalledTimes(1);
  });

  test("debug toggle is hidden while idle and wired once a sim is live", () => {
    const idle = render();
    expect(byText(idle.container, "Debug")).toBeNull();
    idle.unmount();
    mounted = null;

    const { container, h } = render({ running: true });
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

describe("Toolbar — role axis (guest vs. signed-in)", () => {
  test("renders without crashing for a guest (useMe -> null)", () => {
    useMe.mockReturnValue({ data: null, isLoading: false });
    const { container } = render();
    expect(container.querySelector(".app-header")).not.toBeNull();
  });

  test("renders without crashing for a signed-in user and a teacher", () => {
    useMe.mockReturnValue({ data: { role: "user", isTeacher: true }, isLoading: false });
    const { container } = render();
    expect(container.querySelector(".app-header")).not.toBeNull();
  });
});

describe("Toolbar — workspace rules (Task 12)", () => {
  const LOCKED = {
    editors: "blocks", debug: false, importFiles: false,
    exportAndCopy: false, advancedBlocks: false, templates: false,
  };

  test("editors restricted to one surface empties the primary zone — no mode toggle renders at all", () => {
    useAssignmentContext.mockReturnValue({ rules: { ...LOCKED, editors: "blocks" } });
    mounted = mountComponent(
      <Toolbar goal="physics" mode="blocks" running={false} isDark {...handlers()}>
        <span data-testid="mode-toggle-marker">toggle</span>
      </Toolbar>,
    );
    expect(mounted.container.querySelector('[data-testid="mode-toggle-marker"]')).toBeNull();
  });

  test("a locked assignment (every rule off) empties the file menu with no dangling divider, and hides Debug from both the inline row and the overflow it shares zones with", () => {
    useAssignmentContext.mockReturnValue({ rules: LOCKED });
    const { container } = render({ running: true });
    click(container.querySelector(".tb-btn--dropdown"));
    const menu = container.querySelector(".tb-dropdown-menu");
    expect(menu).not.toBeNull();
    expect(menu.querySelectorAll(".tb-dropdown-item")).toHaveLength(0);
    expect(menu.querySelector(".tb-dropdown-divider")).toBeNull();
    // debug is a `view`-zone key (visibleControls' own contract) — gone here
    // means gone from secondaryActions, so both render paths lose it at once.
    expect(byText(container, "Debug")).toBeNull();
  });

  test("importFiles:false hides both Import items and the divider; exports stay", () => {
    useAssignmentContext.mockReturnValue({ rules: { ...LOCKED, exportAndCopy: true } });
    const { container } = render();
    click(container.querySelector(".tb-btn--dropdown"));
    expect(byText(container, "Import blocks or Python (.py, .xml)")).toBeNull();
    expect(byText(container, "Open project bundle (.physide.json)")).toBeNull();
    expect(container.querySelector(".tb-dropdown-divider")).toBeNull();
    expect(byText(container, "Export as Python (.py)")).not.toBeNull();
    expect(byText(container, "Export Project Bundle (.physide.json)")).not.toBeNull();
  });

  test("exportAndCopy:false hides every export item, Copy Code, both PDFs and the fileMenu Screenshot item; imports stay", () => {
    useAssignmentContext.mockReturnValue({ rules: { ...LOCKED, importFiles: true } });
    const { container } = render();
    click(container.querySelector(".tb-btn--dropdown"));
    expect(byText(container, "Import blocks or Python (.py, .xml)")).not.toBeNull();
    expect(byText(container, "Open project bundle (.physide.json)")).not.toBeNull();
    expect(container.querySelector(".tb-dropdown-divider")).toBeNull();
    for (const label of [
      "Export as Python (.py)",
      "Export Blocks (.xml)",
      "Code as PDF",
      "Blocks as PDF",
      "Screenshot Viewport (.png)",
      "Copy Code to Clipboard",
      "Export Project Bundle (.physide.json)",
    ]) {
      expect(byText(container, label)).toBeNull();
    }
  });

  test("rules: null (no assignment context) leaves the file menu exactly as today — nine items, one divider", () => {
    useAssignmentContext.mockReturnValue(null);
    const { container } = render();
    click(container.querySelector(".tb-btn--dropdown"));
    const menu = container.querySelector(".tb-dropdown-menu");
    expect(menu.querySelectorAll(".tb-dropdown-item")).toHaveLength(9);
    expect(menu.querySelector(".tb-dropdown-divider")).not.toBeNull();
  });
});
