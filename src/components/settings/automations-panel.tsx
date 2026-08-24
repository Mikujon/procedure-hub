"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Zap, ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { CreateAutomationDialog } from "@/components/settings/create-automation-dialog";
import { cn } from "@/lib/utils";

interface AutomationRuleRow {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  triggerType: string;
  actionType: string;
  createdBy: { name: string };
  _count: { runs: number };
}

const TRIGGER_LABEL: Record<string, string> = {
  PROCEDURE_STATUS_ENTERED: "Cambio di stato",
  REVIEW_DATE_DUE: "Data di revisione",
  ACK_CAMPAIGN_AGE: "Età campagna conferma lettura",
  ACK_CAMPAIGN_COMPLETED: "Lettura confermata al 100%",
  COMMENT_ADDED: "Nuovo commento",
};
const ACTION_LABEL: Record<string, string> = {
  SEND_NOTIFICATION: "Invia notifica",
  CHANGE_PROCEDURE_STATUS: "Archivia",
  SEND_WEBHOOK: "Chiama webhook",
};

/** Client half of /admin/automations — list + toggle + delete + entry point for CreateAutomationDialog. */
export function AutomationsPanel({ rules }: { rules: AutomationRuleRow[] }) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function toggle(rule: AutomationRuleRow) {
    setBusyId(rule.id);
    await fetch(`/api/admin/automations/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !rule.isEnabled }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function remove(rule: AutomationRuleRow) {
    if (!confirm(`Eliminare la regola "${rule.name}"?`)) return;
    setBusyId(rule.id);
    await fetch(`/api/admin/automations/${rule.id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">{rules.length} regola/e</p>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" /> Nuova regola
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nessuna automazione ancora — crea la prima per notificare o archiviare procedure automaticamente.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rules.map((rule, i) => (
            <li key={rule.id} className="opacity-0 animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}>
              <div className="flex items-center gap-3 px-5 py-3">
                <button
                  onClick={() => setExpandedId((id) => (id === rule.id ? null : rule.id))}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Zap className={`h-4 w-4 shrink-0 ${rule.isEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{rule.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {TRIGGER_LABEL[rule.triggerType] ?? rule.triggerType} → {ACTION_LABEL[rule.actionType] ?? rule.actionType} ·{" "}
                      {rule._count.runs} esecuzione/i · creata da {rule.createdBy.name}
                    </p>
                  </div>
                  <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expandedId === rule.id && "rotate-180")} />
                </button>
                <button
                  onClick={() => toggle(rule)}
                  disabled={busyId === rule.id}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    rule.isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {rule.isEnabled ? "Attiva" : "Disattivata"}
                </button>
                <button
                  onClick={() => remove(rule)}
                  disabled={busyId === rule.id}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {expandedId === rule.id && <RunHistory ruleId={rule.id} />}
            </li>
          ))}
        </ul>
      )}

      {showDialog && (
        <CreateAutomationDialog onClose={() => setShowDialog(false)} onCreated={() => router.refresh()} />
      )}
    </div>
  );
}

interface RunRow {
  id: string;
  entityType: string;
  status: string;
  error: string | null;
  firedAt: string;
  procedure: { id: string; title: string; code: string } | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "adesso";
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24);
  return `${d} g fa`;
}

/** Lazily-loaded run history for one rule (3.1) — the data already existed in AutomationRun, only `_count.runs` was ever shown before. */
function RunHistory({ ruleId }: { ruleId: string }) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/automations/${ruleId}/runs`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `Errore (${r.status})`);
        setRuns(data.runs);
      })
      .catch((e) => setError(e.message ?? "Errore imprevisto"));
  }, [ruleId]);

  return (
    <div className="border-t border-border bg-muted/20 px-5 py-3">
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : runs === null ? (
        <p className="text-xs text-muted-foreground">Caricamento…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nessuna esecuzione ancora.</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((run) => (
            <li key={run.id} className="flex items-start gap-2 text-xs">
              {run.status === "SUCCESS" ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stamp-green" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  {run.procedure ? `${run.procedure.code} — ${run.procedure.title}` : "Procedura non più disponibile"}
                  <span className="ml-2 text-muted-foreground">{timeAgo(run.firedAt)}</span>
                </p>
                {run.error && <p className="mt-0.5 text-destructive">{run.error}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
