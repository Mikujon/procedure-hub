import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Lists block-tree page templates available to the current tenant: global (tenantId: null) + the tenant's own. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const templates = await prisma.template.findMany({
    where: { category: { not: null }, OR: [{ tenantId: null }, { tenantId }] },
    orderBy: [{ tenantId: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, icon: true, category: true, tenantId: true },
  });

  return NextResponse.json({ templates });
}
