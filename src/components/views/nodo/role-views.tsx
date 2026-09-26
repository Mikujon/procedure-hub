"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Users,
  Bell,
  History,
  Eye,
  Megaphone,
  Clock,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useKbSearch, useKbApprove, useKbRemind, useKbReadStatus } from "@/lib/hooks";
import { toast } from "sonner";
import { EmptyState, SectionHeader, StatCard } from "@/components/shared/layout-primitives";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatRelative, formatDate } from "@/lib/domain";
import { cn } from "@/lib/utils";

// ---- Compliance queue (Marco Rossi) -------------------------------------
export function ComplianceQueueView() {
  const { openProcedure } = useAppStore();
  const { data: allDocs } = useKbSearch({});
  const approve = useKbApprove();
  const pending = (allDocs ?? []).filter((d: any) => d.status === "in_review");

  const onApprove = (docId: string, decision: "approved" | "rejected") => {
    approve.mutate(
      { documentId: docId, decision },
      {
        onSuccess: (r: any) =>
          toast.success(decision === "approved" ? "Approvato" : "Rifiutato", {
            description: r.workflowComplete ? "Workflow completo" : "Prossimo step in attesa",
          }),
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Coda Compliance</h1>
          <p className="text-sm text-muted-foreground">Documenti in attesa di approvazione compliance.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="In attesa" value={pending.length} icon={<Clock className="h-4 w-4" />} tone="warning" />
        <StatCard label="Approvati oggi" value={0} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatCard label="Rifiutati" value={0} icon={<XCircle className="h-4 w-4" />} tone="danger" />
      </div>

      {pending.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Coda vuota" description="Nessun documento attende la tua approvazione." />
      ) : (
        <div className="space-y-2">
          {pending.map((d: any) => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => openProcedure(d.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{d.code}</span>
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.tipo}</span>
                  </div>
                  <p className="mt-0.5 font-medium leading-snug hover:text-primary transition-colors">{d.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{d.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <UserAvatar name={d.owner.name} color={d.owner.avatarColor} size="xs" />
                    {d.owner.name} · {formatRelative(d.updatedAt)}
                  </div>
                </button>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => onApprove(d.id, "approved")}
                    disabled={approve.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-status-published/30 bg-status-published/10 px-3 py-1.5 text-xs font-medium text-status-published hover:bg-status-published/20"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approva
                  </button>
                  <button
                    onClick={() => onApprove(d.id, "rejected")}
                    disabled={approve.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Rifiuta
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ---- LG-2: Policy & versioni (Legal Head) -------------------------------
export function Lg2View() {
  const { openProcedure } = useAppStore();
  const { data: allDocs } = useKbSearch({ tipo: "policy" });
  const docs = (allDocs ?? []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Policy e versioni</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pubblica policy e gestisci le versioni.</p>
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<History className="h-5 w-5" />} title="Nessuna policy" description="Nessuna policy pubblicata." />
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => (
            <button
              key={d.id}
              onClick={() => openProcedure(d.id)}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{d.code}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px]">v{d.version ?? "?"}</span>
                </div>
                <p className="mt-0.5 font-medium group-hover:text-primary transition-colors">{d.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{d.summary}</p>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                <p>{d.acknowledged ? "✓ confermato" : "in attesa"}</p>
                <p>{formatRelative(d.updatedAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ---- HR-8: Comunicazioni ufficiali (HR Head) ----------------------------
export function Hr8View() {
  const { openProcedure } = useAppStore();
  const { data: allDocs } = useKbSearch({ tipo: "comunicazione" });
  const docs = (allDocs ?? []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Comunicazioni ufficiali</h1>
        <p className="mt-1 text-sm text-muted-foreground">Comunicazioni destinate al personale.</p>
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-5 w-5" />} title="Nessuna comunicazione" description="Nessuna comunicazione pubblicata." />
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => (
            <button
              key={d.id}
              onClick={() => openProcedure(d.id)}
              className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Megaphone className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium group-hover:text-primary transition-colors">{d.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{d.summary}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(d.updatedAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ---- LG-4: Prese visione (Legal Head / Legal Manager) ------------------
export function Lg4View() {
  const { openProcedure } = useAppStore();
  const { data: allDocs } = useKbSearch({ obbligatorio: "1" });
  const docs = (allDocs ?? []);
  const [selected, setSelected] = React.useState<string | null>(null);
  const remind = useKbRemind();

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Prese visione</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dimostra chi ha letto cosa e quando. Sollecita i ritardatari.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* document list */}
        <div className="space-y-2">
          {docs.map((d: any) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                selected === d.id ? "border-primary/40 bg-primary/5" : "border-border hover:border-foreground/20"
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground">{d.code}</span>
              <span className="text-sm font-medium line-clamp-2">{d.title}</span>
            </button>
          ))}
        </div>

        {/* read status panel */}
        <div>
          {selected ? <ReadStatusDetail documentId={selected} onOpen={() => openProcedure(selected)} /> : (
            <EmptyState icon={<Eye className="h-5 w-5" />} title="Seleziona un documento" description="Scegli dalla lista per vedere chi ha preso visione." />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ReadStatusDetail({ documentId, onOpen }: { documentId: string; onOpen: () => void }) {
  const { data, isLoading } = useKbReadStatus(documentId, "all");
  const remind = useKbRemind();
  if (isLoading) return <div className="rounded-xl border border-border bg-card p-4 space-y-3"><div className="h-4 w-1/3 rounded bg-muted shimmer" /><div className="h-32 rounded bg-muted shimmer" /></div>;
  if (!data) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tasso di presa visione</p>
          <p className="font-display text-3xl font-medium">{data.stats.rate}%</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => remind.mutate({ documentId }, { onSuccess: (r: any) => toast.success(`${r.reminded} solleciti inviati`), onError: (e: any) => toast.error(e.message) })}
            disabled={remind.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Bell className="h-3.5 w-3.5" /> Sollecita
          </button>
          <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            <Eye className="h-3.5 w-3.5" /> Apri
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="font-display text-xl">{data.stats.total}</p>
          <p className="text-[11px] text-muted-foreground">destinatari</p>
        </div>
        <div className="rounded-lg bg-status-published/10 p-3">
          <p className="font-display text-xl text-status-published">{data.stats.acked}</p>
          <p className="text-[11px] text-muted-foreground">confermati</p>
        </div>
        <div className="rounded-lg bg-status-review/10 p-3">
          <p className="font-display text-xl text-status-review">{data.stats.pending}</p>
          <p className="text-[11px] text-muted-foreground">in attesa</p>
        </div>
      </div>
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {data.recipients.map((r: any) => (
          <div key={r.userId} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar name={r.userName} color="#888" size="xs" />
              <div className="min-w-0">
                <p className="truncate">{r.userName}</p>
                <p className="text-[10px] text-muted-foreground">{r.userLocation} · {r.userRole}</p>
              </div>
            </div>
            {r.acknowledged ? (
              <div className="text-right text-[11px]">
                <p className="text-status-published">✓ confermato</p>
                <p className="text-muted-foreground">{formatDate(r.acknowledgedAt)}</p>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
