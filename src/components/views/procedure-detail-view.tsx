"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Star,
  CircleCheck,
  Clock,
  CalendarClock,
  User,
  Tag,
  History,
  GitBranch,
  ChevronRight,
  ShieldCheck,
  FileWarning,
  Printer,
  Share2,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useProcedure, useAck, useToggleFavorite, useTransition } from "@/lib/hooks";
import { toast } from "sonner";
import { ContentRenderer } from "@/components/procedure/content-renderer";
import { WorkflowTimeline } from "@/components/procedure/workflow-timeline";
import { StatusBadge, CriticalityBadge, TagPill } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import {
  formatDate,
  formatRelative,
  daysUntil,
  STATUS_CONFIG,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { ProcedureStatus } from "@/lib/types";

export function ProcedureDetailView() {
  const { selectedProcedureId, openProcedure, setView } = useAppStore();
  const { data: proc, isLoading } = useProcedure(selectedProcedureId);
  const ack = useAck(selectedProcedureId);
  const fav = useToggleFavorite(selectedProcedureId);
  const transition = useTransition(selectedProcedureId);

  const onAck = () => {
    ack.mutate(undefined, {
      onSuccess: () => toast.success("Acknowledgment recorded", { description: "Your read-back is logged in the audit trail." }),
      onError: () => toast.error("Could not acknowledge"),
    });
  };

  const onFav = () => {
    fav.mutate(undefined, {
      onSuccess: (res: any) =>
        toast(res.favorite ? "Added to favorites" : "Removed from favorites"),
    });
  };

  const onTransition = (target: ProcedureStatus) => {
    transition.mutate(target, {
      onSuccess: (res: any) => {
        const cfg = STATUS_CONFIG[res.status];
        toast.success(`Moved to ${cfg.label}`, {
          description: res.version > 1 ? `Now at version ${res.version}` : undefined,
        });
      },
      onError: (e: any) => toast.error(e.message ?? "Transition failed"),
    });
  };

  if (isLoading || !proc) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="h-8 w-1/3 rounded bg-muted shimmer" />
          <div className="h-12 w-3/4 rounded bg-muted shimmer" />
          <div className="h-4 w-full rounded bg-muted shimmer" />
          <div className="h-4 w-5/6 rounded bg-muted shimmer" />
        </div>
        <div className="h-64 rounded-xl bg-muted/40 shimmer" />
      </div>
    );
  }

  const reviewDays = daysUntil(proc.nextReviewAt);
  const overdue = reviewDays !== null && reviewDays < 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      {/* Main column */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="min-w-0"
      >
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <button onClick={() => setView("library")} className="hover:text-foreground">
            Library
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="inline-flex items-center gap-1">
            <DynamicIcon name={proc.departmentIcon} className="h-3.5 w-3.5" style={{ color: proc.departmentColor }} />
            {proc.departmentName}
          </span>
          {proc.processName && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>{proc.processName}</span>
            </>
          )}
          {proc.parentTitle && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <button onClick={() => proc.parentId && openProcedure(proc.parentId)} className="hover:text-foreground">
                {proc.parentTitle}
              </button>
            </>
          )}
        </nav>

        {/* Header */}
        <div className="mt-3 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-muted-foreground">{proc.code}</span>
            <StatusBadge status={proc.status} />
            <CriticalityBadge criticality={proc.criticality} size="sm" />
            <span className="text-xs text-muted-foreground">v{proc.version}</span>
            {proc.visibility === "RESTRICTED" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive">
                <FileWarning className="h-3 w-3" />
                Restricted
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight text-balance">
            {proc.title}
          </h1>

          <p className="text-[15px] leading-relaxed text-muted-foreground">{proc.summary}</p>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {proc.ackRequired && proc.status === "PUBLISHED" && (
              proc.acknowledged ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-status-published/30 bg-status-published/10 px-3 py-2 text-sm font-medium text-status-published">
                  <CircleCheck className="h-4 w-4" />
                  Acknowledged {proc.acknowledgedAt && `· ${formatDate(proc.acknowledgedAt)}`}
                </span>
              ) : (
                <button
                  onClick={onAck}
                  disabled={ack.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:shadow-[var(--shadow-soft)] hover:brightness-105 disabled:opacity-60"
                >
                  {ack.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CircleCheck className="h-4 w-4" />
                  )}
                  Read &amp; Acknowledge
                </button>
              )
            )}

            <button
              onClick={onFav}
              disabled={fav.isPending}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                proc.favorite
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              )}
            >
              <Star className={cn("h-4 w-4", proc.favorite && "fill-primary")} />
              <span className="hidden sm:inline">{proc.favorite ? "Favorited" : "Favorite"}</span>
            </button>

            <button
              onClick={() => toast.info("Export queued", { description: "PDF export is ready for download." })}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(proc.code + " — " + proc.title);
                toast.success("Copied reference");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>

          {/* Workflow */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold">Approval workflow</p>
              <span className="text-[11px] text-muted-foreground">
                Stage {STATUS_CONFIG_DASH_INDEX[proc.status] + 1} of 4
              </span>
            </div>
            <WorkflowTimeline
              current={proc.status}
              canTransition
              onTransition={onTransition}
            />
          </div>
        </div>

        {/* Content */}
        <article className="mt-8 max-w-3xl">
          <ContentRenderer blocks={proc.content} />
        </article>

        {/* Children (Work Instructions) */}
        {proc.children?.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-medium">Work instructions</h2>
              <span className="text-xs text-muted-foreground">({proc.children.length})</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {proc.children.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => openProcedure(c.id)}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
                >
                  <span
                    className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
                    style={{ backgroundColor: c.department?.color }}
                  />
                  <div className="min-w-0 flex-1 pl-1.5">
                    <span className="font-mono text-[11px] text-muted-foreground">{c.code}</span>
                    <p className="mt-0.5 font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                      {c.title}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Sidebar */}
      <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
        {/* Stamp */}
        {proc.status === "PUBLISHED" && (
          <div className="relative overflow-hidden rounded-xl border border-status-published/20 bg-card p-4">
            <div className="absolute -right-3 -top-3 rotate-[3deg]">
              <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-status-published/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-status-published animate-stamp">
                <ShieldCheck className="h-3.5 w-3.5" />
                Approved
              </span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Published version
            </p>
            <p className="mt-1 font-display text-2xl font-medium">v{proc.version}</p>
            <p className="text-xs text-muted-foreground">
              {proc.publishedAt ? formatDate(proc.publishedAt) : "—"}
            </p>
          </div>
        )}

        {/* Owner */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Owner
          </p>
          <div className="flex items-center gap-3">
            <UserAvatar name={proc.ownerName} color={proc.ownerAvatarColor} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{proc.ownerName}</p>
              <p className="text-xs text-muted-foreground">Procedure owner</p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Details
          </p>
          <dl className="space-y-2.5 text-sm">
            <Meta icon={<Clock className="h-3.5 w-3.5" />} label="Read time" value={`${proc.readMinutes} min`} />
            <Meta icon={<History className="h-3.5 w-3.5" />} label="Updated" value={formatRelative(proc.updatedAt)} />
            <Meta icon={<CalendarClock className="h-3.5 w-3.5" />} label="Next review" value={proc.nextReviewAt ? formatDate(proc.nextReviewAt) : "—"} valueClass={overdue ? "text-destructive font-medium" : ""} />
            <Meta icon={<User className="h-3.5 w-3.5" />} label="Acknowledgment" value={proc.ackRequired ? "Required" : "Not required"} />
          </dl>
          {overdue && (
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2 text-xs text-destructive">
              This procedure is {Math.abs(reviewDays!)} days past its review date.
            </div>
          )}
        </div>

        {/* Tags */}
        {proc.tags.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {proc.tags.map((t: string) => (
                <TagPill key={t} tag={t} />
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

const STATUS_CONFIG_DASH_INDEX: Record<ProcedureStatus, number> = {
  DRAFT: 0,
  IN_REVIEW: 1,
  PUBLISHED: 2,
  ARCHIVED: 3,
};

function Meta({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn("font-medium text-foreground text-right", valueClass)}>{value}</span>
    </div>
  );
}
