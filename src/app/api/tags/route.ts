import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Tenant's tag list — tags aren't sensitive (already visible as badges on
 * every procedure page to anyone who can view it), so no admin gate.
 * Powers the automation tag-condition picker (3.2); reusable anywhere else
 * that needs "pick from existing tags" instead of free text prone to typos
 * that would silently never match.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const tags = await prisma.tag.findMany({
    where: { tenantId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ tags });
}
