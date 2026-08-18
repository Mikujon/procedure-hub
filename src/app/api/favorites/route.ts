import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ procedureId: z.string() });

/** Toggle a favorite for the current user. Returns { favorited: boolean }. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Ensure the procedure belongs to the caller's tenant (isolation).
  const procedure = await prisma.procedure.findFirst({
    where: { id: parsed.data.procedureId, tenantId },
    select: { id: true },
  });
  if (!procedure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.favorite.findUnique({
    where: { userId_procedureId: { userId, procedureId: procedure.id } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  }

  await prisma.favorite.create({ data: { userId, procedureId: procedure.id } });
  return NextResponse.json({ favorited: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { procedure: { include: { department: { select: { name: true, slug: true } } } } },
  });

  return NextResponse.json({ favorites });
}
