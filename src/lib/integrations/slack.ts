import { Integration } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Slack integration — two supported modes, chosen by what's stored in
 * Integration.config:
 *
 *  1. Incoming Webhook (simplest, tenant-wide channel):
 *     config = { mode: "webhook", webhookUrl: "https://hooks.slack.com/services/..." }
 *     Every notification posts to one fixed channel (e.g. #procedures-updates).
 *
 *  2. Slack App with bot token (per-user DMs):
 *     config = { mode: "bot", botToken: "xoxb-...", signingSecret: "..." }
 *     Requires each User to have a linked SlackUserIdentity (via OAuth,
 *     see /api/notifications/slack/oauth — not scaffolded, add when the
 *     Slack app is registered in api.slack.com/apps).
 *     Uses chat.postMessage to the user's Slack ID directly.
 *
 * Both paths degrade gracefully: if config is incomplete, the function logs
 * and returns rather than throwing, so a bad integration setup never breaks
 * the in-app notification flow that already succeeded.
 */

interface SendSlackInput {
  integration: Integration;
  userId: string;
  title: string;
  body?: string;
  linkUrl?: string;
  /** Fase 4: pre-signed, per-recipient "Conferma lettura" URL — clicking it confirms without opening the app. */
  confirmUrl?: string;
}

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.procedurehub.com";

export async function sendSlackNotification({ integration, userId, title, body, linkUrl, confirmUrl }: SendSlackInput) {
  const config = integration.config as Record<string, any>;
  const fullLink = linkUrl ? `${appBaseUrl}${linkUrl}` : undefined;

  const blocks = buildSlackBlocks(title, body, fullLink, confirmUrl);

  if (config.mode === "webhook" && config.webhookUrl) {
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    }).catch((err) => console.error("[slack] webhook post failed", err));
    return;
  }

  if (config.mode === "bot" && config.botToken) {
    const identity = await prisma.slackUserIdentity.findUnique({ where: { userId } });
    if (!identity) return; // user hasn't linked their Slack account yet

    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.botToken}`,
      },
      body: JSON.stringify({ channel: identity.slackUserId, blocks }),
    }).catch((err) => console.error("[slack] chat.postMessage failed", err));
    return;
  }

  console.warn("[slack] integration enabled but config incomplete for tenant", integration.tenantId);
}

function buildSlackBlocks(title: string, body?: string, linkUrl?: string, confirmUrl?: string) {
  const blocks: any[] = [
    { type: "section", text: { type: "mrkdwn", text: `*${title}*` } },
  ];
  if (body) blocks.push({ type: "section", text: { type: "mrkdwn", text: body } });
  if (linkUrl || confirmUrl) {
    blocks.push({
      type: "actions",
      elements: [
        ...(linkUrl ? [{ type: "button", text: { type: "plain_text", text: "Open in Procedure Hub" }, url: linkUrl }] : []),
        // A `url`-type button, not an interactive action_id one: clicking it
        // is a plain GET to quick-confirm, no Slack signing-secret / Request
        // URL callback needed to still get "confirm without opening the app".
        ...(confirmUrl
          ? [{ type: "button", style: "primary", text: { type: "plain_text", text: "✓ Conferma lettura" }, url: confirmUrl }]
          : []),
      ],
    });
  }
  return blocks;
}
