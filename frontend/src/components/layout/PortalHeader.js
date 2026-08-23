import React from "react";
import { Link } from "react-router-dom";
import ThemeToggleButton from "./ThemeToggleButton";
import HeaderAccount from "../auth/HeaderAccount";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * The one portal header. Same zone idiom as the IDE's app-header (chrome.css)
 * so a portal screen and an IDE screen read as one product: identity, then
 * whatever the screen navigates by, then a right cluster carrying the theme
 * toggle and the account control (spec §18 D9 — before this, light mode was
 * unreachable outside the IDE on /classes, /admin and every /auth/* screen).
 *
 * `title` renders as the screen's H1 below the bar when given; `nav` is the
 * screen's own tab row, rendered as-is (ARIA tablist for Admin, plain
 * aria-current Links for a class page). Both optional: /classes has a title
 * and no nav, a class page has both.
 */
export default function PortalHeader({ title, nav, home = "/" }) {
  const { isDark, toggle } = useTheme();
  return (
    <header className="page-header">
      <div className="page-header__bar">
        <Link to={home} className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <div className="page-header__spacer" />
        <ThemeToggleButton isDark={isDark} onToggle={toggle} />
        <HeaderAccount />
      </div>
      {title ? <h1 className="page-header__title">{title}</h1> : null}
      {nav}
    </header>
  );
}
