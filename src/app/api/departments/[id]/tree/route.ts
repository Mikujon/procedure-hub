import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { visibilityWhereClause } from "@/lib/permissions";

/**
 * Flat data for the Department -> Process -> Procedure -> Work Instruction
 * tree (sidebar `DepartmentTree` and the department page's tree view share
 * this one endpoint — same "fetch flat, build the tree client-side" pattern
 * PageTree already uses for Workspace pages, not a nested-JSON response).
 *
 * Also used by the procedure page's breadcrumb to resolve sibling
 * process/procedure nodes at each crumb level for the "jump to a sibling"
 * dropdown — one source of truth for the hierarchy instead of a second
 * siblings-only endpoint.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const department = await prisma.department.findFirst({ where: { id: params.id, tenantId }, select: { id: true } });
  if (!department) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const actor = { id: userId, tenantId, globalRole };
  const visClause = await visibilityWhereClause(actor);

  const [processes, procedures] = await Promise.all([
    prisma.process.findMany({
      where: { departmentId: department.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, parentId: true },
    }),
    // Same visibility rule as canViewProcedure (rule 4) — a RESTRICTED/
    // DEPARTMENT procedure never shows up in the tree for someone with no
    // membership here, even though the department itself is listed for
    // everyone in the sidebar.
    prisma.procedure.findMany({
      where: { departmentId: department.id, ...visClause },
      orderBy: { updatedAt: "desc" },
      select: { id: true, code: true, title: true, status: true, isCritical: true, processId: true, parentId: true },
    }),
  ]);

  return NextResponse.json({ processes, procedures });
}
