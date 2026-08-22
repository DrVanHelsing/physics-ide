import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { useSignin } from "../../auth/useAuth";

export default function SignInPage() {
  const navigate = useNavigate();
  const signin = useSignin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      await signin.mutateAsync({ email: email.trim().toLowerCase(), password });
      navigate(sessionStorage.getItem("pide_pending_invite") ? "/join/invite" : "/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      footer={
        <>
          New here? <Link to="/auth/signup">Create an account</Link> ·{" "}
          <Link to="/auth/forgot">Forgot password?</Link>
        </>
      }
    >
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
        <label className="auth-label">
          Password
          <input
            className="auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="auth-error">{error}</div> : null}
        <button
          className="btn btn--primary btn--lg btn--block"
          type="submit"
          disabled={signin.isPending}
        >
          {signin.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
