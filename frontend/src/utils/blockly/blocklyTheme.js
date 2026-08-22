import Blockly from "./blocklyLib";
import { blockStylesFromPalette, categoryStylesFromPalette } from "./blockPalette";

/* componentStyles carried over verbatim from the inline buildBlocklyTheme
   (BlocklyWorkspace.js pre-extraction), values unchanged. */
const COMPONENT_STYLES = {
  dark: {
    workspaceBackgroundColour: "#1e1e1e",
    toolboxBackgroundColour: "#252526",
    toolboxForegroundColour: "#cccccc",
    flyoutBackgroundColour: "#1e1e1e",
    flyoutForegroundColour: "#cccccc",
    flyoutOpacity: 0.98,
    scrollbarColour: "#505050",
    scrollbarOpacity: 0.55,
    insertionMarkerColour: "#569cd6",
    insertionMarkerOpacity: 0.5,
    cursorColour: "#007acc",
  },
  light: {
    workspaceBackgroundColour: "#ffffff",
    toolboxBackgroundColour: "#f3f3f3",
    toolboxForegroundColour: "#333333",
    flyoutBackgroundColour: "#f3f3f3",
    flyoutForegroundColour: "#333333",
    flyoutOpacity: 0.98,
    scrollbarColour: "#c8c8c8",
    scrollbarOpacity: 0.55,
    insertionMarkerColour: "#0451a5",
    insertionMarkerOpacity: 0.5,
    cursorColour: "#007acc",
  },
};

const FONT_STYLE = {
  family: "'Inter', 'Segoe UI', system-ui, sans-serif",
  weight: "500",
  size: 13, // was 11 — Zelos geometry carries 13 comfortably (MakeCode uses larger still)
};

export function gridColourFor(isDark) {
  return isDark ? "#2a2c40" : "#dddddd";
}

const cache = {};
export function getBlocklyTheme(isDark) {
  const key = isDark ? "physics-dark" : "physics-light";
  if (!cache[key]) {
    cache[key] = Blockly.Theme.defineTheme(key, {
      name: key,
      base: Blockly.Themes.Zelos,
      blockStyles: blockStylesFromPalette(),
      categoryStyles: categoryStylesFromPalette(),
      componentStyles: COMPONENT_STYLES[isDark ? "dark" : "light"],
      fontStyle: FONT_STYLE,
    });
  }
  return cache[key];
}
