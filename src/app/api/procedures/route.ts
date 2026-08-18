import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure, visibilityWhereClause } from "@/lib/permissions";
import { slugify } from "@/lib/utils";

const createSchema = z.object({
  title: z.string().min(3),
  code: z.string().min(2),
  departmentId: z.string(),
  processId: z.string().optional(),
  parentId: z.string().optional(),
  type: z.enum(["PROCEDURE", "WORK_INSTRUCTION", "POLICY", "SOP", "FORM", "TEMPLATE", "FAQ"]),
  summary: z.string().optional(),
  requiresAck: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "DEPARTMENT", "RESTRICTED"]).optional(),
  tagIds: z.array(z.string()).optional(),
  contentJson: z.any(),
  contentHtml: z.string(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  const { searchParams } = new URL(req.url);

  const departmentId = searchParams.get("departmentId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const jobRoleId = searchParams.get("jobRoleId") ?? undefined;

  const visibilityWhere = await visibilityWhereClause({ id: userId, tenantId, globalRole });

  const procedures = await prisma.procedure.findMany({
    where: {
      tenantId,
      departmentId: departmentId || undefined,
      status: (status as any) || undefined,
      tags: tag ? { some: { tag: { name: tag } } } : undefined,
      jobRoles: jobRoleId ? { some: { jobRoleId } } : undefined,
      ...visibilityWhere,
    },
    include: {
      department: true,
      currentVersion: true,
      tags: { include: { tag: true } },
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ procedures });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const allowed = await canEditProcedure({ id: userId, tenantId, globalRole }, data.departmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
  const procedure = await prisma.$transaction(async (tx) => {
    const created = await tx.procedure.create({
      data: {
        tenantId,
        departmentId: data.departmentId,
        processId: data.processId,
        parentId: data.parentId,
        code: data.code,
        title: data.title,
        summary: data.summary,
        type: data.type,
        requiresAck: data.requiresAck ?? false,
        isCritical: data.isCritical ?? false,
        visibility: data.visibility ?? "DEPARTMENT",
        authorId: userId,
        ownerId: userId,
        status: "DRAFT",
        tags: data.tagIds
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
    });

    const version = await tx.procedureVersion.create({
      data: {
        procedureId: created.id,
        versionNumber: 1,
        contentJson: data.contentJson,
        contentHtml: data.contentHtml,
        authorId: userId,
        changelog: "Initial draft",
      },
    });

    const updated = await tx.procedure.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: "CREATE",
        entityType: "Procedure",
        entityId: created.id,
        procedureId: created.id,
      },
    });

    return updated;
  });

  return NextResponse.json({ procedure }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: `Esiste già una procedura con il codice "${data.code}". Scegli un codice diverso.` },
        { status: 409 }
      );
    }
    console.error("POST /api/procedures failed:", err);
    return NextResponse.json({ error: "Errore interno durante la creazione della procedura." }, { status: 500 });
  }
}
