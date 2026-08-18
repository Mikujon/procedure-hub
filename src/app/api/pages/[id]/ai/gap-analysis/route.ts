import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";
import { generateText } from "@/lib/ai/client";
import { blocksToMarkdown } from "@/lib/ai/context";
import { buildBlockTree } from "@/lib/blocks/tree";

/**
 * Compares the page's current content against the structure its Template
 * expects (section headings from Template.blockTemplate) — or, if the page
 * wasn't created from a template, against generic completeness/clarity
 * criteria. Produces observations only (AiSuggestion.notes), never blocks
 * to insert — this kind never has proposedContent to accept.
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

  const page = await prisma.page.findFirst({ where: { id: params.id, tenantId }, include: { template: true } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks = await prisma.block.findMany({ where: { pageId: page.id } });
  const currentMarkdown = blocksToMarkdown(buildBlockTree(blocks));

  const expectedStructure = page.template
    ? `Sezioni attese (dal template "${page.template.name}"):\n${JSON.stringify(page.template.blockTemplate)}`
    : "Questa pagina non ha un template di riferimento: valuta completezza e chiarezza generali (contesto, decisioni/azioni chiare, nessuna sezione palesemente vuota o troppo generica).";

  let text: string;
  try {
    text = await generateText({
      system:
        "Sei un revisore che confronta il contenuto attuale di un documento con la struttura attesa e segnala cosa manca o è incompleto. " +
        "Rispondi ESCLUSIVAMENTE con un array JSON (nessun testo prima o dopo) di oggetti { \"section\": \"...\", \"issue\": \"...\" }. " +
        "Se non trovi problemi, rispondi con un array vuoto []. Non proporre contenuto sostitutivo, solo osservazioni.",
      prompt: `${expectedStructure}\n\nContenuto attuale della pagina:\n${currentMarkdown || "(pagina vuota)"}`,
      maxOutputTokens: 2048,
    });
  } catch {
    return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
  }

  let notes: unknown;
  try {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    notes = JSON.parse(text.slice(start, end + 1));
  } catch {
    return NextResponse.json({ error: "AI response was not valid JSON" }, { status: 502 });
  }

  const suggestion = await prisma.aiSuggestion.create({
    data: {
      tenantId,
      pageId: page.id,
      kind: "GAP_ANALYSIS",
      proposedContent: [],
      notes: notes as any,
      requestedById: userId,
    },
  });

  return NextResponse.json({ suggestion }, { status: 201 });
}
