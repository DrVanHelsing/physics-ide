import React from "react";
import { Link } from "react-router-dom";
import ThemeToggleButton from "../components/layout/ThemeToggleButton";
import DropdownMenu from "../components/common/DropdownMenu";
import { useTheme } from "../contexts/ThemeContext";
import { MenuIcon } from "../components/Icons";

/**
 * WelcomeHeader — the slim site header (polish brief move 4): mounted on
 * /welcome and reused, unchanged, on /about, /contact and (public-pages
 * finish) /teachers. Same zone idiom as the one portal header
 * (components/layout/PortalHeader.js) — identity, then navigation, then a
 * right cluster carrying the theme toggle — but not that component itself:
 * PortalHeader's right cluster is account-aware (HeaderAccount) and built
 * for the signed-in portal; this bar is what a visitor who has never
 * created an account sees, on four gate-adjacent routes, with a fixed
 * public link set instead of a caller-supplied nav slot.
 *
 * `onSignIn`, when given, renders Sign in as a button calling it — /welcome
 * passes `() => go("/auth/signin")` so the click still stamps the session
 * pass through go() like every other call to action on that page (hard
 * constraint 2 in WelcomePage.js's header comment). /about, /contact and
 * /teachers sit outside the gate entirely (App.js mounts them with no
 * <WelcomeGate>, the same as /join), so they render no `onSignIn` and get a
 * plain Link, the same shape JoinClassPage.js already uses for its own
 * sign-in link.
 *
 * `teachersHref` points "For teachers" at the dedicated /teachers page —
 * every caller gets the same route by default now (public-pages finish:
 * the nav item is a real navigation everywhere, including on /welcome
 * itself, where it used to jump to the in-page "#s-class" section instead).
 * The prop still exists so a caller can override it, but nothing currently
 * does; the anchor branch this component used to carry for that case is
 * gone with it — WelcomePage.js's own #s-class section is untouched, it is
 * simply no longer where the header's nav link points.
 *
 * v2 (redesign brief): this bar is now also the sticky nav that sits at the
 * hero's bottom edge and pins to the top of the screen on scroll — pure CSS
 * (welcome.css: `position: sticky; top: 0`), no JS, no separate component.
 * `onOpenIde`, when given, adds the wireframe's trailing "[Open the IDE]"
 * primary door to both the persistent cluster and the collapse menu — only
 * WelcomePage.js passes it; /about, /contact and /teachers stay a plain
 * header with no fourth cluster item, unchanged from tranche 2.5.
 */
export default function WelcomeHeader({ onSignIn, onOpenIde, teachersHref = "/teachers" }) {
  const { isDark, toggle } = useTheme();

  const navLinks = (
    <>
      <Link to="/about">About</Link>
      <Link to={teachersHref}>For teachers</Link>
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
          {onOpenIde && (
            <button type="button" className="btn btn--primary btn--sm" onClick={onOpenIde}>
              Open the IDE
            </button>
          )}
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
            <Link className="tb-dropdown-item" to={teachersHref}>
              <span>For teachers</span>
            </Link>
            <Link className="tb-dropdown-item" to="/contact">
              <span>Contact</span>
            </Link>
            <div className="tb-dropdown-divider" />
            {menuSignIn}
            {onOpenIde && (
              <button type="button" className="tb-dropdown-item" onClick={onOpenIde}>
                <span>Open the IDE</span>
              </button>
            )}
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
