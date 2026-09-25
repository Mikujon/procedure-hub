"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG } from "@/lib/domain";
import { WORKFLOW_STAGES } from "@/lib/domain";
import type { ProcedureStatus } from "@/lib/types";

export function WorkflowTimeline({
  current,
  onTransition,
  canTransition = false,
}: {
  current: ProcedureStatus;
  onTransition?: (target: ProcedureStatus) => void;
  canTransition?: boolean;
}) {
  const currentIndex = WORKFLOW_STAGES.indexOf(current);

  const allowedTargets: Record<ProcedureStatus, ProcedureStatus[]> = {
    DRAFT: ["IN_REVIEW"],
    IN_REVIEW: ["PUBLISHED", "DRAFT"],
    PUBLISHED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  const targets = allowedTargets[current];

  return (
    <div className="space-y-4">
      {/* Stage rail */}
      <div className="flex items-center">
        {WORKFLOW_STAGES.map((stage, i) => {
          const cfg = STATUS_CONFIG[stage];
          const Icon = cfg.icon;
          const done = i < currentIndex;
          const active = i === currentIndex;
          const last = i === WORKFLOW_STAGES.length - 1;
          return (
            <React.Fragment key={stage}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                    active && "border-primary bg-primary text-primary-foreground",
                    done && "border-status-published bg-status-published/15 text-status-published",
                    !active && !done && "border-border bg-card text-muted-foreground"
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  {active && (
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      animate={{ boxShadow: "0 0 0 4px var(--ring)" }}
                      transition={{ duration: 1.4, repeat: Infinity, repeatType: "reverse" }}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium whitespace-nowrap",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {cfg.label}
                </span>
              </div>
              {!last && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                    i < currentIndex ? "bg-status-published/40" : "bg-border"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Transition actions */}
      {canTransition && targets.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {targets.map((t) => {
            const cfg = STATUS_CONFIG[t];
            const Icon = cfg.icon;
            const isReject = current === "IN_REVIEW" && t === "DRAFT";
            const isArchive = current === "PUBLISHED" && t === "ARCHIVED";
            return (
              <button
                key={t}
                onClick={() => onTransition?.(t)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all hover:shadow-[var(--shadow-soft)]",
                  isReject
                    ? "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                    : isArchive
                    ? "border-status-archived/30 bg-status-archived/5 text-status-archived hover:bg-status-archived/10"
                    : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                )}
              >
                {isReject ? <X className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                {isReject ? "Return to draft" : isArchive ? "Archive" : `Advance to ${cfg.label}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
