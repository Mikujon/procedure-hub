"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, Video, MessagesSquare, Cloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type IntegrationRow = { type: string; isEnabled: boolean; config: Record<string, any> };

/**
 * The four integrations that actually have somewhere to save to (a real
 * Integration row something reads) — see the note under this panel on the
 * page for why Jira/ServiceNow/Freshdesk (unlocked via Automations'
 * SEND_WEBHOOK instead) and Entra ID SSO (a deployment-level env var, not
 * per-tenant) aren't cards here.
 *
 * Every field pre-fills from `initialIntegrations` — secret-shaped ones
 * (webhookUrl, botToken, signingSecret, serviceAccountJson, clientSecret)
 * arrive already masked as "••••••••" by the server component (never the
 * real value). Saving a field still showing that placeholder is what tells
 * POST /api/admin/integrations to leave the stored value alone
 * (mergeIntegrationConfig, lib/integrations/sanitize.ts) — the admin only
 * needs to touch a secret field when actually changing it.
 */
export function IntegrationsPanel({ initialIntegrations }: { initialIntegrations: IntegrationRow[] }) {
  const byType = new Map(initialIntegrations.map((i) => [i.type, i]));

  return (
    <div className="space-y-4">
      <SlackCard initial={byType.get("SLACK")} />
      <GoogleChatCard initial={byType.get("GOOGLE_CHAT")} />
      <TeamsCard initial={byType.get("MICROSOFT_TEAMS")} />
      <SharePointCard initial={byType.get("SHAREPOINT")} />
    </div>
  );
}

