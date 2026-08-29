/**
 * describeRunError — turn a runner exception into something a 15-year-old can act on.
 *
 * glowRunner wraps failures up to three times: compileSource throws
 * "Compile error: …", executeCompiled rethrows "Runtime error: …", and
 * runPython wraps that again as "Execution error: …". It then appends either
 * 120 characters of raw source or 300 characters of compiled JavaScript. A
 * student was reading "Execution error: Runtime error: TypeError: ball is
 * undefined | src: sphere ( pos = vect…" and learning nothing.
 *
 * Pure: no DOM, no imports, no side effects. Technical payloads survive on
 * `.raw` for the console; nothing is thrown away, it is just not shouted.
 */

const WRAPPERS = /^(?:Execution error:\s*|Runtime error:\s*|Compile error:\s*)+/;
const SOURCE_PREVIEW = /\s*\|\s*src:.*$/s;
const JS_PREVIEW = /\s*Preview:.*$/s;
const DIAGNOSTICS = /\s*Diagnostics:.*$/s;
const MAIN_NOTE = /\s*__main__:\s*\w+\.?/;

/** [matcher, title, detail-builder] — first match wins, so order is meaning. */
const RULES = [
  [
    /Failed to load script|did not load|did not initialize|dependency missing/i,
    "The 3D engine could not start.",
    () =>
      "The simulation engine files did not load. Check your connection, then reload the page and press Run again.",
  ],
  [
    /VPython source is empty/i,
    "There's nothing to run yet.",
    () => "Add some blocks (or write some code) before pressing Run.",
  ],
  [
    /no canvas was rendered/i,
    "The simulation ran but drew nothing.",
    () =>
      "Your program finished without creating any 3D objects. Add a sphere, box or arrow inside Simulation Start.",
  ],
  [
    /NameError: name '([^']+)' is not defined/i,
    (m) => `There's no variable called “${m[1]}”.`,
    () =>
      `Check the spelling, or create it before you use it — a "set" block above the line that reads it.`,
  ],
  [
    /(?:TypeError:\s*)?(\w+) is (?:undefined|not defined)/i,
    (m) => `Something used “${m[1]}” before it was created.`,
    (m) => `Move the block that creates “${m[1]}” above the block that uses it.`,
  ],
  [
    /IndentationError/i,
    "A line is indented wrongly.",
    () => "In Code view, make sure every line inside a loop or an if is indented by the same amount.",
  ],
  [
    /ZeroDivisionError|division by zero/i,
    "Something was divided by zero.",
    () => "A value you divided by reached 0. Check the denominators in your formulas.",
  ],
  [
    /SyntaxError|Unexpected token|Unexpected identifier/i,
    "Python couldn't read one of your lines.",
    (m, rest) => `There's a typo near${m.index != null ? "" : ""} the reported line. ${rest}`.trim(),
  ],
  [
    /AttributeError: .*has no attribute '([^']+)'/i,
    (m) => `That object has no property called “${m[1]}”.`,
    () => "Check the property name — spheres have pos, radius, color and velocity, for example.",
  ],
  [
    /is not a function|is not callable/i,
    "Something was used as if it were a function.",
    () => "Check for a missing operator, or a variable name that shadows a built-in like mag or norm.",
  ],
];

function firstLineNumber(text) {
  const m = /(?:\bline\s+|\(line\s+)(\d+)/i.exec(text);
  return m ? Number(m[1]) : null;
}

/**
 * @param {unknown} err
 * @returns {{title: string, detail: string, line: number|null, raw: string}}
 */
export function describeRunError(err) {
  const raw = err == null ? "" : String(err && err.message ? err.message : err);

  let text = raw.replace(WRAPPERS, "");
  const line = firstLineNumber(text);
  text = text
    .replace(SOURCE_PREVIEW, "")
    .replace(JS_PREVIEW, "")
    .replace(DIAGNOSTICS, "")
    .replace(MAIN_NOTE, "")
    .trim();

  for (const [pattern, title, detail] of RULES) {
    const m = pattern.exec(text);
    if (!m) continue;
    return {
      title: typeof title === "function" ? title(m) : title,
      detail: typeof detail === "function" ? detail(m, text) : detail,
      line,
      raw,
    };
  }

  return { title: "The simulation stopped with an error.", detail: text, line, raw };
}
