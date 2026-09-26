// GET /api/kb/read-status?documentId=&scope=self|team|all
// kb.get_read_status — who acked what (LG-4, TL).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { computeReadStatus, computeReadStatusForManager } from "@/lib/cascade";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId, role } = ctx;

  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId");
  const scope = url.searchParams.get("scope") ?? "self";

  if (!documentId)
    return NextResponse.json({ error: "documentId required" }, { status: 400 });

  // permission: TL/FM/CSDM/COO see team/perimeter; LEGAL_HEAD/LEGAL_MANAGER see all
  if (!can(role, "kb:document:read_status") && scope !== "self")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let rows;
  if (scope === "team") {
    // TL/FM/CSDM perimeter
    rows = await computeReadStatusForManager(documentId, userId, tenantId);
  } else if (scope === "all") {
    // LEGAL_HEAD / LEGAL_MANAGER / ADMIN
    rows = await computeReadStatus(documentId, tenantId);
  } else {
    // self only — just the caller
    const all = await computeReadStatus(documentId, tenantId);
    rows = all.filter((r) => r.userId === userId);
  }

  const total = rows.length;
  const acked = rows.filter((r) => r.acknowledged).length;

  return NextResponse.json({
    documentId,
    scope,
    recipients: rows,
    stats: { total, acked, pending: total - acked, rate: total ? Math.round((acked / total) * 100) : 0 },
  });
}
