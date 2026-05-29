import React, { useEffect, useRef } from "react";
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
    const el = renderDsChartToElement(chartOutput);
    ref.current.innerHTML = "";
    if (el) ref.current.appendChild(el);
    return () => { if (ref.current) ref.current.innerHTML = ""; };
  }, [chartOutput]);
  return <div className="ds-chart-container" ref={ref} />;
}

export default function DataPanel({ goal, datasetCount = 0, dsOutputs = [] }) {
  const tableOutputs  = dsOutputs.filter((o) => o.type === "table");
  const valueOutputs  = dsOutputs.filter((o) => o.type === "value");
  const chartOutputs  = dsOutputs.filter((o) => o.type === "chart");
  const noteOutputs   = dsOutputs.filter((o) => o.type === "note");
  const compareOutputs = dsOutputs.filter((o) => o.type === "compare");
  const conclusions   = dsOutputs.filter((o) => o.type === "conclusion");
  const hasOutputs = dsOutputs.length > 0;
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
            : datasetCount === 0
            ? "no datasets yet"
            : `${datasetCount} dataset${datasetCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="data-panel-body">
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

        {valueOutputs.length > 0 && (
          <div className="ds-values">
            {valueOutputs.map((o, i) => (
              <div key={i} className="ds-value-row">
                <span className="ds-value-label">{o.label}</span>
                <span className="ds-value-num">
                  {typeof o.value === "number"
                    ? o.value.toFixed(4)
                    : o.value == null
                    ? "—"
                    : String(o.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {tableOutputs.map((t, i) => (
          <div key={i} className="ds-table-section">
            {tableOutputs.length > 1 && (
              <p className="ds-table-label">{t.varName}</p>
            )}
            <DataTable dataset={t.dataset} />
          </div>
        ))}

        {chartOutputs.map((c, i) => (
          <div key={i} className="ds-chart-section">
            <DsChart chartOutput={c} />
          </div>
        ))}

        {noteOutputs.map((o, i) => (
          <div key={i} className="ds-note">{o.text}</div>
        ))}

        {compareOutputs.map((o, i) => (
          <div key={i} className="ds-compare">
            <div className="ds-compare-cell">
              <span className="ds-value-label">{o.a.label}</span>
              <span className="ds-value-num">
                {typeof o.a.value === "number" ? o.a.value.toFixed(4) : String(o.a.value ?? "—")}
              </span>
            </div>
            <span className="ds-compare-vs">vs</span>
            <div className="ds-compare-cell">
              <span className="ds-value-label">{o.b.label}</span>
              <span className="ds-value-num">
                {typeof o.b.value === "number" ? o.b.value.toFixed(4) : String(o.b.value ?? "—")}
              </span>
            </div>
          </div>
        ))}

        {conclusions.map((o, i) => (
          <div key={i} className="ds-conclusion">
            <span className="ds-conclusion-icon">💡</span>
            <span className="ds-conclusion-text">{o.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
