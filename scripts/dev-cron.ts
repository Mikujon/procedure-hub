import { runTimeBasedAutomations } from "../src/lib/automations/engine";
import { prisma } from "../src/lib/prisma";

/**
 * In-repo stand-in for Vercel Cron in local/on-premise environments
 * (PERF-01 remediation). Loops runTimeBasedAutomations() on an interval
 * instead of relying on the OS's own task scheduler — keeps the fix inside
 * the project rather than a machine-specific setup step someone has to
 * remember to redo. Hourly is safe to run more often than any individual
 * rule actually needs: dedup happens per (rule, entity, fireKey) via
 * AutomationRun's own unique constraint, so an extra tick just finds
 * nothing new to fire.
 *
 * Used to also drive lib/review-reminders.ts's sendReviewReminders()
 * separately — retired 9 set 2026 when review reminders (and Read &
 * Acknowledge escalation, scripts/send-ack-reminders.ts) were migrated
 * onto the automation engine itself (lib/automations/defaults.ts
 * provisions the equivalent default rules per tenant), so this loop now
 * has just the one thing to drive.
 *
 * Opt-in: `npm run cron:dev`. Not part of `npm run dev:all` — a reminder
 * loop firing in the background isn't something every dev session wants.
 * In a real deployment, prefer the OS/host's own scheduler (or Vercel Cron)
 * over leaving this running unattended.
 */
const INTERVAL_MS = 60 * 60 * 1000;

async function tick() {
  try {
    const { rulesChecked, fired } = await runTimeBasedAutomations();
    console.log(`[dev-cron] ${new Date().toISOString()} — checked ${rulesChecked} automation rule(s), fired ${fired}.`);
  } catch (err) {
    console.error("[dev-cron] automations tick failed:", err);
  }
}

console.log(`[dev-cron] automations loop started, every ${INTERVAL_MS / 60000} min. Ctrl+C to stop.`);
tick();
const timer = setInterval(tick, INTERVAL_MS);

process.on("SIGINT", async () => {
  clearInterval(timer);
  await prisma.$disconnect();
  process.exit(0);
});
