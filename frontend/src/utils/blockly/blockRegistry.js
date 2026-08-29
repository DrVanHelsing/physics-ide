/**
 * Block registry — Phase B.6.
 *
 * Canonical metadata for every custom and stock block surfaced in the
 * toolbox. The product contract locks "zero duplication" — each block has
 * exactly one entry here, with one canonical category and one domain tag.
 *
 * What this file does NOT do (yet):
 *   - It does not replace the hand-crafted TOOLBOX_XML in
 *     src/components/BlocklyWorkspace.js. That XML carries rich defaults
 *     (shadow children with pre-filled fields, labels, seps) that we want
 *     to preserve as-is for now. Phase C's DS-block landing is the right
 *     time to swap to buildToolboxXml(); doing it now without DS blocks
 *     buys nothing.
 *   - It does not register Blockly block definitions or Python generators.
 *     Those still live in src/utils/blockly/blocklyGenerator.js. B.7's
 *     full generator split lands in Phase C alongside DS generators.
 *
 * What it DOES do:
 *   - One source of truth for {id, category, domain, conceptLabel,
 *     keywords}.
 *   - Powers BLOCK_CATALOGUE (the search index) without manual drift.
 *   - Enforces no-duplication via scripts/check-block-registry.js (run
 *     with `npm run check:blocks`).
 *   - Covered by a Jest test that asserts every block id appearing in
 *     the live TOOLBOX_XML has a registry entry, so the toolbox cannot
 *     gain a new block without registering it.
 *
 * Domain tags:
 *   shared       — works in any goal (math, logic, control flow, vars).
 *   physics      — VPython / GlowScript objects, motion, simulation.
 *   datascience  — foundational DS blocks (populated in Phase C).
 *   hybrid       — trace-to-dataset bridges (populated in Phase C).
 *
 * Categories: each entry's `category` must be one of the toolbox
 * categories the block actually appears under (an entry that appears in
 * two drawers may name either — see define_const_block, mag_block,
 * norm_block, vector_block below). "Data Science" is a toolbox drawer
 * parent, not a category any entry carries — its ten pipeline stages
 * (Load Data, Explore, Statistics, Transforming Data, Uncertainty,
 * Analyzing Relationships, Filter & Sort, Group & Compare, Charts,
 * Communicate) are the real categories.
 */

