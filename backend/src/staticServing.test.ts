/**
 * Single-origin static serving (DEPLOY-GCP option 1, Task 10b): with
 * STATIC_DIR set, this API serves the built SPA from the same origin —
 * Firebase Hosting's rewrite cannot reach africa-south1, so the container
 * carries its own static story. The contract pinned here:
 *
 *   - "/" serves index.html with the COOP/COEP pair;
 *   - /assets/** is immutable for a year (content-hashed by the build);
 *   - /vendor/** and /blockly-media/** get a day (unhashed, the offline
 *     promise's Locked term — product-contract.md's /vendor clause);
 *   - an unknown non-API path falls back to index.html (SPA routing);
 *   - an unknown /api path stays a JSON 404 — the fallback must never
 *     swallow the API's own namespace;
 *   - /api/health keeps answering exactly as before.
 *
 * Without STATIC_DIR nothing changes at all — every other suite in this
 * workspace runs the API-only shape and proves that half.
 */
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";

const dir = mkdtempSync(path.join(tmpdir(), "pide-static-"));
writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>Physics IDE</title>");
mkdirSync(path.join(dir, "assets"));
writeFileSync(path.join(dir, "assets", "index-abc123.js"), "// bundle");
mkdirSync(path.join(dir, "vendor"));
writeFileSync(path.join(dir, "vendor", "glow.3.2.min.js"), "// glowscript");
mkdirSync(path.join(dir, "blockly-media"));
writeFileSync(path.join(dir, "blockly-media", "click.mp3"), "mp3");

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv("STATIC_DIR", dir);
  vi.resetModules();
  const { buildApp } = await import("./app.js");
  const { testDb } = await import("./db/testClient.js");
  app = buildApp({ db: testDb });
});

afterAll(async () => {
  await app.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe("the container serves the SPA — same origin, honest headers", () => {
  test('"/" is index.html, carrying the COOP/COEP pair', async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(res.headers["cross-origin-embedder-policy"]).toBe("unsafe-none");
    expect(res.body).toContain("Physics IDE");
  });

  test("/assets/** is immutable — the build hashes those names", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/index-abc123.js" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  test("/vendor/** gets a day — unhashed, the Locked offline term", async () => {
    const res = await app.inject({ method: "GET", url: "/vendor/glow.3.2.min.js" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=86400");
  });

  test("/blockly-media/** gets a day too — same unhashed runtime-fetched shape", async () => {
    const res = await app.inject({ method: "GET", url: "/blockly-media/click.mp3" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=86400");
  });

  test("an unknown path is the SPA shell — client routing owns it", async () => {
    const res = await app.inject({ method: "GET", url: "/assignments/whatever" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("Physics IDE");
  });

  test("an unknown /api path is STILL a JSON 404 — the fallback never swallows the API", async () => {
    const res = await app.inject({ method: "GET", url: "/api/definitely-not-a-route" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
  });

  test("/api/health answers exactly as before", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "physics-ide-api" });
  });
});
