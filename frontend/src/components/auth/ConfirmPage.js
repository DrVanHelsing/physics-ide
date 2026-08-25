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
    if (posted.current) return;
    posted.current = true;
    (async () => {
      try {
        await api("/api/auth/confirm", { method: "POST", body: { token } });
        setState("done");
      } catch (err) {
        setState("failed");
        setMessage(err.message);
      }
    })();
  }, [token]);

  return (
    <AuthLayout title="Confirming your address" footer={<Link to="/auth/signin">Sign in</Link>}>
      {state === "working" ? <p className="auth-text">One moment…</p> : null}
      {state === "done" ? (
        <p className="auth-text">Your email address is confirmed. You can sign in now.</p>
      ) : null}
      {state === "failed" ? <div className="alert alert--danger" role="alert">{message}</div> : null}
    </AuthLayout>
  );
}
