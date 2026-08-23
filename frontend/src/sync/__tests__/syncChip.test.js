import { describe, test, expect, vi, afterEach } from "vitest";
import React, { act } from "react";
import SyncChip from "../SyncChip";
import { mountComponent } from "../../test/renderHelpers";
import { useMe } from "../../auth/useAuth";
import { getGlobalSyncEngine } from "../../utils/sync/syncEngine";

/* SyncChip calls useMe() and getGlobalSyncEngine() directly — stub both,
   following the HeaderAccount.test.js pattern for satisfying useMe(). */
vi.mock("../../auth/useAuth", () => ({
  useMe: vi.fn(),
}));
vi.mock("../../utils/sync/syncEngine", () => ({
  getGlobalSyncEngine: vi.fn(),
}));

function engineWith(state, lastError = null) {
  return {
    getStatus: () => ({ state, lastError }),
    subscribe: () => () => {},
  };
}

/* Flushes the microtask queue via a real macrotask boundary, so the
   effect's `await getGlobalSyncEngine()` and its follow-on setState land
   before we inspect the DOM. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

describe("SyncChip — five states, each a distinct class and its documented word (spec §6.3)", () => {
  test.each([
    ["idle", "Synced"],
    ["synced", "Synced"],
    ["syncing", "Syncing…"],
    ["offline", "Waiting for connection"],
    ["error", "Sync error"],
  ])("%s renders sync-chip--%s with the verbatim string and a glyph", async (state, label) => {
    useMe.mockReturnValue({ data: { id: "1", name: "Ada" } });
    getGlobalSyncEngine.mockResolvedValue(engineWith(state));

    mounted = mountComponent(<SyncChip />);
    await flush();

    const chip = mounted.container.querySelector(`.sync-chip--${state}`);
    expect(chip).not.toBeNull();
    expect(chip.textContent).toContain(label);
    // A second channel besides colour: every state carries a glyph.
    expect(chip.querySelector("svg")).not.toBeNull();
  });

  test("idle is its own rule, not a fallthrough with no class at all", () => {
    useMe.mockReturnValue({ data: { id: "1", name: "Ada" } });
    getGlobalSyncEngine.mockReturnValue(new Promise(() => {})); // never resolves
    mounted = mountComponent(<SyncChip />);
    const chip = mounted.container.querySelector(".sync-chip");
    expect(chip.className).toBe("sync-chip sync-chip--idle");
  });

  test("signed out: renders nothing", () => {
    useMe.mockReturnValue({ data: null });
    mounted = mountComponent(<SyncChip />);
    expect(mounted.container.querySelector(".sync-chip")).toBeNull();
  });
});
