import React from "react";
import WelcomeSubpage from "./WelcomeSubpage";

/**
 * ContactPage — /contact, gate-free. Exactly one contact channel, per the
 * polish brief: the school's own site admin or teacher, plus the public
 * repository link. No invented email address, form or support channel — the
 * user may supply a real one later, and this page must not get ahead of
 * that.
 *
 * Public-pages finish: gained section headings (matching About's and
 * Teachers' heading rhythm) and a "Found a problem?" line pointing at the
 * repository's issues page — still no invented channel, just the existing
 * GitHub link's own issue tracker. The two locked sentences below
 * (school-admin, GitHub link) are unchanged byte-for-byte from before this
 * pass; welcomeSubpages.test.js pins both.
 */
export default function ContactPage() {
  return (
    <WelcomeSubpage title="Contact">
      <p>
        This installation is run by your school. Your teacher or site
        administrator is the right contact for anything about your account,
        your class, or this installation.
      </p>

      <h2>The project</h2>
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

      <h2>Found a problem?</h2>
      <p>
        If something in Physics IDE itself is broken &mdash; not your
        account or your class, the software &mdash; open an issue on the
        repository&rsquo;s tracker:{" "}
        <a
          href="https://github.com/DrVanHelsing/physics-ide/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/DrVanHelsing/physics-ide/issues
        </a>
        .
      </p>
    </WelcomeSubpage>
  );
}
