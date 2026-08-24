import crypto from "crypto";
import type { DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matchesConditions } from "./conditions";
import { executeSendNotification, executeChangeProcedureStatus, executeSendWebhook } from "./actions";
import type { AutomationConditions, SendNotificationConfig, ChangeProcedureStatusConfig, SendWebhookConfig } from "./types";

interface RuleRow {
  id: string;
  tenantId: string;
  actionType: string;
  actionConfig: unknown;
  conditions: unknown;
  triggerConfig: unknown;
}

/**
 * Shared "claim the dedup slot, then execute" wrapper — every trigger path
 * funnels through this so idempotency and run history live in one place.
 * The AutomationRun row is created (claiming @@unique([ruleId, entityId,
 * fireKey])) BEFORE the action runs, not after: that's what makes the
 * dedup safe under concurrency, not just under a single-threaded read-then-
 * write. Never throws to the caller — a failing rule must not break the
 * workflow transition or cron tick that invoked it.
 */
async function fireRule(rule: RuleRow, entityType: string, entityId: string, fireKey: string, procedureId: string) {
  try {
    await prisma.automationRun.create({
      data: { ruleId: rule.id, tenantId: rule.tenantId, entityType, entityId, fireKey, status: "SUCCESS" },
    });
  } catch {
    // Unique constraint hit: this exact (rule, entity, fireKey) already
    // fired — expected dedup path, not an error.
    return;
  }

  try {
    if (rule.actionType === "SEND_NOTIFICATION") {
      await executeSendNotification(rule.tenantId, procedureId, rule.actionConfig as SendNotificationConfig);
    } else if (rule.actionType === "CHANGE_PROCEDURE_STATUS") {
      await executeChangeProcedureStatus(rule.tenantId, procedureId, rule.actionConfig as ChangeProcedureStatusConfig);
    } else if (rule.actionType === "SEND_WEBHOOK") {
      await executeSendWebhook(rule.tenantId, procedureId, rule.actionConfig as SendWebhookConfig);
    }
  } catch (err) {
    await prisma.automationRun.updateMany({
      where: { ruleId: rule.id, entityId, fireKey },
      data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Event-driven entry point — called in-process from
 * src/lib/workflow/index.ts right after each of its existing notifyEvent()
 * calls, for every status a procedure transitions into. History only, not
 * a dedup key (fireKey is a fresh id every call): notifyEvent() itself has
 * no double-click guard at those call sites either, so this matches the
 * existing risk posture instead of inventing new protection the rest of
 * that file doesn't have.
 */
export async function runStatusAutomations(tenantId: string, procedureId: string, enteredStatus: DocumentStatus) {
  const rules = await prisma.automationRule.findMany({
    where: { tenantId, isEnabled: true, triggerType: "PROCEDURE_STATUS_ENTERED" },
  });
  const relevant = rules.filter((r) => (r.triggerConfig as { status?: string })?.status === enteredStatus);
  if (relevant.length === 0) return;

  const procedure = await prisma.procedure.findUnique({
    where: { id: procedureId },
    select: { id: true, isCritical: true },
  });
  if (!procedure) return;

  for (const rule of relevant) {
    if (!(await matchesConditions(procedure, rule.conditions as AutomationConditions))) continue;
    await fireRule(rule, "Procedure", procedureId, crypto.randomUUID(), procedureId);
  }
}

/**
 * Event-driven entry point — called from lib/ack.ts's maybeCompleteCampaign
 * right after it notifies the procedure owner that 100% of the target
 * audience has acknowledged. That owner-only notification stays as-is
 * (unconditional, not admin-configurable); this is the hook that lets an
 * admin ALSO notify the department or the whole tenant when that happens,
 * without touching lib/ack.ts's own logic.
 */
export async function runAckCompletionAutomations(tenantId: string, procedureId: string) {
  const rules = await prisma.automationRule.findMany({
    where: { tenantId, isEnabled: true, triggerType: "ACK_CAMPAIGN_COMPLETED" },
  });
  if (rules.length === 0) return;

  const procedure = await prisma.procedure.findUnique({
    where: { id: procedureId },
    select: { id: true, isCritical: true },
  });
  if (!procedure) return;

  for (const rule of rules) {
    if (!(await matchesConditions(procedure, rule.conditions as AutomationConditions))) continue;
    await fireRule(rule, "Procedure", procedureId, crypto.randomUUID(), procedureId);
  }
}

/**
 * Event-driven entry point — called from POST /api/procedures/[id]/comments
 * right after a Comment (top-level or reply) is created. History only, not
 * a dedup key (fresh id every call) — same category as
 * runAckCompletionAutomations above, a comment is a one-shot event, not
 * something that could plausibly double-fire for the same fireKey the way
 * a time-based scan revisiting the same procedure could.
 */
export async function runCommentAddedAutomations(tenantId: string, procedureId: string) {
  const rules = await prisma.automationRule.findMany({
    where: { tenantId, isEnabled: true, triggerType: "COMMENT_ADDED" },
  });
  if (rules.length === 0) return;

  const procedure = await prisma.procedure.findUnique({
    where: { id: procedureId },
    select: { id: true, isCritical: true },
  });
  if (!procedure) return;

  for (const rule of rules) {
    if (!(await matchesConditions(procedure, rule.conditions as AutomationConditions))) continue;
    await fireRule(rule, "Procedure", procedureId, crypto.randomUUID(), procedureId);
  }
}

/**
 * Time-based entry point — GET /api/cron/automations (Vercel Cron in
 * production) and the local dev-cron loop both call this. Scans across
 * every tenant (each subsequent query is scoped by rule.tenantId, per the
 * multi-tenancy rule every query here must respect).
 */
export async function runTimeBasedAutomations() {
  const rules = await prisma.automationRule.findMany({
    where: { isEnabled: true, triggerType: { in: ["REVIEW_DATE_DUE", "ACK_CAMPAIGN_AGE"] } },
  });

  let fired = 0;
  for (const rule of rules) {
    fired += rule.triggerType === "REVIEW_DATE_DUE" ? await runReviewDateDueRule(rule) : await runAckCampaignAgeRule(rule);
  }
  return { rulesChecked: rules.length, fired };
}

async function runReviewDateDueRule(rule: RuleRow): Promise<number> {
  const procedures = await prisma.procedure.findMany({
    where: { tenantId: rule.tenantId, status: "PUBLISHED", nextReviewDate: { lte: new Date() } },
    select: { id: true, isCritical: true, nextReviewDate: true },
  });

  let fired = 0;
  for (const p of procedures) {
    if (!(await matchesConditions(p, rule.conditions as AutomationConditions))) continue;
    await fireRule(rule, "Procedure", p.id, p.nextReviewDate!.toISOString(), p.id);
    fired++; // counts attempts, not confirmed sends — fireRule dedupes via the unique constraint.
  }
  return fired;
}

async function runAckCampaignAgeRule(rule: RuleRow): Promise<number> {
  const days = (rule.triggerConfig as { days?: number })?.days ?? 14;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const campaigns = await prisma.ackCampaign.findMany({
    where: { tenantId: rule.tenantId, completedAt: null, startedAt: { lte: cutoff } },
    include: { procedure: { select: { id: true, isCritical: true } } },
  });

  let fired = 0;
  for (const c of campaigns) {
    if (!(await matchesConditions(c.procedure, rule.conditions as AutomationConditions))) continue;
    await fireRule(rule, "AckCampaign", c.procedureId, String(days), c.procedureId);
    fired++;
  }
  return fired;
}
