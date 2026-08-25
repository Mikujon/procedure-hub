import { Integration } from "@prisma/client";

/**
 * Microsoft Teams integration — mirrors slack.ts/gchat.ts's shape, but only
 * one mode is real so far:
 *
 *  1. Workflow webhook (tenant-wide channel, the only mode implemented):
 *     config = { mode: "webhook", webhookUrl: "https://.../workflows/.../triggers/manual/paths/invoke?..." }
 *     Microsoft retired the old Office 365 Connector "Incoming Webhook" for
 *     Teams (all connectors, tenant-wide, completed by 2025) — the
 *     replacement is the "Workflows" app: a user adds it to a channel,
 *     picks the "Post to a channel when a webhook request is received"
 *     template, and gets back an HTTP-trigger URL that expects the request
 *     body below. Same POST-a-URL shape as a classic incoming webhook from
 *     this codebase's point of view, just a different payload envelope
 *     (Adaptive Card wrapped in `attachments`, not the retired MessageCard
 *     format).
 *
 *  2. Bot Framework DM (per-user, not implemented — TODO): proactively
 *     messaging a specific person in Teams (not a channel) requires a
 *     registered Azure Bot resource with the Teams channel enabled, plus a
 *     stored conversation reference per user (obtained the first time that
 *     user messages the bot, or via the Graph `chats` API once the bot is
 *     installed for them) — there is no equivalent of Slack's "one bot
 *     token + a Slack user id" here. Left as a TODO for the same reason
 *     gchat.ts's bot-mode DM is: it needs verifying against a real tenant's
 *     Azure Bot + Teams admin setup before writing code that can only be
 *     guessed at.
 *
 * Both paths degrade gracefully: if config is incomplete, the function logs
 * and returns rather than throwing, so a bad integration setup never breaks
 * the in-app notification flow that already succeeded.
 */

interface SendTeamsInput {
  integration: Integration;
  userId: string;
  title: string;
  body?: string;
  linkUrl?: string;
  /** Fase 4: pre-signed, per-recipient "Conferma lettura" URL — clicking it confirms without opening the app. */
  confirmUrl?: string;
}

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.procedurehub.com";

export async function sendTeamsNotification({ integration, userId, title, body, linkUrl, confirmUrl }: SendTeamsInput) {
  const config = integration.config as Record<string, any>;
  const fullLink = linkUrl ? `${appBaseUrl}${linkUrl}` : undefined;

  if (config.mode === "webhook" && config.webhookUrl) {
    const message = buildAdaptiveCardMessage(title, body, fullLink, confirmUrl);
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    }).catch((err) => console.error("[teams] webhook post failed", err));
    return;
  }

  if (config.mode === "bot") {
    // See the module comment: needs a registered Azure Bot + a stored
    // per-user conversation reference, neither of which exist yet. Log
    // rather than silently drop, so a tenant that flips this mode on
    // without realizing it's unimplemented has something to grep for.
    console.info(`[teams] bot-mode DM requested for user ${userId} in tenant ${integration.tenantId}; not implemented yet`);
    return;
  }

  console.warn("[teams] integration enabled but config incomplete for tenant", integration.tenantId);
}

/**
 * The request body a Teams "Workflows" webhook trigger expects: a `message`
 * activity carrying one Adaptive Card attachment. Same envelope Power
 * Automate's built-in "Post to a channel when a webhook request is
 * received" template documents.
 */
function buildAdaptiveCardMessage(title: string, body?: string, linkUrl?: string, confirmUrl?: string) {
  const actions: any[] = [];
  if (linkUrl) actions.push({ type: "Action.OpenUrl", title: "Apri in Procedure Hub", url: linkUrl });
  if (confirmUrl) actions.push({ type: "Action.OpenUrl", title: "✓ Conferma lettura", url: confirmUrl });

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: title, weight: "Bolder", size: "Medium", wrap: true },
            ...(body ? [{ type: "TextBlock", text: body, wrap: true }] : []),
          ],
          ...(actions.length ? { actions } : {}),
        },
      },
    ],
  };
}
