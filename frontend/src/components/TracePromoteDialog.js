import React, { useMemo, useState } from "react";
import { XIcon, TableIcon, CheckIcon } from "./Icons";

/**
 * TracePromoteDialog — variable selection + time window for "save run as dataset".
 *
 * Props:
 *   recordBuffer: [{ t, name, value, delta, min, max }]
 *   onConfirm({ label, selectedVars, tMin, tMax }): void
 *   onCancel(): void
 */
export default function TracePromoteDialog({ recordBuffer, onConfirm, onCancel }) {
  const { varNames, tMinMs, tMaxMs } = useMemo(() => {
    const names = new Set();
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of recordBuffer) {
      names.add(r.name);
      if (r.t < lo) lo = r.t;
      if (r.t > hi) hi = r.t;
    }
    return {
      varNames: [...names].sort(),
      tMinMs: lo === Infinity ? 0 : lo,
      tMaxMs: hi === -Infinity ? 0 : hi,
    };
  }, [recordBuffer]);

  const durationSec = ((tMaxMs - tMinMs) / 1000).toFixed(2);

  const [label, setLabel] = useState(`Run @ ${new Date().toLocaleTimeString()}`);
  const [selected, setSelected] = useState(() => new Set(varNames));
  const [tFrom, setTFrom] = useState(0);
  const [tTo, setTTo] = useState(parseFloat(durationSec));

  const toggleVar = (name) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const canSubmit = selected.size > 0 && label.trim().length > 0;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm({
      label: label.trim(),
      selectedVars: [...selected],
      tMin: tMinMs + tFrom * 1000,
      tMax: tMinMs + tTo * 1000,
    });
  };

  return (
    <div className="trace-promote-overlay" role="dialog" aria-modal="true" aria-label="Save run as dataset">
      <div className="trace-promote-dialog">
        <div className="trace-promote-header">
          <span className="trace-promote-title"><TableIcon size={15} /> Save run as dataset</span>
          <button className="trace-promote-close" onClick={onCancel} aria-label="Close"><XIcon size={14} /></button>
        </div>

        <div className="trace-promote-body">
          <label className="trace-promote-field">
            <span>Dataset label</span>
            <input
              className="trace-promote-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Projectile run 1"
              autoFocus
            />
          </label>

          <div className="trace-promote-field">
            <span>Time window <em className="trace-promote-hint">(seconds from start, total {durationSec}s)</em></span>
            <div className="trace-promote-time-row">
              <label>
                From
                <input
                  type="number"
                  className="trace-promote-time-input"
                  value={tFrom}
                  min={0}
                  max={parseFloat(durationSec)}
                  step={0.1}
                  onChange={(e) => setTFrom(parseFloat(e.target.value) || 0)}
                />
                s
              </label>
              <label>
                To
                <input
                  type="number"
                  className="trace-promote-time-input"
                  value={tTo}
                  min={0}
                  max={parseFloat(durationSec)}
                  step={0.1}
                  onChange={(e) => setTTo(parseFloat(e.target.value) || 0)}
                />
                s
              </label>
            </div>
          </div>

          <div className="trace-promote-field">
            <span>Variables <em className="trace-promote-hint">({selected.size} of {varNames.length} selected)</em></span>
            <div className="trace-promote-vars">
              {varNames.map((name) => (
                <label key={name} className="trace-promote-var-row">
                  <input
                    type="checkbox"
                    checked={selected.has(name)}
                    onChange={() => toggleVar(name)}
                  />
                  <code className="trace-promote-var-name">{name}</code>
                </label>
              ))}
            </div>
          </div>

          <p className="trace-promote-rows-hint">
            {recordBuffer.length} raw records → dataset rows ≈ {Math.round(recordBuffer.length / Math.max(varNames.length, 1))}
          </p>
        </div>

        <div className="trace-promote-footer">
          <button className="trace-promote-cancel" onClick={onCancel}>Cancel</button>
          <button className="trace-promote-confirm" onClick={handleConfirm} disabled={!canSubmit}>
            <CheckIcon size={13} /> Save dataset
          </button>
        </div>
      </div>
    </div>
  );
}
