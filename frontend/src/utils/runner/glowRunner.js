/*
 * GlowScript / VPython runner
 *
 * Runs each simulation inside an isolated iframe runtime so compiler/runtime
 * globals never leak across runs.
 */

import { traceRegistry } from '../blockly/traceRegistry';
import { instrumentPythonForDebug } from './instrumentor';
import { DEBUG_RUNNER } from '../../constants';

let activeRunToken = 0;
let activeFrameWindow = null;

/** Set by useSimulation so a rejection AFTER runPython resolves can still
 *  reach the status bar. Before Tranche 3 these only console.error'd, so a
 *  dead simulation went on claiming it was running. */
let runtimeErrorSink = null;

export function setRuntimeErrorSink(fn) {
  runtimeErrorSink = typeof fn === "function" ? fn : null;
}

function reportAsyncRuntimeError(err) {
  console.error("[PhysicsIDE] runtime error after start:", err);
  if (runtimeErrorSink) runtimeErrorSink(err);
}

/* ── Code-project trace entries (populated by instrumentPythonForDebug) ── */
let codeTraceEntries = [];

// instrumentPythonForDebug is imported from './instrumentor'.
// It is also re-exported here so existing callers that import from glowRunner
// do not need updating.
export { instrumentPythonForDebug };

/** The GlowScript release the six pinned URLs below belong to. Exported so the
 *  status bar cannot drift from what actually loads (IDELayout.js used to
 *  hardcode "VPython 3.2" with nothing keeping the two in step). */
export const GLOWSCRIPT_VERSION = "3.2";

