/**
 * check-block-registry — CI guard for the canonical block registry.
 *
 * Run:  npm run check:blocks
 *
 * The registry and the toolbox must describe the SAME product, in both
 * directions. Before Tranche 3 this script checked one direction only
 * (toolbox → registry), and 19 of 125 block-search results dead-ended
 * silently: BlockSearch.openCategory (BlocklyWorkspace.js:32-53) resolves a
 * result by CATEGORY NAME and swallows the failure, so a registry entry in a
 * category the toolbox does not have, or a block in no drawer at all, looks
 * to a student like a search box that does nothing.
 *
 * Fails (exit 1) on:
 *   1. Duplicate ids in the registry.
 *   2. A toolbox block id with no registry entry.
 *   3. A registry id that appears in no toolbox drawer.
 *   4. A registry category that is not a toolbox category.
 *   5. A toolbox category that is neither a registry category nor declared
 *      below as a stock-only or parent drawer.
 *   6. A registry entry whose category is not one of the drawers its own
 *      block actually appears in. (Blocks may appear in several drawers —
 *      define_const_block is in Values and State — so the registry names the
 *      canonical home, and it has to be a real one.)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

/* Stock Blockly blocks come from blockly/blocks; we do not register them. */
const STOCK_PREFIXES = ["controls_", "variables_", "procedures_", "lists_", "text_"];
const STOCK_ONLY_IDS = new Set([
  "text",
  "logic_null", "logic_ternary",
  "math_number_property", "math_round", "math_on_list",
  "math_modulo", "math_random_int", "math_random_float",
]);

/* Drawers that legitimately hold no registry-owned block. */
const STOCK_ONLY_CATEGORIES = new Set(["Variables", "Functions", "Loops", "Text", "Lists"]);
const PARENT_CATEGORIES = new Set(["Advanced", "Data Science"]);

function isStockBlock(id) {
  if (STOCK_ONLY_IDS.has(id)) return true;
  return STOCK_PREFIXES.some((p) => id.startsWith(p));
}

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

/**
 * Walk MASTER_TOOLBOX_XML's source text and return, per category name, the
 * set of block ids declared inside it. Nesting is handled by a depth stack;
 * a block belongs to the innermost open category.
 */
function readToolbox(src) {
  const byCategory = new Map();
  const stack = [];
  const token = /<category\s+name="([^"]+)"|<\/category>|<block\s+type="([^"]+)"|<shadow\s+type="([^"]+)"/g;
  let m;
  while ((m = token.exec(src))) {
    if (m[1] !== undefined) {
      const name = decode(m[1]);
      if (!byCategory.has(name)) byCategory.set(name, new Set());
      stack.push(name);
    } else if (m[0] === "</category>") {
      stack.pop();
    } else {
      const id = m[2] || m[3];
      const here = stack[stack.length - 1];
      if (id && here && !isStockBlock(id)) byCategory.get(here).add(id);
    }
  }
  return byCategory;
}

function fail(title, lines) {
  console.error(`✘ ${title}`);
  for (const l of lines) console.error(`   - ${l}`);
  process.exit(1);
}

async function main() {
  const registryUrl = new URL("../src/utils/blockly/blockRegistry.js", import.meta.url);
  const { findDuplicateIds, findUnknownIds, getAllBlockEntries } = await import(registryUrl);

  const dups = findDuplicateIds();
  if (dups.length > 0) {
    fail(
      "Duplicate block ids found in blockRegistry.js:",
      dups.map((d) => `${d.id} (categories: '${d.first.category}' and '${d.second.category}')`),
    );
  }

  const toolboxSrc = readFileSync(resolve(repoRoot, "src/utils/blockly/toolbox.js"), "utf8");
  const byCategory = readToolbox(toolboxSrc);
  const toolboxIds = new Set([...byCategory.values()].flatMap((s) => [...s]));
  const toolboxCategories = new Set(byCategory.keys());

  const entries = getAllBlockEntries();
  const registryCategories = new Set(entries.map((e) => e.category));

  /* 2. toolbox → registry (ids) */
  const unknown = findUnknownIds([...toolboxIds]);
  if (unknown.length > 0) {
    fail("Block ids in the toolbox with no blockRegistry.js entry:", unknown);
  }

  /* 3. registry → toolbox (ids) */
  const orphanIds = entries.filter((e) => !toolboxIds.has(e.id));
  if (orphanIds.length > 0) {
    fail(
      "Registry ids that appear in NO toolbox drawer (block search would dead-end):",
      orphanIds.map((e) => `${e.id} [${e.category}]`),
    );
  }

  /* 4. registry → toolbox (categories) */
  const orphanCats = [...registryCategories].filter((c) => !toolboxCategories.has(c));
  if (orphanCats.length > 0) {
    fail("Registry categories with no matching toolbox category:", orphanCats);
  }

  /* 5. toolbox → registry (categories) */
  const strayCats = [...toolboxCategories].filter(
    (c) => !registryCategories.has(c) && !STOCK_ONLY_CATEGORIES.has(c) && !PARENT_CATEGORIES.has(c),
  );
  if (strayCats.length > 0) {
    fail(
      "Toolbox categories that own no registry block and are not declared stock-only or parent drawers:",
      strayCats,
    );
  }

  /* 6. the canonical home has to be a real one */
  const misplaced = entries.filter((e) => {
    const drawers = [...byCategory.entries()]
      .filter(([, ids]) => ids.has(e.id))
      .map(([name]) => name);
    return !drawers.includes(e.category);
  });
  if (misplaced.length > 0) {
    fail(
      "Registry entries whose category is not a drawer their block appears in:",
      misplaced.map((e) => {
        const drawers = [...byCategory.entries()]
          .filter(([, ids]) => ids.has(e.id))
          .map(([name]) => name);
        return `${e.id} says '${e.category}' but appears in: ${drawers.join(", ") || "(nowhere)"}`;
      }),
    );
  }

  console.log(
    `✔ Registry OK: ${entries.length} entries in ${registryCategories.size} categories; ` +
      `${toolboxIds.size} toolbox ids and ${toolboxCategories.size} drawers reconcile both ways.`,
  );
}

main().catch((err) => {
  console.error("check-block-registry crashed:", err);
  process.exit(1);
});
