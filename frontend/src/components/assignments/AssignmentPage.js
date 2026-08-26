import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { startAssignmentWork } from "../../utils/assignments/startWork";
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

      <div className="assignments-actions">
        <button
          className="btn btn--primary"
          type="button"
          disabled={!!gated || start.isPending}
          onClick={() => start.mutate(assignment)}
        >
          {buttonLabel}
        </button>
        {isStaff ? (
          <>
            <Link className="btn" to={`/classes/${id}/assignments/${aid}/edit`}>
              Edit
            </Link>
            {/* Points at Task 16's inbox route, but that route doesn't exist
                yet — disabled with an honest title rather than a dead link. */}
            <button className="btn" type="button" disabled title="Arrives with marking">
              Submissions
            </button>
          </>
        ) : null}
      </div>
      {gated ? (
        <p className="auth-text auth-text--dim" role="status">
          {gated}
        </p>
      ) : null}
    </div>
  );
}