const VENDOR_BASE = "/vendor/glowscript";
export const GLOWSCRIPT_SCRIPTS = {
  jquery: `${VENDOR_BASE}/jquery.min.js`,
  jqueryTextChange: `${VENDOR_BASE}/jquery.textchange.custom.js`,
  jqueryUi: `${VENDOR_BASE}/jquery-ui.custom.min.js`,
  glow: `${VENDOR_BASE}/glow.${GLOWSCRIPT_VERSION}.min.js`,
  compiler: `${VENDOR_BASE}/RScompiler.${GLOWSCRIPT_VERSION}.min.js`,
  run: `${VENDOR_BASE}/RSrun.${GLOWSCRIPT_VERSION}.min.js`,
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

/** The two viewport themes. Deep-space black for dark, clean off-white for light. */
export const VIEWPORT_THEME = {
  dark:  { bg: "#040611", text: "#dde4f8", link: "#7db5ff" },
  light: { bg: "#f2f4f8", text: "#111827", link: "#1d4ed8" },
};

/** The label colours this app is allowed to overwrite when the theme flips.
 *
 *  A telemetry label is drawn INSIDE the 3D scene by the student's own
 *  program, so it cannot read a CSS variable — the generator emits a literal
 *  `color=color.white` (blocklyGenerator.js, label_block / label_full_block).
 *  In dark mode that is right; in light mode the scene background is #f2f4f8
 *  and white-on-near-white is about 1.05:1, i.e. invisible. That is the bug.
 *
 *  We cannot fix it at generation time: exported .py files must stay valid
 *  standalone VPython, so the emitted colour has to be a literal and cannot
 *  reference anything this app defines. So the runtime rethemes instead —
 *  the same way it already rethemes scene.background.
 *
 *  The set below is what makes that safe. Only a label still wearing the
 *  GENERATOR'S DEFAULT (white) or a colour WE previously assigned is
 *  repainted. A student who chose their own colour keeps it, in both themes.
 */
const RETHEMEABLE_LABEL_COLOURS = new Set([
  "#ffffff",
  VIEWPORT_THEME.dark.text.toLowerCase(),
  VIEWPORT_THEME.light.text.toLowerCase(),
]);

/** Pure. GlowScript colours are vec(r,g,b) floats in 0..1. */
export function labelColourToHex(c) {
  if (!c || typeof c.x !== "number") return null;
  const h = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${h(c.x)}${h(c.y)}${h(c.z)}`;
}

/** Pure: the colour a label should take for this theme, or null to leave it
 *  alone. Exported so the decision is unit-testable without a live scene. */
export function nextLabelColour(currentHex, isDark) {
  if (!currentHex) return null;
  if (!RETHEMEABLE_LABEL_COLOURS.has(currentHex.toLowerCase())) return null;
  return (isDark ? VIEWPORT_THEME.dark : VIEWPORT_THEME.light).text;
}

/** Pure: the runtime frame's stylesheet for a given theme. Injected at frame
 *  creation and re-injected on every theme toggle, so a running simulation
 *  rethemes with the panes around it instead of staying in the old theme. */
export function viewportStyleText({ bg, text, link }) {
  return `
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0; padding: 0;
        width: 100%; height: 100%;
        overflow: hidden;
        background: ${bg};
        color: ${text};
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
      }
      /* overflow-y auto, not hidden (Plan 10 Task 3): GlowScript appends
         graph panels as .glowscript-graph siblings BELOW the 3D canvas
         wrapper, and a hidden overflow made every live graph invisible.
         With graphs present the scene YIELDS to ~55% (resizeRuntimeCanvas)
         and the canvas renders attr-sized below, so the first graph's top
         edge is above the fold — the pane scrolls for the rest. */
      #glowscript-root { width: 100%; height: 100%; overflow-y: auto; overflow-x: hidden; background: ${bg}; }
      #glowscript { width: 100%; height: 100%; background: ${bg}; }
      /* Scoped to the SCENE canvas (wrapper child, or a bare direct child on
         older layouts) — graph panels are Plotly SVG plots
         (.glowscript-graph.js-plotly-plot) whose own sizing a forced 100%
         would corrupt. */
      #glowscript .glowscript-canvas-wrapper canvas,
      #glowscript > canvas {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        background: ${bg};
        outline: none;
        border: none;
      }
      /* With graphs present, the canvas displays at its ATTRIBUTE size —
         resizeRuntimeCanvas sets scene.height to the yielded split, and a
         forced CSS 100% would stretch/desync the GL viewport (the measured
         failure mode the resize comment records). */
      #glowscript:has(.glowscript-graph) .glowscript-canvas-wrapper,
      #glowscript:has(.glowscript-graph) .glowscript-canvas-wrapper canvas,
      #glowscript:has(.glowscript-graph) > canvas {
        height: auto !important;
      }
      /* Live graph panels: white cards whatever the theme — Plotly draws
         its axes and labels in dark ink on white paper, so the card
         supplies the contrast the dark theme cannot. Fixed-width plots
         scroll within their own card on narrow panes rather than being
         clipped by the root's hidden x-overflow. */
      #glowscript .glowscript-graph {
        margin: 10px 12px;
        padding: 6px;
        background: #ffffff;
        border-radius: 6px;
        overflow-x: auto;
      }
      #glowscript-root * { color: ${text} !important; }
      #glowscript a { color: ${link} !important; }
      div[id="glowscript"] > div { font-family: system-ui, sans-serif !important; font-size: 12px !important; }
  `;
}

function currentViewportTheme() {
  const attr =
    document.documentElement.getAttribute("data-theme") ||
    document.body.getAttribute("data-theme") ||
    "dark";
  return attr === "light" ? VIEWPORT_THEME.light : VIEWPORT_THEME.dark;
}

function createRuntimeFrame(host) {
  const theme = currentViewportTheme();

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
    <style id="physide-theme">${viewportStyleText(theme)}</style>
  </head>
  <body>
    <div id="glowscript-root"></div>
  </body>
</html>`);
  frameDoc.close();

  const frameWindow = iframe.contentWindow;
  frameWindow.addEventListener("error", (e) => reportAsyncRuntimeError(e.error || e.message));
  frameWindow.addEventListener("unhandledrejection", (e) => reportAsyncRuntimeError(e.reason));

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

  if (DEBUG_RUNNER) {
    console.log(
      "[PhysicsIDE] Python source (" + source.split("\n").length + " lines):\n" +
      source.slice(0, 4000) + (source.length > 4000 ? "\n…(truncated)" : "")
    );
  }

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

