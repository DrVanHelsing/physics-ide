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

  /* ── Category 2: Exploring Data (remaining) ── */

  ds_show_last_n_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const n = parseInt(block.getFieldValue("N") || "5", 10);
    const tmpVar = `__tail_${dsVar}`;
    return (
      `var ${tmpVar} = __ds.transform(${dsVar}, { kind: "limit", n: ${n}, from: "tail" });\n` +
      `if (${tmpVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar} (last ${n})`)}, dataset: ${tmpVar} });\n`
    );
  },

  ds_count_cols_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    return (
      `var ${resultVar} = ${dsVar} ? ${dsVar}.columns.length : 0;\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`columns(${dsVar})`)}, value: ${resultVar} });\n`
    );
  },

  ds_list_cols_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    return (
      `var ${resultVar} = ${dsVar} ? ${dsVar}.columns.map(function(c){ return c.name; }).join(", ") : "";\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`column names(${dsVar})`)}, value: ${resultVar} });\n`
    );
  },

  ds_show_column_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    const tmpVar = `__col_${dsVar}`;
    return (
      `var ${tmpVar} = __ds.transform(${dsVar}, { kind: "select", columns: [${JSON.stringify(col)}] });\n` +
      `if (${tmpVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar}.${col}`)}, dataset: ${tmpVar} });\n`
    );
  },

  /* ── Category 3: Describing Data (remaining) ── */

  ds_calc_mode_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.mode(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`most common(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_calc_range_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.rangeOfColumn(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`range(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_calc_count_block(block) {
    const resultVar = resolveVar(block, "RESULT", "result");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "value").trim();
    return (
      `var ${resultVar} = __ds.countOfColumn(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`count non-missing(${dsVar}.${col})`)}, value: ${resultVar} });\n`
    );
  },

  /* ── Category 4: Asking Questions (Filter / Sort / Group) ── */

  ds_filter_eq_block(block) {
    const resultVar = resolveVar(block, "RESULT", "filtered");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "col").trim();
    const val = (block.getFieldValue("VALUE") || "").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "filter", column: ${JSON.stringify(col)}, op: "=", value: ${JSON.stringify(val)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar}[${col}="${val}"]`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_filter_gt_block(block) {
    const resultVar = resolveVar(block, "RESULT", "filtered");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "col").trim();
    const val = (block.getFieldValue("VALUE") || "0").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "filter", column: ${JSON.stringify(col)}, op: ">", value: ${JSON.stringify(val)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar}[${col}>${val}]`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_filter_lt_block(block) {
    const resultVar = resolveVar(block, "RESULT", "filtered");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "col").trim();
    const val = (block.getFieldValue("VALUE") || "0").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "filter", column: ${JSON.stringify(col)}, op: "<", value: ${JSON.stringify(val)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar}[${col}<${val}]`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_sort_asc_block(block) {
    const resultVar = resolveVar(block, "RESULT", "sorted");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "sort", column: ${JSON.stringify(col)}, dir: "asc" });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar} sorted by ${col} ↑`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_sort_desc_block(block) {
    const resultVar = resolveVar(block, "RESULT", "sorted");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "sort", column: ${JSON.stringify(col)}, dir: "desc" });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar} sorted by ${col} ↓`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_remove_missing_block(block) {
    const resultVar = resolveVar(block, "RESULT", "cleaned");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "dropMissing", column: ${JSON.stringify(col)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar} (no missing ${col})`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_group_count_block(block) {
    const resultVar = resolveVar(block, "RESULT", "grouped");
    const dsVar = resolveVar(block, "VAR", "df");
    const col = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "groupBy", column: ${JSON.stringify(col)}, agg: "count" });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`count by ${col}`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_group_mean_block(block) {
    const resultVar = resolveVar(block, "RESULT", "grouped");
    const dsVar = resolveVar(block, "VAR", "df");
    const valueCol = (block.getFieldValue("VALUE_COL") || "value").trim();
    const groupCol = (block.getFieldValue("GROUP_COL") || "group").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "groupBy", column: ${JSON.stringify(groupCol)}, agg: "mean", valueColumn: ${JSON.stringify(valueCol)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`mean ${valueCol} by ${groupCol}`)}, dataset: ${resultVar} });\n`
    );
  },

  /* ── Category 5: Seeing Data (Charts) ── */

  ds_chart_bar_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const xCol  = (block.getFieldValue("X_COL") || "x").trim();
    const yCol  = (block.getFieldValue("Y_COL") || "y").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `__outputs.push({ type: "chart", chartType: "bar", dataset: ${dsVar}, xCol: ${JSON.stringify(xCol)}, yCol: ${JSON.stringify(yCol)}, title: ${JSON.stringify(title)} });\n`;
  },

  ds_chart_line_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const xCol  = (block.getFieldValue("X_COL") || "x").trim();
    const yCol  = (block.getFieldValue("Y_COL") || "y").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `__outputs.push({ type: "chart", chartType: "line", dataset: ${dsVar}, xCol: ${JSON.stringify(xCol)}, yCol: ${JSON.stringify(yCol)}, title: ${JSON.stringify(title)} });\n`;
  },

  ds_chart_scatter_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const xCol  = (block.getFieldValue("X_COL") || "x").trim();
    const yCol  = (block.getFieldValue("Y_COL") || "y").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `__outputs.push({ type: "chart", chartType: "scatter", dataset: ${dsVar}, xCol: ${JSON.stringify(xCol)}, yCol: ${JSON.stringify(yCol)}, title: ${JSON.stringify(title)} });\n`;
  },

  ds_chart_histogram_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const col   = (block.getFieldValue("COL") || "value").trim();
    const title = (block.getFieldValue("TITLE") || "").trim();
    return `__outputs.push({ type: "chart", chartType: "histogram", dataset: ${dsVar}, col: ${JSON.stringify(col)}, title: ${JSON.stringify(title)} });\n`;
  },

  ds_chart_box_block(block) {
    const dsVar    = resolveVar(block, "VAR", "df");
    const valueCol = (block.getFieldValue("VALUE_COL") || "value").trim();
    const groupCol = (block.getFieldValue("GROUP_COL") || "").trim();
    const title    = (block.getFieldValue("TITLE") || "").trim();
    return `__outputs.push({ type: "chart", chartType: "box", dataset: ${dsVar}, valueCol: ${JSON.stringify(valueCol)}, groupCol: ${JSON.stringify(groupCol)}, title: ${JSON.stringify(title)} });\n`;
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
