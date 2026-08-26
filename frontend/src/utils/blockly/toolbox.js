/**
 * Toolbox — single source of truth (Phase J).
 *
 * Replaces the two hand-written toolbox strings that used to live in
 * BlocklyWorkspace.js (TOOLBOX_XML + TOOLBOX_BEGINNER_XML). There is now ONE
 * master toolbox; `buildToolboxXml(goal)` filters it per project goal using
 * the canonical block registry's domain tags, so a physics project never
 * shows Data Science blocks and a data project never shows Objects/Motion.
 *
 * Design notes:
 *   - The "Starter" category was removed; the simulation anchors
 *     (sim_start/sim_end) now live at the top of Control.
 *   - Beginner/Advanced *mode* is gone. Complexity is managed instead by an
 *     "Advanced" drawer (a parent category whose children collapse) holding
 *     the power-user categories.
 *   - Filtering is by *block* domain (via getBlockEntry), not by category, so
 *     mixed categories (Control, 3D Math) keep their shared blocks for every
 *     goal while dropping their physics-only blocks for data projects.
 *   - Stock Blockly blocks (controls_*, text_*, lists_*, math_number, …) have
 *     no registry entry; they are treated as "shared" and always kept.
 */

import { getBlockEntry } from "./blockRegistry";

/* ── Goal → allowed domains (mirrors getBlocksForGoal) ───────── */
function domainAllowedForGoal(goal, domain) {
  if (goal === "physics") return domain === "shared" || domain === "physics";
  if (goal === "datascience") return domain === "shared" || domain === "datascience";
  // hybrid / custom / unknown → everything
  return true;
}

function blockDomain(type) {
  const entry = getBlockEntry(type);
  return entry ? entry.domain : "shared"; // stock blocks → shared
}

/* ──────────────────────────────────────────────────────────────
   MASTER TOOLBOX — every block the IDE offers, once.
   Categories are filtered/pruned per goal at runtime.
   ────────────────────────────────────────────────────────────── */
