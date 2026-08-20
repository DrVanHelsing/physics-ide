import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      // The esbuild.include below narrows Vite's transform to src/*.js (the
      // CRA-era JSX-in-.js shim), which also stops Vite from stripping
      // TypeScript out of the raw-TS @physics-ide/shared workspace source —
      // in dev and build alike. This scoped pre-plugin restores TS handling
      // for exactly that package and nothing else.
      name: "shared-workspace-ts",
      enforce: "pre",
      async transform(code, id) {
        if (/[\\/]shared[\\/]src[\\/][^?]*\.ts$/.test(id)) {
          return transformWithEsbuild(code, id, { loader: "ts" });
        }
      },
    },
    react(),
  ],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.js$/,
    exclude: [],
  },
  // Vitest 4 does NOT run on the Vite above: it bundles its own Vite 8, which
  // is oxc-based and prints "Both esbuild and oxc options were set. oxc options
  // will be used and esbuild options will be ignored." vite:oxc defaults to
  // exclude: /\.js$/, and @vitejs/plugin-react skips Babel outside a refresh
  // environment — so JSX inside .js files fails to parse in tests while dev and
  // build stay fine. Mirror the shim in oxc terms, scoped to the test mode so
  // the app's esbuild path is untouched. Proof: src/test/__tests__/jsxTransform.test.js.
  ...(mode === "test"
    ? {
        oxc: {
          include: /src\/.*\.js$/,
          exclude: [],
          lang: "jsx",
          jsx: { runtime: "automatic" },
        },
      }
    : {}),
  optimizeDeps: {
    esbuildOptions: { loader: { ".js": "jsx" } },
  },
  server: {
    port: 3000,
    // Explicit IPv4 loopback: on this Windows/Node setup, Vite's default
    // "localhost" binding resolves to the IPv6 loopback only, leaving
    // http://127.0.0.1:3000 unreachable.
    host: "127.0.0.1",
    proxy: {
      "/api": "http://127.0.0.1:4000",
    },
  },
  build: { outDir: "dist" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.js",
    include: ["src/**/*.test.js"],
  },
}));
