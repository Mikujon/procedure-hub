import { sendReviewReminders } from "../src/lib/review-reminders";
import { prisma } from "../src/lib/prisma";

/**
 * Daily periodic-review reminder (CLAUDE.md roadmap). Manual/local/node-cron
 * entry point — Vercel Cron instead hits GET /api/cron/review-reminders,
 * both call the same sendReviewReminders() so behavior never diverges.
 * Manual: `npx tsx scripts/send-review-reminders.ts`.
 */
async function main() {
  const { checked, sent } = await sendReviewReminders();
  console.log(`Checked ${checked} overdue procedure(s), sent ${sent} reminder(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
