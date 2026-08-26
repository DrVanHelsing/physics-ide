import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { startAssignmentWork } from "../startWork";
import { saveProject } from "../../storage/projectStore";
import { setAssignmentMeta } from "../../storage/assignmentMeta";
import { getGlobalSyncEngine } from "../../sync/syncEngine";
import { api } from "../../api/client";
import { LAST_PROJECT_KEY } from "../../../constants";

/* createManifest (utils/manifest/factory.js) is pure and left real, so the
 * assertions on saveProject's argument double as a check that startWork
 * wires the right fields into it. Everything with a side effect — local
 * storage, the sync engine, the network, assignment-meta caching — is
 * mocked so the sequence's ORDER (design D§2) can be asserted directly. */
vi.mock("../../storage/projectStore", () => ({ saveProject: vi.fn() }));
vi.mock("../../storage/assignmentMeta", () => ({ setAssignmentMeta: vi.fn() }));
vi.mock("../../sync/syncEngine", () => ({ getGlobalSyncEngine: vi.fn() }));
vi.mock("../../api/client", () => ({ api: vi.fn() }));

const ME = { id: "u1" };

function assignment(overrides = {}) {
  return {
    id: "a1",
    classId: "c1",
    title: "Kinematics HW",
    projectType: "physics",
    dueAt: 1700000000000,
    rules: { debug: true },
    myWork: null,
    starterSeed: null,
    ...overrides,
  };
}

let order;
let pushProjectSpy;

beforeEach(() => {
  order = [];
  localStorage.clear();

  saveProject.mockImplementation(async (manifest) => {
    order.push("saveProject");
    return { ...manifest, id: "p-saved-1" };
  });
  pushProjectSpy = vi.fn(async () => {
    order.push("pushProject");
  });
  getGlobalSyncEngine.mockResolvedValue({ pushProject: pushProjectSpy });
  api.mockImplementation(async (path) => {
    order.push(`api:${path}`);
    return {};
  });
  setAssignmentMeta.mockImplementation(async () => {
    order.push("setAssignmentMeta");
  });
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("startAssignmentWork — fresh start (no myWork)", () => {
  test("follows D§2's order: save -> stamp LAST_PROJECT_KEY -> push -> POST /start -> cache context", async () => {
    const a = assignment();
    const id = await startAssignmentWork({ assignment: a, me: ME });

    expect(id).toBe("p-saved-1");
    expect(order).toEqual([
      "saveProject",
      "pushProject",
      "api:/api/assignments/a1/start",
      "setAssignmentMeta",
    ]);
  });

  test("builds a manifest from the assignment when there is no starter — createManifest's own default frame stands in for workspaceXml", async () => {
    await startAssignmentWork({ assignment: assignment(), me: ME });

    const manifestArg = saveProject.mock.calls[0][0];
    expect(manifestArg.goal).toBe("physics");
    expect(manifestArg.title).toBe("Kinematics HW");
    expect(manifestArg.projectType).toBe("custom");
    expect(manifestArg.preferredEditor).toBe("blocks");
    expect(manifestArg.workspace.xml).toContain("sim_start_block");
    expect(manifestArg.source.python).toBe("");
  });

  test("a pinned starter seeds workspaceXml/python and marks the manifest block_template", async () => {
    const a = assignment({
      projectType: "datascience",
      starterSeed: {
        goal: "datascience",
        workspaceXml: "<xml>seed</xml>",
        python: "",
        preferredEditor: "code",
      },
    });
    await startAssignmentWork({ assignment: a, me: ME });

    const manifestArg = saveProject.mock.calls[0][0];
    expect(manifestArg.goal).toBe("datascience");
    expect(manifestArg.projectType).toBe("block_template");
    expect(manifestArg.workspace.xml).toBe("<xml>seed</xml>");
    expect(manifestArg.preferredEditor).toBe("code");
  });

  test("stamps LAST_PROJECT_KEY before pushing to the server — the FK needs the row", async () => {
    let seenAtPush = null;
    pushProjectSpy.mockImplementation(async () => {
      seenAtPush = localStorage.getItem(LAST_PROJECT_KEY);
      order.push("pushProject");
    });
    await startAssignmentWork({ assignment: assignment(), me: ME });
    expect(seenAtPush).toBe("p-saved-1");
  });

  test("pushes with the saved project id and the caller's id", async () => {
    await startAssignmentWork({ assignment: assignment(), me: ME });
    expect(pushProjectSpy).toHaveBeenCalledWith("p-saved-1", "u1");
  });

  test("POSTs /start with the saved project id", async () => {
    await startAssignmentWork({ assignment: assignment(), me: ME });
    expect(api).toHaveBeenCalledWith("/api/assignments/a1/start", {
      method: "POST",
      body: { projectId: "p-saved-1" },
    });
  });

  test("caches assignment context against the NEW project's id", async () => {
    await startAssignmentWork({ assignment: assignment(), me: ME });
    expect(setAssignmentMeta).toHaveBeenCalledWith("p-saved-1", {
      assignmentId: "a1",
      classId: "c1",
      title: "Kinematics HW",
      dueAt: 1700000000000,
      rules: { debug: true },
    });
  });
});

describe("startAssignmentWork — myWork already present (Continue)", () => {
  test("skips create/save/push/POST entirely and caches context against the existing projectId", async () => {
    const a = assignment({ myWork: { projectId: "p-existing-1", startedAt: 123 } });
    const id = await startAssignmentWork({ assignment: a, me: ME });

    expect(id).toBe("p-existing-1");
    expect(saveProject).not.toHaveBeenCalled();
    expect(getGlobalSyncEngine).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
    expect(setAssignmentMeta).toHaveBeenCalledWith("p-existing-1", {
      assignmentId: "a1",
      classId: "c1",
      title: "Kinematics HW",
      dueAt: 1700000000000,
      rules: { debug: true },
    });
  });
});
