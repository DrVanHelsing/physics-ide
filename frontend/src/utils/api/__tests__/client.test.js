import { describe, test, expect, vi, afterEach } from "vitest";
import { api, ApiError } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status, json) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api()", () => {
  test("GET returns parsed JSON and sends same-origin credentials", async () => {
    const fn = stubFetch(200, { user: { name: "A" } });
    const out = await api("/api/auth/me");
    expect(out).toEqual({ user: { name: "A" } });
    const [url, opts] = fn.mock.calls[0];
    expect(url).toBe("/api/auth/me");
    expect(opts.credentials).toBe("same-origin");
    expect(opts.method).toBe("GET");
  });

  test("POST serialises the body and sets the JSON header", async () => {
    const fn = stubFetch(201, { ok: true });
    await api("/api/auth/signup", { method: "POST", body: { a: 1 } });
    const [, opts] = fn.mock.calls[0];
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
  });

  test("a non-2xx response throws ApiError carrying the server's message and status", async () => {
    stubFetch(403, { error: "This site is at capacity — ask your teacher or the site owner." });
    const err = await api("/api/auth/signup", { method: "POST", body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("This site is at capacity — ask your teacher or the site owner.");
  });

  test("a non-JSON failure still throws a readable ApiError", async () => {
    const fn = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    }));
    vi.stubGlobal("fetch", fn);
    const err = await api("/api/health").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe("Something went wrong (HTTP 500).");
  });
});
