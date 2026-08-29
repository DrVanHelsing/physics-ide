import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import NotificationBell, { BELL_EMPTY } from "../NotificationBell";
import DropdownMenu from "../../common/DropdownMenu";
import { mountComponent, click } from "../../../test/renderHelpers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useMe } from "../../../auth/useAuth";

/* Same idiom as homeStrip.test.js / shareDialog.test.js / submitFlow.test.js:
   stub react-query's hooks directly (no QueryClientProvider mounted) and
   stub useMe + useNavigate. DropdownMenu itself is deliberately NOT mocked —
   it is a plain component with no external hooks, and the brief wants its
   real open/close + cloned role="menuitem"/close-on-select behaviour
   exercised for real, since that is exactly what proves the bell's rows are
   direct children of it. */
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));
vi.mock("../../../auth/useAuth", () => ({ useMe: vi.fn() }));
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigateSpy }));

const ROWS = [
  {
    id: 1,
    type: "mark",
    text: "Naledi marked your Kinematics HW",
    href: "/classes/c1/assignments/a1",
    createdAt: "2026-08-29T10:00:00Z",
    readAt: null,
  },
  {
    id: 2,
    type: "share",
    text: "Thabo shared Momentum Lab with you",
    href: "/classes/c2/assignments/a2",
    createdAt: "2026-08-28T10:00:00Z",
    readAt: "2026-08-28T11:00:00Z",
  },
];

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render() {
  mounted = mountComponent(<NotificationBell />);
  return mounted.container;
}

function trigger(container) {
  return container.querySelector('button[aria-haspopup="menu"]');
}

describe("NotificationBell — guest", () => {
  test("renders null and disables the query when signed out", () => {
    useMe.mockReturnValue({ data: null });
    const container = render();
    expect(container.firstChild).toBeNull();
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });
});

describe("NotificationBell — badge", () => {
  test("unreadCount 3 renders the badge and the trigger's aria label", () => {
    useMe.mockReturnValue({ data: { id: "u1" } });
    useQuery.mockReturnValue({ data: { notifications: ROWS, unreadCount: 3 } });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const container = render();
    const badge = container.querySelector(".badge");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe("3");
    expect(trigger(container).getAttribute("aria-label")).toBe("Notifications, 3 unread");
  });

  test("unreadCount 0 renders no badge and the bare label", () => {
    useMe.mockReturnValue({ data: { id: "u1" } });
    useQuery.mockReturnValue({ data: { notifications: ROWS, unreadCount: 0 } });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const container = render();
    expect(container.querySelector(".badge")).toBeNull();
    expect(trigger(container).getAttribute("aria-label")).toBe("Notifications");
  });
});

describe("NotificationBell — opening the menu", () => {
  test("renders both rows' text and fires the read mutation exactly once", () => {
    useMe.mockReturnValue({ data: { id: "u1" } });
    useQuery.mockReturnValue({ data: { notifications: ROWS, unreadCount: 3 } });
    const mutate = vi.fn();
    useMutation.mockReturnValue({ mutate, isPending: false });
    const container = render();

    click(trigger(container));

    expect(container.textContent).toContain(ROWS[0].text);
    expect(container.textContent).toContain(ROWS[1].text);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  test("zero unread never fires the read mutation, even across a close + re-open", () => {
    useMe.mockReturnValue({ data: { id: "u1" } });
    useQuery.mockReturnValue({ data: { notifications: ROWS, unreadCount: 0 } });
    const mutate = vi.fn();
    useMutation.mockReturnValue({ mutate, isPending: false });
    const container = render();
    const btn = trigger(container);

    click(btn); // open
    click(btn); // close
    click(btn); // re-open

    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("NotificationBell — row click", () => {
  test("navigates to the row's href and closes the menu (proves the rows are direct children)", () => {
    useMe.mockReturnValue({ data: { id: "u1" } });
    useQuery.mockReturnValue({ data: { notifications: ROWS, unreadCount: 3 } });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const container = render();

    click(trigger(container));
    const row = [...container.querySelectorAll(".bell-item")].find((el) =>
      el.textContent.includes(ROWS[0].text),
    );
    expect(row).toBeTruthy();
    expect(row.getAttribute("role")).toBe("menuitem");
    click(row);

    expect(navigateSpy).toHaveBeenCalledWith(ROWS[0].href);
    expect(container.querySelector(".tb-dropdown-menu")).toBeNull();
  });
});

describe("NotificationBell — empty state", () => {
  test("renders the disabled BELL_EMPTY row", () => {
    useMe.mockReturnValue({ data: { id: "u1" } });
    useQuery.mockReturnValue({ data: { notifications: [], unreadCount: 0 } });
    useMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const container = render();

    click(trigger(container));
    const empty = container.querySelector(".bell-empty");
    expect(empty).not.toBeNull();
    expect(empty.textContent).toBe(BELL_EMPTY);
    expect(empty.disabled).toBe(true);
  });
});

// No dedicated DropdownMenu suite exists yet (grepped: only this bell and
// welcomeHeader.test.js touch it, and the latter exercises WelcomeHeader's
// own markup, not DropdownMenu directly) — this case pins DropdownMenu's own
// regression per the brief: adding the optional onOpenChange prop must not
// change behaviour for every caller that doesn't pass it.
describe("DropdownMenu — no onOpenChange prop (regression)", () => {
  test("opens, clones role=menuitem + close-on-select onto children, and closes on select, exactly as before", () => {
    const onClick = vi.fn();
    mounted = mountComponent(
      <DropdownMenu trigger="Menu" triggerAriaLabel="Menu">
        <button type="button" onClick={onClick}>
          Item
        </button>
      </DropdownMenu>,
    );
    const container = mounted.container;
    const btn = container.querySelector('button[aria-haspopup="menu"]');
    expect(container.querySelector(".tb-dropdown-menu")).toBeNull();

    click(btn);
    const item = container.querySelector(".tb-dropdown-menu button");
    expect(item).not.toBeNull();
    expect(item.getAttribute("role")).toBe("menuitem");

    click(item);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".tb-dropdown-menu")).toBeNull();
  });
});
