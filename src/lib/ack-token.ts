import jwt from "jsonwebtoken";

/**
 * Signs/verifies the one-click Read & Acknowledge confirm link sent via
 * Slack/Google Chat/email — same jsonwebtoken + separate-secret pattern as
 * COLLAB_JWT_SECRET (src/app/api/procedures/[id]/collab-token/route.ts).
 * The token itself is the proof of authorization for quick-confirm (no
 * session/cookie involved — the click comes from outside the app), so a
 * long expiry is deliberate: it must still work near the end of a 14-day
 * escalation window, not just right after the initial reminder.
 */
export interface AckTokenPayload {
  userId: string;
  procedureId: string;
  versionNumber: number;
  channel: "SLACK" | "GOOGLE_CHAT";
}

export function signAckToken(payload: AckTokenPayload): string {
  const secret = process.env.ACK_JWT_SECRET;
  if (!secret) throw new Error("ACK_JWT_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

export function verifyAckToken(token: string): AckTokenPayload {
  const secret = process.env.ACK_JWT_SECRET;
  if (!secret) throw new Error("ACK_JWT_SECRET is not configured");
  return jwt.verify(token, secret) as AckTokenPayload;
}

export function buildAckConfirmUrl(payload: AckTokenPayload): string {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.procedurehub.com";
  const token = signAckToken(payload);
  return `${appBaseUrl}/api/acknowledgments/quick-confirm?token=${encodeURIComponent(token)}`;
}
