"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, FileText, LayoutDashboard, Star, Bell, FilePlus2, ShieldCheck, Loader2, CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScanBar } from "@/components/ui/scan-bar";

interface Hit {
  id: string;
  title: string;
  code: string;
  departmentName: string;
  type: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home inizio" },
  { label: "Nuova procedura", href: "/procedures/new", icon: FilePlus2, keywords: "crea create new aggiungi" },
  { label: "Preferiti", href: "/favorites", icon: Star, keywords: "favorites salvate stelle" },
  { label: "Notifiche", href: "/notifications", icon: Bell, keywords: "notifications avvisi" },
  { label: "Amministrazione", href: "/admin", icon: ShieldCheck, keywords: "admin kpi dashboard" },
  { label: "Impostazioni", href: "/admin/settings", icon: ShieldCheck, keywords: "settings config team" },
];

export function CommandPalette({ trigger }: { trigger?: (open: () => void) => React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
  }, []);

  // Global Cmd/Ctrl+K to open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  // Debounced procedure search.
  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setHits(data.hits ?? []);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.filter((n) => (n.label + " " + n.keywords).toLowerCase().includes(q));
  }, [query]);

  // Flatten to a single navigable list: nav items first, then procedure hits.
  const rows = useMemo(
    () => [
      ...filteredNav.map((n) => ({ kind: "nav" as const, ...n })),
      ...hits.map((h) => ({ kind: "hit" as const, ...h })),
    ],
    [filteredNav, hits]
  );

  useEffect(() => setActive(0), [query, hits.length]);

  function go(row: (typeof rows)[number]) {
    close();
    router.push(row.kind === "nav" ? row.href : `/procedures/${row.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && rows[active]) { e.preventDefault(); go(rows[active]); }
  }

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full max-w-md items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Cerca o vai a…</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">
            ⌘K
          </kbd>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-foreground/30 px-4 pt-[12vh] backdrop-blur-sm" onClick={close}>
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center gap-3 overflow-hidden border-b border-border px-4">
              {loading && <ScanBar />}
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Cerca procedure o naviga…"
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {rows.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nessun risultato{query ? ` per “${query}”` : ""}.
                </p>
              ) : (
                <>
                  {filteredNav.length > 0 && (
                    <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Naviga
                    </p>
                  )}
                  {rows.map((row, i) => {
                    const isHitSectionStart = row.kind === "hit" && rows[i - 1]?.kind === "nav";
                    const Icon = row.kind === "nav" ? row.icon : FileText;
                    return (
                      <div key={row.kind === "nav" ? row.href : row.id}>
                        {isHitSectionStart && (
                          <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Procedure
                          </p>
                        )}
                        <button
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(row)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm",
                            i === active ? "bg-primary/10 text-foreground" : "text-foreground/90 hover:bg-muted"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 shrink-0", i === active ? "text-primary" : "text-muted-foreground")} />
                          <span className="min-w-0 flex-1 truncate">
                            {row.kind === "nav" ? row.label : row.title}
                            {row.kind === "hit" && (
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {row.code} · {row.departmentName}
                              </span>
                            )}
                          </span>
                          {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1">↑↓</kbd> naviga</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1">↵</kbd> apri</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1">esc</kbd> chiudi</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
