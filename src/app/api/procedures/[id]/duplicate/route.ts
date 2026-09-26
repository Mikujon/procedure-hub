import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure, canViewProcedure } from "@/lib/permissions";
import { buildBlockTree, type BlockWithChildren } from "@/lib/blocks/tree";
import { blockParentWhere } from "@/lib/blocks/parent";
import { blocksToProseMirrorDoc } from "@/lib/blocks/serialize";
import { createBlocksFromProseMirrorDoc, type PMNode } from "@/lib/blocks/from-prosemirror";
import type { Prisma } from "@prisma/client";

/** Inserts a copy of `nodes` (and their children, recursively) as new Block rows under `newParentBlockId` — same sortOrder as the source, brand new ids so the source tree is left untouched. */
async function copyBlockTree(
  tx: Prisma.TransactionClient,
  tenantId: string,
  createData: { procedureId: string | null; pageId: string | null },
  nodes: BlockWithChildren[],
  newParentBlockId: string | null
) {
  for (const node of nodes) {
    const created = await tx.block.create({
      data: {
        tenantId,
        ...createData,
        parentBlockId: newParentBlockId,
        type: node.type,
        content: node.content as Prisma.InputJsonValue,
        sortOrder: node.sortOrder,
      },
    });
    if (node.children.length > 0) {
      await copyBlockTree(tx, tenantId, createData, node.children, created.id);
    }
  }
}

/**
 * "Duplica" (page-options menu). Copies the source procedure's live block
 * tree (not just its last published contentHtml — an unpublished draft's
 * in-progress edits get duplicated too) into a brand new DRAFT procedure in
 * the same department/process/parent, plus an initial v1 ProcedureVersion
 * serialized from that same copy so the duplicate reads correctly even
 * before its first publish (same pattern as promote-to-procedure). History
 * (versions, comments, acknowledgments, workflow steps, attachments) is
 * intentionally NOT copied — a duplicate starts clean, same as creating any
 * other new procedure. A locked source can still be duplicated — locking
 * freezes edits to that procedure, not reads of it.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  const actor = { id: userId, tenantId, globalRole };

  const canView = await canViewProcedure(actor, params.id);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const source = await prisma.procedure.findUnique({ where: { id: params.id } });
  if (!source || source.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canEditProcedure(actor, source.departmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parentWhere = blockParentWhere(source);
  let sourceBlocks = await prisma.block.findMany({ where: parentWhere });
  if (sourceBlocks.length === 0) {
    // Same lazy backfill as GET /api/procedures/[id]/blocks — a procedure
    // created via the legacy POST /api/procedures (or seeded directly, like
    // prisma/seed.ts) has a ProcedureVersion but no Block rows until the
    // block editor is opened once. Duplicating it must not silently copy
    // zero blocks just because nobody has opened it in the editor yet.
    const withVersion = await prisma.procedure.findUnique({
      where: { id: source.id },
      include: { currentVersion: { select: { contentJson: true } } },
    });
    if (withVersion?.currentVersion) {
      await createBlocksFromProseMirrorDoc(prisma, tenantId, parentWhere, withVersion.currentVersion.contentJson as PMNode | null);
      sourceBlocks = await prisma.block.findMany({ where: parentWhere });
    }
  }
  const tree = buildBlockTree(sourceBlocks);
  const { json, html } = blocksToProseMirrorDoc(tree);
  const sourceTags = await prisma.procedureTag.findMany({ where: { procedureId: source.id }, select: { tagId: true } });

  // Codes are unique per tenant (@@unique([tenantId, code])) — try "-COPY",
  // then "-COPY-2", "-COPY-3", ... rather than making the user pick one, up
  // to a sane bound so a runaway loop can't hang the request.
  for (let attempt = 1; attempt <= 25; attempt++) {
    const code = attempt === 1 ? `${source.code}-COPY` : `${source.code}-COPY-${attempt}`;
    try {
      const procedure = await prisma.$transaction(async (tx) => {
        const created = await tx.procedure.create({
          data: {
            tenantId,
            departmentId: source.departmentId,
            processId: source.processId,
            parentId: source.parentId,
            code,
            title: `${source.title} (copia)`,
            summary: source.summary,
            type: source.type,
            requiresAck: source.requiresAck,
            isCritical: source.isCritical,
            visibility: source.visibility,
            authorId: userId,
            ownerId: userId,
            status: "DRAFT",
            tags: sourceTags.length > 0 ? { create: sourceTags.map((t) => ({ tagId: t.tagId })) } : undefined,
          },
        });

        await copyBlockTree(tx, tenantId, { procedureId: created.id, pageId: null }, tree, null);

        const version = await tx.procedureVersion.create({
          data: {
            procedureId: created.id,
            versionNumber: 1,
            contentJson: json,
            contentHtml: html,
            authorId: userId,
            changelog: `Duplicata da "${source.title}" (${source.code})`,
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
            metadata: { source: "duplicate", duplicatedFromId: source.id },
          },
        });

        return updated;
      });

      return NextResponse.json({ procedure }, { status: 201 });
    } catch (err: any) {
      if (err?.code === "P2002" && attempt < 25) continue; // code taken — retry with the next suffix
      console.error("POST /api/procedures/[id]/duplicate failed:", err);
      return NextResponse.json({ error: "Errore interno durante la duplicazione della procedura." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Impossibile generare un codice univoco per la copia." }, { status: 500 });
}
