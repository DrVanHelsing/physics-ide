/**
 * DataPanel — Phase B.9 scaffold.
 *
 * Surface for the active project's datasets and their summary. In Phase B
 * the panel is intentionally empty: it announces itself, links to the
 * Phase A demo path, and waits for Phase C to wire dataset state + the
 * foundational stats summary into it. The goal of B.9 is only to claim
 * the layout slot so DS and Hybrid goals have a useful default view.
 */

import React from "react";
import { TableIcon } from "./Icons";

export default function DataPanel({ goal, datasetCount = 0 }) {
  return (
    <div className="data-panel">
      <div className="data-panel-header">
        <span className="data-panel-title">
          <TableIcon size={14} /> Data
        </span>
        <span className="data-panel-meta">
          {datasetCount === 0
            ? "no datasets yet"
            : `${datasetCount} dataset${datasetCount === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="data-panel-body">
        <p className="data-panel-empty-title">No active dataset</p>
        {goal === "datascience" ? (
          <p className="data-panel-empty-hint">
            Load a built-in dataset or import a CSV from the toolbox to get started.
            Foundational DS blocks land in Phase C.
          </p>
        ) : (
          <p className="data-panel-empty-hint">
            Run the simulation, open Debug Mode, record a few variables, then
            click <strong>Chart</strong> on the trace panel to promote the run
            into a dataset.
          </p>
        )}
      </div>
    </div>
  );
}
