import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { mountComponent } from "../../test/renderHelpers";
import { AssignmentProvider, useAssignmentContext } from "../AssignmentContext";
import { useMe } from "../../auth/useAuth";
import { api } from "../../utils/api/client";
import { setAssignmentMeta, getAssignmentMeta, _resetAssignmentMetaForTests } from "../../utils/storage/assignmentMeta";

/* AssignmentProvider calls useMe() and api() directly — stub both,
   following SyncChip.test.js's pattern. assignmentMeta itself is used for
   real (jsdom's localStorage-backed localforage driver, same as
   assignmentMeta.test.js) so these tests exercise the real cache/refresh
   round trip, not a mocked stand-in for it. */
vi.mock("../../auth/useAuth", () => ({ useMe: vi.fn() }));
vi.mock("../../utils/api/client", () => ({ api: vi.fn() }));

function Probe() {
  const ctx = useAssignmentContext();
  return <div data-testid="probe">{ctx ? JSON.stringify(ctx) : "null"}</div>;
}

/* Flushes the microtask queue via a real macrotask boundary — same idiom as
   SyncChip.test.js — so the effect's chain of awaits (cache read, then the
   background refresh) lands before the DOM is inspected. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function probeText() {
  return mounted.container.querySelector('[data-testid="probe"]').textContent;
}

const ME = { id: "u-1", name: "Ada" };

const CACHED = {
  assignmentId: "a-1",
  classId: "c-1",
  title: "Pendulum Lab (cached)",
  dueAt: 1000,
  rules: { editors: "both", debug: true, importFiles: true, exportAndCopy: true, advancedBlocks: true, templates: true },
};

let mounted = null;

beforeEach(async () => {
  await _resetAssignmentMetaForTests();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

describe("AssignmentProvider — cache, refresh, and the guest gate (Task 11)", () => {
  test("cached serve: the cached record renders before any refresh resolves (D§2 — offline lessons run from the cache)", async () => {
    await setAssignmentMeta("p-1", CACHED);
    useMe.mockReturnValue({ data: ME });
    api.mockReturnValue(new Promise(() => {})); // refresh never resolves in this test

    mounted = mountComponent(<AssignmentProvider projectId="p-1"><Probe /></AssignmentProvider>);
    await flush();

    expect(JSON.parse(probeText())).toEqual(CACHED);
  });

  test("offline cache-stands: a rejected refresh leaves the rendered context and the stored cache both untouched", async () => {
    await setAssignmentMeta("p-1", CACHED);
    useMe.mockReturnValue({ data: ME });
    api.mockRejectedValue(new Error("offline"));

    mounted = mountComponent(<AssignmentProvider projectId="p-1"><Probe /></AssignmentProvider>);
    await flush();
    await flush();

    expect(JSON.parse(probeText())).toEqual(CACHED);
    expect(await getAssignmentMeta("p-1")).toEqual(CACHED);
  });

  test("fresh-refresh overwrite: a successful GET overwrites both the rendered context and the cache ('new rules next time they open the work')", async () => {
    await setAssignmentMeta("p-1", CACHED);
    useMe.mockReturnValue({ data: ME });
    const fresh = {
      classId: "c-1",
      title: "Pendulum Lab (renamed)",
      dueAt: 2000,
      rules: { editors: "code", debug: false, importFiles: false, exportAndCopy: false, advancedBlocks: false, templates: false },
    };
    api.mockResolvedValue({ assignment: fresh });

    mounted = mountComponent(<AssignmentProvider projectId="p-1"><Probe /></AssignmentProvider>);
    await flush();
    await flush();

    const expected = { assignmentId: "a-1", ...fresh };
    expect(JSON.parse(probeText())).toEqual(expected);
    expect(await getAssignmentMeta("p-1")).toEqual(expected);
    expect(api).toHaveBeenCalledWith("/api/assignments/a-1");
  });

  test("guest: me is null, so context stays null even though a cached record exists for this project — the guest IDE must be byte-identical", async () => {
    await setAssignmentMeta("p-1", CACHED);
    useMe.mockReturnValue({ data: null });

    mounted = mountComponent(<AssignmentProvider projectId="p-1"><Probe /></AssignmentProvider>);
    await flush();

    expect(probeText()).toBe("null");
    expect(api).not.toHaveBeenCalled();
  });

  test("pending-start record: a project cached before the server confirmed the work row still refreshes cleanly off its assignmentId", async () => {
    // task-10 review's fix round: startWork.js's resolveLocalProject caches
    // this shape immediately after saveProject, before /start has ever
    // succeeded — so assignmentMeta can hold a record with no matching
    // assignment_work row server-side. The refresh GET keys on
    // assignmentId (present either way), not on myWork, so this must not
    // crash or wedge — it refreshes exactly like a fully-linked record.
    const pending = {
      assignmentId: "a-pending",
      classId: "c-2",
      title: "Projectile Motion",
      dueAt: null,
      rules: { editors: "both", debug: true, importFiles: true, exportAndCopy: true, advancedBlocks: true, templates: true },
    };
    await setAssignmentMeta("p-pending", pending);
    useMe.mockReturnValue({ data: ME });
    const fresh = { classId: "c-2", title: "Projectile Motion", dueAt: null, rules: pending.rules };
    api.mockResolvedValue({ assignment: fresh });

    mounted = mountComponent(<AssignmentProvider projectId="p-pending"><Probe /></AssignmentProvider>);
    await flush();
    await flush();

    expect(() => JSON.parse(probeText())).not.toThrow();
    expect(JSON.parse(probeText())).toEqual({ assignmentId: "a-pending", ...fresh });
    expect(api).toHaveBeenCalledWith("/api/assignments/a-pending");
  });
});
