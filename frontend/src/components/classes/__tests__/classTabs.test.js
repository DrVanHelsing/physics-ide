import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import ClassChrome from "../ClassChrome";
import { mountComponent } from "../../../test/renderHelpers";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";

/* ClassChrome calls useQuery() (TanStack Query), useMe() and useParams() —
   stub all three, following adminStatus.test.js / HeaderAccount.test.js. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));
vi.mock("../../../auth/useAuth", () => ({
  useMe: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  Navigate: () => null,
  useParams: () => ({ id: "class-1" }),
}));
/* ClassChrome now mounts PortalHeader, which mounts HeaderAccount —
   HeaderAccount calls useSignout()/useNavigate(), neither stubbed above, so
   stub the whole component out the way PortalHeader.test.js does; its own
   behaviour is covered by HeaderAccount.test.js. */
vi.mock("../../auth/HeaderAccount", () => ({ default: () => null }));
// Plan 8 Task 6: PortalHeader also mounts NotificationBell now, which calls
// useQuery() unconditionally — same reason, same fix (its own behaviour is
// covered by notificationBell.test.js).
vi.mock("../../layout/NotificationBell", () => ({ default: () => null }));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render(tab, myRole = "teacher", props = {}) {
  useMe.mockReturnValue({ data: { id: "u1", role: "member" }, isLoading: false });
  useQuery.mockReturnValue({
    data: {
      class: { id: "class-1", name: "Physics 101", archived: false, myRole },
    },
    error: null,
  });
  mounted = mountComponent(
    <ClassChrome tab={tab} {...props}>
      {() => <div>panel</div>}
    </ClassChrome>,
  );
  return mounted.container;
}

describe("ClassChrome link tabs — aria-current, not the tablist pattern", () => {
  test("the active tab's Link carries aria-current=page and no other link does", () => {
    const container = render("people");
    const links = [...container.querySelectorAll(".tab")];
    // Teacher role sees all five: Assignments, Guides, Gradebook, People,
    // Settings. Deliberate (Task 9): Guides joins the tab set between
    // Assignments and People for every role — a guide page is "the same
    // format" as an assignment's instructions, published standalone, so it
    // lives beside Assignments rather than behind a staff-only gate.
    // Deliberate (Task 19): Gradebook joins right after Guides but stays
    // staff-only (show: isStaff) — unlike Guides, it's a teacher/TA
    // preparation tool with nothing for a student to see, so it follows
    // People/Settings' gating instead of Guides' show: true one.
    expect(links.length).toBe(5);

    const current = links.filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.length).toBe(1);
    expect(current[0].textContent).toBe("People");

    links
      .filter((l) => l !== current[0])
      .forEach((l) => expect(l.hasAttribute("aria-current")).toBe(false));
  });

  test("switching the active tab prop moves aria-current to the new link", () => {
    const container = render("settings");
    const current = container.querySelectorAll('.tab[aria-current="page"]');
    expect(current.length).toBe(1);
    expect(current[0].textContent).toBe("Settings");
  });

  test("link tabs use .tabs/.tab, never the tablist ARIA pattern — they navigate, they do not switch panels", () => {
    const container = render("assignments");
    expect(container.querySelector(".tabs")).not.toBeNull();
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector('[role="tab"]')).toBeNull();
    expect(container.querySelector('[role="tabpanel"]')).toBeNull();
    expect(container.querySelector(".admin-tabs")).toBeNull();
  });

  test("a student (non-staff) sees Assignments and Guides only — no People/Settings link", () => {
    const container = render("assignments", "student");
    const links = [...container.querySelectorAll(".tab")];
    // Guides is shown to every role (Task 9) — Gradebook/People/Settings
    // stay staff-only (Task 19 adds Gradebook to that staff-only group).
    expect(links.map((l) => l.textContent)).toEqual(["Assignments", "Guides"]);
    expect(links[0].getAttribute("aria-current")).toBe("page");
  });

  test("Gradebook tab: visible to a teacher, links to /classes/:id/gradebook, and carries aria-current when active", () => {
    const container = render("gradebook");
    const links = [...container.querySelectorAll(".tab")];
    const gradebook = links.find((l) => l.textContent === "Gradebook");
    expect(gradebook).not.toBeUndefined();
    expect(gradebook.getAttribute("href")).toBe("/classes/class-1/gradebook");
    expect(gradebook.getAttribute("aria-current")).toBe("page");
  });

  test("a TA also sees Gradebook (staff, not just teacher)", () => {
    const container = render("assignments", "ta");
    const links = [...container.querySelectorAll(".tab")];
    expect(links.map((l) => l.textContent)).toContain("Gradebook");
  });
});

/**
 * The back affordance, asserted against the REAL ClassChrome (F2 + the fix
 * round of 2026-08-28). Three of the nine screens that carry a back link
 * (AssignmentPage, InboxPage, GradebookTab) are tested through a ClassChrome
 * stub that drops the prop entirely, so without this file nothing automated
 * pinned the wiring at all — and nothing pinned the suppression rule that
 * keeps the header from offering /classes twice.
 */
describe("ClassChrome — the back affordance it hands the header", () => {
  test("the default back stands down: it names the same place the wordmark does", () => {
    const container = render("people");
    // The wordmark carries /classes, and it is the only link that does.
    expect(container.querySelector(".auth-brand").getAttribute("href")).toBe("/classes");
    expect(container.querySelector(".back-link")).toBeNull();
    const toClasses = [...container.querySelectorAll('a[href="/classes"]')];
    expect(toClasses).toHaveLength(1);
  });

  test("a sub-page's own back target reaches the header as a real .back-link", () => {
    const container = render("assignments", "teacher", {
      back: { to: "/classes/class-1", label: "Back to assignments" },
    });
    const back = container.querySelector(".back-link");
    expect(back).not.toBeNull();
    expect(back.getAttribute("href")).toBe("/classes/class-1");
    expect(back.textContent.replace(/\s+/g, " ").trim()).toBe("Back to assignments");
    // Still exactly one — the wordmark is not a second copy of it.
    expect(container.querySelectorAll(".back-link")).toHaveLength(1);
  });
});
