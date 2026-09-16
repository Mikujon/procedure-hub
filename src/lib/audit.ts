import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Records an AuditLog row for a procedure export/download. Rule 2 ("every
 * state-changing action logs an AuditLog row") doesn't strictly require this
 * — a download changes nothing — but exporting a procedure's content to a
 * file that leaves the app is exactly the activity an ISO/GDPR/SOC2 audit
 * trail needs: who downloaded what, and when.
 *
 * syncProcedureToSharePoint (lib/sharepoint-sync.ts) already wrote this same
 * AuditAction.EXPORT for its own copy of the content; GET .../export (plain
 * PDF/DOCX/XLSX download) and GET .../ack-certificate (Read & Acknowledge
 * compliance certificate) had no equivalent until now — a real gap flagged
 * but left out of scope when SharePoint sync was built (CLAUDE.md, 2 set
 * 2026), closed here since both manual downloads share this one call.
 */
export async function logProcedureExport(params: {
  tenantId: string;
  actorId: string;
  procedureId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: "EXPORT",
      entityType: "Procedure",
      entityId: params.procedureId,
      procedureId: params.procedureId,
      metadata: params.metadata as Prisma.InputJsonValue,
    },
  });
}
