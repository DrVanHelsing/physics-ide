import React from "react";
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
 */
export default function WelcomeSubpage({ title, children }) {
  return (
    <div className="welcome-subpage">
      <WelcomeHeader teachersHref="/teachers" />
      <main className="welcome-subpage__body">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
