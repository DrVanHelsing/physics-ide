import React, { useEffect, useState } from "react";
import { useMe } from "../auth/useAuth";
import { getGlobalSyncEngine } from "../utils/sync/syncEngine";
import { CheckIcon, RefreshIcon, ZapOffIcon, AlertTriangleIcon } from "../components/Icons";

const LABELS = {
  idle: "Synced",
  synced: "Synced",
  syncing: "Syncing…",
  offline: "Waiting for connection",
  error: "Sync error",
};

/* Colour is never the only channel (D13) — each state also carries a glyph
   that agrees with its word, so the chip reads the same in greyscale. */
const ICONS = {
  idle: CheckIcon,
  synced: CheckIcon,
  syncing: RefreshIcon,
  offline: ZapOffIcon,
  error: AlertTriangleIcon,
};

const DEFAULT_TITLE = "Your work saves locally first and syncs to your account.";

export default function SyncChip() {
  const { data: me } = useMe();
  const [state, setState] = useState("idle");
  /* The server's own sentence for the last failure (cap, oversize, invalid
     shape) — carried through verbatim, never paraphrased. */
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    if (!me) return undefined;
    let unsub = () => {};
    let disposed = false;
    (async () => {
      const engine = await getGlobalSyncEngine();
      if (disposed) return;
      const s0 = engine.getStatus();
      setState(s0.state);
      setLastError(s0.lastError ?? null);
      unsub = engine.subscribe((s) => {
        setState(s.state);
        setLastError(s.lastError ?? null);
      });
    })().catch(() => {
      // No engine, no status to show — the chip keeps its last known state.
    });
    return () => {
      disposed = true;
      unsub();
    };
  }, [me]);

  if (!me) return null;
  const Icon = ICONS[state] ?? CheckIcon;
  return (
    <span className={`sync-chip sync-chip--${state}`} title={lastError || DEFAULT_TITLE}>
      <Icon size={12} />
      Saved on this computer · {LABELS[state] ?? "Synced"}
    </span>
  );
}
