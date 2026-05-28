/**
 * check-block-registry — CI guard for the canonical block registry (Phase B.6).
 *
 * Run:  npm run check:blocks
 *
 * Fails (exit 1) on:
 *   - Duplicate ids in src/utils/blockly/blockRegistry.js.
 *   - Any <block type="..."> appearing in src/components/BlocklyWorkspace.js's
 *     TOOLBOX_XML or TOOLBOX_BEGINNER_XML that does not have a registry entry.
 *     Stock Blockly utility-category blocks (controls_*, variables_*,
 *     procedures_*, text_*, lists_*) are ignored because they are sourced
 *     from Blockly itself, not from our registry.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

// Stock Blockly blocks come from blocks_compressed.js; we do not register
// them. Whole-category prefixes (controls_, variables_, procedures_, lists_,
// text_) plus an explicit set for stock blocks in our own categories (logic_,
// math_) that we have deliberately chosen NOT to surface in the registry.
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

async function main() {
  const registryUrl = new URL("../src/utils/blockly/blockRegistry.js", import.meta.url);
  const { findDuplicateIds, findUnknownIds, getAllBlockEntries } = await import(registryUrl);

  const dups = findDuplicateIds();
  if (dups.length > 0) {
    console.error("✘ Duplicate block ids found in blockRegistry.js:");
    for (const d of dups) {
      console.error(`   - ${d.id} (categories: '${d.first.category}' and '${d.second.category}')`);
    }
    process.exit(1);
  }

  const toolboxPath = resolve(repoRoot, "src/components/BlocklyWorkspace.js");
  const toolboxSrc = readFileSync(toolboxPath, "utf8");
  const blockIdRe = /<block\s+type="([^"]+)"|<shadow\s+type="([^"]+)"/g;
  const toolboxIds = new Set();
  let m;
  while ((m = blockIdRe.exec(toolboxSrc))) {
    const id = m[1] || m[2];
    if (id && !isStockBlock(id)) toolboxIds.add(id);
  }

  const unknown = findUnknownIds([...toolboxIds]);
  if (unknown.length > 0) {
    console.error("✘ Block ids in TOOLBOX_XML missing from blockRegistry.js:");
    for (const id of unknown) console.error(`   - ${id}`);
    process.exit(1);
  }

  const entries = getAllBlockEntries();
  console.log(`✔ Registry OK: ${entries.length} entries, 0 duplicates, ${toolboxIds.size} toolbox ids all present.`);
}

main().catch((err) => {
  console.error("check-block-registry crashed:", err);
  process.exit(1);
});
