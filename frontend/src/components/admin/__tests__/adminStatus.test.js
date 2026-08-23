import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { HealthTab } from "../AdminConsole";
import { mountComponent } from "../../../test/renderHelpers";
import { useQuery } from "@tanstack/react-query";

/* HealthTab calls useQuery() (TanStack Query) directly — stub it so this
   suite can mount the tab in isolation, the way HeaderAccount.test.js stubs
   useAuth for the same reason. useMutation/useQueryClient are stubbed too
   since AdminConsole.js imports them at module scope, even though HealthTab
   itself never calls them. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render(data) {
  useQuery.mockReturnValue({ data });
  mounted = mountComponent(<HealthTab />);
  return mounted.container;
}

describe("AdminConsole HealthTab — semantic status with a second channel (D13)", () => {
  test("healthy API renders .badge--success containing the word running, plus an svg", () => {
    const container = render({ ok: true, db: "ok", users: 3, cap: 200, emailsLogged: 5 });
    const badge = container.querySelector(".badge--success");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain("running");
    expect(badge.querySelector("svg")).not.toBeNull();
    // Neither state class appears on the other's badge — colour is not the
    // only channel, and the two never share a class.
    expect(badge.classList.contains("badge--danger")).toBe(false);
  });

  test("unhealthy API renders .badge--danger containing the word trouble, plus an svg", () => {
    const container = render({ ok: false, db: "ok", users: 3, cap: 200, emailsLogged: 5 });
    const badge = container.querySelector(".badge--danger");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain("trouble");
    expect(badge.querySelector("svg")).not.toBeNull();
    expect(badge.classList.contains("badge--success")).toBe(false);
  });

  test("the health list is wrapped in a .card surface", () => {
    const container = render({ ok: true, db: "ok", users: 3, cap: 200, emailsLogged: 5 });
    const card = container.querySelector(".card");
    expect(card).not.toBeNull();
    expect(card.querySelector(".admin-health")).not.toBeNull();
  });
});
