/**
 * ChartOverlay — phase-A modal-style overlay for showing a chart from a Dataset.
 *
 * Modeled on the fullscreen-overlay pattern used by StartMenu, HelpPage, and
 * DebugMode. Phase C will extend with saved chart specs and per-goal layouts;
 * for now this is the minimum needed to validate trace -> dataset -> chart.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import Overlay from "./common/Overlay";
import { XIcon, DownloadIcon } from "./Icons";
import { renderChart } from "../utils/charts/plotRender";
import { numericColumns } from "../utils/dataset/dataset";

function defaultEncodings(dataset) {
  if (!dataset) return { x: null, y: null };
  const nums = numericColumns(dataset);
  if (nums.length === 0) return { x: dataset.columns[0]?.name, y: dataset.columns[1]?.name };
  const x = nums.includes("t") ? "t" : nums[0];
  const y = nums.find((n) => n !== x) || nums[0];
  return { x, y };
}

function downloadSvg(svgEl, filename) {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([`<?xml version="1.0" standalone="no"?>\n${xml}`], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `chart-${Date.now()}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPng(containerEl, filename) {
  const bg =
    getComputedStyle(document.documentElement).getPropertyValue("--bg-base").trim() || "#0a0a0f";
  const html2canvas =
    typeof window.html2canvas === "function"
      ? window.html2canvas
      : (await import("html2canvas")).default;
  if (!html2canvas) {
    // Fall back to a single-mark SVG -> PNG dataURL via canvas.
    const svg = containerEl.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.viewBox.baseVal.width || svg.clientWidth;
      canvas.height = svg.viewBox.baseVal.height || svg.clientHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        const pngUrl = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = filename || `chart-${Date.now()}.png`;
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
        }, 1000);
      });
    };
    img.src = url;
    return;
  }
  const canvas = await html2canvas(containerEl, { backgroundColor: bg, scale: 2 });
  canvas.toBlob((b) => {
    const pngUrl = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = filename || `chart-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
  });
}

export default function ChartOverlay({ dataset, onClose, onAnalyse }) {
  const containerRef = useRef(null);
  const [chartType, setChartType] = useState("line");
  const [encodings, setEncodings] = useState(() => defaultEncodings(dataset));
  const [title, setTitle] = useState(dataset?.name || "Chart");

  useEffect(() => {
    setEncodings(defaultEncodings(dataset));
    setTitle(dataset?.name || "Chart");
  }, [dataset]);

  const spec = useMemo(
    () => ({
      type: chartType,
      datasetId: dataset?.id,
      encodings,
      title,
      axisLabels: { x: encodings.x, y: encodings.y },
    }),
    [chartType, dataset?.id, encodings, title],
  );

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    host.innerHTML = "";
    if (!dataset) return;
    const node = renderChart(spec, dataset, { width: 760, height: 440 });
    host.appendChild(node);
  }, [spec, dataset]);

  if (!dataset) return null;

  const columnNames = dataset.columns.map((c) => c.name);

  return (
    <Overlay onClose={onClose} label={`Chart — ${title}`} className="chart-overlay" panelClassName="chart-overlay-inner">
      <div className="chart-overlay-header">
        <div className="chart-overlay-title">
          <strong>{title}</strong>
          <span className="chart-overlay-meta">
            {dataset.rowCount} row{dataset.rowCount !== 1 ? "s" : ""} · {dataset.columns.length} columns ·{" "}
            {dataset.provenance}
          </span>
        </div>
        <div className="chart-overlay-header-actions">
          {onAnalyse && (
            <button
              className="chart-overlay-analyse"
              onClick={onAnalyse}
              title="Load the paired analysis for this run"
            >
              Analyse this run →
            </button>
          )}
          <button className="chart-overlay-close" onClick={onClose} title="Close">
            <XIcon size={14} />
          </button>
        </div>
      </div>

      <div className="chart-overlay-controls">
        <label>
          Type
          <select value={chartType} onChange={(e) => setChartType(e.target.value)}>
            <option value="line">Line</option>
            <option value="scatter">Scatter</option>
          </select>
        </label>
        <label>
          X
          <select
            value={encodings.x || ""}
            onChange={(e) => setEncodings((s) => ({ ...s, x: e.target.value }))}
          >
            {columnNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Y
          <select
            value={encodings.y || ""}
            onChange={(e) => setEncodings((s) => ({ ...s, y: e.target.value }))}
          >
            {columnNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="chart-overlay-title-input">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="chart-overlay-spacer" />
        <button
          className="chart-overlay-action"
          onClick={() => {
            const svg = containerRef.current?.querySelector("svg");
            if (svg) downloadSvg(svg, `${title.replace(/\s+/g, "_")}.svg`);
          }}
        >
          <DownloadIcon size={12} /> SVG
        </button>
        <button
          className="chart-overlay-action"
          onClick={() => downloadPng(containerRef.current, `${title.replace(/\s+/g, "_")}.png`)}
        >
          <DownloadIcon size={12} /> PNG
        </button>
      </div>

      <div ref={containerRef} className="chart-overlay-canvas" />
    </Overlay>
  );
}
