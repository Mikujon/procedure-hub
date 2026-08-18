import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";

const schema = z.object({
  title: z.string().optional(),
  values: z.record(z.any()).optional(),
});

/** Add a row to a database. RELATION-column values, if passed, seed DatabaseRowRelation instead of the values JSON. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  if (!(await canEditWorkspace({ id: (session.user as any).id, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Sola lettura: non hai i permessi per modificare." }, { status: 403 });
  }
  const db = await prisma.database.findFirst({ where: { id: params.id, tenantId }, select: { id: true } });
  if (!db) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const relationColumns = await prisma.databaseColumn.findMany({
    where: { databaseId: params.id, type: "RELATION" },
    select: { id: true },
  });
  const relationColumnIds = new Set(relationColumns.map((c) => c.id));

  const incomingValues = parsed.data.values ?? {};
  const scalarValues: Record<string, any> = {};
  const relationEntries: [string, any][] = [];
  for (const [key, val] of Object.entries(incomingValues)) {
    if (relationColumnIds.has(key)) relationEntries.push([key, val]);
    else scalarValues[key] = val;
  }

  const count = await prisma.databaseRow.count({ where: { databaseId: params.id } });

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.databaseRow.create({
      data: {
        databaseId: params.id,
        title: parsed.data.title ?? "",
        values: scalarValues as any,
        sortOrder: count,
      },
    });

    for (const [columnId, val] of relationEntries) {
      const toRowIds: string[] = Array.isArray(val) ? val : val ? [val] : [];
      if (toRowIds.length) {
        await tx.databaseRowRelation.createMany({
          data: toRowIds.map((toRowId) => ({ columnId, fromRowId: created.id, toRowId })),
          skipDuplicates: true,
        });
      }
    }

    return created;
  });

  // Echo back values including the relation arrays just written, so the
  // client's local row state matches what a GET would compose.
  const values = { ...scalarValues };
  for (const [columnId, val] of relationEntries) {
    values[columnId] = Array.isArray(val) ? val : val ? [val] : [];
  }

  return NextResponse.json({ row: { ...row, values } }, { status: 201 });
}
