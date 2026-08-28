import React from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import PortalHeader from "../layout/PortalHeader";

/**
 * Shell for /classes/:id — header, tab nav, and the class query.
 * Children render via the `children(classData, me)` function prop.
 *
 * `back` is the shared up-control every class screen carries (F2, 2026-08-28:
 * the tab row was the ONLY navigation here, and on a sub-page of a tab the
 * *current* tab was the thing that went up — nothing said so). The default
 * names the class wall; a sub-page overrides it with its own real parent
 * (AssignmentPage → the class, InboxPage → the assignment).
 */
export default function ClassChrome({
  tab,
  back = { to: "/classes", label: "Back to my classes" },
  children,
}) {
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
      <div className="page">
        <div className="page-body">
          <div className="alert alert--danger" role="alert">
            {classQuery.error.message}
          </div>
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
    { key: "guides", label: "Guides", to: `/classes/${c.id}/guides`, show: true },
    { key: "gradebook", label: "Gradebook", to: `/classes/${c.id}/gradebook`, show: isStaff },
    { key: "people", label: "People", to: `/classes/${c.id}/people`, show: isStaff },
    { key: "settings", label: "Settings", to: `/classes/${c.id}/settings`, show: isTeacher },
  ].filter((t) => t.show);

  return (
    <div className="page">
      <PortalHeader
        home="/classes"
        back={back}
        title={
          <>
            {c.name}
            {c.archived ? <span className="badge badge--warning">archived</span> : null}
          </>
        }
        nav={
          <nav className="tabs">
            {tabs.map((t) => (
              <Link
                key={t.key}
                to={t.to}
                className="tab"
                aria-current={t.key === tab ? "page" : undefined}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        }
      />
      {children(c, me)}
    </div>
  );
}
