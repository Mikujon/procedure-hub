"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search,
  FileText,
  CircleCheck,
  CircleAlert,
  Clock,
  Filter,
  BookOpen,
  Megaphone,
  ShieldCheck,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useBootstrap, useKbSearch } from "@/lib/hooks";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/layout-primitives";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/domain";

const TIPO_META: Record<string, { label: string; icon: any; color: string }> = {
  policy: { label: "Policy", icon: ShieldCheck, color: "#475569" },
  procedura: { label: "Procedura", icon: FileText, color: "#0d9488" },
  processo: { label: "Processo", icon: BookOpen, color: "#7c3aed" },
  comunicazione: { label: "Comunicazione", icon: Megaphone, color: "#be185d" },
  documento: { label: "Documento", icon: FileText, color: "#ca8a04" },
};

export function B7View() {
  const { openProcedure } = useAppStore();
  const { data: boot } = useBootstrap();
  const [q, setQ] = React.useState("");
  const [tipo, setTipo] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "toRead" | "read">("all");

  const { data, isLoading } = useKbSearch({
    q: q || undefined,
    tipo: tipo ?? undefined,
  });

  const docs = data?.results ?? [];
  const filtered = docs.filter((d: any) => {
    if (filter === "toRead") return d.obbligatorio && !d.acknowledged;
    if (filter === "read") return d.acknowledged;
    return true;
  });

  const stats = {
    total: docs.length,
    toRead: docs.filter((d: any) => d.obbligatorio && !d.acknowledged).length,
    read: docs.filter((d: any) => d.acknowledged).length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Le mie procedure</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documenti destinati a te per ruolo, sede e posizione nell'organigramma.
        </p>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            filter === "all" ? "border-primary/40 bg-primary/5" : "border-border hover:border-foreground/20"
          )}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tutti</p>
          <p className="mt-1 font-display text-2xl font-medium">{stats.total}</p>
        </button>
        <button
          onClick={() => setFilter("toRead")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            filter === "toRead" ? "border-status-review/40 bg-status-review/5" : "border-border hover:border-foreground/20"
          )}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Da leggere</p>
          <p className="mt-1 font-display text-2xl font-medium text-status-review">{stats.toRead}</p>
        </button>
        <button
          onClick={() => setFilter("read")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            filter === "read" ? "border-status-published/40 bg-status-published/5" : "border-border hover:border-foreground/20"
          )}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Confermati</p>
          <p className="mt-1 font-display text-2xl font-medium text-status-published">{stats.read}</p>
        </button>
      </div>

      {/* search + tipo filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca procedura, policy, comunicazione…"
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setTipo(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap",
              !tipo ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            )}
          >
            Tutti i tipi
          </button>
          {Object.entries(TIPO_META).map(([k, m]) => (
            <button
              key={k}
              onClick={() => setTipo(tipo === k ? null : k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap",
                tipo === k ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              )}
            >
              <m.icon className="h-3 w-3" />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* list */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-border bg-card shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Nessun documento"
          description={q ? "Nessun risultato per la tua ricerca." : "Non hai documenti assegnati al momento."}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((d: any) => {
            const meta = TIPO_META[d.tipo] ?? TIPO_META.documento;
            const Icon = meta.icon;
            const toRead = d.obbligatorio && !d.acknowledged;
            return (
              <button
                key={d.id}
                onClick={() => openProcedure(d.id)}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-[var(--shadow-soft)]",
                  toRead && "border-status-review/30 bg-status-review/5"
                )}
              >
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{d.code}</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{meta.label}</span>
                    {d.obbligatorio && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-status-review">
                        <CircleAlert className="h-3 w-3" /> obbligatorio
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-medium leading-snug group-hover:text-primary transition-colors">
                    {d.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{d.summary}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>v{d.version ?? "?"}</span>
                    <span>·</span>
                    <span>{d.lingua}</span>
                    <span>·</span>
                    <span>{formatRelative(d.updatedAt)}</span>
                  </div>
                </div>
                {d.acknowledged ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-published/10 px-2 py-0.5 text-[11px] font-medium text-status-published">
                    <CircleCheck className="h-3 w-3" /> confermato
                  </span>
                ) : d.obbligatorio ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-review/15 px-2 py-0.5 text-[11px] font-medium text-status-review">
                    <Clock className="h-3 w-3" /> da leggere
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
