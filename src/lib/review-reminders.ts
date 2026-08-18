import { prisma } from "@/lib/prisma";
import { notifyEvent } from "@/lib/integrations/notify";

/**
 * Daily periodic-review reminder (CLAUDE.md roadmap). For every PUBLISHED
 * procedure whose nextReviewDate has passed, notifies the Document Owner
 * (falling back to the author if no owner is set) once per review cycle.
 *
 * Idempotency: reviewReminderSentAt is compared against nextReviewDate, not
 * just checked for null — so re-running this same day is a no-op, but
 * pushing nextReviewDate forward (owner completed the review, cycle
 * restarts) naturally re-arms the reminder without any extra bookkeeping.
 *
 * Shared by scripts/send-review-reminders.ts (manual / node-cron) and
 * GET /api/cron/review-reminders (Vercel Cron) so the two triggers can
 * never drift into different behavior.
 */
export async function sendReviewReminders() {
  const candidates = await prisma.procedure.findMany({
    where: { status: "PUBLISHED", nextReviewDate: { lte: new Date() } },
    select: {
      id: true,
      title: true,
      tenantId: true,
      ownerId: true,
      authorId: true,
      nextReviewDate: true,
      reviewReminderSentAt: true,
    },
  });

  // Prisma's where clause can't compare two columns of the same row, so the
  // "already reminded for *this* cycle" check happens here instead.
  const due = candidates.filter((p) => !p.reviewReminderSentAt || p.reviewReminderSentAt < p.nextReviewDate!);

  let sent = 0;
  for (const procedure of due) {
    const recipientId = procedure.ownerId ?? procedure.authorId;

    await notifyEvent({
      tenantId: procedure.tenantId,
      type: "REVIEW_DUE",
      procedureId: procedure.id,
      title: `"${procedure.title}" è in scadenza di revisione`,
      body: `La data di revisione prevista (${procedure.nextReviewDate?.toLocaleDateString("it-IT")}) è passata.`,
      userIds: [recipientId],
    });

    await prisma.procedure.update({
      where: { id: procedure.id },
      data: { reviewReminderSentAt: new Date() },
    });
    sent++;
  }

  return { checked: candidates.length, sent };
}
