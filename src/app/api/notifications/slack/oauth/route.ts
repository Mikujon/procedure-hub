import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSlackOAuthConfigured, signSlackState, buildSlackAuthorizeUrl } from "@/lib/integrations/slack-oauth";

/** Starts "Sign in with Slack" for the logged-in user — redirects to Slack's consent screen. */
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));

  if (!isSlackOAuthConfigured()) {
    return NextResponse.json(
      { error: "Slack OAuth non configurato (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET mancanti)." },
      { status: 503 }
    );
  }

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const state = signSlackState({ userId, tenantId });

  return NextResponse.redirect(buildSlackAuthorizeUrl(state));
}

/** Unlinks the current user's Slack identity — they stop receiving bot DMs (webhook-mode notifications, if configured, are unaffected). */
export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;

  const existing = await prisma.slackUserIdentity.findUnique({ where: { userId } });
  if (existing) {
    await prisma.slackUserIdentity.delete({ where: { userId } });
    await prisma.auditLog.create({
      data: { tenantId, actorId: userId, action: "DELETE", entityType: "SlackUserIdentity", entityId: existing.id },
    });
  }

  return NextResponse.json({ success: true });
}
