import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure } from "@/lib/permissions";
import { submitForReview } from "@/lib/workflow";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  // Previously missing entirely: without this, any authenticated user of any
  // tenant could submit another tenant's procedure for review just by
  // knowing its id — see procedure-hub audit, finding #1.
  const procedure = await prisma.procedure.findUnique({ where: { id: params.id } });
  if (!procedure || procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canEditProcedure({ id: userId, tenantId, globalRole }, procedure.departmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const nextStage = await submitForReview(params.id, userId);
  return NextResponse.json({ status: nextStage });
}
