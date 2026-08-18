import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
});
