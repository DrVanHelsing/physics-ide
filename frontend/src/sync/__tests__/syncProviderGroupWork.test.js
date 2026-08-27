import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import SyncProvider from "../SyncProvider";
import { mountComponent } from "../../test/renderHelpers";
import { useMe } from "../../auth/useAuth";
import { getGlobalSyncEngine } from "../../utils/sync/syncEngine";
import { createManifest } from "../../utils/manifest/factory";
import { saveProject, _resetAllProjectStorageForTests } from "../../utils/storage/projectStore";
import { setAssignmentMeta, _resetAssignmentMetaForTests } from "../../utils/storage/assignmentMeta";
import { _resetSyncMetaForTests } from "../../utils/storage/syncMeta";

/**
 * Task 22 — the plan's binding architectural note for group work: "group
 * work does NOT ride the personal sync engine. The shared project row lives
 * under the FOUNDING member's account; every other member reaches it
 * exclusively through the group endpoints."
 *
 * The wiring that would otherwise break that rule is push-after-save's
 * auto-adopt branch: a group project's local copy is born signed-in and
 * carries no sync meta, so without a guard the first local edit would upload
 * a copy of the FOUNDER's project into whichever member made it — under
 * their account, against their project cap. These tests pin the guard.
 *
 * Only the account hook and the engine are mocked; the project store, the
 * sync-meta store and the assignment-meta store are all real (jsdom's
 * localStorage-backed localforage driver), because what is under test is
 * exactly which of those the handler consults.
 */
vi.mock("../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../utils/sync/syncEngine", () => ({ getGlobalSyncEngine: vi.fn() }));

const ME = { id: "u-me" };

let engine = null;
let mounted = null;

function context(groupId) {
  return {
    assignmentId: "a-1",
    classId: "c-1",
    title: "Momentum Lab",
    dueAt: null,
    rules: null,
    groupId,
  };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(async () => {
  localStorage.clear();
  await _resetAllProjectStorageForTests();
  await _resetSyncMetaForTests();
  await _resetAssignmentMetaForTests();
  useMe.mockReturnValue({ data: ME });
  engine = {
    reset: vi.fn(),
    setOnline: vi.fn(),
    reconcile: vi.fn().mockResolvedValue(undefined),
    drainPending: vi.fn(),
    pushProject: vi.fn(),
    adoptLocalProject: vi.fn().mockResolvedValue(undefined),
    deleteRemoteProject: vi.fn().mockResolvedValue(undefined),
    getStatus: () => ({ state: "idle", pendingCount: 0, lastError: null }),
  };
  getGlobalSyncEngine.mockResolvedValue(engine);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

/** Mount with an EMPTY local library, so anything saved afterwards counts as
 *  "born signed-in" — the branch that auto-adopts. */
async function mountWired() {
  mounted = mountComponent(<SyncProvider><div /></SyncProvider>);
  await flush();
  await flush();
}

describe("push-after-save and group work", () => {
  test("a group project's local save never gets adopted into this member's own account", async () => {
    await mountWired();
    const m = createManifest({ goal: "physics", title: "Momentum Lab" });
    await setAssignmentMeta(m.id, context("g-1"));

    await saveProject(m);
    await flush();
    await flush();

    expect(engine.adoptLocalProject).not.toHaveBeenCalled();
    expect(engine.pushProject).not.toHaveBeenCalled();
  });

  test("an ordinary signed-in project still adopts — the guard is about group work, nothing else", async () => {
    await mountWired();
    const m = createManifest({ goal: "physics", title: "My own project" });

    await saveProject(m);
    await flush();
    await flush();

    expect(engine.adoptLocalProject).toHaveBeenCalledWith(m.id, ME.id);
  });

  test("an INDIVIDUAL assignment's project adopts as normal — that one really is the student's own", async () => {
    await mountWired();
    const m = createManifest({ goal: "physics", title: "Kinematics HW" });
    await setAssignmentMeta(m.id, context(null));

    await saveProject(m);
    await flush();
    await flush();

    expect(engine.adoptLocalProject).toHaveBeenCalledWith(m.id, ME.id);
  });
});
