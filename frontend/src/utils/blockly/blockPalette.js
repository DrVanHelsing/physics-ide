/**
 * WCAG-compliant colour helpers (no imports)
 */
function relativeLuminance(hex) {
  const r = parseInt(hex.substring(1, 3), 16) / 255;
  const g = parseInt(hex.substring(3, 5), 16) / 255;
  const b = parseInt(hex.substring(5, 7), 16) / 255;

  const lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lr = lin(r);
  const lg = lin(g);
  const lb = lin(b);

  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hueOf(hex) {
  const r = parseInt(hex.substring(1, 3), 16) / 255;
  const g = parseInt(hex.substring(3, 5), 16) / 255;
  const b = parseInt(hex.substring(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue;
  if (delta === 0) {
    hue = 0;
  } else if (max === r) {
    hue = (((g - b) / delta) % 6) * 60;
  } else if (max === g) {
    hue = (((b - r) / delta) + 2) * 60;
  } else {
    hue = (((r - g) / delta) + 4) * 60;
  }

  return hue < 0 ? hue + 360 : hue;
}

/**
 * v2 colour palette: 26 categories with WCAG AA verification
 */
const BLOCK_PALETTE = {
  Objects: {
    slug: "objects",
    fill: "#0973D1",
    secondary: "#1077D2",
    tertiary: "#79BDF9",
    bright: "#0A8DFF",
    on: "#FFFFFF",
  },
  Motion: {
    slug: "motion",
    fill: "#B05D07",
    secondary: "#B2610D",
    tertiary: "#F8A552",
    bright: "#FF860A",
    on: "#FFFFFF",
  },
  Values: {
    slug: "values",
    fill: "#743BF7",
    secondary: "#7741F1",
    tertiary: "#C3AAFB",
    bright: "#550AFF",
    on: "#FFFFFF",
  },
  State: {
    slug: "state",
    fill: "#D7099A",
    secondary: "#DB119F",
    tertiary: "#FB96DC",
    bright: "#FF0AB6",
    on: "#FFFFFF",
  },
  Control: {
    slug: "control",
    fill: "#BB0AF0",
    secondary: "#BE1EEE",
    tertiary: "#E59CFB",
    bright: "#C70AFF",
    on: "#FFFFFF",
  },
  Logic: {
    slug: "logic",
    fill: "#137AAD",
    secondary: "#1A7DAE",
    tertiary: "#66C1EE",
    bright: "#19AAF0",
    on: "#FFFFFF",
  },
  Math: {
    slug: "math",
    fill: "#3B54F7",
    secondary: "#4159F1",
    tertiary: "#A7B3FB",
    bright: "#0A2BFF",
    on: "#FFFFFF",
  },
  Variables: {
    slug: "variables",
    fill: "#BB5421",
    secondary: "#BB5A29",
    tertiary: "#EAA888",
    bright: "#E46525",
    on: "#FFFFFF",
  },
  "Data Science": {
    slug: "data-science",
    fill: "#058178",
    secondary: "#0A847C",
    tertiary: "#09CDBF",
    bright: "#0AFFEE",
    on: "#FFFFFF",
  },
  Advanced: {
    slug: "advanced",
    fill: "#62748D",
    secondary: "#6A7788",
    tertiary: "#AEB8C7",
    bright: "#6580A4",
    on: "#FFFFFF",
  },
  "Load Data": {
    slug: "load-data",
    fill: "#077CA0",
    secondary: "#0C7FA3",
    tertiary: "#28C6F6",
    bright: "#0AC6FF",
    on: "#FFFFFF",
  },
  Explore: {
    slug: "explore",
    fill: "#057F84",
    secondary: "#0A8387",
    tertiary: "#09CBD2",
    bright: "#0AF7FF",
    on: "#FFFFFF",
  },
  Statistics: {
    slug: "statistics",
    fill: "#058269",
    secondary: "#0A856C",
    tertiary: "#09CFA7",
    bright: "#0AFFCD",
    on: "#FFFFFF",
  },
  "Transforming Data": {
    slug: "transforming-data",
    fill: "#06844D",
    secondary: "#0A8750",
    tertiary: "#09D179",
    bright: "#0AFF93",
    on: "#FFFFFF",
  },
  Uncertainty: {
    slug: "uncertainty",
    fill: "#068530",
    secondary: "#0A8834",
    tertiary: "#09D34B",
    bright: "#0AFF5B",
    on: "#FFFFFF",
  },
  "Analyzing Relationships": {
    slug: "analyzing-relationships",
    fill: "#068512",
    secondary: "#0A8916",
    tertiary: "#09D41C",
    bright: "#0AFF21",
    on: "#FFFFFF",
  },
  "Filter & Sort": {
    slug: "filter-sort",
    fill: "#1F8506",
    secondary: "#24880A",
    tertiary: "#31D309",
    bright: "#3BFF0A",
    on: "#FFFFFF",
  },
  "Group & Compare": {
    slug: "group-compare",
    fill: "#3F8205",
    secondary: "#43850A",
    tertiary: "#65CF09",
    bright: "#7BFF0A",
    on: "#FFFFFF",
  },
  Charts: {
    slug: "charts",
    fill: "#617C05",
    secondary: "#647F0A",
    tertiary: "#9AC608",
    bright: "#C6FF0A",
    on: "#FFFFFF",
  },
  Communicate: {
    slug: "communicate",
    fill: "#877106",
    secondary: "#8A740A",
    tertiary: "#D7B409",
    bright: "#FFD60A",
    on: "#FFFFFF",
  },
  "3D Math": {
    slug: "3d-math",
    fill: "#6168D1",
    secondary: "#666DCB",
    tertiary: "#B0B3E8",
    bright: "#3741D2",
    on: "#FFFFFF",
  },
  "Raw Python": {
    slug: "raw-python",
    fill: "#6D7380",
    secondary: "#747679",
    tertiary: "#B4B7BF",
    bright: "#717E98",
    on: "#FFFFFF",
  },
  Loops: {
    slug: "loops",
    fill: "#B43CC6",
    secondary: "#B149C1",
    tertiary: "#DCA4E5",
    bright: "#BE37D2",
    on: "#FFFFFF",
  },
  Text: {
    slug: "text",
    fill: "#25806F",
    secondary: "#2D8373",
    tertiary: "#4CCBB2",
    bright: "#37D2B4",
    on: "#FFFFFF",
  },
  Lists: {
    slug: "lists",
    fill: "#597D24",
    secondary: "#5E802C",
    tertiary: "#90C740",
    bright: "#93D237",
    on: "#FFFFFF",
  },
  Functions: {
    slug: "functions",
    fill: "#BF38B1",
    secondary: "#BE42B2",
    tertiary: "#E4A1DD",
    bright: "#D237C2",
    on: "#FFFFFF",
  },
};

const CATEGORY_NAMES = Object.keys(BLOCK_PALETTE);

function getCategoryColour(name) {
  return BLOCK_PALETTE[name]?.fill;
}

function styleNameFor(name) {
  return `${BLOCK_PALETTE[name].slug.replace(/-/g, "_")}_blocks`;
}

function categoryStyleNameFor(name) {
  return `${BLOCK_PALETTE[name].slug.replace(/-/g, "_")}_category`;
}

function cssVarFor(name) {
  return `--cat-${BLOCK_PALETTE[name].slug}`;
}

function brightFor(name) {
  return BLOCK_PALETTE[name]?.bright;
}

function paletteCssText() {
  const vars = CATEGORY_NAMES.map((name) => {
    const entry = BLOCK_PALETTE[name];
    return `${cssVarFor(name)}: ${entry.fill};\n  ${cssVarFor(name)}-bright: ${entry.bright};`;
  }).join(";\n  ");
  return `:root {\n  ${vars};\n}`;
}

function blockStylesFromPalette() {
  const styles = {};
  for (const name of CATEGORY_NAMES) {
    const entry = BLOCK_PALETTE[name];
    styles[styleNameFor(name)] = {
      colourPrimary: entry.fill,
      colourSecondary: entry.secondary,
      colourTertiary: entry.tertiary,
    };
  }
  return styles;
}

function categoryStylesFromPalette() {
  const styles = {};
  for (const name of CATEGORY_NAMES) {
    const entry = BLOCK_PALETTE[name];
    styles[categoryStyleNameFor(name)] = {
      colour: entry.fill,
    };
  }
  return styles;
}

const STYLE_CATEGORY_ALIASES = Object.freeze({
  Starter: "Control",
  Scene: "Objects",
});

export {
  BLOCK_PALETTE,
  CATEGORY_NAMES,
  getCategoryColour,
  styleNameFor,
  categoryStyleNameFor,
  cssVarFor,
  brightFor,
  paletteCssText,
  blockStylesFromPalette,
  categoryStylesFromPalette,
  relativeLuminance,
  contrastRatio,
  hueOf,
  STYLE_CATEGORY_ALIASES,
};
