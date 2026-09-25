"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Star,
  Clock,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, CriticalityBadge, TagPill } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { formatRelative, daysUntil } from "@/lib/domain";
import type { ProcedureListItem } from "@/lib/types";

export function ProcedureCard({
  proc,
  onOpen,
  layout = "list",
  showDepartment = true,
}: {
  proc: ProcedureListItem;
  onOpen: (id: string) => void;
  layout?: "list" | "grid";
  showDepartment?: boolean;
}) {
  const reviewDays = daysUntil(proc.nextReviewAt);
  const overdue = reviewDays !== null && reviewDays < 0;
  const dueSoon = reviewDays !== null && reviewDays >= 0 && reviewDays <= 14;

  return (
    <motion.button
      type="button"
      layout
      onClick={() => onOpen(proc.id)}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative w-full text-left rounded-xl border border-border bg-card transition-colors",
        "hover:border-primary/40 hover:shadow-[var(--shadow-soft)]",
        layout === "grid" ? "p-4 flex flex-col h-full" : "p-3.5 flex items-start gap-3"
      )}
    >
      {/* department accent stripe */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-xl",
          layout === "grid" ? "top-0 bottom-0" : "top-0 bottom-0"
        )}
        style={{ backgroundColor: proc.departmentColor }}
        aria-hidden
      />

      <div className={cn(layout === "grid" ? "flex-1 pl-2" : "flex-1 min-w-0 pl-2")}>
        {/* top row: code + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[11px] font-medium text-muted-foreground tracking-tight">
              {proc.code}
            </span>
            {proc.childrenCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                {proc.childrenCount}
              </span>
            )}
          </div>
          <StatusBadge status={proc.status} size="sm" />
        </div>

        {/* title */}
        <h3 className="mt-1.5 font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {proc.title}
        </h3>

        {/* summary */}
        {layout === "grid" && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {proc.summary}
          </p>
        )}

        {/* meta row */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          {showDepartment && (
            <span className="inline-flex items-center gap-1">
              <DynamicIcon
                name={proc.departmentIcon}
                className="h-3 w-3"
                style={{ color: proc.departmentColor }}
              />
              <span className="truncate max-w-[120px]">{proc.departmentName}</span>
            </span>
          )}
          {proc.processName && (
            <span className="truncate max-w-[110px]">· {proc.processName}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {proc.readMinutes}m
          </span>
          {proc.ackRequired && (
            proc.acknowledged ? (
              <span className="inline-flex items-center gap-1 text-status-published">
                <CircleCheck className="h-3 w-3" />
                Acked
              </span>
            ) : proc.status === "PUBLISHED" ? (
              <span className="inline-flex items-center gap-1 font-medium text-status-review">
                <CircleAlert className="h-3 w-3" />
                Ack due
              </span>
            ) : null
          )}
        </div>

        {/* tags */}
        {proc.tags.length > 0 && layout === "grid" && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {proc.tags.slice(0, 3).map((t) => (
              <TagPill key={t} tag={t} />
            ))}
          </div>
        )}

        {/* footer */}
        <div className="mt-2.5 flex items-center justify-between gap-2 pt-2.5 border-t border-border/60">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserAvatar name={proc.ownerName} color={proc.ownerAvatarColor} size="xs" />
            <span className="text-[11px] text-muted-foreground truncate">
              {proc.ownerName.split(" ")[0]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {overdue && (
              <span className="text-[11px] font-medium text-destructive">
                Review overdue
              </span>
            )}
            {dueSoon && !overdue && (
              <span className="text-[11px] font-medium text-status-review">
                Review in {reviewDays}d
              </span>
            )}
            {!overdue && !dueSoon && (
              <span className="text-[11px] text-muted-foreground">
                {formatRelative(proc.updatedAt)}
              </span>
            )}
            {proc.favorite && (
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            )}
          </div>
        </div>
      </div>

      {layout === "list" && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      )}

      {/* criticality corner */}
      {proc.criticality !== "LOW" && proc.criticality !== "MEDIUM" && (
        <div className={cn(layout === "grid" ? "absolute top-3 right-3" : "")}>
          <CriticalityBadge criticality={proc.criticality} size="sm" />
        </div>
      )}
    </motion.button>
  );
}
