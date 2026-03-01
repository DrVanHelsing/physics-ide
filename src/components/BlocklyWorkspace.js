import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  defineCustomBlocksAndGenerator,
  generatePythonFromWorkspace,
  BLOCK_CATALOGUE,
} from "../utils/blocklyGenerator";
import { SearchIcon } from "./Icons";
import * as dialogService from "../utils/dialogService";

/* ── Toolbox XML ─────────────────────────────────────────────
   Custom VPython blocks are defined in blocklyGenerator.js.
   Standard Blockly categories (Logic, Loops, Math, Text,
   Variables, Functions) come from blocks_compressed.js.
   ──────────────────────────────────────────────────────────── */
const TOOLBOX_XML = `
<xml>  <!-- ── 🚀 STARTER ──────────────────────────────────────── -->
  <category name="\uD83D\uDE80 Starter" colour="#5cb85c">
    <label text="Quick create objects" web-class="tb-label"></label>
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
    <sep gap="12"></sep>    <label text="Define a named constant" web-class="tb-label"></label>
    <block type="define_const_block">
      <value name="VALUE"><shadow type="physics_const_block"><field name="CONST">g</field></shadow></value>
    </block>
    <block type="define_const_block">
      <field name="NAME">MASS</field>
      <value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
    </block>
    <sep gap="8"></sep>    <label text="Physics constants" web-class="tb-label"></label>
    <block type="physics_const_block"></block>
    <sep gap="12"></sep>
    <label text="Initial velocity" web-class="tb-label"></label>
    <block type="set_velocity_block">
      <value name="VEL"><shadow type="vector_block"><field name="X">5</field><field name="Y">5</field><field name="Z">0</field></shadow></value>
    </block>
    <sep gap="12"></sep>
    <label text="Simulation setup" web-class="tb-label"></label>
    <block type="set_gravity_block"></block>
    <block type="time_step_block"></block>
    <sep gap="12"></sep>
    <label text="Main loop" web-class="tb-label"></label>
    <block type="forever_loop_block"></block>
    <block type="rate_block"></block>
    <block type="update_position_block">
      <value name="DT"><shadow type="expr_block"><field name="EXPR">dt</field></shadow></value>
    </block>
    <block type="apply_force_block">
      <value name="ACCEL"><shadow type="vector_block"><field name="X">0</field><field name="Y">-9.81</field><field name="Z">0</field></shadow></value>
      <value name="DT"><shadow type="expr_block"><field name="EXPR">dt</field></shadow></value>
    </block>
    <sep gap="12"></sep>
    <label text="Conditions" web-class="tb-label"></label>
    <block type="if_block">
      <value name="COND"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
    <block type="if_else_block">
      <value name="COND"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
  </category>
  <!-- ── VALUES ─────────────────────────────────────────── -->
  <category name="Values" colour="#7c68c6">    <label text="Define constants" web-class="tb-label"></label>
    <block type="define_const_block">
      <value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
    </block>
    <sep gap="8"></sep>
    <label text="Physics constants" web-class="tb-label"></label>    <block type="physics_const_block"></block>
    <block type="vector_block"></block>
    <block type="colour_block"></block>
    <block type="expr_block"></block>
    <sep gap="12"></sep>
    <label text="Physics expressions" web-class="tb-label"></label>
    <block type="get_prop_block">
      <field name="OBJ">ball</field>
      <field name="PROP">velocity</field>
    </block>
    <block type="get_component_block">
      <field name="COMP">y</field>
      <value name="VEC">
        <shadow type="get_prop_block">
          <field name="OBJ">ball</field>
          <field name="PROP">pos</field>
        </shadow>
      </value>
    </block>
    <block type="mag_block">
      <value name="VEC">
        <shadow type="get_prop_block">
          <field name="OBJ">ball</field>
          <field name="PROP">velocity</field>
        </shadow>
      </value>
    </block>
    <block type="norm_block">
      <value name="VEC">
        <shadow type="get_prop_block">
          <field name="OBJ">ball</field>
          <field name="PROP">pos</field>
        </shadow>
      </value>
    </block>
  </category>

  <!-- ── OBJECTS ────────────────────────────────────────── -->
  <category name="Objects" colour="#4a90d9">
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
    <block type="box_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="SIZE"><shadow type="vector_block"><field name="X">1</field><field name="Y">1</field><field name="Z">1</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#4444ff</field></shadow></value>
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
  </category>

  <!-- ── MOTION ─────────────────────────────────────────── -->
  <category name="Motion" colour="#d9a54a">
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
  </category>

  <!-- ── STATE ──────────────────────────────────────────── -->
  <category name="State" colour="#d06030">
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
      <value name="V1"><shadow type="get_prop_block"><field name="OBJ">ball</field><field name="PROP">pos</field></shadow></value>
      <value name="V2"><shadow type="get_prop_block"><field name="OBJ">ball</field><field name="PROP">velocity</field></shadow></value>
    </block>
  </category>

  <!-- ── CONTROL ────────────────────────────────────────── -->
  <category name="Control" colour="#9b59b6">
    <block type="time_step_block"></block>
    <block type="rate_block"></block>
    <block type="forever_loop_block"></block>
    <block type="for_range_block"></block>
    <block type="if_block">
      <value name="COND">
        <shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow>
      </value>
    </block>
    <block type="if_else_block">
      <value name="COND">
        <shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow>
      </value>
    </block>
    <block type="break_loop_block"></block>
    <block type="comment_block"></block>
  </category>

  <!-- ── ADVANCED ───────────────────────────────────────── -->
  <category name="Advanced" colour="#d35400">
    <block type="python_raw_block"></block>
    <block type="python_raw_expr_block"></block>
  </category>

  <sep gap="32"></sep>

  <!-- ── LOGIC (standard Blockly) ──────────────────────── -->
  <category name="Logic" colour="#5b80a5">
    <block type="logic_compare"></block>
    <block type="logic_operation"></block>
    <block type="logic_negate"></block>
    <block type="logic_boolean"></block>
    <block type="logic_null"></block>
    <block type="logic_ternary"></block>
  </category>

  <!-- ── LOOPS (standard Blockly) ──────────────────────── -->
  <category name="Loops" colour="#5ba55b">
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

  <!-- ── MATH ───────────────────────────────────────────── -->
  <category name="Math" colour="#5b67a5">
    <block type="math_number"></block>
    <block type="math_arithmetic"></block>
    <block type="math_single"></block>
    <block type="math_trig"></block>
    <block type="math_constant"></block>
    <block type="math_number_property"></block>
    <block type="math_round"></block>
    <block type="math_on_list"></block>
    <block type="math_modulo"></block>
    <block type="math_constrain">
      <value name="LOW"><block type="math_number"><field name="NUM">1</field></block></value>
      <value name="HIGH"><block type="math_number"><field name="NUM">100</field></block></value>
    </block>
    <block type="math_random_int">
      <value name="FROM"><block type="math_number"><field name="NUM">1</field></block></value>
      <value name="TO"><block type="math_number"><field name="NUM">100</field></block></value>
    </block>
    <block type="math_random_float"></block>
  </category>

  <!-- ── TEXT ───────────────────────────────────────────── -->
  <category name="Text" colour="#5ba58c">
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

  <!-- ── LISTS ──────────────────────────────────────────── -->
  <category name="Lists" colour="#745ba5">
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

  <category name="Variables" colour="#a55b80" custom="VARIABLE"></category>
  <category name="Functions" colour="#995ba5" custom="PROCEDURE"></category>
</xml>`;
/* ── Beginner toolbox (simplified — essential blocks only) ── */
const TOOLBOX_BEGINNER_XML = `
<xml>
  <!-- Beginner mode: Starter + simplified categories -->
  <category name="\uD83D\uDE80 Starter" colour="#5cb85c">
    <label text="Quick create objects" web-class="tb-label"></label>
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
    <sep gap="12"></sep>
    <label text="Define a named constant" web-class="tb-label"></label>
    <block type="define_const_block">
      <value name="VALUE"><shadow type="physics_const_block"><field name="CONST">g</field></shadow></value>
    </block>
    <block type="define_const_block">
      <field name="NAME">MASS</field>
      <value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
    </block>
    <sep gap="8"></sep>
    <label text="Physics constants" web-class="tb-label"></label>
    <block type="physics_const_block"></block>
    <sep gap="12"></sep>
    <label text="Initial velocity" web-class="tb-label"></label>
    <block type="set_velocity_block">
      <value name="VEL"><shadow type="vector_block"><field name="X">5</field><field name="Y">5</field><field name="Z">0</field></shadow></value>
    </block>
    <sep gap="12"></sep>
    <label text="Simulation setup" web-class="tb-label"></label>
    <block type="set_gravity_block"></block>
    <block type="time_step_block"></block>
    <sep gap="12"></sep>
    <label text="Main loop" web-class="tb-label"></label>
    <block type="forever_loop_block"></block>
    <block type="rate_block"></block>
    <block type="update_position_block">
      <value name="DT"><shadow type="expr_block"><field name="EXPR">dt</field></shadow></value>
    </block>
    <block type="apply_force_block">
      <value name="ACCEL"><shadow type="vector_block"><field name="X">0</field><field name="Y">-9.81</field><field name="Z">0</field></shadow></value>
      <value name="DT"><shadow type="expr_block"><field name="EXPR">dt</field></shadow></value>
    </block>
    <sep gap="12"></sep>
    <label text="Conditions" web-class="tb-label"></label>
    <block type="if_block">
      <value name="COND"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
    <block type="if_else_block">
      <value name="COND"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
  </category>

  <category name="Values" colour="#7c68c6">
    <block type="define_const_block">
      <value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
    </block>
    <block type="physics_const_block"></block>
    <block type="vector_block"></block>
    <block type="colour_block"></block>
  </category>

  <category name="Objects" colour="#4a90d9">
    <block type="preset_sphere_block">
      <field name="NAME">ball</field><field name="X">0</field><field name="Y">0</field><field name="Z">0</field><field name="R">1</field><field name="COL">#ff4444</field>
    </block>
    <block type="preset_box_block">
      <field name="NAME">wall</field><field name="X">0</field><field name="Y">-1</field><field name="Z">0</field><field name="W">10</field><field name="H">0.5</field><field name="D">10</field><field name="COL">#336633</field>
    </block>
    <block type="arrow_block">
      <value name="POS"><shadow type="vector_block"><field name="X">0</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="AXIS"><shadow type="vector_block"><field name="X">1</field><field name="Y">0</field><field name="Z">0</field></shadow></value>
      <value name="COL"><shadow type="colour_block"><field name="MODE">CUSTOM</field><field name="CUSTOM">#ffff00</field></shadow></value>
    </block>
  </category>

  <category name="Motion" colour="#d9a54a">
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
  </category>

  <category name="Control" colour="#9b59b6">
    <block type="time_step_block"></block>
    <block type="rate_block"></block>
    <block type="forever_loop_block"></block>
    <block type="if_block">
      <value name="COND"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
    <block type="if_else_block">
      <value name="COND"><shadow type="logic_boolean"><field name="BOOL">TRUE</field></shadow></value>
    </block>
  </category>

  <category name="Logic" colour="#5b80a5">
    <block type="logic_compare"></block>
    <block type="logic_operation"></block>
    <block type="logic_boolean"></block>
  </category>

  <category name="Math" colour="#5b67a5">
    <block type="math_number"></block>
    <block type="math_arithmetic"></block>
    <block type="math_single"></block>
    <block type="math_trig"></block>
  </category>

  <category name="Variables" colour="#a55b80" custom="VARIABLE"></category>
</xml>`;

