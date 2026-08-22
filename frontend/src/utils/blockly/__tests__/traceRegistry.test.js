/**
 * Task 14 — breakableIds() is the ground truth for "can a breakpoint here
 * ever fire". Only entries the generator actually pushed into traceRegistry
 * (one per tr() call — seven block types) can pause the runtime, so this
 * must reflect exactly and only the blockIds that show up there.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { traceRegistry, clearTraceRegistry, breakableIds } from "../traceRegistry";

beforeEach(() => {
  clearTraceRegistry();
});

describe("breakableIds", () => {
  test("empty registry yields an empty set", () => {
    expect(breakableIds()).toEqual(new Set());
  });

  test("collects the blockId of every entry that has one", () => {
    traceRegistry.push(
      { safeName: "x", displayName: "x", blockId: "block-1" },
      { safeName: "y", displayName: "y", blockId: "block-2" },
    );
    expect(breakableIds()).toEqual(new Set(["block-1", "block-2"]));
  });

  test("de-duplicates repeated blockIds (a block can emit more than one trace entry)", () => {
    traceRegistry.push(
      { safeName: "vx", displayName: "vx", blockId: "block-1" },
      { safeName: "vy", displayName: "vy", blockId: "block-1" },
    );
    expect(breakableIds()).toEqual(new Set(["block-1"]));
  });

  test("entries with no blockId (falsy) are skipped, not added as 'undefined'", () => {
    traceRegistry.push(
      { safeName: "a", displayName: "a", blockId: "" },
      { safeName: "b", displayName: "b", blockId: undefined },
      { safeName: "c", displayName: "c", blockId: "block-3" },
    );
    expect(breakableIds()).toEqual(new Set(["block-3"]));
  });

  test("reflects clearTraceRegistry() — a fresh generation pass starts from nothing", () => {
    traceRegistry.push({ safeName: "a", displayName: "a", blockId: "block-1" });
    expect(breakableIds().size).toBe(1);
    clearTraceRegistry();
    expect(breakableIds()).toEqual(new Set());
  });

  test("returns a fresh Set each call — mutating the result cannot corrupt the registry", () => {
    traceRegistry.push({ safeName: "a", displayName: "a", blockId: "block-1" });
    const first = breakableIds();
    first.add("block-injected");
    expect(breakableIds()).toEqual(new Set(["block-1"]));
  });
});
