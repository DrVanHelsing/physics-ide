import React, { useEffect, useState } from "react";
import { useMe } from "../auth/useAuth";
import { getGlobalSyncEngine } from "../utils/sync/syncEngine";

const LABELS = {
  idle: "Synced",
  synced: "Synced",
  syncing: "Syncing…",
  offline: "Waiting for connection",
  error: "Sync error",
};

export default function SyncChip() {
  const { data: me } = useMe();
  const [state, setState] = useState("idle");

  useEffect(() => {
    if (!me) return undefined;
    let unsub = () => {};
    let disposed = false;
    (async () => {
      const engine = await getGlobalSyncEngine();
      if (disposed) return;
      setState(engine.getStatus().state);
      unsub = engine.subscribe((s) => setState(s.state));
    })();
    return () => {
      disposed = true;
      unsub();
    };
  }, [me]);

  if (!me) return null;
  return (
    <span className={`sync-chip sync-chip--${state}`} title="Your work saves locally first and syncs to your account.">
      Saved on this computer · {LABELS[state] ?? "Synced"}
    </span>
  );
}
