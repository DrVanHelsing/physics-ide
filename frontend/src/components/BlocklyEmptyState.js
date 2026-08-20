import React from "react";
import BeginnerGuide from "./BeginnerGuide";
import { AtomIcon, SpringIcon, GlobeIcon, TableIcon } from "./Icons";

/**
 * Shown over an empty block canvas. One line of guidance plus starter chips
 * that inject real block XML — the fastest path from "blank grid" to "there is
 * a sphere on my screen". Hidden the moment a block lands.
 *
 * pointer-events are off on the layer and back on for the chips, so a student
 * can still drag from the flyout straight through it.
 */
const CHIPS = {
  physics: [
    {
      id: "sphere",
      label: "A ball that falls",
      icon: AtomIcon,
      xml:
        '<block type="sphere_block">' +
        '<field name="NAME">ball</field>' +
        "</block>",
    },
    {
      id: "loop",
      label: "An animation loop",
      icon: SpringIcon,
      xml: '<block type="forever_loop_block"><statement name="BODY"><block type="rate_block"><field name="N">100</field></block></statement></block>',
    },
    {
      id: "gravity",
      label: "Gravity",
      icon: GlobeIcon,
      xml: '<block type="physics_const_block"><field name="CONST">g</field></block>',
    },
  ],
  datascience: [
    { id: "load", label: "Load a dataset", icon: TableIcon, xml: '<block type="ds_load_builtin_block"><field name="ID">penguins</field></block>' },
    { id: "table", label: "Show the table", icon: TableIcon, xml: '<block type="ds_show_table_block"></block>' },
  ],
};

export default function BlocklyEmptyState({ goal = "physics", onInsert, checkpointState, onDismissTip }) {
  const chips = CHIPS[goal] || CHIPS.physics;
  return (
    <div className="blockly-empty" aria-live="polite">
      <div className="blockly-empty__inner">
        <p className="blockly-empty__lead">
          Drag a block from the toolbox on the left — or start with one of these.
        </p>
        <div className="blockly-empty__chips">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="blockly-empty__chip"
              onClick={() => onInsert?.(chip.xml)}
              title={`Add: ${chip.label}`}
            >
              <chip.icon size={14} />
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
        <BeginnerGuide goal={goal} checkpointState={checkpointState} onDismiss={onDismissTip} />
      </div>
    </div>
  );
}
