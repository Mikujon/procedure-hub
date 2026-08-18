import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditBlockParent } from "@/lib/permissions";
import { generateText } from "@/lib/ai/client";
import { blocksToMarkdown } from "@/lib/ai/context";
import { buildBlockTree } from "@/lib/blocks/tree";
import { parseAiBlockArray, BLOCK_JSON_CONTRACT } from "@/lib/ai/blocks";

/**
 * Proposes content for one specific block (typically an empty section under
 * a heading) using the rest of the page as context. Suggest Mode only works
 * on Page blocks (AiSuggestion has no procedureId) — a block that belongs
 * to a Procedure is out of scope here.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const target = await prisma.block.findUnique({ where: { id: params.id }, include: { procedure: true } });
  if (!target || target.tenantId !== tenantId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!target.pageId) {
    return NextResponse.json({ error: "AI suggestions are only available for page blocks" }, { status: 400 });
  }

  const allowed = await canEditBlockParent({ id: userId, tenantId, globalRole }, target);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const siblingBlocks = await prisma.block.findMany({ where: { pageId: target.pageId } });
  const pageMarkdown = blocksToMarkdown(buildBlockTree(siblingBlocks));

  let text: string;
  try {
    text = await generateText({
      system:
        "Sei un assistente che completa UNA sezione specifica di un documento, usando il resto della pagina come contesto. " +
        "Non riscrivere le altre sezioni. Se il contesto non basta per essere specifici, scrivi contenuto plausibile ma generico invece di inventare fatti concreti. " +
        BLOCK_JSON_CONTRACT,
      prompt: `Contenuto attuale dell'intera pagina (la sezione da completare è vuota o segnaposto):\n${pageMarkdown}\n\nGenera il contenuto per il blocco di tipo "${target.type}" in quella sezione vuota.`,
      maxOutputTokens: 2048,
    });
  } catch {
    return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
  }

  let proposedContent;
  try {
    proposedContent = parseAiBlockArray(text);
  } catch {
    return NextResponse.json({ error: "AI response was not valid block JSON" }, { status: 502 });
  }
  if (proposedContent.length === 0) {
    return NextResponse.json({ error: "AI returned no content" }, { status: 502 });
  }

  const suggestion = await prisma.aiSuggestion.create({
    data: {
      tenantId,
      pageId: target.pageId,
      targetBlockId: target.id,
      kind: "SECTION_COMPLETION",
      proposedContent: proposedContent as any,
      requestedById: userId,
    },
  });

  return NextResponse.json({ suggestion }, { status: 201 });
}
