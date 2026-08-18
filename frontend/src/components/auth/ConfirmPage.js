import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { api } from "../../utils/api/client";

export default function ConfirmPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState("working"); // working | done | failed
  const [message, setMessage] = useState("");
  const token = params.get("token") || "";
  const posted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (posted.current) return;
      posted.current = true;
      try {
        await api("/api/auth/confirm", { method: "POST", body: { token } });
        if (!cancelled) setState("done");
      } catch (err) {
        if (!cancelled) {
          setState("failed");
          setMessage(err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthLayout title="Confirming your address" footer={<Link to="/auth/signin">Sign in</Link>}>
      {state === "working" ? <p className="auth-text">One moment…</p> : null}
      {state === "done" ? (
        <p className="auth-text">Your email address is confirmed. You can sign in now.</p>
      ) : null}
      {state === "failed" ? <div className="auth-error">{message}</div> : null}
    </AuthLayout>
  );
}
