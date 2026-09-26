import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { filterVisibleProcedureHits } from "@/lib/permissions";
import { searchProcedures } from "@/lib/search";
import { buildAiContext } from "@/lib/ai/context";
import { streamText } from "@/lib/ai/client";
import { checkAiRateLimit } from "@/lib/rate-limit";

const schema = z.object({ question: z.string().min(1) });

// MeiliSearch is a keyword engine, not semantic: a full natural-language
// question ("Cosa dice la procedura per...?") is mostly stopwords, which
// dilutes relevance against short procedure titles/summaries enough to
// return zero hits even when an obviously-matching procedure exists.
// Stripping them before searching is a cheap, real fix for every question a
// user asks here — not just a demo-data quirk.
const STOPWORDS = new Set([
  "chi", "cosa", "come", "dove", "quando", "perché", "perche", "qual", "quale", "quali",
  "la", "il", "lo", "gli", "le", "di", "del", "della", "dei", "delle", "un", "una", "uno",
  "e", "è", "per", "con", "su", "in", "a", "da", "che", "si", "non", "mi", "ci", "ti", "vi",
  "questo", "questa", "questi", "queste", "dice", "dicono", "fare", "devo", "posso", "sono",
  "essere", "ha", "hanno", "abbiamo", "ce", "sul", "nella", "nel", "delle", "degli",
]);

function extractSearchTerms(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[?!.,;:'"()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return words.length > 0 ? words.join(" ") : question;
}

const NO_RESULTS_MESSAGE =
  "Non ho trovato procedure pubblicate pertinenti a questa domanda. Prova a riformularla, o verifica che la procedura che cerchi sia già pubblicata.";

/**
 * Notion-AI-style natural language Q&A: searches MeiliSearch (Fase 5a),
 * builds full context for the top matches via buildAiContext (Fase 5a),
 * then streams an answer grounded ONLY in that context. Two hard
 * guarantees, both enforced in code rather than trusted to the prompt:
 *  - visibility: search hits are filtered through visibilityWhereClause
 *    before ever reaching the model, so a user never gets an answer that
 *    cites a procedure they couldn't otherwise open.
 *  - no hallucinated answers: if nothing relevant is found, the fixed
 *    NO_RESULTS_MESSAGE is streamed back without ever calling the model —
 *    there's no path where "no sources" can still produce an invented answer.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const limit = await checkAiRateLimit(userId);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Troppe richieste all'assistente AI. Riprova tra qualche minuto." },
      { status: 429, headers: { "Retry-After": String(limit.resetInSeconds) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const results = await searchProcedures(tenantId, extractSearchTerms(parsed.data.question));
  const hitIds = (results.hits as any[]).map((h) => h.id).slice(0, 8);

  // filterVisibleProcedureHits re-checks both status and visibility against
  // Postgres and already preserves hitIds' relevance order — see its own
  // comment in lib/permissions for why a Meili hit list is only ever a set
  // of candidates, not something to cite an AI answer from directly.
  const sources = (await filterVisibleProcedureHits({ id: userId, tenantId, globalRole }, tenantId, hitIds)).slice(0, 5);

  const encoder = new TextEncoder();

  if (sources.length === 0) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(NO_RESULTS_MESSAGE));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Ai-Sources": encodeURIComponent(JSON.stringify([])) },
    });
  }

  const contexts = await Promise.all(sources.map((s) => buildAiContext(s.id)));
  const contextText = contexts
    .map(
      (c, i) =>
        `--- Procedura ${i + 1}: "${c.metadata.title}" (${sources[i].code}, reparto ${c.metadata.department}) ---\n${c.markdown}`
    )
    .join("\n\n");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamText({
          system:
            "Rispondi alla domanda dell'utente usando ESCLUSIVAMENTE le informazioni contenute nelle procedure fornite come contesto. " +
            "Non usare conoscenza generale né inventare dettagli non presenti nel testo. " +
            "Se il contesto non contiene una risposta chiara, dillo esplicitamente invece di indovinare. " +
            "Cita sempre almeno una procedura per nome nella risposta. Rispondi in italiano, in modo diretto e conciso.",
          prompt: `${contextText}\n\nDomanda: ${parsed.data.question}`,
          maxOutputTokens: 2048,
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        controller.enqueue(encoder.encode("\n\n[Errore durante la generazione della risposta.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Ai-Sources": encodeURIComponent(JSON.stringify(sources)),
    },
  });
}
