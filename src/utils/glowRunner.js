/*
 * GlowScript / VPython runner
 *
 * Runs each simulation inside an isolated iframe runtime so compiler/runtime
 * globals never leak across runs.
 */

let activeRunToken = 0;

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
  const viewportTextColor = isLight ? "#111827" : "#f5f7ff";

  const iframe = document.createElement("iframe");
  iframe.title = "GlowScript Runtime";
  iframe.setAttribute("aria-label", "GlowScript Runtime");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";

  host.innerHTML = "";
  host.appendChild(iframe);

  const frameDoc = iframe.contentDocument;
  frameDoc.open();
  frameDoc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; color: ${viewportTextColor}; }
      #glowscript-root { width: 100%; height: 100%; }
      #glowscript { width: 100%; height: 100%; }
      #glowscript canvas { display: block; width: 100% !important; height: 100% !important; }
      #glowscript-root, #glowscript-root * { color: ${viewportTextColor} !important; }
      #glowscript a { color: ${isLight ? "#1d4ed8" : "#93c5fd"} !important; }
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
  const trimmed = codeString.trimStart();
  const firstLine = trimmed.split(/\r?\n/, 1)[0] || "";
  const hasHeader = /^(GlowScript|Web\s+VPython)\s/i.test(firstLine);
  const source = hasHeader ? trimmed : "GlowScript 3.2 VPython\n" + trimmed;

  if (!source || source.length === 0) {
    throw new Error("Compile error: VPython source is empty.");
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

async function executeCompiled(frameWindow, compiledCode) {
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

  try {
    frameWindow.eval(compiledCode);
  } catch (runtimeErr) {
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
    const compiled = compileSource(compile, source);
    const compiledCode = extractCompiledCode(compiled);

    await executeCompiled(frameWindow, compiledCode);

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

  const host = document.getElementById(hostId);
  if (host) {
    host.innerHTML = "";
  }
}
