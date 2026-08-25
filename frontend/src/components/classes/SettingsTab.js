import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import ClassChrome from "./ClassChrome";

export default function SettingsTab() {
  return <ClassChrome tab="settings">{(c) => <SettingsBody classData={c} />}</ClassChrome>;
}

function SettingsBody({ classData }) {
  const { id } = useParams();
  const qc = useQueryClient();
  const [name, setName] = useState(classData.name);
  const [subjectLabel, setSubjectLabel] = useState(classData.subjectLabel ?? "");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["class", id] });
  const patch = useMutation({
    mutationFn: (body) => api(`/api/classes/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      refresh();
      setError(null);
      setMsg("Saved.");
    },
    onError: (err) => {
      setMsg(null);
      setError(err.message);
    },
  });
  const archive = useMutation({
    mutationFn: (action) => api(`/api/classes/${id}/${action}`, { method: "POST", body: {} }),
    onSuccess: refresh,
  });

  return (
    <div className="page-body">
      <form
        className="card auth-form form-narrow"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          setError(null);
          patch.mutate({
            name,
            subjectLabel: subjectLabel.trim() === "" ? null : subjectLabel,
          });
        }}
      >
        <label className="auth-label">
          Class name
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="auth-label">
          Subject / year
          <input
            className="input"
            value={subjectLabel}
            onChange={(e) => setSubjectLabel(e.target.value)}
          />
        </label>
        <button
          className="btn btn--primary btn--lg btn--block"
          type="submit"
          disabled={patch.isPending}
        >
          Save
        </button>
      </form>
      <h2 className="section-title">Joining rules</h2>
      <div className="auth-doors" style={{ maxWidth: 520 }}>
        {[
          ["open", "Open — anyone with the code joins instantly"],
          ["approval", "Approval — joiners wait for you"],
          ["paused", "Paused — nobody can join"],
        ].map(([mode, label]) => (
          <label key={mode} className={classData.joinMode === mode ? "auth-door auth-door--on" : "auth-door"}>
            <input
              type="radio"
              name="joinMode"
              checked={classData.joinMode === mode}
              onChange={() => patch.mutate({ joinMode: mode })}
            />
            {label}
          </label>
        ))}
      </div>
      {msg ? (
        <div className="alert alert--success" role="status">
          {msg}
        </div>
      ) : null}
      {error ? (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      ) : null}
      <h2 className="section-title">Archive</h2>
      {classData.archived ? (
        <button className="btn" type="button" onClick={() => archive.mutate("unarchive")}>
          Unarchive this class
        </button>
      ) : (
        <button className="btn btn--danger" type="button" onClick={() => archive.mutate("archive")}>
          Archive this class (read-only for everyone)
        </button>
      )}
    </div>
  );
}
