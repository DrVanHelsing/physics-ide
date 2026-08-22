/**
 * instrumentor.js
 *
 * Pure-function Python source instrumentation for the Physics IDE debugger.
 *
 * Takes a raw VPython source string and injects lightweight `_phtr_` trace
 * assignments so that every assignment site becomes observable at runtime.
 * The compiled JS is later post-processed by glowRunner to append
 * `parent.postMessage(...)` calls and pauseable checkpoint logic.
 *
 * Three scopes of probe are produced:
 *   - "setup" — top-level (indent 0) assignments outside any loop, e.g.
 *     `m = 2.5`. These are the constants a physics student checks first when
 *     a simulation misbehaves (mass, g, spring constant, initial velocity,
 *     an out-of-loop dt) and were previously invisible: the old `if
 *     (!inLoop) continue;` bail-out skipped them entirely. Probed once, at
 *     top level, immediately after the assignment line.
 *   - "loop" — assignments inside the first (outermost) while-loop body, as
 *     before. Each site gets its own safeName/blockId so per-line
 *     breakpoints keep working.
 *   - "watch" — ad-hoc expressions supplied by the caller (the trace panel's
 *     watch box). These are not assignments in the source at all; they are
 *     synthesized probe lines appended to the end of the loop body (so they
 *     observe post-update values) or, when there is no loop, at top level.
 *
 * This module has no side-effects and no React/DOM dependencies.
 */

/** VPython 3-D object constructors — skip variables whose RHS starts with one. */
const SKIP_CONSTRUCTORS = [
  'sphere(', 'box(', 'cylinder(', 'arrow(', 'helix(', 'ring(',
  'curve(', 'points(', 'graph(', 'gcurve(', 'gdots(', 'gvbars(',
  'label(', 'wtext(', 'text(',
];

/** Known builtins / VPython names that should not be traced. */
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
 * Examples matched : "    t = 0", "  x += dt", "  KE *= 0.5"
 * Not matched      : "  if x == 0:", "  obj.attr = v" (stops at the dot)
 */
const ASSIGN_RE = /^(\s*)([a-zA-Z_]\w*)\s*(?:[+\-*/%&|^]|\*\*|\/\/)?=(?!=)/;

/** A watch expression is a single line of Python that must not smuggle in a
 *  statement. Anything with a newline, a leading keyword, or nothing in it is
 *  dropped rather than run. */
const WATCH_REJECT = /^\s*(?:import|from|def|class|while|for|if|return|del|global|nonlocal|raise|assert|with|pass|break|continue)\b/;

