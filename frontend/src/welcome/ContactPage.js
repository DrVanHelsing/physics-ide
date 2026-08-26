import React from "react";
import WelcomeSubpage from "./WelcomeSubpage";

/**
 * ContactPage — /contact, gate-free. Exactly one contact channel, per the
 * polish brief: the school's own site admin or teacher, plus the public
 * repository link. No invented email address, form or support channel — the
 * user may supply a real one later, and this page must not get ahead of
 * that.
 */
export default function ContactPage() {
  return (
    <WelcomeSubpage title="Contact">
      <p>
        This installation is run by your school. Your teacher or site
        administrator is the right contact for anything about your account,
        your class, or this installation.
      </p>
      <p>
        Physics IDE itself is developed in the open, on GitHub:{" "}
        <a
          href="https://github.com/DrVanHelsing/physics-ide"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/DrVanHelsing/physics-ide
        </a>
        .
      </p>
    </WelcomeSubpage>
  );
}
