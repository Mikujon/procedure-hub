import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure, canViewProcedure } from "@/lib/permissions";
import { notifyEvent } from "@/lib/integrations/notify";
import { indexProcedure, removeFromIndex, buildSearchDocument, stripHtml } from "@/lib/search";

const updateSchema = z.object({
  contentJson: z.any(),
  contentHtml: z.string(),
  changelog: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  jobRoleIds: z.array(z.string()).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const allowed = await canViewProcedure({ id: userId, tenantId, globalRole }, params.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const procedure = await prisma.procedure.findUnique({
    where: { id: params.id },
    include: {
      department: true,
      process: true,
      currentVersion: true,
      versions: { orderBy: { versionNumber: "desc" }, include: { author: { select: { name: true } } } },
      tags: { include: { tag: true } },
      jobRoles: { include: { jobRole: true } },
      attachments: true,
      relatedFrom: { include: { to: { select: { id: true, title: true, code: true } } } },
      workflowSteps: { orderBy: { createdAt: "desc" } },
      author: { select: { id: true, name: true, avatarUrl: true } },
      owner: { select: { id: true, name: true, avatarUrl: true } },
      comments: {
        where: { parentId: null },
        include: { author: { select: { name: true, avatarUrl: true } }, replies: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { acknowledgments: true } },
    },
  });

  if (!procedure) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ procedure });
}

/** Creates a new immutable version — this is how edits happen (never mutate a published version in place). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const existing = await prisma.procedure.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await canEditProcedure({ id: userId, tenantId, globalRole }, existing.departmentId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const latestVersion = await prisma.procedureVersion.findFirst({
    where: { procedureId: params.id },
    orderBy: { versionNumber: "desc" },
  });
  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  const updated = await prisma.$transaction(async (tx) => {
    const version = await tx.procedureVersion.create({
      data: {
        procedureId: params.id,
        versionNumber: nextVersionNumber,
        contentJson: data.contentJson,
        contentHtml: data.contentHtml,
        changelog: data.changelog,
        authorId: userId,
      },
    });

    const proc = await tx.procedure.update({
      where: { id: params.id },
      data: {
        currentVersionId: version.id,
        title: data.title ?? undefined,
        summary: data.summary ?? undefined,
        // Editing a published procedure sends it back to Draft/Review, never
        // silently overwrites what's live — content stays "PUBLISHED" until
        // resubmitted, so the old version keeps serving readers meanwhile.
        status: existing.status === "PUBLISHED" ? "DRAFT" : existing.status,
      },
    });

    // jobRoleIds is a metadata assignment, not a content edit — sync it
    // alongside the version bump if the caller sent it, same delete-then-
    // create pattern used for anything else keyed by a join table.
    if (data.jobRoleIds !== undefined) {
      await tx.procedureJobRole.deleteMany({ where: { procedureId: params.id } });
      if (data.jobRoleIds.length > 0) {
        await tx.procedureJobRole.createMany({
          data: data.jobRoleIds.map((jobRoleId) => ({ procedureId: params.id, jobRoleId })),
          skipDuplicates: true,
        });
      }
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: "UPDATE",
        entityType: "Procedure",
        entityId: params.id,
        procedureId: params.id,
        metadata: { versionNumber: nextVersionNumber, changelog: data.changelog },
      },
    });

    return proc;
  });

  if (existing.status === "PUBLISHED") {
    await notifyEvent({
      tenantId,
      type: "UPDATED",
      procedureId: params.id,
      title: `"${updated.title}" was updated and is back in Draft pending re-approval`,
    });
  }

  // Same index-sync as the block-editor publish route — this legacy path
  // still owns saves for procedures not yet opened in the block editor.
  const withRelations = await prisma.procedure.findUnique({
    where: { id: params.id },
    include: { department: true, tags: { include: { tag: true } } },
  });
  if (withRelations) {
    await indexProcedure(buildSearchDocument(withRelations, stripHtml(data.contentHtml)), tenantId);
  }

  return NextResponse.json({ procedure: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (globalRole !== "ADMIN") {
    return NextResponse.json({ error: "Only tenant admins can permanently delete a procedure" }, { status: 403 });
  }

  const existing = await prisma.procedure.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.auditLog.create({
    data: { tenantId, actorId: userId, action: "DELETE", entityType: "Procedure", entityId: params.id },
  });
  await prisma.procedure.delete({ where: { id: params.id } });
  await removeFromIndex(params.id, tenantId);

  return NextResponse.json({ ok: true });
}
