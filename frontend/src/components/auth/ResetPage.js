import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PASSWORD_MIN_LENGTH } from "@physics-ide/shared";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";

export default function ResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const token = params.get("token") || "";

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Passwords need at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    try {
      await api("/api/auth/reset", { method: "POST", body: { token, password } });
      navigate("/auth/signin");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout title="Choose a new password" footer={<Link to="/auth/signin">Back to sign in</Link>}>
      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-label">
          New password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error ? <div className="alert alert--danger">{error}</div> : null}
        <button className="btn btn--primary btn--lg btn--block" type="submit">
          Set password
        </button>
      </form>
    </AuthLayout>
  );
}
