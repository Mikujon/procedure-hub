import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { toProcedureListItem } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId } = ctx;

  const url = new URL(req.url);
  const departmentId = url.searchParams.get("departmentId");
  const status = url.searchParams.get("status");
  const criticality = url.searchParams.get("criticality");
  const tag = url.searchParams.get("tag");
  const search = url.searchParams.get("q")?.toLowerCase();
  const favoriteOnly = url.searchParams.get("favorite") === "1";
  const ackPending = url.searchParams.get("ackPending") === "1";
  const sort = url.searchParams.get("sort") ?? "updated";

  const where: any = { tenantId };
  if (departmentId) where.departmentId = departmentId;
  if (status) where.status = status;
  if (criticality) where.criticality = criticality;
  if (tag) where.tags = { contains: JSON.stringify(tag) };

  let procedures = await db.procedure.findMany({
    where,
    include: {
      department: true,
      process: true,
      parent: true,
      owner: true,
      favorites: { where: { userId } },
      acknowledgments: { where: { userId } },
      _count: { select: { children: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (search) {
    procedures = procedures.filter(
      (p) =>
        p.title.toLowerCase().includes(search) ||
        p.code.toLowerCase().includes(search) ||
        p.summary.toLowerCase().includes(search) ||
        p.tags.toLowerCase().includes(search)
    );
  }
  if (favoriteOnly) {
    procedures = procedures.filter((p) =>
      p.favorites.some((f) => f.userId === userId)
    );
  }
  if (ackPending) {
    procedures = procedures.filter(
      (p) =>
        p.status === "PUBLISHED" &&
        p.ackRequired &&
        !p.acknowledgments.some((a) => a.userId === userId)
    );
  }

  switch (sort) {
    case "title":
      procedures.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "code":
      procedures.sort((a, b) => a.code.localeCompare(b.code));
      break;
    case "review":
      procedures.sort(
        (a, b) =>
          (a.nextReviewAt?.getTime() ?? Infinity) -
          (b.nextReviewAt?.getTime() ?? Infinity)
      );
      break;
    case "updated":
    default:
      procedures.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      break;
  }

  return NextResponse.json(procedures.map((p) => toProcedureListItem(p as any, userId)));
}
