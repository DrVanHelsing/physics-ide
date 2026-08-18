import { describe, test, expect, afterAll } from "vitest";
import { buildApp } from "./app.js";
import { testDb, testPool } from "./db/testClient.js";

afterAll(async () => {
  await testPool.end();
});

describe("GET /api/health", () => {
  test("returns ok with the service name", async () => {
    const app = buildApp({ db: testDb });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "physics-ide-api" });
    await app.close();
  });
});
