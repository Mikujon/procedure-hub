import { NextRequest, NextResponse } from "next/server";
import { runTimeBasedAutomations } from "@/lib/automations/engine";

/**
 * Vercel Cron entry point (vercel.json — hourly) for time-based automation
 * rules (REVIEW_DATE_DUE, ACK_CAMPAIGN_AGE — including, since 9 set 2026,
 * the four default rules lib/automations/defaults.ts provisions per
 * tenant, which replace the old dedicated review-reminders/ack-reminders
 * cron paths). No user session here, Vercel Cron calls this as a plain
 * HTTP GET, CRON_SECRET is the only authorization. scripts/dev-cron.ts is
 * the local/on-prem equivalent.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runTimeBasedAutomations();
  return NextResponse.json(result);
}
