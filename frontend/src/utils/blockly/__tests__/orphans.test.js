import { describe, test, expect } from "vitest";
import { planOrphanState, ANCHOR_TYPES } from "../orphans";

/** Minimal stand-in for a Blockly top block: id, type, and its descendants. */
function block(id, type, kids = []) {
  const self = { id, type, shadow: false };
  self.descendants = [self, ...kids];
  return self;
}
const shadow = (id) => ({ id, type: "math_number", shadow: true, descendants: [] });

describe("planOrphanState", () => {
  test("no anchor on the canvas: nothing is disabled", () => {
    const tops = [block("a", "sphere_block"), block("b", "box_block")];
    expect(planOrphanState(tops, ANCHOR_TYPES)).toEqual({
      enable: new Set(["a", "b"]),
      disable: new Set(),
    });
  });

  test("with an anchor, anything not rooted in it is disabled", () => {
    const anchored = block("s", "sim_start_block", [block("s1", "sphere_block")]);
    const stray = block("x", "box_block", [block("x1", "vector_block")]);
    const plan = planOrphanState([anchored, stray], ANCHOR_TYPES);
    expect(plan.enable).toEqual(new Set(["s", "s1"]));
    expect(plan.disable).toEqual(new Set(["x", "x1"]));
  });

  test("sim_end is an anchor too — it must not grey itself out", () => {
    const plan = planOrphanState(
      [block("s", "sim_start_block"), block("e", "sim_end_block")],
      ANCHOR_TYPES,
    );
    expect(plan.disable.size).toBe(0);
  });

  test("a ds_start hat anchors a data analysis the same way", () => {
    const plan = planOrphanState(
      [block("d", "ds_start_block", [block("d1", "ds_calc_mean_block")]), block("y", "ds_chart_bar_block")],
      ANCHOR_TYPES,
    );
    expect(plan.enable).toEqual(new Set(["d", "d1"]));
    expect(plan.disable).toEqual(new Set(["y"]));
  });

  test("a hybrid canvas with both hats keeps both programs alive", () => {
    const plan = planOrphanState(
      [
        block("s", "sim_start_block", [block("s1", "sphere_block")]),
        block("d", "ds_start_block", [block("d1", "ds_show_table_block")]),
        block("z", "label_block"),
      ],
      ANCHOR_TYPES,
    );
    expect(plan.enable).toEqual(new Set(["s", "s1", "d", "d1"]));
    expect(plan.disable).toEqual(new Set(["z"]));
  });

  test("shadow blocks are never touched", () => {
    const stray = block("x", "box_block", [shadow("sh1")]);
    const plan = planOrphanState([block("s", "sim_start_block"), stray], ANCHOR_TYPES);
    expect(plan.disable.has("sh1")).toBe(false);
    expect(plan.disable).toEqual(new Set(["x"]));
  });

  test("is idempotent — planning twice gives the same plan", () => {
    const tops = [block("s", "sim_start_block", [block("s1", "sphere_block")]), block("x", "box_block")];
    expect(planOrphanState(tops, ANCHOR_TYPES)).toEqual(planOrphanState(tops, ANCHOR_TYPES));
  });
});
