import { Integration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGoogleAccessToken } from "@/lib/integrations/google-auth";

/**
 * Google Chat integration — mirrors slack.ts with two modes:
 *
 *  1. Incoming Webhook (Google Chat "Webhook" attached to a Space):
 *     config = { mode: "webhook", webhookUrl: "https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=..." }
 *
 *  2. Chat App (bot) posting DMs to individual users via the Google Chat API:
 *     config = { mode: "bot", serviceAccountJson: "...", googleWorkspaceDomain: "acme.com" }
 *     Requires each User to have a linked GoogleChatUserIdentity, resolved
 *     via Google Workspace directory lookup during onboarding/SSO.
 *
 * As with Slack, failures are logged, never thrown — a broken integration
 * must not block the workflow or the in-app notification that already fired.
 */

interface SendGChatInput {
  integration: Integration;
  userId: string;
  title: string;
  body?: string;
  linkUrl?: string;
  /** Fase 4: pre-signed, per-recipient "Conferma lettura" URL — clicking it confirms without opening the app. */
  confirmUrl?: string;
}

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.procedurehub.com";

export async function sendGoogleChatNotification({ integration, userId, title, body, linkUrl, confirmUrl }: SendGChatInput) {
  const config = integration.config as Record<string, any>;
  const fullLink = linkUrl ? `${appBaseUrl}${linkUrl}` : undefined;

  const cardMessage = buildCardMessage(title, body, fullLink, confirmUrl);

  if (config.mode === "webhook" && config.webhookUrl) {
    await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cardMessage),
    }).catch((err) => console.error("[gchat] webhook post failed", err));
    return;
  }

  if (config.mode === "bot" && config.serviceAccountJson) {
    const identity = await prisma.googleChatUserIdentity.findUnique({ where: { userId } });
    if (!identity) return; // user hasn't been matched to a Google Chat identity yet

    // Token exchange is real (lib/integrations/google-auth.ts, standard
    // JWT-bearer flow) — what's still a TODO is the Chat API call itself:
    // finding-or-creating the DM space for identity.googleUserId and
    // POSTing the message into it. That contract needs verifying against
    // a real Workspace + Google's current Chat API docs before going
    // further (see the comment in google-auth.ts for why it's not guessed
    // at here) — pending the tenant's Workspace admin approving the Chat
    // app + granting domain-wide delegation.
    try {
      await getGoogleAccessToken(config.serviceAccountJson, ["https://www.googleapis.com/auth/chat.bot"]);
      console.info(
        `[gchat] access token acquired for tenant ${integration.tenantId}; ` +
          "TODO: find-or-create DM space for", identity.googleUserId, "and POST the message"
      );
    } catch (err) {
      console.error("[gchat] service-account token exchange failed", err);
    }
    return;
  }

  console.warn("[gchat] integration enabled but config incomplete for tenant", integration.tenantId);
}

function buildCardMessage(title: string, body?: string, linkUrl?: string, confirmUrl?: string) {
  const buttons: any[] = [];
  if (linkUrl) buttons.push({ text: "Open in Procedure Hub", onClick: { openLink: { url: linkUrl } } });
  // openLink, not a Chat App action callback: same reasoning as slack.ts —
  // a plain link click hits quick-confirm directly, no card-action
  // verification infrastructure needed for "confirm without opening the app".
  if (confirmUrl) buttons.push({ text: "✓ Conferma lettura", onClick: { openLink: { url: confirmUrl } } });

  return {
    text: undefined,
    cardsV2: [
      {
        cardId: "procedure-notification",
        card: {
          header: { title },
          sections: [
            {
              widgets: [
                ...(body ? [{ textParagraph: { text: body } }] : []),
                ...(buttons.length ? [{ buttonList: { buttons } }] : []),
              ],
            },
          ],
        },
      },
    ],
  };
}
