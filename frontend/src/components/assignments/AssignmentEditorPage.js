import React, { Suspense, lazy, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ASSIGNMENT_PROJECT_TYPES,
  BUILT_IN_RULE_SETS,
  EMPTY_INSTRUCTIONS_DOC,
  SUBMISSION_MODES,
} from "@physics-ide/shared";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import PortalHeader from "../layout/PortalHeader";
import RulesPicker from "./RulesPicker";

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
 *
 * The starter row and Publish/Close/Delete lifecycle controls (Task 8) only
 * apply to an assignment that already exists — pinning a starter and
 * stepping the lifecycle both hit `/api/assignments/:id/...` routes, and a
 * brand-new draft has no `:id` until the first Save. Both sections are
 * gated on `!isNew`.
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
    rules: BUILT_IN_RULE_SETS.standard_classwork,
  };
}

/** The one-line consequence sentence next to Publish — spec: "Students in
 *  this class will see it immediately", or the scheduled date when the
 *  form's Opens field is set. */
function publishConsequence(opensAtMs) {
  return opensAtMs
    ? `Students in this class will see it starting ${new Date(opensAtMs).toLocaleString()}.`
    : "Students in this class will see it immediately.";
}

function gatedPage(title, body, back) {
  return (
    <div className="page">
      <PortalHeader home="/classes" title={title} back={back} />
      <div className="page-body">{body}</div>
    </div>
  );
}

