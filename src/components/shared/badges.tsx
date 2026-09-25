"use client";

import { cn } from "@/lib/utils";
import { STATUS_CONFIG, CRITICALITY_CONFIG } from "@/lib/domain";
import type { ProcedureStatus, Criticality } from "@/lib/types";

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: ProcedureStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        cfg.color,
        cfg.bg,
        cfg.border,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {cfg.label}
    </span>
  );
}

export function CriticalityBadge({
  criticality,
  size = "md",
  className,
}: {
  criticality: Criticality;
  size?: "sm" | "md";
  className?: string;
}) {
  const cfg = CRITICALITY_CONFIG[criticality];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        cfg.color,
        cfg.bg,
        "border-current/15",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
      title={`${cfg.label} criticality`}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      {cfg.label}
    </span>
  );
}

export function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      {tag}
    </span>
  );
}
