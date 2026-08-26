import { describe, test, expect, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import AboutPage from "../AboutPage";
import ContactPage from "../ContactPage";
import TeachersPage from "../TeachersPage";
import { mountComponent } from "../../test/renderHelpers";

/* /about, /contact and /teachers (polish brief, extended by the public-pages
   finish): gate-free routes sharing the WelcomeSubpage shell (header + a
   single prose column). Locks the copy the brief specifies — every sentence
   derivable from docs/classroom-platform.md, README.md or the shipped
   product, no invented contact channel — the same discipline
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

  // Public-pages finish: "For teachers" used to point back at the front
  // page's "#s-class" anchor from here — now it routes to the dedicated
  // /teachers page, same as every other page that mounts WelcomeHeader.
  test("the header's For teachers link routes to the dedicated /teachers page", () => {
    const container = render(<AboutPage />);
    const teachers = [...container.querySelectorAll(".welcome-header__nav a")].find(
      (a) => a.textContent === "For teachers",
    );
    expect(teachers.getAttribute("href")).toBe("/teachers");
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

  /* Moved after a fix-round review: the surveillance sentence originally
     claimed the record covers "who made, shared and joined what", which is
     the not-yet-shipped assignments/sharing ledger's scope, not what ships.
     This lock now holds the corrected sentence to WelcomePage.js §12's own
     wording word-for-word, and separately bans the overclaim so it cannot
     silently come back. */
  test("the surveillance sentence claims exactly what ships, matching §12", () => {
    const container = render(<AboutPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain(
      "an append-only record of account signups, class joins and join requests",
    );
    expect(text).toContain("that is the whole of the monitoring");
    expect(text).not.toMatch(/who made,?\s*shared and joined/i);
  });

  test("does not claim submissions or marking are live", () => {
    // Same honesty discipline as welcomePage.test.js's non-claims list, but
    // narrowed in the public-pages finish: this test used to also forbid
    // claiming assignments are live, matching WelcomePage.js §12's panel at
    // the time. Verified against the shipped code (Plan 6 Stages 0/A —
    // TeachersPage.js's header comment cites the commits), assignment
    // authoring and starting work really are live now, so that half of the
    // old assertion would be locking in a false claim rather than catching
    // one. Submissions, marking and the gradebook are still genuinely
    // undelivered (no submit action, no marking room, no gradebook screen
    // anywhere in frontend/src), so those checks stay.
    const container = render(<AboutPage />);
    const text = container.textContent;
    expect(text).not.toMatch(/marking is/i);
    expect(text).not.toMatch(/gradebook (is|lets|gives|includes)/i);
    expect(text).not.toMatch(/submi(t|ssion)[a-z]* (is|are) (live|available|here)/i);
    expect(text).toMatch(/designed but not shipped/);
  });

  // The signature line for the corrected fact above: assignments themselves
  // are now described as real (they hold a place in the class today,
  // alongside the roster/settings/people), while what remains undelivered
  // is named precisely — submitting work, marking it, and the gradebook.
  test("the corrected teacher paragraph names assignments as real and the remaining gap precisely", () => {
    const container = render(<AboutPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("its roster, its join settings, its people, and its assignments");
    expect(text).toContain(
      "submitting that work, marking it, and the gradebook are designed but not shipped yet",
    );
  });

  test("accessibility section is present with WCAG AA floor commitment", () => {
    const container = render(<AboutPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    // Verify the h2 exists
    const h2s = container.querySelectorAll("h2");
    const accessibilityH2 = [...h2s].find((h) => h.textContent === "Accessibility");
    expect(accessibilityH2).toBeTruthy();
    // Lock a signature sentence from the accessibility section
    expect(text).toContain("the test suite holds every generated block colour to the WCAG AA floor");
  });

  test("new content covers class roles, guest import, and local-first dependency", () => {
    const container = render(<AboutPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    // Roles and join policies
    expect(text).toContain("Five roles exist across the system");
    expect(text).toContain("short join code");
    expect(text).toContain("three join policies");
    // Guest import and limits
    expect(text).toContain("Signing up after working as a guest");
    expect(text).toContain("100 projects per account");
    // Local-first dependency
    expect(text).toContain("no bill whose failure could switch anything off");
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

  // Public-pages finish: the new "Found a problem?" section — still the
  // repository's own issue tracker, not an invented support channel.
  test("Found a problem? links the repository's issue tracker", () => {
    const container = render(<ContactPage />);
    const h2s = [...container.querySelectorAll("h2")].map((h) => h.textContent);
    expect(h2s).toContain("Found a problem?");
    const link = container.querySelector(
      'a[href="https://github.com/DrVanHelsing/physics-ide/issues"]',
    );
    expect(link).toBeTruthy();
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});

describe("TeachersPage — /teachers", () => {
  test("renders the shared header and exactly one h1", () => {
    const container = render(<TeachersPage />);
    expect(container.querySelector(".welcome-header")).toBeTruthy();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("For teachers");
  });

  test("the header's For teachers link routes to this page itself", () => {
    const container = render(<TeachersPage />);
    const teachers = [...container.querySelectorAll(".welcome-header__nav a")].find(
      (a) => a.textContent === "For teachers",
    );
    expect(teachers.getAttribute("href")).toBe("/teachers");
  });

  test("the header's Sign in is a plain Link — /teachers sits outside the gate, same as /about and /contact", () => {
    const container = render(<TeachersPage />);
    const signIn = container.querySelector(".welcome-header__signin a");
    expect(signIn).toBeTruthy();
    expect(signIn.getAttribute("href")).toBe("/auth/signin");
  });

  test("covers what's live today: open signup, class creation, all four join methods, the four class tabs, and the admin console", () => {
    const container = render(<TeachersPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("Anyone may sign up as a teacher");
    expect(text).toContain("a name and an optional subject or year label");
    expect(text).toContain("a short class code");
    expect(text).toContain("a copyable link");
    expect(text).toContain("QR code");
    expect(text).toContain("email invite");
    expect(text).toContain("Assignments, Guides, People and Settings");
    expect(text).toContain("admin console covers four tabs");
  });

  test("covers assignments as they actually ship: rich instructions, starter projects, three rule presets, guides", () => {
    const container = render(<TeachersPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("headings, images, formulas and embedded video");
    expect(text).toContain("Pin a starter project");
    expect(text).toContain("open practice leaves every tool on");
    expect(text).toContain("standard classwork is the everyday default");
    expect(text).toContain("locked assessment strips");
    expect(text).toContain("Guide pages publish that same rich format");
  });

  // The not-yet-built sentence — this page's own honesty panel, corrected
  // against the shipped code rather than reusing WelcomePage.js §12's now-
  // stale wording verbatim (that panel still lists assignments as
  // undelivered; here they are not). Locked so a future edit cannot widen
  // or narrow the claim without a deliberate test change.
  test("the not-yet-built panel names exactly what remains: submitting, marking, gradebook, pairs/groups", () => {
    const container = render(<TeachersPage />);
    const h3 = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Not yet built.");
    expect(h3).toBeTruthy();
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain(
      "Turning that work in, marking it, the gradebook, and pair or group work are designed but not shipped.",
    );
    // And the positive half stays honest too: starting work (not submitting it) is what exists today.
    expect(text).toContain("can start it in a private copy today");
  });

  test("does not claim submissions, marking, the gradebook, or group work are live", () => {
    const container = render(<TeachersPage />);
    const text = container.textContent;
    expect(text).not.toMatch(/\bsubmit(ted|s)?\b.{0,20}\b(is|are)\b.{0,10}\b(live|available|here)\b/i);
    expect(text).not.toMatch(/marking is/i);
    expect(text).not.toMatch(/gradebook (is|lets|gives|includes)/i);
    expect(text).not.toMatch(/group work is (live|available|here)/i);
  });

  test("the CTA door signs teachers up gate-free, via /auth/signup", () => {
    const container = render(<TeachersPage />);
    const h2s = [...container.querySelectorAll("h2")].map((h) => h.textContent);
    expect(h2s).toContain("Start: create your class");
    const cta = container.querySelector(".welcome-teachers-cta a.btn--primary");
    expect(cta).toBeTruthy();
    expect(cta.getAttribute("href")).toBe("/auth/signup");
    expect(cta.textContent).toBe("Create your account");
  });

  test("links out to About instead of duplicating its roles/limits/accessibility content", () => {
    const container = render(<TeachersPage />);
    const text = container.textContent;
    // The accessibility depth About already carries must not be repeated here.
    expect(text).not.toMatch(/WCAG/i);
    expect(text).not.toMatch(/keyboard focus ring/i);
    const aboutLink = container.querySelector('a[href="/about"]');
    expect(aboutLink).toBeTruthy();
  });
});
