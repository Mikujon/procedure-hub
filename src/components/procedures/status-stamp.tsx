import { cn } from "@/lib/utils";

/**
 * Signature UI element for the whole app: workflow status rendered as a
 * document stamp (rotated border-box + letterspaced caps) instead of a
 * generic colored pill. It's meant to read the way a "APPROVED" ink stamp
 * on a physical document does — because that's literally the mental model
 * users bring from paper-based procedure binders.
 */

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  DRAFT: { label: "Draft", className: "border-muted-foreground/40 text-muted-foreground" },
  IN_REVIEW: { label: "In Review", className: "border-primary text-primary" },
  COMPLIANCE_APPROVAL: { label: "Compliance Review", className: "border-[hsl(var(--stamp-amber))] text-[hsl(var(--stamp-amber))]" },
  MANAGEMENT_APPROVAL: { label: "Management Review", className: "border-[hsl(var(--stamp-amber))] text-[hsl(var(--stamp-amber))]" },
  PUBLISHED: { label: "Published", className: "border-[hsl(var(--stamp-green))] text-[hsl(var(--stamp-green))]" },
  ARCHIVED: { label: "Archived", className: "border-muted-foreground/40 text-muted-foreground line-through" },
  REJECTED: { label: "Rejected", className: "border-destructive text-destructive" },
};

export function StatusStamp({ status, className }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  return (
    // key={status}: React remounts this element whenever the status prop
    // changes across re-renders of the same StatusStamp instance, which is
    // what replays the settle animation on an approve/reject/publish rather
    // than just once on first paint.
    <span
      key={status}
      className={cn(
        "inline-flex items-center rounded-sm border-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest",
        "font-mono select-none animate-pill-settle",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
