import React, { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../utils/api/client";
import { useMe } from "../../auth/useAuth";
import { getGlobalSyncEngine } from "../../utils/sync/syncEngine";
import PortalHeader from "../layout/PortalHeader";
import HistoryTimeline, { buildTimelineEntries } from "./HistoryTimeline";

/**
 * HistoryPage.js — /history/:projectId (design D§6: the screen is "History").
 * The student's own feeder for HistoryTimeline — signed-in, own project.
 * The API is owner-scoped (GET/POST /api/projects/:id/versions[/restore],
 * projects.ts:277-365) so this page carries no ownership check of its own;
 * a foreign or unknown projectId simply 404s the way the API already does.
 *
 * Restore: POST the restore route, THEN reconcile the sync engine so the
 * local copy converges with the server BEFORE returning to the IDE — the
 * mirror image of AssignmentPage.js's submit, which pushes first so the
 * server sees the local edits; here the server changed, so the LOCAL copy
 * is what must catch up before "/" reads it again.
 */
export default function HistoryPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: me, isLoading: meLoading } = useMe();
  const [error, setError] = useState(null);

  const versionsQuery = useQuery({
    queryKey: ["project-versions", projectId],
    queryFn: () => api(`/api/projects/${projectId}/versions`),
    enabled: !!me,
    retry: false,
  });

  const restore = useMutation({
    mutationFn: async (versionId) => {
      await api(`/api/projects/${projectId}/versions/${versionId}/restore`, { method: "POST" });
      const engine = await getGlobalSyncEngine();
      await engine.reconcile(me.id);
    },
    onSuccess: () => navigate("/"),
    onError: (err) => setError(err.message),
  });

  if (meLoading) return null;
  if (!me) return <Navigate to="/auth/signin" replace />;
  if (versionsQuery.isLoading) return null;

  const handleRestore = (versionId) => {
    setError(null);
    restore.mutate(versionId);
  };

  return (
    <div className="page">
      <PortalHeader title="History" />
      <div className="page-body">
        {versionsQuery.error ? (
          <div className="alert alert--danger" role="alert">
            {versionsQuery.error.message}
          </div>
        ) : (
          <HistoryTimeline
            entries={buildTimelineEntries({ versions: versionsQuery.data?.versions ?? [] })}
            onRestore={restore.isPending ? null : handleRestore}
          />
        )}

        {error ? (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        ) : null}

        <div className="assignments-actions">
          <Link className="btn" to="/">
            Back to the IDE
          </Link>
        </div>
      </div>
    </div>
  );
}
