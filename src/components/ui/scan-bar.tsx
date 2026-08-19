import { cn } from "@/lib/utils";

/** Ambient sweep overlay for a search field while a query is in flight — pairs with a `relative overflow-hidden` container. */
export function ScanBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 animate-scan-sweep", className)}
      style={{
        background: "linear-gradient(100deg, transparent 40%, hsl(var(--primary) / 0.14) 50%, transparent 60%)",
        backgroundSize: "250% 100%",
      }}
    />
  );
}
