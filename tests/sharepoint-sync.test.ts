import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { syncProcedureToSharePoint } from "@/lib/sharepoint-sync";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

/**
 * Integration test for the permission/status gating in
 * lib/sharepoint-sync.ts, against the real test-tenant fixture — the
 * network call itself (lib/integrations/sharepoint.ts) is unit-tested in
 * isolation (tests/sharepoint.test.ts); here fetch is mocked only for the
 * one "ok" path that needs to get past it, so the real DB/permission/
 * PDF-generation logic in between is what's actually exercised.
 */
let t: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
});

afterAll(async () => {
  await t.cleanup();
});

const VALID_CONFIG = {
  azureTenantId: "azure-tenant-1",
  clientId: "client-1",
  clientSecret: "secret-1",
  siteId: "contoso.sharepoint.com,a,b",
  drivePath: "Procedure Hub",
};

async function setIntegration(config: Record<string, any> | null, isEnabled = true) {
  await prisma.integration.deleteMany({ where: { tenantId: t.tenant.id, type: "SHAREPOINT" } });
  if (config) {
    await prisma.integration.create({ data: { tenantId: t.tenant.id, type: "SHAREPOINT", isEnabled, config } });
  }
}

describe("syncProcedureToSharePoint", () => {
  it("returns not_found for a procedure id in another tenant", async () => {
    const other = await createTestTenant();
    try {
      const proc = await other.createProcedure({ status: "PUBLISHED" });
      const result = await syncProcedureToSharePoint({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
      expect(result).toEqual({ status: "not_found" });
    } finally {
      await other.cleanup();
    }
  });

  it("returns forbidden for a user without edit rights on the procedure's department", async () => {
    await setIntegration(VALID_CONFIG);
    const proc = await t.createProcedure({ status: "PUBLISHED" });
    // t.viewer is only a VIEWER in the fixture's department — canEditProcedure requires EDITOR/DEPARTMENT_OWNER/ADMIN.
    const result = await syncProcedureToSharePoint({ id: t.viewer.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns no_content for a procedure that isn't PUBLISHED yet", async () => {
    await setIntegration(VALID_CONFIG);
    const proc = await t.createProcedure({ status: "DRAFT" });
    const result = await syncProcedureToSharePoint({ id: t.editor.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "no_content" });
  });

  it("returns not_configured when no SHAREPOINT integration exists for the tenant", async () => {
    await setIntegration(null);
    const proc = await t.createProcedure({ status: "PUBLISHED" });
    const result = await syncProcedureToSharePoint({ id: t.editor.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "not_configured" });
  });

  it("returns not_configured when the integration exists but is disabled", async () => {
    await setIntegration(VALID_CONFIG, false);
    const proc = await t.createProcedure({ status: "PUBLISHED" });
    const result = await syncProcedureToSharePoint({ id: t.editor.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "not_configured" });
  });

  it("returns not_configured when the stored config is missing required fields", async () => {
    await setIntegration({ siteId: "only-this-field" });
    const proc = await t.createProcedure({ status: "PUBLISHED" });
    const result = await syncProcedureToSharePoint({ id: t.editor.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "not_configured" });
  });

  describe("with a valid, enabled configuration and a mocked Graph API", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      await setIntegration(VALID_CONFIG);
      vi.stubGlobal(
        "fetch",
        (fetchMock = vi.fn(async (url: string) => {
          if (url.includes("login.microsoftonline.com")) return { ok: true, json: async () => ({ access_token: "tok" }) };
          return { ok: true, json: async () => ({ webUrl: "https://contoso.sharepoint.com/synced.pdf", id: "item-1" }) };
        }))
      );
    });
    afterEach(() => vi.unstubAllGlobals());

    it("succeeds for an editor on a PUBLISHED procedure, returning the webUrl and writing an AuditLog", async () => {
      const proc = await t.createProcedure({ status: "PUBLISHED" });
      const result = await syncProcedureToSharePoint({ id: t.editor.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
      expect(result).toEqual({ status: "ok", webUrl: "https://contoso.sharepoint.com/synced.pdf" });

      const log = await prisma.auditLog.findFirst({
        where: { tenantId: t.tenant.id, entityType: "Procedure", entityId: proc.id, action: "EXPORT" },
        orderBy: { createdAt: "desc" },
      });
      expect(log).not.toBeNull();
      expect(log?.metadata).toMatchObject({ destination: "SharePoint", webUrl: "https://contoso.sharepoint.com/synced.pdf" });
    });

    it("succeeds for an ADMIN regardless of department membership", async () => {
      const proc = await t.createProcedure({ status: "PUBLISHED" });
      const result = await syncProcedureToSharePoint({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "ADMIN" }, proc.id);
      expect(result.status).toBe("ok");
    });

    it("actually calls the Graph API with the procedure's real PDF content, not a stub", async () => {
      const proc = await t.createProcedure({ status: "PUBLISHED" });
      await syncProcedureToSharePoint({ id: t.editor.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);

      const uploadCall = fetchMock.mock.calls.find((call: any[]) => call[0].includes("graph.microsoft.com"));
      expect(uploadCall).toBeDefined();
      const [url, opts] = uploadCall!;
      expect(url).toContain(encodeURIComponent(proc.code));
      expect(opts.headers["Content-Type"]).toBe("application/pdf");
      // A real PDF starts with this magic header — proves this is
      // generateProcedurePdf's actual output, not a placeholder buffer.
      expect(Buffer.from(opts.body).subarray(0, 5).toString()).toBe("%PDF-");
    });
  });
});
