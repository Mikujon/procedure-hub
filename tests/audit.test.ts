import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { logProcedureExport } from "@/lib/audit";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

/**
 * A real gap found while otherwise blocked on roadmap #1-3 (still waiting on
 * real external credentials): syncProcedureToSharePoint already wrote an
 * AuditLog row (action: EXPORT) whenever a procedure's PDF was pushed to
 * SharePoint, but the two manual downloads of the exact same kind of
 * content — GET .../export (plain PDF/DOCX/XLSX) and GET .../ack-certificate
 * (the Read & Acknowledge compliance certificate) — had no equivalent. A
 * previously-flagged, previously out-of-scope gap (CLAUDE.md, 2 set 2026),
 * closed here via one shared helper both routes (and sharepoint-sync) now
 * call, instead of three separate inline prisma.auditLog.create() calls.
 */
describe("logProcedureExport", () => {
  let ctx: TestTenant;

  afterAll(async () => {
    await ctx.cleanup();
  });

  it("writes a real AuditLog row with action EXPORT scoped to the right tenant/actor/procedure", async () => {
    ctx = await createTestTenant();
    const procedure = await ctx.createProcedure({ status: "PUBLISHED" });

    await logProcedureExport({
      tenantId: ctx.tenant.id,
      actorId: ctx.owner.id,
      procedureId: procedure.id,
      metadata: { format: "pdf", fileName: "test.pdf" },
    });

    const rows = await prisma.auditLog.findMany({ where: { tenantId: ctx.tenant.id, procedureId: procedure.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "EXPORT",
      entityType: "Procedure",
      entityId: procedure.id,
      actorId: ctx.owner.id,
      tenantId: ctx.tenant.id,
    });
    expect(rows[0].metadata).toEqual({ format: "pdf", fileName: "test.pdf" });
  });

  it("writes one independent row per call — two exports of the same procedure leave two rows", async () => {
    const procedure = await ctx.createProcedure({ status: "PUBLISHED" });

    await logProcedureExport({ tenantId: ctx.tenant.id, actorId: ctx.owner.id, procedureId: procedure.id, metadata: { format: "docx" } });
    await logProcedureExport({ tenantId: ctx.tenant.id, actorId: ctx.editor.id, procedureId: procedure.id, metadata: { format: "xlsx" } });

    const rows = await prisma.auditLog.findMany({ where: { tenantId: ctx.tenant.id, procedureId: procedure.id }, orderBy: { createdAt: "asc" } });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.actorId)).toEqual([ctx.owner.id, ctx.editor.id]);
  });
});
