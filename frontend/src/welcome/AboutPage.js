import React from "react";
import { Link } from "react-router-dom";
import WelcomeSubpage from "./WelcomeSubpage";

/**
 * AboutPage — /about, gate-free. Every sentence here is derivable from
 * docs/classroom-platform.md or README.md (polish brief's requirement); none
 * of it goes further than what those documents and the shipped product
 * state.
 *
 * Launch-truth copy pass (2026-08-26, controller-confirmed): the site
 * publishes only once the classroom assignments build (Plan 6 — see
 * TeachersPage.js's own header comment for the spec citation) is complete,
 * so the teacher paragraph below describes the finished class — roster,
 * settings, people, assignments, submissions, marking and the gradebook —
 * in the present tense. It still claims nothing past Plan 6 §1's stage
 * table; §9's exclusions (the notification bell, rubric marking, peer
 * sharing, real email delivery, admin data requests) are not named here.
 *
 * Honesty pass (2026-08-28): Plan 6 is complete, so every claim on this
 * page was re-read against the shipped code rather than against that stage
 * table. All of it holds except the privacy paragraph under "No
 * surveillance layer", which had gone stale in the *understating*
 * direction — see its own comment below. The rest, spot-checked to source:
 * five roles — spec §2.1's table is Guest, Student, TA, Teacher, Admin, and
 * in code that is `CLASS_ROLES` (student/ta/teacher) plus `ACCOUNT_ROLES`
 * (user/admin) in shared/src/roles.ts, the guest being precisely the person
 * with no account; three join policies (open / approval / paused); the
 * 100-project cap (`MAX_PROJECTS_PER_USER`, backend/src/routes/projects.ts);
 * the 200-account cap (admin.ts's `account_cap` setting, default 200).
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
        holds its roster, its join settings, its people, and its
        assignments; students submit their work against them, teachers mark
        it in the same IDE, and a gradebook tracks every result. More on
        what a teacher can do is in <Link to="/teachers">For teachers</Link>.
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
      {/* Honesty pass (2026-08-28) — the sentence below was rewritten, and
          this comment with it. Its two predecessors both misdescribed the
          ledger. The first overclaimed ("who made, shared and joined what"
          — the scope of §8.3's peer-sharing ledger, which is NOT shipped
          and is a Plan 6 §9 exclusion). The correction then underclaimed:
          it said the record was "account signups, class joins and join
          requests — that is the whole of the monitoring", aligned to
          WelcomePage.js's then-§12 panel, and that sentence stopped being
          true the moment Plan 6 landed. `logEvent` (backend/src/db/events.ts)
          now writes more than forty kinds of row (43 written as string
          literals, plus the ternary and constant call sites) across
          auth.ts, classes.ts, invites.ts,
          members.ts, projects.ts, assignments.ts, groups.ts, guides.ts,
          admin.ts and tick.ts — assignment created/published/closed, work
          started, submitted, marks drafted/released/returned, groups formed
          and the baton taken, and (design §6) every teacher read of a
          student's timeline. A privacy paragraph that undercounts what is
          recorded is as dishonest as one that overclaims a feature, so the
          copy now names the shape of the record instead of a stale list.
          Still deliberately absent, per §8.2 and unchanged: any similarity
          scan, any paste or typing telemetry, any webcam or screen capture.
          Plan 7's honesty pass (28 August 2026) added one more sentence
          to the same paragraph rather than a new one: the §8.3 peer-sharing
          ledger shipped in Stage C, so a share event now simply joins the
          record already described here. */}
      <p>
        The platform keeps one append-only record of the actions accounts
        take: signing up, joining a class or asking to, publishing an
        assignment, handing work in, releasing a mark, forming a group
        &mdash; and, so that the trail cuts both ways, every time a teacher
        opens a student&rsquo;s timeline. It exists so an action can be
        checked afterwards, never so a person can be watched while they
        work. It does not scan for copied work, does not watch how you type,
        and has no webcam or screen monitoring of any kind. Every share of
        work between classmates joins the same record &mdash; who shared
        what, with whom, when.
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
      {/* Honesty pass (2026-08-28): this paragraph used to end "there is no
          bill whose failure could switch anything off", which was true of
          the browser-only v1 and stopped being true when the classroom
          platform gained a backend (product-contract.md's 18 August 2026
          amendment). The local-first promise it was really making still
          holds exactly — and holds in the part that matters — so the
          paragraph now says which part, instead of claiming the whole
          product has no server bill. Two things are deliberately NOT
          claimed here: that the classroom layer is free to run, and spec
          §12's "the cloud parts sleep when nobody is using them", which
          describes the GCP step and is not shipped (design §9). */}
      <p>
        A hosted tool lasts only as long as someone keeps paying for its
        servers. The part of this one that does the work has no such
        dependency: the physics and the analysis run on your own machine and
        projects save there first, so an installation that went dark
        tomorrow would leave the IDE, and every project on your computer,
        working exactly as it does today. What a lapsed bill would reach is
        the classroom layer around it &mdash; classes, assignments and marks
        &mdash; and that layer is deliberately small: one installation for
        one school, capped by the software itself at 200 accounts.
      </p>
    </WelcomeSubpage>
  );
}
