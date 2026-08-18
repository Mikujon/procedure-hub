import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";
import { generateText } from "@/lib/ai/client";
import { blocksToMarkdown } from "@/lib/ai/context";
import { buildBlockTree } from "@/lib/blocks/tree";

/**
 * Suggests links to other pages in the tenant. lib/search.ts's MeiliSearch
 * index is Procedure-only (SearchDocument has departmentId/code/isCritical
 * — fields Pages don't have), so there's no existing Page search index to
 * reuse yet. Grounds the AI call in real candidates instead of asking it to
 * invent titles: pull the tenant's other pages first (cheap, deterministic),
 * then ask the model to pick which ones are genuinely related — every
 * pageId in the response is validated against the candidate set before a
 * suggestion is built, so a hallucinated id can't slip into proposedContent.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canEditWorkspace({ id: userId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = await prisma.page.findFirst({ where: { id: params.id, tenantId } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks = await prisma.block.findMany({ where: { pageId: page.id } });
  const pageMarkdown = blocksToMarkdown(buildBlockTree(blocks));

  const candidates = await prisma.page.findMany({
    where: { tenantId, isArchived: false, id: { not: page.id } },
    select: { id: true, title: true },
    take: 30,
    orderBy: { updatedAt: "desc" },
  });

  if (candidates.length === 0) {
    const suggestion = await prisma.aiSuggestion.create({
      data: { tenantId, pageId: page.id, kind: "RELATED_DOCUMENT_LINK", proposedContent: [], requestedById: userId },
    });
    return NextResponse.json({ suggestion }, { status: 201 });
  }

  let text: string;
  try {
    text = await generateText({
      system:
        "Scegli, tra un elenco di pagine candidate, quelle davvero correlate al documento fornito (stesso argomento, processo collegato, dipendenza). " +
        "Rispondi ESCLUSIVAMENTE con un array JSON di oggetti { \"pageId\": \"...\", \"reason\": \"breve motivo\" }, usando solo id presenti nell'elenco candidati. " +
        "Se nessuna è davvero correlata, rispondi [].",
      prompt: `Documento corrente ("${page.title}"):\n${pageMarkdown || "(vuoto)"}\n\nPagine candidate:\n${candidates
        .map((c) => `- ${c.id}: ${c.title}`)
        .join("\n")}`,
      maxOutputTokens: 1024,
    });
  } catch {
    return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
  }

  let picks: { pageId: string; reason?: string }[] = [];
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    picks = JSON.parse(text.slice(start, end + 1));
  } catch {
    return NextResponse.json({ error: "AI response was not valid JSON" }, { status: 502 });
  }

  const candidateIds = new Set(candidates.map((c) => c.id));
  const validPicks = picks.filter((p) => candidateIds.has(p?.pageId));
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const proposedContent = validPicks.map((p) => ({
    type: "PAGE_LINK",
    content: { pageId: p.pageId, title: byId.get(p.pageId)!.title, reason: p.reason ?? "" },
  }));

  const suggestion = await prisma.aiSuggestion.create({
    data: {
      tenantId,
      pageId: page.id,
      kind: "RELATED_DOCUMENT_LINK",
      proposedContent: proposedContent as any,
      requestedById: userId,
    },
  });

  return NextResponse.json({ suggestion }, { status: 201 });
}
