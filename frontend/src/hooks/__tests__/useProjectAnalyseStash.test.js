/**
 * useProject.analyseStash / analyseRestore — the hybrid data-loss hotfix.
 *
 * "Analyse this run →" used to hard-replace the simulation workspace with
 * the analysis template: no confirmation, no way back, and the debounced
 * autosave persisted the loss within seconds (simplification audit,
 * claim 2 — confirmed in-browser). These tests pin the fix's contract:
 * nothing is stashed without consent, cancel is byte-identical, the stash
 * rides the manifest (so it survives a full reload), restore promotes it
 * back and clears it, and re-entering analysis re-stashes latest-wins.
 *
 * `projectStore` is mocked with an in-memory map standing in for
 * localForage (ProjectContext.test.js's pattern); `dialogService` is
 * mocked so consent is scriptable per test.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { ProjectProvider } from "../../contexts/ProjectContext";
import { SimulationProvider, useSimulationContext } from "../../contexts/SimulationContext";
import { useProject } from "../useProject";

vi.mock("../../utils/storage/projectStore", () => ({
  listProjects: vi.fn(),
  loadProject: vi.fn(),
  saveProject: vi.fn(),
  deleteProject: vi.fn(),
  onProjectSaved: vi.fn(() => () => {}),
  onProjectDeleted: vi.fn(() => () => {}),
}));
vi.mock("../../utils/export/dialogService", () => ({
  confirm: vi.fn(),
  alert: vi.fn(),
  prompt: vi.fn(),
}));

import { listProjects, loadProject, saveProject } from "../../utils/storage/projectStore";
import { confirm } from "../../utils/export/dialogService";

/** Flush pending microtasks (promise chains) via a real macrotask tick. */
const flush = () => new Promise((r) => setTimeout(r, 0));

let mounted = null;
let latestProj = null;
let latestSim = null;

function Consumer() {
  latestProj = useProject();
  latestSim = useSimulationContext();
  return null;
}

function mountHarness() {
  mounted = mountComponent(
    React.createElement(
      SimulationProvider,
      null,
      React.createElement(ProjectProvider, null, React.createElement(Consumer)),
    ),
  );
}

/** In-memory stand-in for localForage; pass a map to share it across mounts. */
function wireStore(store = new Map()) {
  listProjects.mockImplementation(async () =>
    [...store.values()].map((m) => ({
      id: m.id, title: m.title, goal: m.goal, projectType: m.projectType,
      updatedAt: m.updatedAt, createdAt: m.createdAt,
    })),
  );
  saveProject.mockImplementation(async (m) => {
    store.set(m.id, m);
    return m;
  });
  loadProject.mockImplementation(async (id) => store.get(id) || null);
  return store;
}

const SIM_XML = "<xml>sim-blocks-v1</xml>";
const ANALYSIS_XML = "<xml>analysis-blocks</xml>";

/** Mount, settle the bootstrap, and open a hybrid project with sim blocks. */
async function seedHybridProject() {
  mountHarness();
  await act(async () => {
    await flush();
  });
  let created;
  await act(async () => {
    created = await latestProj.createNew({
      goal: "hybrid",
      title: "Hybrid cart",
      projectType: "block_template",
      workspaceXml: SIM_XML,
      python: "print('sim')",
    });
  });
  return created;
}

