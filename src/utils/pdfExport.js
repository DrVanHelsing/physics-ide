/**
 * pdfExport.js
 *
 * Export blocks (as a screenshot) or code (syntax-highlighted) to PDF.
 * Uses jsPDF + html2canvas.
 */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

/**
 * Build a syntax-highlighted HTML string from Python source code.
 */
function buildHighlightedHtml(code) {
  const tokens = tokenizePython(code);

  const COLORS = {
    keyword:  "#c678dd",
    builtin:  "#61afef",
    string:   "#98c379",
    number:   "#d19a66",
    comment:  "#5c6370",
    ident:    "#e5e5e5",
    punct:    "#abb2bf",
    ws:       "",
    newline:  "",
  };

  let html = "";
  for (const t of tokens) {
    if (t.type === "newline") {
      html += "<br/>";
      continue;
    }
    if (t.type === "ws") {
      html += t.text.replace(/ /g, "&nbsp;");
      continue;
    }
    const escaped = t.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const col = COLORS[t.type] || COLORS.ident;
    html += `<span style="color:${col}">${escaped}</span>`;
  }
  return html;
}

/* ── Blocks → PDF (full workspace capture) ───────────── */
export async function exportBlocksPdf(workspace) {
  const blocklyHost = document.querySelector(".blockly-host");
  if (!blocklyHost || !workspace) {
    window.alert("Switch to Blocks mode first to export the block workspace.");
    return;
  }

  const blocks = workspace.getAllBlocks(false);
  if (blocks.length === 0) {
    window.alert("No blocks to export.");
    return;
  }

  // Bounding box in workspace coordinates
  const bbox = workspace.getBlocksBoundingBox();
  const contentW = bbox.right - bbox.left;
  const contentH = bbox.bottom - bbox.top;
  if (contentW === 0 || contentH === 0) {
    window.alert("No blocks to export.");
    return;
  }

  // Save original state
  const origScale = workspace.getScale();
  const origScrollX = workspace.scrollX;
  const origScrollY = workspace.scrollY;
  const origHostCss = blocklyHost.style.cssText;

  // Hide toolbox so blocks get full width
  const toolbox = blocklyHost.querySelector(".blocklyToolboxDiv");
  const flyout = blocklyHost.querySelector(".blocklyFlyout");
  const origToolboxDisplay = toolbox ? toolbox.style.display : null;
  const origFlyoutDisplay = flyout ? flyout.style.display : null;
  if (toolbox) toolbox.style.display = "none";
  if (flyout) flyout.style.display = "none";

  const padding = 60;
  const renderW = contentW + padding * 2;
  const renderH = contentH + padding * 2;

  try {
    // Move host off-screen and resize to fit all blocks
    blocklyHost.style.position = "fixed";
    blocklyHost.style.top = "-30000px";
    blocklyHost.style.left = "0";
    blocklyHost.style.width = renderW + "px";
    blocklyHost.style.height = renderH + "px";
    blocklyHost.style.zIndex = "-1";
    blocklyHost.style.overflow = "hidden";

    // Set scale 1:1 and resize Blockly SVG to fill container
    workspace.setScale(1);
    if (workspace.resize) workspace.resize();

    // Scroll so blocks start at the padding offset
    workspace.scroll(padding - bbox.left, padding - bbox.top);

    // Allow Blockly to re-render
    await new Promise((r) => setTimeout(r, 250));

    // Capture with html2canvas
    const canvas = await html2canvas(blocklyHost, {
      backgroundColor: "#1a1b2e",
      scale: 2,
      useCORS: true,
      logging: false,
      width: renderW,
      height: renderH,
    });

    // ── Generate paginated PDF ──────────────────────────
    const imgData = canvas.toDataURL("image/png");
    const imgW = canvas.width;
    const imgH = canvas.height;

    const landscape = imgW > imgH;
    const pdf = new jsPDF({
      orientation: landscape ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const usableW = pageW - margin * 2;

    // Title
    pdf.setFontSize(16);
    pdf.setTextColor(60, 60, 80);
    pdf.text("Physics IDE \u2014 Block Workspace", margin, margin + 12);
    pdf.setFontSize(9);
    pdf.setTextColor(130, 130, 150);
    pdf.text(new Date().toLocaleString(), margin, margin + 26);

    const titleH = 40;
    const firstPageH = pageH - margin * 2 - titleH;
    const otherPageH = pageH - margin * 2;

    // Scale image to fit page width
    const pdfScale = usableW / imgW;
    const drawW = imgW * pdfScale;
    const drawH = imgH * pdfScale;

    if (drawH <= firstPageH) {
      pdf.addImage(imgData, "PNG", margin, margin + titleH, drawW, drawH);
    } else {
      // Paginate across multiple pages
      let yOffset = 0;
      let page = 0;
      while (yOffset < drawH) {
        if (page > 0) pdf.addPage();
        const usableH = page === 0 ? firstPageH : otherPageH;
        const topMargin = page === 0 ? margin + titleH : margin;
        const sliceH = Math.min(usableH, drawH - yOffset);
        const srcSliceH = sliceH / pdfScale;

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(srcSliceH);
        const ctx = sliceCanvas.getContext("2d");
        ctx.drawImage(
          canvas,
          0,
          Math.floor(yOffset / pdfScale),
          canvas.width,
          Math.ceil(srcSliceH),
          0,
          0,
          canvas.width,
          Math.ceil(srcSliceH)
        );

        const sliceData = sliceCanvas.toDataURL("image/png");
        pdf.addImage(sliceData, "PNG", margin, topMargin, drawW, sliceH);

        yOffset += sliceH;
        page++;
      }
    }

    pdf.save("blocks-workspace.pdf");
  } finally {
    // Restore original state
    blocklyHost.style.cssText = origHostCss;
    if (toolbox) toolbox.style.display = origToolboxDisplay || "";
    if (flyout) flyout.style.display = origFlyoutDisplay || "";
    workspace.setScale(origScale);
    if (workspace.resize) workspace.resize();
    workspace.scroll(origScrollX, origScrollY);
  }
}

/* ── Code → PDF (syntax highlighted) ─────────────────── */
export async function exportCodePdf(code) {
  if (!code || !code.trim()) {
    window.alert("No code to export.");
    return;
  }

  // Create a hidden container with highlighted code
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    top: -10000px;
    left: 0;
    width: 680px;
    padding: 32px 28px;
    background: #282c34;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 12px;
    line-height: 1.7;
    color: #abb2bf;
    border-radius: 8px;
    z-index: -1;
  `;

  // Title header
  const header = document.createElement("div");
  header.style.cssText = `
    margin-bottom: 18px;
    padding-bottom: 12px;
    border-bottom: 1px solid #3e4451;
  `;
  header.innerHTML = `
    <div style="font-family: Inter, system-ui, sans-serif; font-size: 16px; font-weight: 600; color: #e5e5e5; margin-bottom: 4px;">
      Physics IDE — Python Source
    </div>
    <div style="font-family: Inter, system-ui, sans-serif; font-size: 10px; color: #5c6370;">
      ${new Date().toLocaleString()} &nbsp;|&nbsp; VPython 3.2
    </div>
  `;
  container.appendChild(header);

  // Line numbers + highlighted code
  const lines = code.split("\n");
  const codeBlock = document.createElement("div");
  codeBlock.style.cssText = "display: flex; gap: 0;";

  // Line numbers column
  const lineNums = document.createElement("div");
  lineNums.style.cssText = `
    text-align: right;
    padding-right: 14px;
    margin-right: 14px;
    border-right: 1px solid #3e4451;
    color: #4b5263;
    font-size: 11px;
    line-height: 1.7;
    user-select: none;
    min-width: 28px;
  `;
  lineNums.innerHTML = lines.map((_, i) => `${i + 1}<br/>`).join("");

  // Code column
  const codeCol = document.createElement("div");
  codeCol.style.cssText = `
    flex: 1;
    min-width: 0;
    white-space: pre-wrap;
    word-break: break-all;
  `;
  codeCol.innerHTML = buildHighlightedHtml(code);

  codeBlock.appendChild(lineNums);
  codeBlock.appendChild(codeCol);
  container.appendChild(codeBlock);
  document.body.appendChild(container);

  // Capture to canvas
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: "#282c34",
      scale: 2,
      logging: false,
    });

    const imgW = canvas.width;
    const imgH = canvas.height;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const usableW = pageW - margin * 2;

    const scale = usableW / imgW;
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    // If the rendered code is taller than one page, paginate
    const usablePageH = pageH - margin * 2;
    let yOffset = 0;
    let page = 0;

    while (yOffset < drawH) {
      if (page > 0) pdf.addPage();

      // How much of the source image fits on this page
      const sliceH = Math.min(usablePageH, drawH - yOffset);
      const srcSliceH = sliceH / scale;

      // Create a temporary canvas for this page slice
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.ceil(srcSliceH);
      const ctx = sliceCanvas.getContext("2d");
      ctx.drawImage(
        canvas,
        0, Math.floor(yOffset / scale),
        canvas.width, Math.ceil(srcSliceH),
        0, 0,
        canvas.width, Math.ceil(srcSliceH)
      );

      const sliceData = sliceCanvas.toDataURL("image/png");
      pdf.addImage(sliceData, "PNG", margin, margin, drawW, sliceH);

      yOffset += sliceH;
      page++;
    }

    pdf.save("code-export.pdf");
  } finally {
    document.body.removeChild(container);
  }
}
