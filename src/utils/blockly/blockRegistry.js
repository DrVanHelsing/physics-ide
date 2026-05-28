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
 *     keywords, beginnerVisible}.
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
 */

/* eslint-disable max-lines */

const REGISTRY = [
  /* ── Starter / Simulation structure (physics) ─────────────── */
  { id: "sim_start_block", category: "Starter", domain: "physics",
    conceptLabel: "Simulation Start", beginnerVisible: true,
    keywords: ["start", "begin", "simulation", "setup", "init"] },
  { id: "sim_end_block", category: "Starter", domain: "physics",
    conceptLabel: "Simulation End", beginnerVisible: true,
    keywords: ["end", "stop", "finish", "simulation", "complete"] },

  /* ── Values (physics-flavoured but used inside loops too) ── */
  { id: "define_const_block", category: "Values", domain: "physics",
    conceptLabel: "Define constant", beginnerVisible: true,
    keywords: ["constant", "define", "const", "mass", "named", "reuse"] },
  { id: "physics_const_block", category: "Values", domain: "physics",
    conceptLabel: "Physics constant (g, G, π…)", beginnerVisible: false,
    keywords: ["constant", "g", "G", "pi", "c", "h", "m_e", "m_p"] },
  { id: "vector_block", category: "Values", domain: "physics",
    conceptLabel: "Vector (x, y, z)", beginnerVisible: true,
    keywords: ["vector", "vec", "position", "velocity", "axis"] },
  { id: "colour_block", category: "Values", domain: "physics",
    conceptLabel: "Colour", beginnerVisible: true,
    keywords: ["colour", "color", "red", "blue", "green", "hue"] },
  { id: "expr_block", category: "Values", domain: "physics",
    conceptLabel: "Expression (any Python)", beginnerVisible: false,
    keywords: ["expression", "expr", "formula", "code", "custom"] },
  { id: "var_read_block", category: "Values", domain: "physics",
    conceptLabel: "Read variable", beginnerVisible: true,
    keywords: ["variable", "read", "var", "name", "value", "get"] },
  { id: "get_prop_block", category: "Values", domain: "physics",
    conceptLabel: "Object property (ball.pos)", beginnerVisible: true,
    keywords: ["property", "prop", "dot", "ball", "pos", "velocity", "radius"] },
  { id: "get_component_block", category: "Values", domain: "physics",
    conceptLabel: "Vector component .x .y .z", beginnerVisible: true,
    keywords: ["component", "x", "y", "z", "scalar"] },
  { id: "mag_block", category: "Values", domain: "physics",
    conceptLabel: "Magnitude mag(vec)", beginnerVisible: true,
    keywords: ["magnitude", "mag", "speed", "length", "scalar"] },
  { id: "norm_block", category: "Values", domain: "physics",
    conceptLabel: "Unit vector norm(vec)", beginnerVisible: false,
    keywords: ["normalise", "norm", "unit", "direction", "hat"] },
  { id: "set_colour_var_block", category: "Values", domain: "physics",
    conceptLabel: "Set colour variable", beginnerVisible: true,
    keywords: ["colour", "color", "variable", "set"] },

  /* ── Objects (physics) ────────────────────────────────────── */
  { id: "preset_sphere_block", category: "Objects", domain: "physics",
    conceptLabel: "Quick sphere / ball", beginnerVisible: true,
    keywords: ["sphere", "ball", "create", "quick", "object"] },
  { id: "preset_box_block", category: "Objects", domain: "physics",
    conceptLabel: "Quick box / wall / floor", beginnerVisible: true,
    keywords: ["box", "wall", "floor", "create", "quick", "object"] },
  { id: "sphere_block", category: "Objects", domain: "physics",
    conceptLabel: "Sphere", beginnerVisible: true,
    keywords: ["sphere", "ball", "circle", "round"] },
  { id: "sphere_trail_block", category: "Objects", domain: "physics",
    conceptLabel: "Sphere + trail", beginnerVisible: false,
    keywords: ["sphere", "trail", "track", "path", "particle"] },
  { id: "sphere_emissive_block", category: "Objects", domain: "physics",
    conceptLabel: "Glowing sphere", beginnerVisible: false,
    keywords: ["sphere", "glow", "emissive", "star", "sun", "light"] },
  { id: "box_block", category: "Objects", domain: "physics",
    conceptLabel: "Box", beginnerVisible: true,
    keywords: ["box", "cube", "wall", "floor", "ground", "rect"] },
  { id: "box_opacity_block", category: "Objects", domain: "physics",
    conceptLabel: "Box (transparent)", beginnerVisible: false,
    keywords: ["box", "opacity", "transparent", "glass", "semi"] },
  { id: "cylinder_block", category: "Objects", domain: "physics",
    conceptLabel: "Cylinder", beginnerVisible: true,
    keywords: ["cylinder", "rod", "pipe", "tube", "circle"] },
  { id: "arrow_block", category: "Objects", domain: "physics",
    conceptLabel: "Arrow", beginnerVisible: true,
    keywords: ["arrow", "vector", "force", "direction", "axis"] },
  { id: "helix_block", category: "Objects", domain: "physics",
    conceptLabel: "Helix / spring", beginnerVisible: true,
    keywords: ["helix", "spring", "coil", "spiral"] },
  { id: "helix_full_block", category: "Objects", domain: "physics",
    conceptLabel: "Helix (detailed)", beginnerVisible: false,
    keywords: ["helix", "spring", "coils", "thickness", "detailed"] },
  { id: "label_block", category: "Objects", domain: "physics",
    conceptLabel: "Text label", beginnerVisible: true,
    keywords: ["label", "text", "display", "print", "show"] },
  { id: "label_full_block", category: "Objects", domain: "physics",
    conceptLabel: "Live display label", beginnerVisible: false,
    keywords: ["label", "telemetry", "live", "display", "hud"] },
  { id: "local_light_block", category: "Objects", domain: "physics",
    conceptLabel: "Point light source", beginnerVisible: false,
    keywords: ["light", "lamp", "glow", "local", "point"] },

  /* ── Motion (physics) ─────────────────────────────────────── */
  { id: "set_velocity_block", category: "Motion", domain: "physics",
    conceptLabel: "Set velocity", beginnerVisible: true,
    keywords: ["velocity", "speed", "v", "motion", "initial", "set"] },
  { id: "update_position_block", category: "Motion", domain: "physics",
    conceptLabel: "Update position pos += v×dt", beginnerVisible: true,
    keywords: ["position", "pos", "move", "update", "euler"] },
  { id: "apply_force_block", category: "Motion", domain: "physics",
    conceptLabel: "Apply force v += a×dt", beginnerVisible: true,
    keywords: ["force", "velocity", "acceleration", "apply", "gravity"] },
  { id: "set_gravity_block", category: "Motion", domain: "physics",
    conceptLabel: "Gravity constant", beginnerVisible: true,
    keywords: ["gravity", "g", "9.81", "vector", "down"] },
  { id: "rotate_object_block", category: "Motion", domain: "physics",
    conceptLabel: "Rotate object (angle, axis)", beginnerVisible: false,
    keywords: ["rotate", "spin", "angle", "axis", "angular", "rotation"] },

  /* ── State (physics) ──────────────────────────────────────── */
  { id: "set_scalar_block", category: "State", domain: "physics",
    conceptLabel: "Set variable (x = …)", beginnerVisible: true,
    keywords: ["variable", "set", "assign", "scalar", "number"] },
  { id: "set_attr_expr_block", category: "State", domain: "physics",
    conceptLabel: "Set object attribute", beginnerVisible: true,
    keywords: ["set", "attribute", "property", "object", "dot"] },
  { id: "add_attr_expr_block", category: "State", domain: "physics",
    conceptLabel: "Add to attribute (+=)", beginnerVisible: true,
    keywords: ["add", "increment", "plus", "attribute", "update"] },
  { id: "telemetry_update_block", category: "State", domain: "physics",
    conceptLabel: "Live display update", beginnerVisible: true,
    keywords: ["telemetry", "display", "live", "update", "show", "hud"] },

  /* ── Control flow (shared) ────────────────────────────────── */
  { id: "time_step_block", category: "Control", domain: "physics",
    conceptLabel: "Time step dt", beginnerVisible: true,
    keywords: ["dt", "time", "step", "timestep"] },
  { id: "rate_block", category: "Control", domain: "physics",
    conceptLabel: "Rate (fps)", beginnerVisible: true,
    keywords: ["rate", "fps", "animation", "framerate"] },
  { id: "forever_loop_block", category: "Control", domain: "shared",
    conceptLabel: "Forever loop", beginnerVisible: true,
    keywords: ["loop", "forever", "while", "main", "simulation"] },
  { id: "for_range_block", category: "Control", domain: "shared",
    conceptLabel: "For loop (range)", beginnerVisible: true,
    keywords: ["for", "loop", "range", "repeat", "iterate", "i"] },
  { id: "if_block", category: "Control", domain: "shared",
    conceptLabel: "If condition", beginnerVisible: true,
    keywords: ["if", "condition", "when", "check"] },
  { id: "if_else_block", category: "Control", domain: "shared",
    conceptLabel: "If / Else", beginnerVisible: true,
    keywords: ["if", "else", "condition", "branch"] },
  { id: "break_loop_block", category: "Control", domain: "shared",
    conceptLabel: "Break loop", beginnerVisible: false,
    keywords: ["break", "stop", "exit", "end", "quit"] },
  { id: "comment_block", category: "Control", domain: "shared",
    conceptLabel: "Comment / note", beginnerVisible: true,
    keywords: ["comment", "note", "describe", "explain", "text"] },

  /* ── Advanced (shared escape hatch) ───────────────────────── */
  { id: "python_raw_block", category: "Advanced", domain: "shared",
    conceptLabel: "Raw Python code", beginnerVisible: false,
    keywords: ["python", "code", "raw", "custom", "advanced", "statement"] },
  { id: "python_raw_expr_block", category: "Advanced", domain: "shared",
    conceptLabel: "Raw Python expression", beginnerVisible: false,
    keywords: ["python", "expression", "raw", "custom", "advanced", "value"] },

  /* ── Logic (shared — including custom + stock Blockly) ───── */
  { id: "compare_block", category: "Logic", domain: "shared",
    conceptLabel: "Compare (< ≤ > ≥ = ≠)", beginnerVisible: true,
    keywords: ["compare", "less", "greater", "equal", "condition", "lt", "gt"] },
  { id: "logic_and_or_block", category: "Logic", domain: "shared",
    conceptLabel: "AND / OR", beginnerVisible: true,
    keywords: ["and", "or", "logic", "boolean", "both", "either", "combine"] },
  { id: "logic_not_block", category: "Logic", domain: "shared",
    conceptLabel: "NOT", beginnerVisible: true,
    keywords: ["not", "negate", "invert", "flip"] },
  { id: "logic_compare", category: "Logic", domain: "shared",
    conceptLabel: "Compare (stock)", beginnerVisible: false,
    keywords: ["compare", "less", "greater", "equal", "condition"] },
  { id: "logic_operation", category: "Logic", domain: "shared",
    conceptLabel: "AND / OR (stock)", beginnerVisible: false,
    keywords: ["and", "or", "logic", "boolean"] },
  { id: "logic_negate", category: "Logic", domain: "shared",
    conceptLabel: "NOT (stock)", beginnerVisible: false,
    keywords: ["not", "negate", "invert"] },
  { id: "logic_boolean", category: "Logic", domain: "shared",
    conceptLabel: "True / False", beginnerVisible: true,
    keywords: ["true", "false", "boolean"] },

  /* ── Math (shared, stock Blockly) ─────────────────────────── */
  { id: "math_number", category: "Math", domain: "shared",
    conceptLabel: "Number", beginnerVisible: true,
    keywords: ["number", "value", "digit", "constant", "scalar"] },
  { id: "math_arithmetic", category: "Math", domain: "shared",
    conceptLabel: "Maths (+ − × ÷)", beginnerVisible: true,
    keywords: ["add", "subtract", "multiply", "divide", "arithmetic"] },
  { id: "math_single", category: "Math", domain: "shared",
    conceptLabel: "Math function (sqrt, abs…)", beginnerVisible: true,
    keywords: ["sqrt", "abs", "square", "root", "power", "log"] },
  { id: "math_trig", category: "Math", domain: "shared",
    conceptLabel: "Trig (sin, cos, tan)", beginnerVisible: true,
    keywords: ["sin", "cos", "tan", "trig", "angle"] },
  { id: "math_constant", category: "Math", domain: "shared",
    conceptLabel: "Math constant (π, e, √2)", beginnerVisible: true,
    keywords: ["pi", "e", "constant", "phi", "golden"] },

  /* ── 3D Math (physics-flavoured) ──────────────────────────── */
  { id: "cross_product_block", category: "3D Math", domain: "physics",
    conceptLabel: "Cross product cross(a, b)", beginnerVisible: false,
    keywords: ["cross", "product", "perpendicular", "torque", "angular"] },
  { id: "dot_product_block", category: "3D Math", domain: "physics",
    conceptLabel: "Dot product dot(a, b)", beginnerVisible: false,
    keywords: ["dot", "product", "scalar", "work", "projection", "angle"] },
  { id: "math_trig_block", category: "3D Math", domain: "physics",
    conceptLabel: "Trig / math (sin, cos, radians…)", beginnerVisible: false,
    keywords: ["sin", "cos", "tan", "trig", "radians", "degrees"] },
  { id: "vector_compose_block", category: "3D Math", domain: "physics",
    conceptLabel: "Vector compose (x, y, z slots)", beginnerVisible: false,
    keywords: ["vector", "compose", "build", "dynamic", "expression"] },
  { id: "math_min_block", category: "3D Math", domain: "shared",
    conceptLabel: "Min min(a, b)", beginnerVisible: true,
    keywords: ["min", "minimum", "smaller", "clamp", "floor", "lower"] },
  { id: "math_max_block", category: "3D Math", domain: "shared",
    conceptLabel: "Max max(a, b)", beginnerVisible: true,
    keywords: ["max", "maximum", "larger", "clamp", "ceiling", "upper"] },
  { id: "math_pow_block", category: "3D Math", domain: "shared",
    conceptLabel: "Power a ** b", beginnerVisible: true,
    keywords: ["power", "exponent", "squared", "cubed", "square"] },
  { id: "math_clamp_block", category: "3D Math", domain: "shared",
    conceptLabel: "Clamp (val, lo, hi)", beginnerVisible: false,
    keywords: ["clamp", "constrain", "bound", "limit", "range", "between"] },

  /* ── Scene (physics) ──────────────────────────────────────── */
  { id: "scene_camera_block", category: "Scene", domain: "physics",
    conceptLabel: "Scene / camera (center, forward…)", beginnerVisible: false,
    keywords: ["scene", "camera", "forward", "up", "center", "range", "zoom", "view"] },

  /* ── Data Science (Phase C.3 vertical slice) ─────────────── */
  { id: "ds_load_builtin_block", category: "Data Science", domain: "datascience",
    conceptLabel: "Load built-in dataset", beginnerVisible: true,
    keywords: ["load", "dataset", "data", "planets", "penguins", "weather", "import", "builtin"] },
  { id: "ds_show_table_block", category: "Data Science", domain: "datascience",
    conceptLabel: "Show table", beginnerVisible: true,
    keywords: ["show", "table", "display", "view", "dataset", "rows", "columns"] },
  { id: "ds_calc_mean_block", category: "Data Science", domain: "datascience",
    conceptLabel: "Calculate mean", beginnerVisible: true,
    keywords: ["mean", "average", "statistics", "column", "compute", "calculate"] },
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

export function getBlocksForGoal(goal, { beginnerEnabled = false } = {}) {
  const allowedDomains =
    goal === "physics" ? new Set(["shared", "physics"]) :
    goal === "datascience" ? new Set(["shared", "datascience"]) :
    goal === "hybrid" ? new Set(["shared", "physics", "datascience", "hybrid"]) :
    new Set(["shared", "physics", "datascience", "hybrid"]);
  return REGISTRY.filter((e) => {
    if (!allowedDomains.has(e.domain)) return false;
    if (beginnerEnabled && !e.beginnerVisible) return false;
    return true;
  });
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
