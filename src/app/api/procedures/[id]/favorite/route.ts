import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId } = ctx;
  const { id } = await params;

  const procedure = await db.procedure.findUnique({ where: { id } });
  if (!procedure || procedure.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await db.favorite.findUnique({
    where: { userId_procedureId: { userId, procedureId: id } },
  });

  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorite: false });
  }

  await db.favorite.create({ data: { userId, procedureId: id } });
  await db.auditLog.create({
    data: {
      tenantId,
      action: "FAVORITE",
      entityType: "PROCEDURE",
      entityId: id,
      summary: "Added to favorites",
      userId,
      procedureId: id,
    },
  });
  return NextResponse.json({ favorite: true });
}
