import { db } from "@/lib/db";
import { createHmac } from "crypto";

/**
 * Fire webhooks for a given event.
 * Finds all active WebhookConfig rows for the tenant whose events list
 * includes the event name (or "*" for all events), then POSTs the payload
 * to each URL with an HMAC-SHA256 signature.
 *
 * Events:
 *  - kb.document.published    — a new version was published
 *  - kb.document.acknowledged — someone took read confirmation
 *  - kb.document.submitted    — submitted for review
 *  - kb.document.approved     — approved by compliance
 *  - kb.document.rejected     — rejected by compliance
 */
export async function fireWebhook(tenantId: string, event: string, payload: Record<string, unknown>) {
  try {
    const configs = await db.webhookConfig.findMany({
      where: { tenantId, active: true },
    });

    if (configs.length === 0) return;

    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    const promises = configs.map(async (config) => {
      try {
        const events: string[] = JSON.parse(config.events || "[]");
        if (!events.includes(event) && !events.includes("*")) return;

        const signature = createHmac("sha256", config.secret || "default-secret")
          .update(body)
          .digest("hex");

        const res = await fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Webhook-Signature": `sha256=${signature}`,
            "X-Webhook-Timestamp": Date.now().toString(),
          },
          body,
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!res.ok) {
          console.error(`[webhook] ${event} → ${config.url} returned ${res.status}`);
        }
      } catch (e: any) {
        console.error(`[webhook] failed ${event} → ${config.url}:`, e?.message ?? e);
      }
    });

    await Promise.allSettled(promises);
  } catch (e) {
    console.error("[webhook] fireWebhook error:", e);
  }
}

export const WEBHOOK_EVENTS = [
  { value: "kb.document.published", label: "Documento pubblicato" },
  { value: "kb.document.acknowledged", label: "Presa visione" },
  { value: "kb.document.submitted", label: "Inviato per revisione" },
  { value: "kb.document.approved", label: "Approvato" },
  { value: "kb.document.rejected", label: "Rifiutato" },
  { value: "*", label: "Tutti gli eventi" },
];
