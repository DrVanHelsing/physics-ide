/**
 * vectorChainTypeChecks.test.js — Regression proof for Plan 4 / Task 9.
 *
 * Task 9 adds Blockly connection `check:` / `output:` typing to the vector
 * chain (vector_block, mag_block, norm_block, cross/dot product, the
 * object POS/AXIS/SIZE/VEL/ACCEL slots, …). Those fields are read only by
 * Blockly's *connection* logic (drag-and-drop snapping) — the Python
 * generator functions registered per block type are untouched, so the
 * code emitted for any workspace that was legally connectable before the
 * change must still be byte-identical after it.
 *
 * There is no unit-testable hook for "does dragging a block make a sound"
 * (that's Step 3's manual browser pass), but the thing that pass exists to
 * protect — a stored template silently dropping a connection because a new
 * check rejects it — is fully mechanical: load each template's XML into a
 * headless workspace, generate Python, and compare.
 *
 * This suite asserts two things per template:
 *   1. Structural connectivity — every block loaded from the template's XML
 *      is still attached to the tree (nothing got silently orphaned by a
 *      rejected connection), and the top-level shape is exactly the
 *      sim_start_block chain the template author authored.
 *   2. Byte-identical generated Python — a SHA-256 hash of the generated
 *      code is compared against a hash captured from the SAME templates run
 *      through this SAME suite on the pre-Task-9 code (verified by hand via
 *      `git stash` / `git stash pop`, recorded in the task report). Any
 *      future change to blocklyGenerator.js that alters what these four
 *      templates emit will fail this test, which is the point.
 *
 * PLAN DEFECT CAUGHT BY THIS SUITE, AND ITS FIX:
 * The first version of Task 9's typing broke `blocks_orbits` ("Sun, Earth &
 * Moon") for real: `norm_block` / `vector_block` correctly gained
 * `output:"Vector"`, but the template computes gravity via VPython's
 * scalar×vector and vector±vector operator overloading routed through
 * Blockly's *built-in* `math_arithmetic` block, whose A/B inputs are
 * hardcoded `check:"Number"` in Blockly core. That mismatch silently
 * dropped 8 blocks off the tree — `domToWorkspace()` does not throw, it
 * just leaves the child unconnected — and `valueToCode()` fell back to a
 * default of `0` for every vanished input: every gravitational
 * acceleration term (`a_earth`, `a_moon`) and the moon's velocity offset
 * were silently multiplied/added by zero, i.e. zero gravity, with no
 * error anywhere. Caught here (block count went 1 -> 9 top-level blocks
 * for `blocks_orbits`), not in production. Controller-ruled fix: widen
 * the built-in `math_arithmetic` block's A/B checks and output to
 * `["Number","Vector"]` in `blocklyGenerator.js` (immediately after the
 * custom block definitions land) rather than reverting the new producer
 * typings or touching the template XML — see the comment above
 * `Blockly.Blocks["math_arithmetic"].init` there for the full rationale.
 * The EXPECTED_HASHES below were captured *after* that widening landed,
 * and matched the pre-Task-9 baseline byte-for-byte on first try.
 */
import { createHash } from "crypto";
import { describe, test, expect, beforeAll } from "vitest";
import Blockly from "../blocklyLib";
import { defineCustomBlocksAndGenerator, generatePythonFromWorkspace } from "../blocklyGenerator";
import { BLOCK_TEMPLATES } from "../../blockTemplates";

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// Captured by running this suite's hashing logic against the pre-Task-9
// blocklyGenerator.js (`git stash` the typing edit, run, record, `git stash
// pop`, run again) and confirming an EXACT match against the post-Task-9
// (post-widening) hashes below — see task-9-report.md for the transcript.
//
// Re-captured after commit 7b41d04 (scene.background strip from three templates):
// projectile, spring, and orbits templates no longer emit scene.background assignments,
// so their hashes changed legitimately during cross-lane merge reconciliation.
const EXPECTED_HASHES = {
  blocks_projectile: "0b8e144f42eddd6519c411ecc9403ef96b39e10744f41051ba55ee4274824093",
  blocks_spring:      "8c322f2de61ceb68d9174c7ef85d66521af541441dfea9fa685c9ec7e818743b",
  blocks_orbits:      "456590d618a349e051b9ce3e6b6c653343492057f00c0ad8dc3386fb5ece16b3",
  blocks_pendulum:    "c81e6a7e38688631c6ade1d1049d77826a9751ad21d7815e35defea6578447f1",
};

