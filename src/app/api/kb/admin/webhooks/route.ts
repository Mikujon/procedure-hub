import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { WEBHOOK_EVENTS } from "@/lib/webhook";

export const dynamic = "force-dynamic";

// GET — list all webhook configs for the tenant
export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;

  const configs = await db.webhookConfig.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    webhooks: configs.map((c) => ({
      id: c.id,
      url: c.url,
      secret: c.secret ? c.secret.slice(0, 4) + "••••" : "",
      events: JSON.parse(c.events || "[]"),
      active: c.active,
      createdAt: c.createdAt.toISOString(),
    })),
    availableEvents: WEBHOOK_EVENTS,
  });
}

// POST — create a new webhook config
export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId, userId } = ctx;

  const body = await req.json().catch(() => ({}));
  const { url, secret, events } = body;
  if (!url || !url.startsWith("http"))
    return NextResponse.json({ error: "Valid URL required" }, { status: 400 });

  const config = await db.webhookConfig.create({
    data: {
      tenantId,
      url,
      secret: secret || Math.random().toString(36).slice(2),
      events: JSON.stringify(events ?? ["*"]),
      active: true,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId, action: "CREATE", entityType: "WEBHOOK", entityId: config.id,
      summary: `Webhook created: ${url}`, userId,
    },
  });

  return NextResponse.json({
    ok: true,
    id: config.id,
    secret: config.secret, // return full secret only once on creation
  });
}
