import React, { useEffect, useRef, useState, useCallback } from "react";

/* ── Truncate long values for display ─────────────────────── */
function truncate(str, max) {
  if (!str) return "";
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max) + "…";
}

/* ── Tiny sparkline SVG ────────────────────────────────────── */
function Sparkline({ history }) {
  if (!history || history.length < 2) return <span className="spark-empty" />;
  const nums = history.map((v) => parseFloat(v)).filter((n) => !isNaN(n));
  if (nums.length < 2) return <span className="spark-empty" />;
  const W = 56, H = 16;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const range = hi - lo || 1;
  const pts = nums.map((v, i) => {
    const x = (i / (nums.length - 1)) * (W - 2) + 1;
    const y = H - 1 - ((v - lo) / range) * (H - 4) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="spark-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle
        cx={parseFloat(pts[pts.length - 1].split(",")[0])}
        cy={parseFloat(pts[pts.length - 1].split(",")[1])}
        r="2"
        fill="var(--accent)"
      />
    </svg>
  );
}

/* ── Threshold check ──────────────────────────────────────── */
function checkAlert(alertConfig, currentValue) {
  if (!alertConfig || alertConfig.val === "") return false;
  const num = parseFloat(currentValue);
  const thresh = parseFloat(alertConfig.val);
  if (isNaN(num) || isNaN(thresh)) return false;
  if (alertConfig.op === ">") return num > thresh;
  if (alertConfig.op === "<") return num < thresh;
  if (alertConfig.op === "=") return Math.abs(num - thresh) < 1e-9;
  return false;
}

/* ── Inline threshold editor (sub-row) ───────────────────── */
function AlertEditRow({ name, alertConfig, onSave, onDelete, onCancel }) {
  const [op, setOp]   = useState(alertConfig?.op  ?? ">");
  const [val, setVal] = useState(alertConfig?.val ?? "");

  return (
    <tr className="trace-alert-edit-row">
      <td colSpan={5}>
        <div className="trace-alert-form">
          <span className="trace-alert-lbl">{name}</span>
          <select
            className="trace-alert-select"
            value={op}
            onChange={(e) => setOp(e.target.value)}
          >
            <option value=">">&gt;</option>
            <option value="<">&lt;</option>
            <option value="=">=</option>
          </select>
          <input
            className="trace-alert-input"
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="threshold"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && val !== "") onSave(name, op, val);
              if (e.key === "Escape") onCancel();
            }}
          />
          <button
            className="trace-alert-save"
            onClick={() => onSave(name, op, val)}
            disabled={val === ""}
          >
            ✓
          </button>
          {alertConfig && (
            <button className="trace-alert-del" onClick={() => onDelete(name)}>
              ✕
            </button>
          )}
          <button className="trace-icon-btn" style={{ marginLeft: "auto" }} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── Single data row ─────────────────────────────────────── */
