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

  /* F2 (2026-08-28 UI audit) — the wordmark reads as a logo, not an
     up-control, and on a drill-down page it was the ONLY structural link on
     the screen. `back` is the one shared affordance every stranded page now
     renders, naming its real parent rather than "back". */
  test("back={{to,label}} renders one .back-link in the bar, pointing at the named destination", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const container = render({
      home: "/classes",
      back: { to: "/classes/c1/assignments/a1/inbox", label: "Back to inbox" },
    });
    const bar = container.querySelector(".page-header__bar");
    const back = bar.querySelector(".back-link");
    expect(back).not.toBeNull();
    expect(back.getAttribute("href")).toBe("/classes/c1/assignments/a1/inbox");
    expect(back.textContent.replace(/\s+/g, " ").trim()).toBe("Back to inbox");
    // The brand is still the brand — the back link is a second, distinct link.
    expect(container.querySelector(".auth-brand").getAttribute("href")).toBe("/classes");
    expect(container.querySelectorAll(".back-link")).toHaveLength(1);
  });

  test("no back prop, no back link — a top-level screen renders none", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const container = render({ title: "My classes" });
    expect(container.querySelector(".back-link")).toBeNull();
  });

  /* Fix round (2026-08-28 wave review) — the header must never offer the same
     destination twice. ClassChrome sends home="/classes" AND a default back of
     "/classes", so every class tab that did not override `back` showed two
     adjacent links to one URL. The rule lives here rather than in any caller:
     a redundant `back` stands down wherever it comes from. */
  test("a back link that only repeats the wordmark's destination stands down", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const container = render({
      home: "/classes",
      back: { to: "/classes", label: "Back to my classes" },
    });
    expect(container.querySelector(".back-link")).toBeNull();
    // The wordmark still carries the destination — nothing was lost.
    expect(container.querySelector(".auth-brand").getAttribute("href")).toBe("/classes");
  });

  test("the same back target survives when home points somewhere else", () => {
    useTheme.mockReturnValue({ isDark: true, toggle: vi.fn() });
    const container = render({
      home: "/",
      back: { to: "/classes", label: "Back to my classes" },
    });
    const back = container.querySelector(".back-link");
    expect(back).not.toBeNull();
    expect(back.getAttribute("href")).toBe("/classes");
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
