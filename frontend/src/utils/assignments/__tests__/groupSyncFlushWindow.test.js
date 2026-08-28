import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { startGroupSaves, flushGroupSaves, GROUP_PUSH_FAILED_MESSAGE } from "../groupSync";
import { api } from "../../api/client";
import { loadProject, onProjectSaved } from "../../storage/projectStore";

/**
 * Final fix wave (Task 23 residual) — the one gap left in the push barrier.
 *
 * `flushGroupSaves` used to run drain-then-check: wait for what is in flight,
 * then re-read the local copy and push it if it had never gone up. A save
 * landing BETWEEN those two steps escaped both — `track()` stamps `pushedAt`
 * synchronously, so by the time the freshness check read the store it saw a
 * local copy that matched and concluded there was nothing to send, while the
 * push that save had just started was never awaited. Submit then outran the
 * very push the barrier exists to wait for, and a push that failed in that
 * window never reached the refusal check either.
 *
 * That window is a few microtasks wide, so unlike groupSync.test.js (which
 * runs against the REAL project store on purpose) this file mocks the store:
 * the point here is control-flow ordering, and the save has to be staged at
 * an exact moment inside the barrier rather than near it.
 */
vi.mock("../../api/client", () => ({ api: vi.fn() }));
vi.mock("../../storage/projectStore", () => ({
  listProjects: vi.fn(),
  loadProject: vi.fn(),
  saveProject: vi.fn(),
  onProjectSaved: vi.fn(),
}));

const GROUP_ID = "g-1";
const PROJECT_ID = "p-1";

/** A promise the test lets land (or fail) on its own schedule. */
function deferred() {
  let settle;
  const promise = new Promise((resolve, reject) => {
    settle = { resolve, reject };
  });
  return { promise, ...settle };
}

async function tick() {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
}

let unsubscribe = null;
/** The save listener startGroupSaves registers — the test fires it directly,
 *  which is exactly what projectStore's own notify loop does. */
let listener = null;
let order = [];
let pushes = [];

beforeEach(() => {
  order = [];
  pushes = [];
  listener = null;
  onProjectSaved.mockImplementation((fn) => {
    listener = fn;
    return () => {
      listener = null;
    };
  });
  let call = 0;
  api.mockImplementation(() => {
    call += 1;
    const n = call;
    const gate = deferred();
    pushes.push(gate);
    return gate.promise.then(
      (r) => {
        order.push(`push-${n}`);
        return r;
      },
      (err) => {
        order.push(`push-${n}-failed`);
        throw err;
      },
    );
  });
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  vi.clearAllMocks();
});

describe("flushGroupSaves — a save landing inside the barrier's own re-read", () => {
  /** Drives the barrier to the exact point where it is awaiting the local
   *  re-read, with the first push already landed. Returns the handles the
   *  test needs to stage the late save and finish the barrier off. */
  async function barrierInsideTheReRead() {
    const read = deferred();
    loadProject.mockReturnValue(read.promise);

    unsubscribe = startGroupSaves(GROUP_ID, PROJECT_ID);
    listener({ id: PROJECT_ID, updatedAt: 1000 }, {});
    await tick();

    let settled = false;
    const flushed = flushGroupSaves(GROUP_ID).then(
      () => {
        order.push("flush");
        settled = true;
      },
      (err) => {
        order.push("flush-refused");
        settled = true;
        throw err;
      },
    );
    await tick();

    // The first push lands; the barrier's drain finishes and it goes on to
    // re-read the local copy — which is where it now sits, waiting on us.
    pushes[0].resolve({ ok: true });
    await tick();
    expect(loadProject).toHaveBeenCalledWith(PROJECT_ID);

    return { read, flushed, isSettled: () => settled };
  }

  test("the autosave started in that window is waited on, not stepped over", async () => {
    const { read, flushed, isSettled } = await barrierInsideTheReRead();

    // The student's last keystroke autosaves right here. track() stamps
    // pushedAt synchronously, so the read that resolves next reports a local
    // copy that has "already gone up" — while its push is still in flight.
    listener({ id: PROJECT_ID, updatedAt: 2000 }, {});
    read.resolve({ id: PROJECT_ID, updatedAt: 2000 });
    await tick();

    expect(pushes).toHaveLength(2);
    expect(isSettled()).toBe(false); // the second push is still out there

    pushes[1].resolve({ ok: true });
    await flushed;
    expect(order).toEqual(["push-1", "push-2", "flush"]);
  });

  test("and if that push fails, the submit is refused rather than handing in the previous head", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { read, flushed, isSettled } = await barrierInsideTheReRead();

    listener({ id: PROJECT_ID, updatedAt: 2000 }, {});
    read.resolve({ id: PROJECT_ID, updatedAt: 2000 });
    await tick();
    expect(isSettled()).toBe(false);

    pushes[1].reject(new Error("Another member holds the baton."));

    await expect(flushed).rejects.toThrow(GROUP_PUSH_FAILED_MESSAGE);
    warn.mockRestore();
  });
});
