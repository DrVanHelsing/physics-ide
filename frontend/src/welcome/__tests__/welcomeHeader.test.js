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
    expect(links[2].getAttribute("href")).toBe("/contact");
  });

  test("default teachersHref is the in-page anchor for /welcome itself", () => {
    const container = render({});
    const teachers = container.querySelector('.welcome-header__nav a[href="#s-class"]');
    expect(teachers).toBeTruthy();
    expect(teachers.textContent).toBe("For teachers");
  });

  test("a non-anchor teachersHref (from /about or /contact) renders a router Link instead", () => {
    const container = render({ teachersHref: "/welcome#s-class" });
    // A real navigation, not an anchor that resolves to nothing on the current page.
    expect(container.querySelector('.welcome-header__nav a[href="#s-class"]')).toBeNull();
    const teachers = container.querySelector('.welcome-header__nav a[href="/welcome#s-class"]');
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
});
