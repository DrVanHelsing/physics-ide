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

/* ── Blocks → PDF (screenshot) ───────────────────────── */
export async function exportBlocksPdf() {
  // Find the Blockly workspace SVG container
  const blocklyHost = document.querySelector(".blockly-host");
  if (!blocklyHost) {
    window.alert("Switch to Blocks mode first to export the block workspace.");
    return;
  }

  const mainSvg = blocklyHost.querySelector(".blocklySvg");
  if (!mainSvg) {
    window.alert("No Blockly workspace found to capture.");
    return;
  }

  // Use html2canvas on the blockly host container
  const canvas = await html2canvas(blocklyHost, {
    backgroundColor: "#1e1e2e",
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgW = canvas.width;
  const imgH = canvas.height;

  // Create PDF — landscape if wider than tall
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
  const usableH = pageH - margin * 2 - 40; // leave room for title

  // Title
  pdf.setFontSize(16);
  pdf.setTextColor(60, 60, 80);
  pdf.text("Physics IDE — Block Workspace", margin, margin + 12);
  pdf.setFontSize(9);
  pdf.setTextColor(130, 130, 150);
  pdf.text(new Date().toLocaleString(), margin, margin + 26);

  // Scale image to fit
  const scale = Math.min(usableW / imgW, usableH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  pdf.addImage(imgData, "PNG", margin, margin + 40, drawW, drawH);
  pdf.save("blocks-workspace.pdf");
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
