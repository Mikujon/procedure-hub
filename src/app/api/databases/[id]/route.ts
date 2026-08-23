import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";
import { columnsToProperties, viewsToClient, toColumnType, toViewType, type Property, type View } from "@/lib/database";

async function tenantDb(id: string, tenantId: string) {
  return prisma.database.findFirst({ where: { id, tenantId }, select: { id: true } });
}

function actor(session: any) {
  return {
    id: session.user.id as string,
    tenantId: session.user.tenantId as string,
    globalRole: session.user.globalRole,
  };
}

/** Composes the same {id,title,icon,properties,views,rows} shape the frontend has always consumed, from the relational tables. */
async function loadDatabaseForClient(id: string) {
  const database = await prisma.database.findUnique({
    where: { id },
    include: {
      columns: { orderBy: { sortOrder: "asc" } },
      views: true,
      rows: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { relationsFrom: true },
      },
    },
  });
  if (!database) return null;

  const relationColumnIds = database.columns.filter((c) => c.type === "RELATION").map((c) => c.id);

  const rows = database.rows.map((row) => {
    const values: Record<string, any> = { ...((row.values as Record<string, any>) ?? {}) };
    for (const colId of relationColumnIds) {
      values[colId] = row.relationsFrom.filter((r) => r.columnId === colId).map((r) => r.toRowId);
    }
    return { id: row.id, title: row.title, values, sortOrder: row.sortOrder };
  });

  return {
    id: database.id,
    title: database.title,
    icon: database.icon,
    properties: columnsToProperties(database.columns),
    views: viewsToClient(database.views),
    rows,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  if (!(await tenantDb(params.id, tenantId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const database = await loadDatabaseForClient(params.id);
  if (!database) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit = await canEditWorkspace(actor(session));
  return NextResponse.json({ database, canEdit });
}

const updateSchema = z.object({
  title: z.string().optional(),
  icon: z.string().nullable().optional(),
  properties: z.array(z.any()).optional(),
  views: z.array(z.any()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  if (!(await canEditWorkspace(actor(session)))) {
    return NextResponse.json({ error: "Sola lettura: non hai i permessi per modificare." }, { status: 403 });
  }
  if (!(await tenantDb(params.id, tenantId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (d.title !== undefined || d.icon !== undefined) {
      await tx.database.update({
        where: { id: params.id },
        data: { title: d.title ?? undefined, icon: d.icon === undefined ? undefined : d.icon },
      });
    }

    // The client always sends the *whole* properties/views array (add/rename/
    // delete are all "recompute the array, PATCH it") — diff against what's
    // stored so this stays a drop-in replacement for the old direct-JSON-write.
    if (d.properties !== undefined) {
      const incoming = d.properties as Property[];
      const existingCols = await tx.databaseColumn.findMany({ where: { databaseId: params.id } });
      const incomingIds = new Set(incoming.map((p) => p.id));
      const toDelete = existingCols.filter((c) => !incomingIds.has(c.id)).map((c) => c.id);
      if (toDelete.length) {
        await tx.databaseColumn.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (let i = 0; i < incoming.length; i++) {
        const p = incoming[i];
        const config =
          p.type === "select"
            ? { options: p.options ?? [] }
            : p.type === "relation"
              ? { targetDatabaseId: p.targetDatabaseId }
              : {};
        await tx.databaseColumn.upsert({
          where: { id: p.id },
          create: { id: p.id, databaseId: params.id, name: p.name, type: toColumnType(p.type), sortOrder: i, config: config as any },
          update: { name: p.name, sortOrder: i, config: config as any },
        });
      }
    }

    if (d.views !== undefined) {
      const incoming = d.views as View[];
      const existingViews = await tx.databaseView.findMany({ where: { databaseId: params.id } });
      const incomingIds = new Set(incoming.map((v) => v.id));
      const toDelete = existingViews.filter((v) => !incomingIds.has(v.id)).map((v) => v.id);
      if (toDelete.length) {
        await tx.databaseView.deleteMany({ where: { id: { in: toDelete } } });
      }
      for (const v of incoming) {
        const config = (v.config ?? {}) as any;
        await tx.databaseView.upsert({
          where: { id: v.id },
          create: { id: v.id, databaseId: params.id, name: v.name, type: toViewType(v.type), groupByColumnId: v.groupByPropertyId ?? null, config },
          update: { name: v.name, groupByColumnId: v.groupByPropertyId ?? null, config },
        });
      }
    }
  });

  const database = await loadDatabaseForClient(params.id);
  return NextResponse.json({ database });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  if (!(await canEditWorkspace(actor(session)))) {
    return NextResponse.json({ error: "Sola lettura: non hai i permessi per eliminare." }, { status: 403 });
  }
  if (!(await tenantDb(params.id, tenantId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.database.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
