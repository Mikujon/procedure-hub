import { prisma } from "@/lib/prisma";
import { notifyEvent, resolveDefaultRecipients } from "@/lib/integrations/notify";
import { archiveProcedure } from "@/lib/workflow";
import { getSystemActorId } from "./system-actor";
import type { SendNotificationConfig, ChangeProcedureStatusConfig, SendWebhookConfig, EscalateAckToManagersConfig } from "./types";

/**
 * Extra context only an ACK_CAMPAIGN_AGE-triggered rule can supply —
 * runAckCampaignAgeRule (engine.ts) computes this once per campaign
 * (who's still outstanding) and threads it through fireRule() to whichever
 * action actually needs it. Both SEND_NOTIFICATION's "ACK_OUTSTANDING"
 * recipient and ESCALATE_ACK_TO_MANAGERS depend on it; every other
 * trigger/action combination ignores it entirely.
 */
export interface AckEscalationContext {
  ackCampaignId: string;
  ackOutstandingUserIds: string[];
}

/**
 * The only placeholder SEND_NOTIFICATION's title/body support — a plain
 * substring replace, not a template engine. Added migrating
 * scripts/send-review-reminders.ts's per-procedure title (`"${title}" è in
 * scadenza di revisione`) onto this action: every existing SEND_NOTIFICATION
 * rule before this sent one fixed string regardless of which procedure
 * triggered it, fine for the announcement-style rules Track 3.1/3.2 were
 * built for ("Avvisa il DPO quando serve approvazione compliance" — one
 * event, the user opens it to see which procedure) but not for a
 * recurring reminder that fires across many different procedures, where
 * an undistinguishable title in the notification list defeats the point.
 */
const PROCEDURE_TITLE_PLACEHOLDER = "{{procedureTitle}}";

export async function executeSendNotification(
  tenantId: string,
  procedureId: string,
  config: SendNotificationConfig,
  context?: AckEscalationContext
) {
  let userIds: string[] | undefined;
  let procedureTitle: string | undefined;

  const needsProcedureTitle =
    config.title.includes(PROCEDURE_TITLE_PLACEHOLDER) || config.body?.includes(PROCEDURE_TITLE_PLACEHOLDER);

  if (config.recipients === "OWNER" || needsProcedureTitle) {
    const procedure = await prisma.procedure.findUniqueOrThrow({
      where: { id: procedureId },
      select: { ownerId: true, authorId: true, title: true },
    });
    if (config.recipients === "OWNER") userIds = [procedure.ownerId ?? procedure.authorId];
    procedureTitle = procedure.title;
  }
  if (config.recipients === "TENANT") {
    const recipients = await resolveDefaultRecipients(tenantId);
    userIds = recipients.map((r) => r.id);
  } else if (config.recipients === "ACK_OUTSTANDING") {
    // Only meaningful when fired from runAckCampaignAgeRule, which is the
    // only caller that ever supplies `context`. A rule misconfigured onto
    // some other trigger (e.g. PROCEDURE_STATUS_ENTERED) reaches here with
    // no context — warn and skip rather than notifying nobody silently or
    // throwing and failing the whole run for what's a config mistake, not
    // a runtime error (same permissiveness this codebase already gives an
    // incomplete Slack/Teams integration config, see slack.ts/teams.ts).
    if (!context?.ackOutstandingUserIds.length) {
      console.warn(
        `[automations] SEND_NOTIFICATION with recipients=ACK_OUTSTANDING fired for procedure ${procedureId} outside an ACK_CAMPAIGN_AGE trigger (or with nothing outstanding) — skipped`
      );
      return;
    }
    userIds = context.ackOutstandingUserIds;
  }
  // "DEPARTMENT": leave userIds undefined — notifyEvent's own
  // resolveDefaultRecipients(tenantId, procedureId) already does the
  // department-scoped fan-out, isCritical/requiresAck escalation included.

  const title = procedureTitle ? config.title.replaceAll(PROCEDURE_TITLE_PLACEHOLDER, procedureTitle) : config.title;
  const body = procedureTitle && config.body ? config.body.replaceAll(PROCEDURE_TITLE_PLACEHOLDER, procedureTitle) : config.body;

  await notifyEvent({
    tenantId,
    type: "AUTOMATION",
    procedureId,
    title,
    body,
    userIds,
    externalChannels: config.externalChannels,
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
 *
 * `config.authHeader`, when set, is sent verbatim as the Authorization
 * header — needed to call Jira/ServiceNow/Freshdesk's own REST APIs
 * directly (all three expect Basic or Bearer auth on every request, unlike
 * Teams/Slack/Jira-Automation incoming webhooks, which carry their secret
 * in the URL and need nothing here).
 */
export async function executeSendWebhook(_tenantId: string, procedureId: string, config: SendWebhookConfig) {
  const procedure = await prisma.procedure.findUniqueOrThrow({
    where: { id: procedureId },
    select: { id: true, title: true, code: true, status: true, department: { select: { name: true } } },
  });

  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.procedurehub.com";

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.authHeader ? { Authorization: config.authHeader } : {}),
    },
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

/**
 * Migrated from scripts/send-ack-reminders.ts's DAY_14 step. Not
 * expressible as SEND_NOTIFICATION: that action resolves one recipient
 * set and sends ONE notifyEvent() call, but this needs to group outstanding
 * users by *their own* manager (fallback: the procedure owner) and send
 * one distinct message per manager — a different shape of action, not
 * just a different recipient list, hence its own AutomationActionType
 * (allowed under architectural rule 7: that rule blocks a generic
 * "advance/publish status" action specifically, not new notification-
 * shaped ones).
 *
 * Silently does nothing if `context` is missing (misconfigured onto a
 * non-ACK_CAMPAIGN_AGE trigger) or nobody has a manager/owner to escalate
 * to — same warn-and-skip posture as ACK_OUTSTANDING above, not a thrown
 * error for what's a config mistake rather than a runtime failure.
 */
export async function executeEscalateAckToManagers(
  tenantId: string,
  procedureId: string,
  _config: EscalateAckToManagersConfig,
  context?: AckEscalationContext
) {
  if (!context?.ackOutstandingUserIds.length) {
    console.warn(
      `[automations] ESCALATE_ACK_TO_MANAGERS fired for procedure ${procedureId} outside an ACK_CAMPAIGN_AGE trigger (or with nothing outstanding) — skipped`
    );
    return;
  }

  const procedure = await prisma.procedure.findUniqueOrThrow({
    where: { id: procedureId },
    select: { title: true, ownerId: true },
  });

  const users = await prisma.user.findMany({
    where: { id: { in: context.ackOutstandingUserIds } },
    select: { id: true, name: true, managerId: true },
  });

  // managerId (or, absent that, the procedure owner) -> outstanding names
  // reporting to them — one grouped message per manager, not one nag per
  // outstanding person.
  const groups = new Map<string, string[]>();
  for (const user of users) {
    const escalateTo = user.managerId ?? procedure.ownerId;
    if (!escalateTo) continue; // no manager and no owner set — nothing to escalate to
    const names = groups.get(escalateTo) ?? [];
    names.push(user.name);
    groups.set(escalateTo, names);
  }

  for (const [managerId, names] of groups) {
    await notifyEvent({
      tenantId,
      type: "AUTOMATION",
      procedureId,
      title: `${names.length} persona/e del tuo team non ha/hanno ancora confermato la lettura di "${procedure.title}"`,
      body: names.join(", "),
      userIds: [managerId],
    });
  }
}
