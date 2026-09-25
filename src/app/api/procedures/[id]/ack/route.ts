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
  if (procedure.status !== "PUBLISHED")
    return NextResponse.json({ error: "Procedure is not published" }, { status: 400 });

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
      tenantId,
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
