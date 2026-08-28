import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { startAssignmentWork } from "../startWork";
import { saveProject, loadProject } from "../../storage/projectStore";
import { setAssignmentMeta, listAssignmentMeta, deleteAssignmentMeta } from "../../storage/assignmentMeta";
import { getGlobalSyncEngine } from "../../sync/syncEngine";
import { api } from "../../api/client";
import { pullGroupProject } from "../groupSync";
import { requestProjectOpen } from "../../projectOpenRequest";
import { LAST_PROJECT_KEY } from "../../../constants";

/* createManifest (utils/manifest/factory.js) is pure and left real, so the
 * assertions on saveProject's argument double as a check that startWork
 * wires the right fields into it. Everything with a side effect — local
 * storage, the sync engine, the network, assignment-meta caching — is
 * mocked so the sequence's ORDER (design D§2) can be asserted directly. */
vi.mock("../../storage/projectStore", () => ({ saveProject: vi.fn(), loadProject: vi.fn() }));
vi.mock("../../storage/assignmentMeta", () => ({
  setAssignmentMeta: vi.fn(),
  listAssignmentMeta: vi.fn(),
  deleteAssignmentMeta: vi.fn(),
}));
vi.mock("../../sync/syncEngine", () => ({ getGlobalSyncEngine: vi.fn() }));
vi.mock("../../api/client", () => ({ api: vi.fn() }));
vi.mock("../groupSync", () => ({ pullGroupProject: vi.fn() }));
vi.mock("../../projectOpenRequest", () => ({ requestProjectOpen: vi.fn() }));

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

function okEngine(pushProjectSpy) {
  return { pushProject: pushProjectSpy, getStatus: () => ({ state: "synced", pendingCount: 0, lastError: null }) };
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
  loadProject.mockResolvedValue(null);
  listAssignmentMeta.mockResolvedValue({}); // no pending project from an earlier failed attempt, by default
  deleteAssignmentMeta.mockResolvedValue(undefined);

  pushProjectSpy = vi.fn(async () => {
    order.push("pushProject");
  });
  getGlobalSyncEngine.mockResolvedValue(okEngine(pushProjectSpy));

  api.mockImplementation(async (path) => {
    order.push(`api:${path}`);
    // Normal case: the server links the SAME project this attempt pushed.
    return { work: { projectId: "p-saved-1" } };
  });
  setAssignmentMeta.mockImplementation(async () => {
    order.push("setAssignmentMeta");
  });
  pullGroupProject.mockImplementation(async () => {
    order.push("pullGroupProject");
  });
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("startAssignmentWork — fresh start (no myWork, no pending retry)", () => {
  test("follows D§2's order: save -> cache (pending) -> stamp LAST_PROJECT_KEY -> push -> POST /start -> cache (final)", async () => {
    const a = assignment();
    const id = await startAssignmentWork({ assignment: a, me: ME });

    expect(id).toBe("p-saved-1");
    // setAssignmentMeta appears twice: once immediately after saveProject
    // (the retry-idempotency pending cache) and once at the very end with
    // the server-confirmed linked id — see startWork.js's file header.
    expect(order).toEqual([
      "saveProject",
      "setAssignmentMeta",
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
      groupId: null,
      individualWork: false,
    });
  });

  // Task 6: the flag threaded into the cached meta — Task 11's Toolbar Share
  // gate reads it offline via assignmentMeta, so it has to survive the SAME
  // cacheContext call the rest of the record goes through.
  test("individualWork: true on the assignment is carried into the cached meta", async () => {
    const a = assignment({ individualWork: true });
    await startAssignmentWork({ assignment: a, me: ME });
    expect(setAssignmentMeta).toHaveBeenCalledWith(
      "p-saved-1",
      expect.objectContaining({ assignmentId: "a1", individualWork: true }),
    );
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
      groupId: null,
      individualWork: false,
    });
  });

  test("stamps LAST_PROJECT_KEY so 'Continue' reopens THIS assignment's project, not the last one touched", async () => {
    localStorage.setItem(LAST_PROJECT_KEY, "p-something-else");
    const a = assignment({ myWork: { projectId: "p-existing-1", startedAt: 123 } });

    await startAssignmentWork({ assignment: a, me: ME });

    expect(localStorage.getItem(LAST_PROJECT_KEY)).toBe("p-existing-1");
  });

  test("individual work never touches the group routes", async () => {
    const a = assignment({ myWork: { projectId: "p-existing-1", startedAt: 123 } });
    await startAssignmentWork({ assignment: a, me: ME });
    expect(pullGroupProject).not.toHaveBeenCalled();
  });
});