/* ── Block search bar component ────────────────────────── */
function BlockSearch({ workspaceRef }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const seen = new Set();
    return BLOCK_CATALOGUE.filter(item => {
      if (seen.has(item.type + item.category)) return false;
      const match =
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords.some(k => k.includes(q));
      if (match) seen.add(item.type + item.category);
      return match;
    }).slice(0, 12);
  }, [query]);

  function openCategory(catName) {
    try {
      const ws = workspaceRef.current;
      if (!ws) return;
      const toolbox = ws.getToolbox();
      if (!toolbox) return;
      const clean = catName.replace(/^\uD83D\uDE80\s*/, "");
      if (toolbox.selectCategoryByName) {
        toolbox.selectCategoryByName(catName) ||
          toolbox.selectCategoryByName(clean);
        return;
      }
      const items = toolbox.getToolboxItems ? toolbox.getToolboxItems() : [];
      const match = items.find(
        i => i.getName && (i.getName() === catName || i.getName() === clean)
      );
      if (match) {
        if (toolbox.selectItem_) toolbox.selectItem_(match, true);
        else if (match.setSelected) match.setSelected(true);
      }
    } catch (e) { /* ignore toolbox API differences */ }
  }

  return (
    <div className="block-search">
      <div className="block-search-bar">
        <SearchIcon size={12} />
        <input
          type="text"
          className="block-search-input"
          placeholder="Search blocks\u2026"
          value={query}
          spellCheck={false}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
        />
        {query && (
          <button className="block-search-clear" onClick={() => setQuery("")} tabIndex={-1}>&times;</button>
        )}
      </div>
      {open && query && (
        <div className="block-search-dropdown">
          {results.length > 0
            ? results.map(item => (
                <button
                  key={item.type + item.category}
                  className="block-search-item"
                  onMouseDown={() => { openCategory(item.category); setQuery(""); setOpen(false); }}
                >
                  <span className="block-search-item-label">{item.label}</span>
                  <span className="block-search-item-cat">{item.category}</span>
                </button>
              ))
            : <div className="block-search-empty">No blocks match "{query}"</div>
          }
        </div>
      )}
    </div>
  );
}
/* ── Dark / Light Blockly themes ─────────────────────────── */
function buildBlocklyTheme(Blockly, isDark) {
  if (isDark) {
    return Blockly.Theme.defineTheme("physics-dark", {
      name: "physics-dark",
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: "#1a1b2e",
        toolboxBackgroundColour: "#141521",
        toolboxForegroundColour: "#c8cad8",
        flyoutBackgroundColour: "#1a1b2e",
        flyoutForegroundColour: "#c8cad8",
        flyoutOpacity: 0.96,
        scrollbarColour: "#3b3d56",
        scrollbarOpacity: 0.55,
        insertionMarkerColour: "#7aa2f7",
        insertionMarkerOpacity: 0.4,
        cursorColour: "#f5e0dc",
      },
      fontStyle: {
        family: "'Inter', 'Segoe UI', system-ui, sans-serif",
        weight: "500",
        size: 11,
      },
    });
  }

  return Blockly.Theme.defineTheme("physics-light", {
    name: "physics-light",
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: "#f5f5f8",
      toolboxBackgroundColour: "#eaecf0",
      toolboxForegroundColour: "#333",
      flyoutBackgroundColour: "#f5f5f8",
      flyoutForegroundColour: "#333",
      flyoutOpacity: 0.96,
      scrollbarColour: "#c0c2cc",
      scrollbarOpacity: 0.55,
      insertionMarkerColour: "#3b82f6",
      insertionMarkerOpacity: 0.4,
      cursorColour: "#333",
    },
    fontStyle: {
      family: "'Inter', 'Segoe UI', system-ui, sans-serif",
      weight: "500",
      size: 11,
    },
  });
}

