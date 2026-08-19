import { describe, test, expect, beforeEach } from "vitest";
import {
  getSyncMeta,
  setSyncMeta,
  deleteSyncMeta,
  listSyncMeta,
  _resetSyncMetaForTests,
} from "../syncMeta";

beforeEach(async () => {
  await _resetSyncMetaForTests();
});

describe("sync-meta store", () => {
  test("set/get/list/delete round-trip", async () => {
    expect(await getSyncMeta("p-1")).toBeNull();
    await setSyncMeta("p-1", { ownerId: "u-1", remoteUpdatedAt: 100, lastPushedAt: 200 });
    expect(await getSyncMeta("p-1")).toEqual({
      ownerId: "u-1",
      remoteUpdatedAt: 100,
      lastPushedAt: 200,
    });
    await setSyncMeta("p-2", { ownerId: "u-1", remoteUpdatedAt: 1, lastPushedAt: 1 });
    const all = await listSyncMeta();
    expect(Object.keys(all).sort()).toEqual(["p-1", "p-2"]);
    await deleteSyncMeta("p-1");
    expect(await getSyncMeta("p-1")).toBeNull();
  });
});
