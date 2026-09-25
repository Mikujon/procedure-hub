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

  const procedure = await db.procedure.findUnique({ where: { id } });
  if (!procedure) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (procedure.status !== "PUBLISHED")
    return NextResponse.json({ error: "Procedure is not published" }, { status: 400 });

  // upsert acknowledgment for the current version
  const existing = await db.acknowledgment.findUnique({
    where: {
      userId_procedureId_version: {
        userId,
        procedureId: id,
        version: procedure.version,
      },
    },
  });
  if (existing) return NextResponse.json({ ok: true, already: true });

  const ack = await db.acknowledgment.create({
    data: { userId, procedureId: id, version: procedure.version },
  });

  await db.auditLog.create({
    data: {
      action: "ACK",
      entityType: "PROCEDURE",
      entityId: id,
      summary: `Acknowledged version ${procedure.version}`,
      userId,
      procedureId: id,
    },
  });

  return NextResponse.json({ ok: true, acknowledgedAt: ack.acknowledgedAt });
}