/** The analyse swap's sim-side half, as IDELayout performs it post-stash. */
function swapSimToAnalysis() {
  act(() => {
    latestSim.setWorkspaceXml(ANALYSIS_XML);
    latestSim.setProjectType("block_template");
  });
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  latestProj = null;
  latestSim = null;
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useProject.analyseStash — consent, capture, latest-wins", () => {
  test("cancel means untouched: no stash, no persist, workspace byte-identical", async () => {
    wireStore();
    await seedHybridProject();
    confirm.mockResolvedValue(false);
    const savesBefore = saveProject.mock.calls.length;

    let result;
    await act(async () => {
      result = await latestProj.analyseStash();
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
    expect(saveProject.mock.calls.length).toBe(savesBefore);
    expect(latestSim.workspaceXml).toBe(SIM_XML);
    expect(latestProj.activeManifest.hybridStash).toBeUndefined();
  });

  test("consent stashes the LIVE simulation state into the manifest and persists it", async () => {
    const store = wireStore();
    await seedHybridProject();
    // Unsaved edits since the last autosave must ride into the stash.
    act(() => {
      latestSim.setWorkspaceXml("<xml>sim-blocks-v2</xml>");
    });
    confirm.mockResolvedValue(true);

    let result;
    await act(async () => {
      result = await latestProj.analyseStash();
    });

    expect(result).not.toBeNull();
    expect(latestProj.activeManifest.hybridStash).toEqual({
      xml: "<xml>sim-blocks-v2</xml>",
      python: "print('sim')",
      projectType: "block_template",
    });
    // Persisted, not just in memory — the reload path reads this.
    expect(store.get(result.id).hybridStash.xml).toBe("<xml>sim-blocks-v2</xml>");
  });

  test("re-entering analysis re-stashes the CURRENT blocks — latest wins", async () => {
    wireStore();
    await seedHybridProject();
    confirm.mockResolvedValue(true);

    await act(async () => {
      await latestProj.analyseStash();
    });
    swapSimToAnalysis();
    await act(async () => {
      await latestProj.analyseRestore();
    });
    act(() => {
      latestSim.setWorkspaceXml("<xml>sim-blocks-v3</xml>");
    });
    await act(async () => {
      await latestProj.analyseStash();
    });

    expect(latestProj.activeManifest.hybridStash.xml).toBe("<xml>sim-blocks-v3</xml>");
  });
});

describe("useProject.analyseRestore — the way back", () => {
  test("restore promotes the stash into the working state and clears it", async () => {
    const store = wireStore();
    const created = await seedHybridProject();
    confirm.mockResolvedValue(true);
    await act(async () => {
      await latestProj.analyseStash();
    });
    swapSimToAnalysis();

    let restored;
    await act(async () => {
      restored = await latestProj.analyseRestore();
    });

    expect(restored).not.toBeNull();
    expect(latestSim.workspaceXml).toBe(SIM_XML);
    expect(latestSim.projectType).toBe("block_template");
    expect(latestProj.activeManifest.hybridStash).toBeUndefined();
    expect(store.get(created.id).hybridStash).toBeUndefined();
    expect(store.get(created.id).workspace.xml).toBe(SIM_XML);
  });

  test("cancel keeps the analysis workspace AND the stash", async () => {
    wireStore();
    await seedHybridProject();
    confirm.mockResolvedValue(true);
    await act(async () => {
      await latestProj.analyseStash();
    });
    swapSimToAnalysis();
    confirm.mockResolvedValue(false);

    let restored;
    await act(async () => {
      restored = await latestProj.analyseRestore();
    });

    expect(restored).toBeNull();
    expect(latestSim.workspaceXml).toBe(ANALYSIS_XML);
    expect(latestProj.activeManifest.hybridStash.xml).toBe(SIM_XML);
  });

  test("no stash: returns null without even asking", async () => {
    wireStore();
    await seedHybridProject();

    let restored;
    await act(async () => {
      restored = await latestProj.analyseRestore();
    });

    expect(restored).toBeNull();
    expect(confirm).not.toHaveBeenCalled();
  });

  test("the stash survives a reload — the autosave now persists the recovery, not the loss", async () => {
    const store = wireStore();
    const created = await seedHybridProject();
    confirm.mockResolvedValue(true);
    await act(async () => {
      await latestProj.analyseStash();
    });
    swapSimToAnalysis();
    // The autosave's own capture path, as it would run before the reload:
    // the analysis XML lands in workspace.xml, the stash rides ...base.
    await act(async () => {
      await latestProj.saveCurrent();
    });
    expect(store.get(created.id).workspace.xml).toBe(ANALYSIS_XML);
    expect(store.get(created.id).hybridStash.xml).toBe(SIM_XML);

    // "Reload": tear the whole tree down and remount over the same store.
    mounted.unmount();
    wireStore(store);
    mountHarness();
    await act(async () => {
      await flush();
    });
    await act(async () => {
      await latestProj.selectProject(created.id);
    });
    expect(latestSim.workspaceXml).toBe(ANALYSIS_XML); // reopened into analysis view
    expect(latestProj.activeManifest.hybridStash.xml).toBe(SIM_XML);

    confirm.mockResolvedValue(true);
    await act(async () => {
      await latestProj.analyseRestore();
    });
    expect(latestSim.workspaceXml).toBe(SIM_XML);
    expect(latestProj.activeManifest.hybridStash).toBeUndefined();
  });
});
