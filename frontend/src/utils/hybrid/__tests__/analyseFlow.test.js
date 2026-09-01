/**
 * The analyse swap/return ORDER as a tested contract (review round 1 of the
 * data-loss hotfix): the original bug was a workspace replacement that ran
 * unconditionally — these tests pin that nothing replaces the workspace
 * before the stash succeeds, cancel aborts everything, and a failed op
 * surfaces through onError instead of half-running.
 */
import { describe, test, expect, vi } from "vitest";
import { performAnalyseSwap, performAnalyseReturn } from "../analyseFlow";

function swapDeps(overrides = {}) {
  const calls = [];
  const deps = {
    analyseStash: vi.fn(async () => {
      calls.push("stash");
      return { id: "m1" };
    }),
    exitDebug: vi.fn(() => calls.push("exitDebug")),
    loadWorkspaceXml: vi.fn(() => calls.push("load")),
    bumpReloadKey: vi.fn(() => calls.push("bump")),
    closeChart: vi.fn(() => calls.push("close")),
    onError: vi.fn((e) => calls.push(`error:${e.message}`)),
    ...overrides,
  };
  return { deps, calls };
}

describe("performAnalyseSwap — stash strictly before replacement", () => {
  test("the happy path runs stash → load → bump → close, in that order", async () => {
    const { deps, calls } = swapDeps();
    const ok = await performAnalyseSwap(deps, "<xml/>");
    expect(ok).toBe(true);
    expect(calls).toEqual(["stash", "exitDebug", "load", "bump", "close"]);
    expect(deps.loadWorkspaceXml).toHaveBeenCalledWith("<xml/>");
  });

  test("a cancelled stash replaces NOTHING — the original data-loss regression guard", async () => {
    const { deps } = swapDeps({ analyseStash: vi.fn(async () => null) });
    const ok = await performAnalyseSwap(deps, "<xml/>");
    expect(ok).toBe(false);
    expect(deps.loadWorkspaceXml).not.toHaveBeenCalled();
    expect(deps.bumpReloadKey).not.toHaveBeenCalled();
    expect(deps.closeChart).not.toHaveBeenCalled();
    expect(deps.onError).not.toHaveBeenCalled();
  });

  test("a THROWING stash replaces nothing and surfaces through onError", async () => {
    const boom = new Error("quota");
    const { deps } = swapDeps({ analyseStash: vi.fn(async () => { throw boom; }) });
    const ok = await performAnalyseSwap(deps, "<xml/>");
    expect(ok).toBe(false);
    expect(deps.onError).toHaveBeenCalledWith(boom);
    expect(deps.loadWorkspaceXml).not.toHaveBeenCalled();
  });

  test("exitDebug is optional — absent means skipped, not crashed", async () => {
    const { deps } = swapDeps({ exitDebug: undefined });
    expect(await performAnalyseSwap(deps, "<xml/>")).toBe(true);
    expect(deps.loadWorkspaceXml).toHaveBeenCalled();
  });
});

function returnDeps(overrides = {}) {
  const deps = {
    analyseRestore: vi.fn(async () => ({ id: "m1" })),
    exitDebug: vi.fn(),
    stopRun: vi.fn(),
    bumpReloadKey: vi.fn(),
    closeChart: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
  return deps;
}

describe("performAnalyseReturn — restore strictly before teardown", () => {
  test("the happy path stops the run and remounts only after restore succeeds", async () => {
    const deps = returnDeps();
    expect(await performAnalyseReturn(deps)).toBe(true);
    expect(deps.stopRun).toHaveBeenCalled();
    expect(deps.bumpReloadKey).toHaveBeenCalled();
    expect(deps.closeChart).toHaveBeenCalled();
  });

  test("a cancelled (or stash-less) restore touches nothing", async () => {
    const deps = returnDeps({ analyseRestore: vi.fn(async () => null) });
    expect(await performAnalyseReturn(deps)).toBe(false);
    expect(deps.stopRun).not.toHaveBeenCalled();
    expect(deps.bumpReloadKey).not.toHaveBeenCalled();
    expect(deps.onError).not.toHaveBeenCalled();
  });

  test("a THROWING restore surfaces through onError and tears nothing down", async () => {
    const boom = new Error("save failed");
    const deps = returnDeps({ analyseRestore: vi.fn(async () => { throw boom; }) });
    expect(await performAnalyseReturn(deps)).toBe(false);
    expect(deps.onError).toHaveBeenCalledWith(boom);
    expect(deps.stopRun).not.toHaveBeenCalled();
  });
});
