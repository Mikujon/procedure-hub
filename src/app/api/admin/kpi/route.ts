import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).globalRole !== "ADMIN" && (session.user as any).globalRole !== "COMPLIANCE_OFFICER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = (session.user as any).tenantId as string;

  const [
    totalProcedures,
    byStatus,
    byDepartment,
    activeUsers,
    upcomingReviews,
    mostViewedTags,
  ] = await Promise.all([
    prisma.procedure.count({ where: { tenantId } }),
    prisma.procedure.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
    prisma.procedure.groupBy({ by: ["departmentId"], where: { tenantId }, _count: true }),
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.procedure.findMany({
      where: {
        tenantId,
        status: "PUBLISHED",
        nextReviewDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true, title: true, nextReviewDate: true, department: { select: { name: true } } },
      orderBy: { nextReviewDate: "asc" },
      take: 10,
    }),
    prisma.tag.findMany({
      where: { tenantId },
      include: { _count: { select: { procedures: true } } },
      orderBy: { procedures: { _count: "desc" } },
      take: 8,
    }),
  ]);

  const departments = await prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  return NextResponse.json({
    totalProcedures,
    activeUsers,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byDepartment: byDepartment.map((d) => ({ department: deptMap[d.departmentId], count: d._count })),
    upcomingReviews,
    topTags: mostViewedTags.map((t) => ({ name: t.name, count: t._count.procedures })),
  });
}