export const MASTER_TOOLBOX_XML = `
<xml>
  <!-- ── VALUES (physics) ───────────────────────────────── -->
  <category name="Values" categorystyle="values_category">
    <label text="Define constants" web-class="tb-label"></label>
    <block type="define_const_block">
      <value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
    </block>
    <sep gap="8"></sep>
    <label text="Physics constants" web-class="tb-label"></label>
    <block type="physics_const_block"></block>
    <block type="vector_block"></block>
    <block type="colour_block"></block>
    <block type="var_read_block"></block>
    <block type="expr_block"></block>
    <sep gap="12"></sep>
    <label text="Object properties &amp; vectors" web-class="tb-label"></label>
    <block type="get_prop_block">
      <field name="OBJ">ball</field>
      <field name="PROP">velocity</field>
    </block>
    <block type="get_component_block">
      <field name="COMP">y</field>
      <value name="VEC"><shadow type="get_prop_block"><field name="OBJ">ball</field><field name="PROP">pos</field></shadow></value>
    </block>
    <block type="mag_block">
      <value name="VEC"><shadow type="get_prop_block"><field name="OBJ">ball</field><field name="PROP">velocity</field></shadow></value>
    </block>
    <block type="norm_block">
      <value name="VEC"><shadow type="get_prop_block"><field name="OBJ">ball</field><field name="PROP">pos</field></shadow></value>
    </block>
  </category>

  <!-- ── OBJECTS (physics) ──────────────────────────────── -->
  <category name="Objects" categorystyle="objects_category">
    <label text="Quick create" web-class="tb-label"></label>
    <block type="preset_sphere_block">
      <field name="NAME">ball</field>
      <field name="X">0</field><field name="Y">0</field><field name="Z">0</field>
      <field name="R">1</field><field name="COL">#ff4444</field>
    </block>
    <block type="preset_box_block">
      <field name="NAME">wall</field>
      <field name="X">0</field><field name="Y">-1</field><field name="Z">0</field>
      <field name="W">10</field><field name="H">0.5</field><field name="D">10</field>
      <field name="COL">#336633</field>
    </block>
    <sep gap="8"></sep>
    <label text="Composable objects" web-class="tb-label"></label>
    <block type="sphere_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="RADIUS"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#ff4444</field></shadow></value>
    </block>
    <block type="sphere_trail_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="RADIUS"><shadow type="math_number"><field name="NUM">0.5</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#ff4444</field></shadow></value>
      <value name="TRAIL_R"><shadow type="math_number"><field name="NUM">0.03</field></shadow></value>
      <value name="TRAIL_COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#ffff00</field></shadow></value>
      <value name="RETAIN"><shadow type="math_number"><field name="NUM">200</field></shadow></value>
    </block>
    <block type="sphere_emissive_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="RADIUS"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">YELLOW</field><field name="CUSTOM">#ffdd55</field></shadow></value>
      <value name="OPACITY"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
    </block>
    <block type="box_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="SIZE"><shadow type="vector_block"><field name="X">1</field><field name="Y">1</field><field name="Z">1</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#4444ff</field></shadow></value>
    </block>
    <block type="box_opacity_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="SIZE"><shadow type="vector_block"><field name="X">1</field><field name="Y">1</field><field name="Z">1</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#4444ff</field></shadow></value>
      <value name="OPACITY"><shadow type="math_number"><field name="NUM">0.4</field></shadow></value>
    </block>
    <block type="cylinder_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="AXIS"><shadow type="vector_block"><field name="X">1</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="RADIUS"><shadow type="math_number"><field name="NUM">0.5</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#44ff44</field></shadow></value>
    </block>
    <block type="arrow_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="AXIS"><shadow type="vector_block"><field name="X">1</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#ffff00</field></shadow></value>
    </block>
    <block type="helix_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="AXIS"><shadow type="vector_block"><field name="X">1</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="RADIUS"><shadow type="math_number"><field name="NUM">0.3</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#cccccc</field></shadow></value>
    </block>
    <block type="helix_full_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="AXIS"><shadow type="vector_block"><field name="X">1</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="RADIUS"><shadow type="math_number"><field name="NUM">0.3</field></shadow></value>
      <value name="COILS"><shadow type="math_number"><field name="NUM">10</field></shadow></value>
      <value name="THICK"><shadow type="math_number"><field name="NUM">0.05</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#cccccc</field></shadow></value>
    </block>
    <block type="label_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
    </block>
    <block type="label_full_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">5</field><field name="Z">0</field></shadow></value>
      <value name="HEIGHT"><shadow type="math_number"><field name="NUM">12</field></shadow></value>
    </block>
    <block type="local_light_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">5</field><field name="Z">0</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">WHITE</field><field name="CUSTOM">#ffffff</field></shadow></value>
    </block>
    <sep gap="8"></sep>
    <label text="Scene &amp; camera" web-class="tb-label"></label>
    <block type="scene_camera_block">
      <value name="VALUE"><block type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">8</field></block></value>
    </block>
  </category>

  <!-- ── MOTION (physics) ───────────────────────────────── -->
  <category name="Motion" categorystyle="motion_category">
    <block type="set_velocity_block">
      <value name="VEL"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
    </block>
    <block type="update_position_block">
      <value name="DT"><shadow type="expr_block"><field name="EXPR">dt</field></shadow></value>
    </block>
    <block type="apply_force_block">
      <value name="ACCEL"><shadow type="vector_block"><field name="X">0</field><field name="Y">-9.81</field><field name="Z">0</field></shadow></value>
      <value name="DT"><shadow type="expr_block"><field name="EXPR">dt</field></shadow></value>
    </block>
    <block type="set_gravity_block"></block>
    <sep gap="8"></sep>
    <label text="Rotate" web-class="tb-label"></label>
    <block type="rotate_object_block">
      <value name="ANGLE"><block type="math_number"><field name="NUM">45</field></block></value>
      <value name="AXIS"><block type="vector_block"><field name="X">0</field><field name="Y">1</field><field name="Z">0</field></block></value>
    </block>
  </category>

  <!-- ── STATE (physics) ────────────────────────────────── -->
  <category name="State" categorystyle="state_category">
    <block type="define_const_block">
      <value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
    </block>
    <block type="set_colour_var_block"></block>
    <block type="set_scalar_block">
      <value name="VALUE"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
    </block>
    <block type="set_attr_expr_block">
      <value name="VALUE"><shadow type="expr_block"><field name="EXPR">0</field></shadow></value>
    </block>
    <block type="add_attr_expr_block">
      <value name="VALUE"><shadow type="expr_block"><field name="EXPR">a * dt</field></shadow></value>
    </block>
    <block type="telemetry_update_block">
      <value name="V"><shadow type="get_prop_block"><field name="OBJ">ball</field><field name="PROP">pos</field></shadow></value>
    </block>
  </category>

  <!-- ── CONTROL (shared + simulation anchors) ──────────── -->
  <category name="Control" categorystyle="control_category">
    <label text="Simulation structure" web-class="tb-label"></label>
    <block type="sim_start_block"></block>
    <block type="sim_end_block"></block>
    <sep gap="12"></sep>
    <label text="Timing &amp; loops" web-class="tb-label"></label>
    <block type="time_step_block"></block>
    <block type="rate_block"></block>
    <block type="forever_loop_block"></block>
    <block type="for_range_block"></block>
    <sep gap="8"></sep>
    <label text="Conditions" web-class="tb-label"></label>
    <block type="if_block">
      <value name="COND"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
    <block type="if_else_block">
      <value name="COND"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
    <block type="break_loop_block"></block>
    <block type="comment_block"></block>
  </category>

  <!-- ── LOGIC (shared) ─────────────────────────────────── -->
  <category name="Logic" categorystyle="logic_category">
    <block type="compare_block">
      <value name="A"><shadow type="var_read_block"><field name="VAR">x</field></shadow></value>
      <value name="B"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
    </block>
    <block type="logic_and_or_block">
      <value name="A"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
      <value name="B"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
    <block type="logic_not_block">
      <value name="VAL"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
    <sep gap="8"></sep>
    <block type="logic_boolean"></block>
    <block type="logic_null"></block>
    <block type="logic_ternary"></block>
  </category>

  <!-- ── MATH (shared) ──────────────────────────────────── -->
  <category name="Math" categorystyle="math_category">
    <block type="math_number"></block>
    <block type="math_arithmetic"></block>
    <block type="math_constant"></block>
    <block type="math_number_property"></block>
    <block type="math_round"></block>
    <block type="math_on_list"></block>
    <block type="math_modulo"></block>
    <block type="math_random_int">
      <value name="FROM"><block type="math_number"><field name="NUM">1</field></block></value>
      <value name="TO"><block type="math_number"><field name="NUM">100</field></block></value>
    </block>
    <block type="math_random_float"></block>
  </category>

  <category name="Variables" categorystyle="variables_category" custom="VARIABLE"></category>

  <!-- ── DATA SCIENCE (datascience) — the analysis pipeline, in order ── -->
  <category name="Data Science" categorystyle="data_science_category" expanded="false">
    <category name="Load Data" categorystyle="load_data_category">
      <label text="Analysis structure" web-class="tb-label"></label>
      <block type="ds_start_block"></block>
      <sep gap="12"></sep>
      <label text="Bring data in" web-class="tb-label"></label>
      <block type="ds_load_builtin_block"></block>
      <block type="ds_load_csv_block"></block>
      <block type="ds_load_trace_block"></block>
    </category>

    <category name="Explore" categorystyle="explore_category">
      <block type="ds_show_table_block"></block>
      <block type="ds_show_first_n_block"></block>
      <block type="ds_show_last_n_block"></block>
      <block type="ds_show_column_block"><field name="COL">species</field></block>
      <block type="ds_count_rows_block"></block>
      <block type="ds_count_cols_block"></block>
      <block type="ds_list_cols_block"></block>
      <block type="ds_count_unique_block"><field name="COL">species</field></block>
      <block type="ds_show_one_cell_block"><field name="ROW">0</field><field name="COL">species</field></block>
      <block type="ds_identify_type_block"><field name="COL">species</field></block>
    </category>

    <category name="Statistics" categorystyle="statistics_category">
      <block type="ds_calc_mean_block"><field name="COL">mass</field></block>
      <block type="ds_calc_median_block"><field name="COL">mass</field></block>
      <block type="ds_calc_mode_block"><field name="COL">species</field></block>
      <block type="ds_calc_min_block"><field name="COL">mass</field></block>
      <block type="ds_calc_max_block"><field name="COL">mass</field></block>
      <block type="ds_calc_range_block"><field name="COL">mass</field></block>
      <block type="ds_calc_sum_block"><field name="COL">mass</field></block>
      <block type="ds_calc_count_block"><field name="COL">mass</field></block>
      <block type="ds_calc_stddev_block"><field name="COL">mass</field></block>
      <block type="ds_all_stats_block"><field name="COL">mass</field></block>
      <block type="ds_compare_columns_block"><field name="COL_A">bill_length_mm</field><field name="COL_B">bill_depth_mm</field></block>
      <block type="ds_calc_percentile_block"><field name="COL">mass</field><field name="P">50</field></block>
      <block type="ds_calc_iqr_block"><field name="COL">mass</field></block>
    </category>

    <category name="Transforming Data" categorystyle="transforming_data_category">
      <block type="ds_add_column_transform_block"><field name="SOURCE_COL">x</field><field name="NEW_NAME">log_x</field><field name="TRANSFORM">log10</field></block>
      <block type="ds_multiply_columns_block"><field name="COL_A">t</field><field name="COL_B">t</field><field name="NEW_NAME">t_sq</field></block>
    </category>

    <category name="Uncertainty" categorystyle="uncertainty_category">
      <block type="ds_calc_std_error_block"><field name="COL">mass</field></block>
      <block type="ds_print_uncertainty_block"><field name="LABEL">measurement</field></block>
      <block type="ds_calc_relative_uncertainty_block"></block>
    </category>

    <category name="Analyzing Relationships" categorystyle="analyzing_relationships_category">
      <block type="ds_linear_regression_block"><field name="X_COL">x</field><field name="Y_COL">y</field></block>
      <block type="ds_chart_scatter_fit_block"><field name="X_COL">x</field><field name="Y_COL">y</field></block>
      <block type="ds_correlation_block"><field name="COL_A">x</field><field name="COL_B">y</field></block>
    </category>

    <category name="Filter &amp; Sort" categorystyle="filter_sort_category">
      <block type="ds_filter_eq_block"><field name="COL">species</field><field name="VALUE">Adelie</field></block>
      <block type="ds_filter_gt_block"><field name="COL">mass</field><field name="VALUE">3500</field></block>
      <block type="ds_filter_lt_block"><field name="COL">mass</field><field name="VALUE">3500</field></block>
      <block type="ds_filter_and_block"><field name="COL_A">species</field><field name="VAL_A">Adelie</field><field name="COL_B">island</field><field name="VAL_B">Biscoe</field></block>
      <block type="ds_filter_or_block"><field name="COL_A">species</field><field name="VAL_A">Adelie</field><field name="COL_B">species</field><field name="VAL_B">Chinstrap</field></block>
      <sep gap="8"></sep>
      <block type="ds_sort_asc_block"><field name="COL">mass</field></block>
      <block type="ds_sort_desc_block"><field name="COL">mass</field></block>
      <sep gap="8"></sep>
      <block type="ds_remove_missing_block"><field name="COL">mass</field></block>
      <block type="ds_find_missing_block"><field name="COL">mass</field></block>
    </category>

    <category name="Group &amp; Compare" categorystyle="group_compare_category">
      <block type="ds_group_count_block"><field name="COL">species</field></block>
      <block type="ds_group_mean_block"><field name="VALUE_COL">mass</field><field name="GROUP_COL">species</field></block>
    </category>

    <category name="Charts" categorystyle="charts_category">
      <block type="ds_chart_bar_block"><field name="X_COL">species</field><field name="Y_COL">count</field></block>
      <block type="ds_chart_line_block"><field name="X_COL">date</field><field name="Y_COL">temperature</field></block>
      <block type="ds_chart_scatter_block"><field name="X_COL">bill_length_mm</field><field name="Y_COL">body_mass_g</field></block>
      <block type="ds_chart_histogram_block"><field name="COL">body_mass_g</field></block>
      <block type="ds_chart_box_block"><field name="VALUE_COL">body_mass_g</field><field name="GROUP_COL">species</field></block>
      <block type="ds_save_chart_block"><field name="X_COL">species</field><field name="Y_COL">count</field></block>
    </category>

    <category name="Communicate" categorystyle="communicate_category">
      <block type="ds_write_note_block"></block>
      <block type="ds_print_result_block"></block>
      <block type="ds_compare_results_block"></block>
      <block type="ds_state_conclusion_block"></block>
      <block type="ds_export_table_block"></block>
      <block type="ds_show_python_block"></block>
    </category>
  </category>

  <!-- ── ADVANCED drawer (power-user categories collapse here) ── -->
  <category name="Advanced" categorystyle="advanced_category" expanded="false">
    <category name="3D Math" categorystyle="3d_math_category">
      <label text="Vectors" web-class="tb-label"></label>
      <block type="vector_compose_block">
        <value name="X"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
        <value name="Y"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
        <value name="Z"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
      </block>
      <block type="cross_product_block"></block>
      <block type="dot_product_block"></block>
      <block type="mag_block">
        <value name="VEC"><shadow type="get_prop_block"><field name="OBJ">ball</field><field name="PROP">velocity</field></shadow></value>
      </block>
      <block type="norm_block">
        <value name="VEC"><shadow type="get_prop_block"><field name="OBJ">ball</field><field name="PROP">pos</field></shadow></value>
      </block>
      <label text="Min / Max / Clamp / Power" web-class="tb-label"></label>
      <block type="math_min_block">
        <value name="A"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
        <value name="B"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
      </block>
      <block type="math_max_block">
        <value name="A"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
        <value name="B"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
      </block>
      <block type="math_clamp_block">
        <value name="VAL"><shadow type="math_number"><field name="NUM">0.5</field></shadow></value>
        <value name="LO"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
        <value name="HI"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
      </block>
      <block type="math_pow_block">
        <value name="BASE"><shadow type="math_number"><field name="NUM">2</field></shadow></value>
        <value name="EXP"><shadow type="math_number"><field name="NUM">2</field></shadow></value>
      </block>
      <label text="Trig &amp; Math" web-class="tb-label"></label>
      <block type="math_trig_block"></block>
    </category>

    <category name="Raw Python" categorystyle="raw_python_category">
      <block type="python_raw_block"></block>
      <block type="python_raw_expr_block"></block>
    </category>

    <category name="Loops" categorystyle="loops_category">
      <block type="controls_repeat_ext">
        <value name="TIMES"><block type="math_number"><field name="NUM">10</field></block></value>
      </block>
      <block type="controls_for">
        <field name="VAR">i</field>
        <value name="FROM"><block type="math_number"><field name="NUM">0</field></block></value>
        <value name="TO"><block type="math_number"><field name="NUM">10</field></block></value>
        <value name="BY"><block type="math_number"><field name="NUM">1</field></block></value>
      </block>
      <block type="controls_forEach"></block>
      <block type="controls_flow_statements"></block>
    </category>

    <category name="Text" categorystyle="text_category">
      <block type="text"></block>
      <block type="text_join"></block>
      <block type="text_append">
        <field name="VAR">item</field>
        <value name="TEXT"><block type="text"></block></value>
      </block>
      <block type="text_length"></block>
      <block type="text_isEmpty"></block>
      <block type="text_indexOf"></block>
      <block type="text_charAt"></block>
      <block type="text_getSubstring"></block>
      <block type="text_changeCase"></block>
      <block type="text_trim"></block>
      <block type="text_print"></block>
    </category>

    <category name="Lists" categorystyle="lists_category">
      <block type="lists_create_empty"></block>
      <block type="lists_create_with"></block>
      <block type="lists_repeat">
        <value name="NUM"><block type="math_number"><field name="NUM">5</field></block></value>
      </block>
      <block type="lists_length"></block>
      <block type="lists_isEmpty"></block>
      <block type="lists_indexOf"></block>
      <block type="lists_getIndex"></block>
      <block type="lists_setIndex"></block>
    </category>

    <category name="Functions" categorystyle="functions_category" custom="PROCEDURE"></category>
  </category>
</xml>`;

