import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { BellIcon } from "../Icons";
import ClassChrome from "../classes/ClassChrome";

/**
 * The inbox — /classes/:id/assignments/:aid/inbox. Every active roster
 * student, submitted or missing, on one screen (Plan 6 Task 16). Mounted
 * inside ClassChrome like AssignmentPage/PeopleTab; `tab="assignments"`
 * keeps the Assignments tab lit since this is a sub-page of it, same
 * convention AssignmentPage.js itself already uses.
 *
 * One query — `["assignment", aid, "inbox"]` — backs the whole page; the
 * four filter tabs (All/Submitted/Late/Missing/Marked) are client-side
 * slices over that single result, never separate requests.
 *
 * Task 23: a pair/group assignment answers with one row per GROUP (`kind:
 * "group"`, members named) plus a row for any rostered student who never
 * joined one. The filters are unchanged — a group row carries the same
 * state/late/markStatus fields a student row does — and only the link
 * target and the reminder's headcount differ.
 */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "submitted", label: "Submitted" },
  { key: "late", label: "Late" },
  { key: "missing", label: "Missing" },
  { key: "marked", label: "Marked" },
];

/** Fiat D§11.1: "missing" softens to "not yet submitted" while the
 *  assignment is still open — same row state, a kinder label before the
 *  due date has actually passed. */
function stateBadge(row, phase) {
  if (row.state === "missing") {
    return phase === "open"
      ? { label: "not yet submitted", cls: "badge" }
      : { label: "missing", cls: "badge badge--danger" };
  }
  return row.late
    ? { label: "late", cls: "badge badge--warning" }
    : { label: "submitted", cls: "badge badge--success" };
}

function markBadge(status) {
  switch (status) {
    case "released":
      return { label: "released", cls: "badge badge--accent" };
    case "draft":
      return { label: "draft", cls: "badge badge--warning" };
    default:
      return { label: "not marked", cls: "badge" };
  }
}

function matchesFilter(row, filter) {
  switch (filter) {
    case "submitted":
      return row.state === "submitted";
    case "late":
      return row.state === "submitted" && row.late;
    case "missing":
      return row.state === "missing";
    case "marked":
      return row.markStatus !== "none";
    default:
      return true;
  }
}

export default function InboxPage() {
  const { id, aid } = useParams();
  // This screen's own "Back to assignment" link is the one the 2026-08-28 UI
  // audit called the single correct back affordance in the product. It has
  // been generalised (BackLink.js) and moved into the header region, so it no
  // longer sits in the body styled as a dim caption.
  return (
    <ClassChrome
      tab="assignments"
      back={{ to: `/classes/${id}/assignments/${aid}`, label: "Back to assignment" }}
    >
      {(c) => <InboxBody classData={c} />}
    </ClassChrome>
  );
}

