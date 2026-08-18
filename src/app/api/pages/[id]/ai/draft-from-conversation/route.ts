import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";
import { generateText } from "@/lib/ai/client";
import { parseAiBlockArray, BLOCK_JSON_CONTRACT } from "@/lib/ai/blocks";

const schema = z.object({ transcript: z.string().min(1) });

/**
 * Generates a structured first draft from pasted free text (meeting
 * transcript, chat log, loose notes) — always a Suggestion, never written
 * to the page directly. Non-streaming: this is a one-shot generation the
 * user reviews as a whole, not a live "watch it type" experience like the
 * Q&A endpoint (Parte C).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canEditWorkspace({ id: userId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = await prisma.page.findFirst({
    where: { id: params.id, tenantId },
    include: { template: true },
  });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const structureHint = page.template
    ? `Segui questa struttura di sezioni (stesso ordine, stessi titoli quando ha senso):\n${JSON.stringify(page.template.blockTemplate)}`
    : "Riconosci autonomamente se il contenuto si presta meglio a un PRD, un'Analisi Funzionale o una User Story, e struttura l'output di conseguenza.";

  let text: string;
  try {
    text = await generateText({
      system:
        "Sei un assistente che trasforma trascrizioni/note grezze in una bozza di documento strutturato a blocchi. " +
        "Non inventare fatti non presenti nel testo fornito — se un'informazione manca, lascia la sezione vuota o scrivi '[da definire]'. " +
        structureHint +
        "\n\n" +
        BLOCK_JSON_CONTRACT,
      prompt: parsed.data.transcript,
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

  const suggestion = await prisma.aiSuggestion.create({
    data: {
      tenantId,
      pageId: page.id,
      targetBlockId: null,
      kind: "DRAFT_FROM_CONVERSATION",
      proposedContent: proposedContent as any,
      requestedById: userId,
    },
  });

  return NextResponse.json({ suggestion }, { status: 201 });
}
