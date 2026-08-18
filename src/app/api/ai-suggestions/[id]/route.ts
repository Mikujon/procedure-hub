import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";

const schema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED", "PARTIALLY_ACCEPTED"]),
  /// For PARTIALLY_ACCEPTED: which proposedContent entries to apply, by
  /// array index (stringified) — proposedContent nodes aren't real Block
  /// rows yet at proposal time, so they have no id of their own to
  /// reference; the index is the only stable handle available.
  acceptedBlockIds: z.array(z.string()).optional(),
});

type ProposedNode = { type: string; content: any; children?: ProposedNode[] };

async function insertNodes(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tenantId: string,
  pageId: string,
  nodes: ProposedNode[],
  parentBlockId: string | null,
  startSortOrder: number
) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const block = await tx.block.create({
      data: { tenantId, pageId, parentBlockId, type: node.type as any, content: node.content, sortOrder: startSortOrder + i },
      select: { id: true },
    });
    if (node.children?.length) {
      await insertNodes(tx, tenantId, pageId, node.children, block.id, 0);
    }
  }
}

/**
 * The one place AI-proposed content ever becomes a real Block — never done
 * inline by the generation routes. Semantics per kind:
 *  - DRAFT_FROM_CONVERSATION / RELATED_DOCUMENT_LINK (targetBlockId null):
 *    append proposedContent as new root blocks at the end of the page.
 *  - SECTION_COMPLETION / EXECUTIVE_SUMMARY (targetBlockId set): replace
 *    that block's content with proposedContent[0], insert the rest as new
 *    siblings right after it.
 *  - GAP_ANALYSIS: nothing to write (notes only) — decision just records
 *    that the observations were reviewed.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canEditWorkspace({ id: userId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const suggestion = await prisma.aiSuggestion.findUnique({ where: { id: params.id } });
  if (!suggestion || suggestion.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (suggestion.status !== "PENDING") {
    return NextResponse.json({ error: "Suggestion already decided" }, { status: 409 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { decision, acceptedBlockIds } = parsed.data;

  const applying = decision === "ACCEPTED" || decision === "PARTIALLY_ACCEPTED";
  const allNodes = (suggestion.proposedContent as unknown as ProposedNode[]) ?? [];
  const nodesToApply =
    decision === "PARTIALLY_ACCEPTED" && acceptedBlockIds
      ? allNodes.filter((_, i) => acceptedBlockIds.includes(String(i)))
      : allNodes;

  await prisma.$transaction(async (tx) => {
    if (applying && nodesToApply.length > 0) {
      if (suggestion.targetBlockId) {
        const target = await tx.block.findUnique({ where: { id: suggestion.targetBlockId } });
        if (target) {
          const [first, ...rest] = nodesToApply;
          await tx.block.update({ where: { id: target.id }, data: { content: first.content } });
          if (rest.length > 0) {
            await tx.block.updateMany({
              where: { pageId: suggestion.pageId, parentBlockId: target.parentBlockId, sortOrder: { gt: target.sortOrder } },
              data: { sortOrder: { increment: rest.length } },
            });
            await insertNodes(tx, tenantId, suggestion.pageId, rest, target.parentBlockId, target.sortOrder + 1);
          }
        }
      } else {
        const maxSortOrder = await tx.block.aggregate({
          where: { pageId: suggestion.pageId, parentBlockId: null },
          _max: { sortOrder: true },
        });
        await insertNodes(tx, tenantId, suggestion.pageId, nodesToApply, null, (maxSortOrder._max.sortOrder ?? -1) + 1);
      }
    }

    await tx.aiSuggestion.update({
      where: { id: suggestion.id },
      data: { status: decision, decidedAt: new Date(), decidedById: userId },
    });

    // Audit trail must always make it explicit in retrospect that this
    // content came from an AI proposal a specific person accepted — never
    // anonymous, per the project's non-negotiable Suggest Mode principle.
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: userId,
        action: "UPDATE",
        entityType: "AiSuggestion",
        entityId: suggestion.id,
        metadata: { source: "ai_suggestion", suggestionId: suggestion.id, decision },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
