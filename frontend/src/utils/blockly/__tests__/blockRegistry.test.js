/**
 * Tests for the canonical block registry (Phase B.6).
 *
 * Mirrors the CI check in scripts/check-block-registry.mjs so the same
 * guarantees hold inside the React test suite, and so future PRs that add
 * blocks to the toolbox without registry entries are caught locally.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  getAllBlockEntries,
  getBlockEntry,
  getBlocksByCategory,
  getBlocksByDomain,
  getBlocksForGoal,
  findDuplicateIds,
  findUnknownIds,
  BLOCK_CATALOGUE,
} from "../blockRegistry";
import { buildToolboxXml } from "../toolbox";
import { BLOCK_PALETTE, categoryStyleNameFor } from "../blockPalette";

const STOCK_PREFIXES = ["controls_", "variables_", "procedures_", "lists_", "text_"];
const STOCK_ONLY_IDS = new Set([
  "text",
  "logic_null", "logic_ternary",
  "math_number_property", "math_round", "math_on_list",
  "math_modulo", "math_random_int", "math_random_float",
]);

function isStockBlock(id) {
  if (STOCK_ONLY_IDS.has(id)) return true;
  return STOCK_PREFIXES.some((p) => id.startsWith(p));
}

function extractToolboxBlockIds() {
  const toolboxPath = resolve(__dirname, "../toolbox.js");
  const src = readFileSync(toolboxPath, "utf8");
  const re = /<block\s+type="([^"]+)"|<shadow\s+type="([^"]+)"/g;
  const ids = new Set();
  let m;
  while ((m = re.exec(src))) {
    const id = m[1] || m[2];
    if (id && !isStockBlock(id)) ids.add(id);
  }
  return [...ids];
}

describe("blockRegistry guarantees", () => {
  test("no duplicate ids", () => {
    expect(findDuplicateIds()).toEqual([]);
  });

  test("every toolbox block id has a registry entry", () => {
    const toolboxIds = extractToolboxBlockIds();
    expect(toolboxIds.length).toBeGreaterThan(0);
    const unknown = findUnknownIds(toolboxIds);
    expect(unknown).toEqual([]);
  });

  test("every entry has the required fields", () => {
    for (const e of getAllBlockEntries()) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.category).toBe("string");
      expect(["shared", "physics", "datascience", "hybrid"]).toContain(e.domain);
      expect(typeof e.conceptLabel).toBe("string");
      expect(Array.isArray(e.keywords)).toBe(true);
    }
  });

  test("BLOCK_CATALOGUE mirrors registry entries", () => {
    const entries = getAllBlockEntries();
    expect(BLOCK_CATALOGUE).toHaveLength(entries.length);
    for (let i = 0; i < entries.length; i++) {
      expect(BLOCK_CATALOGUE[i].type).toBe(entries[i].id);
      expect(BLOCK_CATALOGUE[i].category).toBe(entries[i].category);
      expect(BLOCK_CATALOGUE[i].domain).toBe(entries[i].domain);
    }
  });

  test("getBlockEntry returns the entry or null", () => {
    const all = getAllBlockEntries();
    expect(getBlockEntry(all[0].id)).toEqual(all[0]);
    expect(getBlockEntry("definitely_not_a_real_block")).toBeNull();
  });

  test("getBlocksByCategory filters", () => {
    const motion = getBlocksByCategory("Motion");
    expect(motion.length).toBeGreaterThan(0);
    expect(motion.every((e) => e.category === "Motion")).toBe(true);
  });

  test("getBlocksByDomain filters", () => {
    const shared = getBlocksByDomain("shared");
    const physics = getBlocksByDomain("physics");
    expect(shared.length).toBeGreaterThan(0);
    expect(physics.length).toBeGreaterThan(0);
    expect(shared.every((e) => e.domain === "shared")).toBe(true);
    expect(physics.every((e) => e.domain === "physics")).toBe(true);
  });

  test("getBlocksForGoal('physics') excludes datascience entries", () => {
    const result = getBlocksForGoal("physics");
    expect(result.every((e) => e.domain === "shared" || e.domain === "physics")).toBe(true);
  });

  test("getBlocksForGoal('hybrid') is the union of shared + physics + datascience + hybrid", () => {
    const hybrid = getBlocksForGoal("hybrid");
    const allowed = new Set(["shared", "physics", "datascience", "hybrid"]);
    expect(hybrid.every((e) => allowed.has(e.domain))).toBe(true);
  });

  test("the registry is 123 entries across 20 categories", () => {
    const entries = getAllBlockEntries();
    expect(entries).toHaveLength(123);
    const byCat = {};
    for (const e of entries) byCat[e.category] = (byCat[e.category] || 0) + 1;
    expect(byCat).toEqual({
      "Values": 10,
      "Objects": 15,
      "Motion": 5,
      "Graphs": 3,
      "State": 5,
      "Control": 10,
      "Logic": 4,
      "Math": 3,
      "3D Math": 8,
      "Raw Python": 2,
      "Load Data": 4,
      "Explore": 10,
      "Statistics": 13,
      "Transforming Data": 2,
      "Uncertainty": 3,
      "Analyzing Relationships": 3,
      "Filter & Sort": 9,
      "Group & Compare": 2,
      "Charts": 6,
      "Communicate": 6,
    });
  });

  test("the five phantom stock entries are gone", () => {
    for (const id of ["logic_compare", "logic_operation", "logic_negate", "math_single", "math_trig"]) {
      expect(getBlockEntry(id), id).toBeNull();
    }
  });

  test("no entry carries beginner-mode metadata", () => {
    for (const e of getAllBlockEntries()) {
      expect(e).not.toHaveProperty("beginnerVisible");
    }
  });
});

describe("buildToolboxXml goal filtering", () => {
  function typesIn(xml) {
    const set = new Set();
    const re = /<block\s+type="([^"]+)"|<shadow\s+type="([^"]+)"/g;
    let m;
    while ((m = re.exec(xml))) set.add(m[1] || m[2]);
    return set;
  }

  test("physics toolbox has physics + shared blocks, never datascience", () => {
    const t = typesIn(buildToolboxXml("physics"));
    expect(t.has("sphere_block")).toBe(true);            // physics
    expect(t.has("math_number")).toBe(true);             // shared / stock
    expect(t.has("ds_load_builtin_block")).toBe(false);  // datascience
    expect(t.has("ds_start_block")).toBe(false);
  });

  test("datascience toolbox has DS + shared, never physics-only", () => {
    const t = typesIn(buildToolboxXml("datascience"));
    expect(t.has("ds_start_block")).toBe(true);
    expect(t.has("ds_load_builtin_block")).toBe(true);
    expect(t.has("if_block")).toBe(true);                // shared (Control)
    expect(t.has("sphere_block")).toBe(false);           // physics-only
    expect(t.has("set_velocity_block")).toBe(false);
    expect(t.has("sim_start_block")).toBe(false);        // physics anchor dropped
  });

  test("hybrid toolbox is the union of physics + datascience", () => {
    const t = typesIn(buildToolboxXml("hybrid"));
    expect(t.has("sphere_block")).toBe(true);
    expect(t.has("ds_load_builtin_block")).toBe(true);
    expect(t.has("sim_start_block")).toBe(true);
  });

  test("empty categories are pruned, dynamic categories survive", () => {
    const ds = buildToolboxXml("datascience");
    expect(ds.includes('custom="VARIABLE"')).toBe(true); // dynamic — keep
    expect(ds.includes('name="Objects"')).toBe(false);   // physics-only — pruned
    expect(ds.includes('name="Data Science"')).toBe(true);
  });

  test("the three template-shipped Objects blocks are now reachable", () => {
    const t = typesIn(buildToolboxXml("physics"));
    expect(t.has("sphere_emissive_block")).toBe(true);
    expect(t.has("box_opacity_block")).toBe(true);
    expect(t.has("helix_full_block")).toBe(true);
  });

  test("Data Science is a parent drawer with ten pipeline sub-categories", () => {
    const ds = buildToolboxXml("datascience");
    for (const name of [
      "Load Data",
      "Explore",
      "Statistics",
      "Transforming Data",
      "Uncertainty",
      "Analyzing Relationships",
      "Filter & Sort",
      "Group & Compare",
      "Charts",
      "Communicate",
    ]) {
      // XMLSerializer re-escapes "&" as "&amp;" in the attribute value —
      // the registry/palette keep the literal "&", only the XML text differs.
      expect(ds, name).toContain(`name="${name.replace(/&/g, "&amp;")}"`);
    }
    expect(ds).toContain('name="Data Science"');
  });

  test("the whole DS drawer prunes away on a physics project", () => {
    const phys = buildToolboxXml("physics");
    expect(phys).not.toContain('name="Data Science"');
    expect(phys).not.toContain('name="Statistics"');
  });

  test("category colours come from categorystyle names, not colour literals", () => {
    const xml = buildToolboxXml("hybrid");
    for (const name of ["Objects", "Data Science", "Load Data", "Filter & Sort"]) {
      expect(BLOCK_PALETTE[name]).toBeDefined();
      expect(xml).toContain(`categorystyle="${categoryStyleNameFor(name)}"`);
    }
    expect(xml).not.toMatch(/colour="#/);
  });

  // Task 12: advancedBlocks:false (a locked assignment's WorkspaceRules) —
  // display-time only, so this is buildToolboxXml's own concern, not the
  // registry's. hideAdvanced defaults to false: every assertion above this
  // point already proves the unfiltered case is untouched.
  describe("hideAdvanced (Task 12 — advancedBlocks:false)", () => {
    test("drops the Advanced drawer and every block inside it", () => {
      const xml = buildToolboxXml("physics", true);
      expect(xml).not.toContain('name="Advanced"');
      // Its children — the categories nested inside the drawer — go with it.
      for (const name of ["3D Math", "Raw Python", "Loops", "Text", "Lists", "Functions"]) {
        expect(xml, name).not.toContain(`name="${name}"`);
      }
      for (const type of ["vector_compose_block", "python_raw_block", "controls_repeat_ext", "text_join", "lists_create_with"]) {
        expect(xml, type).not.toContain(`type="${type}"`);
      }
    });

    test("leaves every other category standing — filtering is scoped to the one drawer", () => {
      const xml = buildToolboxXml("physics", true);
      for (const name of ["Values", "Objects", "Motion", "State", "Control", "Logic", "Math"]) {
        expect(xml, name).toContain(`name="${name}"`);
      }
    });

    test("hideAdvanced defaults to false — the drawer stays unless a rule says otherwise", () => {
      expect(buildToolboxXml("physics")).toContain('name="Advanced"');
      expect(buildToolboxXml("physics", false)).toContain('name="Advanced"');
    });

    test("works alongside goal filtering — a hybrid toolbox still loses Advanced", () => {
      const xml = buildToolboxXml("hybrid", true);
      expect(xml).not.toContain('name="Advanced"');
      expect(xml).toContain('name="Data Science"'); // goal filtering is untouched
      expect(xml).toContain('name="Objects"');
    });
  });
});
