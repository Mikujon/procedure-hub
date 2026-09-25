"use client";

import * as React from "react";
import {
  Info,
  TriangleAlert,
  CircleCheck,
  CircleX,
  ListChecks,
  ListOrdered,
  Quote,
  SeparatorHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/types";

const CALLOUT_STYLE: Record<
  string,
  { icon: LucideIcon; className: string; iconClass: string }
> = {
  info: { icon: Info, className: "border-status-review/25 bg-status-review/5", iconClass: "text-status-review" },
  warning: { icon: TriangleAlert, className: "border-status-review/30 bg-status-review/10", iconClass: "text-status-review" },
  success: { icon: CircleCheck, className: "border-status-published/25 bg-status-published/5", iconClass: "text-status-published" },
  danger: { icon: CircleX, className: "border-destructive/30 bg-destructive/5", iconClass: "text-destructive" },
};

export function ContentRenderer({ blocks }: { blocks: Block[] }) {
  if (!blocks.length) {
    return (
      <p className="text-sm text-muted-foreground italic">
        This procedure has no content yet.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      if (block.level === 1)
        return (
          <h1 className="font-display text-2xl font-medium tracking-tight text-foreground scroll-mt-24">
            {block.text}
          </h1>
        );
      if (block.level === 2)
        return (
          <h2 className="font-display text-lg font-medium tracking-tight text-foreground scroll-mt-24 mt-2">
            {block.text}
          </h2>
        );
      return (
        <h3 className="text-base font-semibold text-foreground scroll-mt-24">
          {block.text}
        </h3>
      );
    }
    case "paragraph":
      return <p className="text-[15px] leading-relaxed text-foreground/90">{block.text}</p>;
    case "callout": {
      const s = CALLOUT_STYLE[block.variant] ?? CALLOUT_STYLE.info;
      const Icon = s.icon;
      return (
        <div className={cn("flex gap-3 rounded-lg border p-3.5", s.className)}>
          <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", s.iconClass)} aria-hidden />
          <div className="min-w-0">
            {block.title && (
              <p className="text-sm font-semibold text-foreground">{block.title}</p>
            )}
            <p className="text-sm leading-relaxed text-foreground/85">{block.text}</p>
          </div>
        </div>
      );
    }
    case "checklist":
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  item.checked
                    ? "border-status-published bg-status-published text-white"
                    : "border-border bg-background"
                )}
              >
                {item.checked && <CircleCheck className="h-3 w-3" />}
              </span>
              <span
                className={cn(
                  "text-[15px] leading-relaxed",
                  item.checked ? "text-muted-foreground line-through" : "text-foreground/90"
                )}
              >
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="relative space-y-3 pl-6">
          <span className="absolute left-2 top-1.5 bottom-1.5 w-px bg-border" aria-hidden />
          {block.items.map((item, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[18px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground ring-4 ring-background">
                {i + 1}
              </span>
              <span className="text-[15px] leading-relaxed text-foreground/90 inline-block ml-1">
                {item}
              </span>
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="border-l-2 border-primary/50 pl-4 py-1">
          <p className="font-display text-lg italic text-foreground/90">
            “{block.text}”
          </p>
          {block.cite && (
            <cite className="mt-1 block text-xs text-muted-foreground not-italic">
              — {block.cite}
            </cite>
          )}
        </blockquote>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/60 p-3.5">
          <code className="font-mono text-[13px] leading-relaxed text-foreground/90">
            {block.text}
          </code>
        </pre>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2 text-left font-semibold text-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-foreground/80 align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "divider":
      return (
        <div className="flex items-center gap-3 py-1 text-muted-foreground/40">
          <SeparatorHorizontal className="h-4 w-4" />
          <span className="h-px flex-1 bg-border" />
        </div>
      );
    case "definition":
      return (
        <dl className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {block.term}
          </dt>
          <dd className="text-[15px] leading-relaxed text-foreground/90">
            {block.definition}
          </dd>
        </dl>
      );
    default:
      return null;
  }
}

// Small icon legend used in the editor toolbar area (kept for reuse)
export function BlockTypeIcon({ type }: { type: Block["type"] }) {
  const map: Record<string, LucideIcon> = {
    heading: ListChecks,
    steps: ListOrdered,
    quote: Quote,
  };
  const Icon = map[type] ?? ListChecks;
  return <Icon className="h-4 w-4" aria-hidden />;
}
