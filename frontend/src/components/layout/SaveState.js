import React from "react";
import { useMe } from "../../auth/useAuth";
import SyncChip from "../../sync/SyncChip";
import { relativeTime } from "../../utils/relativeTime";

/**
 * Save state for the status bar.
 *
 * Signed in: SyncChip owns the sentence (spec §6.3 copy, verbatim).
 * Guest: the same reassurance without any network claim — a student editing
 * for 40 minutes currently gets zero confirmation that anything is saved.
 */
export default function SaveState({ updatedAt }) {
  const { data: me } = useMe();
  if (me) return <SyncChip />;
  const when = relativeTime(updatedAt);
  if (!when) return null;
  return (
    <span className="sync-chip" title="Your work is stored in this browser on this computer.">
      Saved on this computer · {when}
    </span>
  );
}
