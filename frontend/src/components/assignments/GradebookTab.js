import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { DownloadIcon } from "../Icons";
import ClassChrome from "../classes/ClassChrome";

/**
 * The gradebook tab (/classes/:id/gradebook) — staff-only prep grid: every
 * active student down, every assignment across, one read (Task 19, D§11.5).
 * A TA sees draft mark values too, flagged as drafts rather than hidden —
 * the grid exists to preview where release stands, not to gate anything a
 * TA is already allowed to see. Students never reach this route at all
 * (backend staff gate, same idiom GET /members uses).
 *
 * The table renders inside its own .admin-table-wrap: a wide roster or a
 * long assignment list scrolls horizontally WITHIN that wrapper — the page
 * itself must never gain a horizontal scrollbar.
 */
export default function GradebookTab() {
  return <ClassChrome tab="gradebook">{(c) => <GradebookBody classData={c} />}</ClassChrome>;
}

function GradebookBody({ classData }) {
  const { id } = useParams();
  const q = useQuery({
    queryKey: ["class", id, "gradebook"],
    queryFn: () => api(`/api/classes/${id}/gradebook`),
  });
  const students = q.data?.students ?? [];
  const assignmentList = q.data?.assignments ?? [];
  const cells = q.data?.cells ?? [];
  const cellByKey = new Map(cells.map((c) => [`${c.studentId}:${c.assignmentId}`, c]));

  function handleExport() {
    const csv = gradebookCsvString({ students, assignments: assignmentList, cellByKey });
    // BOM keeps Excel from mangling — em dash and the checkmark — as
    // anything but UTF-8 the moment the file is double-clicked.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${classData.name} gradebook.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-body">
      {q.error ? (
        <div className="alert alert--danger" role="alert">
          {q.error.message}
        </div>
      ) : null}
      <div className="assignments-actions">
        <button
          className="btn"
          type="button"
          onClick={handleExport}
          disabled={q.isLoading || students.length === 0}
        >
          <DownloadIcon size={13} /> Export CSV
        </button>
      </div>
      {students.length === 0 && !q.isLoading ? (
        <p className="empty">No students yet — the grid fills in once your roster does.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                {assignmentList.map((a) => (
                  <th key={a.id}>
                    {a.title} <span className="auth-text--dim">(/{a.points ?? "✓"})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  {assignmentList.map((a) => {
                    const info = cellInfo(cellByKey.get(`${s.id}:${a.id}`), a);
                    return (
                      <td key={a.id}>
                        {info.text}
                        {info.late ? <span className="badge badge--warning">late</span> : null}
                        {info.draft ? <span className="badge badge--warning">draft</span> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Shared by the grid cell and the CSV cell so the two surfaces can never
 *  disagree about what a cell means. `missing` reads as "—". On a
 *  points-less assignment (Task 18, D§11.5 carry-forward), a mark's points
 *  stay null BY CONSTRUCTION — the mark's EXISTENCE is what "complete"
 *  means there, so a real cell is checked BEFORE the points-null case, not
 *  after (a released or draft points-less mark is "✓", never "—", even
 *  though its points value is the same null a genuinely-ungraded cell has).
 *  On a points-having assignment, a cell with no points yet (marked but not
 *  scored) still reads "—". `draft` is exactly "a mark exists but its
 *  status isn't released" — never inferred from anything else. */
function cellInfo(cell, assignment) {
  if (!cell || cell.missing) {
    return { text: "—", late: false, draft: false };
  }
  if (assignment.points == null) {
    return { text: "✓", late: !!cell.late, draft: !cell.released };
  }
  if (cell.points == null) {
    return { text: "—", late: !!cell.late, draft: !cell.released };
  }
  return { text: String(cell.points), late: !!cell.late, draft: !cell.released };
}

/** Doubles inner quotes and wraps every field — a student's name can itself
 *  contain a comma, so every field is quoted unconditionally rather than
 *  only when "needed" (D§11.5). */
function quote(field) {
  return `"${String(field).replace(/"/g, '""')}"`;
}

/** Pure — no DOM, no Blob — so a test can assert the exact CSV string
 *  directly instead of reaching through a download side-effect. Colour
 *  (the grid's badge--warning) doesn't survive a CSV, so late/draft are
 *  spelled out as plain-text suffixes here instead of being dropped. */
export function gradebookCsvString({ students, assignments, cellByKey }) {
  function cellFor(s, a) {
    const info = cellInfo(cellByKey.get(`${s.id}:${a.id}`), a);
    if (info.text === "—") return info.text;
    const flags = [info.late ? "late" : null, info.draft ? "draft" : null].filter(Boolean);
    return flags.length ? `${info.text} (${flags.join(", ")})` : info.text;
  }
  return [
    ["Student", ...assignments.map((a) => `${a.title} (/${a.points ?? "✓"})`)].map(quote).join(","),
    ...students.map((s) => [s.name, ...assignments.map((a) => cellFor(s, a))].map(quote).join(",")),
  ].join("\r\n");
}
