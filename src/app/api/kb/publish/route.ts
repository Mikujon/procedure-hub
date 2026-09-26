// POST /api/kb/publish
// kb.publish_document — publish a new version (HR-8 / LG-2).
// Triggers the approval workflow if the tipo requires it (compliance gate).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { can, canPublish, getRequiredApprovals } from "@/lib/permissions";
import { fireWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId, role } = ctx;

  const body = await req.json().catch(() => ({}));
  const {
    documentId,
    title,
    summary,
    tipo,
    category,
    obbligatorio,
    content,         // JSON blocks
    tags,
    lingua,           // "it" | "sq" | "en" | "de"
    destinations,     // { nodeIds: string[], sedi: string[], ruoli: string[], lingue: string[] }
    publishNow,       // if false, save as draft
  } = body;

  if (!title || !tipo)
    return NextResponse.json({ error: "title + tipo required" }, { status: 400 });

  // permission check
  const perm: "kb:document:publish" | "kb:policy:publish" =
    tipo === "policy" ? "kb:policy:publish" : "kb:document:publish";
  if (!can(role, perm) && role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden — no publish permission", status: 403 } as any, { status: 403 });

  // compute required approvals from DocumentTypeApproval (or default)
  const requiredApprovals = await getRequiredApprovals(tenantId, tipo);

  let document;
  let isNew = false;

  if (documentId) {
    // update existing
    document = await db.document.findUnique({ where: { id: documentId } });
    if (!document || document.tenantId !== tenantId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    document = await db.document.update({
      where: { id: documentId },
      data: {
        title,
        summary: summary ?? "",
        tipo,
        category,
        obbligatorio: !!obbligatorio,
        content: JSON.stringify(content ?? []),
        tags: JSON.stringify(tags ?? []),
        requiredApprovals: JSON.stringify(requiredApprovals),
        status: publishNow ? "in_review" : "draft",
        updatedAt: new Date(),
      },
    });
  } else {
    // create new
    isNew = true;
    const code = await nextCode(tenantId, tipo);
    document = await db.document.create({
      data: {
        tenantId,
        code,
        title,
        summary: summary ?? "",
        tipo,
        category,
        obbligatorio: !!obbligatorio,
        stato: "bozza",
        status: publishNow ? "in_review" : "draft",
        ownerId: userId,
        requiredApprovals: JSON.stringify(requiredApprovals),
        content: JSON.stringify(content ?? []),
        tags: JSON.stringify(tags ?? []),
        visibility: "restricted",
      },
    });
  }

  // create approval stages if publishing
  if (publishNow && requiredApprovals.length > 0) {
    for (const approvalRole of requiredApprovals) {
      await db.approval.create({
        data: {
          tenantId,
          documentId: document.id,
          role: approvalRole,
          status: "pending",
        },
      });
    }
  } else if (publishNow && requiredApprovals.length === 0) {
    // no approvals required: publish directly
    await publishNowFn(document.id, tenantId, userId, content ?? [], lingua ?? "it", destinations, title, summary ?? "");
    return NextResponse.json({ ok: true, documentId: document.id, published: true });
  }

  // create audit log
  await db.auditLog.create({
    data: {
      tenantId,
      action: publishNow ? "SUBMIT" : "CREATE",
      entityType: "DOCUMENT",
      entityId: document.id,
      summary: publishNow ? `Submitted for review (${requiredApprovals.join(", ") || "no approvals"})` : "Created draft",
      userId,
      procedureId: document.id,
    },
  });

  if (publishNow) {
    await fireWebhook(tenantId, "kb.document.submitted", { documentId: document.id, requiredApprovals });
  }

  return NextResponse.json({
    ok: true,
    documentId: document.id,
    published: false,
    status: document.status,
    requiredApprovals,
  });
}

// helper: actually publish (set state to in_vigore, create version + destination)
async function publishNowFn(
  documentId: string,
  tenantId: string,
  userId: string,
  content: any[],
  lingua: string,
  destinations: { nodeIds: string[]; sedi: string[]; ruoli: string[]; lingue: string[] } | undefined,
  title: string,
  summary: string
) {
  const doc = await db.document.findUnique({ where: { id: documentId }, include: { versions: true } });
  if (!doc) return;
  const nextNumero = (doc.versions.reduce((m, v) => Math.max(m, v.numero), 0) || 0) + 1;

  // mark old current as not current
  await db.version.updateMany({
    where: { documentId, isCurrent: true },
    data: { isCurrent: false },
  });

  const version = await db.version.create({
    data: {
      tenantId,
      documentId,
      numero: nextNumero,
      lingua,
      inVigoreDal: new Date(),
      testo: JSON.stringify(content),
      approvataDa: userId,
      approvataIl: new Date(),
      isCurrent: true,
    },
  });

  await db.document.update({
    where: { id: documentId },
    data: {
      stato: "in_vigore",
      status: "published",
      currentVersionId: version.id,
      publishedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // destination (replace existing for this version)
  if (destinations) {
    await db.destination.create({
      data: {
        tenantId,
        documentId,
        versionId: version.id,
        nodeIds: JSON.stringify(destinations.nodeIds ?? []),
        sedi: JSON.stringify(destinations.sedi ?? []),
        ruoli: JSON.stringify(destinations.ruoli ?? []),
        lingue: JSON.stringify(destinations.lingue ?? []),
      },
    });
  }

  // webhook event (kb.document.published) — written to audit log as a placeholder
  await db.auditLog.create({
    data: {
      tenantId,
      action: "PUBLISH",
      entityType: "DOCUMENT",
      entityId: documentId,
      summary: `Published v${nextNumero} (${lingua})`,
      userId,
      procedureId: documentId,
    },
  });

  await fireWebhook(tenantId, "kb.document.published", { documentId, version: nextNumero, lingua });
}

async function nextCode(tenantId: string, tipo: string): Promise<string> {
  const count = await db.document.count({ where: { tenantId, tipo } });
  const prefix =
    tipo === "policy" ? "POL" :
    tipo === "procedura" ? "PROC" :
    tipo === "processo" ? "PRC" :
    tipo === "comunicazione" ? "COM" : "DOC";
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}
