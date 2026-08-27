import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import AssignmentPage from "../AssignmentPage";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { startAssignmentWork } from "../../../utils/assignments/startWork";

/* Same idiom as assignmentsTab.test.js / guides.test.js: stub react-query's
   hooks directly rather than mounting a real QueryClientProvider, mock
   react-router-dom's params/navigate, and stub ClassChrome down to a bare
   render-prop shell (myRole flips per test via this mutable holder).
   startWork.js itself is mocked — its own sequence is covered by
   startWork.test.js; this suite only asserts the button wiring around it. */
vi.mock("../../../utils/assignments/startWork", () => ({ startAssignmentWork: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

const { paramsHolder, navigateSpy } = vi.hoisted(() => ({
  paramsHolder: { id: "c1", aid: "a1" },
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

const { roleHolder } = vi.hoisted(() => ({ roleHolder: { myRole: "student" } }));
vi.mock("../../classes/ClassChrome", () => ({
  default: ({ children }) => children({ id: "c1", myRole: roleHolder.myRole }, { id: "u1" }),
}));

function assignmentData(overrides = {}) {
  return {
    assignment: {
      id: "a1",
      classId: "c1",
      title: "Momentum Lab",
      projectType: "physics",
      phase: "open",
      dueAt: 1700000000000,
      instructions: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Do the thing." }] }],
      },
      rules: { debug: true },
      myWork: null,
      starterSeed: null,
      hasStarter: false,
      ...overrides,
    },
  };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let mounted = null;

beforeEach(() => {
  roleHolder.myRole = "student";
  paramsHolder.id = "c1";
  paramsHolder.aid = "a1";
  useQuery.mockReturnValue({ data: assignmentData(), error: null, isLoading: false });
  useMutation.mockImplementation((opts) => ({
    mutate: (vars) => {
      Promise.resolve()
        .then(() => opts.mutationFn(vars))
        .then((data) => opts.onSuccess && opts.onSuccess(data, vars))
        .catch((err) => opts.onError && opts.onError(err));
    },
    isPending: false,
  }));
  startAssignmentWork.mockResolvedValue("p-new-1");
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render() {
  mounted = mountComponent(<AssignmentPage />);
  return mounted.container;
}

describe("AssignmentPage — content", () => {
  test("renders the title, phase badge, due line, and the instructions doc", () => {
    const container = render();
    expect(container.querySelector("h2").textContent).toBe("Momentum Lab");
    expect(byText(container, "open", "span")).not.toBeNull();
    expect(container.textContent).toMatch(/due/i);

    const rendered = container.querySelector(".instructions");
    expect(rendered).not.toBeNull();
    expect(rendered.querySelector("p").textContent).toBe("Do the thing.");
  });

  test("no due date -> no due line rendered", () => {
    useQuery.mockReturnValue({ data: assignmentData({ dueAt: null }), error: null, isLoading: false });
    const container = render();
    expect(container.textContent).not.toMatch(/due /i);
  });
});

describe("AssignmentPage — Start work / Continue", () => {
  test("no myWork -> Start work button", () => {
    const container = render();
    expect(byText(container, "Start work")).not.toBeNull();
    expect(byText(container, "Continue")).toBeNull();
  });

  test("myWork present -> Continue button", () => {
    useQuery.mockReturnValue({
      data: assignmentData({ myWork: { projectId: "p-existing", startedAt: 1 } }),
      error: null,
      isLoading: false,
    });
    const container = render();
    expect(byText(container, "Continue")).not.toBeNull();
    expect(byText(container, "Start work")).toBeNull();
  });

  test("clicking the button runs startAssignmentWork with the assignment + me, then navigates to /", async () => {
    const container = render();
    click(byText(container, "Start work"));
    await flush();

    expect(startAssignmentWork).toHaveBeenCalledWith({
      assignment: assignmentData().assignment,
      me: { id: "u1" },
    });
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });

  test("a failed start surfaces the server's message instead of navigating", async () => {
    startAssignmentWork.mockRejectedValueOnce(new Error("Something went wrong (HTTP 400)."));
    const container = render();
    click(byText(container, "Start work"));
    await flush();

    const alert = container.querySelector(".alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("Something went wrong (HTTP 400).");
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe("AssignmentPage — phase gating", () => {
  test("scheduled: the button is disabled with an honest sentence", () => {
    useQuery.mockReturnValue({ data: assignmentData({ phase: "scheduled" }), error: null, isLoading: false });
    const container = render();
    const btn = byText(container, "Start work");
    expect(btn.disabled).toBe(true);
    expect(container.textContent).toContain("hasn't opened yet");
  });

  test("closed: the button is disabled with an honest sentence", () => {
    useQuery.mockReturnValue({ data: assignmentData({ phase: "closed" }), error: null, isLoading: false });
    const container = render();
    const btn = byText(container, "Start work");
    expect(btn.disabled).toBe(true);
    expect(container.textContent).toContain("closed");
  });

  test("open: the button is enabled", () => {
    const container = render();
    const btn = byText(container, "Start work");
    expect(btn.disabled).toBe(false);
  });

  test("late_window: the button is enabled", () => {
    useQuery.mockReturnValue({ data: assignmentData({ phase: "late_window" }), error: null, isLoading: false });
    const container = render();
    const btn = byText(container, "Start work");
    expect(btn.disabled).toBe(false);
  });
});

describe("AssignmentPage — staff controls", () => {
  test("teacher view adds an Edit link and a Submissions link to the inbox", () => {
    roleHolder.myRole = "teacher";
    const container = render();

    const editLink = byText(container, "Edit", "a");
    expect(editLink).not.toBeNull();
    expect(editLink.getAttribute("href")).toBe("/classes/c1/assignments/a1/edit");

    const submissions = byText(container, "Submissions", "a");
    expect(submissions).not.toBeNull();
    expect(submissions.getAttribute("href")).toBe("/classes/c1/assignments/a1/inbox");
  });

  test("ta view also gets the staff controls", () => {
    roleHolder.myRole = "ta";
    const container = render();
    expect(byText(container, "Edit", "a")).not.toBeNull();
  });

  test("student view has neither the Edit link nor the Submissions link", () => {
    roleHolder.myRole = "student";
    const container = render();
    expect(byText(container, "Edit", "a")).toBeNull();
    expect(byText(container, "Submissions", "a")).toBeNull();
  });
});
