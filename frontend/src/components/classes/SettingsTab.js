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
  const refresh = () => qc.invalidateQueries({ queryKey: ["class", id] });
  const patch = useMutation({
    mutationFn: (body) => api(`/api/classes/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      refresh();
      setMsg("Saved.");
    },
    onError: (err) => setMsg(err.message),
  });
  const archive = useMutation({
    mutationFn: (action) => api(`/api/classes/${id}/${action}`, { method: "POST", body: {} }),
    onSuccess: refresh,
  });

  return (
    <div className="classes-body">
      <form
        className="auth-form classes-newform"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          patch.mutate({
            name,
            subjectLabel: subjectLabel.trim() === "" ? null : subjectLabel,
          });
        }}
      >
        <label className="auth-label">
          Class name
          <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="auth-label">
          Subject / year
          <input
            className="auth-input"
            value={subjectLabel}
            onChange={(e) => setSubjectLabel(e.target.value)}
          />
        </label>
        <button className="auth-submit" type="submit" disabled={patch.isPending}>
          Save
        </button>
      </form>
      <h2 className="auth-title">Joining rules</h2>
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
      {msg ? <p className="auth-text auth-text--dim">{msg}</p> : null}
      <h2 className="auth-title">Archive</h2>
      {classData.archived ? (
        <button className="admin-btn" type="button" onClick={() => archive.mutate("unarchive")}>
          Unarchive this class
        </button>
      ) : (
        <button className="admin-btn" type="button" onClick={() => archive.mutate("archive")}>
          Archive this class (read-only for everyone)
        </button>
      )}
    </div>
  );
}
