import React from "react";
import { Link } from "react-router-dom";
import WelcomeSubpage from "./WelcomeSubpage";

/**
 * AboutPage — /about, gate-free. Every sentence here is derivable from
 * docs/classroom-platform.md or README.md (polish brief's requirement); none
 * of it goes further than what those documents and the shipped product
 * state.
 *
 * The teacher paragraph's assignment sentence was corrected in the public-
 * pages finish: it used to say "assignments, submissions and marking are
 * designed but not shipped yet", matching WelcomePage.js §12's panel at the
 * time. Verified against the shipped code (not that stale panel — see
 * TeachersPage.js's own header comment for the commit-level evidence),
 * assignment authoring and starting work are real now; only submitting that
 * work, marking it, and the gradebook remain undelivered. The sentence below
 * says exactly that, and no further — this page still does not claim
 * submissions or marking are live.
 */
export default function AboutPage() {
  return (
    <WelcomeSubpage title="About Physics IDE">
      <p>
        Physics IDE is a browser-based tool for building physics simulations
        with blocks or Python, watching them run in 3D, then analysing the
        data they produce &mdash; no account needed, and nothing to install.
      </p>
      <p>
        It is built for physics classrooms. Guests get the complete IDE with
        nothing held back; signing in adds classes and account sync on top.
        Anyone may sign up as a teacher and create a class, and students join
        it by a short code, a link, a QR code, or an email invite. A class
        today holds its roster, its join settings, its people, and its
        assignments &mdash; submitting that work, marking it, and the
        gradebook are designed but not shipped yet. More on what a teacher
        can do today is in <Link to="/teachers">For teachers</Link>.
      </p>

      <h2>How a class works</h2>
      <p>
        Five roles exist across the system. Inviting someone into a class
        offers four ways in: a short join code — its alphabet is chosen so no
        two characters look alike read off a projector — a copyable link, a
        QR code for the board, or an email invite you can paste as a whole
        list. Invited people join as students, teaching assistants or
        co-teachers, and a pending invite can be resent or revoked.
      </p>
      <p>
        Each class has one of three join policies — open, approval, or paused
        — and the join code can be regenerated at any time to retire the old
        one. A People tab holds the full roster and can remove a member.
        Archiving a class at year end turns it read-only for everyone; it can
        be unarchived later.
      </p>

      <h2>Local-first, on purpose</h2>
      <p>
        Physics never runs on a server. Every simulation and every data
        analysis runs in your browser, on your own machine. Projects save to
        your computer first, always; if you sign in, they also sync quietly
        to your account, but the copy on your computer is never the second
        priority.
      </p>
      <p>
        Signing up after working as a guest offers a one-click import of the
        projects already in the browser — or it can be declined, leaving them
        where they are. On a shared computer, signing out clears the projects
        pulled down from the account while guest work stays put. Limits are
        stated plainly: 100 projects per account and a size cap per project,
        both with plain-English messages when they're reached. Signed in, work
        syncs to the account after every save, after every delete, and again
        on sign-in, on returning to the tab, or on coming back online.
      </p>

      <h2>No surveillance layer</h2>
      {/* Aligned word-for-word with WelcomePage.js §12's own wording (the
          shipped record) after a fix-round review caught an overclaim here:
          this page previously said "who made, shared and joined what",
          which is the not-yet-shipped assignments/sharing ledger's scope
          (docs/classroom-platform.md §8.1's share ledger), not what actually
          ships. What ships is exactly signups, joins and join requests. */}
      <p>
        The platform keeps an append-only record of account signups, class
        joins and join requests &mdash; that is the whole of the monitoring,
        and it exists so a join can be audited, not so a student can be
        watched. It does not scan for copied work, does not watch how you
        type, and has no webcam or screen monitoring of any kind.
      </p>

      <h2>Accessibility</h2>
      <p>
        The block palette ships its own contrast arithmetic, and the test
        suite holds every generated block colour to the WCAG AA floor. One
        keyboard focus ring serves the whole product, defined once at zero
        specificity so no component overrides it by accident. Asking the system
        for reduced motion actually turns the animation off — this page's orbit,
        the IDE's idle screen — with an end-to-end test asserting the guard
        ships in the CSS. The classroom portal works from a keyboard throughout:
        the admin console's tabs are ARIA tabs the arrow keys walk, class tabs
        are plain links that declare the current page, and joining, inviting and
        syncing announce their progress through live regions.
      </p>

      <h2>One school, on purpose</h2>
      <p>
        Each installation serves one school and is hard-capped at 200
        accounts &mdash; a limit the software enforces itself, not a promise
        someone has to keep. There is no multi-school machinery and no
        enterprise tier; the design stays small because the constraint is
        real.
      </p>
      <p>
        A hosted tool lasts only as long as someone keeps paying for its
        servers. This one has no such dependency: the physics runs on the
        user's own machine, projects save there first, the account cap is
        enforced by the software itself, and there is no bill whose failure
        could switch anything off.
      </p>
    </WelcomeSubpage>
  );
}
