import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";

async function ownedRow(dbId: string, rowId: string, tenantId: string) {
  return prisma.databaseRow.findFirst({
    where: { id: rowId, databaseId: dbId, database: { tenantId } },
    select: { id: true, values: true },
  });
}

function actor(session: any) {
  return {
    id: session.user.id as string,
    tenantId: session.user.tenantId as string,
    globalRole: session.user.globalRole,
  };
}

const patchSchema = z.object({
  title: z.string().optional(),
  values: z.record(z.any()).optional(),
  sortOrder: z.number().optional(),
});

/**
 * `values` is a merge (client always sends `{...row.values, [propId]: v}`,
 * echoing back keys it isn't touching — including, since Fase 2, RELATION
 * arrays composed by GET). Keys that belong to a RELATION column never get
 * written into the `values` JSON — they resync DatabaseRowRelation instead.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; rowId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  if (!(await canEditWorkspace(actor(session)))) {
    return NextResponse.json({ error: "Sola lettura: non hai i permessi per modificare." }, { status: 403 });
  }
  const existing = await ownedRow(params.id, params.rowId, tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  let relationEntries: [string, any][] = [];
  let mergedValues: Record<string, any> | undefined;

  if (d.values !== undefined) {
    const relationColumns = await prisma.databaseColumn.findMany({
      where: { databaseId: params.id, type: "RELATION" },
      select: { id: true },
    });
    const relationColumnIds = new Set(relationColumns.map((c) => c.id));

    const scalarValues: Record<string, any> = {};
    for (const [key, val] of Object.entries(d.values)) {
      if (relationColumnIds.has(key)) relationEntries.push([key, val]);
      else scalarValues[key] = val;
    }
    mergedValues = { ...((existing.values as Record<string, any>) ?? {}), ...scalarValues };
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.databaseRow.update({
      where: { id: params.rowId },
      data: {
        title: d.title === undefined ? undefined : d.title,
        values: mergedValues === undefined ? undefined : (mergedValues as any),
        sortOrder: d.sortOrder ?? undefined,
      },
    });

    for (const [columnId, val] of relationEntries) {
      const toRowIds: string[] = Array.isArray(val) ? val : val ? [val] : [];
      await tx.databaseRowRelation.deleteMany({ where: { columnId, fromRowId: params.rowId } });
      if (toRowIds.length) {
        await tx.databaseRowRelation.createMany({
          data: toRowIds.map((toRowId) => ({ columnId, fromRowId: params.rowId, toRowId })),
          skipDuplicates: true,
        });
      }
    }

    return updated;
  });

  const values = { ...((row.values as Record<string, any>) ?? {}) };
  for (const [columnId, val] of relationEntries) {
    values[columnId] = Array.isArray(val) ? val : val ? [val] : [];
  }

  return NextResponse.json({ row: { ...row, values } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; rowId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  if (!(await canEditWorkspace(actor(session)))) {
    return NextResponse.json({ error: "Sola lettura: non hai i permessi per eliminare." }, { status: 403 });
  }
  if (!(await ownedRow(params.id, params.rowId, tenantId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // DatabaseRowRelation rows referencing this row (either side) cascade via
  // the fromRowId/toRowId foreign keys — no manual cleanup needed.
  await prisma.databaseRow.delete({ where: { id: params.rowId } });
  return NextResponse.json({ ok: true });
}
