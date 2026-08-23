import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace, canEditProcedure } from "@/lib/permissions";

async function tenantPage(id: string, tenantId: string) {
  return prisma.page.findFirst({ where: { id, tenantId } });
}

/** Department-gated when the page has been promoted to a governed Procedure (Fase 3), workspace-wide otherwise. */
async function canEditThisPage(actorUser: { id: string; tenantId: string; globalRole: any }, page: { procedure: { departmentId: string } | null } | null) {
  if (page?.procedure) return canEditProcedure(actorUser, page.procedure.departmentId);
  return canEditWorkspace(actorUser);
}

function actor(session: any) {
  return {
    id: session.user.id as string,
    tenantId: session.user.tenantId as string,
    globalRole: session.user.globalRole,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const page = await prisma.page.findFirst({
    where: { id: params.id, tenantId },
    include: {
      children: {
        where: { isArchived: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, title: true, icon: true },
      },
      parent: { select: { id: true, title: true, icon: true } },
      procedure: { select: { id: true, departmentId: true, status: true } },
      verifiedBy: { select: { name: true } },
    },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit = await canEditThisPage(actor(session), page);
  return NextResponse.json({ page, canEdit });
}

const updateSchema = z.object({
  title: z.string().optional(),
  icon: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  content: z.any().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const existing = await prisma.page.findFirst({ where: { id: params.id, tenantId }, include: { procedure: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canEditThisPage(actor(session), existing))) {
    return NextResponse.json({ error: "Sola lettura: non hai i permessi per modificare." }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  // Guard against moving a page under itself or one of its descendants (cycle).
  if (data.parentId) {
    if (data.parentId === params.id) {
      return NextResponse.json({ error: "Una pagina non può essere figlia di sé stessa" }, { status: 400 });
    }
    const parent = await tenantPage(data.parentId, tenantId);
    if (!parent) return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    // Walk up from the new parent; if we hit this page, it's a cycle.
    let cursor: string | null = data.parentId;
    while (cursor) {
      if (cursor === params.id) {
        return NextResponse.json({ error: "Spostamento non valido (creerebbe un ciclo)" }, { status: 400 });
      }
      const p: { parentId: string | null } | null = await prisma.page.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = p?.parentId ?? null;
    }
  }

  const page = await prisma.page.update({
    where: { id: params.id },
    data: {
      title: data.title ?? undefined,
      icon: data.icon === undefined ? undefined : data.icon,
      coverUrl: data.coverUrl === undefined ? undefined : data.coverUrl,
      content: data.content === undefined ? undefined : data.content,
      parentId: data.parentId === undefined ? undefined : data.parentId,
      sortOrder: data.sortOrder ?? undefined,
    },
  });

  return NextResponse.json({ page });
}

/** Soft-delete (archive) the page and its subtree. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const existing = await prisma.page.findFirst({ where: { id: params.id, tenantId }, include: { procedure: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A governed page's lifecycle belongs to lib/workflow's archiveProcedure
  // (writes AuditLog, keeps Procedure.status in sync) — archiving it here
  // would silently desync Procedure.status from Page.isArchived and skip
  // the audit trail entirely.
  if (existing.procedure) {
    return NextResponse.json(
      { error: "Questa pagina è un Documento Controllato: archiviala dalla pagina della procedura." },
      { status: 400 }
    );
  }

  if (!(await canEditThisPage(actor(session), existing))) {
    return NextResponse.json({ error: "Sola lettura: non hai i permessi per eliminare." }, { status: 403 });
  }

  // Collect the subtree (this page + all descendants) and archive together.
  const all = await prisma.page.findMany({ where: { tenantId }, select: { id: true, parentId: true } });
  const byParent = new Map<string | null, string[]>();
  for (const p of all) {
    const arr = byParent.get(p.parentId) ?? [];
    arr.push(p.id);
    byParent.set(p.parentId, arr);
  }
  const ids: string[] = [];
  const stack = [params.id];
  while (stack.length) {
    const id = stack.pop()!;
    ids.push(id);
    stack.push(...(byParent.get(id) ?? []));
  }

  await prisma.page.updateMany({ where: { id: { in: ids } }, data: { isArchived: true } });
  return NextResponse.json({ ok: true, archived: ids.length });
}
