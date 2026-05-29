import React, { useEffect, useRef, useState } from "react";
import { TableIcon } from "./Icons";
import { renderDsChartToElement } from "../utils/charts/chartSpec";

const TABLE_ROW_LIMIT = 12;

function DataTable({ dataset }) {
  if (!dataset || dataset.rowCount === 0)
    return <p className="data-panel-empty-hint">Empty dataset.</p>;

  const cols = dataset.columns;
  const rows = dataset.rows.slice(0, TABLE_ROW_LIMIT);
  const overflow = dataset.rowCount - TABLE_ROW_LIMIT;

  return (
    <div className="ds-table-wrapper">
      <table className="ds-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.name}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.name}>
                  {row[c.name] == null ? "—" : String(row[c.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {overflow > 0 && (
        <p className="ds-table-overflow">{overflow} more rows…</p>
      )}
    </div>
  );
}

function DsChart({ chartOutput }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.clientWidth || 320;
    const el = renderDsChartToElement(chartOutput, w);
    ref.current.innerHTML = "";
    if (el) ref.current.appendChild(el);
    return () => { if (ref.current) ref.current.innerHTML = ""; };
  }, [chartOutput]);
  return <div className="ds-chart-container" ref={ref} />;
}

function DsPython({ code }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ds-python-block">
      <button className="ds-python-toggle" onClick={() => setOpen(o => !o)}>
        {open ? "▾" : "▸"} Generated Python
      </button>
      {open && <pre className="ds-python-pre">{code}</pre>}
    </div>
  );
}

const STAT_LABELS = {
  count: "count", mean: "mean", median: "median",
  min: "min", max: "max", range: "range", sum: "sum", spread: "spread",
};

function fmtNum(v) {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}

function AllStats({ output }) {
  const { col, stats } = output;
  return (
    <div className="ds-all-stats">
      <p className="ds-all-stats-title">{col}</p>
      <div className="ds-all-stats-grid">
        {Object.entries(STAT_LABELS).map(([key, label]) => (
          <div key={key} className="ds-all-stats-cell">
            <span className="ds-value-label">{label}</span>
            <span className="ds-value-num">{fmtNum(stats?.[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareStats({ output }) {
  const { colA, colB, statsA, statsB } = output;
  return (
    <div className="ds-compare-stats">
      <div className="ds-compare-stats-header">
        <span />
        <span className="ds-compare-stats-col">{colA}</span>
        <span className="ds-compare-stats-col">{colB}</span>
      </div>
      {Object.entries(STAT_LABELS).map(([key, label]) => (
        <div key={key} className="ds-compare-stats-row">
          <span className="ds-value-label">{label}</span>
          <span className="ds-value-num">{fmtNum(statsA?.[key])}</span>
          <span className="ds-value-num">{fmtNum(statsB?.[key])}</span>
        </div>
      ))}
    </div>
  );
}

function renderOutput(o, i) {
  switch (o.type) {
    case "value":
      return (
        <div key={i} className="ds-value-row">
          <span className="ds-value-label">{o.label}</span>
          <span className="ds-value-num">{fmtNum(o.value)}</span>
        </div>
      );
    case "table":
      return (
        <div key={i} className="ds-table-section">
          {o.varName && <p className="ds-table-label">{o.varName}</p>}
          <DataTable dataset={o.dataset} />
        </div>
      );
    case "chart":
      return (
        <div key={i} className="ds-chart-section">
          {o.title && <p className="ds-chart-label">{o.title}</p>}
          <DsChart chartOutput={o} />
        </div>
      );
    case "note":
      return <div key={i} className="ds-note">{o.text}</div>;
    case "compare":
      return (
        <div key={i} className="ds-compare">
          <div className="ds-compare-cell">
            <span className="ds-value-label">{o.a.label}</span>
            <span className="ds-value-num">{fmtNum(o.a.value)}</span>
          </div>
          <span className="ds-compare-vs">vs</span>
          <div className="ds-compare-cell">
            <span className="ds-value-label">{o.b.label}</span>
            <span className="ds-value-num">{fmtNum(o.b.value)}</span>
          </div>
        </div>
      );
    case "all_stats":
      return <AllStats key={i} output={o} />;
    case "compare_stats":
      return <CompareStats key={i} output={o} />;
    case "conclusion":
      return (
        <div key={i} className="ds-conclusion">
          <span className="ds-conclusion-icon">💡</span>
          <span className="ds-conclusion-text">{o.text}</span>
        </div>
      );
    case "python":
      return <DsPython key={i} code={o.code} />;
    default:
      return null;
  }
}

export default function DataPanel({ goal, datasetCount = 0, dsOutputs = [], dsError = null, onClearCsvCache = null, savedDatasets = [] }) {
  const tableOutputs = dsOutputs.filter((o) => o.type === "table");
  const hasOutputs = dsOutputs.length > 0 || dsError;
  const primaryTable = tableOutputs[0];

  return (
    <div className="data-panel">
      <div className="data-panel-header">
        <span className="data-panel-title">
          <TableIcon size={14} /> Data
        </span>
        <span className="data-panel-meta">
          {primaryTable
            ? `${primaryTable.dataset?.rowCount ?? 0} rows · ${primaryTable.varName}`
            : hasOutputs
            ? `${dsOutputs.length} output${dsOutputs.length === 1 ? "" : "s"}`
            : datasetCount === 0
            ? "no datasets yet"
            : `${datasetCount} dataset${datasetCount === 1 ? "" : "s"}`}
        </span>
        {onClearCsvCache && (
          <button
            className="data-panel-reload-csv"
            title="Re-pick CSV files on next run"
            onClick={onClearCsvCache}
          >↺</button>
        )}
      </div>

      {/* ── Saved trace datasets ── */}
      {savedDatasets.length > 0 && (
        <div className="ds-saved-traces">
          <p className="ds-saved-traces-label">Saved traces</p>
          {savedDatasets.map((ds) => (
            <div key={ds.id} className="ds-saved-trace-row">
              <TableIcon size={12} />
              <span className="ds-saved-trace-name" title={`Use label in "Load trace dataset" block`}>{ds.name}</span>
              <span className="ds-saved-trace-meta">{ds.rowCount} rows · {ds.columns.length} cols</span>
            </div>
          ))}
        </div>
      )}

      <div className={`data-panel-body${!hasOutputs ? " data-panel-body--empty" : ""}`}>
        {dsError && (
          <div className="ds-runner-error">
            <span className="ds-runner-error-icon">⚠</span>
            <span className="ds-runner-error-text">{dsError}</span>
          </div>
        )}

        {!hasOutputs && (
          <>
            <p className="data-panel-empty-title">No active dataset</p>
            {goal === "datascience" ? (
              <p className="data-panel-empty-hint">
                Use the <strong>Data Science</strong> category in the toolbox —
                load a dataset, then use <em>show table</em> to see it here.
              </p>
            ) : (
              <p className="data-panel-empty-hint">
                Run the simulation, open Debug Mode, record a few variables,
                then click <strong>Chart</strong> on the trace panel to promote
                the run into a dataset.
              </p>
            )}
          </>
        )}

        {dsOutputs.map((o, i) => renderOutput(o, i))}
      </div>
    </div>
  );
}
