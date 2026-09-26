// GET  /api/kb/admin/doc-types  — list all DocumentTypeApproval rows for the tenant
// POST /api/kb/admin/doc-types  — upsert requiredApprovals for a given tipo
//   body: { tipo: string, requiredApprovals: string[] }
//   unique key: (tenantId, tipo)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;

  const rows = await db.documentTypeApproval.findMany({
    where: { tenantId },
    orderBy: { tipo: "asc" },
  });

  const docTypes = rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    requiredApprovals: safeParse(r.requiredApprovals, []),
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ docTypes });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;

  const body = await req.json().catch(() => ({}));
  const { tipo, requiredApprovals } = body ?? {};

  if (!tipo || typeof tipo !== "string")
    return NextResponse.json({ error: "tipo is required" }, { status: 400 });

  const approvals = Array.isArray(requiredApprovals)
    ? Array.from(new Set(requiredApprovals.filter((r) => typeof r === "string")))
    : [];

  const record = await db.documentTypeApproval.upsert({
    where: { tenantId_tipo: { tenantId, tipo } },
    create: {
      tenantId,
      tipo,
      requiredApprovals: JSON.stringify(approvals),
    },
    update: {
      requiredApprovals: JSON.stringify(approvals),
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "UPDATE",
      entityType: "DOC_TYPE_APPROVAL",
      entityId: record.id,
      summary: `Set requiredApprovals for "${tipo}" → [${approvals.join(", ")}]`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({
    docType: {
      id: record.id,
      tipo: record.tipo,
      requiredApprovals: approvals,
    },
  });
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}