/* ──────────────────────────────────────────────────────────────
   buildToolboxXml(goal, hideAdvanced) — filter the master to one goal, and
   (Task 12) optionally drop the Advanced drawer entirely for a workspace
   whose assignment rules say advancedBlocks:false. Display-time only — the
   block registry itself is untouched, so npm run check:blocks stays green;
   a block already placed on the canvas from before the rule applied still
   runs, it just can't be dragged back in from the toolbox.
   ────────────────────────────────────────────────────────────── */
export function buildToolboxXml(goal = "physics", hideAdvanced = false) {
  // No DOM available (shouldn't happen in browser/jsdom) → ship master as-is.
  if (typeof DOMParser === "undefined") return MASTER_TOOLBOX_XML;

  let doc;
  try {
    doc = new DOMParser().parseFromString(MASTER_TOOLBOX_XML, "text/xml");
  } catch (e) {
    return MASTER_TOOLBOX_XML;
  }
  if (doc.querySelector("parsererror")) {
    // Malformed master — never blank the toolbox; ship it unfiltered.
    console.warn("buildToolboxXml: master XML failed to parse; using unfiltered toolbox.");
    return MASTER_TOOLBOX_XML;
  }

  // 1) Drop blocks/shadows whose domain isn't allowed for this goal.
  for (const el of [...doc.querySelectorAll("block[type], shadow[type]")]) {
    const type = el.getAttribute("type");
    if (!domainAllowedForGoal(goal, blockDomain(type))) {
      el.remove();
    }
  }

  // 1b) A locked assignment drops the Advanced drawer and everything in it,
  // found by its `name` attribute — never by position, since goal filtering
  // above may already have shifted where it sits among its siblings.
  if (hideAdvanced) {
    const advanced = [...doc.querySelectorAll("category")].find(
      (cat) => cat.getAttribute("name") === "Advanced",
    );
    if (advanced) advanced.remove();
  }

  // 2) Prune categories (bottom-up) that hold no blocks and aren't dynamic.
  pruneEmptyCategories(doc.documentElement);

  // 3) Tidy dangling group labels / separators left behind by pruning.
  for (const cat of [...doc.querySelectorAll("category")]) {
    tidyLabelsAndSeps(cat);
  }

  return new XMLSerializer().serializeToString(doc.documentElement);
}

