import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { BlockType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace, canEditProcedure } from "@/lib/permissions";
import { buildBlockTree } from "@/lib/blocks/tree";
import { createBlocksFromProseMirrorDoc, type PMNode } from "@/lib/blocks/from-prosemirror";

/** Same pattern as src/app/api/pages/[id]/route.ts. */
function actor(session: any) {
  return {
    id: session.user.id as string,
    tenantId: session.user.tenantId as string,
    globalRole: session.user.globalRole,
  };
}

const createSchema = z.object({
  type: z.nativeEnum(BlockType),
  content: z.any(),
  parentBlockId: z.string().nullable().optional(),
  sortOrder: z.number().int(),
});

/**
 * Returns the page's blocks as a nested tree — mirrors
 * GET /api/procedures/[id]/blocks (Fase 1), including the lazy backfill
 * (Fase 2b: pages migrated via scripts/migrate-pages-to-blocks.ts already
 * have Block rows; pages created before that script ran, or via
 * POST /api/pages before Fase 2b, backfill from Page.content on first read).
 * Read is any tenant member, same as GET /api/pages/[id] — Page has no
 * per-item visibility of its own yet.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;

  const page = await prisma.page.findFirst({ where: { id: params.id, tenantId } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let blocks = await prisma.block.findMany({ where: { pageId: params.id } });
  if (blocks.length === 0 && page.content) {
    // Same known race as the Procedure lazy backfill: acceptable for this phase.
    await createBlocksFromProseMirrorDoc(prisma, tenantId, { pageId: params.id }, page.content as unknown as PMNode | null);
    blocks = await prisma.block.findMany({ where: { pageId: params.id } });
  }

  return NextResponse.json({ blocks: buildBlockTree(blocks) });
}

/** Creates one new block (root or nested, per parentBlockId) on a free Page. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;

  const page = await prisma.page.findFirst({ where: { id: params.id, tenantId }, include: { procedure: true } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A page promoted to a governed Procedure (Fase 3) needs the same
  // department-based edit rule as any other procedure content — a free
  // page's looser workspace-wide check would otherwise leak through.
  const allowed = page.procedure
    ? await canEditProcedure(actor(session), page.procedure.departmentId)
    : await canEditWorkspace(actor(session));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const userId = (session.user as any).id as string;

  const block = await prisma.$transaction(async (tx) => {
    const created = await tx.block.create({
      data: {
        tenantId,
        pageId: params.id,
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
        metadata: { type: created.type, pageId: params.id },
      },
    });

    return created;
  });

  return NextResponse.json({ block });
}
