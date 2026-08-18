import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure } from "@/lib/permissions";
import { notifyEvent } from "@/lib/integrations/notify";
import { buildBlockTree } from "@/lib/blocks/tree";
import { blocksToProseMirrorDoc } from "@/lib/blocks/serialize";
import { blockParentWhere } from "@/lib/blocks/parent";
import { indexProcedure, buildSearchDocument, stripHtml } from "@/lib/search";

const publishSchema = z.object({
  changelog: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
});

/**
 * Serializes the procedure's current Block tree into a new immutable
 * ProcedureVersion — the Block-engine equivalent of the "Save" button in the
 * old single-document PATCH /api/procedures/[id]. Per-block edits already
 * autosave through PATCH /api/blocks/[id] as they happen; this route is what
 * actually advances the version history / demotes a published procedure
 * back to Draft, same as before.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const parsed = publishSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const blocks = await prisma.block.findMany({ where: blockParentWhere(existing) });
  const tree = buildBlockTree(blocks);
  const { json, html } = blocksToProseMirrorDoc(tree);

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
        contentJson: json,
        contentHtml: html,
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
        // Same demotion rule as the old editor's save path: publishing a
        // new version off a Published procedure sends it back to Draft
        // pending re-approval, readers keep seeing the prior version.
        status: existing.status === "PUBLISHED" ? "DRAFT" : existing.status,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: "UPDATE",
        entityType: "Procedure",
        entityId: params.id,
        procedureId: params.id,
        metadata: { versionNumber: nextVersionNumber, changelog: data.changelog, source: "block_editor" },
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

  // Keep the search index (and, downstream, any AI retrieval built on it)
  // current as of this publish — never left stale for the next reader/query.
  const withRelations = await prisma.procedure.findUnique({
    where: { id: params.id },
    include: { department: true, tags: { include: { tag: true } } },
  });
  if (withRelations) {
    await indexProcedure(buildSearchDocument(withRelations, stripHtml(html)), tenantId);
  }

  return NextResponse.json({ procedure: updated });
}
