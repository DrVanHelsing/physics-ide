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
import { onProjectSaved } from "../utils/storage/projectStore";
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
  // Cancel a pending autosave when the ACTIVE PROJECT CHANGES, not just on
  // unmount: a timer armed while project A was open otherwise fires against
  // whatever is open when it expires, restamping (and pushing) an untouched
  // project B — which can demote a genuinely newer server copy of B under
  // most-recent-wins. Declared before the dirty-check effect below so this
  // cleanup runs first. Also covers unmount.
  useEffect(() => () => debouncedSaveRef.current.cancel(), [proj.activeProjectId]);
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

  /* A sync PULL writes straight through projectStore (preserveTimestamp), so
     without this the open project would keep rendering the OLD content while
     disk holds the new — and the next keystroke would autosave the stale base
     back over it, archiving the other device's work. Adopt the pulled
     manifest into the live session instead: most-recent-wins, made visible.
     Refs keep this subscription registered exactly once. */
  const activeProjectIdRef = useRef(proj.activeProjectId);
  const applyRef = useRef(applyManifestToWorkingState);
  const setActiveManifestRef = useRef(proj.setActiveManifest);
  useEffect(() => {
    activeProjectIdRef.current = proj.activeProjectId;
    applyRef.current = applyManifestToWorkingState;
    setActiveManifestRef.current = proj.setActiveManifest;
  });
  useEffect(
    () =>
      onProjectSaved((manifest, opts) => {
        if (!opts?.preserveTimestamp) return; // only sync-applied writes
        if (!manifest || manifest.id !== activeProjectIdRef.current) return;
        // An autosave already in flight would land on top of the pull with a
        // stale base — drop it before swapping the content in.
        debouncedSaveRef.current.cancel();
        setActiveManifestRef.current?.(manifest);
        applyRef.current?.(manifest);
      }),
    [],
  );

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

  /* A bootstrap-restored project should open straight into the IDE — the
     start menu is for choosing, not for re-choosing what was already open.
     Runs at most once, after the bootstrap settles. */
  const restoreAppliedRef = useRef(false);
  useEffect(() => {
    if (!proj.loaded || restoreAppliedRef.current) return;
    if (proj.bootstrapResult?.kind !== "existing") return;
    const m = proj.activeManifest;
    if (!m) return;
    restoreAppliedRef.current = true;
    applyManifestToWorkingState(m);
    sim.setShowStart(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj.loaded, proj.bootstrapResult, proj.activeManifest]);

  const renameProject = useCallback(
    async (title) => {
      const next = String(title || "").trim().slice(0, 120);
      if (!proj.activeManifest) return null;
      if (!next || next === proj.activeManifest.title) return null;
      /* Capture first: a rename is an edit, so it carries whatever the student
         has typed since the last autosave rather than dropping it. */
      const base = captureWorkingStateInto(proj.activeManifest);
      return proj.persistActive({ ...base, title: next, updatedAt: Date.now() });
    },
    [captureWorkingStateInto, proj],
  );

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

  /* ── Hybrid analyse stash / restore (data-loss hotfix, 2026-09-01) ──
     "Analyse this run →" used to hard-replace the simulation workspace
     with the analysis template: no confirmation, no way back, and the
     debounced autosave above made the loss permanent within seconds.
     These two ops make the SAME autosave carry the recovery instead —
     the outgoing simulation state is stashed in the manifest itself
     (`hybridStash`), so it survives reload and sync like any other
     project field, and the presence of the stash is what tells the
     header to offer the way back. The confirms live here beside the ops
     they guard, handleClearWorkspace's idiom (useSimulation.js). */
  const analyseStash = useCallback(async () => {
    if (!proj.activeManifest) return null;
    const { confirm } = await import("../utils/export/dialogService");
    const ok = await confirm(
      "Replace the workspace with the analysis template? Your simulation blocks are saved with this project — Back to Simulation brings them back.",
    );
    if (!ok) return null;
    /* An autosave timer armed BEFORE this ran was built on the pre-stash
       manifest; letting it fire mid-persist would write a manifest with no
       stash right before the swap — the original loss. Same hazard, same
       one-liner as the sync-pull path above. */
    debouncedSaveRef.current.cancel();
    /* Capture first (renameProject's idiom), so the stash and the manifest
       both carry what the student typed since the last autosave. Latest
       wins: re-entering analysis re-stashes the CURRENT blocks. */
    const base = captureWorkingStateInto(proj.activeManifest);
    return proj.persistActive({
      ...base,
      hybridStash: {
        xml: sim.workspaceXml || "",
        python: sim.pythonCode || "",
        projectType: sim.projectType || "custom",
        preferredEditor: sim.mode === "text" ? "code" : "blocks",
      },
      updatedAt: Date.now(),
    });
  }, [captureWorkingStateInto, proj, sim]);

  const analyseRestore = useCallback(async () => {
    const stash = proj.activeManifest?.hybridStash;
    if (!stash) return null;
    const { confirm } = await import("../utils/export/dialogService");
    const ok = await confirm(
      "Return to your simulation blocks? The analysis blocks and their generated code will be discarded.",
    );
    if (!ok) return null;
    debouncedSaveRef.current.cancel(); // same fence as analyseStash above
    /* Deliberately NOT captureWorkingStateInto: discarding the analysis
       working state is the confirmed action. The stash's fields are
       promoted back and the stash itself is removed — its absence is what
       returns the header's reset slot to its ordinary job. */
    const rest = { ...proj.activeManifest };
    delete rest.hybridStash;
    const saved = await proj.persistActive({
      ...rest,
      projectType: stash.projectType || "block_template",
      preferredEditor: stash.preferredEditor === "code" ? "code" : "blocks",
      workspace: { ...(rest.workspace || {}), xml: typeof stash.xml === "string" ? stash.xml : "" },
      source: { ...(rest.source || {}), python: typeof stash.python === "string" ? stash.python : "" },
      updatedAt: Date.now(),
    });
    applyManifestToWorkingState(saved);
    /* The render between persistActive's setActiveManifest and the apply
       above can arm the dirty-check debounce (manifest holds sim XML, sim
       still holds analysis XML for that one frame); the "unchanged" pass
       afterwards never disarms it. Cancel so a content-identical restamp
       doesn't push ~3s after every restore. */
    debouncedSaveRef.current.cancel();
    return saved;
  }, [applyManifestToWorkingState, proj]);

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
    renameProject,
    removeProject: proj.removeProject,
    closeProject: proj.closeProject,
    noteExplicitOpen: proj.noteExplicitOpen,
    refreshList: proj.refreshList,
    applyManifestToWorkingState,
    captureWorkingStateInto,
    addRunAndDataset,
    analyseStash,
    analyseRestore,
  };
}
