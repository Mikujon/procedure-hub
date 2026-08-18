import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, "La nuova password deve avere almeno 10 caratteri."),
});

/**
 * Self-service password change — the counterpart to admin-provisioned
 * accounts (POST /api/admin/users): requires the current password even when
 * it's the temporary one the admin generated, since that's the only proof
 * of authorization for this action, same reasoning as an SSO-less first
 * login. Clears mustChangePassword on success.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const parsed = changePasswordSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "Account non gestito con password (SSO)." }, { status: 400 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Password attuale non corretta." }, { status: 401 });

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash, mustChangePassword: false },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: userId,
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      metadata: { field: "password" },
    },
  });

  return NextResponse.json({ success: true });
}
