import type {
  ProcedureDTO,
  ProcedureListItem,
  DepartmentDTO,
  NotificationDTO,
  AuditLogDTO,
  AnnouncementDTO,
  StatsDTO,
  ProcedureStatus,
  Criticality,
  Block,
} from "@/lib/types";

type PrismaProcedure = {
  id: string;
  code: string;
  title: string;
  summary: string;
  departmentId: string;
  processId: string | null;
  parentId: string | null;
  status: string;
  version: number;
  criticality: string;
  visibility: string;
  tags: string;
  content: string;
  ownerId: string;
  ackRequired: boolean;
  readMinutes: number;
  nextReviewAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  department: { id: string; name: string; slug: string; icon: string; color: string } | null;
  process: { id: string; name: string } | null;
  parent: { id: string; title: string } | null;
  owner: { id: string; name: string; avatarColor: string } | null;
  _count?: { children: number };
  favorites?: { userId: string }[];
  acknowledgments?: { userId: string; acknowledgedAt: Date }[];
};

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function toProcedureListItem(
  p: PrismaProcedure,
  currentUserId: string
): ProcedureListItem {
  const favorite = (p.favorites ?? []).some((f) => f.userId === currentUserId);
  const ack = (p.acknowledgments ?? []).find((a) => a.userId === currentUserId);
  return {
    id: p.id,
    code: p.code,
    title: p.title,
    summary: p.summary,
    status: p.status as ProcedureStatus,
    criticality: p.criticality as Criticality,
    departmentId: p.departmentId,
    departmentName: p.department?.name ?? "",
    departmentColor: p.department?.color ?? "#888",
    departmentIcon: p.department?.icon ?? "FileText",
    processName: p.process?.name ?? null,
    version: p.version,
    tags: safeParse<string[]>(p.tags, []),
    ownerId: p.owner?.id ?? p.ownerId,
    ownerName: p.owner?.name ?? "—",
    ownerAvatarColor: p.owner?.avatarColor ?? "#888",
    readMinutes: p.readMinutes,
    acknowledged: !!ack,
    favorite,
    nextReviewAt: p.nextReviewAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
    childrenCount: p._count?.children ?? 0,
  };
}

export function toProcedureDTO(
  p: PrismaProcedure,
  currentUserId: string
): ProcedureDTO {
  const favorite = (p.favorites ?? []).some((f) => f.userId === currentUserId);
  const ack = (p.acknowledgments ?? []).find((a) => a.userId === currentUserId);
  return {
    id: p.id,
    code: p.code,
    title: p.title,
    summary: p.summary,
    departmentId: p.departmentId,
    departmentName: p.department?.name ?? "",
    departmentColor: p.department?.color ?? "#888",
    departmentIcon: p.department?.icon ?? "FileText",
    processId: p.processId,
    processName: p.process?.name ?? null,
    parentId: p.parentId,
    parentTitle: p.parent?.title ?? null,
    status: p.status as ProcedureStatus,
    version: p.version,
    criticality: p.criticality as Criticality,
    visibility: p.visibility as "ALL" | "RESTRICTED",
    tags: safeParse<string[]>(p.tags, []),
    content: safeParse<Block[]>(p.content, []),
    ownerId: p.owner?.id ?? p.ownerId,
    ownerName: p.owner?.name ?? "—",
    ownerAvatarColor: p.owner?.avatarColor ?? "#888",
    ackRequired: p.ackRequired,
    readMinutes: p.readMinutes,
    acknowledged: !!ack,
    acknowledgedAt: ack?.acknowledgedAt.toISOString() ?? null,
    favorite,
    nextReviewAt: p.nextReviewAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toDepartmentDTO(
  d: any,
  procedureCount: number,
  processes: { id: string; name: string; procedureCount: number }[]
): DepartmentDTO {
  return {
    id: d.id,
    name: d.name,
    slug: d.slug,
    icon: d.icon,
    color: d.color,
    description: d.description,
    sortOrder: d.sortOrder,
    procedureCount,
    processes,
  };
}

export function toNotificationDTO(n: any): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.read,
    procedureId: n.procedureId,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toAuditLogDTO(a: any): AuditLogDTO {
  return {
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    summary: a.summary,
    userId: a.userId,
    userName: a.user?.name ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export function toAnnouncementDTO(a: any): AnnouncementDTO {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    variant: a.variant as "info" | "success" | "warning",
    pinned: a.pinned,
    createdAt: a.createdAt.toISOString(),
  };
}

export function emptyStats(): StatsDTO {
  return {
    totalProcedures: 0,
    published: 0,
    inReview: 0,
    drafts: 0,
    archived: 0,
    pendingAcks: 0,
    pendingReviews: 0,
    favorites: 0,
    byDepartment: [],
    byStatus: [],
    byCriticality: [],
    recentActivity: [],
    upcomingReviews: [],
  };
}
