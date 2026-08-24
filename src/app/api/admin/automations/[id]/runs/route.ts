import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTenantAdmin } from "@/lib/permissions";

/**
 * Run history for one rule (3.1) — the data (AutomationRun) already existed,
 * automations-panel.tsx just showed `_count.runs` and nothing else. `entityId`
 * is always a procedureId regardless of `entityType` ("Procedure" or
 * "AckCampaign" — see engine.ts's fireRule calls), so a single batch lookup
 * covers both trigger families.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  if (!isTenantAdmin({ id: userId, tenantId, globalRole })) {
    return NextResponse.json({ error: "Solo un amministratore può gestire le automazioni." }, { status: 403 });
  }

  const rule = await prisma.automationRule.findUnique({ where: { id: params.id }, select: { id: true, tenantId: true } });
  if (!rule || rule.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const runs = await prisma.automationRun.findMany({
    where: { ruleId: params.id },
    orderBy: { firedAt: "desc" },
    take: 25,
  });

  const procedures = await prisma.procedure.findMany({
    where: { id: { in: [...new Set(runs.map((r) => r.entityId))] } },
    select: { id: true, title: true, code: true },
  });
  const procedureMap = Object.fromEntries(procedures.map((p) => [p.id, p]));

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      entityType: r.entityType,
      status: r.status,
      error: r.error,
      firedAt: r.firedAt,
      procedure: procedureMap[r.entityId] ?? null,
    })),
  });
}
