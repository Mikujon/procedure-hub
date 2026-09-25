import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { toProcedureDTO } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId } = ctx;
  const { id } = await params;

  const p = await db.procedure.findUnique({
    where: { id },
    include: {
      department: true,
      process: true,
      parent: { include: { department: true } },
      owner: true,
      favorites: { where: { userId } },
      acknowledgments: { where: { userId } },
      children: {
        where: { status: { not: "ARCHIVED" } },
        include: { department: true, owner: true },
        orderBy: { title: "asc" },
      },
    },
  });

  if (!p || p.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(toProcedureDTO(p as any, userId));
}
