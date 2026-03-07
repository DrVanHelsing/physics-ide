/*
 * GlowScript / VPython runner
 *
 * Runs each simulation inside an isolated iframe runtime so compiler/runtime
 * globals never leak across runs.
 */

import { traceRegistry } from './blocklyGenerator';

let activeRunToken = 0;
let activeFrameWindow = null;

/* ── Code-project trace entries (populated by instrumentPythonForDebug) ── */
let codeTraceEntries = [];

/**
 * Scan a VPython source string and inject _phtr_ trace assignments inside the
 * first while-loop body.  Returns the instrumented source and the corresponding
 * trace-registry entries so the compiled-JS injection can add postMessage calls
 * and pause checks automatically.
 *
 * Each injected variable gets a unique safeName  "varName_lineN" so that every
 * assignment site has its own blockId ("line_N"), enabling per-line breakpoints.
 */
export function instrumentPythonForDebug(pythonSource) {
  /* VPython 3D-object constructors — skip variables whose RHS starts with one */
  const SKIP_CONSTRUCTORS = [
    'sphere(', 'box(', 'cylinder(', 'arrow(', 'helix(', 'ring(',
    'curve(', 'points(', 'graph(', 'gcurve(', 'gdots(', 'gvbars(',
    'label(', 'wtext(', 'text(',
  ];

  /* Known builtins / VPython names to exclude from tracing */
  const BUILTINS = new Set([
    'sphere', 'box', 'cylinder', 'arrow', 'helix', 'ring', 'curve', 'points',
    'canvas', 'scene', 'vector', 'vec', 'color', 'textures',
    'rate', 'sleep', 'mag', 'norm', 'hat', 'cross', 'dot', 'diff_angle',
    'sqrt', 'abs', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
    'radians', 'degrees', 'pow', 'log', 'exp', 'pi',
    'min', 'max', 'sum', 'round', 'floor', 'ceil',
    'True', 'False', 'None', 'print', 'str', 'int', 'float', 'bool',
    'range', 'len', 'list', 'dict', 'set', 'tuple', 'type',
    'GlowScript', 'WebVPython',
    'graph', 'gcurve', 'gdots', 'bar', 'gvbars', 'label', 'wtext',
    'attach_trail', 'make_trail',
  ]);

  /*
   * Assignment regex: leading spaces + identifier + optional compound-op + '='
   * NOT followed by another '=' (avoids matching == comparisons).
   * Examples matched: "    t = 0", "  x += dt", "  KE *= 0.5"
   * Not matched: "  if x == 0:", "  obj.attr = v" (stops at the dot)
   */
  const ASSIGN_RE = /^(\s*)([a-zA-Z_]\w*)\s*(?:[+\-*/%&|^]|\*\*|\/\/)?=(?!=)/;

  const lines   = pythonSource.split('\n');
  const output  = [];
  const entries = [];  /* {safeName, displayName, blockId} */

  let inLoop        = false;
  let loopBaseIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const stripped = line.trimStart();
    output.push(line);

    if (!stripped || stripped.startsWith('#')) continue;

    /* Detect while-loop entry */
    const loopMatch = line.match(/^(\s*)while\s+/);
    if (loopMatch) {
      /* Only track the FIRST (outermost) while loop */
      if (!inLoop) {
        inLoop = true;
        loopBaseIndent = loopMatch[1].length;
      }
      continue;
    }

    /* Detect leaving the loop (non-blank non-comment at indent <= loopBase) */
    if (inLoop) {
      const indentLen = (line.match(/^(\s*)/) || ['', ''])[1].length;
      if (stripped && indentLen <= loopBaseIndent) {
        if (!stripped.match(/^(?:else|elif|except|finally)\b/)) {
          inLoop = false;
          loopBaseIndent = -1;
          /* Check if this line is ANOTHER while loop */
          const newLoop = line.match(/^(\s*)while\s+/);
          if (newLoop) { inLoop = true; loopBaseIndent = newLoop[1].length; }
        }
        if (!inLoop) continue;
      }
    }

    if (!inLoop) continue;

    const am = line.match(ASSIGN_RE);
    if (!am) continue;

    const indent  = am[1];
    const varName = am[2];

    /* Must be inside loop body */
    if (indent.length <= loopBaseIndent) continue;
    if (BUILTINS.has(varName)) continue;
    if (varName.startsWith('_')) continue;

    /* Skip VPython object constructor assignments */
    const eqIdx  = line.search(/(?:[+\-*/%&|^]|\*\*|\/\/)?=(?!=)/);
    const rhsTrim = eqIdx >= 0 ? line.slice(eqIdx + 1).trim() : '';
    if (SKIP_CONSTRUCTORS.some(c => rhsTrim.startsWith(c))) continue;

    const lineNum  = i + 1;                       /* 1-based */
    const safeName = `${varName}_line${lineNum}`;  /* unique per site */
    const blockId  = `line_${lineNum}`;            /* breakpoint key */

    entries.push({ safeName, displayName: varName, blockId });
    /* Inject trace assignment on the very next line */
    output.push(`${indent}_phtr_${safeName} = str(${varName})`);
  }

  return { source: output.join('\n'), entries };
}

