import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { SWITCHABLE_EMAIL_KEYS } from "@physics-ide/shared";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";
import { useMe, ME_KEY } from "../../auth/useAuth";

// PREF_LABELS keys the shared array — SWITCHABLE_EMAIL_KEYS stays the ONE
// source of the key set (decorator, auth route, this UI); only the labels
// live here.
const PREF_LABELS = {
  "submission-receipt": "Submission receipts",
  "marks-released": "Marks released",
  "work-returned": "Work returned for changes",
  "due-tomorrow": "Due-tomorrow reminders",
  "due-reminder": "Reminders from your teacher",
};

export default function ProfilePage() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const [name, setName] = useState(null); // null until user edits
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [prefs, setPrefs] = useState(null); // null until user edits — mirrors `name` above
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;

  // `prefs` seeds from me.notificationPrefs on every render until the user
  // edits a switch, same fallback shape as `name ?? me.name` above — a plain
  // lazy useState initializer would freeze at whatever `me` was on the
  // component's first mount (possibly still loading), never re-seeding once
  // the real data lands. The `?? {}` guards the cache window right after
  // sign-in, whose response isn't one of this task's two resolved
  // endpoints — an absent key still reads as ON below, same as the server
  // convention for an absent row.
  const currentPrefs = prefs ?? me.notificationPrefs ?? {};

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

  async function savePrefs(e) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setSavingPrefs(true);
    try {
      const data = await api("/api/auth/me", {
        method: "PATCH",
        body: { notificationPrefs: currentPrefs },
      });
      qc.setQueryData(ME_KEY, data.user);
      setMsg("Notification settings saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <AuthLayout
      title="Profile & settings"
      back={{ to: "/classes", label: "Back to my classes" }}
    >
      <p className="auth-text">
        {me.email}
        <span className="badge badge--accent">
          {me.role === "admin" ? "site admin" : me.isTeacher ? "teacher" : "student"}
        </span>
        {!me.emailConfirmed ? <span className="badge badge--warning">unconfirmed</span> : null}
      </p>
      <form className="auth-form" onSubmit={saveName}>
        <label className="auth-label">
          Name
          <input
            className="input"
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
            className="input"
            type="password"
            value={pw.currentPassword}
            onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
            autoComplete="current-password"
          />
        </label>
        <label className="auth-label">
          New password
          <input
            className="input"
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
      <h2 className="section-title">Notifications</h2>
      <form className="auth-form" onSubmit={savePrefs}>
        {SWITCHABLE_EMAIL_KEYS.map((key) => [key, PREF_LABELS[key]]).map(([key, label]) => (
          <label key={key} className="pref-row">
            <input
              type="checkbox"
              checked={currentPrefs[key] ?? true}
              onChange={(e) => setPrefs({ ...currentPrefs, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <p className="auth-hint">These switch the emails off. The bell in the header always shows everything.</p>
        <button className="btn" type="submit" disabled={savingPrefs}>
          Save notification settings
        </button>
      </form>
      {msg ? (
        <p className="auth-text" style={{ marginTop: 12 }} role="status" aria-live="polite">
          {msg}
        </p>
      ) : null}
      {error ? <div className="alert alert--danger" style={{ marginTop: 12 }}>{error}</div> : null}
    </AuthLayout>
  );
}
