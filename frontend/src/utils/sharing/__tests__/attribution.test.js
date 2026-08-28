import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { attributionSentence, refreshShareAttributions } from "../attribution";
import { api } from "../../api/client";
import { listShareAttribution, setShareAttribution } from "../../storage/shareMeta";

/**
 * attributionSentence is THE label builder (§8.1's exact words) — asserted
 * verbatim, one place. refreshShareAttributions is the online refresh AND
 * the second-device sidecar backfill (design D§7): every server entry is
 * written into the sidecar, then the merged local list is returned —
 * offline or signed out, the catch swallows and the cache stands.
 */
vi.mock("../../api/client", () => ({ api: vi.fn() }));
vi.mock("../../storage/shareMeta", () => ({
  listShareAttribution: vi.fn(),
  setShareAttribution: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("attributionSentence", () => {
  test("is exactly 'Based on work shared by <name>'", () => {
    expect(attributionSentence("Thabo M.")).toBe("Based on work shared by Thabo M.");
  });
});

describe("refreshShareAttributions", () => {
  test("writes every server entry into the sidecar and returns the merged local list", async () => {
    const ATTRS = {
      "p-1": { shareId: "s-1", sharerId: "u-1", sharerName: "Thabo M." },
      "p-2": { shareId: "s-2", sharerId: "u-2", sharerName: "Naledi" },
    };
    api.mockResolvedValue({ attributions: ATTRS });
    const MERGED = { ...ATTRS };
    listShareAttribution.mockResolvedValue(MERGED);

    const result = await refreshShareAttributions();

    expect(api).toHaveBeenCalledWith("/api/shares/attributions");
    expect(setShareAttribution).toHaveBeenCalledTimes(2);
    expect(setShareAttribution).toHaveBeenCalledWith("p-1", ATTRS["p-1"]);
    expect(setShareAttribution).toHaveBeenCalledWith("p-2", ATTRS["p-2"]);
    expect(result).toBe(MERGED);
  });

  test("api rejecting (offline or signed out) is swallowed — the cache stands, unchanged", async () => {
    api.mockRejectedValue(new Error("offline"));
    const LOCAL = { "p-1": { shareId: "s-1", sharerId: "u-1", sharerName: "Thabo M." } };
    listShareAttribution.mockResolvedValue(LOCAL);

    const result = await refreshShareAttributions();

    expect(setShareAttribution).not.toHaveBeenCalled();
    expect(result).toBe(LOCAL);
  });

  test("a guest's 401 is just another rejection — swallowed the same way", async () => {
    const err = new Error("Sign in required");
    err.status = 401;
    api.mockRejectedValue(err);
    listShareAttribution.mockResolvedValue({});

    const result = await refreshShareAttributions();

    expect(setShareAttribution).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });
});
