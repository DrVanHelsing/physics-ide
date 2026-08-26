import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import ClassChrome from "../classes/ClassChrome";

/**
 * The Guides tab (/classes/:id/guides) — a card list in the same shape as
 * AssignmentsTab's, reusing its `.assignment-list`/`.assignment-row` CSS:
 * guides are "the same format" as an assignment's instructions, published
 * standalone, so the list they're browsed from looks the same too.
 */
export default function GuidesTab() {
  return <ClassChrome tab="guides">{(c) => <GuidesBody classData={c} />}</ClassChrome>;
}

function GuidesBody({ classData }) {
  const { id } = useParams();
  const isStaff = classData.myRole === "teacher" || classData.myRole === "ta";
  const q = useQuery({
    queryKey: ["class", id, "guides"],
    queryFn: () => api(`/api/classes/${id}/guides`),
  });
  const list = q.data?.guides ?? [];
  return (
    <div className="page-body">
      {classData.myRole === "teacher" ? (
        <div className="assignments-actions">
          <Link className="btn" to={`/classes/${id}/guides/new`}>New guide</Link>
        </div>
      ) : null}
      {q.error ? <div className="alert alert--danger" role="alert">{q.error.message}</div> : null}
      {list.length === 0 && !q.isLoading ? (
        <p className="empty">
          {isStaff
            ? "No guides yet — create the first one."
            : "Nothing here yet. Your teacher's guides will appear here."}
        </p>
      ) : (
        <ul className="assignment-list">
          {list.map((g) => (
            <li key={g.id}>
              <Link className="card card--interactive assignment-row" to={`/classes/${id}/guides/${g.id}`}>
                <span className="assignment-row__title">{g.title}</span>
                {isStaff && !g.publishedAt ? <span className="badge badge--warning">draft</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
