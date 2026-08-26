import React, { Suspense, lazy, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ASSIGNMENT_PROJECT_TYPES, EMPTY_INSTRUCTIONS_DOC, SUBMISSION_MODES } from "@physics-ide/shared";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import PortalHeader from "../layout/PortalHeader";

/**
 * The teacher-only assignment editor — /classes/:id/assignments/new and
 * /classes/:id/assignments/:aid/edit both mount this. It is NOT nested in
 * ClassChrome (spec: a full-screen editor, not a class tab), so it carries
 * its own teacher gate against the class query instead of relying on
 * ClassChrome's.
 *
 * The settings form (this file) is eager; the TipTap instructions editor
 * (RichTextEditor.js) is heavy and teacher-only, so it loads behind
 * React.lazy — students and every non-editor screen never pay for it.
 */
const RichTextEditor = lazy(() => import("./RichTextEditor"));

const PROJECT_TYPE_LABELS = { physics: "Physics", datascience: "Data Science", hybrid: "Hybrid" };
const SUBMISSION_MODE_LABELS = { individual: "Individual", pair: "Pair", group: "Group" };

const TEACHERS_ONLY = "Teachers only for this class.";

// A datetime-local input's value is always local-time wall-clock text
// ("YYYY-MM-DDTHH:mm"), so converting to/from epoch ms has to go through
// the browser's own timezone offset rather than treating the string as UTC.
const toLocal = (ms) => (ms ? new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const toMs = (local) => (local ? new Date(local).getTime() : null);

function emptyForm() {
  return {
    title: "",
    projectType: ASSIGNMENT_PROJECT_TYPES[0],
    points: "",
    submissionMode: "individual",
    individualWork: false,
    opensAt: "",
    dueAt: "",
    lateUntil: "",
    instructions: EMPTY_INSTRUCTIONS_DOC,
  };
}

function gatedPage(title, body) {
  return (
    <div className="page">
      <PortalHeader home="/classes" title={title} />
      <div className="page-body">{body}</div>
    </div>
  );
}

export default function AssignmentEditorPage() {
  const { id, aid } = useParams();
  const navigate = useNavigate();
  const isNew = !aid;

  const { data: me, isLoading: meLoading } = useMe();
  const classQuery = useQuery({
    queryKey: ["class", id],
    queryFn: () => api(`/api/classes/${id}`),
    enabled: !!me,
    retry: false,
  });
  const assignmentQuery = useQuery({
    queryKey: ["assignment", aid],
    queryFn: () => api(`/api/assignments/${aid}`),
    enabled: !!me && !isNew,
    retry: false,
  });

  const [form, setForm] = useState(emptyForm);
  const [seeded, setSeeded] = useState(isNew);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isNew || seeded || !assignmentQuery.data) return;
    const a = assignmentQuery.data.assignment;
    setForm({
      title: a.title ?? "",
      projectType: a.projectType ?? ASSIGNMENT_PROJECT_TYPES[0],
      points: a.points == null ? "" : String(a.points),
      submissionMode: a.submissionMode ?? "individual",
      individualWork: !!a.individualWork,
      opensAt: toLocal(a.opensAt),
      dueAt: toLocal(a.dueAt),
      lateUntil: toLocal(a.lateUntil),
      instructions: a.instructions ?? EMPTY_INSTRUCTIONS_DOC,
    });
    setSeeded(true);
  }, [isNew, seeded, assignmentQuery.data]);

  const save = useMutation({
    mutationFn: (body) =>
      isNew
        ? api(`/api/classes/${id}/assignments`, { method: "POST", body })
        : api(`/api/assignments/${aid}`, { method: "PATCH", body }),
    onSuccess: () => navigate(`/classes/${id}`),
    onError: (err) => setError(err.message),
  });

  if (meLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (classQuery.isLoading) return null;
  if (classQuery.error) {
    return gatedPage(
      "Assignment",
      <>
        <div className="alert alert--danger" role="alert">
          {classQuery.error.message}
        </div>
        <Link className="btn" to="/classes">
          Back to my classes
        </Link>
      </>,
    );
  }
  if (!classQuery.data) return null;
  const classData = classQuery.data.class;

  if (classData.myRole !== "teacher") {
    return gatedPage(
      "Assignment",
      <div className="alert alert--danger" role="alert">
        {TEACHERS_ONLY}
      </div>,
    );
  }

  if (!isNew && !seeded) return null;

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleModeChange(mode) {
    setForm((f) => ({
      ...f,
      submissionMode: mode,
      individualWork: mode === "individual" ? f.individualWork : false,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    save.mutate({
      title: form.title,
      projectType: form.projectType,
      points: form.points === "" ? null : Number(form.points),
      submissionMode: form.submissionMode,
      individualWork: form.individualWork,
      opensAt: toMs(form.opensAt),
      dueAt: toMs(form.dueAt),
      lateUntil: toMs(form.lateUntil),
      instructions: form.instructions,
    });
  }

  return (
    <div className="page">
      <PortalHeader home="/classes" title={isNew ? "New assignment" : "Edit assignment"} />
      <div className="page-body">
        <form className="card auth-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            Title
            <input
              className="input"
              name="title"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
            />
          </label>

          <label className="auth-label">
            Goal
            <select
              className="input"
              name="projectType"
              value={form.projectType}
              onChange={(e) => updateField("projectType", e.target.value)}
            >
              {ASSIGNMENT_PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROJECT_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-label">
            Points
            <input
              className="input"
              name="points"
              type="number"
              min="0"
              max="1000"
              step="1"
              placeholder="Complete/not-complete"
              value={form.points}
              onChange={(e) => updateField("points", e.target.value)}
            />
          </label>

          <label className="auth-label">
            Submission
            <select
              className="input"
              name="submissionMode"
              value={form.submissionMode}
              onChange={(e) => handleModeChange(e.target.value)}
            >
              {SUBMISSION_MODES.map((m) => (
                <option key={m} value={m}>
                  {SUBMISSION_MODE_LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-consent">
            <input
              type="checkbox"
              name="individualWork"
              checked={form.individualWork}
              disabled={form.submissionMode !== "individual"}
              onChange={(e) => updateField("individualWork", e.target.checked)}
            />
            Each student's submission is marked individually
          </label>

          <label className="auth-label">
            Opens
            <input
              className="input"
              name="opensAt"
              type="datetime-local"
              value={form.opensAt}
              onChange={(e) => updateField("opensAt", e.target.value)}
            />
          </label>

          <label className="auth-label">
            Due
            <input
              className="input"
              name="dueAt"
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => updateField("dueAt", e.target.value)}
            />
          </label>

          <label className="auth-label">
            Late until
            <input
              className="input"
              name="lateUntil"
              type="datetime-local"
              value={form.lateUntil}
              onChange={(e) => updateField("lateUntil", e.target.value)}
            />
          </label>

          {/* A <div>, not a <label> — the editor's toolbar buttons are
              themselves labelable elements, and wrapping the whole widget
              in a <label> would make every one of them an implicit target
              for the browser's label-click forwarding. */}
          <div className="auth-label">
            <span>Instructions</span>
            <Suspense fallback={<p className="empty">Loading the editor…</p>}>
              <RichTextEditor value={form.instructions} onChange={(doc) => updateField("instructions", doc)} />
            </Suspense>
          </div>

          {error ? (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          ) : null}

          <div className="assignments-actions">
            <Link className="btn" to={`/classes/${id}`}>
              Cancel
            </Link>
            <button className="btn btn--primary" type="submit" disabled={save.isPending}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
