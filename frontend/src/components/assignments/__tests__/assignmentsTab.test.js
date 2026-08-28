import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import AssignmentsTab, { phaseBadge } from "../AssignmentsTab";
import { mountComponent, byText } from "../../../test/renderHelpers";
import { useQuery } from "@tanstack/react-query";

/* AssignmentsTab mounts ClassChrome (mocked below) and calls useQuery()
   directly for the assignment list — stub both, following ClassChrome's own
   suite and HeaderAccount.test.js. useAuth is stubbed too since ClassChrome
   would otherwise pull it in were it not mocked out. */
vi.mock("../../../auth/useAuth", () => ({
  useMe: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "c1" }),
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  Navigate: () => null,
}));

/* ClassChrome itself is a heavy neighbour (header, tab nav, its own class
   query) — mock it out to a bare render-prop shell, the way classTabs.test.js
   covers its real behaviour separately. myRole flips per test via this
   mutable holder. */
const { roleHolder } = vi.hoisted(() => ({ roleHolder: { myRole: "teacher" } }));
vi.mock("../../classes/ClassChrome", () => ({
  default: ({ children }) => children({ id: "c1", myRole: roleHolder.myRole }, { id: "u1" }),
}));

/* SharedWithYou (Plan 7) is another heavy neighbour with its own query,
   useMe(), and navigation — stubbed out the same way ClassChrome is above;
   its own behaviour is sharedWithYou.test.js's business. */
vi.mock("../../sharing/SharedWithYou", () => ({ default: () => null }));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
  roleHolder.myRole = "teacher";
});

function render() {
  mounted = mountComponent(<AssignmentsTab />);
  return mounted.container;
}

describe("AssignmentsTab", () => {
  test("teacher view: renders assignment titles, phase badges, and a New assignment link", () => {
    roleHolder.myRole = "teacher";
    useQuery.mockReturnValue({
      data: {
        assignments: [
          { id: "a1", title: "Kinematics HW", phase: "open", dueAt: null, submittedCount: 3 },
          { id: "a2", title: "Momentum Lab", phase: "draft", dueAt: null, submittedCount: 0 },
        ],
      },
      error: null,
      isLoading: false,
    });

    const container = render();
    expect(byText(container, "Kinematics HW", "span")).not.toBeNull();
    expect(byText(container, "Momentum Lab", "span")).not.toBeNull();
    expect(byText(container, "open", "span")).not.toBeNull();
    expect(byText(container, "draft", "span")).not.toBeNull();

    const link = byText(container, "New assignment", "a");
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/classes/c1/assignments/new");
  });

  test("student view: same list minus drafts server-side — no New assignment link", () => {
    roleHolder.myRole = "student";
    useQuery.mockReturnValue({
      data: {
        assignments: [
          { id: "a1", title: "Kinematics HW", phase: "open", dueAt: null, submittedCount: null },
        ],
      },
      error: null,
      isLoading: false,
    });

    const container = render();
    expect(byText(container, "Kinematics HW", "span")).not.toBeNull();
    expect(byText(container, "New assignment", "a")).toBeNull();
  });

  test("teacher empty state", () => {
    roleHolder.myRole = "teacher";
    useQuery.mockReturnValue({ data: { assignments: [] }, error: null, isLoading: false });

    const container = render();
    const empty = container.querySelector(".empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe("No assignments yet — create the first one.");
  });

  test("student empty state", () => {
    roleHolder.myRole = "student";
    useQuery.mockReturnValue({ data: { assignments: [] }, error: null, isLoading: false });

    const container = render();
    const empty = container.querySelector(".empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe("Nothing here yet. Your teacher's assignments will appear here.");
  });

  test("phaseBadge maps every phase to a word + class; closed carries no colour class", () => {
    expect(phaseBadge("open")).toEqual({ label: "open", cls: "badge badge--success" });
    expect(phaseBadge("late_window")).toEqual({ label: "late window", cls: "badge badge--warning" });
    expect(phaseBadge("scheduled")).toEqual({ label: "scheduled", cls: "badge badge--accent" });
    expect(phaseBadge("draft")).toEqual({ label: "draft", cls: "badge badge--warning" });
    expect(phaseBadge("marks_released")).toEqual({ label: "marks released", cls: "badge badge--accent" });
    expect(phaseBadge("closed")).toEqual({ label: "closed", cls: "badge" });
  });
});
