// Domain helpers + display config for statuses, criticality, roles.
import type { ProcedureStatus, Criticality, UserRole } from "@/lib/types";
import {
  FileEdit,
  Eye,
  CheckCircle2,
  Archive,
  ShieldAlert,
  Shield,
  CircleAlert,
  CircleDot,
  type LucideIcon,
} from "lucide-react";

export interface StatusConfig {
  label: string;
  short: string;
  color: string; // text color class
  bg: string; // bg color class
  border: string;
  dot: string; // hex for charts/dots
  icon: LucideIcon;
  description: string;
}

export const STATUS_CONFIG: Record<ProcedureStatus, StatusConfig> = {
  DRAFT: {
    label: "Draft",
    short: "DR",
    color: "text-status-draft",
    bg: "bg-status-draft/10",
    border: "border-status-draft/25",
    dot: "var(--status-draft)",
    icon: FileEdit,
    description: "Being authored — not yet submitted for review.",
  },
  IN_REVIEW: {
    label: "In Review",
    short: "RV",
    color: "text-status-review",
    bg: "bg-status-review/15",
    border: "border-status-review/30",
    dot: "var(--status-review)",
    icon: Eye,
    description: "Awaiting compliance or management approval.",
  },
  PUBLISHED: {
    label: "Published",
    short: "PB",
    color: "text-status-published",
    bg: "bg-status-published/15",
    border: "border-status-published/30",
    dot: "var(--status-published)",
    icon: CheckCircle2,
    description: "Live and available to readers. Acknowledgments may be required.",
  },
  ARCHIVED: {
    label: "Archived",
    short: "AR",
    color: "text-status-archived",
    bg: "bg-status-archived/10",
    border: "border-status-archived/25",
    dot: "var(--status-archived)",
    icon: Archive,
    description: "Superseded or retired — kept for historical reference.",
  },
};

export interface CriticalityConfig {
  label: string;
  short: string;
  color: string;
  bg: string;
  dot: string;
  icon: LucideIcon;
}

export const CRITICALITY_CONFIG: Record<Criticality, CriticalityConfig> = {
  LOW: {
    label: "Low",
    short: "L",
    color: "text-status-draft",
    bg: "bg-status-draft/10",
    dot: "var(--status-draft)",
    icon: CircleDot,
  },
  MEDIUM: {
    label: "Medium",
    short: "M",
    color: "text-status-review",
    bg: "bg-status-review/15",
    dot: "var(--status-review)",
    icon: CircleAlert,
  },
  HIGH: {
    label: "High",
    short: "H",
    color: "text-primary",
    bg: "bg-primary/10",
    dot: "var(--primary)",
    icon: Shield,
  },
  CRITICAL: {
    label: "Critical",
    short: "C",
    color: "text-destructive",
    bg: "bg-destructive/10",
    dot: "var(--destructive)",
    icon: ShieldAlert,
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  COMPLIANCE: "Compliance Officer",
  OWNER: "Department Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

export const WORKFLOW_STAGES: ProcedureStatus[] = ["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"];

// ---------- date / time helpers ----------
export function formatRelative(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diff = d.getTime() - now;
  const absDays = Math.round(Math.abs(diff) / 86400000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absDays === 0) {
    const hours = Math.round(diff / 3600000);
    if (Math.abs(hours) < 1) {
      const mins = Math.round(diff / 60000);
      return rtf.format(mins, "minute");
    }
    return rtf.format(hours, "hour");
  }
  if (absDays < 30) return rtf.format(Math.round(diff / 86400000), "day");
  if (absDays < 365) return rtf.format(Math.round(diff / (86400000 * 30)), "month");
  return rtf.format(Math.round(diff / (86400000 * 365)), "year");
}

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

// parse a hex color to "r g b / a" for inline rgba usage where needed
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(v, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
