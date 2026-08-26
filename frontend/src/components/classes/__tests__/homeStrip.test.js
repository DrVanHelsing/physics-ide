import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import ClassesHome from "../ClassesHome";
import { mountComponent, byText } from "../../../test/renderHelpers";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";

/* ClassesHome mounts PortalHeader (which pulls in ThemeContext/HeaderAccount
   — irrelevant here, stub it the way classTabs.test.js stubs HeaderAccount)
   and calls useMe()/useQuery()/useMutation()/useQueryClient() directly. Stub
   the lot, following AssignmentsTab.test.js's house idiom for mocking
   useQuery per queryKey. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));
vi.mock("../../../auth/useAuth", () => ({
  useMe: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  Navigate: () => null,
}));
vi.mock("../../layout/PortalHeader", () => ({ default: () => null }));

function defaultUseQuery({ queryKey }) {
  if (queryKey[0] === "classes") return { data: { classes: [] }, isLoading: false };
  if (queryKey[0] === "assignments") {
    return { data: { dueSoon: [], recentFeedback: [] }, isLoading: false };
  }
  return { data: undefined, isLoading: false };
}

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render() {
  useMe.mockReturnValue({ data: { id: "u1", isTeacher: false, role: "user" }, isLoading: false });
  mounted = mountComponent(<ClassesHome />);
  return mounted.container;
}

describe("Home strip — due soon and recent feedback", () => {
  test("an empty Home renders no strip at all — both sections stay absent", () => {
    useQuery.mockImplementation(defaultUseQuery);
    const container = render();
    expect(container.querySelector(".home-strip")).toBeNull();
    expect(byText(container, "Due soon", "h2")).toBeNull();
    expect(byText(container, "Recent feedback", "h2")).toBeNull();
  });

  test("dueSoon alone renders only the Due soon section", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignments") {
        return {
          data: {
            dueSoon: [
              {
                assignmentId: "a1",
                classId: "c1",
                className: "Physics 101",
                title: "Kinematics HW",
                dueAt: Date.now() + 86_400_000,
                submitted: false,
              },
            ],
            recentFeedback: [],
          },
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(byText(container, "Due soon", "h2")).not.toBeNull();
    expect(byText(container, "Recent feedback", "h2")).toBeNull();
  });

  test("recentFeedback alone renders only the Recent feedback section", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignments") {
        return {
          data: {
            dueSoon: [],
            recentFeedback: [
              { assignmentId: "a3", classId: "c3", title: "Projectile Motion", releasedAt: Date.now() },
            ],
          },
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });
    const container = render();
    expect(byText(container, "Due soon", "h2")).toBeNull();
    expect(byText(container, "Recent feedback", "h2")).not.toBeNull();
  });

  test("rows link into the assignment page; a submitted row carries the badge--success chip, an unsubmitted one does not", () => {
    useQuery.mockImplementation(({ queryKey }) => {
      if (queryKey[0] === "assignments") {
        return {
          data: {
            dueSoon: [
              {
                assignmentId: "a1",
                classId: "c1",
                className: "Physics 101",
                title: "Kinematics HW",
                dueAt: Date.now() + 86_400_000,
                submitted: false,
              },
              {
                assignmentId: "a2",
                classId: "c2",
                className: "Physics 102",
                title: "Momentum Lab",
                dueAt: Date.now() + 172_800_000,
                submitted: true,
              },
            ],
            recentFeedback: [
              { assignmentId: "a3", classId: "c3", title: "Projectile Motion", releasedAt: Date.now() },
            ],
          },
          isLoading: false,
        };
      }
      return defaultUseQuery({ queryKey });
    });

    const container = render();

    const kinematicsLink = byText(container, "Kinematics HW", "span")?.closest("a");
    expect(kinematicsLink).not.toBeNull();
    expect(kinematicsLink.getAttribute("href")).toBe("/classes/c1/assignments/a1");
    expect(kinematicsLink.textContent).toContain("Physics 101");
    expect(kinematicsLink.querySelector(".badge--success")).toBeNull();

    const momentumLink = byText(container, "Momentum Lab", "span")?.closest("a");
    expect(momentumLink.getAttribute("href")).toBe("/classes/c2/assignments/a2");
    const badge = momentumLink.querySelector(".badge--success");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe("submitted");

    const feedbackLink = byText(container, "Projectile Motion", "span")?.closest("a");
    expect(feedbackLink.getAttribute("href")).toBe("/classes/c3/assignments/a3");
  });
});
