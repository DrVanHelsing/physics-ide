import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import BriefPane from "../BriefPane";
import { mountComponent, click, byTitle } from "../../../test/renderHelpers";
import { useAssignmentContext } from "../../../contexts/AssignmentContext";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";

/* Same bare-harness idiom as RulesChip.test.js / AssignmentPage.test.js:
   stub the context hook and react-query directly rather than mounting real
   providers, and stub InstructionsView down to a bare probe — its own
   rendering is covered by instructionsView.test.js, this suite only cares
   that BriefPane hands it the right doc. */
vi.mock("../../../contexts/AssignmentContext", () => ({
  useAssignmentContext: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));
vi.mock("../InstructionsView", () => ({
  default: ({ doc }) => (
    <div data-testid="instructions-stub">{doc ? JSON.stringify(doc) : "none"}</div>
  ),
}));
// Task 14: BriefPane now calls useMe() (for the Submit footer's push) —
// stub it, same idiom as SyncChip.test.js. None of these pre-existing
// suites' fixtures carry a `myWork` row, so the footer never renders here;
// submitFlow.test.js is where the Submit button itself is exercised.
vi.mock("../../../auth/useAuth", () => ({
  useMe: vi.fn(),
}));

const CTX = {
  assignmentId: "a-1",
  classId: "c-1",
  title: "Pendulum Lab",
  dueAt: 1700000000000,
  rules: { editors: "both" },
};

const DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Do the thing." }] }],
};

function queryData(doc = DOC) {
  return { data: { assignment: { instructions: doc } }, error: null, isLoading: false };
}

const realMatchMedia = globalThis.matchMedia;

/** Make exactly the listed queries match — same helper as ToolbarResponsive.test.js. */
function setViewport(...matching) {
  globalThis.matchMedia = (query) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

let mounted = null;

beforeEach(() => {
  setViewport(); // nothing matches -> the 1024px floor does not apply
  window.sessionStorage.clear();
  useAssignmentContext.mockReturnValue(CTX);
  useQuery.mockReturnValue(queryData());
  useMe.mockReturnValue({ data: { id: "u-1" } });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  globalThis.matchMedia = realMatchMedia;
  vi.clearAllMocks();
});

function render() {
  mounted = mountComponent(<BriefPane />);
  return mounted.container;
}

describe("BriefPane — no assignment context", () => {
  test("renders nothing at all", () => {
    useAssignmentContext.mockReturnValue(null);
    const container = render();
    expect(container.innerHTML).toBe("");
  });
});

describe("BriefPane — with context, expanded", () => {
  test("pane header carries the --brief variant and is titled by the assignment title", () => {
    const container = render();
    const header = container.querySelector(".pane-header.pane-header--brief");
    expect(header).not.toBeNull();
    expect(header.textContent).toContain("Pendulum Lab");
  });

  test("fetches the assignment detail via [\"assignment\", id] and renders the doc through InstructionsView", () => {
    const container = render();
    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["assignment", "a-1"] }),
    );
    const stub = container.querySelector('[data-testid="instructions-stub"]');
    expect(stub).not.toBeNull();
    expect(stub.textContent).toBe(JSON.stringify(DOC));
  });

  test("renders a due line", () => {
    const container = render();
    expect(container.textContent).toMatch(/due/i);
    expect(container.textContent).toContain(new Date(CTX.dueAt).toLocaleString());
  });

  test("no due date -> no due line", () => {
    useAssignmentContext.mockReturnValue({ ...CTX, dueAt: null });
    const container = render();
    expect(container.querySelector(".assignment-row__due")).toBeNull();
  });

  test("collapse button carries aria-expanded=true and collapses the pane to the handle on click", () => {
    const container = render();
    const collapseBtn = byTitle(container, "Collapse the brief");
    expect(collapseBtn).not.toBeNull();
    expect(collapseBtn.getAttribute("aria-expanded")).toBe("true");

    click(collapseBtn);

    expect(container.querySelector(".brief-pane")).toBeNull();
    const handle = container.querySelector(".brief-handle");
    expect(handle).not.toBeNull();
    expect(handle.getAttribute("aria-expanded")).toBe("false");
    expect(handle.textContent).toBe("Brief");
  });

  test("collapsing persists the choice to sessionStorage for the rest of the session", () => {
    const container = render();
    click(byTitle(container, "Collapse the brief"));
    expect(window.sessionStorage.getItem("pide_brief_collapsed")).toBe("true");
  });

  test("the pop-out button mounts Overlay with the same InstructionsView doc", () => {
    const container = render();
    expect(container.querySelector(".overlay-panel")).toBeNull();

    click(byTitle(container, "Open the brief in a window"));

    const panel = container.querySelector(".overlay-panel");
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("aria-label")).toBe("Pendulum Lab");
    expect(panel.querySelectorAll('[data-testid="instructions-stub"]').length).toBeGreaterThan(0);
  });
});

describe("BriefPane — collapsed", () => {
  test("under the 1024px floor with no stored choice: only the handle renders (a vertical tab labelled Brief)", () => {
    setViewport("(max-width: 1024px)");
    const container = render();

    expect(container.querySelector(".brief-pane")).toBeNull();
    expect(container.querySelector(".pane-header")).toBeNull();
    const handle = container.querySelector(".brief-handle");
    expect(handle).not.toBeNull();
    expect(handle.getAttribute("aria-expanded")).toBe("false");
    expect(handle.textContent).toBe("Brief");
  });

  test("clicking the handle expands the pane and persists the choice", () => {
    setViewport("(max-width: 1024px)");
    const container = render();

    click(container.querySelector(".brief-handle"));

    expect(container.querySelector(".brief-pane")).not.toBeNull();
    expect(window.sessionStorage.getItem("pide_brief_collapsed")).toBe("false");
  });

  test("a stored 'false' choice overrides a matching floor query — the student's explicit choice wins", () => {
    setViewport("(max-width: 1024px)");
    window.sessionStorage.setItem("pide_brief_collapsed", "false");
    const container = render();
    expect(container.querySelector(".brief-pane")).not.toBeNull();
  });

  test("a stored 'true' choice overrides a non-matching floor query", () => {
    setViewport(); // wide viewport — the floor alone would not collapse
    window.sessionStorage.setItem("pide_brief_collapsed", "true");
    const container = render();
    expect(container.querySelector(".brief-handle")).not.toBeNull();
    expect(container.querySelector(".brief-pane")).toBeNull();
  });
});

describe("BriefPane — offline: last-good instructions", () => {
  test("a failed refetch keeps showing the last successfully fetched doc instead of going blank", () => {
    const container = render();
    expect(container.querySelector('[data-testid="instructions-stub"]').textContent).toBe(
      JSON.stringify(DOC),
    );

    useQuery.mockReturnValue({ data: undefined, error: new Error("offline"), isLoading: false });
    mounted.rerender(<BriefPane />);

    expect(container.querySelector('[data-testid="instructions-stub"]').textContent).toBe(
      JSON.stringify(DOC),
    );
  });
});
