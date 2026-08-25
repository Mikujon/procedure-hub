import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * A minimal, self-contained scratch tenant for E2E specs — deliberately
 * separate from tests/helpers/test-tenant.ts (the Vitest integration
 * fixture) rather than reused: that helper's users have no passwordHash
 * (its tests call lib/ functions directly, never sign in for real), which
 * is exactly what a browser-driven login needs. Same cleanup discipline:
 * deleting the Tenant cascades everything created under it.
 */
const PASSWORD = "e2e-test-password-123!";

export async function createE2eFixture() {
  const suffix = randomUUID().slice(0, 8);

  const tenant = await prisma.tenant.create({
    data: { slug: `pw-${suffix}`, name: `Playwright Fixture ${suffix}` },
  });
  const department = await prisma.department.create({
    data: { tenantId: tenant.id, name: "Reparto Riservato", slug: `reparto-riservato-${suffix}` },
  });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  async function createUser(email: string, deptRole?: "VIEWER" | "EDITOR" | "DEPARTMENT_OWNER") {
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email, name: email.split("@")[0], globalRole: "USER", isActive: true, passwordHash },
    });
    if (deptRole) {
      await prisma.departmentMembership.create({ data: { userId: user.id, departmentId: department.id, role: deptRole } });
    }
    return user;
  }

  const member = await createUser(`member-${suffix}@e2e.local`, "VIEWER");
  const outsider = await createUser(`outsider-${suffix}@e2e.local`);

  const title = `Procedura Riservata E2E ${suffix}`;
  const procedure = await prisma.procedure.create({
    data: {
      tenantId: tenant.id,
      departmentId: department.id,
      code: `E2E-${suffix.toUpperCase()}`,
      title,
      authorId: member.id,
      ownerId: member.id,
      visibility: "RESTRICTED",
      status: "PUBLISHED",
    },
  });
  const version = await prisma.procedureVersion.create({
    data: {
      procedureId: procedure.id,
      versionNumber: 1,
      contentJson: { type: "doc", content: [] },
      contentHtml: "<p>Contenuto riservato.</p>",
      authorId: member.id,
    },
  });
  await prisma.procedure.update({ where: { id: procedure.id }, data: { currentVersionId: version.id } });

  async function cleanup() {
    await prisma.procedure.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }

  return { tenant, department, member, outsider, procedure: { ...procedure, title }, password: PASSWORD, cleanup };
}

export type E2eFixture = Awaited<ReturnType<typeof createE2eFixture>>;
