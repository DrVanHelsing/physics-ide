import { describe, test, expect, vi, afterEach } from "vitest";
import { setPendingTemplate, consumePendingTemplate } from "../pendingTemplate";

const KEY = "pide_pending_template";

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("pendingTemplate — the welcome tile to IDE handoff", () => {
  test("round trip: set then consume returns the id and removes it", () => {
    setPendingTemplate("blocks_projectile");
    expect(sessionStorage.getItem(KEY)).toBe("blocks_projectile");
    expect(consumePendingTemplate()).toBe("blocks_projectile");
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  test("consuming with nothing pending returns null", () => {
    expect(consumePendingTemplate()).toBeNull();
  });

  test("consuming is destructive — a second read after the first returns null", () => {
    // This is the guard against re-creating the project on a page reload.
    setPendingTemplate("blocks_pendulum");
    expect(consumePendingTemplate()).toBe("blocks_pendulum");
    expect(consumePendingTemplate()).toBeNull();
  });

  test("blocked storage: setPendingTemplate does not throw", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => setPendingTemplate("blocks_projectile")).not.toThrow();
    spy.mockRestore();
  });

  test("blocked storage: consumePendingTemplate returns null instead of throwing", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => consumePendingTemplate()).not.toThrow();
    expect(consumePendingTemplate()).toBeNull();
    spy.mockRestore();
  });
});
