import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { notifyEvent } from "@/lib/integrations/notify";
import { runTimeBasedAutomations, runStatusAutomations } from "@/lib/automations/engine";
import { ensureDefaultAutomationRules } from "@/lib/automations/defaults";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

/**
 * Roadmap #4: migrating lib/review-reminders.ts + scripts/send-ack-reminders.ts
 * onto the automation engine — these tests cover what's new/changed in
 * that migration specifically. The pre-existing REVIEW_DATE_DUE/
 * ACK_CAMPAIGN_AGE dedup coverage stays in tests/automations.test.ts,
 * unchanged and still passing (verified before adding this file).
 *
 * Every test here creates and tears down its OWN tenant (not a
 * file-shared one via beforeAll, unlike tests/automations.test.ts) — a
 * real thing found writing these: runTimeBasedAutomations() scans every
 * ENABLED ACK_CAMPAIGN_AGE rule *tenant-wide*, so two tests sharing one
 * tenant and each creating their own days=3 rule end up with two live
 * rules both firing on any days=3-eligible campaign in that shared
 * tenant, double-counting notifyEvent calls a test expects to see once.
 * Correct product behavior (an admin creating two same-shaped rules
 * really would double-fire), just not something to let leak across
 * unrelated test cases.
 *
 * notifyEvent is mocked (tests/setup.ts) the same as everywhere else in
 * this suite — inspected here via its own mock call history (nothing else
 * in tests/*.test.ts does this yet) since these tests care about *what*
 * was sent (title/body/recipients), not just that a Notification row
 * exists — notifyEvent itself already has that covered elsewhere, and
 * mocking it here is what keeps this suite independent of a running
 * Redis/BullMQ worker.
 */

function callsFor(procedureId: string) {
  return (notifyEvent as any).mock.calls.map((c: any[]) => c[0]).filter((arg: any) => arg.procedureId === procedureId);
}

async function withTenant(fn: (t: TestTenant) => Promise<void>) {
  const t = await createTestTenant();
  try {
    await fn(t);
  } finally {
    await t.cleanup();
  }
}

async function ackAgeRule(t: TestTenant, days: number, actionType: string, actionConfig: object) {
  return prisma.automationRule.create({
    data: {
      tenantId: t.tenant.id,
      name: `Test ACK_CAMPAIGN_AGE days=${days} ${actionType}`,
      triggerType: "ACK_CAMPAIGN_AGE",
      triggerConfig: { days },
      actionType: actionType as any,
      actionConfig,
      createdById: t.admin.id,
    },
  });
}

