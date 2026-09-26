// POST /api/kb/approve
// Compliance approval gate — approves or rejects a document in review.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { canApproveAs, isWorkflowComplete, getRequiredApprovals } from "@/lib/permissions";
import { fireWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId, role } = ctx;

  const body = await req.json().catch(() => ({}));
  const { documentId, decision, comment } = body; // decision: "approved" | "rejected"
  if (!documentId || !decision)
    return NextResponse.json({ error: "documentId + decision required" }, { status: 400 });

  const doc = await db.document.findUnique({ where: { id: documentId }, include: { approvals: true } });
  if (!doc || doc.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (doc.status !== "in_review")
    return NextResponse.json({ error: "Document is not in review" }, { status: 400 });

  // find the pending approval this user's role can decide
  const required = await getRequiredApprovals(tenantId, doc.tipo);
  const pending = doc.approvals.find((a) => a.status === "pending");
  if (!pending)
    return NextResponse.json({ error: "No pending approval" }, { status: 400 });

  if (!canApproveAs(role, pending.role) && role !== "ADMIN")
    return NextResponse.json({ error: `Forbidden — cannot approve as ${pending.role}` }, { status: 403 });

  const updated = await db.approval.update({
    where: { id: pending.id },
    data: {
      status: decision,
      userId,
      comment: comment ?? null,
      decidedAt: new Date(),
    },
  });

  // if rejected → document back to draft
  if (decision === "rejected") {
    await db.document.update({
      where: { id: documentId },
      data: { status: "draft", updatedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        tenantId, action: "REJECT", entityType: "DOCUMENT", entityId: documentId,
        summary: `Rejected by ${pending.role}`, userId, procedureId: documentId,
      },
    });
    await fireWebhook(tenantId, "kb.document.rejected", { documentId, role: pending.role });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // approved — check if workflow complete
  const complete = await isWorkflowComplete(documentId);
  if (complete) {
    await db.document.update({
      where: { id: documentId },
      data: { status: "approved", updatedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        tenantId, action: "APPROVE", entityType: "DOCUMENT", entityId: documentId,
        summary: `Approved by ${pending.role} — workflow complete`, userId, procedureId: documentId,
      },
    });
    await fireWebhook(tenantId, "kb.document.approved", { documentId, role: pending.role });
    return NextResponse.json({ ok: true, status: "approved", workflowComplete: true });
  }

  await db.auditLog.create({
    data: {
      tenantId, action: "APPROVE", entityType: "DOCUMENT", entityId: documentId,
      summary: `Approved by ${pending.role} — next pending`, userId, procedureId: documentId,
    },
  });
  return NextResponse.json({ ok: true, status: "approved", workflowComplete: false });
}
