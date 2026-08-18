import { defineWorker } from "../src/lib/queue";
import { processNotificationFanout } from "../src/lib/integrations/notification-fanout";
import type { NotificationFanoutJob } from "../src/lib/notifications-queue";

/**
 * Standalone worker process for the "notifications" BullMQ queue — the
 * external (Slack/Google Chat) fan-out that used to run inline inside
 * notifyEvent() (src/lib/integrations/notify.ts). Relative imports
 * throughout: run via plain tsx, doesn't resolve the Next.js "@/" alias.
 */
const worker = defineWorker<NotificationFanoutJob>("notifications", async (job) => {
  await processNotificationFanout(job.data);
});

worker.on("failed", (job, err) => {
  console.error(`notifications worker: job ${job?.id} failed`, err);
});

console.log("notifications worker listening");
