import { prisma } from "@/lib/prisma";
import { getSystemActorId } from "./system-actor";

/**
 * Roadmap #4: migrating lib/review-reminders.ts and
 * scripts/send-ack-reminders.ts onto this engine. Deliberately deferred
 * when the engine was introduced (19 ago 2026) until it had a track record —
 * see CLAUDE.md's roadmap note for why. These two behaviors were never
 * admin-configurable before: every tenant got them automatically, no
 * AutomationRule to create. Simply retiring the old code and telling
 * tenants "go create the equivalent rule yourself" would silently drop
 * review reminders and Read & Acknowledge escalation for every tenant that
 * doesn't proactively do that — a real compliance regression, exactly what
 * the original deferral was worried about.
 *
 * So this doesn't wait for an admin: ensureDefaultAutomationRules(tenantId)
 * creates the four rules below for a tenant if it doesn't already have an
 * equivalent one, preserving the old zero-configuration behavior while also
 * making it a real, visible, editable AutomationRule an admin can see,
 * disable, or tune in /admin/automations — which the old hardcoded path
 * never was. Idempotent: safe to call on every tenant on every deploy (a
 * tenant that already has its defaults, or that deleted one on purpose, is
 * left alone — see hasEquivalentRule below for exactly what "equivalent"
 * means per rule).
 *
 * There is currently no self-service "create a new tenant" flow in this
 * app (only prisma/seed.ts and test fixtures create Tenant rows) — new
 * tenants are provisioned out-of-band. So the real call site for this is
 * scripts/ensure-default-automations.ts, run once per environment (and
 * safe to re-run any time, e.g. after provisioning a new tenant by hand).
 */

const REVIEW_REMINDER_RULE = {
  name: "Promemoria revisione periodica",
  description:
    "Notifica il proprietario (o l'autore) quando la data di revisione di una procedura pubblicata è passata. " +
    "Migrata da lib/review-reminders.ts (25 ago 2026 era la Roadmap #4, deliberatamente rimandata; migrata il 9 set 2026).",
  triggerType: "REVIEW_DATE_DUE" as const,
  triggerConfig: {},
  actionType: "SEND_NOTIFICATION" as const,
  actionConfig: {
    title: '"{{procedureTitle}}" è in scadenza di revisione',
    body: "La data di revisione prevista è passata.",
    recipients: "OWNER" as const,
  },
};

/** DAY_3 equivalent: in-app only, an early nudge not worth external noise yet — matches the original script exactly. */
const ACK_REMINDER_DAY3_RULE = {
  name: "Promemoria conferma lettura — 3 giorni",
  description:
    "Promemoria in-app a chi non ha ancora confermato la lettura, 3 giorni dopo l'apertura della campagna. " +
    "Migrata da scripts/send-ack-reminders.ts (DAY_3).",
  triggerType: "ACK_CAMPAIGN_AGE" as const,
  triggerConfig: { days: 3 },
  actionType: "SEND_NOTIFICATION" as const,
  actionConfig: {
    title: 'Promemoria: conferma la lettura di "{{procedureTitle}}"',
    body: "Non risulta ancora una tua conferma di lettura per questa procedura.",
    recipients: "ACK_OUTSTANDING" as const,
    externalChannels: false,
  },
};

/** DAY_7 equivalent: same reminder, but this time also fanned out to Slack/Google Chat/Teams — matches the original script. */
const ACK_REMINDER_DAY7_RULE = {
  name: "Promemoria conferma lettura — 7 giorni",
  description:
    "Come il promemoria a 3 giorni, ma anche su Slack/Google Chat/Teams oltre alla notifica in-app. " +
    "Migrata da scripts/send-ack-reminders.ts (DAY_7).",
  triggerType: "ACK_CAMPAIGN_AGE" as const,
  triggerConfig: { days: 7 },
  actionType: "SEND_NOTIFICATION" as const,
  actionConfig: {
    title: 'Promemoria: conferma la lettura di "{{procedureTitle}}"',
    body: "Non risulta ancora una tua conferma di lettura per questa procedura.",
    recipients: "ACK_OUTSTANDING" as const,
    externalChannels: true,
  },
};

/** DAY_14 equivalent: escalates to each outstanding person's manager instead of nagging them again. */
const ACK_ESCALATION_DAY14_RULE = {
  name: "Escalation conferma lettura ai manager — 14 giorni",
  description:
    "Dopo 14 giorni, chi non ha ancora confermato la lettura viene segnalato al proprio manager " +
    "(o al proprietario della procedura, se non ha un manager impostato) invece di ricevere un altro promemoria. " +
    "Migrata da scripts/send-ack-reminders.ts (DAY_14).",
  triggerType: "ACK_CAMPAIGN_AGE" as const,
  triggerConfig: { days: 14 },
  actionType: "ESCALATE_ACK_TO_MANAGERS" as const,
  actionConfig: {},
};

const DEFAULT_RULES = [REVIEW_REMINDER_RULE, ACK_REMINDER_DAY3_RULE, ACK_REMINDER_DAY7_RULE, ACK_ESCALATION_DAY14_RULE];

/**
 * "Equivalent" means: same triggerType and actionType, and — for the three
 * ACK_CAMPAIGN_AGE rules, which would otherwise all look alike by that
 * measure alone — the same `days` threshold too. Matching on shape, not on
 * name/description: an admin renaming "Promemoria revisione periodica" to
 * something of their own must not cause a second, duplicate rule to appear
 * on the next run of this function.
 */
async function hasEquivalentRule(tenantId: string, spec: (typeof DEFAULT_RULES)[number]): Promise<boolean> {
  const candidates = await prisma.automationRule.findMany({
    where: { tenantId, triggerType: spec.triggerType, actionType: spec.actionType },
    select: { triggerConfig: true },
  });
  if (spec.triggerType !== "ACK_CAMPAIGN_AGE") return candidates.length > 0;

  const days = (spec.triggerConfig as { days: number }).days;
  return candidates.some((c) => (c.triggerConfig as { days?: number })?.days === days);
}

export interface EnsureDefaultsResult {
  tenantId: string;
  created: string[]; // rule names actually created this call
}

export async function ensureDefaultAutomationRules(tenantId: string): Promise<EnsureDefaultsResult> {
  const createdById = await getSystemActorId(tenantId);
  const created: string[] = [];

  for (const spec of DEFAULT_RULES) {
    if (await hasEquivalentRule(tenantId, spec)) continue;

    await prisma.automationRule.create({
      data: {
        tenantId,
        name: spec.name,
        description: spec.description,
        isEnabled: true,
        triggerType: spec.triggerType,
        triggerConfig: spec.triggerConfig,
        actionType: spec.actionType,
        actionConfig: spec.actionConfig,
        createdById,
      },
    });
    created.push(spec.name);
  }

  return { tenantId, created };
}
