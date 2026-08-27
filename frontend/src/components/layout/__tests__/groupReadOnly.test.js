import { describe, test, expect } from "vitest";
import { groupReadOnly } from "../IDELayout";

/**
 * Task 22 — the one bit of group state IDELayout's own body acts on.
 *
 * IDELayout cannot call useAssignmentContext() itself (AssignmentProvider is
 * a CHILD of its return value — see WorkspaceRulesEnforcer's doc comment for
 * the same constraint), so BatonChip reports `{ groupId, held }` upward and
 * this pure function turns that into the existing `isReadOnlyView` flag.
 * Tested here rather than through a mounted IDELayout for the same reason
 * WorkspaceRulesEnforcer is: the shell needs Blockly and Monaco, and the
 * decision is what matters.
 */
describe("groupReadOnly — !batonHeld, but only once the baton is actually known", () => {
  test("nothing reported yet: not read-only — the editor must not flash locked on every open", () => {
    expect(groupReadOnly(null)).toBe(false);
    expect(groupReadOnly(undefined)).toBe(false);
  });

  test("no group context: never read-only, whatever the baton says", () => {
    expect(groupReadOnly({ groupId: null, held: null })).toBe(false);
    expect(groupReadOnly({ groupId: null, held: false })).toBe(false);
  });

  test("a group, but the baton has not been read yet: still not read-only", () => {
    expect(groupReadOnly({ groupId: "g-1", held: null })).toBe(false);
  });

  test("a group and the baton is yours: editable", () => {
    expect(groupReadOnly({ groupId: "g-1", held: true })).toBe(false);
  });

  test("a group and the baton is NOT yours: read-only", () => {
    expect(groupReadOnly({ groupId: "g-1", held: false })).toBe(true);
  });
});