describe("vector chain type checks — template regression proof", () => {
  beforeAll(() => {
    defineCustomBlocksAndGenerator(Blockly);
  });

  test.each(BLOCK_TEMPLATES)(
    "$id loads with no disconnected blocks and emits the recorded Python",
    ({ id, xml }) => {
      const ws = new Blockly.Workspace();
      try {
        const dom = Blockly.utils.xml.textToDom(xml);
        const topBlockIds = Blockly.Xml.domToWorkspace(dom, ws);

        // Every block the template describes must have made it into the
        // workspace — a rejected value connection does not throw, it just
        // leaves the child block off the tree (domToWorkspace swallows it),
        // so the authoritative check is a block count, not "no exception".
        const expectedBlockCount = countTemplateBlocks(xml);
        const actualBlockCount = ws.getAllBlocks(false).length;
        expect(actualBlockCount, `${id}: block count`).toBe(expectedBlockCount);

        // The template is a single sim_start_block chain (sim_end_block
        // hangs off its <next>), so exactly one top-level block is expected.
        expect(topBlockIds.length, `${id}: top-level block count`).toBe(1);
        expect(ws.getTopBlocks(false).length, `${id}: top-level block count`).toBe(1);

        const code = generatePythonFromWorkspace(ws);
        expect(code, `${id}: generation must not error`).not.toMatch(/error/i);
        expect(code.length, `${id}: generated non-trivial code`).toBeGreaterThan(100);

        const hash = sha256(code);
        expect(hash, `${id}: generated Python changed — see EXPECTED_HASHES`).toBe(
          EXPECTED_HASHES[id]
        );
      } finally {
        ws.dispose();
      }
    }
  );

  // Dedicated, named guard for the exact regression this task salvage caught:
  // `blocks_orbits` computes gravity via scalar×vector / vector±vector
  // arithmetic routed through Blockly's built-in `math_arithmetic` block. The
  // first cut of Task 9's typing gave `norm_block`/`vector_block` a real
  // `output:"Vector"`, and that built-in block's Number-only A/B checks
  // silently orphaned 8 blocks (top-level count 1 -> 9), zeroing every
  // gravitational acceleration term with no error anywhere. The fix widened
  // `math_arithmetic`'s checks to ["Number","Vector"] in blocklyGenerator.js.
  // This assertion is split out from the loop above — rather than folded
  // into its generic per-template checks — so a future reader sees this
  // specific incident pinned by name, not just one row of a parameterized
  // table.
  test("blocks_orbits does not regress to a disconnected tree (Task 9 salvage regression)", () => {
    const tpl = BLOCK_TEMPLATES.find((t) => t.id === "blocks_orbits");
    const ws = new Blockly.Workspace();
    try {
      const dom = Blockly.utils.xml.textToDom(tpl.xml);
      Blockly.Xml.domToWorkspace(dom, ws);
      expect(ws.getTopBlocks(false).length, "blocks_orbits: top-level block count").toBe(1);
    } finally {
      ws.dispose();
    }
  });
});

/** Count <block> tags in the raw template XML — an independent tally of
 *  how many blocks the author's descriptor tree should produce, so the
 *  post-load workspace block count can be checked against it directly
 *  (rather than against a second Blockly-derived count). */
function countTemplateBlocks(xmlText) {
  const matches = xmlText.match(/<block\b/g);
  return matches ? matches.length : 0;
}
