// eslint.config.js — repo-root flat config (ESLint 9)
//
// Three scoped blocks, one per workspace family:
//   1) backend/src + shared/src (TypeScript, project-less — no type-aware rules
//      in this pass; see Plan 8 Task 3 brief D§10)
//   2) frontend/src (JS with JSX-in-.js, React + react-hooks)
// Everything else (tests, generated/vendor output, drizzle migrations) is
// excluded via the global `ignores` block below. Tests are policed by vitest
// conventions, not lint, in this pass — recorded in the task brief.
//
// Non-gating by design: `npm run lint` is not wired into build or test yet
// (spec §18 forward-reference 7 stays open deliberately).

"use strict";

const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "backend/drizzle/**",
      "frontend/public/vendor/**",
      "frontend/e2e/**",
      "**/*.test.*",
      "**/__tests__/**",
      // Build/coverage output that obviously fits the same spirit as dist/.
      "**/coverage/**",
      ".worktrees/**",
    ],
  },

  // backend/src + shared/src — TypeScript, project-less
  ...tseslint.config({
    files: ["backend/src/**/*.ts", "shared/src/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  }),

  // frontend/src — JS with JSX-in-.js (CRA-era shim), React + react-hooks
  {
    files: ["frontend/src/**/*.js"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      // "recommended-latest" is the flat-config-shaped export (rules only —
      // the plugin object is already registered above); the plain
      // "recommended" export is eslintrc-legacy-shaped in this plugin
      // version and does not compose here.
      ...reactHooks.configs["recommended-latest"].rules,
      // The codebase already prefixes intentionally-unused function params
      // with `_` (e.g. `_block`, `_key`) — recognize that existing
      // convention instead of renaming call sites.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // House style: this codebase has never used PropTypes (plain JS, no
      // runtime prop validation convention) — fired 540 times pre-config.
      "react/prop-types": "off",
      // House style: UI copy is written with plain straight quotes/
      // apostrophes throughout (help text, prose pages) rather than HTML
      // entities — fired 54 times pre-config, 38 of them in one help page.
      "react/no-unescaped-entities": "off",
    },
  },
];
