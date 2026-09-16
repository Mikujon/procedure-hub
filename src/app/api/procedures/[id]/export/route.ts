import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewProcedure } from "@/lib/permissions";
import { logProcedureExport } from "@/lib/audit";
import { extractExportBlocks } from "@/lib/export/content-blocks";
import { generateProcedurePdf } from "@/lib/export/pdf";
import { generateProcedureDocx } from "@/lib/export/docx";
import { generateProcedureXlsx } from "@/lib/export/xlsx";
import { slugify } from "@/lib/utils";

const CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * Exports the procedure's *current* content (currentVersion), not a
 * specific historical version — same scope as the main procedure page.
 * Distinct from GET /api/procedures/[id]/ack-certificate, which exports the
 * Read & Acknowledge compliance certificate, not the procedure content.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const format = req.nextUrl.searchParams.get("format");
  if (!format || !(format in CONTENT_TYPE)) {
    return NextResponse.json({ error: "format must be one of: pdf, docx, xlsx" }, { status: 400 });
  }

  const procedure = await prisma.procedure.findFirst({
    where: { id: params.id, tenantId },
    include: {
      department: true,
      currentVersion: true,
      tags: { include: { tag: true } },
      author: { select: { name: true } },
      owner: { select: { name: true } },
    },
  });
  if (!procedure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await canViewProcedure({ id: userId, tenantId, globalRole }, procedure.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!procedure.currentVersion) {
    return NextResponse.json({ error: "Procedure has no published content yet" }, { status: 400 });
  }

  const blocks = extractExportBlocks(procedure.currentVersion.contentJson as any);
  const tags = procedure.tags.map((t) => t.tag.name);

  let body: Uint8Array | Buffer;
  if (format === "pdf") {
    body = await generateProcedurePdf({
      title: procedure.title,
      code: procedure.code,
      departmentName: procedure.department.name,
      summary: procedure.summary,
      versionNumber: procedure.currentVersion.versionNumber,
      tags,
      blocks,
    });
  } else if (format === "docx") {
    body = await generateProcedureDocx({
      title: procedure.title,
      code: procedure.code,
      departmentName: procedure.department.name,
      summary: procedure.summary,
      versionNumber: procedure.currentVersion.versionNumber,
      tags,
      blocks,
    });
  } else {
    body = await generateProcedureXlsx({
      title: procedure.title,
      code: procedure.code,
      departmentName: procedure.department.name,
      status: procedure.status,
      summary: procedure.summary,
      versionNumber: procedure.currentVersion.versionNumber,
      authorName: procedure.author.name,
      ownerName: procedure.owner?.name ?? null,
      tags,
      reviewDate: procedure.reviewDate,
      nextReviewDate: procedure.nextReviewDate,
      blocks,
    });
  }

  const filename = `${procedure.code}-${slugify(procedure.title)}-v${procedure.currentVersion.versionNumber}.${format}`;

  await logProcedureExport({ tenantId, actorId: userId, procedureId: procedure.id, metadata: { format, fileName: filename } });

  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": CONTENT_TYPE[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
