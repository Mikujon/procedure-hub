import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure } from "@/lib/permissions";
import { storage } from "@/lib/storage";
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  extensionOf,
  isAllowedAttachmentType,
  contentTypeForExtension,
  buildAttachmentStorageKey,
} from "@/lib/attachments";

const schema = z.object({
  procedureId: z.string(),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_SIZE_BYTES),
});

/**
 * Presigned-upload flow (roadmap item #1): the browser never streams the
 * file through this route. This endpoint validates permission + file
 * constraints, creates the Attachment row, and hands back a short-lived
 * presigned PUT URL that the client uploads the bytes to directly — see
 * AttachmentUploader.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!storage.isStorageConfigured()) {
    return NextResponse.json(
      { error: "Object storage non configurato (STORAGE_BUCKET / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY mancanti)." },
      { status: 503 }
    );
  }

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { procedureId, fileName, fileSizeBytes } = parsed.data;

  if (!isAllowedAttachmentType(fileName)) {
    return NextResponse.json({ error: `Tipo file non consentito: .${extensionOf(fileName) || "?"}` }, { status: 400 });
  }
  const fileType = extensionOf(fileName);

  const procedure = await prisma.procedure.findUnique({ where: { id: procedureId } });
  if (!procedure || procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canEdit = await canEditProcedure({ id: userId, tenantId, globalRole }, procedure.departmentId);
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const storageKey = buildAttachmentStorageKey(tenantId, procedureId, fileType);

  const attachment = await prisma.attachment.create({
    data: { procedureId, fileName, fileType, fileSizeBytes, storageKey, uploadedById: userId },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId: userId,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      procedureId,
      metadata: { fileName, fileSizeBytes },
    },
  });

  const uploadUrl = await storage.getUploadUrl(storageKey, contentTypeForExtension(fileType));

  return NextResponse.json({ attachment, uploadUrl });
}
