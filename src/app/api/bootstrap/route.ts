import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { getCurrentUser } from "@/lib/session";
import {
  toDepartmentDTO,
  toAnnouncementDTO,
  toAuditLogDTO,
} from "@/lib/mappers";
import type { StatsDTO, ProcedureStatus, Criticality } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeed();
  } catch (e) {
    console.error("[bootstrap] seed failed:", e);
    return NextResponse.json(
      { error: "Seed failed", detail: String(e) },
      { status: 500 }
    );
  }

  const user = await getCurrentUser();

  const [departments, announcements, auditLogs, procedures, favorites] =
    await Promise.all([
      db.department.findMany({
        orderBy: { sortOrder: "asc" },
        include: { processes: { orderBy: { sortOrder: "asc" } } },
      }),
      db.announcement.findMany({
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      db.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { user: true },
      }),
      db.procedure.findMany({
        include: { _count: { select: { children: true } } },
      }),
      db.favorite.count({ where: { userId: user.id } }),
    ]);

  // Build department DTOs with counts
  const deptCounts = new Map<string, number>();
  for (const p of procedures) {
    deptCounts.set(p.departmentId, (deptCounts.get(p.departmentId) ?? 0) + 1);
  }
  const deptDTOs = departments.map((d) => {
    const procInDept = procedures.filter((p) => p.departmentId === d.id);
    const processCounts = new Map<string, number>();
    for (const p of procInDept) {
      if (p.processId)
        processCounts.set(p.processId, (processCounts.get(p.processId) ?? 0) + 1);
    }
    return toDepartmentDTO(
      d,
      deptCounts.get(d.id) ?? 0,
      d.processes.map((pr) => ({
        id: pr.id,
        name: pr.name,
        procedureCount: processCounts.get(pr.id) ?? 0,
      }))
    );
  });

  // Stats
  const statusCounts: Record<string, number> = {};
  const critCounts: Record<string, number> = {};
  for (const p of procedures) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
    critCounts[p.criticality] = (critCounts[p.criticality] ?? 0) + 1;
  }

  // pending acks for current user
  const publishedIds = procedures
    .filter((p) => p.status === "PUBLISHED" && p.ackRequired)
    .map((p) => p.id);
  const acked = await db.acknowledgment.findMany({
    where: { userId: user.id, procedureId: { in: publishedIds } },
    select: { procedureId: true },
  });
  const ackedSet = new Set(acked.map((a) => a.procedureId));
  const pendingAcks = publishedIds.filter((id) => !ackedSet.has(id)).length;

  const pendingReviews = statusCounts["IN_REVIEW"] ?? 0;

  const stats: StatsDTO = {
    totalProcedures: procedures.length,
    published: statusCounts["PUBLISHED"] ?? 0,
    inReview: statusCounts["IN_REVIEW"] ?? 0,
    drafts: statusCounts["DRAFT"] ?? 0,
    archived: statusCounts["ARCHIVED"] ?? 0,
    pendingAcks,
    pendingReviews,
    favorites,
    byDepartment: deptDTOs.map((d) => ({
      name: d.name,
      color: d.color,
      count: d.procedureCount,
      icon: d.icon,
    })),
    byStatus: (
      ["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"] as ProcedureStatus[]
    ).map((s) => ({ status: s, count: statusCounts[s] ?? 0 })),
    byCriticality: (
      ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Criticality[]
    ).map((c) => ({ criticality: c, count: critCounts[c] ?? 0 })),
    recentActivity: auditLogs.map(toAuditLogDTO),
    upcomingReviews: procedures
      .filter((p) => p.nextReviewAt && p.status === "PUBLISHED")
      .sort((a, b) => a.nextReviewAt!.getTime() - b.nextReviewAt!.getTime())
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        nextReviewAt: p.nextReviewAt!.toISOString(),
        departmentColor:
          departments.find((d) => d.id === p.departmentId)?.color ?? "#888",
      })),
  };

  return NextResponse.json({
    user,
    departments: deptDTOs,
    announcements: announcements.map(toAnnouncementDTO),
    stats,
  });
}
