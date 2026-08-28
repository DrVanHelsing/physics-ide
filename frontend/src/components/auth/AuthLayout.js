import React from "react";
import { Link } from "react-router-dom";
import ThemeToggleButton from "../layout/ThemeToggleButton";
import BackLink from "../layout/BackLink";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * Centered card used by every auth/profile screen. Keeps its own shape (a
 * different screen type from the portal's .page shell) but still carries the
 * theme toggle, top-right — spec §18 D9: an evaluating teacher should be
 * able to see both themes before ever creating an account.
 *
 * `back={{ to, label }}` mirrors it top-left, and is the same BackLink the
 * portal header renders (F2/N2, 2026-08-28: /profile was a dead end — a lone
 * theme toggle in an empty 1920px header and no in-app way out). The auth
 * screens themselves pass nothing: sign-in has its own footer links, and a
 * signed-out visitor has no portal destination to go back to.
 */
export default function AuthLayout({ title, children, footer, back }) {
  const { isDark, toggle } = useTheme();
  return (
    <div className="auth-page">
      {back ? (
        <div className="auth-page__back">
          <BackLink to={back.to} label={back.label} />
        </div>
      ) : null}
      <div className="auth-page__theme">
        <ThemeToggleButton isDark={isDark} onToggle={toggle} />
      </div>
      <div className="card card--panel card--lg auth-panel">
        <Link to="/" className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <h1 className="auth-heading">{title}</h1>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
