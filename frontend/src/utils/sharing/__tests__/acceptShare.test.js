import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { acceptShare } from "../acceptShare";
import { api } from "../../api/client";
import { saveProject } from "../../storage/projectStore";
import { setShareAttribution } from "../../storage/shareMeta";
import { getGlobalSyncEngine } from "../../sync/syncEngine";
import { assertPushSucceeded } from "../../assignments/startWork";
import { requestProjectOpen } from "../../projectOpenRequest";
import { LAST_PROJECT_KEY } from "../../../constants";

/**
 * D§4's order (acceptShare.js's own header comment) — the load-bearing
 * property this suite exists to pin: api(accept) -> saveProject (verbatim,
 * preserveTimestamp) -> setShareAttribution -> pushProject ->
 * assertPushSucceeded -> requestProjectOpen. Every dependency with a side
 * effect is mocked so the ORDER can be asserted directly, the same idiom
 * startWork.test.js uses for D§2's order. generateId is mocked to a fixed
 * id so the accept body and every downstream id assertion are exact.
 */
vi.mock("../../api/client", () => ({ api: vi.fn() }));
vi.mock("../../storage/projectStore", () => ({ saveProject: vi.fn() }));
vi.mock("../../storage/shareMeta", () => ({ setShareAttribution: vi.fn() }));
vi.mock("../../sync/syncEngine", () => ({ getGlobalSyncEngine: vi.fn() }));
vi.mock("../../assignments/startWork", () => ({ assertPushSucceeded: vi.fn() }));
vi.mock("../../projectOpenRequest", () => ({ requestProjectOpen: vi.fn() }));
vi.mock("../../manifest/factory", () => ({ generateId: () => "p-fresh-1" }));

const ME = { id: "u-me" };
const SHARE = { id: "s-1", title: "Pendulum lab", sharerName: "Naledi" };
const MANIFEST = { id: "p-fresh-1", title: "Pendulum lab", updatedAt: 1700000000000 };
const ATTRIBUTION = { shareId: "s-1", sharerId: "u-other", sharerName: "Naledi" };

let order;
let pushProjectSpy;

beforeEach(() => {
  order = [];
  localStorage.clear();

  api.mockImplementation(async (path) => {
    order.push(`api:${path}`);
    return { manifest: MANIFEST, attribution: ATTRIBUTION };
  });
  saveProject.mockImplementation(async (manifest) => {
    order.push("saveProject");
    return manifest;
  });
  setShareAttribution.mockImplementation(async () => {
    order.push("setShareAttribution");
  });
  pushProjectSpy = vi.fn(async () => {
    order.push("pushProject");
  });
  getGlobalSyncEngine.mockResolvedValue({
    pushProject: pushProjectSpy,
    getStatus: () => ({ state: "synced", pendingCount: 0, lastError: null }),
  });
  assertPushSucceeded.mockImplementation(() => {
    order.push("assertPushSucceeded");
  });
  requestProjectOpen.mockImplementation(() => {
    order.push("requestProjectOpen");
  });
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("acceptShare — D§4's order", () => {
  test("follows the exact order: accept -> save (verbatim) -> attribute -> push -> assert -> open", async () => {
    const id = await acceptShare(SHARE, ME);

    expect(id).toBe("p-fresh-1");
    expect(order).toEqual([
      "api:/api/shares/s-1/accept",
      "saveProject",
      "setShareAttribution",
      "pushProject",
      "assertPushSucceeded",
      "requestProjectOpen",
    ]);
  });

  test("posts the accept body { projectId: 'p-fresh-1' }", async () => {
    await acceptShare(SHARE, ME);
    expect(api).toHaveBeenCalledWith("/api/shares/s-1/accept", {
      method: "POST",
      body: { projectId: "p-fresh-1" },
    });
  });

  test("saveProject receives the server manifest VERBATIM (never re-stamped) with preserveTimestamp", async () => {
    await acceptShare(SHARE, ME);
    expect(saveProject).toHaveBeenCalledWith(MANIFEST, { preserveTimestamp: true });
  });

  test("the sidecar is stamped against the fresh project id with the server's attribution, before the push", async () => {
    await acceptShare(SHARE, ME);
    expect(setShareAttribution).toHaveBeenCalledWith("p-fresh-1", ATTRIBUTION);
  });

  test("pushes under the caller's own account id", async () => {
    await acceptShare(SHARE, ME);
    expect(pushProjectSpy).toHaveBeenCalledWith("p-fresh-1", "u-me");
  });

  test("stamps LAST_PROJECT_KEY so a reload of \"/\" finds the new copy", async () => {
    await acceptShare(SHARE, ME);
    expect(localStorage.getItem(LAST_PROJECT_KEY)).toBe("p-fresh-1");
  });

  test("a refusal at accept propagates and NOTHING downstream runs", async () => {
    api.mockImplementation(async (path) => {
      order.push(`api:${path}`);
      throw new Error(
        "You're at the 100-project limit — the copy needs a free slot. Delete something first, then add it.",
      );
    });

    await expect(acceptShare(SHARE, ME)).rejects.toThrow(
      "You're at the 100-project limit — the copy needs a free slot. Delete something first, then add it.",
    );
    expect(order).toEqual(["api:/api/shares/s-1/accept"]);
    expect(saveProject).not.toHaveBeenCalled();
    expect(setShareAttribution).not.toHaveBeenCalled();
    expect(getGlobalSyncEngine).not.toHaveBeenCalled();
    expect(assertPushSucceeded).not.toHaveBeenCalled();
    expect(requestProjectOpen).not.toHaveBeenCalled();
    expect(localStorage.getItem(LAST_PROJECT_KEY)).toBeNull();
  });
});
