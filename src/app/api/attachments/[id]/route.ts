import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure } from "@/lib/permissions";
import { storage } from "@/lib/storage";

/** Deletes an attachment — same edit permission as adding one (department EDITOR/DEPARTMENT_OWNER or tenant ADMIN). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { procedure: true },
  });
  if (!attachment || attachment.procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canEdit = await canEditProcedure({ id: userId, tenantId, globalRole }, attachment.procedure.departmentId);
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Best-effort on the object store: a delete that fails to remove the row
  // because the bucket blipped is worse than a dangling object left behind.
  if (storage.isStorageConfigured()) {
    try {
      await storage.deleteObject(attachment.storageKey);
    } catch {
      // swallow — the DB row is the source of truth for "does this attachment exist"
    }
  }

  await prisma.attachment.delete({ where: { id: attachment.id } });

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId: userId,
      action: "DELETE",
      entityType: "Attachment",
      entityId: attachment.id,
      procedureId: attachment.procedureId,
      metadata: { fileName: attachment.fileName },
    },
  });

  return NextResponse.json({ success: true });
}
