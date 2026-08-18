import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Pending AiSuggestions for a page — feeds the suggestion panel in the editor. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;

  const page = await prisma.page.findFirst({ where: { id: params.id, tenantId }, select: { id: true } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // requestedById/decidedById are plain scalars (no User relation on
  // AiSuggestion) — same lightweight pattern as AuditLog.actorId elsewhere.
  const suggestions = await prisma.aiSuggestion.findMany({
    where: { pageId: params.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ suggestions });
}