function TraceRow({
  name, entry, pinned, flashKey, onHighlight, onPin,
  snapshotVal, alertConfig, isFiring, isEditing, onAlertEdit, onAlertSave, onAlertDelete,
}) {
  const rowRef  = useRef(null);
  const prevKey = useRef(flashKey);

  useEffect(() => {
    if (flashKey !== prevKey.current && rowRef.current) {
      prevKey.current = flashKey;
      const el = rowRef.current;
      el.classList.remove("trace-row--flash");
      void el.offsetHeight;
      el.classList.add("trace-row--flash");
      const id = setTimeout(() => el.classList.remove("trace-row--flash"), 700);
      return () => clearTimeout(id);
    }
  }, [flashKey]);

  const { value, count, blockId, delta, min, max } = entry;
  const isNumeric = delta !== null && delta !== undefined;
  const isActive  = count > 0;

  // Live delta display
  let deltaStr = null;
  let deltaClass = "trace-delta trace-delta--zero";
  if (isNumeric) {
    const d = parseFloat(delta);
    if (!isNaN(d)) {
      deltaStr   = d > 0 ? `+${d.toFixed(3)}` : d.toFixed(3);
      deltaClass = d > 0 ? "trace-delta trace-delta--pos"
                 : d < 0 ? "trace-delta trace-delta--neg"
                 :          "trace-delta trace-delta--zero";
    }
  }

  // Snapshot diff
  let snapDiffStr   = null;
  let snapDiffClass = "trace-snap-diff trace-snap-diff--zero";
  if (snapshotVal !== undefined && snapshotVal !== null) {
    const numCur  = parseFloat(value);
    const numSnap = parseFloat(snapshotVal);
    if (!isNaN(numCur) && !isNaN(numSnap)) {
      const d     = parseFloat((numCur - numSnap).toFixed(6));
      snapDiffStr = d > 0 ? `+${d.toFixed(3)}` : d.toFixed(3);
      snapDiffClass = d > 0 ? "trace-snap-diff trace-snap-diff--pos"
                    : d < 0 ? "trace-snap-diff trace-snap-diff--neg"
                    :          "trace-snap-diff trace-snap-diff--zero";
    } else {
      snapDiffStr   = value !== snapshotVal ? "≠" : "=";
      snapDiffClass = "trace-snap-diff trace-snap-diff--zero";
    }
  }

  const minStr  = min !== null && min !== undefined ? String(min).slice(0, 8) : null;
  const maxStr  = max !== null && max !== undefined ? String(max).slice(0, 8) : null;
  const tooltip = `Updates: ${count}${minStr ? ` · min: ${minStr} · max: ${maxStr}` : ""}`;

  const rowClass = [
    "trace-row",
    isActive  ? "trace-row--active"   : "",
    pinned    ? "trace-row--pinned"   : "",
    isFiring  ? "trace-row--alerting" : "",
  ].filter(Boolean).join(" ");

  return (
    <React.Fragment>
      <tr ref={rowRef} className={rowClass} title={tooltip}>
        {/* Pin */}
        <td className="trace-col trace-col--pin">
          <button
            className={`trace-pin-btn${pinned ? " trace-pin-btn--active" : ""}`}
            onClick={(e) => { e.stopPropagation(); onPin(name); }}
            title={pinned ? "Unpin" : "Pin to top"}
          >
            {pinned ? "★" : "☆"}
          </button>
        </td>

        {/* Name */}
        <td
          className="trace-col trace-col--name"
          onClick={() => onHighlight?.(blockId)}
          style={{ cursor: "pointer" }}
        >
          <span className="trace-varname">{name}</span>
        </td>

        {/* Value + live delta */}
        <td className="trace-col trace-col--value" title={value}>
          <div className="trace-value-cell">
            <span className="trace-value">{truncate(value, 14)}</span>
            {deltaStr && <span className={deltaClass}>{deltaStr}</span>}
          </div>
        </td>

        {/* Sparkline + min/max + snapshot diff */}
        <td className="trace-col trace-col--spark">
          <Sparkline history={entry.history} />
          {minStr && (
            <div className="trace-minmax">
              <span>{minStr}</span>
              <span className="trace-minmax-sep">–</span>
              <span>{maxStr}</span>
            </div>
          )}
          {snapshotVal !== undefined && (
            <div className="trace-snap-chip">
              <span className="trace-snap-val">⊡ {truncate(String(snapshotVal), 7)}</span>
              {snapDiffStr && <span className={snapDiffClass}>{snapDiffStr}</span>}
            </div>
          )}
        </td>

        {/* Alert bell */}
        <td className="trace-col trace-col--alert">
          <button
            className={[
              "trace-alert-btn",
              alertConfig  ? "trace-alert-btn--set"    : "",
              isFiring     ? "trace-alert-btn--firing" : "",
            ].filter(Boolean).join(" ")}
            onClick={(e) => { e.stopPropagation(); onAlertEdit(isEditing ? null : name); }}
            title={alertConfig ? `Alert ≡ ${alertConfig.op} ${alertConfig.val}` : "Set threshold alert"}
          >
            {isFiring ? "⚡" : "🔔"}
          </button>
        </td>
      </tr>

      {/* Inline threshold editor */}
      {isEditing && (
        <AlertEditRow
          name={name}
          alertConfig={alertConfig}
          onSave={onAlertSave}
          onDelete={onAlertDelete}
          onCancel={() => onAlertEdit(null)}
        />
      )}
    </React.Fragment>
  );
}

