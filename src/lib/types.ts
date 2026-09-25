// Shared domain types for Procedure Hub (redesign)

export type ProcedureStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type UserRole = "ADMIN" | "COMPLIANCE" | "OWNER" | "EDITOR" | "VIEWER";
export type Visibility = "ALL" | "RESTRICTED";
export type ViewKey =
  | "dashboard"
  | "library"
  | "procedure"
  | "editor"
  | "approvals"
  | "admin"
  | "favorites";

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "callout"; variant: "info" | "warning" | "success" | "danger"; text: string; title?: string }
  | { type: "checklist"; items: { text: string; checked: boolean }[] }
  | { type: "steps"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "code"; language: string; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "divider" }
  | { type: "definition"; term: string; definition: string };

export interface DepartmentDTO {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string | null;
  sortOrder: number;
  procedureCount: number;
  processes: { id: string; name: string; procedureCount: number }[];
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string | null;
  avatarColor: string;
  departmentId: string | null;
}

export interface ProcedureDTO {
  id: string;
  code: string;
  title: string;
  summary: string;
  departmentId: string;
  departmentName: string;
  departmentColor: string;
  departmentIcon: string;
  processId: string | null;
  processName: string | null;
  parentId: string | null;
  parentTitle: string | null;
  status: ProcedureStatus;
  version: number;
  criticality: Criticality;
  visibility: Visibility;
  tags: string[];
  content: Block[];
  ownerId: string;
  ownerName: string;
  ownerAvatarColor: string;
  ackRequired: boolean;
  readMinutes: number;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  favorite: boolean;
  nextReviewAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcedureListItem {
  id: string;
  code: string;
  title: string;
  summary: string;
  status: ProcedureStatus;
  criticality: Criticality;
  departmentId: string;
  departmentName: string;
  departmentColor: string;
  departmentIcon: string;
  processName: string | null;
  version: number;
  tags: string[];
  ownerId: string;
  ownerName: string;
  ownerAvatarColor: string;
  readMinutes: number;
  acknowledged: boolean;
  favorite: boolean;
  nextReviewAt: string | null;
  updatedAt: string;
  childrenCount: number;
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  procedureId: string | null;
  createdAt: string;
}

export interface AuditLogDTO {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

export interface AnnouncementDTO {
  id: string;
  title: string;
  body: string;
  variant: "info" | "success" | "warning";
  pinned: boolean;
  createdAt: string;
}

export interface StatsDTO {
  totalProcedures: number;
  published: number;
  inReview: number;
  drafts: number;
  archived: number;
  pendingAcks: number;
  pendingReviews: number;
  favorites: number;
  byDepartment: { name: string; color: string; count: number; icon: string }[];
  byStatus: { status: ProcedureStatus; count: number }[];
  byCriticality: { criticality: Criticality; count: number }[];
  recentActivity: AuditLogDTO[];
  upcomingReviews: { id: string; code: string; title: string; nextReviewAt: string; departmentColor: string }[];
}
