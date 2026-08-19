import { sendReviewReminders } from "../src/lib/review-reminders";
import { runTimeBasedAutomations } from "../src/lib/automations/engine";
import { prisma } from "../src/lib/prisma";

/**
 * In-repo stand-in for the review-reminders cron in local/on-premise
 * environments that don't have Vercel Cron (PERF-01 remediation). Loops
 * sendReviewReminders() on an interval instead of relying on the OS's own
 * task scheduler — keeps the fix inside the project rather than a
 * machine-specific setup step someone has to remember to redo. Hourly is
 * safe to run more often than the reminder actually needs: the check is
 * idempotent on Procedure.reviewReminderSentAt, so an extra tick just finds
 * nothing new to send.
 *
 * Opt-in: `npm run cron:dev`. Not part of `npm run dev:all` — a reminder
 * loop firing in the background isn't something every dev session wants.
 * In a real deployment, prefer the OS/host's own scheduler (or Vercel Cron)
 * over leaving this running unattended.
 */
const INTERVAL_MS = 60 * 60 * 1000;

async function tick() {
  try {
    const { checked, sent } = await sendReviewReminders();
    console.log(`[dev-cron] ${new Date().toISOString()} — checked ${checked} overdue procedure(s), sent ${sent} reminder(s).`);
  } catch (err) {
    console.error("[dev-cron] review-reminders tick failed:", err);
  }

  try {
    const { rulesChecked, fired } = await runTimeBasedAutomations();
    console.log(`[dev-cron] ${new Date().toISOString()} — checked ${rulesChecked} automation rule(s), fired ${fired}.`);
  } catch (err) {
    console.error("[dev-cron] automations tick failed:", err);
  }
}

console.log(`[dev-cron] review-reminders + automations loop started, every ${INTERVAL_MS / 60000} min. Ctrl+C to stop.`);
tick();
const timer = setInterval(tick, INTERVAL_MS);

process.on("SIGINT", async () => {
  clearInterval(timer);
  await prisma.$disconnect();
  process.exit(0);
});
