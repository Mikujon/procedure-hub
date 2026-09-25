"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Eye,
  CircleAlert,
  CheckCircle2,
  Clock,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useProcedures } from "@/lib/hooks";
import { SectionHeader, EmptyState, StatCard } from "@/components/shared/layout-primitives";
import { ProcedureCard } from "@/components/procedure/procedure-card";
import { StatusBadge } from "@/components/shared/badges";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { formatRelative } from "@/lib/domain";

export function ApprovalsView() {
  const { openProcedure } = useAppStore();
  const { data: inReview, isLoading: rLoading } = useProcedures({ status: "IN_REVIEW" });
  const { data: ackPending, isLoading: aLoading } = useProcedures({ ackPending: "1" });

  const reviewList = inReview ?? [];
  const ackList = ackPending ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Approvals queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Procedures awaiting your review and acknowledgments due from you.
        </p>
      </div>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Awaiting review"
          value={reviewList.length}
          hint="Compliance & management approval"
          icon={<Eye className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Acknowledgments due"
          value={ackList.length}
          hint="Published procedures you must read"
          icon={<CircleAlert className="h-4 w-4" />}
          tone="danger"
        />
        <StatCard
          label="Auto-advancing"
          value={reviewList.filter((p: any) => p.criticality === "LOW" || p.criticality === "MEDIUM").length}
          hint="Non-critical procedures auto-publish on approval"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
      </div>

      {/* Review queue */}
      <section className="space-y-4">
        <SectionHeader
          title="Pending review"
          description="Procedures submitted for approval"
          icon={<Clock className="h-4 w-4" />}
        />
        {rLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="h-3 w-1/4 rounded bg-muted shimmer" />
                <div className="h-5 w-3/4 rounded bg-muted shimmer" />
              </div>
            ))}
          </div>
        ) : reviewList.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Review queue is clear"
            description="No procedures are waiting for approval right now."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {reviewList.map((p: any) => (
              <button
                key={p.id}
                onClick={() => openProcedure(p.id)}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
                  <StatusBadge status={p.status} size="sm" />
                </div>
                <div>
                  <p className="font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {p.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{p.summary}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DynamicIcon name={p.departmentIcon} className="h-3 w-3" style={{ color: p.departmentColor }} />
                    {p.departmentName}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Updated {formatRelative(p.updatedAt)}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Review now <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Ack queue */}
      <section className="space-y-4">
        <SectionHeader
          title="Acknowledgments due"
          description="Published procedures requiring your read-back"
          icon={<CircleAlert className="h-4 w-4" />}
        />
        {aLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="h-3 w-1/3 rounded bg-muted shimmer" />
                <div className="h-4 w-2/3 rounded bg-muted shimmer" />
              </div>
            ))}
          </div>
        ) : ackList.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="All caught up"
            description="You've acknowledged every procedure required of you."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ackList.map((p: any) => (
              <ProcedureCard key={p.id} proc={p} onOpen={openProcedure} layout="grid" />
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
}
