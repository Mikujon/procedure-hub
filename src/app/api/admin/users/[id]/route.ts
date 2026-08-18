import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";

const updateSchema = z.object({
  jobRoleId: z.string().nullable().optional(),
});

/** Admin-only. Currently only assigns JobRole (Fase 3a) — grows as user-management UI grows. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canManageUsers({ id: actorId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Solo un amministratore può modificare gli utenti." }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target || target.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  if (data.jobRoleId) {
    const jobRole = await prisma.jobRole.findUnique({ where: { id: data.jobRoleId } });
    if (!jobRole || jobRole.tenantId !== tenantId) {
      return NextResponse.json({ error: "Mansione non valida." }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { jobRoleId: data.jobRoleId === undefined ? undefined : data.jobRoleId },
    select: { id: true, name: true, email: true, jobTitle: true, jobRoleId: true },
  });

  return NextResponse.json({ user });
}