async function saveIntegration(type: string, isEnabled: boolean, config: Record<string, any>) {
  const res = await fetch("/api/admin/integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, isEnabled, config }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.formErrors?.join(", ") ?? data.error ?? `Errore (${res.status})`);
  return data.integration as IntegrationRow;
}

function IntegrationCard({
  icon: Icon,
  name,
  description,
  isEnabled,
  onToggle,
  saving,
  children,
  onSave,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  description: string;
  isEnabled: boolean;
  onToggle: (v: boolean) => void;
  saving: boolean;
  children: React.ReactNode;
  onSave: () => void;
}) {
  return (
    <Card className="opacity-0 animate-rise">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border py-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-primary" />
          <div>
            <CardTitle className="font-display text-sm font-semibold">{name}</CardTitle>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={isEnabled} onCheckedChange={onToggle} disabled={saving} />
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {children}
        <div className="flex justify-end">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Salva
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

const fieldClass = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

function ModeToggle({ mode, onChange }: { mode: "webhook" | "bot"; onChange: (m: "webhook" | "bot") => void }) {
  return (
    <div>
      <label className={labelClass}>Modalità</label>
      <select value={mode} onChange={(e) => onChange(e.target.value as "webhook" | "bot")} className={fieldClass}>
        <option value="webhook">Incoming webhook (un canale unico per il tenant)</option>
        <option value="bot">Bot con DM personalizzate (per utente)</option>
      </select>
    </div>
  );
}

function SlackCard({ initial }: { initial?: IntegrationRow }) {
  const cfg = initial?.config ?? {};
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? false);
  const [mode, setMode] = useState<"webhook" | "bot">(cfg.mode === "bot" ? "bot" : "webhook");
  const [webhookUrl, setWebhookUrl] = useState(cfg.webhookUrl ?? "");
  const [botToken, setBotToken] = useState(cfg.botToken ?? "");
  const [signingSecret, setSigningSecret] = useState(cfg.signingSecret ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const config = mode === "webhook" ? { mode, webhookUrl: webhookUrl.trim() } : { mode, botToken, signingSecret };
      await saveIntegration("SLACK", isEnabled, config);
      toast.success("Slack salvato");
    } catch (e: any) {
      toast.error(e.message ?? "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IntegrationCard
      icon={MessageSquare}
      name="Slack"
      description="Notifiche verso un canale (webhook) o DM personalizzate (bot, richiede la registrazione dell'app su Slack)"
      isEnabled={isEnabled}
      onToggle={setIsEnabled}
      saving={saving}
      onSave={save}
    >
      <ModeToggle mode={mode} onChange={setMode} />
      {mode === "webhook" ? (
        <div>
          <label className={labelClass}>Incoming Webhook URL</label>
          <input
            type="password"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className={fieldClass}
          />
        </div>
      ) : (
        <>
          <div>
            <label className={labelClass}>Bot Token</label>
            <input type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="xoxb-..." className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Signing Secret</label>
            <input type="password" value={signingSecret} onChange={(e) => setSigningSecret(e.target.value)} className={fieldClass} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Richiede un&apos;app Slack registrata su api.slack.com/apps con i permessi <code>chat:write</code> — vedi
            CLAUDE.md, Roadmap #2.
          </p>
        </>
      )}
    </IntegrationCard>
  );
}

function GoogleChatCard({ initial }: { initial?: IntegrationRow }) {
  const cfg = initial?.config ?? {};
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? false);
  const [mode, setMode] = useState<"webhook" | "bot">(cfg.mode === "bot" ? "bot" : "webhook");
  const [webhookUrl, setWebhookUrl] = useState(cfg.webhookUrl ?? "");
  const [serviceAccountJson, setServiceAccountJson] = useState(cfg.serviceAccountJson ?? "");
  const [googleWorkspaceDomain, setGoogleWorkspaceDomain] = useState(cfg.googleWorkspaceDomain ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const config =
        mode === "webhook"
          ? { mode, webhookUrl: webhookUrl.trim() }
          : { mode, serviceAccountJson, googleWorkspaceDomain: googleWorkspaceDomain.trim() };
      await saveIntegration("GOOGLE_CHAT", isEnabled, config);
      toast.success("Google Chat salvato");
    } catch (e: any) {
      toast.error(e.message ?? "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IntegrationCard
      icon={Video}
      name="Google Chat"
      description="Notifiche verso uno spazio (webhook) o DM personalizzate (bot, richiede un service account Workspace)"
      isEnabled={isEnabled}
      onToggle={setIsEnabled}
      saving={saving}
      onSave={save}
    >
      <ModeToggle mode={mode} onChange={setMode} />
      {mode === "webhook" ? (
        <div>
          <label className={labelClass}>Webhook URL</label>
          <input
            type="password"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=..."
            className={fieldClass}
          />
        </div>
      ) : (
        <>
          <div>
            <label className={labelClass}>Service Account JSON</label>
            <textarea
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              rows={3}
              placeholder='{"client_email": "...", "private_key": "..."}'
              className={cn(fieldClass, "font-mono text-xs")}
            />
          </div>
          <div>
            <label className={labelClass}>Dominio Google Workspace</label>
            <input value={googleWorkspaceDomain} onChange={(e) => setGoogleWorkspaceDomain(e.target.value)} placeholder="acme.com" className={fieldClass} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            L&apos;invio del DM (ricerca/creazione dello spazio Chat) resta un TODO esplicito in{" "}
            <code>gchat.ts</code> finché non è verificabile contro un Workspace reale — vedi CLAUDE.md, Roadmap #3.
            Il token exchange è già reale.
          </p>
        </>
      )}
    </IntegrationCard>
  );
}

function TeamsCard({ initial }: { initial?: IntegrationRow }) {
  const cfg = initial?.config ?? {};
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? false);
  const [webhookUrl, setWebhookUrl] = useState(cfg.webhookUrl ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveIntegration("MICROSOFT_TEAMS", isEnabled, { mode: "webhook", webhookUrl: webhookUrl.trim() });
      toast.success("Microsoft Teams salvato");
    } catch (e: any) {
      toast.error(e.message ?? "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IntegrationCard
      icon={MessagesSquare}
      name="Microsoft Teams"
      description="Notifiche verso un canale, tramite l'app Workflows di Teams"
      isEnabled={isEnabled}
      onToggle={setIsEnabled}
      saving={saving}
      onSave={save}
    >
      <div>
        <label className={labelClass}>URL webhook Workflows</label>
        <input
          type="password"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://.../workflows/.../triggers/manual/paths/invoke?..."
          className={fieldClass}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          In Teams: app &quot;Workflows&quot; sul canale → modello &quot;Post to a channel when a webhook request is
          received&quot;. Microsoft ha ritirato i vecchi connector Incoming Webhook — solo modalità canale per ora,
          la DM diretta (bot) richiede un Azure Bot registrato, non ancora implementata.
        </p>
      </div>
    </IntegrationCard>
  );
}

function SharePointCard({ initial }: { initial?: IntegrationRow }) {
  const cfg = initial?.config ?? {};
  const [isEnabled, setIsEnabled] = useState(initial?.isEnabled ?? false);
  const [azureTenantId, setAzureTenantId] = useState(cfg.azureTenantId ?? "");
  const [clientId, setClientId] = useState(cfg.clientId ?? "");
  const [clientSecret, setClientSecret] = useState(cfg.clientSecret ?? "");
  const [siteId, setSiteId] = useState(cfg.siteId ?? "");
  const [drivePath, setDrivePath] = useState(cfg.drivePath ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveIntegration("SHAREPOINT", isEnabled, {
        azureTenantId: azureTenantId.trim(),
        clientId: clientId.trim(),
        clientSecret,
        siteId: siteId.trim(),
        drivePath: drivePath.trim(),
      });
      toast.success("SharePoint salvato");
    } catch (e: any) {
      toast.error(e.message ?? "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <IntegrationCard
      icon={Cloud}
      name="SharePoint"
      description="Sincronizzazione del PDF di una procedura pubblicata su una raccolta documenti — bottone “SharePoint” sulla pagina procedura"
      isEnabled={isEnabled}
      onToggle={setIsEnabled}
      saving={saving}
      onSave={save}
    >
      <div>
        <label className={labelClass}>Azure AD Tenant ID</label>
        <input value={azureTenantId} onChange={(e) => setAzureTenantId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>Client ID (app registration)</label>
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>Client Secret</label>
        <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>Site ID</label>
        <input value={siteId} onChange={(e) => setSiteId(e.target.value)} placeholder="contoso.sharepoint.com,site-collection-id,web-id" className={fieldClass} />
      </div>
      <div>
        <label className={labelClass}>Percorso cartella nella raccolta documenti</label>
        <input value={drivePath} onChange={(e) => setDrivePath(e.target.value)} placeholder="Procedure Hub/Legal" className={fieldClass} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Serve un&apos;app registration Azure AD dedicata (diversa da quella SSO) con il permesso applicativo{" "}
        <code>Sites.ReadWrite.All</code> e consenso admin — vedi CLAUDE.md, Roadmap #5.
      </p>
    </IntegrationCard>
  );
}
