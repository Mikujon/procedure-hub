import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSharePointAccessToken } from "@/lib/integrations/sharepoint-auth";
import { uploadFileToSharePoint, type SharePointUploadConfig } from "@/lib/integrations/sharepoint";

/**
 * Unit tests for the SharePoint/Graph adapter — fetch is mocked here (network
 * I/O, same treatment tests/integrations-teams.test.ts and
 * tests/automations-webhook-action.test.ts already give it), since there's
 * no real Azure AD app registration + SharePoint site to call in this
 * sandbox. lib/sharepoint-sync.ts's permission/status gating is covered
 * separately (tests/sharepoint-sync.test.ts) against the real DB.
 */

const CREDS = { azureTenantId: "tenant-123", clientId: "client-abc", clientSecret: "secret-xyz" };

describe("getSharePointAccessToken", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("fetch", (fetchMock = vi.fn()));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs a client_credentials grant to the tenant-specific token endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: "tok-1" }) });
    const token = await getSharePointAccessToken(CREDS);
    expect(token).toBe("tok-1");

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token");
    expect(opts.method).toBe("POST");
    const body = new URLSearchParams(opts.body);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("client-abc");
    expect(body.get("client_secret")).toBe("secret-xyz");
    expect(body.get("scope")).toBe("https://graph.microsoft.com/.default");
  });

  it("throws with the error_description when the token endpoint rejects the request", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error_description: "invalid_client" }) });
    await expect(getSharePointAccessToken(CREDS)).rejects.toThrow(/invalid_client/);
  });

  it("throws if a 200 response is somehow missing an access_token", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(getSharePointAccessToken(CREDS)).rejects.toThrow(/token exchange failed/i);
  });
});

describe("uploadFileToSharePoint", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const config: SharePointUploadConfig = { ...CREDS, siteId: "contoso.sharepoint.com,abc,def", drivePath: "Procedure Hub/Legal" };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      (fetchMock = vi.fn(async (url: string) => {
        if (url.includes("login.microsoftonline.com")) return { ok: true, json: async () => ({ access_token: "tok-1" }) };
        return { ok: true, json: async () => ({ webUrl: "https://contoso.sharepoint.com/file.pdf", id: "item-1" }) };
      }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uploads to the correct Graph drive path, URL-encoding each folder segment", async () => {
    const result = await uploadFileToSharePoint(config, "LEG-001-copia-v1.pdf", "application/pdf", Buffer.from("fake pdf"));
    expect(result).toEqual({ webUrl: "https://contoso.sharepoint.com/file.pdf", itemId: "item-1" });

    const uploadCall = fetchMock.mock.calls.find((call: any[]) => call[0].includes("graph.microsoft.com"));
    expect(uploadCall).toBeDefined();
    const [url, opts] = uploadCall!;
    expect(url).toBe(
      "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com%2Cabc%2Cdef/drive/root:/Procedure%20Hub/Legal/LEG-001-copia-v1.pdf:/content"
    );
    expect(opts.method).toBe("PUT");
    expect(opts.headers.Authorization).toBe("Bearer tok-1");
    expect(opts.headers["Content-Type"]).toBe("application/pdf");
    expect(Buffer.from(opts.body).toString()).toBe("fake pdf");
  });

  it("throws (with the response body) when Graph responds non-2xx", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("login.microsoftonline.com")) return { ok: true, json: async () => ({ access_token: "tok-1" }) };
      return { ok: false, status: 403, text: async () => '{"error":{"code":"accessDenied"}}' };
    });
    await expect(uploadFileToSharePoint(config, "f.pdf", "application/pdf", Buffer.from("x"))).rejects.toThrow(
      /403.*accessDenied/s
    );
  });

  it("throws if the upload response is missing webUrl/id (unexpected Graph shape)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("login.microsoftonline.com")) return { ok: true, json: async () => ({ access_token: "tok-1" }) };
      return { ok: true, json: async () => ({}) };
    });
    await expect(uploadFileToSharePoint(config, "f.pdf", "application/pdf", Buffer.from("x"))).rejects.toThrow(
      /unexpected Graph API response/i
    );
  });
});
