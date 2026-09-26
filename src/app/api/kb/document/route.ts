// GET /api/kb/document?id=
// kb.get_document — current version + history + destinations.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { computeUserNodeIds } from "@/lib/cascade";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId, role } = ctx;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, avatarColor: true } },
      versions: { orderBy: { numero: "desc" } },
      destinations: true,
      approvals: { include: { user: { select: { id: true, name: true, avatarColor: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!doc || doc.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // visibility check (cascade): the caller must descend from a destination node
  if (doc.visibility === "restricted") {
    const userNodeIds = await computeUserNodeIds(userId);
    const visible = doc.destinations.some((d) => {
      const ids = safeParse(d.nodeIds);
      return ids.length === 0 || ids.some((n) => userNodeIds.has(n));
    });
    if (!visible && role !== "ADMIN") {
      // Nodo rule V3: distinguish "doesn't exist" vs "exists but not visible"
      return NextResponse.json(
        { error: "exists_not_visible", message: "This document exists but is not visible to your role." },
        { status: 403 }
      );
    }
  }

  const currentVersion = doc.versions.find((v) => v.isCurrent) ?? doc.versions[0] ?? null;
  let acked = false, ackedAt: string | null = null;
  if (currentVersion) {
    const ack = await db.acknowledgment.findUnique({
      where: { userId_documentId_versionId: { userId, documentId: doc.id, versionId: currentVersion.id } },
    });
    if (ack) { acked = true; ackedAt = ack.at.toISOString(); }
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      code: doc.code,
      title: doc.title,
      summary: doc.summary,
      tipo: doc.tipo,
      category: doc.category,
      obbligatorio: doc.obbligatorio,
      stato: doc.stato,
      status: doc.status,
      visibility: doc.visibility,
      requiredApprovals: safeParse(doc.requiredApprovals),
      tags: safeParse(doc.tags),
      owner: doc.owner,
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            numero: currentVersion.numero,
            lingua: currentVersion.lingua,
            inVigoreDal: currentVersion.inVigoreDal?.toISOString() ?? null,
            testo: safeParse(currentVersion.testo),
            approvataDa: currentVersion.approvataDa,
            approvataIl: currentVersion.approvataIl?.toISOString() ?? null,
            createdAt: currentVersion.createdAt.toISOString(),
          }
        : null,
      versions: doc.versions.map((v) => ({
        id: v.id,
        numero: v.numero,
        lingua: v.lingua,
        inVigoreDal: v.inVigoreDal?.toISOString() ?? null,
        approvataIl: v.approvataIl?.toISOString() ?? null,
        createdAt: v.createdAt.toISOString(),
        isCurrent: v.isCurrent,
      })),
      destinations: doc.destinations.map((d) => ({
        id: d.id,
        nodeIds: safeParse(d.nodeIds),
        sedi: safeParse(d.sedi),
        ruoli: safeParse(d.ruoli),
        lingue: safeParse(d.lingue),
      })),
      approvals: doc.approvals.map((a) => ({
        id: a.id,
        role: a.role,
        status: a.status,
        comment: a.comment,
        user: a.user,
        decidedAt: a.decidedAt?.toISOString() ?? null,
      })),
      acknowledged: acked,
      acknowledgedAt: ackedAt,
      canEdit: role === "ADMIN" || doc.owner.id === userId || role === "COMPLIANCE" || role === "HR_HEAD" || role === "LEGAL_HEAD",
      canPublish: can(role, doc.tipo === "policy" ? "kb:policy:publish" : "kb:document:publish"),
      canAck: can(role, "kb:document:acknowledge"),
      updatedAt: doc.updatedAt.toISOString(),
    },
  });
}

function safeParse(s: string | null): any[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