function InboxBody({ classData }) {
  const { id, aid } = useParams();
  const isTeacher = classData.myRole === "teacher";
  const isStaff = isTeacher || classData.myRole === "ta";
  const [filter, setFilter] = useState("all");
  const [remindNote, setRemindNote] = useState(null);
  const [remindError, setRemindError] = useState(null);
  const [releaseNote, setReleaseNote] = useState(null);
  const [releaseError, setReleaseError] = useState(null);

  const q = useQuery({
    queryKey: ["assignment", aid, "inbox"],
    queryFn: () => api(`/api/assignments/${aid}/inbox`),
    enabled: isStaff,
  });

  const remind = useMutation({
    mutationFn: () => api(`/api/assignments/${aid}/remind`, { method: "POST", body: {} }),
    onSuccess: (data) => {
      setRemindError(null);
      // Scoped, not "Reminded N students": POST /remind really does compose a
      // dueReminder per recipient, but the only Mailer implementation writes
      // rows the admin console's Emails tab reads — delivery is a §9
      // exclusion. Same wording pattern TeachersPage.js uses for the same
      // button, so the two surfaces agree about where the message goes.
      setRemindNote(
        `Reminder written for ${data.reminded} student${data.reminded === 1 ? "" : "s"} — it lands in the Emails log rather than being posted out.`,
      );
    },
    onError: (err) => {
      setRemindNote(null);
      setRemindError(err.message);
    },
  });

  // Task 18: release every draft mark on this assignment in one go, and
  // flip the assignment's own status to marks_released (the server does
  // both in one call — { all: true }).
  const releaseAll = useMutation({
    mutationFn: () => api(`/api/assignments/${aid}/marks/release`, { method: "POST", body: { all: true } }),
    onSuccess: (data) => {
      setReleaseError(null);
      const refusedCount = data.refused?.length ?? 0;
      const skippedNote =
        refusedCount > 0
          ? ` ${refusedCount} skipped — written against a previous attempt.`
          : "";
      setReleaseNote(
        `Released ${data.released.length} mark${data.released.length === 1 ? "" : "s"}.${skippedNote}`,
      );
    },
    onError: (err) => {
      setReleaseNote(null);
      setReleaseError(err.message);
    },
  });

  if (!isStaff) {
    return (
      <div className="page-body">
        <div className="alert alert--danger" role="alert">
          Teachers and assistants only.
        </div>
        <Link className="btn" to={`/classes/${id}/assignments/${aid}`}>
          Back to assignment
        </Link>
      </div>
    );
  }

  if (q.isLoading) return null;
  if (q.error) {
    return (
      <div className="page-body">
        <div className="alert alert--danger" role="alert">
          {q.error.message}
        </div>
        <Link className="btn" to={`/classes/${id}/assignments/${aid}`}>
          Back to assignment
        </Link>
      </div>
    );
  }

  const rows = q.data?.rows ?? [];
  const phase = q.data?.phase;
  const total = rows.length;
  const submittedCount = rows.filter((r) => r.state === "submitted").length;
  const missingRows = rows.filter((r) => r.state === "missing");
  // Task 23: a group row is ONE hand-in but several people. The progress line
  // counts hand-ins (rows); the reminder counts the emails it will send.
  const missingPeople = missingRows.reduce(
    (n, r) => n + (r.kind === "group" ? r.members.length : 1),
    0,
  );
  const pct = total > 0 ? Math.round((submittedCount / total) * 100) : 0;
  const filtered = rows.filter((r) => matchesFilter(r, filter));

  function handleRemind() {
    setRemindNote(null);
    setRemindError(null);
    // The exact consequence sentence — its own precise wording is the point,
    // and the consequence is a written message, not a delivered one.
    const ok = window.confirm(
      `Write a reminder for ${missingPeople} students who have not submitted? It lands in the Emails log rather than being posted out.`,
    );
    if (!ok) return;
    remind.mutate();
  }

  function handleReleaseAll() {
    setReleaseNote(null);
    setReleaseError(null);
    const ok = window.confirm("Release all marks for this assignment? Students will be notified by email.");
    if (!ok) return;
    releaseAll.mutate();
  }

  return (
    <div className="page-body page-body--wide">
      <div className="assignment-page-header">
        <h2>Inbox</h2>
      </div>

      <p className="inbox-progress-line">
        {submittedCount} of {total} submitted
      </p>
      <div
        className="inbox-progress-bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="inbox-progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>

      <nav className="tabs inbox-filters" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className="tab"
            aria-current={filter === f.key ? "page" : undefined}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </nav>

      {isTeacher ? (
        <div className="assignments-actions inbox-actions">
          <button
            className="btn"
            type="button"
            disabled={missingRows.length === 0 || remind.isPending}
            onClick={handleRemind}
          >
            <BellIcon size={14} /> Remind
          </button>
          <button
            className="btn btn--primary"
            type="button"
            disabled={releaseAll.isPending}
            onClick={handleReleaseAll}
          >
            Release all
          </button>
        </div>
      ) : null}
      {remindNote ? (
        <div className="alert alert--success" role="status">
          {remindNote}
        </div>
      ) : null}
      {remindError ? (
        <div className="alert alert--danger" role="alert">
          {remindError}
        </div>
      ) : null}
      {releaseNote ? (
        <div className="alert alert--success" role="status">
          {releaseNote}
        </div>
      ) : null}
      {releaseError ? (
        <div className="alert alert--danger" role="alert">
          {releaseError}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="empty">Nothing here.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Attempt</th>
              <th>Mark</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const badge = stateBadge(r, phase);
              const mark = markBadge(r.markStatus);
              // Task 23: a group's row IS the group — its name links into the
              // group marking room, and its members are named beneath it so
              // "who is this?" never needs a second screen.
              const isGroup = r.kind === "group";
              const href = isGroup
                ? `/classes/${id}/assignments/${aid}/marking/group/${r.groupId}`
                : `/classes/${id}/assignments/${aid}/marking/${r.studentId}`;
              return (
                <tr key={r.groupId ?? r.studentId}>
                  <td>
                    <Link to={href}>{r.name}</Link>
                    {isGroup ? (
                      <span className="inbox-row__members">{r.members.map((m) => m.name).join(", ")}</span>
                    ) : null}
                  </td>
                  <td>
                    <span className={badge.cls}>{badge.label}</span>
                  </td>
                  <td>{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                  <td>{r.attempt ?? "—"}</td>
                  <td>
                    <span className={mark.cls}>{mark.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
