import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAssignmentMeta,
  setAssignmentMeta,
  deleteAssignmentMeta,
  listAssignmentMeta,
  _resetAssignmentMetaForTests,
} from "../assignmentMeta";

beforeEach(async () => {
  await _resetAssignmentMetaForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const RULES = {
  editors: "both",
  debug: true,
  importFiles: false,
  exportAndCopy: false,
  advancedBlocks: true,
  templates: false,
};

describe("assignment-meta store — mirrors syncMeta.js's own harness", () => {
  test("set/get/list/delete round-trip", async () => {
    expect(await getAssignmentMeta("p-1")).toBeNull();

    const meta = { assignmentId: "a-1", classId: "c-1", title: "Pendulum Lab", dueAt: 1000, rules: RULES };
    await setAssignmentMeta("p-1", meta);
    // groupId is an explicit null, not an absent key: "this project is not
    // group work" is a fact the IDE reads offline, so it is written down.
    expect(await getAssignmentMeta("p-1")).toEqual({ ...meta, groupId: null });

    await setAssignmentMeta("p-2", { ...meta, assignmentId: "a-2" });
    const all = await listAssignmentMeta();
    expect(Object.keys(all).sort()).toEqual(["p-1", "p-2"]);

    await deleteAssignmentMeta("p-1");
    expect(await getAssignmentMeta("p-1")).toBeNull();
  });

  test("a pending-start record — cached by startWork.js before the server confirms the work row — round-trips the same shape", async () => {
    // task-10's fix round: resolveLocalProject caches this exact shape
    // (real assignmentId/title/dueAt/rules) right after a fresh local
    // project is saved, BEFORE /start has ever succeeded — so this store
    // must hold and return it exactly like any other record.
    const pending = {
      assignmentId: "a-9",
      classId: "c-9",
      title: "Projectile Motion",
      dueAt: null,
      rules: { editors: "both", debug: true, importFiles: true, exportAndCopy: true, advancedBlocks: true, templates: true },
    };
    await setAssignmentMeta("p-pending", pending);
    expect(await getAssignmentMeta("p-pending")).toEqual({ ...pending, groupId: null });
  });

  test("group work: the group id rides with the rest of the context, so the IDE knows offline which routes its saves take", async () => {
    const meta = {
      assignmentId: "a-5",
      classId: "c-5",
      title: "Collisions",
      dueAt: null,
      rules: RULES,
      groupId: "g-7",
    };
    await setAssignmentMeta("p-group", meta);
    expect(await getAssignmentMeta("p-group")).toEqual(meta);
  });

  test("blocked storage: getAssignmentMeta rejects rather than silently returning null", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    await expect(getAssignmentMeta("p-1")).rejects.toThrow();
  });

  test("blocked storage: setAssignmentMeta rejects rather than silently no-op", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    await expect(
      setAssignmentMeta("p-1", { assignmentId: "a-1", classId: "c-1", title: "t", dueAt: null, rules: null }),
    ).rejects.toThrow();
  });
});