describe("runAckCampaignAgeRule — fireKey bug fix", () => {
  it("fires independently for two separate AckCampaigns on the same procedure (previously permanently blocked after the first)", async () =>
    withTenant(async (t) => {
      const rule = await ackAgeRule(t, 3, "SEND_NOTIFICATION", { title: "T", recipients: "OWNER" });
      const p = await t.createProcedure({ status: "PUBLISHED", requiresAck: true });

      const campaign1 = await prisma.ackCampaign.create({
        data: {
          tenantId: t.tenant.id,
          procedureId: p.id,
          versionNumber: 1,
          targetUserIds: [t.viewer.id],
          startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          completedAt: new Date(), // closed — must not be picked up
        },
      });
      await runTimeBasedAutomations();
      expect(await prisma.automationRun.count({ where: { ruleId: rule.id, entityId: campaign1.id } })).toBe(0);

      // A second, later campaign for the SAME procedure (a republish that
      // required ack again) — under the old `fireKey = String(days)` bug,
      // this could never fire because (ruleId, procedureId, "3") was
      // considered already claimed forever, regardless of which campaign.
      const campaign2 = await prisma.ackCampaign.create({
        data: {
          tenantId: t.tenant.id,
          procedureId: p.id,
          versionNumber: 2,
          targetUserIds: [t.viewer.id],
          startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      });
      await runTimeBasedAutomations();
      await runTimeBasedAutomations(); // repeat scan — still only one run for campaign2

      const runs = await prisma.automationRun.findMany({ where: { ruleId: rule.id } });
      expect(runs.map((r) => r.entityId).sort()).toEqual([campaign2.id]);
    }));

  it("skips a campaign where nobody is currently outstanding (defensive — maybeCompleteCampaign should already have closed it)", async () =>
    withTenant(async (t) => {
      const rule = await ackAgeRule(t, 3, "SEND_NOTIFICATION", { title: "T", recipients: "OWNER" });
      const p = await t.createProcedure({ status: "PUBLISHED", requiresAck: true });
      const campaign = await prisma.ackCampaign.create({
        data: {
          tenantId: t.tenant.id,
          procedureId: p.id,
          versionNumber: 1,
          targetUserIds: [t.viewer.id],
          startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      });
      await prisma.acknowledgment.create({
        data: { procedureId: p.id, userId: t.viewer.id, versionNumber: 1 },
      });

      await runTimeBasedAutomations();
      expect(await prisma.automationRun.count({ where: { ruleId: rule.id, entityId: campaign.id } })).toBe(0);
    }));
});

describe("SEND_NOTIFICATION recipients: ACK_OUTSTANDING", () => {
  it("notifies only the campaign members who have not yet acknowledged", async () =>
    withTenant(async (t) => {
      await ackAgeRule(t, 3, "SEND_NOTIFICATION", { title: "Promemoria", recipients: "ACK_OUTSTANDING", externalChannels: false });
      const p = await t.createProcedure({ status: "PUBLISHED", requiresAck: true });
      await prisma.ackCampaign.create({
        data: {
          tenantId: t.tenant.id,
          procedureId: p.id,
          versionNumber: 1,
          targetUserIds: [t.viewer.id, t.editor.id],
          startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      });
      // editor already acknowledged — only viewer is outstanding.
      await prisma.acknowledgment.create({ data: { procedureId: p.id, userId: t.editor.id, versionNumber: 1 } });

      await runTimeBasedAutomations();

      const calls = callsFor(p.id);
      expect(calls).toHaveLength(1);
      expect(calls[0].userIds).toEqual([t.viewer.id]);
      expect(calls[0].externalChannels).toBe(false);
    }));

  it("skips (no notifyEvent call, but the AutomationRun row still exists) when fired outside an ACK_CAMPAIGN_AGE trigger — no context to resolve ACK_OUTSTANDING from", async () =>
    withTenant(async (t) => {
      const rule = await prisma.automationRule.create({
        data: {
          tenantId: t.tenant.id,
          name: "Misconfigured ACK_OUTSTANDING on PROCEDURE_STATUS_ENTERED",
          triggerType: "PROCEDURE_STATUS_ENTERED",
          triggerConfig: { status: "PUBLISHED" },
          actionType: "SEND_NOTIFICATION",
          actionConfig: { title: "T", recipients: "ACK_OUTSTANDING" },
          createdById: t.admin.id,
        },
      });
      const p = await t.createProcedure({ status: "PUBLISHED" });

      await runStatusAutomations(t.tenant.id, p.id, "PUBLISHED", `misfire-${p.id}`);

      // AutomationRun IS created (fireRule claims the dedup slot before
      // running the action) — it's the notifyEvent call that's skipped.
      expect(await prisma.automationRun.count({ where: { ruleId: rule.id, entityId: p.id } })).toBe(1);
      expect(callsFor(p.id)).toHaveLength(0);
    }));
});

describe("{{procedureTitle}} templating", () => {
  it("substitutes the real procedure title into both title and body", async () =>
    withTenant(async (t) => {
      await ackAgeRule(t, 3, "SEND_NOTIFICATION", {
        title: 'Promemoria: "{{procedureTitle}}"',
        body: "Conferma la lettura di {{procedureTitle}} al più presto.",
        recipients: "ACK_OUTSTANDING",
      });
      const p = await t.createProcedure({ status: "PUBLISHED", requiresAck: true });
      await prisma.ackCampaign.create({
        data: {
          tenantId: t.tenant.id,
          procedureId: p.id,
          versionNumber: 1,
          targetUserIds: [t.viewer.id],
          startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      });

      await runTimeBasedAutomations();

      const calls = callsFor(p.id);
      expect(calls).toHaveLength(1);
      expect(calls[0].title).toBe(`Promemoria: "${p.title}"`);
      expect(calls[0].body).toBe(`Conferma la lettura di ${p.title} al più presto.`);
    }));
});

describe("ESCALATE_ACK_TO_MANAGERS", () => {
  it("groups outstanding users by their manager, one notification per manager", async () =>
    withTenant(async (t) => {
      await ackAgeRule(t, 14, "ESCALATE_ACK_TO_MANAGERS", {});
      const manager = await t.createUser({ email: `manager-${Date.now()}@test.local` });
      const report1 = await t.createUser({ email: `report1-${Date.now()}@test.local` });
      const report2 = await t.createUser({ email: `report2-${Date.now()}@test.local` });
      await prisma.user.update({ where: { id: report1.id }, data: { managerId: manager.id } });
      await prisma.user.update({ where: { id: report2.id }, data: { managerId: manager.id } });

      const p = await t.createProcedure({ status: "PUBLISHED", requiresAck: true });
      await prisma.ackCampaign.create({
        data: {
          tenantId: t.tenant.id,
          procedureId: p.id,
          versionNumber: 1,
          targetUserIds: [report1.id, report2.id],
          startedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        },
      });

      await runTimeBasedAutomations();

      const calls = callsFor(p.id);
      expect(calls).toHaveLength(1); // one call, to the shared manager
      expect(calls[0].userIds).toEqual([manager.id]);
      expect(calls[0].body).toContain(report1.name);
      expect(calls[0].body).toContain(report2.name);
    }));

  it("falls back to the procedure owner when an outstanding user has no manager set", async () =>
    withTenant(async (t) => {
      await ackAgeRule(t, 14, "ESCALATE_ACK_TO_MANAGERS", {});
      const noManagerUser = await t.createUser({ email: `nomanager-${Date.now()}@test.local` });
      const p = await t.createProcedure({ status: "PUBLISHED", requiresAck: true });
      await prisma.ackCampaign.create({
        data: {
          tenantId: t.tenant.id,
          procedureId: p.id,
          versionNumber: 1,
          targetUserIds: [noManagerUser.id],
          startedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        },
      });

      await runTimeBasedAutomations();

      const calls = callsFor(p.id);
      expect(calls).toHaveLength(1);
      // p.ownerId defaults to t.owner per createProcedure — see test-tenant.ts.
      expect(calls[0].userIds).toEqual([t.owner.id]);
    }));
});

describe("ensureDefaultAutomationRules", () => {
  it("creates the four default rules on a tenant with none, and is a no-op on a second call", async () =>
    withTenant(async (t) => {
      const first = await ensureDefaultAutomationRules(t.tenant.id);
      expect(first.created).toHaveLength(4);

      const rules = await prisma.automationRule.findMany({ where: { tenantId: t.tenant.id } });
      expect(rules).toHaveLength(4);
      expect(rules.every((r) => r.isEnabled)).toBe(true);

      const second = await ensureDefaultAutomationRules(t.tenant.id);
      expect(second.created).toHaveLength(0);
      expect(await prisma.automationRule.count({ where: { tenantId: t.tenant.id } })).toBe(4);
    }));

  it("does not duplicate the REVIEW_DATE_DUE rule if an equivalent one already exists (matched by shape, not name)", async () =>
    withTenant(async (t) => {
      await prisma.automationRule.create({
        data: {
          tenantId: t.tenant.id,
          name: "Un nome completamente diverso scelto dall'admin",
          triggerType: "REVIEW_DATE_DUE",
          triggerConfig: {},
          actionType: "SEND_NOTIFICATION",
          actionConfig: { title: "Custom", recipients: "OWNER" },
          createdById: t.admin.id,
        },
      });

      const result = await ensureDefaultAutomationRules(t.tenant.id);
      expect(result.created).toEqual([
        "Promemoria conferma lettura — 3 giorni",
        "Promemoria conferma lettura — 7 giorni",
        "Escalation conferma lettura ai manager — 14 giorni",
      ]);
      expect(await prisma.automationRule.count({ where: { tenantId: t.tenant.id, triggerType: "REVIEW_DATE_DUE" } })).toBe(1);
    }));

  it("treats the three ACK_CAMPAIGN_AGE default rules as distinct by their `days` config, not as interchangeable", async () =>
    withTenant(async (t) => {
      await ensureDefaultAutomationRules(t.tenant.id);
      const ackRules = await prisma.automationRule.findMany({
        where: { tenantId: t.tenant.id, triggerType: "ACK_CAMPAIGN_AGE" },
      });
      const days = ackRules.map((r) => (r.triggerConfig as any).days).sort((a, b) => a - b);
      expect(days).toEqual([3, 7, 14]);
    }));
});
