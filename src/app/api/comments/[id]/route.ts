import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Only the comment's own author or a tenant admin can delete it. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
    include: { procedure: { select: { tenantId: true } } },
  });
  if (!comment || comment.procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (comment.authorId !== userId && globalRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // No onDelete: Cascade on the self-relation (Comment.parent) — delete any
  // replies first in the same transaction so removing a top-level comment
  // never trips over a dangling foreign key.
  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { parentId: params.id } }),
    prisma.comment.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
