import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Overlay from "../common/Overlay";
import { api } from "../../utils/api/client";

/* D§8, said at the point of use — nobody discovers revocation policy later. */
export const HANDOFF_SENTENCE = "Once they add it, it's theirs — you can't take it back.";
export const NO_SHARING_CLASSES = "None of your classes has peer sharing switched on.";
export const EMPTY_ROSTER = "Nobody else is in this class yet.";

/** The send surface (design D§6): the product's one overlay idiom, a
 *  class-roster picker, NO message field — a share carries a project and a
 *  name, nothing else (D§1). The server re-refuses everything this dialog
 *  cannot see (D§5 fails closed); errors land here as their own sentences. */
export default function ShareDialog({ projectId, onClose }) {
  const [classId, setClassId] = useState(null);
  const [recipientId, setRecipientId] = useState(null);
  const [sentTo, setSentTo] = useState(null);

  const classesQ = useQuery({ queryKey: ["share", "classes"], queryFn: () => api("/api/classes") });
  const shareable = (classesQ.data?.classes ?? []).filter(
    (c) => c.peerSharing && !c.archived && c.myStatus === "active",
  );
  const chosenClass = classId ?? (shareable.length === 1 ? shareable[0].id : null);

  const rosterQ = useQuery({
    queryKey: ["share", "roster", chosenClass],
    queryFn: () => api(`/api/shares/roster/${chosenClass}`),
    enabled: !!chosenClass,
  });
  const members = rosterQ.data?.members ?? [];

  const send = useMutation({
    mutationFn: () =>
      api("/api/shares", { method: "POST", body: { classId: chosenClass, recipientId, projectId } }),
    onSuccess: () => setSentTo(members.find((m) => m.userId === recipientId)?.name ?? "them"),
  });

  return (
    <Overlay onClose={onClose} label="Share this project" panelClassName="share-dialog">
      <h2 className="share-dialog__title">Share this project</h2>
      {classesQ.isLoading ? null : shareable.length === 0 ? (
        <p className="empty">{NO_SHARING_CLASSES}</p>
      ) : sentTo ? (
        <p className="share-dialog__done" role="status">
          Shared with {sentTo}. It will wait on their class page until they add it.
        </p>
      ) : (
        <>
          {shareable.length > 1 ? (
            <label className="auth-label">
              Class
              <select
                className="input"
                value={chosenClass ?? ""}
                onChange={(e) => {
                  setClassId(e.target.value || null);
                  setRecipientId(null);
                }}
              >
                <option value="">Choose a class…</option>
                {shareable.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {chosenClass && !rosterQ.isLoading ? (
            members.length === 0 ? (
              <p className="empty">{EMPTY_ROSTER}</p>
            ) : (
              <div className="share-roster" role="radiogroup" aria-label="Share with">
                {members.map((m) => (
                  <label
                    key={m.userId}
                    className={recipientId === m.userId ? "auth-door auth-door--on" : "auth-door"}
                  >
                    <input
                      type="radio"
                      name="shareRecipient"
                      checked={recipientId === m.userId}
                      onChange={() => setRecipientId(m.userId)}
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            )
          ) : null}
          <p className="share-dialog__note">{HANDOFF_SENTENCE}</p>
          {send.error ? (
            <div className="alert alert--danger" role="alert">{send.error.message}</div>
          ) : null}
          <div className="share-dialog__actions">
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button
              className="btn btn--primary"
              type="button"
              disabled={!chosenClass || !recipientId || send.isPending}
              onClick={() => send.mutate()}
            >
              Share
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
}
