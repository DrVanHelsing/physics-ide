/**
 * The unknown-block safeguard (Plan 10 Task 4). Retirement is DELETION in
 * this product — no deprecation machinery — so a workspace saved while a
 * since-deleted block type existed (dev-local projects, mostly) must load
 * gracefully rather than crash the whole IDE: Blockly's domToWorkspace
 * throws on the first unknown type and the student loses the entire
 * workspace view for one dead block.
 *
 * Strips every <block>/<shadow> node whose type is not registered, whole —
 * including anything chained under its <next> (a crash-safeguard, not a
 * splice: reconnecting an orphaned chain across a missing block would
 * invent program structure the author never made). Returns the de-duplicated
 * list of dropped types so callers can say what was skipped.
 */
export function sanitizeWorkspaceDom(Blockly, dom) {
  const dropped = [];
  // Snapshot first: removals mutate the live list under querySelectorAll?
  // No — querySelectorAll returns a static list — but a node already removed
  // via an ancestor must not be double-counted, hence the isConnected check.
  const nodes = [...dom.querySelectorAll("block, shadow")];
  for (const node of nodes) {
    if (!node.isConnected) continue; // gone with an already-removed ancestor
    const type = node.getAttribute("type");
    if (type && !Blockly.Blocks[type]) {
      dropped.push(type);
      node.remove();
    }
  }
  return { dom, dropped: [...new Set(dropped)] };
}
