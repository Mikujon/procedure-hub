import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";

/** Flat list of the tenant's pages (the client builds the tree from parentId). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const pages = await prisma.page.findMany({
    where: { tenantId, isArchived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, parentId: true, title: true, icon: true, sortOrder: true, updatedAt: true },
  });

  return NextResponse.json({ pages });
}

const createSchema = z.object({
  parentId: z.string().nullable().optional(),
  title: z.string().optional(),
  icon: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canEditWorkspace({ id: userId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Non hai i permessi per creare pagine." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // If a parent is given, ensure it belongs to this tenant (isolation).
  if (parsed.data.parentId) {
    const parent = await prisma.page.findFirst({
      where: { id: parsed.data.parentId, tenantId },
      select: { id: true },
    });
    if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 });
  }

  // New pages go to the end of their sibling list.
  const siblingCount = await prisma.page.count({
    where: { tenantId, parentId: parsed.data.parentId ?? null },
  });

  const page = await prisma.page.create({
    data: {
      tenantId,
      parentId: parsed.data.parentId ?? null,
      title: parsed.data.title ?? "Senza titolo",
      icon: parsed.data.icon ?? null,
      sortOrder: siblingCount,
      createdById: userId,
    },
    select: { id: true, parentId: true, title: true, icon: true },
  });

  return NextResponse.json({ page }, { status: 201 });
}
