import { describe, test, expect } from "vitest";
import { buildApp } from "./app.js";

describe("GET /api/health", () => {
  test("returns ok with the service name", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "physics-ide-api" });
    await app.close();
  });
});
