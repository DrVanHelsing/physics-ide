import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BUILT_IN_RULE_SETS, WorkspaceRulesSchema } from "@physics-ide/shared";
import { api } from "../../utils/api/client";

/** Spec §5.4's field order, straight from the shared schema — not a
 *  hand-copied list that could drift out of sync with it. */
const RULE_FIELDS = Object.keys(WorkspaceRulesSchema.shape);

const PRESETS = [
  ["open_practice", "Open practice"],
  ["standard_classwork", "Standard classwork"],
  ["locked_assessment", "Locked assessment"],
];

const EDITOR_OPTIONS = [
  ["blocks", "Blocks"],
  ["code", "Code"],
  ["both", "Both"],
];

/** The five boolean switches (Editors is the three-way select above them) —
 *  spec §5.4's exact words. */
const SWITCHES = [
  ["debug", "Debugging"],
  ["importFiles", "Import"],
  ["exportAndCopy", "Export & copy"],
  ["advancedBlocks", "Advanced blocks"],
  ["templates", "Templates"],
];

function sameRules(a, b) {
  if (!a || !b) return false;
  return RULE_FIELDS.every((k) => a[k] === b[k]);
}

/**
 * `<RulesPicker value={rules} onChange={fn} />` — spec §5.4. A radio set
 * over the three built-in presets plus the teacher's saved custom sets,
 * with "Custom…" revealing the six switches (seeded from `value`, not
 * reset) and a "Save as…" row to persist the current combination.
 *
 * Fully controlled: this component holds no copy of `rules` itself. Which
 * radio reads as selected is *derived* from `value` every render (matched
 * against the built-ins and the saved sets by field-for-field equality) —
 * except while the teacher is actively customizing, tracked by the one bit
 * of local state (`manualSelection`) that pins the view on "Custom…" even
 * if the edited value happens to coincide with some other preset.
 */
export default function RulesPicker({ value, onChange }) {
  const qc = useQueryClient();
  const savedQuery = useQuery({ queryKey: ["rule-sets"], queryFn: () => api("/api/rule-sets") });
  const savedSets = savedQuery.data?.ruleSets ?? [];

  const [manualSelection, setManualSelection] = useState(null); // null = derive from value
  const [name, setName] = useState("");

  const save = useMutation({
    mutationFn: (body) => api("/api/rule-sets", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rule-sets"] });
      setName("");
    },
  });
  const removeSet = useMutation({
    mutationFn: (id) => api(`/api/rule-sets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rule-sets"] }),
  });

  const matchedSaved = savedSets.find((s) => sameRules(s.rules, value));
  const matchedPreset = PRESETS.find(([key]) => sameRules(BUILT_IN_RULE_SETS[key], value));
  const derivedKey = matchedSaved ? `saved:${matchedSaved.id}` : matchedPreset ? matchedPreset[0] : "custom";
  const selectedKey = manualSelection ?? derivedKey;
  const customOpen = selectedKey === "custom";

  function choose(rules) {
    setManualSelection(null);
    onChange(rules);
  }

  function updateField(key, fieldValue) {
    onChange({ ...value, [key]: fieldValue });
  }

  function doorClass(key) {
    return selectedKey === key ? "auth-door auth-door--on" : "auth-door";
  }

  return (
    <div className="rules-picker">
      <div className="auth-doors" role="radiogroup" aria-label="Workspace rules">
        {PRESETS.map(([key, label]) => (
          <label key={key} className={doorClass(key)}>
            <input
              type="radio"
              name="rulesPreset"
              checked={selectedKey === key}
              onChange={() => choose(BUILT_IN_RULE_SETS[key])}
            />
            {label}
          </label>
        ))}
        <label className={doorClass("custom")}>
          <input
            type="radio"
            name="rulesPreset"
            checked={customOpen}
            onChange={() => setManualSelection("custom")}
          />
          Custom…
        </label>
      </div>

      {savedSets.length > 0 ? (
        <div className="rules-saved-sets">
          {savedSets.map((s) => {
            const key = `saved:${s.id}`;
            return (
              <div key={s.id} className="rules-saved-row">
                <label className={doorClass(key)}>
                  <input
                    type="radio"
                    name="rulesPreset"
                    checked={selectedKey === key}
                    onChange={() => choose(s.rules)}
                  />
                  {s.name}
                </label>
                <button
                  className="btn btn--danger btn--sm"
                  type="button"
                  onClick={() => removeSet.mutate(s.id)}
                  disabled={removeSet.isPending}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {customOpen ? (
        <div className="rules-switches">
          <label className="auth-label">
            Editors
            <select
              className="input"
              value={value.editors}
              onChange={(e) => updateField("editors", e.target.value)}
            >
              {EDITOR_OPTIONS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {SWITCHES.map(([key, label]) => (
            <label key={key} className="auth-consent">
              <input
                type="checkbox"
                checked={!!value[key]}
                onChange={(e) => updateField(key, e.target.checked)}
              />
              {label}
            </label>
          ))}

          <div className="rules-save-as">
            <input
              className="input"
              placeholder="Name this rule set…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="btn"
              type="button"
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate({ name: name.trim(), rules: value })}
            >
              Save as…
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
