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

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  listProjects,
  loadProject,
  saveProject,
  deleteProject,
  onProjectSaved,
  onProjectDeleted,
} from "../utils/storage/projectStore";
import { readLegacyV1, migrate, LEGACY_V1_KEY } from "../utils/manifest/migrate";
import { createManifest } from "../utils/manifest/factory";
import { SIGNED_IN_HINT_KEY, LAST_PROJECT_KEY } from "../constants";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeManifest, setActiveManifest] = useState(null);
  const [projectList, setProjectList] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState(null);
  /* Flipped synchronously the instant openProject is called, so the
     bootstrap restore below (which awaits its own loadProject before it can
     check state) can tell whether the user has already opened something in
     the meantime — closures inside the bootstrap effect see stale state, so
     a ref is the only reliable read here. */
  const explicitOpenRef = useRef(false);

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
          // signed-in first runs pull from the cloud instead (SyncProvider backfills the legacy blob if the cloud is empty too)
          const legacy = localStorage.getItem(SIGNED_IN_HINT_KEY) ? null : readLegacyV1();
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
          /* Reopen whatever was open last, if it still exists. Guarded on the
             list we just read, so a deleted or cloud-tombstoned project can
             never resurrect itself — and only reached when the list is
             non-empty, so it cannot race the legacy-v1 resurrection above. */
          let restoredId = null;
          try {
            restoredId = localStorage.getItem(LAST_PROJECT_KEY);
          } catch {
            // Storage blocked — start at the menu.
          }
          if (restoredId && list.some((p) => p.id === restoredId)) {
            const restored = await loadProject(restoredId);
            if (cancelled) return;
            /* The start menu is already visible while this await is in
               flight (projectList was just set above), so the user can open
               a different project — or create a new one — before this
               resolves. That explicit action must win: applying the stale
               restore on top of it would silently discard what the user
               just chose. */
            if (restored && !explicitOpenRef.current) {
              setActiveProjectId(restored.id);
              setActiveManifest(restored);
            }
          }
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

  /* Sync pulls save and delete straight through projectStore, bypassing this
     provider — subscribe so the start-menu list follows, and close a project
     that was tombstoned remotely while open. */
  useEffect(() => {
    const unsubSaved = onProjectSaved(() => {
      refreshList().catch(() => {});
    });
    const unsubDeleted = onProjectDeleted((id) => {
      refreshList().catch(() => {});
      setActiveProjectId((cur) => (cur === id ? null : cur));
      setActiveManifest((cur) => (cur && cur.id === id ? null : cur));
      try { localStorage.removeItem(LAST_PROJECT_KEY); } catch { /* storage blocked */ }
    });
    return () => {
      unsubSaved();
      unsubDeleted();
    };
  }, [refreshList]);

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
      // Flip before the await: this is the earliest point at which an
      // explicit open is committed, and it must beat a bootstrap restore
      // that resolves later.
      explicitOpenRef.current = true;
      const m = await loadProject(id);
      if (!m) return null;
      setActiveProjectId(m.id);
      setActiveManifest(m);
      try { localStorage.setItem(LAST_PROJECT_KEY, m.id); } catch { /* storage blocked */ }
      return m;
    },
    [],
  );

  /* Called by any explicit-navigation path that doesn't go through
     openProject (e.g. importing a file) — flips the same guard so a
     bootstrap restore that resolves afterward can't clobber it. */
  const noteExplicitOpen = useCallback(() => {
    explicitOpenRef.current = true;
  }, []);

  const closeProject = useCallback(() => {
    setActiveProjectId(null);
    setActiveManifest(null);
    try { localStorage.removeItem(LAST_PROJECT_KEY); } catch { /* storage blocked */ }
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
        try { localStorage.removeItem(LAST_PROJECT_KEY); } catch { /* storage blocked */ }
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
    noteExplicitOpen,
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
