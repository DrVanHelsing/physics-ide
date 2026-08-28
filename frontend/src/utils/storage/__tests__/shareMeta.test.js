import { describe, test, expect, beforeEach } from "vitest";
import {
  getShareAttribution,
  setShareAttribution,
  deleteShareAttribution,
  listShareAttribution,
  _resetShareMetaForTests,
} from "../shareMeta";

beforeEach(async () => {
  await _resetShareMetaForTests();
});

const ATTRIBUTION = { shareId: "s-1", sharerId: "u-1", sharerName: "Thabo M." };

describe("share-meta store — mirrors assignmentMeta.js's own harness", () => {
  test("set/get round-trip", async () => {
    await setShareAttribution("p-1", ATTRIBUTION);
    expect(await getShareAttribution("p-1")).toEqual(ATTRIBUTION);
  });

  test("get on a missing id returns null", async () => {
    expect(await getShareAttribution("p-none")).toBeNull();
  });

  test("delete removes the record", async () => {
    await setShareAttribution("p-1", ATTRIBUTION);
    await deleteShareAttribution("p-1");
    expect(await getShareAttribution("p-1")).toBeNull();
  });

  test("listShareAttribution returns the map with the share-meta: prefix stripped", async () => {
    const a1 = { shareId: "s-1", sharerId: "u-1", sharerName: "Thabo M." };
    const a2 = { shareId: "s-2", sharerId: "u-2", sharerName: "Naledi K." };
    await setShareAttribution("p-1", a1);
    await setShareAttribution("p-2", a2);

    expect(await listShareAttribution()).toEqual({ "p-1": a1, "p-2": a2 });
  });

  test("_resetShareMetaForTests clears the store", async () => {
    await setShareAttribution("p-1", ATTRIBUTION);
    await _resetShareMetaForTests();
    expect(await listShareAttribution()).toEqual({});
  });
});
