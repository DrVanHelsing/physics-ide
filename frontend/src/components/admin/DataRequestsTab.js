import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { SearchIcon, XIcon, DownloadIcon, TrashIcon, PrivacyIcon } from "../Icons";
import Overlay from "../common/Overlay";

/**
 * The admin console's fifth tab (spec §10 — "Data requests": export
 * everything about one person as a file, or erase a person completely).
 * Mirrors the People tab's search + row structure — same
 * `.admin-search-box`, same `.admin-table` — but this tab never lists
 * everyone at rest: the query only runs once an admin has typed something
 * to look for, since a data request is acted on one named person at a
 * time, not browsed. Export follows D§6 (a client-side Blob, nothing new
 * under the contract); erase follows D§5 (the in-place PII scrub).
 */

/* Spec §11's "Right to leave" paragraph, worded for the dialog itself —
 * the dialog's own consequence sentence, asserted verbatim by
 * dataRequests.test.js. The backend's own erase-route refusals
 * (NO_SUCH_ACCOUNT, ALREADY_ERASED, SELF_ERASE, CONFIRM_MISMATCH) are
 * separate sentences for separate failure cases; this one is spoken before
 * the request is even sent. */
export const ERASE_SENTENCE =
  "This cannot be undone. Their account and personal details go; their " +
  'submissions and marks stay in the class record under "Removed student".';

const RESTING_COPY = "Search for a person to export or erase their data.";

export default function DataRequestsTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [eraseTarget, setEraseTarget] = useState(null); // { id, email } | null
  const [confirmText, setConfirmText] = useState("");
  const [exportError, setExportError] = useState(null);
  const hasQuery = q.trim().length > 0;

  const usersQuery = useQuery({
    queryKey: ["admin", "dataRequests", q],
    queryFn: () => api(`/api/admin/users?q=${encodeURIComponent(q)}`),
    enabled: hasQuery,
  });

  const erase = useMutation({
    mutationFn: ({ id, confirm }) =>
      api(`/api/admin/users/${id}/erase`, { method: "POST", body: { confirm } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      setEraseTarget(null);
      setConfirmText("");
    },
  });

  function openErase(u) {
    setExportError(null);
    setConfirmText("");
    setEraseTarget({ id: u.id, email: u.email });
  }

  function closeErase() {
    setEraseTarget(null);
    setConfirmText("");
  }

  // The GradebookTab idiom verbatim (its own Export CSV button) — a Blob
  // built in the browser, an <a download> driven and discarded, never a
  // server-side Content-Disposition (D§6's contract stays intact).
  async function handleExport(u) {
    setExportError(null);
    try {
      const data = await api(`/api/admin/users/${u.id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `physide-export-${u.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message);
    }
  }

  const rows = usersQuery.data?.users ?? [];

  return (
    <div className="page-body page-body--wide">
      <div className="admin-search-box">
        <span className="admin-search-icon" aria-hidden="true">
          <SearchIcon size={13} />
        </span>
        <input
          className="input admin-search-input"
          type="text"
          placeholder="Search by name or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search by name or email"
        />
        {q ? (
          <button
            type="button"
            className="admin-search-clear"
            onClick={() => setQ("")}
            aria-label="Clear search"
          >
            <XIcon size={13} />
          </button>
        ) : null}
      </div>
      {exportError ? (
        <div className="alert alert--danger" role="alert">
          {exportError}
        </div>
      ) : null}
      {!hasQuery ? (
        <p className="empty">
          <PrivacyIcon size={14} /> {RESTING_COPY}
        </p>
      ) : rows.length === 0 && !usersQuery.isLoading ? (
        <p className="empty">No one matches “{q}”.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td className="admin-actions">
                    <button className="btn" type="button" onClick={() => handleExport(u)}>
                      <DownloadIcon size={13} /> Export
                    </button>
                    {!u.erased ? (
                      <button
                        className="btn btn--danger"
                        type="button"
                        onClick={() => openErase(u)}
                      >
                        <TrashIcon size={13} /> Erase…
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {eraseTarget ? (
        <Overlay
          onClose={closeErase}
          label="Erase this account"
          panelClassName="erase-dialog"
          dismissOnBackdrop={false}
        >
          <h2 className="erase-dialog__title">Erase this account</h2>
          <p>{ERASE_SENTENCE}</p>
          <label className="auth-label">
            Type {eraseTarget.email} to confirm
            <input
              className="input"
              type="text"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </label>
          {erase.error ? (
            <div className="alert alert--danger" role="alert">
              {erase.error.message}
            </div>
          ) : null}
          <div className="erase-dialog__actions">
            <button className="btn" type="button" onClick={closeErase}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              type="button"
              disabled={confirmText !== eraseTarget.email || erase.isPending}
              onClick={() => erase.mutate({ id: eraseTarget.id, confirm: confirmText })}
            >
              <TrashIcon size={13} /> Erase permanently
            </button>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
