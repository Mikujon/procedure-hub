import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAckToken } from "@/lib/ack-token";
import { recordAcknowledgment } from "@/lib/ack";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/**
 * The link behind the "Conferma lettura" button in Slack/Google Chat/email
 * — a plain GET so clicking it "just works" from any client (chat app link
 * preview, email client, browser) with no session required. The signed
 * token IS the authorization; nothing here trusts the request otherwise.
 * Always redirects to the public /ack-confirmed page rather than returning
 * JSON, since a browser navigates here on click.
 */
export async function GET(req: NextRequest) {
  // Public endpoint, no session — the token IS the authorization, so the
  // only thing worth throttling here is request volume per client.
  const { allowed } = await checkRateLimit(`quick-confirm:${clientIp(req)}`, 20, 300);
  if (!allowed) return NextResponse.redirect(new URL("/ack-confirmed?status=error&reason=rate_limited", req.url));

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/ack-confirmed?status=error&reason=missing_token", req.url));

  let payload;
  try {
    payload = verifyAckToken(token);
  } catch {
    return NextResponse.redirect(new URL("/ack-confirmed?status=error&reason=invalid_token", req.url));
  }

  const procedure = await prisma.procedure.findUnique({ where: { id: payload.procedureId } });
  if (!procedure) {
    return NextResponse.redirect(new URL("/ack-confirmed?status=error&reason=not_found", req.url));
  }

  const ip = req.headers.get("x-forwarded-for") ?? undefined;
  await recordAcknowledgment(payload.procedureId, payload.userId, payload.versionNumber, ip, payload.channel);

  const url = new URL("/ack-confirmed", req.url);
  url.searchParams.set("status", "ok");
  url.searchParams.set("title", procedure.title);
  return NextResponse.redirect(url);
}
