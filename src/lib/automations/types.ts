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

export function parseTriggerConfig(triggerType: string, config: unknown) {
  switch (triggerType) {
    case "PROCEDURE_STATUS_ENTERED":
      return procedureStatusEnteredConfigSchema.parse(config);
    case "REVIEW_DATE_DUE":
      return reviewDateDueConfigSchema.parse(config);
    case "ACK_CAMPAIGN_AGE":
      return ackCampaignAgeConfigSchema.parse(config);
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
  recipients: z.enum(["OWNER", "DEPARTMENT", "TENANT"]),
});
export type SendNotificationConfig = z.infer<typeof sendNotificationConfigSchema>;

/// v1 deliberately supports only ARCHIVED — see src/lib/automations/actions.ts
/// for why a general "advance status" action isn't offered.
export const changeProcedureStatusConfigSchema = z.object({
  status: z.literal("ARCHIVED"),
});
export type ChangeProcedureStatusConfig = z.infer<typeof changeProcedureStatusConfigSchema>;

export function parseActionConfig(actionType: string, config: unknown) {
  switch (actionType) {
    case "SEND_NOTIFICATION":
      return sendNotificationConfigSchema.parse(config);
    case "CHANGE_PROCEDURE_STATUS":
      return changeProcedureStatusConfigSchema.parse(config);
    default:
      throw new Error(`Unknown actionType "${actionType}"`);
  }
}

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  isEnabled: z.boolean().optional(),
  triggerType: z.enum(["PROCEDURE_STATUS_ENTERED", "REVIEW_DATE_DUE", "ACK_CAMPAIGN_AGE"]),
  triggerConfig: z.record(z.any()),
  conditions: conditionsSchema,
  actionType: z.enum(["SEND_NOTIFICATION", "CHANGE_PROCEDURE_STATUS"]),
  actionConfig: z.record(z.any()),
});
