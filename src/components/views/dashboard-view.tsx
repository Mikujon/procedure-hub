"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  Eye,
  Clock,
  Star,
  ArrowRight,
  Megaphone,
  Activity,
  CalendarClock,
  CircleAlert,
  Inbox,
  Sparkles,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useBootstrap, useProcedures } from "@/lib/hooks";
import { StatCard, SectionHeader, EmptyState, CardSkeleton } from "@/components/shared/layout-primitives";
import { ProcedureCard } from "@/components/procedure/procedure-card";
import { StatusBadge } from "@/components/shared/badges";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { formatRelative, formatDate, daysUntil } from "@/lib/domain";
import { cn } from "@/lib/utils";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

export function DashboardView() {
  const { openProcedure, setView } = useAppStore();
  const { data, isLoading } = useBootstrap();
  const { data: recent } = useProcedures({ sort: "updated" });
  const { data: ackPending } = useProcedures({ ackPending: "1" });
  const { data: inReview } = useProcedures({ status: "IN_REVIEW" });
  const { data: favorites } = useProcedures({ favorite: "1" });

  const stats = data?.stats;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = data?.user?.name.split(" ")[0] ?? "there";

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-xl bg-muted/40 shimmer" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton className="lg:col-span-2" />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const actionRequired = [
    ...(ackPending ?? []).slice(0, 3).map((p) => ({
      kind: "ack" as const,
      proc: p,
    })),
    ...(inReview ?? []).slice(0, 2).map((p) => ({
      kind: "review" as const,
      proc: p,
    })),
  ].slice(0, 4);

  const upcoming = stats.upcomingReviews ?? [];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
      {/* Hero */}
      <motion.section variants={item} className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" aria-hidden />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" aria-hidden />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight">
              {greeting}, {firstName}.
            </h1>
            <p className="text-sm text-muted-foreground max-w-lg">
              You have{" "}
              <button onClick={() => setView("b7")} className="font-medium text-foreground underline-offset-4 hover:underline">
                {stats.pendingReviews} procedure{stats.pendingReviews === 1 ? "" : "s"} in review
              </button>{" "}
              and{" "}
              <button onClick={() => setView("b7")} className="font-medium text-foreground underline-offset-4 hover:underline">
                {stats.pendingAcks} acknowledgment{stats.pendingAcks === 1 ? "" : "s"} due
              </button>
              .
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            <span>Next review window closes in 12 days</span>
          </div>
        </div>
      </motion.section>

      {/* Stat cards */}
      <motion.section variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Procedures"
          value={stats.totalProcedures}
          hint={`${stats.published} published · ${stats.drafts} drafts`}
          icon={<FileText className="h-4 w-4" />}
          tone="primary"
          onClick={() => setView("b7")}
        />
        <StatCard
          label="In Review"
          value={stats.inReview}
          hint="Awaiting approval"
          icon={<Eye className="h-4 w-4" />}
          tone="warning"
          onClick={() => setView("b7")}
        />
        <StatCard
          label="Ack Due"
          value={stats.pendingAcks}
          hint="Require your read-back"
          icon={<CircleAlert className="h-4 w-4" />}
          tone="danger"
          onClick={() => setView("b7")}
        />
        <StatCard
          label="Favorites"
          value={stats.favorites}
          hint="Pinned for quick access"
          icon={<Star className="h-4 w-4" />}
          tone="success"
          onClick={() => setView("b7")}
        />
      </motion.section>

      {/* Action required + announcements */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.section variants={item} className="lg:col-span-2 space-y-4">
          <SectionHeader
            title="Action required"
            description="Items waiting on your attention"
            icon={<Inbox className="h-4 w-4" />}
            action={
              <button
                onClick={() => setView("b7")}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </button>
            }
          />
          {actionRequired.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Nothing pending"
              description="You're all caught up. Nice work."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {actionRequired.map(({ kind, proc }) => (
                <button
                  key={proc.id}
                  onClick={() => openProcedure(proc.id)}
                  className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        kind === "ack"
                          ? "bg-status-review/15 text-status-review"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {kind === "ack" ? <CircleAlert className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {kind === "ack" ? "Acknowledge" : "Review"}
                    </span>
                    <StatusBadge status={proc.status} size="sm" />
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">{proc.code}</p>
                  <p className="font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {proc.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {kind === "ack" ? `Updated ${formatRelative(proc.updatedAt)}` : "Awaiting your decision"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section variants={item} className="space-y-4">
          <SectionHeader
            title="Announcements"
            icon={<Megaphone className="h-4 w-4" />}
          />
          <div className="space-y-3">
            {(data?.announcements ?? []).map((a: any) => (
              <div
                key={a.id}
                className={cn(
                  "rounded-xl border p-4",
                  a.variant === "warning"
                    ? "border-status-review/25 bg-status-review/5"
                    : "border-border bg-card"
                )}
              >
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                  {a.body}
                </p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {formatRelative(a.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Recent procedures */}
      <motion.section variants={item} className="space-y-4">
        <SectionHeader
          title="Recently updated"
          description="Procedures with the latest activity"
          icon={<Clock className="h-4 w-4" />}
          action={
            <button
              onClick={() => setView("b7")}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(recent ?? []).slice(0, 6).map((p: any) => (
            <ProcedureCard key={p.id} proc={p} onOpen={openProcedure} layout="grid" />
          ))}
        </div>
      </motion.section>

      {/* Favorites + upcoming reviews */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.section variants={item} className="lg:col-span-2 space-y-4">
          <SectionHeader
            title="Your favorites"
            description="Quick access to procedures you've pinned"
            icon={<Star className="h-4 w-4" />}
            action={
              <button
                onClick={() => setView("b7")}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </button>
            }
          />
          {(favorites ?? []).length === 0 ? (
            <EmptyState
              icon={<Star className="h-5 w-5" />}
              title="No favorites yet"
              description="Star a procedure to pin it here for quick access."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(favorites ?? []).slice(0, 4).map((p: any) => (
                <ProcedureCard key={p.id} proc={p} onOpen={openProcedure} layout="grid" />
              ))}
            </div>
          )}
        </motion.section>

        <motion.section variants={item} className="space-y-4">
          <SectionHeader
            title="Upcoming reviews"
            icon={<CalendarClock className="h-4 w-4" />}
          />
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {upcoming.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No scheduled reviews.
              </div>
            )}
            {upcoming.map((r: any) => {
              const days = daysUntil(r.nextReviewAt);
              const overdue = days !== null && days < 0;
              return (
                <button
                  key={r.id}
                  onClick={() => openProcedure(r.id)}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: r.departmentColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-muted-foreground">{r.code}</p>
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {r.title}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-medium tabular-nums",
                      overdue ? "text-destructive" : days !== null && days <= 14 ? "text-status-review" : "text-muted-foreground"
                    )}
                  >
                    {overdue ? `${Math.abs(days!)}d overdue` : formatDate(r.nextReviewAt)}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.section>
      </div>

      {/* Activity */}
      <motion.section variants={item} className="space-y-4">
        <SectionHeader
          title="Recent activity"
          description="Latest changes across the workspace"
          icon={<Activity className="h-4 w-4" />}
        />
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {(stats.recentActivity ?? []).map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                <span className="font-medium text-foreground">{log.userName ?? "System"}</span>
                <span className="text-muted-foreground truncate flex-1">{log.summary}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatRelative(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