function sanitiseWatch(list) {
  return (Array.isArray(list) ? list : [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length > 0 && !s.includes("\n") && !WATCH_REJECT.test(s) && !s.includes("="));
}

/**
 * Scan a VPython source string and inject `_phtr_` trace assignments: once
 * for each top-level constant (scope "setup"), once for each assignment
 * inside the first while-loop body (scope "loop"), and once for each
 * caller-supplied watch expression (scope "watch", appended to the end of
 * the loop body). Returns the instrumented source plus the corresponding
 * trace-registry entries so the compiled-JS injection can add `postMessage`
 * calls and pause-checkpoint logic automatically.
 *
 * Each injected variable gets a unique safeName `"varName_lineN"` so that
 * every assignment site has its own blockId (`"line_N"`), enabling per-line
 * breakpoints. Watch entries use `"watch_N"` for both safeName and blockId.
 *
 * @param {string} pythonSource - Raw VPython source code.
 * @param {{ watch?: string[] }} [options] - `watch`: expressions to probe
 *   inside the loop on the next run (sanitised — see `sanitiseWatch`).
 * @returns {{ source: string, entries: Array<{safeName: string, displayName: string, blockId: string, scope: 'setup'|'loop'|'watch'}> }}
 */
export function instrumentPythonForDebug(pythonSource, { watch = [] } = {}) {
  const lines   = pythonSource.split('\n');
  const output  = [];
  const entries = [];  /* {safeName, displayName, blockId, scope} */

  let inLoop          = false;
  let loopBaseIndent  = -1;
  let loopBodyIndent  = null;   /* body indent of the last in-loop probe seen */
  let lastLoopLineIndex = -1;   /* index in `output` of the last loop-scope probe */

  for (let i = 0; i < lines.length; i++) {
    const line     = lines[i];
    const stripped = line.trimStart();
    output.push(line);

    if (!stripped || stripped.startsWith('#')) continue;

    /* Detect while-loop entry */
    const loopMatch = line.match(/^(\s*)while\s+/);
    if (loopMatch) {
      if (!inLoop) {
        inLoop         = true;
        loopBaseIndent = loopMatch[1].length;
      }
      continue;
    }

    /* Detect leaving the loop (non-blank, non-comment at indent <= loopBase) */
    if (inLoop) {
      const indentLen = (line.match(/^(\s*)/) || ['', ''])[1].length;
      if (stripped && indentLen <= loopBaseIndent) {
        if (!stripped.match(/^(?:else|elif|except|finally)\b/)) {
          inLoop         = false;
          loopBaseIndent = -1;
          const newLoop  = line.match(/^(\s*)while\s+/);
          if (newLoop) {
            inLoop         = true;
            loopBaseIndent = newLoop[1].length;
          }
        }
        if (!inLoop) continue;
      }
    }

    const am = line.match(ASSIGN_RE);
    if (!am) continue;

    const indent  = am[1];
    const varName = am[2];

    if (BUILTINS.has(varName))   continue;
    if (varName.startsWith('_')) continue;

    /* Skip VPython object constructor assignments */
    const eqIdx  = line.search(/(?:[+\-*/%&|^]|\*\*|\/\/)?=(?!=)/);
    const rhsTrim = eqIdx >= 0 ? line.slice(eqIdx + 1).trim() : '';
    if (SKIP_CONSTRUCTORS.some(c => rhsTrim.startsWith(c))) continue;

    let scope;
    if (inLoop) {
      /* Inside the loop body proper — not the `while` header's own indent. */
      if (indent.length <= loopBaseIndent) continue;
      scope = 'loop';
    } else {
      /* Top level only. A constant assigned inside an if/for/def is not a
         "setup constant"; probing it there would fire at an unpredictable
         time and read as noise. */
      if (indent.length !== 0) continue;
      scope = 'setup';
    }

    const lineNum  = i + 1;
    const safeName = `${varName}_line${lineNum}`;
    const blockId  = `line_${lineNum}`;

    entries.push({ safeName, displayName: varName, blockId, scope });
    output.push(`${indent}_phtr_${safeName} = str(${varName})`);

    if (scope === 'loop') {
      if (loopBodyIndent === null) loopBodyIndent = indent;
      lastLoopLineIndex = output.length - 1;
    }
  }

  const watches = sanitiseWatch(watch);
  if (watches.length > 0) {
    const bodyIndent = loopBodyIndent ?? (loopBaseIndent >= 0 ? ' '.repeat(loopBaseIndent + 4) : '');
    /* Watches are appended to the END of the loop body so they observe the
       values AFTER the frame's updates, which is what a student watching
       "total energy" expects. Emitted at top level when there is no loop. */
    const insertAt = lastLoopLineIndex >= 0 ? lastLoopLineIndex + 1 : output.length;
    const watchLines = watches.map((expr, n) => `${bodyIndent}_phtr_watch_${n} = str(${expr})`);
    output.splice(insertAt, 0, ...watchLines);
    watches.forEach((expr, n) => {
      entries.push({
        safeName: `watch_${n}`,
        displayName: expr,
        blockId: `watch_${n}`,
        scope: 'watch',
      });
    });
  }

  return { source: output.join('\n'), entries };
}
