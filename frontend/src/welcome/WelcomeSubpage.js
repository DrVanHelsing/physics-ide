import React from "react";
import WelcomeHeader from "./WelcomeHeader";

/**
 * WelcomeSubpage — the shared shell for /about and /contact: the same site
 * header as /welcome (brief move 4) plus a single 72ch prose column on
 * --bg-base. Both routes are gate-free (App.js mounts them with no
 * <WelcomeGate>, the same as /join), so WelcomeHeader gets no `onSignIn` —
 * its Sign in control falls back to a plain Link, mirroring how
 * JoinClassPage.js already handles the same ungated situation.
 */
export default function WelcomeSubpage({ title, children }) {
  return (
    <div className="welcome-subpage">
      <WelcomeHeader teachersHref="/welcome#s-class" />
      <main className="welcome-subpage__body">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
