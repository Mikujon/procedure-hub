import { prisma } from "@/lib/prisma";
import { notifyEvent, resolveDefaultRecipients } from "@/lib/integrations/notify";
import { archiveProcedure } from "@/lib/workflow";
import { getSystemActorId } from "./system-actor";
import type { SendNotificationConfig, ChangeProcedureStatusConfig, SendWebhookConfig } from "./types";

export async function executeSendNotification(tenantId: string, procedureId: string, config: SendNotificationConfig) {
  let userIds: string[] | undefined;

  if (config.recipients === "OWNER") {
    const procedure = await prisma.procedure.findUniqueOrThrow({
      where: { id: procedureId },
      select: { ownerId: true, authorId: true },
    });
    userIds = [procedure.ownerId ?? procedure.authorId];
  } else if (config.recipients === "TENANT") {
    const recipients = await resolveDefaultRecipients(tenantId);
    userIds = recipients.map((r) => r.id);
  }
  // "DEPARTMENT": leave userIds undefined — notifyEvent's own
  // resolveDefaultRecipients(tenantId, procedureId) already does the
  // department-scoped fan-out, isCritical/requiresAck escalation included.

  await notifyEvent({
    tenantId,
    type: "AUTOMATION",
    procedureId,
    title: config.title,
    body: config.body,
    userIds,
  });
}

/**
 * v1 deliberately supports only ARCHIVED, not a general "advance status"
 * action: resolveNextStage() (lib/workflow/index.ts) already auto-publishes
 * a non-critical, non-compliance-tagged procedure after management
 * approval — the "approved and not critical -> publish" case is handled
 * there today, unconditionally. Letting a rule change status in parallel
 * would race that logic on the same transition and could let an unattended
 * rule bypass a compliance approval stage with no human decision behind
 * it. archiveProcedure() has no competing auto-advance logic, so it's safe
 * to expose; nothing else is, yet.
 */
export async function executeChangeProcedureStatus(
  tenantId: string,
  procedureId: string,
  config: ChangeProcedureStatusConfig
) {
  if (config.status !== "ARCHIVED") {
    throw new Error(`CHANGE_PROCEDURE_STATUS only supports ARCHIVED, got "${config.status}"`);
  }
  const actorId = await getSystemActorId(tenantId);
  // skipAutomations: an automation archiving a procedure must not re-fire
  // ARCHIVED-triggered rules — see the guard's own comment in
  // lib/workflow/index.ts for the loop this prevents.
  await archiveProcedure(procedureId, actorId, { skipAutomations: true });
}

/**
 * Generic outbound webhook (3.3) — same "plain fetch, no SDK" pattern as
 * lib/integrations/slack.ts's webhook mode, made reusable for whatever
 * incoming-webhook URL an admin pastes in (Teams, Jira, ServiceNow, a
 * custom endpoint...) instead of one adapter file per provider. Unlike
 * notify.ts's Slack/Google Chat fan-out, a failed request here throws
 * instead of being swallowed — the webhook call *is* the action, so its
 * failure must land in AutomationRun.status/error (surfaced in the 3.1 run
 * history), not disappear into a console.error no one is watching.
 */
export async function executeSendWebhook(_tenantId: string, procedureId: string, config: SendWebhookConfig) {
  const procedure = await prisma.procedure.findUniqueOrThrow({
    where: { id: procedureId },
    select: { id: true, title: true, code: true, status: true, department: { select: { name: true } } },
  });

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.procedurehub.com";

  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "procedure.automation",
      procedure: {
        id: procedure.id,
        code: procedure.code,
        title: procedure.title,
        status: procedure.status,
        department: procedure.department.name,
        url: `${appBaseUrl}/procedures/${procedure.id}`,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Il webhook ha risposto con stato ${res.status}`);
  }
}
