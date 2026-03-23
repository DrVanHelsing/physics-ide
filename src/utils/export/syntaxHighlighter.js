/**
 * syntaxHighlighter.js
 *
 * Minimal Python tokeniser used by the PDF code-export feature.
 * Classifies each token into one of: keyword, builtin, string, number,
 * comment, whitespace, newline, or generic punctuation/identifier.
 *
 * This module has no side-effects and no DOM/React dependencies.
 */

/** Python 3 reserved keywords. */
export const PY_KEYWORDS = new Set([
  "False","None","True","and","as","assert","async","await","break",
  "class","continue","def","del","elif","else","except","finally",
  "for","from","global","if","import","in","is","lambda","nonlocal",
  "not","or","pass","raise","return","try","while","with","yield",
]);

/** Built-in names + common VPython identifiers highlighted as builtins. */
export const PY_BUILTINS = new Set([
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

/**
 * Tokenise a single line (or multi-line string) of Python source code.
 *
 * @param {string} code - Python source text.
 * @returns {Array<{type: string, text: string}>}
 */
export function tokenizePython(code) {
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

    // Strings (single/double, triple-quoted)
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      let start = i;
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
    if (
      /[0-9]/.test(code[i]) ||
      (code[i] === "." && i + 1 < len && /[0-9]/.test(code[i + 1]))
    ) {
      let start = i;
      while (i < len && /[0-9.eE\-+xXoObBaAcCdDfF_]/.test(code[i])) i++;
      tokens.push({ type: "number", text: code.substring(start, i) });
      continue;
    }

    // Identifiers, keywords, builtins
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
