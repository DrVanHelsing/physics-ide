import { describe, test, expect, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import AboutPage from "../AboutPage";
import ContactPage from "../ContactPage";
import { mountComponent } from "../../test/renderHelpers";

/* /about and /contact (polish brief): gate-free routes sharing the
   WelcomeSubpage shell (header + a single prose column). Locks the copy the
   brief specifies — every sentence derivable from docs/classroom-platform.md
   or README.md, no invented contact channel — the same discipline
   welcomePage.test.js already holds the front page to. */

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function render(ui) {
  mounted = mountComponent(<MemoryRouter>{ui}</MemoryRouter>);
  return mounted.container;
}

describe("AboutPage — /about", () => {
  test("renders the shared header and exactly one h1", () => {
    const container = render(<AboutPage />);
    expect(container.querySelector(".welcome-header")).toBeTruthy();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("About Physics IDE");
  });

  test("the header's For teachers link points at the front page's anchor, not the current page", () => {
    const container = render(<AboutPage />);
    const teachers = [...container.querySelectorAll(".welcome-header__nav a")].find(
      (a) => a.textContent === "For teachers",
    );
    expect(teachers.getAttribute("href")).toBe("/welcome#s-class");
  });

  test("the header's Sign in is a plain Link — /about sits outside the gate", () => {
    const container = render(<AboutPage />);
    const signIn = container.querySelector(".welcome-header__signin a");
    expect(signIn).toBeTruthy();
    expect(signIn.getAttribute("href")).toBe("/auth/signin");
  });

  test("the design-stance copy locks: local-first, no surveillance, one school", () => {
    const container = render(<AboutPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("Physics never runs on a server.");
    expect(text).toContain("no webcam or screen monitoring of any kind");
    expect(text).toContain("hard-capped at 200 accounts");
  });

  test("does not claim assignments, submissions or marking are live", () => {
    // Same honesty discipline as welcomePage.test.js's non-claims list: the
    // welcome page's own "Not yet built." panel is the standing source of
    // truth, and this page must not get ahead of it.
    const container = render(<AboutPage />);
    const text = container.textContent;
    expect(text).not.toMatch(/assignment[s]? (are|is) (available|here)/i);
    expect(text).not.toMatch(/marking is/i);
    expect(text).not.toMatch(/gradebook (is|lets|gives|includes)/i);
    expect(text).toMatch(/designed but not shipped/);
  });
});

describe("ContactPage — /contact", () => {
  test("renders the shared header and exactly one h1", () => {
    const container = render(<ContactPage />);
    expect(container.querySelector(".welcome-header")).toBeTruthy();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("Contact");
  });

  test("names the school's own admin/teacher as the contact, and only that", () => {
    const container = render(<ContactPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("This installation is run by your school.");
    expect(text).toContain("Your teacher or site administrator is the right contact");
  });

  test("links the public repository, and no other contact channel is invented", () => {
    const container = render(<ContactPage />);
    const link = container.querySelector('a[href="https://github.com/DrVanHelsing/physics-ide"]');
    expect(link).toBeTruthy();
    expect(link.getAttribute("rel")).toContain("noopener");
    const text = container.textContent;
    // No invented email address, phone number or contact form.
    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(text).not.toMatch(/\bcall\b|\bphone\b|contact form/i);
  });
});
