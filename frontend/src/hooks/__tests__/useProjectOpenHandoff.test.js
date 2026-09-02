/**
 * The portal → IDE hand-off, made deterministic. "Start work" (and "Open a
 * test copy", and accept-share) announce a project id on the PORTAL page and
 * then navigate("/") — ProjectContext (always mounted) opens the project,
 * but the IDE-side half (apply the manifest to the working state, dismiss
 * the start menu) lives in useProject, which is not mounted yet when the
 * announcement fires. It used to work only by timing accident; the portal
 * e2e's "Start work lands IN the work" check flickered with it. These tests
 * pin the deterministic mechanism: the request bus keeps the pending id,
 * and useProject consumes it when the matching manifest becomes active —
 * in BOTH orders (announce-then-mount, the real portal order, and
 * announce-while-mounted).
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { ProjectProvider } from "../../contexts/ProjectContext";
import { SimulationProvider, useSimulationContext } from "../../contexts/SimulationContext";
import { useProject } from "../useProject";
import { createManifest } from "../../utils/manifest/factory";
import { requestProjectOpen, consumeRequestedOpen, peekRequestedOpen } from "../../utils/projectOpenRequest";

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

/* The providers are ALWAYS mounted in the real app (they wrap the router);
   only the IDE — and with it useProject — mounts on navigate("/"). The
   harness mirrors that: `ideVisible` false models the portal page, true
   models the IDE route. */
let ideVisible = true;
let harnessTick = null;
function Harness() {
  const [, setTick] = React.useState(0);
  harnessTick = () => setTick((t) => t + 1);
  return React.createElement(
    SimulationProvider,
    null,
    React.createElement(ProjectProvider, null, ideVisible ? React.createElement(Consumer) : null),
  );
}

function mountHarness({ ideMounted = true } = {}) {
  ideVisible = ideMounted;
  mounted = mountComponent(React.createElement(Harness));
}

async function mountIDE() {
  ideVisible = true;
  await act(async () => {
    harnessTick();
    await flush();
  });
}

function wireStore(store = new Map()) {
  listProjects.mockImplementation(async () =>
    [...store.values()].map((m) => ({
      id: m.id, title: m.title, goal: m.goal, projectType: m.projectType,
      updatedAt: m.updatedAt, createdAt: m.createdAt,
    })),
  );
  loadProject.mockImplementation(async (id) => store.get(id) || null);
  return store;
}

function storedProject(store, xml) {
  const m = createManifest({ goal: "physics", title: "Assignment work" });
  const stamped = { ...m, workspace: { ...m.workspace, xml } };
  store.set(stamped.id, stamped);
  return stamped;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  latestProj = null;
  latestSim = null;
  consumeRequestedOpen(); // never leak a pending id between tests
  localStorage.clear();
  vi.clearAllMocks();
});

describe("the portal hand-off — announce, then land IN the work", () => {
  test("announce BEFORE the IDE mounts (the real portal order): manifest applied, menu dismissed", async () => {
    const store = wireStore();
    const project = storedProject(store, "<xml>assignment-blocks</xml>");

    // Providers up, IDE not mounted — the portal page.
    mountHarness({ ideMounted: false });
    await act(async () => {
      await flush();
    });
    // The portal announces (ProjectContext hears it), THEN "/" mounts the IDE.
    await act(async () => {
      requestProjectOpen(project.id);
      await flush();
    });
    await mountIDE();

    expect(latestProj.activeProjectId).toBe(project.id);
    expect(latestSim.workspaceXml).toBe("<xml>assignment-blocks</xml>");
    expect(latestSim.showStart).toBe(false);
    expect(peekRequestedOpen()).toBeNull(); // consumed on match, gone for good
  });

  test("announce while the IDE is mounted: same landing", async () => {
    const store = wireStore();
    const project = storedProject(store, "<xml>test-copy</xml>");
    mountHarness();
    await act(async () => {
      await flush();
    });
    expect(latestSim.showStart).toBe(true); // the menu is up first

    await act(async () => {
      requestProjectOpen(project.id);
      await flush();
    });

    expect(latestProj.activeProjectId).toBe(project.id);
    expect(latestSim.workspaceXml).toBe("<xml>test-copy</xml>");
    expect(latestSim.showStart).toBe(false);
    expect(peekRequestedOpen()).toBeNull();
  });

  test("a manifest becoming active under a DIFFERENT pending id neither consumes it nor fires the hand-off", async () => {
    const store = wireStore();
    const projectA = storedProject(store, "<xml>a-blocks</xml>");
    mountHarness();
    await act(async () => {
      await flush();
    });

    // Announce something else entirely, then activate A through the
    // ordinary door (selectProject — the start menu's own path).
    requestProjectOpen("p-something-else");
    await act(async () => {
      await latestProj.selectProject(projectA.id);
      await flush();
    });

    // selectProject dismissed the menu itself; the pending id was NOT
    // consumed by A's activation — strictly-on-match is the contract.
    expect(latestProj.activeProjectId).toBe(projectA.id);
    expect(peekRequestedOpen()).toBe("p-something-else");
  });

  test("no announcement at all: an empty bootstrap leaves the menu up", async () => {
    wireStore();
    mountHarness();
    await act(async () => {
      await flush();
    });
    expect(latestSim.showStart).toBe(true);
  });
});
