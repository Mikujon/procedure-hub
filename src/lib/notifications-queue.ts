import type { NotificationType } from "@prisma/client";
import { defineQueue } from "./queue";

/**
 * Job payload for the external (Slack/Google Chat) notification fan-out.
 * In-app Notification rows are NOT part of this job — those are created
 * synchronously in notifyEvent() itself (src/lib/integrations/notify.ts),
 * since the bell icon/notification center needs them immediately. Only the
 * external webhook calls — the slow, failure-prone part — move to the queue.
 *
 * Relative import above (not "@/lib/queue") deliberately: this module is
 * loaded both from Next.js API routes (which resolve the "@/" alias) and
 * from workers/notifications-worker.ts via plain tsx (which does not).
 */
export interface NotificationFanoutJob {
  tenantId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
  recipientIds: string[];
  /** ACK_REQUIRED only: lets the worker mint a per-recipient signed "Conferma lettura" link (Fase 4). */
  ackContext?: { procedureId: string; versionNumber: number };
}

export const notificationsQueue = defineQueue<NotificationFanoutJob>("notifications");
