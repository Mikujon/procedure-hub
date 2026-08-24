import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Minimal tenant member directory — powers @mention autocomplete (2.6) and
 * anything else that needs "who can I address in this tenant" without the
 * full admin/settings team-management payload. Any authenticated tenant
 * member can list colleagues by name (same visibility as a Slack/Notion
 * org directory) — no department/procedure scoping needed here.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const q = req.nextUrl.searchParams.get("q")?.trim();

  const users = await prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
      isSystem: false,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, avatarUrl: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json({ users });
}
