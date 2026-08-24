import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { DepartmentRole, GlobalRole } from "@prisma/client";

/**
 * Builds an isolated Tenant + Department + a set of Users for one test
 * file to run against the real dev database without touching seeded demo
 * data. `cleanup()` deletes the Tenant, which cascades to every row created
 * under it (every tenantId relation in schema.prisma is onDelete: Cascade) —
 * so tests never need to hand-delete each fixture individually.
 */
export async function createTestTenant() {
  const suffix = randomUUID().slice(0, 8);

  const tenant = await prisma.tenant.create({
    data: { slug: `vitest-${suffix}`, name: `Vitest Fixture ${suffix}` },
  });

  const department = await prisma.department.create({
    data: { tenantId: tenant.id, name: "Test Department", slug: "test-department" },
  });

  async function createUser(opts: { email: string; globalRole?: GlobalRole; deptRole?: DepartmentRole }) {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: opts.email,
        name: opts.email.split("@")[0],
        globalRole: opts.globalRole ?? "USER",
        isActive: true,
      },
    });
    if (opts.deptRole) {
      await prisma.departmentMembership.create({
        data: { userId: user.id, departmentId: department.id, role: opts.deptRole },
      });
    }
    return user;
  }

  const admin = await createUser({ email: `admin-${suffix}@test.local`, globalRole: "ADMIN" });
  const compliance = await createUser({ email: `compliance-${suffix}@test.local`, globalRole: "COMPLIANCE_OFFICER" });
  const owner = await createUser({ email: `owner-${suffix}@test.local`, deptRole: "DEPARTMENT_OWNER" });
  const editor = await createUser({ email: `editor-${suffix}@test.local`, deptRole: "EDITOR" });
  const viewer = await createUser({ email: `viewer-${suffix}@test.local`, deptRole: "VIEWER" });
  const outsider = await createUser({ email: `outsider-${suffix}@test.local` }); // no department membership at all

  /** Minimal DRAFT procedure with a current version, owned by `owner`. */
  async function createProcedure(opts?: {
    isCritical?: boolean;
    visibility?: "PUBLIC" | "DEPARTMENT" | "RESTRICTED";
    status?: "DRAFT" | "IN_REVIEW" | "COMPLIANCE_APPROVAL" | "MANAGEMENT_APPROVAL" | "PUBLISHED" | "ARCHIVED" | "REJECTED";
    requiresAck?: boolean;
    tagNames?: string[];
  }) {
    const code = `TST-${randomUUID().slice(0, 8).toUpperCase()}`;
    const procedure = await prisma.procedure.create({
      data: {
        tenantId: tenant.id,
        departmentId: department.id,
        code,
        title: `Test procedure ${code}`,
        authorId: editor.id,
        ownerId: owner.id,
        isCritical: opts?.isCritical ?? false,
        visibility: opts?.visibility ?? "DEPARTMENT",
        status: opts?.status ?? "DRAFT",
        requiresAck: opts?.requiresAck ?? false,
      },
    });

    const version = await prisma.procedureVersion.create({
      data: {
        procedureId: procedure.id,
        versionNumber: 1,
        contentJson: { type: "doc", content: [] },
        contentHtml: "<p>Test content</p>",
        authorId: editor.id,
      },
    });
    await prisma.procedure.update({ where: { id: procedure.id }, data: { currentVersionId: version.id } });

    if (opts?.tagNames?.length) {
      for (const name of opts.tagNames) {
        const tag = await prisma.tag.upsert({
          where: { tenantId_name: { tenantId: tenant.id, name } },
          create: { tenantId: tenant.id, name },
          update: {},
        });
        await prisma.procedureTag.create({ data: { procedureId: procedure.id, tagId: tag.id } });
      }
    }

    return prisma.procedure.findUniqueOrThrow({ where: { id: procedure.id } });
  }

  async function cleanup() {
    // ProcedureVersion.authorId -> User has no onDelete:Cascade (versions are
    // immutable audit records, deliberately not auto-orphaned by a user
    // deletion elsewhere in the app) — so a plain `tenant.delete()` can race
    // Postgres's own cascade ordering between "delete these Users" and
    // "delete these Procedures/Versions" and hit that FK. Delete procedures
    // (and everything cascading from them, including versions) explicitly
    // first so no User row is still referenced when the tenant cascade reaches it.
    await prisma.procedure.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }

  return { tenant, department, admin, compliance, owner, editor, viewer, outsider, createUser, createProcedure, cleanup };
}

export type TestTenant = Awaited<ReturnType<typeof createTestTenant>>;
