import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
});
