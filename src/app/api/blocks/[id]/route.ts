import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { BlockType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditBlockParent } from "@/lib/permissions";

const updateSchema = z.object({
  type: z.nativeEnum(BlockType).optional(),
  content: z.any().optional(),
  sortOrder: z.number().int().optional(),
  parentBlockId: z.string().nullable().optional(),
});

/** Updates a block's content, type, or position (sortOrder/parentBlockId — drag & drop reorder). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const existing = await prisma.block.findUnique({
    where: { id: params.id },
    include: { procedure: true, page: { include: { procedure: true } } },
  });
  if (!existing || existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canEditBlockParent({ id: userId, tenantId, globalRole }, existing);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const block = await prisma.$transaction(async (tx) => {
    const updated = await tx.block.update({
      where: { id: params.id },
      data: {
        type: data.type ?? undefined,
        content: data.content ?? undefined,
        sortOrder: data.sortOrder ?? undefined,
        parentBlockId: "parentBlockId" in data ? data.parentBlockId : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: "UPDATE",
        entityType: "Block",
        entityId: params.id,
        procedureId: existing.procedureId,
        metadata: { fields: Object.keys(data) },
      },
    });

    return updated;
  });

  return NextResponse.json({ block });
}

/** Deletes a block; children cascade via the parentBlockId relation. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const existing = await prisma.block.findUnique({
    where: { id: params.id },
    include: { procedure: true, page: { include: { procedure: true } } },
  });
  if (!existing || existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canEditBlockParent({ id: userId, tenantId, globalRole }, existing);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$transaction(async (tx) => {
    await tx.block.delete({ where: { id: params.id } });
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: "DELETE",
        entityType: "Block",
        entityId: params.id,
        procedureId: existing.procedureId,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
