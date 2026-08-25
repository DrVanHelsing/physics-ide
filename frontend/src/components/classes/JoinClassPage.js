import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { normalizeClassCode, CLASS_CODE_REGEX } from "@physics-ide/shared";
import AuthLayout from "../auth/AuthLayout";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

export default function JoinClassPage() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();
  const [code, setCode] = useState(codeParam ? normalizeClassCode(codeParam) : "");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const autoJoined = useRef(false); // StrictMode double-invoke guard (Plan 2 ConfirmPage pattern)

  async function join(joinCode) {
    setError(null);
    try {
      const data = await api("/api/classes/join", { method: "POST", body: { code: joinCode } });
      setResult(data);
      if (data.status === "active") {
        setTimeout(() => navigate(`/classes/${data.classId}`), 900);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // Arriving via /join/CODE while signed in: submit automatically, exactly once.
  useEffect(() => {
    if (autoJoined.current) return;
    if (!isLoading && me && codeParam && CLASS_CODE_REGEX.test(normalizeClassCode(codeParam))) {
      autoJoined.current = true;
      join(normalizeClassCode(codeParam));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (isLoading) return null;
  if (!me) {
    return (
      <AuthLayout
        title="Join a class"
        footer={
          <>
            <Link to="/auth/signin">Sign in</Link> or <Link to="/auth/signup">create an account</Link>{" "}
            first — then come back to this link.
          </>
        }
      >
        <p className="auth-text">You need an account to join a class.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Join a class" footer={<Link to="/classes">My classes</Link>}>
      {/* Always mounted (visually hidden until there is a result) — a status
          region that arrives already carrying its text is not reliably
          announced. This one exists from first render, so by the time the
          900ms redirect below fires, a screen reader has already had the
          region "in view" for as long as the message has been true. */}
      <p
        className={result ? "auth-text" : "auth-text sr-only"}
        role="status"
        aria-live="polite"
      >
        {result
          ? result.status === "active"
            ? `You're in ${result.className}! Taking you there…`
            : `Request sent — ${result.className}'s teacher will approve you.`
          : ""}
      </p>
      {result ? null : (
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            join(normalizeClassCode(code));
          }}
        >
          <label className="auth-label">
            Class code
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="KQ4-7PM"
              autoFocus
            />
          </label>
          {error ? (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          ) : null}
          <button
            className="btn btn--primary btn--lg btn--block"
            type="submit"
            disabled={!CLASS_CODE_REGEX.test(normalizeClassCode(code))}
          >
            Join
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
