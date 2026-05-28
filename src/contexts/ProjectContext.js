/**
 * ProjectContext — Phase B.4.
 *
 * Owns the multi-project state on top of localForage. The active project's
 * working state (Python code, workspace XML, editor mode, beginner flag)
 * continues to live in SimulationContext; ProjectContext orchestrates
 * loading, switching, saving, and creating.
 *
 *   activeProjectId: id of the open project, or null when none
 *   activeManifest:  the loaded manifest (mirrors what's in storage)
 *   projectList:     lightweight summaries from project-list
 *   loaded:          true once the bootstrap pass has finished
 *
 * Operations on the active project are exposed via useProject() (a hook
 * defined alongside this provider). The hook bridges between ProjectContext
 * and SimulationContext.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  listProjects,
  loadProject,
  saveProject,
  deleteProject,
} from "../utils/storage/projectStore";
import { readLegacyV1, migrate, LEGACY_V1_KEY } from "../utils/manifest/migrate";
import { createManifest } from "../utils/manifest/factory";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeManifest, setActiveManifest] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState(null);

  const refreshList = useCallback(async () => {
    const list = await listProjects();
    setProjectList(list);
    return list;
  }, []);

  /* Bootstrap: pick up legacy v1 state on first run; otherwise stay
     empty and let the start menu drive. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listProjects();
        if (cancelled) return;
        if (list.length === 0) {
          const legacy = readLegacyV1();
          if (legacy) {
            const migrated = migrate(legacy);
            const saved = await saveProject(migrated);
            if (cancelled) return;
            setProjectList([
              {
                id: saved.id,
                title: saved.title,
                goal: saved.goal,
                projectType: saved.projectType,
                updatedAt: saved.updatedAt,
                createdAt: saved.createdAt,
                thumbnail: saved.thumbnail || null,
              },
            ]);
            setBootstrapResult({ kind: "migrated", manifestId: saved.id });
          } else {
            setBootstrapResult({ kind: "empty" });
          }
        } else {
          setProjectList(list);
          setBootstrapResult({ kind: "existing", count: list.length });
        }
      } catch (err) {
        console.warn("ProjectContext bootstrap failed:", err);
        setBootstrapResult({ kind: "error", error: String(err) });
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistActive = useCallback(
    async (next) => {
      const saved = await saveProject(next);
      setActiveManifest(saved);
      await refreshList();
      return saved;
    },
    [refreshList],
  );

  const openProject = useCallback(
    async (id) => {
      const m = await loadProject(id);
      if (!m) return null;
      setActiveProjectId(m.id);
      setActiveManifest(m);
      return m;
    },
    [],
  );

  const closeProject = useCallback(() => {
    setActiveProjectId(null);
    setActiveManifest(null);
  }, []);

  const createAndOpen = useCallback(
    async (spec = {}) => {
      const manifest = createManifest(spec);
      const saved = await persistActive(manifest);
      setActiveProjectId(saved.id);
      return saved;
    },
    [persistActive],
  );

  const removeProject = useCallback(
    async (id) => {
      await deleteProject(id);
      if (id === activeProjectId) {
        setActiveProjectId(null);
        setActiveManifest(null);
      }
      await refreshList();
    },
    [activeProjectId, refreshList],
  );

  const value = {
    activeProjectId,
    activeManifest,
    setActiveManifest,
    projectList,
    loaded,
    bootstrapResult,
    refreshList,
    openProject,
    closeProject,
    createAndOpen,
    removeProject,
    persistActive,
    legacyKey: LEGACY_V1_KEY,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProjectContext must be used within a ProjectProvider");
  }
  return ctx;
}

export default ProjectContext;
