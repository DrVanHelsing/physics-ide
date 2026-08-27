import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import AssignmentPage from "../AssignmentPage";
import { mountComponent, byText, click } from "../../../test/renderHelpers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startAssignmentWork } from "../../../utils/assignments/startWork";
import { api } from "../../../utils/api/client";

/* Same idiom as assignmentsTab.test.js / guides.test.js: stub react-query's
   hooks directly rather than mounting a real QueryClientProvider, mock
   react-router-dom's params/navigate, and stub ClassChrome down to a bare
   render-prop shell (myRole flips per test via this mutable holder).
   startWork.js itself is mocked — its own sequence is covered by
   startWork.test.js; this suite only asserts the button wiring around it. */
vi.mock("../../../utils/assignments/startWork", () => ({ startAssignmentWork: vi.fn() }));
vi.mock("../../../utils/api/client", () => ({ api: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
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
      myMark: null,
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
let invalidateSpy = null;

/** Task 22: the page now runs TWO queries (the assignment and, for group
 *  work, the assignment's groups). Only the group tests need both, so this
 *  installs a key-aware implementation rather than changing the single
 *  mockReturnValue every other test relies on. */
function mockQueries({ assignment, groups }) {
  useQuery.mockImplementation(({ queryKey }) => {
    if (queryKey[2] === "groups") return { data: groups, error: null, isLoading: false };
    return { data: assignment, error: null, isLoading: false };
  });
}

beforeEach(() => {
  roleHolder.myRole = "student";
  paramsHolder.id = "c1";
  paramsHolder.aid = "a1";
  invalidateSpy = vi.fn();
  useQueryClient.mockReturnValue({ invalidateQueries: invalidateSpy });
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
  api.mockResolvedValue({});
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

describe("AssignmentPage — released mark and returned state (Task 18)", () => {
  test("no myMark -> neither the feedback card nor the returned alert render", () => {
    const container = render();
    expect(container.querySelector(".card")).toBeNull();
    expect(container.querySelector(".alert.alert--warning")).toBeNull();
  });

  test("a released mark on a points-having assignment renders a .card with the score and the comment", () => {
    useQuery.mockReturnValue({
      data: assignmentData({
        points: 10,
        myMark: { points: 8, comment: "Nice work overall.", released: true, returned: false },
      }),
      error: null,
      isLoading: false,
    });
    const container = render();
    const card = container.querySelector(".card");
    expect(card).not.toBeNull();
    expect(card.textContent).toContain("Score: 8/10");
    expect(card.textContent).toContain("Nice work overall.");
  });

  test("a released mark on a points-less assignment reads 'Marked complete.' — no score line", () => {
    useQuery.mockReturnValue({
      data: assignmentData({
        points: null,
        myMark: { points: null, comment: "", released: true, returned: false },
      }),
      error: null,
      isLoading: false,
    });
    const container = render();
    expect(container.querySelector(".card").textContent).toContain("Marked complete.");
  });

  test("a returned (not yet released) mark renders alert--warning with the comment and an honest 'You can resubmit.'", () => {
    useQuery.mockReturnValue({
      data: assignmentData({
        points: 10,
        myMark: { points: null, comment: "Please fix the units.", released: false, returned: true },
      }),
      error: null,
      isLoading: false,
    });
    const container = render();
    expect(container.querySelector(".card")).toBeNull();
    const alert = container.querySelector(".alert.alert--warning");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain("Please fix the units.");
    expect(alert.textContent).toContain("You can resubmit.");
  });

  test("a returned, unreleased mark reopens Submit even while the assignment is closed (fiat D§11.2, mirrored client-side)", () => {
    useQuery.mockReturnValue({
      data: assignmentData({
        phase: "closed",
        myWork: { projectId: "p-1", startedAt: 1 },
        myMark: { points: null, comment: "Please fix the units.", released: false, returned: true },
      }),
      error: null,
      isLoading: false,
    });
    const container = render();
    expect(byText(container, "Submit")).not.toBeNull();
  });

  test("a mark that is BOTH released and returned does NOT reopen Submit while closed — the server's reopen rule is unreleased-only", () => {
    useQuery.mockReturnValue({
      data: assignmentData({
        phase: "closed",
        myWork: { projectId: "p-1", startedAt: 1 },
        myMark: { points: 8, comment: "Already graded.", released: true, returned: true },
      }),
      error: null,
      isLoading: false,
    });
    const container = render();
    expect(byText(container, "Submit")).toBeNull();
  });
});

/* ── Task 22: the group panel (spec §5.5 / §6.2) ────────────────────────
   "For pair/group assignments, this is also where students pick or see
   their group." The refusal sentences asserted here are the backend's own
   (groups.ts) — they must reach the student verbatim, never paraphrased. */

const GROUPS = {
  capacity: 2,
  groups: [
    { id: "g1", name: "Group 1", projectId: null, members: [{ userId: "u9", name: "Thabo" }] },
    {
      id: "g2",
      name: "Group 2",
      projectId: "p-9",
      members: [
        { userId: "u7", name: "Naledi" },
        { userId: "u8", name: "Sam" },
      ],
    },
  ],
};

function pairAssignment(overrides = {}) {
  return assignmentData({ submissionMode: "pair", myGroup: null, ...overrides });
}

describe("AssignmentPage — the group panel", () => {
  test("an individual assignment has no group panel at all", () => {
    mockQueries({ assignment: assignmentData({ submissionMode: "individual" }), groups: GROUPS });
    const container = render();
    expect(container.querySelector(".group-panel")).toBeNull();
  });

  test("pair work with no group yet: every group is listed with its members and its seat count", () => {
    mockQueries({ assignment: pairAssignment(), groups: GROUPS });
    const container = render();

    const panel = container.querySelector(".group-panel");
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain("Group 1");
    expect(panel.textContent).toContain("Thabo");
    expect(panel.textContent).toContain("Naledi, Sam");
    expect(byText(panel, "1/2", "span")).not.toBeNull();
    expect(byText(panel, "2/2", "span")).not.toBeNull();
  });

  test("a full group's Join is disabled — the cap is visible before you click, not only after", () => {
    mockQueries({ assignment: pairAssignment(), groups: GROUPS });
    const container = render();

    const rows = [...container.querySelectorAll(".group-row")];
    expect(rows[0].querySelector("button").disabled).toBe(false);
    expect(rows[1].querySelector("button").disabled).toBe(true);
  });

  test("Create a group POSTs the create route and refreshes the page's own data", async () => {
    mockQueries({ assignment: pairAssignment(), groups: GROUPS });
    const container = render();
    click(byText(container, "Create a group"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/assignments/a1/groups", { method: "POST", body: {} });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["assignment", "a1"] });
  });

  test("Join POSTs that group's join route", async () => {
    mockQueries({ assignment: pairAssignment(), groups: GROUPS });
    const container = render();
    click([...container.querySelectorAll(".group-row")][0].querySelector("button"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/groups/g1/join", { method: "POST" });
  });

  test("a refusal is shown verbatim in an alert--danger, not paraphrased away", async () => {
    mockQueries({ assignment: pairAssignment(), groups: GROUPS });
    api.mockRejectedValueOnce(new Error("That group is full."));
    const container = render();
    click([...container.querySelectorAll(".group-row")][0].querySelector("button"));
    await flush();

    const alert = container.querySelector(".group-panel .alert.alert--danger");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toBe("That group is full.");
  });

  test("in a group already: only that group offers a control, and it is Leave", () => {
    mockQueries({
      assignment: pairAssignment({ myGroup: GROUPS.groups[0] }),
      groups: GROUPS,
    });
    const container = render();

    expect(byText(container, "Create a group")).toBeNull();
    expect(byText(container, "Join")).toBeNull();
    const leave = byText(container, "Leave");
    expect(leave).not.toBeNull();
    expect(leave.className).toContain("btn--danger");
  });

  test("Leave POSTs the leave route, and its refusal is shown verbatim too", async () => {
    mockQueries({ assignment: pairAssignment({ myGroup: GROUPS.groups[0] }), groups: GROUPS });
    api.mockRejectedValueOnce(new Error("This group has already submitted."));
    const container = render();
    click(byText(container, "Leave"));
    await flush();

    expect(api).toHaveBeenCalledWith("/api/groups/g1/leave", { method: "POST" });
    expect(container.querySelector(".group-panel .alert.alert--danger").textContent).toBe(
      "This group has already submitted.",
    );
  });

  test("no groups exist yet: an empty state, and Create a group is still offered", () => {
    mockQueries({ assignment: pairAssignment(), groups: { capacity: 6, groups: [] } });
    const container = render();

    expect(container.querySelector(".group-panel .empty")).not.toBeNull();
    expect(byText(container, "Create a group")).not.toBeNull();
  });

  test("staff see the roster but get no Create/Join/Leave — groups are the students' (Ruling R7)", () => {
    roleHolder.myRole = "teacher";
    mockQueries({ assignment: pairAssignment(), groups: GROUPS });
    const container = render();

    expect(container.querySelector(".group-panel").textContent).toContain("Thabo");
    expect(byText(container, "Create a group")).toBeNull();
    expect(byText(container, "Join")).toBeNull();
    expect(byText(container, "Leave")).toBeNull();
    // /start refuses an ungrouped caller whatever their role, so the button
    // is honest about it for staff too rather than earning a 400.
    expect(byText(container, "Start work").disabled).toBe(true);
  });
});

describe("AssignmentPage — group work gates Start work on having a group", () => {
  test("no group yet: Start work is disabled and carries the server's own sentence", () => {
    mockQueries({ assignment: pairAssignment(), groups: GROUPS });
    const container = render();

    expect(byText(container, "Start work").disabled).toBe(true);
    expect(container.textContent).toContain("Join a group before starting this assignment.");
  });

  test("in a group: Start work is enabled again", () => {
    mockQueries({ assignment: pairAssignment({ myGroup: GROUPS.groups[0] }), groups: GROUPS });
    const container = render();

    expect(byText(container, "Start work").disabled).toBe(false);
    expect(container.textContent).not.toContain("Join a group before starting this assignment.");
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
