import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";
import { useMe, ME_KEY } from "../../auth/useAuth";

export default function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState(null); // null until user edits
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;

  async function saveName(e) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const data = await api("/api/auth/me", { method: "PATCH", body: { name } });
      qc.setQueryData(ME_KEY, data.user);
      setMsg("Name updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      await api("/api/auth/change-password", { method: "POST", body: pw });
      setPw({ currentPassword: "", newPassword: "" });
      setMsg("Password changed. Other devices were signed out.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout title="Profile & settings">
      <p className="auth-text">
        {me.email} · {me.role === "admin" ? "site admin" : me.isTeacher ? "teacher" : "student"}
        {!me.emailConfirmed ? " · email not yet confirmed" : ""}
      </p>
      <form className="auth-form" onSubmit={saveName}>
        <label className="auth-label">
          Name
          <input
            className="auth-input"
            value={name ?? me.name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          className="btn btn--primary btn--lg btn--block"
          type="submit"
          disabled={name === null || name === me.name}
        >
          Save name
        </button>
      </form>
      <form className="auth-form" style={{ marginTop: 18 }} onSubmit={changePassword}>
        <label className="auth-label">
          Current password
          <input
            className="auth-input"
            type="password"
            value={pw.currentPassword}
            onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
            autoComplete="current-password"
          />
        </label>
        <label className="auth-label">
          New password
          <input
            className="auth-input"
            type="password"
            value={pw.newPassword}
            onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
            autoComplete="new-password"
          />
        </label>
        <button className="btn btn--primary btn--lg btn--block" type="submit">
          Change password
        </button>
      </form>
      {msg ? <p className="auth-text" style={{ marginTop: 12 }}>{msg}</p> : null}
      {error ? <div className="auth-error" style={{ marginTop: 12 }}>{error}</div> : null}
    </AuthLayout>
  );
}
