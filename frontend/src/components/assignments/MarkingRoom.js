import React, { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import { createManifest } from "../../utils/manifest/factory";
import { saveProject } from "../../utils/storage/projectStore";
import { requestProjectOpen } from "../../utils/projectOpenRequest";
import { LAST_PROJECT_KEY } from "../../constants";
import PortalHeader from "../layout/PortalHeader";
import SubmissionViewer from "./SubmissionViewer";
import HistoryTimeline, { buildTimelineEntries } from "./HistoryTimeline";

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
 *     touching the student's), stamps LAST_PROJECT_KEY, announces the copy
 *     (projectOpenRequest.js — the stamp alone only answers a reload, and
 *     this navigation is client-side), and navigates to "/" — the full IDE,
 *     with Run and debug mode, opens on the copy.
 *   - **Previous / Next**: walk Task 16's inbox row order (query key
 *     ["assignment", aid, "inbox"], shared verbatim with InboxPage.js) so
 *     marking a set of submissions is one continuous flow, never a trip
 *     back to the inbox between students (spec §7.2). A marker who lands
 *     here straight from the inbox reuses its already-cached rows; a
 *     direct link fetches them itself.
 *
 * Task 18 adds the marking panel beside SubmissionViewer (MarkPanel below),
 * plus the History timeline panel deferred by Task 20 (its own report's
 * "Deferred mount" section — the exact snippet lands here, fed by
 * GET /api/assignments/:id/timeline/:studentId).
 */

const STAFF_ONLY = "Teachers and assistants only for this class.";

function gatedPage(title, body, back) {
  return (
    <div className="page">
      <PortalHeader home="/classes" title={title} back={back} />
      <div className="page-body">{body}</div>
    </div>
  );
}

