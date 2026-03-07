/**
 * pdfExport.js
 *
 * Export blocks (as a screenshot) or code (syntax-highlighted) to PDF.
 * Uses jsPDF + html2canvas.
 */
import jsPDF from "jspdf";

/* ── Python syntax highlighting (simple tokeniser) ───── */
const PY_KEYWORDS = new Set([
  "False","None","True","and","as","assert","async","await","break",
  "class","continue","def","del","elif","else","except","finally",
  "for","from","global","if","import","in","is","lambda","nonlocal",
  "not","or","pass","raise","return","try","while","with","yield",
]);

const PY_BUILTINS = new Set([
  "abs","all","any","bin","bool","bytes","callable","chr","dict",
  "dir","divmod","enumerate","eval","filter","float","format",
  "frozenset","getattr","globals","hasattr","hash","hex","id",
  "input","int","isinstance","issubclass","iter","len","list",
  "locals","map","max","memoryview","min","next","object","oct",
  "open","ord","pow","print","property","range","repr","reversed",
  "round","set","setattr","slice","sorted","staticmethod","str",
  "sum","super","tuple","type","vars","zip",
  // VPython builtins
  "vector","mag","norm","hat","cross","dot","rate","color","scene",
  "sphere","box","cylinder","arrow","helix","cone","ring","label",
  "curve","points","extrusion","text","local_light","distant_light",
  "pi","radians","degrees","sin","cos","tan","asin","acos","atan2",
  "sqrt","log","exp","random","GlowScript","VPython",
]);

function tokenizePython(code) {
  const tokens = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // Whitespace
    if (code[i] === " " || code[i] === "\t") {
      let start = i;
      while (i < len && (code[i] === " " || code[i] === "\t")) i++;
      tokens.push({ type: "ws", text: code.substring(start, i) });
      continue;
    }

    // Newline
    if (code[i] === "\n") {
      tokens.push({ type: "newline", text: "\n" });
      i++;
      continue;
    }

    // Comment
    if (code[i] === "#") {
      let start = i;
      while (i < len && code[i] !== "\n") i++;
      tokens.push({ type: "comment", text: code.substring(start, i) });
      continue;
    }

    // Strings
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      let start = i;
      // Check for triple-quote
      if (code.substring(i, i + 3) === q + q + q) {
        i += 3;
        while (i < len && code.substring(i, i + 3) !== q + q + q) i++;
        i += 3;
      } else {
        i++;
        while (i < len && code[i] !== q && code[i] !== "\n") {
          if (code[i] === "\\") i++;
          i++;
        }
        if (i < len) i++;
      }
      tokens.push({ type: "string", text: code.substring(start, i) });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(code[i]) || (code[i] === "." && i + 1 < len && /[0-9]/.test(code[i + 1]))) {
      let start = i;
      while (i < len && /[0-9.eE\-+xXoObBaAcCdDfF_]/.test(code[i])) i++;
      tokens.push({ type: "number", text: code.substring(start, i) });
      continue;
    }

    // Identifiers / keywords
    if (/[a-zA-Z_]/.test(code[i])) {
      let start = i;
      while (i < len && /[a-zA-Z0-9_]/.test(code[i])) i++;
      const word = code.substring(start, i);
      if (PY_KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", text: word });
      } else if (PY_BUILTINS.has(word)) {
        tokens.push({ type: "builtin", text: word });
      } else {
        tokens.push({ type: "ident", text: word });
      }
      continue;
    }

    // Operators / punctuation
    tokens.push({ type: "punct", text: code[i] });
    i++;
  }

  return tokens;
}

/* ── Blocks → PDF (SVG clone – full workspace, all pages) ─
   Strategy: all Blockly blocks live in the SVG DOM at all
   times; only the viewport clips them. We deep-clone the
   SVG, reset the blocklyBlockCanvas scroll/scale transform,
   set a viewBox that covers every block via
   getBlocksBoundingBox(), then rasterise to canvas and
   paginate into an A4 PDF.  No DOM mutation of the live
   workspace, no html2canvas, no scroll tricks.

   Special handling: editable fields (text inputs, numbers,
   variable names) are rendered as <foreignObject> HTML in
   the live SVG.  Browsers drop foreignObject content when
   drawing an SVG blob into a canvas <img>, causing the
   "black box" effect.  We capture the live .value of every
   input BEFORE cloning, then replace each <foreignObject>
   in the clone with an equivalent SVG <text> element.      */
