import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import MarkingRoom from "../MarkingRoom";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";
import { createManifest } from "../../../utils/manifest/factory";
import { saveProject } from "../../../utils/storage/projectStore";
import { LAST_PROJECT_KEY } from "../../../constants";

/**
 * Task 17 — the marking room. Same "stub react-query's hooks + useMe()
 * directly" idiom as assignmentEditor.test.js / submitFlow.test.js, rather
 * than a real QueryClientProvider. The two real sub-editors (ReadOnlyBlockly,
 * CodeEditor) are mocked entirely — same posture assignmentEditor.test.js
 * takes with RichTextEditor: Blockly/Monaco don't run meaningfully in
 * jsdom, and this suite is about the marking room's own behaviour (tabs,
 * test-copy, Previous/Next), not the sub-editors' own rendering (their
 * suites already cover that).
 */
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../auth/HeaderAccount", () => ({ default: () => null }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("../../../utils/manifest/factory", () => ({ createManifest: vi.fn() }));
vi.mock("../../../utils/storage/projectStore", () => ({ saveProject: vi.fn() }));

vi.mock("../../BlocklyWorkspace", () => ({
  ReadOnlyBlockly: ({ xml }) => <div data-testid="readonly-blockly">{xml}</div>,
}));
vi.mock("../../CodeEditor", () => ({
  default: ({ value, readOnly }) => (
    <div data-testid="code-editor" data-readonly={String(!!readOnly)}>
      {value}
    </div>
  ),
}));

