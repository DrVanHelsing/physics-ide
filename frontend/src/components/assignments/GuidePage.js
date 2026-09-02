import React, { Suspense, lazy, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EMPTY_INSTRUCTIONS_DOC } from "@physics-ide/shared";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import PortalHeader from "../layout/PortalHeader";
import InstructionsView from "./InstructionsView";

/**
 * The one component behind three routes — /classes/:id/guides/new,
 * /classes/:id/guides/:gid, and /classes/:id/guides/:gid/edit — because a
 * guide page has only two things to show (App.js passes which one via the
 * `mode` prop, same "route decides, component branches" idiom `isNew` uses
 * in AssignmentEditorPage):
 *   - "read": the published-format render, through InstructionsView (the
 *     same renderer the assignment brief pane and student page will use) —
 *     open to any class member, gated by the API the way a draft assignment
 *     is (a student's GET 404s until publish).
 *   - "edit": the teacher-only settings form, reusing RichTextEditor.js
 *     behind the same React.lazy boundary AssignmentEditorPage established
 *     — a guide's body is the same InstructionsDocSchema an assignment's
 *     instructions are, so it is the same heavy, teacher-only editor.
 *
 * Like AssignmentEditorPage, this is NOT nested in ClassChrome — it is a
 * full-screen page, not a class tab (GuidesTab is the tab).
 */
const RichTextEditor = lazy(() => import("./RichTextEditor"));

const TEACHERS_ONLY = "Teachers only for this class.";

function emptyForm() {
  return { title: "", body: EMPTY_INSTRUCTIONS_DOC };
}

function gatedPage(title, body, back) {
  return (
    <div className="page">
      <PortalHeader home="/classes" title={title} back={back} />
      <div className="page-body">{body}</div>
    </div>
  );
}

export default function GuidePage({ mode }) {
  const { id, gid } = useParams();
  const navigate = useNavigate();
  const isNew = !gid;
  const editing = mode === "edit";
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useMe();
  const classQuery = useQuery({
    queryKey: ["class", id],
    queryFn: () => api(`/api/classes/${id}`),
    enabled: !!me,
    retry: false,
  });
  const guideQuery = useQuery({
    queryKey: ["guide", gid],
    queryFn: () => api(`/api/guides/${gid}`),
    enabled: !!me && !isNew,
    retry: false,
  });

  const [form, setForm] = useState(emptyForm);
  const [seeded, setSeeded] = useState(isNew);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isNew || seeded || !guideQuery.data) return;
    const g = guideQuery.data.guide;
    setForm({ title: g.title ?? "", body: g.body ?? EMPTY_INSTRUCTIONS_DOC });
    setSeeded(true);
  }, [isNew, seeded, guideQuery.data]);

  const save = useMutation({
    mutationFn: (body) =>
      isNew
        ? api(`/api/classes/${id}/guides`, { method: "POST", body })
        : api(`/api/guides/${gid}`, { method: "PATCH", body }),
    onSuccess: (data) => navigate(`/classes/${id}/guides/${data.guide.id}`),
    onError: (err) => setError(err.message),
  });

  const refreshGuide = () => qc.invalidateQueries({ queryKey: ["guide", gid] });

  const publish = useMutation({
    mutationFn: () => api(`/api/guides/${gid}/publish`, { method: "POST" }),
    onSuccess: refreshGuide,
    onError: (err) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => api(`/api/guides/${gid}`, { method: "DELETE" }),
    onSuccess: () => navigate(`/classes/${id}/guides`),
    onError: (err) => setError(err.message),
  });

  if (meLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace state={{ returnTo: window.location.pathname }} />;
  if (classQuery.isLoading) return null;
  if (classQuery.error) {
    return gatedPage(
      "Guide",
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
  const isTeacher = classData.myRole === "teacher";

  if (editing && !isTeacher) {
    return gatedPage(
      "Guide",
      <div className="alert alert--danger" role="alert">
        {TEACHERS_ONLY}
      </div>,
      { to: `/classes/${id}/guides`, label: "Back to guides" },
    );
  }

  if (!isNew && guideQuery.isLoading) return null;
  if (!isNew && guideQuery.error) {
    return gatedPage(
      "Guide",
      <>
        <div className="alert alert--danger" role="alert">
          {guideQuery.error.message}
        </div>
        <Link className="btn" to={`/classes/${id}/guides`}>
          Back to guides
        </Link>
      </>,
    );
  }

  if (editing) {
    if (!isNew && !seeded) return null;

    function handleSubmit(e) {
      e.preventDefault();
      setError(null);
      save.mutate({ title: form.title, body: form.body });
    }

    return (
      <div className="page">
        <PortalHeader
          home="/classes"
          title={isNew ? "New guide" : "Edit guide"}
          back={
            isNew
              ? { to: `/classes/${id}/guides`, label: "Back to guides" }
              : { to: `/classes/${id}/guides/${gid}`, label: "Back to the guide" }
          }
        />
        <div className="page-body">
          <form className="card auth-form" onSubmit={handleSubmit}>
            <label className="auth-label">
              Title
              <input
                className="input"
                name="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </label>

            {/* A <div>, not a <label> — same reasoning as AssignmentEditorPage's
                Instructions field: the editor's own toolbar buttons must not
                become implicit label-click targets. */}
            <div className="auth-label">
              <span>Body</span>
              <Suspense fallback={<p className="empty">Loading the editor…</p>}>
                <RichTextEditor value={form.body} onChange={(doc) => setForm((f) => ({ ...f, body: doc }))} />
              </Suspense>
            </div>

            {error ? (
              <div className="alert alert--danger" role="alert">
                {error}
              </div>
            ) : null}

            <div className="assignments-actions">
              <Link className="btn" to={isNew ? `/classes/${id}/guides` : `/classes/${id}/guides/${gid}`}>
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

  // Read mode.
  const guide = guideQuery.data?.guide;
  if (!guide) return null;
  const isDraft = !guide.publishedAt;

  return (
    <div className="page">
      <PortalHeader
        home="/classes"
        back={{ to: `/classes/${id}/guides`, label: "Back to guides" }}
        title={
          <>
            {guide.title}
            {isTeacher && isDraft ? <span className="badge badge--warning">draft</span> : null}
          </>
        }
      />
      <div className="page-body">
        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}
        <InstructionsView doc={guide.body} />
        {isTeacher ? (
          <div className="assignments-actions">
            <Link className="btn" to={`/classes/${id}/guides/${gid}/edit`}>
              Edit
            </Link>
            {isDraft ? (
              <button
                className="btn btn--primary"
                type="button"
                disabled={publish.isPending}
                onClick={() => publish.mutate()}
              >
                Publish
              </button>
            ) : null}
            <button
              className="btn btn--danger"
              type="button"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
