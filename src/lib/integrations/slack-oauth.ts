import jwt from "jsonwebtoken";

/**
 * "Sign in with Slack" (OpenID Connect) — lets an individual user prove
 * which Slack account is theirs, to populate SlackUserIdentity for
 * per-user bot DMs (CLAUDE.md roadmap: "OAuth Slack App... popolando
 * SlackUserIdentity"). Deliberately NOT the "Add to Slack" bot-install
 * flow — that grants a workspace-wide bot token, already settable by an
 * admin via POST /api/admin/integrations (Integration.config.botToken).
 * This flow only ever needs the `openid` scope: no bot permissions, no
 * message-sending capability, just "who is this on Slack".
 */

const AUTHORIZE_URL = "https://slack.com/openid/connect/authorize";
const TOKEN_URL = "https://slack.com/api/openid.connect.token";
const USERINFO_URL = "https://slack.com/api/openid.connect.userInfo";

export function isSlackOAuthConfigured(): boolean {
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}

function redirectUri(): string {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appBaseUrl}/api/notifications/slack/oauth/callback`;
}

export interface SlackOAuthState {
  userId: string;
  tenantId: string;
}

/** Short-lived (10min) signed state — CSRF protection, and lets the callback recover which user initiated the flow without relying solely on the session cookie surviving the round-trip to Slack and back. */
export function signSlackState(state: SlackOAuthState): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");
  return jwt.sign(state, secret, { expiresIn: "10m" });
}

export function verifySlackState(token: string): SlackOAuthState {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");
  return jwt.verify(token, secret) as SlackOAuthState;
}

export function buildSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: "openid",
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface SlackIdentity {
  slackUserId: string;
  slackTeamId: string;
}

/** Exchanges the authorization code for the user's Slack user id + team id. Throws on any failure — the callback route turns that into a redirect with an error flag, never a silently-broken identity link. */
export async function exchangeSlackCode(code: string): Promise<SlackIdentity> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.ok) throw new Error(`Slack token exchange failed: ${tokenData.error ?? "unknown error"}`);

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userRes.json();
  if (!userData.ok && !userData.sub) throw new Error(`Slack userInfo failed: ${userData.error ?? "unknown error"}`);

  const slackUserId = userData.sub as string;
  const slackTeamId = userData["https://slack.com/team_id"] as string;
  if (!slackUserId || !slackTeamId) throw new Error("Slack userInfo response missing sub or team_id");

  return { slackUserId, slackTeamId };
}