/** A category is keepable if it is dynamic (custom=…), has a surviving
 *  block descendant, or has a surviving sub-category. Pruned bottom-up. */
function pruneEmptyCategories(root) {
  const cats = [...root.querySelectorAll("category")];
  // Reverse so children are evaluated before parents.
  for (const cat of cats.reverse()) {
    if (cat.getAttribute("custom")) continue; // VARIABLE / PROCEDURE
    if (cat.querySelector("block")) continue;
    if (cat.querySelector("category")) continue; // drawer with live children
    cat.remove();
  }
}

/** Remove labels with no block before the next label, and collapse stray
 *  separators, so a filtered category has no orphan headers. */
function tidyLabelsAndSeps(cat) {
  const children = [...cat.children];
  // Drop a <label> if no <block> follows it before the next <label>.
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.tagName !== "label") continue;
    let hasBlock = false;
    for (let j = i + 1; j < children.length; j++) {
      if (children[j].tagName === "label") break;
      if (children[j].tagName === "block") { hasBlock = true; break; }
    }
    if (!hasBlock) node.remove();
  }
  // Drop leading/trailing/duplicate <sep>.
  const after = [...cat.children];
  let prevWasSep = true; // treat start as sep so a leading sep is dropped
  for (const node of after) {
    if (node.tagName === "sep") {
      if (prevWasSep) node.remove();
      else prevWasSep = true;
    } else {
      prevWasSep = false;
    }
  }
  if (cat.lastElementChild && cat.lastElementChild.tagName === "sep") {
    cat.lastElementChild.remove();
  }
}
