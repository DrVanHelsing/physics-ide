import React from "react";

/**
 * Spec §3.2 — mounted for the lifetime of the app by SyncProvider (see its
 * render), regardless of whether there is anything to show. Only the
 * children come and go with `open`: a `role="status"` node that is itself
 * inserted fresh at the same moment it gains its text is not reliably
 * announced (the same bug fixed for JoinClassPage/InviteLandingPage's status
 * paragraph and PeopleTab's "Copied!" badge) — keeping this node permanent
 * and swapping only what is inside it is the fix. `.guest-import:empty` in
 * platform.css zeroes the fixed-position box's border/padding/shadow while
 * `open` is false, so an always-mounted-but-contentless prompt renders as
 * nothing, not an empty floating chip, and carries no focusable buttons to
 * trip over when there is nothing to accept or decline.
 */
export default function GuestImportPrompt({ open, count, onAccept, onDecline, busy }) {
  return (
    <div className="guest-import" role="status" aria-live="polite">
      {open ? (
        <>
          <span>
            Bring your {count} guest project{count === 1 ? "" : "s"} into your new account?
          </span>
          <button className="btn btn--primary" type="button" onClick={onAccept} disabled={busy}>
            {busy ? "Bringing them in…" : "Bring them in"}
          </button>
          <button className="btn" type="button" onClick={onDecline} disabled={busy}>
            Not now
          </button>
        </>
      ) : null}
    </div>
  );
}
