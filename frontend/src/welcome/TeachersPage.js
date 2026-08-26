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
 * design.md — is complete on main, so this page describes the finished
 * system in the present tense rather than today's tree. That is standard
 * pre-launch product copy, not dishonesty: every claim below traces to
 * Plan 6 §1's stage table (teacher authoring, student
 * submissions, the marking room, the gradebook, pairs/groups, guide pages)
 * and will be true the day this page goes live. Nothing here reaches past
 * that table — §9 of the same document lists what launch deliberately
 * excludes (the notification bell, rubric marking, peer sharing, real email
 * delivery, admin data requests), and none of those are claimed here or
 * anywhere else on the public pages.
 */
export default function TeachersPage() {
  return (
    <WelcomeSubpage title="For teachers">
      <p>
        Physics IDE is free for any teacher to try. Sign up, create a class,
        and put your students to work inside the same browser-based physics
        lab guests already use &mdash; no procurement, no approval queue,
        and no server for you to run.
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
        Inside a class there are four tabs: Assignments, Guides, People and
        Settings. People holds the roster, the join code and the pending
        invites; Settings holds the class name and its join policy.
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
        Marking opens a submission read-only in the full IDE &mdash; a
        script you can watch run, never a live document either of you could
        accidentally edit. Make a test copy any time you want to explore
        past reading. A teaching assistant can draft marks and comments
        against a submission, but nothing reaches a student until you
        release it; return a submission for changes instead, and that
        student&rsquo;s work reopens.
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
