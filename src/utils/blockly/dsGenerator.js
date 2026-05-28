// JS code generator for DS blocks.
// Produces async JS code for dsRunner — separate from the Python generator.

function resolveVar(block, fieldName, fallback) {
  const Blockly = window.Blockly;
  const id = block.getFieldValue(fieldName);
  if (!id) return fallback;
  const model =
    block.workspace && Blockly
      ? block.workspace.getVariableById(id)
      : null;
  return (model ? model.name : id) || fallback;
}

const DS_GENERATORS = {
  ds_load_builtin_block(block) {
    const varName = resolveVar(block, "VAR", "df");
    const id = block.getFieldValue("ID") || "planets";
    return `var ${varName} = await __ds.fromBuiltin(${JSON.stringify(id)});\n`;
  },

  ds_show_table_block(block) {
    const varName = resolveVar(block, "VAR", "df");
    return (
      `if (typeof ${varName} !== "undefined" && ${varName}) ` +
      `__outputs.push({ type: "table", varName: ${JSON.stringify(varName)}, dataset: ${varName} });\n`
    );
  },

  ds_calc_mean_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.meanOfColumn(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`mean(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },
};

function walkChain(block, parts) {
  while (block) {
    const gen = DS_GENERATORS[block.type];
    if (gen) parts.push(gen(block));
    block = block.getNextBlock();
  }
}

export function generateDsJsFromWorkspace(workspace) {
  if (!workspace) return "";
  const parts = [];
  for (const top of workspace.getTopBlocks(true)) {
    walkChain(top, parts);
  }
  return parts.join("");
}
