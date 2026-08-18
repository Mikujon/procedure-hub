import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defaultSchema, toColumnType, toViewType } from "@/lib/database";
import { canEditWorkspace } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const databases = await prisma.database.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, icon: true, _count: { select: { rows: true } } },
  });

  return NextResponse.json({ databases });
}

const createSchema = z.object({ title: z.string().optional(), icon: z.string().optional() });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canEditWorkspace({ id: userId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Non hai i permessi per creare database." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const schema = defaultSchema();
  const database = await prisma.$transaction(async (tx) => {
    const created = await tx.database.create({
      data: {
        tenantId,
        title: parsed.data.title ?? "Nuovo database",
        icon: parsed.data.icon ?? "🗃️",
        createdById: userId,
        // Seed three empty rows so a new database isn't a blank wall.
        rows: {
          create: [
            { title: "Prima attività", sortOrder: 0, values: {} },
            { title: "Seconda attività", sortOrder: 1, values: {} },
            { title: "Terza attività", sortOrder: 2, values: {} },
          ],
        },
      },
      select: { id: true, title: true, icon: true },
    });

    await tx.databaseColumn.createMany({
      data: schema.properties.map((p, i) => ({
        id: p.id,
        databaseId: created.id,
        name: p.name,
        type: toColumnType(p.type),
        sortOrder: i,
        config: (p.type === "select" ? { options: p.options ?? [] } : {}) as any,
      })),
    });

    await tx.databaseView.createMany({
      data: schema.views.map((v) => ({
        id: v.id,
        databaseId: created.id,
        name: v.name,
        type: toViewType(v.type),
        groupByColumnId: v.groupByPropertyId ?? null,
      })),
    });

    return created;
  });

  return NextResponse.json({ database }, { status: 201 });
}
