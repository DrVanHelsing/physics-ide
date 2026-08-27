import React, { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import { createManifest } from "../../utils/manifest/factory";
import { saveProject } from "../../utils/storage/projectStore";
import { LAST_PROJECT_KEY } from "../../constants";
import PortalHeader from "../layout/PortalHeader";
import SubmissionViewer from "./SubmissionViewer";

/**
 * The marking room — /classes/:id/assignments/:aid/marking/:studentId
 * (spec §7.2). Not nested in ClassChrome — like GuidePage.js and
 * AssignmentEditorPage.js, this is a full-screen room, not a class tab.
 *
 * Two things sit alongside the read-only script (SubmissionViewer):
 *   - **Open a test copy**: the ONLY way to run/debug a submission (spec
 *     §7.2 — "the submission itself is read-only and untouchable... the
 *     teacher works in a test copy"). Builds a fresh manifest from the
 *     snapshot, saves it into the TEACHER's own project space (never
 *     touching the student's), stamps LAST_PROJECT_KEY, and navigates to
 *     "/" — the full IDE, with Run and debug mode, opens on the copy.
 *   - **Previous / Next**: walk Task 16's inbox row order (query key
 *     ["assignment", aid, "inbox"], shared verbatim with InboxPage.js) so
 *     marking a set of submissions is one continuous flow, never a trip
 *     back to the inbox between students (spec §7.2). A marker who lands
 *     here straight from the inbox reuses its already-cached rows; a
 *     direct link fetches them itself.
 *
 * Task 18 adds the marking panel beside SubmissionViewer in this same file
 * — this task only builds the read-only room the panel will sit inside.
 */

const STAFF_ONLY = "Teachers and assistants only for this class.";

function gatedPage(title, body) {
  return (
    <div className="page">
      <PortalHeader home="/classes" title={title} />
      <div className="page-body">{body}</div>
    </div>
  );
}

export default function MarkingRoom() {
  const { id, aid, studentId } = useParams();
  const navigate = useNavigate();
  const [copyError, setCopyError] = useState(null);
  const [copying, setCopying] = useState(false);

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
    enabled: !!me,
  });
  const submissionQuery = useQuery({
    queryKey: ["assignment", aid, "submission", studentId],
    queryFn: () => api(`/api/assignments/${aid}/submissions/${studentId}`),
    enabled: !!me,
  });
  // Task 16's own query, key-for-key — a cache hit if the marker arrived
  // from the inbox, a fresh fetch (once that route exists) otherwise.
  const inboxQuery = useQuery({
    queryKey: ["assignment", aid, "inbox"],
    queryFn: () => api(`/api/assignments/${aid}/inbox`),
    enabled: !!me,
  });

  if (meLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (classQuery.isLoading) return null;
  if (classQuery.error) {
    return gatedPage(
      "Marking",
      <div className="alert alert--danger" role="alert">
        {classQuery.error.message}
      </div>,
    );
  }
  if (!classQuery.data) return null;
  const classData = classQuery.data.class;
  const isStaff = classData.myRole === "teacher" || classData.myRole === "ta";
  if (!isStaff) {
    return gatedPage(
      "Marking",
      <div className="alert alert--danger" role="alert">
        {STAFF_ONLY}
      </div>,
    );
  }

  if (assignmentQuery.isLoading || submissionQuery.isLoading) return null;
  if (assignmentQuery.error) {
    return gatedPage(
      "Marking",
      <div className="alert alert--danger" role="alert">
        {assignmentQuery.error.message}
      </div>,
    );
  }
  if (submissionQuery.error) {
    return gatedPage(
      "Marking",
      <div className="alert alert--danger" role="alert">
        {submissionQuery.error.message}
      </div>,
    );
  }
  const assignment = assignmentQuery.data?.assignment;
  const submission = submissionQuery.data?.submission;
  if (!assignment || !submission) return null;

  // Task 16's inbox rows — { studentId, ... } — in submission order. Not
  // required for the room to render: a missing/still-loading inbox just
  // means Previous/Next stay disabled rather than blocking the page.
  const order = (inboxQuery.data?.rows ?? []).map((r) => r.studentId);
  const idx = order.indexOf(studentId);
  const prevId = idx > 0 ? order[idx - 1] : null;
  const nextId = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  function goTo(otherStudentId) {
    navigate(`/classes/${id}/assignments/${aid}/marking/${otherStudentId}`);
  }

  async function openTestCopy() {
    setCopyError(null);
    setCopying(true);
    try {
      const manifest = createManifest({
        goal: assignment.projectType,
        workspaceXml: submission.workspaceXml,
        python: submission.python,
        title: `Test copy — ${submission.studentName} — ${assignment.title}`,
      });
      const saved = await saveProject(manifest);
      try {
        localStorage.setItem(LAST_PROJECT_KEY, saved.id);
      } catch {
        /* storage blocked */
      }
      navigate("/");
    } catch (err) {
      setCopyError(err.message);
      setCopying(false);
    }
  }

  return (
    <div className="page">
      <PortalHeader
        home={`/classes/${id}/assignments/${aid}`}
        title={
          <span className="marking-room__header">
            {submission.studentName}
            <span className="badge">Attempt {submission.attempt}</span>
            {submission.late ? <span className="badge badge--warning">late</span> : null}
            <code className="marking-room__fingerprint">{submission.fingerprint}</code>
          </span>
        }
        nav={
          <div className="marking-room__nav">
            <button className="btn" type="button" disabled={!prevId} onClick={() => goTo(prevId)}>
              Previous
            </button>
            <button className="btn" type="button" disabled={!nextId} onClick={() => goTo(nextId)}>
              Next
            </button>
          </div>
        }
      />
      <div className="page-body marking-room__body">
        <div className="assignments-actions">
          <button className="btn" type="button" disabled={copying} onClick={openTestCopy}>
            Open a test copy
          </button>
        </div>
        {copyError ? (
          <div className="alert alert--danger" role="alert">
            {copyError}
          </div>
        ) : null}
        <SubmissionViewer workspaceXml={submission.workspaceXml} python={submission.python} />
      </div>
    </div>
  );
}