export default function AssignmentEditorPage() {
  const { id, aid } = useParams();
  const navigate = useNavigate();
  const isNew = !aid;
  const qc = useQueryClient();

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
  // The teacher's own projects, for the starter-pinning row — only useful
  // (and only fetched) once the assignment itself exists.
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("/api/projects"),
    enabled: !!me && !isNew,
  });

  const [form, setForm] = useState(emptyForm);
  const [seeded, setSeeded] = useState(isNew);
  const [error, setError] = useState(null);
  const [starterProjectId, setStarterProjectId] = useState("");

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
      rules: a.rules ?? BUILT_IN_RULE_SETS.standard_classwork,
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

  const refreshAssignment = () => qc.invalidateQueries({ queryKey: ["assignment", aid] });

  const pinStarter = useMutation({
    mutationFn: (projectId) => api(`/api/assignments/${aid}/starter`, { method: "POST", body: { projectId } }),
    onSuccess: () => {
      refreshAssignment();
      setStarterProjectId("");
    },
    onError: (err) => setError(err.message),
  });
  const clearStarter = useMutation({
    mutationFn: () => api(`/api/assignments/${aid}/starter`, { method: "DELETE" }),
    onSuccess: refreshAssignment,
    onError: (err) => setError(err.message),
  });
  const publish = useMutation({
    mutationFn: () => api(`/api/assignments/${aid}/publish`, { method: "POST" }),
    onSuccess: refreshAssignment,
    onError: (err) => setError(err.message),
  });
  const close = useMutation({
    mutationFn: () => api(`/api/assignments/${aid}/close`, { method: "POST" }),
    onSuccess: refreshAssignment,
    onError: (err) => setError(err.message),
  });
  const deleteDraft = useMutation({
    mutationFn: () => api(`/api/assignments/${aid}`, { method: "DELETE" }),
    onSuccess: () => navigate(`/classes/${id}`),
    onError: (err) => setError(err.message),
  });

  // Cancel exists, but at the BOTTOM of a ten-field form (F2, 2026-08-28).
  // The way out belongs above the fold too, and it names where it goes: the
  // class for a new assignment, the assignment itself when editing one that
  // already exists. Declared before the gates so the refused states get the
  // same exit the happy path does — GuidePage's equivalent branch already did.
  const back = isNew
    ? { to: `/classes/${id}`, label: "Back to assignments" }
    : { to: `/classes/${id}/assignments/${aid}`, label: "Back to the assignment" };

  if (meLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace state={{ returnTo: window.location.pathname }} />;
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
      back,
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
      back,
    );
  }

  if (!isNew && !seeded) return null;

  // Only meaningful once the assignment exists — see the file header note
  // on why the starter row and lifecycle controls are gated on `!isNew`.
  const assignment = isNew ? null : assignmentQuery.data?.assignment;
  const isDraft = assignment?.phase === "draft";
  // Publish acts on the PERSISTED row — it POSTs no body — so a live, unsaved
  // edit to a date field must never let the consequence sentence promise a
  // schedule Publish itself won't honor (fix round, review 9c831c0: the
  // sentence used to read `form.opensAt` directly). Save first; only then is
  // the live form's dates the same as what Publish will act on.
  const datesDirty =
    isDraft &&
    (toMs(form.opensAt) !== assignment.opensAt ||
      toMs(form.dueAt) !== assignment.dueAt ||
      toMs(form.lateUntil) !== assignment.lateUntil);

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
      rules: form.rules,
    });
  }

  return (
    <div className="page">
      <PortalHeader
        home="/classes"
        title={isNew ? "New assignment" : "Edit assignment"}
        back={back}
      />
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
            Individual work — students see the stamp, and this work can't be shared with classmates
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

          <h2 className="section-title">Workspace rules</h2>
          <RulesPicker value={form.rules} onChange={(rules) => updateField("rules", rules)} />

          {!isNew ? (
            <>
              <h2 className="section-title">Starter project</h2>
              <div className="assignments-starter-row">
                <select
                  className="input"
                  name="starterProjectId"
                  value={starterProjectId}
                  onChange={(e) => setStarterProjectId(e.target.value)}
                >
                  <option value="">— choose a project —</option>
                  {(projectsQuery.data?.projects ?? [])
                    .filter((p) => !p.deleted)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
                <button
                  className="btn"
                  type="button"
                  disabled={!starterProjectId || pinStarter.isPending}
                  onClick={() => pinStarter.mutate(starterProjectId)}
                >
                  Pin
                </button>
                {assignment?.hasStarter ? (
                  <button
                    className="btn"
                    type="button"
                    disabled={clearStarter.isPending}
                    onClick={() => clearStarter.mutate()}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <p className="auth-text auth-text--dim">
                {assignment?.hasStarter
                  ? "Students start their own copy of the pinned project."
                  : "No starter pinned — students begin from a blank project."}
              </p>
            </>
          ) : null}

          {error ? (
            <div className="alert alert--danger" role="alert">
              {error}
            </div>
          ) : null}

          {isDraft ? (
            <>
              {/* Reads the PERSISTED opensAt, not the live form field — this
                  sentence describes what clicking Publish right now will
                  actually do, and Publish itself sends no body. */}
              <p className="auth-text auth-text--dim">{publishConsequence(assignment.opensAt)}</p>
              {datesDirty ? (
                <p className="auth-text auth-text--dim" role="status">
                  Save your changes first — unsaved date edits do not apply.
                </p>
              ) : null}
            </>
          ) : null}

          <div className="assignments-actions">
            <Link className="btn" to={`/classes/${id}`}>
              Cancel
            </Link>
            {isDraft ? (
              <button
                className="btn btn--danger"
                type="button"
                disabled={deleteDraft.isPending}
                onClick={() => deleteDraft.mutate()}
              >
                Delete draft
              </button>
            ) : null}
            <button className="btn btn--primary" type="submit" disabled={save.isPending}>
              Save
            </button>
            {isDraft ? (
              <button
                className="btn btn--primary"
                type="button"
                disabled={publish.isPending || datesDirty}
                onClick={() => publish.mutate()}
              >
                Publish
              </button>
            ) : null}
            {assignment && !isDraft ? (
              <button
                className="btn btn--danger"
                type="button"
                disabled={close.isPending}
                onClick={() => close.mutate()}
              >
                Close now
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
