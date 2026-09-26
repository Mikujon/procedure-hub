// DELETE /api/kb/admin/assignments/[id]
// Soft remove — set validTo = now (history preserved, Nodo V7 rule).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;
  const { id } = await params;

  const assignment = await db.orgAssignment.findUnique({
    where: { id },
    include: {
      node: { select: { name: true } },
      user: { select: { email: true } },
    },
  });
  if (!assignment || assignment.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (assignment.validTo) {
    // already closed — idempotent no-op
    return NextResponse.json({ ok: true, alreadyClosed: true });
  }

  const now = new Date();
  await db.orgAssignment.update({
    where: { id },
    data: { validTo: now },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "DELETE",
      entityType: "ORG_ASSIGNMENT",
      entityId: id,
      summary: `Closed assignment: ${assignment.user.email} → ${assignment.node.name} (${assignment.relation})`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({ ok: true, validTo: now.toISOString() });
}
