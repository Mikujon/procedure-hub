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

  const now = Date.now();
  const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

  const [
    totalProcedures,
    byStatus,
    byDepartment,
    activeUsers,
    upcomingReviews,
    mostViewedTags,
    ackCampaigns,
    pagesNeedingVerification,
  ] = await Promise.all([
    prisma.procedure.count({ where: { tenantId } }),
    prisma.procedure.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
    prisma.procedure.groupBy({ by: ["departmentId"], where: { tenantId }, _count: true }),
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.procedure.findMany({
      where: {
        tenantId,
        status: "PUBLISHED",
        nextReviewDate: { lte: new Date(now + 30 * 24 * 60 * 60 * 1000) },
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
    // % of Read & Acknowledge campaigns completed, for procedures that
    // still require one — only the campaign matching the procedure's
    // *current* version counts, a superseded campaign from an older
    // version isn't "still open" even if it never hit 100%.
    prisma.ackCampaign.findMany({
      where: { tenantId, procedure: { requiresAck: true } },
      select: { versionNumber: true, completedAt: true, procedure: { select: { currentVersion: { select: { versionNumber: true } } } } },
    }),
    // Pages "da verificare" (2.4): never verified, or stale beyond the same
    // 90-day threshold the badge on the page itself uses.
    prisma.page.count({
      where: {
        tenantId,
        isArchived: false,
        OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: new Date(now - STALE_AFTER_MS) } }],
      },
    }),
  ]);

  const departments = await prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true } });
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  const currentAckCampaigns = ackCampaigns.filter((c) => c.versionNumber === c.procedure.currentVersion?.versionNumber);
  const completedAckCampaigns = currentAckCampaigns.filter((c) => c.completedAt !== null);
  const ackCompletionRate =
    currentAckCampaigns.length > 0 ? Math.round((completedAckCampaigns.length / currentAckCampaigns.length) * 100) : null;

  return NextResponse.json({
    totalProcedures,
    activeUsers,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byDepartment: byDepartment.map((d) => ({ department: deptMap[d.departmentId], count: d._count })),
    upcomingReviews: upcomingReviews.map((p) => ({ ...p, overdue: p.nextReviewDate !== null && p.nextReviewDate.getTime() < now })),
    topTags: mostViewedTags.map((t) => ({ name: t.name, count: t._count.procedures })),
    ackCompletionRate,
    ackCampaignCount: currentAckCampaigns.length,
    pagesNeedingVerification,
  });
}
