import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import {
  pullGroupProject,
  pushGroupProject,
  startGroupSaves,
  onGroupPushFailed,
  flushGroupSaves,
  GROUP_PUSH_FAILED_MESSAGE,
} from "../groupSync";
import { api } from "../../api/client";
import { createManifest } from "../../manifest/factory";
import {
  saveProject,
  loadProject,
  onProjectSaved,
  _resetAllProjectStorageForTests,
} from "../../storage/projectStore";
import { ProjectProvider } from "../../../contexts/ProjectContext";
import { SimulationProvider, useSimulationContext } from "../../../contexts/SimulationContext";
import { useProject } from "../../../hooks/useProject";
import { mountComponent } from "../../../test/renderHelpers";

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

/**
 * Task 23, fix round 1 — the push barrier submit depends on.
 *
 * The listener above is fire-and-forget by design (a refused push must never
 * fail the local save it hangs off), which left group submit able to outrun
 * it: the PUT carrying the student's newest save could still be in flight
 * when POST /submit was issued, and the server would then snapshot — and
 * FINGERPRINT — the previous head. `flushGroupSaves` is the awaited barrier
 * that closes that, and the refusal that replaces a silent stale hand-in.
 */
describe("flushGroupSaves — the barrier submit waits on", () => {
  /** A push that hangs until the test lets it land (or fail). */
  function deferredPush() {
    let settle;
    const gate = new Promise((resolve, reject) => {
      settle = { land: () => resolve({ ok: true, clientUpdatedAt: 1 }), fail: (e) => reject(e) };
    });
    return { gate, ...settle };
  }

  async function tick() {
    for (let i = 0; i < 4; i += 1) await Promise.resolve();
  }

  /** A real macrotask boundary — the store's own reads land across one, so a
   *  "has NOT resolved yet" claim needs this rather than a microtask drain. */
  async function settleTasks() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  test("a push still in flight is awaited — submit can never outrun the save it depends on", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    const push = deferredPush();
    const order = [];
    api.mockImplementation(() => push.gate.then((r) => { order.push("push"); return r; }));

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveProject({ ...m, title: "The change being handed in" });
    await tick();

    let settled = false;
    const flushed = flushGroupSaves(GROUP_ID).then(() => { order.push("flush"); settled = true; });
    await tick();
    expect(settled).toBe(false); // still waiting on the push, as it must

    push.land();
    await flushed;
    expect(order).toEqual(["push", "flush"]);
  });

  test("a save that fires WHILE the barrier waits is waited on too — submit lands behind the LAST push", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    const first = deferredPush();
    const second = deferredPush();
    const order = [];
    let call = 0;
    api.mockImplementation(() => {
      call += 1;
      const n = call;
      const gate = n === 1 ? first : second;
      return gate.gate.then((r) => {
        order.push(`push-${n}`);
        return r;
      });
    });

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveProject({ ...m, title: "First" });
    await tick();

    let settled = false;
    const flushed = flushGroupSaves(GROUP_ID).then(() => { order.push("flush"); settled = true; });
    await tick();

    // The autosave the student's last keystroke started, arriving mid-wait.
    await saveProject({ ...m, title: "Second" });
    await tick();
    first.land();
    await settleTasks(); // a real macrotask boundary — no timing luck in the claim below
    expect(settled).toBe(false); // the second push is still out there

    second.land();
    await flushed;
    expect(order).toEqual(["push-1", "push-2", "flush"]);
  });

  test("a push that never landed refuses the submit instead of handing in the previous save", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    api.mockRejectedValue(new Error("Another member holds the baton."));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveProject({ ...m, title: "Never reached the group" });
    await tick();

    await expect(flushGroupSaves(GROUP_ID)).rejects.toThrow(GROUP_PUSH_FAILED_MESSAGE);
    warn.mockRestore();
  });

  test("a later push that lands clears the refusal — the member fixed it, so submit is allowed again", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    api.mockRejectedValueOnce(new Error("Another member holds the baton."));

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveProject({ ...m, title: "Refused" });
    await tick();

    api.mockResolvedValue({ ok: true, clientUpdatedAt: 2 });
    await saveProject({ ...m, title: "Landed" });
    await tick();

    await expect(flushGroupSaves(GROUP_ID)).resolves.toBeUndefined();
    warn.mockRestore();
  });

  test("holding the baton: the current local copy is pushed BEFORE submit, even if no save fired the listener", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await flushGroupSaves(GROUP_ID);

    expect(api).toHaveBeenCalledWith(
      `/api/groups/${GROUP_ID}/project`,
      expect.objectContaining({ method: "PUT" }),
    );
    expect(api.mock.calls[0][1].body.manifest.id).toBe(m.id);
  });

  test("a copy the listener already pushed is not pushed a second time", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveProject({ ...m, title: "Edited" });
    await tick();
    expect(api).toHaveBeenCalledTimes(1);

    await flushGroupSaves(GROUP_ID);
    expect(api).toHaveBeenCalledTimes(1);
  });

  test("not the baton holder: nothing of theirs is in flight, so the barrier is a no-op", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    await expect(flushGroupSaves(GROUP_ID)).resolves.toBeUndefined();
    expect(api).not.toHaveBeenCalled();
  });

  test("another group's submit never waits on — or pushes — this group's work", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await flushGroupSaves("g-someone-else");

    expect(api).not.toHaveBeenCalled();
  });

  /* The barrier is the HOLDER's: the listener existing is the permission to
     write, so once it is gone there is nothing this member may push and
     nothing of theirs still in flight to wait for. A member who lost the
     baton mid-edit is then in the same position as any other non-holder —
     the head is whatever the group last saved. That is inherent to group
     work (see the report's "known limitation"), not something this barrier
     can detect from one browser. */
  test("after the baton is gone the barrier is a no-op — a member with no turn has nothing to push", async () => {
    const m = manifestAt(1000);
    await saveProject(m, { preserveTimestamp: true });
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });

    startGroupSaves(GROUP_ID, m.id)();
    api.mockClear();

    await expect(flushGroupSaves(GROUP_ID)).resolves.toBeUndefined();
    expect(api).not.toHaveBeenCalled();
  });
});

