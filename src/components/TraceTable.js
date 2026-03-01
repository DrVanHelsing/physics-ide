import React, { useEffect, useRef } from "react";

/* ── Truncate long values for display ─────────────────────── */
function truncate(str, max) {
  if (!str) return "";
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max) + "…";
}

/* ── Single row ──────────────────────────────────────────── */
function TraceRow({ name, value, count, blockId, flashKey, onHighlight }) {
  const rowRef = useRef(null);
  const prevKey = useRef(flashKey);

  useEffect(() => {
    if (flashKey !== prevKey.current && rowRef.current) {
      prevKey.current = flashKey;
      const el = rowRef.current;
      el.classList.remove("trace-row--flash");
      // Force reflow so removing + re-adding the class restarts the animation
      void el.offsetHeight;
      el.classList.add("trace-row--flash");
      const id = setTimeout(() => el.classList.remove("trace-row--flash"), 700);
      return () => clearTimeout(id);
    }
  }, [flashKey]);

  const isActive = count > 0;

  return (
    <tr
      ref={rowRef}
      className={`trace-row${isActive ? " trace-row--active" : ""}`}
      onClick={() => onHighlight?.(blockId)}
      title={`Click to highlight block • Last value: ${value}`}
    >
      <td className="trace-col trace-col--name">
        <span className="trace-varname">{name}</span>
      </td>
      <td className="trace-col trace-col--value" title={value}>
        <span className="trace-value">{truncate(value, 32)}</span>
      </td>
      <td className="trace-col trace-col--count">
        <span className={`trace-badge-count${count > 100 ? " trace-badge-count--hot" : ""}`}>
          {count > 9999 ? (count / 1000).toFixed(1) + "k" : count}
        </span>
      </td>
    </tr>
  );
}

/* ── Main trace table ─────────────────────────────────────── */
function TraceTable({ data, onHighlight, onClear }) {
  // Sort: constants (low update count) first, then alphabetically
  const rows = Array.from(data.entries()).sort(([aName, aVal], [bName, bVal]) => {
    const aConst = aVal.count <= 1;
    const bConst = bVal.count <= 1;
    if (aConst && !bConst) return -1;
    if (!aConst && bConst) return 1;
    return aName.localeCompare(bName);
  });

  return (
    <div className="trace-panel">
      {/* Header */}
      <div className="trace-panel-header">
        <div className="trace-panel-title">
          <span className="trace-live-dot" />
          Live Trace
        </div>
        <div className="trace-panel-meta">
          <span className="trace-var-count">{data.size} var{data.size !== 1 ? "s" : ""}</span>
        </div>
        <button
          type="button"
          className="trace-clear-btn"
          onClick={onClear}
          title="Clear trace data"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="trace-scroll">
        <table className="trace-table">
          <thead>
            <tr>
              <th className="trace-th">Variable</th>
              <th className="trace-th">Value</th>
              <th className="trace-th trace-th--count" title="Number of updates">Updates</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="trace-empty">
                  <span>Run a simulation — variables will appear here in real time.</span>
                </td>
              </tr>
            ) : (
              rows.map(([name, entry]) => (
                <TraceRow
                  key={name}
                  name={name}
                  value={entry.value}
                  count={entry.count}
                  blockId={entry.blockId}
                  flashKey={entry.flashKey}
                  onHighlight={onHighlight}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TraceTable;
