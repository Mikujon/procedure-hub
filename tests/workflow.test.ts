import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { submitForReview, decideWorkflowStep, archiveProcedure } from "@/lib/workflow";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

let t: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
});

afterAll(async () => {
  await t.cleanup();
});

/** Latest (only, in these tests) PENDING WorkflowStep for a procedure. */
async function pendingStep(procedureId: string) {
  return prisma.workflowStep.findFirstOrThrow({
    where: { procedureId, status: "PENDING" },
    orderBy: { id: "desc" },
  });
}

describe("submitForReview", () => {
  it("moves a DRAFT procedure to IN_REVIEW, creates a PENDING WorkflowStep and an AuditLog row", async () => {
    const p = await t.createProcedure();

    const nextStage = await submitForReview(p.id, t.editor.id);
    expect(nextStage).toBe("IN_REVIEW");

    const updated = await prisma.procedure.findUniqueOrThrow({ where: { id: p.id } });
    expect(updated.status).toBe("IN_REVIEW");

    const step = await pendingStep(p.id);
    expect(step.stage).toBe("IN_REVIEW");

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { procedureId: p.id, action: "UPDATE" },
    });
    expect(log.actorId).toBe(t.editor.id);
    expect((log.metadata as any).transition).toBe("DRAFT -> IN_REVIEW");
  });
});

describe("decideWorkflowStep — non-critical, no compliance tag", () => {
  it("skips COMPLIANCE_APPROVAL entirely: IN_REVIEW approval goes straight to MANAGEMENT_APPROVAL, then to PUBLISHED", async () => {
    const p = await t.createProcedure();
    await submitForReview(p.id, t.editor.id);

    const step1 = await pendingStep(p.id);
    const afterFirst = await decideWorkflowStep(step1.id, t.owner.id, "APPROVED");
    expect(afterFirst).toBe("MANAGEMENT_APPROVAL");
    expect((await prisma.procedure.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("MANAGEMENT_APPROVAL");

    const step2 = await pendingStep(p.id);
    expect(step2.stage).toBe("MANAGEMENT_APPROVAL");
    const afterSecond = await decideWorkflowStep(step2.id, t.owner.id, "APPROVED");
    expect(afterSecond).toBe("PUBLISHED");

    const published = await prisma.procedure.findUniqueOrThrow({ where: { id: p.id } });
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();

    // Reaching PUBLISHED must not leave a dangling PENDING step behind.
    const dangling = await prisma.workflowStep.findFirst({ where: { procedureId: p.id, status: "PENDING" } });
    expect(dangling).toBeNull();
  });

  it("REJECTED at any stage sets the procedure to REJECTED and records the decision on the step", async () => {
    const p = await t.createProcedure();
    await submitForReview(p.id, t.editor.id);
    const step = await pendingStep(p.id);

    const result = await decideWorkflowStep(step.id, t.owner.id, "REJECTED", "Manca la firma del DPO");
    expect(result).toBe("REJECTED");

    const updated = await prisma.procedure.findUniqueOrThrow({ where: { id: p.id } });
    expect(updated.status).toBe("REJECTED");

    const decided = await prisma.workflowStep.findUniqueOrThrow({ where: { id: step.id } });
    expect(decided.status).toBe("REJECTED");
    expect(decided.comment).toBe("Manca la firma del DPO");
    expect(decided.decidedAt).not.toBeNull();
  });
});

describe("decideWorkflowStep — critical procedures never skip COMPLIANCE_APPROVAL", () => {
  it("an isCritical procedure routes through COMPLIANCE_APPROVAL before MANAGEMENT_APPROVAL", async () => {
    const p = await t.createProcedure({ isCritical: true });
    await submitForReview(p.id, t.editor.id);

    const step1 = await pendingStep(p.id);
    const next = await decideWorkflowStep(step1.id, t.owner.id, "APPROVED");
    expect(next).toBe("COMPLIANCE_APPROVAL");
  });

  it("a non-critical procedure carrying a compliance tag (e.g. GDPR) also does not skip COMPLIANCE_APPROVAL", async () => {
    const p = await t.createProcedure({ isCritical: false, tagNames: ["GDPR"] });
    await submitForReview(p.id, t.editor.id);

    const step1 = await pendingStep(p.id);
    const next = await decideWorkflowStep(step1.id, t.owner.id, "APPROVED");
    expect(next).toBe("COMPLIANCE_APPROVAL");
  });
});

describe("archiveProcedure", () => {
  it("sets status ARCHIVED with archivedAt, and writes an ARCHIVE AuditLog row", async () => {
    const p = await t.createProcedure({ status: "PUBLISHED" });

    await archiveProcedure(p.id, t.admin.id);

    const updated = await prisma.procedure.findUniqueOrThrow({ where: { id: p.id } });
    expect(updated.status).toBe("ARCHIVED");
    expect(updated.archivedAt).not.toBeNull();

    const log = await prisma.auditLog.findFirstOrThrow({ where: { procedureId: p.id, action: "ARCHIVE" } });
    expect(log.actorId).toBe(t.admin.id);
  });
});

describe("ProcedureVersion immutability (rule 3)", () => {
  it("an edit never mutates an existing version row — it must be a new row with an incremented versionNumber", async () => {
    const p = await t.createProcedure();
    const v1 = await prisma.procedureVersion.findUniqueOrThrow({
      where: { procedureId_versionNumber: { procedureId: p.id, versionNumber: 1 } },
    });

    const v2 = await prisma.procedureVersion.create({
      data: {
        procedureId: p.id,
        versionNumber: 2,
        contentJson: { type: "doc", content: [] },
        contentHtml: "<p>Edited content</p>",
        authorId: t.editor.id,
      },
    });
    await prisma.procedure.update({ where: { id: p.id }, data: { currentVersionId: v2.id } });

    // v1 must still exist, untouched, not replaced.
    const v1Reloaded = await prisma.procedureVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(v1Reloaded.contentHtml).toBe("<p>Test content</p>");

    const versions = await prisma.procedureVersion.findMany({ where: { procedureId: p.id }, orderBy: { versionNumber: "asc" } });
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2]);

    const current = await prisma.procedure.findUniqueOrThrow({ where: { id: p.id } });
    expect(current.currentVersionId).toBe(v2.id);
  });
});
