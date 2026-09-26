import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { executeSendWebhook } from "@/lib/automations/actions";
import { sendWebhookConfigSchema } from "@/lib/automations/types";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

/**
 * executeSendWebhook is the one automation action with real network I/O
 * (an admin-supplied webhook URL, see actions.ts's own comment on why it
 * throws instead of swallowing failures) — fetch is mocked here for the
 * same reason tests/integrations-teams.test.ts mocks it for the Teams
 * adapter, while the procedure it looks up stays a real DB row via the
 * usual test-tenant fixture.
 */

let t: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
});

afterAll(async () => {
  await t.cleanup();
});

describe("sendWebhookConfigSchema", () => {
  it("accepts a config with no authHeader (unchanged pre-3.3 shape)", () => {
    expect(sendWebhookConfigSchema.parse({ url: "https://example.com/hook" })).toEqual({
      url: "https://example.com/hook",
    });
  });

  it("accepts an authHeader alongside the url", () => {
    expect(sendWebhookConfigSchema.parse({ url: "https://example.com/hook", authHeader: "Bearer abc123" })).toEqual({
      url: "https://example.com/hook",
      authHeader: "Bearer abc123",
    });
  });

  it("rejects an empty-string authHeader rather than silently sending an empty header", () => {
    expect(() => sendWebhookConfigSchema.parse({ url: "https://example.com/hook", authHeader: "" })).toThrow();
  });
});

describe("executeSendWebhook", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not send an Authorization header when authHeader is not configured", async () => {
    const procedure = await t.createProcedure();
    await executeSendWebhook(t.tenant.id, procedure.id, { url: "https://example.com/hook" });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers).not.toHaveProperty("Authorization");
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("sends the configured authHeader verbatim as the Authorization header", async () => {
    const procedure = await t.createProcedure();
    await executeSendWebhook(t.tenant.id, procedure.id, {
      url: "https://example.com/hook",
      authHeader: "Basic dXNlcjpwYXNz",
    });

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Basic dXNlcjpwYXNz");
  });

  it("still sends the same procedure payload shape regardless of authHeader", async () => {
    const procedure = await t.createProcedure();
    await executeSendWebhook(t.tenant.id, procedure.id, {
      url: "https://example.com/hook",
      authHeader: "Bearer xyz",
    });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/hook");
    const payload = JSON.parse(opts.body);
    expect(payload).toMatchObject({
      event: "procedure.automation",
      procedure: { id: procedure.id, code: procedure.code, status: "DRAFT" },
    });
  });

  it("throws (rather than swallowing) when the webhook responds non-2xx, auth-header case included", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const procedure = await t.createProcedure();
    await expect(
      executeSendWebhook(t.tenant.id, procedure.id, { url: "https://example.com/hook", authHeader: "Bearer wrong" })
    ).rejects.toThrow(/401/);
  });
});