export async function exportBlocksPdf(workspace, fileName) {
  if (!workspace) {
    window.alert("Switch to Blocks mode first to export the block workspace.");
    return;
  }

  const blocks = workspace.getAllBlocks(false);
  if (!blocks.length) { window.alert("No blocks to export."); return; }

  const bbox = workspace.getBlocksBoundingBox();
  const contentW = bbox.right  - bbox.left;
  const contentH = bbox.bottom - bbox.top;
  if (contentW === 0 || contentH === 0) { window.alert("No blocks to export."); return; }

  /* ── 1. Locate the live workspace SVG ──────────────── */
  const svgRoot = workspace.getParentSvg
    ? workspace.getParentSvg()
    : document.querySelector(".blockly-host svg");
  if (!svgRoot) { window.alert("Cannot locate workspace SVG."); return; }

  /* ── 2. Capture live field values BEFORE cloning ───────
     foreignObject > input .value is a live DOM property;
     cloneNode copies the attribute (default) not the current
     value. We read it now, skipping anything inside the flyout
     (which gets stripped later) so indices stay aligned.    */
  const liveFOs = Array.from(svgRoot.querySelectorAll("foreignObject")).filter(
    (fo) => !fo.closest(".blocklyFlyout")
  );
  const foValues = liveFOs.map((fo) => {
    const inp = fo.querySelector("input, textarea");
    if (inp) return inp.value;
    const editable = fo.querySelector("[contenteditable]");
    if (editable) return editable.textContent;
    return fo.textContent;
  });

  /* ── 2b. Snapshot computed text fills from the LIVE SVG ─
     Blockly styles block labels via CSS (.blocklyText {fill:#fff}).
     When the clone is serialised to a blob URL the stylesheet is
     NOT included, so every <text> defaults to fill:black —
     invisible on dark-coloured blocks.  Capture fills now and
     stamp them as inline attributes on the clone later (6b). */
  const liveTextEls = Array.from(
    svgRoot.querySelectorAll("text, tspan")
  ).filter((el) => !el.closest(".blocklyFlyout, .blocklyZoom"));
  const computedFills = liveTextEls.map((el) => {
    try { return window.getComputedStyle(el).fill || "#ffffff"; }
    catch (e) { return "#ffffff"; }
  });
  const computedFontSizes = liveTextEls.map((el) => {
    try { return window.getComputedStyle(el).fontSize || ""; }
    catch (e) { return ""; }
  });

  /* ── 3. Define viewBox in workspace-unit coordinates ── */
  const pad  = 40;
  const vbX  = bbox.left   - pad;
  const vbY  = bbox.top    - pad;
  const vbW  = contentW    + pad * 2;
  const vbH  = contentH    + pad * 2;

  /* ── 4. Deep-clone SVG so we never touch the live DOM ── */
  const svgClone = svgRoot.cloneNode(true);

  /* ── 5. Reset canvas group transform ───────────────────
     Removes the scroll/scale offset so block groups sit at
     their raw workspace coordinates, matching the viewBox.  */
  const blockCanvas  = svgClone.querySelector(".blocklyBlockCanvas");
  const bubbleCanvas = svgClone.querySelector(".blocklyBubbleCanvas");
  if (blockCanvas)  blockCanvas.setAttribute("transform",  "translate(0,0)");
  if (bubbleCanvas) bubbleCanvas.setAttribute("transform", "translate(0,0)");

  /* ── 6. Strip non-block UI from the clone ───────────────
     Do NOT include "foreignObject" here – we convert them
     to SVG text in the next step instead of removing them.  */
  [
    ".blocklyScrollbar",
    ".blocklyScrollbarBackground",
    ".blocklyScrollbarHandle",
    ".blocklyZoom",
    ".blocklyFlyoutBackground",
    ".blocklyFlyout",
  ].forEach((sel) => svgClone.querySelectorAll(sel).forEach((el) => el.remove()));

  /* ── 6b. Inline text fills on every <text> / <tspan> ────
     Stamp the computed fills captured in step 2b so text is
     readable when the SVG is rendered without the page CSS. */
  const NS = "http://www.w3.org/2000/svg";
  const cloneTextEls = Array.from(svgClone.querySelectorAll("text, tspan"));
  cloneTextEls.forEach((el, i) => {
    if (i < computedFills.length) {
      el.setAttribute("fill", computedFills[i]);
      if (computedFontSizes[i]) el.setAttribute("font-size", computedFontSizes[i]);
    } else if (!el.getAttribute("fill")) {
      el.setAttribute("fill", "#ffffff");
    }
    if (!el.getAttribute("font-family")) {
      el.setAttribute("font-family", "sans-serif");
    }
  });

  /* ── 7. Replace foreignObjects with SVG <text> elements ─
     After stripping .blocklyFlyout the remaining fOs in the
     clone correspond 1-to-1 (document order) with liveFOs.  */
  const clonedFOs = Array.from(svgClone.querySelectorAll("foreignObject"));
  clonedFOs.forEach((fo, i) => {
    const val = (foValues[i] ?? "").trim();
    if (!val) { fo.remove(); return; }

    const x = parseFloat(fo.getAttribute("x")      || "0");
    const y = parseFloat(fo.getAttribute("y")      || "0");
    const w = parseFloat(fo.getAttribute("width")  || "40");
    const h = parseFloat(fo.getAttribute("height") || "16");

    const textEl = document.createElementNS(NS, "text");
    textEl.setAttribute("x",              String(x + w / 2));
    textEl.setAttribute("y",              String(y + h * 0.74));
    textEl.setAttribute("text-anchor",    "middle");
    textEl.setAttribute("fill",           "#ffffff");
    textEl.setAttribute("font-size",      "12");
    textEl.setAttribute("font-family",    "sans-serif");
    textEl.setAttribute("pointer-events", "none");
    textEl.textContent = val;

    if (fo.parentNode) fo.parentNode.replaceChild(textEl, fo);
  });

  /* ── 8. White background rect behind all blocks ─────── */
  const bgRect = document.createElementNS(NS, "rect");
  bgRect.setAttribute("x",      String(vbX));
  bgRect.setAttribute("y",      String(vbY));
  bgRect.setAttribute("width",  String(vbW));
  bgRect.setAttribute("height", String(vbH));
  bgRect.setAttribute("fill",   "#ffffff");
  const anchor = svgClone.querySelector(".blocklyWorkspace") || svgClone.firstElementChild;
  svgClone.insertBefore(bgRect, anchor);

  /* ── 9. Set viewBox + pixel dimensions ─────────────── */
  const DPR     = 2;
  const renderW = Math.ceil(vbW * DPR);
  const renderH = Math.ceil(vbH * DPR);
  svgClone.setAttribute("viewBox",  `${vbX} ${vbY} ${vbW} ${vbH}`);
  svgClone.setAttribute("width",    String(renderW));
  svgClone.setAttribute("height",   String(renderH));
  svgClone.removeAttribute("style");

  /* ── 10. Serialise SVG → Blob URL → Image → Canvas ─── */
  let svgStr = new XMLSerializer().serializeToString(svgClone);
  if (!svgStr.includes("xmlns="))
    svgStr = svgStr.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload  = resolve;
    img.onerror = () => reject(new Error("SVG workspace render failed"));
    img.src     = url;
  });
  URL.revokeObjectURL(url);

  const canvas = document.createElement("canvas");
  canvas.width  = renderW;
  canvas.height = renderH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, renderW, renderH);
  ctx.drawImage(img, 0, 0);

  /* ── 11. Paginate canvas into A4 PDF ────────────────── */
  const pdf = new jsPDF({
    orientation: renderW > renderH ? "landscape" : "portrait",
    unit: "pt", format: "a4",
  });

  const PAGE_W     = pdf.internal.pageSize.getWidth();
  const PAGE_H     = pdf.internal.pageSize.getHeight();
  const MARGIN     = 36;
  const TITLE_H    = 40;
  const usableW    = PAGE_W - MARGIN * 2;
  const firstPageH = PAGE_H - MARGIN * 2 - TITLE_H;
  const otherPageH = PAGE_H - MARGIN * 2;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16); pdf.setTextColor(60, 60, 80);
  pdf.text("Physics IDE \u2014 Block Workspace", MARGIN, MARGIN + 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);  pdf.setTextColor(130, 130, 150);
  pdf.text(new Date().toLocaleString(), MARGIN, MARGIN + 26);

  const pdfScale = usableW / renderW;
  const drawW    = renderW * pdfScale;
  const drawH    = renderH * pdfScale;

  if (drawH <= firstPageH) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", MARGIN, MARGIN + TITLE_H, drawW, drawH);
  } else {
    let yOff = 0, page = 0;
    while (yOff < drawH) {
      if (page > 0) pdf.addPage();
      const usableH   = page === 0 ? firstPageH : otherPageH;
      const topMargin = page === 0 ? MARGIN + TITLE_H : MARGIN;
      const sliceH    = Math.min(usableH, drawH - yOff);
      const srcY      = Math.floor(yOff   / pdfScale);
      const srcH      = Math.ceil(sliceH  / pdfScale);
      const sc        = document.createElement("canvas");
      sc.width  = canvas.width;
      sc.height = srcH;
      sc.getContext("2d").drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
      pdf.addImage(sc.toDataURL("image/png"), "PNG", MARGIN, topMargin, drawW, sliceH);
      yOff += sliceH;
      page++;
    }
  }

  pdf.save(`${fileName || "blocks-workspace"}.pdf`);
}

