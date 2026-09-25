import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import type { Block, Criticality } from "@/lib/types";

export const dynamic = "force-dynamic";

// PATCH /api/procedures/[id]/content — save edited content + metadata.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId } = ctx;
  const { id } = await params;

  const procedure = await db.procedure.findUnique({ where: { id } });
  if (!procedure || procedure.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const content: Block[] = Array.isArray(body.content) ? body.content : [];
  const title: string | undefined = typeof body.title === "string" ? body.title : undefined;
  const summary: string | undefined = typeof body.summary === "string" ? body.summary : undefined;
  const tags: string[] | undefined = Array.isArray(body.tags) ? body.tags : undefined;
  const criticality: Criticality | undefined = body.criticality as Criticality | undefined;
  const readMinutes: number | undefined = typeof body.readMinutes === "number" ? body.readMinutes : undefined;

  const data: any = { content: JSON.stringify(content), updatedAt: new Date() };
  if (title !== undefined && title.trim()) data.title = title.trim();
  if (summary !== undefined) data.summary = summary.trim();
  if (tags !== undefined) data.tags = JSON.stringify(tags);
  if (criticality !== undefined) data.criticality = criticality;
  if (readMinutes !== undefined && readMinutes > 0) data.readMinutes = readMinutes;

  const updated = await db.procedure.update({ where: { id }, data });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "UPDATE",
      entityType: "PROCEDURE",
      entityId: id,
      summary: "Edited content and metadata",
      userId,
      procedureId: id,
    },
  });

  return NextResponse.json({
    ok: true,
    version: updated.version,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
