import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { pullGroupProject, pushGroupProject, startGroupSaves } from "../groupSync";
import { api } from "../../api/client";
import { createManifest } from "../../manifest/factory";
import {
  saveProject,
  loadProject,
  _resetAllProjectStorageForTests,
} from "../../storage/projectStore";

/**
 * Task 22 — the group project's own I/O. Only the network is mocked: the
 * project store is REAL (jsdom's localStorage-backed localforage driver,
 * same posture AssignmentContext.test.js takes with assignmentMeta), so
 * these tests exercise the actual saveProject listener contract rather than
 * a stand-in for it — that contract is the whole point of the module.
 */
vi.mock("../../api/client", () => ({ api: vi.fn() }));

const GROUP_ID = "g-1";

function manifestAt(updatedAt, overrides = {}) {
  return { ...createManifest({ goal: "physics", title: "Momentum Lab" }), updatedAt, ...overrides };
}

let unsubscribe = null;

beforeEach(async () => {
  await _resetAllProjectStorageForTests();
  api.mockReset();
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  vi.clearAllMocks();
});

describe("pullGroupProject — the group's head, into the local library", () => {
  test("fetches the group route (never /api/projects/:id — a member may not own the row) and writes the head locally", async () => {
    const head = manifestAt(1000);
    api.mockResolvedValue({ manifest: head, clientUpdatedAt: 1000, savedBy: "u-2" });

    await pullGroupProject(GROUP_ID);

    expect(api).toHaveBeenCalledWith(`/api/groups/${GROUP_ID}/project`);
    const local = await loadProject(head.id);
    expect(local).not.toBeNull();
    expect(local.id).toBe(head.id);
  });

  test("preserves the head's timestamp — a pull is not an edit, and must not re-push as one", async () => {
    const head = manifestAt(1000);
    api.mockResolvedValue({ manifest: head, clientUpdatedAt: 1000, savedBy: "u-2" });

    await pullGroupProject(GROUP_ID);

    expect((await loadProject(head.id)).updatedAt).toBe(1000);
  });

  test("a local copy NEWER than the head is left alone — a pull never silently discards a member's own unsent work", async () => {
    const mine = manifestAt(2000, { title: "My later edit" });
    await saveProject(mine, { preserveTimestamp: true });
    api.mockResolvedValue({ manifest: manifestAt(1000, { id: mine.id }), clientUpdatedAt: 1000, savedBy: "u-2" });

    await pullGroupProject(GROUP_ID);

    const local = await loadProject(mine.id);
    expect(local.title).toBe("My later edit");
    expect(local.updatedAt).toBe(2000);
  });

  test("a head newer than the local copy replaces it — this is how another member's save arrives", async () => {
    const mine = manifestAt(1000, { title: "Before" });
    await saveProject(mine, { preserveTimestamp: true });
    api.mockResolvedValue({
      manifest: manifestAt(3000, { id: mine.id, title: "After" }),
      clientUpdatedAt: 3000,
      savedBy: "u-2",
    });

    await pullGroupProject(GROUP_ID);

    expect((await loadProject(mine.id)).title).toBe("After");
  });
});

describe("pushGroupProject — the group route, never the personal one", () => {
  test("PUTs the manifest to the group's project route", async () => {
    const m = manifestAt(1000);
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    await pushGroupProject(GROUP_ID, m);

    expect(api).toHaveBeenCalledWith(`/api/groups/${GROUP_ID}/project`, {
      method: "PUT",
      body: { manifest: m },
    });
  });

  test("the server's refusal sentence reaches the caller verbatim", async () => {
    api.mockRejectedValue(new Error("Another member holds the baton."));
    await expect(pushGroupProject(GROUP_ID, manifestAt(1000))).rejects.toThrow(
      "Another member holds the baton.",
    );
  });
});

describe("startGroupSaves — pushes only while it is registered (i.e. only while the baton is held)", () => {
  test("a local save of the group project pushes it through the group route", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveProject({ ...m, title: "Edited" });
    await Promise.resolve();

    expect(api).toHaveBeenCalledWith(
      `/api/groups/${GROUP_ID}/project`,
      expect.objectContaining({ method: "PUT" }),
    );
  });

  test("after the listener is torn down (the baton is gone), a save pushes nothing", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    startGroupSaves(GROUP_ID, m.id)();
    await saveProject({ ...m, title: "Edited while read-only" });
    await Promise.resolve();

    expect(api).not.toHaveBeenCalled();
  });

  test("a preserveTimestamp write (the pull itself) never echoes straight back to the server", async () => {
    const m = manifestAt(1000);
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveProject(m, { preserveTimestamp: true });
    await Promise.resolve();

    expect(api).not.toHaveBeenCalled();
  });

  test("saving a DIFFERENT project never lands in the group's row", async () => {
    const group = manifestAt(1000);
    const personal = manifestAt(1000);
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    unsubscribe = startGroupSaves(GROUP_ID, group.id);
    await saveProject(personal);
    await Promise.resolve();

    expect(api).not.toHaveBeenCalled();
  });

  test("a refused push never breaks the local save", async () => {
    const m = manifestAt(1000);
    api.mockRejectedValue(new Error("Take the baton before saving."));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    const saved = await saveProject(m);
    await Promise.resolve();
    await Promise.resolve();

    expect(saved.id).toBe(m.id);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Take the baton before saving."));
    warn.mockRestore();
  });
});