const GLOWSCRIPT_SCRIPTS = {
  jquery: "https://cdn.jsdelivr.net/npm/jquery@2.1.4/dist/jquery.min.js",
  jqueryTextChange:
    "https://www.glowscript.org/lib/jquery/IDE/jquery.textchange.custom.js",
  jqueryUi:
    "https://www.glowscript.org/lib/jquery/IDE/jquery-ui.custom.min.js",
  glow: "https://www.glowscript.org/package/glow.3.2.min.js",
  compiler: "https://www.glowscript.org/package/RScompiler.3.2.min.js",
  run: "https://www.glowscript.org/package/RSrun.3.2.min.js",
};

function normalizeScriptUrl(url) {
  return String(url || "").split("#")[0].split("?")[0];
}

function hasScriptLoaded(doc, src) {
  const target = normalizeScriptUrl(src);
  const scripts = Array.from(doc.getElementsByTagName("script"));
  return scripts.some((s) => normalizeScriptUrl(s.src) === target);
}

function loadScriptInFrame(frameWindow, src) {
  const doc = frameWindow.document;

  return new Promise((resolve, reject) => {
    if (hasScriptLoaded(doc, src)) {
      resolve();
      return;
    }

    const script = doc.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load script: " + src));
    doc.head.appendChild(script);
  });
}

function buildGlowScriptDiag(frameWindow) {
  return {
    jQuery: !!frameWindow.jQuery,
    jQueryUiResizable:
      !!(
        frameWindow.jQuery &&
        frameWindow.jQuery.fn &&
        frameWindow.jQuery.fn.resizable
      ),
    GlowScript: !!frameWindow.GlowScript,
    glowscript_compile: typeof frameWindow.glowscript_compile,
    call_acorn_parse: typeof frameWindow.call_acorn_parse,
    acorn_parse:
      frameWindow.acorn && typeof frameWindow.acorn.parse !== "undefined"
        ? typeof frameWindow.acorn.parse
        : "missing",
  };
}

async function ensureGlowScriptLoaded(frameWindow) {
  await loadScriptInFrame(frameWindow, GLOWSCRIPT_SCRIPTS.jquery);
  await loadScriptInFrame(frameWindow, GLOWSCRIPT_SCRIPTS.jqueryTextChange);
  await loadScriptInFrame(frameWindow, GLOWSCRIPT_SCRIPTS.jqueryUi);
  await loadScriptInFrame(frameWindow, GLOWSCRIPT_SCRIPTS.glow);
  await loadScriptInFrame(frameWindow, GLOWSCRIPT_SCRIPTS.compiler);
  await loadScriptInFrame(frameWindow, GLOWSCRIPT_SCRIPTS.run);

  if (
    !frameWindow.jQuery ||
    !frameWindow.jQuery.fn ||
    typeof frameWindow.jQuery.fn.resizable !== "function"
  ) {
    throw new Error(
      "GlowScript runtime dependency missing: jQuery UI resizable() not loaded. Diagnostics: " +
        JSON.stringify(buildGlowScriptDiag(frameWindow))
    );
  }

  if (typeof frameWindow.glowscript_compile !== "function") {
    throw new Error(
      "GlowScript compiler did not load (RScompiler). Diagnostics: " +
        JSON.stringify(buildGlowScriptDiag(frameWindow))
    );
  }

  if (typeof frameWindow.call_acorn_parse !== "function") {
    if (frameWindow.acorn && typeof frameWindow.acorn.parse === "function") {
      frameWindow.call_acorn_parse = frameWindow.acorn.parse.bind(
        frameWindow.acorn
      );
    } else {
      throw new Error(
        "GlowScript parser did not initialize correctly (call_acorn_parse missing). Diagnostics: " +
          JSON.stringify(buildGlowScriptDiag(frameWindow))
      );
    }
  }
}

