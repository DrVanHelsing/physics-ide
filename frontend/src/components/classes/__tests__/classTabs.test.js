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

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render(tab, myRole = "teacher") {
  useMe.mockReturnValue({ data: { id: "u1", role: "member" }, isLoading: false });
  useQuery.mockReturnValue({
    data: {
      class: { id: "class-1", name: "Physics 101", archived: false, myRole },
    },
    error: null,
  });
  mounted = mountComponent(<ClassChrome tab={tab}>{() => <div>panel</div>}</ClassChrome>);
  return mounted.container;
}

describe("ClassChrome link tabs — aria-current, not the tablist pattern", () => {
  test("the active tab's Link carries aria-current=page and no other link does", () => {
    const container = render("people");
    const links = [...container.querySelectorAll(".tab")];
    // Teacher role sees all three: Assignments, People, Settings.
    expect(links.length).toBe(3);

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

  test("a student (non-staff) sees only Assignments — no People/Settings link at all", () => {
    const container = render("assignments", "student");
    const links = [...container.querySelectorAll(".tab")];
    expect(links.map((l) => l.textContent)).toEqual(["Assignments"]);
    expect(links[0].getAttribute("aria-current")).toBe("page");
  });
});
