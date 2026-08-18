import { prisma } from "../prisma";
import { sendSlackNotification } from "./slack";
import { sendGoogleChatNotification } from "./gchat";
import { buildAckConfirmUrl } from "../ack-token";
import type { NotificationFanoutJob } from "../notifications-queue";

/**
 * The actual external (Slack/Google Chat) fan-out — batched preference
 * lookup + parallel sends, extracted out of notifyEvent() so both the
 * synchronous caller (none anymore — see notify.ts) and the queue worker
 * (workers/notifications-worker.ts) can run it. Relative imports throughout
 * (not "@/..."): this file is loaded by tsx directly in the worker process,
 * which doesn't resolve the Next.js path alias.
 */
export async function processNotificationFanout(job: NotificationFanoutJob): Promise<void> {
  const linkUrl = job.linkUrl;

  const [slackIntegration, gchatIntegration, allPrefs] = await Promise.all([
    prisma.integration.findUnique({ where: { tenantId_type: { tenantId: job.tenantId, type: "SLACK" } } }),
    prisma.integration.findUnique({ where: { tenantId_type: { tenantId: job.tenantId, type: "GOOGLE_CHAT" } } }),
    prisma.notificationPreference.findMany({ where: { userId: { in: job.recipientIds } } }),
  ]);
  const prefsByUserId = new Map(allPrefs.map((p) => [p.userId, p]));

  const ackContext = job.ackContext;

  await Promise.allSettled(
    job.recipientIds.flatMap((userId) => {
      const prefs = prefsByUserId.get(userId);
      const sends: Promise<unknown>[] = [];
      // Signed per-recipient AND per-channel — never shared across users (or
      // anyone with the link could acknowledge on someone else's behalf),
      // and channel-specific so the certificate (Fase 4) can show which
      // surface each confirmation actually came through.
      const ackPayload = (channel: "SLACK" | "GOOGLE_CHAT") =>
        ackContext ? buildAckConfirmUrl({ userId, procedureId: ackContext.procedureId, versionNumber: ackContext.versionNumber, channel }) : undefined;

      if (slackIntegration?.isEnabled && (prefs?.slackEnabled ?? true)) {
        sends.push(
          sendSlackNotification({ integration: slackIntegration, userId, title: job.title, body: job.body, linkUrl, confirmUrl: ackPayload("SLACK") })
        );
      }

      if (gchatIntegration?.isEnabled && (prefs?.gchatEnabled ?? false)) {
        sends.push(
          sendGoogleChatNotification({ integration: gchatIntegration, userId, title: job.title, body: job.body, linkUrl, confirmUrl: ackPayload("GOOGLE_CHAT") })
        );
      }

      return sends;
    })
  );
}
