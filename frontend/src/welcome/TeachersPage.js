import React from "react";
import { Link } from "react-router-dom";
import WelcomeSubpage from "./WelcomeSubpage";

/**
 * TeachersPage — /teachers, gate-free. Replaces the old "For teachers" nav
 * item's in-page anchor to WelcomePage.js's §12 section with a real page.
 *
 * Launch-truth copy pass (2026-08-26, controller-confirmed): the site
 * publishes to the public only once the classroom assignments build — Plan
 * 6, docs/superpowers/specs/2026-08-25-classroom-platform-06-assignments-
 * design.md — is complete on main, so this page was written in the present
 * tense ahead of the tree, against Plan 6 §1's stage table (teacher
 * authoring, student submissions, the marking room, the gradebook,
 * pairs/groups, guide pages).
 *
 * Honesty pass (2026-08-28): Plan 6 is complete, so every sentence here was
 * re-read against the SHIPPED code rather than against that table. Two
 * claims had drifted past what ships and are corrected:
 *
 *   1. "four tabs: Assignments, Guides, People and Settings" — Plan 6 added
 *      a fifth, Gradebook (ClassChrome.js's `tabs`, staff-visible). Now
 *      five, with the note that a student sees the first two.
 *   2. "Marking opens a submission read-only in the full IDE — a script you
 *      can watch run" — it does not, and that is the point of the design:
 *      MarkingRoom.js renders the snapshot through SubmissionViewer.js (the
 *      IDE's ReadOnlyBlockly + a read-only Monaco, on a tab each) and the
 *      ONLY way to run a submission is "Open a test copy", which writes a
 *      fresh project into the teacher's own space and opens the full IDE on
 *      that. The old sentence promised a runnable read-only script, which
 *      would be a live document — exactly the thing spec §7.2 forbids.
 *
 * Fix round 1 (2026-08-28, review of the pass above): the honesty pass added
 * a sentence about the inbox's reminder button that itself overclaimed —
 * "a reminder you can send to the students who still owe you work" reads as
 * delivery, and `POST /api/assignments/:id/remind` really does compose one
 * `dueReminder` per missing recipient — but the only `Mailer` implementation
 * writes rows the admin console's Emails tab reads. Delivery is a §9
 * exclusion this same commit's contract amendment restates as NOT lifted, so
 * the copy and the contract disagreed inside one commit. The sentence now
 * scopes itself the way this page's own admin-console paragraph already
 * scopes that tab ("every message the system would send"). An honesty pass
 * that introduces a claim is the failure mode it exists to catch; recorded
 * here rather than quietly corrected.
 *
 * Everything else verified as it stands. Nothing here reaches past the
 * stage table — §9 of the same document lists what launch deliberately
 * excludes (the notification bell, rubric marking, peer sharing, real email
 * delivery, admin data requests), none of those are claimed here or
 * anywhere else on the public pages, and welcomeSubpages.test.js's
 * launch-truth scope guard sweeps all four pages for them on every run.
 */
export default function TeachersPage() {
  return (
    <WelcomeSubpage title="For teachers">
      <p>
        Physics IDE is free for any teacher to try. Sign up, create a class,
        and put your students to work inside the same browser-based physics
        lab guests already use &mdash; no procurement, no approval queue,
        and nothing for you or your students to install. Your school runs
        one small installation; you just sign in to it.
      </p>

      <h2>Start a class in a minute</h2>
      <p>
        Anyone may sign up as a teacher; there is no gatekeeping at the
        door. Creating a class asks for a name and an optional subject or
        year label &mdash; one click and it exists.
      </p>
      <p>
        Students join four ways: a short class code, a copyable link, a QR
        code you can put up on the board, or an email invite pasted in as a
        list. Each class picks one of three join policies &mdash; open,
        approval, or paused &mdash; and approval holds new joiners in a
        waiting list until you confirm them.
      </p>
      <p>
        Inside a class you have five tabs: Assignments, Guides, Gradebook,
        People and Settings &mdash; a student sees the first two. People
        holds the roster, the join code and the pending invites; Settings
        holds the class name and its join policy.
      </p>

      <h2>Assignments with real instructions</h2>
      <p>
        An assignment's instructions are a real document, not a text box
        &mdash; headings, images, formulas and embedded video all render
        inline. Pin a starter project and every student begins from your
        setup instead of a blank canvas.
      </p>
      <p>
        Three workspace-rule presets shape what a student can touch while
        working: open practice leaves every tool on, standard classwork is
        the everyday default, and locked assessment strips debugging, file
        import, export and the advanced block set down to what the
        assignment is actually testing. Save your own combination once and
        reuse it on the next assignment.
      </p>
      <p>
        Guide pages publish that same rich format to a class without
        attaching it to any assignment &mdash; for how-tos, safety notes, or
        revision material. An assignment itself moves from draft to
        published to closed on your own schedule.
      </p>

      <h2>From a student&rsquo;s first click to a graded receipt</h2>
      <p>
        A student who opens a published assignment starts it in a private
        copy of your starter, workspace rules enforced from the first
        click. Turning the work in produces a receipt carrying a
        fingerprint of exactly what was submitted &mdash; the same
        fingerprint you see beside their work in the marking room, so what
        a student handed in and what you grade are provably the same file.
        Work submitted after the due date carries a late label
        automatically.
      </p>

      <h2>The marking room</h2>
      <p>
        Every published assignment has an inbox: who has submitted, who is
        late, and who is missing. One button writes a reminder to every
        student who still owes you work &mdash; and, like every message the
        system would send, it lands in the Emails log the site owner reads
        in the admin console rather than being posted out.
      </p>
      <p>
        Marking opens the submission as a read-only script &mdash; the
        student&rsquo;s blocks and their code, a tab each, in the
        IDE&rsquo;s own editors, frozen exactly as they were handed in.
        Neither of you can edit it, by accident or otherwise. To run it,
        open a test copy: that lands in your own projects and the full IDE
        opens on it, leaving what the student submitted untouched.
      </p>
      <p>
        A teaching assistant can draft marks and comments against a
        submission, but nothing reaches a student until you release it;
        return a submission for changes instead, and that student&rsquo;s
        work reopens.
      </p>
      <p>
        Every released mark lands in a single gradebook for the class, and
        it exports to CSV whenever you want the numbers in a spreadsheet
        instead.
      </p>

      <h2>Pairs and groups</h2>
      <p>
        Set an assignment to pair or group mode and the students on it
        share one project instead of working alone. An editing baton makes
        who currently holds write access unambiguous, and any member of the
        group can submit on behalf of all of them.
      </p>

      <h2>One school, one console</h2>
      <p>
        Every installation is run by its own site owner, and every teacher
        signup is visible to them the moment it happens. The admin console
        covers four tabs: People (search accounts, deactivate or reactivate
        one, resend a confirmation, send a password reset), Classes (every
        class's join mode and member count), Emails (every message the
        system would send), and Health (API, database and account usage at
        a glance).
      </p>
      <p>
        More on roles, the 200-account cap, and the local-first design
        behind all of it is in <Link to="/about">About</Link>.
      </p>

      <h2>Start: create your class</h2>
      <div className="card card--panel card--lg welcome-teachers-cta">
        <p>
          Sign up, choose &ldquo;I&rsquo;m a teacher,&rdquo; and your first
          class is a name and a click away.
        </p>
        <Link className="btn btn--primary btn--lg" to="/auth/signup">
          Create your account
        </Link>
        <p className="welcome-helpref">
          Already have an account? <Link to="/auth/signin">Sign in</Link>.
        </p>
      </div>
    </WelcomeSubpage>
  );
}
