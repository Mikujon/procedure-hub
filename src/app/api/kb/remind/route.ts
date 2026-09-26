// POST /api/kb/remind
// kb.remind — aggregated reminder to recipients who haven't acked.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { computeReadStatus } from "@/lib/cascade";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId, role } = ctx;

  const body = await req.json().catch(() => ({}));
  const { documentId } = body;
  if (!documentId) return NextResponse.json({ error: "documentId required" }, { status: 400 });

  if (!can(role, "kb:document:remind"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await computeReadStatus(documentId, tenantId);
  const pending = rows.filter((r) => !r.acknowledged);

  // create one notification per pending user (aggregated: one per person)
  for (const r of pending) {
    await db.notification.create({
      data: {
        userId: r.userId,
        type: "ACK_DUE",
        title: `Reminder: ${doc.title}`,
        body: `You have not yet acknowledged "${doc.title}" (v${doc.currentVersionId ?? 1}). Please read and confirm.`,
        procedureId: documentId,
      },
    });
  }

  await db.auditLog.create({
    data: {
      tenantId, action: "REMIND", entityType: "DOCUMENT", entityId: documentId,
      summary: `Sent reminder to ${pending.length} recipient(s)`, userId, procedureId: documentId,
    },
  });

  return NextResponse.json({ ok: true, reminded: pending.length, recipients: pending.map((r) => ({ userId: r.userId, name: r.userName })) });
}
