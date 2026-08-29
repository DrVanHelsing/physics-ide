import React from "react";
import { Link } from "react-router-dom";
import WelcomeHeader from "./WelcomeHeader";
import { PrivacyIcon } from "../components/Icons";

/**
 * WelcomeSubpage — the shared shell for /about, /contact and /teachers: the
 * same site header as /welcome (brief move 4) plus a single 72ch prose
 * column on --bg-base. All three routes are gate-free (App.js mounts them
 * with no <WelcomeGate>, the same as /join), so WelcomeHeader gets no
 * `onSignIn` — its Sign in control falls back to a plain Link, mirroring how
 * JoinClassPage.js already handles the same ungated situation.
 *
 * `teachersHref="/teachers"` is passed explicitly even though it now equals
 * WelcomeHeader's own default (public-pages finish: the nav item routes to
 * the dedicated page everywhere) — kept explicit so this shell states its
 * own intent rather than depending on a default that could drift.
 *
 * The closing <footer> (consistency-audit fix) gives all three pages the
 * same "the page has an end" rhythm /welcome's own footer already has,
 * instead of stopping cold the instant the prose does — starkest on
 * /contact, whose three short paragraphs used to leave a bare, undesigned
 * void below them. Plain Links only, same reasoning as WelcomeHeader's own
 * Sign in above: these routes carry no go(), so a bare Link to "/" would
 * trip WelcomeGate and bounce straight back to /welcome.
 *
 * Task 13 (D§7): this footer is also where /privacy gets its one nav/footer
 * link, beside the account links every subpage already closes on — not
 * WelcomeHeader's own nav, whose three-item order (About, For teachers,
 * Contact) is locked verbatim by welcomeHeader.test.js and welcomePage.test.js,
 * neither of which this task touches. It carries `PrivacyIcon` (the same
 * glyph DataRequestsTab.js already pairs with its own privacy-flavoured
 * copy), the icon+label button shape already established for this design
 * system rather than a bare text link standing out from its two siblings.
 */
export default function WelcomeSubpage({ title, children }) {
  return (
    <div className="welcome-subpage">
      <WelcomeHeader teachersHref="/teachers" />
      <main className="welcome-subpage__body">
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="welcome-subpage__foot">
        <div className="welcome-foot__links">
          <Link className="btn btn--ghost" to="/privacy">
            <PrivacyIcon size={13} /> Privacy
          </Link>
          <Link className="btn btn--ghost" to="/auth/signup">Create an account</Link>
          <Link className="btn btn--ghost" to="/auth/signin">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
