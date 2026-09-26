import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

// DELETE — remove a webhook config
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId, userId } = ctx;
  const { id } = await params;

  const config = await db.webhookConfig.findUnique({ where: { id } });
  if (!config || config.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.webhookConfig.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      tenantId, action: "DELETE", entityType: "WEBHOOK", entityId: id,
      summary: `Webhook deleted: ${config.url}`, userId,
    },
  });

  return NextResponse.json({ ok: true });
}
