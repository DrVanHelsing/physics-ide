import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import PortalHeader from "../PortalHeader";
import { mountComponent, click } from "../../../test/renderHelpers";
import { useTheme } from "../../../contexts/ThemeContext";

/* PortalHeader renders <Link> (react-router-dom), <HeaderAccount> (which
   itself calls useMe()/useSignout()/useNavigate() — see HeaderAccount.test.js)
   and useTheme() directly. Stub Link the way adminTabs.test.js / classTabs.
   test.js do, replace HeaderAccount with an identifiable marker (same mock
   target the brief calls for — a marker instead of null so this suite can
   assert its position in the right cluster), and stub useTheme so this suite
   mounts with no Router, no QueryClientProvider and no ThemeProvider. */
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("../../auth/HeaderAccount", () => ({
  default: () => <div data-testid="header-account" />,
}));
vi.mock("../../../contexts/ThemeContext", () => ({
  useTheme: vi.fn(),
}));

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render(props) {
  mounted = mountComponent(<PortalHeader {...props} />);
  return mounted.container;
}

describe("PortalHeader — the one portal header (spec §18 D9)", () => {
  test("renders the brand link to the given home", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const container = render({ home: "/classes" });
    const brand = container.querySelector(".auth-brand");
    expect(brand).not.toBeNull();
    expect(brand.getAttribute("href")).toBe("/classes");
  });

  test("brand defaults to / when no home prop is given", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const container = render({});
    expect(container.querySelector(".auth-brand").getAttribute("href")).toBe("/");
  });

  test("renders a nav slot when given one, omits it entirely when not", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const withNav = render({ nav: <nav className="tabs">tabs</nav> });
    expect(withNav.querySelector(".tabs")).not.toBeNull();
    mounted.unmount();

    const withoutNav = render({});
    expect(withoutNav.querySelector(".tabs")).toBeNull();
  });

  test("renders the title as an h1 when given, omits it when not", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const withTitle = render({ title: "My classes" });
    const h1 = withTitle.querySelector(".page-header__title");
    expect(h1).not.toBeNull();
    expect(h1.textContent).toBe("My classes");
    mounted.unmount();

    const withoutTitle = render({});
    expect(withoutTitle.querySelector(".page-header__title")).toBeNull();
  });

  test("the right cluster carries ThemeToggleButton then HeaderAccount, inside the bar", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const container = render({});
    const bar = container.querySelector(".page-header__bar");
    expect(bar).not.toBeNull();

    const theme = bar.querySelector(".tb-btn--theme");
    const account = bar.querySelector('[data-testid="header-account"]');
    expect(theme).not.toBeNull();
    expect(account).not.toBeNull();
    // Theme toggle precedes the account control in the cluster.
    expect(
      theme.compareDocumentPosition(account) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("clicking the toggle calls useTheme().toggle", () => {
    const toggle = vi.fn();
    useTheme.mockReturnValue({ isDark: true, toggle });
    const container = render({});
    click(container.querySelector(".tb-btn--theme"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  test("isDark from useTheme() drives the toggle's accessible label", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const dark = render({});
    expect(dark.querySelector(".tb-btn--theme").getAttribute("aria-label")).toBe(
      "Switch to light mode",
    );
    mounted.unmount();

    useTheme.mockReturnValue({ isDark: false, toggle: vi.fn() });
    const light = render({});
    expect(light.querySelector(".tb-btn--theme").getAttribute("aria-label")).toBe(
      "Switch to dark mode",
    );
  });
});
