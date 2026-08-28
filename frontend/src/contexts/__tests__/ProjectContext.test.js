/**
 * Regression test for the bootstrap-restore-vs-explicit-navigation race:
 *
 * ProjectContext's bootstrap effect sets `projectList` (painting the start
 * menu) BEFORE it awaits `loadProject(restoredId)` for the last-opened
 * project. That await boundary gives the user a real window to open a
 * DIFFERENT project from the now-visible start menu before the bootstrap's
 * own restore resolves. Whichever `loadProject` call settles last used to
 * win outright — so a slow bootstrap restore could silently clobber the
 * project the user just explicitly opened.
 *
 * `../../utils/storage/projectStore` is mocked so the test can control
 * exactly when each `loadProject` call resolves and force the adversarial
 * ordering (explicit open resolves first, stale restore resolves after).
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { ProjectProvider, useProjectContext } from "../ProjectContext";
import { requestProjectOpen } from "../../utils/projectOpenRequest";
import { LAST_PROJECT_KEY } from "../../constants";

vi.mock("../../utils/storage/projectStore", () => ({
  listProjects: vi.fn(),
  loadProject: vi.fn(),
  saveProject: vi.fn(),
  deleteProject: vi.fn(),
  onProjectSaved: vi.fn(() => () => {}),
  onProjectDeleted: vi.fn(() => () => {}),
}));

import { listProjects, loadProject } from "../../utils/storage/projectStore";

/** A promise this test can resolve on its own schedule. */
function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Flush pending microtasks (promise chains) via a real macrotask tick. */
const flush = () => new Promise((r) => setTimeout(r, 0));

let mounted = null;
let latestCtx = null;

function Consumer() {
  latestCtx = useProjectContext();
  return null;
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  latestCtx = null;
  localStorage.clear();
  vi.clearAllMocks();
});

describe("ProjectContext bootstrap restore vs. explicit navigation", () => {
  test("an explicit openProject during bootstrap wins over the stale last-project restore", async () => {
    const projectA = { id: "project-A", title: "A" };
    const projectB = { id: "project-B", title: "B" };

    localStorage.setItem(LAST_PROJECT_KEY, "project-A");

    listProjects.mockResolvedValue([
      { id: "project-A", title: "A", updatedAt: 1 },
      { id: "project-B", title: "B", updatedAt: 2 },
    ]);

    // Two independently-controlled loads: the bootstrap's restore of A, and
    // the user's explicit open of B.
    const restoreLoad = deferred();
    const explicitLoad = deferred();
    loadProject.mockImplementation((id) => {
      if (id === "project-A") return restoreLoad.promise;
      if (id === "project-B") return explicitLoad.promise;
      return Promise.resolve(null);
    });

    mounted = mountComponent(
      React.createElement(ProjectProvider, null, React.createElement(Consumer)),
    );

    // Let listProjects() settle — the bootstrap reaches its
    // `await loadProject("project-A")` and blocks there (start menu is
    // now showing the project list, per the real app's showStart default).
    await act(async () => {
      await flush();
    });
    expect(latestCtx.projectList.map((p) => p.id)).toEqual(["project-A", "project-B"]);
    expect(latestCtx.activeProjectId).toBeNull();

    // The user opens a DIFFERENT project from that visible list before the
    // bootstrap restore has resolved.
    await act(async () => {
      latestCtx.openProject("project-B");
      await flush();
    });

    // The explicit open settles first.
    explicitLoad.resolve(projectB);
    await act(async () => {
      await flush();
    });
    expect(latestCtx.activeProjectId).toBe("project-B");
    expect(latestCtx.activeManifest?.id).toBe("project-B");

    // Now the stale bootstrap restore for A finally resolves. It must NOT
    // override the user's explicit choice of B.
    restoreLoad.resolve(projectA);
    await act(async () => {
      await flush();
    });

    expect(latestCtx.activeProjectId).toBe("project-B");
    expect(latestCtx.activeManifest?.id).toBe("project-B");
  });

  test("noteExplicitOpen (the import path) also beats the stale bootstrap restore", async () => {
    const projectA = { id: "project-A", title: "A" };

    localStorage.setItem(LAST_PROJECT_KEY, "project-A");

    listProjects.mockResolvedValue([{ id: "project-A", title: "A", updatedAt: 1 }]);

    const restoreLoad = deferred();
    loadProject.mockImplementation((id) => {
      if (id === "project-A") return restoreLoad.promise;
      return Promise.resolve(null);
    });

    mounted = mountComponent(
      React.createElement(ProjectProvider, null, React.createElement(Consumer)),
    );

    await act(async () => {
      await flush();
    });
    expect(latestCtx.activeProjectId).toBeNull();

    // Mirrors IDELayout's onImport handler: noteExplicitOpen() runs instead
    // of openProject(), immediately before the import is applied.
    act(() => {
      latestCtx.noteExplicitOpen();
    });

    // The stale bootstrap restore for A finally resolves. It must NOT
    // override the import that just happened.
    restoreLoad.resolve(projectA);
    await act(async () => {
      await flush();
    });

    expect(latestCtx.activeProjectId).toBeNull();
    expect(latestCtx.activeManifest).toBeNull();
  });
});

/**
 * Final fix wave, D2 — the consumer half of the portal's hand-off into the
 * IDE. "Start work" and "Open a test copy" both settle on a project id and
 * then navigate to "/" client-side, which remounts nothing: the bootstrap
 * effect above ran long ago and LAST_PROJECT_KEY on its own only answers a
 * reload. This provider listens for the announcement instead.
 */
describe("ProjectContext — an open requested from outside the IDE", () => {
  test("a requested project becomes the active one, without a remount or a reload", async () => {
    const projectB = { id: "project-B", title: "B" };
    listProjects.mockResolvedValue([{ id: "project-B", title: "B", updatedAt: 2 }]);
    loadProject.mockImplementation((id) => Promise.resolve(id === "project-B" ? projectB : null));

    mounted = mountComponent(
      React.createElement(ProjectProvider, null, React.createElement(Consumer)),
    );
    await act(async () => {
      await flush();
    });
    expect(latestCtx.activeProjectId).toBeNull();

    await act(async () => {
      requestProjectOpen("project-B");
      await flush();
    });

    expect(latestCtx.activeProjectId).toBe("project-B");
    expect(latestCtx.activeManifest?.id).toBe("project-B");
    // openProject's own stamp: a reload after this lands in the same place.
    expect(localStorage.getItem(LAST_PROJECT_KEY)).toBe("project-B");
  });

  test("the subscription is dropped on unmount — a late request never touches a torn-down provider", async () => {
    listProjects.mockResolvedValue([{ id: "project-B", title: "B", updatedAt: 2 }]);
    loadProject.mockResolvedValue({ id: "project-B", title: "B" });

    mounted = mountComponent(
      React.createElement(ProjectProvider, null, React.createElement(Consumer)),
    );
    await act(async () => {
      await flush();
    });
    mounted.unmount();
    mounted = null;
    loadProject.mockClear();

    requestProjectOpen("project-B");
    await flush();

    expect(loadProject).not.toHaveBeenCalled();
  });
});
