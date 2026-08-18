import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure } from "@/lib/permissions";
import { storage } from "@/lib/storage";

// Matches the fileType comment on the Attachment model in schema.prisma.
const ALLOWED_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg", "mp4", "zip", "txt", "csv"];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const schema = z.object({
  procedureId: z.string(),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

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

  const fileType = extensionOf(fileName);
  if (!ALLOWED_EXTENSIONS.includes(fileType)) {
    return NextResponse.json({ error: `Tipo file non consentito: .${fileType || "?"}` }, { status: 400 });
  }

  const procedure = await prisma.procedure.findUnique({ where: { id: procedureId } });
  if (!procedure || procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canEdit = await canEditProcedure({ id: userId, tenantId, globalRole }, procedure.departmentId);
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Not derived from the user-supplied fileName alone — collisions and path
  // traversal (../, absolute paths) both go away by keying storage on a
  // fresh id, while the original name is kept only as display metadata.
  const storageKey = `${tenantId}/${procedureId}/${randomUUID()}.${fileType}`;

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

  const uploadUrl = await storage.getUploadUrl(storageKey, contentTypeFor(fileType));

  return NextResponse.json({ attachment, uploadUrl });
}

function contentTypeFor(extension: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    mp4: "video/mp4",
    zip: "application/zip",
    txt: "text/plain",
    csv: "text/csv",
  };
  return map[extension] ?? "application/octet-stream";
}