function createRuntimeFrame(host) {
  const currentTheme =
    document.documentElement.getAttribute("data-theme") ||
    document.body.getAttribute("data-theme") ||
    "dark";
  const isLight = currentTheme === "light";
  /* Deep-space black for dark mode, clean off-white for light */
  const viewportBg        = isLight ? "#f2f4f8"  : "#040611";
  const viewportTextColor = isLight ? "#111827"  : "#dde4f8";
  const linkColor         = isLight ? "#1d4ed8"  : "#7db5ff";

  const iframe = document.createElement("iframe");
  iframe.title = "GlowScript Runtime";
  iframe.setAttribute("aria-label", "GlowScript Runtime");
  iframe.style.width   = "100%";
  iframe.style.height  = "100%";
  iframe.style.border  = "0";
  iframe.style.display = "block";

  host.innerHTML = "";
  host.appendChild(iframe);

  const frameDoc = iframe.contentDocument;
  frameDoc.open();
  frameDoc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0;
        width: 100%; height: 100%;
        overflow: hidden;
        background: ${viewportBg};
        color: ${viewportTextColor};
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
      }
      #glowscript-root {
        width: 100%; height: 100%;
        overflow: hidden;
        background: ${viewportBg};
      }
      #glowscript {
        width: 100%; height: 100%;
        background: ${viewportBg};
      }
      /* Canvas fills the container without any scaling artefacts */
      #glowscript canvas {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        background: ${viewportBg};
        outline: none;
        border: none;
      }
      /* Override injected text colours */
      #glowscript-root * { color: ${viewportTextColor} !important; }
      #glowscript a { color: ${linkColor} !important; }
      /* Overlay elements injected by GlowScript (info text etc.) */
      div[id="glowscript"] > div {
        font-family: system-ui, sans-serif !important;
        font-size: 12px !important;
      }
    </style>
  </head>
  <body>
    <div id="glowscript-root"></div>
  </body>
