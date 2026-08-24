import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { matchesConditions } from "@/lib/automations/conditions";
import {
  runStatusAutomations,
  runCommentAddedAutomations,
  runTimeBasedAutomations,
} from "@/lib/automations/engine";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

let t: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
});

afterAll(async () => {
  await t.cleanup();
});

async function createRule(opts: {
  triggerType: "PROCEDURE_STATUS_ENTERED" | "REVIEW_DATE_DUE" | "ACK_CAMPAIGN_AGE" | "COMMENT_ADDED";
  triggerConfig?: object;
  conditions?: object;
}) {
  return prisma.automationRule.create({
    data: {
      tenantId: t.tenant.id,
      name: `Test rule ${opts.triggerType}`,
      triggerType: opts.triggerType,
      triggerConfig: opts.triggerConfig ?? {},
      conditions: opts.conditions,
      actionType: "SEND_NOTIFICATION",
      actionConfig: { title: "Test notification", recipients: "OWNER" },
      createdById: t.admin.id,
    },
  });
}

function runsFor(ruleId: string) {
  return prisma.automationRun.findMany({ where: { ruleId } });
}

describe("matchesConditions", () => {
  it("no conditions (undefined/null) always matches", async () => {
    expect(await matchesConditions({ id: "x", isCritical: false }, undefined)).toBe(true);
    expect(await matchesConditions({ id: "x", isCritical: false }, null)).toBe(true);
  });

  it("isCriticalEquals filters on Procedure.isCritical", async () => {
    expect(await matchesConditions({ id: "x", isCritical: true }, { isCriticalEquals: true })).toBe(true);
    expect(await matchesConditions({ id: "x", isCritical: false }, { isCriticalEquals: true })).toBe(false);
  });

  it("tagNameIn requires at least one matching tag on the real procedure", async () => {
    const withTag = await t.createProcedure({ tagNames: ["GDPR"] });
    const withoutTag = await t.createProcedure();

    expect(await matchesConditions(withTag, { tagNameIn: ["GDPR", "ISO27001"] })).toBe(true);
    expect(await matchesConditions(withoutTag, { tagNameIn: ["GDPR", "ISO27001"] })).toBe(false);
  });

  it("tagNameNotIn excludes a procedure that carries any of the listed tags", async () => {
    const withTag = await t.createProcedure({ tagNames: ["Draft-Only"] });
    const withoutTag = await t.createProcedure();

    expect(await matchesConditions(withTag, { tagNameNotIn: ["Draft-Only"] })).toBe(false);
    expect(await matchesConditions(withoutTag, { tagNameNotIn: ["Draft-Only"] })).toBe(true);
  });
});

describe("runStatusAutomations — PROCEDURE_STATUS_ENTERED, event-driven, real dedup via caller-supplied fireKey (3.5)", () => {
  it("fires only for rules whose triggerConfig.status matches the entered status", async () => {
    const rulePublished = await createRule({ triggerType: "PROCEDURE_STATUS_ENTERED", triggerConfig: { status: "PUBLISHED" } });
    const ruleArchived = await createRule({ triggerType: "PROCEDURE_STATUS_ENTERED", triggerConfig: { status: "ARCHIVED" } });
    const p = await t.createProcedure();

    await runStatusAutomations(t.tenant.id, p.id, "PUBLISHED", "step-1");

    expect(await runsFor(rulePublished.id)).toHaveLength(1);
    expect(await runsFor(ruleArchived.id)).toHaveLength(0);
  });

  it("respects conditions: a rule scoped to critical procedures does not fire for a non-critical one", async () => {
    const rule = await createRule({
      triggerType: "PROCEDURE_STATUS_ENTERED",
      triggerConfig: { status: "PUBLISHED" },
      conditions: { isCriticalEquals: true },
    });
    const nonCritical = await t.createProcedure({ isCritical: false });
    const critical = await t.createProcedure({ isCritical: true });

    await runStatusAutomations(t.tenant.id, nonCritical.id, "PUBLISHED", "step-nc");
    expect(await runsFor(rule.id)).toHaveLength(0);

    await runStatusAutomations(t.tenant.id, critical.id, "PUBLISHED", "step-c");
    expect(await runsFor(rule.id)).toHaveLength(1);
  });

  it("a retry with the same fireKey (e.g. a client double-submit deciding the same WorkflowStep twice) does not double-fire", async () => {
    const rule = await createRule({ triggerType: "PROCEDURE_STATUS_ENTERED", triggerConfig: { status: "PUBLISHED" } });
    const p = await t.createProcedure();

    await runStatusAutomations(t.tenant.id, p.id, "PUBLISHED", "same-step-id");
    await runStatusAutomations(t.tenant.id, p.id, "PUBLISHED", "same-step-id");

    expect(await runsFor(rule.id)).toHaveLength(1);
  });

  it("a later, genuinely separate transition into the same status (different fireKey) fires again", async () => {
    const rule = await createRule({ triggerType: "PROCEDURE_STATUS_ENTERED", triggerConfig: { status: "PUBLISHED" } });
    const p = await t.createProcedure();

    await runStatusAutomations(t.tenant.id, p.id, "PUBLISHED", "step-first-publish");
    await runStatusAutomations(t.tenant.id, p.id, "PUBLISHED", "step-republish-after-revision");

    expect(await runsFor(rule.id)).toHaveLength(2);
  });

  it("a disabled rule never fires", async () => {
    const rule = await prisma.automationRule.create({
      data: {
        tenantId: t.tenant.id,
        name: "Disabled rule",
        isEnabled: false,
        triggerType: "PROCEDURE_STATUS_ENTERED",
        triggerConfig: { status: "PUBLISHED" },
        actionType: "SEND_NOTIFICATION",
        actionConfig: { title: "x", recipients: "OWNER" },
        createdById: t.admin.id,
      },
    });
    const p = await t.createProcedure();

    await runStatusAutomations(t.tenant.id, p.id, "PUBLISHED", "step-disabled");
    expect(await runsFor(rule.id)).toHaveLength(0);
  });
});

