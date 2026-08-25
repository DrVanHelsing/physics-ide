import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SignupInputSchema, PASSWORD_MIN_LENGTH } from "@physics-ide/shared";
import AuthLayout from "./AuthLayout";
import { useSignup } from "../../auth/useAuth";

export default function SignUpPage() {
  const navigate = useNavigate();
  const signup = useSignup();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    wantsTeacher: false,
    consent: false,
  });
  const [error, setError] = useState(null);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const parsed = SignupInputSchema.safeParse(form);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue.path[0] === "consent"
          ? "Please tick the consent box to continue."
          : issue.path[0] === "password"
            ? `Passwords need at least ${PASSWORD_MIN_LENGTH} characters.`
            : "Please check your name and email address.",
      );
      return;
    }
    try {
      await signup.mutateAsync(parsed.data);
      navigate("/auth/check-email");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      footer={
        <>
          Already have an account? <Link to="/auth/signin">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="auth-doors" role="radiogroup" aria-label="Account type">
          <label className={form.wantsTeacher ? "auth-door" : "auth-door auth-door--on"}>
            <input
              type="radio"
              name="door"
              checked={!form.wantsTeacher}
              onChange={() => setForm((f) => ({ ...f, wantsTeacher: false }))}
            />
            I'm a student
          </label>
          <label className={form.wantsTeacher ? "auth-door auth-door--on" : "auth-door"}>
            <input
              type="radio"
              name="door"
              checked={form.wantsTeacher}
              onChange={() => setForm((f) => ({ ...f, wantsTeacher: true }))}
            />
            I'm a teacher
          </label>
        </div>
        <label className="auth-label">
          Name
          <input className="input" value={form.name} onChange={set("name")} autoComplete="name" />
        </label>
        <label className="auth-label">
          Email
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
          />
        </label>
        <label className="auth-label">
          Password
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
        </label>
        <label className="auth-consent">
          <input type="checkbox" checked={form.consent} onChange={set("consent")} />
          <span>
            I agree that my name, email address and school work are stored so this site can run.
          </span>
        </label>
        {error ? <div className="alert alert--danger">{error}</div> : null}
        <button
          className="btn btn--primary btn--lg btn--block"
          type="submit"
          disabled={signup.isPending}
        >
          {signup.isPending ? "Creating…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