/** Index of the last non-whitespace character at or before `from`, or -1
 *  (meaning "start of string" — a legitimate statement boundary). */
function lastNonSpaceIndex(source, from) {
  let i = from;
  while (i >= 0 && /\s/.test(source[i])) i--;
  return i;
}

/** Index of the first non-whitespace character at or after `from`, or -1
 *  if only whitespace remains. */
function nextNonSpaceIndex(source, from) {
  let i = from;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i < source.length ? i : -1;
}

/** From `openIdx` (the index just past an opening "("), the index of its
 *  matching closing ")" by depth-counting, or -1 if unbalanced. */
function findMatchingParen(source, openIdx) {
  let depth = 1;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Rewrites every rate()-call statement in compiled GlowScript JS to run
 *  `bookkeeping` immediately before it, wrapping the ENTIRE original
 *  statement — verbatim, whatever shape it is — inside a fresh `{ }` block.
 *
 *  Why a whole-statement wrap rather than "insert text right before
 *  `rate(`": RapydScript does not always emit a bare `rate(240);` statement.
 *  The confirmed real shape (captured from an actual compile, see Task 15
 *  fix round 2) is a PARENTHESIZED expression-statement —
 *  `(await rate(240));` — and plain `await rate(240);` / bare `rate(240);`
 *  are also plausible depending on where the call falls in RapydScript's
 *  async-generator rewrite. Textually inserting a semicolon-separated
 *  statement sequence right before `rate(` is only valid for the bare form:
 *  inside `(await rate(240))`'s parens, a statement sequence is not a legal
 *  expression, so that shape always threw "SyntaxError: Unexpected token
 *  ';'" at `frameWindow.eval()` — the release-blocking regression this
 *  rewrite fixes. A `{ }` block is legal wherever a statement is legal, so
 *  wrapping the original statement (parens and all) inside one, with the
 *  bookkeeping as an earlier statement in the same block, is valid for all
 *  three shapes without needing to special-case which one it is.
 *
 *  Defensive: `rate(` occurrences that are NOT their own statement (e.g.
 *  embedded in a larger expression, or a "(" that turns out to belong to an
 *  unrelated call rather than a statement-wrapping paren) are left
 *  completely untouched rather than guessed at — see the boundary checks
 *  below. */
export function injectFrameBoundaries(source, bookkeeping) {
  const RATE_RE = /\b(?:await\s+)?rate\s*\(/g;
  let result = "";
  let cursor = 0;
  let match;

  while ((match = RATE_RE.exec(source))) {
    const callStart = match.index; // start of "await" or "rate"
    const argStart = RATE_RE.lastIndex; // just past "rate("

    const argClose = findMatchingParen(source, argStart);
    if (argClose === -1) continue; // unbalanced parens — leave untouched

    // Does a standalone "(" immediately (mod whitespace) precede this call,
    // itself immediately preceded by a genuine statement boundary (";", "{",
    // "}", or the start of the file)? That is RapydScript's parenthesized
    // expression-statement form. Anything else preceding the call — an
    // identifier, a comma, an operator, a function name's own "(" — means
    // `rate(` is embedded in some other expression or call, not its own
    // statement, and must be left alone.
    const beforeCall = lastNonSpaceIndex(source, callStart - 1);
    let stmtStart = callStart;
    let wrapCloseExpected = false;

    if (beforeCall !== -1 && source[beforeCall] === "(") {
      const beforeWrap = lastNonSpaceIndex(source, beforeCall - 1);
      const atBoundary = beforeWrap === -1 || ";{}".includes(source[beforeWrap]);
      if (!atBoundary) continue; // that "(" belongs to a real call/expression
      stmtStart = beforeCall;
      wrapCloseExpected = true;
    } else if (beforeCall !== -1 && !";{}".includes(source[beforeCall])) {
      continue; // rate() is embedded in some other expression
    }

    let afterArgs = argClose + 1;
    if (wrapCloseExpected) {
      const closeParenIdx = nextNonSpaceIndex(source, afterArgs);
      if (closeParenIdx === -1 || source[closeParenIdx] !== ")") continue;
      afterArgs = closeParenIdx + 1;
    }
    const semiIdx = nextNonSpaceIndex(source, afterArgs);
    if (semiIdx === -1 || source[semiIdx] !== ";") continue;
    const stmtEnd = semiIdx + 1;

    result += source.slice(cursor, stmtStart);
    result += "{" + bookkeeping + source.slice(stmtStart, stmtEnd) + "}";
    cursor = stmtEnd;
    RATE_RE.lastIndex = stmtEnd;
  }
  result += source.slice(cursor);
  return result;
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

async function executeCompiled(frameWindow, compiledCode, traceEntries, initialBreakpoints) {
  activeFrameWindow = frameWindow;
  frameWindow.__physide_paused = false;
  frameWindow.__physide_steps = 0;
  frameWindow.__physide_iter = 0;
  frameWindow.__physide_frame_steps = 0;
  /* Seeded BEFORE eval so a breakpoint aimed at the FIRST iteration — the
     common case when debugging initial conditions — actually catches it.
     Until Tranche 3 this was `new Set()` and useSimulation re-armed it after
     `await runPython`, which returns 120 ms after __main__() starts the loop. */
  frameWindow.__physide_breakpoints =
    initialBreakpoints instanceof Set ? new Set(initialBreakpoints) : new Set(initialBreakpoints || []);
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
        const sc = (entry.scope || 'loop').replace(/'/g, "\\'");
        return (
          prefix + value + semi +
          "try{parent.postMessage({type:'__phtr',n:'" + dn +
          "',v:String(_phtr_" + safeName +
          "),b:'" + bid + "',s:'" + sc + "',i:(window.__physide_iter||0)},'*');" +
          "if(window.__physide_breakpoints&&window.__physide_breakpoints.has('" + bid + "')){" +
          "window.__physide_paused=true;window.__physide_steps=0;}" +
          "if(window.__physide_paused){" +
          "if(window.__physide_steps>0){window.__physide_steps--;}" +
          "else{" +
          "parent.postMessage({type:'__phpause',paused:true,b:'" + bid + "',i:(window.__physide_iter||0)},'*');" +
          "await new Promise(function(r){" +
          "var _pi=setInterval(function(){" +
          "if(!window.__physide_paused||window.__physide_steps>0){" +
          "clearInterval(_pi);" +
          "if(window.__physide_steps>0)window.__physide_steps--;" +
          "parent.postMessage({type:'__phpause',paused:false},'*');" +
          "r();}},30);})}" +
          "}}catch(_e){}"
        );
      }
    );
  }

  /* Frame boundaries. Every VPython animation loop calls rate(); that call is
     the only reliable "one timestep has elapsed" marker available without a
     Python-level AST pass. The counter feeds the "iteration N" readout, and
     __physide_frame_steps makes "Next frame" a real unit rather than "next
     trace event" (which advanced a quarter of a timestep in a four-variable
     loop). injectFrameBoundaries wraps the WHOLE original rate() statement
     (which RapydScript actually emits as `(await rate(240));` — a
     parenthesized expression-statement, not a bare one) in a fresh block
     rather than inserting text directly ahead of `rate(` — see its doc
     comment for why the naive version broke every run. */
  traceInjected = injectFrameBoundaries(
    traceInjected,
    "window.__physide_iter=(window.__physide_iter||0)+1;" +
      "if(window.__physide_frame_steps>0){window.__physide_frame_steps--;" +
      "if(window.__physide_frame_steps===0){window.__physide_paused=true;window.__physide_steps=0;}}",
  );

  try {
    frameWindow.eval(traceInjected);
  } catch (runtimeErr) {
    console.error("[PhysicsIDE] eval() failed:", runtimeErr.message);
    if (DEBUG_RUNNER) {
      console.error(
        "\nCompiled JS preview (first 1000 chars):\n",
        traceInjected.slice(0, 1000)
      );
    }
    throw new Error("Runtime error: " + (runtimeErr.message || runtimeErr));
  }

  if (typeof frameWindow.__main__ === "function") {
    try {
      const maybePromise = frameWindow.__main__();
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.catch(reportAsyncRuntimeError);
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
    // The same "drew something" vocabulary as the guard below (review I1):
    // a scene-less pure-plot program has no canvas but HAS its graph panel,
    // and re-invoking the entrypoints would run the program twice —
    // duplicate panels, doubled series, two concurrent rate() loops.
    !frameWindow.document.querySelector("canvas, .glowscript-graph") &&
    fallbackEntrypoints.length > 0
  ) {
    for (const entrypoint of fallbackEntrypoints) {
      const result = entrypoint();
      if (result && typeof result.then === "function") {
        result.catch(reportAsyncRuntimeError);
      }
    }
  }
}

export async function runPython(codeString, hostId = "glowscript-host", opts = {}) {
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
       the source so that pause/step/trace work exactly like block projects.
       Block projects normally skip the instrumentor entirely (their tr()
       checkpoints already cover the loop body) — but a watch expression has
       no block-generated checkpoint of its own, so a project WITH block
       trace entries still needs a pass through the instrumentor when watches
       are present, purely to pick up the watch probes. */
    let compilableSource = source;
    let traceEntries = traceRegistry;
    const watch = opts.watch || [];
    if (traceRegistry.length === 0 || watch.length > 0) {
      const result = instrumentPythonForDebug(source, { watch });
      compilableSource = result.source;
      codeTraceEntries = result.entries;
      /* Block projects already have tr() checkpoints in the generated source;
         keep them and add the instrumentor's watch entries on top. */
      traceEntries = traceRegistry.length === 0
        ? codeTraceEntries
        : [...traceRegistry, ...codeTraceEntries.filter((e) => e.scope === "watch")];
      if (DEBUG_RUNNER && codeTraceEntries.length > 0) {
        console.log(
          "[PhysicsIDE] Code instrumentation: " + codeTraceEntries.length + " trace vars injected"
        );
      }
    }

    const compiled = compileSource(compile, compilableSource);
    const compiledCode = extractCompiledCode(compiled);

    await executeCompiled(frameWindow, compiledCode, traceEntries, opts.breakpoints);

    if (thisRunToken !== activeRunToken) {
      return;
    }

    /* The program may have just CREATED graph panels the observer's last
       resize could not know about (or torn down last run's). Re-apply the
       pane split so the scene yields — or reclaims — immediately, without
       waiting for a real pane resize (Stage B review I1). */
    if (lastResize.w > 0) resizeRuntimeCanvas(lastResize.w, lastResize.h);

    await new Promise((resolve) => window.setTimeout(resolve, 120));

    /* A graph panel counts as drawing (Plan 10 Task 3): a pure-plotting
       program — graph display + series + plot, no 3D object — is legitimate
       Trinket-style output, and its .glowscript-graph div (a Plotly SVG
       plot) exists as soon as graph() runs. Only a program that made
       NEITHER a canvas NOR a graph "drew nothing". */
    const renderedCanvas = frameWindow.document.querySelector("canvas, .glowscript-graph");
    if (!renderedCanvas) {
      const preview = compiledCode.slice(0, 300).replace(/\s+/g, " ");
      throw new Error(
        "GlowScript executed but no canvas was rendered. __main__: " +
          typeof frameWindow.__main__ +
          ". Preview: " +
          preview
      );
    }

    /* A freshly started run must render at the display's actual pixel ratio
       immediately — otherwise GlowScript's default buffer stays soft until
       the user happens to trigger a resize (e.g. dragging the divider).
       Goes through the same guarded resizeRuntimeCanvas() path, so a bad
       measurement here is silently a no-op rather than a thrown error. */
    const hostRect = host.getBoundingClientRect();
    resizeRuntimeCanvas(hostRect.width, hostRect.height, window.devicePixelRatio || 1);
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

/** Advance exactly one animation frame (one rate() call), then pause again. */
export function stepFrame() {
  if (!activeFrameWindow) return;
  activeFrameWindow.__physide_frame_steps = 1;
  activeFrameWindow.__physide_steps = 0;
  activeFrameWindow.__physide_paused = false;
}

export function setBreakpoints(bpSet) {
  if (activeFrameWindow) {
    activeFrameWindow.__physide_breakpoints = bpSet instanceof Set ? bpSet : new Set(bpSet);
  }
}

/* ── Parent → runtime handles ──────────────────────────────
   The scene lives in a separate document, so every accessor below is a
   capability check as much as a getter: nothing is running, the frame was
   torn down, or GlowScript never finished loading are all normal states,
   and every caller must be able to render a disabled control instead. */

/** The live runtime frame's window, or null. */
export function getRuntimeWindow() {
  return activeFrameWindow || null;
}

/** The <canvas> GlowScript draws into, or null. */
export function getRuntimeCanvas() {
  try {
    // The SCENE canvas, never a graph's: live graphs (Plan 10 Task 3) add
    // flot canvases to the same document, and "first canvas in the DOM"
    // would become order-dependent. The wrapper-scoped selector names the
    // 3D canvas structurally; the bare fallback keeps pre-wrapper layouts
    // (and the between-runs window) working as before.
    const doc = activeFrameWindow?.document;
    if (!doc) return null;
    return doc.querySelector(".glowscript-canvas-wrapper canvas") || doc.querySelector("canvas") || null;
  } catch {
    return null;   // cross-document access can throw if the frame was replaced
  }
}

/** The live scene (VPython's `canvas` instance) being rendered into, or null.
 *  Confirmed live in DevTools: compiled GlowScript 3.2 VPython does NOT expose
 *  the user's `scene` variable as a window global — it stays a local inside the
 *  compiled __main__ closure. The runtime's own bookkeeping of "the currently
 *  active canvas" lives at window.__context.canvas_selected instead, and that
 *  object has the same forward/up/autoscale/title/caption surface. win.scene is
 *  checked first in case a future runtime build does expose it directly. */
export function getRuntimeScene() {
  const win = getRuntimeWindow();
  try {
    return win?.scene || win?.__context?.canvas_selected || null;
  } catch {
    return null;
  }
}

/** Re-theme a RUNNING simulation in place. No reload, no lost run.
 *  The background-recolor branch reads the scene via getRuntimeScene() rather
 *  than win.scene directly — win.scene is never set on the compiled runtime
 *  (see getRuntimeScene's comment), so this branch was previously dead code
 *  that always skipped silently. */
export function applyRuntimeTheme(isDark) {
  const win = getRuntimeWindow();
  if (!win) return false;
  const theme = isDark ? VIEWPORT_THEME.dark : VIEWPORT_THEME.light;
  try {
    const styleEl = win.document.getElementById("physide-theme");
    if (styleEl) styleEl.textContent = viewportStyleText(theme);
    const scene = getRuntimeScene();
    if (scene && typeof win.vec === "function") {
      const n = (h) => parseInt(h, 16) / 255;
      const toVec = (hex) => win.vec(n(hex.slice(1, 3)), n(hex.slice(3, 5)), n(hex.slice(5, 7)));
      scene.background = toVec(theme.bg);

      /* Telemetry labels live inside the scene, so no stylesheet reaches
         them — see nextLabelColour for why this is done here and why it
         only ever repaints a default. */
      const objects = Array.isArray(scene.objects) ? scene.objects : [];
      for (const obj of objects) {
        if (!obj || typeof obj.text !== "string") continue;
        const next = nextLabelColour(labelColourToHex(obj.color), isDark);
        if (next) obj.color = toVec(next);
      }
    }
    return true;
  } catch (err) {
    console.warn("Could not retheme the running viewport:", err);
    return false;
  }
}

/** Resize the runtime's drawing surface for a new CSS box size (a divider
 *  drag, a pane toggle, or the just-started-run kick in runPython()).
 *
 *  This is CSS-sized, not DPR-sized, and that is deliberate. GlowScript
 *  derives its GL viewport from scene.width/scene.height, which it treats as
 *  CSS pixels — it never multiplies by devicePixelRatio. Confirmed live
 *  (deviceScaleFactor 2): the previous code set scene.width/height to the CSS
 *  size (which is what drives the GL viewport) and then ALSO force-wrote
 *  canvas.width/height to cssSize * dpr. That desynced the two: the buffer
 *  ended up 2x the CSS size but the GL viewport stayed CSS-sized, so
 *  GlowScript only ever rendered into one quarter of the buffer — and the
 *  frame's CSS `width:100% !important` then stretched that quarter back up
 *  to fill the pane. Net result was strictly worse than a plain CSS-sized
 *  buffer: soft AND wrong, instead of just soft.
 *
 *  So: when the scene is reachable, let it own the buffer (scene.width/height
 *  in CSS px) and leave canvas.width/height alone entirely — soft-but-correct
 *  beats desynced. The manual canvas.width/height = css * dpr write survives
 *  only as the FALLBACK for when no scene is reachable at all, where there is
 *  no GL viewport to desync from and a higher pixel count is pure upside.
 *
 *  Real DPR-sharp rendering needs the runtime itself to scale its GL viewport
 *  by dpr, which stock GlowScript 3.2 does not do. That requires vendoring or
 *  patching the runtime script and is deferred to a later plan.
 *
 *  DPR-SHARP SPIKE (tried and reverted, Task 3 Step 7): hypothesis was that
 *  since GlowScript's GL viewport tracks scene.width/height verbatim (see
 *  above), setting scene.width/height = cssSize * dpr — instead of cssSize —
 *  would size the buffer AND the GL viewport together at DPR scale with no
 *  runtime patch, while `canvas { width/height: 100% !important }` kept the
 *  element displayed at CSS size. Measured with e2e/hidpi-probe.mjs at
 *  deviceScaleFactor 2: this DID work for rendering — buffer went from
 *  715x762 to 1430x1524 (= css * dpr) and glViewport reported [0,0,1430,1524],
 *  matching the buffer exactly (no render-desync; VERDICT: DPR-SAFE).
 *
 *  But mouse interaction broke. GlowScript maps pointer events (drag-rotate,
 *  wheel-zoom's target point, and scene.mouse.pos/pick) into normalized scene
 *  coordinates using canvas.width/height — the backing BUFFER — as the
 *  divisor, not the CSS/clientWidth the events actually arrive in. At dpr=1
 *  buffer==CSS size so this coincidentally works; once the buffer is 2x CSS
 *  size, every pointer coordinate lands at HALF its intended normalized
 *  position. Isolated, repeated measurement (e2e/dpr-pick-only-probe.mjs,
 *  moving the real mouse to the exact same CSS-pixel canvas position, no
 *  camera movement in between): scene.mouse.pos at canvas center was
 *  (-0.025, 0, 0) — i.e. essentially the scene origin, correct — at dpr=1,
 *  but (-9.01, 9.59, 0) at dpr=2 with the buffer scaled — nowhere near
 *  center, in a scene with range ≈ 18. Moving the real cursor +100 CSS px
 *  moved the picked world point by 5.03 world units at dpr=1 but only 2.52 at
 *  dpr=2 — a ~0.5x sensitivity, the exact factor-of-dpr offset the task brief
 *  flagged as the bail signal. This would desync drag-rotate, zoom-to-cursor,
 *  and object picking for every user on a >1 dpr display. REVERTED: the two
 *  edits (this function's preferred path, and the extra `canvas {}` rule in
 *  viewportStyleText) were undone; resizeRuntimeCanvas is back to CSS-sized
 *  scene.width/height. Real DPR-sharp rendering still needs the runtime
 *  itself patched to scale both its GL viewport AND its pointer-mapping
 *  divisor by dpr together — sizing the buffer alone from the outside cannot
 *  fix this, because the same canvas.width the render path wants scaled is
 *  the same value the input path reads to normalize the cursor. */
/** The last pane size the host reported, so a run that CREATES graphs after
 *  the observer's last fire can re-apply the split without a real resize
 *  (Stage B review I1: the graphs were invisible below a full-height scene). */
let lastResize = { w: 0, h: 0 };

export function resizeRuntimeCanvas(cssWidth, cssHeight, dpr = window.devicePixelRatio || 1) {
  if (cssWidth < 1 || cssHeight < 1) return false;
  // Remembered even when nothing is running: the next run's post-execute
  // re-apply must not replay a pane size from before a splitter drag.
  lastResize = { w: cssWidth, h: cssHeight };
  const win = getRuntimeWindow();
  const canvas = getRuntimeCanvas();
  if (!win || !canvas) return false;
  try {
    /* When graph panels exist, the scene YIELDS: full height put every
       graph below the fold with no visible affordance, and the wheel over
       the scene zooms rather than scrolls (Stage B review I1 — four
       templates' whole value is the live graph). ~55% keeps the scene
       readable while the first graph's top edge shows above the fold; the
       root scrolls for the rest. The CSS switches the canvas to attr-sized
       (height auto) in the same :has() condition, so buffer and display
       stay 1:1 — the desync the comment above warns about cannot occur. */
    const hasGraphs = !!win.document.querySelector(".glowscript-graph");
    // The 240px floor is itself clamped to the pane: on a very short pane an
    // unclamped floor would make the scene TALLER than the pane and push
    // every graph back below the fold — the original bug, worse.
    const sceneHeight = hasGraphs
      ? Math.min(Math.round(cssHeight), Math.max(240, Math.round(cssHeight * 0.55)))
      : Math.round(cssHeight);
    const scene = getRuntimeScene();
    if (scene && typeof scene.width === "number") {
      /* Preferred path: GlowScript owns the buffer. Its GL viewport tracks
         scene.width/height directly in CSS px with no dpr multiply, so NOT
         touching canvas.width/height here is what keeps the viewport and the
         buffer in sync (see the function comment for the measured failure
         mode when both were written, and for the DPR-sharp spike that was
         tried and reverted). */
      scene.width = Math.round(cssWidth);
      scene.height = sceneHeight;
      return true;
    }
    /* Fallback: no scene reachable (nothing running, or between frame
       teardown and the next run), so there is no GL viewport to desync from —
       size the buffer directly at the display's pixel ratio. */
    const ratio = Math.min(dpr, 2);   // cap: a 3x buffer buys nothing here and costs frames
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    return true;
  } catch (err) {
    console.warn("Could not resize the runtime canvas:", err);
    return false;
  }
}

/**
 * Capture the live 3D scene as a PNG data URL, from the canvas itself rather
 * than through html2canvas (which can rasterise neither a cross-document
 * iframe nor WebGL pixels). Runs inside the FRAME's own requestAnimationFrame
 * so the read happens as close to a draw as the parent can arrange.
 *
 * Returns null when nothing is running or the read throws — the caller must
 * still verify the pixels, because a successful read can be a blank buffer.
 */
export function captureRuntimeCanvas() {
  const win = getRuntimeWindow();
  const canvas = getRuntimeCanvas();
  if (!win || !canvas) return Promise.resolve(null);
  return new Promise((resolve) => {
    const read = () => {
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("Could not read the runtime canvas:", err);
        resolve(null);
      }
    };
    try {
      if (typeof win.requestAnimationFrame === "function") win.requestAnimationFrame(read);
      else read();
    } catch {
      read();
    }
  });
}

/** The scene's authored title and caption, if the program set them.
 *  precodedExamples.js:16,21 authors both; GlowScript renders them as sibling
 *  divs that this runtime's overflow:hidden pushes out of view. */
export function getSceneMeta() {
  const scene = getRuntimeScene();
  const clean = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 240) : "");
  try {
    return { title: clean(scene?.title), caption: clean(scene?.caption) };
  } catch {
    return { title: "", caption: "" };
  }
}
