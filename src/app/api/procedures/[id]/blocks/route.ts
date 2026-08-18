import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { BlockType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure, canViewProcedure } from "@/lib/permissions";
import { buildBlockTree } from "@/lib/blocks/tree";
import { createBlocksFromProseMirrorDoc, type PMNode } from "@/lib/blocks/from-prosemirror";
import { blockParentWhere, blockParentCreateData } from "@/lib/blocks/parent";

const createSchema = z.object({
  type: z.nativeEnum(BlockType),
  content: z.any(),
  parentBlockId: z.string().nullable().optional(),
  sortOrder: z.number().int(),
});

/** Returns the procedure's blocks as a nested tree, ordered by sortOrder within each level. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const allowed = await canViewProcedure({ id: userId, tenantId, globalRole }, params.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const procedure = await prisma.procedure.findUnique({
    where: { id: params.id },
    include: { currentVersion: { select: { contentJson: true } } },
  });
  if (!procedure || procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parent = blockParentWhere(procedure);
  let blocks = await prisma.block.findMany({ where: parent });
  if (blocks.length === 0 && procedure.currentVersion) {
    // Lazy backfill: procedures created via POST /api/procedures get a
    // ProcedureVersion but no Block rows (that route predates this phase) —
    // same conversion scripts/migrate-to-blocks.ts used for pre-existing
    // procedures. Known race: two concurrent first-opens of the same
    // never-migrated procedure could both backfill and duplicate blocks;
    // acceptable for Phase 1, not worth a DB-level lock for this edge case.
    // (For a Fase-3 page-linked procedure this is effectively unreachable —
    // promotion never links an empty page — but the branch stays correct either way.)
    await createBlocksFromProseMirrorDoc(prisma, tenantId, parent, procedure.currentVersion.contentJson as PMNode | null);
    blocks = await prisma.block.findMany({ where: parent });
  }

  return NextResponse.json({ blocks: buildBlockTree(blocks) });
}

/** Creates one new block (root or nested, per parentBlockId). */
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

  const allowed = await canEditProcedure({ id: userId, tenantId, globalRole }, existing.departmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const block = await prisma.$transaction(async (tx) => {
    const created = await tx.block.create({
      data: {
        tenantId,
        ...blockParentCreateData(existing),
        parentBlockId: data.parentBlockId ?? null,
        type: data.type,
        content: data.content,
        sortOrder: data.sortOrder,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: "CREATE",
        entityType: "Block",
        entityId: created.id,
        procedureId: params.id,
        metadata: { type: created.type },
      },
    });

    return created;
  });

  return NextResponse.json({ block });
}
