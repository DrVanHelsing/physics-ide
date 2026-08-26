/**
 * RulesChip — spec §5.4's workspace-rules note.
 *
 * Inside an assignment, the workspace follows the teacher's rules; students
 * "always see a small note ... listing anything that's switched off —
 * rules are visible, never silent." This is that note: a small
 * `.sync-chip`-shaped status-bar readout (mounted right after `<SaveState
 * />`, see IDELayout.js — the recorded deviation D§4 from the spec's prose,
 * which puts it in the header's collapsing view zone instead).
 *
 * - No assignment context (free project, or nothing open yet): renders
 *   nothing.
 * - Something is switched off: "Your teacher has turned off: <list>",
 *   built from the rules object's false switches plus a non-"both" editors
 *   restriction ("blocks only" / "code only").
 * - Nothing off: "Assignment: <title>" — so a student inside assignment
 *   work always knows it, even under Open practice.
 *
 * `role="status" aria-live="polite"` so a screen reader hears it when the
 * rules change (a teacher can edit them after publishing). The full
 * sentence always lives on `title`; the visible text may shorten under CSS
 * ellipsis as the status bar narrows, but the element itself must never
 * unmount (delta S4) — a student who can't see the note can't know where
 * the edges are.
 */
import React from "react";
import { WorkspaceRulesSchema } from "@physics-ide/shared";
import { useAssignmentContext } from "../../contexts/AssignmentContext";

/** Field order straight from the shared schema (spec §5.4) — the same
 *  precedent RulesPicker.js sets for "not a hand-copied list that could
 *  drift out of sync with it". */
const RULE_FIELDS = Object.keys(WorkspaceRulesSchema.shape);

/** Spec §5.4's own vocabulary for each boolean switch, lowercased to read
 *  as a sentence fragment. */
const SWITCH_LABELS = {
  debug: "debug mode",
  importFiles: "import",
  exportAndCopy: "export & copy",
  advancedBlocks: "advanced blocks",
  templates: "templates",
};

function offList(rules) {
  if (!rules) return [];
  const items = [];
  for (const key of RULE_FIELDS) {
    if (key === "editors") {
      if (rules.editors !== "both") {
        items.push(rules.editors === "blocks" ? "blocks only" : "code only");
      }
      continue;
    }
    if (rules[key] === false) items.push(SWITCH_LABELS[key]);
  }
  return items;
}

export default function RulesChip() {
  const ctx = useAssignmentContext();
  if (!ctx) return null;

  const off = offList(ctx.rules);
  const sentence =
    off.length > 0
      ? `Your teacher has turned off: ${off.join(", ")}`
      : `Assignment: ${ctx.title}`;

  return (
    <span className="sync-chip rules-chip" role="status" aria-live="polite" title={sentence}>
      <span className="rules-chip__text">{sentence}</span>
    </span>
  );
}
