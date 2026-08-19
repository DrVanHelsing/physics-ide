/**
 * useProject — bridges ProjectContext (multi-project library + manifest
 * storage) with SimulationContext (working state for the active project).
 *
 *   - applyManifestToWorkingState(manifest): push fields from a loaded
 *     manifest into SimulationContext so the IDE renders that project.
 *   - captureWorkingStateInto(manifest): build a new manifest by merging
 *     the live SimulationContext fields onto a base manifest, ready to
 *     pass to persistActive.
 *   - selectProject(id): persist current working state into the active
 *     manifest, then load `id` and apply it.
 *   - createNew(spec): build a manifest, persist, load, and apply.
 *   - saveCurrent(): persist current working state into the active manifest.
 */

import { useCallback, useEffect, useRef } from "react";
import { useProjectContext } from "../contexts/ProjectContext";
import { useSimulationContext } from "../contexts/SimulationContext";
import { createManifest } from "../utils/manifest/factory";
import { debounce } from "../utils/debounce";
import { MANIFEST_AUTOSAVE_MS } from "../constants";

export function useProject() {
  const proj = useProjectContext();
  const sim = useSimulationContext();

  const applyManifestToWorkingState = useCallback(
    (manifest) => {
      if (!manifest) return;
      sim.setMode(manifest.preferredEditor === "code" ? "text" : "blocks");
      sim.setProjectType(manifest.projectType || "custom");
      sim.setPythonCode(manifest.source?.python || "");
      sim.setWorkspaceXml(manifest.workspace?.xml || "");
    },
    [sim],
  );

  const captureWorkingStateInto = useCallback(
    (base) => {
      if (!base) return null;
      const editorIsCode = sim.mode === "text";
      return {
        ...base,
        preferredEditor: editorIsCode ? "code" : "blocks",
        projectType: sim.projectType || base.projectType || "custom",
        workspace: { ...(base.workspace || {}), xml: sim.workspaceXml || "" },
        source: { ...(base.source || {}), python: sim.pythonCode || "" },
        updatedAt: Date.now(),
      };
    },
    [sim],
  );

  const saveCurrent = useCallback(async () => {
    if (!proj.activeManifest) return null;
    const next = captureWorkingStateInto(proj.activeManifest);
    return proj.persistActive(next);
  }, [captureWorkingStateInto, proj]);

  // Debounced editor→manifest autosave: edits reach the manifest (and thus sync)
  // without waiting for a project switch. Guests benefit too (pure local persistence).
  const saveCurrentRef = useRef(saveCurrent);
  useEffect(() => {
    saveCurrentRef.current = saveCurrent;
  });
  const debouncedSaveRef = useRef(null);
  if (!debouncedSaveRef.current) {
    debouncedSaveRef.current = debounce(() => {
      Promise.resolve(saveCurrentRef.current?.()).catch((err) => {
        console.warn("autosave: failed to persist current project:", err);
      });
    }, MANIFEST_AUTOSAVE_MS);
  }
  useEffect(() => {
    if (!proj.activeProjectId || !proj.activeManifest) return;
    // Dirty check: opening a project pushes its fields INTO sim, which fires
    // this effect too. Saving then would restamp updatedAt — and with sync,
    // merely opening a stale offline copy would claim most-recent-wins
    // recency. Only schedule a save when sim actually differs from the
    // persisted manifest.
    const m = proj.activeManifest;
    const unchanged =
      (m.source?.python || "") === (sim.pythonCode || "") &&
      (m.workspace?.xml || "") === (sim.workspaceXml || "") &&
      (m.preferredEditor === "code" ? "text" : "blocks") === sim.mode &&
      (m.projectType || "custom") === (sim.projectType || "custom");
    if (unchanged) return;
    debouncedSaveRef.current();
  }, [
    proj.activeProjectId,
    proj.activeManifest,
    sim.pythonCode,
    sim.workspaceXml,
    sim.mode,
    sim.projectType,
  ]);
  useEffect(() => () => debouncedSaveRef.current.cancel(), []);

  const selectProject = useCallback(
    async (id) => {
      if (proj.activeManifest && proj.activeProjectId !== id) {
        try {
          await saveCurrent();
        } catch (err) {
          console.warn("selectProject: failed to save current before switching:", err);
        }
      }
      const m = await proj.openProject(id);
      if (m) {
        applyManifestToWorkingState(m);
        sim.setShowStart(false);
      }
      return m;
    },
    [applyManifestToWorkingState, proj, saveCurrent, sim],
  );

  const createNew = useCallback(
    async (spec = {}) => {
      // Persist current first so we don't lose unsaved work.
      if (proj.activeManifest) {
        try {
          await saveCurrent();
        } catch (err) {
          console.warn("createNew: failed to save current before creating:", err);
        }
      }
      // Use the factory directly so we can override projectType / xml / python.
      const manifest = createManifest(spec);
      const saved = await proj.persistActive(manifest);
      // Point ProjectContext at it without re-loading.
      await proj.openProject(saved.id);
      applyManifestToWorkingState(saved);
      sim.setShowStart(false);
      return saved;
    },
    [applyManifestToWorkingState, proj, saveCurrent, sim],
  );

  /* If the bootstrap migrated a legacy v1 save, auto-open it so the user
     keeps their work. Runs once after the bootstrap completes. */
  useEffect(() => {
    if (!proj.loaded) return;
    if (proj.activeProjectId) return;
    if (proj.bootstrapResult?.kind === "migrated") {
      selectProject(proj.bootstrapResult.manifestId).catch((err) => {
        console.warn("Could not auto-open migrated project:", err);
      });
    }
    // Run once when bootstrap finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj.loaded]);

  const addRunAndDataset = useCallback(
    async (runSnapshot, datasetDescriptor) => {
      if (!proj.activeManifest) return null;
      const base = captureWorkingStateInto(proj.activeManifest);
      const next = {
        ...base,
        runs: [...(base.runs || []), runSnapshot],
        datasets: [...(base.datasets || []), datasetDescriptor],
        updatedAt: Date.now(),
      };
      return proj.persistActive(next);
    },
    [captureWorkingStateInto, proj],
  );

  return {
    /* state passthrough */
    activeProjectId: proj.activeProjectId,
    activeManifest: proj.activeManifest,
    projectList: proj.projectList,
    loaded: proj.loaded,
    bootstrapResult: proj.bootstrapResult,
    /* operations */
    selectProject,
    createNew,
    saveCurrent,
    removeProject: proj.removeProject,
    refreshList: proj.refreshList,
    applyManifestToWorkingState,
    captureWorkingStateInto,
    addRunAndDataset,
  };
}
