/**
 * orphans — which top-level blocks are part of the program, and which are not.
 *
 * docs/product-contract.md:36 specifies ONE behaviour for both goals: top-level
 * blocks outside the anchor hat are "greyed and ignored, so 'in use vs unused'
 * is visible". Until Tranche 3 the code did two different things — data
 * analyses greyed orphans, while physics FORCE-ADOPTED every stray top-level
 * block into sim_start's SETUP slot on the next change event, so a student who
 * parked a block aside to think watched it snap into their program and
 * silently change the generated Python.
 *
 * Pure on purpose: `planOrphanState` takes plain {id, type, descendants[]}
 * shapes so it is testable without a live workspace, and `applyOrphanState`
 * is the two-line imperative half.
 */

/** Hat blocks that root a program. A canvas with none is left fully enabled. */
export const ANCHOR_TYPES = Object.freeze(["sim_start_block", "sim_end_block", "ds_start_block"]);

/**
 * @param {Array<{id:string,type:string,descendants:Array<{id:string,shadow:boolean}>}>} topBlocks
 * @param {ReadonlyArray<string>} anchorTypes
 * @returns {{enable: Set<string>, disable: Set<string>}}
 */
export function planOrphanState(topBlocks, anchorTypes = ANCHOR_TYPES) {
  const anchors = new Set(anchorTypes);
  const enable = new Set();
  const disable = new Set();

  const hasAnchor = topBlocks.some((b) => anchors.has(b.type));

  for (const top of topBlocks) {
    // No hat anywhere → a legacy or half-built canvas. Leave everything alone
    // rather than greying out a project the student has not anchored yet.
    const target = !hasAnchor || anchors.has(top.type) ? enable : disable;
    for (const b of top.descendants || []) {
      if (b.shadow) continue;
      target.add(b.id);
    }
  }
  return { enable, disable };
}

/** Apply a plan to a live Blockly workspace. Guards on isEnabled so it can run
 *  inside the change listener without an event storm. Returns true if it changed
 *  anything. */
export function applyOrphanState(workspace, plan) {
  let changed = false;
  for (const [ids, want] of [
    [plan.enable, true],
    [plan.disable, false],
  ]) {
    for (const id of ids) {
      const b = workspace.getBlockById(id);
      if (!b || b.isEnabled() === want) continue;
      b.setEnabled(want);
      changed = true;
    }
  }
  return changed;
}

/** Read a live workspace into the plain shape planOrphanState wants. */
export function readTopBlocks(workspace) {
  return workspace.getTopBlocks(false).map((top) => ({
    id: top.id,
    type: top.type,
    descendants: top.getDescendants(false).map((b) => ({ id: b.id, shadow: b.isShadow() })),
  }));
}
