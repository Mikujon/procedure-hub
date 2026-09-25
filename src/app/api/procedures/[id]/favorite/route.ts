import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getCurrentUserId();

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
