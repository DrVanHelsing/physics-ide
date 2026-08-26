import { describe, test, expect, vi, afterEach } from "vitest";
import React from "react";
import { WorkspaceRulesEnforcer } from "../IDELayout";
import { mountComponent } from "../../../test/renderHelpers";
import { useAssignmentContext } from "../../../contexts/AssignmentContext";

/**
 * WorkspaceRulesEnforcer.js's doc comment explains why this lives as a
 * mounted child rather than a hook call inside IDELayout's own body — it
 * reads useAssignmentContext() directly, so stub it the same way
 * RulesChip.test.js does for the same shape of hook.
 *
 * Review fix (Ruling R3, "content visibility beats mode enforcement"): the
 * editors-lock effect must not force "blocks" mode onto a project whose
 * blocks canvas has no representation of the student's work — a code_blank
 * project's blocks↔python sync is one-way (blocks generate python; typed
 * python is never parsed back into blocks), so forcing it would swap the
 * student's code for an empty canvas with no way back. IDELayout already
 * expresses "this project has no blocks representation" as
 * `lockedMode === "blocks"` (the same value that disables ModeToggle's
 * Blocks button for a code_blank project) — these tests drive that signal
 * directly rather than reconstructing IDELayout's projectType→lockedMode
 * derivation.
 */
vi.mock("../../../contexts/AssignmentContext", () => ({ useAssignmentContext: vi.fn() }));

const OPEN_EXCEPT_EDITORS = {
  debug: true, importFiles: true, exportAndCopy: true, advancedBlocks: true, templates: true,
};

let mounted = null;
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.clearAllMocks();
});

function render({ mode, lockedMode = null, onModeChange = vi.fn(), onRules = vi.fn() } = {}) {
  mounted = mountComponent(
    <WorkspaceRulesEnforcer mode={mode} onModeChange={onModeChange} onRules={onRules} lockedMode={lockedMode} />,
  );
  return { onModeChange, onRules };
}

describe("WorkspaceRulesEnforcer — the editors-lock effect (Task 12; review Ruling R3)", () => {
  test("rules: null never forces mode", () => {
    useAssignmentContext.mockReturnValue(null);
    const { onModeChange } = render({ mode: "text" });
    expect(onModeChange).not.toHaveBeenCalled();
  });

  test('editors:"both" never forces mode', () => {
    useAssignmentContext.mockReturnValue({ rules: { ...OPEN_EXCEPT_EDITORS, editors: "both" } });
    const { onModeChange } = render({ mode: "text" });
    expect(onModeChange).not.toHaveBeenCalled();
  });

  test('a normal project (lockedMode: null) under editors:"blocks" is forced into blocks — existing behavior', () => {
    useAssignmentContext.mockReturnValue({ rules: { ...OPEN_EXCEPT_EDITORS, editors: "blocks" } });
    const { onModeChange } = render({ mode: "text", lockedMode: null });
    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith("blocks");
  });

  test('a code_blank project (lockedMode: "blocks") under editors:"blocks" is NOT forced — its blocks canvas has no representation of the student\'s code', () => {
    useAssignmentContext.mockReturnValue({ rules: { ...OPEN_EXCEPT_EDITORS, editors: "blocks" } });
    const { onModeChange } = render({ mode: "text", lockedMode: "blocks" });
    expect(onModeChange).not.toHaveBeenCalled();
  });

  test('the symmetric case needs no guard: editors:"code" still forces text mode even on a lockedMode:"blocks" project, because blocks-based projects always regenerate python', () => {
    useAssignmentContext.mockReturnValue({ rules: { ...OPEN_EXCEPT_EDITORS, editors: "code" } });
    const { onModeChange } = render({ mode: "blocks", lockedMode: "blocks" });
    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith("text");
  });

  test("already in the required mode is a no-op", () => {
    useAssignmentContext.mockReturnValue({ rules: { ...OPEN_EXCEPT_EDITORS, editors: "blocks" } });
    const { onModeChange } = render({ mode: "blocks", lockedMode: null });
    expect(onModeChange).not.toHaveBeenCalled();
  });

  test("mirrors the resolved rules up via onRules, so IDELayout can thread advancedBlocks into the toolbox", () => {
    const rules = { ...OPEN_EXCEPT_EDITORS, editors: "both" };
    useAssignmentContext.mockReturnValue({ rules });
    const { onRules } = render({ mode: "blocks" });
    expect(onRules).toHaveBeenCalledWith(rules);
  });
});
