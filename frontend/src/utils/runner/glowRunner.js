/*
 * GlowScript / VPython runner
 *
 * Runs each simulation inside an isolated iframe runtime so compiler/runtime
 * globals never leak across runs.
 */

import { traceRegistry } from '../blockly/traceRegistry';
import { instrumentPythonForDebug } from './instrumentor';

let activeRunToken = 0;
let activeFrameWindow = null;

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

const GLOWSCRIPT_SCRIPTS = {
  jquery: "https://cdn.jsdelivr.net/npm/jquery@2.1.4/dist/jquery.min.js",
  jqueryTextChange:
    "https://www.glowscript.org/lib/jquery/IDE/jquery.textchange.custom.js",
  jqueryUi:
    "https://www.glowscript.org/lib/jquery/IDE/jquery-ui.custom.min.js",
  glow: `https://www.glowscript.org/package/glow.${GLOWSCRIPT_VERSION}.min.js`,
  compiler: `https://www.glowscript.org/package/RScompiler.${GLOWSCRIPT_VERSION}.min.js`,
  run: `https://www.glowscript.org/package/RSrun.${GLOWSCRIPT_VERSION}.min.js`,
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
      #glowscript-root { width: 100%; height: 100%; overflow: hidden; background: ${bg}; }
      #glowscript { width: 100%; height: 100%; background: ${bg}; }
      #glowscript canvas {
        display: block !important;
        width: 100% !important;
        height: 100% !important;
        background: ${bg};
        outline: none;
        border: none;
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
    return activeFrameWindow?.document?.querySelector("canvas") || null;
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
      scene.background = win.vec(n(theme.bg.slice(1, 3)), n(theme.bg.slice(3, 5)), n(theme.bg.slice(5, 7)));
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
 *  patching the runtime script and is deferred to a later plan. */
export function resizeRuntimeCanvas(cssWidth, cssHeight, dpr = window.devicePixelRatio || 1) {
  const win = getRuntimeWindow();
  const canvas = getRuntimeCanvas();
  if (!win || !canvas || cssWidth < 1 || cssHeight < 1) return false;
  try {
    const scene = getRuntimeScene();
    if (scene && typeof scene.width === "number") {
      /* Preferred path: GlowScript owns the buffer. Its GL viewport tracks
         scene.width/height directly in CSS px with no dpr multiply, so NOT
         touching canvas.width/height here is what keeps the viewport and the
         buffer in sync (see the function comment for the measured failure
         mode when both were written). */
      scene.width = Math.round(cssWidth);
      scene.height = Math.round(cssHeight);
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
