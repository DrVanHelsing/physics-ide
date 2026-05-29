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

  ds_calc_median_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.median(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`median(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_calc_min_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.minOfColumn(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`min(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_calc_max_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.maxOfColumn(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`max(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_calc_sum_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.sumOfColumn(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`sum(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_calc_stddev_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.stddevOfColumn(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`spread(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_show_first_n_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const n = parseInt(block.getFieldValue("N") || "5", 10);
    const tmpVar = `__head_${dsVar}`;
    return (
      `var ${tmpVar} = __ds.transform(${dsVar}, { kind: "limit", n: ${n}, from: "head" });\n` +
      `if (${tmpVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar} (first ${n})`)}, dataset: ${tmpVar} });\n`
    );
  },

  ds_count_rows_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    return (
      `var ${resultVar} = ${dsVar} ? ${dsVar}.rowCount : 0;\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`rows(${dsVar})`)}, value: ${resultVar} });\n`
    );
  },

  ds_count_unique_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.uniqueCount(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`unique(${dsVar}.${col})`)}, value: ${resultVar} });\n`
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
