import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMe, useSignout } from "../../auth/useAuth";

/** Small account block for the StartMenu sidebar. Guests see the doors; members see themselves. */
export default function AccountChip() {
  const { data: me, isLoading } = useMe();
  const signout = useSignout();
  const navigate = useNavigate();

  if (isLoading) return null;

  if (!me) {
    return (
      <div className="account-chip">
        <div className="account-chip-head">ACCOUNT</div>
        <Link className="account-chip-btn" to="/auth/signin">
          Sign in
        </Link>
        <Link className="account-chip-btn account-chip-btn--primary" to="/auth/signup">
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="account-chip">
      <div className="account-chip-head">ACCOUNT</div>
      <div className="account-chip-name" title={me.email}>
        {me.name}
        {!me.emailConfirmed ? <span className="account-chip-badge">unconfirmed</span> : null}
      </div>
      <Link className="account-chip-btn" to="/classes">
        My classes
      </Link>
      <Link className="account-chip-btn" to="/profile">
        Profile
      </Link>
      {me.role === "admin" ? (
        <Link className="account-chip-btn" to="/admin">
          Admin console
        </Link>
      ) : null}
      <button
        className="account-chip-btn"
        type="button"
        onClick={async () => {
          await signout.mutateAsync();
          navigate("/");
        }}
      >
        Sign out
      </button>
    </div>
  );
}
