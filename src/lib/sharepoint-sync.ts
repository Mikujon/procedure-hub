import { prisma } from "@/lib/prisma";
import { canEditProcedure, type ActingUser } from "@/lib/permissions";
import { logProcedureExport } from "@/lib/audit";
import { extractExportBlocks } from "@/lib/export/content-blocks";
import { generateProcedurePdf } from "@/lib/export/pdf";
import { uploadFileToSharePoint, type SharePointUploadConfig } from "@/lib/integrations/sharepoint";
import { slugify } from "@/lib/utils";

export type SyncToSharePointResult =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "no_content" }
  | { status: "not_configured" }
  | { status: "ok"; webUrl: string };

function isValidSharePointConfig(config: unknown): config is SharePointUploadConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  return (
    typeof c.azureTenantId === "string" &&
    c.azureTenantId.length > 0 &&
    typeof c.clientId === "string" &&
    c.clientId.length > 0 &&
    typeof c.clientSecret === "string" &&
    c.clientSecret.length > 0 &&
    typeof c.siteId === "string" &&
    c.siteId.length > 0 &&
    typeof c.drivePath === "string" &&
    c.drivePath.length > 0
  );
}

/**
 * Pushes the procedure's *current published version*, rendered as PDF (same
 * generateProcedurePdf as GET .../export?format=pdf), into the tenant's
 * configured SharePoint document library. Only PUBLISHED content is ever
 * synced — same "external systems only ever see what's actually
 * published" rule syncSearchIndex (lib/workflow/index.ts) already follows
 * for MeiliSearch, applied here to a second external system.
 *
 * Gated on canEditProcedure (rule 4), not canViewProcedure: pushing a copy
 * of a procedure out to an external, separately-permissioned surface is a
 * content-management action, the same tier as adding an attachment, not a
 * read.
 */
export async function syncProcedureToSharePoint(actor: ActingUser, procedureId: string): Promise<SyncToSharePointResult> {
  const procedure = await prisma.procedure.findFirst({
    where: { id: procedureId, tenantId: actor.tenantId },
    include: { department: true, currentVersion: true, tags: { include: { tag: true } } },
  });
  if (!procedure) return { status: "not_found" };

  const canEdit = await canEditProcedure(actor, procedure.departmentId);
  if (!canEdit) return { status: "forbidden" };

  if (procedure.status !== "PUBLISHED" || !procedure.currentVersion) return { status: "no_content" };

  const integration = await prisma.integration.findUnique({
    where: { tenantId_type: { tenantId: actor.tenantId, type: "SHAREPOINT" } },
  });
  if (!integration?.isEnabled || !isValidSharePointConfig(integration.config)) {
    return { status: "not_configured" };
  }

  const blocks = extractExportBlocks(procedure.currentVersion.contentJson as any);
  const tags = procedure.tags.map((t) => t.tag.name);

  const pdfBytes = await generateProcedurePdf({
    title: procedure.title,
    code: procedure.code,
    departmentName: procedure.department.name,
    summary: procedure.summary,
    versionNumber: procedure.currentVersion.versionNumber,
    tags,
    blocks,
  });

  const fileName = `${procedure.code}-${slugify(procedure.title)}-v${procedure.currentVersion.versionNumber}.pdf`;
  const { webUrl } = await uploadFileToSharePoint(integration.config, fileName, "application/pdf", Buffer.from(pdfBytes));

  await logProcedureExport({
    tenantId: actor.tenantId,
    actorId: actor.id,
    procedureId: procedure.id,
    metadata: { destination: "SharePoint", fileName, webUrl },
  });

  return { status: "ok", webUrl };
}
