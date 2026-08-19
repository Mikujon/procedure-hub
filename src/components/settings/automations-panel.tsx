"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Zap } from "lucide-react";
import { CreateAutomationDialog } from "@/components/settings/create-automation-dialog";

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
};
const ACTION_LABEL: Record<string, string> = {
  SEND_NOTIFICATION: "Invia notifica",
  CHANGE_PROCEDURE_STATUS: "Archivia",
};

/** Client half of /admin/automations — list + toggle + delete + entry point for CreateAutomationDialog. */
export function AutomationsPanel({ rules }: { rules: AutomationRuleRow[] }) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center gap-3 px-5 py-3">
              <Zap className={`h-4 w-4 shrink-0 ${rule.isEnabled ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{rule.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {TRIGGER_LABEL[rule.triggerType] ?? rule.triggerType} → {ACTION_LABEL[rule.actionType] ?? rule.actionType} ·{" "}
                  {rule._count.runs} esecuzione/i · creata da {rule.createdBy.name}
                </p>
              </div>
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
