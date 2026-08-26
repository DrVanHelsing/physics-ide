import React from "react";
import { Link } from "react-router-dom";
import ThemeToggleButton from "../components/layout/ThemeToggleButton";
import DropdownMenu from "../components/common/DropdownMenu";
import { useTheme } from "../contexts/ThemeContext";
import { MenuIcon } from "../components/Icons";

/**
 * WelcomeHeader — the slim site header (polish brief move 4): mounted on
 * /welcome and reused, unchanged, on /about and /contact. Same zone idiom as
 * the one portal header (components/layout/PortalHeader.js) — identity, then
 * navigation, then a right cluster carrying the theme toggle — but not that
 * component itself: PortalHeader's right cluster is account-aware
 * (HeaderAccount) and built for the signed-in portal; this bar is what a
 * visitor who has never created an account sees, on three gate-adjacent
 * routes, with a fixed public link set instead of a caller-supplied nav slot.
 *
 * `onSignIn`, when given, renders Sign in as a button calling it — /welcome
 * passes `() => go("/auth/signin")` so the click still stamps the session
 * pass through go() like every other call to action on that page (hard
 * constraint 2 in WelcomePage.js's header comment). /about and /contact sit
 * outside the gate entirely (App.js mounts them with no <WelcomeGate>, the
 * same as /join), so they render no `onSignIn` and get a plain Link, the
 * same shape JoinClassPage.js already uses for its own sign-in link.
 *
 * `teachersHref` points "For teachers" at the front page's §12 anchor. On
 * /welcome itself that is the in-page "#s-class"; from /about or /contact it
 * is "/welcome#s-class" — a real navigation, not an anchor that resolves to
 * nothing on the current page.
 */
export default function WelcomeHeader({ onSignIn, teachersHref = "#s-class" }) {
  const { isDark, toggle } = useTheme();
  const isAnchor = teachersHref.startsWith("#");

  const navLinks = (
    <>
      <Link to="/about">About</Link>
      {isAnchor ? (
        <a href={teachersHref}>For teachers</a>
      ) : (
        <Link to={teachersHref}>For teachers</Link>
      )}
      <Link to="/contact">Contact</Link>
    </>
  );

  const signIn = onSignIn ? (
    <button type="button" className="welcome-linklike" onClick={onSignIn}>
      Sign in
    </button>
  ) : (
    <Link to="/auth/signin">Sign in</Link>
  );

  const menuSignIn = onSignIn ? (
    <button type="button" className="tb-dropdown-item" onClick={onSignIn}>
      <span>Sign in</span>
    </button>
  ) : (
    <Link className="tb-dropdown-item" to="/auth/signin">
      <span>Sign in</span>
    </Link>
  );

  return (
    // role="banner" set explicitly: on /welcome this <header> is a
    // descendant of <main> (WelcomePage.js's long-standing single-<main>
    // shape) so the implicit HTML-ARIA mapping would suppress the banner
    // role there while granting it on /about and /contact (WelcomeSubpage.js
    // renders it as <main>'s sibling) — the same component landing two
    // different landmark roles depending on which page mounts it. Setting
    // the role explicitly makes it consistent everywhere, regardless of
    // ancestry.
    <header className="welcome-header" role="banner">
      <div className="welcome-header__bar">
        <Link to="/welcome" className="auth-brand welcome-header__brand">
          Physics<span>IDE</span>
        </Link>
        <nav className="welcome-header__nav" aria-label="Site">
          {navLinks}
        </nav>
        <div className="welcome-header__spacer" />
        <div className="welcome-header__cluster">
          <ThemeToggleButton isDark={isDark} onToggle={toggle} />
          <span className="welcome-header__signin">{signIn}</span>
        </div>
        <div className="welcome-header__menu">
          <DropdownMenu
            align="right"
            chevron={false}
            trigger={<MenuIcon size={16} />}
            triggerAriaLabel="Site menu"
            triggerClassName="tb-btn tb-btn--icon"
          >
            <Link className="tb-dropdown-item" to="/about">
              <span>About</span>
            </Link>
            {isAnchor ? (
              <a className="tb-dropdown-item" href={teachersHref}>
                <span>For teachers</span>
              </a>
            ) : (
              <Link className="tb-dropdown-item" to={teachersHref}>
                <span>For teachers</span>
              </Link>
            )}
            <Link className="tb-dropdown-item" to="/contact">
              <span>Contact</span>
            </Link>
            <div className="tb-dropdown-divider" />
            {menuSignIn}
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
