import React from "react";
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";

export default function CheckEmailPage() {
  return (
    <AuthLayout title="Check your email" footer={<Link to="/auth/signin">Go to sign in</Link>}>
      <p className="auth-text">
        We sent you a confirmation link. Open it to prove the address is yours — until then you can
        look around, but you can't join a class or submit work.
      </p>
      <p className="auth-text auth-text--dim">
        While the site runs locally, "sent" emails appear in the admin console's pretend inbox.
      </p>
    </AuthLayout>
  );
}
