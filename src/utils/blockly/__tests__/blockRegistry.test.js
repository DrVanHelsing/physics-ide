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
  const toolboxPath = resolve(__dirname, "../../../components/BlocklyWorkspace.js");
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
      expect(typeof e.beginnerVisible).toBe("boolean");
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

  test("getBlocksForGoal with beginnerEnabled drops non-beginner entries", () => {
    const beginner = getBlocksForGoal("physics", { beginnerEnabled: true });
    const all = getBlocksForGoal("physics");
    expect(beginner.length).toBeLessThan(all.length);
    expect(beginner.every((e) => e.beginnerVisible === true)).toBe(true);
  });

  test("getBlocksForGoal('hybrid') is the union of shared + physics + datascience + hybrid", () => {
    const hybrid = getBlocksForGoal("hybrid");
    const allowed = new Set(["shared", "physics", "datascience", "hybrid"]);
    expect(hybrid.every((e) => allowed.has(e.domain))).toBe(true);
  });
});
