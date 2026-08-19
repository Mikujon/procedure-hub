import type { NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyEvent, resolveDefaultRecipients } from "@/lib/integrations/notify";
import { runAckCompletionAutomations } from "@/lib/automations/engine";

/**
 * Opens a Read & Acknowledge campaign for a procedure's current version and
 * fires the INITIAL reminder — called from lib/workflow/index.ts right
 * after a requiresAck procedure reaches PUBLISHED. Idempotent per
 * (procedureId, versionNumber): re-running (e.g. a retried request) never
 * creates a second campaign or a duplicate INITIAL reminder for the same version.
 */
export async function startAckCampaign(procedureId: string) {
  const procedure = await prisma.procedure.findUnique({
    where: { id: procedureId },
    include: { currentVersion: { select: { versionNumber: true } } },
  });
  if (!procedure || !procedure.requiresAck || !procedure.currentVersion) return;

  const versionNumber = procedure.currentVersion.versionNumber;

  const existing = await prisma.ackCampaign.findFirst({ where: { procedureId, versionNumber } });
  if (existing) return;

  const recipients = await resolveDefaultRecipients(procedure.tenantId, procedureId);
  const targetUserIds = recipients.map((r) => r.id);
  if (targetUserIds.length === 0) return;

  const campaign = await prisma.ackCampaign.create({
    data: { tenantId: procedure.tenantId, procedureId, versionNumber, targetUserIds },
  });
  await prisma.ackReminder.create({ data: { campaignId: campaign.id, stage: "INITIAL" } });

  await notifyEvent({
    tenantId: procedure.tenantId,
    type: "ACK_REQUIRED",
    procedureId,
    title: `"${procedure.title}" richiede conferma di lettura`,
    body: "Conferma di aver letto questa procedura.",
    userIds: targetUserIds,
    ackVersionNumber: versionNumber,
  });
}

/**
 * Records one Read & Acknowledge confirmation and checks whether it closes
 * out the active AckCampaign for that version — shared by the authenticated
 * route (POST /api/acknowledgments) and the token-based one-click confirm
 * (GET /api/acknowledgments/quick-confirm) so the "did this complete the
 * campaign" logic exists in exactly one place.
 */
export async function recordAcknowledgment(
  procedureId: string,
  userId: string,
  versionNumber: number,
  ipAddress?: string,
  channel: NotificationChannel = "IN_APP"
) {
  const ack = await prisma.acknowledgment.upsert({
    where: { procedureId_userId_versionNumber: { procedureId, userId, versionNumber } },
    update: {},
    create: { procedureId, userId, versionNumber, ipAddress, channel },
  });

  const procedure = await prisma.procedure.findUniqueOrThrow({ where: { id: procedureId } });

  await prisma.auditLog.create({
    data: {
      tenantId: procedure.tenantId,
      actorId: userId,
      action: "ACKNOWLEDGE",
      entityType: "Procedure",
      entityId: procedureId,
      procedureId,
      metadata: { versionNumber },
    },
  });

  await maybeCompleteCampaign(procedureId, versionNumber);

  return ack;
}

/** If every target of the active campaign for this version has now acknowledged, close it out and notify the owner. */
async function maybeCompleteCampaign(procedureId: string, versionNumber: number) {
  const campaign = await prisma.ackCampaign.findFirst({
    where: { procedureId, versionNumber, completedAt: null },
  });
  if (!campaign) return;

  const acknowledgedCount = await prisma.acknowledgment.count({
    where: { procedureId, versionNumber, userId: { in: campaign.targetUserIds } },
  });
  if (acknowledgedCount < campaign.targetUserIds.length) return;

  await prisma.ackCampaign.update({ where: { id: campaign.id }, data: { completedAt: new Date() } });

  const procedure = await prisma.procedure.findUnique({ where: { id: procedureId } });
  if (procedure?.ownerId) {
    await notifyEvent({
      tenantId: campaign.tenantId,
      type: "ACK_REQUIRED",
      procedureId,
      title: `Read & Acknowledge completo al 100% per "${procedure.title}"`,
      body: "Tutte le persone coinvolte hanno confermato la lettura. Certificato disponibile.",
      userIds: [procedure.ownerId],
    });
  }

  // Owner notification above is unconditional and always was. This is the
  // admin-configurable extra layer: a rule can broadcast "100% read" to a
  // whole department or the tenant, not just the one owner.
  await runAckCompletionAutomations(campaign.tenantId, procedureId);
}
