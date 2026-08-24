import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  canViewProcedure,
  canEditProcedure,
  canPublishProcedure,
  canActOnComplianceStage,
  isTenantAdmin,
  canEditWorkspace,
} from "@/lib/permissions";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

let t: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
});

afterAll(async () => {
  await t.cleanup();
});

function actor(user: { id: string; globalRole: any }) {
  return { id: user.id, tenantId: t.tenant.id, globalRole: user.globalRole };
}

describe("canViewProcedure", () => {
  it("PUBLIC procedures are visible to anyone in the tenant, including a user with no department membership", async () => {
    const p = await t.createProcedure({ visibility: "PUBLIC" });
    expect(await canViewProcedure(actor(t.outsider), p.id)).toBe(true);
  });

  it("DEPARTMENT procedures require membership (any role)", async () => {
    const p = await t.createProcedure({ visibility: "DEPARTMENT" });
    expect(await canViewProcedure(actor(t.viewer), p.id)).toBe(true);
    expect(await canViewProcedure(actor(t.outsider), p.id)).toBe(false);
  });

  it("RESTRICTED procedures require membership, same as DEPARTMENT (membership is the explicit grant)", async () => {
    const p = await t.createProcedure({ visibility: "RESTRICTED" });
    expect(await canViewProcedure(actor(t.viewer), p.id)).toBe(true);
    expect(await canViewProcedure(actor(t.outsider), p.id)).toBe(false);
  });

  it("ADMIN bypasses visibility entirely, even RESTRICTED", async () => {
    const p = await t.createProcedure({ visibility: "RESTRICTED" });
    expect(await canViewProcedure(actor(t.admin), p.id)).toBe(true);
  });

  it("a procedure from another tenant is never visible, even to that tenant's admin acting with a mismatched tenantId", async () => {
    const other = await createTestTenant();
    try {
      const p = await other.createProcedure({ visibility: "PUBLIC" });
      // t.admin belongs to `t`, not `other` — canViewProcedure must reject on tenant mismatch alone.
      expect(await canViewProcedure(actor(t.admin), p.id)).toBe(false);
    } finally {
      await other.cleanup();
    }
  });
});

describe("canEditProcedure / canPublishProcedure", () => {
  it("VIEWER can neither edit nor publish", async () => {
    expect(await canEditProcedure(actor(t.viewer), t.department.id)).toBe(false);
    expect(await canPublishProcedure(actor(t.viewer), t.department.id)).toBe(false);
  });

  it("EDITOR can edit but not publish", async () => {
    expect(await canEditProcedure(actor(t.editor), t.department.id)).toBe(true);
    expect(await canPublishProcedure(actor(t.editor), t.department.id)).toBe(false);
  });

  it("DEPARTMENT_OWNER can edit and publish", async () => {
    expect(await canEditProcedure(actor(t.owner), t.department.id)).toBe(true);
    expect(await canPublishProcedure(actor(t.owner), t.department.id)).toBe(true);
  });

  it("a user with no membership in the department can neither edit nor publish", async () => {
    expect(await canEditProcedure(actor(t.outsider), t.department.id)).toBe(false);
    expect(await canPublishProcedure(actor(t.outsider), t.department.id)).toBe(false);
  });

  it("ADMIN bypasses department role for both edit and publish", async () => {
    expect(await canEditProcedure(actor(t.admin), t.department.id)).toBe(true);
    expect(await canPublishProcedure(actor(t.admin), t.department.id)).toBe(true);
  });

  it("rejects a department belonging to a different tenant, even for that tenant's own ADMIN (defense-in-depth against a caller that forgot to tenant-scope the departmentId)", async () => {
    const other = await createTestTenant();
    try {
      expect(await canEditProcedure(actor(t.admin), other.department.id)).toBe(false);
      expect(await canPublishProcedure(actor(t.admin), other.department.id)).toBe(false);
    } finally {
      await other.cleanup();
    }
  });
});

describe("canActOnComplianceStage / isTenantAdmin", () => {
  it("only ADMIN and COMPLIANCE_OFFICER can act on the compliance stage", () => {
    expect(canActOnComplianceStage(actor(t.admin))).toBe(true);
    expect(canActOnComplianceStage(actor(t.compliance))).toBe(true);
    expect(canActOnComplianceStage(actor(t.owner))).toBe(false);
    expect(canActOnComplianceStage(actor(t.editor))).toBe(false);
  });

  it("isTenantAdmin is true only for ADMIN", () => {
    expect(isTenantAdmin(actor(t.admin))).toBe(true);
    expect(isTenantAdmin(actor(t.compliance))).toBe(false);
    expect(isTenantAdmin(actor(t.owner))).toBe(false);
  });
});

describe("canEditWorkspace", () => {
  it("ADMIN and COMPLIANCE_OFFICER can always edit the workspace", async () => {
    expect(await canEditWorkspace(actor(t.admin))).toBe(true);
    expect(await canEditWorkspace(actor(t.compliance))).toBe(true);
  });

  it("a plain USER can edit only if they hold EDITOR/DEPARTMENT_OWNER in at least one department", async () => {
    expect(await canEditWorkspace(actor(t.editor))).toBe(true);
    expect(await canEditWorkspace(actor(t.owner))).toBe(true);
  });

  it("a pure VIEWER, or someone with no department membership, cannot edit the workspace", async () => {
    expect(await canEditWorkspace(actor(t.viewer))).toBe(false);
    expect(await canEditWorkspace(actor(t.outsider))).toBe(false);
  });
});
