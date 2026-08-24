import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notificationsQueue } from "@/lib/notifications-queue";

interface NotifyEventInput {
  tenantId: string;
  type: NotificationType;
  procedureId?: string;
  title: string;
  body?: string;
  /** Explicit recipients; if omitted, resolved from department membership / all tenant users. */
  userIds?: string[];
  /** ACK_REQUIRED only: versionNumber to sign the per-recipient "Conferma lettura" link for (Fase 4). */
  ackVersionNumber?: number;
  /** False = in-app Notification row only, skip the Slack/Google Chat fan-out (Fase 4's DAY_3 reminder stage). Default true. */
  externalChannels?: boolean;
  /** Appended to the computed /procedures/[id] link, e.g. "#commenti" so a @mention notification (2.6) lands the reader on the thread instead of the top of the page. */
  linkSuffix?: string;
}

/**
 * Single entry point for firing a notification. Fans out to:
 *   1. In-app Notification row (always created — this is the source of truth
 *      for the bell icon / notification center).
 *   2. Slack, if the tenant has an enabled Slack integration and the
 *      recipient opted in.
 *   3. Google Chat, same conditions.
 *   4. Email is left as a stub (Resend client is wired but not called here —
 *      hook into notifyEvent once transactional templates are designed).
 */
export async function notifyEvent(input: NotifyEventInput) {
  const recipients = input.userIds?.length
    ? await prisma.user.findMany({ where: { id: { in: input.userIds } } })
    : await resolveDefaultRecipients(input.tenantId, input.procedureId);

  const linkUrl = input.procedureId ? `/procedures/${input.procedureId}${input.linkSuffix ?? ""}` : undefined;

  await prisma.notification.createMany({
    data: recipients.map((r) => ({
      tenantId: input.tenantId,
      userId: r.id,
      type: input.type,
      title: input.title,
      body: input.body,
      linkUrl,
      channel: "IN_APP",
    })),
  });

  if (input.externalChannels === false) return;

  // External fan-out (Slack/Google Chat) is the slow, failure-prone part —
  // never run it inline with the request/response cycle. Enqueue and return;
  // workers/notifications-worker.ts (processNotificationFanout) does the
  // actual batched-preference-lookup + parallel-send work off-request.
  await notificationsQueue.add("fanout", {
    tenantId: input.tenantId,
    type: input.type,
    title: input.title,
    body: input.body,
    linkUrl,
    recipientIds: recipients.map((r) => r.id),
    ackContext:
      input.procedureId && input.ackVersionNumber !== undefined
        ? { procedureId: input.procedureId, versionNumber: input.ackVersionNumber }
        : undefined,
  });
}

/**
 * Default fan-out: all members of the procedure's department, plus (for
 * ACK_REQUIRED / PUBLISHED on critical docs) escalate to the whole tenant.
 * Exported so lib/workflow/index.ts can reuse the exact same audience
 * calculation when freezing AckCampaign.targetUserIds (Fase 4) — the set of
 * people notified and the set of people obligated to acknowledge must never
 * silently drift apart.
 */
export async function resolveDefaultRecipients(tenantId: string, procedureId?: string) {
  if (!procedureId) {
    return prisma.user.findMany({ where: { tenantId, isActive: true } });
  }

  const procedure = await prisma.procedure.findUnique({ where: { id: procedureId } });
  if (!procedure) return [];

  if (procedure.isCritical || procedure.requiresAck) {
    return prisma.user.findMany({ where: { tenantId, isActive: true } });
  }

  const memberships = await prisma.departmentMembership.findMany({
    where: { departmentId: procedure.departmentId },
    include: { user: true },
  });
  return memberships.map((m) => m.user).filter((u) => u.isActive);
}
