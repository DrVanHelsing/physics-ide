import { describe, test, expect, vi, afterEach, afterAll, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { testDb, testPool, truncateAuthTables } from "../db/testClient.js";
import { emails } from "../db/schema.js";
import { neverThrow, suppressErased, type MinimalLogger } from "./guards.js";
import { withPreferences } from "./withPreferences.js";
import {
  createBrevoMailer,
  BREVO_SEND_URL,
  SEND_TIMEOUT_MS,
  brevoStatus,
} from "./brevoMailer.js";

const CONFIG = { mailFrom: "no-reply@physics-ide.test", brevoApiKey: "test-api-key" };

/** A confirm-style body with a LIVE token — the exact shape ~20 existing
 *  assertions regex a token out of when the dev driver stores it. */
const RAW_TOKEN = "aB3-_xYz9token";
const TOKEN_BODY = `Hi there,

Confirm your address: http://127.0.0.1:3000/confirm?token=${RAW_TOKEN}

The link expires in 48 hours.`;

function msg(to: string, text = TOKEN_BODY) {
  return { to, template: "confirm", subject: "Confirm your address", text };
}

/** Brevo's documented success body — the id arrives ANGLE-BRACKETED. */
function okResponse(messageId = "<201798300811.5787683@relay.domain.com>") {
  return new Response(JSON.stringify({ messageId }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
}

async function rowFor(to: string) {
  const rows = await testDb.select().from(emails).where(eq(emails.toEmail, to));
  expect(rows).toHaveLength(1);
  return rows[0];
}

beforeAll(async () => {
  await truncateAuthTables();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await testPool.end();
});

describe("createBrevoMailer — the happy path", () => {
  test("writes ONE row: redacted body, status sent, the normalised provider id, and resolves void", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);

    await expect(mailer.send(msg("happy@example.com"))).resolves.toBeUndefined();

    const row = await rowFor("happy@example.com");
    expect(row.status).toBe(brevoStatus.sent);
    expect(row.template).toBe("confirm");
    expect(row.subject).toBe("Confirm your address");
    // Angle brackets stripped at write time so this is byte-comparable with
    // the webhook's bare `message-id`.
    expect(row.providerId).toBe("201798300811.5787683@relay.domain.com");
  });

  test("the PERSISTED body is redacted and no raw token survives anywhere in the row", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    await mailer.send(msg("redact@example.com"));

    const row = await rowFor("redact@example.com");
    expect(row.bodyText).toContain("token=REDACTED");
    expect(row.bodyText).not.toContain(RAW_TOKEN);
    // Not just body_text — nothing in the whole row may carry it.
    expect(JSON.stringify(row)).not.toContain(RAW_TOKEN);
  });

  test("every token= occurrence is redacted, not only the first", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    await mailer.send(
      msg("redact-all@example.com", "one ?token=AAA_bbb-1 two ?token=CCC_ddd-2 done"),
    );

    const row = await rowFor("redact-all@example.com");
    expect(row.bodyText).toBe("one ?token=REDACTED two ?token=REDACTED done");
  });

  test("the RECIPIENT still gets the real link — redaction is the log's, not the wire's", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    await mailer.send(msg("wire@example.com"));

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as { textContent: string };
    expect(sent.textContent).toContain(`token=${RAW_TOKEN}`);
    expect(sent.textContent).not.toContain("REDACTED");
  });
});

/** The wire format is copied from Brevo's live docs (see brevoMailer.ts's
 *  docblock for the URLs and the retrieval date), not from memory. */
describe("createBrevoMailer — the documented wire format", () => {
  test("POSTs Brevo's /v3/smtp/email shape with the api-key header", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    await mailer.send(msg("shape@example.com"));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(BREVO_SEND_URL);
    expect(BREVO_SEND_URL).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "api-key": "test-api-key",
      "content-type": "application/json",
      accept: "application/json",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      sender: { email: "no-reply@physics-ide.test" },
      to: [{ email: "shape@example.com" }],
      subject: "Confirm your address",
      textContent: TOKEN_BODY,
    });
  });

  test("a bare (non-bracketed) messageId is stored unchanged — normalisation is idempotent", async () => {
    const fetchImpl = vi.fn(async () => okResponse("bare.123@relay.domain.com"));
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    await mailer.send(msg("bare@example.com"));
    expect((await rowFor("bare@example.com")).providerId).toBe("bare.123@relay.domain.com");
  });

  test("a success with no usable messageId still records the send, with a null provider id", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("{}", { status: 201, headers: { "content-type": "application/json" } }),
    );
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    await expect(mailer.send(msg("noid@example.com"))).resolves.toBeUndefined();
    const row = await rowFor("noid@example.com");
    expect(row.status).toBe(brevoStatus.sent);
    expect(row.providerId).toBeNull();
  });
});

