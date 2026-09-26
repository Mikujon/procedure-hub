// POST /api/kb/acknowledge
// kb.acknowledge — record "I read this version" (immutable, append-only).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { can } from "@/lib/permissions";
import { fireWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId, role } = ctx;

  const body = await req.json().catch(() => ({}));
  const { documentId, versionId, via, performedBy } = body;
  if (!documentId || !versionId)
    return NextResponse.json({ error: "documentId + versionId required" }, { status: 400 });

  if (!can(role, "kb:document:acknowledge"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const version = await db.version.findUnique({ where: { id: versionId } });
  if (!version || version.documentId !== documentId)
    return NextResponse.json({ error: "Version mismatch" }, { status: 400 });

  // idempotent: if already acked, return the existing one
  const existing = await db.acknowledgment.findUnique({
    where: { userId_documentId_versionId: { userId, documentId, versionId } },
  });
  if (existing)
    return NextResponse.json({ ok: true, already: true, at: existing.at.toISOString() });

  const ack = await db.acknowledgment.create({
    data: {
      tenantId,
      userId,
      documentId,
      versionId,
      via: via ?? "diretta",
      performedBy: via === "tramite_responsabile" ? (performedBy ?? userId) : null,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "ACK",
      entityType: "DOCUMENT",
      entityId: documentId,
      summary: `Acknowledged v${version.numero} (${version.lingua})`,
      userId,
      procedureId: documentId,
    },
  });

  await fireWebhook(tenantId, "kb.document.acknowledged", { documentId, versionId, userId });

  return NextResponse.json({ ok: true, at: ack.at.toISOString() });
}
