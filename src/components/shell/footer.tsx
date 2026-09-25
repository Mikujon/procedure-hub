"use client";

import * as React from "react";
import { Command, Wifi, ShieldCheck } from "lucide-react";
import { useBootstrap } from "@/lib/hooks";
import { ROLE_LABELS } from "@/lib/domain";

export function Footer() {
  const { data } = useBootstrap();
  const role = data?.user?.role;
  const [time, setTime] = React.useState<string>("");

  React.useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="flex h-9 items-center justify-between gap-4 px-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-published opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-status-published" />
            </span>
            <span className="hidden sm:inline">Live</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5">
            <Wifi className="h-3 w-3" />
            Synced
          </span>
          {role && (
            <span className="hidden md:inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {time && <span className="tabular-nums hidden sm:inline">{time}</span>}
          <span className="hidden lg:inline-flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center gap-0.5 rounded border border-border bg-muted px-1 font-mono text-[10px]">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
            to search
          </span>
          <span className="text-muted-foreground/70">v2.0 · Atelier</span>
        </div>
      </div>
    </footer>
  );
}
