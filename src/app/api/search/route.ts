import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchProcedures } from "@/lib/search";

/**
 * Global search. Primary engine is MeiliSearch (typo-tolerant, highlighted),
 * but the app must stay fully usable when Meili is not running (local dev
 * without Docker, or a Meili outage). So we try Meili first and transparently
 * fall back to a Postgres query. Either way the response shape is the same:
 * { hits: [...], engine: "meili" | "postgres" | "none" } and we never 500.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const tags = searchParams.get("tags")?.split(",").filter(Boolean);

  if (!q) return NextResponse.json({ hits: [], engine: "none" });

  // 1. Try MeiliSearch.
  try {
    const results = await searchProcedures(tenantId, q, { departmentId, type, tags });
    const hits = (results.hits as any[]).map((h) => ({
      id: h.id,
      title: h.title,
      code: h.code,
      summary: h.summary ?? null,
      departmentName: h.departmentName,
      type: h.type,
    }));
    return NextResponse.json({ hits, engine: "meili" });
  } catch {
    // 2. Fall back to Postgres. Not typo-tolerant, but keeps search working.
  }

  const procedures = await prisma.procedure.findMany({
    where: {
      tenantId,
      status: "PUBLISHED",
      departmentId: departmentId || undefined,
      type: (type as any) || undefined,
      tags: tags?.length ? { some: { tag: { name: { in: tags } } } } : undefined,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { department: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  const hits = procedures.map((p) => ({
    id: p.id,
    title: p.title,
    code: p.code,
    summary: p.summary,
    departmentName: p.department.name,
    type: p.type,
  }));

  return NextResponse.json({ hits, engine: "postgres" });
}
