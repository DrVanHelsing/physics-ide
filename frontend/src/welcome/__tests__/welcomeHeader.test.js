import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import WelcomeHeader from "../WelcomeHeader";
import { mountComponent, click } from "../../test/renderHelpers";

/* WelcomeHeader (polish brief move 4) is the slim site header mounted on
   /welcome and reused, unchanged, on /about and /contact. This suite covers
   the brief's own test list — "header nav links + collapse behavior" —
   independent of which page mounts it. */

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function render(props) {
  mounted = mountComponent(
    <MemoryRouter>
      <WelcomeHeader {...props} />
    </MemoryRouter>,
  );
  return mounted.container;
}

describe("WelcomeHeader — the site header (brief move 4)", () => {
  test("carries an explicit banner role, consistent regardless of which page mounts it", () => {
    // Left implicit, this <header> would get the banner role on /about and
    // /contact (sibling of <main>) but not on /welcome (descendant of
    // <main>, WelcomePage.js's long-standing shape) — the same component
    // landing two different landmark roles. Explicit role sidesteps that.
    const container = render({});
    expect(container.querySelector(".welcome-header").getAttribute("role")).toBe("banner");
  });

  test("the brand links Home to /welcome", () => {
    const container = render({});
    const brand = container.querySelector(".welcome-header__brand");
    expect(brand).toBeTruthy();
    expect(brand.getAttribute("href")).toBe("/welcome");
    expect(brand.textContent).toBe("PhysicsIDE");
  });

  test("the nav row carries About, For teachers and Contact, in order", () => {
    const container = render({});
    const links = [...container.querySelector(".welcome-header__nav").querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual(["About", "For teachers", "Contact"]);
    expect(links[0].getAttribute("href")).toBe("/about");
    expect(links[1].getAttribute("href")).toBe("/teachers");
    expect(links[2].getAttribute("href")).toBe("/contact");
  });

  // Public-pages finish: "For teachers" used to default to the in-page
  // "#s-class" anchor (only true on /welcome itself) and every other caller
  // had to override it with a real path. Now there is a dedicated /teachers
  // page, so the default itself is that route — every caller, /welcome
  // included, gets a real navigation unless it explicitly asks for
  // something else.
  test("default teachersHref routes to the dedicated /teachers page", () => {
    const container = render({});
    const teachers = container.querySelector('.welcome-header__nav a[href="/teachers"]');
    expect(teachers).toBeTruthy();
    expect(teachers.textContent).toBe("For teachers");
  });

  test("a caller-supplied teachersHref overrides the default", () => {
    const container = render({ teachersHref: "/welcome" });
    expect(container.querySelector('.welcome-header__nav a[href="/teachers"]')).toBeNull();
    const teachers = container.querySelector('.welcome-header__nav a[href="/welcome"]');
    expect(teachers).toBeTruthy();
    expect(teachers.textContent).toBe("For teachers");
  });

  test("the theme toggle is always present", () => {
    const container = render({});
    expect(container.querySelector(".tb-btn--theme")).toBeTruthy();
  });

  test("with onSignIn: Sign in is a button that calls it, not a Link", () => {
    const onSignIn = vi.fn();
    const container = render({ onSignIn });
    const signInWrap = container.querySelector(".welcome-header__signin");
    const btn = signInWrap.querySelector("button");
    expect(btn).toBeTruthy();
    expect(signInWrap.querySelector("a")).toBeNull();
    click(btn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  test("without onSignIn (about/contact): Sign in is a plain Link to /auth/signin", () => {
    const container = render({});
    const signInWrap = container.querySelector(".welcome-header__signin");
    expect(signInWrap.querySelector("button")).toBeNull();
    const link = signInWrap.querySelector("a");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/auth/signin");
  });

  test("collapse target: the one DropdownMenu carries the same four items, always in the DOM", () => {
    // CSS (welcome.css's ≤720px tail rule), not conditional render, decides
    // which of .welcome-header__nav / .welcome-header__menu is visible —
    // both exist in markup at every width, matched to welcomeTokens.test.js's
    // own "everything after the first @media" discipline.
    const onSignIn = vi.fn();
    const container = render({ onSignIn });
    const menu = container.querySelector(".welcome-header__menu");
    expect(menu).toBeTruthy();
    expect(menu.querySelector(".tb-dropdown")).toBeTruthy();
    const trigger = menu.querySelector('button[aria-haspopup="menu"]');
    expect(trigger).toBeTruthy();
    click(trigger);
    const items = [...menu.querySelectorAll(".tb-dropdown-item")].map((el) =>
      el.textContent.trim(),
    );
    expect(items).toEqual(["About", "For teachers", "Contact", "Sign in"]);
  });

  test("the menu's Sign in item calls onSignIn too, not just the persistent one", () => {
    const onSignIn = vi.fn();
    const container = render({ onSignIn });
    click(container.querySelector('.welcome-header__menu button[aria-haspopup="menu"]'));
    const menuSignIn = [...container.querySelectorAll(".welcome-header__menu .tb-dropdown-item")].find(
      (el) => el.textContent.trim() === "Sign in",
    );
    expect(menuSignIn.tagName).toBe("BUTTON");
    click(menuSignIn);
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  test("with onOpenIde: the menu's Open the IDE item calls it too, not just the persistent button", () => {
    // On phones (≤720px), CSS hides the persistent .welcome-header__cluster button,
    // so the DropdownMenu item is the only reachable "Open the IDE" control. This
    // test mirrors the onSignIn case above: open the menu, click the item, assert
    // the callback fires exactly once.
    const onOpenIde = vi.fn();
    const container = render({ onOpenIde });
    click(container.querySelector('.welcome-header__menu button[aria-haspopup="menu"]'));
    const menuOpenIde = [...container.querySelectorAll(".welcome-header__menu .tb-dropdown-item")].find(
      (el) => el.textContent.trim() === "Open the IDE",
    );
    expect(menuOpenIde.tagName).toBe("BUTTON");
    click(menuOpenIde);
    expect(onOpenIde).toHaveBeenCalledTimes(1);
  });
});
