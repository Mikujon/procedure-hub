import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySlackState, exchangeSlackCode } from "@/lib/integrations/slack-oauth";

const SETTINGS_PATH = "/settings/notifications";

function redirectTo(req: NextRequest, status: "connected" | "error", reason?: string) {
  const url = new URL(SETTINGS_PATH, req.url);
  url.searchParams.set("slack", status);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

/**
 * Handles Slack's redirect back after consent. Requires an active session
 * (not just the signed state) — defense in depth: the state proves which
 * user *started* the flow, the session proves who's *finishing* it, and
 * both must agree before writing SlackUserIdentity.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return redirectTo(req, "error", "session_expired");

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;

  const { searchParams } = new URL(req.url);
  const error = searchParams.get("error");
  if (error) return redirectTo(req, "error", "denied");

  const code = searchParams.get("code");
  const stateToken = searchParams.get("state");
  if (!code || !stateToken) return redirectTo(req, "error", "missing_params");

  let state;
  try {
    state = verifySlackState(stateToken);
  } catch {
    return redirectTo(req, "error", "invalid_state");
  }
  if (state.userId !== userId || state.tenantId !== tenantId) {
    return redirectTo(req, "error", "state_mismatch");
  }

  let identity;
  try {
    identity = await exchangeSlackCode(code);
  } catch (e) {
    console.error("[slack oauth] code exchange failed", e);
    return redirectTo(req, "error", "exchange_failed");
  }

  const existing = await prisma.slackUserIdentity.findUnique({ where: { userId } });
  await prisma.slackUserIdentity.upsert({
    where: { userId },
    update: { slackUserId: identity.slackUserId, slackTeamId: identity.slackTeamId },
    create: { userId, slackUserId: identity.slackUserId, slackTeamId: identity.slackTeamId },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId: userId,
      action: existing ? "UPDATE" : "CREATE",
      entityType: "SlackUserIdentity",
      entityId: userId,
      metadata: { slackTeamId: identity.slackTeamId },
    },
  });

  return redirectTo(req, "connected");
}
