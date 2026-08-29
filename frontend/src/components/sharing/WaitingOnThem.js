import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";

/** The sender-side half of Plan 7's carry-forward promise, made operable
 *  (design D§8): the caller's own PENDING outgoing shares in this class,
 *  each with a Revoke button driving the existing
 *  POST /api/shares/:id/revoke — no new mutating route. The class
 *  TEACHER's widened view (every pending share in the class, sharer ->
 *  recipient — D§8 gave teachers revoke authority; this is their surface)
 *  is the SAME section, toggled by `isTeacher`: the mount site already
 *  knows classData.myRole. Renders NOTHING when empty — SharedWithYou's
 *  own rule (D§6): a mostly-empty destination is a section, not a screen.
 *  Revocation stays silent in the bell (D§2) — nothing here calls notify.
 */
export default function WaitingOnThem({ classId, isTeacher = false }) {
  const qc = useQueryClient();
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const queryKey = ["class", classId, "outgoingShares"];
  const q = useQuery({
    queryKey,
    queryFn: () => api(`/api/shares/outgoing?classId=${classId}`),
  });
  const pending = q.data?.shares ?? [];
  if (pending.length === 0) return null;

  const revoke = async (share) => {
    setError(null);
    setBusyId(share.id);
    try {
      await api(`/api/shares/${share.id}/revoke`, { method: "POST" });
      qc.invalidateQueries({ queryKey });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="waiting-on-them">
      <h2 className="section-title">Waiting on them</h2>
      <ul className="share-list">
        {pending.map((s) => (
          <li className="card share-row" key={s.id}>
            <span className="share-row__title">{s.title}</span>
            <span className="waiting-row__to">
              {isTeacher ? `${s.sharerName} to ${s.recipientName}` : `to ${s.recipientName}`}
            </span>
            <button className="btn" type="button" disabled={busyId === s.id} onClick={() => revoke(s)}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}
