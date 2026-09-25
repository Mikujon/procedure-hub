"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ShieldCheck,
  Activity,
  FileText,
  Users,
  TrendingUp,
} from "lucide-react";
import { useBootstrap, useAuditLog } from "@/lib/hooks";
import { StatCard, SectionHeader } from "@/components/shared/layout-primitives";
import { STATUS_CONFIG, CRITICALITY_CONFIG, formatRelative } from "@/lib/domain";
import type { ProcedureStatus, Criticality } from "@/lib/types";
import { useTheme } from "next-themes";

const STATUS_HUES: Record<ProcedureStatus, string> = {
  DRAFT: "var(--status-draft)",
  IN_REVIEW: "var(--status-review)",
  PUBLISHED: "var(--status-published)",
  ARCHIVED: "var(--status-archived)",
};

export function AdminView() {
  const { data, isLoading } = useBootstrap();
  const { data: audit } = useAuditLog(15);
  const stats = data?.stats;
  const { resolvedTheme } = useTheme();
  const gridColor = resolvedTheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const tickColor = "var(--muted-foreground)";

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-xl bg-muted/40 shimmer" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/40 shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const statusData = stats.byStatus.map((s: any) => ({
    name: STATUS_CONFIG[s.status as ProcedureStatus].label,
    value: s.count,
    color: STATUS_HUES[s.status as ProcedureStatus],
  }));
  const deptData = stats.byDepartment.map((d: any) => ({
    name: d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name,
    count: d.count,
    color: d.color,
  }));
  const critData = stats.byCriticality.map((c: any) => ({
    name: CRITICALITY_CONFIG[c.criticality as Criticality].label,
    value: c.count,
    color: CRITICALITY_CONFIG[c.criticality as Criticality].dot,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Admin console</h1>
          <p className="text-sm text-muted-foreground">
            Workspace health, distribution, and audit trail.
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total procedures"
          value={stats.totalProcedures}
          hint={`${stats.archived} archived`}
          icon={<FileText className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Published"
          value={stats.published}
          hint={`${Math.round((stats.published / Math.max(stats.totalProcedures, 1)) * 100)}% of total`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="In review"
          value={stats.inReview}
          hint="Awaiting approval"
          icon={<Activity className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Departments"
          value={stats.byDepartment.length}
          hint={`${stats.drafts} drafts in flight`}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status distribution */}
        <section className="rounded-xl border border-border bg-card p-5">
          <SectionHeader title="Status distribution" className="mb-4" />
          <div className="flex items-center gap-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {statusData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2">
              {statusData.map((s: any) => (
                <li key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 text-muted-foreground">{s.name}</span>
                  <span className="font-medium tabular-nums">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Criticality */}
        <section className="rounded-xl border border-border bg-card p-5">
          <SectionHeader title="By criticality" className="mb-4" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={critData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: tickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: tickColor }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {critData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Department breakdown */}
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          title="Procedures by department"
          className="mb-4"
          icon={<Users className="h-4 w-4" />}
        />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: tickColor }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: tickColor }}
                axisLine={false}
                tickLine={false}
                width={130}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {deptData.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Audit log */}
      <section className="space-y-4">
        <SectionHeader
          title="Audit trail"
          description="Every state-changing action, most recent first"
          icon={<Activity className="h-4 w-4" />}
        />
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {(audit ?? []).map((log: any) => {
              const cfg = AUDIT_ACTION_CONFIG[log.action] ?? { color: "text-muted-foreground", bg: "bg-muted" };
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors"
                >
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.color} ${cfg.bg}`}>
                    {log.action}
                  </span>
                  <span className="text-foreground truncate">{log.summary}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {log.userName ?? "System"} · {formatRelative(log.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </motion.div>
  );
}

const AUDIT_ACTION_CONFIG: Record<string, { color: string; bg: string }> = {
  CREATE: { color: "text-primary", bg: "bg-primary/10" },
  UPDATE: { color: "text-muted-foreground", bg: "bg-muted" },
  SUBMIT: { color: "text-status-review", bg: "bg-status-review/15" },
  APPROVE: { color: "text-status-published", bg: "bg-status-published/15" },
  REJECT: { color: "text-destructive", bg: "bg-destructive/10" },
  PUBLISH: { color: "text-status-published", bg: "bg-status-published/15" },
  ARCHIVE: { color: "text-status-archived", bg: "bg-status-archived/10" },
  ACK: { color: "text-primary", bg: "bg-primary/10" },
  FAVORITE: { color: "text-muted-foreground", bg: "bg-muted" },
};
