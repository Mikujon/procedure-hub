import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";
import { generateText } from "@/lib/ai/client";
import { blocksToMarkdown } from "@/lib/ai/context";
import { buildBlockTree } from "@/lib/blocks/tree";
import { checkAiRateLimit } from "@/lib/rate-limit";

/**
 * On-demand only. The plan called for auto-triggering this from a
 * ProcedureVersion-creation hook in lib/workflow/index.ts, but that hook
 * fires for Procedures — Pages (what this whole Parte B operates on) have
 * no version/publish lifecycle to hang a hook off. Kept as a button the
 * user presses, same trigger model as the other Suggest Mode actions.
 *
 * The summary lives in a CALLOUT block flagged `isExecutiveSummary: true`
 * at the top of the page; if one already exists this proposes replacing it
 * (targetBlockId set), otherwise proposes inserting a new one at position 0.
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

  const limit = await checkAiRateLimit(userId);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Troppe richieste all'assistente AI. Riprova tra qualche minuto." }, { status: 429, headers: { "Retry-After": String(limit.resetInSeconds) } });
  }

  const page = await prisma.page.findFirst({ where: { id: params.id, tenantId } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks = await prisma.block.findMany({ where: { pageId: page.id } });
  const pageMarkdown = blocksToMarkdown(buildBlockTree(blocks));
  if (!pageMarkdown.trim()) {
    return NextResponse.json({ error: "Page has no content to summarize" }, { status: 400 });
  }

  const existingSummaryBlock = blocks.find((b) => b.type === "CALLOUT" && (b.content as any)?.isExecutiveSummary === true);

  let text: string;
  try {
    text = await generateText({
      system:
        "Scrivi un riepilogo esecutivo di 2-4 frasi del documento fornito, in italiano, per chi non ha tempo di leggerlo tutto. " +
        "Rispondi ESCLUSIVAMENTE con il testo del riepilogo, in prosa normale. " +
        "Non includere titoli, preamboli, elenchi puntati, né meta-commenti sul riepilogo stesso (conteggio frasi, tono, lunghezza): " +
        "solo le 2-4 frasi del riepilogo, niente altro.",
      prompt: `Documento da riassumere:\n\n${pageMarkdown}\n\nScrivi ora SOLO il riepilogo di 2-4 frasi, senza alcun commento aggiuntivo.`,
      maxOutputTokens: 1024,
    });
  } catch {
    return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
  }

  const proposedContent = [
    {
      type: "CALLOUT",
      content: { text: [{ type: "text", text: text.trim() }], isExecutiveSummary: true },
    },
  ];

  const suggestion = await prisma.aiSuggestion.create({
    data: {
      tenantId,
      pageId: page.id,
      targetBlockId: existingSummaryBlock?.id ?? null,
      kind: "EXECUTIVE_SUMMARY",
      proposedContent: proposedContent as any,
      requestedById: userId,
    },
  });

  return NextResponse.json({ suggestion }, { status: 201 });
}
