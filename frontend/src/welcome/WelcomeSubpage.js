import React from "react";
import { Link } from "react-router-dom";
import WelcomeHeader from "./WelcomeHeader";

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
          <Link className="btn btn--ghost" to="/auth/signup">Create an account</Link>
          <Link className="btn btn--ghost" to="/auth/signin">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
