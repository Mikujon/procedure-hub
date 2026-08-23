import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace, canEditProcedure } from "@/lib/permissions";

/** Same edit-gate as PATCH /api/pages/[id] — a page promoted to a governed Procedure follows department RBAC, a free page follows workspace RBAC. */
async function canEditThisPage(actorUser: { id: string; tenantId: string; globalRole: any }, page: { procedure: { departmentId: string } | null } | null) {
  if (page?.procedure) return canEditProcedure(actorUser, page.procedure.departmentId);
  return canEditWorkspace(actorUser);
}

/** Marks a page "still accurate" — the lightweight staleness signal from 2.4, not Procedure's formal review workflow. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const existing = await prisma.page.findFirst({ where: { id: params.id, tenantId }, include: { procedure: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canEditThisPage({ id: userId, tenantId, globalRole }, existing))) {
    return NextResponse.json({ error: "Sola lettura: non hai i permessi per verificare questa pagina." }, { status: 403 });
  }

  const page = await prisma.page.update({
    where: { id: params.id },
    data: { lastVerifiedAt: new Date(), verifiedById: userId },
    select: { lastVerifiedAt: true, verifiedBy: { select: { name: true } } },
  });

  return NextResponse.json({ page });
}