</html>`);
  frameDoc.close();

  return iframe;
}

function getCompileFn(frameWindow) {
  return (
    frameWindow.glowscript_compile ||
    (frameWindow.GlowScript && frameWindow.GlowScript.compile)
  );
}

function buildSource(codeString) {
  const sanitized = String(codeString || "")
    .replace(/^\s*;+\s*$/gm, "")
    .replace(/(;+)\s*$/gm, "");

  const trimmed = sanitized.trimStart();
  const firstLine = trimmed.split(/\r?\n/, 1)[0] || "";
  const hasHeader = /^(GlowScript|Web\s+VPython)\s/i.test(firstLine);

  const source = hasHeader ? trimmed : "GlowScript 3.2 VPython\n" + trimmed;

  if (!source || source.length === 0) {
    throw new Error("Compile error: VPython source is empty.");
  }

  /* ── DEBUG: log the Python source so we can spot the ';' problem ── */
  console.log(
    "[PhysicsIDE] Python source (" + source.split("\n").length + " lines):\n" +
    source.slice(0, 4000) + (source.length > 4000 ? "\n…(truncated)" : "")
  );

  return source;
}

function compileSource(compile, source) {
  const normalized = source.replace(/\r\n?/g, "\n");
  const compileAttempts = [
    {
      src: normalized,
      opts: { lang: "vpython", version: "3.2", run: true, nodictionary: false },
    },
    {
      src: normalized + "\n",
      opts: { lang: "vpython", version: "3.2", run: true, nodictionary: false },
    },
    { src: normalized, opts: { lang: "vpython", version: "3.2" } },
    { src: normalized + "\n", opts: { lang: "vpython", version: "3.2" } },
  ];

  let compiled = null;
  let lastCompileError = null;

  for (const attempt of compileAttempts) {
    try {
      compiled = compile(attempt.src, attempt.opts);
      lastCompileError = null;
      break;
    } catch (err) {
      lastCompileError = err;
    }
  }

  if (lastCompileError) {
    const srcPreview = source.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      "Compile error: " +
        (lastCompileError.message || lastCompileError) +
        " | src: " +
        srcPreview
    );
  }

  return compiled;
}

function extractCompiledCode(compiled) {
  const compiledCode =
    typeof compiled === "string"
      ? compiled
      : typeof compiled?.program === "string"
      ? compiled.program
      : typeof compiled?.code === "string"
      ? compiled.code
      : "";

  if (!compiledCode || !compiledCode.trim()) {
    throw new Error("GlowScript compile produced empty output.");
  }

  return compiledCode;
}

async function executeCompiled(frameWindow, compiledCode, traceEntries) {
  activeFrameWindow = frameWindow;
  frameWindow.__physide_paused = false;
  frameWindow.__physide_steps = 0;
  frameWindow.__physide_breakpoints = new Set();
  const mount = frameWindow.document.createElement("div");
  mount.id = "glowscript";
  mount.style.width = "100%";
  mount.style.height = "100%";

  const root = frameWindow.document.getElementById("glowscript-root");
  if (!root) {
    throw new Error("GlowScript runtime mount root not found.");
  }

  root.innerHTML = "";
  root.appendChild(mount);

  const jqContainer =
    typeof frameWindow.jQuery === "function"
      ? frameWindow.jQuery(mount)
      : mount;

  frameWindow.__context = { glowscript_container: jqContainer };
  frameWindow.glowscript_container = jqContainer;

  if (frameWindow.GlowScript) {
    frameWindow.GlowScript.context = {
      glowscript_container: frameWindow.document.getElementById("glowscript"),
    };
  }

  /* Inject live-trace by modifying compiled JS.
     During Python generation, tr() emits  _phtr_SAFENAME = str(EXPR)  for each
     traced variable.  After RapydScript compiles, we regex-find those assignments
     in the JS and append parent.postMessage(...) so trace data flows to the
     React TraceTable via window.__physide_trace_cb.  */
  let traceInjected = compiledCode;
  if (traceEntries.length > 0) {
    // Build safe-name → display-name lookup
    const nameMap = {};
    for (const entry of traceEntries) {
      nameMap[entry.safeName] = entry;
    }
    // Single regex pass over compiled JS
    traceInjected = traceInjected.replace(
      /((?:var\s+)?_phtr_(\w+)\s*=\s*)([^;\n]+)(;?)/g,
      function (match, prefix, safeName, value, semi) {
        const entry = nameMap[safeName];
        if (!entry) return match;
        const dn = entry.displayName.replace(/'/g, "\\'");
        const bid = (entry.blockId || '').replace(/'/g, "\\'");
        return (
          prefix + value + semi +
          "try{parent.postMessage({type:'__phtr',n:'" + dn +
          "',v:String(_phtr_" + safeName +
          "),b:'" + bid + "'},'*');" +
          "if(window.__physide_breakpoints&&window.__physide_breakpoints.has('" + bid + "')){" +
          "window.__physide_paused=true;window.__physide_steps=0;}" +
          "if(window.__physide_paused){" +
          "if(window.__physide_steps>0){window.__physide_steps--;}" +
          "else{await new Promise(function(r){" +
          "var _pi=setInterval(function(){" +
          "if(!window.__physide_paused||window.__physide_steps>0){" +
          "clearInterval(_pi);" +
          "if(window.__physide_steps>0)window.__physide_steps--;" +
          "r();}},30);})}" +
          "}}catch(_e){}"
        );
      }
    );
  }

  try {
    frameWindow.eval(traceInjected);
  } catch (runtimeErr) {
    /* ── DEBUG: show the compiled JS around the problem ── */
    console.error(
      "[PhysicsIDE] eval() failed:", runtimeErr.message,
      "\nCompiled JS preview (first 1000 chars):\n",
      traceInjected.slice(0, 1000)
    );
    throw new Error("Runtime error: " + (runtimeErr.message || runtimeErr));
  }

  if (typeof frameWindow.__main__ === "function") {
    try {
      const maybePromise = frameWindow.__main__();
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.catch((runtimeErr) => {
          console.error("GlowScript runtime async error:", runtimeErr);
        });
      }
    } catch (runtimeErr) {
      throw new Error("Runtime error: " + (runtimeErr.message || runtimeErr));
    }
  }

  const fallbackEntrypoints = [
    frameWindow.__context && frameWindow.__context.__main__,
    frameWindow.__context && frameWindow.__context.glowscript_main,
    frameWindow.glowscript_main,
    frameWindow.main,
  ].filter((fn) => typeof fn === "function");

  if (
    !frameWindow.document.querySelector("canvas") &&
    fallbackEntrypoints.length > 0
  ) {
    for (const entrypoint of fallbackEntrypoints) {
      const result = entrypoint();
      if (result && typeof result.then === "function") {
        result.catch((runtimeErr) => {
          console.error("GlowScript fallback async error:", runtimeErr);
        });
      }
    }
  }
}

export async function runPython(codeString, hostId = "glowscript-host") {
  activeRunToken += 1;
  const thisRunToken = activeRunToken;

  /* Reset code-project trace entries for this run */
  codeTraceEntries = [];

  if (typeof codeString !== "string") {
    throw new Error("Compile error: VPython source is not a string.");
  }

  const host = document.getElementById(hostId);
  if (!host) {
    throw new Error("GlowScript host container (#" + hostId + ") not found in DOM.");
  }

  const runtimeFrame = createRuntimeFrame(host);
  const frameWindow = runtimeFrame.contentWindow;

  try {
    await ensureGlowScriptLoaded(frameWindow);

    if (thisRunToken !== activeRunToken) {
      return;
    }

    const compile = getCompileFn(frameWindow);
    if (typeof compile !== "function") {
      throw new Error("GlowScript compiler did not load. Check runtime scripts.");
    }

    if (!frameWindow.RapydScript && frameWindow.RS && frameWindow.RS.RapydScript) {
      frameWindow.RapydScript = frameWindow.RS.RapydScript;
    }

    const source = buildSource(codeString);

    /* For code-only projects (no block trace declarations), auto-instrument
       the source so that pause/step/trace work exactly like block projects. */
    let compilableSource = source;
    let traceEntries = traceRegistry;
    if (traceRegistry.length === 0) {
      const result = instrumentPythonForDebug(source);
      compilableSource = result.source;
      codeTraceEntries = result.entries;
      traceEntries = codeTraceEntries;
      if (codeTraceEntries.length > 0) {
        console.log(
          "[PhysicsIDE] Code instrumentation: " + codeTraceEntries.length + " trace vars injected"
        );
      }
    }

    const compiled = compileSource(compile, compilableSource);
    const compiledCode = extractCompiledCode(compiled);

    await executeCompiled(frameWindow, compiledCode, traceEntries);

    if (thisRunToken !== activeRunToken) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120));

    const renderedCanvas = frameWindow.document.querySelector("canvas");
    if (!renderedCanvas) {
      const preview = compiledCode.slice(0, 300).replace(/\s+/g, " ");
      throw new Error(
        "GlowScript executed but no canvas was rendered. __main__: " +
          typeof frameWindow.__main__ +
          ". Preview: " +
          preview
      );
    }
  } catch (err) {
    if (host.contains(runtimeFrame) && thisRunToken !== activeRunToken) {
      return;
    }
    throw new Error("Execution error: " + (err.message || err));
  }
}

export function stopPython(hostId = "glowscript-host") {
  activeRunToken += 1;
  activeFrameWindow = null;

  const host = document.getElementById(hostId);
  if (host) {
    host.innerHTML = "";
  }
}

export function pausePython() {
  if (activeFrameWindow) {
    activeFrameWindow.__physide_paused = true;
    activeFrameWindow.__physide_steps = 0;
  }
}

export function resumePython() {
  if (activeFrameWindow) {
    activeFrameWindow.__physide_paused = false;
    activeFrameWindow.__physide_steps = 0;
  }
}

export function stepPython() {
  if (activeFrameWindow) {
    activeFrameWindow.__physide_paused = true;
    activeFrameWindow.__physide_steps = (activeFrameWindow.__physide_steps || 0) + 1;
  }
}

export function setBreakpoints(bpSet) {
  if (activeFrameWindow) {
    activeFrameWindow.__physide_breakpoints = bpSet instanceof Set ? bpSet : new Set(bpSet);
  }
}