/* ── Task 22: group work ──────────────────────────────────────────────
   The shared project lives under the FOUNDING member's account. Only the
   founder ever pushes it through the personal engine (that is what /start
   links); every other member's local copy arrives through the group route,
   because /api/projects/:id would 404 for a project they do not own. */
describe("startAssignmentWork — group work", () => {
  const GROUP = { id: "g1", name: "Group 1", projectId: null, members: [] };

  test("the founding member follows D§2 unchanged — their own push is what /start links", async () => {
    const a = assignment({ submissionMode: "pair", myGroup: GROUP });
    const id = await startAssignmentWork({ assignment: a, me: ME });

    expect(id).toBe("p-saved-1");
    expect(order).toEqual([
      "saveProject",
      "setAssignmentMeta",
      "pushProject",
      "api:/api/assignments/a1/start",
      "setAssignmentMeta",
    ]);
    expect(pullGroupProject).not.toHaveBeenCalled();
  });

  test("the group id is cached alongside the rest of the assignment context", async () => {
    const a = assignment({ submissionMode: "pair", myGroup: GROUP });
    await startAssignmentWork({ assignment: a, me: ME });

    expect(setAssignmentMeta).toHaveBeenCalledWith(
      "p-saved-1",
      expect.objectContaining({ assignmentId: "a1", groupId: "g1" }),
    );
  });

  test("a LATER member gets their copy from the group route — never a create, a push, or /start", async () => {
    const a = assignment({
      submissionMode: "pair",
      myGroup: { ...GROUP, projectId: "p-founder" },
      myWork: { projectId: "p-founder", startedAt: 1 },
    });

    const id = await startAssignmentWork({ assignment: a, me: ME });

    expect(id).toBe("p-founder");
    expect(saveProject).not.toHaveBeenCalled();
    expect(getGlobalSyncEngine).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
    expect(pullGroupProject).toHaveBeenCalledWith("g1");
    expect(localStorage.getItem(LAST_PROJECT_KEY)).toBe("p-founder");
  });

  test("losing the race to another MEMBER: the winner's project is pulled, since it is on their account, not ours", async () => {
    api.mockImplementation(async (path) => {
      order.push(`api:${path}`);
      return { work: { projectId: "p-other-member" } };
    });
    const a = assignment({ submissionMode: "pair", myGroup: GROUP });

    const id = await startAssignmentWork({ assignment: a, me: ME });

    expect(id).toBe("p-other-member");
    expect(deleteAssignmentMeta).toHaveBeenCalledWith("p-saved-1");
    expect(pullGroupProject).toHaveBeenCalledWith("g1");
    expect(localStorage.getItem(LAST_PROJECT_KEY)).toBe("p-other-member");
  });
});

describe("startAssignmentWork — push failure (engine never throws)", () => {
  test("a failed push surfaces an honest error and never calls /start", async () => {
    getGlobalSyncEngine.mockResolvedValue({
      pushProject: pushProjectSpy,
      getStatus: () => ({ state: "error", pendingCount: 1, lastError: "Storage cap reached." }),
    });

    await expect(startAssignmentWork({ assignment: assignment(), me: ME })).rejects.toThrow(
      "Could not reach the server — check your connection and try again.",
    );

    expect(pushProjectSpy).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalled();
  });

  test("an offline push status is treated the same as an error", async () => {
    getGlobalSyncEngine.mockResolvedValue({
      pushProject: pushProjectSpy,
      getStatus: () => ({ state: "offline", pendingCount: 1, lastError: null }),
    });

    await expect(startAssignmentWork({ assignment: assignment(), me: ME })).rejects.toThrow(
      "Could not reach the server — check your connection and try again.",
    );
    expect(api).not.toHaveBeenCalled();
  });

  test("the failed attempt's own local project is cached (pending) immediately, before the push even runs", async () => {
    getGlobalSyncEngine.mockResolvedValue({
      pushProject: pushProjectSpy,
      getStatus: () => ({ state: "error", pendingCount: 1, lastError: null }),
    });

    await expect(startAssignmentWork({ assignment: assignment(), me: ME })).rejects.toThrow();

    expect(setAssignmentMeta).toHaveBeenCalledWith(
      "p-saved-1",
      expect.objectContaining({ assignmentId: "a1" }),
    );
  });

  test("retrying after a push failure reuses the SAME local project — no duplicate creation", async () => {
    const engineFailing = {
      pushProject: pushProjectSpy,
      getStatus: () => ({ state: "error", pendingCount: 1, lastError: null }),
    };
    getGlobalSyncEngine.mockResolvedValueOnce(engineFailing);

    await expect(startAssignmentWork({ assignment: assignment(), me: ME })).rejects.toThrow();
    expect(saveProject).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalled();

    // What the failed attempt's own pending cacheContext call left behind —
    // simulate it being read back from storage on the retry.
    listAssignmentMeta.mockResolvedValue({ "p-saved-1": { assignmentId: "a1" } });
    loadProject.mockResolvedValue({ id: "p-saved-1", title: "Kinematics HW" });
    getGlobalSyncEngine.mockResolvedValueOnce(okEngine(pushProjectSpy));

    const id = await startAssignmentWork({ assignment: assignment(), me: ME });

    expect(id).toBe("p-saved-1");
    expect(saveProject).toHaveBeenCalledTimes(1); // still just once across both attempts
    expect(api).toHaveBeenCalledWith("/api/assignments/a1/start", {
      method: "POST",
      body: { projectId: "p-saved-1" },
    });
  });

  test("a pending project whose local copy has since vanished is dropped, not resumed", async () => {
    listAssignmentMeta.mockResolvedValue({ "p-gone": { assignmentId: "a1" } });
    loadProject.mockResolvedValue(null); // deleted locally since the pending cache was written

    await startAssignmentWork({ assignment: assignment(), me: ME });

    expect(deleteAssignmentMeta).toHaveBeenCalledWith("p-gone");
    expect(saveProject).toHaveBeenCalledTimes(1); // fell through to a fresh create
  });
});