const { paramsHolder, navigateSpy } = vi.hoisted(() => ({
  paramsHolder: { id: "c1", aid: "a1", studentId: "s1" },
  navigateSpy: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => paramsHolder,
  useNavigate: () => navigateSpy,
  Navigate: () => null,
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const ME = { id: "teacher-1" };
const CLASS_DATA = { class: { id: "c1", name: "Physics 101", myRole: "teacher" } };
const ASSIGNMENT_DATA = { assignment: { id: "a1", title: "Momentum Lab", projectType: "physics" } };

function submissionData(overrides = {}) {
  return {
    submission: {
      studentId: "s1",
      studentName: "Kid One",
      attempt: 2,
      late: true,
      fingerprint: "abcdef1234567890",
      submittedAt: 1700000000000,
      workspaceXml: "<xml>blocks-here</xml>",
      python: "print('hi')",
      ...overrides,
    },
  };
}

/** { rows: [...] } — Task 16's own inbox response shape, per its brief. */
const INBOX_ROWS = [
  { studentId: "s0", name: "Zero" },
  { studentId: "s1", name: "Kid One" },
  { studentId: "s2", name: "Two" },
];

function defaultUseQuery({ queryKey }) {
  if (queryKey[0] === "class") return { data: CLASS_DATA, error: null, isLoading: false };
  if (queryKey[2] === "submission") return { data: submissionData(), error: null, isLoading: false };
  if (queryKey[2] === "inbox") return { data: { rows: INBOX_ROWS }, error: null, isLoading: false };
  if (queryKey[0] === "assignment") return { data: ASSIGNMENT_DATA, error: null, isLoading: false };
  return { data: undefined, error: null, isLoading: false };
}

let mounted = null;

beforeEach(() => {
  paramsHolder.id = "c1";
  paramsHolder.aid = "a1";
  paramsHolder.studentId = "s1";
  useMe.mockReturnValue({ data: ME, isLoading: false });
  useQuery.mockImplementation(defaultUseQuery);
  localStorage.clear();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render() {
  mounted = mountComponent(<MarkingRoom />);
  return mounted.container;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("MarkingRoom — header and SubmissionViewer", () => {
  test("staff-only: a student member sees the gate sentence, not the viewer", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "class") {
        return { data: { class: { id: "c1", name: "Physics 101", myRole: "student" } }, error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(container.querySelector(".alert.alert--danger")).not.toBeNull();
    expect(container.querySelector('[data-testid="readonly-blockly"]')).toBeNull();
  });

  test("header carries student name, attempt, a late badge, and the fingerprint in --mono", () => {
    const container = render();
    expect(container.textContent).toContain("Kid One");
    expect(byText(container, "Attempt 2", "span")).not.toBeNull();
    const lateBadge = container.querySelector(".badge.badge--warning");
    expect(lateBadge?.textContent).toBe("late");
    const fingerprint = container.querySelector(".marking-room__fingerprint");
    expect(fingerprint?.textContent).toBe("abcdef1234567890");
  });

  test("no late badge when the submission is on time", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "submission") {
        return { data: submissionData({ late: false }), error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(container.querySelector(".badge.badge--warning")).toBeNull();
  });

  test("SubmissionViewer renders both tabs from the fixture snapshot: Blocks first, Code on click, both read-only", () => {
    const container = render();

    // Blocks is the default tab.
    const blockly = container.querySelector('[data-testid="readonly-blockly"]');
    expect(blockly?.textContent).toBe("<xml>blocks-here</xml>");
    expect(container.querySelector('[data-testid="code-editor"]')).toBeNull();
    expect(byText(container, "Blocks", "button")?.getAttribute("aria-selected")).toBe("true");

    click(byText(container, "Code", "button"));

    const codeEditor = container.querySelector('[data-testid="code-editor"]');
    expect(codeEditor?.textContent).toBe("print('hi')");
    expect(codeEditor?.getAttribute("data-readonly")).toBe("true");
    expect(container.querySelector('[data-testid="readonly-blockly"]')).toBeNull();
    expect(byText(container, "Code", "button")?.getAttribute("aria-selected")).toBe("true");
    expect(byText(container, "Blocks", "button")?.getAttribute("aria-selected")).toBe("false");
  });
});

describe("MarkingRoom — Open a test copy", () => {
  test("builds a manifest from the snapshot titled 'Test copy — <student> — <assignment>', saves it, stamps LAST_PROJECT_KEY, and navigates to \"/\"", async () => {
    const FAKE_MANIFEST = { id: "m-fake", title: "Test copy — Kid One — Momentum Lab" };
    createManifest.mockReturnValue(FAKE_MANIFEST);
    saveProject.mockResolvedValue({ id: "p-saved-1" });

    const container = render();
    click(byText(container, "Open a test copy", "button"));
    await flush();

    expect(createManifest).toHaveBeenCalledWith({
      goal: "physics",
      workspaceXml: "<xml>blocks-here</xml>",
      python: "print('hi')",
      title: "Test copy — Kid One — Momentum Lab",
    });
    expect(saveProject).toHaveBeenCalledWith(FAKE_MANIFEST);
    expect(localStorage.getItem(LAST_PROJECT_KEY)).toBe("p-saved-1");
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });

  test("never touches the student's own project space — only the local saveProject primitive runs, on a freshly-minted manifest", async () => {
    createManifest.mockReturnValue({ id: "m-fake-2" });
    saveProject.mockResolvedValue({ id: "p-saved-2" });

    const container = render();
    click(byText(container, "Open a test copy", "button"));
    await flush();

    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(saveProject.mock.calls[0][0]).not.toBe(submissionData().submission);
  });
});

describe("MarkingRoom — Previous / Next", () => {
  test("a middle row: both enabled, each jumping to the adjacent studentId in inbox order", () => {
    const container = render(); // studentId "s1" is INBOX_ROWS[1]
    const prev = byText(container, "Previous", "button");
    const next = byText(container, "Next", "button");
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);

    click(next);
    expect(navigateSpy).toHaveBeenCalledWith("/classes/c1/assignments/a1/marking/s2");

    click(prev);
    expect(navigateSpy).toHaveBeenCalledWith("/classes/c1/assignments/a1/marking/s0");
  });

  test("the first row: Previous disabled, Next enabled", () => {
    paramsHolder.studentId = "s0";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "submission") return { data: submissionData({ studentId: "s0" }), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(byText(container, "Previous", "button").disabled).toBe(true);
    expect(byText(container, "Next", "button").disabled).toBe(false);
  });

  test("the last row: Next disabled, Previous enabled", () => {
    paramsHolder.studentId = "s2";
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "submission") return { data: submissionData({ studentId: "s2" }), error: null, isLoading: false };
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(byText(container, "Next", "button").disabled).toBe(true);
    expect(byText(container, "Previous", "button").disabled).toBe(false);
  });

  test("no inbox data yet (direct link, cache empty): both disabled rather than guessing", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "inbox") return { data: undefined, error: null, isLoading: true };
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(byText(container, "Previous", "button").disabled).toBe(true);
    expect(byText(container, "Next", "button").disabled).toBe(true);
  });
});
