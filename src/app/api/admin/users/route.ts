import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  globalRole: z.enum(["USER", "COMPLIANCE_OFFICER", "ADMIN"]).default("USER"),
  departmentId: z.string().optional(),
  departmentRole: z.enum(["VIEWER", "EDITOR", "DEPARTMENT_OWNER"]).default("VIEWER"),
});

/**
 * Generates a temporary password for an admin-provisioned account. Returned
 * once in the API response (never stored in plaintext, never logged) so the
 * admin can relay it out-of-band; the account is created with
 * mustChangePassword=true so this value can never become the permanent
 * password (see POST /api/me/password).
 */
function generateTemporaryPassword(): string {
  return crypto.randomBytes(12).toString("base64url");
}

/** Admin-only. Creates a user with a generated temporary password (SEC-05 / ADO-01 remediation — no provisioning path existed before this). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canManageUsers({ id: actorId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Solo un amministratore può creare utenti." }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;
  const email = data.email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) {
    return NextResponse.json({ error: "Esiste già un utente con questa email in questo tenant." }, { status: 409 });
  }

  if (data.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!department || department.tenantId !== tenantId) {
      return NextResponse.json({ error: "Dipartimento non valido." }, { status: 400 });
    }
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        tenantId,
        name: data.name,
        email,
        passwordHash,
        globalRole: data.globalRole,
        mustChangePassword: true,
      },
    });

    if (data.departmentId) {
      await tx.departmentMembership.create({
        data: { userId: created.id, departmentId: data.departmentId, role: data.departmentRole },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId,
        action: "CREATE",
        entityType: "User",
        entityId: created.id,
        metadata: { email, globalRole: data.globalRole, departmentId: data.departmentId ?? null },
      },
    });

    return created;
  });

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, globalRole: user.globalRole },
    temporaryPassword,
  });
}
