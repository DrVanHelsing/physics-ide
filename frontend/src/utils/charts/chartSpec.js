import * as Plot from "@observablehq/plot";

const DS_COLOR = "#2da56f";
const CHART_STYLE = {
  background: "transparent",
  color: "var(--text, #e6e6e6)",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  fontSize: "11px",
};

function validRows(rows, ...cols) {
  return rows.filter((r) =>
    cols.every((c) => {
      if (!c) return true;
      const v = r[c];
      return v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v) !== v ? v : Number(v));
    })
  );
}

function baseOpts(title, containerWidth) {
  const w = Math.max(260, (containerWidth || 330) - 8);
  return {
    width: w,
    height: Math.round(w * 0.62),
    marginLeft: 50,
    marginBottom: 46,
    marginTop: title ? 26 : 8,
    style: CHART_STYLE,
  };
}

export function renderDsChartToElement(chartOutput, containerWidth) {
  const { chartType, dataset, xCol, yCol, col, valueCol, groupCol, title } = chartOutput;
  if (!dataset || !dataset.rows || dataset.rows.length === 0)
    return stateEl("No data to chart yet.", "empty");

  const rows = dataset.rows;

  try {
    let chart;
    switch (chartType) {
      case "bar": {
        const clean = validRows(rows, xCol);
        if (!clean.length) return stateEl("No valid rows for bar chart.", "empty");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: [
            Plot.barY(clean, { x: xCol, y: yCol, fill: DS_COLOR }),
            Plot.ruleY([0]),
            Plot.tip(clean, Plot.pointerX({ x: xCol, y: yCol })),
          ],
          x: { label: xCol, tickRotate: -30 },
          y: { label: yCol, grid: true },
        });
        break;
      }
      case "line": {
        const clean = validRows(rows, xCol, yCol);
        if (!clean.length) return stateEl("No valid rows for line chart.", "empty");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: [
            Plot.line(clean, { x: xCol, y: yCol, stroke: DS_COLOR, strokeWidth: 1.5 }),
            Plot.dot(clean, { x: xCol, y: yCol, fill: DS_COLOR, r: 2 }),
            Plot.tip(clean, Plot.pointerX({ x: xCol, y: yCol })),
          ],
          x: { label: xCol, grid: true },
          y: { label: yCol, grid: true },
        });
        break;
      }
      case "scatter": {
        const clean = validRows(rows, xCol, yCol);
        if (!clean.length) return stateEl("No valid rows for scatter plot.", "empty");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: [
            Plot.dot(clean, { x: xCol, y: yCol, fill: DS_COLOR, opacity: 0.7, r: 3 }),
            Plot.tip(clean, Plot.pointer({ x: xCol, y: yCol })),
          ],
          x: { label: xCol, grid: true },
          y: { label: yCol, grid: true },
        });
        break;
      }
      case "histogram": {
        const theCol = col || xCol;
        if (!theCol) return errorEl("Histogram needs a column.");
        const clean = rows.filter((r) => {
          const v = r[theCol];
          return v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));
        });
        if (!clean.length) return stateEl("No valid numeric values for histogram.", "empty");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: [
            Plot.rectY(clean, Plot.binX({ y: "count" }, { x: theCol, fill: DS_COLOR })),
            Plot.ruleY([0]),
            Plot.tip(clean, Plot.binX({ y: "count" }, Plot.pointerX({ x: theCol }))),
          ],
          x: { label: theCol },
          y: { label: "count", grid: true },
        });
        break;
      }
      case "box": {
        const vCol = valueCol || col;
        if (!vCol) return errorEl("Box plot needs a value column.");
        const clean = rows.filter((r) => {
          const v = r[vCol];
          return v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));
        });
        if (!clean.length) return stateEl("No valid values for box plot.", "empty");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: groupCol
            ? [
                Plot.boxY(clean, { x: groupCol, y: vCol, fill: DS_COLOR }),
                Plot.tip(clean, Plot.pointer({ x: groupCol, y: vCol })),
              ]
            : [
                Plot.boxY(clean, { y: vCol, fill: DS_COLOR }),
                Plot.tip(clean, Plot.pointerY({ y: vCol })),
              ],
          ...(groupCol ? { x: { label: groupCol, tickRotate: -30 } } : {}),
          y: { label: vCol, grid: true },
        });
        break;
      }
      case "scatter_fit": {
        const clean = validRows(rows, xCol, yCol);
        if (!clean.length) return stateEl("No valid rows for scatter+fit chart.", "empty");
        const fit = chartOutput.fit;
        const marks = [
          Plot.dot(clean, { x: xCol, y: yCol, fill: DS_COLOR, opacity: 0.7, r: 3 }),
          Plot.tip(clean, Plot.pointer({ x: xCol, y: yCol })),
        ];
        if (fit && fit.slope != null) {
          marks.push(
            Plot.linearRegressionY(clean, { x: xCol, y: yCol, stroke: "#ff9f43", strokeWidth: 1.5, ci: 0 })
          );
        }
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks,
          x: { label: xCol, grid: true },
          y: { label: yCol, grid: true },
        });
        break;
      }
      default:
        return errorEl(`Unknown chart type: "${chartType}"`);
    }
    return annotateChart(chart, describeChart(chartOutput, rows.length));
  } catch (e) {
    return errorEl(`Chart error: ${e.message}`);
  }
}

/* ── Accessibility: a screen-reader summary of the chart ──────────
   Observable Plot renders an <svg>/<figure> with no inherent label, so
   assistive tech announces nothing useful. We mark the chart as an image
   and give it a one-line description derived from its encodings. */
function describeChart(chartOutput, rowCount) {
  const { chartType, xCol, yCol, col, valueCol, groupCol, title } = chartOutput;
  const kind =
    {
      bar: "Bar chart",
      line: "Line chart",
      scatter: "Scatter plot",
      histogram: "Histogram",
      box: "Box plot",
      scatter_fit: "Scatter plot with linear fit",
    }[chartType] || "Chart";
  const x = xCol || col || valueCol || groupCol;
  let body;
  if (yCol && x) body = `${yCol} versus ${x}`;
  else if (x) body = `distribution of ${x}`;
  else body = "";
  const parts = [title || kind];
  if (body) parts.push(body);
  if (rowCount != null) parts.push(`${rowCount} row${rowCount === 1 ? "" : "s"}`);
  return parts.join(" — ");
}

function annotateChart(el, label) {
  if (!el || !label) return el;
  try {
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", label);
  } catch {
    /* non-element (shouldn't happen) — ignore */
  }
  return el;
}

/* Empty-data and load-failure placeholders. Both are announced to screen
   readers; the empty state is informational, errors are assertive. */
function stateEl(msg, variant = "empty") {
  const d = document.createElement("div");
  d.className = variant === "error" ? "ds-chart-error" : "ds-chart-empty";
  d.setAttribute("role", variant === "error" ? "alert" : "status");
  d.textContent = msg;
  return d;
}

function errorEl(msg) {
  return stateEl(msg, "error");
}
