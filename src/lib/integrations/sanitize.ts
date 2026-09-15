const SECRET_KEY_PATTERN = /token|secret|key|password/i;
export const MASKED_SECRET_VALUE = "••••••••";

/**
 * Fields that are secret-shaped by what they grant, not by their name —
 * SECRET_KEY_PATTERN misses both. `webhookUrl` is a bearer credential:
 * whoever holds a Slack/Google Chat/Teams incoming-webhook URL can post to
 * that channel as the integration, no further auth needed. `serviceAccountJson`
 * is a full Google Workspace service-account key (includes an RSA private
 * key) pasted in whole. Explicit exact-name list, not a broadened regex —
 * `siteId`/`drivePath`/`googleWorkspaceDomain` aren't secrets and a looser
 * pattern (e.g. matching "webhook") would risk catching a future
 * non-secret field of a similar name.
 *
 * Found while building /admin/integrations (9 set 2026 (2)): webhookUrl not
 * being masked was a known, previously-flagged inconsistency (see CLAUDE.md,
 * 25 ago 2026 (2)) — deemed out of scope for that day's task. serviceAccountJson
 * was an undocumented instance of the same gap. Both now squarely in scope:
 * this is the exact function guarding what that page's form fields display.
 */
const EXPLICIT_SECRET_FIELDS = new Set(["webhookUrl", "serviceAccountJson"]);

function isSecretField(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key) || EXPLICIT_SECRET_FIELDS.has(key);
}

/**
 * Never let a secret-shaped Integration.config field reach the browser —
 * shared by GET /api/admin/integrations and the /admin/integrations page
 * itself (a server component: whatever it passes to a client component
 * gets serialized into the page's own RSC payload, so masking has to
 * happen here, not just in how the client chooses to *display* a field).
 */
export function sanitizeIntegrationConfig(config: unknown): Record<string, any> {
  return Object.fromEntries(
    Object.entries((config as Record<string, any>) ?? {}).map(([k, v]) => [
      k,
      isSecretField(k) ? MASKED_SECRET_VALUE : v,
    ])
  );
}

/**
 * Merges an incoming config update into what's already stored, instead of
 * replacing it wholesale — and treats an incoming value that's exactly the
 * mask placeholder as "unchanged", never overwriting the real secret with
 * the literal masked string. This is what makes the admin UI safe to
 * pre-fill secret fields with the masked value and only send something
 * meaningful when the admin actually typed a new one: correct regardless
 * of what the client sends, not dependent on the client remembering not to
 * resubmit a field it never touched.
 */
export function mergeIntegrationConfig(existing: unknown, incoming: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...((existing as Record<string, any>) ?? {}) };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === MASKED_SECRET_VALUE) continue; // untouched secret placeholder — keep whatever (if anything) was already stored
    merged[k] = v;
  }
  return merged;
}