describe("runCommentAddedAutomations — event-driven (3.4), real dedup via the comment's own id as fireKey (3.5)", () => {
  it("fires for an enabled COMMENT_ADDED rule when a comment is posted on a matching procedure", async () => {
    const rule = await createRule({ triggerType: "COMMENT_ADDED" });
    const p = await t.createProcedure();

    await runCommentAddedAutomations(t.tenant.id, p.id, "comment-1");

    const runs = await runsFor(rule.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("SUCCESS");
    expect(runs[0].entityType).toBe("Procedure");
    expect(runs[0].entityId).toBe(p.id);
  });

  it("the same comment id never fires a rule twice", async () => {
    const rule = await createRule({ triggerType: "COMMENT_ADDED" });
    const p = await t.createProcedure();

    await runCommentAddedAutomations(t.tenant.id, p.id, "comment-dup");
    await runCommentAddedAutomations(t.tenant.id, p.id, "comment-dup");

    expect(await runsFor(rule.id)).toHaveLength(1);
  });
});

describe("runTimeBasedAutomations — REVIEW_DATE_DUE and ACK_CAMPAIGN_AGE, real dedup via a stable fireKey", () => {
  it("REVIEW_DATE_DUE fires once for an overdue PUBLISHED procedure, and a second scan does not double-fire (@@unique([ruleId, entityId, fireKey]))", async () => {
    const rule = await createRule({ triggerType: "REVIEW_DATE_DUE" });
    const overdue = await t.createProcedure({ status: "PUBLISHED" });
    await prisma.procedure.update({
      where: { id: overdue.id },
      data: { nextReviewDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    });

    await runTimeBasedAutomations();
    await runTimeBasedAutomations();

    expect(await runsFor(rule.id)).toHaveLength(1);

    // runTimeBasedAutomations scans every PUBLISHED+overdue procedure in the
    // tenant for a REVIEW_DATE_DUE rule, not just the one this test created —
    // clear the overdue date so later tests in this shared tenant/fixture
    // don't pick this procedure up too.
    await prisma.procedure.update({ where: { id: overdue.id }, data: { nextReviewDate: null } });
  });

  it("REVIEW_DATE_DUE does not fire for a procedure whose review date is in the future", async () => {
    const rule = await createRule({ triggerType: "REVIEW_DATE_DUE" });
    const future = await t.createProcedure({ status: "PUBLISHED" });
    await prisma.procedure.update({
      where: { id: future.id },
      data: { nextReviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    await runTimeBasedAutomations();
    expect(await runsFor(rule.id)).toHaveLength(0);
  });

  it("ACK_CAMPAIGN_AGE fires once for a campaign open past the configured day threshold, and a repeat scan does not double-fire", async () => {
    const rule = await createRule({ triggerType: "ACK_CAMPAIGN_AGE", triggerConfig: { days: 7 } });
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
    expect(campaign.completedAt).toBeNull();

    await runTimeBasedAutomations();
    await runTimeBasedAutomations();

    expect(await runsFor(rule.id)).toHaveLength(1);
  });
});
