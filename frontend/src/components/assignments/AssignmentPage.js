import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { startAssignmentWork, assertPushSucceeded } from "../../utils/assignments/startWork";
import { getGlobalSyncEngine } from "../../utils/sync/syncEngine";
import ClassChrome from "../classes/ClassChrome";
import { phaseBadge } from "./AssignmentsTab";
import InstructionsView from "./InstructionsView";

/**
 * The student/staff assignment detail page — /classes/:id/assignments/:aid,
 * mounted inside ClassChrome like AssignmentsTab (the list tab). Spec §6.2:
 * one big button, Start work / Continue depending on `myWork`, wired to
 * startWork.js's startAssignmentWork (the D§2 sequence: private copy saved
 * locally, pushed to the server, then linked via POST /start) and landing
 * back at "/" — the IDE lives there and finds the context itself (Task 11).
 *
 * The button is gated on exactly the phases the server's own /start route
 * accepts (open, late_window) so it can never promise something the API
 * will 400 on a moment later.
 *
 * Submit (Task 14) sits beside it once `myWork` exists, gated the same way
 * (open/late_window — the D§11.2 returned-mark reopen is a backend-only
 * guarantee until Task 18 wires its own UI). Same client order as
 * BriefPane's footer: push the linked project's current local copy FIRST
 * (`engine.pushProject`), THEN POST — the snapshot must be what the student
 * sees, never a race against an unpushed edit.
 */

/** The one honest sentence next to a gated button — never leaves someone
 *  guessing why Start work / Continue is unavailable. */
function gateSentence(phase) {
  switch (phase) {
    case "draft":
      return "This assignment hasn't been published yet.";
    case "scheduled":
      return "This assignment hasn't opened yet.";
    case "closed":
      return "This assignment is closed.";
    case "marks_released":
      return "This assignment is closed — marks have been released.";
    default:
      return null;
  }
}

export default function AssignmentPage() {
  return <ClassChrome tab="assignments">{(c, me) => <AssignmentBody classData={c} me={me} />}</ClassChrome>;
}

function AssignmentBody({ classData, me }) {
  const { id, aid } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const isStaff = classData.myRole === "teacher" || classData.myRole === "ta";

  const q = useQuery({
    queryKey: ["assignment", aid],
    queryFn: () => api(`/api/assignments/${aid}`),
  });

  const start = useMutation({
    mutationFn: (assignment) => startAssignmentWork({ assignment, me }),
    onSuccess: () => navigate("/"),
    onError: (err) => setError(err.message),
  });

  const submit = useMutation({
    mutationFn: async (assignment) => {
      const engine = await getGlobalSyncEngine();
      await engine.pushProject(assignment.myWork.projectId, me.id); // push FIRST — the snapshot must be what the student sees
      assertPushSucceeded(engine);
      return api(`/api/assignments/${assignment.id}/submit`, { method: "POST" });
    },
    onSuccess: (data) => {
      setSubmitError(null);
      setSubmitResult(data.submission);
    },
    onError: (err) => {
      setSubmitResult(null);
      setSubmitError(err.message);
    },
  });

  if (q.isLoading) return null;
  if (q.error) {
    return (
      <div className="page-body">
        <div className="alert alert--danger" role="alert">
          {q.error.message}
        </div>
        <Link className="btn" to={`/classes/${id}`}>
          Back to assignments
        </Link>
      </div>
    );
  }
  const assignment = q.data?.assignment;
  if (!assignment) return null;

  const badge = phaseBadge(assignment.phase);
  const gated = gateSentence(assignment.phase);
  const buttonLabel = assignment.myWork ? "Continue" : "Start work";
  const canSubmit =
    !!assignment.myWork && (assignment.phase === "open" || assignment.phase === "late_window");
  const submitLate = assignment.phase === "late_window";

  return (
    <div className="page-body">
      <div className="assignment-page-header">
        {/* h2, not h1 — InstructionsView's own heading levels step down
            from here (attrs.level 2 renders h3), same convention GuidePage
            and InstructionsView.js document. */}
        <h2>{assignment.title}</h2>
        <span className={badge.cls}>{badge.label}</span>
      </div>
      {assignment.dueAt ? (
        <p className="assignment-row__due">due {new Date(assignment.dueAt).toLocaleString()}</p>
      ) : null}

      <InstructionsView doc={assignment.instructions} />

      {error ? (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      ) : null}

      {canSubmit && submitLate ? (
        <p className="auth-text auth-text--dim" role="status">
          The due date has passed — this submission will carry a permanent late label.
        </p>
      ) : null}

      <div className="assignments-actions">
        <button
          className="btn btn--primary"
          type="button"
          disabled={!!gated || start.isPending}
          onClick={() => start.mutate(assignment)}
        >
          {buttonLabel}
        </button>
        {canSubmit ? (
          <button
            className="btn btn--primary"
            type="button"
            disabled={submit.isPending}
            onClick={() => submit.mutate(assignment)}
          >
            Submit
          </button>
        ) : null}
        {isStaff ? (
          <>
            <Link className="btn" to={`/classes/${id}/assignments/${aid}/edit`}>
              Edit
            </Link>
            <Link className="btn" to={`/classes/${id}/assignments/${aid}/inbox`}>
              Submissions
            </Link>
          </>
        ) : null}
      </div>
      {gated ? (
        <p className="auth-text auth-text--dim" role="status">
          {gated}
        </p>
      ) : null}

      {submitResult ? (
        <div className="alert alert--success" role="status">
          Submitted — attempt {submitResult.attempt}. Fingerprint{" "}
          <code>{submitResult.fingerprint.slice(0, 8)}</code>.
        </div>
      ) : null}
      {submitError ? (
        <div className="alert alert--danger" role="alert">
          {submitError}
        </div>
      ) : null}
    </div>
  );
}
