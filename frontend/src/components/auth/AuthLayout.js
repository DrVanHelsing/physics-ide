import React from "react";
import { Link } from "react-router-dom";
import ThemeToggleButton from "../layout/ThemeToggleButton";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * Centered card used by every auth/profile screen. Keeps its own shape (a
 * different screen type from the portal's .page shell) but still carries the
 * theme toggle, top-right — spec §18 D9: an evaluating teacher should be
 * able to see both themes before ever creating an account.
 */
export default function AuthLayout({ title, children, footer }) {
  const { isDark, toggle } = useTheme();
  return (
    <div className="auth-page">
      <div className="auth-page__theme">
        <ThemeToggleButton isDark={isDark} onToggle={toggle} />
      </div>
      <div className="auth-card">
        <Link to="/" className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <h1 className="auth-title">{title}</h1>
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
