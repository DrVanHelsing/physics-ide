import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import MarkingRoom from "../MarkingRoom";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";
import { createManifest } from "../../../utils/manifest/factory";
import { saveProject } from "../../../utils/storage/projectStore";
import { api } from "../../../utils/api/client";
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
const ASSIGNMENT_DATA = { assignment: { id: "a1", title: "Momentum Lab", projectType: "physics", points: 10 } };

/** history entries — { id, attempt, ... }, same shape toSubmissionSummary
 *  produces (Task 17). Attempt 1's id is what a "stale" mark's
 *  basedOnSubmissionId points back to in the stale-warning tests below. */
const HISTORY = [
  { id: "sub-2", fingerprint: "abcdef1234567890", late: true, attempt: 2, submittedAt: 1700000000000 },
  { id: "sub-1", fingerprint: "0000000000000000", late: false, attempt: 1, submittedAt: 1699000000000 },
];

function submissionData(overrides = {}) {
  return {
    submission: {
      studentId: "s1",
      studentName: "Kid One",
      id: "sub-2",
      attempt: 2,
      late: true,
      fingerprint: "abcdef1234567890",
      submittedAt: 1700000000000,
      workspaceXml: "<xml>blocks-here</xml>",
      python: "print('hi')",
      mark: null,
      ...overrides,
    },
    history: HISTORY,
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
  if (queryKey[2] === "timeline") return { data: { versions: [], submissions: [] }, error: null, isLoading: false };
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

/** Same native-setter idiom guides.test.js/assignmentEditor.test.js use —
 *  React tracks the DOM value setter, so assigning `.value =` directly
 *  never fires its change-detection; the native prototype setter does. */
function typeInto(el, value) {
  act(() => {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
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

describe("MarkingRoom — MarkPanel: mark input and Save draft (Task 18)", () => {
  test("a points-having assignment shows a numeric field labelled with the out-of, empty by default (no mark yet)", () => {
    const container = render();
    expect(container.textContent).toContain("Points (out of 10)");
    const input = container.querySelector(".marking-panel input[type='number']");
    expect(input.value).toBe("");
    expect(container.querySelector(".marking-panel input[type='checkbox']")).toBeNull();
    expect(byText(container, "No mark yet.", "p")).not.toBeNull();
  });

  test("a points-less assignment shows a 'Mark complete' checkbox instead, and Save draft starts disabled", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      // ["assignment", aid] only — NOT the submission/inbox/timeline keys,
      // which also start with "assignment" as queryKey[0].
      if (queryKey.length === 2 && queryKey[0] === "assignment") {
        return { data: { assignment: { ...ASSIGNMENT_DATA.assignment, points: null } }, error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(container.querySelector(".marking-panel input[type='number']")).toBeNull();
    const checkbox = container.querySelector(".marking-panel input[type='checkbox']");
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
    expect(byText(container, "Save draft", "button").disabled).toBe(true);

    click(checkbox);
    expect(byText(container, "Save draft", "button").disabled).toBe(false);
  });

  test("an existing draft prefills points, comment, and the private note", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "submission") {
        return {
          data: submissionData({
            mark: { points: 7, comment: "Nice work", privateNote: "watch this one", status: "draft", returned: false, basedOnSubmissionId: "sub-2", releasedAt: null },
          }),
          error: null,
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(container.querySelector(".marking-panel input[type='number']").value).toBe("7");
    expect(container.querySelectorAll(".marking-panel textarea")[0].value).toBe("Nice work");
    expect(container.querySelectorAll(".marking-panel textarea")[1].value).toBe("watch this one");
    expect(container.textContent).toContain("Status: draft");
  });

  test("Save draft PUTs points/comment/privateNote and shows the success note on the returned mark", async () => {
    api.mockResolvedValueOnce({
      mark: { points: 9, comment: "Great job", privateNote: "", status: "draft", returned: false, basedOnSubmissionId: "sub-2", releasedAt: null },
    });
    const container = render();
    const input = container.querySelector(".marking-panel input[type='number']");
    typeInto(input, "9");
    const [comment] = container.querySelectorAll(".marking-panel textarea");
    typeInto(comment, "Great job");

    click(byText(container, "Save draft", "button"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1/marks/s1", {
      method: "PUT",
      body: { points: 9, comment: "Great job", privateNote: "" },
    });
    expect(byText(container, "Draft saved.", "div")).not.toBeNull();
  });

  test("a failed save surfaces the server's message", async () => {
    api.mockRejectedValueOnce(new Error("That is more than the assignment is out of."));
    const container = render();
    click(byText(container, "Save draft", "button"));
    await flush();
    const alert = container.querySelector(".marking-panel .alert.alert--danger");
    expect(alert?.textContent).toBe("That is more than the assignment is out of.");
  });
});

describe("MarkingRoom — MarkPanel: the stale-draft warning (D§11.3)", () => {
  test("a draft written against a superseded attempt shows the warning with the ORIGINAL attempt number", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "submission") {
        return {
          data: submissionData({
            mark: { points: 4, comment: "", privateNote: "", status: "draft", returned: false, basedOnSubmissionId: "sub-1", releasedAt: null },
          }),
          error: null,
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    const warning = container.querySelector(".marking-panel .alert.alert--warning");
    expect(warning).not.toBeNull();
    expect(warning.textContent).toContain("attempt 1");
  });

  test("a draft based on the CURRENT attempt shows no warning", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "submission") {
        return {
          data: submissionData({
            mark: { points: 4, comment: "", privateNote: "", status: "draft", returned: false, basedOnSubmissionId: "sub-2", releasedAt: null },
          }),
          error: null,
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(container.querySelector(".marking-panel .alert.alert--warning")).toBeNull();
  });
});

describe("MarkingRoom — MarkPanel: Return for changes", () => {
  test("an empty comment is refused client-side — no API call", async () => {
    const container = render();
    click(byText(container, "Return for changes", "button"));
    await flush();
    expect(api).not.toHaveBeenCalled();
    expect(byText(container, "A comment explaining the return is required.", "div")).not.toBeNull();
  });

  test("a non-empty comment POSTs to the return route and shows the success note", async () => {
    api.mockResolvedValueOnce({
      mark: { points: null, comment: "Please redo part 2.", privateNote: "", status: "draft", returned: true, basedOnSubmissionId: "sub-2", releasedAt: null },
    });
    const container = render();
    const [comment] = container.querySelectorAll(".marking-panel textarea");
    typeInto(comment, "Please redo part 2.");

    click(byText(container, "Return for changes", "button"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1/marks/s1/return", {
      method: "POST",
      body: { comment: "Please redo part 2." },
    });
    expect(byText(container, "Sent back for changes.", "div")).not.toBeNull();
  });
});

describe("MarkingRoom — MarkPanel: Release", () => {
  test("a TA never sees the Release button", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "class") {
        return { data: { class: { id: "c1", name: "Physics 101", myRole: "ta" } }, error: null, isLoading: false };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(byText(container, "Release", "button")).toBeNull();
  });

  test("the teacher's Release button is disabled until a mark exists", () => {
    const container = render();
    expect(byText(container, "Release", "button").disabled).toBe(true);
  });

  test("clicking Release posts studentIds:[studentId] and shows Released. on success", async () => {
    api.mockResolvedValueOnce({ released: ["s1"], refused: [] });
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "submission") {
        return {
          data: submissionData({
            mark: { points: 9, comment: "", privateNote: "", status: "draft", returned: false, basedOnSubmissionId: "sub-2", releasedAt: null },
          }),
          error: null,
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(byText(container, "Release", "button").disabled).toBe(false);

    click(byText(container, "Release", "button"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1/marks/release", {
      method: "POST",
      body: { studentIds: ["s1"] },
    });
    expect(byText(container, "Released.", "div")).not.toBeNull();
  });

  test("a stale refusal from the server surfaces the exact sentence, not a generic error", async () => {
    api.mockResolvedValueOnce({
      released: [],
      refused: [{ studentId: "s1", error: "This draft was written against a previous attempt — re-save it before releasing." }],
    });
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "submission") {
        return {
          data: submissionData({
            mark: { points: 9, comment: "", privateNote: "", status: "draft", returned: false, basedOnSubmissionId: "sub-2", releasedAt: null },
          }),
          error: null,
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    click(byText(container, "Release", "button"));
    await flush();
    const alert = container.querySelector(".marking-panel .alert.alert--danger");
    expect(alert.textContent).toBe("This draft was written against a previous attempt — re-save it before releasing.");
  });
});

describe("MarkingRoom — the History panel (Task 20's deferred mount)", () => {
  test("feeds buildTimelineEntries with the timeline query's versions/submissions and the student's name as savedByLabel, Restore disabled throughout", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[2] === "timeline") {
        return {
          data: {
            versions: [{ versionId: 1, clientUpdatedAt: 1699000000000, reason: "overwrite", savedAt: "2023-11-03T00:00:00.000Z" }],
            submissions: [],
          },
          error: null,
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    const history = container.querySelector(".marking-room__history");
    expect(history).not.toBeNull();
    expect(history.textContent).toContain("saved over");
    expect(history.textContent).toContain("Kid One");
    expect(history.querySelector(".btn")).toBeNull();
  });

  test("no checkpoints yet renders the empty state", () => {
    const container = render();
    const history = container.querySelector(".marking-room__history");
    expect(byText(history, "No checkpoints yet.", "p")).not.toBeNull();
  });
});
