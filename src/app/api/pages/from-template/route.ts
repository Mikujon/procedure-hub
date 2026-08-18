import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";
import type { BlockType } from "@prisma/client";

const schema = z.object({
  templateId: z.string(),
  parentId: z.string().nullable().optional(),
});

type TemplateNode = { type: BlockType; content: unknown; children?: TemplateNode[] };

/**
 * Clones a template's block-tree mold into real Block rows for a fresh
 * page — new ids, pageId set, sortOrder assigned per sibling group. This is
 * a template-clone, not a ProseMirror-doc import, so it doesn't reuse
 * from-prosemirror.ts (different source shape).
 */
async function cloneBlocks(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string,
  pageId: string,
  nodes: TemplateNode[],
  parentBlockId: string | null
) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const block = await tx.block.create({
      data: {
        tenantId,
        pageId,
        parentBlockId,
        type: node.type,
        content: node.content as any,
        sortOrder: i,
      },
      select: { id: true },
    });
    if (node.children?.length) {
      await cloneBlocks(tx, tenantId, pageId, node.children, block.id);
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canEditWorkspace({ id: userId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Non hai i permessi per creare pagine." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const template = await prisma.template.findFirst({
    where: { id: parsed.data.templateId, OR: [{ tenantId: null }, { tenantId }] },
  });
  if (!template || !template.blockTemplate) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.page.findFirst({ where: { id: parsed.data.parentId, tenantId }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 });
  }

  const siblingCount = await prisma.page.count({ where: { tenantId, parentId: parsed.data.parentId ?? null } });

  const page = await prisma.$transaction(async (tx) => {
    const created = await tx.page.create({
      data: {
        tenantId,
        parentId: parsed.data.parentId ?? null,
        title: template.name,
        icon: template.icon,
        templateId: template.id,
        sortOrder: siblingCount,
        createdById: userId,
      },
      select: { id: true, parentId: true, title: true, icon: true },
    });

    await cloneBlocks(tx, tenantId, created.id, template.blockTemplate as unknown as TemplateNode[], null);

    // trackingDatabaseId (auto-tracking row in a linked Database) is schema-
    // ready but not wired up: DatabaseRow has no field to link back to a
    // Page, and none of the 5 built-in templates set trackingDatabaseId.
    // Deferred until a real template needs it.

    return created;
  });

  return NextResponse.json({ page }, { status: 201 });
}