describe("createBrevoMailer — row first, then the wire", () => {
  test("the row exists with status sending BEFORE the provider is called", async () => {
    let statusAtCallTime: string | undefined;
    const fetchImpl = vi.fn(async () => {
      // Observed from inside the provider call: the log already knows.
      const rows = await testDb
        .select()
        .from(emails)
        .where(eq(emails.toEmail, "ordering@example.com"));
      statusAtCallTime = rows[0]?.status;
      return okResponse();
    });
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    await mailer.send(msg("ordering@example.com"));

    expect(statusAtCallTime).toBe(brevoStatus.sending);
    expect((await rowFor("ordering@example.com")).status).toBe(brevoStatus.sent);
  });
});

describe("createBrevoMailer — honest failure", () => {
  test("a 4xx leaves the row failed and REJECTS", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"message":"bad key"}', { status: 401 }));
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);

    await expect(mailer.send(msg("four@example.com"))).rejects.toThrow(/401/);
    const row = await rowFor("four@example.com");
    expect(row.status).toBe(brevoStatus.failed);
    expect(row.providerId).toBeNull();
    // A failed send is still a redacted record — never a token in the log.
    expect(row.bodyText).toContain("token=REDACTED");
  });

  test("a 5xx leaves the row failed and REJECTS", async () => {
    const fetchImpl = vi.fn(async () => new Response("upstream boom", { status: 503 }));
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);

    await expect(mailer.send(msg("five@example.com"))).rejects.toThrow(/503/);
    expect((await rowFor("five@example.com")).status).toBe(brevoStatus.failed);
  });

  test("a network-level rejection leaves the row failed and REJECTS", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const mailer = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);

    await expect(mailer.send(msg("net@example.com"))).rejects.toThrow(/ECONNREFUSED/);
    expect((await rowFor("net@example.com")).status).toBe(brevoStatus.failed);
  });
});

/** The black hole. A provider that ACCEPTS the connection and then answers
 *  nothing is not covered by any returning-failure test above: without a
 *  deadline `send()` never settles, and every one of the thirteen call
 *  sites awaits it inside a request handler behind --max-instances=1. */
describe("createBrevoMailer — the one deadline", () => {
  test("the production budget is ten seconds", () => {
    expect(SEND_TIMEOUT_MS).toBe(10_000);
  });

  test("a fetch that never answers is aborted by the driver's own deadline: failed row, rejection", async () => {
    let askedForMs: number | undefined;
    // AbortSignal.timeout's real semantics, compressed: the driver asks for
    // SEND_TIMEOUT_MS and we assert that, but fire in 20ms so the suite
    // doesn't sit through the real ten seconds.
    vi.spyOn(AbortSignal, "timeout").mockImplementation(((ms: number) => {
      askedForMs = ms;
      const controller = new AbortController();
      setTimeout(
        () => controller.abort(new DOMException("timed out", "TimeoutError")),
        20,
      ).unref?.();
      return controller.signal;
    }) as typeof AbortSignal.timeout);

    // Never settles on its own — only the signal can end it, exactly as a
    // real fetch against a silent server behaves.
    const blackHole = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject((init.signal as AbortSignal).reason),
          );
        }),
    );
    const mailer = createBrevoMailer(testDb, CONFIG, blackHole as unknown as typeof fetch);

    await expect(mailer.send(msg("blackhole@example.com"))).rejects.toThrow();
    expect(askedForMs).toBe(SEND_TIMEOUT_MS);
    const row = await rowFor("blackhole@example.com");
    expect(row.status).toBe(brevoStatus.failed);
  }, 5_000);
});

/** Pinned once through the real composition (app.ts:44-46). The driver
 *  REJECTS; never-throw is the thing that swallows. If the driver were
 *  changed to resolve on failure, the failed row would still be written and
 *  this test would keep passing — so it also asserts the log.error call
 *  that only a real rejection produces. */
describe("through the composed seam — neverThrow(log, withPreferences(db, suppressErased(driver)))", () => {
  test("a driver failure is swallowed at the top, and the failed row still lands", async () => {
    const log: MinimalLogger = { error: vi.fn() };
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const driver = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    const mailer = neverThrow(log, withPreferences(testDb, suppressErased(driver)));

    await expect(mailer.send(msg("seam@example.com"))).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalledTimes(1);
    expect((await rowFor("seam@example.com")).status).toBe(brevoStatus.failed);
  });

  test("an erased recipient never reaches the driver, so no row and no provider call", async () => {
    const log: MinimalLogger = { error: vi.fn() };
    const fetchImpl = vi.fn(async () => okResponse());
    const driver = createBrevoMailer(testDb, CONFIG, fetchImpl as unknown as typeof fetch);
    const mailer = neverThrow(log, withPreferences(testDb, suppressErased(driver)));

    await mailer.send(msg("gone@erased.invalid"));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      await testDb.select().from(emails).where(eq(emails.toEmail, "gone@erased.invalid")),
    ).toHaveLength(0);
  });
});
