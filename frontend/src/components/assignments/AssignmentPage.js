import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
 *
 * Task 22 adds the group panel below the instructions for pair/group work —
 * spec §6.2's "this is also where students pick or see their group" — and
 * gates Start work on being in one, because /start refuses outright until
 * then. Group work's own project I/O never goes near the personal sync
 * engine; see utils/assignments/groupSync.js.
 */

/** groups.ts's own refusal for starting group work ungrouped. Mirrored here
 *  so the button is gated on it rather than promising a 400. */
const JOIN_A_GROUP_FIRST = "Join a group before starting this assignment.";

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

/**
 * The group panel — spec §5.5 ("students group themselves from the class
 * list, first-come, capped at the group size") on the surface §6.2 puts it:
 * "For pair/group assignments, this is also where students pick or see
 * their group."
 *
 * Every refusal the routes can give ("That group is full.", "This group has
 * already submitted.", "You are already in a group for this assignment.")
 * is the server's own sentence and is shown verbatim — this panel never
 * writes its own version of why something was refused.
 *
 * Staff see the roster but get no controls: a group's membership is what
 * Task 23 credits a submission to, and a teacher sitting in a student group
 * would poison that. (The server-side guard for it lands with Task 23; this
 * is the surface half.)
 */
function GroupPanel({ assignment, isStaff }) {
  const qc = useQueryClient();
  const [error, setError] = useState(null);

  const q = useQuery({
    queryKey: ["assignment", assignment.id, "groups"],
    queryFn: () => api(`/api/assignments/${assignment.id}/groups`),
    retry: false,
  });

  // The detail query's key is a PREFIX of this one, so one invalidation
  // refreshes both: the roster here, and myGroup/myWork on the page around it.
  const refresh = () => qc.invalidateQueries({ queryKey: ["assignment", assignment.id] });
  const mutationOpts = {
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: (err) => setError(err.message),
  };

  const create = useMutation({
    // An explicit empty body, not a bodyless POST: this is the one group
    // route that parses a body schema (the optional `name`), and `{}` is the
    // shape groups.test.ts proves it accepts. Join/leave/take carry none.
    mutationFn: () => api(`/api/assignments/${assignment.id}/groups`, { method: "POST", body: {} }),
    ...mutationOpts,
  });
  const join = useMutation({
    mutationFn: (gid) => api(`/api/groups/${gid}/join`, { method: "POST" }),
    ...mutationOpts,
  });
  const leave = useMutation({
    mutationFn: (gid) => api(`/api/groups/${gid}/leave`, { method: "POST" }),
    ...mutationOpts,
  });

  const groups = q.data?.groups ?? [];
  const capacity = q.data?.capacity ?? null;
  const myGroup = assignment.myGroup ?? null;
  const busy = create.isPending || join.isPending || leave.isPending;

  return (
    <section className="card group-panel">
      <h3>Groups</h3>
      {/* The whole roster is shown either way ("pick or SEE their group"), so
          which one is yours is said outright rather than left to be inferred
          from which row happens to carry a Leave button. */}
      {myGroup ? <p className="auth-text auth-text--dim">You are in {myGroup.name}.</p> : null}
      {q.error ? (
        <div className="alert alert--danger" role="alert">
          {q.error.message}
        </div>
      ) : null}
      {groups.length === 0 && !q.isLoading && !q.error ? (
        <p className="empty">No groups yet.</p>
      ) : null}
      {groups.length > 0 ? (
        <ul className="group-list">
          {groups.map((g) => (
            <li className="group-row" key={g.id}>
              <span className="group-row__name">{g.name}</span>
              <span className="group-row__members">
                {g.members.length > 0 ? g.members.map((m) => m.name).join(", ") : "Nobody yet"}
              </span>
              {capacity != null ? (
                <span className="badge">
                  {g.members.length}/{capacity}
                </span>
              ) : null}
              {isStaff ? null : myGroup?.id === g.id ? (
                <button
                  className="btn btn--sm btn--danger"
                  type="button"
                  disabled={busy}
                  onClick={() => leave.mutate(g.id)}
                >
                  Leave
                </button>
              ) : myGroup ? null : (
                <button
                  className="btn btn--sm"
                  type="button"
                  disabled={busy || (capacity != null && g.members.length >= capacity)}
                  onClick={() => join.mutate(g.id)}
                >
                  Join
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {!isStaff && !myGroup ? (
        <button className="btn" type="button" disabled={busy} onClick={() => create.mutate()}>
          Create a group
        </button>
      ) : null}
      {error ? (
        <div className="alert alert--danger" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
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
      // Group work's projectId names the FOUNDING member's project — a row
      // this member may not own, so the personal engine must never be asked
      // to push it (that would plant a copy of someone else's work under
      // their account). The group's head is already current: every group
      // save goes straight through the group route as it happens. Group
      // submit itself is Task 23.
      if (!assignment.myGroup) {
        const engine = await getGlobalSyncEngine();
        await engine.pushProject(assignment.myWork.projectId, me.id); // push FIRST — the snapshot must be what the student sees
        assertPushSucceeded(engine);
      }
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
  // Pair/group work: /start refuses outright until the caller is in a group
  // — staff included — so the button is gated on that too rather than
  // promising something the API will 400 on a moment later.
  const isGroupWork = assignment.submissionMode === "pair" || assignment.submissionMode === "group";
  const needsGroup = isGroupWork && !assignment.myGroup;
  const gated = gateSentence(assignment.phase) ?? (needsGroup ? JOIN_A_GROUP_FIRST : null);
  const buttonLabel = assignment.myWork ? "Continue" : "Start work";
  const myMark = assignment.myMark ?? null;
  // Fiat D§11.2: a returned, unreleased mark reopens submission even while
  // Closed — the same server-side rule Task 14's submit route enforces
  // (returned && status !== released). Mirrored here so the button is
  // never hidden from a case the server would actually accept.
  const reopenedByReturn = !!myMark?.returned && !myMark?.released;
  const canSubmit =
    !!assignment.myWork &&
    (assignment.phase === "open" || assignment.phase === "late_window" || (assignment.phase === "closed" && reopenedByReturn));
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

      {isGroupWork ? <GroupPanel assignment={assignment} isStaff={isStaff} /> : null}

      {myMark?.released ? (
        <div className="card">
          <h3>Feedback</h3>
          <p>
            {assignment.points != null
              ? `Score: ${myMark.points ?? "—"}/${assignment.points}`
              : "Marked complete."}
          </p>
          {myMark.comment ? <p>{myMark.comment}</p> : null}
        </div>
      ) : null}
      {myMark?.returned ? (
        <div className="alert alert--warning" role="status">
          <p>{myMark.comment}</p>
          <p>You can resubmit.</p>
        </div>
      ) : null}

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
