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
 *
 * Fix round 1: the lock is `held !== true`, not `held === false`. An UNKNOWN
 * baton (the first poll still in flight, or a poll that has never succeeded
 * — offline, or 403 after being removed from the group) used to leave group
 * work fully editable with no push path: no save listener is registered
 * unless the baton is confirmed held, so every edit stayed local, and
 * pullGroupProject's newer-local guard then meant the group head could never
 * arrive again. Silent permanent divergence. Not-confirmed-yours locks.
 */
describe("groupReadOnly — read-only until the baton is CONFIRMED yours", () => {
  test("nothing reported yet: no group is known, so nothing is locked", () => {
    expect(groupReadOnly(null)).toBe(false);
    expect(groupReadOnly(undefined)).toBe(false);
  });

  test("no group context: never read-only, whatever the baton says", () => {
    expect(groupReadOnly({ groupId: null, held: null })).toBe(false);
    expect(groupReadOnly({ groupId: null, held: false })).toBe(false);
    expect(groupReadOnly({ groupId: null, held: true })).toBe(false);
  });

  test("a group, but the baton has NOT been read yet: read-only — an unread baton is not a held one", () => {
    expect(groupReadOnly({ groupId: "g-1", held: null })).toBe(true);
    expect(groupReadOnly({ groupId: "g-1" })).toBe(true);
  });

  test("a group and the baton is yours: editable", () => {
    expect(groupReadOnly({ groupId: "g-1", held: true })).toBe(false);
  });

  test("a group and the baton is NOT yours: read-only", () => {
    expect(groupReadOnly({ groupId: "g-1", held: false })).toBe(true);
  });
});
