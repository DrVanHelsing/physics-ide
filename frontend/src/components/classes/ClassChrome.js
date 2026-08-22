import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";

/**
 * Shell for /classes/:id — header, tab nav, and the class query.
 * Children render via the `children(classData, me)` function prop.
 */
export default function ClassChrome({ tab, children }) {
  const { id } = useParams();
  const { data: me, isLoading } = useMe();
  const classQuery = useQuery({
    queryKey: ["class", id],
    queryFn: () => api(`/api/classes/${id}`),
    enabled: !!me,
    retry: false,
  });

  if (isLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (classQuery.error) {
    return (
      <div className="classes-page">
        <div className="classes-body">
          <div className="auth-error">{classQuery.error.message}</div>
          <Link className="btn" to="/classes">
            Back to my classes
          </Link>
        </div>
      </div>
    );
  }
  if (!classQuery.data) return null;
  const c = classQuery.data.class;
  const isTeacher = c.myRole === "teacher";
  const isStaff = isTeacher || c.myRole === "ta";
  const tabs = [
    { key: "assignments", label: "Assignments", to: `/classes/${c.id}`, show: true },
    { key: "people", label: "People", to: `/classes/${c.id}/people`, show: isStaff },
    { key: "settings", label: "Settings", to: `/classes/${c.id}/settings`, show: isTeacher },
  ].filter((t) => t.show);

  return (
    <div className="classes-page">
      <header className="classes-header">
        <Link to="/classes" className="auth-brand">
          Physics<span>IDE</span>
        </Link>
        <h1>
          {c.name}
          {c.archived ? <span className="class-archived-badge">archived</span> : null}
        </h1>
        <nav className="admin-tabs">
          {tabs.map((t) => (
            <Link
              key={t.key}
              to={t.to}
              className={t.key === tab ? "admin-tab admin-tab--on" : "admin-tab"}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      {children(c, me)}
    </div>
  );
}

export function AssignmentsStub() {
  return (
    <ClassChrome tab="assignments">
      {() => (
        <div className="classes-body">
          <p className="auth-text auth-text--dim">
            Assignments arrive in a later update. For now this class holds its roster and settings.
          </p>
        </div>
      )}
    </ClassChrome>
  );
}
