import React from "react";
import { Link } from "react-router-dom";

/** Centered card used by every auth/profile screen. */
export default function AuthLayout({ title, children, footer }) {
  return (
    <div className="auth-page">
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
