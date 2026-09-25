"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-xl font-medium tracking-tight text-foreground truncate">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  trend,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "warning" | "danger" | "success";
  trend?: { value: string; up?: boolean };
  onClick?: () => void;
  className?: string;
}) {
  const tones = {
    default: "",
    primary: "text-primary",
    warning: "text-status-review",
    danger: "text-destructive",
    success: "text-status-published",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all",
        onClick && "hover:border-primary/40 hover:shadow-[var(--shadow-soft)] cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span className={cn("transition-transform group-hover:scale-110", tones[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn("font-display text-3xl font-medium tabular-nums tracking-tight", tones[tone])}>
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              trend.up ? "text-status-published" : "text-muted-foreground"
            )}
          >
            {trend.up ? "▲" : "▼"} {trend.value}
          </span>
        )}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 space-y-3",
        className
      )}
    >
      <div className="h-4 w-1/3 rounded bg-muted shimmer" />
      <div className="h-3 w-2/3 rounded bg-muted shimmer" />
      <div className="h-3 w-1/2 rounded bg-muted shimmer" />
    </div>
  );
}
