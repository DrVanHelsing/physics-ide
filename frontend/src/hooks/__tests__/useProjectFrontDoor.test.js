/**
 * Plan 10 Task 1 — the plain front door lands on the MENU (ruling R4).
 *
 * A guest who walked through the welcome page's "Open the IDE" door was
 * being taken straight into last session's block project: the bootstrap
 * restore auto-opened it before they ever saw the chooser. The door now
 * stamps a one-shot session key; the restore effect still APPLIES the
 * restored manifest (so selectProject's save-before-switch can never
 * capture empty state over it) but leaves the start menu up — the project
 * becomes the Continue choice. Reloads and template tiles never stamp the
 * key, so continuity keeps auto-opening; the key is consumed on arrival
 * whatever the bootstrap finds, so it can never go stale within a session.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { ProjectProvider } from "../../contexts/ProjectContext";
import { SimulationProvider, useSimulationContext } from "../../contexts/SimulationContext";
import { useProject } from "../useProject";
import { createManifest } from "../../utils/manifest/factory";
import { LAST_PROJECT_KEY, WANT_MENU_SESSION_KEY } from "../../constants";

vi.mock("../../utils/storage/projectStore", () => ({
  listProjects: vi.fn(),
  loadProject: vi.fn(),
  saveProject: vi.fn(),
  deleteProject: vi.fn(),
  onProjectSaved: vi.fn(() => () => {}),
  onProjectDeleted: vi.fn(() => () => {}),
}));

import { listProjects, loadProject } from "../../utils/storage/projectStore";

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

/** A store holding one project, stamped as the last one open — the exact
 *  state a returning guest's browser is in. */
function returningGuestStore() {
  const m = createManifest({ goal: "physics", title: "Last time's project" });
  const stamped = { ...m, workspace: { ...m.workspace, xml: "<xml>old-blocks</xml>" } };
  const store = new Map([[stamped.id, stamped]]);
  listProjects.mockImplementation(async () =>
    [...store.values()].map((p) => ({
      id: p.id, title: p.title, goal: p.goal, projectType: p.projectType,
      updatedAt: p.updatedAt, createdAt: p.createdAt,
    })),
  );
  loadProject.mockImplementation(async (id) => store.get(id) || null);
  localStorage.setItem(LAST_PROJECT_KEY, stamped.id);
  return stamped;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  latestProj = null;
  latestSim = null;
  sessionStorage.clear();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("the front door ruling — menu on request, continuity otherwise", () => {
  test("door stamped: the restored project is APPLIED but the menu STAYS — and the key is consumed", async () => {
    const project = returningGuestStore();
    sessionStorage.setItem(WANT_MENU_SESSION_KEY, "1");

    mountHarness();
    await act(async () => {
      await flush();
    });

    expect(latestProj.activeProjectId).toBe(project.id); // Continue knows what to offer
    expect(latestSim.workspaceXml).toBe("<xml>old-blocks</xml>"); // applied, so a later save can't clobber
    expect(latestSim.showStart).toBe(true); // the menu is the landing
    expect(sessionStorage.getItem(WANT_MENU_SESSION_KEY)).toBeNull(); // one-shot
  });

  test("no stamp (a reload): the restore auto-opens exactly as before", async () => {
    const project = returningGuestStore();

    mountHarness();
    await act(async () => {
      await flush();
    });

    expect(latestProj.activeProjectId).toBe(project.id);
    expect(latestSim.workspaceXml).toBe("<xml>old-blocks</xml>");
    expect(latestSim.showStart).toBe(false);
  });

  test("a fresh guest with the stamp: menu shows, and the key is still consumed (no stale carry)", async () => {
    listProjects.mockImplementation(async () => []);
    loadProject.mockImplementation(async () => null);
    sessionStorage.setItem(WANT_MENU_SESSION_KEY, "1");

    mountHarness();
    await act(async () => {
      await flush();
    });

    expect(latestSim.showStart).toBe(true);
    expect(sessionStorage.getItem(WANT_MENU_SESSION_KEY)).toBeNull();
  });
});
