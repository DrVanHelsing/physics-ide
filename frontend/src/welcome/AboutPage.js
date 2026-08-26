import React from "react";
import WelcomeSubpage from "./WelcomeSubpage";

/**
 * AboutPage — /about, gate-free. Every sentence here is derivable from
 * docs/classroom-platform.md or README.md (polish brief's requirement); none
 * of it goes further than what those documents and the welcome page's own
 * honesty-ledger copy already state. In particular this page does NOT claim
 * assignments, submissions or marking exist yet — the welcome page's own
 * "Not yet built." panel (§12) is the standing source of truth for that, and
 * this page's teacher paragraph stops exactly where that panel does.
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
        today holds its roster, its join settings and its people &mdash;
        assignments, submissions and marking are designed but not shipped
        yet.
      </p>

      <h2>Local-first, on purpose</h2>
      <p>
        Physics never runs on a server. Every simulation and every data
        analysis runs in your browser, on your own machine. Projects save to
        your computer first, always; if you sign in, they also sync quietly
        to your account, but the copy on your computer is never the second
        priority.
      </p>

      <h2>No surveillance layer</h2>
      <p>
        The platform keeps an append-only record of who made, shared and
        joined what, and when &mdash; an honest paper trail, not a
        classroom-monitoring tool. It does not scan for copied work, does not
        watch how you type, and has no webcam or screen monitoring of any
        kind.
      </p>

      <h2>One school, on purpose</h2>
      <p>
        Each installation serves one school and is hard-capped at 200
        accounts &mdash; a limit the software enforces itself, not a promise
        someone has to keep. There is no multi-school machinery and no
        enterprise tier; the design stays small because the constraint is
        real.
      </p>
    </WelcomeSubpage>
  );
}
