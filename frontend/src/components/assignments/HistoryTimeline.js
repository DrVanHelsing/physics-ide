import React from "react";
import { relativeTime } from "../../utils/relativeTime";
import { HistoryIcon, UploadIcon } from "../Icons";

/**
 * HistoryTimeline.js — the History screen's one renderer, two feeders
 * (Plan 4's deferral, design D§6 naming): the screen is "History", one
 * entry is a "checkpoint". The student page (own project, Restore wired)
 * and the teacher's marking-room Timeline panel (a cross-user read,
 * Restore disabled) both hand this component the SAME entry shape —
 * built by buildTimelineEntries below — and it renders whichever fields
 * are present without knowing which feeder it came from.
 *
 * `reason` (from project_versions, spec §6.3/§8.1) is always one of three
 * machine words; D§6 requires plain-word labels for every one of them.
 */
const REASON_LABELS = {
  overwrite: "saved over",
  "conflict-loser": "kept from a sync conflict",
  restore: "restored",
};

/** Exported so a caller that ever needs the bare word (an aria-label, a
 *  CSV export) doesn't have to duplicate the mapping. */
export function reasonLabel(reason) {
  return REASON_LABELS[reason] ?? reason;
}

function epochOf(time) {
  // A version's `savedAt`/a submission's `createdAt` arrive as an ISO
  // string over the wire (both routes stamp them via Date#toISOString);
  // a bare epoch number is accepted too so callers that already hold one
  // (e.g. a locally-optimistic entry) don't have to round-trip it.
  return typeof time === "number" ? time : new Date(time).getTime();
}

/**
 * Merges a version list and a submission list into one time-ordered feed,
 * newest first — the same merge the student page and the (deferred) teacher
 * Timeline panel both use, so "one component, two feeders" extends to how
 * entries are BUILT, not just how they render.
 *
 * `savedByLabel`, when given, is stamped onto every checkpoint — the
 * teacher feed's attribution (D§6). Individual work: every checkpoint in one
 * student's project history is that same student's, so one constant label
 * covers the whole list.
 *
 * Group work (Task 23, spec §5.5 — "the history keeps every checkpoint,
 * labelled with who saved it") is where that stops being constant: the group
 * timeline route names the member behind each version, and a row's own
 * `savedByName` wins over the label.
 */
export function buildTimelineEntries({ versions = [], submissions = [], savedByLabel = null } = {}) {
  const checkpoints = versions.map((v) => ({
    type: "checkpoint",
    key: `checkpoint-${v.versionId}`,
    time: epochOf(v.savedAt),
    versionId: v.versionId,
    reason: v.reason,
    savedBy: v.savedByName ?? savedByLabel,
  }));
  const markers = submissions.map((s) => ({
    type: "submission",
    key: `submission-${s.id}`,
    time: epochOf(s.createdAt),
    attempt: s.attempt,
    late: s.late,
  }));
  return [...checkpoints, ...markers].sort((a, b) => b.time - a.time);
}

/**
 * `entries`: the array buildTimelineEntries produces (or an equivalent
 * hand-built list — the shape, not the helper, is the contract).
 * `onRestore`: `(versionId) => void`, or null/undefined for a read-only
 * feed (the teacher's — restoring a student's work from the outside is
 * not this screen's job).
 */
export default function HistoryTimeline({ entries, onRestore }) {
  if (!entries || entries.length === 0) {
    return <p className="empty">No checkpoints yet.</p>;
  }
  return (
    <ul className="history-timeline">
      {entries.map((entry) => (
        <li key={entry.key} className="history-checkpoint">
          <span className="history-checkpoint__icon" aria-hidden="true">
            {entry.type === "submission" ? <UploadIcon size={14} /> : <HistoryIcon size={14} />}
          </span>
          <div className="history-checkpoint__body">
            {entry.type === "submission" ? (
              <span className="history-checkpoint__label">
                Submitted — attempt {entry.attempt}
                {entry.late ? <span className="badge badge--warning">late</span> : null}
              </span>
            ) : (
              <span className="history-checkpoint__label">
                {reasonLabel(entry.reason)}
                {entry.savedBy ? <span className="history-checkpoint__by"> — {entry.savedBy}</span> : null}
              </span>
            )}
            <span className="history-checkpoint__time">{relativeTime(entry.time)}</span>
          </div>
          {entry.type === "checkpoint" && onRestore ? (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => onRestore(entry.versionId)}
            >
              Restore
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
