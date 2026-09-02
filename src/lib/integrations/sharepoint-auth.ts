/**
 * Microsoft Graph OAuth2 client-credentials flow (app-only, no signed-in
 * user) — standard, stable, and verifiable without a live tenant: POST
 * client_id/client_secret/scope to Azure AD's token endpoint, get back a
 * bearer access token good for calling Graph as the app itself. This is a
 * *different* Azure AD app registration from the one lib/auth.ts's
 * AzureADProvider uses for SSO: that one is a delegated-permissions app a
 * user signs into (AZURE_AD_CLIENT_ID/SECRET/TENANT_ID, one per whole
 * deployment); this one needs the application permission
 * `Sites.ReadWrite.All` granted with admin consent, configured per tenant
 * in Integration.config (SHAREPOINT) alongside the SharePoint site/drive to
 * write into — same reasoning as Slack/Google Chat's own per-tenant
 * Integration.config credentials.
 */

export interface SharePointCredentials {
  azureTenantId: string;
  clientId: string;
  clientSecret: string;
}

function tokenUrl(azureTenantId: string): string {
  return `https://login.microsoftonline.com/${azureTenantId}/oauth2/v2.0/token`;
}

export async function getSharePointAccessToken(creds: SharePointCredentials): Promise<string> {
  const res = await fetch(tokenUrl(creds.azureTenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`SharePoint/Graph token exchange failed: ${data.error_description ?? data.error ?? res.status}`);
  }
  return data.access_token as string;
}
