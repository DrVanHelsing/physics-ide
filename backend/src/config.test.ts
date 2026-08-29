import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/** config.ts runs `EnvSchema.parse(process.env)` once at module load and
 *  freezes the result into `config`, so each case here needs a FRESH module
 *  instance built from its own env — vi.resetModules() + vi.stubEnv(...) +
 *  a dynamic import, not a static `import { config } from "./config.js"`
 *  at the top of the file. (Task 6 reuses this exact pattern for its
 *  Secure-cookie test.) */
async function loadConfig() {
  vi.resetModules();
  return (await import("./config.js")).config;
}

const PRODUCTION_BASE = {
  NODE_ENV: "production",
  TICK_SECRET: "a-real-tick-secret",
  MAIL_DRIVER: "brevo",
  MAIL_FROM: "no-reply@example.com",
  BREVO_API_KEY: "a-real-brevo-key",
  MAIL_WEBHOOK_SECRET: "a-real-webhook-secret",
} as const;

function stubAll(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("MAIL_DRIVER", () => {
  test("defaults to dev", async () => {
    const config = await loadConfig();
    expect(config.mailDriver).toBe("dev");
  });

  test("must be \"brevo\" in production — boots with everything else production-required set and no MAIL_DRIVER throws", async () => {
    const { MAIL_DRIVER: _omit, ...rest } = PRODUCTION_BASE;
    stubAll(rest);
    await expect(loadConfig()).rejects.toThrow();
  });

  test("production with MAIL_DRIVER=brevo (and its required companions) parses cleanly", async () => {
    stubAll(PRODUCTION_BASE);
    const config = await loadConfig();
    expect(config.mailDriver).toBe("brevo");
  });
});

describe("MAIL_FROM / BREVO_API_KEY — required iff MAIL_DRIVER=brevo", () => {
  test("brevo without MAIL_FROM throws", async () => {
    stubAll({ MAIL_DRIVER: "brevo", BREVO_API_KEY: "k" });
    await expect(loadConfig()).rejects.toThrow();
  });

  test("brevo without BREVO_API_KEY throws", async () => {
    stubAll({ MAIL_DRIVER: "brevo", MAIL_FROM: "a@example.com" });
    await expect(loadConfig()).rejects.toThrow();
  });

  test("brevo with both set parses, and dev never requires either", async () => {
    stubAll({ MAIL_DRIVER: "brevo", MAIL_FROM: "a@example.com", BREVO_API_KEY: "k" });
    const brevo = await loadConfig();
    expect(brevo.mailFrom).toBe("a@example.com");
    expect(brevo.brevoApiKey).toBe("k");

    vi.unstubAllEnvs();
    const dev = await loadConfig();
    expect(dev.mailFrom).toBeUndefined();
    expect(dev.brevoApiKey).toBeUndefined();
  });
});

describe("MAIL_WEBHOOK_SECRET — both halves of the tick idiom, NOT tied to the driver", () => {
  test("unset under the default MAIL_DRIVER=dev falls back to a non-optional dev sentinel (never undefined)", async () => {
    const config = await loadConfig();
    expect(config.mailWebhookSecret).toBe("dev-mail-hook");
  });

  test("required in production even though every other production var (including a valid MAIL_DRIVER=brevo) is set", async () => {
    const { MAIL_WEBHOOK_SECRET: _omit, ...rest } = PRODUCTION_BASE;
    stubAll(rest);
    await expect(loadConfig()).rejects.toThrow();
  });

  test("production with it set parses and carries the real value through, not the dev fallback", async () => {
    stubAll(PRODUCTION_BASE);
    const config = await loadConfig();
    expect(config.mailWebhookSecret).toBe("a-real-webhook-secret");
  });
});

describe("TRUST_PROXY — z.enum(['true','false']), not z.coerce.boolean()", () => {
  test("defaults to false when unset", async () => {
    const config = await loadConfig();
    expect(config.trustProxy).toBe(false);
  });

  test('the string "false" maps to false — the z.coerce.boolean() trap (Boolean("false") === true) does NOT apply here', async () => {
    stubAll({ TRUST_PROXY: "false" });
    const config = await loadConfig();
    expect(config.trustProxy).toBe(false);
  });

  test('the string "true" maps to true', async () => {
    stubAll({ TRUST_PROXY: "true" });
    const config = await loadConfig();
    expect(config.trustProxy).toBe(true);
  });

  test("any other value is rejected by the enum", async () => {
    stubAll({ TRUST_PROXY: "yes" });
    await expect(loadConfig()).rejects.toThrow();
  });
});