/* ── Code → PDF (direct jsPDF text – no html2canvas) ────
   Renders syntax-highlighted Python straight into the PDF
   without needing an off-screen DOM element, so it always
   produces a real page instead of a blank one.            */
export async function exportCodePdf(code, fileName) {
  if (!code || !code.trim()) {
    window.alert("No code to export.");
    return;
  }

  const pdf        = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const PAGE_W     = pdf.internal.pageSize.getWidth();
  const PAGE_H     = pdf.internal.pageSize.getHeight();
  const MARGIN     = 36;
  const FONT_SIZE  = 8;
  const LINE_H     = 13;
  const LN_W       = 28;                 // line-number column width
  const CODE_LEFT  = MARGIN + LN_W + 5;  // x where code starts
  const TITLE_H    = 50;                 // height of title block on page 1

  /* ── Page-1 title ───────────────────────────────────── */
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(40, 40, 60);
  pdf.text("Physics IDE \u2014 Python Source", MARGIN, 22);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(110, 110, 130);
  pdf.text(`${new Date().toLocaleString()}  \u2022  VPython 3.2`, MARGIN, 35);

  pdf.setDrawColor(190, 190, 210);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, 42, PAGE_W - MARGIN, 42);

  /* ── Dark code-block background (first page) ────────── */
  pdf.setFillColor(40, 44, 52);
  pdf.rect(MARGIN, TITLE_H, PAGE_W - MARGIN * 2, PAGE_H - TITLE_H - MARGIN, "F");

  let y = TITLE_H + LINE_H;

  const addCodePage = () => {
    pdf.addPage();
    pdf.setFillColor(40, 44, 52);
    pdf.rect(MARGIN, MARGIN, PAGE_W - MARGIN * 2, PAGE_H - MARGIN * 2, "F");
    y = MARGIN + LINE_H;
  };

  /* ── Render line by line ─────────────────────────────── */
  pdf.setFont("courier", "normal");
  pdf.setFontSize(FONT_SIZE);

  const lines = code.split("\n");

  for (let li = 0; li < lines.length; li++) {
    if (y + LINE_H > PAGE_H - MARGIN) addCodePage();

    /* line number */
    pdf.setFontSize(FONT_SIZE - 0.5);
    pdf.setTextColor(75, 82, 99);
    pdf.text(String(li + 1), MARGIN + LN_W - 2, y, { align: "right" });
    pdf.setFontSize(FONT_SIZE);

    /* tokens */
    const tokens = tokenizePython(lines[li]);
    let x = CODE_LEFT;

    for (const tok of tokens) {
      if (tok.type === "newline") continue;
      const text = tok.text.replace(/\t/g, "    ");
      if (!text) continue;

      switch (tok.type) {
        case "keyword": pdf.setTextColor(198, 120, 221); break;
        case "builtin": pdf.setTextColor(97,  175, 239); break;
        case "string":  pdf.setTextColor(152, 195, 121); break;
        case "number":  pdf.setTextColor(209, 154, 102); break;
        case "comment": pdf.setTextColor(92,   99, 112); break;
        default:        pdf.setTextColor(171, 178, 191); break;
      }

      pdf.text(text, x, y);
      x += pdf.getTextWidth(text);
    }

    y += LINE_H;
  }

  pdf.save(`${fileName || "code-export"}.pdf`);
}
