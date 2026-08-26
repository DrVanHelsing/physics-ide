/**
 * usePendingTemplateSeed — the consumer half of the welcome page's worked-
 * project tiles. A tile stamps a template id into sessionStorage
 * (welcome/pendingTemplate.js) and this hook, mounted from IDELayout via
 * useProject(), picks it up once the project bootstrap has settled and
 * seeds a project from it through the wizard's own creation path
 * (StartMenu's buildManifestSpec + useProject's createNew).
 *
 * `../../utils/storage/projectStore` is mocked (same pattern as
 * contexts/__tests__/ProjectContext.test.js) with an in-memory map standing
 * in for localForage, so the test can assert on exactly what got saved
 * without touching real storage.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { ProjectProvider } from "../../contexts/ProjectContext";
import { SimulationProvider } from "../../contexts/SimulationContext";
import { useProject } from "../useProject";
import { usePendingTemplateSeed } from "../usePendingTemplateSeed";
import { BLOCK_TEMPLATES } from "../../utils/blockTemplates";
import { EXAMPLES } from "../../utils/precodedExamples";

const PENDING_KEY = "pide_pending_template";

vi.mock("../../utils/storage/projectStore", () => ({
  listProjects: vi.fn(),
  loadProject: vi.fn(),
  saveProject: vi.fn(),
  deleteProject: vi.fn(),
  onProjectSaved: vi.fn(() => () => {}),
  onProjectDeleted: vi.fn(() => () => {}),
}));

import { listProjects, loadProject, saveProject } from "../../utils/storage/projectStore";

/** Flush pending microtasks (promise chains) via a real macrotask tick. */
const flush = () => new Promise((r) => setTimeout(r, 0));

let mounted = null;
let latestProj = null;

function Consumer() {
  const proj = useProject();
  usePendingTemplateSeed(proj);
  latestProj = proj;
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

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  latestProj = null;
  sessionStorage.clear();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("usePendingTemplateSeed — the welcome tile's project-creation seam", () => {
  test("a pending real template id seeds a project through the wizard's own path, and the key is gone afterwards", async () => {
    const store = new Map();
    listProjects.mockImplementation(async () =>
      [...store.values()].map((m) => ({
        id: m.id, title: m.title, goal: m.goal, projectType: m.projectType,
        updatedAt: m.updatedAt, createdAt: m.createdAt,
      })),
    );
    saveProject.mockImplementation(async (m) => {
      const stamped = { ...m, updatedAt: Date.now() };
      store.set(stamped.id, stamped);
      return stamped;
    });
    loadProject.mockImplementation(async (id) => store.get(id) || null);

    sessionStorage.setItem(PENDING_KEY, "blocks_pendulum");

    mountHarness();
    await act(async () => {
      await flush();
      await flush();
    });

    const pendulumTpl = BLOCK_TEMPLATES.find((t) => t.id === "blocks_pendulum");
    const pairedCode = EXAMPLES.find((e) => e.id === "pendulum");

    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    expect(latestProj.activeManifest).toBeTruthy();
    expect(latestProj.activeManifest.projectType).toBe("block_template");
    expect(latestProj.activeManifest.preferredEditor).toBe("blocks");
    expect(latestProj.activeManifest.goal).toBe("physics");
    expect(latestProj.activeManifest.workspace.xml).toBe(pendulumTpl.xml);
    expect(latestProj.activeManifest.source.python).toBe(pairedCode.code);
    expect(saveProject).toHaveBeenCalled();
  });

  test("an unknown pending id is ignored — no project is created, and the key is still consumed", async () => {
    listProjects.mockResolvedValue([]);

    sessionStorage.setItem(PENDING_KEY, "not-a-real-template");

    mountHarness();
    await act(async () => {
      await flush();
      await flush();
    });

    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    expect(latestProj.activeProjectId).toBeNull();
    expect(latestProj.activeManifest).toBeNull();
    expect(saveProject).not.toHaveBeenCalled();
  });

  test("no pending id at all is today's behaviour — nothing created", async () => {
    listProjects.mockResolvedValue([]);

    mountHarness();
    await act(async () => {
      await flush();
      await flush();
    });

    expect(latestProj.activeProjectId).toBeNull();
    expect(saveProject).not.toHaveBeenCalled();
  });
});
