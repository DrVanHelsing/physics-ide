import { BLOCK_PALETTE } from "../blockly/blockPalette";

export const VPYTHON_BUILTINS = [
  "sphere", "box", "cylinder", "cone", "arrow", "ring", "helix", "curve",
  "label", "vector", "vec", "rate", "color", "mag", "norm", "cross", "dot",
  "graph", "gcurve", "gdots", "canvas", "scene",
];

const P = BLOCK_PALETTE;
const strip = (hex) => hex.slice(1);

export const MONACO_THEMES = {
  "physics-light": {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: strip(P["Control"].fill) },
      { token: "type.identifier.vpython", foreground: strip(P["Objects"].fill) },
      { token: "number", foreground: strip(P["Motion"].fill) },
      { token: "string", foreground: strip(P["Transforming Data"].fill) },
      { token: "comment", foreground: "6D7380" },
    ],
    colors: { "editor.background": "#ffffff" },
  },
  "physics-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: strip(P["Control"].tertiary) },
      { token: "type.identifier.vpython", foreground: strip(P["Objects"].tertiary) },
      { token: "number", foreground: strip(P["Motion"].tertiary) },
      { token: "string", foreground: strip(P["Transforming Data"].tertiary) },
      { token: "comment", foreground: "8B949E" },
    ],
    colors: { "editor.background": "#1e1e1e" },
  },
};

export function physicsThemeName(isDark) {
  return isDark ? "physics-dark" : "physics-light";
}

/** Register both themes and teach python's monarch grammar the VPython
 *  vocabulary (as a distinct token so the Objects azure lands on calls). */
export async function registerPhysicsThemes(monaco) {
  const { language } = await import(
    "monaco-editor/esm/vs/basic-languages/python/python.js"
  );
  monaco.languages.setMonarchTokensProvider("python", {
    ...language,
    typeKeywords: VPYTHON_BUILTINS,
    tokenizer: {
      ...language.tokenizer,
      root: [
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@typeKeywords": "type.identifier.vpython",
              "@keywords": "keyword",
              "@default": "identifier",
            },
          },
        ],
        ...language.tokenizer.root,
      ],
    },
  });
  for (const [name, data] of Object.entries(MONACO_THEMES)) {
    monaco.editor.defineTheme(name, data);
  }
}
