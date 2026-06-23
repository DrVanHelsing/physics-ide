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

  ds_load_trace_block(block) {
    const varName = resolveVar(block, "VAR", "df");
    const label = (block.getFieldValue("DATASET_NAME") || "").trim();
    return `var ${varName} = __ds.loadSavedDataset(${JSON.stringify(label)});\n`;
  },

  ds_load_csv_block(block) {
    const varName = resolveVar(block, "VAR", "df");
    return `var ${varName} = await __ds.loadCsvFile(${JSON.stringify(varName)});\n`;
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

  /* ── Category 6: Communicating Findings ── */

  ds_write_note_block(block) {
    const text = (block.getFieldValue("TEXT") || "").trim();
    return `__outputs.push({ type: "note", text: ${JSON.stringify(text)} });\n`;
  },

  ds_print_result_block(block) {
    const varName = resolveVar(block, "VAR", "result");
    const label = (block.getFieldValue("LABEL") || varName).trim();
    return `__outputs.push({ type: "value", label: ${JSON.stringify(label)}, value: ${varName} });\n`;
  },

  ds_compare_results_block(block) {
    const varA  = resolveVar(block, "VAR_A", "result1");
    const labelA = (block.getFieldValue("LABEL_A") || varA).trim();
    const varB  = resolveVar(block, "VAR_B", "result2");
    const labelB = (block.getFieldValue("LABEL_B") || varB).trim();
    return `__outputs.push({ type: "compare", a: { value: ${varA}, label: ${JSON.stringify(labelA)} }, b: { value: ${varB}, label: ${JSON.stringify(labelB)} } });\n`;
  },

  ds_state_conclusion_block(block) {
    const text = (block.getFieldValue("TEXT") || "").trim();
    return `__outputs.push({ type: "conclusion", text: ${JSON.stringify(text)} });\n`;
  },

  ds_export_table_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    return `__outputs.push({ type: "download", format: "csv", dataset: ${dsVar} });\n`;
  },

  ds_show_python_block(_block) {
    return `__outputs.push({ type: "show_python" });\n`;
  },

  /* ── D.5: Missing spec blocks ── */

  ds_find_missing_block(block) {
    const resultVar = resolveVar(block, "RESULT", "missing");
    const dsVar     = resolveVar(block, "VAR", "df");
    const col       = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "findMissing", column: ${JSON.stringify(col)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar} missing in ${col}`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_show_one_cell_block(block) {
    const resultVar = resolveVar(block, "RESULT", "cell");
    const dsVar     = resolveVar(block, "VAR", "df");
    const row       = parseInt(block.getFieldValue("ROW") || "0", 10);
    const col       = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.cellAt(${dsVar}, ${row}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`${dsVar}[${row}]["${col}"]`)}, value: ${resultVar} });\n`
    );
  },

  ds_all_stats_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const col   = (block.getFieldValue("COL") || "col").trim();
    return (
      `var __stats = __ds.allStats(${dsVar}, ${JSON.stringify(col)});\n` +
      `if (__stats) __outputs.push({ type: "all_stats", col: ${JSON.stringify(col)}, stats: __stats });\n`
    );
  },

  ds_compare_columns_block(block) {
    const dsVar = resolveVar(block, "VAR", "df");
    const colA  = (block.getFieldValue("COL_A") || "col1").trim();
    const colB  = (block.getFieldValue("COL_B") || "col2").trim();
    return (
      `var __statsA = __ds.allStats(${dsVar}, ${JSON.stringify(colA)});\n` +
      `var __statsB = __ds.allStats(${dsVar}, ${JSON.stringify(colB)});\n` +
      `__outputs.push({ type: "compare_stats", colA: ${JSON.stringify(colA)}, colB: ${JSON.stringify(colB)}, statsA: __statsA, statsB: __statsB });\n`
    );
  },

  ds_save_chart_block(block) {
    const dsVar    = resolveVar(block, "VAR", "df");
    const xCol     = (block.getFieldValue("X_COL") || "x").trim();
    const yCol     = (block.getFieldValue("Y_COL") || "y").trim();
    const chartType = (block.getFieldValue("CHART_TYPE") || "bar").trim();
    return `__outputs.push({ type: "save_chart", chartType: ${JSON.stringify(chartType)}, dataset: ${dsVar}, xCol: ${JSON.stringify(xCol)}, yCol: ${JSON.stringify(yCol)} });\n`;
  },

  /* ── Phase E: Compound filters + identify-type ── */

  ds_filter_and_block(block) {
    const resultVar = resolveVar(block, "RESULT", "filtered");
    const dsVar     = resolveVar(block, "VAR", "df");
    const colA  = (block.getFieldValue("COL_A")  || "col").trim();
    const valA  = (block.getFieldValue("VAL_A")  || "").trim();
    const colB  = (block.getFieldValue("COL_B")  || "col").trim();
    const valB  = (block.getFieldValue("VAL_B")  || "").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "filterAnd", colA: ${JSON.stringify(colA)}, opA: "=", valA: ${JSON.stringify(valA)}, colB: ${JSON.stringify(colB)}, opB: "=", valB: ${JSON.stringify(valB)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar}[${colA}="${valA}" AND ${colB}="${valB}"]`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_filter_or_block(block) {
    const resultVar = resolveVar(block, "RESULT", "filtered");
    const dsVar     = resolveVar(block, "VAR", "df");
    const colA  = (block.getFieldValue("COL_A")  || "col").trim();
    const valA  = (block.getFieldValue("VAL_A")  || "").trim();
    const colB  = (block.getFieldValue("COL_B")  || "col").trim();
    const valB  = (block.getFieldValue("VAL_B")  || "").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "filterOr", colA: ${JSON.stringify(colA)}, opA: "=", valA: ${JSON.stringify(valA)}, colB: ${JSON.stringify(colB)}, opB: "=", valB: ${JSON.stringify(valB)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar}[${colA}="${valA}" OR ${colB}="${valB}"]`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_identify_type_block(block) {
    const resultVar = resolveVar(block, "RESULT", "type");
    const dsVar     = resolveVar(block, "VAR", "df");
    const col       = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = ${dsVar} ? (${dsVar}.columns.find(function(c){ return c.name === ${JSON.stringify(col)}; }) || {}).inferredType || "unknown" : "unknown";\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`type of ${dsVar}.${col}`)}, value: ${resultVar} });\n`
    );
  },

  /* ── Transform columns ── */
  ds_add_column_transform_block(block) {
    const resultVar = resolveVar(block, "RESULT", "df2");
    const dsVar     = resolveVar(block, "VAR", "df");
    const newCol    = (block.getFieldValue("NEW_COL") || "new_col").trim();
    const transform = block.getFieldValue("TRANSFORM") || "ln";
    const srcCol    = (block.getFieldValue("SOURCE_COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "computedColumn", newName: ${JSON.stringify(newCol)}, sourceCol: ${JSON.stringify(srcCol)}, transformType: ${JSON.stringify(transform)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar}+${newCol}`)}, dataset: ${resultVar} });\n`
    );
  },

  ds_multiply_columns_block(block) {
    const resultVar = resolveVar(block, "RESULT", "df2");
    const dsVar     = resolveVar(block, "VAR", "df");
    const newCol    = (block.getFieldValue("NEW_COL") || "product").trim();
    const colA      = (block.getFieldValue("COL_A") || "col1").trim();
    const colB      = (block.getFieldValue("COL_B") || "col2").trim();
    return (
      `var ${resultVar} = __ds.transform(${dsVar}, { kind: "multiplyColumns", newName: ${JSON.stringify(newCol)}, colA: ${JSON.stringify(colA)}, colB: ${JSON.stringify(colB)} });\n` +
      `if (${resultVar}) __outputs.push({ type: "table", varName: ${JSON.stringify(`${dsVar}+${newCol}`)}, dataset: ${resultVar} });\n`
    );
  },

  /* ── Uncertainty ── */
  ds_calc_std_error_block(block) {
    const resultVar = resolveVar(block, "RESULT", "se");
    const dsVar     = resolveVar(block, "VAR", "df");
    const col       = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.stdErrorOfColumn(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`std_error(${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_print_uncertainty_block(block) {
    const meanVar = resolveVar(block, "MEAN_VAR", "mean_val");
    const seVar   = resolveVar(block, "SE_VAR", "se");
    const label   = (block.getFieldValue("LABEL") || "measurement").trim();
    return `__outputs.push({ type: "uncertainty", label: ${JSON.stringify(label)}, mean: ${meanVar}, stdError: ${seVar} });\n`;
  },

  ds_calc_relative_uncertainty_block(block) {
    const resultVar = resolveVar(block, "RESULT", "rel_unc");
    const meanVar   = resolveVar(block, "MEAN_VAR", "mean_val");
    const seVar     = resolveVar(block, "SE_VAR", "se");
    return (
      `var ${resultVar} = (${meanVar} !== null && ${meanVar} !== 0) ? (Math.abs(${seVar} / ${meanVar}) * 100) : null;\n` +
      `__outputs.push({ type: "value", label: "relative uncertainty (%)", value: ${resultVar} });\n`
    );
  },

  /* ── Relationships ── */
  ds_linear_regression_block(block) {
    const resultVar = resolveVar(block, "RESULT", "fit");
    const dsVar     = resolveVar(block, "VAR", "df");
    const xCol      = (block.getFieldValue("X_COL") || "x").trim();
    const yCol      = (block.getFieldValue("Y_COL") || "y").trim();
    return (
      `var ${resultVar} = __ds.linearRegression(${dsVar}, ${JSON.stringify(xCol)}, ${JSON.stringify(yCol)});\n` +
      `if (${resultVar}) __outputs.push({ type: "regression_result", xCol: ${JSON.stringify(xCol)}, yCol: ${JSON.stringify(yCol)}, fit: ${resultVar} });\n`
    );
  },

  ds_chart_scatter_fit_block(block) {
    const dsVar   = resolveVar(block, "VAR", "df");
    const fitVar  = resolveVar(block, "FIT_VAR", "fit");
    const xCol    = (block.getFieldValue("X_COL") || "x").trim();
    const yCol    = (block.getFieldValue("Y_COL") || "y").trim();
    const title   = (block.getFieldValue("TITLE") || "").trim();
    return `__outputs.push({ type: "chart", chartType: "scatter_fit", dataset: ${dsVar}, xCol: ${JSON.stringify(xCol)}, yCol: ${JSON.stringify(yCol)}, fit: ${fitVar}, title: ${JSON.stringify(title)} });\n`;
  },

  ds_correlation_block(block) {
    const resultVar = resolveVar(block, "RESULT", "r");
    const dsVar     = resolveVar(block, "VAR", "df");
    const colA      = (block.getFieldValue("COL_A") || "col1").trim();
    const colB      = (block.getFieldValue("COL_B") || "col2").trim();
    return (
      `var ${resultVar} = __ds.pearsonCorrelation(${dsVar}, ${JSON.stringify(colA)}, ${JSON.stringify(colB)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`r(${colA}, ${colB})`)}, value: ${resultVar} });\n`
    );
  },

  /* ── Additional stats ── */
  ds_calc_percentile_block(block) {
    const resultVar = resolveVar(block, "RESULT", "p_val");
    const dsVar     = resolveVar(block, "VAR", "df");
    const col       = (block.getFieldValue("COL") || "col").trim();
    const p         = parseFloat(block.getFieldValue("P") || "25");
    return (
      `var ${resultVar} = __ds.percentile(${dsVar}, ${JSON.stringify(col)}, ${p});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`p${p}(${col})`)}, value: ${resultVar} });\n`
    );
  },

  ds_calc_iqr_block(block) {
    const resultVar = resolveVar(block, "RESULT", "iqr_val");
    const dsVar     = resolveVar(block, "VAR", "df");
    const col       = (block.getFieldValue("COL") || "col").trim();
    return (
      `var ${resultVar} = __ds.iqr(${dsVar}, ${JSON.stringify(col)});\n` +
      `__outputs.push({ type: "value", label: ${JSON.stringify(`IQR(${col})`)}, value: ${resultVar} });\n`
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
  const tops = workspace.getTopBlocks(true);
  // Anchor to the ds_start hat(s) when present: only the analysis placed
  // inside a hat runs. Falls back to all top blocks for legacy projects
  // (and templates) that have no hat yet.
  const hats = tops.filter((b) => b.type === "ds_start_block");
  if (hats.length > 0) {
    for (const hat of hats) {
      walkChain(hat.getInputTargetBlock("BODY"), parts);
    }
  } else {
    for (const top of tops) {
      walkChain(top, parts);
    }
  }
  return parts.join("");
}
