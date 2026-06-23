/**
 * plotRender — phase-A minimal renderer using Observable Plot.
 *
 * Renders a chart-spec against a Dataset and returns an SVG element ready to
 * mount in the ChartOverlay. Only line and scatter are supported in this
 * spike; the other foundational chart types land in Phase C.
 *
 *   ChartSpec {
 *     type: 'line' | 'scatter',
 *     datasetId,
 *     encodings: { x, y, color? },
 *     title,
 *     axisLabels: { x?, y? },
 *   }
 */
import * as Plot from "@observablehq/plot";

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 420;

function isNumericColumn(dataset, colName) {
  const col = dataset.columns.find((c) => c.name === colName);
  return col?.inferredType === "number";
}

function buildAxisOptions(dataset, colName, label) {
  const numeric = isNumericColumn(dataset, colName);
  const base = { label, grid: true };
  if (numeric) {
    return {
      ...base,
      type: "linear",
      nice: true,
      ticks: 8,
      tickFormat: ".3~f",
      tickRotate: -30,
    };
  }
  return { ...base, tickRotate: -30 };
}

export function renderChart(spec, dataset, opts = {}) {
  if (!dataset || dataset.rowCount === 0) return emptyState("No data to chart.");
  const enc = spec.encodings || {};
  const xCol = enc.x;
  const yCol = enc.y;
  if (!xCol || !yCol) return emptyState("Chart needs both X and Y columns.");

  const xNumeric = isNumericColumn(dataset, xCol);
  const yNumeric = isNumericColumn(dataset, yCol);

  const cleanRows = dataset.rows.filter((r) => {
    const xv = r[xCol];
    const yv = r[yCol];
    if (xv === null || xv === undefined || xv === "") return false;
    if (yv === null || yv === undefined || yv === "") return false;
    if (xNumeric && (typeof xv !== "number" || Number.isNaN(xv))) return false;
    if (yNumeric && (typeof yv !== "number" || Number.isNaN(yv))) return false;
    return true;
  });
  if (cleanRows.length === 0) return emptyState("No rows with valid X and Y values.");

  const width = opts.width || DEFAULT_WIDTH;
  const height = opts.height || DEFAULT_HEIGHT;

  const marks = [];
  if (spec.type === "line") {
    marks.push(Plot.lineY(cleanRows, { x: xCol, y: yCol, stroke: enc.color || "currentColor", strokeWidth: 1.5 }));
    marks.push(Plot.dot(cleanRows, { x: xCol, y: yCol, fill: enc.color || "currentColor", r: 1.5, opacity: 0.5 }));
  } else if (spec.type === "scatter") {
    marks.push(Plot.dot(cleanRows, { x: xCol, y: yCol, fill: enc.color || "currentColor", r: 3, opacity: 0.7 }));
  } else {
    return emptyState(`Chart type '${spec.type}' not supported in Phase A.`);
  }

  const chart = Plot.plot({
    width,
    height,
    marginLeft: 64,
    marginBottom: 70,
    style: {
      background: "transparent",
      color: "var(--text, #e6e6e6)",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: "12px",
    },
    x: buildAxisOptions(dataset, xCol, spec.axisLabels?.x || xCol),
    y: buildAxisOptions(dataset, yCol, spec.axisLabels?.y || yCol),
    marks,
  });

  if (spec.title) {
    const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
    title.setAttribute("x", String(width / 2));
    title.setAttribute("y", "18");
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("font-size", "14");
    title.setAttribute("font-weight", "600");
    title.setAttribute("fill", "currentColor");
    title.textContent = spec.title;
    chart.insertBefore(title, chart.firstChild);
  }

  return chart;
}

function emptyState(message) {
  const div = document.createElement("div");
  div.className = "chart-empty";
  div.textContent = message;
  return div;
}
