import { DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyEvent } from "@/lib/integrations/notify";
import { indexProcedure, removeFromIndex, buildSearchDocument, stripHtml } from "@/lib/search";
import { startAckCampaign } from "@/lib/ack";

/**
 * Approval pipeline:
 *
 *   DRAFT -> IN_REVIEW -> COMPLIANCE_APPROVAL -> MANAGEMENT_APPROVAL -> PUBLISHED
 *                                                                          |
 *                                                                       ARCHIVED
 *
 * COMPLIANCE_APPROVAL is skipped automatically for procedures where
 * isCritical === false and no compliance-related tag is present — most
 * departments' day-to-day content only needs Review + Management sign-off.
 * This keeps the workflow lightweight for non-regulated content while still
 * enforcing the stricter path for ISO/GDPR/SOC2-tagged and "critical" docs.
 */

const PIPELINE: DocumentStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "COMPLIANCE_APPROVAL",
  "MANAGEMENT_APPROVAL",
  "PUBLISHED",
];

export async function submitForReview(procedureId: string, actorId: string) {
  const procedure = await prisma.procedure.findUniqueOrThrow({ where: { id: procedureId } });

  const nextStage = await resolveNextStage(procedure.id, "DRAFT", procedure.isCritical);

  await prisma.$transaction([
    prisma.procedure.update({
      where: { id: procedureId },
      data: { status: nextStage },
    }),
    prisma.workflowStep.create({
      data: { procedureId, stage: nextStage, status: "PENDING" },
    }),
    prisma.auditLog.create({
      data: {
        tenantId: procedure.tenantId,
        actorId,
        action: "UPDATE",
        entityType: "Procedure",
        entityId: procedureId,
        procedureId,
        metadata: { transition: `DRAFT -> ${nextStage}` },
      },
    }),
  ]);

  await notifyEvent({
    tenantId: procedure.tenantId,
    type: "APPROVAL_REQUESTED",
    procedureId,
    title: `"${procedure.title}" awaiting ${nextStage.replace("_", " ").toLowerCase()}`,
  });

  return nextStage;
}

export async function decideWorkflowStep(
  stepId: string,
  actorId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string
) {
  const step = await prisma.workflowStep.findUniqueOrThrow({
    where: { id: stepId },
    include: { procedure: true },
  });

  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { status: decision, comment, decidedAt: new Date(), assignedToId: actorId },
  });

  if (decision === "REJECTED") {
    await prisma.procedure.update({
      where: { id: step.procedureId },
      data: { status: "REJECTED" },
    });
    await notifyEvent({
      tenantId: step.procedure.tenantId,
      type: "APPROVAL_DECIDED",
      procedureId: step.procedureId,
      title: `"${step.procedure.title}" was rejected at ${step.stage.replace("_", " ").toLowerCase()}`,
    });
    return "REJECTED" as const;
  }

  const nextStage = await resolveNextStage(step.procedureId, step.stage, step.procedure.isCritical);

  await prisma.procedure.update({
    where: { id: step.procedureId },
    data: {
      status: nextStage,
      publishedAt: nextStage === "PUBLISHED" ? new Date() : undefined,
    },
  });

  if (nextStage !== "PUBLISHED") {
    await prisma.workflowStep.create({
      data: { procedureId: step.procedureId, stage: nextStage, status: "PENDING" },
    });
  }

  await notifyEvent({
    tenantId: step.procedure.tenantId,
    type: nextStage === "PUBLISHED" ? "PUBLISHED" : "APPROVAL_REQUESTED",
    procedureId: step.procedureId,
    title:
      nextStage === "PUBLISHED"
        ? `"${step.procedure.title}" has been published`
        : `"${step.procedure.title}" awaiting ${nextStage.replace("_", " ").toLowerCase()}`,
  });

  // The search index (and any AI retrieval built on it) filters on
  // status = PUBLISHED — reaching PUBLISHED only via a content save
  // (blocks/publish or the legacy PATCH) would leave a procedure invisible
  // in search after being approved through this, the real-world path.
  if (nextStage === "PUBLISHED") {
    await syncSearchIndex(step.procedureId);
    // A new PUBLISHED version always opens a fresh obligation — old
    // acknowledgments (scoped by versionNumber) never count toward it.
    await startAckCampaign(step.procedureId);
  }

  return nextStage;
}

async function syncSearchIndex(procedureId: string) {
  const procedure = await prisma.procedure.findUnique({
    where: { id: procedureId },
    include: { department: true, tags: { include: { tag: true } }, currentVersion: { select: { contentHtml: true } } },
  });
  if (!procedure) return;
  await indexProcedure(
    buildSearchDocument(procedure, stripHtml(procedure.currentVersion?.contentHtml ?? "")),
    procedure.tenantId
  );
}

async function resolveNextStage(
  procedureId: string,
  currentStage: DocumentStatus,
  isCritical: boolean
): Promise<DocumentStatus> {
  const currentIndex = PIPELINE.indexOf(currentStage);
  let nextIndex = currentIndex + 1;

  // Skip COMPLIANCE_APPROVAL for non-critical, non-compliance-tagged content.
  if (PIPELINE[nextIndex] === "COMPLIANCE_APPROVAL" && !isCritical) {
    const hasComplianceTag = await prisma.procedureTag.findFirst({
      where: {
        procedureId,
        tag: { name: { in: ["GDPR", "ISO27001", "ISO9001", "SOC2", "Compliance", "Mandatory"] } },
      },
    });
    if (!hasComplianceTag) nextIndex += 1;
  }

  return PIPELINE[nextIndex] ?? "PUBLISHED";
}

export async function archiveProcedure(procedureId: string, actorId: string) {
  const procedure = await prisma.procedure.findUniqueOrThrow({ where: { id: procedureId } });
  await prisma.procedure.update({
    where: { id: procedureId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      tenantId: procedure.tenantId,
      actorId,
      action: "ARCHIVE",
      entityType: "Procedure",
      entityId: procedureId,
      procedureId,
    },
  });
  // Owned here rather than left to the caller — any future path that
  // archives a procedure through this function (not just the one route
  // today) must not be able to forget to pull it out of search/AI retrieval.
  await removeFromIndex(procedureId, procedure.tenantId);
}
