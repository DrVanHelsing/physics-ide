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
        <div className="account-chip-head">Account</div>
        <Link className="nav-row" to="/auth/signin">
          Sign in
        </Link>
        <Link className="nav-row nav-row--primary" to="/auth/signup">
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="account-chip">
      <div className="account-chip-head">Account</div>
      <div className="account-chip-name" title={me.email}>
        {me.name}
        {!me.emailConfirmed ? <span className="account-chip-badge">unconfirmed</span> : null}
      </div>
      <Link className="nav-row" to="/classes">
        My classes
      </Link>
      <Link className="nav-row" to="/profile">
        Profile
      </Link>
      {me.role === "admin" ? (
        <Link className="nav-row" to="/admin">
          Admin console
        </Link>
      ) : null}
      <button
        className="nav-row"
        type="button"
        disabled={signout.isPending}
        onClick={() => {
          // Sign-out now flushes pending sync first (bounded), so it can take a
          // moment — show that, and never leave a rejected mutation silent.
          signout
            .mutateAsync()
            .then(() => navigate("/"))
            .catch((err) => {
              console.warn("sign-out failed; you are still signed in", err);
            });
        }}
      >
        {signout.isPending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
