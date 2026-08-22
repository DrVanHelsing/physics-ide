/**
 * Reads a stylesheet and reports literal metrics on the properties spec
 * §18 D1 governs. The point is not this pass — it is that the pass cannot
 * silently regress once it has landed.
 *
 * Deliberately NOT covered, and why:
 *   width / height / max-width / min-width / inset offsets — layout
 *     dimensions (a 420px form, a 1000px body, a 220px card track, a 260px
 *     canvas) sit on no ramp and were never meant to.
 *   border-width — the product writes 1px and 2px hairlines literally
 *     everywhere, including workspace.css's category strips. There is no
 *     border-width token and D16 says inventing one is a decision, not a
 *     side effect of a substitution pass.
 *   animation-duration — the three duration tokens govern UI transitions.
 *     A 13-second orbit period is a keyframe animation, not a transition.
 *
 * A declaration may opt out by carrying `metric-exempt` in a comment on its
 * own line, which must state a reason. That is the escape hatch D16 asks for:
 * visible, greppable, and never silent.
 */
const COVERED = [
  "font-size", "font-weight", "line-height", "letter-spacing",
  "border-radius",
  "gap", "row-gap", "column-gap",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "z-index",
  "transition", "transition-duration",
];

const DECL = new RegExp(String.raw`(?:^|[;{])\s*(${COVERED.join("|")})\s*:\s*([^;}]+)`, "g");
const UNIT = /(?:^|[\s,(])-?\d*\.?\d+(?:px|em|rem|s|ms)\b/;
const BARE = new Set(["font-weight", "line-height", "z-index"]);

/** Blank out every var(...) — fallback included — so var(--space-4, 16px)
 *  does not read as a literal. Loops for nested fallbacks. */
function stripVars(value) {
  let out = value;
  let prev;
  do {
    prev = out;
    out = out.replace(/var\([^()]*\)/g, " ");
  } while (out !== prev);
  return out;
}

/** → array of "selector-ish line :: prop: value" strings; empty means clean. */
export function metricViolations(css) {
  const found = [];
  const lines = css.split("\n");
  lines.forEach((line, i) => {
    if (line.includes("metric-exempt")) return;
    if (i > 0 && lines[i - 1].includes("metric-exempt")) return;
    for (const m of line.matchAll(DECL)) {
      const prop = m[1];
      const raw = m[2].trim();
      const value = stripVars(raw);
      const literal =
        UNIT.test(value) ||
        (BARE.has(prop) && /(?:^|\s)\d*\.?\d+(?:\s|$)/.test(value.replace(/(?:^|\s)0(?:\s|$)/g, " ")));
      if (literal) found.push(`${i + 1}: ${prop}: ${raw}`);
    }
  });
  return found;
}
