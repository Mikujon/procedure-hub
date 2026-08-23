import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewProcedure } from "@/lib/permissions";

/**
 * Minimal lookup so the sidebar can "reveal" a procedure it didn't navigate
 * to via its own tree (opened from search, the breadcrumb, a direct link,
 * a notification, …) — same idea as VS Code/GitHub auto-expanding the file
 * explorer to the file you're looking at. Deliberately not the full
 * GET /api/procedures/[id] (that pulls contentHtml/versions/comments — far
 * more than the sidebar needs just to know which department/process
 * branches to open).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const allowed = await canViewProcedure({ id: userId, tenantId, globalRole }, params.id);
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const procedure = await prisma.procedure.findUnique({
    where: { id: params.id },
    select: { id: true, departmentId: true, department: { select: { slug: true } }, processId: true, parentId: true },
  });
  if (!procedure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    departmentId: procedure.departmentId,
    departmentSlug: procedure.department.slug,
    processId: procedure.processId,
    parentId: procedure.parentId,
  });
}
