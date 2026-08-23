import { describe, test, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import AdminConsole from "../AdminConsole";
import { mountComponent, keyDown } from "../../../test/renderHelpers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";

/* AdminConsole (and the tabs it switches between) call useQuery/useMutation/
   useQueryClient directly, and useMe() for the admin gate — stub all four so
   this suite mounts with no QueryClientProvider, following adminStatus.test.js. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: undefined })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, error: null })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
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
}));

function type(input, value) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
  useQuery.mockReturnValue({ data: undefined });
  useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null });
  useQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
});

function render() {
  useMe.mockReturnValue({ data: { id: "a1", name: "Admin", role: "admin" }, isLoading: false });
  mounted = mountComponent(<AdminConsole />);
  return mounted.container;
}

function selectedTab(container) {
  return container.querySelector('[role="tab"][aria-selected="true"]');
}

describe("AdminConsole tabs — real ARIA tablist, not attributes alone", () => {
  test("a tablist wraps four tabs, exactly one selected, panel wired via aria-labelledby", () => {
    const container = render();

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();

    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(["People", "Classes", "Emails", "Health"]);

    const selected = tabs.filter((t) => t.getAttribute("aria-selected") === "true");
    expect(selected.length).toBe(1);
    expect(selected[0].textContent).toBe("People");
    expect(selected[0].id).toBe("admin-tab-People");

    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("aria-labelledby")).toBe(selected[0].id);
  });

  test("roving tabIndex: only the selected tab is in the sequential tab order", () => {
    const container = render();
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    tabs.forEach((t) => {
      const wantZero = t.getAttribute("aria-selected") === "true";
      expect(t.getAttribute("tabindex")).toBe(wantZero ? "0" : "-1");
    });
  });

  test("ArrowRight moves both selection and DOM focus to the next tab", () => {
    const container = render();
    const first = selectedTab(container);
    expect(first.textContent).toBe("People");

    keyDown(first, { key: "ArrowRight" });

    const next = selectedTab(container);
    expect(next.textContent).toBe("Classes");
    expect(document.activeElement).toBe(next);
    // The panel actually switched, not just the tab's own attribute.
    expect(container.querySelector('[role="tabpanel"]').getAttribute("aria-labelledby")).toBe(next.id);
  });

  test("ArrowLeft from the first tab wraps to the last", () => {
    const container = render();
    const first = selectedTab(container);
    keyDown(first, { key: "ArrowLeft" });
    const now = selectedTab(container);
    expect(now.textContent).toBe("Health");
  });

  test("End jumps to the last tab, Home jumps back to the first", () => {
    const container = render();
    const first = selectedTab(container);

    keyDown(first, { key: "End" });
    const last = selectedTab(container);
    expect(last.textContent).toBe("Health");
    expect(document.activeElement).toBe(last);

    keyDown(last, { key: "Home" });
    const backToFirst = selectedTab(container);
    expect(backToFirst.textContent).toBe("People");
    expect(document.activeElement).toBe(backToFirst);
  });

  test("a key outside the roving set (e.g. Tab) does not change selection", () => {
    const container = render();
    const first = selectedTab(container);
    keyDown(first, { key: "Tab" });
    expect(selectedTab(container).textContent).toBe("People");
  });
});

describe("AdminConsole search — icon, clear button, no legacy alias", () => {
  test("the search box carries an icon and no clear button until there is text", () => {
    const container = render();
    const box = container.querySelector(".admin-search-box");
    expect(box).not.toBeNull();
    expect(box.querySelector("svg")).not.toBeNull();
    expect(box.querySelector(".admin-search-clear")).toBeNull();
  });

  test("typing reveals a clear button labeled for a screen reader; clicking it empties the field", () => {
    const container = render();
    const input = container.querySelector(".admin-search-box input");
    type(input, "ada");

    const clear = container.querySelector(".admin-search-clear");
    expect(clear).not.toBeNull();
    expect(clear.getAttribute("aria-label")).toBe("Clear search");

    act(() => clear.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.querySelector(".admin-search-box input").value).toBe("");
    expect(container.querySelector(".admin-search-clear")).toBeNull();
  });
});

describe("AdminConsole — the primitive class names, not the migration aliases", () => {
  test("the tab bar renders .tabs/.tab, never admin-tabs/admin-tab", () => {
    const container = render();
    expect(container.querySelector(".tabs")).not.toBeNull();
    expect(container.querySelector(".tab")).not.toBeNull();
    expect(container.querySelector(".admin-tabs")).toBeNull();
    // Every element classed exactly "admin-tab" or "admin-tab admin-tab--on"
    // is gone — only the canonical .tab / .tab.tab--on remain.
    expect(container.innerHTML).not.toMatch(/class="admin-tab(?:\s|")/);
  });
});

describe("AdminConsole Emails tab — the mail row is not click-only", () => {
  function renderEmails() {
    useMe.mockReturnValue({ data: { id: "a1", name: "Admin", role: "admin" }, isLoading: false });
    useQuery.mockImplementation(({ queryKey }) =>
      queryKey[1] === "emails"
        ? {
            data: {
              emails: [
                { id: "m1", createdAt: "2026-01-01T00:00:00Z", toEmail: "a@b.com", subject: "Hi", bodyText: "Body" },
              ],
            },
          }
        : { data: undefined },
    );
    mounted = mountComponent(<AdminConsole />);
    // Switch to the Emails tab the same way a mouse user would.
    const tabs = [...mounted.container.querySelectorAll('[role="tab"]')];
    const emailsTab = tabs.find((t) => t.textContent === "Emails");
    act(() => emailsTab.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    return mounted.container;
  }

  test("the row is focusable, announces its collapsed state, and opens on Enter", () => {
    const container = renderEmails();
    const row = container.querySelector(".admin-mail-row");
    expect(row.getAttribute("tabindex")).toBe("0");
    expect(row.getAttribute("role")).toBe("button");
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".admin-mail-body")).toBeNull();

    keyDown(row, { key: "Enter" });

    expect(container.querySelector(".admin-mail-row").getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".admin-mail-body")).not.toBeNull();
  });

  test("Space also opens the row and does not scroll the page (preventDefault called)", () => {
    const container = renderEmails();
    const row = container.querySelector(".admin-mail-row");
    let defaultPrevented = false;
    act(() => {
      const evt = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
      row.dispatchEvent(evt);
      defaultPrevented = evt.defaultPrevented;
    });
    expect(defaultPrevented).toBe(true);
    expect(container.querySelector(".admin-mail-row").getAttribute("aria-expanded")).toBe("true");
  });
});
