import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import ClassChrome from "../classes/ClassChrome";
import SharedWithYou from "../sharing/SharedWithYou";

export function phaseBadge(phase) {
  switch (phase) {
    case "open":           return { label: "open", cls: "badge badge--success" };
    case "late_window":    return { label: "late window", cls: "badge badge--warning" };
    case "scheduled":      return { label: "scheduled", cls: "badge badge--accent" };
    case "draft":          return { label: "draft", cls: "badge badge--warning" };
    case "marks_released": return { label: "marks released", cls: "badge badge--accent" };
    default:               return { label: "closed", cls: "badge" };
  }
}

export default function AssignmentsTab() {
  return (
    <ClassChrome tab="assignments">
      {(c, me) => <AssignmentsBody classData={c} me={me} />}
    </ClassChrome>
  );
}

function AssignmentsBody({ classData }) {
  const { id } = useParams();
  const isStaff = classData.myRole === "teacher" || classData.myRole === "ta";
  const q = useQuery({
    queryKey: ["class", id, "assignments"],
    queryFn: () => api(`/api/classes/${id}/assignments`),
  });
  const list = q.data?.assignments ?? [];
  return (
    <div className="page-body">
      <SharedWithYou classId={id} />
      {classData.myRole === "teacher" ? (
        <div className="assignments-actions">
          <Link className="btn" to={`/classes/${id}/assignments/new`}>New assignment</Link>
        </div>
      ) : null}
      {q.error ? <div className="alert alert--danger" role="alert">{q.error.message}</div> : null}
      {list.length === 0 && !q.isLoading ? (
        <p className="empty">
          {isStaff
            ? "No assignments yet — create the first one."
            : "Nothing here yet. Your teacher's assignments will appear here."}
        </p>
      ) : (
        <ul className="assignment-list">
          {list.map((a) => {
            const badge = phaseBadge(a.phase);
            return (
              <li key={a.id}>
                <Link className="card card--interactive assignment-row" to={`/classes/${id}/assignments/${a.id}`}>
                  <span className="assignment-row__title">{a.title}</span>
                  <span className={badge.cls}>{badge.label}</span>
                  {a.dueAt ? (
                    <span className="assignment-row__due">
                      due {new Date(a.dueAt).toLocaleDateString()}
                    </span>
                  ) : null}
                  {typeof a.submittedCount === "number" ? (
                    <span className="assignment-row__count">{a.submittedCount} submitted</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