const REGISTRY = [
  /* ── Values (physics-flavoured but used inside loops too) ── */
  { id: "define_const_block", category: "Values", domain: "physics",
    conceptLabel: "Define constant",
    keywords: ["constant", "define", "const", "mass", "named", "reuse"] },
  { id: "physics_const_block", category: "Values", domain: "physics",
    conceptLabel: "Physics constant (g, G, π…)",
    keywords: ["constant", "g", "G", "pi", "c", "h", "m_e", "m_p"] },
  { id: "vector_block", category: "Values", domain: "physics",
    conceptLabel: "Vector (x, y, z)",
    keywords: ["vector", "vec", "position", "velocity", "axis"] },
  { id: "colour_block", category: "Values", domain: "physics",
    conceptLabel: "Colour",
    keywords: ["colour", "color", "red", "blue", "green", "hue"] },
  { id: "expr_block", category: "Values", domain: "physics",
    conceptLabel: "Expression (any Python)",
    keywords: ["expression", "expr", "formula", "code", "custom"] },
  { id: "var_read_block", category: "Values", domain: "physics",
    conceptLabel: "Read variable",
    keywords: ["variable", "read", "var", "name", "value", "get"] },
  { id: "get_prop_block", category: "Values", domain: "physics",
    conceptLabel: "Object property (ball.pos)",
    keywords: ["property", "prop", "dot", "ball", "pos", "velocity", "radius"] },
  { id: "get_component_block", category: "Values", domain: "physics",
    conceptLabel: "Vector component .x .y .z",
    keywords: ["component", "x", "y", "z", "scalar"] },
  { id: "mag_block", category: "Values", domain: "physics",
    conceptLabel: "Magnitude mag(vec)",
    keywords: ["magnitude", "mag", "speed", "length", "scalar"] },
  { id: "norm_block", category: "Values", domain: "physics",
    conceptLabel: "Unit vector norm(vec)",
    keywords: ["normalise", "norm", "unit", "direction", "hat"] },

  /* ── Objects (physics) ────────────────────────────────────── */
  { id: "preset_sphere_block", category: "Objects", domain: "physics",
    conceptLabel: "Quick sphere / ball",
    keywords: ["sphere", "ball", "create", "quick", "object"] },
  { id: "preset_box_block", category: "Objects", domain: "physics",
    conceptLabel: "Quick box / wall / floor",
    keywords: ["box", "wall", "floor", "create", "quick", "object"] },
  { id: "sphere_block", category: "Objects", domain: "physics",
    conceptLabel: "Sphere",
    keywords: ["sphere", "ball", "circle", "round"] },
  { id: "sphere_trail_block", category: "Objects", domain: "physics",
    conceptLabel: "Sphere + trail",
    keywords: ["sphere", "trail", "track", "path", "particle"] },
  { id: "sphere_emissive_block", category: "Objects", domain: "physics",
    conceptLabel: "Glowing sphere",
    keywords: ["sphere", "glow", "emissive", "star", "sun", "light"] },
  { id: "box_block", category: "Objects", domain: "physics",
    conceptLabel: "Box",
    keywords: ["box", "cube", "wall", "floor", "ground", "rect"] },
  { id: "box_opacity_block", category: "Objects", domain: "physics",
    conceptLabel: "Box (transparent)",
    keywords: ["box", "opacity", "transparent", "glass", "semi"] },
  { id: "cylinder_block", category: "Objects", domain: "physics",
    conceptLabel: "Cylinder",
    keywords: ["cylinder", "rod", "pipe", "tube", "circle"] },
  { id: "arrow_block", category: "Objects", domain: "physics",
    conceptLabel: "Arrow",
    keywords: ["arrow", "vector", "force", "direction", "axis"] },
  { id: "helix_block", category: "Objects", domain: "physics",
    conceptLabel: "Helix / spring",
    keywords: ["helix", "spring", "coil", "spiral"] },
  { id: "helix_full_block", category: "Objects", domain: "physics",
    conceptLabel: "Helix (detailed)",
    keywords: ["helix", "spring", "coils", "thickness", "detailed"] },
  { id: "label_block", category: "Objects", domain: "physics",
    conceptLabel: "Text label",
    keywords: ["label", "text", "display", "print", "show"] },
  { id: "label_full_block", category: "Objects", domain: "physics",
    conceptLabel: "Live display label",
    keywords: ["label", "telemetry", "live", "display", "hud"] },
  { id: "local_light_block", category: "Objects", domain: "physics",
    conceptLabel: "Point light source",
    keywords: ["light", "lamp", "glow", "local", "point"] },
  { id: "scene_camera_block", category: "Objects", domain: "physics",
    conceptLabel: "Scene / camera (center, forward…)",
    keywords: ["scene", "camera", "forward", "up", "center", "range", "zoom", "view"] },

  /* ── Motion (physics) ─────────────────────────────────────── */
  { id: "set_velocity_block", category: "Motion", domain: "physics",
    conceptLabel: "Set velocity",
    keywords: ["velocity", "speed", "v", "motion", "initial", "set"] },
  { id: "update_position_block", category: "Motion", domain: "physics",
    conceptLabel: "Update position pos += v×dt",
    keywords: ["position", "pos", "move", "update", "euler"] },
  { id: "apply_force_block", category: "Motion", domain: "physics",
    conceptLabel: "Apply force v += a×dt",
    keywords: ["force", "velocity", "acceleration", "apply", "gravity"] },
  { id: "set_gravity_block", category: "Motion", domain: "physics",
    conceptLabel: "Gravity constant",
    keywords: ["gravity", "g", "9.81", "vector", "down"] },
  { id: "rotate_object_block", category: "Motion", domain: "physics",
    conceptLabel: "Rotate object (angle, axis)",
    keywords: ["rotate", "spin", "angle", "axis", "angular", "rotation"] },

  /* ── State (physics) ──────────────────────────────────────── */
  { id: "set_scalar_block", category: "State", domain: "physics",
    conceptLabel: "Set variable (x = …)",
    keywords: ["variable", "set", "assign", "scalar", "number"] },
  { id: "set_attr_expr_block", category: "State", domain: "physics",
    conceptLabel: "Set object attribute",
    keywords: ["set", "attribute", "property", "object", "dot"] },
  { id: "add_attr_expr_block", category: "State", domain: "physics",
    conceptLabel: "Add to attribute (+=)",
    keywords: ["add", "increment", "plus", "attribute", "update"] },
  { id: "telemetry_update_block", category: "State", domain: "physics",
    conceptLabel: "Live display update",
    keywords: ["telemetry", "display", "live", "update", "show", "hud"] },
  { id: "set_colour_var_block", category: "State", domain: "physics",
    conceptLabel: "Set colour variable",
    keywords: ["colour", "color", "variable", "set"] },

  /* ── Control flow (shared + simulation anchors) ───────────── */
  { id: "sim_start_block", category: "Control", domain: "physics",
    conceptLabel: "Simulation Start",
    keywords: ["start", "begin", "simulation", "setup", "init"] },
  { id: "sim_end_block", category: "Control", domain: "physics",
    conceptLabel: "Simulation End",
    keywords: ["end", "stop", "finish", "simulation", "complete"] },
  { id: "time_step_block", category: "Control", domain: "physics",
    conceptLabel: "Time step dt",
    keywords: ["dt", "time", "step", "timestep"] },
  { id: "rate_block", category: "Control", domain: "physics",
    conceptLabel: "Rate (fps)",
    keywords: ["rate", "fps", "animation", "framerate"] },
  { id: "forever_loop_block", category: "Control", domain: "shared",
    conceptLabel: "Forever loop",
    keywords: ["loop", "forever", "while", "main", "simulation"] },
  { id: "for_range_block", category: "Control", domain: "shared",
    conceptLabel: "For loop (range)",
    keywords: ["for", "loop", "range", "repeat", "iterate", "i"] },
  { id: "if_block", category: "Control", domain: "shared",
    conceptLabel: "If condition",
    keywords: ["if", "condition", "when", "check"] },
  { id: "if_else_block", category: "Control", domain: "shared",
    conceptLabel: "If / Else",
    keywords: ["if", "else", "condition", "branch"] },
  { id: "break_loop_block", category: "Control", domain: "shared",
    conceptLabel: "Break loop",
    keywords: ["break", "stop", "exit", "end", "quit"] },
  { id: "comment_block", category: "Control", domain: "shared",
    conceptLabel: "Comment / note",
    keywords: ["comment", "note", "describe", "explain", "text"] },

  /* ── Raw Python (Advanced drawer — shared escape hatch) ───── */
  { id: "python_raw_block", category: "Raw Python", domain: "shared",
    conceptLabel: "Raw Python code",
    keywords: ["python", "code", "raw", "custom", "advanced", "statement"] },
  { id: "python_raw_expr_block", category: "Raw Python", domain: "shared",
    conceptLabel: "Raw Python expression",
    keywords: ["python", "expression", "raw", "custom", "advanced", "value"] },

  /* ── Logic (shared — custom, plus stock logic_boolean) ────── */
  { id: "compare_block", category: "Logic", domain: "shared",
    conceptLabel: "Compare (< ≤ > ≥ = ≠)",
    keywords: ["compare", "less", "greater", "equal", "condition", "lt", "gt"] },
  { id: "logic_and_or_block", category: "Logic", domain: "shared",
    conceptLabel: "AND / OR",
    keywords: ["and", "or", "logic", "boolean", "both", "either", "combine"] },
  { id: "logic_not_block", category: "Logic", domain: "shared",
    conceptLabel: "NOT",
    keywords: ["not", "negate", "invert", "flip"] },
  { id: "logic_boolean", category: "Logic", domain: "shared",
    conceptLabel: "True / False",
    keywords: ["true", "false", "boolean"] },

  /* ── Math (shared, stock Blockly) ─────────────────────────── */
  { id: "math_number", category: "Math", domain: "shared",
    conceptLabel: "Number",
    keywords: ["number", "value", "digit", "constant", "scalar"] },
  { id: "math_arithmetic", category: "Math", domain: "shared",
    conceptLabel: "Maths (+ − × ÷)",
    keywords: ["add", "subtract", "multiply", "divide", "arithmetic"] },
  { id: "math_constant", category: "Math", domain: "shared",
    conceptLabel: "Math constant (π, e, √2)",
    keywords: ["pi", "e", "constant", "phi", "golden"] },

  /* ── 3D Math (physics-flavoured) ──────────────────────────── */
  { id: "cross_product_block", category: "3D Math", domain: "physics",
    conceptLabel: "Cross product cross(a, b)",
    keywords: ["cross", "product", "perpendicular", "torque", "angular"] },
  { id: "dot_product_block", category: "3D Math", domain: "physics",
    conceptLabel: "Dot product dot(a, b)",
    keywords: ["dot", "product", "scalar", "work", "projection", "angle"] },
  { id: "math_trig_block", category: "3D Math", domain: "physics",
    conceptLabel: "Trig / math (sin, cos, radians…)",
    keywords: ["sin", "cos", "tan", "trig", "radians", "degrees"] },
  { id: "vector_compose_block", category: "3D Math", domain: "physics",
    conceptLabel: "Vector compose (x, y, z slots)",
    keywords: ["vector", "compose", "build", "dynamic", "expression"] },
  { id: "math_min_block", category: "3D Math", domain: "shared",
    conceptLabel: "Min min(a, b)",
    keywords: ["min", "minimum", "smaller", "clamp", "floor", "lower"] },
  { id: "math_max_block", category: "3D Math", domain: "shared",
    conceptLabel: "Max max(a, b)",
    keywords: ["max", "maximum", "larger", "clamp", "ceiling", "upper"] },
  { id: "math_pow_block", category: "3D Math", domain: "shared",
    conceptLabel: "Power a ** b",
    keywords: ["power", "exponent", "squared", "cubed", "square"] },
  { id: "math_clamp_block", category: "3D Math", domain: "shared",
    conceptLabel: "Clamp (val, lo, hi)",
    keywords: ["clamp", "constrain", "bound", "limit", "range", "between"] },

  /* ── Data Science pipeline (Phase C.3 vertical slice) ──────
     Ten sub-categories, in pipeline order: Load Data, Explore,
     Statistics, Transforming Data, Uncertainty, Analyzing
     Relationships, Filter & Sort, Group & Compare, Charts,
     Communicate. "Data Science" itself is a toolbox drawer, not a
     category any entry below carries. ── */

  /* ── Load Data ─────────────────────────────────────────────── */
  { id: "ds_start_block", category: "Load Data", domain: "datascience",
    conceptLabel: "Start analysis",
    keywords: ["start", "begin", "analysis", "anchor", "hat", "setup", "structure"] },
  { id: "ds_load_builtin_block", category: "Load Data", domain: "datascience",
    conceptLabel: "Load built-in dataset",
    keywords: ["load", "dataset", "data", "planets", "penguins", "weather", "import", "builtin"] },
  { id: "ds_load_csv_block", category: "Load Data", domain: "datascience",
    conceptLabel: "Load CSV file from computer",
    keywords: ["csv", "import", "upload", "file", "load", "open", "own data", "spreadsheet"] },
  { id: "ds_load_trace_block", category: "Load Data", domain: "datascience",
    conceptLabel: "Load promoted simulation run as dataset",
    keywords: ["trace", "run", "simulation", "promoted", "hybrid", "load saved", "record"] },

  /* ── Explore ───────────────────────────────────────────────── */
  { id: "ds_show_table_block", category: "Explore", domain: "datascience",
    conceptLabel: "Show table",
    keywords: ["show", "table", "display", "view", "dataset", "rows", "columns"] },
  { id: "ds_show_first_n_block", category: "Explore", domain: "datascience",
    conceptLabel: "Show first N rows",
    keywords: ["show", "first", "head", "rows", "preview", "top", "sample"] },
  { id: "ds_show_last_n_block", category: "Explore", domain: "datascience",
    conceptLabel: "Show last N rows",
    keywords: ["show", "last", "tail", "rows", "end", "bottom", "sample"] },
  { id: "ds_show_column_block", category: "Explore", domain: "datascience",
    conceptLabel: "Show one column",
    keywords: ["show", "column", "variable", "values", "single", "isolate"] },
  { id: "ds_count_rows_block", category: "Explore", domain: "datascience",
    conceptLabel: "Count rows",
    keywords: ["count", "rows", "length", "size", "total", "how many"] },
  { id: "ds_count_cols_block", category: "Explore", domain: "datascience",
    conceptLabel: "Count columns",
    keywords: ["count", "columns", "variables", "width", "how many"] },
  { id: "ds_list_cols_block", category: "Explore", domain: "datascience",
    conceptLabel: "List column names",
    keywords: ["list", "columns", "names", "variables", "headers"] },
  { id: "ds_count_unique_block", category: "Explore", domain: "datascience",
    conceptLabel: "Count unique values",
    keywords: ["count", "unique", "distinct", "values", "categories", "column"] },
  { id: "ds_show_one_cell_block", category: "Explore", domain: "datascience",
    conceptLabel: "Show one cell value",
    keywords: ["cell", "row", "column", "index", "value", "lookup", "access"] },
  { id: "ds_identify_type_block", category: "Explore", domain: "datascience",
    conceptLabel: "Identify data type of a column",
    keywords: ["type", "data type", "number", "text", "boolean", "string", "identify", "kind"] },

  /* ── Statistics ────────────────────────────────────────────── */
  { id: "ds_calc_mean_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Calculate mean",
    keywords: ["mean", "average", "statistics", "column", "compute", "calculate"] },
  { id: "ds_calc_median_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Calculate median",
    keywords: ["median", "middle", "statistics", "column", "centre", "center"] },
  { id: "ds_calc_mode_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Find most common value",
    keywords: ["mode", "most common", "frequent", "typical", "categorical"] },
  { id: "ds_calc_min_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Find minimum",
    keywords: ["min", "minimum", "smallest", "lowest", "statistics", "column"] },
  { id: "ds_calc_max_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Find maximum",
    keywords: ["max", "maximum", "largest", "highest", "statistics", "column"] },
  { id: "ds_calc_range_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Calculate range",
    keywords: ["range", "spread", "difference", "max minus min", "statistics"] },
  { id: "ds_calc_sum_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Calculate sum",
    keywords: ["sum", "total", "add", "aggregate", "statistics", "column"] },
  { id: "ds_calc_count_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Count non-missing values",
    keywords: ["count", "non-missing", "valid", "complete", "statistics"] },
  { id: "ds_calc_stddev_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Show spread (std deviation)",
    keywords: ["spread", "stddev", "standard deviation", "variability", "statistics", "column"] },
  { id: "ds_all_stats_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Show all statistics for a column",
    keywords: ["all stats", "describe", "summary", "profile", "mean", "median", "min", "max", "overview"] },
  { id: "ds_compare_columns_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Compare statistics for two columns",
    keywords: ["compare", "two columns", "side by side", "statistics", "versus", "vs"] },
  { id: "ds_calc_percentile_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Calculate p-th percentile",
    keywords: ["percentile", "quantile", "distribution", "quartile", "p25", "p75", "median"] },
  { id: "ds_calc_iqr_block", category: "Statistics", domain: "datascience",
    conceptLabel: "Interquartile range (IQR = Q3 − Q1)",
    keywords: ["IQR", "interquartile", "quartile", "Q1", "Q3", "spread", "box plot", "range"] },

  /* ── Transforming Data ─────────────────────────────────────── */
  { id: "ds_add_column_transform_block", category: "Transforming Data", domain: "datascience",
    conceptLabel: "Add transformed column (ln, log10, √, x², 1/x)",
    keywords: ["transform", "column", "log", "ln", "log10", "sqrt", "square", "reciprocal", "linearize", "add column"] },
  { id: "ds_multiply_columns_block", category: "Transforming Data", domain: "datascience",
    conceptLabel: "Multiply two columns into new column",
    keywords: ["multiply", "product", "columns", "element-wise", "T squared", "combine", "square"] },

  /* ── Uncertainty ───────────────────────────────────────────── */
  { id: "ds_calc_std_error_block", category: "Uncertainty", domain: "datascience",
    conceptLabel: "Standard error of the mean (σ/√n)",
    keywords: ["standard error", "std error", "SE", "uncertainty", "mean", "sigma", "sqrt n", "repeated"] },
  { id: "ds_print_uncertainty_block", category: "Uncertainty", domain: "datascience",
    conceptLabel: "Print measurement ± uncertainty",
    keywords: ["print", "uncertainty", "plus minus", "mean", "error", "measurement", "display", "report"] },
  { id: "ds_calc_relative_uncertainty_block", category: "Uncertainty", domain: "datascience",
    conceptLabel: "Relative uncertainty (%)",
    keywords: ["relative", "uncertainty", "percent", "percentage", "fractional", "error", "ratio"] },

  /* ── Analyzing Relationships ───────────────────────────────── */
  { id: "ds_linear_regression_block", category: "Analyzing Relationships", domain: "datascience",
    conceptLabel: "Linear regression — fit straight line (OLS)",
    keywords: ["regression", "linear", "fit", "slope", "intercept", "R squared", "OLS", "line of best fit", "trend"] },
  { id: "ds_chart_scatter_fit_block", category: "Analyzing Relationships", domain: "datascience",
    conceptLabel: "Scatter plot with regression line overlay",
    keywords: ["scatter", "fit", "regression", "line", "chart", "visualise", "trend", "best fit"] },
  { id: "ds_correlation_block", category: "Analyzing Relationships", domain: "datascience",
    conceptLabel: "Pearson correlation coefficient r",
    keywords: ["correlation", "pearson", "r", "relationship", "linear", "association", "strength"] },

  /* ── Filter & Sort ─────────────────────────────────────────── */
  { id: "ds_filter_eq_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Filter rows (equals)",
    keywords: ["filter", "where", "equals", "equal", "match", "select", "rows"] },
  { id: "ds_filter_gt_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Filter rows (greater than)",
    keywords: ["filter", "where", "greater", "above", "more than", "threshold"] },
  { id: "ds_filter_lt_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Filter rows (less than)",
    keywords: ["filter", "where", "less", "below", "under", "threshold"] },
  { id: "ds_sort_asc_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Sort ascending",
    keywords: ["sort", "order", "ascending", "smallest first", "low to high"] },
  { id: "ds_sort_desc_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Sort descending",
    keywords: ["sort", "order", "descending", "largest first", "high to low"] },
  { id: "ds_remove_missing_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Remove missing values",
    keywords: ["remove", "missing", "null", "empty", "drop", "clean", "NaN"] },
  { id: "ds_find_missing_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Find rows where value is missing",
    keywords: ["missing", "null", "empty", "NaN", "find", "incomplete", "quality"] },
  { id: "ds_filter_and_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Filter rows where BOTH conditions match (AND)",
    keywords: ["filter", "and", "both", "compound", "multiple conditions", "intersect"] },
  { id: "ds_filter_or_block", category: "Filter & Sort", domain: "datascience",
    conceptLabel: "Filter rows where EITHER condition matches (OR)",
    keywords: ["filter", "or", "either", "compound", "multiple conditions", "union"] },

  /* ── Group & Compare ───────────────────────────────────────── */
  { id: "ds_group_count_block", category: "Group & Compare", domain: "datascience",
    conceptLabel: "Count per group",
    keywords: ["group", "count", "per group", "frequency", "category", "split"] },
  { id: "ds_group_mean_block", category: "Group & Compare", domain: "datascience",
    conceptLabel: "Mean per group",
    keywords: ["group", "mean", "average", "per group", "compare", "aggregate"] },

  /* ── Charts ────────────────────────────────────────────────── */
  { id: "ds_chart_bar_block", category: "Charts", domain: "datascience",
    conceptLabel: "Bar chart",
    keywords: ["bar", "chart", "compare", "categories", "visualise", "plot"] },
  { id: "ds_chart_line_block", category: "Charts", domain: "datascience",
    conceptLabel: "Line chart",
    keywords: ["line", "chart", "trend", "time", "change", "visualise", "plot"] },
  { id: "ds_chart_scatter_block", category: "Charts", domain: "datascience",
    conceptLabel: "Scatter plot",
    keywords: ["scatter", "plot", "relationship", "correlation", "x y", "visualise"] },
  { id: "ds_chart_histogram_block", category: "Charts", domain: "datascience",
    conceptLabel: "Histogram",
    keywords: ["histogram", "distribution", "frequency", "bins", "visualise"] },
  { id: "ds_chart_box_block", category: "Charts", domain: "datascience",
    conceptLabel: "Box plot",
    keywords: ["box", "plot", "spread", "median", "outliers", "quartile", "visualise"] },
  { id: "ds_save_chart_block", category: "Charts", domain: "datascience",
    conceptLabel: "Save chart as image",
    keywords: ["save", "export", "chart", "image", "png", "download", "picture"] },

  /* ── Communicate ───────────────────────────────────────────── */
  { id: "ds_write_note_block", category: "Communicate", domain: "datascience",
    conceptLabel: "Write a note",
    keywords: ["note", "annotation", "text", "label", "observation", "caption"] },
  { id: "ds_print_result_block", category: "Communicate", domain: "datascience",
    conceptLabel: "Print a result",
    keywords: ["print", "display", "show", "result", "output", "label"] },
  { id: "ds_compare_results_block", category: "Communicate", domain: "datascience",
    conceptLabel: "Compare two results",
    keywords: ["compare", "two", "results", "side by side", "versus", "vs"] },
  { id: "ds_state_conclusion_block", category: "Communicate", domain: "datascience",
    conceptLabel: "State a conclusion",
    keywords: ["conclusion", "finding", "claim", "evidence", "data shows", "summary"] },
  { id: "ds_export_table_block", category: "Communicate", domain: "datascience",
    conceptLabel: "Export table as CSV",
    keywords: ["export", "csv", "download", "save", "file", "table"] },
  { id: "ds_show_python_block", category: "Communicate", domain: "datascience",
    conceptLabel: "Show generated Python",
    keywords: ["python", "code", "reveal", "show", "generated", "syntax"] },
];