function BlocklyWorkspace({ initialXml, onWorkspaceReady, onWorkspaceChange, isDark, beginnerMode = false }) {
  const hostRef = useRef(null);
  const workspaceRef = useRef(null);
  const [loadError, setLoadError] = useState("");

  const onReadyRef = useRef(onWorkspaceReady);
  const onChangeRef = useRef(onWorkspaceChange);
  const initialXmlRef = useRef(initialXml);
  onReadyRef.current = onWorkspaceReady;
  onChangeRef.current = onWorkspaceChange;

  /* ── One-time workspace setup ──────────────────────────── */
  useEffect(() => {
    const Blockly = window.Blockly;
    if (!Blockly) {
      setLoadError("Blockly failed to load. Check your network / CDN access.");
      return undefined;
    }

    defineCustomBlocksAndGenerator(Blockly);

    const theme = buildBlocklyTheme(Blockly, true);

    // Blockly v11 uses a callback-based dialog API. Route through our
    // dialogService so the custom VariableDialog component handles these.
    if (Blockly.dialog) {
      if (Blockly.dialog.setPrompt) {
        Blockly.dialog.setPrompt((msg, defaultVal, callback) => {
          dialogService.prompt(msg, defaultVal).then(callback);
        });
      }
      if (Blockly.dialog.setAlert) {
        Blockly.dialog.setAlert((msg, callback) => {
          dialogService.alert(msg).then(() => { if (callback) callback(); });
        });
      }
      if (Blockly.dialog.setConfirm) {
        Blockly.dialog.setConfirm((msg, callback) => {
          dialogService.confirm(msg).then(callback);
        });
      }
    }

    const workspace = Blockly.inject(hostRef.current, {
      toolbox: TOOLBOX_XML,
      theme,
      comments: true,
      trashcan: true,
      scrollbars: true,
      sounds: false,
      grid: { spacing: 25, length: 3, colour: "#2a2c40", snap: true },
      zoom: {
        controls: false,
        wheel: true,
        startScale: 0.9,
        maxScale: 2,
        minScale: 0.35,
        scaleSpeed: 1.1,
      },
      renderer: "zelos",
    });

    workspaceRef.current = workspace;
    onReadyRef.current(workspace);

    // Restore saved XML
    const xml = initialXmlRef.current;
    if (xml) {
      try {
        const dom = Blockly.utils.xml.textToDom(xml);
        Blockly.Xml.domToWorkspace(dom, workspace);
      } catch (err) {
        console.warn("Could not restore Blockly XML:", err);
      }
    }

    // Emit changes
    const listener = (event) => {
      if (
        event.type === Blockly.Events.UI ||
        event.type === Blockly.Events.VIEWPORT_CHANGE
      ) {
        return;
      }
      const dom = Blockly.Xml.workspaceToDom(workspace);
      const xmlText = Blockly.Xml.domToText(dom);
      const code = generatePythonFromWorkspace(workspace);
      onChangeRef.current(xmlText, code);
    };
    workspace.addChangeListener(listener);

    return () => {
      workspace.removeChangeListener(listener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, []);

  /* ── Switch toolbox when beginner mode toggles ─────────── */
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    try {
      ws.updateToolbox(beginnerMode ? TOOLBOX_BEGINNER_XML : TOOLBOX_XML);
    } catch (e) {
      console.warn("BlocklyWorkspace: could not switch toolbox", e);
    }
  }, [beginnerMode]);

  /* ── React to theme changes ────────────────────────────── */
  useEffect(() => {
    const ws = workspaceRef.current;
    const Blockly = window.Blockly;
    if (!ws || !Blockly) return;
    const theme = buildBlocklyTheme(Blockly, isDark);
    ws.setTheme(theme);

    // Update grid colour
    const gridColour = isDark ? "#2a2c40" : "#ddd";
    const svgGrid = ws.getParentSvg()?.querySelector(".blocklyGridPattern line");
    if (svgGrid) svgGrid.setAttribute("stroke", gridColour);
  }, [isDark]);

  if (loadError) {
    return <div className="fallback-panel">{loadError}</div>;
  }

  return (
    <div className="blockly-workspace-wrapper">
      <BlockSearch workspaceRef={workspaceRef} />
      <div ref={hostRef} className="blockly-host" />
    </div>
  );
}

/* ── Read-only Blockly (for showing block reference alongside code) ── */
function ReadOnlyBlockly({ xml, isDark }) {
  const hostRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const Blockly = window.Blockly;
    if (!Blockly || !hostRef.current) return undefined;

    defineCustomBlocksAndGenerator(Blockly);
    const theme = buildBlocklyTheme(Blockly, isDark);

    const ws = Blockly.inject(hostRef.current, {
      readOnly: true,
      theme,
      scrollbars: true,
      renderer: "zelos",
      sounds: false,
      grid: { spacing: 25, length: 3, colour: isDark ? "#2a2c40" : "#ddd", snap: false },
      zoom: { controls: false, wheel: true, startScale: 0.65, maxScale: 2, minScale: 0.15, scaleSpeed: 1.1 },
    });
    wsRef.current = ws;

    if (xml) {
      try {
        const dom = Blockly.utils.xml.textToDom(xml);
        Blockly.Xml.domToWorkspace(dom, ws);
      } catch (e) {
        console.warn("ReadOnlyBlockly: could not load XML", e);
      }
    }

    return () => {
      ws.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml]);

  useEffect(() => {
    const ws = wsRef.current;
    const Blockly = window.Blockly;
    if (!ws || !Blockly) return;
    const theme = buildBlocklyTheme(Blockly, isDark);
    ws.setTheme(theme);
  }, [isDark]);

  return <div ref={hostRef} className="blockly-host blockly-readonly" />;
}

export default BlocklyWorkspace;
export { ReadOnlyBlockly };

