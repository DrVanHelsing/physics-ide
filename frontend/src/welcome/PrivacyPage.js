import React from "react";
import WelcomeSubpage from "./WelcomeSubpage";

/**
 * PrivacyPage — /privacy (D§7, Task 13). The ONE new §14 row Plan 8 adds
 * (docs/classroom-platform.md §14's "Privacy page" row; the contract
 * amendment already names it — docs/product-contract.md's 29 August 2026
 * amendment). Gate-free, the same WelcomeSubpage shell as /about, /contact
 * and /teachers, linked from that shell's footer and from AboutPage.js's
 * "No surveillance layer" section.
 *
 * Every section below mirrors one of §11's six plain statements
 * (docs/classroom-platform.md §11 — "Privacy and data care"), in the
 * spec's own plain voice, plus §10's honest admin-visibility sentence and
 * §8.2's what-we-never-collect list. The right-to-leave section also
 * carries D§7's export-scope sentence verbatim.
 *
 * CRITICAL ORDERING CONSTRAINT (Task 13 brief, plan self-review note 8):
 * this page landed while `/data request/i` and the two bell patterns were
 * STILL banned phrases in welcomeSubpages.test.js's EXCLUDED sweep, and
 * this page joined that swept `pages` array in that same task. So the
 * wording at birth was written to clear all six EXCLUDED patterns on day
 * one, not just the three Task 14 leaves standing: it did not use the
 * literal phrase "data request" (saying "a complete copy … or its removal"
 * instead, exactly as D§7's About sentence does), the bare word "bell",
 * "rubric", or a claim that "real email" is "delivered" — the pretend
 * inbox is Plan 9's postman's job, not this page's to promise.
 *
 * Honesty pass (2026-08-29, Task 14): `/data request/i` and the two bell
 * patterns are lifted from EXCLUDED (the contract amendment above lifts the
 * bell and admin data requests), so the ordering constraint above is now
 * historical — the "who sees what" section says "act on a data request"
 * in the spec's own plain words rather than the birth-day euphemism
 * "leaving request". Rubric and real-email-delivered stay unclaimed; they
 * are still banned and this page still clears them.
 *
 * CONTROLLER WORDING CONSTRAINT (Task 9's ruling, binding): the erasure
 * scrub deliberately does not remove every trace — the events ledger,
 * the pretend inbox and outstanding invites can still carry the person's
 * email, and a personal project's own assignment_work rows cascade away
 * with it. So the right-to-leave section claims exactly what the scrub
 * does (the class record keeps the work, under "Removed student"; the
 * account and personal details go) and never claims total removal.
 */
export default function PrivacyPage() {
  return (
    <WelcomeSubpage title="Privacy and data care">
      <p>
        This is the whole of it, in one screen of text: what the system
        stores, what it never collects, who can see what, what happens if
        you leave, how the youngest users are treated, and how long records
        are kept.
      </p>

      <h2>What we store</h2>
      <p>
        What we store: name, email, scrambled password, class memberships,
        projects and their history, submissions, marks and feedback, the
        share ledger, and sign-in timestamps. That is the whole list.
      </p>

      <h2>What we never collect</h2>
      <p>
        What we never collect: no location, no contacts, no browsing
        habits, no advertising identifiers, no photos, no birthdates.
      </p>

      <h2>Who sees what</h2>
      <p>
        Teachers see their own classes&rsquo; work and marks. Students see
        their own. Guests see nothing of anyone &mdash; a guest has no
        account for anyone to see. Said honestly rather than left
        unsaid: an admin can technically see anything, because someone has
        to be able to fix a stuck account or act on a data request; the
        admin console is built for a once-a-week glance, not for reading
        marks for its own sake.
      </p>

      <h2>The right to leave</h2>
      <p>
        Any person can ask for all of it: a complete copy of everything the
        system holds about them, or its removal.
      </p>
      {/* D§7's export-scope sentence, verbatim (welcomeSubpages.test.js
          pins it word for word, straight apostrophes and all — do not
          swap these for &rsquo; entities, which render a different
          character). */}
      <p>
        The copy you get contains the actions you took. It does not
        contain other people's — including a teacher's record of opening
        your timeline, which is theirs to be accountable for, not yours to
        hold.
      </p>
      <p>
        Removing an account takes that person&rsquo;s own account and
        personal details with it. Their work inside a class record stays
        &mdash; submissions, marks and feedback &mdash; but it is kept
        under the name Removed student, so a class&rsquo;s marks history
        stays intact without keeping the person in it.
      </p>

      <h2>For school-aged users</h2>
      <p>
        Signing up includes a consent step written for school-aged users,
        and the language throughout this system is written for them, not
        for a lawyer. South Africa&rsquo;s POPIA rules are the bar this
        system aims at.
      </p>

      <h2>How long things are kept</h2>
      <p>
        The current proposal is to keep an archived class and its
        submissions for three years, then delete them on a schedule, so
        the system never turns into a data museum. That is a proposal, not
        yet a running promise &mdash; stated honestly as one, because the
        automatic side of it has not been built yet.
      </p>
    </WelcomeSubpage>
  );
}
