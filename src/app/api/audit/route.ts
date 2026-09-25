import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { toAuditLogDTO } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = ctx;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "30"), 100);
  const logs = await db.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: true },
  });
  return NextResponse.json(logs.map(toAuditLogDTO));
}
