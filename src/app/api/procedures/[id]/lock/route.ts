import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canPublishProcedure } from "@/lib/permissions";

const schema = z.object({ locked: z.boolean() });

/**
 * "Blocca pagina" / "Sblocca pagina" (page-options menu). Same permission
 * as publishing (Department Owner/Admin) — a lock is a governance action,
 * not a plain edit, so the bar to set or lift one is higher than
 * canEditProcedure. Once set, canMutateProcedureContent() (lib/permissions)
 * freezes every content-mutating route (blocks CRUD, the legacy version
 * PATCH, real-time collab) for everyone below that bar.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const existing = await prisma.procedure.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canPublishProcedure({ id: userId, tenantId, globalRole }, existing.departmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { locked } = parsed.data;

  if (locked === existing.isLocked) {
    return NextResponse.json({ procedure: existing }); // idempotent, no-op audit noise
  }

  const procedure = await prisma.$transaction(async (tx) => {
    const updated = await tx.procedure.update({ where: { id: params.id }, data: { isLocked: locked } });
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: "UPDATE",
        entityType: "Procedure",
        entityId: params.id,
        procedureId: params.id,
        metadata: { field: "isLocked", value: locked },
      },
    });
    return updated;
  });

  return NextResponse.json({ procedure });
}
