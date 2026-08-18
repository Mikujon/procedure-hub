import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure } from "@/lib/permissions";
import { buildBlockTree } from "@/lib/blocks/tree";
import { blocksToProseMirrorDoc } from "@/lib/blocks/serialize";

const schema = z.object({
  departmentId: z.string(),
  code: z.string().min(2),
  type: z.enum(["PROCEDURE", "WORK_INSTRUCTION", "POLICY", "SOP", "FORM", "TEMPLATE", "FAQ"]),
  requiresAck: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "DEPARTMENT", "RESTRICTED"]).optional(),
});

/**
 * "Rendi Pagina Ufficiale" — the step that turns a free Page into a
 * Documento Controllato (Fase 3). Creates a Procedure linked via pageId and
 * an initial ProcedureVersion serialized from the page's *existing* blocks
 * — the content is never recreated or duplicated, only the same Block rows
 * gain governance (workflow, versioning, Read & Ack) on top.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const page = await prisma.page.findFirst({
    where: { id: params.id, tenantId },
    include: { procedure: { select: { id: true } } },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.procedure) {
    return NextResponse.json({ error: "Questa pagina è già un Documento Controllato" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const allowed = await canEditProcedure({ id: userId, tenantId, globalRole }, data.departmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const blocks = await prisma.block.findMany({ where: { pageId: page.id } });
  const { json, html } = blocksToProseMirrorDoc(buildBlockTree(blocks));

  try {
    const procedure = await prisma.$transaction(async (tx) => {
      const created = await tx.procedure.create({
        data: {
          tenantId,
          departmentId: data.departmentId,
          pageId: page.id,
          code: data.code,
          title: page.title,
          type: data.type,
          requiresAck: data.requiresAck ?? false,
          isCritical: data.isCritical ?? false,
          visibility: data.visibility ?? "DEPARTMENT",
          authorId: userId,
          ownerId: userId,
          status: "DRAFT",
        },
      });

      const version = await tx.procedureVersion.create({
        data: {
          procedureId: created.id,
          versionNumber: 1,
          contentJson: json,
          contentHtml: html,
          authorId: userId,
          changelog: "Promossa da pagina libera a Documento Controllato",
        },
      });

      const updated = await tx.procedure.update({ where: { id: created.id }, data: { currentVersionId: version.id } });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: userId,
          action: "CREATE",
          entityType: "Procedure",
          entityId: created.id,
          procedureId: created.id,
          metadata: { source: "promoted_from_page", pageId: page.id },
        },
      });

      return updated;
    });

    return NextResponse.json({ procedure }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: `Esiste già una procedura con il codice "${data.code}". Scegli un codice diverso.` },
        { status: 409 }
      );
    }
    throw err;
  }
}
