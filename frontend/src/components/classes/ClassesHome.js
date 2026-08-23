import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import PortalHeader from "../layout/PortalHeader";

export default function ClassesHome() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  return (
    <div className="page">
      <PortalHeader title="My classes" />
      <ClassWall me={me} />
    </div>
  );
}

function ClassWall({ me }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [error, setError] = useState(null);
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => api("/api/classes") });
  const create = useMutation({
    mutationFn: (body) => api("/api/classes", { method: "POST", body }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      navigate(`/classes/${data.class.id}`);
    },
    onError: (err) => setError(err.message),
  });

  const all = classesQuery.data?.classes ?? [];
  const active = all.filter((c) => !c.archived);
  const archived = all.filter((c) => c.archived);
  const canCreate = me.isTeacher || me.role === "admin";

  return (
    <div className="page-body">
      <div className="classes-actions">
        {canCreate ? (
          <button className="btn" type="button" onClick={() => setCreating((v) => !v)}>
            New class
          </button>
        ) : null}
        <Link className="btn" to="/join">
          Join a class
        </Link>
      </div>
      {creating ? (
        <form
          className="auth-form classes-newform"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate({ name, ...(subjectLabel.trim() ? { subjectLabel } : {}) });
          }}
        >
          <label className="auth-label">
            Class name
            <input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="auth-label">
            Subject / year (optional)
            <input
              className="auth-input"
              value={subjectLabel}
              onChange={(e) => setSubjectLabel(e.target.value)}
            />
          </label>
          {error ? <div className="alert alert--danger">{error}</div> : null}
          <button
            className="btn btn--primary btn--lg btn--block"
            type="submit"
            disabled={!name.trim() || create.isPending}
          >
            Create class
          </button>
        </form>
      ) : null}
      <div className="classes-wall">
        {active.map((c) => (
          <Link key={c.id} to={`/classes/${c.id}`} className="class-card">
            <div className="class-card-name">{c.name}</div>
            {c.subjectLabel ? <div className="class-card-label">{c.subjectLabel}</div> : null}
            <div className="class-card-meta">
              {c.myRole === "teacher" ? "teacher" : c.myRole === "ta" ? "assistant" : "student"}
              {c.myStatus === "waiting" ? " · waiting for approval" : ""}
            </div>
          </Link>
        ))}
        {active.length === 0 && !classesQuery.isLoading ? (
          <p className="empty empty--full">
            {canCreate
              ? "No classes yet — create your first one."
              : "No classes yet — join one with a code from your teacher."}
          </p>
        ) : null}
      </div>
      {archived.length > 0 ? (
        <details className="classes-archived">
          <summary>Archived ({archived.length})</summary>
          {archived.map((c) => (
            <Link key={c.id} to={`/classes/${c.id}`} className="class-card class-card--archived">
              <div className="class-card-name">{c.name}</div>
            </Link>
          ))}
        </details>
      ) : null}
    </div>
  );
}