export default function MarkingRoom() {
  const { id, aid, studentId, gid } = useParams();
  const navigate = useNavigate();
  const [copyError, setCopyError] = useState(null);
  const [copying, setCopying] = useState(false);
  // Task 23: the same room on a GROUP row. The URL carries a group id
  // (/marking/group/:gid) instead of a student id, and both cross-user reads
  // swing to the group's own endpoints — a group's work row and submission
  // are keyed by the group, so the student-keyed routes would 404.
  const isGroup = !!gid;
  const target = isGroup ? `group/${gid}` : studentId;

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
    retry: false,
  });
  const submissionQuery = useQuery({
    queryKey: ["assignment", aid, "submission", target],
    queryFn: () => api(`/api/assignments/${aid}/submissions/${target}`),
    enabled: !!me,
    retry: false,
  });
  // Task 16's own query, key-for-key — a cache hit if the marker arrived
  // from the inbox, a fresh fetch (once that route exists) otherwise.
  const inboxQuery = useQuery({
    queryKey: ["assignment", aid, "inbox"],
    queryFn: () => api(`/api/assignments/${aid}/inbox`),
    enabled: !!me,
  });
  // Task 20's teacher feed — the History panel below (deferred mount,
  // landed here per that task's report).
  const timelineQuery = useQuery({
    queryKey: ["assignment", aid, "timeline", target],
    queryFn: () => api(`/api/assignments/${aid}/timeline/${target}`),
    enabled: !!me,
  });

  // Every exit from this room, gated or not, leads to the inbox it was opened
  // from (F2, 2026-08-28 — this file held zero <Link>s and the wordmark was
  // the only escape). A class read that failed is the one case where the inbox
  // is not knowably reachable either, so that branch aims at the class wall.
  const backToInbox = { to: `/classes/${id}/assignments/${aid}/inbox`, label: "Back to inbox" };

  if (meLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (classQuery.isLoading) return null;
  if (classQuery.error) {
    return gatedPage(
      "Marking",
      <div className="alert alert--danger" role="alert">
        {classQuery.error.message}
      </div>,
      { to: "/classes", label: "Back to my classes" },
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
      { to: `/classes/${id}`, label: "Back to the class" },
    );
  }

  if (assignmentQuery.isLoading || submissionQuery.isLoading) return null;
  if (assignmentQuery.error) {
    return gatedPage(
      "Marking",
      <div className="alert alert--danger" role="alert">
        {assignmentQuery.error.message}
      </div>,
      backToInbox,
    );
  }
  if (submissionQuery.error) {
    return gatedPage(
      "Marking",
      <div className="alert alert--danger" role="alert">
        {submissionQuery.error.message}
      </div>,
      backToInbox,
    );
  }
  const assignment = assignmentQuery.data?.assignment;
  const submission = submissionQuery.data?.submission;
  if (!assignment || !submission) return null;

  // Task 16's inbox rows in submission order. Not required for the room to
  // render: a missing/still-loading inbox just means Previous/Next stay
  // disabled rather than blocking the page. Task 23: the list can now mix
  // student rows and group rows, so each step carries which KIND it is —
  // the two land on different URLs.
  const order = (inboxQuery.data?.rows ?? []).map((r) =>
    r.kind === "group" ? { group: true, id: r.groupId } : { group: false, id: r.studentId },
  );
  const idx = order.findIndex((o) => o.id === (isGroup ? gid : studentId));
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  // Whose work this is, said once: a group has no one student to name.
  const markedName = isGroup ? submission.groupName : submission.studentName;

  function goTo(step) {
    const suffix = step.group ? `group/${step.id}` : step.id;
    navigate(`/classes/${id}/assignments/${aid}/marking/${suffix}`);
  }

  async function openTestCopy() {
    setCopyError(null);
    setCopying(true);
    try {
      const manifest = createManifest({
        goal: assignment.projectType,
        workspaceXml: submission.workspaceXml,
        python: submission.python,
        title: `Test copy — ${markedName} — ${assignment.title}`,
      });
      const saved = await saveProject(manifest);
      try {
        localStorage.setItem(LAST_PROJECT_KEY, saved.id);
      } catch {
        /* storage blocked */
      }
      // The stamp answers a reload; this answers the client-side navigation
      // on the next line, which remounts nothing (see projectOpenRequest.js).
      requestProjectOpen(saved.id);
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
        back={backToInbox}
        title={
          <span className="marking-room__header">
            {markedName}
            {isGroup ? (
              <span className="marking-room__members">
                {(submission.members ?? []).map((m) => m.name).join(", ")}
              </span>
            ) : null}
            <span className="badge">Attempt {submission.attempt}</span>
            {submission.late ? <span className="badge badge--warning">late</span> : null}
            <code className="marking-room__fingerprint">{submission.fingerprint}</code>
          </span>
        }
        nav={
          <div className="marking-room__nav">
            <button className="btn" type="button" disabled={!prev} onClick={() => goTo(prev)}>
              Previous
            </button>
            <button className="btn" type="button" disabled={!next} onClick={() => goTo(next)}>
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
        <div className="marking-room__workspace">
          <SubmissionViewer workspaceXml={submission.workspaceXml} python={submission.python} />
          <MarkPanel
            key={target}
            assignment={assignment}
            submission={submission}
            /* The server returns the mark as a SIBLING of submission/history,
               not a field inside `submission` — read it where it lives. A
               group's is `groupMark`: one mark, reassembled from its
               members' rows. */
            mark={(isGroup ? submissionQuery.data?.groupMark : submissionQuery.data?.mark) ?? null}
            history={submissionQuery.data?.history ?? []}
            isTeacher={classData.myRole === "teacher"}
            aid={aid}
            studentId={studentId}
            group={
              isGroup
                ? {
                    groupId: gid,
                    // Prefer the mark's own member list (it carries each
                    // adjustment); fall back to the submission's roster
                    // before anything has been marked at all.
                    members:
                      submissionQuery.data?.groupMark?.members ??
                      (submission.members ?? []).map((m) => ({
                        studentId: m.userId,
                        name: m.name,
                        adjustment: 0,
                        points: null,
                      })),
                  }
                : null
            }
          />
        </div>
        <div className="card marking-room__history">
          <h3>History</h3>
          <HistoryTimeline
            entries={buildTimelineEntries({
              versions: timelineQuery.data?.versions ?? [],
              submissions: timelineQuery.data?.submissions ?? [],
              // A group's checkpoints have different authors, and the group
              // timeline names each one (spec §5.5) — so no constant label.
              savedByLabel: isGroup ? null : submission.studentName,
            })}
            onRestore={null}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The marking panel (Task 18, spec §7.3) — mark input, comment, private
 * note, Save draft / Return for changes / Release. `key={studentId}` on
 * the call site remounts this fresh per student (simpler and safer than
 * syncing local state via an effect every time Previous/Next changes the
 * mark underneath it).
 *
 * A points-less assignment (`assignment.points == null`) replaces the
 * numeric field with a complete/not-complete toggle — points always stay
 * null there BY CONSTRUCTION (the server enforces this too; the toggle is
 * this panel's own honest reflection of that rule, not a separate source
 * of truth). Save draft is disabled in that case until the box is
 * checked: there is no "not complete" mark to save, only the absence of
 * one, so a draft can only be produced once the marker means it.
 *
 * The Return-for-changes reason and the release-facing comment are the
 * SAME field — one comment, whichever action the marker takes with it.
 *
 * `mark` arrives as its own prop because that is its own place in the
 * server's response ({ submission, history, mark }) — reading it off
 * `submission` prefilled nothing against the real API, which meant a Save
 * draft could overwrite an existing comment and private note with empties.
 *
 * Task 23 — `group`, when given ({ groupId, members }), makes this the
 * GROUP's panel (spec §7.3): the same one mark, one comment and one private
 * note, plus a small ± field per member. `points` is then the group's own
 * figure and each member's total is `points + adjustment`, shown live so the
 * consequence of an adjustment is visible before it is saved. Every write
 * swings to the group routes; nothing else about the panel changes, because
 * a group mark IS an ordinary mark written for several people at once.
 */
function MarkPanel({ assignment, submission, mark: initialMark, history, isTeacher, aid, studentId, group }) {
  const outOf = assignment.points;
  const members = group?.members ?? [];
  const [mark, setMark] = useState(initialMark ?? null);
  const [points, setPoints] = useState(initialMark?.points != null ? String(initialMark.points) : "");
  const [complete, setComplete] = useState(!!initialMark);
  const [comment, setComment] = useState(initialMark?.comment ?? "");
  const [privateNote, setPrivateNote] = useState(initialMark?.privateNote ?? "");
  const [adjustments, setAdjustments] = useState(() =>
    Object.fromEntries(members.map((m) => [m.studentId, String(m.adjustment ?? 0)])),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveNote, setSaveNote] = useState(null);
  const [returning, setReturning] = useState(false);
  const [returnError, setReturnError] = useState(null);
  const [returnNote, setReturnNote] = useState(null);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState(null);
  const [releaseNote, setReleaseNote] = useState(null);

  // D§11.3's stale-draft guard, shown proactively — the exact same rule
  // the release route enforces (a draft written against a superseded
  // attempt), computed here from data the panel already holds.
  const staleAttempt =
    mark?.basedOnSubmissionId && mark.basedOnSubmissionId !== submission.id
      ? (history.find((h) => h.id === mark.basedOnSubmissionId)?.attempt ?? null)
      : null;

  const canSaveDraft = outOf != null || complete;
  const groupPoints = points === "" ? null : Number(points);
  const adjustmentOf = (memberId) => Number(adjustments[memberId] || 0);
  /** A member's own total — null while the group has no figure yet, so the
   *  panel never shows a number the marker has not actually chosen. */
  const totalFor = (memberId) =>
    outOf == null || groupPoints == null ? null : groupPoints + adjustmentOf(memberId);

  async function handleSaveDraft() {
    setSaveError(null);
    setSaveNote(null);
    setSaving(true);
    try {
      const body = {
        points: outOf == null ? null : groupPoints,
        comment,
        privateNote,
      };
      if (group) {
        const data = await api(`/api/assignments/${aid}/marks/group/${group.groupId}`, {
          method: "PUT",
          body: {
            ...body,
            adjustments: members.map((m) => ({ studentId: m.studentId, adjustment: adjustmentOf(m.studentId) })),
          },
        });
        setMark(data.groupMark);
      } else {
        const data = await api(`/api/assignments/${aid}/marks/${studentId}`, { method: "PUT", body });
        setMark(data.mark);
      }
      setSaveNote("Draft saved.");
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReturn() {
    setReturnError(null);
    setReturnNote(null);
    if (comment.trim().length === 0) {
      setReturnError("A comment explaining the return is required.");
      return;
    }
    setReturning(true);
    try {
      const url = group
        ? `/api/assignments/${aid}/marks/group/${group.groupId}/return`
        : `/api/assignments/${aid}/marks/${studentId}/return`;
      const data = await api(url, { method: "POST", body: { comment } });
      setMark(group ? data.groupMark : data.mark);
      setReturnNote("Sent back for changes.");
    } catch (err) {
      setReturnError(err.message);
    } finally {
      setReturning(false);
    }
  }

  async function handleRelease() {
    setReleaseError(null);
    setReleaseNote(null);
    setReleasing(true);
    try {
      // One mark for the group means one release for the group: every
      // member's row, in the one call the server already fans out from.
      const data = await api(`/api/assignments/${aid}/marks/release`, {
        method: "POST",
        body: { studentIds: group ? members.map((m) => m.studentId) : [studentId] },
      });
      if (data.refused?.length) {
        setReleaseError(data.refused[0].error);
      } else {
        // Releasing ends any return episode (server ruling R5) — mirror
        // that here so the panel never shows "released · returned".
        setMark((m) => (m ? { ...m, status: "released", returned: false } : m));
        setReleaseNote("Released.");
      }
    } catch (err) {
      setReleaseError(err.message);
    } finally {
      setReleasing(false);
    }
  }

  return (
    <div className="card marking-panel">
      <h3>{group ? "Mark for the group" : "Mark"}</h3>
      {outOf != null ? (
        <label className="marking-panel__field">
          Points (out of {outOf})
          <input
            className="input"
            type="number"
            min="0"
            max={outOf}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </label>
      ) : (
        <label className="marking-panel__field marking-panel__checkbox">
          <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />
          Mark complete
        </label>
      )}
      {/* Spec §5.5: one mark for the group, "with the teacher free to adjust
          an individual member's mark up or down where contribution clearly
          warrants it". A points-less assignment has no total to adjust
          against, so the fields are simply not offered there — the same rule
          the server holds. */}
      {group && outOf != null ? (
        <div className="marking-panel__members">
          <p className="marking-panel__members-label">Per-member adjustment</p>
          {members.map((m) => {
            const total = totalFor(m.studentId);
            return (
              <label className="marking-panel__member" key={m.studentId}>
                <span className="marking-panel__member-name">{m.name}</span>
                <input
                  className="input"
                  type="number"
                  step="1"
                  value={adjustments[m.studentId] ?? "0"}
                  onChange={(e) =>
                    setAdjustments((prev) => ({ ...prev, [m.studentId]: e.target.value }))
                  }
                />
                <span className="marking-panel__member-total">
                  {total == null ? "—" : `${total}/${outOf}`}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}

      <label className="marking-panel__field">
        Comment
        <textarea
          className="input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="Feedback for the student — also the reason if you return this for changes."
        />
      </label>
      <label className="marking-panel__field">
        Private — teachers and TAs only
        <textarea
          className="input"
          value={privateNote}
          onChange={(e) => setPrivateNote(e.target.value)}
          rows={3}
        />
      </label>

      {staleAttempt != null ? (
        <p className="alert alert--warning" role="status">
          Written against attempt {staleAttempt} — a newer attempt exists. Re-save before releasing.
        </p>
      ) : null}

      <div className="assignments-actions">
        <button className="btn" type="button" disabled={!canSaveDraft || saving} onClick={handleSaveDraft}>
          Save draft
        </button>
        <button className="btn btn--danger" type="button" disabled={returning} onClick={handleReturn}>
          Return for changes
        </button>
        {isTeacher ? (
          <button
            className="btn btn--primary"
            type="button"
            disabled={!mark || mark.status === "released" || releasing}
            onClick={handleRelease}
          >
            Release
          </button>
        ) : null}
      </div>

      {saveError ? (
        <div className="alert alert--danger" role="alert">
          {saveError}
        </div>
      ) : null}
      {saveNote ? (
        <div className="alert alert--success" role="status">
          {saveNote}
        </div>
      ) : null}
      {returnError ? (
        <div className="alert alert--danger" role="alert">
          {returnError}
        </div>
      ) : null}
      {returnNote ? (
        <div className="alert alert--success" role="status">
          {returnNote}
        </div>
      ) : null}
      {releaseError ? (
        <div className="alert alert--danger" role="alert">
          {releaseError}
        </div>
      ) : null}
      {releaseNote ? (
        <div className="alert alert--success" role="status">
          {releaseNote}
        </div>
      ) : null}

      {mark ? (
        <p className="auth-text auth-text--dim">
          Status: {mark.status}
          {mark.returned ? " · returned" : ""}
        </p>
      ) : (
        <p className="empty">No mark yet.</p>
      )}
    </div>
  );
}