/* ── CSV export ────────────────────────────────────────────── */
function exportCsv(data) {
  const header = "variable,value,updates,min,max,delta\n";
  const rows = Array.from(data.entries()).map(
    ([name, e]) =>
      `"${name}","${e.value}",${e.count},${e.min ?? ""},${e.max ?? ""},${e.delta ?? ""}`
  );
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "trace_data.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Recording CSV export ─────────────────────────────────── */
function exportRecordingCsv(buffer) {
  const header = "timestamp_ms,variable,value,delta,min,max\n";
  const rows = buffer.map(
    (r) => `${r.t},"${r.name}","${r.value}",${r.delta ?? ""},${r.min ?? ""},${r.max ?? ""}`
  );
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "recording_" + Date.now() + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Main trace table ─────────────────────────────────────── */
function TraceTable({
  data, onHighlight, onClear,
  recording = false,
  onStartRecord,
  onStopRecord,
  recordBuffer = [],
}) {
  const [filter,       setFilter]       = useState("");
  const [pinned,       setPinned]       = useState(() => new Set());
  const [snapshot,     setSnapshot]     = useState(null);           // null | Map<name, string>
  const [alerts,       setAlerts]       = useState(() => new Map()); // Map<name, {op, val}>
  const [editingAlert, setEditingAlert] = useState(null);           // string | null

  /* Pin handling */
  const handlePin = useCallback((name) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Drop stale pins when data changes
  useEffect(() => {
    setPinned((prev) => {
      const keys = new Set(data.keys());
      const next = new Set([...prev].filter((k) => keys.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  /* Snapshot handling */
  const handleSnapshot = useCallback(() => {
    setSnapshot(new Map(Array.from(data.entries()).map(([n, e]) => [n, e.value])));
  }, [data]);
  const handleClearSnapshot = useCallback(() => setSnapshot(null), []);

  /* Alert handling */
  const handleAlertSave = useCallback((name, op, val) => {
    setAlerts((prev) => {
      const next = new Map(prev);
      next.set(name, { op, val });
      return next;
    });
    setEditingAlert(null);
  }, []);
  const handleAlertDelete = useCallback((name) => {
    setAlerts((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
    setEditingAlert(null);
  }, []);

  /* Count currently-firing alerts for the header badge */
  const firingCount = Array.from(data.entries()).filter(([name, entry]) => {
    const alert = alerts.get(name);
    return alert && checkAlert(alert, entry.value);
  }).length;

  /* Filter + sort */
  const filterLower = filter.toLowerCase();
  const allRows = Array.from(data.entries()).filter(
    ([name]) => !filterLower || name.toLowerCase().includes(filterLower)
  );
  const pinnedRows   = allRows.filter(([name]) => pinned.has(name));
  const unpinnedRows = allRows
    .filter(([name]) => !pinned.has(name))
    .sort(([aName, aVal], [bName, bVal]) => {
      const aC = aVal.count <= 1, bC = bVal.count <= 1;
      if (aC && !bC) return -1;
      if (!aC && bC) return 1;
      return aName.localeCompare(bName);
    });

  const renderRows = (rows, isPinnedSection) =>
    rows.map(([name, entry]) => {
      const alertConfig = alerts.get(name);
      return (
        <TraceRow
          key={name}
          name={name}
          entry={entry}
          pinned={isPinnedSection}
          flashKey={entry.flashKey}
          onHighlight={onHighlight}
          onPin={handlePin}
          snapshotVal={snapshot?.get(name)}
          alertConfig={alertConfig}
          isFiring={checkAlert(alertConfig, entry.value)}
          isEditing={editingAlert === name}
          onAlertEdit={setEditingAlert}
          onAlertSave={handleAlertSave}
          onAlertDelete={handleAlertDelete}
        />
      );
    });

  return (
    <div className="trace-panel">
      {/* ── Header ── */}
      <div className="trace-panel-header">
        <div className="trace-panel-title">
          <span className="trace-live-dot" />
          Variables
        </div>
        <div className="trace-panel-meta">
          <span className="trace-var-count">{data.size} var{data.size !== 1 ? "s" : ""}</span>
          {firingCount > 0 && (
            <span className="trace-alert-badge">⚡ {firingCount}</span>
          )}
          {recording && (
            <span className="trace-alert-badge" style={{ background: "var(--rec-color, #e53e3e)" }}>
              ● {recordBuffer.length}
            </span>
          )}
          {snapshot && (
            <span className="trace-snap-badge">⊡ snap</span>
          )}
        </div>
        {/* Recording controls */}
        {onStartRecord && (
          <>
            {recording ? (
              <button
                type="button"
                className="trace-icon-btn trace-rec-btn trace-rec-btn--active"
                onClick={onStopRecord}
                title="Stop recording"
              >
                <span className="trace-rec-dot" />
                REC
              </button>
            ) : (
              <button
                type="button"
                className="trace-icon-btn trace-rec-btn"
                onClick={onStartRecord}
                title="Start recording all variable data to CSV"
                disabled={data.size === 0}
              >
                ⏺ Record
              </button>
            )}
            <button
              type="button"
              className="trace-icon-btn"
              onClick={() => exportRecordingCsv(recordBuffer)}
              title={`Export recording (${recordBuffer.length} rows)`}
              disabled={recordBuffer.length === 0}
            >
              ↓ Rec.CSV
            </button>
          </>
        )}
        {/* Snapshot toggle */}
        <button
          type="button"
          className={`trace-icon-btn${snapshot ? " trace-icon-btn--active" : ""}`}
          onClick={snapshot ? handleClearSnapshot : handleSnapshot}
          title={snapshot ? "Clear snapshot" : "Snapshot current values"}
          disabled={data.size === 0}
        >
          {snapshot ? "✕ Snap" : "⊡ Snap"}
        </button>
        {/* CSV */}
        <button
          type="button"
          className="trace-icon-btn"
          onClick={() => exportCsv(data)}
          title="Export as CSV"
          disabled={data.size === 0}
        >
          ↓ CSV
        </button>
        {/* Clear */}
        <button
          type="button"
          className="trace-clear-btn"
          onClick={() => { onClear(); setSnapshot(null); setEditingAlert(null); }}
          title="Clear trace data"
        >
          Clear
        </button>
      </div>

      {/* ── Search ── */}
      <div className="trace-search-bar">
        <svg className="trace-search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="4.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" />
        </svg>
        <input
          className="trace-search-input"
          type="text"
          placeholder="Filter variables…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          spellCheck={false}
        />
        {filter && (
          <button className="trace-search-clear" onClick={() => setFilter("")} aria-label="Clear filter">✕</button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="trace-scroll">
        <table className="trace-table">
          <thead>
            <tr>
              <th className="trace-th trace-th--pin" />
              <th className="trace-th">Variable</th>
              <th className="trace-th">Value / Δ</th>
              <th className="trace-th trace-th--spark">Trend</th>
              <th className="trace-th trace-th--alert" />
            </tr>
          </thead>
          <tbody>
            {allRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="trace-empty">
                  {filter
                    ? `No variables matching "${filter}"`
                    : "Run a simulation — variables will appear here in real time."}
                </td>
              </tr>
            ) : (
              <>
                {pinnedRows.length > 0 && (
                  <>
                    <tr className="trace-section-row">
                      <td colSpan={5}><span className="trace-section-label">★ Pinned</span></td>
                    </tr>
                    {renderRows(pinnedRows, true)}
                  </>
                )}
                {unpinnedRows.length > 0 && pinnedRows.length > 0 && (
                  <tr className="trace-section-row">
                    <td colSpan={5}><span className="trace-section-label">All variables</span></td>
                  </tr>
                )}
                {renderRows(unpinnedRows, false)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TraceTable;