/**
 * Fix round 1. A refused push is the earliest, most reliable news that this
 * member's turn is over (or never began) — the server has just said so in
 * as many words. Swallowing it into console.warn left the chip claiming the
 * baton, and the workspace editable, until the next 20 s poll. Announcing it
 * lets the chip re-read at once, the same re-read it already does after a
 * 409 on take.
 */
describe("onGroupPushFailed — a refused push announces itself", () => {
  async function saveAndSettle(manifest) {
    await saveProject(manifest);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  test("a refused push notifies subscribers, carrying the server's own refusal", async () => {
    const m = manifestAt(1000);
    api.mockRejectedValue(new Error("Take the baton before saving."));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const heard = [];
    const off = onGroupPushFailed((err) => heard.push(err));

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveAndSettle(m);
    off();

    expect(heard).toHaveLength(1);
    expect(heard[0].message).toBe("Take the baton before saving.");
    warn.mockRestore();
  });

  test("a push that lands announces nothing — there is nothing for the chip to correct", async () => {
    const m = manifestAt(1000);
    api.mockResolvedValue({ ok: true, clientUpdatedAt: 1000 });
    const heard = [];
    const off = onGroupPushFailed(() => heard.push(true));

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveAndSettle(m);
    off();

    expect(heard).toHaveLength(0);
  });

  test("unsubscribing stops the announcements", async () => {
    const m = manifestAt(1000);
    api.mockRejectedValue(new Error("Take the baton before saving."));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const heard = [];
    onGroupPushFailed(() => heard.push(true))();

    unsubscribe = startGroupSaves(GROUP_ID, m.id);
    await saveAndSettle(m);

    expect(heard).toHaveLength(0);
    warn.mockRestore();
  });
});

/**
 * Fix round 1, the other half of "taking the baton delivers the head": a
 * pull is only useful if the OPEN project follows it. It does — through the
 * mechanism that already exists for exactly this, and through nothing new:
 * pullGroupProject writes with `preserveTimestamp`, and useProject subscribes
 * to precisely those writes ("A sync PULL writes straight through
 * projectStore … adopt the pulled manifest into the live session instead")
 * to cancel any in-flight autosave, swap the active manifest, and re-apply it
 * to the editors. These two describes pin both ends of that seam.
 */
describe("pullGroupProject — the write the open project reloads from", () => {
  test("a newer head lands as a preserveTimestamp save — the signal useProject adopts", async () => {
    const mine = manifestAt(1000, { title: "Before" });
    await saveProject(mine, { preserveTimestamp: true });
    api.mockResolvedValue({
      manifest: manifestAt(3000, { id: mine.id, title: "After" }),
      clientUpdatedAt: 3000,
      savedBy: "u-2",
    });
    const seen = [];
    const off = onProjectSaved((m, opts) => seen.push({ id: m.id, opts }));

    await pullGroupProject(GROUP_ID);
    off();

    expect(seen).toEqual([{ id: mine.id, opts: { preserveTimestamp: true } }]);
  });

  test("a head no newer than the local copy writes nothing, so nothing reloads under the member", async () => {
    const mine = manifestAt(2000, { title: "Mine" });
    await saveProject(mine, { preserveTimestamp: true });
    api.mockResolvedValue({
      manifest: manifestAt(2000, { id: mine.id, title: "Same age" }),
      clientUpdatedAt: 2000,
      savedBy: "u-2",
    });
    const seen = [];
    const off = onProjectSaved(() => seen.push(true));

    await pullGroupProject(GROUP_ID);
    off();

    expect(seen).toEqual([]);
  });
});

describe("pullGroupProject — the open project, in a live session", () => {
  let mounted = null;
  let session = null;

  function Session() {
    session = { proj: useProject(), sim: useSimulationContext() };
    return null;
  }

  /* No localStorage.clear() here: localforage runs on the localStorage
     driver under jsdom, so clearing it would take the project with it. The
     bootstrap's last-project restore is harmless anyway — manifest ids are
     fresh per test, so a stale pointer can never match one. */
  async function openSession(projectId) {
    mounted = mountComponent(
      <ProjectProvider>
        <SimulationProvider>
          <Session />
        </SimulationProvider>
      </ProjectProvider>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await session.proj.selectProject(projectId);
    });
  }

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    session = null;
  });

  test("a head newer than the open copy reloads the editors — this is what makes a takeover safe", async () => {
    const mine = manifestAt(1000, { title: "Before", source: { python: "print('mine')" } });
    await saveProject(mine, { preserveTimestamp: true });
    await openSession(mine.id);
    expect(session.sim.pythonCode).toBe("print('mine')");

    api.mockResolvedValue({
      manifest: manifestAt(3000, {
        id: mine.id,
        title: "After",
        source: { python: "print('theirs')" },
      }),
      clientUpdatedAt: 3000,
      savedBy: "u-2",
    });
    await act(async () => {
      await pullGroupProject(GROUP_ID);
    });

    expect(session.sim.pythonCode).toBe("print('theirs')");
    expect(session.proj.activeManifest.title).toBe("After");
  });

  test("a head no newer than the open copy leaves the editors exactly as they are", async () => {
    const mine = manifestAt(2000, { title: "Mine", source: { python: "print('mine')" } });
    await saveProject(mine, { preserveTimestamp: true });
    await openSession(mine.id);

    api.mockResolvedValue({
      manifest: manifestAt(2000, {
        id: mine.id,
        title: "Same age",
        source: { python: "print('theirs')" },
      }),
      clientUpdatedAt: 2000,
      savedBy: "u-2",
    });
    await act(async () => {
      await pullGroupProject(GROUP_ID);
    });

    expect(session.sim.pythonCode).toBe("print('mine')");
    expect(session.proj.activeManifest.title).toBe("Mine");
  });
});
