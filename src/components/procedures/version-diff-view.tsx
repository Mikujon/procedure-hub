import { cn } from "@/lib/utils";
import type { DiffBlockResult } from "@/lib/diff";

const STATUS_STYLES: Record<DiffBlockResult["status"], string> = {
  unchanged: "border-transparent",
  added: "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20",
  removed: "border-rose-500 bg-rose-50/60 dark:bg-rose-950/20",
  modified: "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20",
};

const STATUS_LABEL: Record<DiffBlockResult["status"], string | null> = {
  unchanged: null,
  added: "Aggiunto",
  removed: "Rimosso",
  modified: "Modificato",
};

export function VersionDiffView({ blocks }: { blocks: DiffBlockResult[] }) {
  if (blocks.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nessun contenuto in nessuna delle due versioni.</p>;
  }

  return (
    <div className="divide-y divide-border/60">
      {blocks.map((block, i) => (
        <div key={i} className={cn("border-l-2 py-2 pl-3 pr-2 text-sm leading-relaxed", STATUS_STYLES[block.status])}>
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{block.label}</span>
            {STATUS_LABEL[block.status] && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  block.status === "added" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                  block.status === "removed" && "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
                  block.status === "modified" && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                )}
              >
                {STATUS_LABEL[block.status]}
              </span>
            )}
          </div>

          {block.status === "modified" ? (
            <p className="whitespace-pre-wrap text-foreground">
              {block.wordDiff.map((part, j) =>
                part.added ? (
                  <mark key={j} className="rounded-sm bg-emerald-200/70 px-0.5 text-emerald-950 no-underline dark:bg-emerald-800/50 dark:text-emerald-100">
                    {part.value}
                  </mark>
                ) : part.removed ? (
                  <span key={j} className="rounded-sm bg-rose-200/70 px-0.5 text-rose-950 line-through dark:bg-rose-800/50 dark:text-rose-100">
                    {part.value}
                  </span>
                ) : (
                  <span key={j}>{part.value}</span>
                )
              )}
            </p>
          ) : (
            <p
              className={cn(
                "whitespace-pre-wrap",
                block.status === "unchanged" ? "text-muted-foreground" : "text-foreground",
                block.status === "removed" && "line-through"
              )}
            >
              {block.text || <span className="italic text-muted-foreground">(vuoto)</span>}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
