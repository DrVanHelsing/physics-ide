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
    return errorEl("No data to chart.");

  const rows = dataset.rows;

  try {
    let chart;
    switch (chartType) {
      case "bar": {
        const clean = validRows(rows, xCol);
        if (!clean.length) return errorEl("No valid rows for bar chart.");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: [
            Plot.barY(clean, { x: xCol, y: yCol, fill: DS_COLOR }),
            Plot.ruleY([0]),
          ],
          x: { label: xCol, tickRotate: -30 },
          y: { label: yCol, grid: true },
        });
        break;
      }
      case "line": {
        const clean = validRows(rows, xCol, yCol);
        if (!clean.length) return errorEl("No valid rows for line chart.");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: [
            Plot.line(clean, { x: xCol, y: yCol, stroke: DS_COLOR, strokeWidth: 1.5 }),
            Plot.dot(clean, { x: xCol, y: yCol, fill: DS_COLOR, r: 2 }),
          ],
          x: { label: xCol, grid: true },
          y: { label: yCol, grid: true },
        });
        break;
      }
      case "scatter": {
        const clean = validRows(rows, xCol, yCol);
        if (!clean.length) return errorEl("No valid rows for scatter plot.");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: [
            Plot.dot(clean, { x: xCol, y: yCol, fill: DS_COLOR, opacity: 0.7, r: 3 }),
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
        if (!clean.length) return errorEl("No valid numeric values for histogram.");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: [
            Plot.rectY(clean, Plot.binX({ y: "count" }, { x: theCol, fill: DS_COLOR })),
            Plot.ruleY([0]),
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
        if (!clean.length) return errorEl("No valid values for box plot.");
        chart = Plot.plot({
          ...baseOpts(title, containerWidth),
          title: title || undefined,
          marks: groupCol
            ? [Plot.boxY(clean, { x: groupCol, y: vCol, fill: DS_COLOR })]
            : [Plot.boxY(clean, { y: vCol, fill: DS_COLOR })],
          ...(groupCol ? { x: { label: groupCol, tickRotate: -30 } } : {}),
          y: { label: vCol, grid: true },
        });
        break;
      }
      default:
        return errorEl(`Unknown chart type: "${chartType}"`);
    }
    return chart;
  } catch (e) {
    return errorEl(`Chart error: ${e.message}`);
  }
}

function errorEl(msg) {
  const d = document.createElement("div");
  d.className = "ds-chart-error";
  d.textContent = msg;
  return d;
}
