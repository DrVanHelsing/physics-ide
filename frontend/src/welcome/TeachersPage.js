import React from "react";
import { Link } from "react-router-dom";
import WelcomeSubpage from "./WelcomeSubpage";

/**
 * TeachersPage — /teachers, gate-free. Replaces the old "For teachers" nav
 * item's in-page anchor to WelcomePage.js's §12 section with a real page.
 *
 * Every claim here was verified against the shipped code, not the design
 * spec (docs/classroom-platform.md) or the stale honesty copy elsewhere on
 * the site — both describe a superset that includes work still in flight.
 * Concretely: WelcomePage.js §12 and AboutPage.js's teacher paragraph both
 * still say assignments are "designed but not shipped", but Plan 6 Stages 0
 * and A are in on this branch (commits dc5fdf7…9c831c0, 597ceb5) — teachers
 * really can author and publish assignments with rich instructions, pinned
 * starters and workspace rules today, and a student really can start one in
 * a private copy (c47abb7, eae61a7, 2875b74). What is still missing is
 * everything Plan 6 Stages B(tail)–D deliver: submitting that work, the
 * marking room, the gradebook, and pair/group work — confirmed absent by
 * the disabled "Submissions" button in AssignmentPage.js ("Arrives with
 * marking") and by there being no brief pane, submit action or inbox
 * anywhere in frontend/src yet. This page's own "not yet built" panel below
 * names exactly that remaining set — not the wider, now-inaccurate list the
 * landing page still carries. Updating that page's own copy is Plan 6 Task
 * 25 ("the honesty pass"), owned by a later stage, not this lane.
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

      <h2>What&rsquo;s still on the way</h2>
      <div className="card card--panel welcome-notbuilt">
        <h3>Not yet built.</h3>
        <p>
          A student who opens a published assignment can start it in a
          private copy today, workspace rules enforced from the first
          click. Turning that work in, marking it, the gradebook, and pair
          or group work are designed but not shipped. When they arrive,
          this page updates.
        </p>
      </div>

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
