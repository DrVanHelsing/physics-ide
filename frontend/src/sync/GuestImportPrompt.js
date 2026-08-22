import React from "react";

/** Spec §3.2 — shown by SyncProvider when unadopted guest projects exist. */
export default function GuestImportPrompt({ count, onAccept, onDecline, busy }) {
  return (
    <div className="guest-import">
      <span>
        Bring your {count} guest project{count === 1 ? "" : "s"} into your new account?
      </span>
      <button className="btn btn--primary" type="button" onClick={onAccept} disabled={busy}>
        {busy ? "Bringing them in…" : "Bring them in"}
      </button>
      <button className="btn" type="button" onClick={onDecline} disabled={busy}>
        Not now
      </button>
    </div>
  );
}
