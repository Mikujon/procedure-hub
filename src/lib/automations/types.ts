import { z } from "zod";

/**
 * Validated shapes for AutomationRule.triggerConfig / conditions /
 * actionConfig (all Prisma Json columns — same precedent as
 * Integration.config, validated here at the API boundary rather than in
 * the schema). The enum columns (triggerType/actionType) stay authoritative;
 * these configs hold only the type-specific extra fields, not a repeat of
 * the type itself.
 */

const DOCUMENT_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "COMPLIANCE_APPROVAL",
  "MANAGEMENT_APPROVAL",
  "PUBLISHED",
  "ARCHIVED",
  "REJECTED",
] as const;

export const procedureStatusEnteredConfigSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES),
});

export const reviewDateDueConfigSchema = z.object({}).strict();

export const ackCampaignAgeConfigSchema = z.object({
  days: z.number().int().min(1).max(60),
});

export const ackCampaignCompletedConfigSchema = z.object({}).strict();

/// Fires on every new Comment (top-level or reply) on any procedure —
/// same "history only, no dedup key" category as ACK_CAMPAIGN_COMPLETED,
/// see engine.ts's runCommentAddedAutomations.
export const commentAddedConfigSchema = z.object({}).strict();

export function parseTriggerConfig(triggerType: string, config: unknown) {
  switch (triggerType) {
    case "PROCEDURE_STATUS_ENTERED":
      return procedureStatusEnteredConfigSchema.parse(config);
    case "REVIEW_DATE_DUE":
      return reviewDateDueConfigSchema.parse(config);
    case "ACK_CAMPAIGN_AGE":
      return ackCampaignAgeConfigSchema.parse(config);
    case "ACK_CAMPAIGN_COMPLETED":
      return ackCampaignCompletedConfigSchema.parse(config);
    case "COMMENT_ADDED":
      return commentAddedConfigSchema.parse(config);
    default:
      throw new Error(`Unknown triggerType "${triggerType}"`);
  }
}

/// Fixed guard shape — the one condition resolveNextStage() (lib/workflow)
/// already hardcodes for the compliance-tag skip, made admin-configurable.
/// Not a generic condition builder: no AND/OR trees, no arbitrary fields.
export const conditionsSchema = z
  .object({
    isCriticalEquals: z.boolean().optional(),
    tagNameIn: z.array(z.string()).optional(),
    tagNameNotIn: z.array(z.string()).optional(),
  })
  .nullable()
  .optional();

export type AutomationConditions = z.infer<typeof conditionsSchema>;

export const sendNotificationConfigSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(1000).optional(),
  /// "DEPARTMENT" delegates to notifyEvent's own resolveDefaultRecipients
  /// (department-scoped, with the existing isCritical/requiresAck
  /// tenant-wide escalation already baked in) — not reimplemented here.
  /// "ACK_OUTSTANDING" (added migrating scripts/send-ack-reminders.ts onto
  /// this engine): the AckCampaign members who have NOT yet acknowledged —
  /// only resolvable on an ACK_CAMPAIGN_AGE trigger, which is the only one
  /// that hands the executor that campaign context; on any other trigger
  /// this recipient resolves to nobody and the action is skipped (see
  /// executeSendNotification's own comment for why that's a warn-and-skip,
  /// not a validation error at rule-creation time — same permissiveness
  /// SEND_WEBHOOK's authHeader already has for a field that's only
  /// meaningful in some configurations, not all).
  recipients: z.enum(["OWNER", "DEPARTMENT", "TENANT", "ACK_OUTSTANDING"]),
  /// Default true (matches notifyEvent's own default: full external
  /// fan-out). The migrated DAY_3 ack reminder was deliberately in-app
  /// only in the old script (an early nudge, not worth a Slack/Teams
  /// ping yet) while DAY_7 fanned out everywhere — this is what lets the
  /// default-provisioned rules (scripts/ensure-default-automations.ts)
  /// reproduce that distinction; any rule can use it, not just those.
  externalChannels: z.boolean().optional(),
});
export type SendNotificationConfig = z.infer<typeof sendNotificationConfigSchema>;

/// No fields: which campaign/outstanding users to escalate comes entirely
/// from the ACK_CAMPAIGN_AGE trigger context that fired this rule (same
/// reasoning as ACK_OUTSTANDING above) — there is nothing for an admin to
/// configure here beyond enabling the rule and picking the trigger's `days`.
export const escalateAckToManagersConfigSchema = z.object({}).strict();
export type EscalateAckToManagersConfig = z.infer<typeof escalateAckToManagersConfigSchema>;

/// v1 deliberately supports only ARCHIVED — see src/lib/automations/actions.ts
/// for why a general "advance status" action isn't offered.
export const changeProcedureStatusConfigSchema = z.object({
  status: z.literal("ARCHIVED"),
});
export type ChangeProcedureStatusConfig = z.infer<typeof changeProcedureStatusConfigSchema>;

/// Generic outbound webhook (3.3) — same trust boundary as Slack/Google
/// Chat's own webhookUrl config (Integration.config): only a tenant ADMIN
/// can set it (see the isTenantAdmin gate in api/admin/automations), so an
/// admin-supplied POST target isn't a new SSRF surface, it's the same one
/// those integrations already accept.
///
/// `authHeader` (added when this stopped being enough for Jira/ServiceNow/
/// Freshdesk, see actions.ts): the *whole* Authorization header value,
/// verbatim — "Bearer <token>" for a ServiceNow OAuth token, "Basic
/// <base64(email:api_token)>" for Jira Cloud/Freshdesk's basic-auth REST
/// APIs. A single opaque string rather than a scheme picker: those three
/// providers alone already cover 3 different auth shapes, so a
/// "helpfully" structured field would just be guessing at a 4th provider's
/// shape next. The admin is expected to construct the header value the
/// same way they would for a `curl -H "Authorization: ..."` call against
/// that provider's own docs. Optional: Teams/Slack-style incoming webhooks
/// (and Jira's own "Automation for Jira" incoming-webhook trigger) already
/// carry their secret in the URL itself and need nothing here.
export const sendWebhookConfigSchema = z.object({
  url: z.string().url(),
  authHeader: z.string().min(1).max(4000).optional(),
});
export type SendWebhookConfig = z.infer<typeof sendWebhookConfigSchema>;

export function parseActionConfig(actionType: string, config: unknown) {
  switch (actionType) {
    case "SEND_NOTIFICATION":
      return sendNotificationConfigSchema.parse(config);
    case "CHANGE_PROCEDURE_STATUS":
      return changeProcedureStatusConfigSchema.parse(config);
    case "SEND_WEBHOOK":
      return sendWebhookConfigSchema.parse(config);
    case "ESCALATE_ACK_TO_MANAGERS":
      return escalateAckToManagersConfigSchema.parse(config);
    default:
      throw new Error(`Unknown actionType "${actionType}"`);
  }
}

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isEnabled: z.boolean().optional(),
  triggerType: z.enum(["PROCEDURE_STATUS_ENTERED", "REVIEW_DATE_DUE", "ACK_CAMPAIGN_AGE", "ACK_CAMPAIGN_COMPLETED", "COMMENT_ADDED"]),
  triggerConfig: z.record(z.any()),
  conditions: conditionsSchema,
  actionType: z.enum(["SEND_NOTIFICATION", "CHANGE_PROCEDURE_STATUS", "SEND_WEBHOOK", "ESCALATE_ACK_TO_MANAGERS"]),
  actionConfig: z.record(z.any()),
});
