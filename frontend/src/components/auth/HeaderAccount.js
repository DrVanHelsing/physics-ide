import React from "react";
import { useNavigate } from "react-router-dom";
import DropdownMenu from "../common/DropdownMenu";
import { UserIcon } from "../Icons";
import { useMe, useSignout } from "../../auth/useAuth";

/**
 * Header account control. The sidebar's <AccountChip> is a stacked block of
 * links built for StartMenu.js:308 — it cannot live in a 44px bar, so this is
 * the compact form. Same destinations, same guest/member split.
 */
export default function HeaderAccount() {
  const { data: me, isLoading } = useMe();
  const signout = useSignout();
  const navigate = useNavigate();

  if (isLoading) return null;

  const label = me ? me.name : "Guest";
  return (
    <DropdownMenu
      align="right"
      title={me ? `Signed in as ${me.email}` : "You are working as a guest"}
      triggerClassName="tb-btn tb-btn--account"
      trigger={
        <>
          <UserIcon size={13} />
          <span className="tb-btn-label">{label}</span>
          {me && !me.emailConfirmed ? <span className="badge badge--warning">unconfirmed</span> : null}
        </>
      }
    >
      {me ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/classes")}>
          <span>My classes</span>
        </button>
      ) : null}
      {me ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/profile")}>
          <span>Profile</span>
        </button>
      ) : null}
      {me && me.role === "admin" ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/admin")}>
          <span>Admin console</span>
        </button>
      ) : null}
      {me ? (
        <button
          type="button"
          className="tb-dropdown-item"
          disabled={signout.isPending}
          onClick={() => {
            signout
              .mutateAsync()
              .then(() => navigate("/"))
              .catch((err) => console.warn("sign-out failed; you are still signed in", err));
          }}
        >
          <span>{signout.isPending ? "Signing out…" : "Sign out"}</span>
        </button>
      ) : null}
      {!me ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/auth/signin")}>
          <span>Sign in</span>
        </button>
      ) : null}
      {!me ? (
        <button type="button" className="tb-dropdown-item" onClick={() => navigate("/auth/signup")}>
          <span>Create account</span>
        </button>
      ) : null}
    </DropdownMenu>
  );
}
