/**
 * instrumentor.js
 *
 * Pure-function Python source instrumentation for the Physics IDE debugger.
 *
 * Takes a raw VPython source string and injects lightweight `_phtr_` trace
 * assignments inside the first (outermost) while-loop body so that every
 * assignment site becomes observable at runtime.  The compiled JS is later
 * post-processed by glowRunner to append `parent.postMessage(...)` calls and
 * pauseable checkpoint logic.
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

/**
 * Scan a VPython source string and inject `_phtr_` trace assignments inside
 * the first while-loop body.  Returns the instrumented source plus the
 * corresponding trace-registry entries so the compiled-JS injection can add
 * `postMessage` calls and pause-checkpoint logic automatically.
 *
 * Each injected variable gets a unique safeName `"varName_lineN"` so that
 * every assignment site has its own blockId (`"line_N"`), enabling per-line
 * breakpoints.
 *
 * @param {string} pythonSource - Raw VPython source code.
 * @returns {{ source: string, entries: Array<{safeName: string, displayName: string, blockId: string}> }}
 */
export function instrumentPythonForDebug(pythonSource) {
  const lines   = pythonSource.split('\n');
  const output  = [];
  const entries = [];  /* {safeName, displayName, blockId} */

  let inLoop         = false;
  let loopBaseIndent = -1;

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

    if (!inLoop) continue;

    const am = line.match(ASSIGN_RE);
    if (!am) continue;

    const indent  = am[1];
    const varName = am[2];

    if (indent.length <= loopBaseIndent) continue;
    if (BUILTINS.has(varName))           continue;
    if (varName.startsWith('_'))         continue;

    /* Skip VPython object constructor assignments */
    const eqIdx  = line.search(/(?:[+\-*/%&|^]|\*\*|\/\/)?=(?!=)/);
    const rhsTrim = eqIdx >= 0 ? line.slice(eqIdx + 1).trim() : '';
    if (SKIP_CONSTRUCTORS.some(c => rhsTrim.startsWith(c))) continue;

    const lineNum  = i + 1;
    const safeName = `${varName}_line${lineNum}`;
    const blockId  = `line_${lineNum}`;

    entries.push({ safeName, displayName: varName, blockId });
    output.push(`${indent}_phtr_${safeName} = str(${varName})`);
  }

  return { source: output.join('\n'), entries };
}
