"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TRIGGER_OPTIONS = [
  { value: "PROCEDURE_STATUS_ENTERED", label: "Una procedura entra in uno stato" },
  { value: "REVIEW_DATE_DUE", label: "Arriva la data di revisione" },
  { value: "ACK_CAMPAIGN_AGE", label: "Una campagna di conferma lettura è aperta da N giorni" },
  { value: "ACK_CAMPAIGN_COMPLETED", label: "Una procedura è stata letta e confermata da tutti" },
  { value: "COMMENT_ADDED", label: "Viene aggiunto un commento a una procedura" },
];

const STATUS_OPTIONS = [
  { value: "IN_REVIEW", label: "In revisione" },
  { value: "COMPLIANCE_APPROVAL", label: "Approvazione compliance" },
  { value: "MANAGEMENT_APPROVAL", label: "Approvazione management" },
  { value: "PUBLISHED", label: "Pubblicata" },
  { value: "ARCHIVED", label: "Archiviata" },
  { value: "REJECTED", label: "Rifiutata" },
];

const ACTION_OPTIONS = [
  { value: "SEND_NOTIFICATION", label: "Invia una notifica" },
  { value: "CHANGE_PROCEDURE_STATUS", label: "Archivia la procedura" },
  { value: "SEND_WEBHOOK", label: "Chiama un webhook (Teams, Jira, ServiceNow, ...)" },
];

const RECIPIENT_OPTIONS = [
  { value: "OWNER", label: "Il proprietario della procedura" },
  { value: "DEPARTMENT", label: "Il dipartimento (tutta l'azienda se critica/richiede conferma)" },
  { value: "TENANT", label: "Tutta l'azienda" },
];

/** Admin-only "Nuova regola" form — the UI for POST /api/admin/automations. Deliberately not a visual rule builder: fixed trigger/condition/action shapes, matching the v1 scope in the redesign/automations plan. */
export function CreateAutomationDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("PROCEDURE_STATUS_ENTERED");
  const [status, setStatus] = useState("PUBLISHED");
  const [days, setDays] = useState(14);
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [requiredTags, setRequiredTags] = useState<string[]>([]);
  const [actionType, setActionType] = useState("SEND_NOTIFICATION");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState("OWNER");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookAuthHeader, setWebhookAuthHeader] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((data) => setTags(data.tags ?? []))
      .catch(() => setTags([]));
  }, []);

  function toggleTag(name: string) {
    setRequiredTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  }

  async function submit() {
    if (!name.trim() || (actionType === "SEND_NOTIFICATION" && !title.trim())) {
      setError("Nome regola (e titolo notifica, se applicabile) sono obbligatori.");
      return;
    }
    if (actionType === "SEND_WEBHOOK" && !isValidHttpUrl(webhookUrl)) {
      setError("Inserisci un URL webhook valido (https://...).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const triggerConfig =
        triggerType === "PROCEDURE_STATUS_ENTERED"
          ? { status }
          : triggerType === "ACK_CAMPAIGN_AGE"
            ? { days }
            : {};
      const actionConfig =
        actionType === "SEND_NOTIFICATION"
          ? { title: title.trim(), body: body.trim() || undefined, recipients }
          : actionType === "SEND_WEBHOOK"
            ? { url: webhookUrl.trim(), authHeader: webhookAuthHeader.trim() || undefined }
            : { status: "ARCHIVED" };

      const conditions =
        onlyCritical || requiredTags.length > 0
          ? { ...(onlyCritical ? { isCriticalEquals: true } : {}), ...(requiredTags.length ? { tagNameIn: requiredTags } : {}) }
          : undefined;

      const res = await fetch("/api/admin/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          triggerType,
          triggerConfig,
          conditions,
          actionType,
          actionConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? `Errore (${res.status})`);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Nuova automazione</h2>
          <button onClick={onClose} type="button" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome regola</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Avvisa il DPO quando serve approvazione compliance"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Quando</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            >
              {TRIGGER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {triggerType === "PROCEDURE_STATUS_ENTERED" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Stato</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {triggerType === "ACK_CAMPAIGN_AGE" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Giorni dall'apertura della campagna</label>
              <input
                type="number"
                min={1}
                max={60}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={onlyCritical} onChange={(e) => setOnlyCritical(e.target.checked)} />
            Solo per procedure critiche
          </label>

          {tags.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Solo se ha uno di questi tag (opzionale)</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.name)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      requiredTags.includes(t.name)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Azione</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {actionType === "SEND_NOTIFICATION" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Titolo notifica</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Messaggio (opzionale)</label>
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Destinatari</label>
                <select
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                >
                  {RECIPIENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {actionType === "SEND_WEBHOOK" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">URL webhook</label>
              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Riceve un POST JSON con i dati della procedura — l'URL di un incoming webhook di Teams, Jira,
                ServiceNow o un endpoint personalizzato.
              </p>
            </div>
          )}

          {actionType === "SEND_WEBHOOK" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Header Authorization (opzionale)
              </label>
              <input
                type="password"
                value={webhookAuthHeader}
                onChange={(e) => setWebhookAuthHeader(e.target.value)}
                placeholder="Bearer ... oppure Basic ..."
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Serve solo per chiamare direttamente le API di Jira/ServiceNow/Freshdesk (richiedono
                autenticazione su ogni richiesta) — un incoming webhook di Teams/Slack/Jira Automation porta
                già il proprio segreto nell&apos;URL e non ne ha bisogno.
              </p>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} type="button" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
            Annulla
          </button>
          <button
            onClick={submit}
            type="button"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Crea regola
          </button>
        </div>
      </div>
    </div>
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
