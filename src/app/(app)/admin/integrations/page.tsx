import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeIntegrationConfig } from "@/lib/integrations/sanitize";
import { Plug } from "lucide-react";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";

/**
 * Real admin UI for configuring Slack/Google Chat/Microsoft Teams/SharePoint
 * — until now the only way to set any of these up was a direct
 * POST /api/admin/integrations call, despite /admin/settings promising a
 * link to exactly this (pointing at the KPI dashboard instead, which has
 * no such section — a gap found and documented across three earlier
 * sessions' work on those integrations, finally addressed here).
 *
 * Server component: fetches the tenant's Integration rows and sanitizes
 * `config` (sanitizeIntegrationConfig) *before* handing them to the client
 * component — whatever a server component passes to a client component is
 * serialized into the page's own RSC payload sent to the browser, so
 * masking has to happen here, not just in how IntegrationsPanel chooses to
 * *display* a field.
 */
export default async function AdminIntegrationsPage() {
  const session = await getServerSession(authOptions);
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  const globalRole = (session?.user as any)?.globalRole as string | undefined;
  if (!session?.user || globalRole !== "ADMIN") redirect("/dashboard");

  const rows = await prisma.integration.findMany({ where: { tenantId } });
  const integrations = rows.map((i) => ({
    type: i.type,
    isEnabled: i.isEnabled,
    config: sanitizeIntegrationConfig(i.config),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="opacity-0 animate-rise">
        <h1 className="font-display flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Plug className="h-7 w-7 text-primary" /> Integrazioni
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Notifiche verso Slack, Google Chat, Microsoft Teams e sincronizzazione documenti su SharePoint.
        </p>
      </div>

      <IntegrationsPanel initialIntegrations={integrations as any} />

      <div className="opacity-0 animate-rise rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground" style={{ animationDelay: "300ms" }}>
        <p className="font-medium text-foreground">Jira, ServiceNow, Freshdesk</p>
        <p className="mt-1">
          Non hanno una scheda qui — si collegano tramite una regola in{" "}
          <a href="/admin/automations" className="text-primary underline underline-offset-2">
            Automazioni
          </a>{" "}
          con azione &quot;Chiama un webhook&quot;, verso l&apos;incoming webhook nativo del provider (o la sua
          REST API diretta, con l&apos;header Authorization opzionale della stessa azione).
        </p>
        <p className="mt-3 font-medium text-foreground">SSO Microsoft Entra ID</p>
        <p className="mt-1">
          Si configura con variabili d&apos;ambiente a livello di deployment (<code>AZURE_AD_CLIENT_ID</code>,{" "}
          <code>AZURE_AD_CLIENT_SECRET</code>, <code>AZURE_AD_TENANT_ID</code>), non da qui — è un&apos;app
          registration Azure AD per l&apos;intero deployment, non per singolo tenant. Vedi{" "}
          <code>docs/SSO-ENTRA-ID-SETUP.md</code>.
        </p>
      </div>
    </div>
  );
}
