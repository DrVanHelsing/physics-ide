import { describe, test, expect, afterEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import AboutPage from "../AboutPage";
import ContactPage from "../ContactPage";
import TeachersPage from "../TeachersPage";
import WelcomePage from "../WelcomePage";
import PrivacyPage from "../PrivacyPage";
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

  /* This lock has now been wrong in both directions, which is why it is
     written the way it is.

     First it held an OVERCLAIM: the record covered "who made, shared and
     joined what" — the scope of §8.3's peer-sharing ledger, which is not
     shipped and is a Plan 6 §9 exclusion. A fix round replaced that with
     "account signups, class joins and join requests — that is the whole of
     the monitoring", pinned word-for-word to WelcomePage.js's then-§12 panel.

     Honesty pass (2026-08-28): that replacement became an UNDERCLAIM the
     moment Plan 6 landed. `logEvent` writes more than forty kinds of row
     today — assignments created and published, work started and submitted,
     marks drafted, released and returned, groups formed, the baton taken,
     and every teacher read of a student's timeline. A privacy paragraph that
     undercounts what is recorded is exactly as dishonest as one that
     overclaims a feature, and on a privacy paragraph it is the worse of the
     two failures. The copy now names the record's shape, so it cannot rot
     again each time a route gains an event; the lock pins the shape, the
     underclaim wording is banned, and the "not a surveillance layer"
     promise — the part that actually constrains the build — is pinned
     hardest.

     Same pass, second half: peer sharing shipped in Stage C, which retired
     the OVERCLAIM's ban along with it — "who made, shared and joined what"
     stopped being an overclaim the day the ledger it described shipped.
     The record's own paragraph now says so directly, and the positive lock
     below pins that sentence rather than banning its old absence. */
  test("the surveillance sentence claims exactly what the ledger records — neither more nor less", () => {
    const container = render(<AboutPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("one append-only record of the actions accounts take");
    // &rsquo; in the markup — a typographic apostrophe in the rendered text.
    expect(text).toContain("every time a teacher opens a student’s timeline");
    expect(text).toContain(
      "so an action can be checked afterwards, never so a person can be watched while they work",
    );
    // Peer sharing shipped in Stage C — a share event simply joins the
    // record this paragraph already describes.
    expect(text).toContain("who shared what, with whom, when");
    // The underclaim ("that is the whole of the monitoring") stays banned.
    expect(text).not.toMatch(/that is the whole of the monitoring/i);
    // Task 13 (D§7): the About record grows its data-care leg — the same
    // "complete copy … or its removal" / "Removed student" pair the new
    // /privacy page pins, appended to this same paragraph.
    expect(text).toContain(
      "a complete copy of everything the system holds about them, or its removal",
    );
    expect(text).toContain("Removed student");
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
    /* Local-first dependency. Honesty pass (2026-08-28): the sentence this
       pinned — "there is no bill whose failure could switch anything off" —
       was true of the browser-only v1 and false once the classroom platform
       gained a backend. The promise underneath it is unchanged and still
       kept, so the lock now holds the scoped version: the IDE and the
       projects on your own machine survive the server going away, and the
       claim stops there. The unscoped absolute is banned so it cannot creep
       back with a copy edit. */
    expect(text).toContain(
      "would leave the IDE, and every project on your computer, working exactly as it does today",
    );
    expect(text).toContain("one installation for one school");
    expect(text).not.toMatch(/no bill whose failure/i);
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

  /* Honesty pass (2026-08-28): "the four class tabs" was true when this lock
     was written and false by the time Plan 6 landed — ClassChrome.js's `tabs`
     gained a staff-visible Gradebook, making five for a teacher and two for a
     student. The count is asserted here in the copy's own words rather than
     left to a reader's memory of the class shell. The admin console's four
     tabs are unchanged (AdminConsole.js's TABS: People, Classes, Emails,
     Health). */
  test("covers what's live today: open signup, class creation, all four join methods, the five class tabs, and the admin console", () => {
    const container = render(<TeachersPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("Anyone may sign up as a teacher");
    expect(text).toContain("a name and an optional subject or year label");
    expect(text).toContain("a short class code");
    expect(text).toContain("a copyable link");
    expect(text).toContain("QR code");
    expect(text).toContain("email invite");
    expect(text).toContain("Assignments, Guides, Gradebook, People and Settings");
    expect(text).toContain("a student sees the first two");
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
  /* Honesty pass (2026-08-28): the marking sentence this lock pinned —
     "Marking opens a submission read-only in the full IDE — a script you can
     watch run" — promised something the build deliberately does not do.
     MarkingRoom.js renders the snapshot through SubmissionViewer.js (the
     IDE's ReadOnlyBlockly plus a read-only Monaco, on a tab each), and the
     ONLY way to run a submission is "Open a test copy", which writes a fresh
     project into the marker's own space. A runnable read-only script would be
     a live document, which spec §7.2 forbids outright. The corrected sentence
     is pinned here, and the old promise is banned so it cannot drift back. */
  test("the completed system — submissions, marking, gradebook, pairs/groups — is described in the present tense", () => {
    const container = render(<TeachersPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    expect(text).toContain("Marking opens the submission as a read-only script");
    expect(text).toContain("To run it, open a test copy");
    /* Fix round 1: the reminder sentence must keep saying where the message
       actually goes. `POST /api/assignments/:id/remind` composes a real
       dueReminder per missing recipient, but the only Mailer implementation
       writes rows the admin console's Emails tab reads — delivery is a §9
       exclusion. The scoped wording is pinned; the unscoped one that shipped
       for review is banned so it cannot come back on a copy edit. */
    expect(text).toContain("rather than being posted out");
    expect(text).not.toMatch(/a reminder you can send to the students/i);
    expect(text).not.toMatch(/read-only in the full IDE/i);
    expect(text).not.toMatch(/script you can watch run/i);
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

describe("PrivacyPage — /privacy — §11's plain statements, pinned", () => {
  test("renders the shared header and exactly one h1", () => {
    const container = render(<PrivacyPage />);
    expect(container.querySelector(".welcome-header")).toBeTruthy();
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
  });

  test("§11's six plain statements, §10's admin sentence and D§7's export-scope sentence are pinned verbatim", () => {
    const container = render(<PrivacyPage />);
    const text = container.textContent.replace(/\s+/g, " ");
    // What we store (§11).
    expect(text).toContain(
      "name, email, scrambled password, class memberships, projects and their history, submissions, marks and feedback, the share ledger, and sign-in timestamps",
    );
    // What we never collect (§8.2/§11).
    expect(text).toContain(
      "no location, no contacts, no browsing habits, no advertising identifiers, no photos, no birthdates",
    );
    // Who sees what — §10's honest admin-visibility sentence.
    expect(text).toContain("an admin can technically see anything");
    // The right to leave — the erasure consequence.
    expect(text).toContain(
      "a complete copy of everything the system holds about them, or its removal",
    );
    expect(text).toContain("Removed student");
    // D§7's export-scope sentence, verbatim.
    expect(text).toContain("It does not contain other people's");
    expect(text).toContain(
      "The copy you get contains the actions you took. It does not contain other people's " +
        "— including a teacher's record of opening your timeline, which is theirs to be " +
        "accountable for, not yours to hold.",
    );
    /* §11's retention statement (Task 9, design D§7). This section had NO
     * lock at all until the sweep shipped — grepping this file for
     * retention/three years/proposal/"How long" returned nothing — so the
     * one paragraph on the page that describes an IRREVERSIBLE delete was
     * the only one that could drift silently. Three pins, because the copy
     * makes three separate promises the running code has to keep: what the
     * rule IS, what SURVIVES it (fiat 11 — no `projects` row is touched),
     * and that the period is a setting rather than a law. */
    expect(text).toContain(
      "An archived class is kept for three years and then deleted automatically",
    );
    expect(text).toContain("the class, its assignments, its submissions and its marks all go");
    expect(text).toContain("Students keep their own project libraries");
    expect(text).toContain("An administrator can change the period");
    // The honesty clause that stood while the sweep did not exist. It leaves
    // the moment the promise starts running, and is banned so a copy edit
    // cannot reinstate a hedge the code no longer needs.
    expect(text).not.toMatch(/not yet a running promise/i);
    expect(text).not.toMatch(/the current proposal/i);
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
   Plan 6") names features that stay out of scope even at launch. This guard
   is mechanized, not a one-time read, so a future present-tense edit to any
   of the swept pages cannot silently smuggle an excluded feature back in.

   Honesty pass (2026-08-28): peer sharing shipped in Stage C of Plan 7 and
   left this list — the exclusion it named is no longer true, so banning it
   would forbid the product's own copy from saying so.

   Consistency-audit hardening: two exclusions from the same §9 list — real
   email delivery and admin data requests — had no ban here at all, and
   ContactPage was missing from the page set entirely (the other three were
   checked, it never was). Both closed below (data requests since lifted —
   see the next paragraph). The real-email pattern is phrase-level on
   purpose, not a single word: the shipped copy legitimately says "email
   invite" (About, Teachers — a real join method) and "Emails" (Teachers'
   admin-console tab, the pretend-inbox log) already, and neither of those is
   the excluded claim. What's actually excluded is a claim that the platform
   *delivers* real email — so the ban targets that phrase, not the word
   "email" alone.

   Task 13 (D§9 ordering note): PrivacyPage joined the swept `pages` array
   below, written to clear all six patterns EXCLUDED then held at birth.

   Honesty pass (2026-08-29, Task 14): the notification bell and admin data
   requests shipped — Task 14's contract amendment lifts both — so their
   three patterns come out of EXCLUDED the same way peer sharing's did
   above; a test may not forbid a truth. Rubric marking and real email
   delivery are what remain of Plan 6 §9's original list, and the three
   surviving patterns below keep policing all five swept pages. */
describe("Launch-truth scope guard — Plan 6 §9 exclusions appear on none of the five public pages", () => {
  test("no page names rubric marking or real email delivery", () => {
    const EXCLUDED = [
      /rubric/i,
      /real email/i,
      /email delivery/i,
    ];
    const pages = [
      <AboutPage />,
      <ContactPage />,
      <TeachersPage />,
      <WelcomePage />,
      <PrivacyPage />,
    ];
    for (const ui of pages) {
      const container = render(ui);
      const text = container.textContent;
      for (const re of EXCLUDED) expect(text).not.toMatch(re);
      mounted.unmount();
      mounted = null;
    }
  });
});
