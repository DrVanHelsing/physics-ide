import { describe, test, expect, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import AboutPage from "../AboutPage";
import ContactPage from "../ContactPage";
import TeachersPage from "../TeachersPage";
import WelcomePage from "../WelcomePage";
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

  /* Launch-truth directive, controller-confirmed (2026-08-26): the site
     publishes to the public only once the classroom assignments build
     (Plan 6) is complete, so the two locks that stood here — one requiring
     "designed but not shipped" to appear, one requiring the paragraph to
     stop short of naming submissions/marking/the gradebook as real — no
     longer describe the launch system. Deleted together; the present-tense
     replacement is locked below. */
  test("the teacher paragraph names the completed system in the present tense", () => {
    const container = render(<AboutPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("its roster, its join settings, its people, and its assignments");
    expect(text).toContain(
      "students submit their work against them, teachers mark it in the same IDE, and a gradebook tracks every result",
    );
    expect(text).not.toMatch(/designed but not shipped/i);
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

  /* Launch-truth directive, controller-confirmed (2026-08-26): the site
     publishes to the public only once the classroom assignments build
     (Plan 6) is complete, so the two locks that stood here — one requiring
     the "Not yet built." panel and its "designed but not shipped" sentence,
     one banning present-tense claims about submissions/marking/the
     gradebook/group work — no longer describe the launch system. Deleted
     together; the present-tense replacement is locked below. */
  test("the completed system — submissions, marking, gradebook, pairs/groups — is described in the present tense", () => {
    const container = render(<TeachersPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("Marking opens a submission read-only in the full IDE");
    expect(text).toContain("a receipt carrying a fingerprint of exactly what was submitted");
    expect(text).toContain("carries a late label automatically");
    expect(text).toContain("Every released mark lands in a single gradebook for the class");
    expect(text).toContain("it exports to CSV");
    expect(text).toContain("An editing baton makes who currently holds write access unambiguous");
    const h3 = [...container.querySelectorAll("h3")].find((h) => h.textContent === "Not yet built.");
    expect(h3).toBeUndefined();
    expect(container.querySelector(".welcome-notbuilt")).toBeNull();
    expect(text).not.toMatch(/still on the way/i);
    expect(text).not.toMatch(/designed but not shipped/i);
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

/* ── Shared closing footer (consistency-audit fix) ─────────────────────────
   About, Contact and Teachers previously ended the instant their prose did
   — no closing rhythm at all, unlike /welcome's own deliberate .welcome-foot.
   Starkest on /contact: three short paragraphs left a bare, undesigned void
   below them (caught by a full-page capture, not by reading the CSS). All
   three now close on a thin rule plus the same two gate-free account links
   the header's own Sign in already uses — plain Links, not go(), since
   these routes carry no session-stamping function and a bare Link to "/"
   would trip WelcomeGate and bounce straight back to /welcome. */
describe("Subpage shell — the shared closing footer (About, Contact, Teachers)", () => {
  test("every subpage closes on the same footer: gate-free links to sign-up and sign-in", () => {
    for (const Page of [AboutPage, ContactPage, TeachersPage]) {
      const container = render(<Page />);
      const foot = container.querySelector(".welcome-subpage__foot");
      expect(foot).toBeTruthy();
      const signUp = foot.querySelector('a[href="/auth/signup"]');
      const signIn = foot.querySelector('a[href="/auth/signin"]');
      expect(signUp).toBeTruthy();
      expect(signUp.textContent).toBe("Create an account");
      expect(signIn).toBeTruthy();
      expect(signIn.textContent).toBe("Sign in");
      mounted.unmount();
      mounted = null;
    }
  });
});

/* ── Launch-truth scope guard (Plan 6 §9) ──────────────────────────────────
   All four public pages now describe the classroom assignments build in the
   present tense, on the premise that the site publishes only once Plan 6 is
   complete. That premise has a hard edge: Plan 6 §9 ("Deliberately NOT in
   Plan 6") names features that stay out of scope even at launch — the
   notification bell, rubric marking, peer sharing, real email delivery and
   admin data requests among them. This guard is mechanized, not a one-time
   read, so a future present-tense edit to any of the four pages cannot
   silently smuggle an excluded feature back in.

   Consistency-audit hardening: two exclusions from the same §9 list — real
   email delivery and admin data requests — had no ban here at all, and
   ContactPage was missing from the page set entirely (the other three were
   checked, it never was). Both closed below. The two new patterns are
   phrase-level on purpose, not single words: the shipped copy legitimately
   says "email invite" (About, Teachers — a real join method) and "Emails"
   (Teachers' admin-console tab, the pretend-inbox log) already, and neither
   of those is the excluded claim. What's actually excluded is a claim that
   the platform *delivers* real email, or that admin can issue a *data
   request* (export/erase) — so the bans target those phrases, not the word
   "email" or "data" alone. */
describe("Launch-truth scope guard — Plan 6 §9 exclusions appear on none of the four public pages", () => {
  test("no page names the notification bell, rubric marking, peer sharing, real email delivery or admin data requests", () => {
    const EXCLUDED = [
      /rubric/i,
      /notification bell/i,
      /\bbell\b/i,
      /peer sharing/i,
      /real email/i,
      /email delivery/i,
      /data request/i,
    ];
    const pages = [<AboutPage />, <ContactPage />, <TeachersPage />, <WelcomePage />];
    for (const ui of pages) {
      const container = render(ui);
      const text = container.textContent;
      for (const re of EXCLUDED) expect(text).not.toMatch(re);
      mounted.unmount();
      mounted = null;
    }
  });
});