/* ── Public surface ──────────────────────────────────────── */

const BY_ID = new Map(REGISTRY.map((entry) => [entry.id, entry]));

export function getAllBlockEntries() {
  return REGISTRY.slice();
}

export function getBlockEntry(id) {
  return BY_ID.get(id) || null;
}

export function getBlocksByCategory(category) {
  return REGISTRY.filter((e) => e.category === category);
}

export function getBlocksByDomain(domain) {
  return REGISTRY.filter((e) => e.domain === domain);
}

export function getBlocksForGoal(goal) {
  const allowedDomains =
    goal === "physics" ? new Set(["shared", "physics"]) :
    goal === "datascience" ? new Set(["shared", "datascience"]) :
    goal === "hybrid" ? new Set(["shared", "physics", "datascience", "hybrid"]) :
    new Set(["shared", "physics", "datascience", "hybrid"]);
  return REGISTRY.filter((e) => allowedDomains.has(e.domain));
}

/* ── BLOCK_CATALOGUE (search index) — built from registry ── */
export const BLOCK_CATALOGUE = REGISTRY.map((e) => ({
  type: e.id,
  label: e.conceptLabel,
  category: e.category,
  keywords: e.keywords || [],
  domain: e.domain,
}));

/* ── Helpers for the CI duplication check ──────────────────── */
export function findDuplicateIds() {
  const seen = new Map();
  const dups = [];
  for (const entry of REGISTRY) {
    const prev = seen.get(entry.id);
    if (prev) dups.push({ id: entry.id, first: prev, second: entry });
    else seen.set(entry.id, entry);
  }
  return dups;
}

export function findUnknownIds(ids) {
  return ids.filter((id) => !BY_ID.has(id));
}
