"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CircleCheck,
  Clock,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Users,
  Bell,
  FileText,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useKbDocument, useKbAck, useKbApprove, useKbReadStatus, useKbRemind } from "@/lib/hooks";
import { toast } from "sonner";
import { ContentRenderer } from "@/components/procedure/content-renderer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDate, formatRelative, roleLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<string, string> = {
  policy: "Policy", procedura: "Procedura", processo: "Processo",
  comunicazione: "Comunicazione", documento: "Documento",
};

export function KbDocumentView() {
  const { selectedProcedureId } = useAppStore();
  const { data: doc, isLoading } = useKbDocument(selectedProcedureId);
  const ack = useKbAck();
  const approve = useKbApprove();
  const remind = useKbRemind();
  const [showReadStatus, setShowReadStatus] = React.useState(false);

  const onAck = () => {
    if (!doc?.currentVersion) return;
    ack.mutate(
      { documentId: doc.id, versionId: doc.currentVersion.id },
      {
        onSuccess: () => toast.success("Presa visione registrata", { description: "Il tuo ack è immutabile e con valore legale." }),
        onError: (e: any) => toast.error(e.message ?? "Ack failed"),
      }
    );
  };

  const onApprove = (decision: "approved" | "rejected") => {
    approve.mutate(
      { documentId: doc.id, decision },
      {
        onSuccess: (res: any) =>
          toast.success(decision === "approved" ? "Approvato" : "Rifiutato", {
            description: res.workflowComplete ? "Workflow completo — pronto per pubblicazione" : undefined,
          }),
        onError: (e: any) => toast.error(e.message ?? "Approve failed"),
      }
    );
  };

  if (isLoading || !doc) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 rounded bg-muted shimmer" />
        <div className="h-24 rounded bg-muted shimmer" />
      </div>
    );
  }

  const toRead = doc.obbligatorio && !doc.acknowledged;
  const pendingApproval = doc.approvals.find((a: any) => a.status === "pending");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid gap-8 lg:grid-cols-[1fr_320px]"
    >
      <div className="min-w-0">
        {/* breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button onClick={() => useAppStore.getState().setView("b7")} className="hover:text-foreground">
            Le mie procedure
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="uppercase text-[11px] tracking-wide">{TIPO_LABEL[doc.tipo] ?? doc.tipo}</span>
        </nav>

        {/* header */}
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{doc.code}</span>
            {doc.obbligatorio && (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-review/15 px-2 py-0.5 text-[11px] font-medium text-status-review">
                <ShieldCheck className="h-3 w-3" /> obbligatorio
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px]">
              v{doc.currentVersion?.numero ?? "?"} · {doc.currentVersion?.lingua ?? "it"}
            </span>
            {doc.acknowledged ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-published/15 px-2 py-0.5 text-[11px] font-medium text-status-published">
                <CircleCheck className="h-3 w-3" /> confermato
              </span>
            ) : toRead ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-review/15 px-2 py-0.5 text-[11px] font-medium text-status-review">
                <Clock className="h-3 w-3" /> da leggere
              </span>
            ) : null}
          </div>

          <h1 className="font-display text-3xl sm:text-4xl font-medium tracking-tight">{doc.title}</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{doc.summary}</p>

          {/* action bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {doc.canAck && doc.currentVersion && (
              doc.acknowledged ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-status-published/30 bg-status-published/10 px-4 py-2 text-sm font-medium text-status-published">
                  <CircleCheck className="h-4 w-4" />
                  Confermato {doc.acknowledgedAt && `· ${formatDate(doc.acknowledgedAt)}`}
                </span>
              ) : (
                <button
                  onClick={onAck}
                  disabled={ack.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:shadow-[var(--shadow-soft)] hover:brightness-105 disabled:opacity-60"
                >
                  {ack.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}
                  Prendi visione (v{doc.currentVersion.numero})
                </button>
              )
            )}

            {/* compliance approval buttons */}
            {pendingApproval && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">In attesa di approvazione <b>{pendingApproval.role}</b>:</span>
                <button
                  onClick={() => onApprove("approved")}
                  disabled={approve.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-status-published/30 bg-status-published/10 px-3 py-2 text-sm font-medium text-status-published hover:bg-status-published/20"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approva
                </button>
                <button
                  onClick={() => onApprove("rejected")}
                  disabled={approve.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
                >
                  <XCircle className="h-4 w-4" /> Rifiuta
                </button>
              </div>
            )}

            {/* remind button (LG-4) */}
            {doc.status === "published" && (
              <button
                onClick={() => {
                  remind.mutate(
                    { documentId: doc.id },
                    { onSuccess: (r: any) => toast.success(`${r.reminded} sollecito/i inviati`), onError: (e: any) => toast.error(e.message) }
                  );
                }}
                disabled={remind.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-4 w-4" /> Sollecita
              </button>
            )}
          </div>
        </div>

        {/* content */}
        {doc.currentVersion?.testo && (
          <article className="mt-8 max-w-3xl">
            <ContentRenderer blocks={doc.currentVersion.testo} />
          </article>
        )}

        {/* workflow / approval history */}
        {doc.approvals.length > 0 && (
          <div className="mt-10 rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-medium">
              <History className="h-4 w-4" /> Workflow di approvazione
            </h2>
            <div className="mt-4 space-y-2">
              {doc.approvals.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex h-2 w-2 rounded-full",
                      a.status === "approved" ? "bg-status-published" : a.status === "rejected" ? "bg-destructive" : "bg-status-review"
                    )} />
                    <span className="font-medium capitalize">{a.role}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {a.user && <UserAvatar name={a.user.name} color={a.user.avatarColor} size="xs" />}
                    <span>{a.user?.name ?? "—"}</span>
                    <span>·</span>
                    <span>{a.decidedAt ? formatRelative(a.decidedAt) : "in attesa"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* sidebar */}
      <aside className="lg:sticky lg:top-20 lg:self-start space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dettagli</p>
          <dl className="space-y-2.5 text-sm">
            <Meta label="Tipo" value={TIPO_LABEL[doc.tipo] ?? doc.tipo} />
            <Meta label="Versione" value={`v${doc.currentVersion?.numero ?? "?"} (${doc.currentVersion?.lingua ?? "it"})`} />
            <Meta label="In vigore dal" value={doc.currentVersion?.inVigoreDal ? formatDate(doc.currentVersion.inVigoreDal) : "—"} />
            <Meta label="Approvata da" value={doc.currentVersion?.approvataIl ? formatDate(doc.currentVersion.approvataIl) : "—"} />
            <Meta label="Stato" value={doc.stato} />
            <Meta label="Ultimo aggiornamento" value={formatRelative(doc.updatedAt)} />
          </dl>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proprietario</p>
          </div>
          <div className="flex items-center gap-3">
            <UserAvatar name={doc.owner.name} color={doc.owner.avatarColor} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{doc.owner.name}</p>
              <p className="text-xs text-muted-foreground">Document owner</p>
            </div>
          </div>
        </div>

        {/* version history */}
        {doc.versions.length > 1 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Storico versioni</p>
            <div className="space-y-1">
              {doc.versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted/40">
                  <span className="font-mono">v{v.numero} · {v.lingua}</span>
                  <span className={cn("text-muted-foreground", v.isCurrent && "text-status-published font-medium")}>
                    {v.isCurrent ? "corrente" : formatRelative(v.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* destinations */}
        {doc.destinations.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destinazione</p>
            {doc.destinations.map((d: any, i: number) => (
              <div key={i} className="space-y-1 text-xs">
                <div className="text-muted-foreground">
                  Nodi: <span className="text-foreground font-mono">{d.nodeIds.length}</span>
                  {d.sedi.length > 0 && <span> · Sedi: {d.sedi.join(", ")}</span>}
                  {d.ruoli.length > 0 && <span> · Ruoli: {d.ruoli.join(", ")}</span>}
                  {d.lingue.length > 0 && <span> · Lingue: {d.lingue.join(", ")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* read status (LG-4 / TL) */}
        {doc.status === "published" && (
          <button
            onClick={() => setShowReadStatus((s) => !s)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" /> Stato prese visione
            </span>
            <ChevronRight className={cn("h-4 w-4 transition-transform", showReadStatus && "rotate-90")} />
          </button>
        )}
        {showReadStatus && <ReadStatusPanel documentId={doc.id} scope="team" />}
      </aside>
    </motion.div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function ReadStatusPanel({ documentId, scope }: { documentId: string; scope: "self" | "team" | "all" }) {
  const { data, isLoading } = useKbReadStatus(documentId, scope);
  if (isLoading) return <div className="rounded-xl border border-border bg-card p-4 shimmer h-32" />;
  if (!data) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Totale: <b className="text-foreground">{data.stats.total}</b></span>
        <span className="text-status-published">✓ {data.stats.acked}</span>
        <span className="text-status-review">in attesa: {data.stats.pending}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-status-published" style={{ width: `${data.stats.rate}%` }} />
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {data.recipients.map((r: any) => (
          <div key={r.userId} className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-muted/40">
            <span className="truncate">{r.userName}</span>
            {r.acknowledged ? (
              <span className="text-status-published inline-flex items-center gap-1">
                <CircleCheck className="h-3 w-3" /> {formatRelative(r.acknowledgedAt)}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
