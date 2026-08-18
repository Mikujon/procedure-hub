import { NextRequest, NextResponse } from "next/server";
import { sendReviewReminders } from "@/lib/review-reminders";

/**
 * Vercel Cron entry point (see vercel.json — daily at 07:00 UTC) for the
 * periodic-review reminder. No user session here: Vercel Cron calls this
 * as a plain HTTP GET, so CRON_SECRET is the only authorization — anyone
 * without it gets a 401, same shared-secret pattern as a webhook endpoint.
 * scripts/send-review-reminders.ts is the equivalent manual/node-cron
 * entry point; both call the same sendReviewReminders().
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  // No CRON_SECRET configured: allowed through, matching this project's
  // "works with zero config in local dev" convention elsewhere (e.g.
  // storage.isStorageConfigured()) — set CRON_SECRET before exposing this
  // deployment publicly.

  const result = await sendReviewReminders();
  return NextResponse.json(result);
}
