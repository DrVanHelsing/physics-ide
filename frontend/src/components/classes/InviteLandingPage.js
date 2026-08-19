import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../auth/AuthLayout";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

export const PENDING_INVITE_KEY = "pide_pending_invite";

/**
 * /join/invite?token=... — the emailed button lands here.
 * Signed out: stash the token and route through signup/signin; this page
 * re-reads the stash when the user returns signed in.
 */
export default function InviteLandingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();
  const [state, setState] = useState("working"); // working | done | failed
  const [message, setMessage] = useState("");
  const posted = useRef(false);
  const token = params.get("token") || sessionStorage.getItem(PENDING_INVITE_KEY) || "";

  useEffect(() => {
    if (isLoading) return;
    if (!me) {
      if (token) sessionStorage.setItem(PENDING_INVITE_KEY, token);
      return;
    }
    if (posted.current || !token) return;
    posted.current = true;
    (async () => {
      try {
        const data = await api("/api/invites/accept", { method: "POST", body: { token } });
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setState("done");
        setMessage(`You're in ${data.className}!`);
        setTimeout(() => navigate(`/classes/${data.classId}`), 900);
      } catch (err) {
        setState("failed");
        setMessage(err.message);
      }
    })();
  }, [isLoading, me, token, navigate]);

  if (isLoading) return null;
  if (!me) {
    return (
      <AuthLayout
        title="You're invited"
        footer={
          <>
            <Link to="/auth/signup">Create an account</Link> or <Link to="/auth/signin">sign in</Link>
          </>
        }
      >
        <p className="auth-text">
          Create an account (or sign in) and you'll land in the class automatically — this
          invitation waits for you.
        </p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="You're invited" footer={<Link to="/classes">My classes</Link>}>
      {state === "working" ? <p className="auth-text">One moment…</p> : null}
      {state === "done" ? <p className="auth-text">{message}</p> : null}
      {state === "failed" ? <div className="auth-error">{message}</div> : null}
    </AuthLayout>
  );
}
