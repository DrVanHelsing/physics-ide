import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/auth/forgot", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      setSent(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout title="Reset your password" footer={<Link to="/auth/signin">Back to sign in</Link>}>
      {sent ? (
        <p className="auth-text">
          If that address has an account, a reset link is on its way. The link works once and
          expires in 60 minutes.
        </p>
      ) : (
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          {error ? <div className="auth-error">{error}</div> : null}
          <button className="auth-submit" type="submit">
            Email me a reset link
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
