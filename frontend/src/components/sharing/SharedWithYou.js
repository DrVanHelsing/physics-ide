import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import { acceptShare } from "../../utils/sharing/acceptShare";

/** The receive surface (design D§6): a section on the class page, never a
 *  tab, rendering NOTHING when empty — a mostly-empty destination is a
 *  section, not a screen. Discovery is pull-based by design (D§10): §9's
 *  email table is closed and the bell is Plan 8's. */
export default function SharedWithYou({ classId }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const q = useQuery({
    queryKey: ["class", classId, "shares"],
    queryFn: () => api(`/api/shares/incoming?classId=${classId}`),
  });
  const pending = q.data?.shares ?? [];
  if (pending.length === 0) return null;

  const add = async (share) => {
    setError(null);
    setBusyId(share.id);
    try {
      await acceptShare(share, me);
      qc.invalidateQueries({ queryKey: ["class", classId, "shares"] });
      navigate("/");
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  };

  return (
    <section className="shared-with-you">
      <h2 className="section-title">Shared with you</h2>
      <ul className="share-list">
        {pending.map((s) => (
          <li className="card share-row" key={s.id}>
            <span className="share-row__title">{s.title}</span>
            <span className="share-row__from">from {s.sharerName}</span>
            <button className="btn" type="button" disabled={busyId === s.id} onClick={() => add(s)}>
              Add to my projects
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