/* ── Final fix wave, D2: the pending-open handshake ──────────────────
   Stamping LAST_PROJECT_KEY only answers a RELOAD of "/". AssignmentPage
   navigates there client-side, which remounts nothing — ProjectContext read
   that key once, at boot, long before this click. So every start landed the
   student on the start menu rather than in the work they just opened. The
   settled id is now announced as well; the stamp stays, for the reload. */
describe("startAssignmentWork — announcing the project to open", () => {
  test("a fresh start asks for the project the server actually linked", async () => {
    await startAssignmentWork({ assignment: assignment(), me: ME });
    expect(requestProjectOpen).toHaveBeenCalledWith("p-saved-1");
  });

  test("Continue asks for the existing work's project", async () => {
    const a = assignment({ myWork: { projectId: "p-existing-1", startedAt: 123 } });
    await startAssignmentWork({ assignment: a, me: ME });
    expect(requestProjectOpen).toHaveBeenCalledWith("p-existing-1");
  });

  test("losing the start race asks for the WINNER's project, never this attempt's orphan", async () => {
    api.mockImplementation(async (path) => {
      order.push(`api:${path}`);
      return { work: { projectId: "p-winner-from-other-tab" } };
    });

    await startAssignmentWork({ assignment: assignment(), me: ME });

    expect(requestProjectOpen).toHaveBeenLastCalledWith("p-winner-from-other-tab");
  });

  test("a failed push announces nothing — there is no project to open", async () => {
    getGlobalSyncEngine.mockResolvedValue({
      pushProject: pushProjectSpy,
      getStatus: () => ({ state: "offline", pendingCount: 1, lastError: null }),
    });

    await expect(startAssignmentWork({ assignment: assignment(), me: ME })).rejects.toThrow();
    expect(requestProjectOpen).not.toHaveBeenCalled();
  });
});

describe("startAssignmentWork — uses the server's response, not just its own local id", () => {
  test("concurrent double-start: the server hands back the WINNER's projectId, which is what gets cached and returned", async () => {
    api.mockImplementation(async (path) => {
      order.push(`api:${path}`);
      return { work: { projectId: "p-winner-from-other-tab" } };
    });

    const id = await startAssignmentWork({ assignment: assignment(), me: ME });

    expect(id).toBe("p-winner-from-other-tab");
    expect(setAssignmentMeta).toHaveBeenCalledWith(
      "p-winner-from-other-tab",
      expect.objectContaining({ assignmentId: "a1" }),
    );
  });

  test("the loser's own local copy's pending cache is dropped, not left masquerading as the working copy", async () => {
    api.mockImplementation(async (path) => {
      order.push(`api:${path}`);
      return { work: { projectId: "p-winner-from-other-tab" } };
    });

    await startAssignmentWork({ assignment: assignment(), me: ME });

    expect(deleteAssignmentMeta).toHaveBeenCalledWith("p-saved-1");
  });
});
